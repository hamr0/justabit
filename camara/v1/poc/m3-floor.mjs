// PoC module M3 — floor gate. The operator runs this BEFORE answering: is the
// request's demanded floor equal-or-stricter than the operator's published floor
// on EVERY axis? Looser in any way — or unrecognizable in any way — is a
// rejection, never a silently-widened answer (profile rule 5 / FR4).
// Pure logic, zero dependencies, no crypto: M1 signs, M2 seals, M6 composes.

// The four floor axes — a CLOSED set mirroring the spec's Floor schema and M1's
// closed claim set. An unknown or misspelled axis is a rejection: a typo'd axis
// name that were merely ignored would silently DROP a constraint the requester
// believes is enforced — the exact silent-widening path this module exists to kill.
// Enum axes carry exactly one legal value in the consumer-agent profile today.
const AXES = Object.freeze({
  simType: { kind: 'enum', legal: 'voice+data' },
  tenureMin: { kind: 'duration' },
  swapAgeMin: { kind: 'duration' },
  class: { kind: 'enum', legal: 'postpaid' },
  // ADDED 2026-08-17 with the 3 → 6 predicate round (PRD §9, user-signed).
  // `location-verification/v1/verify` has a measured THIRD state, `PARTIAL` — the
  // operator saying "I cannot answer at the resolution you asked for". Under this
  // profile it is REFUSED, never rounded to yes or no, because a rounded answer
  // is signed and indistinguishable on the wire from a real one.
  //
  // The operator PUBLISHES that policy and the requester may only TIGHTEN it,
  // which is this module's existing rule-5 machinery and deliberately NOT a new
  // mechanism. `refuse` is the only legal value today, exactly as `simType` and
  // `class` carry one legal value each: a request demanding anything else — a
  // request asking to have PARTIAL rounded for it — is a LOOSENING and is
  // rejected by the same closed-set gate that rejects a misspelled axis.
  partialPolicy: { kind: 'enum', legal: 'refuse' },
});

// Strict ISO-8601 duration subset: P<int>D or P<int>Y ONLY (decision 2026-08-15).
// 1 year = 365 days — the one stated approximation. Months are REJECTED as
// ambiguous: a month is 28–31 days, so "is P3M >= P90D?" has no honest single
// answer. Coercion is banned by construction: parseInt('3M') === 3 and
// Number(null) === 0 (spike-proven), so a lenient parser would turn garbage —
// or a months value — into a number that PASSES the gate.
function durationDays(value) {
  if (typeof value !== 'string') return null;
  const m = /^P(\d+)(D|Y)$/.exec(value);
  if (!m) return null;
  const days = Number(m[1]) * (m[2] === 'Y' ? 365 : 1);
  // Past 2^53 Number() can collapse a strict ordering into equality, which a
  // strict `<` compare reads as "not below" — a marginally looser request
  // would be admitted. Absurd at profile magnitudes; rejected anyway.
  return Number.isSafeInteger(days) ? days : null;
}

// Render a REJECTED value for the diagnostic. `JSON.stringify` looks safe here
// and is not — measured 2026-08-17 at the M6 composition spike, which is why
// this is the module's declared fix point:
//   * it THROWS on a BigInt ("Do not know how to serialize a BigInt"), and
//   * it CALLS a caller-supplied `toJSON`, so a throwing one throws here too.
// Either replaced this module's loud, named-input rejection with a bare
// TypeError escaping `checkFloor` — breaking the ONE contract the untrusted side
// states ("wire input never throws"), and doing it in the rejection path, i.e.
// exactly when the caller most needs the reason. Neither is reachable through a
// JSON round-trip (`JSON.parse` produces neither a BigInt nor a function), so
// the envelope's transit is what kept it unreachable in the demo — a structural
// accident, not a guarantee this module is entitled to lean on.
//
// So nothing caller-supplied is invoked: primitives render directly and anything
// else is named by KIND. Same shape as M4's `describe()` after its release gate,
// and the `[unrenderable]` floor is here for the same reason — `Array.isArray`
// itself throws on a REVOKED Proxy, which arrives as a plain `typeof 'object'`.
// Length is deliberately NOT clamped: every currently-pinned reason stays
// byte-identical, and bounding the wire-derived reason before it is sealed is
// M6's job (M2's envelope throws above its capacity, so the clamp has to live on
// the side that knows the envelope).
function render(value) {
  const t = typeof value;
  if (t === 'string') return JSON.stringify(value);
  if (t === 'number' || t === 'boolean' || t === 'undefined' || value === null) return String(value);
  if (t === 'bigint') return `${value}n`;      // named as a BigInt, not as the number it prints like
  if (t === 'symbol') return 'symbol';
  if (t === 'function') return 'function';
  try {
    return Array.isArray(value) ? 'array' : 'object';
  } catch {
    return '[unrenderable]';
  }
}

// An UNKNOWN axis NAME is requester-chosen text, and it is the one thing in this
// module's diagnostics that reaches a reason verbatim: every VALUE goes through
// `render` (which JSON-quotes a string, so a newline becomes `\n`) and every
// known axis name is one of this module's own literals. The unknown-axis name is
// neither. Rendered verbatim while it is short and printable, so the common typo
// reads exactly as typed — naming the misspelling is the actionable half — and
// replaced otherwise, so an embedded newline or NUL cannot forge a line in
// whatever log the reason lands in. Same helper, same reason and the same 40-char
// printable-ASCII rule as M6's request-field check and M4's `describeKey`; this
// was the sibling of that guard that the closed-set sweep left unswept.
const fieldName = (k) => (/^[\x20-\x7e]{1,40}$/.test(k) ? k : '(unprintable field name)');

