# Findings log

Dated, append-only. What experiments actually showed — including what did
NOT work. Complements `prd.md` (which records decisions); this records the
evidence and the dead ends, so nothing gets re-tried or re-argued from
memory. A finding here is something that was RUN and OBSERVED, not reasoned.

---

## 2026-08-16 — user validation at v0.2.0 (`7c41c83`): all four suites green, M4 at 33/33

After the v0.2.0 release — main at merge commit `7c41c83`, tag `v0.2.0` — the
user personally ran the full runbook on their own machine and reported all four
suites clean: `node poc/m1-check.mjs` **19/19**, `node poc/m2-check.mjs`
**10/10**, `node poc/m3-check.mjs` **22/22**, `node poc/m4-check.mjs` **33/33**.

**This closes the release-gate round's "M4 user re-run pending"** — the one
marker the tree was still carrying (recorded in the entry below and in PRD
§4.4). M4's 33 cases include the three added by that round, which pin the
TOCTOU `length` re-read, the process-fatal `toJSON` allocation, and the
nested-input bound — so the guards found at the release gate are now
user-validated, not just agent-run and mutation-proven.

Ladder status: **all four modules user-validated at current counts — M1 19/19,
M2 10/10, M3 22/22, M4 33/33 — with no asterisk and no pending re-run.**
M5–M6 not started.

## 2026-08-16 — v0.2.0 release gate: three unbounded-wire-work fail-opens, one of them process-fatal (30 → 33 cases)

The release gate for 0.2.0 ran `/security` and `/diff-review` over
`origin/main...HEAD` as independent passes. Between them they found **three**
defects, all of one shape — **work reachable from wire input that no cap
actually bounded** — and all three defeating a guard the module explicitly
claimed, in-source and in the entry below. **None of the 30 cases could catch
their regression.** Every one was reproduced against the unfixed file before it
was accepted, and every fix was re-probed after.

**1. The country-set cap was time-of-check/time-of-use — and it reached a
SIGNED answer.** `countrySet()` tested `v.length` against `MAX_COUNTRIES = 300`
and then re-read `v.length` on every loop iteration. `Array.isArray` passes
straight through a Proxy, so a `length` trap could answer honestly for the cap
test and enormously for the walk. Measured against the unfixed module: cap
checked against **2**, loop then walked **5,000,000 indices in 6.5s**, and the
predicate returned **`{answered: true}`** — an answer built from a set the cap
exists to refuse. Fixed by capturing `const n = v.length` once and walking `n`.

**2. `describe()` could kill the process — exit 134.** The renderer tried
`JSON.stringify` → `String` → `Object.prototype.toString` in turn, each wrapped
in a try/catch. **A try/catch bounds a THROW; it cannot bound an ALLOCATION.** A
~40-byte predicate value whose `toJSON` returned `'x'.repeat(3e8)` produced a
**fatal OOM inside V8's `JsonStringifier::Stringify` — SIGABRT, core dumped,
exit 134**, which no `catch` can degrade. This is strictly worse than the throw
the fallback chain was built to prevent: a dead process cannot return
`{answered: false}`, so "wire input never throws" failed in the one way that
leaves nothing behind to report it.

**3. The input bound covered two shapes only.** The same entry below claimed
"the input is bounded first". It bounded a **top-level** long string and an
array's **length** — a long string one level down was still serialized in full.
Measured with a control: a 50MB string **nested** in a one-element array cost
**657ms**, the same string at **top level** (where the bound applied) **83ms**,
and inside a plain object **527ms**.

**The fix is one decision, not three patches: the renderer now invokes NOTHING
caller-supplied.** Primitives render directly; arrays render at most 16 elements
one level deep; an object is described by its **key names** via
`getOwnPropertyNames`, which reads no accessor and calls no hook. There is no
`toJSON`/`toString`/`toStringTag` path left to allocate down. `[unrenderable]`
survives as the floor and is still reachable — by a **revoked Proxy**, where
enumeration itself throws — so case 25 still pins it, via that shape now.

