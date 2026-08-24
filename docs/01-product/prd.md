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

- **2026-08-18 (latest) — user ran the FULL validation suite on their own
  machine against the CURRENT uncommitted tree (the tree the entries below
  describe): every suite clean, zero `FAIL`, zero `TypeError`, zero
  `Error:` lines in either log. BOTH GATES MET on this tree.** The main
  session verified with `find poc -newer` that no `.mjs` file changed
  after the run, so this record covers exactly this tree and nothing
  later. Offline (user-run, by exit code, all exit 0): `m1-check.mjs`
  20/20, `m2-check.mjs` 10/10, `m3-check.mjs` 26/26, `m4-check.mjs` 42/42,
  `m5-check.mjs` 67/67, `m6-check.mjs` 47/47, `demo.mjs` (mock) 35/35.
  Live (user-run, real Orange Network APIs Playground, injected clock
  `2026-08-18T19:24:42.422Z`, quota 1 of 10 custom slots in use at start
  AND at end — no slot leaked, all exit 0): `m5-check-live.mjs` 20/20,
  `demo.mjs --backend orange` 35/35 — every count user-run, none
  agent-run. G1 (M1–M4 + M6 user-validated) is MET at
  20/10/26/42/47 plus `demo.mjs` (mock) 35/35. G2 (M5 user-validated live)
  is MET on both legs (offline 67/67, live 20/20). **The headline:**
  `m5-check-live.mjs` case 20 — written blind in this session and never
  executed until this run — PASSED live with `sim-swap calls=1,
  device-roaming-status calls=0, device-reachability-status calls=0`. That
  is the FIRST live evidence for the call-count saving that motivated this
  whole round; until now the saving was proven only OFFLINE against an
  injected transport, recorded at `bb0b52f` as a known open item. **That
  open item is now CLOSED by measurement, not by argument.** Of the five
  open items recorded at `bb0b52f`: **CLOSED** — the saving proven live
  (above); case 42's source-text search replaced by a shape-based regex;
  `m6-check.mjs` case 47 pinning conditional reads through the full
  composed path; `m5-check.mjs` catching a wrong axes mapping (`ROAM_Q`/
  `REACH_Q` built via `factQuery`); the `demo.mjs` pre-seal guard deriving
  capacity from the recipient key with its own persisted case; the `r6b`
  scan frame now able to genuinely red. **NEW STATED LIMIT, kept visible
  on purpose, not softened:** the raw-value leak scan now drops needles
  shorter than `PLAIN_MIN_NEEDLE = 2`, so a value whose every spelling is
  under 2 characters cannot be leak-tested by this scan at all. **STILL
  OPEN:** `poc/m5-check.mjs` case 67 reddens under mutation via an
  uncaught 404 escaping to the wire rather than by its own assertion
  firing — a genuine red, but a scruffier proof than the others; recorded
  as a known weakness, not overstated as clean. Per this repo's own rule,
  this record covers this tree ONLY — any later change to a file either
  gate covers re-opens the relevant gate, commit or no commit. Full
  record: `CHANGELOG.md`, Unreleased (now `0.5.0`).

- **2026-08-18 — `/code-review medium --fix` round on the fix
  round below (agent-run, NOT user-validated — G1 and G2 stay
  RE-OPENED/PENDING at the new counts).** Two DRY consolidations, both
  mutation-proved: (1) `poc/m5-facts-orange.mjs`'s six hand-copied axis
  re-checks consolidated into one `asked(key)` helper — mutation-proved
  (forcing it to always return `true` reds both `m5-check.mjs` and
  `m6-check.mjs`; restored → both green); (2) `poc/demo.mjs`'s
  byte-identical `plainNeedles`/`opaqueNeedles` filters consolidated into
  one `atLeast(min)` factory. Consolidation (2) was NOT independently
  pinned by any existing case at review time — nothing reds if `atLeast`'s
  comparison flips — so per the coordinator's rule ("if it cannot be broken
  into a red, it needs a case too") two coverage gaps were closed with new
  cases rather than left unpinned:
  **`m5-check.mjs` case 67** — the axis-signal gate must require the
  signal to be EXACTLY `true`, not merely truthy. Found missing by
  mutation: relaxing `asked` to `hasOwn(q,key)` alone left the whole suite
  green (66/66). Case 67 sends `needSim:1`, `needDevice:'yes'`,
  `needRoaming:{}`, `needReachability:1`, `needLocation:'yes'`,
  `needKyc:{}` against otherwise well-formed values and asserts zero live
  calls and an absent axis on all six. **`m5-check.mjs` moves 66 → 67.**
  Mutation-proved: reverting `asked` to `hasOwn(q,key)` alone reds it
  (exit 1, an uncaught `location-verification` 404 surfaces because the
  gate let a non-`true` signal through); restored → 67/67, exit 0,
  `m5-facts-orange.mjs` byte-identical (md5) to pre-mutation.
  **`demo.mjs` new case** — pins the EXACT set `PLAIN_MIN_NEEDLE` drops
  (`droppedPlain = RAW_NEEDLES.filter(n => n.length < PLAIN_MIN_NEEDLE)`
  asserted `=== ['4']`, the single documented drop), not merely a count —
  a count-only check would pass identically if a different needle had
  dropped. **`demo.mjs` moves 34 → 35.** Mutation-proved twice: raising
  `PLAIN_MIN_NEEDLE` to 3 reds it (34/35, exit 1; dropped set becomes
  `["4","FR","97"]` — the country code and a score needle silently
  falling out); restored → green. Separately, this same new case also
  proved consolidation (2) load-bearing: flipping `atLeast`'s `>=` to `>`
  reds `demo.mjs` (34/35, exit 1) via the same assertion; restored →
  green, md5-identical to pre-mutation.
  Full offline suite by exit code, before and after this round: m1 20/20,
  m2 10/10, m3 26/26, m4 42/42, **m5 66/66 → 67/67**, m6 47/47,
  **demo(mock) 34/34 → 35/35** — all exit 0. `m5-check-live.mjs` case 20
  stays UNRUN this round too — no credentials, no live Orange legs. No
  existing assertion was weakened or deleted; `m6-check.mjs` case 40's
  `plain()` guard untouched. Full record: `CHANGELOG.md`, Unreleased.
  (SUPERSEDED — see the top entry above: the user's full run on this exact
  tree subsequently MET both gates at these counts, including case 20
  live.)

