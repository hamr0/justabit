// PoC module M4 — mock facts adapter. The operator-side source of RAW facts
// (swap age, roaming country, reachability) behind the one interface M5 swaps
// for the live Orange Playground, plus the single step that turns facts + a
// predicate into the BIT. Zero dependencies, no crypto, no network, no clock:
// M1 signs the bit, M2 seals it, M3 gates the floor, M6 composes them.
//
// Two rules shape everything here:
//
// 1. THE FACTS SIDE NEVER ANSWERS A QUESTION, AND THE ANSWER SIDE NEVER SEES A
//    RAW VALUE LEAVE. `getFacts` returns raw facts (operator-internal, never
//    wire-bound); `evaluatePredicate` returns `{answered, reason, result}` and
//    nothing else — the closed return IS the profile invariant (rule 2: no raw
//    value reaches the requester in profile mode). The naive "debuggable"
//    return shipped the swap age alongside the bit; the spike observed it
//    surviving JSON.stringify, i.e. reaching the wire.
//
// 2. THE CLOCK IS INJECTED AND THE BACKSTORY IS RELATIVE. A backstory says
//    "swapped 120 days ago", never a date, so a check written today still
//    passes in 2099 (spike: identical age at now=2020 and now=2099). Absolute
//    dates enter only at the M5/Orange boundary, where the Playground hands
//    back `latestSimChange` and the operator differences it against the same
//    injected `now`.
//
// Trusted-vs-untrusted follows M2/M3: the operator's OWN input (backstories,
// numbers, the clock) fails LOUD — a throw naming the fault; wire input (the
// predicate) NEVER throws — it comes back rejected with an exact reason. A
// mock with defaults would break that: every spike trap below ended in a
// confident answer, never an error.

const DAY_MS = 86400000;

// +990 is the Orange Playground's test range and the only range this PoC will
// touch — a real subscriber number must never reach it, not even in a fixture
// (PRD §4.3 / no-go 13). The digit bound covers the Playground's own spellings
// (+99012345678, +990100000099) without admitting an E.164 number elsewhere.
const TEST_NUMBER = /^\+990\d{6,12}$/;
// ISO-3166-1 alpha-2, uppercase and canonical. Not a courtesy: the spike
// observed ['FR'].includes('fr') === false, so a lowercase country silently
// answers "not roaming in FR" about a subscriber who is. Canonical or nothing.
const COUNTRY = /^[A-Z]{2}$/;

// The backstory's CLOSED field set — mirrors the Playground admin model (per
// number: swap date, roaming country, reachability) and M1's closed claim set.
// Every field is REQUIRED and a call REPLACES the whole story: there are no
// defaults and no partial merge, by design. The spike's sharpest trap was a
// `{...DEFAULTS, ...backstory}` merge, where `swapedDaysAgo` (one missing 'p')
// was accepted silently and the fact came from DEFAULTS — a scripted story that
// never took effect, with no error anywhere. With a required closed set the
// same typo is BOTH an unknown field and a missing one, and cannot be silent.
const FIELDS = Object.freeze({
  swappedDaysAgo: 'dayCount',
  roamingCountry: 'countryOrNull',
  reachable: 'boolean',
});

