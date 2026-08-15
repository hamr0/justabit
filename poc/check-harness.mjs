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
    const reasonOk = verdict.reason === expectedReason;
    const extraOk = extra ? extra.ok : true;
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
  // Prints the tally and exits: 0 only if every case (including its extra) held.
  function conclude() {
    const passed = results.filter(Boolean).length;
    console.log(`RESULT: ${passed}/${results.length}`);
    process.exit(passed === results.length ? 0 : 1);
  }
  return { check, conclude };
}