- **2026-08-18 — fix round on the five open items recorded at
  `bb0b52f`, now COMPLETE (agent-run, NOT yet user-validated — G1 and G2
  stay RE-OPENED/PENDING).** All six agreed fixes, in two passes (the
  second after a coordinator decision on items 5 and 6):
  (1) live call-count proof for the axis-signal reduction — `m5-check-
  live.mjs` case 20 added, asserting a `simSwapAge` question calls
  `sim-swap` and never roaming/reachability; WRITTEN, NOT RUN (no live
  credential this session — stays unrun, per instruction, no live Orange
  legs this round);
  (2) `m4-check.mjs` case 42's fixture now locates the `reachable` entry and
  its `axes` sub-field by SHAPE (regex) instead of the verbatim literal —
  proved both ways: reverting the real guard to bare `spec.axes` still reds
  (41/42); the behaviourally-identical `Array.isArray` rewrite still stays
  green (42/42);
  (3) `m6-check.mjs` case 47 added — a `simSwapAge` question through the
  FULL composed path (same injected-Orange-transport rig as case 22) never
  calls roaming/reachability; proved by forcing the `needRoaming` gate open
  (46/47 red, restore → 47/47 green);
  (4) `m5-check.mjs`'s `ROAM_Q`/`REACH_Q` now built via `factQuery` on the
  real predicates instead of hand-written literals — proved: flipping
  `roamingIn`'s `axes` mapping now reds BOTH `m4-check.mjs` (41/42) and
  `m5-check.mjs` (61/66), closing the gap where only `m4-check.mjs` caught
  it;
  (5) `poc/demo.mjs`'s pre-seal capacity guard now derives capacity from the
  actual recipient key (`recipientEnc.asymmetricKeyDetails.modulusLength`),
  matching what `seal()` in `m2-envelope.mjs` already derives, instead of
  comparing against the `OAEP_CAPACITY` demo constant — `m2-envelope.mjs`'s
  own crypto needed no change. A PERSISTED regression case was added to
  `runDemo()` (RSA-3072 recipient, real cap 318 B, gets a graceful signed
  refusal instead of an uncaught throw) — **`demo.mjs` moves 33 → 34 cases:
  agent-run only, NOT user-validated at this new count.** Mutation-proved on
  the persisted case: guard reverted to the constant → the same scenario
  throws uncaught and ABORTS THE RUN (exit 1); restored → 34/34, exit 0. The
  throwaway `/tmp` repro script used before the persisted case existed has
  been deleted — it did not count as coverage.
  (6) `rawNeedles()` gained a `deviceFlippedDaysAgo` parameter so the `r6b`
  frame's own re-scripted value has spellings in the scan inventory. Adding
  them first reds the suite (`demo.mjs` 29/33, `m6-check.mjs` 45/47) and was
  escalated rather than fixed by trimming the needle set. Audited before
  being believed a leak: every failing hit was exactly the single character
  `"4"` — including the FIRST assertion in `runDemo()`, whose frame is
  scanned BEFORE the device-flip scenario runs, making it structurally
  impossible to carry that value. Confirmed independently (by the
  coordinating session too) as a harness confound, not a leak. **Resolved:
  a `PLAIN_MIN_NEEDLE = 2` cutoff (new `plainNeedles()` helper beside the
  existing `opaqueNeedles()`/`OPAQUE_MIN_NEEDLE = 8`) drops bare
  single-character needles from the plaintext scan while keeping every
  2+-character needle already proven safe across this suite's run history
  (`FR`, kept deliberately per this file's own comment; `137`/`211`).**
  Justified separately from `OPAQUE_MIN_NEEDLE`: 8 is measured against
  RANDOM bytes/base64 where even a short needle is rare; this scan runs
  against STRUCTURED JSON text where a bare digit is common (an `exp`
  timestamp alone makes a 1-character digit needle near-certain to
  collide) but a 2+-character token is not. **Honest limit, stated
  plainly: a value whose EVERY spelling is shorter than 2 characters
  cannot be leak-tested by this scan.** `DEVICE_FLIPPED_DAYS_AGO`'s longer
  spellings (`345600000`, its ISO instant, its date) were already in the
  inventory and remain fully leak-testable — only its bare `"4"` spelling
  is dropped. PROVED the frame can still genuinely fail: temporarily made
  `r6b`'s answer carry `facts.deviceSwapAgeMs` (reusing the existing
  `leakRaw` control) — scan reds (exit 1, hits include `"345600000"`);
  reverted — green again (exit 0). Full offline suite by exit code: BEFORE
  this whole round — m1 20/20, m2 10/10, m3 26/26, m4 42/42, m5 66/66,
  m6 46/46, demo(mock) 33/33 (all green). AFTER both passes — m1 20/20,
  m2 10/10, m3 26/26, m4 42/42, m5 66/66, m6 47/47, demo(mock) 34/34 —
  **all exit 0.** No case outside what each fix names was touched; no
  existing assertion was weakened or deleted. Full record: `CHANGELOG.md`,
  Unreleased.
  (SUPERSEDED — see the top entry above: the user's full run on the
  current uncommitted tree subsequently MET both gates.)