// The predicate types this adapter's facts can answer — closed, one fact and
// one operator each. An unrecognized type must NOT fall through to a compare:
// the spike observed a naive evaluate answering a typo'd type with a clean
// `false`, i.e. a signed "no" to a question that was never asked. Whether that
// reads as safe depends entirely on the question's polarity, which is exactly
// why it can never be an answer.
// `reachable` has no counterpart in `spec/carrier-attestation.yaml`'s
// illustrative Predicate enum (see findings 2026-08-16) — reachability is a
// required mock FACT (PRD FR5), and a fact no predicate can consume is dead
// weight, so the type is carried here and flagged rather than minted silently.
const PREDICATES = Object.freeze({
  simSwapAge: { operator: 'gte', value: 'duration', fact: 'swapAgeMs' },
  roamingIn: { operator: 'in', value: 'countries', fact: 'roamingCountry' },
  reachable: { operator: 'eq', value: 'boolean', fact: 'reachable' },
});
const PREDICATE_KEYS = Object.freeze(['type', 'operator', 'value']);

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// A diagnostic rendering of an arbitrary value that CANNOT throw and CANNOT
// run away. `JSON.stringify` alone does both (M3 release-gate open item 1:
// BigInt, circular, and a throwing `toJSON` all escape as raw TypeErrors),
// which would break "wire input never throws" from inside the error message.
// Clamped because a diagnostic built from caller-supplied data can end up in a
// log verbatim.
// EVERY fallback is guarded in turn, because every one of them runs
// caller-supplied code: `JSON.stringify` runs `toJSON`, `String` runs
// `toString`/`valueOf`/`Symbol.toPrimitive`, and even `Object.prototype
// .toString` reads a `Symbol.toStringTag` GETTER. The 2026-08-16 review round
// measured the last one escaping — with all three hostile at once the renderer
// threw, and `evaluatePredicate` threw with it, breaking "wire input never
// throws" from inside the message written to prevent exactly that. The final
// constant cannot throw, so the function now has a floor.
function describe(value) {
  let s;
  try {
    s = JSON.stringify(value);
  } catch { /* BigInt / circular / throwing toJSON */ }
  if (s === undefined) {
    try { s = String(value); } catch { /* throwing toString / valueOf / Symbol.toPrimitive */ }
  }
  if (typeof s !== 'string') {
    try { s = Object.prototype.toString.call(value); } catch { /* throwing Symbol.toStringTag */ }
  }
  if (typeof s !== 'string') s = '[unrenderable]';
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}

// Strict ISO-8601 duration subset, byte-for-byte the same rule M3 applies to
// floors: P<int>D or P<int>Y only, 1Y = 365D declared, months REJECTED as
// ambiguous (a month is 28–31 days, so "is P3M ≥ P90D?" has no honest single
// answer). Deliberately duplicated rather than imported: PRD §4.4 requires each
// module to work alone, and M3 keeps its parser private. M6 folds the two.
// Coercion is banned by construction — the spike measured parseInt('90D') === 90
// and Number(null) === 0, either of which invents a threshold out of garbage.
function durationMs(value) {
  if (typeof value !== 'string') return null;
  const m = /^P(\d+)(D|Y)$/.exec(value);
  if (!m) return null;
  const ms = Number(m[1]) * (m[2] === 'Y' ? 365 : 1) * DAY_MS;
  // Past 2^53 an ordering collapses into equality, and `>=` then reads a
  // marginally-too-fresh SIM as old enough. Absurd at profile magnitudes; the
  // same guard M3 pins, rejected anyway.
  return Number.isSafeInteger(ms) ? ms : null;
}

// Why `value` is invalid for backstory field `field`, or null if it is fine.
// Every message names the coercion that is NOT happening, because the spike
// showed each of these silently "working": '120' arithmetic-coerces to 120,
// null to 0 days (a confident "swapped today"), true to 1 day.
function invalidField(field, value) {
  switch (FIELDS[field]) {
    case 'dayCount':
      // isSafeInteger rejects strings, null, booleans, NaN and fractions
      // outright; the product bound keeps the ms conversion exact.
      return Number.isSafeInteger(value) && value >= 0 && Number.isSafeInteger(value * DAY_MS)
        ? null
        : `invalid swappedDaysAgo: ${describe(value)} (whole days as a non-negative number; strings, null and booleans are NOT coerced)`;
    case 'countryOrNull':
      return value === null || (typeof value === 'string' && COUNTRY.test(value))
        ? null
        : `invalid roamingCountry: ${describe(value)} (ISO-3166-1 alpha-2 uppercase, or null for not roaming)`;
    default:
      return typeof value === 'boolean'
        ? null
        : `invalid reachable: ${describe(value)} (boolean true or false, never a string)`;
  }
}

