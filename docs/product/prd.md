# justabit — PRD

**Status:** ACTIVE — this document leads all specs, proposals, and the PoC.
**Date:** 2026-08-14 (consolidated from `carrier-attestation-proposal.md`,
`camara-plan.md`, `aaif-plan.md` — all three deleted; outward content moved to
`docs/product/`).
**Last updated:** 2026-08-25.
**Doctrine:** `CLAUDE.md` (invariants, claims discipline). This PRD is the
*what/when/how-good*; CLAUDE.md is the *never-break*.

---

## 1. What this project is

A standards effort: make telecom network APIs answer with **exactly what the
requester needs — a signed, nonce-bound, expiring boolean under monotone
floors — and nothing else, ever** ("attested windowed disclosure").

This is a **docs-and-proposals project with one small runnable PoC**, not a
software product. The deliverable is text that survives CAMARA/IETF
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
| G4 Filed (CAMARA) | Commonalities guideline proposal + sim-swap adoption PR + APIBacklog issue/PR submitted (API family owner: Cairenes Solutions) — filing does not wait on named supporters | issue/PR links |
| G5 Supported | Named operator supporters recorded in the template's Supporters field — populated by the Working Group during evaluation, downstream of filing (no-go 12 retired 2026-08-25) | names in template |
| G6 IETF filed | Internet-Draft submitted covering agent/delegation semantics (target: OAuth WG automated-agent-authorization work item; CATALIST as a routing venue if OAuth WG doesn't fit) | draft link |

Timescale is telecom-speed: quarters, not weeks. Sustained presence is itself
a deliverable (CAMARA freezes proposals after 6+ weeks GitHub inactivity or 3
missed WG meetings).

## 3. Deliverables and the 3-doc inventory

**Hard rule: three living documents, no more.** New design content is folded
into one of these (this PRD grows a dated Decisions entry, §9); side-docs are
not created. Proposal docs follow the target body's proposal standards.

| # | Deliverable | Where | Consumer |
|---|---|---|---|
| D1 | **This PRD** — requirements, sequence, no-gos, decisions | `docs/product/prd.md` | us |
| D2 | **CAMARA proposal** — problem, the normative profile (8 rules), modes, phase plan, risks, pre-filled APIBacklog template mapping | `docs/product/camara-attested-windowed-disclosure.md` | CAMARA Commonalities / ICM / APIBacklog WG |
| D3 | **Agent/delegation proposal** — agent/delegation side only, targets the IETF OAuth WG. | `docs/product/ietf-agent-delegation.md` | IETF (OAuth WG); supersedes `docs/archive/aaif-agent-auth.md`, retained only as a dated, superseded record of the earlier AAIF-targeted text |
| D4 | **PoC** — Mode A demo, 4 assertions, mock + Orange backends | `poc/` | WG readers, demo audiences |
| D5 | Sustained WG presence (meetings, mailing lists, PR responses) | calendars, minutes | CAMARA anti-staleness rules |

Supporting artifacts (not documents): `spec/carrier-attestation.yaml` stays an
illustrative OpenAPI sketch (non-normative); `README.md` is the adopter-facing
front door and mirrors — never forks — the proposals;
`docs/logs/findings.md` is the dated evidence log (what experiments
showed, including dead ends) — it complements this PRD, which stays the home
of decisions; `docs/product/camara-filing-issue.md` (step 1, the GitHub
issue body) and `docs/product/camara-filing-template.md` (step 2, the
filled API-proposal template) are the live filing deliverables for CAMARA
APIBacklog, derived verbatim from D2 §10 and never a source of design
content — each becomes an immutable record once filed. Design content
still folds into the 3 docs, never into findings.

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
| M1 attestation core | sign + verify `{predicate, result, nonce, exp}` (closed claim set) | tamper/expired/wrong-key/wrong-question responses genuinely REJECT (negatives first); nonce check = stateless BINDING — single-use nonces are the requester's job (M6) |
| M2 blind envelope | E2E encryption past a hub that logs metering only | the hub truly cannot read; envelope SIZE side-channel stated honestly |
| M3 floor gate | monotone floor check | below-floor is NEVER answered — no silent widening path exists |
| M4 facts adapter (mock) | scriptable backstories behind one interface | flipping the backstory flips the bit; fixture can show the negative |
| M5 facts adapter (orange) | same interface, live Playground | built-ins shadow writes (measured) — READ-verify is load-bearing |
| M6 integration | one-command demo = the four assertions; requester issues single-use per-request nonces (completes rule-2 replay rejection); requester signs requests, operator verifies via trust directory before answering (request authenticity — closes the M2 audit open item) | the modules compose without weakening any single module's guarantee |

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
had not been re-read against the rounds that landed after it.) **Amended again,
2026-08-18: M4 no longer belongs in the no-asterisk group either.** The 3 → 6
predicate round (same day, landing after this line was written) moved
`m4-check.mjs` 33 → 40 without a user re-run — the maintainer's last M4 run
was still at 33 — so M4 carries an asterisk too, same as M1 and M3. (M3's own
count also moved again the same round, 24 → 25, per the `presentIn` entry
below; still no user re-run at either count.) M5's asterisk was raised twice and
retired twice by runs, not by argument: G2 was met at `69b6f2e`, re-opened by
the release-gate fixes and re-established at `4ac60e9`, re-opened again by the
2026-08-17 post-gate review round (all three M5 files touched) and re-closed at
`8e842c3`. Keeping the asterisk visible until a run retires it is deliberate —
the alternative is to ship fixes unmentioned and let an earlier G2 record
appear to cover code it never saw.

