// PoC module M3 — standalone check. Run: node poc/m3-check.mjs
// Negatives first: every silent-widening path the spike identified is shown
// being rejected before the happy paths.
import { checkFloor } from './m3-floor.mjs';
import { makeHarness } from './check-harness.mjs';

const { check, checkThrows, conclude } = makeHarness({ field: 'allowed', okWord: 'ALLOW' });

// The demo operator's published floor: the consumer-agent reference profile
// (proposal §3.4). `class` deliberately omitted — it is optional tightening.
const PUB = { simType: 'voice+data', tenureMin: 'P2Y', swapAgeMin: 'P90D' };

// 1 LOOSER WINDOW — the headline FR4 negative: a request demanding a looser
// swap-age window than the operator publishes is REJECTED, not answered wider.
check('1 LOOSER WINDOW', false, checkFloor(PUB, { swapAgeMin: 'P30D' }),
  'below floor: swapAgeMin P30D < P90D');

// 2 LOOSER CROSS-UNIT — P365D (1 year) vs published P2Y: the compare must work
// across the D/Y spellings (365 < 730), not just same-unit strings.
check('2 LOOSER CROSS-UNIT', false, checkFloor(PUB, { tenureMin: 'P365D' }),
  'below floor: tenureMin P365D < P2Y');

// 3 AMBIGUOUS MONTHS — P24M would be ≥ 2 years under any month length, but a
// month is 28–31 days: no honest single compare exists, so months are rejected
// outright (fail closed beats convenience — decision 2026-08-15).
check('3 AMBIGUOUS MONTHS', false, checkFloor(PUB, { tenureMin: 'P24M' }),
  'invalid duration: tenureMin "P24M" (use P<days>D or P<years>Y; months are ambiguous)');

// 4 UNKNOWN FIELD — closed axis set, same philosophy as M1's closed claim set.
check('4 UNKNOWN FIELD', false, checkFloor(PUB, { favoriteColor: 'blue' }),
  'unknown floor field: favoriteColor');

// 5 TYPO FIELD — 'swapAgemin' (lowercase m). If unknown axes were IGNORED, the
// typo would silently drop the constraint the requester believes is enforced —
// the exact silent-widening path M3 exists to kill.
check('5 TYPO FIELD', false, checkFloor(PUB, { swapAgemin: 'P180D' }),
  'unknown floor field: swapAgemin');

// 6 NON-STRING DURATION — the number 90. parseInt/Number-style coercion is
// banned (spike: parseInt('3M')===3, Number(null)===0 — coercion turns garbage
// into a PASSING floor); a non-string is named invalid, not coerced.
check('6 NON-STRING DURATION', false, checkFloor(PUB, { swapAgeMin: 90 }),
  'invalid duration: swapAgeMin 90 (use P<days>D or P<years>Y; months are ambiguous)');

// 7 MALFORMED FLOOR — the floor itself is not an object. Arrays are objects to
// typeof, so the extra proves an array is caught too, not just a string.
check('7 MALFORMED FLOOR', false, checkFloor(PUB, 'P90D'), 'malformed floor',
  { label: 'array also malformed', ok: checkFloor(PUB, ['P90D']).reason === 'malformed floor' });

// 8 WRONG ENUM — a data-only SIM type. The consumer-agent profile has exactly
// one legal simType; anything else is invalid, never "close enough".
check('8 WRONG ENUM', false, checkFloor(PUB, { simType: 'data-only' }),
  'invalid simType: "data-only" (profile allows only "voice+data")');

// 9 STRING-COMPARE TRAP — 'P100D' < 'P90D' LEXICOGRAPHICALLY (spike trap 1).
// A naive string compare would reject this TIGHTER request; numeric parse must
// allow it. This is the mutation canary for the parse-then-compare design.
// (`?.` on effective: a regressed module returns no effective — that must print
// as a FAIL line, not die as a stack trace with no RESULT — M2 review lesson.)
{
  const v = checkFloor(PUB, { swapAgeMin: 'P100D' });
  check('9 STRING-COMPARE TRAP', true, v, 'ok',
    { label: 'effective keeps P100D', ok: v.effective?.swapAgeMin === 'P100D' });
}

// 10 EQUAL — restating the published floor exactly is allowed; the effective
// floor equals the published one (tie keeps the operator's spelling).
{
  const v = checkFloor(PUB, { ...PUB });
  check('10 EQUAL', true, v, 'ok',
    { label: 'effective = published', ok: JSON.stringify(v.effective) === JSON.stringify(PUB) });
}

// 11 TIGHTER — both durations tightened; effective reflects the request.
{
  const v = checkFloor(PUB, { tenureMin: 'P3Y', swapAgeMin: 'P180D' });
  check('11 TIGHTER', true, v, 'ok',
    { label: 'effective tightened', ok: v.effective?.tenureMin === 'P3Y' && v.effective?.swapAgeMin === 'P180D' });
}

