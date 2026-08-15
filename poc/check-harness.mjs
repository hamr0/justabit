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
  // Prints the tally and exits: 0 only if every case (including its extra) held.
  function conclude() {
    const passed = results.filter(Boolean).length;
    console.log(`RESULT: ${passed}/${results.length}`);
    process.exit(passed === results.length ? 0 : 1);
  }
  return { check, checkThrows, conclude };
}
