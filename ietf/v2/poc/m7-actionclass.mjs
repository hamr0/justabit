// PoC module IETF-M7 — actionClass floor axis. A SPIKE for
// draft-hamr-oauth-agent-delegation -01, exploring whether the CAMARA-side
// floor-gate machinery (M3) extends cleanly to an agent-side ACTION floor:
// not "may this agent see the answer" but "may this agent DO this write".
//
// Three new axes, layered on top of (not replacing) M3's existing four:
//   actionClass  — ORDERED enum r < w < x. The link's value is a MAXIMUM the
//                  agent may perform; a child delegation may only lower it.
//   classSource  — ORDERED enum declared < method. `method` (the tighter of
//                  the two) classifies purely from the HTTP method; `declared`
//                  additionally consults the resource owner's signed menu. A
//                  child may only move declared -> method (tightening), never
//                  the reverse.
//   writeBudget  — non-negative integer, monotone DOWN a chain (a child may
//                  lower, never raise), and STATEFUL at admission time: each
//                  admitted w/x request spends one unit; r never spends.
//
// M3's `checkFloor` compares a PUBLISHED (operator) floor against a
// REQUESTED (wire) floor — a different shape from what this module needs,
// which is PARENT delegation link vs CHILD delegation link down a chain
// (draft-hamr-oauth-agent-delegation -01 §"why floors only tighten"). Rather
// than force three axes with different orderings (two enums, one integer,
// one of them requiring an explicit rank table) through M3's axis-kind
// machinery — which only knows `enum` (single-legal-value equality) and
// `duration` — this module is a CLEAN PARALLEL implementation. M3's own four
// axes are untouched, still M3's, still compared the M3 way; nothing here
// calls into m3-floor.mjs. See the report for why this was judged cleaner
// than bolting a third axis-kind onto AXES/invalidValue/checkFloor.
//
// Zero dependencies beyond the copied m1-jws.mjs (node:crypto transitively).

import { verifyJws } from './m1-jws.mjs';

// ---------------------------------------------------------------------------
// Typed reasons. Classified by `.code`, never by message-string parsing —
// same discipline as m1-jws.mjs's ClaimRejected/JwsRejected.
// ---------------------------------------------------------------------------

export class ActionRejected extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ActionRejected';
    this.code = code;
  }
}

function reject(code, message) {
  return { ok: false, reason: new ActionRejected(code, message) };
}

// ---------------------------------------------------------------------------
// Rank tables. Ordering is ALWAYS by explicit rank lookup, never by string
// comparison ('r' < 'w' < 'x' happens to hold lexicographically, but relying
// on that would be an accident this module refuses to lean on, same
// philosophy as M3 refusing to lean on the envelope filtering BigInts).
// ---------------------------------------------------------------------------

const ACTION_CLASS_RANK = Object.freeze({ r: 0, w: 1, x: 2 });
const CLASS_SOURCE_RANK = Object.freeze({ declared: 0, method: 1 }); // method is TIGHTER (higher rank)

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype;
}

function isNonNegativeInteger(v) {
  return Number.isSafeInteger(v) && v >= 0;
}

// ---------------------------------------------------------------------------
// Per-axis validation. Every function here NEVER THROWS on caller input —
// this whole module is untrusted-wire-facing (mirrors M3's normalizeRequested
// / m1-jws's verifyJws: wire input rejects, it never escapes as a raw
// TypeError). Returns a rank/normalized value, or null meaning invalid.
// ---------------------------------------------------------------------------