- **2026-08-18 — user ran the FULL validation suite on their own
  machine against the CURRENT uncommitted working tree (this record applies
  to that PRIOR tree at `bb0b52f` only — it does NOT carry forward to the
  fix round in the entry above, which changed executable code both gates
  cover): every suite clean, zero `FAIL`, zero `TypeError`, zero `Error:`
  lines in either log. BOTH
  gates MET on this tree.** Offline (user-run, by exit code, all exit 0):
  `m1-check.mjs` 20/20, `m2-check.mjs` 10/10, `m3-check.mjs` 26/26,
  `m4-check.mjs` 42/42, `m5-check.mjs` 66/66, `m6-check.mjs` 46/46,
  `demo.mjs` (mock backend) 33/33. Live (user-run, real Orange Network APIs
  Playground, injected clock `2026-08-18T16:25:49.263Z`, quota 1 of 10
  custom slots in use at start, all exit 0): `m5-check-live.mjs` 19/19,
  `demo.mjs --backend orange` 33/33 — every count user-run, none agent-run.
  G1 (M1–M4 + M6 user-validated) is MET at 20/10/26/42/46 plus `demo.mjs`
  (mock) 33/33. G2 (M5 user-validated live) is MET on both legs (offline
  66/66, live 19/19). Notably, `m5-check-live.mjs` had two cases edited
  this session and had never been executed until this run — it passed
  19/19 on its first ever execution against the real Playground. The first
  attempt at the live legs exited 2 (missing `ORANGE_BASIC_AUTH`) and was
  correctly NOT a pass — the successful re-run above is the one that
  counts. **This record covers the uncommitted working tree it was run
  against ONLY**: per this repo's own rule, a user validation covers only
  the exact tree it ran at (commit or no commit), and any later change to
  a file either gate covers re-opens that gate. Two known open items
  surfaced by this round, not yet fixed, recorded not dropped: (1) the
  call-count saving that motivated the axis-signal unification (the two
  entries below) is proven only OFFLINE (injected transport) — no live
  case asserts it; (2) `m6-check.mjs` gives no signal on the
  roaming/reachability-gating change — it stayed 46/46 before and after;
  only `m4-check.mjs` catches a wrong `axes` mapping (flipping `roamingIn`
  to `['reachability']` left `m5-check.mjs` fully green at 63/63, measured
  before this round's 66/66 count). Also still open, pre-existing and
  unaffected by this round: `poc/m4-check.mjs` case 42 searches the source
  for the literal `", axes: ['reachability']"` to build its fixture — same
  brittleness class as the guard-text search already removed elsewhere
  (see the entry directly below), now aimed at the predicate table
  instead; `poc/m2-envelope.mjs:26` hardcodes `OAEP_CAPACITY = 446` rather
  than deriving it from the recipient key; and the `r6b` scan frame in
  `poc/demo.mjs` structurally cannot red because `rawNeedles` is built
  from `DEVICE_SWAPPED_DAYS_AGO` while `r6b` answers about
  `DEVICE_FLIPPED_DAYS_AGO`, so the value it could leak is not in the
  needle inventory. Full record: `CHANGELOG.md`, Unreleased.
- **2026-08-18 — fixes `m4-check.mjs` case 42 itself: it pinned the
  guard's SPELLING, not its behaviour (agent-run, not yet user-validated).**
  Case 42 (added by the entry directly below) originally searched the real
  `m4-facts-mock.mjs` source for the exact literal `'spec.axes ?? []'` and
  threw a "fixture assumption broken" error if that string was absent —
  which meant the case could only pass under one specific spelling of the
  guard. Proven wrong by direct measurement: replacing the guard with the
  behaviourally identical `Array.isArray(spec.axes) ? spec.axes : []` (same
  fail-closed outcome, same "no axes field never throws" contract) made
  `m4-check.mjs` go RED (41/42, exit 1) on a refactor that broke nothing —
  the textbook "tests mirror implementation, fails for the wrong reason"
  anti-pattern (`.claude/remember/AGENT_RULES.md`). Fixed by keeping the
  behavioural half of the case (build a source variant of the real file with
  one predicate's `axes` field stripped; assert `factQuery` on that predicate
  returns `{}` without throwing) and replacing the verbatim guard-text search
  with a shape-based one: the negative-control variant now locates the
  `for (const axis of ...) {` loop header by its syntactic shape and replaces
  it with the bare, unguarded `spec.axes`, independent of how the guard is
  currently spelled. Re-proven, all by exit code: revert the real guard to
  bare `spec.axes` → `m4-check.mjs` RED (41/42, exit 1); restore → GREEN
  (42/42, exit 0); swap the real guard to the `Array.isArray` spelling →
  STAYS GREEN (42/42, exit 0 — the fix's whole point, where the unfixed case
  went red); restore the original spelling → GREEN again (42/42, exit 0).
  Full offline suite re-verified green by exit code after restoring the
  original file: m1 20/20, m2 10/10, m3 26/26, m4 42/42, m5 66/66, m6 46/46,
  demo(mock) 33/33. No case other than 42 was touched. **G1 and G2 stay
  PENDING** — this changes executable test code covered by both gates and
  has not been run by the user at this commit. (SUPERSEDED — see the top
  entry above: the user's full run on the uncommitted tree subsequently
  MET both gates.)
- **2026-08-18 — FINISHES the axis-signal unification the prior entry
  started (agent-run, not yet user-validated): all SIX operator axes now gate
  on `PREDICATES.axes`/`needXxx`, closing the two the prior round left on the
  old per-axis pattern.** The prior entry moved `roaming`/`reachability` onto
  the `needRoaming`/`needReachability` signal but left SIM/device gated on
  `hasOwn(q, thresholdKey)` and location/KYC gated on value-presence
  (`q.area`/`q.claimedName`) — two live sources of truth for the same
  question, which is exactly what `axes` was supposed to remove. Now
  `poc/m5-facts-orange.mjs` gates all four on `needSim`/`needDevice`/
  `needLocation`/`needKyc === true`, re-checked the same way the other two
  already were. `readSwapAxis` gained an explicit fail-closed guard —
  `!Number.isSafeInteger(thresholdMs) || thresholdMs <= 0` → no read on
  either surface — needed because moving the gate off the threshold key
  means the function is now reachable with `needSim: true` and no valid
  threshold at all; before this guard a present-but-invalid threshold fell
  into the `/retrieve-date` branch (a raw-date read for an unvalidated
  window) instead of being refused. Location/KYC keep their existing value
  validation ALONGSIDE the new signal check — the signal decides whether to
  read, the value still decides what to send. `m5-check.mjs` grew from
  63 → 66: every hand-built query literal that exercises SIM/device/
  location/KYC now carries the matching `needXxx: true`; new case 64 pins
  the threshold fail-closed guard, new case 65 pins the location/KYC
  fail-closed outcome on an absent value (case 60 itself updated to carry
  the signal so it keeps testing value re-validation rather than going
  vacuous under the new gate), and new case 66 is the direct negative for
  the unification — a well-formed value with the `needXxx` flag omitted now
  makes zero calls on all four axes. Also closes a separate, pre-existing
  gap: the earlier round's `spec.axes ?? []` guard had no test able to
  detect its own absence (reverting it left every offline suite green,
  since no current `PREDICATES` entry lacks `axes`) — new `m4-check.mjs`
  case 42 dynamically imports a variant of the real source with one entry's
  `axes` field stripped, proving `factQuery` tolerates it, and a second
  variant with the guard also stripped, proving that one throws
  (`m4-check.mjs` 41 → 42). Every changed/added case mutation-proven
  (revert → red, exit 1 → restore → green) against the real files. Verified
  green by exit code: m1 20/20, m2 10/10, m3 26/26, **m4 42/42**,
  **m5 66/66**, m6 46/46, demo(mock) 33/33 — all agent-run offline;
  `m5-check-live.mjs` was NOT run this round (no live credentials in this
  session) — it needed no code change, since every query it builds already
  goes through `factQuery`, the real seam, rather than a hand-built literal.
  **G1 and G2 stay PENDING**: this changes executable code covered by both
  gates and has not been run by the user at this commit. Full record:
  `CHANGELOG.md`, Unreleased. (SUPERSEDED — see the top entry above: the
  user's full run on the uncommitted tree subsequently MET both gates.)
- **2026-08-18 — CLOSES the `roaming`/`reachability` unconditional-read
  open design item (agent-run, not yet user-validated): both axes are now
  conditional on `getFacts`, gated on a `factQuery`-carried `needRoaming`/
  `needReachability` signal — the same pattern the SIM/device axes already
  used.** `poc/m4-facts-mock.mjs`'s `PREDICATES` table gains a single `axes`
  field per predicate (the one place the predicate → operator-axis mapping
  lives); `factQuery` emits the axis as a flat top-level boolean ONLY when the
  predicate's own value validated (a malformed/unknown predicate still yields
  `{}`, unchanged — case 40's `plain()` guard in `m6-check.mjs` is untouched).
  `poc/m5-facts-orange.mjs` gates the two live reads on the signal, re-checked
  `=== true` (this file re-validates every query field rather than trusting
  the caller). 15 existing `m5-check.mjs` cases were rewired — not weakened —
  to declare the axis they exercise, plus 3 new cases (61/62: read-only-when-
  asked with a negative control for each axis; 63: the fail-closed chain, no
  query → zero live calls → refusal, never a guessed bit) and a new
  `m4-check.mjs` case 41 for the "axis signal only when the predicate's own
  value validated" guard. Six mutation proofs (revert → red → restore →
  green) covered both clusters (the generic auth/redaction cases and the
  roaming/reachability behaviour cases) plus the core `factQuery` gating
  logic. Verified green by exit code: m1 20/20, m2 10/10, m3 26/26,
  **m4 41/41**, **m5 63/63**, m6 46/46, demo(mock) 33/33 — all agent-run
  offline; `m5-check-live.mjs` (updated for the new contract, cases 17/18)
  and `demo.mjs --backend orange` were NOT run this round (no live
  credentials in this session). **G1 and G2 are RE-OPENED (PENDING)**:
  executable code covered by both gates changed since the full user run at
  `4446517` recorded directly below, and per this repo's own rule that
  record covers only its own commit — the user has not run this change.
  Full record: `CHANGELOG.md`, Unreleased.
- **2026-08-18 — user ran the FULL validation suite on their own
  machine at `4446517`/`c921508`, log timestamped 08:16: every suite clean,
  zero `FAIL`, zero `TypeError`, zero `Error:` lines in the entire log.
  BOTH gates MET at `4446517`, for the first time at the same commit.**
  `m1-check.mjs` 20/20, `m2-check.mjs` 10/10, `m3-check.mjs` 26/26,
  `m4-check.mjs` 40/40, `m5-check.mjs` 60/60, `m6-check.mjs` 46/46,
  `demo.mjs` (mock) 33/33, `demo.mjs --backend orange` (live, real Orange
  Playground) 33/33, `m5-check-live.mjs` (live, real Orange Playground)
  19/19 — verified directly against the user's log by the main session.
  Every count is user-run; none is agent-run. G1 (M1–M4 + M6 all
  user-validated) is MET at the current counts (20/10/26/40/46). G2 (M5
  user-validated live) is MET on both legs (offline 60/60, live 19/19).
  This is the first time both gates have been met at the same commit on a
  tree that had already been through two `/code-review` rounds with every
  fix mutation-proven — see the two entries directly below for what those
  rounds changed. Per this repo's own rule, this record covers `4446517`
  (code) / `c921508` (docs) and nothing later; a future change to any
  covered file re-opens the relevant gate the same way the two rounds
  below did. Full record: `findings.md`, 2026-08-18 (latest).
- **2026-08-18 — second `/code-review medium --fix` round:
  cross-requester sealing fixed (m6 45 → 46), spec closure — G1 and G2
  were PENDING at `4446517` until the full user run above.** The round-1 tree (`c15fcc0`) had the
  operator sealing every signed refusal AND every answer to a hardcoded
  `keys.rpEnc.publicKey` instead of the envelope key of the issuer step 3/4
  had just authenticated — the directory already carried `encPub` for
  exactly this and nothing read it. With a second directory-listed
  requester, that requester's query passes signature verification and the
  operator encrypts the answer under the FIRST requester's key: cross-requester
  disclosure between two authenticated principals, invisible with one RP in
  the world. Fixed by resolving `entry.encPub` at step 3 and threading it as
  `recipientEnc` through every seal call site; an issuer with no `encPub`
  now reports `unknown issuer`. Also closed `spec/carrier-attestation.yaml`'s
  `Predicate` schema to `additionalProperties: false`, matching what
  `evaluatePredicate` already enforces in code. New case m6 46 CROSS-REQUESTER
  SEALING (`twoRpWorld()`, both directions/both reply kinds) is
  mutation-proven — reverting the fix alone gives 45/46, exit 1 — and is the
  THIRD fix in this project's history to ship with no net until its own
  case existed. **One item surfaced and deliberately NOT built this round:**
  `m5-facts-orange.mjs`'s `roaming`/`reachability` reads are still
  unconditional on every `getFacts` call (same class as the SIM/device axes
  round 1 already conditioned), which needs a `factQuery`-carrying signal
  for predicates with no query value — **OPEN DESIGN ITEM, awaiting the
  user's decision**, not a defect. Two further items recorded as stated
  limits (the `r6b` scan frame structurally cannot red against `NEEDLES`;
  the pre-seal size guard uses the module `OAEP_CAPACITY` constant rather
  than a key-derived capacity, an M2-owned fix). `/security` re-run: clean,
  did NOT catch the sealing defect — not proof. Verified green by exit
  code: m1 20/20, m2 10/10, m3 26/26, m4 40/40, m5 60/60, **m6 46/46**,
  demo(mock) 33/33. **Consequence: this round changed `poc/demo.mjs` again
  — one of the two files the last user validation (`3276ed0`) covered — so
  G1 and G2 remained PENDING at this commit** (SUPERSEDED — see the
  2026-08-18 (latest) entry above: the user's full run at `4446517`
  subsequently MET both gates), and the tree had moved three times since
  that validation (`9b04854`, `c15fcc0`, `4446517`). Full record:
  `findings.md`, 2026-08-18 (latest); commit `4446517`.
- **2026-08-18 — `/code-review medium --fix` round + `/security`
  (6 fixes, 1 user-approved behaviour change): m3 25 → 26, m5 58 → 60; G1 AND
  G2 BOTH RE-OPENED (PENDING) at `9b04854`.** (SUPERSEDED — see the
  2026-08-18 (latest) entry above: the user's full run at `4446517`
  subsequently MET both gates.) Reviewed the six live-touching
  files (`poc/demo.mjs`, `poc/m3-check.mjs`, `poc/m3-floor.mjs`,
  `poc/m5-check.mjs`, `poc/m5-facts-orange.mjs`,
  `spec/carrier-attestation.yaml`). Six fixes: an unknown floor field name
  reaching a refusal reason RAW (log-line-forging via newline/NUL, bounded
  to 40 chars printable ASCII); the "effective floor" assertion recomputing
  `checkFloor` locally instead of reading the operator's own return (passed
  identically for an operator that discarded the effective floor);
  `getFacts` trusting `q.area`/`q.claimedName` verbatim on a path a caller
  could reach without going through `factQuery` (now re-validated); the RP
  registering a pending nonce BEFORE `seal()` (leaked one unconsumable entry
  per oversize retry); `verifyResponse` throwing a bare `TypeError` instead
  of returning a verdict under `skipNonceStore`+no-fallback; and a spec-doc
  divergence (`additionalProperties:false` omitting `number`) now stated
  instead of left as a trap. **Finding 7, escalated and USER-APPROVED as a
  behaviour change:** the SIM-swap axis was read UNCONDITIONALLY in
  `m5-facts-orange.mjs`, so a `reachable`/`roamingIn`/`presentIn`/
  `numberMatch` question — none of which carry a SIM threshold — still made
  a metered `/retrieve-date` call and pulled a raw SIM-swap date
  operator-side for a question nobody asked; now conditional, matching the
  device-axis pattern, on the user's stated reasoning that a reference
  operator holding an unrequested raw value undercuts the CAMARA proposal's
  own no-raw-value-to-leak argument for `/check`. That change REPAIRED (not
  weakened) 7 pinned m5 cases (10, 11, 12, 14, 15, 27, 49) via an explicit
  SIM-question fixture threaded through each. Three new mutation-proven
  cases (m3 26, m5 59, m5 60) closed two real coverage gaps (m3/m5 scored
  25/25 and 58/58 whether fixes 1 and 3 were present or reverted, before
  these cases existed). `/security` re-run for the first time across this
  round: clean, no new findings. **Consequence: this round changed exactly
  the two files (`poc/demo.mjs`, `poc/m5-facts-orange.mjs`) that gates G1
  and G2 were user-validated against at tip `3276ed0` — by this repo's own
  rule a user record covers only the tree it was run on, so BOTH gates are
  PENDING again at `9b04854`, and the `3276ed0` records for M1/M2/M4/M6/demo
  do not transfer forward either, even where their counts (20/10/40/45/33)
  are unchanged — the tree changed under them.** Full record:
  `findings.md`, 2026-08-18 (latest); commit `9b04854`.