// 12 OMITTED = INHERIT — an empty request floor: the operator's minimums apply
// anyway (omission is silent TIGHTENING, which is allowed) and the effective
// floor makes the inheritance VISIBLE, never hidden (decision 2026-08-15).
{
  const v = checkFloor(PUB, {});
  check('12 OMITTED = INHERIT', true, v, 'ok',
    { label: 'effective = published', ok: JSON.stringify(v.effective) === JSON.stringify(PUB) });
}

// 13 EXTRA TIGHTENING — demanding `class: postpaid`, which the operator did not
// publish: demanding an axis beyond the published floor is tighter, so allowed,
// and it lands in the effective floor alongside the inherited axes.
{
  const v = checkFloor(PUB, { class: 'postpaid' });
  check('13 EXTRA TIGHTENING', true, v, 'ok',
    { label: 'class enforced + rest inherited', ok: v.effective?.class === 'postpaid' && v.effective?.swapAgeMin === 'P90D' });
}

// 14 BROKEN PUBLISHED FLOOR THROWS — the operator's OWN config carries P3M.
// This must fail LOUD (throw naming the axis), never fail open: the spike
// proved a coerced garbage floor compares as 0 days and admits every request.
checkThrows('14 BROKEN PUBLISHED FLOOR THROWS',
  () => checkFloor({ tenureMin: 'P3M' }, {}), ['tenureMin']);

// 15 NULL FLOOR — a wire request carrying `floor: null`. "Wire input never
// throws" is the invariant: null means no extra strictness, the published
// floor applies in full, visibly. (Mutation-proven gap: deleting the
// null-branch threw a raw TypeError while the old suite stayed 14/14.)
{
  const v = checkFloor(PUB, null);
  const absent = checkFloor(PUB); // no floor argument at all — same meaning
  check('15 NULL FLOOR', true, v, 'ok',
    { label: 'effective = published + absent floor also inherits',
      ok: JSON.stringify(v.effective) === JSON.stringify(PUB) && absent.allowed === true && JSON.stringify(absent.effective) === JSON.stringify(PUB) });
}

// 16 YEAR CONSTANT — pins the declared 1Y = 365D from both sides: P364D is
// below a P1Y floor, P365D is not, and the tie keeps the operator's spelling.
// (A 360-day mutant survived the old suite; this case kills it.)
{
  const pub = { tenureMin: 'P1Y' };
  const tie = checkFloor(pub, { tenureMin: 'P365D' });
  check('16 YEAR CONSTANT', false, checkFloor(pub, { tenureMin: 'P364D' }),
    'below floor: tenureMin P364D < P1Y',
    { label: 'P365D allowed + tie keeps P1Y spelling', ok: tie.allowed === true && tie.effective?.tenureMin === 'P1Y' });
}

// 17 PUBLISHED TYPO THROWS NAMED — the named diagnostic is the point of
// validatePublished: a typo'd axis in the operator's OWN config must throw
// an error that names the field, not an incidental TypeError later.
checkThrows('17 PUBLISHED TYPO THROWS NAMED',
  () => checkFloor({ swapAgemin: 'P90D' }, {}), ['swapAgemin']);

// 18 NON-ENUMERABLE PUBLISHED THROWS — a non-enumerable own prop passes the
// prototype check but VANISHES in the spread: the operator's intended axis
// would silently go unenforced (reproduced as a fail-open before the fix).
// The plain-object contract is asserted on own-property COUNT, not just proto.
{
  const p = { simType: 'voice+data' };
  Object.defineProperty(p, 'tenureMin', { value: 'P2Y' }); // non-enumerable by default
  checkThrows('18 NON-ENUMERABLE PUBLISHED THROWS',
    () => checkFloor(p, { tenureMin: 'P1D' }), ['not a plain object']);
}

// 19 NON-PLAIN REQUEST REJECTED — the untrusted-side mirror. A request floor
// carrying its axes on the PROTOTYPE would be stripped by the spread: pre-fix
// this came back ALLOWED with the demanded constraint silently dropped — the
// same silent-widening class as an ignored typo, arriving from the wire.
// The extra pins the other half of "wire input never throws": a throwing
// getter is rejected as malformed, never escaping as a raw TypeError.
{
  const v = checkFloor(PUB, Object.create({ swapAgeMin: 'P180D' }));
  let getterVerdict;
  try {
    const o = {};
    Object.defineProperty(o, 'swapAgeMin', { enumerable: true, get() { throw new Error('boom'); } });
    getterVerdict = checkFloor(PUB, o);
  } catch (e) {
    getterVerdict = { allowed: true, reason: `ESCAPED: ${e.message}` };
  }
  check('19 NON-PLAIN REQUEST REJECTED', false, v, 'malformed floor',
    { label: 'throwing getter also malformed, never thrown',
      ok: getterVerdict.allowed === false && getterVerdict.reason === 'malformed floor' });
}

