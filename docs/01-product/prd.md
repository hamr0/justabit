# justabit — PRD

**Status:** ACTIVE — this document leads all specs, proposals, and the PoC.
**Date:** 2026-08-14 (consolidated from `carrier-attestation-proposal.md`,
`camara-plan.md`, `aaif-plan.md` — all three deleted; outward content moved to
`docs/02-proposals/`).
**Doctrine:** `CLAUDE.md` (invariants, claims discipline). This PRD is the
*what/when/how-good*; CLAUDE.md is the *never-break*.

---

## 1. What this project is

A standards effort: make telecom network APIs answer with **exactly what the
requester needs — a signed, nonce-bound, expiring boolean under monotone
floors — and nothing else, ever** ("attested windowed disclosure").

This is a **docs-and-proposals project with one small runnable PoC**, not a
software product. The deliverable is text that survives CAMARA/AAIF
working-group scrutiny; the PoC exists to make the text undeniable. The
decision this PRD serves: *what do we write, build, and file — in what order —
to get the profile adopted catalog-wide, as an independent author with no
member company behind them?*

## 2. Goals and success criteria

Define "good" before building (AGENT_RULES). In order of proof strength:

| Gate | Success looks like | Evidence |
|---|---|---|
| G0 Docs consolidated | Exactly 3 living docs (this PRD + 2 proposals); no orphan cross-references | repo grep |
| G1 PoC runnable | `node poc/demo.mjs` passes all 4 assertions on a clean clone, zero credentials, exit code 0 | run output |
| G2 PoC live | Same demo, `--backend orange`, against Orange Playground with scripted backstories | run output |
| G3 Circulated | Profile posted to ICM discussion / GitHub Discussion; reactions collected | links |
| G4 Supported | 2–3 named operator supporters (DT / Orange / Telefónica the likely pool) | names in template |
| G5 Filed | Commonalities guideline proposal + sim-swap adoption PR + APIBacklog PR (with supporters) submitted | PR links |
| G6 AAIF filed | Agent-auth project proposal submitted once their process is grounded | link |

Timescale is telecom-speed: quarters, not weeks. Sustained presence is itself
a deliverable (CAMARA freezes proposals after 6+ weeks GitHub inactivity or 3
missed WG meetings).

## 3. Deliverables and the 3-doc inventory

**Hard rule: three living documents, no more.** New design content is folded
into one of these (this PRD grows a dated Decisions entry, §9); side-docs are
not created. Proposal docs follow the target body's proposal standards.

| # | Deliverable | Where | Consumer |
|---|---|---|---|
| D1 | **This PRD** — requirements, sequence, no-gos, decisions | `docs/01-product/prd.md` | us |
| D2 | **CAMARA proposal** — problem, the normative profile (8 rules), modes, phase plan, risks, pre-filled APIBacklog template mapping | `docs/02-proposals/camara-attested-windowed-disclosure.md` | CAMARA Commonalities / ICM / APIBacklog WG |
| D3 | **AAIF proposal** — agent/delegation side only | `docs/02-proposals/aaif-agent-auth.md` | AAIF Identity & Trust WG |
| D4 | **PoC** — Mode A demo, 4 assertions, mock + Orange backends | `poc/` | WG readers, demo audiences |
| D5 | Sustained WG presence (meetings, mailing lists, PR responses) | calendars, minutes | CAMARA anti-staleness rules |

Supporting artifacts (not documents): `spec/carrier-attestation.yaml` stays an
illustrative OpenAPI sketch (non-normative); `README.md` is the adopter-facing
front door and mirrors — never forks — the proposals;
`docs/01-product/findings.md` is the dated evidence log (what experiments
showed, including dead ends) — it complements this PRD, which stays the home
of decisions. Design content still folds into the 3 docs, never into findings.

## 4. PoC requirements (the only build)

**Objective:** prove the four load-bearing claims of Mode A in the simplest
runnable form. A WG reader who clones the repo and runs one command must see
them pass. The PoC is *evidence*, not a product — it never ships as a
library, package, or SDK (AGENT_RULES: never ship the POC).

### 4.1 Functional requirements — the four assertions

Each assertion must be able to FAIL, and the demo must show the negative:

- **FR1 Windowing** — the wire carries `swapAge ≥ 90d → true|false`, never
  the swap timestamp; roaming → "in FR: yes/no", never a country list.
  Negative: flip the backstory ("swapped yesterday" ↔ "swapped 120d ago") and
  watch the boolean flip while the wire payload shape stays identical.
- **FR2 Nonce + expiry** — the signed response echoes the requester's nonce
  and carries an expiry. Negative: a replayed captured response is rejected;
  an expired response is rejected.
- **FR3 Blind hub** — requester↔operator legs are genuinely end-to-end
  encrypted (real crypto, not a comment); the hub's own log is printed and
  contains metering records only (count, route, "bill") — no numbers, no
  predicates, no answers. Negative: show the hub attempting to read yields
  ciphertext.
- **FR4 Monotone floor** — a request below the operator's published floor is
  **rejected**, never silently answered wider. Negative: loosen the floor in
  the request and show the rejection; tighten it and show acceptance.

- **FR7 The wired predicate set (added 2026-08-17, PRD §9 user-signed).** The
  PoC answers `simSwapAge`, `deviceSwapAge`, `roamingIn`, `presentIn`,
  `numberMatch` and `reachable`, and nothing else. Every one is backed by an
  endpoint OBSERVED answering live; a type nothing computes is never minted (the
  fabricated-fact rule, one layer up). Five rules bind all six, without
  exception: (1) the answer is a signed boolean or a refusal — never a value, a
  score or a date; (2) an off-menu threshold is refused LOUDLY and never rounded
  to the nearest bucket; (3) anything the operator cannot answer honestly is a
  refusal; (4) the operator publishes the floor and the requester may only
  tighten; (5) raw values the operator legitimately holds stay operator-side.
  Each new predicate ships with its own negative and its own disabled-guard
  control, like every assertion before it.

### 4.2 Backend adapter seam

- **FR5** One operator-facts interface, two backends:
  - `mock` (default): local stub with scriptable backstories mirroring the
    Playground's admin model (per-number swap date, roaming country,
    reachability). Zero credentials, zero network, deterministic.
  - `orange`: Orange Network APIs Playground (+990 test numbers, backstories
    via its Admin API). Credentials come **only** from the environment
    (`ORANGE_CLIENT_ID` / `ORANGE_CLIENT_SECRET` or the Playground Basic Auth
    string) — never the tree.
  - The demo, assertions, and printed evidence are byte-for-byte the same code
    path either way; only the facts source swaps. Anyone with a free Orange
    account can flip `--backend orange` and re-prove the point live.
- **FR6** Single entry point: `node poc/demo.mjs [--backend mock|orange]`.
  Prints per-assertion evidence, exits 0 only if all four (including
  negatives) hold.

### 4.3 Non-functional requirements

- Node ≥ 20, **zero dependencies** — `node:crypto` for Ed25519
  signing/verification and the E2E leg (RSA-4096 OAEP-SHA256 envelopes, per
  the 2026-08-15 decision log entry — one vetted primitive, no hand-glued
  hybrid), `node:http` if a
  process split is ever needed (default: in-process actors, one file per
  role max).
- No secrets in the tree; `.env` gitignored; no real subscriber numbers ever
  (+990 test range or mock only).
- The demo's output never uses ZK language (claims discipline is enforced in
  the artifact, not just the docs).
- Simplicity bound: the whole PoC should stay small enough to read in one
  sitting (~a few hundred lines). If it grows past "readable by a WG member
  over coffee", it is doing too much.

### 4.4 Build ladder — modular, POC-first per module, user-validated per gate

**Binding rule (2026-08-15):** the PoC is a **product**. It is built as
independent modules; **each module is POC'd first (spike aimed at its toughest
assumption), then built properly, then works end-to-end ON ITS OWN, then the
USER validates it — before the next module starts.** No chaining builds, no
integrating an unvalidated module, no "the orchestrator checked it" — the
user runs each module's check themselves.