- **2026-08-18 — a LIVE Orange run at 32/33 caught a vacuous
  negative control; fixed, and then RE-RUN LIVE at 33/33 (USER-RUN, tip
  `3276ed0`).** Assertion 1's leaky-operator control reused the section's
  shared `simSwapAge ≥ P90D` predicate. P90D is 2160 hours, under M5's
  measured 2400-hour `/check` cap, so on the orange backend that question
  answers via `/check` — a surface that never reads or holds a raw date at
  all. `facts.swapAgeMs` was `undefined` on that path, so the control's
  asserted condition ("a leaky operator reds the scanner") was structurally
  false, not merely unmet: there was no raw age operator-side to leak. The
  harness did the right thing — it failed loudly (`hits=[]`, `verdict='ok'`)
  instead of passing vacuously. **Fix:** the leaky-operator control now asks
  a dedicated `LEAK_PREDICATE` at `P365D` (8760h, above the cap), which
  forces `/retrieve-date` on both backends, where a real raw date genuinely
  exists to leak. Mutation-proven offline first (an injected-transport
  replay reproduced the exact vacuous pass under the old P90D shape and
  reds cleanly under the new one), no case count moved (still 33 — this
  fixes an existing assertion, not a new one). **Then the user re-ran `node
  poc/demo.mjs --backend orange` live and reported 33/33** — the SECOND user
  run of `poc/demo.mjs` (M6) against the real Playground and the first CLEAN
  one (the first, on 2026-08-17, is the 32/33 run above that surfaced the
  vacuous control being fixed here), meeting G2's literal definition ("same
  demo, `--backend orange`, against Orange Playground") for the composition.
  **The user then also re-ran
  `ORANGE_BASIC_AUTH=… node poc/m5-check-live.mjs` live at the same tip and
  reported 19/19** — the current 6-predicate count, closing the "G2 stays
  PENDING" mark the 3 → 6 round's `m5-check-live` grounding-failure entry
  (below) had left open. **G2 is therefore MET at `3276ed0`, on both its M5
  and its M6 legs; nothing pending.** `m6-check.mjs`'s and the other
  modules' own offline counts stay agent-run (m1 20, m2 10, m3 25, m4 40, m5
  58, m6 45, demo-mock 33) — these two live runs validate the demo and the
  M5 live gate, not the offline module checks. Full mechanism, the accidental
  `/check`-narrows-operator-attack-surface finding this bug surfaced, and the
  live `/check`-vs-`/retrieve-date` cap-boundary measurement (`P90D` →
  `check maxAge=2160h` → `true`; `P365D` → `retrieve-date` → `false`):
  `findings.md`, 2026-08-17/18, and the addendum in the CAMARA proposal §3.5.