// 20 PROTOTYPE PUBLISHED THROWS — the other diagonal of case 18. Cases 18/19
// pinned {published,non-enumerable} and {requested,prototype}; a mutant removing
// the PUBLISHED prototype check survived the 19-case suite. It is a fail-open of
// the worst kind: a floor carried on a prototype is stripped by the spread, so
// `checkFloor(Object.create({swapAgeMin:'P90D'}), {swapAgeMin:'P1D'})` returned
// ALLOWED with the operator's ENTIRE floor unenforced.
checkThrows('20 PROTOTYPE PUBLISHED THROWS',
  () => checkFloor(Object.create({ tenureMin: 'P2Y', swapAgeMin: 'P90D' }), { swapAgeMin: 'P1D' }),
  ['not a plain object']);

// 21 NON-ENUMERABLE REQUEST REJECTED — the fourth corner, and the untrusted-side
// mirror of 18. A request carrying a demanded axis as a NON-ENUMERABLE own prop
// passes the prototype check but vanishes in the spread: pre-fix this returned
// `allowed:true` with the demanded constraint silently dropped. Wire input, so
// it must REJECT cleanly — never throw.
{
  const r = { simType: 'voice+data' };
  Object.defineProperty(r, 'swapAgeMin', { value: 'P180D', enumerable: false, configurable: true });
  check('21 NON-ENUMERABLE REQUEST REJECTED', false, checkFloor(PUB, r), 'malformed floor');
}

// 22 PAST 2^53 REJECTED — pins the Number.isSafeInteger guard in durationDays.
// Past 2^53 `Number()` collapses a strict ordering into equality, which the
// strict `<` compare reads as "not below" — a marginally looser request would be
// admitted. A mutant returning the unchecked day count survived the 19-case
// suite. Both sides asserted in one case: the wire side REJECTS (never throws),
// the operator's own config fails LOUD.
{
  const req = checkFloor(PUB, { swapAgeMin: 'P9007199254740993D' });
  let pubVerdict;
  try {
    checkFloor({ swapAgeMin: 'P9007199254740993D' }, {});
    pubVerdict = { threw: false, msg: 'did not throw' };
  } catch (e) {
    pubVerdict = { threw: true, msg: e.message };
  }
  check('22 PAST 2^53 REJECTED', false, req,
    'invalid duration: swapAgeMin "P9007199254740993D" (use P<days>D or P<years>Y; months are ambiguous)',
    { label: 'published side fails loud',
      ok: pubVerdict.threw === true && pubVerdict.msg.includes('invalid duration') });
}

// 23 NON-JSON VALUE REJECTED, NEVER THROWN — the module's declared fix point
// (2026-08-17, found by the M6 composition spike). The rejection-message builder
// used `JSON.stringify` on the requested value, which THROWS on a BigInt and
// RUNS a caller-supplied `toJSON`. Either way a bare TypeError escaped
// `checkFloor` and replaced the loud named-input rejection — breaking "wire
// input never throws" in the rejection path itself, i.e. exactly when the caller
// most needs the reason. Three shapes, one defect: a BigInt (stringify throws), a
// throwing `toJSON` (stringify runs caller code), and a revoked Proxy (where the
// structural fallback's own `Array.isArray` throws). None survives a JSON round
// trip — which is precisely the point: the envelope's transit is what kept this
// unreachable in the demo, and a transport accident is not a contract.
{
  const guard = (requested) => {
    try { return checkFloor(PUB, requested); }
    catch (e) { return { allowed: true, reason: `ESCAPED: ${e.constructor.name}` }; }
  };
  const evil = guard({ swapAgeMin: { toJSON() { throw new Error('boom'); } } });
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  const revoked = guard({ swapAgeMin: proxy });
  const dur = (rendered) => `invalid duration: swapAgeMin ${rendered} (use P<days>D or P<years>Y; months are ambiguous)`;
  check('23 NON-JSON VALUE REJECTED', false, guard({ swapAgeMin: 10n }), dur('10n'),
    { label: 'throwing toJSON + revoked proxy also rejected, never thrown',
      ok: evil.allowed === false && evil.reason === dur('object')
        && revoked.allowed === false && revoked.reason === dur('[unrenderable]') });
}