**M5's asterisk was raised a third time and retired a third time, same rule
(2026-08-18).** The 3 → 6 predicate round moved `m5-check-live.mjs` 11 → 19
cases without a user re-run at the time (recorded PENDING in the decisions
log below); the user then ran it live at tip `3276ed0` and reported 19/19,
retiring it again. The same live session also produced **M6's first CLEAN
user run of `poc/demo.mjs` itself**, `--backend orange` → 33/33 — but not its
first user run: the user had already run it live on 2026-08-17 and scored
**32/33**, and that run is what surfaced the vacuous leaky-operator control
(the fix this whole entry is about). M6's asterisk stayed up through that
first, failing run and is retired only now, by the second, clean one.
`m6-check.mjs`'s own offline count (45) and M1's (20) and M3's (25) are
unaffected by either run and stay asterisked. Full detail in the 2026-08-18
decisions-log entry.

**All asterisks retired (2026-08-18, superseding the four paragraphs
above).** Two `/code-review` rounds the same day moved M1 to 20, M3 to 26,
M4 to 40, M5's offline count to 60, M5's live count to 19 and built M6 to 46
— every count above this paragraph is now stale by module count, not just
by asterisk. The user then ran the FULL suite at code commit `4446517` /
docs commit `c921508` (2026-08-18 08:16) and reported every module clean at
its current count: M1 20/20, M2 10/10, M3 26/26, M4 40/40, M5 60/60 offline
+ 19/19 live, M6 46/46, `demo.mjs` 33/33 mock and 33/33 live. **M1–M6 all
carry no asterisk as of `4446517`/`c921508`** — this is the first time every
module has been user-validated at its current count on the same tree. See
`findings.md`, 2026-08-18 (latest).

(For the record, an earlier version of this note said the `/code-review` round
"changed exactly four files … verified by `git diff --stat`". `git show --stat
5d5e8aa` reports **seven**: those four plus `findings.md`, `prd.md` and
`poc/README.md`. The four were the code/spec files; the claim as written was
checkable and did not check out, so it is corrected here rather than dropped.)

**Asterisks raised and retired a further time, on the uncommitted tree
(2026-08-18, superseding the paragraph above).** Two further rounds moved
M4 to 42 (case 42, the guard-text-search fix) and M5's offline count to 66
(the axis-signal-unification round, finishing what the roaming/reachability
round started), both AGENT-RUN with a user re-run PENDING at the time — see
the two decisions-log entries below the top one. The user then ran the FULL
suite on their own machine against the CURRENT uncommitted working tree and
reported every module clean at its current count: M1 20/20, M2 10/10, M3
26/26, M4 42/42, M5 66/66 offline + 19/19 live, M6 46/46, `demo.mjs` 33/33
mock and 33/33 live — every count user-run. **M1–M6 all carry no asterisk
on this tree.** Because the tree is uncommitted, this record is pinned to
the tree itself rather than a commit pair: it covers exactly the working
tree present at the time of the run, and per this repo's own rule, any
later change to a covered file (commit or no commit) re-opens the relevant
gate again. Full record: `CHANGELOG.md`, Unreleased, and the top entry of
the decisions log below.

**Asterisks raised again by a further fix round (2026-08-18, superseding the
paragraph above): `demo.mjs` moved 33 → 34 cases, agent-run only.** The
six-item fix round (top decisions-log entry) added a persisted regression
case for the pre-seal capacity guard fix, so `demo.mjs`'s own count is no
longer the `33/33` the paragraph above reports — it is **34/34, agent-run,
NOT yet user-validated at this count**. `m6-check.mjs` (which shells out to
`demo.mjs` and now PARSES its result line rather than matching the literal
`'RESULT: 33/33'`, closing the same "pins a spelling, not a behaviour"
defect class fixed twice already for `m4-check.mjs` case 42) moved 46 → 47
for its own new case. Every `33/33` figure ABOVE this paragraph remains an
accurate dated record of the tree it was measured against and is NOT
rewritten; it simply no longer describes the current tree. **M1–M6 all
carry an asterisk again** pending a user run at the new counts. Full
record: `CHANGELOG.md`, Unreleased, and the top entry of the decisions log
below.