- **2026-08-17 — a throwaway LIVE convergence probe (user-run,
  `+990100000099`) settled the Admin `location` write shape and moved two other
  axes from ASSUMED to MEASURED-GOOD.** After the location 400 above named
  `lastLocationTime`, the user ran a probe that kept re-submitting the Admin
  UPDATE, one 400 at a time, until it converged: round 1 → `400
  "data.location.available" is required`; round 2 → `400 "data.location.radius"
  is required`; round 3 → `200 OK`, read back intact. Recorded:
  (1) **The settled field set is `{latitude, longitude, lastLocationTime,
  available, radius}`.** The adapter now writes all five; `available: true`
  (every scripted position is one the operator can currently place) and
  `radius: 500` (the ONE decision made outright rather than copying the probe's
  own placeholder `0` — 500 is the value the same READ showed already resident
  in that slot, and a zero-radius write would claim a precision the operator
  never asserted). Both join the read-after-write loop as their own axes
  (`geoAvailable`, `geoRadius`), the same `geoAt` precedent applies for the same
  reason: a mismatch folded into `geo` reads as the wrong bug.
  (2) **`kyc:{name}` and `deviceSwap:{latestDeviceChange}` are corrected from
  ASSUMED to MEASURED-GOOD**, not reopened: the same converged READ returned both
  sub-objects verbatim, closing the "still untested" label this log carried for
  `kyc` below. The read-after-write guard on both stays wired regardless —
  measured once is not guaranteed forever.
  (3) **`tenure:{latestTenureChange, contractType}` exists operator-side, with
  no CAMARA read endpoint** (both `tenure/v1/retrieve` and
  `sim-tenure/v1/retrieve` answer `400 "unhandled path"`) — this CONFIRMS the
  existing decision below (2026-08-16 line, M4 spec) that `tenure` stays out of
  the wired predicate set; it is not reopened and no predicate is wired from it.
  (4) **The generalisable lesson from the prior entry stands, refined rather than
  reversed**: an observed READ shape did not tell the write field set for
  `location`, but a CONVERGING PROBE — one field named per round rather than one
  live run per field — closed the gap in three rounds instead of three separate
  live gates. Counts moved: m5 offline 57 → 58. Agent-run; user re-run of the
  live gate stays PENDING.
