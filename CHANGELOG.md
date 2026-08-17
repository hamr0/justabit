# Changelog

## Unreleased (0.4.0 — M6)

- **M6 built: `poc/demo.mjs`, the one-command reader-facing demo, and
  `poc/m6-check.mjs`, 25 cases. AGENT-RUN 20/20 and 25/25 by exit code; USER
  VALIDATION PENDING, so gate G1 is NOT yet met.** `node poc/demo.mjs` needs no
  credentials and touches no network; `--backend orange` swaps in M5 reading
  `ORANGE_BASIC_AUTH` from the environment and exits **2** with printed
  prerequisites if the credential is absent or the Playground is unreachable —
  never a silent fallback to the mock. Exit 0 only if all 20 assertions hold, 1
  if any fails.
- **The demo prints in plain language**, because it is the surface a CAMARA/AAIF
  reader sees: a `Q:` with the scripted backstory, the `A:` bit, then
  `negative flip → PASS`. Each of PRD §4.1's four assertions is followed by a
  control that disables that ONE guard and shows the same input being accepted —
  a guard never disabled has not been proven load-bearing.
- **The repeated-query oracle, found by the M6 composition spike and only partly
  closed.** Every individual response is a clean windowed bit; the SEQUENCE is
  not. Nine legal, signed, sealed, metered queries binary-searched the
  subscriber's exact swap age (137 days, recovered exactly) with every response
  passing every check. No module is wrong — M3 gates FLOORS, not predicate
  thresholds, and profile rule 1 hands the threshold to the requester. The demo
  operator now publishes a **coarse threshold menu** next to its floor
  (`P30D | P90D | P180D | P365D`) and REFUSES anything off it — refuses, never
  rounds. That CAPS the oracle at the bucket (≈2 bits/year); it does not close
  it, and it is written down as a cap in the CAMARA proposal §3.5 alongside the
  two other mitigations (rate limits + per-query billing, adopted; a
  tighten-only repeat rule, considered and declined — it costs the attacker ~15×
  and still recovers the value).
- **Duplicate-key REQUESTS are refused outright**, using M1's newly exported
  scanner (above): no partial acceptance, and never a pick between the two
  values. **Refusals are SIGNED and nonce-bound** past authentication, so the
  blind hub cannot forge a denial; before authentication they are deliberately
  unsigned, because an operator cannot sign a refusal to a party it cannot name.
- **M6 owns exactly four things no module owns**, each one load-bearing and each
  one pinned: the transport frame `{iss, payload, sig}`; the **injective**
  canonical predicate string (a mutation dropping the threshold left the whole
  spike green while the operator answered `gte P1D` to a `gte P90D` question);
  the single-use nonce store (M1's nonce check is stateless BINDING and says so,
  so replay rejection lives entirely here); and the reason clamp (M3 builds
  reasons from wire input unbounded, and M2's `seal()` THROWS above capacity, so
  an unclamped refusal crashes the operator instead of refusing).
- **`poc/m6-check.mjs` is offline in BOTH backend modes.** The `--backend
  orange` seam runs through an injected transport replaying captured Playground
  bytes, and with the keys and the nonce held fixed the two backends produce a
  **byte-identical signed frame** — signature included, since Ed25519 is
  deterministic. That is the strongest form FR5's "only the facts source swaps"
  claim can take. The suite also runs the demo itself and asserts its exit code,
  its 20/20 tally, and **claims discipline**: every mention of zero-knowledge in
  the output must be a negation.
- **16 mutations against M6's own guards, 16 killed, 0 survivors** (plus 5
  against the M1/M3 changes below).
- **Spec sketch `Predicate` enum trimmed 7 → 3.**
  `spec/carrier-attestation.yaml` now lists only what the PoC wires end to end —
  `simSwapAge`, `roamingIn`, `reachable` (the boolean `value` branch stays;
  `reachable` needs it and the reference module rejects the string spelling).
  `tenure`, `simType`, `presentIn` and `numberMatch` were aspirational entries
  in an illustrative artifact: nothing computes them, so a reader could send a
  schema-valid request the reference operator refuses. They move to a
  **future-work note** in the CAMARA proposal §3.3.1 rather than being deleted —
  `tenure` and `simType` are still FLOOR axes, `presentIn` is
  location-verification's existing shape, `numberMatch` is
  number-verification's `/verify` which conforms today, and `tenure` carries the
  unresolved MNP question the trim declines to ship as settled. The **normative**
  profile enumerates no predicate types, so nothing normative moved.