**Two pinned messages changed, deliberately.** A circular object renders
`{self}` instead of `[object Object]`, and case 25's hostile object renders
`{self, toString, valueOf}` instead of `[unrenderable]`. Both old spellings were
*products of the caller-invoking fallbacks that were removed* — the object is no
longer "unrenderable", it is simply described without being asked anything. Both
new spellings are strictly more informative. Post-fix cost: nested 657ms →
**77.7ms**, object 527ms → **2.2ms** (both now at the cost of the harness's own
string allocation, not the renderer's).

**`DESC_MAX_STRING` was moved 64 → 48, below the 60-char output clamp.** At 64
the per-string bound was real but **invisible**: the output clamp always cut
first, so no assertion could distinguish a clamped string from an unclamped one
and the bound could regress silently. Below the output clamp it shows in the
rendered text, which is what makes case 33 able to fail at all.

**Mutation-proven, by exit code — four mutations, each red on exactly its own
case, each restored byte-identical by sha256 → 33/33 exit 0:**

| Mutation | Result |
|---|---|
| `countrySet` re-reads `v.length` per iteration | case 31 red, **walked 100,000** indices; suite exit 1 |
| object branch calls `JSON.stringify` again | case 32 red (`toJSON` invoked 1×), 4 cases red, exit 1 — **and the OOM probe returns to exit 134** |
| array depth cap removed | case 33 red (`[[["deep"]]]` instead of `[[array of 1]]`), exit 1 |
| per-string clamp removed | case 33 red (100000-char string rendered in full), exit 1 |

The second row is the guard-off negative control that matters: **with the
mutation the fatal-OOM probe exits 134, without it exits 0.** Three new cases
carry these — 31 (cap survives a lying `length`), 32 (renderer never calls
caller code), 33 (nested/oversized values bounded) — so the declared count goes
**30 → 33**.

**Deployed risk today was nil and is stated as such:** a predicate arriving
through `JSON.parse` at the real M5/Orange wire cannot carry a Proxy or a
`toJSON`. These are reachable in-process, which is exactly where the PoC's
assertions run — and the artifact was making bounds claims that measurement
falsified, which in a repo whose PoC exists to make the text undeniable is the
defect regardless of deployment reach.

**These three fixes are POST-user-validation.** The user validated the four
suites at `5d5e8aa` (entry immediately below); the release gate then changed
`poc/m4-facts-mock.mjs` and `poc/m4-check.mjs`. So **M4's 33/33 is agent-run and
a user re-run is pending**, on the 0.1.0 precedent where the user closes that
gap after the release. M1/M2/M3 are untouched by this round — no module source,
no check file, and the shared harness is unchanged — so their user-validated
19/19, 10/10 and 22/22 stand.

## 2026-08-16 — user validation at `5d5e8aa`: all four suites green on the post-code-review tree

The user personally re-ran the runbook on their own machine at commit `5d5e8aa`
— the state produced by the `/code-review medium` round below — and reported all
four suites clean: `node poc/m1-check.mjs` **19/19**, `node poc/m2-check.mjs`
**10/10**, `node poc/m3-check.mjs` **22/22**, `node poc/m4-check.mjs` **30/30**.

**This closed every "user re-run pending" the tree was carrying** — three
separate markers, all settled by this one run: M4 at its post-review-fix state
(the entry below had it user-validated only at the PRE-fix state); the shared
harness and the spec sketch, both touched by that same round; and M1/M2/M3,
whose module sources were never touched but whose check files gained
`conclude(19|10|22)` post-validation on the shared harness.

So at `5d5e8aa` the ladder read, with no asterisk: **M1 19/19, M2 10/10, M3
22/22, M4 30/30 — all four user-validated at that tree state.** The release-gate
round recorded above then moved M4 to 33 cases, which is agent-run.

## 2026-08-16 — `/code-review medium` round on PR #4: 8 findings, all confirmed by execution, all fixed

A second review pass over the M4 work already on PR #4 — the least-reviewed code
in the repo is the previous round's own fix code. **Nothing was accepted as a
finding on argument: every one was reproduced against the unfixed file by a
probe, and every fix re-probed afterwards.** Agent-run result after the round:
M1 **19/19**, M2 **10/10**, M3 **22/22**, M4 **30/30**, all exit 0; YAML
re-parsed clean (exit 0). Case count stays a declared **30** — the new guards
were folded into existing cases 16/17 rather than appended.

**1. Wire-supplied country-set arrays ran CALLER-CONTROLLED CODE — three ways,
one of them a signed answer.** `plainSnapshot` copies the predicate's TOP level
only, so `p.value` stayed the requester's own array object, and the sibling
`p.value.every(...)` / `p.value.includes(fact)` iterated *their* object:

| Hostile set | Observed against the unfixed module |
|---|---|
| array with a throwing index GETTER | threw straight out of `evaluatePredicate` — "wire input never throws" broken |
| `Proxy(['FR'])` with a throwing `includes` trap | threw AFTER validation passed — i.e. on the answer path, past every gate |
| **sparse `new Array(5)`** | holes are not `undefined` own props, so the empty-set gate saw length 5 and `every` was VACUOUSLY true → **`{answered:true, result:false}`, SIGNED** — an answer to the malformed empty question case 17 exists to refuse |
| `new Array(2 ** 32 - 1)` | the walk ran past a **60s** timeout — an unbounded stall reachable from the wire |

Fixed by `countrySet()`: an index-walked defensive copy inside a `try/catch`
(a hole reads `undefined` and is rejected, a throw is a rejection), a
`MAX_COUNTRIES = 300` length cap (ISO 3166-1 has 249 codes; bigger is a
malformed question, not a question), and the membership test now runs on OUR
copy — `p.value` is never iterated again. A *transparent* Proxy still simply
answers, which is correct: its reads pass through.

**2. `plainSnapshot`'s `Array.isArray` line ran OUTSIDE its own try.** On a
**revoked** Proxy even `Array.isArray` throws, so a revoked-proxy predicate
escaped the "never throws" contract as a raw `TypeError` instead of coming back
`malformed predicate`. The line moved inside the `try`. (Note the interaction
with the settled decision above: that clause stays as documented redundancy for
the *array* case, but its placement was a real defect.)

**3. `describe()` bounded its OUTPUT but not its INPUT.** It clamps to 60
chars — after fully serializing (or walking) whatever it was handed. A 100MB
string or a `2**32`-element array was therefore paid for in full just to print
60 characters. Now the input is bounded first: strings sliced to 64 chars,
arrays over 16 elements rendered as `[array of N]`, both inside a `try` because
`Array.isArray` can throw (finding 2). Post-fix: the 100MB-string reason
returns in **168 ms** at **129 chars**; the `2**32-1` array returns in **0 ms**
as `invalid country set: [array of 4294967295] …`.

> **RETRACTED 2026-08-16 (same day, release gate) — "the input is bounded
> first" was measurably false.** It bounded a top-level long string and an
> array's length, and nothing else: a long string one level down was still
> serialized in full (657ms nested vs 83ms top-level, same 50MB string). Worse,
> guarding the fallbacks with try/catch bounded throws but not allocations — a
> `toJSON` returning `'x'.repeat(3e8)` killed the process outright at exit 134.
> Both are fixed and the whole fallback chain is gone; see the release-gate
> entry at the top of this file. Left in place rather than edited: this log is
> append-only, and a retraction is the record.

**4. Two diagnostics skipped the clamp — both built from requester-chosen
text.** (a) The unknown-backstory-field throw interpolated the caller's key
RAW: a 5000-char key containing a newline rode verbatim into an `Error`
message, which is both unbounded and **log-forgeable** (an embedded newline in
a logged message fabricates a log line). (b) `unexpected predicate fields` did
a bare `extra.join(', ')`: a predicate carrying 50 huge keys produced a
**~100KB** `reason` — on the wire-facing return, not just a log. Fixed with
`describeKey()` (verbatim only for short printable keys, so the common typo
still reads exactly as typed) plus a 60-char clamp on the joined list. Post-fix
the 50-huge-key reason is **90 chars** and the 5000-char-key message **112
chars with no newline**. **Every pinned message in the suites stayed
byte-identical** — the clamp only fires on input no honest caller sends.

**5. The shared harness printed a GREEN line last on a failing run.**
`conclude()` printed `FAIL CASE COUNT` *before* `RESULT: N/N`, so the final line
of a count-failing run — the line the runbook and any `| tail -1` reads — was a
green tally sitting directly below the failure it hid. Order swapped; the red
line is last now. Exit code was always correct; this is the eyeball fail-open
the count argument exists to close, reintroduced one line lower.

**6. The spec sketch contradicted itself — introduced by the immediately
preceding commit.** `reachable` was minted into the `Predicate` type enum, but
`value` had no boolean branch in its `oneOf` (`string` | `array of string`) and
the module rejects the string spelling `"true"`. So **no `reachable` request
could be both schema-valid and answerable.** `- type: boolean` added to the
`oneOf`; YAML re-parses clean.

**7. Test hygiene, in the check file itself.** The `bit()` helper had no
callers (dead code shipped in the previous round) — removed, along with an
unused `number` parameter on `scripted()` and a stray `const p = P90` alias.
More load-bearing: `threws()` discarded the callee's return value, so case 25
re-ran the call by hand to get the verdict it asserted on — two calls, able to
drift. `threws()` now returns `{threw, msg, value}` and case 25 asserts on the
value of **the same call it probed**.

**Mutation-proven, by exit code.** The new guards were folded into cases 16 and
17 (declared count stays 30, so the seatbelt from the previous round still
matches). Each fix reverted one at a time from a working-copy `cp` backup →
suite exits **1**, red on exactly case 16 or case 17 as intended → restored →
byte-identical by sha256 → **30/30 exit 0**.

**SKIPPED, on record as open items rather than papered over:**

1. **M3 carries the same `describe`-throw class, live and unfixed.**
   `checkFloor({swapAgeMin:'P90D'}, {swapAgeMin: 10n})` throws a raw
   `TypeError: Do not know how to serialize a BigInt` out of the UNTRUSTED-side
   path (re-measured 2026-08-16; a circular value with a throwing `toString`
   throws `Converting circular structure to JSON` the same way). This is
   pre-existing, outside this diff, and already on record: the entry below
   records M3's release-gate open item 1 as only PARTIALLY closed — M4 built the
   throw-proof `describe()`, M3 was never retrofitted with it. Fixing it means
   touching a user-validated module, so it waits for M3's next deliberate touch.
2. **The spec sketch still over-promises relative to the code.** Its
   `Predicate` enum lists seven types; the M4 module answers **three**
   (`simSwapAge`, `roamingIn`, `reachable`). And `required: [type]` leaves
   `operator` optional in the schema while the module rejects any predicate
   whose operator does not match its type exactly. The sketch is illustrative,
   not normative, and **M6 is the declared reconcile point** — restated here
   because a schema looser than the reference implementation is exactly the
   silent-widening shape the profile forbids, and it should not be discovered
   fresh at M6.

## 2026-08-16 — user validation: all four modules green at `1f92792`; two decisions settled; declared case counts extended to M1–M3

The user personally ran the runbook on their own machine at commit `1f92792`
and reported all four suites clean: `node poc/m1-check.mjs` **19/19**,
`node poc/m2-check.mjs` **10/10**, `node poc/m3-check.mjs` **22/22**,
`node poc/m4-check.mjs` **30/30**. This closes the M4 user gate the entry below
left open and re-confirms M1–M3 at their post-release counts.

**Two user decisions on the carried-forward open items:**

1. **The three deliberately-unpinned redundant guards stay, settled.** The
   `Array.isArray` clause in `plainSnapshot`, `durationMs`'s 2^53 reject, and
   the `\d{6,12}` digit bound — each classified redundant by PROBE rather than
   by argument in the entry below — remain as documented defence-in-depth,
   marked in-source as not relied upon rather than deleted or left looking
   load-bearing. Not to be re-litigated at M6.
2. **`reachable` is minted into the spec sketch now, not deferred to M6.** The
   illustrative `Predicate` enum in `spec/carrier-attestation.yaml` becomes
   `[simSwapAge, tenure, simType, roamingIn, presentIn, numberMatch, reachable]`,
   closing the open item the two entries below carry. YAML re-parsed clean
   after the edit (exit 0). A grep of both proposals and `README.md` for a
   predicate-type list found **no normative surface to sync**: the CAMARA
   proposal's normative profile (rules 1–8) enumerates no predicate types at
   all, and its only predicate list is Mode B prose (§5.3 presentment: "device
   reachable within last hour"), which the addition agrees with rather than
   contradicts. The sketch stays illustrative, not normative. The in-source
   note in `m4-facts-mock.mjs` that flagged the type as deliberately un-minted
   was corrected in the same change rather than left stale.

**Declared case counts extended to M1/M2/M3 — and this change is
POST-VALIDATION.** The shared harness's `conclude(expected)` seatbelt (a suite
that silently loses the cases carrying its guarantee must not read green —
measured below) protected only M4. `m1-check.mjs` now declares `conclude(19)`,
`m2-check.mjs` `conclude(10)`, `m3-check.mjs` `conclude(22)`. Each
mutation-proven: one case block removed → suite exits **1** printing
`FAIL CASE COUNT: expected N cases, ran N−1` (18/19, 9/10, 21/22 respectively)
→ restored from a working-copy `cp` backup, byte-identical by sha256 → **19/19,
10/10, 22/22, all exit 0**. **Honesty note: the user validated the MODULES at
these counts; these three check files were edited afterwards, so a user re-run
of M1/M2/M3 is pending.** No module source was touched — one `conclude`
argument and one comment per check file.

## 2026-08-16 — M4 adversarial review round: 1 code defect, 5 unpinned guards, 2 harness fail-opens (24 → 30 cases)

Independent review of the M4 build below, run against the challenge "did you fit
to pass? what did you gloss over?". Every verdict by EXIT CODE; every mutation
restored from a working-copy `cp` backup and verified byte-identical (sha256).
**Agent-run 30/30 — the user gate is still the next step.**

**Fit-to-pass probe (written BEFORE reading `poc/m4-check.mjs`).** A 19-case
adversarial check was written from the PRD + the four signed-off decisions only,
then run: **18/19**. One failure was the harness's own confound (the probe used
`'ZW'` as both the subscriber's country and a requester-supplied predicate
value, so the requester's echoed input read as a leak — requester-echoed values
are acceptable, subscriber facts are not); corrected, it passed. The other was
real (below). So the shipped suite was **not** shaped around a broken module —
but it did leave guards unpinned, which an independent mutation set found.

