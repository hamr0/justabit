// PoC module M3 — standalone check. Run: node poc/m3-check.mjs
// Negatives first: every silent-widening path the spike identified is shown
// being rejected before the happy paths.
import { checkFloor } from './m3-floor.mjs';
import { makeHarness } from './check-harness.mjs';

const { check, conclude } = makeHarness({ field: 'allowed', okWord: 'ALLOW' });

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
{
  let verdict, extra = { label: 'error names the axis', ok: false };
  try {
    checkFloor({ tenureMin: 'P3M' }, {});
    verdict = { allowed: true, reason: 'did not throw' };
  } catch (e) {
    verdict = { allowed: false, reason: 'threw' };
    extra.ok = e.message.includes('tenureMin');
  }
  check('14 BROKEN PUBLISHED FLOOR THROWS', false, verdict, 'threw', extra);
}

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
{
  let verdict, extra = { label: 'error names the typo', ok: false };
  try {
    checkFloor({ swapAgemin: 'P90D' }, {});
    verdict = { allowed: true, reason: 'did not throw' };
  } catch (e) {
    verdict = { allowed: false, reason: 'threw' };
    extra.ok = e.message.includes('swapAgemin');
  }
  check('17 PUBLISHED TYPO THROWS NAMED', false, verdict, 'threw', extra);
}

conclude();
