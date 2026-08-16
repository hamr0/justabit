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
// `reachable` was carried here ahead of the spec sketch and flagged rather than
// minted silently; on the user's decision (2026-08-16) it is now also in
// `spec/carrier-attestation.yaml`'s illustrative Predicate enum. Reachability is
// a required mock FACT (PRD FR5), and a fact no predicate can consume is dead
// weight. The sketch is illustrative, not normative — the normative profile
// (proposal rules 1–8) enumerates no predicate types, so nothing else moved.
const PREDICATES = Object.freeze({
  simSwapAge: { operator: 'gte', value: 'duration', fact: 'swapAgeMs' },
  roamingIn: { operator: 'in', value: 'countries', fact: 'roamingCountry' },
  reachable: { operator: 'eq', value: 'boolean', fact: 'reachable' },
});
const PREDICATE_KEYS = Object.freeze(['type', 'operator', 'value']);

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// A field/key NAME is caller-chosen text too: render it verbatim only when it
// is short and printable (so the common typo reads exactly as typed), otherwise
// through describe() — measured 2026-08-16, a 5000-char newline-bearing key
// rode into a throw message raw, the one diagnostic on the path that skipped
// the clamp (an embedded newline in a logged message can forge a log line).
const describeKey = (k) => (/^[\x20-\x7e]{1,60}$/.test(k) ? k : describe(k));

// A diagnostic rendering of an arbitrary value that CANNOT throw and CANNOT
// run away. Clamped because a diagnostic built from caller-supplied data can
// end up in a log verbatim.
//
// The 2026-08-16 REVIEW round built this out of three guarded fallbacks
// (`JSON.stringify` → `String` → `Object.prototype.toString`), because each one
// runs caller code — `toJSON`, `toString`/`valueOf`/`Symbol.toPrimitive`, and a
// `Symbol.toStringTag` GETTER respectively — and with all three hostile at once
// the renderer threw, taking `evaluatePredicate` with it.
//
// The 2026-08-16 RELEASE GATE showed that guarding those calls was never
// enough, and the claim this comment used to make ("bound the INPUT before
// rendering") was measurably false in two directions:
//   * a try/catch bounds a THROW, not an ALLOCATION — a `toJSON` returning
//     `'x'.repeat(3e8)` killed the process at exit 134 (SIGABRT, fatal OOM
//     inside V8's JsonStringifier), which no catch can degrade; and
//   * the input bound only ever covered a TOP-LEVEL long string and an array's
//     LENGTH, so a long string one level down was still serialized in full
//     (measured: 657ms nested vs 83ms for the same 50MB string at top level).
// So the fallback chain is gone. Nothing caller-supplied is invoked at all now:
// primitives render directly, arrays render at most DESC_MAX_ITEMS elements one
// level deep, and an object is described by its KEY NAMES. The `[unrenderable]`
// floor still cannot throw, and is still reachable — by a revoked Proxy, where
// enumeration itself throws.
const DESC_MAX_OUT = 60;      // the printed clamp
// Per string, BEFORE it is rendered — and deliberately BELOW DESC_MAX_OUT. At
// 64 the per-string clamp was real but invisible: the 60-char output clamp
// always cut first, so no assertion could tell a clamped string from an
// unclamped one and the bound could regress silently. Below the output clamp it
// shows up in the rendered text, which is what makes case 33 able to fail.
const DESC_MAX_STRING = 48;
const DESC_MAX_ITEMS = 16;    // array elements rendered individually
const DESC_MAX_KEYS = 8;      // object keys named individually

// Render a value structurally, WITHOUT invoking a single caller-supplied
// conversion. This is the shape the 2026-08-16 release gate forced, and the
// reason is measured, not theoretical: the previous version reached for
// `JSON.stringify` → `String` → `Object.prototype.toString` in turn, and every
// one of those runs caller code (`toJSON`, `toString`/`valueOf`/
// `Symbol.toPrimitive`, a `Symbol.toStringTag` getter). Guarding each with a
// try/catch bounds a THROW; it cannot bound an ALLOCATION. A ~40-byte predicate
// whose `toJSON` returned `'x'.repeat(3e8)` killed the process outright —
// exit 134, SIGABRT, fatal OOM inside V8's `JsonStringifier::Stringify`, which
// no `catch` can degrade. That is strictly worse than the throw this renderer
// exists to prevent: a dead process cannot return `{answered: false}`.
// So: primitives are rendered directly (bounded, no user code), arrays are
// walked at most DESC_MAX_ITEMS deep-1, and an object is described by its KEY
// NAMES only — never by its values, never through a conversion hook. The old
// three-fallback chain also walked NESTED values in full (measured: a 50MB
// string inside a one-element array cost 657ms against 83ms for the same string
// at top level, where the input bound did apply); rendering each element
// through the same clamp closes that too.
function renderValue(value, depth) {
  if (value === null) return 'null';
  const t = typeof value;
  // JSON.stringify on a STRING cannot run user code and cannot throw; the slice
  // happens first, so what gets rendered is bounded whatever arrived.
  if (t === 'string') {
    return JSON.stringify(value.length > DESC_MAX_STRING
      ? `${value.slice(0, DESC_MAX_STRING)}…`   // the marker rides INSIDE the quotes
      : value);
  }
  // `String` on a primitive is the primitive's own spec-defined conversion —
  // no caller code exists to run. NaN now prints as `NaN` rather than the
  // `null` JSON.stringify used to give it, which is the honest spelling.
  if (t === 'number' || t === 'boolean' || t === 'undefined' || t === 'bigint' || t === 'symbol') {
    return String(value);
  }
  if (t === 'function') return '[function]';
  if (Array.isArray(value)) {
    const n = value.length;                       // captured once, as in countrySet
    if (!Number.isSafeInteger(n) || n > DESC_MAX_ITEMS || depth <= 0) return `[array of ${n}]`;
    const parts = [];
    for (let i = 0; i < n; i += 1) parts.push(renderValue(value[i], depth - 1));
    return `[${parts.join(',')}]`;
  }
  // Key NAMES only. `getOwnPropertyNames` reads no accessor and calls no hook,
  // so a getter that would allocate a gigabyte never runs; depth is irrelevant
  // because values are never visited. A hostile `ownKeys` trap can still throw
  // (revoked Proxy) — that lands in describe()'s catch and the floor answers.
  const names = Object.getOwnPropertyNames(value);
  if (names.length > DESC_MAX_KEYS) return `{object with ${names.length} keys}`;
  return `{${names.map(describeKey).join(', ')}}`;
}

