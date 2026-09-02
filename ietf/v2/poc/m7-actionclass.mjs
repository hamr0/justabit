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

import { createHash } from 'node:crypto';
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

// hasOwn(obj, key) — presence test for the omitted-axis rule below. NEVER
// `in` and NEVER a truthiness/bracket check: an axis value of 0
// (writeBudget) or 'method' (classSource) is a legitimate, falsy-adjacent
// value that a naive check would misread as "omitted".
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function checkActionFloor(parentFloor, childFloor) {
  const p = validateLink(parentFloor);
  if (!p.ok) return { allowed: false, reason: `parent: ${p.reason.message}` };
  const c = validateLink(childFloor);
  if (!c.ok) return { allowed: false, reason: `child: ${c.reason.message}` };

  // actionClass: child rank must be <= parent rank (child may lower, never raise).
  // (No link-to-link omitted-axis check is needed here: draft -01 gives
  // actionClass no omission semantics at all — a chain hop always states it
  // explicitly — and validateLink above already hard-rejects a child link
  // that omits it, via INVALID_ACTION_CLASS, before this function runs.)
  if (c.normalized.actionClassRank > p.normalized.actionClassRank) {
    return { allowed: false, reason: `actionClass raised: ${childFloor.actionClass} > ${parentFloor.actionClass}` };
  }

  // classSource omitted-axis rule (draft -01 axis-registry, link-to-link
  // case; attenuation rule 2): where the PARENT link constrains classSource
  // as its own property and the CHILD link omits it, that omission is
  // non-relaxation-by-omission and the chain MUST be rejected — never
  // silently defaulted to 'method'. Only where NEITHER link constrains the
  // axis does the link-to-published-floor case (inheritance, via
  // validateLink's own declared default) apply.
  if (hasOwn(parentFloor, 'classSource') && !hasOwn(childFloor, 'classSource')) {
    return { allowed: false, reason: 'classSource omitted: parent link constrains it, child link must not omit it' };
  }
  // classSource: child rank must be >= parent rank (declared -> method only).
  if (c.normalized.classSourceRank < p.normalized.classSourceRank) {
    return { allowed: false, reason: `classSource loosened: ${c.normalized.classSource} looser than ${p.normalized.classSource}` };
  }

  // writeBudget omitted-axis rule — same shape as classSource's, above.
  if (hasOwn(parentFloor, 'writeBudget') && !hasOwn(childFloor, 'writeBudget')) {
    return { allowed: false, reason: 'writeBudget omitted: parent link constrains it, child link must not omit it' };
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

// Resolves a menu JWS against the OWNER's public key only, and binds it to
// the resource being called. Returns the decoded { iss, menu } payload on
// success, or null on ANY failure (malformed token, bad signature, wrong
// shape, OR an iss that does not match the request target's origin) —
// classify() below treats null as "no usable menu", which is exactly the
// fail-closed-to-method behavior the spec calls for. Per -01's declared-menu
// origin-binding rule: "A menu applies only to the resource that issued
// it. [...] where the two do not match, the menu fails, exactly as if its
// signature had not verified." `targetOrigin` is the RFC 6454 origin of the
// request target, supplied by the caller (the verifier already knows what
// resource it is verifying against — this is not wire input from the menu
// itself).
function resolveMenu(menu, ownerPublicKey, targetOrigin) {
  if (typeof menu !== 'string' || !ownerPublicKey) return null;
  const r = verifyJws(menu, () => ownerPublicKey);
  if (!r.ok) return null;
  if (!isPlainObject(r.payload) || typeof r.payload.iss !== 'string' || !isPlainObject(r.payload.menu)) {
    return null;
  }
  if (r.payload.iss !== targetOrigin) return null;
  return r.payload;
}

// ---------------------------------------------------------------------------
// Path-template matching (draft -01 "The Declared Menu"): a menu operation
// key has the form "METHOD path-template", where a brace-delimited template
// segment ({callId}) matches exactly one non-empty request path segment. A
// request matches a key only where both have the same method and the same
// number of path segments, and every segment position is either a literal
// equal to the request's segment or a parameter matching a non-empty
// segment. Where more than one key matches, the key with the greater number
// of LITERAL segments governs; an equal-literal tie across distinct keys is
// a miss, never resolved by JSON key order or any other means.
// ---------------------------------------------------------------------------

function pathSegments(path) {
  return typeof path === 'string' ? path.split('/') : null;
}

function isParamSegment(seg) {
  return typeof seg === 'string' && seg.length >= 2 && seg[0] === '{' && seg[seg.length - 1] === '}';
}

// Matches one template's segments against one request's segments. Returns
// the literal-segment count on a match, or null on no match (segment count
// differs, a literal segment doesn't equal, or a parameter segment meets an
// empty request segment).
function matchTemplateSegments(templateSegs, requestSegs) {
  if (templateSegs.length !== requestSegs.length) return null;
  let literalCount = 0;
  for (let i = 0; i < templateSegs.length; i += 1) {
    const t = templateSegs[i];
    const req = requestSegs[i];
    if (isParamSegment(t)) {
      if (typeof req !== 'string' || req.length === 0) return null;
    } else {
      if (t !== req) return null;
      literalCount += 1;
    }
  }
  return literalCount;
}

// Looks up `method path` against every key of `menu` (own enumerable keys
// only, via Object.keys — never a prototype-walking `in`/bare-access
// lookup, so a menu key literally named "__proto__" — a real own property
// when the menu arrives via JSON.parse, as every menu here does via
// verifyJws — is matched exactly like any other string key). Returns the
// declared value on an unambiguous match, or undefined on no match OR an
// equal-literal-segment tie (a tie is deliberately indistinguishable from a
// miss to every caller of this function).
function matchOperationKey(menu, method, path) {
  const upperMethod = typeof method === 'string' ? method.toUpperCase() : method;
  const requestSegs = pathSegments(path);
  if (requestSegs === null) return undefined;
  let bestLiteralCount = -1;
  let bestValue;
  let tie = false;
  for (const key of Object.keys(menu)) {
    const spaceIdx = key.indexOf(' ');
    if (spaceIdx === -1) continue;
    const keyMethod = key.slice(0, spaceIdx);
    if (keyMethod !== upperMethod) continue;
    const templateSegs = pathSegments(key.slice(spaceIdx + 1));
    if (templateSegs === null) continue;
    const literalCount = matchTemplateSegments(templateSegs, requestSegs);
    if (literalCount === null) continue;
    if (literalCount > bestLiteralCount) {
      bestLiteralCount = literalCount;
      bestValue = menu[key];
      tie = false;
    } else if (literalCount === bestLiteralCount) {
      tie = true;
    }
  }
  if (bestLiteralCount === -1 || tie) return undefined;
  return bestValue;
}

// ---------------------------------------------------------------------------
// deriveChainId(rootSignature) — draft -01 "Chain Identifier": the chain
// identifier that keys the writeBudget count MUST be derived by the
// verifier itself, as the SHA-256 digest of the octet string that is L(0)'s
// signature value, in whatever encoding that signature is carried on the
// wire — never taken from a value the request supplies. `rootSignature` is
// the wire form of L(0)'s signature as the verifier itself already
// extracted and verified it (this is verifier-held input, not a
// caller-supplied request field): a base64url string (matching the JWS
// signature-segment encoding this repo's own credential format uses), or
// already-decoded bytes (Buffer/Uint8Array).
//
// A string input MUST be validated against the strict base64url alphabet
// (A-Z, a-z, 0-9, '-', '_') BEFORE decoding: Node's Buffer.from(s,
// 'base64url') does not throw on a character outside that alphabet, it
// silently strips it and decodes whatever is left, which makes two
// distinct strings collide on one digest. The alphabet check alone does
// NOT eliminate every collision, though: Buffer.from(s, 'base64url') also
// silently DISCARDS the low-order bits of a final partial group when
// s.length mod 4 is 2 or 3 (and drops the whole trailing character when
// s.length mod 4 is 1), rather than rejecting them — so e.g. 'AA', 'AB',
// 'AC' and 'AD' are all in-alphabet, all length 2, and all decode to the
// same single zero byte. Closing THIS collision class requires a second,
// independent check after decoding: the decoded bytes are re-encoded with
// the same .toString('base64url') convention this module's own strings
// use, and the input is rejected unless that re-encoding reproduces the
// original string EXACTLY. Only the canonical unpadded base64url encoding
// of a byte string round-trips to itself this way, so this check accepts a
// string if and only if it IS that canonical encoding — collapsing the
// "many strings decode to the same bytes" class down to exactly one
// accepted spelling per byte string. It also rejects every length-mod-4-
// equals-1 string as a side effect (no such string can ever round-trip),
// so no separate length check is needed for that case either. This module
// treats base64url as UNPADDED, matching m1-jws.mjs's own
// toString('base64url') output convention (no trailing '='): a '='
// character is therefore invalid input here (rejected by the alphabet
// check, before the canonical check even runs), same as any other
// out-of-alphabet character.
//
// Returns a lowercase hex digest, or null if `rootSignature` is not a
// usable, canonically-encoded byte source. Never throws (reject-never-
// throw, mirrors every other wire-facing function in this module).
// ---------------------------------------------------------------------------

const BASE64URL_STRICT_RE = /^[A-Za-z0-9_-]+$/;

export function deriveChainId(rootSignature) {
  let bytes;
  if (typeof rootSignature === 'string') {
    if (rootSignature.length === 0) return null;
    if (!BASE64URL_STRICT_RE.test(rootSignature)) return null;
    try {
      bytes = Buffer.from(rootSignature, 'base64url');
    } catch {
      return null;
    }
    // Canonical round-trip: reject unless re-encoding the decoded bytes
    // reproduces the original string exactly (see the comment above).
    if (bytes.toString('base64url') !== rootSignature) return null;
  } else if (Buffer.isBuffer(rootSignature) || rootSignature instanceof Uint8Array) {
    bytes = Buffer.from(rootSignature);
  } else {
    return null;
  }
  if (bytes.length === 0) return null;
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * @param method   HTTP method string (case-insensitive).
 * @param path     request path, e.g. '/bookings'.
 * @param menuInput  { token, ownerPublicKey } | undefined — the signed menu
 *   JWS and the owner's public key to verify it against. Absent/malformed
 *   -> treated exactly like a verification failure (fail closed to method).
 * @param classSource 'method' | 'declared' | undefined (defaults to 'method'
 *   per spec line 2's stated default when omitted).
 * @param targetOrigin  the RFC 6454 origin of the request target, as the
 *   verifier itself knows it (not wire input from the menu). Required for
 *   the menu's iss to be usable at all — draft -01's declared-menu rule
 *   binds the menu octet-for-octet to this value; any mismatch, including
 *   an omitted targetOrigin, fails the menu exactly like an invalid
 *   signature would.
 * @returns the actionClass string 'r' | 'w' | 'x'. NEVER throws, NEVER
 *   returns anything outside the closed enum.
 */
export function classify(method, path, menuInput, classSource, targetOrigin) {
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
    ? resolveMenu(menuInput.token, menuInput.ownerPublicKey, targetOrigin)
    : null;
  if (menu === null) return def; // fail closed to method on any menu failure
  // Path-template matching (draft -01 "The Declared Menu"), never an
  // exact-string lookup: an undefined return covers both "no key matches"
  // and "an equal-literal-segment tie between distinct keys", per
  // matchOperationKey's own contract.
  const declared = matchOperationKey(menu.menu, method, path);
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
 * @param request  { method, path, menu?, targetOrigin?, rootSignature } —
 *   `menu` (optional) is { token, ownerPublicKey } as classify() expects;
 *   `targetOrigin` (optional, but required for a declared menu to be
 *   usable) is the RFC 6454 origin of the request target; `rootSignature`
 *   is L(0)'s wire signature value, from which the chain identifier that
 *   keys the writeBudget count is derived per draft -01's Chain Identifier
 *   rule (deriveChainId above) — the verifier's own extracted, already-
 *   verified value, never a caller-supplied identifier field. A request
 *   object MAY carry other fields (e.g. a caller-supplied "chainId"-shaped
 *   field); admit() never reads any field but the ones named here, so such
 *   a field has no effect. Accessed defensively: a Proxy with a throwing
 *   getter must reject typed, never throw.
 * @param state  a Map<derivedChainId, remainingBudget>. Reserve-then-
 *   decrement: the map is seeded lazily from the link's effective
 *   writeBudget on first use for a derived chain id, then decremented on
 *   every admitted w/x request.
 * @returns { ok: true, actionClass, effective } | { ok: false, reason: ActionRejected }
 */
export function admit(link, request, state) {
  let m; // method
  let path;
  let menu;
  let targetOrigin;
  let rootSignature;
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
    // request.chainId (or any other field) is deliberately never read here:
    // the chain identifier is derived below from rootSignature alone, never
    // taken from a value the request supplies.
    m = request.method;
    path = request.path;
    menu = request.menu;
    targetOrigin = request.targetOrigin;
    rootSignature = request.rootSignature;
    const chainId = deriveChainId(rootSignature);
    if (chainId === null) {
      return reject('MALFORMED_INPUT', 'request.rootSignature must be L(0)\'s wire signature bytes');
    }

    const { normalized } = v;
    const cls = classify(m, path, menu, normalized.classSource, targetOrigin);
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
    // this derived chainId — later admit() calls for the same chain (same
    // rootSignature -> same derived chainId) reuse the Map's own running
    // total, never re-reading the link's writeBudget (that would let a link
    // presented fresh each call refill the budget). Because chainId is
    // derived from rootSignature and never from a caller-supplied field, no
    // request field the caller controls can mint a fresh key into this Map.
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
