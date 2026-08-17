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
  // ADDED 2026-08-17 (predicate set 3 → 6). A DEVICE swap is a different fact
  // about different hardware, so it is a separate axis rather than a reuse of
  // the SIM one — but the QUESTION shape is deliberately identical (PRD §9,
  // user-signed): same bucket menu, same `gte` duration compare. Two facts that
  // answer the same shape of question must not teach a reader two grammars, and
  // a second shape is a second place for the window to widen quietly.
  deviceSwappedDaysAgo: 'dayCount',
  roamingCountry: 'countryOrNull',
  reachable: 'boolean',
  // ADDED 2026-08-17 (predicate set 3 → 6). The subscriber's own position, or
  // `null` for "the operator cannot place this subscriber" — a PRESENT key with a
  // null value, the same spelling `roamingCountry` uses for the honest negative,
  // and the same reason: an absent axis and a known-unavailable one are different
  // answers. It is never returned as a fact; only a VERDICT about an area the
  // requester asked about is (see `presentVerdict`).
  location: 'geoOrNull',
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
// `atLeastFact`/`atLeastMsFact` are the SECOND, coarser shape a duration fact can
// arrive in, and they exist because a real operator surface measured on
// 2026-08-17 only offers that shape: CAMARA's sim-swap and device-swap `/check`
// answer `{"swapped":bool}` for a `maxAge` window in HOURS and never hand back a
// date at all. A boolean about a window is not an age, so it cannot be compared
// against an arbitrary threshold — it can only answer the ONE question it was
// computed for. The `…AtLeastMs` companion carries that window, and the compare
// below refuses unless it EQUALS the threshold asked. That equality is the whole
// guard: without it an adapter could answer "not swapped in 30 days" to a
// "90 days?" question and the bit would look perfect on the wire.
// `queryKey` is what `factQuery` hands the adapter so it can choose the surface.
const PREDICATES = Object.freeze({
  simSwapAge: {
    operator: 'gte', value: 'duration', fact: 'swapAgeMs',
    atLeastFact: 'swapAgeAtLeast', atLeastMsFact: 'swapAgeAtLeastMs', queryKey: 'swapAgeThresholdMs',
  },
  deviceSwapAge: {
    operator: 'gte', value: 'duration', fact: 'deviceSwapAgeMs',
    atLeastFact: 'deviceSwapAgeAtLeast', atLeastMsFact: 'deviceSwapAgeAtLeastMs', queryKey: 'deviceSwapAgeThresholdMs',
  },
  roamingIn: { operator: 'in', value: 'countries', fact: 'roamingCountry' },
  presentIn: { operator: 'in', value: 'area', fact: 'presentVerdict', queryKey: 'area' },
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

// An AREA, validated into a frozen plain copy of three primitives, or null. Two
// callers depend on this being exact: `factQuery` sends it to a live operator,
// and `evaluatePredicate` renders it into the canonical predicate string that
// both sides must derive byte-identically.
//
// The bounds are not decoration. A latitude past ±90 or a longitude past ±180 is
// not a place, and `NaN`/`Infinity` compare `false` against every bound, so an
// unguarded pair would travel to a live endpoint as garbage and come back as a
// confident verdict about nowhere. The radius is bounded at 200 km (CAMARA's
// location-verification maximum) and at 1 m below, because a zero or negative
// radius is a question with no answer rather than a small one.
//
// NOTE on the LOWER bound, stated because it is a deviation: CAMARA's
// location-verification also specifies a MINIMUM radius of 2000 m, and this
// accepts less. That is deliberate and measured — the Playground answered a 100 m
// request with `PARTIAL`, which is the exact state this round exists to refuse,
// and enforcing the catalog minimum here would make the third state unreachable
// in the reference implementation. A deployment that enforces 2000 m loses
// nothing: the refusal is what a sub-resolution question gets either way.
const MAX_RADIUS_M = 200000;
const AREA_KEYS = Object.freeze(['lat', 'long', 'radiusM']);
const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
function areaOf(v) {
  const a = plainSnapshot(v);
  if (a === null) return null;
  const keys = Object.keys(a).sort();
  if (keys.length !== AREA_KEYS.length || keys.join(',') !== [...AREA_KEYS].sort().join(',')) return null;
  if (!inRange(a.lat, -90, 90) || !inRange(a.long, -180, 180)) return null;
  if (!Number.isSafeInteger(a.radiusM) || a.radiusM < 1 || a.radiusM > MAX_RADIUS_M) return null;
  // Rebuilt in a FIXED key order rather than copied: `canonicalPredicate` renders
  // this object, and two requesters spelling the same area with their keys in a
  // different order must not produce two different signed predicate strings.
  return Object.freeze({ lat: a.lat, long: a.long, radiusM: a.radiusM });
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
      // The field is NAMED from `field` rather than hardcoded: a second dayCount
      // axis (deviceSwappedDaysAgo) arrived 2026-08-17, and a message naming the
      // wrong field is the "every fault names the field" rule broken in the one
      // place a caller reads. The spelling for swappedDaysAgo is unchanged.
      return Number.isSafeInteger(value) && value >= 0 && Number.isSafeInteger(value * DAY_MS)
        ? null
        : `invalid ${field}: ${describe(value)} (whole days as a non-negative number; strings, null and booleans are NOT coerced)`;
    case 'countryOrNull':
      return value === null || (typeof value === 'string' && COUNTRY.test(value))
        ? null
        : `invalid roamingCountry: ${describe(value)} (ISO-3166-1 alpha-2 uppercase, or null for not roaming)`;
    case 'geoOrNull': {
      if (value === null) return null;
      const g = plainSnapshot(value);
      const ok = g !== null && Object.keys(g).sort().join(',') === 'lat,long'
        && inRange(g.lat, -90, 90) && inRange(g.long, -180, 180);
      return ok ? null : `invalid location: ${describe(value)} ({lat, long} as finite degrees within ±90/±180, or null for a subscriber the operator cannot place)`;
    }
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
// Great-circle distance in metres. Six lines of arithmetic with no dependency and
// no caller-supplied anything; the mean-Earth-radius approximation is DECLARED
// (WGS-84 varies ~0.3% pole to equator) and is far inside any radius this PoC
// answers. It exists so the mock can produce a real TRUE/FALSE about a real area
// rather than a scripted verdict — a scripted one would make the demo's location
// assertion unable to fail for the right reason.
const EARTH_RADIUS_M = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function metresBetween(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLong = rad(b.long - a.long);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLong / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * One instance = one operator's scriptable subscriber base.
 *
 * `locationResolutionM` is OPERATOR CONFIG, not a backstory: it is the finest
 * radius this operator can resolve, and a question below it produces `PARTIAL` —
 * the measured third state of `location-verification/v1/verify`, which this
 * profile REFUSES rather than rounding. It is configuration because it is a
 * property of the operator's network, not of a subscriber, and because the live
 * backend's resolution is whatever the real network does and cannot be scripted
 * at all. Default 2000 m — CAMARA's own minimum location-verification radius.
 */
export function createMockFacts({ locationResolutionM = 2000 } = {}) {
  if (!Number.isSafeInteger(locationResolutionM) || locationResolutionM < 1) {
    throw new Error(`invalid locationResolutionM: ${describe(locationResolutionM)} (whole metres, at least 1 — operator config, so a fault here is LOUD)`);
  }
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
  function getFacts(number, nowMs, query = {}) {
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
    const deviceSwappedAtMs = nowMs - b.deviceSwappedDaysAgo * DAY_MS;
    // Frozen: facts are operator-internal, and an M6 caller mutating them
    // in place would rewrite the input to the bit after the fact.
    //
    // The mock returns EXACT ages for both swap axes and never the coarse
    // `…AtLeast` shape, and that asymmetry with M5 is deliberate and stated: the
    // coarse shape is an artefact of a REAL surface (`/check`, whose `maxAge` is
    // capped at 2400 hours), not of the fact. The mock's job is scriptable
    // backstories, so it answers from the story it was given. Both shapes are
    // exercised — this one end to end, the other through M5's replay and through
    // synthetic facts in this module's own check.
    const facts = {
      swapAgeMs: nowMs - swappedAtMs,
      deviceSwapAgeMs: nowMs - deviceSwappedAtMs,
      roamingCountry: b.roamingCountry,
      reachable: b.reachable,
    };
    // The location axis is a VERDICT about an area the requester asked about, and
    // it exists only when an area was asked about — the subscriber's own position
    // is never a fact this function returns, on either backend. That is not a
    // convenience: `presentIn` is the one predicate whose upstream is itself
    // predicate-shaped, and handing the position out as a fact would put the raw
    // value one careless line away from the wire.
    //
    // `PARTIAL` is produced, not scripted: a radius finer than this operator can
    // resolve cannot be answered honestly, which is exactly what the live
    // endpoint says with the same word.
    const area = plainSnapshot(query)?.area;
    if (area !== undefined && b.location !== null) {
      const a = areaOf(area);
      if (a !== null) {
        facts.presentVerdict = a.radiusM < locationResolutionM
          ? 'PARTIAL'
          : (metresBetween(a, b.location) <= a.radiusM ? 'TRUE' : 'FALSE');
      }
    }
    return Object.freeze(facts);
  }

  return { setBackstory, getFacts };
}

// ─────────────── the validated question a facts backend is allowed to see ────
// ADDED 2026-08-17 with the 3 → 6 predicate round, and it is the round's one
// genuinely new seam, so the reason is written down.
//
// Three of the six predicates cannot be answered from a subscriber snapshot: the
// operator has to ask its own upstream a QUESTION-SHAPED question. `/check` needs
// the window in hours; `location-verification/v1/verify` needs the area;
// `kyc-match/v1/match` needs the name the requester claims. So something has to
// carry part of the predicate down to the adapter.
//
// The dangerous way to do that is to hand the adapter `req.predicate` — raw wire
// input, before anything validated it, into the one module that builds outbound
// HTTP. That is the mistake M6 already avoided once (canonicalising before
// evaluation would have run `Array.prototype.join` over a wire array); doing it
// here would be the same mistake pointed at the network.
//
// So this function is the chokepoint: it takes the untrusted predicate, NEVER
// throws, invokes nothing caller-supplied (`plainSnapshot` + the same validators
// `evaluatePredicate` uses), and returns a FROZEN plain object of validated
// PRIMITIVES — or `{}`. An adapter therefore never holds a wire object at all.
// Anything it could not validate is simply absent, which makes the fact absent,
// which `evaluatePredicate` refuses. There is no path where a malformed question
// becomes a query.
//
// It deliberately does NOT decide which endpoint to call: that is the adapter's
// own measured business (M5 knows the 2400-hour cap; the mock has no endpoints).
export function factQuery(predicate) {
  const p = plainSnapshot(predicate);
  if (p === null) return Object.freeze({});
  if (typeof p.type !== 'string' || !hasOwn(PREDICATES, p.type)) return Object.freeze({});
  const spec = PREDICATES[p.type];
  const q = {};
  if (spec.value === 'duration') {
    const ms = durationMs(p.value);
    if (ms !== null) q[spec.queryKey] = ms;
  } else if (spec.value === 'area') {
    // The one query value that is not a primitive. It is a FROZEN rebuild in a
    // fixed key order carrying three validated numbers — never the requester's
    // object — so an adapter iterating it cannot run caller code and cannot see a
    // key nobody validated.
    const a = areaOf(p.value);
    if (a !== null) q[spec.queryKey] = a;
  }
  return Object.freeze(q);
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
    if (Number.isSafeInteger(fact) && fact >= 0) {
      result = fact >= threshold;
    } else {
      // The COARSE shape (a `/check`-style boolean about one window). Answerable
      // only for the window it was computed for: the carried `…AtLeastMs` must
      // EQUAL the threshold asked, or this is a bit about a different question
      // and the honest outcome is a refusal. `!==` on two safe integers, never a
      // range test — "close enough" is how a 30-day answer gets signed against a
      // 90-day question.
      const win = f[spec.atLeastMsFact];
      const bit = f[spec.atLeastFact];
      if (!(Number.isSafeInteger(win) && win >= 0 && typeof bit === 'boolean' && win === threshold)) {
        return { answered: false, reason: `fact unavailable: ${spec.fact}` };
      }
      result = bit;
    }
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
  } else if (spec.value === 'area') {
    const area = areaOf(p.value);
    if (area === null) {
      return { answered: false, reason: `invalid area: ${describe(p.value)} (use {lat, long, radiusM} in degrees and whole metres)` };
    }
    // THE THIRD STATE. `PARTIAL` is the operator saying it cannot answer at the
    // resolution asked for, and this profile REFUSES it rather than rounding it
    // to `true` or `false` — a rounded answer is signed and indistinguishable on
    // the wire from a real one, which is the missing-fact-as-confident-negative
    // failure one layer along. The operator publishes this policy as a floor axis
    // (`partialPolicy`, M3) and a requester may only tighten it, so there is no
    // parameter anywhere that turns the rounding on.
    if (fact === 'PARTIAL') {
      return { answered: false, reason: 'location partial: refused, never rounded' };
    }
    if (fact !== 'TRUE' && fact !== 'FALSE') {
      return { answered: false, reason: `fact unavailable: ${spec.fact}` };
    }
    result = fact === 'TRUE';
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