// Plain own-data snapshot, or null if the input is not plain data. Same shape
// M3 settled on, and load-bearing for the same measured reason: the spike put a
// backstory's axis on the PROTOTYPE and then as a NON-ENUMERABLE own property,
// and both times the spread dropped it and the adapter answered from defaults —
// a scripted story silently not in force. Never throws (a throwing getter lands
// in the catch), so both the trusted and untrusted callers can use it.
// `Array.isArray` is deliberately REDUNDANT and known to be so: mutation-tested
// 2026-08-16, removing it kills nothing, and a probe over 8 array shapes
// (including prototype-rewritten and subclassed ones) showed every array is
// already caught below — `length` is a non-enumerable own property, so the
// own-property-count check catches even an array wearing Object.prototype. It
// stays because "a list is not a record" is worth saying out loud at the top,
// and it mirrors M3; it is NOT relied upon. See findings 2026-08-16.
function plainSnapshot(o) {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return null;
  try {
    const proto = Object.getPrototypeOf(o);
    if (proto !== Object.prototype && proto !== null) return null;
    if (Object.getOwnPropertyNames(o).length !== Object.keys(o).length) return null;
    return { ...o }; // getters read exactly once, here
  } catch {
    return null;
  }
}

function assertTestNumber(number) {
  if (typeof number !== 'string' || !TEST_NUMBER.test(number)) {
    throw new Error(`invalid number: ${describe(number)} (+990 test range only — a real subscriber number must never reach the PoC)`);
  }
}

// The adapter. One instance = one operator's scriptable subscriber base.
// `setBackstory` is callable mid-run, mirroring the Playground's Admin API:
// re-scripting a number and re-asking is exactly how the FR1 negative is shown.
export function createMockFacts() {
  const store = new Map();

  // Operator-side write. Trusted input, so every fault is a THROW naming the
  // field — a mis-scripted backstory that came back quietly would leave the
  // demo asserting against a story that never took effect.
  function setBackstory(number, backstory) {
    assertTestNumber(number);
    const snapshot = plainSnapshot(backstory);
    if (snapshot === null) throw new Error(`invalid backstory for ${number}: not a plain object`);
    // Unknown before missing: a typo trips both, and naming the typo'd spelling
    // is the actionable half.
    for (const k of Object.keys(snapshot)) {
      if (!hasOwn(FIELDS, k)) throw new Error(`invalid backstory for ${number}: unknown field ${k}`);
    }
    for (const k of Object.keys(FIELDS)) {
      if (!hasOwn(snapshot, k)) throw new Error(`invalid backstory for ${number}: missing field ${k} (all fields required — the mock has no defaults)`);
      const bad = invalidField(k, snapshot[k]);
      if (bad) throw new Error(`invalid backstory for ${number}: ${bad}`);
    }
    // The snapshot, never the caller's object: otherwise mutating that object
    // after the call would silently re-write history for every later query —
    // and the validation above would have been performed on different data.
    store.set(number, snapshot);
  }

  // Operator-side read. `nowMs` is INJECTED — the mock never reads a wall
  // clock, so a case is deterministic forever.
  function getFacts(number, nowMs) {
    assertTestNumber(number);
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
      throw new Error(`invalid now: ${describe(nowMs)} (unix epoch ms as a safe integer — the clock is injected, never read)`);
    }
    const b = store.get(number);
    // Loud, never a default backstory: the spike watched a naive `?? DEFAULTS`
    // hand back a confident 365-day-old SIM for a number nobody ever scripted.
    // A fabricated fact is worse than no answer — it is signed downstream.
    if (b === undefined) {
      throw new Error(`unknown number: ${number} (no backstory scripted — the mock has no default backstory, because answering for a subscriber that does not exist is a fabricated fact)`);
    }
    // The relative→absolute conversion, and the ONLY place it happens. It looks
    // like a round trip because in the mock it is one; it is kept because it is
    // the single line M5 replaces — there `swappedAtMs` comes from Orange's
    // `latestSimChange` and the age is differenced against the same injected
    // `now`. Exact in both directions: both operands are non-negative safe
    // integers, so the difference cannot leave the safe range.
    const swappedAtMs = nowMs - b.swappedDaysAgo * DAY_MS;
    // Frozen: facts are operator-internal, and an M6 caller mutating them
    // in place would rewrite the input to the bit after the fact.
    return Object.freeze({
      swapAgeMs: nowMs - swappedAtMs,
      roamingCountry: b.roamingCountry,
      reachable: b.reachable,
    });
  }

  return { setBackstory, getFacts };
}