**Asterisks raised again by a `/code-review medium --fix` round (2026-08-18,
superseding the paragraph above): `m5-check.mjs` moved 66 → 67, `demo.mjs`
moved 34 → 35, both agent-run only.** The review closed two test-coverage
gaps found during its own review of a two-item DRY consolidation: a case
pinning the axis-signal gate's `=== true` strictness (`m5-check.mjs`) and a
case pinning the exact set `PLAIN_MIN_NEEDLE` drops from the leak scan
(`demo.mjs`). Both are mutation-proved (see the top decisions-log entry).
Every `66/66`/`34/34` figure ABOVE this paragraph remains an accurate dated
record of the tree it was measured against and is NOT rewritten; it simply
no longer describes the current tree. **M1–M6 all carry an asterisk again**
pending a user run at the new counts. Full record: `CHANGELOG.md`,
Unreleased, and the top entry of the decisions log below.

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

### 4.6 Known limits of the PoC (accepted, parked)

Standing home for the PoC's honest limits — so a reader does not have to dig
through the append-only Decisions log (§9) to find what is still weak. These
are **accepted limits, parked by user decision (2026-08-18)**, not open
defects: "for the sake of demoing I think they can be parked, we are not
seeking perfection but valid and solid code/prototype." The PoC's job is to
make the proposal text undeniable, not to be production-hardened. Per this
repo's stated discipline (CLAUDE.md, "Honest limits stay in the text"),
neither item below is softened.

1. **The raw-value leak scan cannot test very short values.**
   `poc/demo.mjs`'s raw-value leak scan drops needles shorter than
   `PLAIN_MIN_NEEDLE = 2` — a value whose every spelling is under 2
   characters cannot be leak-tested by this scan at all. Accepted because the
   alternative is worse: `DEVICE_FLIPPED_DAYS_AGO = 4` produces the bare
   needle `"4"`, which matches ordinary digit content (epoch timestamps, byte
   counts, billing counters) in nearly every frame — a needle that reds a
   clean run asserts nothing, the same reasoning already applied at
   `OPAQUE_MIN_NEEDLE = 8`. Still covered: that value's LONG spellings
   (`345600000`, its ISO instant, `2026-08-13`) remain in the leak inventory
   and are scanned, so the value itself is not unguarded — only its
   1-character spelling is. **What would make it bite:** a future secret
   whose ONLY meaningful spelling is a single character; that value would be
   structurally unreachable by this scan and would need a dedicated check.
   First recorded 2026-08-18 (§9, `d85d3cf`-tree entry).

2. **`m5-check.mjs` case 67 proves itself by crashing, not by asserting.**
   The case pins that the axis-signal gate requires strictly `=== true`, not
   merely truthy. Under mutation (relaxing the gate to `hasOwn(q, key)`
   alone) the case does go RED with a non-zero exit — but via an UNCAUGHT
   `location-verification` 404 escaping to the wire, not via its own
   assertion evaluating false. The failure IS detected, and fail-loud on an
   unexpected live call is itself correct defence-in-depth, but the case's
   designed proof path (its own assertion firing) has never been observed
   exercised. **What would make it bite:** if that stray call ever returned
   success instead of a 404, the crash would not happen, and detection would
   rest entirely on the case's own assertion — which would then need to have
   actually been proven to fire. First recorded 2026-08-18 (§9, the
   `/code-review medium --fix` round entry that introduced case 67).

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
9. **No unpinned claims, no stale submissions.** Every CAMARA/GSMA/IETF state
   claim is pinned to a source and re-verified before filing; a claim that
   dies on re-verification is retracted visibly.
10. **No dependencies on zkagent/8een in submission docs.** They are cited as
    *one implementation* of the principal layer; the proposals must stand
    standards-neutral.
11. **No fourth document.** Design content folds into the 3-doc inventory
    (§3); this PRD's Decisions log absorbs what would otherwise be a side-doc.
12. ~~No APIBacklog PR before supporters.~~ **RETIRED 2026-08-25 —
    verified false as a CAMARA requirement.** The APIBacklog template's own
    Supporters field reads verbatim: "List of supporters. *NOTE: That shall
    be added by the Working Group.*" — the WG populates it during
    evaluation, downstream of filing; supporter maintainer commitments bind
    only at Sub Project creation, further downstream still. This was never
    a CAMARA process fact — it was the author's own risk-management
    judgement about first impressions, stated as if it were a gate. Per
    no-go 9's own rule, retracted visibly rather than silently dropped. The
    user's decision: file first, network later (§9 decisions log,
    2026-08-25).
13. **No secrets or real subscriber data in the repo** — test ranges and env
    credentials only. `.claude/` session context is never published.
14. **No orphaned references.** After retracting a claim, renaming or moving
    a file, dropping a target/term, or changing a heading, sweep the whole
    repository for the old term or path and classify every hit before
    calling the change done — corrected, or deliberately preserved as dated
    history, and the second must be a decision, never an oversight. The
    sweep covers markdown, code, spec files, generated indexes, GitHub repo
    metadata (description and topics), directory structure (git cannot see
    an empty directory), and internal anchors (a changed heading changes
    its slug). Evidence: five instances missed in one session,
    `docs/logs/findings.md` (2026-08-28).

