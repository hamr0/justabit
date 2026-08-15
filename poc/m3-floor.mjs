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
  return Number(m[1]) * (m[2] === 'Y' ? 365 : 1);
}

// Why `value` is invalid for `axis`, or null if it is fine.
function invalidValue(axis, value) {
  const spec = AXES[axis];
  if (spec.kind === 'duration') {
    return durationDays(value) === null
      ? `invalid duration: ${axis} ${JSON.stringify(value)} (use P<days>D or P<years>Y; months are ambiguous)`
      : null;
  }
  return value === spec.legal
    ? null
    : `invalid ${axis}: ${JSON.stringify(value)} (profile allows only ${JSON.stringify(spec.legal)})`;
}

// The published floor is the OPERATOR'S OWN config — a broken one must fail
// LOUD (throw), never fail closed-quietly or, worse, open: the spike showed a
// coerced garbage floor compares as 0 days and lets EVERY request through.
// (M2 precedent: seal() throws on the sender's own bad input; wire input never throws.)
function validatePublished(published) {
  if (typeof published !== 'object' || published === null || Array.isArray(published)) {
    throw new Error('invalid published floor: not an object');
  }
  for (const k of Object.keys(published)) {
    if (!Object.prototype.hasOwnProperty.call(AXES, k)) {
      throw new Error(`invalid published floor: unknown field ${k}`);
    }
    const bad = invalidValue(k, published[k]);
    if (bad) throw new Error(`invalid published floor: ${bad}`);
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
  validatePublished(published);

  if (requested === undefined || requested === null) requested = {};
  if (typeof requested !== 'object' || Array.isArray(requested)) {
    return { allowed: false, reason: 'malformed floor' };
  }
  // Validate every requested axis before comparing anything: unknown fields and
  // malformed values are named individually. (A JSON.parse'd "__proto__" arrives
  // as an own key and is caught here as unknown — same behavior M1 probes proved.)
  for (const k of Object.keys(requested)) {
    if (!Object.prototype.hasOwnProperty.call(AXES, k)) {
      return { allowed: false, reason: `unknown floor field: ${k}` };
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
      if (r < p) return { allowed: false, reason: `below floor: ${axis} ${req} < ${pub}` };
      effective[axis] = r === p ? pub : req; // tie keeps the operator's spelling (P2Y over P730D)
    } else {
      effective[axis] = pub; // enum axes: both already validated equal to the single legal value
    }
  }
  return { allowed: true, reason: 'ok', effective };
}