// Facts + predicate → the BIT. The predicate arrives off the wire, so this
// NEVER throws: it returns `{answered: false, reason}` with an exact reason, or
// `{answered: true, reason: 'ok', result}` — and the success shape carries the
// boolean and NOTHING else. Keeping this out of `getFacts` is what makes M5 a
// drop-in: the backend swaps the facts source, this step is unchanged.
export function evaluatePredicate(facts, predicate) {
  const p = plainSnapshot(predicate);
  if (p === null) return { answered: false, reason: 'malformed predicate' };
  const f = plainSnapshot(facts);
  if (f === null) return { answered: false, reason: 'malformed facts' };

  if (typeof p.type !== 'string' || !hasOwn(PREDICATES, p.type)) {
    return { answered: false, reason: `unknown predicate type: ${describe(p.type)}` };
  }
  const spec = PREDICATES[p.type];
  // Closed predicate field set (M1's closed claim set, M3's closed axis set).
  // An ignored extra field is a constraint the requester believes is enforced
  // and is not — the silent-widening class, arriving on the predicate.
  const extra = Object.keys(p).filter((k) => !PREDICATE_KEYS.includes(k));
  if (extra.length > 0) {
    return { answered: false, reason: `unexpected predicate fields: ${extra.join(', ')}` };
  }
  if (p.operator !== spec.operator) {
    return { answered: false, reason: `wrong operator for ${p.type}: ${describe(p.operator)} (expected ${JSON.stringify(spec.operator)})` };
  }

  const fact = f[spec.fact];
  let result;
  if (spec.value === 'duration') {
    const threshold = durationMs(p.value);
    if (threshold === null) {
      return { answered: false, reason: `invalid duration: ${describe(p.value)} (use P<days>D or P<years>Y; months are ambiguous)` };
    }
    // A missing or malformed fact must NOT compare: `undefined >= n` is false,
    // which would answer "the SIM is not old enough" about a SIM nobody looked
    // up. Unanswerable is a distinct outcome from `false`.
    if (!Number.isSafeInteger(fact) || fact < 0) {
      return { answered: false, reason: `fact unavailable: ${spec.fact}` };
    }
    result = fact >= threshold;
  } else if (spec.value === 'countries') {
    if (!Array.isArray(p.value) || p.value.length === 0 ||
        !p.value.every((c) => typeof c === 'string' && COUNTRY.test(c))) {
      // An empty set is rejected rather than answered: it is false for every
      // subscriber alive, so it is a malformed question, not a question.
      return { answered: false, reason: `invalid country set: ${describe(p.value)} (ISO-3166-1 alpha-2 uppercase, at least one)` };
    }
    if (!(fact === null || (typeof fact === 'string' && COUNTRY.test(fact)))) {
      return { answered: false, reason: `fact unavailable: ${spec.fact}` };
    }
    // `null` = not roaming, so "in this set" is honestly false — a real answer,
    // not a fallback.
    result = p.value.includes(fact);
  } else {
    if (typeof p.value !== 'boolean') {
      return { answered: false, reason: `invalid ${p.type} value: ${describe(p.value)} (boolean true or false, never a string)` };
    }
    if (typeof fact !== 'boolean') {
      return { answered: false, reason: `fact unavailable: ${spec.fact}` };
    }
    result = fact === p.value;
  }

  // The closed answer. `result` is the whole disclosure: no age, no date, no
  // country, no number — profile rule 2, enforced in the artifact rather than
  // promised in the prose.
  return { answered: true, reason: 'ok', result };
}