function describe(value) {
  let s;
  try {
    s = renderValue(value, 1);
  } catch { /* revoked proxy: even Array.isArray / getOwnPropertyNames throw */ }
  // The floor still cannot throw, and is still reachable — a revoked Proxy is
  // now the shape that lands here.
  if (typeof s !== 'string') s = '[unrenderable]';
  return s.length > DESC_MAX_OUT ? `${s.slice(0, DESC_MAX_OUT)}…` : s;
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

// Defensive copy of a wire-supplied country set, or null if it is not a valid
// one. plainSnapshot copies the predicate's TOP level only, so `p.value` is
// still the requester's own array object — and iterating it directly runs
// caller-controlled code. Measured 2026-08-16, three ways the sibling
// `.every(...)`/`.includes(...)` broke "wire input never throws" or worse:
// a throwing index GETTER threw straight through; a Proxy with a throwing
// `includes` trap threw after validation passed; and a SPARSE array
// (`new Array(5)`) slid past both the empty-set gate and the vacuous `every`
// to a SIGNED `{answered:true, result:false}` — an answer to the malformed
// empty question case 17 exists to refuse. Index-walked copy inside a
// try/catch: a hole reads as undefined and is rejected, a throw is a
// rejection, and the later membership test runs on OUR array, never theirs.
// The length cap bounds the walk (ISO 3166-1 has 249 codes; a 2^32-1-length
// array stalled the evaluator past 60s) — far above any honest set, and a
// bigger one is a malformed question, not a question.
const MAX_COUNTRIES = 300;
function countrySet(v) {
  try {
    if (!Array.isArray(v)) return null;
    // `length` is CAPTURED ONCE, and the walk runs against the captured number.
    // Re-reading it per iteration made the cap a time-of-check/time-of-use
    // window: `Array.isArray` passes through a Proxy, so a `length` trap could
    // answer 2 for the cap test and a huge number to the loop. Measured
    // 2026-08-16 (release gate): the cap was checked against 2, the loop then
    // walked 5,000,000 indices in 6.5s, and the predicate came back
    // `{answered: true}` — i.e. a SIGNED answer built from a set the
    // MAX_COUNTRIES cap exists to refuse. Capturing `n` bounds the walk at the
    // cap no matter what the trap says afterwards.
    const n = v.length;
    if (!Number.isSafeInteger(n) || n === 0 || n > MAX_COUNTRIES) return null;
    const copy = [];
    for (let i = 0; i < n; i += 1) {
      const c = v[i];
      if (typeof c !== 'string' || !COUNTRY.test(c)) return null;
      copy.push(c);
    }
    return copy;
  } catch {
    return null;
  }
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
    case 'boolean':
      return typeof value === 'boolean'
        ? null
        : `invalid ${field}: ${describe(value)} (boolean true or false, never a string)`;
    default:
      // Unreachable while FIELDS is in sync with this switch. Named rather than
      // folded into the boolean case: a future FIELDS axis with a new kind tag
      // must not be silently validated as a boolean and reported as a fault in
      // a field the caller never set ("every fault names the field").
      return `internal: no validator for field ${field} (kind ${describe(FIELDS[field])})`;
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
  try {
    // Inside the try, not before it: `Array.isArray` (and every later read)
    // THROWS on a revoked Proxy, and this function's contract is "never throws"
    // — measured 2026-08-16, a revoked-proxy predicate escaped as a TypeError
    // instead of coming back `malformed predicate`.
    if (typeof o !== 'object' || o === null || Array.isArray(o)) return null;
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
      if (!hasOwn(FIELDS, k)) throw new Error(`invalid backstory for ${number}: unknown field ${describeKey(k)}`);
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
    // Rendered and clamped like every other diagnostic: the keys are
    // requester-chosen text, and a bare `join` was the one reason string built
    // from wire input that skipped the 60-char clamp (measured 2026-08-16: a
    // predicate with 50 huge keys produced a 100KB reason).
    const list = extra.map(describeKey).join(', ');
    return { answered: false, reason: `unexpected predicate fields: ${list.length > 60 ? `${list.slice(0, 60)}…` : list}` };
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
    // An empty set is rejected rather than answered: it is false for every
    // subscriber alive, so it is a malformed question, not a question. The
    // validated COPY (see countrySet) is what gets tested and searched —
    // p.value stays the requester's object and is never iterated again.
    const set = countrySet(p.value);
    if (set === null) {
      return { answered: false, reason: `invalid country set: ${describe(p.value)} (ISO-3166-1 alpha-2 uppercase, at least one)` };
    }
    if (!(fact === null || (typeof fact === 'string' && COUNTRY.test(fact)))) {
      return { answered: false, reason: `fact unavailable: ${spec.fact}` };
    }
    // `null` = not roaming, so "in this set" is honestly false — a real answer,
    // not a fallback.
    result = set.includes(fact);
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