function actionClassRank(value) {
  if (typeof value !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(ACTION_CLASS_RANK, value)
    ? ACTION_CLASS_RANK[value]
    : null;
}

function classSourceRank(value) {
  if (typeof value !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(CLASS_SOURCE_RANK, value)
    ? CLASS_SOURCE_RANK[value]
    : null;
}

// Effective writeBudget: present + valid non-negative integer -> itself;
// omitted (undefined) -> the declared default 0; anything else -> null
// (invalid — negative, non-integer, wrong type).
function writeBudgetValue(value) {
  if (value === undefined) return 0;
  return isNonNegativeInteger(value) ? value : null;
}

// Effective classSource: present + valid -> itself; omitted -> the declared
// default 'method'; anything else -> null (invalid).
function classSourceValue(value) {
  if (value === undefined) return 'method';
  return classSourceRank(value) !== null ? value : null;
}

// ---------------------------------------------------------------------------
// Link validation. A "link" here is one hop's floor: { actionClass,
// classSource?, writeBudget? }. Fails closed: any malformed link is rejected
// with a typed reason, never partially trusted.
// ---------------------------------------------------------------------------

function validateLink(link) {
  if (!isPlainObject(link)) {
    return reject('MALFORMED_LINK', 'link must be a plain object');
  }
  const acRank = actionClassRank(link.actionClass);
  if (acRank === null) {
    return reject('INVALID_ACTION_CLASS', `invalid actionClass: ${JSON.stringify(link.actionClass)}`);
  }
  const cs = classSourceValue(link.classSource);
  if (cs === null) {
    return reject('INVALID_CLASS_SOURCE', `invalid classSource: ${JSON.stringify(link.classSource)}`);
  }
  const wb = writeBudgetValue(link.writeBudget);
  if (wb === null) {
    return reject('INVALID_WRITE_BUDGET', `invalid writeBudget: ${JSON.stringify(link.writeBudget)}`);
  }
  return {
    ok: true,
    normalized: {
      actionClass: link.actionClass,
      actionClassRank: acRank,
      classSource: cs,
      classSourceRank: classSourceRank(cs),
      writeBudget: wb,
    },
  };
}

// ---------------------------------------------------------------------------
// checkActionFloor(parentFloor, childFloor) — the monotone gate. A child
// link may only TIGHTEN relative to its parent, on all three axes
// independently. Returns
//   { allowed: true, reason: 'ok', effective }             — effective =
//     the child's own normalized values (a child link states ITS OWN floor;
//     unlike M3 there is no "inherit the parent's value" default here — a
//     chain hop always states actionClass explicitly, since M7 has no
//     concept of an omitted actionClass. classSource/writeBudget DO have
//     declared defaults, applied per-link by validateLink above, and those
//     defaults are what appears in `effective` when omitted.)
//   { allowed: false, reason }                              — first failing
//     axis wins, named.
// ---------------------------------------------------------------------------

export function checkActionFloor(parentFloor, childFloor) {
  const p = validateLink(parentFloor);
  if (!p.ok) return { allowed: false, reason: `parent: ${p.reason.message}` };
  const c = validateLink(childFloor);
  if (!c.ok) return { allowed: false, reason: `child: ${c.reason.message}` };

  // actionClass: child rank must be <= parent rank (child may lower, never raise).
  if (c.normalized.actionClassRank > p.normalized.actionClassRank) {
    return { allowed: false, reason: `actionClass raised: ${childFloor.actionClass} > ${parentFloor.actionClass}` };
  }
  // classSource: child rank must be >= parent rank (declared -> method only).
  if (c.normalized.classSourceRank < p.normalized.classSourceRank) {
    return { allowed: false, reason: `classSource loosened: ${c.normalized.classSource} looser than ${p.normalized.classSource}` };
  }
  // writeBudget: child must be <= parent (monotone down).
  if (c.normalized.writeBudget > p.normalized.writeBudget) {
    return { allowed: false, reason: `writeBudget raised: ${c.normalized.writeBudget} > ${p.normalized.writeBudget}` };
  }

  return {
    allowed: true,
    reason: 'ok',
    effective: {
      actionClass: c.normalized.actionClass,
      classSource: c.normalized.classSource,
      writeBudget: c.normalized.writeBudget,
    },
  };
}

// ---------------------------------------------------------------------------
// classify(method, path, menu, classSource) — turns a concrete HTTP request
// into an actionClass, per RFC 9110 method semantics and, when opted in via
// classSource: 'declared', the resource owner's signed menu.
//
// NEVER THROWS on caller input: method/path/menu are all wire-adjacent
// (menu literally IS wire input — a JWS token from the owner).
// ---------------------------------------------------------------------------

const METHOD_DEFAULT = Object.freeze({
  GET: 'r', HEAD: 'r', OPTIONS: 'r',
  PUT: 'w', DELETE: 'w',
  POST: 'x', PATCH: 'x',
});

// RFC 9110 default per spec line 3: GET/HEAD/OPTIONS -> r; PUT/DELETE -> w;
// POST/PATCH -> x; any other or unknown method -> x (the least-trusting
// default: an unrecognized method is treated as maximally capable until an
// owner's menu says otherwise).
function methodDefault(method) {
  if (typeof method !== 'string') return 'x';
  const upper = method.toUpperCase();
  return Object.prototype.hasOwnProperty.call(METHOD_DEFAULT, upper) ? METHOD_DEFAULT[upper] : 'x';
}

// Resolves a menu JWS against the OWNER's public key only. Returns the
// decoded { iss, menu } payload on success, or null on ANY failure
// (malformed token, bad signature, wrong shape) — classify() below treats
// null as "no usable menu", which is exactly the fail-closed-to-method
// behavior the spec calls for.
function resolveMenu(menu, ownerPublicKey) {
  if (typeof menu !== 'string' || !ownerPublicKey) return null;
  const r = verifyJws(menu, () => ownerPublicKey);
  if (!r.ok) return null;
  if (!isPlainObject(r.payload) || typeof r.payload.iss !== 'string' || !isPlainObject(r.payload.menu)) {
    return null;
  }
  return r.payload;
}

/**
 * @param method   HTTP method string (case-insensitive).
 * @param path     request path, e.g. '/bookings'.
 * @param menuInput  { token, ownerPublicKey } | undefined — the signed menu
 *   JWS and the owner's public key to verify it against. Absent/malformed
 *   -> treated exactly like a verification failure (fail closed to method).
 * @param classSource 'method' | 'declared' | undefined (defaults to 'method'
 *   per spec line 2's stated default when omitted).
 * @returns the actionClass string 'r' | 'w' | 'x'. NEVER throws, NEVER
 *   returns anything outside the closed enum.
 */
export function classify(method, path, menuInput, classSource) {
  const def = methodDefault(method);
  const source = classSource === undefined ? 'method' : classSource;
  if (source !== 'declared') {
    // classSource === 'method', or anything else unrecognized: the method
    // default is the safe fallback either way. (Validation of classSource
    // itself, as a link-floor value, is validateLink's job, not classify's —
    // classify's contract is simply "never throw, always return r|w|x".)
    return def;
  }
  const menu = menuInput && typeof menuInput === 'object'
    ? resolveMenu(menuInput.token, menuInput.ownerPublicKey)
    : null;
  if (menu === null) return def; // fail closed to method on any menu failure
  const key = `${typeof method === 'string' ? method.toUpperCase() : method} ${path}`;
  const declared = Object.prototype.hasOwnProperty.call(menu.menu, key) ? menu.menu[key] : undefined;
  if (declared === undefined) return def;
  // Per spec line 3, authoritative paragraph: classSource=declared with a
  // valid menu returns the DECLARED value when present (not max(method,
  // declared) — that would collapse B into A). An invalid declared value
  // (outside r/w/x) is not a class this module recognizes, so it falls back
  // to the method default rather than propagating a bad enum value.
  return Object.prototype.hasOwnProperty.call(ACTION_CLASS_RANK, declared) ? declared : def;
}

// ---------------------------------------------------------------------------
// admit(link, request, state) — the gate. Stateless for actionClass;
// STATEFUL for writeBudget via `state`, a Map keyed by chain id.
// ---------------------------------------------------------------------------

/**
 * @param link  the admitting hop's OWN floor link: { actionClass,
 *   classSource?, writeBudget? } (already the EFFECTIVE link — e.g. the
 *   output of a checkActionFloor chain walk, or a root link).
 * @param request  { method, path, menu?, chainId } — `menu` (optional) is
 *   { token, ownerPublicKey } as classify() expects. Accessed defensively:
 *   a Proxy with a throwing getter must reject typed, never throw.
 * @param state  a Map<chainId, remainingBudget>. Reserve-then-decrement:
 *   the map is seeded lazily from the link's effective writeBudget on first
 *   use for that chainId, then decremented on every admitted w/x request.
 * @returns { ok: true, actionClass, effective } | { ok: false, reason: ActionRejected }
 */
export function admit(link, request, state) {
  let m; // method
  let path;
  let menu;
  let chainId;
  try {
    if (!(state instanceof Map)) {
      return reject('MALFORMED_INPUT', 'state must be a Map');
    }
    const v = validateLink(link);
    if (!v.ok) return v;
    if (!isPlainObject(request) && !(request && typeof request === 'object')) {
      return reject('MALFORMED_INPUT', 'request must be an object');
    }
    // Reads are wrapped: a Proxy with a throwing getter on any of these
    // properties must produce a typed refusal, never an escaping TypeError.
    m = request.method;
    path = request.path;
    menu = request.menu;
    chainId = request.chainId;
    if (typeof chainId !== 'string' || chainId.length === 0) {
      return reject('MALFORMED_INPUT', 'request.chainId must be a non-empty string');
    }

    const { normalized } = v;
    const cls = classify(m, path, menu, normalized.classSource);
    const clsRank = ACTION_CLASS_RANK[cls];

    if (clsRank > normalized.actionClassRank) {
      return reject('ABOVE_ACTION_FLOOR', `classified ${cls} exceeds actionClass floor ${normalized.actionClass}`);
    }

    if (cls === 'r') {
      // r never touches the budget — no reservation, no decrement.
      return { ok: true, actionClass: cls, effective: { actionClass: normalized.actionClass, classSource: normalized.classSource, writeBudget: normalized.writeBudget } };
    }

    // w or x: reserve-then-decrement against this chain's remaining budget.
    // Lazily seeded from the link's effective writeBudget on first sight of
    // this chainId — later admit() calls for the same chainId reuse the
    // Map's own running total, never re-reading the link's writeBudget
    // (that would let a link presented fresh each call refill the budget).
    if (!state.has(chainId)) {
      state.set(chainId, normalized.writeBudget);
    }
    const remaining = state.get(chainId);
    if (typeof remaining !== 'number' || remaining <= 0) {
      return reject('BUDGET_EXHAUSTED', `writeBudget exhausted for chain ${chainId}`);
    }
    state.set(chainId, remaining - 1);
    return {
      ok: true,
      actionClass: cls,
      effective: { actionClass: normalized.actionClass, classSource: normalized.classSource, writeBudget: remaining - 1 },
    };
  } catch {
    // Backstop: a throwing getter anywhere on `request` (or `link`, though
    // validateLink already guards that path) lands here, collapsed to one
    // typed reason — mirrors m1-jws's verifyJws top-level catch.
    return reject('MALFORMED_INPUT', 'request must be a readable plain object');
  }
}

export { ACTION_CLASS_RANK, CLASS_SOURCE_RANK };