**The one code defect — `describe()` could throw, breaking "wire input never
throws" from inside the message written to prevent it.** Three fallbacks, only
two guarded: `Object.prototype.toString` reads a `Symbol.toStringTag` GETTER,
and the last-resort call sat *inside* the previous `catch`, unprotected. With a
wire value that is circular (`JSON.stringify` throws) AND carries a throwing
`toString`/`valueOf`/`Symbol.toPrimitive` (`String` throws) AND a throwing
`toStringTag`, `evaluatePredicate` **threw**. Fixed by guarding each fallback in
turn with a constant floor (`[unrenderable]`); all previously-observed renderings
are byte-identical (BigInt `10`, circular `[object Object]`, `Symbol(s)`, the
60-char clamp). This means M3's release-gate open item 1 was only PARTIALLY
closed by the build below — the correction is recorded rather than the claim
quietly restated. Pinned by case 25.

**Independent mutation sweep: 28 mutants of my own selection, 20 killed, EIGHT
survived** — against the build's reported 27/28. The gap is the answer to "what
did you gloss over": the 24-case suite left seven load-bearing-looking guards
unpinned beyond the one it documented. Each survivor was then classified by
PROBE against the mutated module, never by argument:

| Survivor | Probe result | Verdict |
|---|---|---|
| `hasOwn(PREDICATES, p.type)` → truthiness lookup | `{type:'toString', operator:undefined, value:true}` returned **`{answered:true, result:true}`** — a signed AFFIRMATIVE to a predicate type that does not exist; 5 more `Object.prototype` keys the same | LOAD-BEARING → case 26 |
| `typeof p.type !== 'string'` | a boxed `String`, `['simSwapAge']` and `{toString}` each coerced to a real key and answered **`{answered:true, result:true}`** — the clause is NOT redundant (predicted redundant, measured load-bearing) | LOAD-BEARING → case 27 |
| `fact < 0` on `swapAgeMs` | a negative age answered **`{answered:true, result:false}`** — "not old enough" as a real bit. Unreachable via the mock, but M5 differences an operator-supplied `latestSimChange` against the injected now, where a skewed clock does exactly this | LOAD-BEARING → case 28 |
| `COUNTRY.test(fact)` on `roamingCountry` | fact `'fr'` answered **`{answered:true, result:false}`** — "not roaming in FR" about a subscriber who IS. The spike's own lowercase trap, arriving from the FACT side; case 17 only pinned it on the request side | LOAD-BEARING → case 29 |
| `typeof number !== 'string'` | `TEST_NUMBER.test()` COERCES, so `{toString:()=>'+990…'}` was accepted and keyed by identity: the store answered for the object and threw `unknown number` for the identical string — two subscribers wearing one number | LOAD-BEARING → case 30 |
| `\d{6,12}` digit bound | admits `+990`, `+9901`, 20-digit numbers; but every real-format number (`+33…`, `+1…`, `+86…`) still threw — the no-real-number rule (no-go 13) is carried by the `+990` PREFIX, not the bound | well-formedness only → folded into case 30 |
| `Array.isArray` in `plainSnapshot` | **the build's redundancy claim REPRODUCES** — re-probed over **13** array shapes (the build probed 8; added `arguments`, a typed array, a prototype-rewritten subclass, `new Array(3)`): 0 slipped past the remaining checks, in both the backstory and predicate directions | genuinely redundant, stays unpinned |
| `durationMs` 2^53 reject | cannot produce a wrong answer: any fact large enough to collide with an unsafe threshold fails the fact side's own safe-integer test first, so the too-fresh SIM came back `fact unavailable`, not a false `true` | redundant (defence in depth), stays unpinned |