- **2026-08-17 — the same live run exposed a GROUNDING failure:
  `m5-check-live.mjs` was the one file the 3 → 6 round never touched (11 → 19
  cases).** Recorded:
  (1) **The mechanism is general, not a slip.** It is the only check in the tree
  that cannot be run offline, so it is the only one whose drift from a moved
  contract nobody could observe until the gate. Every sibling reds on a clean
  clone; this one needed credentials to red at all.
  (2) **"It threw" is not evidence a guard fired.** The write-trap case caught a
  backstory-validation throw while asserting it had caught the built-in
  shadowing. It now asserts it failed for its OWN reason.
  (3) **The fix is a new offline case 1**: the file's single story definition is
  pinned against the adapter's closed field set — the full story must PASS
  validation (proven by reaching a throwing transport sentinel), every field must
  be required, and an unknown field refused by name. Zero credentials, so a
  future field addition reds on a clean clone.
  (4) **The live path now covers all six predicates**, each with its negative,
  including the `/check`-vs-`/retrieve-date` surface choice read off the wire.
  Evidence is an injected-transport REPLAY (19/19 exit 0) plus five killed
  mutations, and it is labelled as proving control flow only. **G2 stood
  PENDING at this round** — nothing here was a live measurement. **Superseded
  2026-08-18: the user ran `node poc/m5-check-live.mjs` live at tip `3276ed0`
  and reported 19/19, re-meeting G2 at the current 6-predicate count — see the
  latest entry above.**