| Module | Scope (works alone) | Toughest assumption its POC must attack |
|---|---|---|
| M1 attestation core | sign + verify `{predicate, result, nonce, exp}` (closed claim set) | tamper/expired/wrong-key/wrong-question responses genuinely REJECT (negatives first); nonce check = stateless BINDING — single-use nonces are the RP's job (M6) |
| M2 blind envelope | E2E encryption past a hub that logs metering only | the hub truly cannot read; envelope SIZE side-channel stated honestly |
| M3 floor gate | monotone floor check | below-floor is NEVER answered — no silent widening path exists |
| M4 facts adapter (mock) | scriptable backstories behind one interface | flipping the backstory flips the bit; fixture can show the negative |
| M5 facts adapter (orange) | same interface, live Playground | built-ins shadow writes (measured) — READ-verify is load-bearing |
| M6 integration | one-command demo = the four assertions; RP issues single-use per-request nonces (completes rule-2 replay rejection); RP signs requests, operator verifies via trust directory before answering (request authenticity — closes the M2 audit open item) | the modules compose without weakening any single module's guarantee |

Gate mapping: G1 = M1–M4 + M6 all user-validated; G2 = M5 user-validated live.

Ladder status (2026-08-16): **M1 user-validated 19/19** (user ran 17/17
pre-hardening, then 19/19 post-release — dated findings entry).
**M2 user-validated 10/10** (post-release user run, 2026-08-15 — the first
dated user-run record for M2; spike user-validated → build → review round, 5
findings fixed → runbook green). **M3 user-validated 22/22** (user ran 14/14
at the pre-review build gate, then 22/22 post-release after two review rounds
plus a release-gate round hardened the module to 22 cases) (spec
signed off with 3 user decisions → spike at the silent-widening traps →
build → user ran `node poc/m3-check.mjs` 14/14 → 3 mutants killed → review
round 1: 7 warnings fixed, +3 canary cases → 17/17 → review round 2: 8
findings, +2 canary cases → 19/19 → release gate: 3 surviving mutants found
on already-fixed guards, +3 cases → 22/22, plus 500k-iteration differential
fuzz clean). **M4 user-validated 33/33** (user ran 30/30 at `5d5e8aa`, then
33/33 post-release at v0.2.0 after the release-gate round — dated findings
entry) (spec signed off with 4 user
decisions → spike observed six
fail-opens in the naive adapter incl. the headline flip with a working
negative control → build → 24 cases → 28 guards mutation-tested, 27 killed,
1 proven redundant by probe rather than left looking load-bearing → adversarial
review round: an independent 19-case check written from the spec alone before
reading the suite, plus an independent 28-mutant sweep that left EIGHT
survivors, closed 1 code defect (`describe()` could throw, breaking "wire input
never throws" — so M3's release-gate open item 1 was only partially closed),
5 unpinned load-bearing guards (+6 cases → 30) and 2 shared-harness fail-opens
(truthy-non-boolean `extra.ok`; a silently shrinking suite reading as green);
200k-round leak fuzz clean, all 13 spike claims reproduced; then a
`/code-review medium` round on PR #4: 8 findings, all confirmed by execution,
all fixed — wire-supplied country-set arrays running caller code (a sparse array
reached a SIGNED answer), a revoked proxy escaping `plainSnapshot`, two
unclamped diagnostics, an unbounded `describe()` input, a green last line on a
failing run, and a self-contradicting spec sketch; case count unchanged at 30,
mutation-proven; then the v0.2.0 **release gate**: 3 more fail-opens, all of one
shape — unbounded wire-reachable work no cap actually bounded — incl. a
TOCTOU `length` re-read that walked 5,000,000 indices to a SIGNED answer past
the 300 cap, and a `describe()` fallback chain whose `toJSON` hook killed the
process at **exit 134** (fatal OOM, uncatchable); renderer rewritten to invoke
nothing caller-supplied, +3 cases → 33, four mutations each red on its own case
incl. a guard-off control returning the OOM; dated findings entries 2026-08-16).
**M5 user-validated LIVE 48/48 + 11/11 at `8e842c3`, the shipped v0.3.0 state
— G2 MET, no asterisk, nothing pending.** (User ran 47/47 + 11/11 at
`69b6f2e`, which met G2 first; the release gate then changed all three M5
files, so the user re-ran at `4ac60e9` clean; a post-gate code review round
(2026-08-17) fixed two more adapter redaction-order defects, an `assertNow`
range bound and three live-check faults — again all three M5 files — so the
user re-ran once more at `8e842c3` clean. Counts were unchanged (48/11)
throughout; each gap was closed by a run, not assumed to carry over. An earlier
44/44 + 10/10 user run at `2fd62ba`, undated at the time, is recorded in the
findings log for completeness.) Spike first: six live rounds re-ran
every recorded Playground finding before a line was written, because they were
measured on 2026-08-14/15 and a sandbox can move. Seven findings held, **three
changed** — `403 FORBIDDEN` no longer means "unknown number" on its own (a
wrong-surface token gives the same status with a different message), sim-swap
is no longer the whole interface (roaming AND reachability are both live, so
all three axes are wired and nothing is faked), and THE TRAP holds with a
sharper mechanism (a bare `UPDATE` on an unclaimed built-in now fails loud with
`400`, but the adapter's own CREATE-then-UPDATE path reproduces the echo-lies
behaviour exactly: echo carried the written date, the next READ did not). The
spike also found the stored credential is already `Basic `-prefixed — a
double-prefix that fails both token endpoints, and cost the spike's first
round. Build: `poc/m5-facts-orange.mjs` (same interface, `evaluatePredicate`
NOT reimplemented — M5 exports `createOrangeFacts` and nothing else, asserted
by a case). **Offline `node poc/m5-check.mjs` 47/47 exit 0 with zero
credentials and zero network** (injected transport replaying the spike's
captured bytes, so it runs on a clean clone); **live `node
poc/m5-check-live.mjs` 11/11 exit 0**, including the FR1 negative on real
infrastructure and the write-trap defence firing on a real built-in with the
custom-slot control succeeding; **32 mutations, 32 killed, 0 survivors.** The
sweep found two defects in the CHECK itself — a redaction case that was
vacuous (its body never reached a branch that quotes bodies, so it could not
fail) and an assertion too crude to survive its own error text — both fixed.
Then an **adversarial review round** (2026-08-16, dated findings entry) took
the suites 44 → **47** and 10 → **11** on three confirmed issues, found by an
independent 30-case check written from the spec BEFORE either shipped suite was
opened plus an independent 16-mutant sweep: (1) the write-verification
diagnostic — the message the module's most load-bearing guard produces — was
the single throw path that skipped `redact()`, leaking a planted credential half
and a planted bearer token, and it clamped AFTER serializing (measured 2354ms on
a 2e8-char value, and a `RangeError` at V8's max string length that destroyed
the loud message entirely); (2) a required mutant SURVIVED — "one token per
surface" was unpinned because the check answered both token endpoints with the
same fixture, though the two are measured non-interchangeable; (3) the live
check's cleanup DELETE was unobserved, so an interrupted run leaked a custom
slot toward the 10-cap silently. All three fixed and mutation-proven (18/18
killed, 0 survivors — the 16 above plus 2 minted against the new guards); a
315-combination leak fuzz with a planted-leak control is clean, and M1–M4 are
unchanged by exit code.

**Then the user ran M5 on their own machine and G2 was MET** — `node
poc/m5-check.mjs` **47/47** and the live `node poc/m5-check-live.mjs` **11/11**
at commit `69b6f2e` (dated findings entry, 2026-08-16). That is the first G2
validation in the project, and it stands as a record of that tree state.

**The v0.3.0 release gate then found five more issues, which re-opened the
gate** — the same post-validation pattern v0.2.0 hit with M4, and recorded the
same way rather than blurred into the line above. Two were real code defects: a stored
`countryName` element was COERCED by `Array.prototype.join`, so a hostile
element replaced the module's loudest guard with a bare 40-char `TypeError`
(offline 47 → **48**); and the live quota assertion compared `end === start`
against a baseline taken before the CUSTOM demo slot existed, so a FRESH
account's first run went RED and blamed the trap case's cleanup, which had in
fact succeeded — reproduced live (`start=0 end=1`, exit 1) and green on the
identical condition after the fix. Three were docs-honesty defects, incl. a
catalog-mapping table whose illustrative shape M1 would have REJECTED under a
sentence claiming the PoC produced it. **The user then re-ran the fixed tree at
`4ac60e9` and reported 48/48 offline + 11/11 live**, re-establishing G2 at that
state (dated findings entry, 2026-08-16). A post-gate code review round
(2026-08-17) then found and fixed two more adapter defects — `joinStored()`
clamped stored `countryName` strings BEFORE `redact()` saw them, so a >48-char
credential echoed off the wire rode an un-redactable 48-char fragment into the
write-verify diagnostic (the exact clamp-before-redact leak the `show()`
comment warns about, one step upstream of it); and `tokenFor()`'s body read sat
outside the try that redacts, the unfixed sibling of the `post()` /security
Low — plus three live-check faults (an unguarded raw-admin token bootstrap
that cached `undefined` and made case 11 blame quota for auth, an unguarded
courtesy re-script that could kill an all-green run before the tally, and case
11's at-cap conjunct blaming a successful cleanup), plus an `assertNow()` bound
at `MAX_EPOCH_MS` (a safe integer past `Date`'s range replaced the module's
loud message with a bare `RangeError`). Counts unchanged (48/11) — **and the
user re-ran the two-line runbook on the fixed tree the same day and reported
both clean, re-closing G2 at `8e842c3`**.

**M6 round (2026-08-17) — two user-validated modules changed, so two counts
moved.** The M6 composition spike attacked "the modules compose without
weakening any single module's guarantee" and came back with two module-level
asks, both user-signed and both built surgically: M1 now **exports** its
duplicate-top-level-key scanner so a signed REQUEST can be checked for the same
equivocation (**19 → 20 cases**), and M3's declared fix point is closed — its
rejection-message builder threw a bare `TypeError` on a BigInt or a
throwing-`toJSON` value instead of producing the loud named-input rejection
(**22 → 23 cases**, every previously pinned reason byte-identical). Both counts
are **AGENT-RUN 20/20 and 23/23 by exit code; a user re-run is PENDING.** The
user's 19/19 and 22/22 records stand for the trees they were run on and are not
transferred to these — same rule the M4 and M5 rounds followed.

**M6 BUILT (2026-08-17) — `poc/demo.mjs` + `poc/m6-check.mjs`. AGENT-RUN 22/22
(demo) and 28/28 (check) by exit code; USER VALIDATION PENDING, so G1 is NOT
yet met.** POC first: a throwaway composition spike outside the tree attacked
"the modules compose without weakening any single module's guarantee" and came
back with five findings that shaped the build rather than being discovered
during it — (1) the repeated-query oracle (decision #1 above), (2) the
hand-rolled request verifier had no duplicate-key defence because M1's scanner
was module-private (decision #2), (3) M3's rejection-message builder threw on a
non-JSON value (the fix point, above), (4) the obvious canonical-predicate
spelling is NOT injective — a mutation dropping the threshold left the whole
spike green while the operator answered `gte P1D` to a `gte P90D` question, and
`[FR,BE]` collided with the single-element set `['FR,BE']` — and (5) M3's
unclamped, wire-derived reasons can exceed M2's envelope capacity, where `seal()`
THROWS, so an unclamped refusal crashes the operator instead of refusing it.
M6 therefore owns four things no module owns: the transport frame
`{iss, payload, sig}`, the injective canonical predicate string, the single-use
nonce store (M1's nonce check is stateless BINDING and says so), and the reason
clamp. A FIFTH was not in the plan and is the round's own finding: an
adversarial probe of the finished, green `demo.mjs` showed the top-level REQUEST
field set was still open, so a request carrying `floors` — one letter off — had
its floor silently dropped and got a signed answer under the operator's own
`P90D` while the requester believed it demanded `P365D` (decision log entry
above). Closing it took the demo to 22 assertions and the check to 27 cases (28
after the exit-code fix logged above, and **38 after the 2026-08-17 adversarial
review round** — four real defects, one more found while fixing them, and ten
independent mutation survivors, all pinned).
The lesson is worth more than the fix: **a closed-set discipline is only as good
as its outermost layer, and the composition owns a layer none of the modules
do** — which is exactly the failure class M6's own POC gate was aimed at, found
one level above where the spike was looking. Beyond the four assertions the demo also shows the request-path guards —
off-menu refusal, duplicate-key refusal, response key pinning — each with its
own disabled-guard control, and signs its refusals so the blind hub cannot forge
a denial. The check is offline in both modes: `--backend orange` is exercised
through an injected transport replaying captured Playground bytes, and with the
keys and nonce held fixed the two backends produce a **byte-identical signed
frame**, which is one honest half of the FR5 "only the facts source swaps"
claim: it shows the wire carries the bit and nothing about where the bit came
from. The other half is that the orange leg drives the bit at all — replay a
5-day-old swap through the same injected transport and the same question comes
back `false` — added 2026-08-17, because byte-identity alone would also pass for
an adapter that ignored its own responses.

**Mutation coverage, corrected 2026-08-17.** This paragraph used to claim "18
mutations against M6's own guards, all killed". An INDEPENDENT sweep of 34
meaningful mutations then found **10 survivors — 29% survival**, so the original
18 were a self-selected set that happened to hit what the suite already pinned.
The survivors were: the malformed-frame and missing-nonce transport rejects;
the floor gate's position relative to `getFacts` (the ordering argument the
whole pipeline rests on, claimed in two comments and asserted nowhere); three of
`verifyRefusal`'s four checks; two of `unpackSigned`'s guards; the hub log's
open field set; and M3's `render` symbol/function branches. All ten are pinned
by cases added the same day (m6-check 29–38, m3-check 24), and the review's four
real defects plus one found while fixing them are pinned beside them. The live
`--backend orange` run is the user's, in the runbook — nothing in this round
touched the network.

On §4.3's simplicity bound, honestly: `poc/demo.mjs` is 1093 lines, of which 452
are comment, 90 blank and 551 code — and roughly half of that code is the narrative
PRINTING the reader asked for (the `Q:`/`A:`/negative-flip transcript), not
composition machinery, which is closer to 200 lines. That is over "a few hundred
lines" if the whole file is counted and inside it if the explanation is counted
as prose, which it largely is. Recorded rather than trimmed: the comments and
the narrative are the deliverable for a WG reader, and cutting them to hit a
line count would optimise the wrong thing.

**Scope of that claim, corrected 2026-08-17.** It used to read "every count
above is from a run on the user's own machine", and by the time the M6 and
review rounds landed above it that was false: M6's 22/38, M1's 20 and M3's 24
are all marked AGENT-RUN in the paragraphs directly above, and this was the one
place in the repo claiming user validation for M6. It contradicted the ladder's
binding rule, so it is narrowed to what actually happened rather than deleted.

**The user-run counts are M1 19/19, M2 10/10, M3 22/22, M4 33/33 and M5 48/48
offline + 11/11 live**, at the commits named below. Everything the 2026-08-17
rounds changed — M1 19→20, M3 22→24, M6 22 assertions / 38 cases — is AGENT-RUN,
with a **user re-run PENDING**. At commit
`5d5e8aa` (dated findings record, 2026-08-16) the user ran 19/19, 10/10, 22/22
and 30/30. The v0.2.0 release gate then changed two files —
`poc/m4-facts-mock.mjs` and `poc/m4-check.mjs` — taking M4 to 33 cases, leaving
M1/M2/M3 untouched (no module source, no check file, and `poc/check-harness.mjs`
unchanged). **After the v0.2.0 merge (main at `7c41c83`, tag `v0.2.0`) the user
re-ran all four and reported 19/19, 10/10, 22/22, 33/33** (dated findings record,
2026-08-16) — closing the last "user re-run pending" marker, per the 0.1.0
precedent where the user closes that gap after the release. Two open items had
been settled by the user in an earlier pass — the three deliberately-unpinned
redundant guards stay as documented defence-in-depth, and `reachable` was minted
into the illustrative spec-sketch `Predicate` enum now rather than at M6 (no
normative surface enumerates predicate types, so nothing else moved).

**M2, M4 and M5 carry no asterisk** — user-validated at their current case
counts on the shipped tree. **M1, M3 and M6 do**: the 2026-08-17 rounds moved
M1 to 20 and M3 to 24 and built M6, and none of those counts has been run by the
user yet. (Amended 2026-08-17 — this line said "all five are user-validated" and
had not been re-read against the rounds that landed after it.) M5's asterisk was raised twice and
retired twice by runs, not by argument: G2 was met at `69b6f2e`, re-opened by
the release-gate fixes and re-established at `4ac60e9`, re-opened again by the
2026-08-17 post-gate review round (all three M5 files touched) and re-closed at
`8e842c3`. Keeping the asterisk visible until a run retires it is deliberate —
the alternative is to ship fixes unmentioned and let an earlier G2 record
appear to cover code it never saw.

(For the record, an earlier version of this note said the `/code-review` round
"changed exactly four files … verified by `git diff --stat`". `git show --stat
5d5e8aa` reports **seven**: those four plus `findings.md`, `prd.md` and
`poc/README.md`. The four were the code/spec files; the claim as written was
checkable and did not check out, so it is corrected here rather than dropped.)

### 4.5 POC-first discipline applied to each module

The riskiest assumption is **not** the crypto (stdlib, boring) — it is that
the **Orange Playground's sim-swap/roaming facts and backstory Admin API
actually fit the adapter shape** (auth flow, response fields, backstory
scripting). So:

1. Build mock backend + demo first (unblocked today; G1).
2. The moment credentials exist, run a ~15-min spike against the real
   Playground **before** writing the orange adapter — hit sim-swap +
   backstory-set endpoints raw, capture real responses, then shape the
   adapter to reality (a pasted doc sample under-specifies; verified pattern).
3. Stated caveat carried into all demo output: the operator shim simulates
   operator-side predicate computation and signing; consent/legal-basis legs
   are out of scope.

## 5. No-go list

Explicit and binding. "Useful" is not a defense for any of these.

1. **Never describe Mode A as zero-knowledge** — in docs, code output,
   commits, repo metadata, talks. ZK language is reserved for Mode B.
2. **No raw value ever reaches the requester in profile mode** — no
   timestamp, country, number, address. Bands are a declared transitional
   exception (profile rule 7), not a loophole.
3. **No readable hub, ever.** No caching, inspection, or "efficiency"
   features that let the aggregator see identifiers, predicates, or answers.
4. **No loosening.** Floors tighten downstream only; widening a window is an
   explicit, distinct, consent-visible operation — never a default, never
   silent.
5. **No Mode B build.** Holder presentment stays design-on-paper (D2 §Mode B)
   until Mode A has landed; no holder app, no proof circuits, no wallet
   integration now.
6. **No new vertical API as the primary ask.** Profile first; the
   CarrierAttestation new-case covers only what no existing API can (agent
   floors, Mode B).
7. **No product-ization.** No npm package, no SDK, no hosted service. The PoC
   is demo evidence only.
8. **No SIM-as-principal-root claims.** A SIM is farmable; floors price
   resets (economic scarcity), they do not create uniqueness. Never conflate
   the consumer-agent floor (voice+data) with the machine-agent profile (M2M).
9. **No unpinned claims, no stale submissions.** Every CAMARA/GSMA/AAIF state
   claim is pinned to a source and re-verified before filing; a claim that
   dies on re-verification is retracted visibly.
10. **No dependencies on zkagent/8een in submission docs.** They are cited as
    *one implementation* of the principal layer; the proposals must stand
    standards-neutral.
11. **No fourth document.** Design content folds into the 3-doc inventory
    (§3); this PRD's Decisions log absorbs what would otherwise be a side-doc.
12. **No APIBacklog PR before supporters.** Recruit 2–3 named supporters
    first (G4 gates G5); an unsupported PR from an independent burns the one
    first impression.
13. **No secrets or real subscriber data in the repo** — test ranges and env
    credentials only. `.claude/` session context is never published.

## 6. Sequence

```
Phase 0  Consolidate docs (this change)                          [G0]
Phase 1  PoC on mock backend — build + 4 assertions green        [G1]
Phase 2  USER: create Orange Playground account (free, instant)
         → 15-min raw spike → orange adapter → live re-run       [G2]
Phase 3  Circulate D2 profile in ICM / GitHub Discussion;
         collect reactions; recruit supporters                   [G3→G4]
Phase 4  File: Commonalities guideline proposal + sim-swap
         adoption PR (nonce+expiry on /check)                    [G5]
Phase 5  File: APIBacklog PR (CarrierAttestation new-case) with
         named supporters, template pre-filled from D2 §mapping  [G5]
Phase A  (parallel) Ground AAIF submission process → finalize D3
         → submit to Identity & Trust WG                         [G6]
Phase ∞  Attend cadence: Backlog WG + ICM + sub-project calls;
         respond within the 6-week/3-meeting staleness windows   [D5]
```

Phases 1 and 3 can overlap; Phase 5 strictly follows G4.

**Immediate order of work inside Phase 1 (2026-08-17, agreed):** (1) the M6
adversarial review round's findings land and get fixed; (2) the six-predicate
build round (§9, dated today — signed off as DESIGN, nothing wired yet);
(3) proposal edits, including the `kyc-match` retraction; (4) the USER
validation run; (5) release 0.4.0. Deliberately in that order: a review round's
findings against a 3-predicate tree are cheaper to fix than against a
6-predicate one, and a user validation run before the build round would have to
be repeated.

## 7. Process facts that gate the work (grounded)

- **CAMARA** (Linux Foundation; participation open, no membership fee). Our
  two deliverables ride **two different processes** (both grounded 2026-08-14
  from `Governance/documentation/API-Onboarding-and-Lifecycle.md` +
  `APIBacklog/README.md`):
  - **Profile → Commonalities/ICM (the light path):** ordinary WG
    contribution — issue + PR against the design guidelines, argued in their
    meetings/mailing list; **adoption = the maintainers merging the PR** into
    a guidelines release, which then propagates to all APIs via the
    meta-release cycle (every API must align with latest Commonalities to
    release). No TSC new-repo machinery.
  - **CarrierAttestation → APIBacklog (the heavy path):** GitHub issue
    (their issue template) + linked PR with the filled
    `API-proposal-template.md` → codeowners validate the template → member
    companies decide support (**each supporter commits ≥1 maintainer**) →
    bi-weekly Backlog WG sessions (2nd Thu 09:00 UTC, 4th Thu 15:00 UTC)
    check charter fit + overlap; objections must be resolved — the bar is
    **lazy consensus** → **TSC approves or rejects** → onboarding tracker →
    Sandbox repo created.
  - Template re-verified 2026-08-14: now includes a **CAMARA scope
    alignment** section — northbound API type (Service API vs Service
    Management API), Project Charter fit, no-overlap declaration, explicit
    out-of-scope items, owner declaration. East-west/federation APIs are out
    of scope. D2 §template-mapping pre-fills all of it.
- **Nothing is ever accepted by inactivity — inactivity only kills.**
  6+ weeks without GitHub activity, or the owner missing 3 consecutive WG
  meetings, or (post-TSC-approval) no onboarding progress within 3 WG
  sessions → **Frozen** (label, open PRs closed, off the agenda). Frozen ~6
  months / two meta-release cycles → **Archived**; resuming requires a brand
  new proposal. A Sandbox repo dies too: 3 months without contributions or
  no initial release within 6 months → archived.
- **Adoption is three ascending events:** WG lazy consensus → TSC approval →
  operators implementing. Lifecycle gates after Sandbox: **Incubating**
  requires one released API version **implemented by ≥1 real operator**,
  meta-release participation, and **3 committed maintainers from 3 different
  companies**; **Graduated** requires 2 release cycles with a stable version
  + multi-market certified deployment. An independent can carry steps up to
  TSC approval with supporters' votes; past Sandbox the ecosystem must
  co-own it by rule — which is why supporter recruitment (G4) is
  existential, not political nicety. Sub-project cadence example: SimSwap
  meets every 4 weeks, Thu 07:30 UTC.
- **Verified spec baseline (2026-08-14):** SimSwap v2.1.0 (`/check`,
  `/retrieve-date`, `/retrieve-age-band`), NumberVerification v2.1.0
  (`/verify`, `/device-phone-number`; 3-legged identifier omission is
  normative), KYC r2.2 (`kyc-match`, `kyc-fill-in`, `kyc-age-verification`).
  All Incubating. Open Gateway: 86 operator groups, 300+ networks. Full
  citations live in D2 §References.
- **AAIF (grounded 2026-08-15):** hosts community projects; Identity & Trust
  WG mandate matches D3 verbatim. Submission process verified from
  `github.com/aaif/project-proposals` (README + issue template
  `.github/ISSUE_TEMPLATE/project-proposal.yml`): (1) review eligibility
  guidance → (2) submit a new issue via the proposal template, all required
  sections complete → (3) backlog triage, scheduled before the Technical
  Committee → (4) TC vote at a scheduled meeting, majority (>50%) advances
  to the Governing Board. Declined proposals may reapply after 3 months
  with demonstrated progress. Next: map D3's sections onto the template
  fields (needs a logged-in view of the form or the raw template YAML).
- **Orange PoC rail:** Network APIs Playground — free instant developer
  account, 15 built-in +990 test numbers plus 10 custom, Admin API scripts
  backstories. Lab tier (real lab numbers +40789103050–59) exists but may
  change without notice — demo material, not a dependency.

## 8. Risks (execution)

Outward/technical risks (SD-JWT-vs-ZK pushback, holder availability, operator
incentive asymmetry, aggregator capture, MNP-vs-tenure, trust-directory
centralization, residual issuance metadata) live in D2 §Risks — they are
part of the proposal's honesty and stay in the outward text. Execution risks
we manage here:

1. **Solo author + staleness rules.** Mitigation: recruit a member-company
   co-owner early; calendar the cadences; the repo itself shows activity.
2. **Orange account is a user action** — PoC live tier (G2) blocks on it;
   mock tier (G1) does not. Don't let G2 block G3.
3. **AAIF template mapping pending** — process now grounded (§7); D3 still
   needs mapping onto the proposal template's required fields; keep it
   modular (summary / proposal / seam sections survive any format).
4. **Scope leak from Mode B enthusiasm** — the no-go list (§5.5) is the
   guard; PoC reviews check against it.

## 9. Decisions log

Dated, append-only. Rationale in one line; details in the stash/history.

- **2026-08-17 (latest) — `presentIn` BUILT; the predicate set is 3 → 5 so far
  this round (AGENT-RUN, user validation PENDING).** The third state is the whole
  of it: `location-verification/v1/verify` answers `TRUE`, `FALSE` and `PARTIAL`,
  and `PARTIAL` produces a signed REFUSAL carrying no bit. Four things recorded:
  (1) **The published PARTIAL policy is a FLOOR AXIS**, `partialPolicy`, with one
  legal value (`refuse`) — so "the requester may only tighten it, using the
  existing rule-5 machinery" is literally what the code does, and a request asking
  to have PARTIAL rounded for it dies at the floor gate before any fact is read.
  This moved a user-validated module: **M3 24 → 25 cases**, and that count is
  AGENT-RUN.
  (2) **The AREA is canonicalised by KEY, not by typing order.** `JSON.stringify`
  serialises an object in insertion order, which for a parsed request is whatever
  the requester typed; two spellings of the same circle would otherwise produce
  two signed predicate strings and one requester would get its own correct answer
  back as a `predicate mismatch`.
  (3) **`lastLocationTime` is not filtered out — it is never read.** There is no
  line that reads it, so there is nothing to filter.
  (4) **An honest residual, added not removed:** an area is a dial (centre plus
  radius) and is walkable toward a position the way a duration threshold is
  bisectable. `presentIn` gets no bucket menu — the signed decision does not give
  it one, and there is no natural coarse set of circles the way there is of
  durations — so the cap here is the operator's own resolution plus the
  rate-limit/billing backstop. Weaker than the duration menu, and written down as
  weaker.
  Counts moved: m3 24 → 25, m4 36 → 38, m5 52 → 54, m6 40 → 43, demo 27 → 30.
  Fourteen more mutations, fourteen killed — **one of which (the location
  write-back) SURVIVED on the first pass** and exposed a genuinely unpinned guard:
  the read-after-write comparison that makes this round's assumed Admin write
  shapes survivable was itself covered for the device axis and not for the
  location one. Pinned, plus two more mutations against the fix.
- **2026-08-17 — `deviceSwapAge` BUILT; the predicate set is 3 → 4 so
  far this round (AGENT-RUN, user validation PENDING).** The signed design above
  is now code: same bucket menu as `simSwapAge`, same `gte` compare, its own
  fact. Three things the build settled that the design had only asserted, each
  recorded because they are the kind of detail a design round cannot reach.
  (1) **The reference adapter now prefers the profile-conforming SURFACE.**
  `/check` answers a bit about a `maxAge` window in HOURS capped at 2400
  (boundary-tested), so `P30D`/`P90D` questions are answered by `/check` — the
  operator never reads a date — and only `P180D`/`P365D` fall back to
  `/retrieve-date`. There is deliberately NO rounding down to a window `/check`
  can express: that would answer a question nobody asked, signed.
  (2) **A coarse `/check` answer is a bit about ONE window, so it carries that
  window and the compare refuses unless it EQUALS the threshold asked.** Without
  the equality an adapter could answer "not swapped in 30 days" to a "90 days?"
  question and the bit would look perfect on the wire.
  (3) **A new seam, `factQuery`.** Three of the six predicates make the operator
  ask its own upstream a question-shaped question, so part of the predicate has
  to reach the adapter. It reaches it through one validating chokepoint that
  never throws, invokes nothing caller-supplied and returns frozen primitives or
  `{}` — never `req.predicate` itself, which would put unvalidated wire objects
  into the one module that builds outbound HTTP. Measured while pinning it: a
  hostile value on a MENU'D type never reaches the adapter at all, because the
  published menu refuses it before any fact is read.
  Counts moved: m4 33 → 36, m5 48 → 52, m6 38 → 40, demo 22 → 27. Twelve
  mutations against the round's new guards, twelve killed.

- **2026-08-17 (latest) — The wired predicate set goes 3 → 6 (user-signed;
  DESIGN, not yet built).** `simSwapAge`, `deviceSwapAge` (NEW — not one of the
  original seven), `roamingIn`, `presentIn`, `numberMatch`, `reachable`. Every
  one is backed by an endpoint **observed answering live** on the Playground
  today (findings, dated entry: sim-swap `/check` + `/retrieve-date`,
  device-swap `/check` + `/retrieve-date`, device-roaming-status,
  location-verification `/verify`, kyc-match `/match`,
  number-verification `/verify`). This is **not a reversal** of the same-day
  trim to 3 — it is that decision's PRINCIPLE applied to new evidence: *wire
  only what a real fact source answers.* The trim removed four types nothing
  could compute; the sweep then found live sources for four of them, and one
  more (`deviceSwapAge`) that was never on the list. `tenure` and `simType` stay
  OUT: the data genuinely exists operator-side (the Admin dataset carries a
  `tenure` axis with `latestTenureChange` + `contractType`), but **no CAMARA
  read endpoint was found** at either `tenure/v1/retrieve` or
  `sim-tenure/v1/retrieve` — both `400 "unhandled path"`. A predicate whose only
  source is an operator-internal admin surface proves something about this
  sandbox, not about the catalog.
- **2026-08-17 (latest) — `deviceSwapAge` takes the IDENTICAL shape to
  `simSwapAge` (user-signed; DESIGN).** Same coarse bucket menu
  `P30D | P90D | P180D | P365D`, `/check` where the bucket fits inside the
  measured 2400-hour (≈100-day) cap, the date path above it. Deliberately not a
  new shape: two facts that answer the same question about different hardware
  should not teach a reader two grammars, and a second shape is a second place
  for the window to widen quietly.
- **2026-08-17 (latest) — `numberMatch`: the requester declares its THRESHOLD in
  the question, off a published menu of 60 / 70 / 80 / 90 and nothing else; the
  operator compares internally and answers a BOOLEAN; the score never crosses
  the wire (user-signed; DESIGN).** Two halves, both load-bearing. *Why a
  threshold at all:* relying parties genuinely need their own tolerance — real
  names vary by accent, middle name, transliteration and typo, and that is
  exactly why CAMARA returns a score in the first place. Forcing one operator
  threshold on everybody would either reject legitimate matches or accept sloppy
  ones. Profile rule 1 already says the window belongs in the question. *Why a
  menu and not free choice:* a free-choice threshold is binary-searchable in
  precisely the way the M6 spike binary-searched the swap date — same oracle,
  same nine queries, same quantisation answer. And the measured `kyc-match`
  behaviour is worse than a threshold walk: it returns a similarity **gradient**
  (`"Bob Wrong"` → 53, `"Alice Arnaut"` — one letter off — → 97), which lets a
  requester hill-climb to the subscriber's real registered name. Boolean out,
  score never on the wire, off-menu refused.
- **2026-08-17 (latest) — `presentIn`: boolean out, and `PARTIAL` REFUSES
  (user-signed; DESIGN).** `location-verification/v1/verify` has three states,
  measured: `TRUE`, `FALSE`, and `PARTIAL` (Paris at a 100 m radius). `PARTIAL`
  is the operator saying *I cannot answer at the resolution you asked for*, and
  it is **not rounded** to yes or no — it produces a refusal, the same honest
  outcome as a straddling band or a missing fact. Rounding it would sign a
  confident answer indistinguishable on the wire from a real one. The operator
  PUBLISHES its PARTIAL policy (default: refuse) and the requester may only
  TIGHTEN it, never loosen — the existing rule-5 floor machinery, no new
  mechanism. `lastLocationTime` (a raw timestamp that rides on *every*
  location-verification response, including the boolean-looking ones) never
  crosses the wire.
- **2026-08-17 (latest) — Five rules apply to all six predicates, no exceptions
  (user-signed; DESIGN).** (1) A signed boolean or a refusal — never a value, a
  score or a date. (2) An off-menu threshold is refused **loudly** and never
  rounded to the nearest bucket. (3) Anything the operator cannot answer
  honestly is a refusal. (4) The operator publishes the floor; the requester may
  tighten only. (5) Raw values the operator legitimately holds stay
  operator-side. Written as one list rather than per-predicate because a rule
  that holds for five of six is not a rule.
- **2026-08-17 (latest) — On the probing oracle generally: the residual walk is
  priced and bounded at the layer ABOVE this profile (user's position, recorded
  as the project's stance).** Per-subject rate limits, per-query billing and the
  operator's own query log are where a walk is made expensive, throttleable and
  auditable. THIS profile's duty is narrower and absolute: **the raw value never
  crosses the wire.** Quantisation caps resolution; it is not claimed to close
  the oracle, and the claim is not upgraded now that the predicate set is wider.
- **2026-08-17 (latest) — `/retrieve-age-band` DOES NOT EXIST on the Orange
  Playground; the previous entry's "UNVERIFIED" is now CLOSED, unfavourably.**
  `400 {"code":"BAD_REQUEST","message":"unhandled path"}` — the Playground's own
  signal for an unwired route. The entry below recorded its availability as
  untested rather than assumed in either direction; it has now been probed and
  the answer is the unflattering one. Consequence: band → bucket mapping
  **cannot be demonstrated live** — it stays mock-only or documented, never
  claimed. The `/check` boolean surface, by contrast, does exist and answers
  (`{"swapped":false}`), and its `maxAge` cap was boundary-tested at 2400 hours
  (2400 → 200, 2401 → 400) on both sim-swap and device-swap.
- **2026-08-17 — Exit 2 is reserved for a backend that COULD NOT RUN; a
  crashed mock run is a FAILURE (M6).** Not a planned decision — a defect found
  by asking what a genuine regression looks like to a CI gate. `main()` mapped
  any mid-run throw to 2, but `--backend mock` has no prerequisites at all (no
  credential, no network, nothing that can be unavailable), so a backend that
  STARTED and then threw can only be a code regression. A gate that correctly
  treats 2 as skip-on-prerequisite would therefore have swallowed a real
  regression in silence. Reproduced with a throwing `setBackstory`: 2 before, 1
  after. Under `--backend orange` a mid-run throw stays 2 — there an unreachable
  live operator genuinely IS a prerequisite failure. The in-code comment had the
  direction backwards ("reporting it as a failed assertion would be the more
  flattering lie"); the flattering lie is the other one. Same family as the
  closed-field-set defect below: **the composition owns a boundary no module
  owns, and an under-modelled boundary rounds optimistically toward "fine".**
  M6: 27 → 28 cases.
- **2026-08-17 — The RP nonce store's unbounded growth is DOCUMENTED, not
  built (M6).** The single-use store deletes a nonce when its response is
  verified, so a request that never receives one — rejected by the hub, dropped
  in transit, answered after the requester gave up — leaves its entry resident
  forever. Harmless in a demo issuing a handful of requests against an injected
  clock; unbounded memory in anything real. A deployment evicts on EXPIRY (the
  answer's validity window is already the natural TTL). NOT built here: the demo
  would have to fake elapsed time to exercise it, and **a stated limit beats an
  untested one** — the same rule the rest of this repo's honest limits follow.
- **2026-08-17 — Four DEPENDENCY-INJECTION seams, one code path each (M6).**
  Recorded because they are a deviation from the frozen shape and would
  otherwise read as test scaffolding in production code. `createWorld({keys})`
  (RSA-4096 keygen is ~2.7s/key and the check builds a world per case),
  `buildRequest({number, nonce})` (a byte-reproducible transcript is how the two
  backends are proved to emit IDENTICAL signed claim bytes),
  `createBackend(mode, {basicAuth, fetchImpl})` (replays captured Playground
  bytes offline; the `mode` branch is FR5, the user-facing `--backend`, not a
  test flag), and `main(argv, {createBackendImpl})` (added 2026-08-17 to drive a
  started-then-crashing backend through the real entry point). Each is a default
  parameter: no `if (test)`, no `NODE_ENV`, no branch that exists only for a
  suite. **Stated honestly:** guard-disabling is a SEPARATE seam — the `controls`
  flags on `hub.route` / `operator.handle` / `rp.verifyResponse` ARE `if` branches
  in production functions, and that is deliberate and published, because a guard
  never shown disabled has not been proven load-bearing. A reader running the
  demo passes none of them.
- **2026-08-17 — Why the PoC reads a PRECISE SIM-swap date, and what that does
  and does not say (M5/M6, documentation only).** The question is fair: the
  profile's own argument favours coarse surfaces, and `/retrieve-date` is the
  surface the proposal itself lists as NON-conforming. Three things, none of them
  a walk-back. (1) The invariant governs the WIRE. The operator legitimately
  holds the raw value — it is the operator's own subscriber data, and windowing
  is something it does TO that value; what must never happen is the value
  reaching the requester, which the wire-byte scan proves by looking for the raw
  needles in the sealed payload and finding only the bit. (2) `/check` is not
  used for a MEASURED reason, not a preference: its `maxAge` is expressed in
  HOURS with a cap of 2400 (≈100 days, measured 2026-08-14), so it cannot
  express the published menu's `P180D` or `P365D` buckets at all — it cannot
  serve the profile as specified. (3) `/retrieve-age-band` is the surface that
  WOULD fit, and it is provider-optional; **its availability on the Orange
  Playground is UNVERIFIED — never probed, recorded as untested rather than
  assumed either way.** Which endpoint M5 calls is unchanged this round.
- **2026-08-17 — Predicate thresholds are QUANTISED to a published menu (M6
  decision #1, user-signed), and the repeated-query oracle is recorded as an
  honest limit.** The M6 composition spike found the one hole no single module
  can see: every individual response is a clean windowed bit, but the SEQUENCE
  is not. Because profile rule 1 puts the window in the QUESTION and hands the
  threshold to the requester, **nine** legal, signed, sealed, metered queries
  binary-searched the subscriber's exact swap age (137 days, recovered exactly)
  — with every response passing every check and the raw value nowhere on the
  wire. Floors do not reach it: M3 gates the *profile* demanded, not the
  threshold asked. The demo operator therefore publishes a coarse menu next to
  its floor (`P30D | P90D | P180D | P365D`) and **refuses** anything off it —
  refuses, never rounds, because rounding answers a question nobody asked. This
  CAPS resolution at the bucket (≈2 bits/year); it does not close the oracle,
  and it is written down as a cap. Only ORDERED thresholds get a menu, which
  after the enum trim means exactly one type — `simSwapAge`; `roamingIn` takes a
  set, which has no ordering to bisect, and `reachable` is already a single bit
  at full resolution, so the menu's scope is a statement, not an oversight.
  Two further
  mitigations: per-subject rate limits + per-query billing are the economic
  backstop (ADOPTED — Mode A's commercial rail is also its defence); a monotone
  tighten-only repeat rule was CONSIDERED and NOT adopted (it defeats bisection
  but leaves a one-directional walk — 137 queries instead of 9, ~15× cost and
  still a complete recovery: a constant factor, not a property; and it makes a
  second legitimate question depend on the first with no way to scope or expire
  that state). Written up in the CAMARA proposal §3.5.
- **2026-08-17 — The top-level REQUEST field set is CLOSED (M6).** Not a
  planned decision — a defect found by an adversarial probe of `poc/demo.mjs`
  *after* it was written and green. Every layer under it was already closed (M1's
  claims, M3's axes, M4's predicate fields) and the outermost envelope, which no
  module owns, was not: a request carrying `floors` — one letter off — had its
  floor silently DROPPED, so `checkFloor` saw no requested floor, applied the
  operator's own `P90D`, and signed an answer while the requester believed it
  had demanded `P365D`. Silent widening arriving through a spelling mistake,
  which is M3's closed-axis argument one level further out. Unknown fields are
  now refused by name (the misspelling is the actionable half), with the name
  rendered only while short and printable so an embedded newline cannot forge a
  log line. The lesson generalises: **a closed-set discipline is only as good as
  its outermost layer, and the composition owns a layer none of the modules do.**
  Demo: 20 → 22 assertions (the guard and its control); check: 25 → 27 cases.
- **2026-08-17 — The subscriber number rides INSIDE the sealed, signed request
  (M6, user-signed).** The hub therefore never sees it, which is what FR3
  requires. But it IS in the request, and that is a demo stand-in for
  token-derived identity, stated in the demo output and here rather than
  glossed: a real 3-legged deployment derives the subject from the access token
  and omits the identifier entirely — NumberVerification already makes that
  omission normative, and profile rule 4 generalises it catalog-wide.
- **2026-08-17 — Spec sketch `Predicate` enum trimmed 7 → 3 (M6,
  user-signed).** `spec/carrier-attestation.yaml` now lists only the types the
  PoC wires end to end — `simSwapAge`, `roamingIn`, `reachable` (the boolean
  `value` branch stays, because `reachable` needs it and the reference module
  rejects the string spelling). `tenure`, `simType`, `presentIn` and
  `numberMatch` were aspirational: nothing computes them, so a reader could send
  a schema-valid request the reference operator refuses — an enum answering for
  facts that do not exist, the fabricated-fact class M4 closed, one layer up.
  They move to a **future-work note** in the CAMARA proposal §3.3.1 rather than
  being deleted; `tenure` and `simType` remain FLOOR axes and are unaffected,
  and `tenure` additionally carries the open MNP question (§9.8 of the
  proposal), which minting it as a predicate would have shipped as settled. The
  normative profile enumerates no predicate types (proposal §3.2), so nothing
  normative moved. YAML re-parsed after the edit.
- **2026-08-17 — M1 exports its duplicate-key scanner; duplicate-key REQUESTS
  are rejected outright (M6 decision #2, user-signed).** A signed request is
  signed bytes too and the equivocation is symmetric — one signature over bytes
  carrying `floor` twice lets the operator enforce `P90D` while the requester
  believes it demanded `P365D`. `verifyAttestation` cannot be reused for a
  request (it demands the closed ANSWER set), so M1 exports
  `hasDuplicateTopLevelKey` and M6 borrows it rather than keeping a second,
  divergent copy — the copy that would face the wire first. The export states
  its precondition (the text must already have parsed as JSON) and M6 calls it
  in M1's own order: signature → parse → scan. The RP's remedy is a clean
  re-request: **no partial acceptance, and never a pick between the two
  values.** M1: 19 → 20 cases.
- **2026-08-17 — M3 fix point closed: `checkFloor` never throws on wire
  input.** The rejection-message builder used `JSON.stringify` on the offending
  value, which throws on a BigInt and runs a caller-supplied `toJSON`; either
  way a bare `TypeError` escaped and replaced the module's loud named-input
  rejection — in the rejection path itself. The renderer now invokes nothing
  caller-supplied (M4's post-release-gate `describe()` shape), with an
  `[unrenderable]` floor because `Array.isArray` throws on a revoked Proxy.
  Neither shape survives a JSON round trip, so the envelope's transit was what
  kept it unreachable — a transport accident, not a contract, which is why it
  is fixed at the module rather than documented at the composition. Reason
  length stays unclamped here on purpose: the clamp belongs on the side that
  knows the envelope capacity, i.e. M6. M3: 22 → 23 cases.
- **2026-08-16 — M4 facts-adapter spec signed off (4 user decisions).**
  (1) **Fake clock:** backstories store RELATIVE time ("swapped N days ago")
  and every evaluation takes an INJECTED `now` — deterministic forever, no
  wall clock anywhere; relative→absolute conversion happens only at the
  M5/Orange boundary. (2) **Setter calls:** `setBackstory(number, {…})` is
  callable mid-run, mirroring the Playground Admin API — re-scripting a
  number and re-asking is how the FR1 negative is shown. (3) **Raw facts
  only:** the adapter returns raw facts (swap age, roaming country,
  reachability) and NEVER a boolean; a separate `evaluatePredicate(facts,
  predicate)` turns facts + predicate into the bit — this split is what
  makes M5 a drop-in swap. (4) **Unknown number = loud error**, never a
  default backstory (a silent default is fail-open — the trap family M3
  closed, measured again here answering for subscribers who do not exist).
  Trusted/untrusted follows M2/M3: operator input (backstories, numbers,
  clock) throws; wire input (the predicate) never throws.
- **2026-08-15 — Versioning scheme corrected (user-decided).** Module
  releases are features, not patches: this M3 release ships as **0.1.0**
  (not 0.0.5); each subsequent module bumps MINOR (M4→0.2.0 … M6→0.4.0);
  PATCH is for fixes; **1.0.0 = PoC complete + proposals submission-ready**.
  Existing 0.0.x tags stay untouched (history is not rewritten).
- **2026-08-15 — M3 floor-gate spec signed off (3 user decisions).**
  (1) Durations: `P<n>D` and `P<n>Y` only, 1 year = 365 days stated;
  months REJECTED as ambiguous (28–31 days — no honest compare exists).
  (2) Omitted axis in a request floor: the operator's published value
  applies anyway (omission = silent tightening, allowed); the returned
  `effective` floor makes the inheritance visible. (3) Unknown/typo'd
  axis: closed-set rejection (an ignored typo silently drops a constraint
  — the exact widening path M3 kills). Gate = pure function
  `checkFloor(published, requested)`; published floor is per-OPERATOR
  config (never hardcoded — the §3.4 reference values are the demo
  operator's choice); broken published config throws loud, wire input
  never throws.
- **2026-08-15 — Both v0.0.3 security Mediums closed now (user-decided:
  "fix both now").** (1) Duplicate claim keys are a rejection — normative in
  profile rule 2, implemented in the M1 verifier (byte-level scan, keys
  compared after escape decoding; mutation-proven: guard off, one signed
  blob reading true-to-last-wins/false-to-first-wins parsers is ACCEPTED;
  guard on, 19/19). (2) Key pinning — normative in profile rule 3: the
  verifier pins the expected operator key before verification; unsigned
  `iss` is a lookup hint and must never select the trusted key (the
  reference verifier already had this shape — text-only; code lands with
  the trust directory at M6).
- **2026-08-15 — Decisions round after the M2 gate (all user-decided).**
  (1) Profile rule 6 gains the size line: envelopes MUST NOT expose payload
  size to the aggregator (fixed-length or padded) — backed by the M2
  measurement that a length-tracking transport turns the billing log into a
  side channel. (2) Request authenticity assigned to M6: the RP signs
  requests, the operator verifies via the trust directory before answering
  (closes the M2 audit open item). (3) Envelope replay to the operator =
  documented honest limit (billing noise only; production API auth, rate
  limits and billing reconciliation cover it) — no stateful nonce memory in
  the demo. (4) Guardrails pre-tool hook wired locally (`.claude/`,
  gitignored): denies secret-file writes and destructive shell, asks on
  auth/CI/settings — armed before M5 touches Orange credentials. (5) Author
  placeholders filled: Amr Hassan. (6) AAIF submission process grounded
  (§7) from the aaif/project-proposals repo.
- **2026-08-15 — M2 envelope shape settled.** One vetted stdlib primitive:
  RSA-4096 OAEP-SHA256 (`publicEncrypt`/`privateDecrypt`), keys exchanged
  via the trust directory — NEVER inside payloads (this is what makes the
  446-byte cap workable). `seal` throws loudly on the sender's own faults
  (oversize, non-RSA key — capacity derived from the recipient key);
  `open` rejects-never-throws on untrusted wire input, with failure modes
  deliberately collapsed to one reason (padding-oracle avoidance).
  Measured: ciphertexts constant 512 B → the hub's byte log carries no
  content signal; count/timing/pairing remain visible (stated honestly).
  Bigger payloads (Mode B, bundles) exceed one envelope and require a
  vetted AEAD hybrid as an explicit future decision — never hand-glued
  primitives. Demo transport only; production = TLS + HPKE-class.
- **2026-08-15 — M1 built under the ladder; verifier shape settled.**
  Spike (throwaway, user-validated) → build → review round. Attestation =
  Ed25519 (`node:crypto`, one vetted primitive, zero deps), sign-the-exact-
  bytes (no canonicalization), unix-ms `exp` in the demo. Verify order:
  response shape → signature over raw bytes (throw-safe) → parse →
  non-null-object claims → predicate matches the question asked → `result`
  is a boolean → nonce (type-gated) → expiry → closed claim set (any field
  beyond `{predicate, result, nonce, exp}` rejects — the one-invariant's
  requester-side enforcement point). Verifier is STATELESS —
  single-use nonces are the requester's job (honest limit, in the tests'
  wording). `predicate` added to the spec sketch's signed set (it was
  missing — a signed answer to a different question would have verified).
  Production note: demo picks Ed25519 for determinism; the profile picks
  whatever standard JOSE algorithm the WG settles on.
- **2026-08-15 — `findings.md` created (user-ordered).** Dated evidence log
  at `docs/01-product/findings.md`: experiments and dead ends, complementing
  this PRD. Not a design side-doc — design still folds into the 3 docs.
- **2026-08-15 — PoC build ROLLED BACK to G0; module ladder made binding
  (§4.4).** The first build went monolith-then-integrate with orchestrator-only
  checks — violating AGENT_RULES build-incrementally and keeping the user out
  of validation. Code archived out of the repo; grounded spike findings
  (Playground token endpoints, maxAge in HOURS capped 2400, built-in
  write-shadowing, 403=unknown-number) are KEPT as dated evidence in
  `poc/README.md` — knowledge survives, code restarts. Every module: POC →
  build → user validates → only then the next.

- **2026-08-14 — Consolidation (this PRD).** 3-doc inventory (PRD + CAMARA +
  AAIF proposals); `carrier-attestation-proposal.md`, `camara-plan.md`,
  `aaif-plan.md`, and `docs/02-features/attested-windowed-disclosure.md`
  folded and deleted. PoC = Node zero-dep, mock backend default + swappable
  Orange adapter, one command, four assertions with negatives. No-go list
  made a first-class PRD section.
- **2026-08-14 — Template re-grounded.** APIBacklog template gained a scope-
  alignment section (northbound type, charter fit, overlap declaration) —
  folded into D2's pre-filled mapping.
- **2026-08-14 (earlier) — Core standard = attested windowed disclosure.**
  Signed, nonce-bound, expiring booleans under monotone floors; never raw
  values.
- **2026-08-14 (earlier) — Two modes; Mode A ships first.** Mode A preserves
  per-query billing + aggregator revenue share (the adoption wedge); Mode B
  (holder presentment, true ZK) is roadmap. A2P lesson → the hub is
  structurally blind, not contractually trusted.
- **2026-08-14 (earlier) — Horizontal profile, not a new vertical API.**
  CAMARA precedent (`/retrieve-age-band`, identifier-free 3-legged,
  `kyc-age-verification`) makes "finish what you started, catalog-wide" the
  ask; CarrierAttestation new-case only for agent floors + Mode B.
- **2026-08-14 (earlier) — Two tracks, one seam.** CAMARA = operator side,
  AAIF = agent side; they meet at the RFC 9421 header; neither depends on the
  other's approval.
- **2026-08-14 (earlier) — Agent-grade floor.** Consumer:
  `voice+data ∧ tenure ≥ 2y ∧ swapAge ≥ 90d (∧ postpaid optional)`, monotone.
  Machine-agent profile is separate and embraces M2M. Economic scarcity,
  explicitly not uniqueness.
- **2026-08-14 (earlier) — Name: justabit; repo-first, not npm-first.**

## 10. AGENT_RULES conformance (the caveat, stated)

This repo follows `.claude/remember/AGENT_RULES.md` with one declared
adaptation: **the product is documents; the only code is a small PoC that
must stay shippable/runnable in its simplest form.** Concretely:

- **Applies unchanged:** spec-before-build (this PRD), POC-first aimed at the
  riskiest assumption (§4.4), prove-don't-assert (assertions must show the
  negative), no secrets in the tree, dependency hierarchy (zero deps),
  surgical changes, no papering over (honest limits stay in the text).
- **Merge/release gates:** nothing merges blind — every merge goes through
  code review plus the release flow (`/code-review`; `/security` on anything
  touching credentials or untrusted input; `/ship` pre-release). Outward
  submissions additionally re-verify every grounded claim (no-go 9).
- **Adapted:** the Testing Trophy does not govern prose — a proposal's "test
  suite" is (a) grounded-claim re-verification before every submission and
  (b) WG scrutiny; retractions are the regression fixes. The PoC gets
  assertion-style self-checks in the demo itself (exit code is the test);
  a separate test pyramid would be heavier than the artifact it tests.
- **Unchanged even for the PoC:** it is never shipped as a product (§5.7),
  and a real secret never enters the tree even in a spike.