// 24 EVERY `render` BRANCH IS NAMED BY KIND — added 2026-08-17 after an
// independent mutation sweep deleted `render`'s `symbol` and `function` branches
// with every suite still green. Low severity and defence in depth by design:
// neither shape survives a JSON round trip, so neither is wire-reachable through
// the demo's envelope. That is exactly the argument case 23 refuses to accept —
// "the transport happens to filter it" is a structural accident, not a contract
// this module is entitled to lean on — so the branches get pinned rather than
// deleted. Without them both values fall through to the structural fallback and
// render as `object`, which names the wrong kind rather than throwing.
//
// This case lives HERE and not in m6-check on purpose: reverting M3's whole
// `render` fix leaves m6-check green, because the composition's envelope is what
// keeps these shapes off the wire. The fix belongs to M3, so its pin does too.
{
  const guard = (requested) => {
    try { return checkFloor(PUB, requested); }
    catch (e) { return { allowed: true, reason: `ESCAPED: ${e.constructor.name}` }; }
  };
  const dur = (rendered) => `invalid duration: swapAgeMin ${rendered} (use P<days>D or P<years>Y; months are ambiguous)`;
  const fn = guard({ swapAgeMin: function nope() {} });
  // The control: a real object DOES render as `object`, so the two cases above
  // are asserting a distinct kind name and not simply "some string came back".
  const obj = guard({ swapAgeMin: { a: 1 } });
  check('24 RENDER NAMES EVERY KIND', false, guard({ swapAgeMin: Symbol('s') }), dur('symbol'),
    { label: 'a function renders as `function`; a plain object still renders as `object`',
      ok: fn.allowed === false && fn.reason === dur('function')
        && obj.allowed === false && obj.reason === dur('object') });
}

// The declared case count. A suite that silently loses the cases carrying its
// guarantee still printed a green `RESULT: n/n` before this argument existed
// (measured 2026-08-16 on m4-check: truncated to 18/18 exit 0, emptied to 0/0
// exit 0).
// 25 THE PARTIAL POLICY IS A FLOOR AXIS, TIGHTEN-ONLY — added 2026-08-17 with the
// 3 -> 6 predicate round. `location-verification/v1/verify` has a measured third
// state, PARTIAL, and this profile refuses it rather than rounding it to yes or
// no. The operator publishes that policy and a requester may only tighten it,
// which is this module's EXISTING machinery and not a new mechanism — so what is
// pinned here is that the axis behaves like every other closed-set enum axis:
//   * restating the published value is allowed and lands in `effective`;
//   * asking for anything else is a LOOSENING and is refused by name (this is the
//     request "round PARTIAL for me", which is precisely the thing that must not
//     be answerable);
//   * omitting it inherits the operator's value VISIBLY, so a requester can see
//     which policy was enforced rather than assuming one.
{
  const PUBP = { ...PUB, partialPolicy: 'refuse' };
  const same = checkFloor(PUBP, { partialPolicy: 'refuse' });
  const loosen = checkFloor(PUBP, { partialPolicy: 'round' });
  const omitted = checkFloor(PUBP, { swapAgeMin: 'P180D' });
  const typo = checkFloor(PUBP, { partialpolicy: 'refuse' });
  check('25 PARTIAL POLICY IS A TIGHTEN-ONLY FLOOR AXIS', false, loosen,
    'invalid partialPolicy: "round" (profile allows only "refuse")',
    { label: `restating it is allowed (effective=${same.effective?.partialPolicy}); omitting it inherits `
      + `(${omitted.effective?.partialPolicy}); a typo'd axis is refused ('${typo.reason}')`,
      ok: same.allowed === true && same.effective.partialPolicy === 'refuse'
        && omitted.allowed === true && omitted.effective.partialPolicy === 'refuse'
        && typo.allowed === false && typo.reason === 'unknown floor field: partialpolicy' });
}

// 26 A HOSTILE AXIS NAME IS NEVER RENDERED VERBATIM — the `fieldName` guard
// (m3-floor.mjs) that case 4/5's plain typos never exercise, because a plain
// typo IS printable ASCII and passes the guard unchanged. A literal newline
// inside the key is the reproduction: proven live (2026-08-18) to score 25/25
// whether `fieldName`'s bound is present or reverted to the raw key — reverted,
// the reason renders the control character verbatim (a fake log line an
// operator's log scraper could be fooled by); fixed, it renders the fixed
// placeholder instead. Case 25 pins the SIBLING typo unaffected by this guard.
{
  const hostile = checkFloor(PUB, { 'a\nFAKE LOG LINE b': 'x' });
  check('26 HOSTILE FLOOR AXIS NAME NEVER RENDERED VERBATIM', false, hostile,
    'unknown floor field: (unprintable field name)',
    { label: `reason='${JSON.stringify(hostile.reason)}'`,
      ok: hostile.allowed === false && hostile.reason === 'unknown floor field: (unprintable field name)'
        && !hostile.reason.includes('\n') });
}

conclude(26);
