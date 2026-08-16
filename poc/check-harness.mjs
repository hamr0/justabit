// Shared PASS/FAIL harness for the PoC module checks — one copy of the reporting
// contract (line format, `extra` folding, results tally, exit code) that every
// m*-check.mjs imports, so a change to it cannot silently land in one runner and
// not another. Verdicts differ per module only in the field that carries the
// verdict ('accepted' for M1, 'ok' for M2) and the word printed for a positive.
//
// Every rejection reason is deterministic, so every case asserts the exact reason
// as well as the verdict: a check that only asserts pass/fail passes even when a
// module starts misreporting one failure mode as another. `extra` (optional)
// folds a case-specific extra condition into the SAME verdict, so each case is
// exactly one entry in the tally and exactly one PASS/FAIL line.
export function makeHarness({ field, okWord }) {
  const results = [];
  function check(name, wantPass, verdict, expectedReason, extra) {
    // A regressed module that returns nothing must print a FAIL line and still
    // reach the tally — dereferencing undefined here would kill the whole suite
    // as a TypeError with no RESULT line, hiding every other case.
    verdict = verdict ?? {};
    const reasonOk = verdict.reason === expectedReason;
    // `=== true`, never truthiness: measured 2026-08-16 — an `extra.ok` that is
    // a truthy NON-boolean (a string, an array, a stray object) made the case
    // print PASS and the suite exit 0 while asserting nothing. Every extra in
    // every m*-check is a boolean expression, so this only ever bites a
    // mistake — which is the point.
    const extraOk = extra ? extra.ok === true : true;
    const pass = verdict[field] === wantPass && reasonOk && extraOk;
    results.push(pass);
    const want = wantPass ? okWord : 'REJECT';
    const got = verdict[field] ? okWord : 'REJECT';
    const extraStr = extra ? `; ${extra.label}=${extra.ok}` : '';
    console.log(
      `${pass ? 'PASS' : 'FAIL'} ${name}: expected ${want}, got ${got}` +
      ` — reason expected '${expectedReason}', got '${verdict.reason}' (match=${reasonOk})${extraStr}`
    );
  }
  // A case asserting that `fn` THROWS — the operator-side "fail loud" contract.
  // Hand-rolling this per case duplicated the try/catch shape and invited each
  // copy to drift; folding it here keeps every throw-case one tally entry with
  // the same verdict vocabulary as check(). `substrings` are the fragments the
  // error message must NAME (e.g. the offending axis) — a throw with a useless
  // message is not a pass.
  function checkThrows(name, fn, substrings = []) {
    try {
      fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const extra = substrings.length
        ? { label: `error names ${substrings.join(' + ')}`, ok: substrings.every((s) => msg.includes(s)) }
        : undefined;
      check(name, false, { [field]: false, reason: 'threw' }, 'threw', extra);
      return;
    }
    check(name, false, { [field]: true, reason: 'did not throw' }, 'threw');
  }
  // Prints the tally and exits: 0 only if every case (including its extra) held
  // AND — when the caller declares one — the suite still has the case count it
  // is supposed to have. Measured 2026-08-16: truncating m4-check to drop its
  // six assertion cases printed `RESULT: 18/18` and exited 0, and emptying the
  // tally entirely printed `RESULT: 0/0` and exited 0. A suite that quietly
  // loses the cases carrying its guarantee must not read as green, so a
  // declared count is asserted like any other case.
  function conclude(expected) {
    const passed = results.filter(Boolean).length;
    const countOk = expected === undefined || results.length === expected;
    console.log(`RESULT: ${passed}/${results.length}`);
    // AFTER the tally, so the LAST line of a count-failing run is the red one:
    // the runbook (and any `| tail -1`) reads the final line, and a green
    // `RESULT: 18/18` printed last would bury the count failure it sits above —
    // the exact eyeball fail-open this argument exists to close.
    if (!countOk) {
      console.log(`FAIL CASE COUNT: expected ${expected} cases, ran ${results.length}` +
        ' — the suite lost or gained cases; a shrinking suite is not a passing suite');
    }
    process.exit(passed === results.length && countOk ? 0 : 1);
  }
  return { check, checkThrows, conclude };
}