// Why `value` is invalid for `axis`, or null if it is fine.
function invalidValue(axis, value) {
  const spec = AXES[axis];
  if (spec.kind === 'duration') {
    return durationDays(value) === null
      ? `invalid duration: ${axis} ${render(value)} (use P<days>D or P<years>Y; months are ambiguous)`
      : null;
  }
  return value === spec.legal
    ? null
    // `spec.legal` is the module's OWN frozen literal, never caller data, so it
    // is rendered with the same helper only for one spelling of quotes.
    : `invalid ${axis}: ${render(value)} (profile allows only ${render(spec.legal)})`;
}

// The published floor is the OPERATOR'S OWN config — a broken one must fail
// LOUD (throw), never fail closed-quietly or, worse, open: the spike showed a
// coerced garbage floor compares as 0 days and lets EVERY request through.
// (M2 precedent: seal() throws on the sender's own bad input; wire input never throws.)
// Normalizes AND validates — the single owner of the plain-shape predicate —
// and returns a plain own-props snapshot so validation and the compare see the
// SAME data: a prototype-carried axis, a re-read getter, or a non-enumerable
// own prop could otherwise put a value in front of the compare that validation
// never saw (or drop an axis the operator intended to enforce).
function validatePublished(published) {
  if (typeof published !== 'object' || published === null || Array.isArray(published)) {
    throw new Error('invalid published floor: not an object');
  }
  const proto = Object.getPrototypeOf(published);
  if (proto !== Object.prototype && proto !== null) {
    throw new Error('invalid published floor: not a plain object');
  }
  // A non-enumerable own prop passes the prototype check but vanishes in the
  // spread — the operator's intended axis would silently go UNENFORCED.
  if (Object.getOwnPropertyNames(published).length !== Object.keys(published).length) {
    throw new Error('invalid published floor: not a plain object');
  }
  const snapshot = { ...published }; // getters read exactly once, here
  for (const k of Object.keys(snapshot)) {
    if (!Object.prototype.hasOwnProperty.call(AXES, k)) {
      throw new Error(`invalid published floor: unknown field ${k}`);
    }
    const bad = invalidValue(k, snapshot[k]);
    if (bad) throw new Error(`invalid published floor: ${bad}`);
  }
  return snapshot;
}

// Untrusted-side mirror — NEVER throws. A request floor that is not a plain
// data object (prototype-carried axes the spread would silently strip — i.e. a
// demanded constraint dropped, same class as an ignored typo — or a getter
// that throws mid-read) is rejected as malformed, not honored partially.
// Returns the plain snapshot, {} for an absent/null floor (no extra
// strictness demanded — the published floor applies in full, visibly), or
// null meaning "malformed".
function normalizeRequested(requested) {
  if (requested === undefined || requested === null) return {};
  if (typeof requested !== 'object' || Array.isArray(requested)) return null;
  try {
    const proto = Object.getPrototypeOf(requested);
    if (proto !== Object.prototype && proto !== null) return null;
    if (Object.getOwnPropertyNames(requested).length !== Object.keys(requested).length) return null;
    return { ...requested }; // getters read exactly once; a throwing one lands in the catch
  } catch {
    return null;
  }
}

// The gate. `published` = operator config (trusted, throws on garbage).
// `requested` = the floor demanded in the request, off the wire (untrusted:
// never throws, rejects with an exact reason). Returns
//   { allowed: true,  reason: 'ok', effective }   — effective = the floor that
//     was actually enforced, per axis the tighter of the two, so an omitted
//     axis inheriting the published value is VISIBLE, never hidden — or
//   { allowed: false, reason }                     — first failure wins.
export function checkFloor(published, requested) {
  published = validatePublished(published);
  requested = normalizeRequested(requested);
  if (requested === null) return { allowed: false, reason: 'malformed floor' };
  // Validate every requested axis before comparing anything: unknown fields and
  // malformed values are named individually. (A JSON.parse'd "__proto__" arrives
  // as an own key and is caught here as unknown — same behavior M1 probes proved.)
  for (const k of Object.keys(requested)) {
    if (!Object.prototype.hasOwnProperty.call(AXES, k)) {
      return { allowed: false, reason: `unknown floor field: ${fieldName(k)}` };
    }
    const bad = invalidValue(k, requested[k]);
    if (bad) return { allowed: false, reason: bad };
  }

  const effective = {};
  for (const axis of Object.keys(AXES)) {
    const pub = published[axis];
    const req = requested[axis];
    if (pub === undefined && req === undefined) continue;
    if (req === undefined) { effective[axis] = pub; continue; } // inherit: tightening is silent-OK, and visible here
    if (pub === undefined) { effective[axis] = req; continue; } // demanding an axis the operator didn't require = tighter
    if (AXES[axis].kind === 'duration') {
      const p = durationDays(pub);
      const r = durationDays(req);
      // Unreachable after validation — defense in depth: `r < null` would
      // coerce to `r < 0` = false = fail OPEN, the exact trap named above.
      if (p === null || r === null) return { allowed: false, reason: `unparseable duration: ${axis}` };
      if (r < p) return { allowed: false, reason: `below floor: ${axis} ${req} < ${pub}` };
      effective[axis] = r === p ? pub : req; // tie keeps the operator's spelling (P2Y over P730D)
    } else {
      // Unreachable today (each enum axis has exactly one legal value, so
      // validation forces pub === req) — but if a second legal value is ever
      // added, two valid enums are UNORDERED: reject, never silently report
      // the published value as enforced (mirrors the duration branch's guard).
      if (pub !== req) return { allowed: false, reason: `enum mismatch: ${axis}` };
      effective[axis] = pub;
    }
  }
  return { allowed: true, reason: 'ok', effective };
}