## 6. Sequence

```
Phase 0  Consolidate docs (this change)                          [G0]
Phase 1  PoC on mock backend — build + 4 assertions green        [G1]
Phase 2  USER: create Orange Playground account (free, instant)
         → 15-min raw spike → orange adapter → live re-run       [G2]
Phase 3  Circulate D2 profile in ICM / GitHub Discussion;
         collect reactions                                       [G3]
Phase 4  File: Commonalities guideline proposal + sim-swap
         adoption PR (nonce+expiry on /check) — still open; open
         the APIBacklog issue + PR (CarrierAttestation new-case,
         template pre-filled from D2 §mapping, API family owner
         = Cairenes Solutions) — supporters are NOT a
         precondition (no-go 12 retired 2026-08-25). **APIBacklog
         half DONE 2026-08-28: issue #330
         (github.com/camaraproject/APIBacklog/issues/330) + PR #331
         (github.com/camaraproject/APIBacklog/pull/331), both
         OPEN, awaiting Working Group evaluation — nothing
         approved yet. The Commonalities/ICM half is still
         outstanding.**                                           [G4 partial]
Phase 5  WG evaluation populates named supporters (template
         validation → company support analysis → bi-weekly
         Backlog WG lazy consensus)                                [G5]
Phase B  (re-homed from AAIF, 2026-08-25) Draft the agent/
         delegation Internet-Draft (RFCXML/xml2rfc v3,
         `draft-<lastname>-<wg>-<topic>-00`) → submit before the
         IETF 127 cutoff, 2 Nov 2026 23:59 UTC → attend the
         IETF 127 Hackathon, 14–15 Nov 2026 (free, non-members
         welcome) → IETF 127 meeting, 14–20 Nov 2026, San
         Francisco. Target WG: OAuth (automated-agent-
         authorization work item); CATALIST as a fallback routing
         venue. D3 (`docs/product/ietf-agent-delegation.md`)
         is drafted; remaining work is turning it into an actual
         Internet-Draft (RFCXML/xml2rfc toolchain)                [G6]
Phase ∞  Attend cadence: Backlog WG + ICM + sub-project calls +
         IETF WG list/meetings; respond within the 6-week/
         3-meeting staleness windows (CAMARA) and I-D 185-day
         expiry (IETF)                                            [D5]
```

Phases 1 and 3 can overlap; Phase 4 does not wait on Phase 5. Phase B runs
independently of the CAMARA phases — no shared gate, per "two tracks, one
seam" (CLAUDE.md), except that AAIF is no longer one of the two tracks
(§9, 2026-08-25 decisions).

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
  co-own it by rule — which is why WG-populated supporters (G5) are
  existential past Sandbox, not political nicety, even though they are no
  longer a precondition for filing (G4; no-go 12 retired 2026-08-25).
  Sub-project cadence example: SimSwap meets every 4 weeks, Thu 07:30 UTC.
- **Verified spec baseline (2026-08-14, re-verified 2026-08-24):** SimSwap
  v2.1.0 (`/check`, `/retrieve-date`, `/retrieve-age-band`) and
  NumberVerification v2.1.0 (`/verify`, `/device-phone-number`) hold, both
  still Incubating; `GET /device-phone-number` takes no request body and is
  structurally identifier-free off the 3-legged token (its sibling
  `POST /verify` still requires an identifier). KYC is no longer one r2.2
  spec — it split into three repos post-Spring25: kyc-match (r1.2, v0.4.0),
  kyc-fill-in (r1.3, v0.4.1), kyc-age-verification (r1.3, v0.2.1, Sandbox
  per its lifecycle badge — though its own README body text still says
  "Incubating stage since February 2025", an unresolved contradiction).
  Open Gateway: 86 operator groups, 300+ networks. Full citations live in
  D2 §References.
- **AAIF — DROPPED as a submission target (2026-08-25 re-verification).**
  **Correction (2026-08-25 re-verification):** the entry that stood here
  said the process was "grounded 2026-08-15" and described a 4-stage
  proposal-review track. That framing was WRONG — the URLs and stage
  mechanics it cited were accurate, but it treated a project-DONATION gate
  as a standards-proposal track. AAIF is "Agentic AI Foundation", a Linux
  Foundation project since December 2025 (founding contributions MCP,
  goose, AGENTS.md; sources: linuxfoundation.org press release, aaif.io).
  Its `github.com/aaif/project-proposals` intake, verified verbatim from
  `.github/ISSUE_TEMPLATE/project-proposal.yml`, requires "evidence of
  production deployments in at least two different organizations", "at
  least 2 core maintainers from different organizations and at least 10
  contributors", and a signed Contribution Agreement transferring all
  project trademarks and accounts to the Foundation before the Governing
  Board can vote. This author is a solo independent with a single-author
  PoC and zero external adoption — roughly 8 of ~14 required fields cannot
  be filled honestly. These are facts we do not have, not writing tasks.
  The Identity & Trust WG's TOPIC still fits the work; the DOOR is wrong,
  not the idea — recorded that way, not as "AAIF was a dead end." D3 has
  since been re-homed onto the IETF track below as
  `docs/product/ietf-agent-delegation.md`;
  `docs/archive/aaif-agent-auth.md` is retained only as a dated,
  superseded record of the earlier AAIF-targeted text.