- **2026-08-17 — the FIRST LIVE run of the 3 → 6 tree corrected the
  Admin `location` write shape (measured by the USER; agent has no credentials).**
  `admin UPDATE` answered `400 BAD_REQUEST "\"data.location.lastLocationTime\" is
  required"`. The adapter wrote the bare `{latitude, longitude}` pair. Recorded:
  (1) **This is the assumed-shape design working, not failing.** The axis was
  shipped as an explicit guess on the argument that a wrong one fails LOUD naming
  the axis rather than scripting a position that never took effect — and it did,
  on first contact, with the missing field named.
  (2) **An OBSERVED READ shape does not tell you the REQUIRED WRITE field set.**
  This downgrades the reasoning that ranked `kyc` "best-supported of the three"
  because its field name had been seen in a READ body. Written into the code
  against that axis.
  (3) **The instant is derived from the INJECTED clock**, never `Date.now()` —
  the same rule every other scripted instant in M5 follows, and the property that
  makes the write payload reproducible.
  (4) **It never becomes a readable fact.** `getFacts` reads no
  `lastLocationTime` from either direction, and the value now sits in the
  wire-byte needle inventory in all three spellings so a future leak reds.
  (5) **The run ABORTED at location, so the `kyc: {name}` write shape is STILL
  UNTESTED** and stays labelled ASSUMED everywhere it appears. Nothing is claimed
  about it in either direction.
  Counts moved: m5 offline 56 → 57. m6 (45) and demo (33) are unchanged in count
  but changed in content — all three are AGENT-RUN with a user re-run PENDING.
  Six mutations, six killed.