- **M1 exports its duplicate-top-level-key scanner
  (`hasDuplicateTopLevelKey`).** A signed REQUEST is signed bytes too, and the
  equivocation is symmetric: one signature over bytes carrying `floor` twice
  lets the operator enforce `P90D` while the requester believes it demanded
  `P365D`. Verifying a request cannot reuse `verifyAttestation` (that demands
  the closed ANSWER set `{predicate, result, nonce, exp}`), so M6 borrows the
  byte-level scan rather than keeping a second, divergent copy of it — the copy
  that would face the wire first. The export carries a stated precondition (the
  text must already have parsed as JSON) and M6 calls it in M1's own order:
  signature → parse → scan. **M1's declared case count 19 → 20** (the new case
  pins the bare function directly, including a duplicated `floor` in a
  request-shaped payload, and that a depth-2 duplicate is not a top-level one).
- **M3 fix point closed: `checkFloor` no longer throws on wire input.** The
  rejection-message builder rendered the offending value with `JSON.stringify`,
  which THROWS on a BigInt and RUNS a caller-supplied `toJSON` — either way a
  bare `TypeError` escaped `checkFloor` and replaced the module's loud
  named-input rejection, breaking "wire input never throws" *in the rejection
  path itself*. Found by the M6 composition spike and recorded there as
  OBSERVED-not-fixed; fixed here. The renderer now invokes nothing
  caller-supplied (M4's post-release-gate `describe()` shape), and keeps the
  `[unrenderable]` floor because `Array.isArray` itself throws on a revoked
  Proxy. Neither shape survives a JSON round trip, so the envelope's transit is
  what kept this unreachable in the demo — a transport accident, not a contract.
  **M3's declared case count 22 → 23**; every previously pinned reason string is
  byte-identical.

## 0.3.0 — 2026-08-17

- **M5 (live Orange facts adapter) built under the §4.4 ladder —
  user-validated 48/48 offline + 11/11 LIVE at `8e842c3`, the shipped state,
  which MEETS gate G2 (`G2 = M5 user-validated live`) with no asterisk and
  nothing pending. M5's G2 is the first G2 in the project — first met at
  `69b6f2e` (47/47 + 11/11), re-established at `4ac60e9`, and re-closed at
  `8e842c3` after the post-gate review round below changed all three M5
  files. Each round of fixes re-opened the gate and each was closed by a run,
  never by assuming an earlier run carried over.**
  `poc/m5-facts-orange.mjs` exports `createOrangeFacts` and nothing else —
  `evaluatePredicate` is deliberately NOT reimplemented, so the M4 split
  (raw facts operator-side; one closed-answer evaluation step facing the wire)
  is what makes the backend a drop-in swap rather than a second code path.
- **The spike re-ran every recorded Playground finding before a line was
  written** — they were measured on 2026-08-14/15 and a sandbox can move.
  **Seven held, three changed.** (1) `403 FORBIDDEN` no longer means "unknown
  number" on its own — a wrong-surface token returns the same status with a
  different body, so the adapter now splits the two by body text rather than
  status. (2) Sim-swap is no longer the whole interface: roaming AND
  reachability are both live, so **all three axes are wired to real endpoints
  and nothing is faked**. (3) THE TRAP holds with a sharper mechanism — a bare
  `UPDATE` on an unclaimed built-in now fails loud with `400`, but the
  adapter's own CREATE-then-UPDATE path reproduces the echo-lies behaviour
  exactly: the echo carried the written date, the next READ did not. The spike
  also found the stored credential is **already `Basic `-prefixed** — a
  double-prefix that fails both token endpoints, and it cost the spike's first
  round.
- **READ-after-write is load-bearing, not belt-and-braces.** Because a write
  can be echoed back and silently discarded, every backstory write is verified
  by a subsequent READ; the mismatch path produces the module's loudest
  diagnostic. Two separate review findings landed on that one message, which is
  what a load-bearing guard attracts.
- **`null`-vs-absent roaming semantics are distinguished, not collapsed.** A
  device that is not roaming returns the key **PRESENT and `null`**; an
  unavailable axis returns the key **ABSENT**. The first is a real answer
  (`answered:false` for a country predicate, because there is no country), the
  second is a refusal (`fact unavailable: roamingCountry`). Collapsing them
  would turn "we cannot know" into a signed bit.
- **Three-layer redaction** over everything that can reach a diagnostic: exact
  known-secret match, pattern match, and a length clamp — composed in an order
  that matters (a string is redacted BEFORE it is clamped, or a clamp leaves an
  unmatched FRAGMENT of the credential printed).
- **Offline suite runs on a clean clone: 48 cases, zero credentials, zero
  network** — an injected transport replays bytes captured live, so the fixture
  can still show the negative. **Live suite: 11 cases with quota hygiene** — it
  consumes and returns one of the app's 10 custom slots, reclaims the slot
  BEFORE consuming it (so an interrupted run does not leak one), prints the
  count at both ends, and case 11 asserts it came back.
- **Adversarial review round: 3 confirmed issues, all fixed (44 → 47 offline,
  10 → 11 live).** Found by an independent 30-case check written from the spec
  BEFORE either shipped suite was opened, plus an independent 16-mutant sweep.
  (1) The write-verification diagnostic — the message the module's most
  load-bearing guard produces — was the **single throw path that skipped
  `redact()`**, leaking a planted credential half and a planted bearer token,
  and it clamped AFTER serializing (measured **2354ms** on a 2e8-char value,
  and a `RangeError` at V8's max string length that destroyed the loud message
  entirely). (2) A required mutant **SURVIVED**: "one token per surface" was
  unpinned because the check answered both token endpoints with the same
  fixture, though the two are measured non-interchangeable. (3) The live
  check's cleanup DELETE was unobserved, so an interrupted run leaked a slot
  toward the 10-cap silently. 18/18 mutants killed after the fixes; a
  315-combination leak fuzz with a planted-leak control is clean.
- **Release gate: five more findings, two of them real code defects (47 → 48
  offline).** `/security` returned 0 Critical / 0 High / 0 Medium; `/diff-review`
  returned "with fixes". Each was reproduced against the unfixed tree first.
  (1) **The stored country list was COERCED while being joined** —
  `Array.prototype.join` calls `String()` on every element, so a JSON-parsed
  `{"toString":"x"}` threw a bare **40-char `TypeError`** from the line that
  BUILDS the write-verify comparison, replacing the module's loudest guard
  before it could run (the benign control gave the correct **418-char**
  message). Closed by `joinStored()`. This is a direct sibling of the defect the
  previous round closed 30 lines below, in the RENDER of the same diagnostic —
  the render was guarded, the line feeding it was not. (2) **The live quota
  assertion used a baseline taken before the CUSTOM slot existed**, so a FRESH
  account's first run went red and blamed the trap case's cleanup, which had in
  fact succeeded — reproduced live at `start=0 end=1`, exit 1, with
  `cleanup DELETE status=204` printed alongside. Fixed by making the baseline
  deterministic rather than by loosening the assertion. Three were docs-honesty
  defects: the CAMARA proposal's catalog table **showed a response shape M1
  REJECTS** under a sentence claiming the PoC produced it (corrected to the real
  envelope, overclaim replaced, retraction left visible); two rows sat outside
  the §11 verified baseline (marked `†` with provenance); and a mutant count
  contradicted itself (18 was the POST-fix total, the pre-fix sweep was 15/16).
- **The three `/security` Lows were all confirmed and fixed**, each trivial and
  local: `await res.text()` sat OUTSIDE the try that redacts (a stream dying
  mid-response rejects there, so its message escaped unredacted) — now inside;
  the client-id pattern's `\S{0,80}` bound was **tighter than the thing it
  masks**, so an over-long identifier had its first 80 characters redacted and
  the REMAINDER printed — worse than not matching — now **256**, re-checked at
  1ms on a 200k-char pathological input to keep the ReDoS property. Operator-side
  timestamps in diagnostics were judged NOT a breach and deliberately left (they
  are operator-side by construction, never wire-reachable).
- **Both release-gate code fixes are mutation-proven**, restores byte-identical
  by sha256: reverting `joinStored` takes the offline suite to exit **1** (47/48,
  case 48 only) and restoring it to exit **0**; reverting the quota baseline on a
  freshly-emptied account takes the LIVE suite to exit **1** (10/11,
  `start=0 end=1`) and restoring it to exit **0** on the identical condition.
  A 110-run flake sweep across all five offline suites returned **0 non-zero
  exits**, and the credential was confirmed absent from the working tree and
  from all 35 commits of history by literal-value match.
- **A catalog-mapping table was added to the CAMARA proposal, labelled
  illustrative.** It maps the profile onto the existing catalog surfaces; the
  PoC produces the ENVELOPE, while the predicate spellings are illustrative and
  the PoC answers three axes, not nine. That distinction is stated in the
  document rather than left for a reviewer to find.
- **Ladder status: M1–M5 user-validated at their current case counts on the
  shipped tree — no module carries an asterisk.** M1 19/19, M2 10/10, M3 22/22,
  M4 33/33, M5 48/48 offline + 11/11 live. M5's G2 was first met at `69b6f2e`
  (47/47 + 11/11), RE-OPENED when the release gate's fixes touched all three M5
  files and re-established by a user run at `4ac60e9`, then RE-OPENED again by
  the post-gate review round below and re-closed by a user run at `8e842c3` —
  the shipped state. Each gap was closed by a run rather than assumed to carry
  over. An earlier 44/44 + 10/10 user run at `2fd62ba`, undated at the time, is
  recorded in the findings log for completeness. **M6 not started**, and
  `poc/demo.mjs` does not exist yet.
- **Post-gate code review round (2026-08-17): two more adapter defects, both
  redaction-order siblings, plus a third adjudicated after the round and three
  live-check hardenings — counts unchanged (48 offline / 11 live). This
  RE-OPENED G2, and the user re-ran the two-line runbook on the fixed tree the
  same day and reported both clean, re-closing it at `8e842c3`.** (1) `joinStored()`
  clamped stored `countryName` strings to 48 chars BEFORE `redact()` ever saw
  them — the exact clamp-before-redact fragment leak the `show()` comment
  warns about, one step upstream of it: a >48-char credential echoed inside
  `countryName` rode a 48-char un-redactable fragment into the write-verify
  diagnostic (reproduced red: fragment printed, no `[REDACTED]`; green after
  redact-first — the 44-char fixture secret planted in the sim axis could
  never catch it). (2) `tokenFor()`'s `await res.text()` sat OUTSIDE the try
  that redacts — the same /security Low fixed in `post()`'s send survived at
  this sibling site; a token stream dying mid-body escaped unredacted
  (reproduced: planted secret printed raw; wrapped and redacted after). (3)
  Adjudicated after the round rather than during it: `assertNow()` admitted a
  safe integer past `Date`'s representable range, so `9e15` cleared every check
  and then `toISOString()` threw a bare `RangeError: Invalid time value` — the
  same opaque-error-replaces-the-loud-one class — now bounded at `MAX_EPOCH_MS`
  (mutation-proven, no suite case added, 48/48 unchanged).
  Live-check hardenings: the raw admin token bootstrap now checks status and
  token shape before caching (a 401 JSON body used to cache
  `access_token: undefined`, and `undefined === null` never refetches — every
  later call sent `Bearer undefined` and case 11 blamed QUOTA for an AUTH
  fault; a non-JSON body threw a raw SyntaxError quoting the wire body); the
  courtesy re-script after case 11 is guarded (a transient failure there
  killed an all-green run before the tally printed); and case 11 no longer
  conjoins `endSlots < QUOTA_CAP` (at-cap is a separate warning, not a red
  blaming a cleanup that succeeded). Comment fixes: case 48's "three legs" now
  says four (it asserts four); the root README status lists all five modules.
- **Open items carried, not cleaned up.** M3 still carries the `describe`-throw
  class on its untrusted-side path (`checkFloor` with a BigInt throws a raw
  TypeError) — pre-existing, fails closed, and deliberately not retrofitted
  because it means touching a user-validated module; **M6 is the declared fix
  point**. The spec sketch still lists predicate types the PoC does not wire
  (seven listed, three answered), with **M6 as the declared wire-or-trim
  point** — restated because a schema looser than the implementation is exactly
  the silent-widening shape the profile exists to forbid.

## 0.2.0 — 2026-08-16

- **M4 (mock facts adapter) built under the §4.4 ladder — user-validated
  30/30 at `5d5e8aa`.** `poc/m4-facts-mock.mjs`: one facts interface with a
  scriptable per-number backstory store mirroring the Playground admin model
  (swap date, roaming country, reachability), an INJECTED clock (no ambient
  `Date.now()` — a fixture that cannot be moved cannot show the negative), and
  a hard split between `getFacts()` (raw facts, operator side only) and
  `evaluatePredicate()` (the only step that may face the wire — it never
  throws, and its success shape carries the boolean and NOTHING else). That
  split is what makes M5 a drop-in: the backend swaps the facts source, the
  evaluation step is unchanged. Closed sets everywhere and NO defaults: an
  unknown predicate type, an unknown axis, a non-canonical country, a negative
  age or a missing fact is `answered:false` — never a silent `false` bit that
  reads as a real answer.
- **The spike measured six fail-opens in the naive adapter before any code was
  written** — headline: a missing fact compared against a threshold yields a
  confident `false` and gets SIGNED (the negative control flips it, so the
  fixture can show both). All 13 spike claims were reproduced against the built
  module.
- **Adversarial review round: 1 real defect + 5 unpinned guards (24 → 30
  cases).** An independent 19-case check written from the spec alone (before
  reading the suite) plus an independent 28-mutant sweep left EIGHT survivors.
  Fixed: `describe()` could throw on hostile input, breaking "wire input never
  throws" — so M3's release-gate open item 1 was only partially closed. Five
  load-bearing guards had no case that could catch their regression; two
  shared-harness fail-opens were closed with them (a truthy-non-boolean
  `extra.ok` reading as a pass, and a silently shrinking suite printing a
  smaller green tally — every suite now declares its case count,
  `conclude(19|10|22|33)`, and exits 1 with `FAIL CASE COUNT`). 200k-round leak
  fuzz clean.
- **`/code-review medium` round on PR #4: 8 findings, all confirmed by
  execution, all fixed.** Nothing was accepted on argument — each was reproduced
  against the unfixed file and re-probed after. The headline: wire-supplied
  country-set arrays ran CALLER-CONTROLLED code three ways, one of them past
  every gate — a sparse `new Array(5)` made the empty-set gate see length 5 and
  `every` vacuously true, producing a SIGNED `{answered:true, result:false}`
  answer to the malformed question case 17 exists to refuse. Closed by an
  index-walked defensive copy inside `try/catch` with a `MAX_COUNTRIES = 300`
  cap. Also: a revoked Proxy escaping `plainSnapshot`, two unclamped
  diagnostics, an unbounded `describe()` input, and a green last line printed on
  a failing run.
- **Release gate: 3 more fail-opens, one of them process-fatal (30 → 33
  cases).** `/security` and `/diff-review` ran as independent passes over the
  release diff and found three defects of one shape — **wire-reachable work no
  cap actually bounded** — each defeating a guard the module explicitly claimed,
  and none catchable by the 30 existing cases. (1) `countrySet()` re-read
  `v.length` every iteration, so the 300-cap was a time-of-check/time-of-use
  window: measured, the cap was tested against **2**, the loop then walked
  **5,000,000 indices in 6.5s**, and the predicate returned **`{answered:true}`**
  — an answer built from a set the cap exists to refuse. (2) `describe()`'s
  guarded fallback chain could **kill the process**: a ~40-byte predicate whose
  `toJSON` returned `'x'.repeat(3e8)` produced a fatal OOM inside V8's
  `JsonStringifier` — **exit 134, SIGABRT** — because *a try/catch bounds a
  throw, not an allocation*, and a dead process cannot return
  `{answered:false}`. (3) The input bound covered only top-level values: the
  same 50MB string cost **657ms nested** vs **83ms** at top level. Fixed by one
  decision rather than three patches — **the renderer now invokes nothing
  caller-supplied**: primitives render directly, arrays render ≤16 elements one
  level deep, and an object is described by its KEY NAMES via
  `getOwnPropertyNames`, which reads no accessor and calls no hook. Post-fix
  657ms → 77.7ms and 527ms → 2.2ms. Four mutations, each red on exactly its own
  new case and each restored byte-identical — including the guard-off negative
  control that matters: **with the mutation the OOM probe exits 134, without it
  exits 0**.
- **Two pinned diagnostics changed, deliberately, and are recorded as such** —
  a circular object now renders `{self}` instead of `[object Object]`, and case
  25's hostile object `{self, toString, valueOf}` instead of `[unrenderable]`.
  Both old spellings were products of the caller-invoking fallbacks that were
  removed; `[unrenderable]` survives as the floor and is still pinned, by the
  one shape that genuinely cannot be enumerated (a revoked Proxy). The claim
  "the input is bounded first" from the review round is **visibly retracted** in
  `findings.md` rather than edited away.
- **Spec sketch: `reachable` minted into the `Predicate` enum and a boolean
  value branch added.** The reference module rejects the string spelling
  (`"true"`), so without the branch no `reachable` request could be both
  schema-valid and answerable — a self-contradicting sketch. Illustrative only;
  no normative surface enumerates predicate types.
- **Ladder status: M1–M4 all built; M1/M2/M3 user-validated at the current tree
  state.** The user re-ran all four suites at `5d5e8aa`: 19/19, 10/10, 22/22,
  30/30 — closing every re-run marker 0.1.0 carried. The release-gate fixes
  landed after that run and touched only `poc/m4-facts-mock.mjs` and
  `poc/m4-check.mjs`, so **M4's 33/33 is agent-run and a user re-run is
  pending** (the 0.1.0 precedent); M1/M2/M3 are untouched and stand. M5–M6 not
  started.
- **Open items carried, not cleaned up.** M3 still carries the `describe`-throw
  class on its untrusted-side path (`checkFloor` with a BigInt throws a raw
  TypeError) — pre-existing, fails closed, and deliberately not retrofitted
  because it means touching a user-validated module. The spec sketch remains
  looser than the reference module (seven predicate types listed, three
  answered; `operator` optional in the schema, mandatory in the code), with
  **M6 as the declared reconcile point** — restated because a schema looser
  than the implementation is exactly the silent-widening shape the profile
  forbids.

## 0.1.0 — 2026-08-15

- **M3 (floor gate) built under the §4.4 ladder — user-validated 14/14.**
  `poc/m3-floor.mjs`: `checkFloor(published, requested)` — pure logic, zero
  deps; closed 4-axis set (simType/tenureMin/swapAgeMin/class); strict
  `P<n>D`/`P<n>Y` durations (1Y = 365D stated; months rejected as ambiguous
  — user decision); no coercion (spike: `parseInt('3M')===3`,
  `Number(null)===0` would admit every request); unknown/typo'd axis =
  closed-set rejection (an ignored typo silently drops a constraint);
  omitted axis inherits the published floor, visible via the returned
  `effective`; broken PUBLISHED config throws loud, wire input never
  throws. `poc/m3-check.mjs`: 17 cases negatives-first (14 at build + 3
  review-round canaries). Mutation-proven: 5 mutants killed (rejection
  disabled / unknown-axes ignored / string compare / 360-day year /
  null-floor branch); check hardened to fail-clean (`?.`) after one mutant
  first died as a stack trace — the M2 "no RESULT line" lesson re-applied.
- **M3 review round (opus, adversarial + 200k-iteration differential fuzz
  vs an independent BigInt oracle — 36,452 allow-verdicts, 0 violations on
  wire-shaped input): 7 warnings fixed.** Non-plain published config (a
  prototype chain or a flip-flopping getter) could slip past validation and
  fail OPEN — closed by rejecting non-plain-prototype configs loud + a
  own-props snapshot before validation (validate and compare now see the
  same data); duration compare gained an explicit null guard (defense in
  depth — `r < null` coerces to `r < 0` = allowed); day counts past 2^53
  rejected (`Number()` can collapse strict-less into equal there, which
  strict `<` reads as not-below); the declared 1Y=365D constant and the
  null/absent-floor "wire never throws" branch each gained a
  mutation-proven canary case; two doc lines the code contradicted
  corrected (poc/README module status; findings.md 2^53 wording).
- **M3 review round 2: 8 findings (harness verdict guard, a `checkThrows`
  helper for the hand-rolled expect-throw cases, non-enumerable /
  non-plain-prototype closures on BOTH the operator and the wire side, an
  enum-mismatch guard, the rule-5 profile + spec sync, and the docs-honesty
  rewording below).** Two in-process fail-opens closed: a non-enumerable
  published axis passed the prototype check but vanished in the spread
  (intended constraint silently unenforced), and a request floor carrying
  its axes on the prototype came back ALLOWED with the demanded constraint
  silently dropped — both now mutation-proven by check cases 18 and 19
  (19 cases at that point). The three signed-off M3 rules (closed axis set,
  `P<n>D`/`P<n>Y` only with 1Y = 365D, numeric-not-lexicographic compare)
  reached the normative text at proposal rule 5 and the spec's Floor schema.
- **M3 release round: three unpinned guards closed (19 → 22 cases).** A
  release-gate mutation sweep found three *already-fixed* fail-opens with no
  case that could catch their regression — mutants removing them survived
  19/19 exit 0. Cases 18/19 pinned only one diagonal of
  {published,requested} × {prototype,non-enumerable}; the other diagonal and
  the 2^53 guard were uncovered. Added case 20 (published floor on a
  prototype throws — the mutant admitted a P1D request against a P90D floor
  with the operator's ENTIRE floor unenforced), case 21 (request carrying a
  demanded axis as a non-enumerable own prop rejects `malformed floor`, not
  ALLOWED-with-constraint-dropped), and case 22 (day counts past 2^53 —
  wire side rejects, operator side fails loud). Each mutation-proven: guard
  removed → that case alone red at 21/22 exit 1, restored → 22/22 exit 0.
  Two independent differential fuzzes against BigInt oracles written from
  the rule (not the code) — 200k and 300k iterations, ~156k allow-verdicts —
  found **0 monotonicity violations**, with a rejection-disabled negative
  control producing 6,200 violations (the fuzz can fail). Non-blocking items
  left open and recorded in `findings.md`, not fixed here: an untrusted-side
  `JSON.stringify` that can throw on BigInt/circular/throwing-`toJSON`
  (unreachable via the current `JSON.parse` path, fails closed), an
  unescaped key in one rejection reason (log injection), an unbounded reason
  echo, and the spec `pattern` lacking a magnitude bound.
  **User runs of this final 22/22 (M3), 19/19 (M1) and 10/10 (M2) state are
  pending at merge time** — those counts are agent-run. The standing
  user-validated M3 record remains 14/14 on the pre-review build.

## 0.0.4 — 2026-08-15

- **Both v0.0.3 security Mediums closed (user decision: now, not M3).**
  (1) Duplicate-key equivocation: the M1 verifier rejects any signed payload
  with a repeated top-level claim key (`duplicate claim keys`), keys compared
  after JSON escape decoding; 2 new check cases (plain + `\u0072esult`
  spelling), mutation-proven — guard off, the equivocating blob is ACCEPTED;
  guard on, 19/19 exit 0, M2 regression 10/10. Normative rule 2 amended
  (proposal + README copy + spec YAML). (2) Key pinning: rule 3 now requires
  verifiers to pin the expected operator key before verification — unsigned
  `iss` is a lookup hint, never the key selector (text-only; the reference
  verifier already takes a caller-pinned key; enforceable surface lands with
  the M6 trust directory).

## 0.0.3 — 2026-08-15

- **Whole-branch release gates run before merge** — `/code-review medium`
  (8 findings, all fixed: honest README/PoC status, ECDH→RSA-OAEP doc
  parity, spec-vs-verifier mutual implementability, real hub-blind attack
  set, `.gitignore` scoped back so `.github/` is trackable, shared
  `poc/check-harness.mjs` extracted — superseding M2's "deliberate
  duplication" note) + fresh security and diff-review gates (unquoted
  inline YAML descriptions were silently truncating the spec's `exp`/
  `predicate` docs — quoted; case 8's reason is observed from `open()`
  again, not derived from the verdict; `.env`/`*.env` now actually
  gitignored as the PRD claims). Two Medium normative-text items (duplicate
  JSON-key ambiguity; verifier key-pinning rule) held as open decisions for
  the submission round — recorded in `findings.md`.
- **Normative profile rule 6 amended (size side channel)** — responses in a
  hub-carried deployment MUST NOT let payload size track the answer;
  grounded by M2's measured constant 512 B ciphertext. Plus decisions
  round: M6 gains the request-authenticity scope (unauthenticated request =
  open item), replay handling bounded, author filled, AAIF submission
  process grounded (`github.com/aaif/project-proposals`).
- **M2 (blind envelope) built under the §4.4 ladder** —
  `poc/m2-envelope.mjs` (RSA-4096 OAEP-SHA256 via `node:crypto`, one vetted
  primitive, zero deps; `seal` derives capacity from the recipient key,
  `open` rejects-never-throws on wire input, failure reasons deliberately
  collapsed against padding oracles) + `poc/m2-check.mjs` (10 cases,
  negatives first, exact reasons; 10/10 exit 0; happy path composes with
  the shipped M1 module end-to-end). Spike measured: real payloads fit
  (148 B request / 270 B response vs 446 B cap), hub blindness structural
  (own-private-key attempts + plaintext substring scan, 0 recoveries,
  mutation-falsifiable), ciphertext length CONSTANT at 512 B (the rule-6
  size side channel does not exist at this layer; count/timing/pairing
  remain visible and stated). Review round: 6 findings — 5 fixed (incl. a
  live-proven derived-capacity bug), 1 documented at the time
  (check-harness duplication — later extracted in the release-gate round,
  see top bullet).
- **M1 (attestation core) built under the §4.4 ladder** — first module of the
  PoC rebuild. `poc/m1-attestation.mjs` (Ed25519 via `node:crypto`, zero
  deps, sign-the-exact-bytes) + `poc/m1-check.mjs` (17 cases, negatives
  first, every rejection reason exactly asserted; 17/17, exit 0). The
  verifier enforces a CLOSED claim set `{predicate, result, nonce, exp}` —
  a validly signed envelope smuggling a raw value alongside the boolean is
  rejected, not passed through. Process: throwaway spike (user-validated) →
  build → two review rounds (16 findings validated, fixed, and
  mutation-proven) → coverage-gap closure. Evidence and dead ends recorded
  in `docs/01-product/findings.md` (new — dated experiments log
  complementing the PRD).
- **Doc sweep from the M1 predicate decision:** the signed response now
  carries the predicate everywhere it is described — normative profile rule
  2 (predicate echo + the stateless-verification limit made explicit), spec
  sketch (`predicate` in the response + sig restated as a detached
  signature over the exact payload bytes; `Predicate.value` can express its
  array example), `poc/README.md` architecture diagram, PRD §4.4 ladder
  wording (M1 proves binding; single-use nonces assigned to M6's RP side).

- **Consolidated to a 3-doc inventory led by a PRD.**
  `docs/01-product/prd.md` is now the leading document (goals/gates,
  deliverables, PoC requirements, an explicit no-go list, sequence, grounded
  process facts, dated decisions log, AGENT_RULES-conformance note). The
  former `carrier-attestation-proposal.md`, `camara-plan.md`, `aaif-plan.md`,
  and `docs/02-features/attested-windowed-disclosure.md` are deleted — their
  content folded into the PRD (internal strategy/process) and two outward
  proposal docs in `docs/02-proposals/`:
  `camara-attested-windowed-disclosure.md` (problem + the normative 8-rule
  profile + modes + phase plan + risks + a pre-filled APIBacklog template
  mapping) and `aaif-agent-auth.md` (agent/delegation side only).
- **APIBacklog template re-grounded 2026-08-14** — it now carries a CAMARA
  scope-alignment section (northbound API type, Project Charter fit,
  no-overlap declaration); the CAMARA doc's §10 mapping pre-fills all fields.
- **PoC re-scoped to shippable-simplest** (`poc/README.md`): Node ≥20, zero
  deps, one command (`node poc/demo.mjs`), mock operator backend by default
  (zero credentials), Orange Playground as a swappable `--backend orange`
  adapter; four assertions each demonstrated with their negative.
- **First PoC build ROLLED BACK (2026-08-15)** — an initial implementation
  (mock + live Orange runs) was built monolith-then-integrate without
  per-module user validation, violating the build-incrementally rule. Code
  removed from the tree; the rebuild follows the PRD §4.4 module ladder
  (M1–M6), each module POC'd against its toughest assumption and
  user-validated before the next.
- **Playground reality grounded by a raw spike (kept as evidence,
  2026-08-15, recorded in `poc/README.md`):** CAMARA playground calls
  tokenize at `/openidconnect/playground/v1.0/token` while the Admin API
  needs `/oauth/v3/token` (not interchangeable — measured `401`); sim-swap
  `403 FORBIDDEN` means unknown number, not an auth failure; `/check`'s
  `maxAge` is in HOURS capped at 2400 (~100 days), so a 90-day floor is
  `maxAge: 2160` and longer floors must be computed from `/retrieve-date`;
  built-in test numbers echo backstory writes back while silently ignoring
  them — only Admin `READ` proves a write landed, so scripted backstories
  need a custom slot and READ-verification.

## 0.0.2 — 2026-08-14

- **Docs reorganized to the house convention** (matching zkagent/8een):
  `docs/01-product/` now holds the master proposal plus both submission plans
  (former `01-proposal/` + `03-submissions/`); `docs/02-features/` holds the
  normative profile (former `02-profile/`). All cross-references updated.
- **CLAUDE.md added** — agent doctrine: the one invariant (signed nonce-bound
  boolean, never raw values), claims discipline (Mode A never called ZK),
  strategy invariants (profile-first, two tracks/one seam), grounding
  discipline, process gates.

## 0.0.1 — 2026-08-14

- Repo scaffolded. Name: **justabit** ("just a bit — never more, never less").
  npm name reserved-checkable (free at scaffold time); repo-first by design —
  standards live as specs, npm is for an eventual reference SDK only.
- Master proposal imported from planning drafts
  (`docs/01-proposal/carrier-attestation-proposal.md`).
- Horizontal profile drafted (`docs/02-profile/attested-windowed-disclosure.md`).
- Submission plans for CAMARA and AAIF tracks (`docs/03-submissions/`).
- OpenAPI sketch (`spec/carrier-attestation.yaml`).
- PoC plan awaiting Orange Playground credentials (`poc/`).