- **Agent/delegation arm re-homed to IETF (grounded 2026-08-25).** An
  unaffiliated individual can submit an Internet-Draft with no membership,
  no sponsor, and no fee (authors.ietf.org/submitting-your-internet-draft;
  datatracker.ietf.org/submit/tool-instructions/) — exactly the gates that
  disqualified AAIF do not exist here. RFC 9421 (HTTP Message Signatures)
  is PUBLISHED, Proposed Standard, February 2024, from the HTTPBIS WG — it
  is not in progress and there is nothing to submit to for it; new work
  CITES it. HTTPBIS's charter excludes new domain-specific extension
  semantics, so delegation semantics do not belong there. **Best first
  target: the OAuth WG** — its charter (datatracker.ietf.org/doc/
  charter-ietf-oauth/, updated 2026-06-04) carries a work item developing
  "new mechanisms or/and extensions for authorization of automated agents
  working on behalf of users, including addressing scenarios where
  automated agents act across multiple administrative domains." Other
  venues noted: WIMSE (workload identity; charter explicitly EXCLUDES
  personal identities, cutting against a human-rooted model), SPICE
  (credential formats only), CATALIST (a coordination/routing venue, not a
  drafting WG — good place to float the idea and get routed). I-D
  mechanics: format RFCXML (xml2rfc v3); naming
  `draft-<lastname>-<wg>-<topic>-00`; an I-D EXPIRES 185 days after
  posting unless refreshed. **Key dates:** I-D submission cutoff for IETF
  127 is **2 November 2026, 23:59 UTC**; IETF 127 Hackathon **14–15
  November 2026** (free, open to non-members, needs only a free
  Datatracker account); IETF 127 meeting 14–20 November 2026, San
  Francisco. Main-meeting registration fee COULD NOT BE VERIFIED — left
  unstated, not guessed. **Prior art, load-bearing:**
  `draft-klrc-aiagent-auth-03` (6 July 2026, expires 7 Jan 2027,
  https://datatracker.ietf.org/doc/draft-klrc-aiagent-auth/) — six authors
  from Defakto Security, AWS, Zscaler, Ping Identity, OpenAI and Okta,
  composing WIMSE/SPIFFE agent identity + RFC 9421 + OAuth 2.0 delegation,
  close to our architecture. It is an INDIVIDUAL draft, not WG-adopted.
  Verified by direct fetch: it contains NO reference to SIM cards, mobile
  network operators, carrier attestation, telco APIs, or physical identity
  documents (passport/eMRTD) — so our two differentiators survive intact:
  (a) SIM-anchored economic scarcity via operator APIs, (b) a
  document-rooted human principal. **OPEN DECISION, pending a full read of
  that draft:** fold our work in as an extension of it versus write a
  distinguishing draft — not to be settled until the draft has been read
  in full (§9). **Naming trap, recorded so it isn't re-discovered the hard
  way:** IETF already owns "PASSporT" (STIR/SHAKEN, Personal Assertion
  Token) — our document-rooted layer must always be written as "ICAO/
  eMRTD passport" or "travel-document identity", never bare "PASSporT".
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
   **The staleness clock is now live** (§5 no-go 9, §7): issue #330 / PR
   #331 filed 2026-08-28, both open — 6+ weeks of GitHub inactivity or 3
   missed WG meetings freezes the proposal per §7, so sustained presence on
   the two threads is no longer preparatory, it is due.
2. **Orange account is a user action** — PoC live tier (G2) blocks on it;
   mock tier (G1) does not. Don't let G2 block G3.
3. **`ietf-agent-delegation.md` still has to become an actual Internet-Draft
   (§7, §9)** — the AAIF→IETF re-homing is DONE (D3 already targets IETF);
   the remaining risk is turning the doc into I-D form (RFCXML/xml2rfc v3,
   `draft-<lastname>-<wg>-<topic>-00`) ahead of the IETF 127 cutoff, 2 Nov
   2026 23:59 UTC; keep it modular (summary / proposal / seam sections
   survive any format).
4. **Scope leak from Mode B enthusiasm** — the no-go list (§5.5) is the
   guard; PoC reviews check against it.

## 9. Decisions log

The full rationale for every decision lives in `docs/logs/findings.md`; this table is the index.

| Date | Decision | Status | Where |
|---|---|---|---|
| 2026-08-30 | IETF draft-00 written and VALIDATED (not submitted); RFC 9421 has no delegation vocabulary; 2 ZK attributions corrected | active | [findings.md](../logs/findings.md#2026-08-2930-latest--ietf-draft-00-written-and-validated-rfc-9421-has-no-delegation-vocabulary-two-zk-attributions-corrected) |
| 2026-08-25 | Fold-in-vs-distinguish resolved as HYBRID (klrc-aiagent-auth-03 read) | active | [findings.md](../logs/findings.md#2026-08-25--open-decision-from-the-entry-below-closed-fold-in-versus-distinguish-resolved-as-hybrid-after-a-full-read-of-draft-klrc-aiagent-auth-03-raw-text) |
| 2026-08-25 | AAIF dropped; agent arm re-homed to IETF; no-go 12 retired | active | [findings.md](../logs/findings.md#2026-08-25--submission-strategy-shift-aaif-dropped-agent-arm-re-homed-to-ietf-no-go-12-retired-api-family-owner-decided) |
| 2026-08-18 | Full user validation run, uncommitted tree — BOTH GATES MET | active | [findings.md](../logs/findings.md#2026-08-18--user-ran-the-full-validation-suite-on-their-own-machine-against-the-current-uncommitted-tree-the-tree-the-entries-below-describe-every-suite-clean-zero-fail-zero-typeerror-zero-error-lines-in-either-log-both-gates-met-on-this-tree) |
| 2026-08-18 | code-review --fix on fix round below (agent-run, NOT user-validated) | superseded | [findings.md](../logs/findings.md#2026-08-18--code-review-medium---fix-round-on-the-fix-round-below-agent-run-not-user-validated--g1-and-g2-stay-re-openedpending-at-the-new-counts) |
| 2026-08-18 | Fix round on 5 items at `bb0b52f` COMPLETE (agent-run, not user-validated) | superseded | [findings.md](../logs/findings.md#2026-08-18--fix-round-on-the-five-open-items-recorded-at-bb0b52f-now-complete-agent-run-not-yet-user-validated--g1-and-g2-stay-re-openedpending) |
| 2026-08-18 | Full user validation run on PRIOR tree `bb0b52f` — BOTH GATES MET (does not carry forward) | active | [findings.md](../logs/findings.md#2026-08-18--user-ran-the-full-validation-suite-on-their-own-machine-against-the-current-uncommitted-working-tree-this-record-applies-to-that-prior-tree-at-bb0b52f-only--it-does-not-carry-forward-to-the-fix-round-in-the-entry-above-which-changed-executable-code-both-gates-cover-every-suite-clean-zero-fail-zero-typeerror-zero-error-lines-in-either-log-both-gates-met-on-this-tree) |
| 2026-08-18 | Fixes `m4-check.mjs` case 42 — pinned spelling not behaviour (agent-run, not user-validated) | superseded | [findings.md](../logs/findings.md#2026-08-18--fixes-m4-checkmjs-case-42-itself-it-pinned-the-guards-spelling-not-its-behaviour-agent-run-not-yet-user-validated) |
| 2026-08-18 | Finishes axis-signal unification, all 6 axes (agent-run, not user-validated) | superseded | [findings.md](../logs/findings.md#2026-08-18--finishes-the-axis-signal-unification-the-prior-entry-started-agent-run-not-yet-user-validated-all-six-operator-axes-now-gate-on-predicatesaxesneedxxx-closing-the-two-the-prior-round-left-on-the-old-per-axis-pattern) |
| 2026-08-18 | Closes roaming/reachability unconditional-read item (agent-run, not user-validated) | active | [findings.md](../logs/findings.md#2026-08-18--closes-the-roamingreachability-unconditional-read-open-design-item-agent-run-not-yet-user-validated-both-axes-are-now-conditional-on-getfacts-gated-on-a-factquery-carried-needroaming-needreachability-signal--the-same-pattern-the-simdevice-axes-already-used) |
| 2026-08-18 | Full user validation run at `4446517`/`c921508` — BOTH GATES MET, same commit | active | [findings.md](../logs/findings.md#2026-08-18--user-ran-the-full-validation-suite-on-their-own-machine-at-4446517c921508-log-timestamped-0816-every-suite-clean-zero-fail-zero-typeerror-zero-error-lines-in-the-entire-log-both-gates-met-at-4446517-for-the-first-time-at-the-same-commit) |
| 2026-08-18 | 2nd code-review --fix: cross-requester sealing fixed (m6 45→46); G1/G2 pending | superseded | [findings.md](../logs/findings.md#2026-08-18--second-code-review-medium---fix-round-cross-requester-sealing-fixed-m6-45--46-spec-closure--g1-and-g2-were-pending-at-4446517-until-the-full-user-run-above) |
| 2026-08-18 | code-review --fix + /security: 6 fixes; G1 AND G2 RE-OPENED (PENDING) at `9b04854` | superseded | [findings.md](../logs/findings.md#2026-08-18--code-review-medium---fix-round--security-6-fixes-1-user-approved-behaviour-change-m3-25--26-m5-58--60-g1-and-g2-both-re-opened-pending-at-9b04854) |
| 2026-08-18 | LIVE Orange run 32/33 caught vacuous control; fixed, RE-RUN 33/33 (USER-RUN, `3276ed0`) | active | [findings.md](../logs/findings.md#2026-08-18--a-live-orange-run-at-3233-caught-a-vacuous-negative-control-fixed-and-then-re-run-live-at-3333-user-run-tip-3276ed0) |
| 2026-08-17 | LIVE convergence probe (user-run) settled Admin `location` write shape | active | [findings.md](../logs/findings.md#2026-08-17--a-throwaway-live-convergence-probe-user-run-990100000099-settled-the-admin-location-write-shape-and-moved-two-other-axes-from-assumed-to-measured-good) |
| 2026-08-17 | Live run exposed grounding failure: `m5-check-live.mjs` untouched by 3→6 round | active | [findings.md](../logs/findings.md#2026-08-17--the-same-live-run-exposed-a-grounding-failure-m5-check-livemjs-was-the-one-file-the-3--6-round-never-touched-11--19-cases) |
| 2026-08-17 | First LIVE run of 3→6 tree corrected Admin `location` write shape (user-measured) | active | [findings.md](../logs/findings.md#2026-08-17--the-first-live-run-of-the-3--6-tree-corrected-the-admin-location-write-shape-measured-by-the-user-agent-has-no-credentials) |
| 2026-08-17 | `numberMatch` BUILT; predicate set now signed SIX (agent-run, user validation PENDING) | active | [findings.md](../logs/findings.md#2026-08-17--numbermatch-built-the-wired-predicate-set-is-now-the-signed-six-agent-run-user-validation-pending) |
| 2026-08-17 | `presentIn` BUILT; predicate set 3→5 (agent-run, user validation PENDING) | active | [findings.md](../logs/findings.md#2026-08-17--presentin-built-the-predicate-set-is-3--5-so-far-this-round-agent-run-user-validation-pending) |
| 2026-08-17 | `deviceSwapAge` BUILT; predicate set 3→4 (agent-run, user validation PENDING) | active | [findings.md](../logs/findings.md#2026-08-17--deviceswapage-built-the-predicate-set-is-3--4-so-far-this-round-agent-run-user-validation-pending) |
| 2026-08-17 | Wired predicate set goes 3→6 (user-signed DESIGN, not yet built) | active | [findings.md](../logs/findings.md#2026-08-17-latest--the-wired-predicate-set-goes-3--6-user-signed-design-not-yet-built) |
| 2026-08-17 | `deviceSwapAge` takes identical shape to `simSwapAge` (user-signed DESIGN) | active | [findings.md](../logs/findings.md#2026-08-17-latest--deviceswapage-takes-the-identical-shape-to-simswapage-user-signed-design) |
| 2026-08-17 | `numberMatch`: threshold off published menu; boolean out, score never wired (user-signed) | active | [findings.md](../logs/findings.md#2026-08-17-latest--numbermatch-the-requester-declares-its-threshold-in-the-question-off-a-published-menu-of-60--70--80--90-and-nothing-else-the-operator-compares-internally-and-answers-a-boolean-the-score-never-crosses-the-wire-user-signed-design) |
| 2026-08-17 | `presentIn`: boolean out, `PARTIAL` REFUSES (user-signed DESIGN) | active | [findings.md](../logs/findings.md#2026-08-17-latest--presentin-boolean-out-and-partial-refuses-user-signed-design) |
| 2026-08-17 | Five rules apply to all six predicates, no exceptions (user-signed DESIGN) | active | [findings.md](../logs/findings.md#2026-08-17-latest--five-rules-apply-to-all-six-predicates-no-exceptions-user-signed-design) |
| 2026-08-17 | Probing oracle: residual walk priced/bounded above this profile (user's stance) | active | [findings.md](../logs/findings.md#2026-08-17-latest--on-the-probing-oracle-generally-the-residual-walk-is-priced-and-bounded-at-the-layer-above-this-profile-users-position-recorded-as-the-projects-stance) |
| 2026-08-17 | `/retrieve-age-band` DOES NOT EXIST on Orange Playground — CLOSED unfavourably | active | [findings.md](../logs/findings.md#2026-08-17-latest--retrieve-age-band-does-not-exist-on-the-orange-playground-the-previous-entrys-unverified-is-now-closed-unfavourably) |
| 2026-08-17 | Exit 2 reserved for backend that COULD NOT RUN; crashed mock run is FAILURE (M6) | active | [findings.md](../logs/findings.md#2026-08-17--exit-2-is-reserved-for-a-backend-that-could-not-run-a-crashed-mock-run-is-a-failure-m6) |
| 2026-08-17 | requester nonce store's unbounded growth DOCUMENTED, not built (M6) | active | [findings.md](../logs/findings.md#2026-08-17--the-requester-nonce-stores-unbounded-growth-is-documented-not-built-m6) |
| 2026-08-17 | Four DEPENDENCY-INJECTION seams, one code path each (M6) | active | [findings.md](../logs/findings.md#2026-08-17--four-dependency-injection-seams-one-code-path-each-m6) |
| 2026-08-17 | Why PoC reads a PRECISE SIM-swap date (M5/M6, documentation only) | active | [findings.md](../logs/findings.md#2026-08-17--why-the-poc-reads-a-precise-sim-swap-date-and-what-that-does-and-does-not-say-m5m6-documentation-only) |
| 2026-08-17 | Predicate thresholds QUANTISED to published menu; repeated-query oracle is honest limit (M6 #1) | active | [findings.md](../logs/findings.md#2026-08-17--predicate-thresholds-are-quantised-to-a-published-menu-m6-decision-1-user-signed-and-the-repeated-query-oracle-is-recorded-as-an-honest-limit) |
| 2026-08-17 | Top-level REQUEST field set is CLOSED (M6) | active | [findings.md](../logs/findings.md#2026-08-17--the-top-level-request-field-set-is-closed-m6) |
| 2026-08-17 | Subscriber number rides INSIDE sealed, signed request (M6, user-signed) | active | [findings.md](../logs/findings.md#2026-08-17--the-subscriber-number-rides-inside-the-sealed-signed-request-m6-user-signed) |
| 2026-08-17 | Spec sketch `Predicate` enum trimmed 7→3 (M6, user-signed) | active | [findings.md](../logs/findings.md#2026-08-17--spec-sketch-predicate-enum-trimmed-7--3-m6-user-signed) |
| 2026-08-17 | M1 exports duplicate-key scanner; duplicate-key requests rejected (M6 #2, user-signed) | active | [findings.md](../logs/findings.md#2026-08-17--m1-exports-its-duplicate-key-scanner-duplicate-key-requests-are-rejected-outright-m6-decision-2-user-signed) |
| 2026-08-17 | M3 fix: `checkFloor` never throws on wire input | active | [findings.md](../logs/findings.md#2026-08-17--m3-fix-point-closed-checkfloor-never-throws-on-wire-input) |
| 2026-08-16 | M4 facts-adapter spec signed off (4 user decisions) | active | [findings.md](../logs/findings.md#2026-08-16--m4-facts-adapter-spec-signed-off-4-user-decisions) |
| 2026-08-15 | Versioning scheme corrected (user-decided) | active | [findings.md](../logs/findings.md#2026-08-15--versioning-scheme-corrected-user-decided) |
| 2026-08-15 | M3 floor-gate spec signed off (3 user decisions) | active | [findings.md](../logs/findings.md#2026-08-15--m3-floor-gate-spec-signed-off-3-user-decisions) |
| 2026-08-15 | Both v0.0.3 security Mediums closed now (user-decided) | active | [findings.md](../logs/findings.md#2026-08-15--both-v003-security-mediums-closed-now-user-decided-fix-both-now) |
| 2026-08-15 | Decisions round after M2 gate (all user-decided) | active | [findings.md](../logs/findings.md#2026-08-15--decisions-round-after-the-m2-gate-all-user-decided) |
| 2026-08-15 | M2 envelope shape settled | active | [findings.md](../logs/findings.md#2026-08-15--m2-envelope-shape-settled) |
| 2026-08-15 | M1 built under the ladder; verifier shape settled | active | [findings.md](../logs/findings.md#2026-08-15--m1-built-under-the-ladder-verifier-shape-settled) |
| 2026-08-15 | `findings.md` created (user-ordered) | active | [findings.md](../logs/findings.md#2026-08-15--findingsmd-created-user-ordered) |
| 2026-08-15 | PoC build ROLLED BACK to G0; module ladder made binding | active | [findings.md](../logs/findings.md#2026-08-15--poc-build-rolled-back-to-g0-module-ladder-made-binding-44) |
| 2026-08-14 | Consolidation (this PRD) | active | [findings.md](../logs/findings.md#2026-08-14--consolidation-this-prd) |
| 2026-08-14 | Template re-grounded | active | [findings.md](../logs/findings.md#2026-08-14--template-re-grounded) |
| 2026-08-14 | Core standard = attested windowed disclosure | active | [findings.md](../logs/findings.md#2026-08-14-earlier--core-standard--attested-windowed-disclosure) |
| 2026-08-14 | Two modes; Mode A ships first | active | [findings.md](../logs/findings.md#2026-08-14-earlier--two-modes-mode-a-ships-first) |
| 2026-08-14 | Horizontal profile, not a new vertical API | active | [findings.md](../logs/findings.md#2026-08-14-earlier--horizontal-profile-not-a-new-vertical-api) |
| 2026-08-14 | Two tracks, one seam | active | [findings.md](../logs/findings.md#2026-08-14-earlier--two-tracks-one-seam) |
| 2026-08-14 | Agent-grade floor | active | [findings.md](../logs/findings.md#2026-08-14-earlier--agent-grade-floor) |
| 2026-08-14 | Name: justabit; repo-first, not npm-first | active | [findings.md](../logs/findings.md#2026-08-14-earlier--name-justabit-repo-first-not-npm-first) |

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