Re-run after the six new cases: **26 of 28 killed**, the only survivors the two
proven-unreachable clauses above, each new case red on exactly the mutant it was
written for.

**Two harness fail-opens, both proven with a deliberate break** (`poc/check-harness.mjs`,
shared by all four modules):

1. **`extra.ok` was read for truthiness, not truth.** Setting one case's
   `extra.ok` to the string `'truthy-string'` printed **PASS** and the suite
   exited **0** while asserting nothing. Now `extra.ok === true`. Guard-OFF/ON
   negative control: same mistake, guard off → `30/30` exit 0; guard on → exit 1,
   red on the case. (A *typo'd* key already failed safe — that direction was fine.)
2. **A silently shrinking suite read as green.** Truncating `m4-check.mjs` to
   drop its six assertion cases printed `RESULT: 18/18` and exited **0**;
   emptying the tally entirely printed `RESULT: 0/0` and exited **0**. `conclude()`
   now takes an optional declared count and fails the run when it does not match.
   Guard-OFF/ON control with 12 cases cut: off → `18/18` exit 0; on → exit 1,
   `FAIL CASE COUNT`. M4 declares `conclude(30)`; M1/M2/M3 keep the no-argument
   form (unchanged behaviour — deliberately not re-opening modules the user has
   already validated; their next touch is the place to declare a count).

Both harness changes are behaviour-preserving for the already-validated modules,
proven by **exact case-count parity**: M1 19/19, M2 10/10, M3 22/22, all exit 0
before and after.

**Leak audit (profile rule 2) — CLEAN.** A 200,000-round fuzz over
`evaluatePredicate` returns, with subscriber facts drawn from a token alphabet
DISJOINT from every requester-supplied input, found **0** leaks of swap age,
swap timestamp, country or number — including through rejection `reason`
strings. The fuzz was proven able to fail first: injecting `fact=${describe(fact)}`
into one reason made it red within 1,623 rounds.

**Spike-claims replay — all reproduce, no correction needed.** The naive adapter
described in the entry below was rebuilt from scratch and all **13** claims
reproduced exactly: the headline flip (120d→`true`, 1d→`false`), the negative
control (setter stubbed → bit stays `true` from DEFAULTS), determinism
(2020 vs 2099 both 120d), all six traps, and the `JSON.stringify`-renders-NaN-as-null
harness artifact.

**Cross-module regression:** M1 19/19, M2 10/10, M3 22/22, M4 30/30 — all exit 0.

**Nits fixed:** the `reachable`-not-in-the-spec-enum note cross-referenced
"findings 2026-08-15"; the entry carrying that open item is 2026-08-16. A
same-file sweep found no other stale cross-reference (the two `Array.isArray`
notes were already correct). Separately, `m4-check.mjs` case 11's comment claimed
the store keeps a "frozen copy" — it keeps an unfrozen private snapshot (the
snapshot, not the freezing, is the load-bearing property and is what the case
actually tests); wording corrected rather than the code changed.

## 2026-08-16 — M4 mock facts adapter: spike traps, build, 28 mutants (27 killed, 1 provably redundant)

Agent-run build of module M4. **Not user-validated** — the user gate is the
next step, exactly as the ladder requires.

**The spike (throwaway, aimed at PRD §4.4's M4 assumption: "flipping the
backstory flips the bit; the fixture can show the negative").** Written the
NAIVE way on purpose — spread-merged defaults, coercing arithmetic, a
"debuggable" evaluate return — so the traps would be OBSERVED rather than
argued. The headline held: with the story scripted "swapped 120 days ago" the
windowed answer was `true`, re-scripted to "yesterday" it was `false`. The
negative control matters more than the result: stubbing the setter to a no-op
left the bit at `true`, so the case can genuinely fail. Determinism held at
both extremes — the same relative story evaluated at `now=2020` and `now=2099`
gave 120 days both times.

Then six fail-opens, each MEASURED, each ending in a confident, wrong,
signable answer rather than an error:

| Trap | Observed |
|---|---|
| `{...DEFAULTS, ...backstory}` merge + typo `swapedDaysAgo` | call looks accepted, fact comes from DEFAULTS (365d) — a scripted story silently never in force |
| backstory axis on the PROTOTYPE / as a NON-ENUMERABLE own prop | spread drops it, adapter answers 365d from defaults (M3's lesson, re-measured on a new surface) |
| unknown number via `store.get(n) ?? DEFAULTS` | confident 365-day-old SIM for a subscriber nobody scripted |
| coerced day counts | `'120'` → 120d silently works; `null` → **0 days** (`Number(null)===0`, a confident "swapped today"); `true` → 1d; `'120d'` → NaN, and `NaN >= x` is false, so the bit is decided by a parse failure |
| unknown / typo'd predicate type | naive evaluate answers a clean `false` — a signed "no" to a question never asked; whether "no" reads as safe depends entirely on the question's polarity |
| "debuggable" return `{result, swapAgeMs}` | the raw age survives `JSON.stringify` — i.e. reaches the wire |

One harness artifact worth naming so it is not re-discovered: printing the
coercion probes via `JSON.stringify` rendered `NaN` as `null`. The assertions
tested the real values (`Number.isNaN`), not the printed ones — the display was
misleading, the verdict was not.

**Build.** `poc/m4-facts-mock.mjs` + `poc/m4-check.mjs`, **24 cases, negatives
first, 24/24 exit 0**. Design points the spike forced: no defaults anywhere and
every backstory field REQUIRED with the call REPLACING the story (so a typo is
both an unknown field and a missing one, and cannot be silent); the clock is a
parameter, never read; facts and answers are separate steps — `getFacts` hands
back raw facts, `evaluatePredicate` hands back `{answered, reason, result}` and
nothing else. Case 20 asserts that answer contains **no digit at all** once
serialized: no age, date, country or number can hide in it.

**Mutation proof: 28 guards reverted one at a time, 27 killed.** Working-copy
backups (`cp` to scratch), never `git checkout` — the module is untracked, so a
checkout restore would delete it outright. Every verdict by EXIT CODE. Each
mutant took the suite to exit 1 with the intended case red; each restore
returned the file byte-identical and the suite to 24/24 exit 0. Three mutants
killed two cases at once (the prototype and non-enumerable checks also cover the
predicate path; the coercion ban also covers the overflow case) — collateral,
not confusion.

**The one survivor, deliberately kept.** Removing `Array.isArray(o)` from
`plainSnapshot` left the suite at 24/24 exit 0. This is NOT a coverage gap: a
probe over 8 array shapes — plain, empty, `JSON.parse`d, with named props,
prototype-rewritten to `Object.prototype`, prototype-set to `null`, subclassed,
sparse — showed **0 slipped past the remaining two checks**, because `length` is
a non-enumerable own property, so the own-property-count check catches even an
array wearing `Object.prototype`. The clause is unreachable by construction. It
stays (it says "a list is not a record" out loud, and mirrors M3's shape) and is
marked in-source as redundant and not relied upon, rather than being quietly
left looking load-bearing.

**Carried forward as an open item:** the predicate type `reachable` has no
counterpart in `spec/carrier-attestation.yaml`'s illustrative `Predicate` enum
(`simSwapAge, tenure, simType, roamingIn, presentIn, numberMatch`).
Reachability is a required mock FACT (FR5, mirroring the Playground admin
model), and a fact no predicate can consume is dead weight — so the type is
carried in M4 and flagged here rather than minted silently into the sketch.
The spec sketch is illustrative, not normative; M6 is the point to reconcile.

Also closed here, one module early: M3's release-gate open item 1
(`JSON.stringify` on an untrusted value can throw — BigInt, circular, throwing
`toJSON`). M4 renders every diagnostic through a `describe()` that cannot throw
and clamps at 60 chars; both properties are pinned by case 6 and both mutants
were killed.

## 2026-08-15 — user validation run: all three modules green at post-release counts

After the v0.1.0 merge, the user personally ran the full runbook on their own
machine and reported all green: `node poc/m1-check.mjs` **19/19**,
`node poc/m2-check.mjs` **10/10**, `node poc/m3-check.mjs` **22/22**. This is
the dated user-run record that was pending for M2 (first ever) and for the
post-review M1 (19-case) and M3 (22-case) states. Ladder status: **M1, M2, M3
all user-validated at current counts.**

## 2026-08-15 — 0.1.0 release gate: three unpinned guards found by mutation, fuzz clean at 500k

Release-gate sweep before merging the M3 module. The floor logic itself came
through clean; what did **not** was the suite's ability to catch a regression
of fixes the previous two rounds had just made.

**Fuzz (two independent oracles, both written from the rule text, not from
`m3-floor.mjs`):** 200,000 and 300,000 random published/requested pairs
compared against BigInt reference implementations — **0 monotonicity
violations across ~156,000 allow-verdicts**, and for every `allowed:true` the
returned `effective` was ≥ published on every duration axis with no axis
silently dropped. The fuzz can fail: a rejection-disabled mutant produced
**6,200 violations**. Precision past 2^53 verified by reasoning *and* probe —
any true product > 2^53−1 rounds to a double ≥ 2^53, so `isSafeInteger` can
never let a collapsed ordering through.

**Three surviving mutants (the real finding).** Cases 18/19 pinned only one
diagonal of {published,requested} × {prototype,non-enumerable}; removing any
of these three guards left the suite at **19/19 exit 0**:

| Guard removed | Observed fail-open |
|---|---|
| `m3-floor.mjs:63` published prototype | `checkFloor(Object.create({tenureMin:'P3M',swapAgeMin:'P90D'}), {swapAgeMin:'P1D'})` → `{allowed:true}` — the operator's ENTIRE floor unenforced |
| `m3-floor.mjs:95` requested non-enumerable | request demanding `swapAgeMin:'P180D'` non-enumerably → `{allowed:true, effective.swapAgeMin:'P90D'}` — demanded constraint silently dropped |
| `m3-floor.mjs:33` `Number.isSafeInteger` | pub `P9007199254740993D` vs req `P9007199254740992D` (1 day looser) → `{allowed:true}` |

The shipping code was **correct throughout** — every guard was present and
load-bearing (verified by probe: each rejects/throws correctly with the guard
in place). This was a test-coverage gap, not a defect.

**Closed by cases 20/21/22**, each mutation-proven with the guard reverted
then restored from a working-copy backup (`git checkout` stays banned here —
it reverts tracked files to HEAD and would wipe the uncommitted fix under
test): guard removed → that case **alone** red, `21/22 exit 1`; restored →
`22/22 exit 0`, module byte-identical (md5 `dfe8c276`). No collateral: each
mutant killed exactly its own case, so each case pins one guard.

**Docs honesty fix:** `poc/README.md` said M2 was `(user re-run pending)`,
implying a prior user run that `findings.md` and `prd.md` both record as
never having happened — corrected to `(user validation pending)`.

**Open items, deliberately NOT fixed in this release** (recorded so they are
on the books rather than papered over):

1. **`m3-floor.mjs:41,46` — `JSON.stringify(value)` on an untrusted value can
   throw**, breaking the module's own "wire input never throws" line. Observed:
   BigInt → `TypeError: Do not know how to serialize a BigInt`; circular →
   `TypeError: Converting circular structure to JSON`; a throwing `toJSON` →
   the attacker's `Error` escapes verbatim. **Not reachable through the
   current wire path** — `JSON.parse` cannot produce any of the three — and it
   fails *closed*, not open. Matters if a non-JSON codec (CBOR/COSE, the
   natural M2 direction) ever feeds this, or for the in-process M6 caller.
   Fix when that lands: a total `safeStr()` used at both sites, plus extending
   case 19's extra to a throwing `toJSON`.
2. **`m3-floor.mjs:118` — untrusted key echoed unescaped** into
   `unknown floor field: ${k}` (every other interpolation goes through
   `JSON.stringify`). Observed: `JSON.parse('{"a\\nPASS ALLOW":1}')` yields a
   reason containing a literal newline — forged log lines if an operator logs
   rejection reasons.
3. **`m3-floor.mjs:41,46,118` — unbounded echo of untrusted input** into
   `reason`. Measured: a 5 MB value → a 5,000,083-char reason (161 ms). No
   ReDoS (`^P(\d+)(D|Y)$` is linear — 2 MB non-matching input, 77 ms), but a
   rejected request costs a multi-megabyte log write.
4. **Spec/profile do not bound duration magnitude.** `^P\d+(D|Y)$`
   (`spec/carrier-attestation.yaml:78,83`) and rule 5 admit
   `P99999999999999999999D`, which the gate rejects. A third-party
   implementation following only the text, in any IEEE-754 language,
   reintroduces the equality-collapse fail-open. For a standards repo an
   invariant enforced only in the reference PoC is not enforced.
5. **`poc/m3-check.mjs:71,87,114`** compare `effective` to `PUB` via
   `JSON.stringify`, which is key-order sensitive. They coincide today;
   reordering `AXES` — a legal refactor — would red three cases for a non-bug.

**Validation state:** the 22/22 (M3), 19/19 (M1) and 10/10 (M2) counts in this
entry are **agent-run**; user runs are pending. The standing user-validated M3
record is 14/14 on the pre-review build.

---

## 2026-08-15 — M3 review round 2: two in-process fail-opens closed, harness hardened, rule-5 reached the text

Second adversarial `/code-review` over the M3 module + check + harness: **8
findings, 7 confirmed, 1 plausible**. The two that mattered were both
*fail-opens* — the gate answering when it should have rejected:

1. **Non-enumerable published axis went UNENFORCED.** A published floor
   carrying an axis as a non-enumerable own property passes the plain-object
   prototype check but VANISHES in the `{ ...published }` snapshot, so the
   operator's intended constraint was simply not compared. Closed by
   asserting the plain-object contract on own-property COUNT
   (`getOwnPropertyNames` vs `keys`), not the prototype alone.
2. **Requested prototype-carried axes were silently STRIPPED.** A request
   floor built on a prototype (`Object.create({ swapAgeMin: 'P180D' })`) came
   back `allowed: true` with the demanded constraint dropped — the same class
   as an ignored typo, but arriving off the wire. Closed in the untrusted-side
   mirror, which also catches a THROWING getter and returns `malformed floor`
   rather than letting a raw `TypeError` escape ("wire input never throws").

Mutation evidence (module restored byte-identical from a working-copy backup
after each; `git checkout` is banned here — it reverts tracked files to HEAD
and wipes the fix under test): removing the non-enumerable check → case 18
red (`expected REJECT, got ALLOW — got 'did not throw'`); removing the
prototype check in the requested-side normalizer → case 19 red (`expected
REJECT, got ALLOW — reason 'ok'`, i.e. the pre-fix fail-open reproduced
exactly). 19/19 exit 0 with both restored.

Harness hardened: `check()` now defaults an absent verdict to `{}`. A
regressed module returning `undefined` previously killed the whole suite as a
`TypeError` with **no RESULT line** — proven by mutating one reject path to a
bare `return;`: without the guard the run dies at case 4 (0 FAIL lines, no
tally); with it the run prints FAIL lines and `RESULT: 15/17`, exit 1. The
hand-rolled expect-throw blocks (cases 14/17) folded into a shared
`checkThrows(name, fn, substrings)` so a throw with a useless message still
fails.

Rule-5 sync: the three signed-off M3 rules had never reached the normative
text, breaking the repo's code+text precedent. Proposal rule 5 now states the
closed axis set, the `P<n>D`/`P<n>Y`-only grammar with 1Y = 365D declared and
months rejected as ambiguous, and numeric-not-lexicographic comparison; the
spec's `Floor` schema gained `additionalProperties: false` and a
`^P\d+(D|Y)$` pattern with quoted descriptions (unquoted commas in an inline
YAML flow mapping silently truncate — a previously confirmed bug in this
file). Verified: the spec parses and no key came back null-valued.

Docs honesty: "user-validated" was overclaiming the current state. M3 was
user-run at 14/14 on the pre-review build; the 17→19-case state is agent-run
only. M1 was user-run at 17/17 pre-hardening, 19/19 agent-run. M2 has **no
dated user-run record at all**. PRD ladder status, `poc/README.md` and the
CHANGELOG now say so, with user re-runs marked pending.

---

## 2026-08-15 — M3 floor gate: spike traps, build, mutation proofs (user-validated 14/14)

Spike (throwaway, scratchpad) attacked the toughest assumption — "no silent
widening path exists" — and confirmed six JS traps a naive gate would ship:

1. **Lexicographic string compare WIDENS silently**: `'P100D' < 'P90D'` is
   true as strings — a naive `requested >= published` compare rejects
   tighter requests and (mirrored) admits looser ones. Parse, never compare
   strings.
2. **`parseInt('3M') === 3`** — a lenient parser reads months as days.
3. **`Number(null) === 0`, `Number('') === 0`** — coercion turns a garbage
   PUBLISHED floor into "0 days", admitting EVERY request. Hence: broken
   published config THROWS (operator's own fault, loud); wire input rejects.
4. Strict grammar `^P(\d+)(D|Y)$` kills `P3M`/`P90d`/`90D`/`PT90H`/
   `P-90D`/compound forms/non-strings in one regex.
5. Precision past 2^53: `Number()` is monotone non-DECREASING, so an
   ordering cannot reverse — but strict-less can COLLAPSE to equal, and the
   gate's strict `<` then admits a marginally looser request. Absurd at
   profile magnitudes (~10^13 years); closed anyway by rejecting
   non-safe-integer day counts (review round).
6. Enum compare is exact-match, case-sensitive.

Build: `poc/m3-floor.mjs` (pure function, no crypto) + `poc/m3-check.mjs`
(14 cases, negatives first). USER ran the check personally: 14/14 exit 0.

Mutation proofs (module restored byte-identical from working-copy backup
after each): (A) below-floor rejection disabled → cases 1+2 red; (B)
unknown axes ignored → cases 4+5 red; (C) numeric compare replaced with
string compare → cases 2, 9, 11 red. Mutant C's FIRST run died as a stack
trace with no RESULT line — the check's own `v.effective.x` derefs were
unguarded, the exact "dead process instead of a FAIL" defect M2's review
caught — fixed with `?.` so a regressed module prints clean FAIL lines to
a RESULT tally.

Review round (opus, adversarial): 200k-iteration differential fuzz vs an
independently-written BigInt oracle — 36,452 allow-verdicts audited, 0
violations on wire-shaped (JSON.parse'd) input; the fuzz's own negative
control (a rejection-disabled mutant) produced 14,725 violations, so it
could fail. 7 warnings, all fixed and re-proven:

1. **Non-plain objects bypassed "throws loud" and failed OPEN** (validation
   iterates OWN keys; the compare read `obj[axis]` through the prototype
   chain, and getters were read twice — validate-once/compare-different
   TOCTOU). Demonstrated: `Object.create({tenureMin:'P3M'})` admitted a
   P1D request. Not wire-reachable (`JSON.parse('{"__proto__":…}')` yields
   an OWN key, caught as unknown field — verified) but M6 hands this
   function in-process objects. Fixed: non-plain-prototype published
   config now THROWS ('not a plain object'); both inputs snapshotted to
   own props before validation so validate and compare see the same data.
2. **`r < null` coerces to `r < 0` = allowed** — explicit null guard added
   to the compare (defense in depth behind validation).
3. `effective` could carry a never-validated value (same root; closed by 1).
4. The null/absent-floor branch guarding "wire never throws" was untested —
   canary case 15 added (null AND absent both inherit, mutation-proven).
5. The declared 1Y=365D constant was unpinned (a 360-day mutant survived
   14/14) — canary case 16 pins it from both sides (P364D rejects, P365D
   allows, tie keeps the operator's 'P1Y' spelling).
6. poc/README still said "M3–M6 not started" beside the M3 run line → M4–M6.
7. This log's own 2^53 claim was worded wrong (see corrected item 5 above);
   non-safe-integer day counts now rejected outright.

Post-fix: 17/17 exit 0 (user-validated build + 3 canaries), m1 19/19,
m2 10/10, five mutants killed total, all restores byte-identical.

## 2026-08-15 — The two v0.0.3 security Mediums closed (duplicate keys + key pinning)

Closed same-day on user decision ("fix both now"), not parked to M3.

1. **Duplicate-key equivocation — RUN and OBSERVED, then fixed.** A signed
   payload carrying `"result":true … "result":false` passed the full M1
   verifier (V8 last-wins; the closed-set check can't see it — Object.keys
   shows one `result`). With the new byte-level scan removed (mutation),
   both new check cases print `expected REJECT, got ACCEPT — got 'ok'`;
   with it, 19/19. The scan compares keys AFTER JSON escape decoding —
   case 18 proves `\u0072esult` cannot impersonate a fresh key. Normative:
   rule 2 sentence added (README copy synced, spec YAML description synced).
2. **Key pinning — text-only today.** Rule 3 now requires the verifier to
   pin the expected operator key BEFORE verification; unsigned `iss` is a
   lookup hint only. The reference verifier already takes a caller-pinned
   key, so no code change exists to test; the enforceable surface arrives
   with the trust directory at M6.

Regression: m1-check 19/19 exit 0 (2 new cases), m2-check 10/10 exit 0
(E2E composes through the patched verifier), spec YAML parses with zero
null-valued keys, mutated module restored byte-identical from backup.

## 2026-08-15 — Whole-branch release gates (code-review 8/8 fixed; security + diff-review)

First review of the branch as a unit (each module had only per-build
reviews). `/code-review medium`: 8 confirmed findings, all fixed and re-run
green (m1 17/17 byte-identical output, m2 10/10) — headline items: README
advertised a `demo.mjs` that doesn't exist yet (M6 target); two docs still
said ECDH+AES-GCM after the RSA-OAEP decision; the spec sketch and the
reference verifier were mutually unimplementable (iat/iss inside claims,
ISO-string exp); 6 of 8 hub-blind key attempts crashed on key-type before
any crypto (attack theater — reduced to the decryption-capable set);
`.gitignore`'s `.*/` silently ignored `.github/`. **Supersedes M2 finding 6
below:** the check-harness duplication WAS extracted
(`poc/check-harness.mjs`) once the whole-branch view made it a third-copy
risk; proven behavior-preserving by byte-identical m1 output.

Release-gate round on top (fresh agents, read-only, mutation-proving):
diff-review found the spec's unquoted inline YAML descriptions silently
truncating (the epoch-ms `exp` detail — the parity fix's own point — was
being dropped by any YAML parser), and that case 8's reason string had
become derived-from-verdict (tautology) rather than observed — both fixed,
observation restored. Security: nothing Critical/High; two Mediums are
normative-text gaps (duplicate-JSON-key ambiguity under sign-what-you-ship;
no rule pinning WHICH operator key a verifier expects) — WG-facing, held
as open decisions for the submission round, not merge blockers.

M2 built (`poc/m2-envelope.mjs` seal/open + `poc/m2-check.mjs`, 10 cases,
10/10 exit 0; M1 regression-checked at 17/17). The review's orchestrator
died on a session limit, so the finders' raw candidates were validated
manually before fixing (a dead reviewer's silence is never a clean bill).

1. **seal()'s capacity guard was hard-coded to the RSA-4096 value (446).**
   Proven live: a 300-byte payload sealed to an RSA-2048 key passed the
   guard and died inside OpenSSL as raw `data too large for key size` —
   the exact unhelpful failure the guard exists to replace; a larger key
   would falsely reject legal payloads. Fixed: capacity DERIVED from the
   recipient key's modulus (`bits/8 − 66`); non-RSA/PEM-string recipients
   get a clear "must be an RSA KeyObject" throw. Mutation-proven: restoring
   the hard-coded guard turns the new RSA-2048 case red. Lesson: a
   constant that is a property of a KEY must be derived from the key.
2. **A hardcoded `ok: true` extra assertion** (TAMPER case) printed as if
   verified while asserting nothing. Dropped — a decorative always-true
   assertion is worse than none.
3. **HUB BLIND redundancy/mislabeling** — the extra duplicated the verdict
   condition, and a catastrophic recovery would have printed as a
   taxonomy note ('mixed reasons') instead of the actual event. Fixed:
   reason now says 'recovered' when the hub reads plaintext.
4. **Triple hand-synced copies of one predicate** (SIZE CONSTANT) — now
   computed once.
5. **Unguarded parses after open() in the E2E** — a regression would have
   died as a stack trace with NO RESULT line instead of a FAIL. Fixed with
   ok-gated steps; negative control run both ways (gated → clean
   `RESULT: 9/10` exit 1; ungated shape → dead process, no RESULT).
6. **Documented, NOT fixed: the check-harness duplication** between
   m1-check and m2-check (~20 lines). Deliberate: each module's check must
   run standalone, and refactoring would touch the already-user-validated
   M1 files. Accepted drift risk, revisit only if a third copy appears
   with an actual harness bug to sync.

Post-build honesty audit (user challenge, answered item-by-item):
- **The hub is a ROLE in the check, not code** — the routing/metering hub
  actor is M6's to build; M2 delivered the envelope primitives + the
  blindness proof.
- **Requests are encrypted but NOT authenticated** — the response carries
  M1's signature, the request carries none; nothing cryptographically ties
  a request to an RP, and no ladder module owns sender authentication yet.
  OPEN ITEM — assign at M6 spec time (options: RP signature over the
  request, or accept hub-level API auth as the demo answer, stated).
- **Envelope-level replay**: a captured request ciphertext re-sent to the
  operator burns a query (billing nuisance); the RP still rejects the
  stale answer via nonce. Stateless, same story as M1 — now stated.
- **No forward secrecy**: a stolen private key decrypts recorded past
  traffic; subsumed under "demo transport, production = TLS/HPKE" but
  named here explicitly.
- **512 B constancy assumes uniform RSA-4096** (pinned by
  generateEnvelopeKeys); mixed key sizes would fingerprint key size.
- Validation split, stated: green paths re-run by the orchestrator
  directly (exit codes); mutation proofs and the live RSA-2048 probe
  validated from agents' verbatim captured output, not re-executed.

## 2026-08-15 — M2 throwaway spike (blind envelope, scratchpad)

RSA-4096 OAEP-SHA256 (`crypto.publicEncrypt`/`privateDecrypt`, one vetted
stdlib primitive, zero deps, no hand-composed crypto), keys exchanged via
the trust directory — never inside payloads. 8 checks, exit 0.

- **Fit is real but not roomy.** OAEP capacity is 446 bytes. Measured:
  request 148 B (33% of cap), response 270 B (60% of cap, 176 B headroom).
  Overflow control proved the cap genuinely refuses (966 B →
  `DATA_TOO_LARGE_FOR_KEY_SIZE`) — the fit tests could fail. **Constraint
  for later modules: one added claim field or a bigger payload (Mode B,
  multi-attestation) blows the envelope — that would require a vetted AEAD
  hybrid scheme as an explicit new decision, not glue.**
- **Hub blindness proven structurally, and falsifiably.** The hub tried
  all 3 directory public keys AND its own private key against both
  ciphertexts: 8 attempts, 0 recoveries, 0 plaintext substrings.
  Mutation-verified: handing the hub the true recipient's private key
  flips the blindness checks red. Positive control: operator read the
  request exactly; RP verified the M1 signature end-to-end.
- **Size side channel: does NOT exist at this layer.** All content
  variants (3 predicates, both result values, plaintexts 141–274 B)
  produced EXACTLY 512-byte ciphertexts — RSA is fixed-width, so the
  hub's byte-metering log records a constant. The rule-6 padding worry is
  answered for the demo envelope. **Honest remainder: message COUNT,
  TIMING, and the RP↔operator PAIRING stay visible to the hub — that is
  the real metadata surface, and the docs must say so.**
- **Tamper = reject, not crash**: one flipped ciphertext bit →
  `OAEP_DECODING_ERROR`, caught — the hub cannot mutate an in-flight
  answer undetected, on top of the Ed25519 signature underneath.
- Implementation note: `privateDecrypt` THROWS on every failure mode
  (wrong key, public key, tamper) — a real hub/recipient must catch
  per-attempt or die on its own probe.

## 2026-08-15 — M1 round-2 review (8 findings on the fix round + doc sweep)

A second review of the FIXED M1 (a fix round is the least-reviewed code)
found the fixes themselves sound but surfaced a deeper invariant hole and a
doc-drift class: **a design change (predicate-in-the-signature) must be
swept across EVERY doc surface in the same round** — spec sketch, normative
profile rules, README diagram, and PRD ladder all still described the old
shape.

1. **Raw-value smuggling through a valid signature.** A validly signed
   payload carrying `swapTimestamp` alongside the boolean VERIFIED CLEAN
   and handed the raw value to the caller — the repo's one invariant, open
   at its requester-side enforcement point. Fixed: closed claim set — any
   field beyond `{predicate, result, nonce, exp}` rejects.
2. **Incomplete response shape gate.** Only `signature === undefined` was
   caught; `null`/number/string signatures — and even a broken TRUSTED KEY
   (caller's own config) — misreported as the attack-shaped 'bad signature
   (malformed)'. Fixed: `Buffer.isBuffer` on the signature in the shape
   gate; the try/catch stays as a defensive backstop for broken caller keys
   (measured: a non-key makes `crypto.verify` throw).
3. **The check harness never asserted rejection REASONS** — collapsing
   'malformed response' into 'bad signature' (the exact regression case 1
   exists to catch) stayed green. Fixed: expected-reason assertions folded
   into pass/fail; happy-path fidelity folded into one verdict (no more
   possible PASS-then-FAIL double line).
4. **Spec sketch described a different signing mechanism than the PoC** —
   a field-tuple signature `(predicate, result, nonce, iat, exp, iss)` with
   optional members and no canonicalization is unimplementable as written.
   Fixed: sig restated as a detached signature over the exact payload bytes
   (sign-what-you-ship).
5. **The NORMATIVE profile (rule 2) never required the predicate echo** —
   the illustrative artifacts were stricter than the document that carries
   the rules; an implementer building to §3.2 alone stayed vulnerable to
   answer-substitution. Fixed: rule 2 now requires predicate echo + names
   the stateless-verification limit (single-use nonces are requester-side).
6. **README architecture diagram** still showed `signed {result, nonce,
   exp}` — the exact wire shape the check suite rejects as an attack. Fixed.
7. **PRD §4.4 M1 row** still claimed "replay … genuinely REJECT" for a
   deliberately stateless verifier. Fixed: row reworded to binding-only;
   the single-use-nonce obligation explicitly assigned to M6's RP side.
8. **`Predicate.value` was typed `string`** while its own example is the
   array `["FR","BE"]` — the schema couldn't express its documented
   set-membership case. Fixed: `oneOf` string | string-array.

Follow-up: the one flagged coverage gap (`unparseable payload` had no test,
since `attest()` can only produce valid JSON) was closed by signing
genuinely non-JSON bytes directly with `crypto.sign` — a valid signature
over garbage, proving the parse failure alone causes the rejection.
Mutation-proven to pin the exact branch: a mutant that still REJECTS but
with the sibling reason (`malformed claims`) turns only that case red —
a verdict-only assertion would have passed it. Final: 17/17, exit 0.

## 2026-08-15 — M1 review round (8 findings on the first M1 build)

A medium code-review of the freshly built `poc/m1-attestation.mjs` +
`poc/m1-check.mjs` surfaced 8 execution-verified findings. The lesson
class: **a verifier must type-gate every field of the signed claims — each
unguarded field was a real accept-what-should-reject hole.**

1. **`result` was never validated.** A validly signed payload with `result`
   missing, or `result: "false"` (a string), was ACCEPTED. A relying party
   branching on the claim reads `undefined` (falsy) or a truthy string —
   the opposite of what was attested. Fixed: `result` must be a boolean
   (matches the repo invariant: the answer IS a signed boolean).
2. **Nonce check failed open.** `claims.nonce !== expected.nonce` passes
   when BOTH are `undefined` — a caller that forgot to generate a nonce
   silently lost all replay binding. Fixed with a string type-gate.
3. **Verifier could throw on validly-signed weird payloads.** `attest(key,
   null)` signs the 4-byte payload `null`; the verifier then crashed on
   `claims.predicate` instead of rejecting. Broke the stated
   "reject, never throw, on untrusted input" invariant. Fixed with a
   non-null-object gate after parse.
4. **Wrong factual comment about `crypto.verify`** (see spike finding below
   — the module comment stated the unmeasured claim).
5. **The try/catch around `crypto.verify` had zero test coverage.** The
   "garbage signature Buffer" case exercises the ordinary `false` path, not
   the catch. The case that actually throws: a signature that is NOT a
   Buffer at all — e.g. a base64 string straight off a JSON wire. Covered
   now with its own case.
6. **PoC vs `spec/carrier-attestation.yaml` divergence.** The sketch's
   signed set was `(result, nonce, iat, exp, iss)` — NO predicate — so
   under the sketch, a signed answer to a DIFFERENT question verifies.
   Fixed: `predicate` added to the sketch's response + signed set.
   Deliberately NOT changed: the sketch's `exp` stays RFC3339 (WG-friendly,
   illustrative) while the demo uses unix-ms (deterministic tests); the
   divergence is format-only and recorded here on purpose.
7. **Caller/config errors were attack-shaped.** A broken trusted key
   (undefined, wrong type) rejected as "bad signature (malformed)" —
   pointing debugging at a nonexistent forger. Fixed: malformed responses
   get a distinct reason before the crypto call.
8. **The "REPLAY" test overclaimed.** It proves a response bound to nonce A
   does not verify against nonce B — nothing more. The verifier is
   STATELESS: re-presenting the same response against the SAME expected
   nonce within `exp` verifies again. Single-use, per-request nonces are
   the requester's job. Test renamed/reworded to what it proves; no
   nonce-consumption state added in M1 (honest limit, stated).

## 2026-08-15 — M1 throwaway spike (scratchpad, user-validated)

Ed25519 attestation core spike: 5 cases (tamper / replay-nonce / expired /
wrong key / happy), 3 guard-off negative controls, 1 sabotage run.

- **All 4 negatives genuinely reject, and each guard is load-bearing**:
  disabling each guard flips exactly its own case to wrongly-ACCEPT and
  nothing else. Sabotaged always-accept verifier → harness goes red, exit 1
  (the test can fail).
- **Measured (Node 22): `crypto.verify` returns `false` on a malformed
  signature *Buffer*** (7-byte, 64-byte random, empty). It THROWS
  (`ERR_INVALID_ARG_TYPE`) only when the signature is not a Buffer at all
  (string/number/null/object). The prior assumption ("throws on malformed
  buffer") was wrong — worth knowing because a base64 string off the wire
  is the realistic throwing input.
- **Sign-the-exact-bytes works with zero canonicalization**: serialize
  once, sign those bytes, ship those bytes, verify before parse. No JSON
  key-order problem exists in this shape.
- **Gap found by the spike's own tamper case**: with signatures disabled, a
  one-bit flip inside the KEY `"predicate"` still parsed as valid JSON with
  the right nonce/exp — i.e. a verifier that only checks sig/nonce/exp will
  accept an answer whose predicate field is renamed or missing. This drove
  the predicate-match check into the real M1 (and then finding 6 above
  drove it into the spec sketch).

## 2026-08-15 — G0 rollback (process, not code)

**What didn't work: building G1+G2 as a monolith, integrate-then-show.**
Modules chained without user validation between them; orchestrator-only
checks. Result: full rollback to G0, code archived out of the repo, the
M1–M6 ladder made binding (POC → user-approved spec → build → works alone
→ user validates via runbook → next). Measured Orange facts survived in
`poc/README.md` — knowledge is cheap to keep; unvalidated code is not.

## 2026-08-14/15 — Orange Network Playground (live, measured)

Full dated facts live in `poc/README.md` (kept as evidence through the
rollback). Headlines: two NON-interchangeable token endpoints (CAMARA vs
Admin); sim-swap `/check` `maxAge` is in HOURS (cap 2400 ≈ 100 days,
proven with a discriminating 20-day backstory); `403 FORBIDDEN` means
UNKNOWN NUMBER, not bad auth; built-in numbers `200/201`-echo Admin writes
while IGNORING them — only a READ after the write proves persistence
(READ-verify is load-bearing); `DELETE` returns `204` with an empty
non-JSON body.
