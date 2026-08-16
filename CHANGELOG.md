# Changelog

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