- **2026-08-17 — `numberMatch` BUILT; the wired predicate set is now
  the signed SIX (AGENT-RUN, user validation PENDING).** `simSwapAge`,
  `deviceSwapAge`, `roamingIn`, `presentIn`, `numberMatch`, `reachable`. The
  threshold rides off the published menu `60 | 70 | 80 | 90`, the operator
  compares internally, and the score never crosses the wire in any spelling.
  Recorded:
  (1) **`claimed` is the only predicate field that is neither a type nor a
  window** — the attribute value the REQUESTER wants compared. It is legal only
  for the types that declare it (refused by name elsewhere, like any unknown
  field) and it is part of the SIGNED predicate string, or an answer about "does
  Bob match?" would verify as an answer about "does Alice match?".
  (2) **Two measured response shapes that a naive implementation gets wrong.**
  `nameMatch` is the STRING `"true"`/`"false"` — and `"false"` is truthy, so an
  unguarded read reports a NON-match as a match. And an EXACT match carries no
  score at all, so "compare score against threshold" alone answers `false` to the
  strongest possible match.
  (3) **The operator learns what the requester claims.** Inherent to a comparison
  and disclosure in the OTHER direction; recorded rather than glossed. Profile
  mode narrows what the OPERATOR discloses and does not make the requester's query
  private — Mode A retains the query log either way.
  (4) **An incidental measurement:** the mock needed a score source, and
  Jaro-Winkler — chosen independently as a plausible standard metric — reproduces
  BOTH measured Playground values exactly (97 for the one-letter near miss, 53 for
  the unrelated name). Evidence, not proof, and nothing depends on it.
  Counts moved: m4 38 → 40, m5 54 → 56, m6 43 → 45, demo 30 → 33. Twelve more
  mutations; **one SURVIVED — the kyc-name write-back, the identical gap the
  location axis had, in the identical place**, which is the argument for pinning
  every assumed write shape rather than one representative of them.
  **One real FLAKE was caught and fixed:** a new case scanned the two-character
  needle `97` against RSA ciphertext and against an unblanked random hex nonce,
  which is a ~1-in-8 and ~1-in-60 false red — the exact trap this repo already
  documented for short needles. Split by artifact class, as the wire scanner
  already was.
- **2026-08-17 — `presentIn` BUILT; the predicate set is 3 → 5 so far
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
