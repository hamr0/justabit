// PoC module M4 — standalone check. Run: node poc/m4-check.mjs
// Negatives first: every fail-open the spike OBSERVED in the naive adapter is
// shown being refused before a single happy path runs. The spike's traps were
// not hypotheses — each one ended in a confident, wrong, signable answer.
import { createMockFacts, evaluatePredicate } from './m4-facts-mock.mjs';
import { makeHarness } from './check-harness.mjs';

const { check, checkThrows, conclude } = makeHarness({ field: 'answered', okWord: 'ANSWER' });

// The injected clock. Every case below reads this and nothing else — no
// Date.now() anywhere in the module or the check, so these cases give the same
// verdict on any machine, in any year.
const NOW = Date.UTC(2026, 7, 15);
const DAY = 86400000;
const N = '+990100000099';                                   // Playground custom slot
const STORY = { swappedDaysAgo: 120, roamingCountry: null, reachable: true };
const P90 = { type: 'simSwapAge', operator: 'gte', value: 'P90D' };

// A fresh operator with one scripted subscriber. Fresh per case: a shared
// adapter would let one case's backstory decide another case's verdict.
const scripted = (story = STORY, number = N) => {
  const facts = createMockFacts();
  facts.setBackstory(number, story);
  return facts;
};
const bit = (facts, predicate = P90, now = NOW) => evaluatePredicate(facts.getFacts(N, now), predicate);

// The harness's checkThrows takes exactly one function; these two fold a SECOND
// angle on the same guard into the SAME tally entry (m3-check case 22 pattern),
// so a guard pinned from two directions is still one PASS/FAIL line.
const threws = (fn) => {
  try { fn(); return { threw: false, msg: 'did not throw' }; }
  catch (e) { return { threw: true, msg: e instanceof Error ? e.message : String(e) }; }
};
const checkThrew = (name, r, extra) =>
  check(name, false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw', extra);

// ============================ operator side: faults must be LOUD ============

// 1 UNKNOWN NUMBER THROWS — the headline fail-open of the whole module. The
// spike's naive `store.get(n) ?? DEFAULTS` answered a number nobody scripted
// with a confident 365-day-old SIM. A fabricated fact is worse than no answer:
// downstream it gets SIGNED. So: no default backstory exists to fall back to.
checkThrows('1 UNKNOWN NUMBER THROWS',
  () => createMockFacts().getFacts(N, NOW), ['unknown number', N, 'no default backstory']);

// 2 UNKNOWN BACKSTORY FIELD THROWS — 'swapedDaysAgo', one missing 'p'. Spike
// OBSERVED: under a `{...DEFAULTS, ...backstory}` merge this call looked
// accepted and the fact came from DEFAULTS (365d), so a story that was scripted
// never took effect and nothing said so. Closed field set, named loudly.
checkThrows('2 UNKNOWN BACKSTORY FIELD THROWS',
  () => createMockFacts().setBackstory(N, { ...STORY, swapedDaysAgo: 400 }),
  ['unknown field swapedDaysAgo']);

// 3 MISSING BACKSTORY FIELD THROWS — the other half of killing the typo trap:
// every field is required and a call REPLACES the story, so a typo is both an
// unknown field AND a missing one. Partial merge is what made the typo silent.
checkThrows('3 MISSING BACKSTORY FIELD THROWS',
  () => createMockFacts().setBackstory(N, { swappedDaysAgo: 120 }),
  ['missing field roamingCountry', 'no defaults']);

// 4 NON-PLAIN BACKSTORY THROWS — M3's lesson, re-measured here: the spike put
// swappedDaysAgo on the PROTOTYPE and then as a NON-ENUMERABLE own property,
// and both times the spread dropped it and the adapter answered 365d from
// defaults. Both corners pinned, because a guard on one is not a guard on both.
{
  const proto = threws(() => createMockFacts().setBackstory(N, Object.create(STORY)));
  const nonEnum = threws(() => {
    const b = { roamingCountry: null, reachable: true };
    Object.defineProperty(b, 'swappedDaysAgo', { value: 120 }); // non-enumerable by default
    createMockFacts().setBackstory(N, b);
  });
  checkThrew('4 NON-PLAIN BACKSTORY THROWS', proto, {
    label: 'prototype + non-enumerable own prop both named not-plain',
    ok: proto.msg.includes('not a plain object') && nonEnum.threw && nonEnum.msg.includes('not a plain object'),
  });
}

// 5 COERCED DAY COUNT THROWS — the arithmetic-coercion family, all four
// MEASURED in the spike as silently "working": '120' multiplies to 120 days,
// null to 0 days (a confident "swapped today"), true to 1 day. Fractions and
// negatives are nonsense ages that would still compare cleanly.
{
  const bad = (v) => threws(() => createMockFacts().setBackstory(N, { ...STORY, swappedDaysAgo: v }));
  const str = bad('120');
  const others = [null, true, -1, 1.5, NaN].map(bad);
  checkThrew('5 COERCED DAY COUNT THROWS', str, {
    label: "names the value + null/true/-1/1.5/NaN also throw",
    ok: str.msg.includes('invalid swappedDaysAgo: "120"') && others.every((r) => r.threw),
  });
}

// 6 BAD COUNTRY THROWS — 'fr' lowercase. Spike OBSERVED ['FR'].includes('fr')
// === false: a non-canonical country does not error, it silently answers "not
// roaming in FR" about a subscriber who is. Canonical alpha-2 or null, nothing else.
// The extra also pins the diagnostic renderer, because a message built from a
// caller-supplied value must not become its own fault: `JSON.stringify` throws
// on a BigInt and on a circular object (M3's release-gate open item 1), and an
// unclamped one can carry a 500-char value into whatever log sees it.
{
  const bad = (v) => threws(() => createMockFacts().setBackstory(N, { ...STORY, roamingCountry: v }));
  const lower = bad('fr');
  const circular = (() => { const c = {}; c.self = c; return bad(c); })();
  const long = bad('x'.repeat(500));
  checkThrew('6 BAD COUNTRY THROWS', lower, {
    label: "names the value + 'FRA'/''/3/BigInt/circular throw cleanly + long value clamped",
    ok: lower.msg.includes('invalid roamingCountry: "fr"') &&
        ['FRA', '', 3, 10n].map(bad).every((r) => r.threw) &&
        circular.threw && circular.msg.includes('[object Object]') &&
        long.threw && long.msg.includes('…') && long.msg.length < 200,
  });
}

// 7 NON-BOOLEAN REACHABLE THROWS — the string 'false' is truthy, so a coerced
// reachability fact would read as reachable=true and answer the opposite of the
// scripted story (M1's non-boolean `result` guard, one layer earlier).
checkThrows('7 NON-BOOLEAN REACHABLE THROWS',
  () => createMockFacts().setBackstory(N, { ...STORY, reachable: 'false' }),
  ['invalid reachable: "false"']);

// 8 NON-TEST NUMBER THROWS — no-go 13: a real subscriber number must never
// reach the PoC, not even as a fixture. Both doors are checked, because a read
// path that accepted what the write path refused would still touch one. The
// fixture is +999 (an UNASSIGNED country code, one digit off the test range):
// a plausible real-format number would itself violate the rule it is here to
// prove, even as a rejection.
{
  const read = threws(() => createMockFacts().getFacts('+99912345678', NOW));
  const write = threws(() => createMockFacts().setBackstory('+99912345678', STORY));
  checkThrew('8 NON-TEST NUMBER THROWS', read, {
    label: 'read + write both refuse a non-+990 number',
    ok: read.msg.includes('+990 test range only') && write.threw && write.msg.includes('+990 test range only'),
  });
}

// 9 BAD INJECTED CLOCK THROWS — the clock is a parameter, never read from the
// machine. A missing one must fail loudly here: `undefined - n` is NaN, and
// every later compare against NaN is false, so the bit would be decided by a
// plumbing mistake rather than by the fact.
{
  const bad = (v) => threws(() => scripted().getFacts(N, v));
  const missing = bad(undefined);
  checkThrew('9 BAD INJECTED CLOCK THROWS', missing, {
    label: 'NaN / fractional / negative / string clocks also throw',
    ok: missing.msg.includes('invalid now') && [NaN, 1.5, -1, '1755216000000'].map(bad).every((r) => r.threw),
  });
}

// 10 OVERFLOW DAY COUNT THROWS — past 2^53 ms an ordering collapses into
// equality and `>=` reads a too-fresh SIM as old enough (the guard M3 pins on
// its durations, applied to the fact side). 2^40 is deliberate: it IS a safe
// integer as a day count and only overflows once converted to ms, so it pins
// the PRODUCT bound rather than the day-count check that 2^53 would trip first.
{
  const product = threws(() => createMockFacts().setBackstory(N, { ...STORY, swappedDaysAgo: 2 ** 40 }));
  checkThrew('10 OVERFLOW DAY COUNT THROWS', product, {
    label: 'safe-as-days-but-not-as-ms named + 2^53 days also throws',
    ok: product.msg.includes('invalid swappedDaysAgo') &&
        threws(() => createMockFacts().setBackstory(N, { ...STORY, swappedDaysAgo: 2 ** 53 })).threw,
  });
}

// 11 BACKSTORY IS SNAPSHOTTED — the store keeps its own copy, not the caller's
// object. Storing the reference would let a caller rewrite history after the
// fact: every later query would answer from an object the operator never
// validated (and the validation would have been performed on different data).
{
  const mutable = { ...STORY };
  const facts = createMockFacts();
  facts.setBackstory(N, mutable);
  mutable.swappedDaysAgo = 1;                       // "swapped yesterday", after the fact
  const v = evaluatePredicate(facts.getFacts(N, NOW), P90);
  // The returned facts are frozen for the same reason, one layer out: an M6
  // caller editing them in place would rewrite the input to the bit after the
  // operator computed it (ESM is strict mode, so the write throws).
  const frozen = threws(() => { facts.getFacts(N, NOW).swapAgeMs = 0; });
  check('11 BACKSTORY IS SNAPSHOTTED', true, v, 'ok', {
    label: 'bit still reflects the validated 120d story + returned facts are frozen',
    ok: v.result === true && frozen.threw,
  });
}

// ============================ wire side: rejections, never a throw ==========

// 12 UNKNOWN PREDICATE TYPE REJECTED — spike OBSERVED a naive evaluate
// answering an unknown type with a clean `false`: a signed "no" to a question
// that was never asked. Whether "no" is the safe answer depends entirely on the
// question's polarity — which is exactly why it can never BE an answer.
{
  const typo = evaluatePredicate({ swapAgeMs: 120 * DAY }, { type: 'simswapAge', operator: 'gte', value: 'P90D' });
  check('12 UNKNOWN PREDICATE TYPE REJECTED', false,
    evaluatePredicate({ swapAgeMs: 120 * DAY }, { type: 'tenure', operator: 'gte', value: 'P90D' }),
    'unknown predicate type: "tenure"',
    { label: "typo'd 'simswapAge' also rejected, not answered",
      ok: typo.answered === false && typo.reason === 'unknown predicate type: "simswapAge"' && !('result' in typo) });
}

// 13 UNEXPECTED PREDICATE FIELD REJECTED — closed field set (M1's closed claim
// set, M3's closed axis set). An ignored extra field is a constraint the
// requester believes is enforced and is not: silent widening, on the predicate.
check('13 UNEXPECTED PREDICATE FIELD REJECTED', false,
  evaluatePredicate({ swapAgeMs: 120 * DAY }, { ...P90, maxAge: 'P30D' }),
  'unexpected predicate fields: maxAge');

// 14 WRONG OPERATOR REJECTED — 'is the swap age EQUAL to 90 days' is a
// different question from the windowed one, and answering it under the
// windowed predicate's name is the mislabelled-answer fault M1 rejects.
check('14 WRONG OPERATOR REJECTED', false,
  evaluatePredicate({ swapAgeMs: 120 * DAY }, { ...P90, operator: 'eq' }),
  'wrong operator for simSwapAge: "eq" (expected "gte")');

// 15 AMBIGUOUS MONTHS REJECTED — same rule M3 applies to floors: a month is
// 28–31 days, so "is the swap age ≥ P3M?" has no honest single answer. The
// extra pins the coercion ban the spike measured (parseInt('90D') === 90).
{
  const nonString = evaluatePredicate({ swapAgeMs: 120 * DAY }, { ...P90, value: 90 });
  check('15 AMBIGUOUS MONTHS REJECTED', false,
    evaluatePredicate({ swapAgeMs: 120 * DAY }, { ...P90, value: 'P3M' }),
    'invalid duration: "P3M" (use P<days>D or P<years>Y; months are ambiguous)',
    { label: 'a bare number 90 is not coerced either',
      ok: nonString.answered === false &&
          nonString.reason === 'invalid duration: 90 (use P<days>D or P<years>Y; months are ambiguous)' });
}

// 16 MALFORMED PREDICATE REJECTED — wire input, so all four shapes must come
// back as a rejection and NONE of them may throw. The prototype/non-enumerable
// corners are the same silent-drop the spike measured on backstories, arriving
// from outside; the throwing getter is the "never throws" half.
{
  const proto = evaluatePredicate({ swapAgeMs: 120 * DAY }, Object.create(P90));
  const nonEnum = (() => {
    const p = { type: 'simSwapAge', operator: 'gte' };
    Object.defineProperty(p, 'value', { value: 'P90D', enumerable: false });
    return evaluatePredicate({ swapAgeMs: 120 * DAY }, p);
  })();
  const getter = threws(() => {
    const p = { type: 'simSwapAge', operator: 'gte' };
    Object.defineProperty(p, 'value', { enumerable: true, get() { throw new Error('boom'); } });
    return evaluatePredicate({ swapAgeMs: 120 * DAY }, p);
  });
  check('16 MALFORMED PREDICATE REJECTED', false,
    evaluatePredicate({ swapAgeMs: 120 * DAY }, ['simSwapAge', 'gte', 'P90D']),
    'malformed predicate',
    { label: 'prototype + non-enumerable + throwing getter all rejected, none thrown',
      ok: proto.reason === 'malformed predicate' && nonEnum.reason === 'malformed predicate' &&
          getter.threw === false && getter.msg === 'did not throw' });
}

// 17 EMPTY COUNTRY SET REJECTED — an empty set is false for every subscriber
// alive, so it is a malformed question, not a question. The extra pins the
// case-canonicalisation the spike measured.
{
  const roam = { type: 'roamingIn', operator: 'in', value: [] };
  const lower = evaluatePredicate({ roamingCountry: 'FR' }, { ...roam, value: ['fr'] });
  check('17 EMPTY COUNTRY SET REJECTED', false,
    evaluatePredicate({ roamingCountry: 'FR' }, roam),
    'invalid country set: [] (ISO-3166-1 alpha-2 uppercase, at least one)',
    { label: "lowercase ['fr'] rejected, never silently 'not roaming'",
      ok: lower.answered === false &&
          lower.reason === 'invalid country set: ["fr"] (ISO-3166-1 alpha-2 uppercase, at least one)' });
}

// 18 FACT UNAVAILABLE REJECTED — the fact the predicate needs is absent.
// `undefined >= threshold` is false, so a missing fact would answer "this SIM
// is not old enough" about a SIM nobody looked up. Unanswerable is a DISTINCT
// outcome from a `false` bit, and only one of the two is honest.
{
  const malformedFacts = evaluatePredicate(null, P90);
  const noCountry = evaluatePredicate({ swapAgeMs: 0 }, { type: 'roamingIn', operator: 'in', value: ['FR'] });
  const noReach = evaluatePredicate({ swapAgeMs: 0 }, { type: 'reachable', operator: 'eq', value: true });
  check('18 FACT UNAVAILABLE REJECTED', false,
    evaluatePredicate({ roamingCountry: null, reachable: true }, P90),
    'fact unavailable: swapAgeMs',
    { label: 'all three fact axes + null facts rejected, never answered',
      ok: malformedFacts.reason === 'malformed facts' &&
          noCountry.answered === false && noCountry.reason === 'fact unavailable: roamingCountry' &&
          noReach.answered === false && noReach.reason === 'fact unavailable: reachable' });
}

// ============================ the assertions themselves =====================

// 19 FLIP FLIPS THE BIT — the FR1 negative and the module's whole reason to
// exist. One adapter, one number: script "swapped 120 days ago" and the
// windowed answer is true; re-script "swapped yesterday" MID-RUN (the
// Playground Admin API model) and the same question answers false — while the
// response shape stays byte-identical apart from the bit. Spike negative
// control: with the setter stubbed to a no-op the bit stayed true, so this case
// can genuinely fail.
{
  const facts = createMockFacts();
  facts.setBackstory(N, { swappedDaysAgo: 120, roamingCountry: null, reachable: true });
  const old = evaluatePredicate(facts.getFacts(N, NOW), P90);
  facts.setBackstory(N, { swappedDaysAgo: 1, roamingCountry: null, reachable: true });
  const fresh = evaluatePredicate(facts.getFacts(N, NOW), P90);
  check('19 FLIP FLIPS THE BIT', true, old, 'ok', {
    label: 'true→false on re-script, shape identical, only the bit differs',
    ok: old.result === true && fresh.result === false &&
        Object.keys(old).join(',') === Object.keys(fresh).join(',') &&
        fresh.answered === true && fresh.reason === 'ok',
  });
}

// 20 NO RAW VALUE IN THE ANSWER — profile rule 2, asserted in the artifact.
// The spike's "debuggable" evaluate returned {result, swapAgeMs} and the age
// survived JSON.stringify, i.e. reached the wire. Here the answer carries
// exactly three fields and, serialized, contains NO DIGIT AT ALL: no age, no
// date, no country, no number can be hiding in it.
{
  const v = evaluatePredicate(scripted().getFacts(N, NOW), P90);
  check('20 NO RAW VALUE IN THE ANSWER', true, v, 'ok', {
    label: 'keys exactly {answered,reason,result} + no digit survives serialization',
    ok: Object.keys(v).join(',') === 'answered,reason,result' &&
        typeof v.result === 'boolean' && !/\d/.test(JSON.stringify(v)),
  });
}

// 21 ROAMING IN SET — the second windowed shape: "in FR: yes/no", never a
// country list back. The extra is the honest-false half: not roaming at all
// (null) is genuinely not in the set — a real answer, not a fallback.
{
  const roam = { type: 'roamingIn', operator: 'in', value: ['FR', 'BE'] };
  const abroad = evaluatePredicate(scripted({ ...STORY, roamingCountry: 'FR' }).getFacts(N, NOW), roam);
  const home = evaluatePredicate(scripted().getFacts(N, NOW), roam);
  check('21 ROAMING IN SET', true, abroad, 'ok', {
    label: 'FR→true, not-roaming→false, and the set never comes back',
    ok: abroad.result === true && home.result === false && home.answered === true &&
        !JSON.stringify(home).includes('FR'),
  });
}

// 22 REACHABLE — the third fact carried by the Playground admin model, wired
// end to end so it is a live axis rather than dead weight in the store.
{
  const off = scripted({ ...STORY, reachable: false });
  const pred = { type: 'reachable', operator: 'eq', value: true };
  const v = evaluatePredicate(off.getFacts(N, NOW), pred);
  // The string 'true' is truthy, so a coerced predicate value would answer the
  // opposite question — the same non-boolean trap case 7 pins on the fact side.
  const coerced = evaluatePredicate(off.getFacts(N, NOW), { ...pred, value: 'true' });
  check('22 REACHABLE', true, v, 'ok', {
    label: "unreachable→false, reachable→true, and the string 'true' is rejected",
    ok: v.result === false &&
        evaluatePredicate(scripted().getFacts(N, NOW), pred).result === true &&
        coerced.answered === false &&
        coerced.reason === 'invalid reachable value: "true" (boolean true or false, never a string)',
  });
}

// 23 DETERMINISTIC FOREVER — the reason backstories are RELATIVE. The same
// scripted story evaluated at now=2020 and now=2099 gives the same bit: this
// suite cannot rot, and no case can pass or fail because of the date it is run.
{
  const facts = scripted();
  const y2020 = evaluatePredicate(facts.getFacts(N, Date.UTC(2020, 0, 1)), P90);
  const y2099 = evaluatePredicate(facts.getFacts(N, Date.UTC(2099, 0, 1)), P90);
  check('23 DETERMINISTIC FOREVER', true, y2020, 'ok', {
    label: 'identical answer at now=2020 and now=2099',
    ok: JSON.stringify(y2020) === JSON.stringify(y2099) && y2020.result === true,
  });
}

// 24 WINDOW BOUNDARY — pins the window as inclusive `>=`: exactly 90 days old
// satisfies a P90D window, 89 does not. A `>` mutant answers every
// exactly-at-the-floor subscriber the wrong way and no other case notices.
{
  const at90 = evaluatePredicate(scripted({ ...STORY, swappedDaysAgo: 90 }).getFacts(N, NOW), P90);
  const at89 = evaluatePredicate(scripted({ ...STORY, swappedDaysAgo: 89 }).getFacts(N, NOW), P90);
  check('24 WINDOW BOUNDARY', true, at90, 'ok', {
    label: '90d→true (inclusive), 89d→false',
    ok: at90.result === true && at89.result === false && at89.answered === true,
  });
}

// ====== 2026-08-16 review round: guards found unpinned by an independent sweep ======
// The build's own mutation table reported 28 guards / 27 killed. An independent
// selection re-run against this suite killed 20 of 28 and left EIGHT survivors.
// Three of the eight are genuinely unreachable and stay unpinned on purpose
// (recorded in the findings entry: the `Array.isArray` clause in plainSnapshot,
// re-probed over 13 array shapes; `durationMs`'s 2^53 reject, which the fact
// side's safe-integer check already covers; and the `+990` digit bound, whose
// no-real-number job is carried by the prefix). The five below each turned a
// removed guard into a WRONG ANSWER, so each gets a case.

// 25 HOSTILE PREDICATE VALUE NEVER THROWS — the untrusted-side contract, and
// the review round's one code defect. `describe()` guarded only two of its
// three fallbacks: `Object.prototype.toString` reads a `Symbol.toStringTag`
// GETTER, so a wire value that is circular (JSON.stringify throws) AND has a
// throwing toString/valueOf/Symbol.toPrimitive (String throws) AND a throwing
// toStringTag made the renderer throw — and evaluatePredicate threw with it,
// from inside the diagnostic written to keep exactly that from happening.
{
  const hostile = {};
  hostile.self = hostile;                                              // JSON.stringify throws
  Object.defineProperty(hostile, 'toString', { value() { throw new Error('boom'); } });
  Object.defineProperty(hostile, 'valueOf', { value() { throw new Error('boom'); } });
  Object.defineProperty(hostile, Symbol.toPrimitive, { value() { throw new Error('boom'); } });
  Object.defineProperty(hostile, Symbol.toStringTag, { get() { throw new Error('boom'); } });
  const asValue = threws(() => evaluatePredicate({ swapAgeMs: 120 * DAY }, { ...P90, value: hostile }));
  const asType = threws(() => evaluatePredicate({ swapAgeMs: 120 * DAY }, { ...P90, type: hostile }));
  const asOperator = threws(() => evaluatePredicate({ swapAgeMs: 120 * DAY }, { ...P90, operator: hostile }));
  // Captured through a catch, not called inline: this is the one case whose
  // subject is a THROW, so calling it inline would kill the runner with no
  // RESULT line and hide every other case — the failure mode check-harness
  // guards against by defaulting a missing verdict rather than dereferencing it.
  const verdict = asValue.threw ? { answered: false, reason: `THREW: ${asValue.msg}` }
    : evaluatePredicate({ swapAgeMs: 120 * DAY }, { ...P90, value: hostile });
  check('25 HOSTILE PREDICATE VALUE NEVER THROWS', false, verdict,
    'invalid duration: [unrenderable] (use P<days>D or P<years>Y; months are ambiguous)',
    { label: 'value + type + operator all rendered, none thrown, BigInt/circular still render as before',
      ok: asValue.threw === false && asType.threw === false && asOperator.threw === false &&
          evaluatePredicate({ swapAgeMs: 120 * DAY }, { ...P90, value: 10n }).reason ===
            'invalid duration: 10 (use P<days>D or P<years>Y; months are ambiguous)' });
}

// 26 PROTOTYPE-KEY PREDICATE TYPE REJECTED — the closed-set gate is
// `hasOwnProperty`, not a truthiness lookup. With a plain `PREDICATES[p.type]`
// the inherited members of Object.prototype all answer truthy, and the measured
// result was not merely a wrong reason: `{type:'toString', operator:undefined}`
// came back `{answered:true, result:true}` — a signed AFFIRMATIVE to a
// predicate type that does not exist. Case 12's 'tenure'/'simswapAge' fixtures
// cannot see this, because neither is a prototype key.
{
  const f = { swapAgeMs: 120 * DAY, roamingCountry: null, reachable: true, undefined: true };
  const keys = ['toString', 'constructor', '__proto__', 'valueOf', 'hasOwnProperty', 'isPrototypeOf'];
  const all = keys.map((k) => evaluatePredicate(f, { type: k, operator: undefined, value: true }));
  check('26 PROTOTYPE-KEY PREDICATE TYPE REJECTED', false,
    evaluatePredicate(f, { type: 'toString', operator: undefined, value: true }),
    'unknown predicate type: "toString"',
    { label: `all ${keys.length} Object.prototype keys rejected, none answered`,
      ok: all.every((r) => r.answered === false && !('result' in r) &&
                          /^unknown predicate type: /.test(r.reason)) });
}

// 27 NON-STRING PREDICATE TYPE REJECTED — `typeof p.type !== 'string'` looks
// redundant next to the hasOwn check and is NOT: a boxed String, a one-element
// array and an object with a toString all coerce to a real key on lookup, and
// with the clause removed each answered `{answered:true, result:true}` under
// the simSwapAge predicate. A type that is not a string is not a question.
{
  const f = { swapAgeMs: 120 * DAY };
  const coercers = [Object('simSwapAge'), ['simSwapAge'], { toString: () => 'simSwapAge' }];
  const all = coercers.map((ty) => evaluatePredicate(f, { type: ty, operator: 'gte', value: 'P90D' }));
  check('27 NON-STRING PREDICATE TYPE REJECTED', false,
    evaluatePredicate(f, { type: ['simSwapAge'], operator: 'gte', value: 'P90D' }),
    'unknown predicate type: ["simSwapAge"]',
    { label: 'boxed String + array + toString-object all rejected, none answered',
      ok: all.every((r) => r.answered === false && !('result' in r)) });
}

// 28 NEGATIVE AGE IS UNANSWERABLE — the other half of case 18. A missing fact
// is caught by the safe-integer test, but a NEGATIVE one passes it: `-1 >= t`
// is false, so a corrupt or clock-skewed age answers "this SIM is not old
// enough" as a real bit. The mock cannot produce a negative age, but M5 differs
// an operator-supplied `latestSimChange` against the injected now, where a
// skewed clock does exactly this — the guard is for that seam.
{
  const p = P90;
  const all = [-1, -DAY, -Number.MAX_SAFE_INTEGER].map((v) => evaluatePredicate({ swapAgeMs: v }, p));
  check('28 NEGATIVE AGE IS UNANSWERABLE', false,
    evaluatePredicate({ swapAgeMs: -1 }, p),
    'fact unavailable: swapAgeMs',
    { label: 'negative ages rejected, never compared to a false bit',
      ok: all.every((r) => r.answered === false && r.reason === 'fact unavailable: swapAgeMs') });
}

// 29 NON-CANONICAL COUNTRY FACT IS UNANSWERABLE — the spike's lowercase trap
// arriving from the FACT side rather than the predicate side. Case 17 pins
// `['fr']` in the request; nothing pinned `roamingCountry: 'fr'` in the facts,
// and with the canonical-case test removed it answered `{answered:true,
// result:false}`: "not roaming in FR" about a subscriber who is roaming in FR.
// That is the exact silent wrong answer the module's own comment cites.
{
  const roam = { type: 'roamingIn', operator: 'in', value: ['FR'] };
  const all = ['fr', 'FRA', '', 'F', 42, true].map((v) => evaluatePredicate({ roamingCountry: v }, roam));
  check('29 NON-CANONICAL COUNTRY FACT IS UNANSWERABLE', false,
    evaluatePredicate({ roamingCountry: 'fr' }, roam),
    'fact unavailable: roamingCountry',
    { label: "'fr'/'FRA'/''/'F'/42/true all rejected, never a silent 'not roaming'",
      ok: all.every((r) => r.answered === false && r.reason === 'fact unavailable: roamingCountry') });
}

// 30 NON-STRING NUMBER THROWS — `TEST_NUMBER.test(x)` COERCES, so without the
// typeof clause an object whose toString spells a +990 number is accepted and
// keyed by identity: measured, the store then answered for the object and threw
// `unknown number` for the identical string, i.e. two different subscribers
// wearing one number. The extra folds in the digit bound (case 8 only pins the
// country code, so `{6,12}` was unpinned in both directions).
{
  const objNum = { toString: () => N };
  const write = threws(() => createMockFacts().setBackstory(objNum, STORY));
  const read = threws(() => createMockFacts().getFacts(objNum, NOW));
  // Both sides of `\d{6,12}`: 0 and 5 digits are too short, 13 and 20 too long.
  const bound = ['+990', '+99012345', '+9901234567890123', '+990' + '1'.repeat(20)]
    .map((n) => threws(() => createMockFacts().setBackstory(n, STORY)));
  checkThrew('30 NON-STRING NUMBER THROWS', write, {
    label: 'object/array numbers refused on read + write, and the 6–12 digit bound holds both ways',
    ok: write.msg.includes('+990 test range only') && read.threw &&
        threws(() => createMockFacts().setBackstory([N], STORY)).threw &&
        bound.every((r) => r.threw),
  });
}

// The declared case count. A suite that silently loses the cases carrying its
// guarantee still printed a green `RESULT: n/n` before this argument existed
// (measured 2026-08-16: truncated to 18/18 exit 0, emptied to 0/0 exit 0).
conclude(30);
