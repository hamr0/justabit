# Findings log

Dated, append-only. What experiments actually showed — including what did
NOT work. Complements `prd.md` (which records decisions); this records the
evidence and the dead ends, so nothing gets re-tried or re-argued from
memory. A finding here is something that was RUN and OBSERVED, not reasoned.

---

## 2026-08-17 (latest) — the 3 → 6 predicate round, part 1: `deviceSwapAge` wired, and three things the build measured that the design had only asserted (AGENT-RUN; user validation PENDING)

Everything below is **AGENT-RUN by exit code on this machine**, offline, no
network in either backend mode. G1 stays **NOT met**. Base commit `fe271df`.

### The scan went red on its first run, and it was right to

The six-predicate wire scan failed immediately with `hits=["FR","FR"]`. Not a
leak: `roamingIn ["FR","BE"]` puts `FR` in the SIGNED CLAIMS by design, because
profile rule 2 requires the answer to name the predicate it answers. A value the
requester put INTO the question is not a disclosure when it comes back out — the
same argument already recorded for the subscriber number.

So each frame is now scanned against the inventory MINUS whatever the question it
answers already carried, and **the size of that exclusion is asserted** (at most
one needle per frame): an exclusion that quietly swallowed the inventory would be
a scanner that cannot red, which is exactly the defect the previous round found.
Mutating the exclusion to drop every needle reds `node poc/demo.mjs`.

**Honest limit, and a real one:** this makes the scan blind to a leak of the SAME
value on the AXIS BEING ASKED ABOUT. If the operator echoed its stored country
into a `roamingIn [FR]` answer, that is byte-identical to the echoed question and
no scanner can separate the two. M1's closed claim set is what actually prevents
it (the leaky-operator control shows that firing); the scan covers every OTHER
value the operator holds. Stated rather than glossed, because the alternative —
dropping `FR` from the inventory — is how the scanner ended up checking one value
five ways last time.

### `/check` is the profile-conforming surface, and it is now the one that runs

`/check` answers `{"swapped":bool}` for a `maxAge` window in HOURS, capped at
2400 (measured, boundary-tested 2400 → 200 / 2401 → 400). That cap is
arithmetic, so the split is not a preference:

```
P30D  =  720h  ->  /check          (operator never reads a date)
P90D  = 2160h  ->  /check
P180D = 4320h  ->  /retrieve-date  (the cap cannot express it)
P365D = 8760h  ->  /retrieve-date
```

There is deliberately no rounding DOWN to a window `/check` can express: that
answers a question nobody asked, signed. `m5-check` case 49 reads which URL went
on the wire per bucket and what `maxAge` rode with it; `m6-check` case 22 pins
that the orange leg of the byte-identity claim really did ask `/check` with
`maxAge=2160` and never touched `/retrieve-date`.

Consequence worth stating: on the `/check` path the operator's own raw fact is a
BOOLEAN, not a timestamp. The profile's argument that windowing is something the
operator does TO a value it holds does not even need to be made there — it never
holds the value.

### A coarse answer is a bit about ONE window, and has to say which

`/check` cannot be compared against an arbitrary threshold, so the fact carries
the window it was computed for (`swapAgeAtLeastMs`) and the compare refuses
unless it EQUALS the threshold asked. Mutating that equality away leaves a module
that can answer "not swapped in 30 days" to a "90 days?" question with a bit that
is signed, verifiable and wrong — killed by m4 case 35.

### `factQuery`, and what it measured

Three of the six predicates need part of the question at the adapter. Handing
`req.predicate` down would put unvalidated wire input into the one module that
builds outbound HTTP — a hostile getter or a revoked Proxy delivered to a network
client instead of being refused. `factQuery` is the chokepoint: never throws,
invokes nothing caller-supplied, returns frozen primitives or `{}`.

Measured while pinning it (m6 case 40): a hostile value on a **menu'd** type never
reaches the adapter at all — the published menu refuses it before any fact is
read. So the shapes that DO reach the seam are the ones on unmenu'd types and the
ones that are not predicates at all; all six arrive as `{}`.

### The Admin write shape for `deviceSwap` is ASSUMED, not measured

What is measured: the Admin READ axis list includes `deviceSwap`, and
`device-swap/v1/retrieve-date` answers `{"latestDeviceChange":…}`. What is NOT:
that an Admin `UPDATE` accepts `deviceSwap:{latestDeviceChange}`. The write
mirrors the one shape that IS verified (`simSwap:{latestSimChange}`), and the
module's read-after-write verification is what makes guessing survivable — a
wrong guess fails LOUD naming the axis rather than scripting a device history
that never took effect. **The live run is what settles it, and nothing here
claims it is settled.** Same for the `{phoneNumber, maxAge}` body shape of the
two `/check` routes, mirrored from sim-swap's measured bare form.

### Mutation table — twelve mutations, twelve killed

| # | Mutation | Red |
|---|---|---|
| 1 | m4: the `/check` window need not equal the threshold | m4 exit 1 |
| 2 | m4: the coarse bit need not be a boolean | m4 exit 1 |
| 3 | m4: `deviceSwapAge` reads the SIM fact | m4, m6, demo all exit 1 |
| 4 | m5: `/check` polarity flipped (`swapped` read as "old enough") | m5, m6 exit 1 |
| 5 | m5: the 2400-hour cap ignored | m5 exit 1 |
| 6 | m5: `swapped` read by truthiness, not as a boolean | m5 exit 1 |
| 7 | m5: the device axis read whether asked or not | m5 exit 1 |
| 8 | m5: the device write not read back | m5 exit 1 |
| 9 | demo: the raw predicate handed to the facts backend | m6 exit 1 |
| 10 | demo: `deviceSwapAge` has no published menu | m6 exit 1 |
| 11 | demo: the wire scan excludes every needle | demo exit 1 |
| 12 | m6-check: the two story day counts made equal | m6 exit 1 |

Every one restored byte-identical afterwards and re-run green.

### A defect in the mutation HARNESS, recorded because it cost a real scare

The harness backs up with `cp` and restores after each mutation — but it had no
restore on INTERRUPT, and a 2-minute command timeout killed it mid-mutation,
leaving mutation 10 applied in the working copy. The next run then reported
`applied=false` (the code was already mutated) with suites red, which reads like
a surviving mutant and is actually a dirty tree. Caught only because the harness
reports whether the mutation applied — the same instrumentation the 2026-08-17
entry below added for the opposite reason. Restored by hand and re-verified.

A separate one-off: immediately after a harness run, `node poc/demo.mjs` and
`node poc/m6-check.mjs` each exited 1 once, then both were green on every
subsequent run. **40 consecutive demo runs and 12 consecutive m6-check runs are
clean**, so it is recorded as unreproduced rather than explained — measured
rather than argued away.

### Suite state after part 1 — ALL AGENT-RUN, user run PENDING

```
m1 20/20 · m2 10/10 · m3 24/24 · m4 36/36 · m5 52/52 · m6 40/40 · demo 27/27
```

Every one verified by exit code. `spec/carrier-attestation.yaml` re-parsed after
the enum edit (now four wired types).

---

## 2026-08-17 — M6 adversarial review: five ways to crash or DoS the operator, a 29%-survival mutation sweep, and four labels that claimed more than they checked (AGENT-RUN; user validation PENDING)

Everything below is **AGENT-RUN by exit code on this machine**, offline, no
network in either backend mode. G1 (PRD §4.4) stays **NOT met**: no user has run
M6, and this round also moved M1 to 20 and M3 to 24, so those two lose their
user-validated status until re-run. Base commit `8238d02`.

An independent adversarial review of the M6 round filed six defects with a
consolidated repro script. All six reproduced on the first run. Four were real
code defects; one was the wire-scanner's LABEL overstating what it scanned; one
was a narration line. Fixing the first two surfaced a fifth crash the review had
not found.

### The four real defects, and the fifth found while fixing them

**1. The operator could be crashed remotely, two ways.** `handle()`'s contract is
that untrusted wire input produces a verdict and never a throw. Two inputs broke
it, both on a request that fits one envelope, both reachable by anyone holding
the operator's public envelope key:

- an **unbounded echoed NONCE**. `req.nonce` was type-checked and never
  length-checked; `signedReject` puts it in the claims and `seal()`s them. 200
  characters → `seal: payload is 500 bytes, over the 446-byte OAEP capacity`,
  thrown straight out of `handle` and up through `roundTrip` → `runDemo` →
  `main`.
- a **clamp counting UTF-16 code units where `seal` counts BYTES**. A floor value
  of 40 astral characters produced a "clamped" 121-unit reason that was 363
  bytes → the same throw, through the ordinary M3 floor-reason path.

The comment above the clamp claimed the worst wire-reachable reason had been
*measured* to fit. It had not. The bound is now computed and the arithmetic is
written down rather than asserted: frame fixed overhead 136 B (32 + 16 `iss` +
88 base64 signature) → base64 payload budget 310 → 308 usable (multiple of 4) →
claims ≤ 231 B → 39 B fixed → **E + N ≤ 192 B**, split 122 / 70 as the
JSON-ENCODED sizes. Measured, not derived on paper: the empty refusal frame is
196 B with 43 B of claims, which pins the 136 exactly. `clampReason` now bounds
the ENCODED byte length (one control character costs six bytes as `\u00XX`, so a
raw-byte bound would still be wrong) and cuts on a CODE POINT boundary, so no
character is split and no lone surrogate is emitted. 122 keeps every previously
pinned reason byte-identical — a quote-free ASCII reason encodes to length + 2,
so the old 120-character cut point does not move. An over-long nonce is a
TRANSPORT reject, in the clear: a nonce the operator cannot echo is one it
cannot sign a refusal against.

**Case 29 seals the worst refusal the two bounds admit — 68-byte nonce beside a
maximal multibyte reason — and measures it at 444/446 B.** Two bytes of
headroom, which is the point of pinning it: that line reds if `iss` ever grows,
which is the one input the stated arithmetic assumes.

**1c. THE FIFTH, found while fixing the first two and not on the review's list:
a request that fits one envelope does not imply an answer that does.**
`roamingIn` takes a SET, and the canonical predicate string re-escapes every
quote in it, so the answer frame grows faster than the request did. Measured: 18
two-letter country codes fit a 446-byte request and produce a **448-byte answer
frame** — `seal()` threw out of `handle` again, on a perfectly legal question.
The answer frame is now measured before it is sealed and an overflow becomes a
signed refusal (a refusal carries no predicate, so it always fits). Case 30 pins
the boundary with a 14-code control that still answers.

**2. A forged response permanently burned the pending nonce.**
`pending.delete(nonce)` ran BEFORE the verdict was examined, so the untrusted hub
— the party the whole design assumes is hostile — could inject **one** garbage
sealed response and the operator's genuine answer then arrived to `unknown or
already-used nonce`. A one-message denial of service. The in-code comment already
said "CONSUMED on any VERIFIED exchange"; the code consumed on any PRESENTED one.
The contract was right and the code was not. Consumption now happens only on an
accepted answer or a verified signed refusal; case 31 also pins the other
direction, that the genuine answer is still single-use afterwards.

**3. `verifyRefusal` never ran the duplicate-key scan.** Profile rule 2 requires
verifiers to reject duplicate claim keys. `verifyAttestation` does it. M6
exported M1's scanner **this very round** precisely so the request path would not
carry a second copy — and then wrote a second verifier that did not call it. One
signature over `{"error":"below floor","error":"off menu",…}` read as one refusal
to a last-wins parser and another to a first-wins one. Fixed in M1's own order
(signature → parse → scan).

**4. Operator-internal diagnostics were signed and delivered to the untrusted
requester.** The backend's exception message was forwarded verbatim into the
signed refusal. On the Orange path an upstream 500 ships a core-network hostname
or pool name to whoever asked — AGENT_RULES invariant 4, broken in the one place
the operator is most likely to be having a bad day. Now one stable reason
(`no facts available for this subject`), with the full message kept on
`operatorDetail`, which never enters the claims and is never sealed. Case 33
throws a message shaped like a real upstream failure
(`sim-swap-pool-07.core.example.net`, tenant, trace id) and scans the ciphertext,
the claims and the requester's verdict for every fragment.

Two decisions recorded rather than assumed:

- **"Unknown subject" and "temporarily unavailable" are deliberately NOT told
  apart.** Distinguishing them is a subject-existence oracle built out of
  refusals — free enumeration of which numbers the operator serves, without ever
  getting an answer. Same reasoning that makes M2 collapse every decryption
  failure into one `undecryptable`.
- **The requester's own submitted number is not echoed back.** The review asked
  whether naming it is disclosure. It is not — it is data they sent. It is
  dropped because it is not NEEDED (the nonce already binds the refusal to that
  exact request) and because putting unbounded wire text into a sealed reason is
  the class of move that produced the nonce crash above. **Case 12 asserted the
  OPPOSITE** ("names the number") — it was pinning the defect, and now pins the
  fix.

### The mutation sweep: 34 meaningful mutations, 10 survivors, 29% survival

Against a shipped claim of "18 mutations against M6's own guards, all killed".
Both numbers are true and the second is the useful one: the original 18 were
self-selected and happened to hit what the suite already pinned. **The claim has
been corrected in `prd.md` and `CHANGELOG.md` rather than left standing.**

The ten survivors, each now pinned:

| # | Survivor | Pinned by |
|---|---|---|
| 1 | `unpackSigned` → `null` → `transportReject('malformed request')` never reached | m6 case 34 |
| 2 | `typeof req.nonce !== 'string'` → `'missing nonce'` never reached | m6 case 35 |
| 3 | **the floor gate moved AFTER `getFacts` left the suite green** | m6 case 36 |
| 4 | `verifyRefusal`'s closed key set (`error,exp,nonce`) | m6 case 37 |
| 5 | `verifyRefusal`'s nonce binding | m6 case 37 |
| 6 | `verifyRefusal`'s expiry check | m6 case 37 |
| 7 | `unpackSigned`'s `typeof … !== 'string'` guards | m6 case 34 |
| 8 | `unpackSigned`'s `Array.isArray(o)` guard | **not pinned — proved REDUNDANT** |
| 9 | the hub log had no closed field set | m6 case 38 |
| 10 | M3 `render`'s `symbol` / `function` branches | m3 case 24 |

Survivor 3 is the one that mattered. "Refused BEFORE any fact is read" is the
justification for the entire pipeline ORDER — *a computed-then-discarded answer
is still an oracle query* — it was claimed in two case comments and asserted
nowhere. Case 36 now **instruments the backend**: a spying `getFacts` counts
calls, and the below-floor and off-menu paths must both read **0** while the
accepted path reads **1**. Counted, not described.

**Survivor 8 is the one that could not be killed, and the honest reading is that
it is redundant, not that the suite is weak.** `unpackSigned`'s `Array.isArray`
was mutated away and `m6-check` stayed green (exit **0**) even with case 34
sending `[1,2,3]`. Proved rather than argued: only `JSON.parse` output reaches
that line, a parsed array's own keys are always its numeric indices, so an array
can never carry own string-valued `iss`/`payload`/`sig` and always dies on the
`typeof` line below instead — guarded and unguarded agreed on **9 array shapes,
0 divergent**. The guard stays as documented defence in depth ("a list is not a
record", said out loud) and is recorded as a **deliberately-unpinned redundant
guard**, not counted as a kill. Exactly the finding and the resolution M4
already reached for the same call in `plainSnapshot`. **So the sweep closes at 9
of 10 survivors pinned and 1 proved unpinnable** — writing a case to "cover" an
unreachable branch would have been a case that cannot fail.

Survivor 10 is pinned in `m3-check.mjs` and not in `m6-check.mjs` on purpose:
**reverting M3's whole `render` fix leaves `m6-check` green**, because the
composition's envelope is what keeps a symbol or a function off the wire. That
is consistent with the fix belonging to M3 — so its pin belongs there too. Saying
so explicitly rather than leaving it implicit, because "the transport happens to
filter it" is exactly the structural accident M3's own case 23 refuses to treat
as a contract.

### Four labels that claimed more than the code checked

No false PASS in any of them — the assertions were true, they just were not
asserting the headline.

- **case 23's `extra` was the literal `ok: true`.** Now asserts M5's export
  surface is exactly one function and carries no `evaluatePredicate` of its own.
- **"the hub opening a message it just carried gets nothing"** opened RSA
  ciphertext with an unrelated fresh key. That asserts RSA-OAEP works; the hub's
  blindness is STRUCTURAL (it is never handed a key) and has no failing case to
  write. Kept as narration, relabelled to what it exercises, in both `demo.mjs`
  and `m6-check.mjs` (case renamed `14 NON-RECIPIENT KEY OPENS NOTHING`). The
  evidence that CAN fail is the log scan and its chatty control.
- **"the effective floor is visible"** asserted only `accepted === true` — a gate
  returning the operator's own floor verbatim would have passed. The effective
  floor is now read: both tightened axes must be the REQUESTER's values and the
  untouched axis the operator's. Mutating M3's `effective[axis] = r === p ? pub :
  req` to `= pub` reds `node poc/demo.mjs`.
- **case 22's byte-identity headline** ("the strongest form the FR5 claim can
  take") was near-vacuous: the signed claims are backend-independent except for
  the boolean, so the frame stays identical even when the orange replay reports a
  swap age nowhere near the mock's. The MECHANISM is sound — the review confirmed
  the orange leg drives M5's real write-verification — so the claim was rewritten
  to what it proves, and a second leg was added that CAN fail: replay a 5-day-old
  swap through the same injected transport and the same question comes back
  `false` while the mock still says `true`. Without it, an adapter that ignored
  its own responses would pass the identity check perfectly.

### The wire-byte scanner was scanning one value five ways

`rawNeedles` was five long-form spellings of the swap timestamp. Four plausible
leaks scored **ZERO** hits while the printed line read "no raw value in ANY wire
artifact": `{"swapDays":137}`, `{"c":"FR"}` (the roaming COUNTRY VALUE — a raw
value under profile rule 1 as much as the date is), `{"m":"+990100000099"}` and
`{"d":"2026-04-02"}`. M1's closed claim set is the real defence and it works, so
this was an honesty defect, not an open leak.

The inventory is now complete at **nine** needles, and the split that was hidden
inside it is explicit: OPAQUE artifacts (RSA ciphertext, base64-bearing frames)
take the seven long forms; PLAINTEXT artifacts take all nine with the random hex
nonce blanked first. Both halves are measured, not assumed — a 2-character
country code lands inside 512 random bytes about one run in 8 and inside a
308-character base64 payload about one in 13; a 3-digit day count lands inside a
32-character hex nonce about one in 140. That is why those two are scanned only
where a hit is real, and why blanking the nonce is what turns the day count from
a flaky needle into an asserting one. Case 18's control plants all five leaks.

### Red → green evidence

Every fix was mutation-proven by reverting it in the working copy (`cp` from a
scratchpad snapshot — never `git checkout`, which would have wiped the
uncommitted fix under test), confirming the target suite exits **1**, then
restoring and confirming **0**. The reviewer's own `repro.mjs` was used as the
red/green oracle alongside `m6-check`, and goes from **6 defects reproduced** to
**0**.

One honest note on that script: its F5 line is written `R('F5', true, …)` — the
verdict is hardcoded, so it reports a defect regardless of the code. It cannot
reach zero by construction. It reaches **0 defect(s) reproduced** with that one
line corrected to test what its own message describes (does the requester's
reason carry the backend's internal detail?), and the correction is a one-line
diff kept beside the run. Reported rather than worked around.

### Suite state after the round

`m1 20/20 · m2 10/10 · m3 24/24 · m4 33/33 · m5 48/48 · m6 38/38 · demo 22/22`,
every one exit 0. Exit-code contract re-verified: clean mock **0**, mock mid-run
crash **1**, orange-without-credential **2**, bad argument **2**.
`spec/carrier-attestation.yaml` parses.

Docs corrected in the same round: the PRD's "every count above is from a run on
the user's own machine" (false the moment M6/M1/M3 landed above it, and the only
place in the repo claiming user validation for M6), the root README's
count/carve-out, `poc/README.md`'s `conclude()` list, the re-measured
`demo.mjs` line composition (1093 / 452 comment / 90 blank / 551 code — the old
873/282/509 no longer summed), the spec's still-open `AttestRequest` top-level
field set, and the spec's `value` example still showing `"voice+data"` after
`simType` left the enum.

---

## 2026-08-17 — Playground endpoint sweep: the band endpoint does not exist, `kyc-match` leaks a similarity GRADIENT, location has three states (AGENT-RUN; user validation PENDING)

Two standalone probes against the Orange Network APIs Playground, number
`+990100000099`, importing nothing from this repo (so nothing here is an
artefact of the adapter's own parsing). Every line below is a response that was
received, pasted verbatim. **Nothing in this entry is built yet** — it is the
evidence a build round starts from.

### Which endpoints actually answer

```
sim-swap/v1/retrieve-date        200  {"latestSimChange":"2026-04-19T01:47:40.334Z"}
sim-swap/v1/check                200  {"swapped":false}
sim-swap/v1/retrieve-age-band    400  {"code":"BAD_REQUEST","message":"unhandled path"}
device-swap/v1/retrieve-date     200  {"latestDeviceChange":"2026-08-11T04:00:16.516Z"}
device-swap/v1/check             200  {"swapped":true}
kyc-match/v1/match               200  (see the gradient below)
location-verification/v1/verify  200  (see the three states below)
number-verification/v1/verify    403  "Request must define a phoneNumber"
tenure/v1/retrieve               400  "unhandled path"
sim-tenure/v1/retrieve           400  "unhandled path"
kyc-age-verification/v1/verify   400  "unhandled path"
device-location/v1/retrieve      400  "unhandled path"
```

**`/retrieve-age-band` DOES NOT EXIST on the Playground.** That closes an item
this log recorded one entry down as UNVERIFIED — "never probed, recorded as
untested rather than assumed in either direction." It has now been probed, and
the honest answer is the unflattering one: the surface that *would* fit the
profile is absent, so band → bucket mapping cannot be demonstrated live at all.
It stays mock-only or documented; it does not get claimed. `400 "unhandled
path"` is the Playground's own signal for a route that isn't wired (the same
signal the 2026-08-16 spike used to tell a missing endpoint from a real one
rejecting a bad shape), so this is an absence, not a permissions problem.

**The `/check` boolean surface EXISTS and works** on both sim-swap and
device-swap — which matters, because it is the shape the profile actually
wants, and up to now the PoC only had `/retrieve-date` measured.

**`number-verification/v1/verify` exists** and 403s with *"Request must define a
phoneNumber"* — the 3-legged shape, where the subject comes from the token. Not
a missing endpoint.

**No CAMARA read endpoint was found for tenure**, at either `tenure/v1/retrieve`
or `sim-tenure/v1/retrieve`, even though the operator-side data is there (below).

### `/check` maxAge is in HOURS, capped at 2400 — boundary-tested on both surfaces

```
maxAge=2400  → 200
maxAge=2401  → 400  "maxAge" must be less than or equal to 2400
```

2400 hours ≈ 100 days. Consequence, stated as arithmetic rather than opinion:
`/check` can serve the `P30D` and `P90D` buckets of the published menu and
**cannot express `P180D` or `P365D` at all.** This is the same cap measured
2026-08-14, now boundary-tested (the 2400/2401 pair) and confirmed identical on
device-swap.

### The `kyc-match` score gradient — the most important measurement of the round

`kyc-match` does not return a match bit. It returns a *similarity score*, and
the score moves with how close you got:

```
name = "Alice Arnaud"   (correct)      → {"nameMatch":"true"}                        no score
name = "Bob Wrong"                     → {"nameMatch":"false","nameMatchScore":53}
name = "Alice Arnaut"   (ONE letter)   → {"nameMatch":"false","nameMatchScore":97}
```

That is a **warmer/colder oracle**. A requester that may guess repeatedly can
hill-climb the score to the subscriber's real registered name — which is
strictly worse than binary guessing, because binary guessing has no gradient to
follow. It is the repeated-query oracle again, but arriving through a single
response field instead of a sequence of thresholds.

**This forces a visible retraction.** The CAMARA proposal claims, in two places
(the §3.3 adoption checklist and the §3.3.1 illustrative table), that
`kyc-match` *"conforms as-is — scores are already bands (rule 7)."* That is
measurably wrong. A band is a coarsening: it destroys resolution inside the
bucket. A similarity score is the opposite — it *preserves* the distance to the
answer and hands it to the requester. The retraction is in the proposal, left
visible, with this measurement next to it. The profile's answer: return the
boolean only, never the score, with the threshold declared in the question off a
published coarse menu.

Also measured on this sandbox: `givenName`, `familyName`, `birthdate` and
`address` all answer `not_available` (only `name` is stored); `email` → 400
validation error; an empty request → 400
`KNOW_YOUR_CUSTOMER.INVALID_PARAM_COMBINATION`.

### `location-verification` has THREE states, not two

```
Paris, radius 10km   → {"verificationResult":"TRUE","lastLocationTime":"2026-08-11T04:00:16.503Z"}
Tokyo, radius 10km   → {"verificationResult":"FALSE", …}
Paris, radius 1km    → {"verificationResult":"TRUE",  …}
Paris, radius 100m   → {"verificationResult":"PARTIAL","matchRate":100, …}
```

`PARTIAL` is the endpoint saying *I cannot answer this at the resolution you
asked for.* Rounding it to `TRUE` or `FALSE` is the missing-fact-as-confident-
negative failure the proposal's §3.3.1 row 3 already has teeth about — signed,
and indistinguishable on the wire from a real answer.

And note what rides along on **every** response, including the ones that look
purely boolean: `lastLocationTime`, a raw timestamp. Even a catalog endpoint
whose headline field is a verdict hands back a raw value beside it. That value
is legitimately the operator's; it must never cross the wire to a requester.

### Operator-side data (Admin API), for completeness

READ axes confirmed: `location, reachability, roaming, simSwap, deviceSwap,
tenure, kyc`. `tenure` holds `latestTenureChange` + `contractType:"PAYM"`;
`kyc` holds `name:"Alice Arnaud"`.

So the tenure data **exists operator-side and has no CAMARA read endpoint**.
That is precisely why `tenure` and `simType` stay OUT of the wired predicate set
(PRD §9, dated today): a predicate whose only source is an operator-internal
admin surface is not catalog-backed, and wiring it would prove something about
this sandbox rather than about CAMARA.

### A grounding failure, recorded plainly

Earlier in this session the orchestrator stated there was **"no fact source
known"** for `tenure` / `simType`. That was wrong, and *this file already said
so*: the 2026-08-16 spike entry records the Admin data model carrying seven axes
including `tenure` and `kyc`, with the note "M5 touches three of the seven; the
rest are untouched, not unnoticed." The claim was made without re-reading the
evidence log it was written into. The conclusion happens to survive — tenure
still stays out, but for the *measured* reason above (no CAMARA endpoint), not
the asserted one (no data). Recorded because a right answer reached by not
checking is not evidence, and this log exists so nothing gets re-argued from
memory.

### Suite state at `e28bc0b` — ALL AGENT-RUN, user re-run PENDING

```
m1 20/20 · m2 10/10 · m3 23/23 · m4 33/33 · m5 48/48 · m6 28/28
poc/demo.mjs 22/22
```

Every one verified by exit code by the orchestrator. **No user has run this
tree.** An adversarial review round of M6 (blind fit-to-pass probe, independent
mutation sweep, can-fail audit, leak/honesty audit) was IN FLIGHT while this
entry was written; its findings are not yet known and will be recorded when they
land, not anticipated here.

### The M6 exit-code defect, independently mutation-proved — and one harness confound caught first

The exit-code fix recorded in the entry below was re-proved by the orchestrator
rather than taken from the author agent's report:

```
fix reverted   node poc/m6-check.mjs   FAIL 28 CRASHED MOCK RUN IS 1, NOT 2 …
                                       mock mid-run throw=2 (regression, must be 1)
                                       RESULT: 27/28    exit 1
fix restored   git diff --quiet        clean (byte-identical restore)
```

Worth recording for its own sake: **the orchestrator's FIRST mutation attempt
did not apply.** Its regex anchor did not match the shipped code; the script
printed `mutation applied: False`, and the "green" run that followed proved
exactly nothing — a passing suite against unmutated code. It was caught because
the script reported whether the mutation landed. Standing lesson, the same one
this log has hit before: **debug the degenerate — or the too-convenient —
result before believing it.** A mutation harness must state whether it mutated
anything, or a green run is indistinguishable from a no-op.

---

## 2026-08-17 (later) — Exit 2 was hiding a real regression; six spec deviations recorded (AGENT-RUN; user validation PENDING)

Every number here is **AGENT-RUN by exit code on this machine.** The earlier
2026-08-17 entry below is left exactly as it was recorded — its `27/27` was true
of the tree it was run on, and this round moved the count to 28.

**The defect, reproduced before it was fixed.** `main()` mapped ANY mid-run
throw to exit 2. Exit 2 is the signed contract for *the chosen backend could not
run* — but `--backend mock` has no prerequisites at all: no credential, no
network, nothing that can be unavailable. So a mock run that STARTED and then
threw could only be a code regression, and it reported itself as a skip.

```
# a genuine regression, injected as a throwing mock setBackstory:
node poc/demo.mjs      exit 2      <- BEFORE (reads as "prerequisite missing")
node poc/demo.mjs      exit 1      <- AFTER  (reads as "a run that failed")
```

A CI gate that treats 2 as skip-on-prerequisite — which is the correct reading
of the contract — would have swallowed that regression in silence. Same family
as the closed-field-set defect below: **the composition owns a boundary no
module owns, and an under-modelled boundary rounds optimistically toward
"fine".** Under `--backend orange` a mid-run throw stays 2, because there an
unreachable live operator genuinely IS a prerequisite failure.

Pinned by new case 28, which drives the REAL `main()` with a backend that starts
clean and throws on first use (the shape a regression has, and not the shape
case 24's could-not-start leg covers), and asserts the clean mock run alongside
so the case cannot pass by making every mock run exit 1.

**Mutation-proved** (revert → red → restore → green), not merely re-run:

```
fix reverted   node poc/m6-check.mjs   FAIL 28 … mock mid-run throw=2   RESULT: 27/28   exit 1
fix restored   node poc/m6-check.mjs   PASS 28 … mock mid-run throw=1   RESULT: 28/28   exit 0
```

**The exit-code contract, observed end to end, not asserted:**

```
clean mock run                                exit 0
--backend orange, credential deleted          exit 2   (+ printed prerequisites)
--oops                                        exit 2   (+ usage)
mock, backend starts then throws mid-run      exit 1   (orange, same throw: 2)
```

### Runs (all AGENT-RUN, exit code checked, never string-matched)

```
node poc/demo.mjs        RESULT: 22/22   exit 0
node poc/m6-check.mjs    RESULT: 28/28   exit 0
node poc/m1-check.mjs 20/20 · m2 10/10 · m3 23/23 · m4 33/33 · m5 48/48   all exit 0
spec/carrier-attestation.yaml parses; Predicate enum still the 3 wired types
```

**Two smaller items closed.** The closed-field-set control passed
`{ operator: {}, skipRequestFields: true }` to `operator.handle`, which reads
FLAT controls — `operator: {}` was dead copy-paste residue from `roundTrip`'s
nested shape, in the one file readers study line by line. And the RP nonce store
only ever GROWS (a request that never receives a response leaves its entry
resident forever); recorded as an honest limit at the store, in the demo's own
notes, and in `poc/README.md`. **Not built** — exercising a TTL would mean faking
elapsed time, and a stated limit beats an untested one.

**Six deviations from the frozen M6 spec, all now recorded, none left silent.**
Four were ALREADY in the decisions log and were not duplicated: the
parse-then-scan ordering of the duplicate-key scan, `findings.md`'s own
creation, the menu covering only ordered thresholds, and M3's reason length
staying unclamped. The 20 → 22 assertion delta was recorded outside §9 and its
entry now carries the count its siblings all carry. The dependency-injection
seams were **unrecorded anywhere** and got a new entry — with the honest note
that guard-disabling is a SEPARATE, deliberately published `controls` seam
(those really are `if` branches in production functions, and that is the point:
a guard never shown disabled has not been proven load-bearing).

**Why the PoC reads a precise SIM-swap date** is now stated where a reader hits
it (M5 source, CAMARA proposal §2.1, PRD §9) rather than left to be noticed as a
contradiction. The invariant governs the WIRE — the operator legitimately holds
the raw value, and the wire-byte scan is what proves only the bit crosses.
`/check` is unusable here for a MEASURED reason, not a preference: its `maxAge`
is in hours capped at 2400 (≈100 days, measured 2026-08-14), which cannot
express the published menu's `P180D` or `P365D` buckets at all. And
`/retrieve-age-band` — the surface that WOULD fit — is provider-optional and
**was never probed on the Playground: recorded as UNTESTED, not assumed
available and not assumed missing.** Probing it is the obvious next spike.
Documentation only this round: which endpoint M5 calls is unchanged.

---

## 2026-08-17 — M6 built: one-command demo + 27-case check, 18/18 mutants killed, and one defect found by probing the finished file (AGENT-RUN; user validation PENDING)

Every number in this entry is **AGENT-RUN by exit code on this machine**. No
user has run M6, and no network call was made in either backend mode. G1 (PRD
§4.4: `G1 = M1–M4 + M6 all user-validated`) is therefore **NOT met**.

### The spike came first, and it found five things — before a line was written

A throwaway composition spike outside the tree (mock only, zero credentials,
zero network) attacked the ladder's stated toughest assumption for M6: *the
modules compose without weakening any single module's guarantee*. It ran every
negative as a PAIR — guard ON must reject, and the same scenario with that guard
OFF must ACCEPT — so a control that could not accept failed the spike too.
41 cases, exit 0, 13 of its own mutations killed. Five findings shaped the
build:

1. **The repeated-query oracle (the headline, and the only one no module could
   have caught).** Each response is a clean windowed bit; the SEQUENCE is not.
   With a free-choice threshold, **9** signed, nonce-bound, expiring,
   end-to-end-encrypted, fully metered queries binary-searched the subscriber's
   exact swap age — **137 days, recovered exactly**, implied swap date
   `2026-04-02T00:00:00.000Z`. All 9 responses passed the same raw-value scan
   that assertion 1 uses, and all 9 verified. No module is wrong: M3 gates the
   *profile floor*, not the predicate threshold, and profile rule 1 hands the
   threshold to the requester on purpose. → decision #1 (quantised menu) and the
   honest-limit paragraph in CAMARA proposal §3.5.
2. **The hand-rolled request verifier had no duplicate-key defence.** M1's
   scanner was module-private and `verifyAttestation` cannot be reused on a
   request (it demands the closed ANSWER set). The spike signed request bytes
   carrying `floor` TWICE and the operator answered: V8 read `P90D`, a first-wins
   parser reads `P365D` — one signature, two agreements. → decision #2.
3. **`checkFloor` throws on a non-JSON value.** `JSON.stringify` in the
   rejection-message builder throws on a BigInt and runs a caller-supplied
   `toJSON`, so a bare `TypeError` escaped in the rejection path. Recorded by the
   spike as OBSERVED-not-fixed; fixed at the module (M3 22 → 23).
4. **The obvious canonical-predicate mapping is NOT injective.** A mutation
   dropping the threshold from the string left the whole spike GREEN while the
   operator answered `gte P1D` to a `gte P90D` question — both sides derived the
   same lossy string, so M1's "an answer can never answer a different question"
   quietly stopped holding. Separately, `roamingIn in [FR,BE]` rendered
   identically for `['FR','BE']` and the single-element set `['FR,BE']`; M4
   happened to reject the second, which is luck, not a defence.
5. **M3's unclamped, wire-derived reasons can exceed M2's envelope capacity,
   where `seal()` THROWS** — an unclamped refusal crashes the operator instead of
   refusing. Measured honestly at the spike: the worst reason a single 446-byte
   request envelope can actually provoke still FITS, so the clamp is insurance
   rather than a live bug — but that margin is a coincidence of two
   independently chosen constants (M2's cap and M3's reason prefix), not a
   property either module guarantees.

### And then a sixth finding, from probing the finished file

The build was written, green at 20/20 and 25/25, and mutation-clean at 16/16
before this was found — which is the point of recording it. An adversarial probe
sent hostile shapes at the operator's wire path directly (rather than through the
RP, which an attacker would not use) and turned up a **silent widening at the one
layer nobody had closed.**

Every layer underneath was already a closed set, each for the same stated reason:
M1's claims, M3's floor axes, M4's predicate fields. The outermost envelope — the
request object itself — was not, because no module owns it. Reproduced:

```
request : {"number":"+990100000099","predicate":{…},"floors":{"swapAgeMin":"P365D"},"nonce":"typo-1"}
verdict : answer
claims  : {"predicate":"simSwapAge gte \"P90D\"","result":true,…}
enforced: {"simType":"voice+data","tenureMin":"P2Y","swapAgeMin":"P90D"}   <- the OPERATOR floor
demanded: {"swapAgeMin":"P365D"}                                          <- what the requester believed
```

One letter (`floors`), the demanded floor silently dropped, `checkFloor` handed
`undefined`, the operator's own `P90D` applied, and a **signed** answer returned
with no error anywhere — the exact silent-widening-through-a-typo path M3's
closed axis set exists to kill, arriving one level further out where M3 cannot
see it. Fixed by closing the top-level request field set and refusing unknown
fields BY NAME (naming the misspelling is the actionable half; the name is
rendered only while short and printable, so an embedded newline cannot forge a
line in whatever log the reason reaches). Demo 20 → 22 assertions, check 25 → 27
cases, mutants 16 → 18.

Also probed and CLEAN in the same pass, recorded so they are not re-tried: ten
hostile predicate shapes off the wire (`null`, missing, array, string, number,
object `type`, object `value`, `['FR',null]`, `[]`, boolean) — none threw, none
was answered, every reason inside the clamp; a JSON-parsed `__proto__` key does
not pollute `Object.prototype`; a `floor` that is an array is `malformed floor`;
a numeric `nonce` is `missing nonce`. The RP's `buildRequest` DOES throw on a
malformed predicate — that is its own caller's input, so throwing is the M2/M3
rule working as written, and it means a requester's malformed question fails at
its own desk instead of burning a metered query.

**The general lesson, which is why this is in the log rather than only in the
diff: a closed-set discipline is only as good as its outermost layer, and the
composition owns a layer none of the modules do.** M6's POC gate was aimed at
exactly this failure class and the spike still looked one level too low.

### The build

`poc/demo.mjs` (873 lines, 282 comment / 509 code) and `poc/m6-check.mjs`
(27 cases). The spike was read as the composition reference and **rewritten, not
shipped** (AGENT_RULES: never ship the POC). M6 owns exactly four things no
module owns — the transport frame `{iss, payload, sig}`, the injective canonical
predicate string, the single-use nonce store, and the reason clamp — and each is
pinned by a case and killed by a mutation.

Two properties the spike did not have, added during the build:

- **Refusals past authentication are SIGNED and nonce-bound**, so the blind hub
  cannot forge a denial-of-service by inventing rejections. Before
  authentication they are deliberately UNSIGNED and the requester must treat
  them as hearsay: an operator cannot sign a refusal to a party it cannot name.
- **The off-menu refusal and the floor rejection both run BEFORE any fact is
  read.** A computed-then-discarded answer is still an oracle query.

### Runs (all AGENT-RUN, exit code checked, never string-matched)

```
node poc/demo.mjs        RESULT: 22/22   exit 0   (~5.4s; RSA-4096 keygen dominates)
node poc/m6-check.mjs    RESULT: 27/27   exit 0   (~15s)
node poc/demo.mjs --backend orange   (no credential)   exit 2 + prerequisites
node poc/demo.mjs --oops / --backend sqlite            exit 2 + usage
node poc/m1-check.mjs 20/20 · m2 10/10 · m3 23/23 · m4 33/33 · m5 48/48   all exit 0
```

`m5-check-live.mjs` was NOT run — it needs a credential and the network, and
this round made no live calls at all.

### Mutation sweep — 23 mutants, 23 killed, 0 survivors

Working-copy `cp` backups, never `git checkout` (which would have reverted
tracked files to HEAD and silently wiped the uncommitted fix under test).

M6 (18/18, each red on `m6-check.mjs`): dup-key scan off · menu check off ·
floor gate off · request auth off · directory accepts any `iss` · nonce store
off · nonce never consumed · `iss` hint picks the key · canonical string drops
the threshold · canonical string joins arrays with `,` · reason clamp off ·
`getFacts` throw uncaught · unanswerable predicate not refused · refusal
signature unchecked · needles lose `swapAgeMs` · refusals sent unsigned ·
closed request field set off · field name echoed raw.

M1/M3 (5/5): M3 renders with `JSON.stringify` again · M3 `[unrenderable]` guard
removed · M1 scanner blind · M1 compares raw instead of decoded keys · M1
`export` removed (a loud `SyntaxError`, no green tally — which is the correct
failure for a missing export).

### The check is offline in BOTH backend modes, and the seam claim is byte-exact

`--backend orange` runs M5 through an INJECTED transport replaying captured
Playground shapes, the same technique `m5-check.mjs` uses. With the key set and
the nonce held fixed, the two backends produce a **byte-identical signed frame**
— signature included, since Ed25519 is deterministic:

```
{"predicate":"simSwapAge gte \"P90D\"","result":true,"nonce":"a1b2c3…","exp":1786924860000}
```

That is the strongest form FR5's "only the facts source swaps" claim can take
offline. It does not and cannot prove the Playground still answers today — that
is the live `--backend orange` run, and it is the user's.

### One deliberate deviation from the frozen build order

The specified operator pipeline put the duplicate-key scan inside the
signature-verification step, before the parse. It runs **after** the parse
instead, because M1's exported scanner carries a stated precondition — the text
must already have parsed as JSON, or the key slice it takes can itself throw on
malformed bytes. That is M1's own internal order (signature → parse → scan) and
matching it was preferred to hardening a user-validated module further. The
guarantee is unchanged: nothing from the request is acted on until both the
signature and the scan have passed.

### What is NOT claimed

- No user run. No live Orange call. G1 not met.
- Quantisation CAPS the oracle at ≈2 bits; it does not close it, and the
  proposal says so in those words.
- `poc/demo.mjs` is over §4.3's "a few hundred lines" bound if the whole file is
  counted (873 total, 509 code, roughly half of that the reader-facing
  narrative). Recorded rather than trimmed.

---

## 2026-08-17 — G2 RE-CLOSED at the final v0.3.0 state: user re-ran M5 clean at `8e842c3` (48/48 offline + 11/11 live)

**This closes the post-gate review round's "user re-run pending"** — the last
pending marker the tree was carrying, and the entry immediately below is the
round that opened it. That round's fixes touched all three M5 files, so the
`4ac60e9` run recorded further down no longer covered the code. The gap is
closed by a run, not by assuming it carried over.

The user personally ran M5 on their own machine on the working tree that
became commit `8e842c3` — the v0.3.0 release state, every review-round fix in,
the code shipping unchanged from there — and reported both suites clean:
`node poc/m5-check.mjs` **48/48** and the live
`ORANGE_BASIC_AUTH=… node poc/m5-check-live.mjs` **11/11**.

**M5 is therefore user-validated LIVE at the shipped state, and G2 (PRD §4.4:
`G2 = M5 user-validated live`) is MET with no asterisk and nothing pending.**

### The full user-run record for M5, in order

Four user runs exist for this module. They are listed separately rather than
collapsed, because each covers a different tree state and only the last one
covers what ships:

| # | Commit | Offline | Live | What it covers |
|---|---|---|---|---|
| 1 | `2fd62ba` | 44/44 | 10/10 | pre-review state; **undated at the time** — recorded later for completeness |
| 2 | `69b6f2e` | 47/47 | 11/11 | post-adversarial-review; **the first G2 in the project** |
| 3 | `4ac60e9` | 48/48 | 11/11 | post-release-gate; G2 re-established there |
| 4 | `8e842c3` | **48/48** | **11/11** | post-review-round — **the shipped v0.3.0 state** |

Runs 1–3 are history: the same module at earlier tree states, each superseded
by a round of fixes that changed code they had already covered. Run 4 is the
one the release rests on. Nothing about M5 is pending.

### Release-gate corroboration at `8e842c3`

The v0.3.0 release gate re-ran the offline ladder independently at the
committed state. This corroborates the user's run; it does not substitute for
it — the G2 record is run 4 above. The live suite was NOT re-run by the agent
(it costs Playground quota and the user's run was clean).

| Check | Exit | Result |
|---|---|---|
| `node poc/m1-check.mjs` | **0** | 19/19 |
| `node poc/m2-check.mjs` | **0** | 10/10 |
| `node poc/m3-check.mjs` | **0** | 22/22 |
| `node poc/m4-check.mjs` | **0** | 33/33 |
| `node poc/m5-check.mjs` | **0** | 48/48 |
| secret scan of the review-round diff | — | clean; the only matches are the offline suite's declared SYNTHETIC fixture credential and `ORANGE_BASIC_AUTH` env references |

Every count above is by **exit code**, not by reading a printed tally.

### Open items carried into M6 (unchanged by this run)

Nothing about M5 is pending. Two items remain open and are carried honestly
rather than closed by this release: the M3 `describe()`-throw class, and the
spec-sketch predicate types that are not wired to the PoC (M6 wires or trims
them).

## 2026-08-17 — Post-gate code review round: two adapter redaction-order defects reproduced red and fixed green; G2 re-opened, then re-closed by the user run above

An 8-angle review of the M5 branch diff found and fixed five code defects.
The two adapter defects were **reproduced against the unfixed tree first**
(a scripted repro with an injected transport, exit 1 pre-fix / exit 0
post-fix; the offline suite stayed 48/48 exit 0 throughout):

1. **`joinStored()` clamped before redacting.** A 78-char known secret planted
   in a stored `countryName` echo produced a `write verification FAILED`
   message carrying the secret's first 48 chars verbatim and no `[REDACTED]`
   (observed: `fragment leaked=true, [REDACTED] present=false`). The exact
   clamp-before-redact fragment leak the `show()` comment documents, one step
   upstream of it — structurally invisible to the suite because the fixture
   secret is 44 chars (< BRIEF_MAX 48) and planted in the sim axis, which
   never passes through `joinStored`. Fixed by redacting each string element
   before the clamp; post-fix the same repro prints `[REDACTED]`, no fragment.
2. **`tokenFor()`'s `await res.text()` sat outside the try that redacts.** A
   token stream dying mid-body rejected there and the planted secret printed
   raw (observed: `secret leaked=true`); the identical /security Low was fixed
   in `post()`'s send only. Post-fix: `token response read failed (camara):
   … [REDACTED]`.

Three live-check faults were fixed by inspection (verified by verifier agents
against the code paths, not run live): the raw admin token bootstrap cached
`access_token: undefined` off a 401 JSON body and `undefined === null` never
refetches — every later call sent `Bearer undefined` and case 11 blamed QUOTA
for an AUTH fault (a non-JSON body additionally threw a raw SyntaxError
quoting the wire body); the courtesy re-script between case 11 and
`conclude(11)` was unguarded, so a transient failure there killed an all-green
run before the tally printed; and case 11's `endSlots < QUOTA_CAP` conjunct
made an at-cap account red under a name blaming a cleanup that succeeded
(now a separate warning).

One further adapter defect, from a review candidate adjudicated AFTER the round
above rather than during it, was fixed the same way:

- **`assertNow()` admitted a safe integer past `Date`'s range.** `9e15` cleared
  the safe-integer and `swappedAtMs < 0` checks, then
  `new Date(swappedAtMs).toISOString()` threw a bare `RangeError: Invalid time
  value` at the caller — the same "opaque error replaces the loud one" class as
  the `joinStored`/`show` fixes above. Bounded at `MAX_EPOCH_MS`
  (8640000000000000), which covers both `setBackstory` and `getFacts` from the
  one check. Mutation-proven: repro exit 1 with the bound reverted (bare
  `RangeError`), exit 0 with it restored (`invalid now: 9000000000000000
  (beyond Date's representable range …)`); no suite case added, 48/48 exit 0
  unchanged.

**Consequence: all three M5 files changed, so the `4ac60e9` user run no longer
covered the tree — G2 was re-opened, counts unchanged (48/48 + 11/11
expected), user re-run of the two-line runbook pending. The user re-ran it the
same day and reported both clean, which re-closed G2 at `8e842c3` — see the
entry above.** Docs-honesty fixes in the same
round: the CHANGELOG headline attributed "the first G2" to the `4ac60e9` run
(the run table below says `69b6f2e`); the root README still said "four modules"
with M5 absent at v0.3.0; case 48's comment said "three legs" while the case
asserts four.

## 2026-08-16 — G2 RE-ESTABLISHED: user re-ran M5 clean at `4ac60e9` (48/48 + 11/11 live)

> **SUPERSEDED as a statement about what ships, 2026-08-17.** The run below is
> confirmed and stands as the record of that tree state. What it no longer is,
> is the *final* state: the 2026-08-17 post-gate review round changed all three
> M5 files after it, so `4ac60e9` became run 3 of 4 and G2 was re-opened and
> then re-closed by the user's run at `8e842c3`. Read "final release state" in
> this entry as "final state as of 2026-08-16". Nothing else here changed.

**This closed the release-gate round's "M5 user re-run pending"** — the last
pending marker the tree was carrying that day. The entry below records G2 being met at
`69b6f2e` and then deliberately re-opened, because the gate's fixes landed
after that run and touched all three M5 files. That gap is now closed by a
run, not by assuming it carried over.

The user personally ran M5 on their own machine at commit `4ac60e9` — the
final release state, with every gate fix in — and reported both suites clean:
`node poc/m5-check.mjs` **48/48** and the live
`ORANGE_BASIC_AUTH=… node poc/m5-check-live.mjs` **11/11**.

**M5 is therefore user-validated LIVE at the final state, and G2 (PRD §4.4:
`G2 = M5 user-validated live`) is MET with no asterisk and nothing pending.**

### The full user-run record for M5, in order

Three user runs existed for this module as of this entry. They are listed
separately rather than collapsed, because each covers a different tree state:

| # | Commit | Offline | Live | What it covers |
|---|---|---|---|---|
| 1 | `2fd62ba` | 44/44 | 10/10 | pre-review state; **undated at the time** — noted here rather than left as an undated memory |
| 2 | `69b6f2e` | 47/47 | 11/11 | post-adversarial-review; **the first G2 in the project** |
| 3 | `4ac60e9` | **48/48** | **11/11** | post-release-gate — the final state *as of 2026-08-16* |

Run 1 was never given a dated record when it happened; it is recorded now for
completeness. It is the same module two review rounds earlier, so it is
history, not a second validation of the current tree. Run 3 was the one the
release rested on when this was written; a fourth run at `8e842c3` supersedes
it (2026-08-17 entry above).

### Release-gate corroboration at `4ac60e9`

The v0.3.0 release gate re-verified the same commit independently. This
corroborates the user's run; it does not substitute for it — the G2 record is
run 3 above.

| Check | Exit | Result |
|---|---|---|
| `node poc/m1-check.mjs` | **0** | 19/19 |
| `node poc/m2-check.mjs` | **0** | 10/10 |
| `node poc/m3-check.mjs` | **0** | 22/22 |
| `node poc/m4-check.mjs` | **0** | 33/33 |
| `node poc/m5-check.mjs` | **0** | 48/48 |
| `node poc/m5-check-live.mjs` (LIVE) | **0** | 11/11, quota restored 1 → 1 of 10 |
| `spec/carrier-attestation.yaml` parses | **0** | OpenAPI 3.0.3, 1 path |
| secret scan of `origin/main...HEAD` | — | clean; the one match is the suite's declared SYNTHETIC fixture credential, commented as such |

Every count above is by **exit code**, not by reading a printed tally. The
first live invocation lost its exit code to a shell mistake (`PIPESTATUS` read
in a later command), so it was re-run capturing the status directly rather
than trusting the `RESULT: 11/11` line — a printed tally is not a pass.

### Open items carried into M6 (unchanged by this run)

Nothing about M5 is pending. Two items remain open and are carried honestly
rather than closed by this release: the M3 `describe()`-throw class, and the
spec-sketch predicate types that are not wired to the PoC (M6 wires or trims
them).

## 2026-08-16 — G2 MET (user ran M5 live), then the v0.3.0 release gate found five more (47 → 48 offline)

Two things happened in this order, and the order is the point: **the user
validated M5 live and closed gate G2**, and then the release gate for v0.3.0
found five issues in the tree that had just been validated. Both are recorded,
because collapsing them would let the G2 record appear to cover code it never
saw.

### 1. G2 is met — the first G2 validation in the project

The user personally ran M5 on their own machine at commit `69b6f2e` and
reported both suites clean: `node poc/m5-check.mjs` **47/47** and the live
`ORANGE_BASIC_AUTH=… node poc/m5-check-live.mjs` **11/11**.

Gate mapping (PRD §4.4) is `G2 = M5 user-validated live`, so **G2 is MET**.
This is the first time a live-operator module in this repo has been validated
by anyone other than an agent.

For completeness, the user had ALSO run the pre-review state clean at `2fd62ba`
— **44/44 offline and 10/10 live** — a run that never got a dated record at the
time. It is noted here rather than left as an undated memory; it is the same
module one review round earlier, not a second validation of the current tree.

The release gate re-ran the live check twice more at `69b6f2e` and got **11/11,
exit 0** both times, with a leak self-check confirming the credential appeared
in no output line. That corroborates the user's run; it does not substitute for
it.

### 2. The gate then found five issues — two of them real code defects

`/security` returned **0 Critical, 0 High, 0 Medium** (three Lows, below).
`/diff-review` returned no Critical but did NOT return clean: verdict "with
fixes". Every finding below was reproduced against the unfixed tree before
anything was touched.

**(1) The stored country list was COERCED while being joined — the module's
loudest guard replaced by an opaque error.** `Array.prototype.join` calls
`String()` on every element, so a JSON-parsed `{"toString":"x"}` inside the
Admin READ's `countryName` threw a bare `TypeError: Cannot convert object to
primitive value` — and it threw from the line that BUILDS the write-verify
comparison, i.e. before the loud message could run at all. Measured on the
unfixed module:

| Stored `countryName` | Result |
|---|---|
| `[{"toString":"x"}]` | `TypeError`, **40 chars**, no "write verification FAILED" |
| `["Spain"]` (benign control) | correct loud message, **418 chars** |

This is a direct sibling of the defect the previous review round closed 30 lines
below, in the RENDER of the same diagnostic — the render was guarded, the line
feeding it was not. Fixed with `joinStored()`: strings are taken verbatim and
clamped (never `brief()`-rendered, because `brief()` adds JSON quotes and
`"FR"` must still compare equal to `FR`), anything else renders as its KIND and
can therefore never equal a canonical country, and `length` is read ONCE into a
bound of 16 — the time-of-check/time-of-use lesson M4 paid for at v0.2.0.
Pinned by new **case 48**, whose four legs are deliberately joint: hostile
element still fails LOUD and renders `[object]`, benign element still names
`Spain`, a legitimate `["FR"]` still MATCHES (a guard that broke this would be
worse than the bug), and 5000 elements stay bounded.

**(2) The live quota assertion went RED on a clean account, and blamed the wrong
case.** Case 11 asserts `endSlots === startSlots`, but the baseline was taken
before the CUSTOM demo slot existed. On a FRESH account the adapter's
CREATE-if-missing path creates it during case 2 — a legitimate, deliberate,
permanent consumption (the run leaves it scripted on purpose) — so the run ended
one slot up and reported that the trap case had failed to give its slot back.
**Reproduced live**, not argued: the custom slot was deleted to create the
fresh-account condition, and the unfixed check ran `start=0 end=1`, **exit 1,
10/11**, with `cleanup DELETE status=204` printed alongside — the cleanup had in
fact succeeded. Fixed by making the baseline deterministic rather than loosening
the assertion: the CUSTOM slot is brought into existence BEFORE the baseline is
taken, so `===` still holds on a fresh account and a re-run alike, and a genuine
built-in leak still fails. Re-run on the identical freshly-emptied account:
**11/11, exit 0**, printing `(CREATED +990100000099: first run on this app)`.

**(3) The CAMARA proposal's catalog table showed a shape M1 REJECTS, under a
sentence claiming the PoC produced it.** §3.3.1 rendered profile-mode responses
as a flat `{"predicate":…,"result":true,"nonce":"…","exp":"…","sig":"…"}` and
then asserted "the shapes in it are the ones the PoC actually produces, not
sketches". Both halves fail against this repo: M1's claim set is CLOSED to
`{predicate, result, nonce, exp}`, so a `sig` inside `claims` returns
`unexpected fields: sig`, and `spec/carrier-attestation.yaml` requires
`[claims, sig]` as siblings with `exp` an **integer** (Unix ms), not a quoted
string. This is the most consequential finding of the round despite being
docs-only: it is the submission document, and a working-group reviewer
falsifies it with one grep. Rows corrected to the real envelope; the overclaim
replaced with what is actually true (the PoC produces the ENVELOPE; the
predicate spellings are illustrative and the PoC answers three axes, not nine),
with the retraction left visible.

**(4) Two table rows were outside the verified baseline.** The §11 baseline
covers SimSwap v2.1.0, NumberVerification v2.1.0 and KYC r2.2 — not
`device-roaming-status` or `device-reachability-status`, whose shapes came from
the Orange Playground sandbox, not a CAMARA spec surface. Marked `†` with the
provenance stated, since grounding discipline requires the source, not just the
shape.

**(5) The mutant count contradicted itself.** The previous entry's intro called
the sweep "18-mutant" while its own table row 2 recorded **15/16 killed, 1
survived**. The 18 is the POST-fix total (16 plus 2 minted against the new
guards); applying it to the pre-fix sweep made the entry disagree with itself.
Corrected in both this log and PRD §4.4.

**The three `/security` Lows** were all confirmed and all fixed, since each was
trivial and local: `await res.text()` sat OUTSIDE the try that redacts (a stream
dying mid-response rejects there, so its message escaped unredacted); the
client-id pattern's bound of `\S{0,80}` was tighter than the thing it masks, so
an over-long identifier would have had its first 80 characters redacted and the
REMAINDER printed — worse than not matching — now 256, re-checked at 1ms on a
200k-char pathological input to keep the ReDoS property; and operator-side
timestamps in diagnostics were judged NOT a breach and deliberately left (they
are operator-side by construction, never wire-reachable).

### Proofs

Both code fixes are mutation-proven, restores byte-identical by sha256, using
working-copy `cp` backups rather than `git checkout` — the fixes were
uncommitted, and a checkout would have wiped the thing under test.

| Mutation | Suite | Exit | Verdict |
|---|---|---|---|
| revert `joinStored` → raw `.join(',')` | offline | **1** (47/48, case 48 only) | killed |
| restore | offline | **0** (48/48) | green |
| revert quota baseline, fresh account | **live** | **1** (10/11, `start=0 end=1`) | killed |
| restore, same fresh account | **live** | **0** (11/11) | green |

Three guards from the PREVIOUS round were also independently re-proven at this
gate, in an isolated copy so the repo tree was never touched: stripping
`redact()` from the write-verify diagnostic, sharing one token across surfaces,
and clamp-after-serialize each turned the suite red (exit 1) and each restore
went green. Separately, a 110-run flake sweep across all five offline suites
returned **0 non-zero exits**, and the credential was confirmed absent from the
working tree and from all 35 commits of history by literal-value match.

**Honesty marker: the CURRENT counts (48 offline, 11 live) are AGENT-RUN.** G2
was met at `69b6f2e`; these fixes landed after that run and touched
`m5-facts-orange.mjs`, `m5-check.mjs` and `m5-check-live.mjs`. A user re-run is
pending and re-establishes G2 at the final state — the same pattern M4 followed
at v0.2.0, where the release gate's fixes landed after the user's run and the
gap was closed by a re-run rather than by assuming it carried over.

## 2026-08-16 — M5 adversarial review round: 3 confirmed issues (44 → 47 offline, 10 → 11 live)

A second agent re-attacked M5 against the challenge "what did you gloss over?
what did you not validate but asserted or fit to pass?". Method, in this order:
an INDEPENDENT 30-case check written from the PRD, M4's interface contract and
the module source alone **before either shipped suite was opened**; then an
independent **16**-mutant sweep; then a leak fuzz; then the live legs. Every
verdict below is from something that RAN.

| # | Audit item | Verdict |
|---|---|---|
| 1 | Fit-to-pass probe (independent check, written blind) | **CONFIRMED ISSUE** — 27/30, three failures, all on ONE line |
| 2 | Independent mutation sweep (≥12, incl. 8 named) | **CONFIRMED ISSUE** — 15/16 killed, 1 required mutant SURVIVED |
| 3 | Redaction / leak audit | **CONFIRMED ISSUE** (same line as 1); otherwise clean — 315 combinations, 0 leaks |
| 4 | Live-case can-fail audit | **CLEAN** — all 10 can genuinely fail; no sibling of the build round's vacuous case |
| 5 | Quota / crash hygiene | **CONFIRMED ISSUE** — cleanup unobserved; fixed + new case 11 |
| 6 | Cross-module regression + fixture honesty | **CLEAN** — M1–M4 unchanged by exit code; every fixture traces to a capture |
| 7 | Live confirmation | **DONE** — 11/11, exit 0, quota restored 1 → 1 of 10 |

**Issue 1 — the write-verification diagnostic was the one throw path that
skipped `redact()`, and it clamped AFTER serializing.** Three distinct defects
on one line (`write verification FAILED … stored ${axis} is
${JSON.stringify(String(got[axis])).slice(0, 60)}`), and it is not an obscure
line: it is the message the module's most load-bearing guard produces, the one a
demo run is most likely to print.

- **It bypassed `redact()`.** `got[axis]` comes off the WIRE. Measured: a
  credential half, and an issued bearer token, each planted in an Admin `READ`
  body, rode verbatim into the thrown message. Every other throw in the file
  redacts; this one did not — so module rule 3 ("the credential, every token and
  the client id never reach a string this module can print or throw") was false
  on exactly one path. The offline suite's cases 5–8 all probe `getFacts` error
  paths and none covered this one.
- **It clamped after serializing.** `JSON.stringify(String(v)).slice(0, 60)`
  builds the whole serialization and only then bounds it: measured **2354ms on a
  2e8-char stored value vs 0ms** for the `brief()` ordering, and at V8's max
  string length (536870888) `JSON.stringify` throws `RangeError: Invalid string
  length` — which **destroys the loud, actionable trap message** at exactly the
  moment it is needed. This is the same lesson the offline suite's own case 43
  already states ("clamped BEFORE it is rendered, not after — bounding the OUTPUT
  still serializes the whole input first"); the suite stated the principle and
  never applied it to the one line that broke it.
- **Fixed** by composing the two helpers the file already had, in an order that
  matters: `const show = (v) => (typeof v === 'string' ? brief(redact(v)) :
  brief(v))`. A STRING is redacted FIRST because the known-secret layer is an
  EXACT match — clamping first would leave a 48-char FRAGMENT of a 110-char
  credential unmatched and printed — and `redact()` returns ≤200 chars, which
  `brief()` can then serialize safely. A NON-string goes to `brief()` directly:
  no secret can hide in one, and `redact()`'s `String(v)` coercion would run a
  wire-supplied `toString` (`JSON.parse('{"toString":"x"}')` makes `String(v)`
  throw a bare TypeError — the same "opaque error replaces the loud one" failure
  by another route). Pinned by new cases **45** and **46**.
- **The residual, measured rather than waved away.** `redact()` still makes its
  exact-match passes over the full string before clamping, which cannot be
  reordered without reintroducing the fragment leak above. On a 5e7-char stored
  value that is **318ms for five passes, against 1611ms** for the `JSON.parse`
  of the same body that the module has ALREADY paid before this line is reached
  — 0.20× work already done, not a new unbounded surface, and identical to the
  exposure every other error path in the file already carries. Recorded as a
  known residual rather than traded for a fragment leak.
- **Case 46 asserts the rendered SHAPE, not elapsed time**, and that choice was
  vindicated during the round: the independent probe's own 1000ms timing bound
  flaked at 1176ms under concurrent load while the message stayed correctly
  bounded at 443 chars. A clamp-BEFORE render always emits a closed,
  ellipsis-terminated string (`…"`); a clamp-AFTER regression emits one sliced
  off mid-value with no closing quote. Deterministic, and it kills the mutant
  without racing the CPU.

**Issue 2 — "one token per surface" was unpinned; the mutant survived.** The
module is correct, but a mutant caching one token ACROSS both surfaces left the
44-case suite fully green. The cause was in the CHECK: its replay transport
answered BOTH token endpoints with the same fixture, so a shared cache and a
per-surface cache were indistinguishable. This is a load-bearing invariant — the
two endpoints are measured NOT interchangeable (CAMARA token on Admin → `401
UNAUTHENTICATED`; Admin token on sim-swap → `403 "Request must be authorized"`)
— so a regression would surface as an auth fault far from its cause. Fixed by
giving the Admin endpoint its own fixture token and adding case **47**, which
drives both surfaces from ONE adapter instance and asserts each call carried its
own surface's bearer.

**Issue 5 — the live check's cleanup was unobserved, so quota leaked silently.**
Case 1 CONSUMES one of the app's 10 custom slots (the adapter CREATEs the
built-in before it can discover the write is shadowed) and gave it back with a
DELETE whose **result was discarded**. A run interrupted between those two
points left the slot consumed with nothing on screen saying so; repeated
interrupted runs would walk the quota to its cap and the eventual failure would
name a phone number, not a quota. Fixed three cheap ways, all observable in the
output: the slot is **reclaimed BEFORE it is consumed** (measured: `DELETE` of a
slot not held answers `400 "PhoneNumber Not Found"` = nothing to reclaim, while
`204` means an earlier run really did leak), the count is **printed at both
ends** against the cap, and new case **11** asserts it came back. The count is
the assertion because it is the authoritative observable; the DELETE status is
reported alongside and required only to be a success, not to be exactly `204`.

**What the review round could NOT fault:**

- **The 10 live cases can all genuinely fail.** Each was traced to the
  observable that would flip it. The build round's own catch (a case that
  coerced an `undefined` token to the string `'undefined'`) has no surviving
  sibling. Case 11 was held to the same bar and PROVED able to produce the
  negative rather than assumed: a live probe confirmed the `LIST` count actually
  MOVES (1 → 2 → 1 across a CREATE/DELETE pair, net-zero quota) — without that,
  `endSlots === startSlots` would have been a tautology.
- **Redaction is otherwise airtight.** A fuzz across every throw path × every
  known secret (supplied credential, normalized, decoded pair, each half, each
  issued token) × five embeddings (raw, JSON, URL-encoded, quoted, header-ish)
  ran **315 throwing combinations with 0 leaks**. Its first run reported 62
  leaks — every one a HARNESS artifact: it demanded redaction of a token the
  adapter had never been issued, which is impossible by construction (a token
  enters the known set at mint time). Debugged rather than believed, per the
  standing rule about degenerate numbers. The probe carries a PLANTED-LEAK
  control (47 hits) so a clean result cannot mean a blind probe, and re-run
  against the PRE-fix line it goes red with exactly 10 leaks, all on
  `write-verify mismatch`.
- **Fixture honesty holds.** Every offline fixture traces to a shape recorded in
  the spike entry above — including `countryCode:34`/`["Spain"]` on the built-in
  and `208`/`["FR"]` on a scripted record, which the findings record in prose
  rather than raw JSON. Nothing was edited to fit the code. One over-readable
  claim was tightened rather than left: the `stored()` helper is CONSTRUCTED,
  not captured (its seven-key shape is measured and the three axes M5 reads
  carry captured values, but the filler in the four axes M5 never touches is
  arbitrary), and now says so, so the file header's "captured verbatim" is not
  over-read to cover it.
- **M1–M4 are untouched**, verified by exit code: 19/19, 10/10, 22/22, 33/33.

**Counts after the round: offline 47/47, live 11/11, 18/18 mutants killed, 0
survivors** — 16 in the sweep above plus 2 minted against the guards this round
introduced. (The intro to this entry originally called the sweep itself
"18-mutant", applying the post-fix total to the pre-fix sweep and contradicting
the 15/16 in row 2 of the table. Corrected at the v0.3.0 release gate, which is
where a reader spotted the two numbers disagreeing — recorded rather than
quietly overwritten.) The sweep's own harness gained a per-run timeout after the
unbounded-401 mutant SPUN and wedged the first attempt — a hang must be scored
as a kill, not left pegging a core. Restores were working-copy `cp` with a
sha256 byte-identity assertion, never `git checkout`; one mid-sweep interruption
did leave the module mutated and was caught and restored by that check.

**Honesty marker, unchanged by this round: every M5 count is AGENT-RUN.** That
was true of 44/10 before the review and is true of 47/11 after it. M5 has never
been run by the user, so **G2 is still not met** — the round hardened the module
and grew its evidence, it did not close the gate.

## 2026-08-16 — M5 live spike: the recorded Playground findings re-verified, three CHANGED

A throwaway spike (6 rounds, scratchpad only) re-ran every recorded Playground
finding against the live API before any M5 code was written, because the
findings were measured on **2026-08-14/15** and a sandbox can move. Raw
responses were captured (secrets redacted at capture time) and are the fixtures
`poc/m5-check.mjs` replays. Verdict per finding:

| Recorded finding (2026-08-14/15) | 2026-08-16 verdict |
|---|---|
| CAMARA token endpoint → `{access_token, expires_in:3600}` | **HOLDS** |
| Two NON-interchangeable token endpoints | **HOLDS** — CAMARA token on Admin = `401 UNAUTHENTICATED` |
| sim-swap `/retrieve-date` → `{latestSimChange}` | **HOLDS** |
| Admin actions `LIST/CREATE/READ/UPDATE/DELETE` | **HOLDS** |
| `DELETE` → `204`, empty `text/html` body | **HOLDS** |
| Custom slot `+990100000099` honours writes | **HOLDS** |
| Quota: 10 custom numbers | **HOLDS** |
| **THE TRAP: built-ins `200/201`-echo writes while ignoring them** | **HOLDS — mechanism refined** (below) |
| **`403 FORBIDDEN` on sim-swap means UNKNOWN NUMBER** | **CHANGED — narrowed** (below) |
| **"That single [sim-swap] call satisfies the whole facts interface"** | **CHANGED — obsolete** (below) |
| `/check` `maxAge` in HOURS, cap 2400 | **NOT RE-TESTED** — the adapter does not use `/check`; recorded as untested rather than assumed |

**1. THE TRAP HOLDS, and the mechanism is sharper than recorded.** The original
finding said a built-in answers `CREATE`/`UPDATE` with `200`/`201` echoing your
payload. Measured today, it splits in two:

- a bare `UPDATE` on a built-in the app has never claimed answers **`400
  BAD_REQUEST "PhoneNumber Not Found"`** — i.e. it now fails LOUD, which the
  recorded finding did not describe; but
- the adapter's own path is CREATE-then-UPDATE, and *that* reproduces the trap
  exactly. Replayed on `+990100000002`: `CREATE` → `201` echoing a **fabricated
  default template**; `UPDATE {"simSwap":{"latestSimChange":"2001-02-03…"}}` →
  **`200` echoing that very date back**; the next `READ` → the built-in's own
  dataset (`2020-03-15T10:00:00.000Z`, `kyc.name "Bernard Blanc"`,
  `countryName:["Spain"]`); sim-swap → `2020-03-15T10:00:00.000Z`, unchanged.
  **Echo carried the write: true. READ carried it: false.** The negative
  control — the identical sequence on the custom slot — had echo, READ and
  sim-swap all agree. So READ-after-write is load-bearing, and the test that
  says so can fail.

**2. `403 FORBIDDEN` no longer means unknown number on its own.** It is the
MESSAGE that discriminates, and two different faults share the status:
`{"code":"FORBIDDEN","message":"+990100000077 does not exist for <client_id>"}`
is an unknown number, while a request carrying the **wrong surface's token**
answers `{"code":"FORBIDDEN","message":"Request must be authorized"}`.
Collapsing the two puts you back in the failure the original finding exists to
prevent — debugging a backstory when the fault is the token — one layer in.
M5 therefore classifies on the message, and the offline suite pins both
directions (a mutation making *every* 403 an unknown number, and one making
*no* 403 an unknown number, are each killed by their own case).

**3. Sim-swap is no longer the whole interface — all three axes are WIRED.**
The recorded claim that one sim-swap call satisfies the facts interface is
obsolete: the app's own token scopes include `device-roaming-status:read` and
`device-reachability-status:read`, and both endpoints answer live at
`.../api/device-roaming-status/v1/retrieve` and
`.../api/device-reachability-status/v1/retrieve`. **Nothing in M5 is faked or
stubbed and no axis is unavailable on this app.** Note the two request shapes:
sim-swap takes a bare `phoneNumber`, the two device-status APIs take a `device`
wrapper — sending the bare form answers `400 INVALID_ARGUMENT "phoneNumber is
not allowed"`, which is how a real-but-differently-shaped endpoint was told
apart from a non-existent one (`400 BAD_REQUEST "unhandled path"`).

**NEW findings the spike produced:**

- **The credential is already scheme-prefixed.** Line 1 of the stored entry —
  the exact value `poc/README.md`'s runbook line yields — is `Basic <base64>`.
  Sending `Basic ${that}` double-prefixes and BOTH token endpoints reject it
  (`400 invalid_request` / `401 "Basic authentication is malformed"`). This
  cost the spike's first round and is now normalized in the adapter and pinned
  by a case that reads the header actually sent.
- **The Admin data model is much wider than "swap date, roaming, reachability"**
  — `location`, `reachability`, `roaming`, `simSwap`, `deviceSwap`, `tenure`,
  `kyc`. M5 touches three of the seven; the rest are untouched, not unnoticed.
- **The `roaming` axis has THREE distinct states, and they are the reason the
  null-vs-absent distinction is not academic.** Measured: `roaming:false` →
  `{"roaming":false}`; `roaming:true` + a country → `{"roaming":true,
  "countryCode":208,"countryName":["FR"]}`; **`roaming:true` with NO country →
  `{"roaming":true}`.** The third is the fail-open: the subscriber IS roaming
  and the country is UNKNOWN, and folding it into "not roaming" answers "not in
  FR" about someone who may be in France.
- **`countryName` is a NAME list, not a code list.** The Playground's own
  built-in records carry `["Spain"]`; an admin-scripted record accepts `["FR"]`
  because that is what was written. So a country is accepted only when it is a
  single canonical ISO-3166-1 alpha-2 code; `["Spain"]` and multi-country
  `["FR","MC"]` (both producible) leave the axis unavailable.
- **`countryCode` is internally inconsistent and therefore unusable.** The
  built-in Spain record carries `34` (the DIALLING code); an admin-scripted
  French record takes `208` (the MCC). M5 reads neither and writes neither —
  `countryName` alone round-trips, verified live.
- **`roaming:false` WITH a stale country is producible** (`{"roaming":false,
  "countryCode":208,"countryName":["FR"]}`). The `roaming` flag is the
  authoritative half; this is "not roaming", not a country.
- **Reachability is a closed enum**: `CONNECTED_DATA | CONNECTED_SMS |
  NOT_CONNECTED`. Anything else is refused by the Admin API with a `400` naming
  the allowed values, and the rejected write does NOT take effect.
- **An Admin `UPDATE` REPLACES a sub-object rather than merging it** — writing
  `{"reachability":{"reachabilityStatus":…}}` drops the `lastStatusTime` that
  was there. M5 writes all three axes in one call for that reason.
- **`READ` on a built-in the app never claimed** answers `400 "PhoneNumber Not
  Found"`, and a claimed one is SHADOWED: it appears in `LIST` while `READ` and
  the CAMARA reads keep serving the built-in dataset.

Nothing in the spike contradicted the M5 adapter shape, so the build proceeded.
Quota was left exactly as found (1 of 10 custom numbers).

## 2026-08-16 — M5 built: live Orange facts adapter, 44 offline + 10 live cases, 32/32 mutants killed

`poc/m5-facts-orange.mjs` — the same `setBackstory` / `getFacts` interface as
M4's mock with a real operator behind it. **`evaluatePredicate` is not
reimplemented**: M5 exports `createOrangeFacts` and nothing else, and the check
asserts that, because swapping the facts SOURCE must not touch the step where
the profile invariant lives. `setBackstory`/`getFacts` are async here (there is
a network); the clock stays INJECTED, and the relative→absolute conversion M4
only simulates happens at this boundary for real.

**What was measured, not asserted:**

- **Offline suite: 44/44, exit 0, zero credentials, zero network**
  (`node poc/m5-check.mjs`). The transport is injected and replays the spike's
  CAPTURED bytes, so it runs on a clean clone.
- **Live suite: 10/10, exit 0** (`node poc/m5-check-live.mjs`) against the real
  Playground. It proves the FR1 negative live (a 120-day-old SIM answers `true`
  to `simSwapAge ≥ P90D`; the SAME number re-scripted to 1 day answers `false`,
  same code, same predicate), that the write-trap defence fires on a real
  built-in **with the custom-slot control succeeding**, that all three axes
  serve real values, and that an unavailable axis refuses.
- **32 mutations, 32 killed, 0 survivors.** Including the two that matter most:
  removing READ-after-write entirely, and comparing against the ECHO instead of
  the stored state — each turns the suite red on its own case. Backups were
  working-copy `cp`, never `git checkout`.

**Two defects the mutation sweep found in the check itself**, both fixed:

1. **A VACUOUS redaction case.** Case 8 (client id redacted when no client id
   can be derived from a non-base64 credential) used a `403` body — but a body
   containing "does not exist for" routes to the unknown-number branch, whose
   message is built from the NUMBER and never quotes the body. The client id
   could not have leaked however the redactor behaved: the case could not fail.
   Caught because deleting the redactor's pattern layer left the suite green.
   Re-aimed at a `500`, which reaches the branch that does quote the body.
2. **A too-crude assertion.** Case 11 asserted the auth-403 message does not
   contain "unknown number" — but the message legitimately explains that it is
   "not an unknown number". Tightened to the classification itself
   (`/^unknown number:/`), which still catches a branch regression.

**The live redaction case demonstrates its own precondition.** Case 10 fetches
the RAW `403` for the same call and confirms the body genuinely contains the
client id (`true`), THEN asserts the adapter's error does not. Without that
half it would pass against a Playground that had simply stopped echoing it — a
redaction proof with nothing to redact.

**The security pass ran AFTER the build, and found three real defects** (a fix
round is the least-reviewed code there is, and this one was no exception). All
three are the same class M4's release gate found, carried across rather than
re-learned:

1. **Diagnostics invoked caller-supplied conversions.** `assertTestNumber` and
   `assertNow` rendered their argument with `String(value)` / `JSON.stringify(
   String(value))`, which runs a caller's `toString`/`valueOf`. Replaced with a
   `brief()` renderer that invokes nothing caller-supplied and clamps a string
   BEFORE serializing it. **Pre-registered expectation for the guard-off
   control was exit 134** (M4's fatal OOM); **measured exit 1** — `String()` on
   a 3e8-char return allocates fine here, so the case catches the regression
   cleanly instead of the process dying. Recorded as a clean kill, and M4's
   process-fatal claim deliberately NOT carried over: that one came through
   `JSON.stringify`'s JsonStringifier, a different path.
2. **A backstory field carried on the PROTOTYPE was used but never checked.**
   Destructuring reads a prototype-borne `swappedDaysAgo`, while `Object.keys`
   never sees it — so the unknown-field check that catches a typo'd axis passed
   straight over it. M4 measured the mirror image (a prototype-borne axis
   DROPPED and defaults used); either direction is a scripted story that is not
   the story in force. Now refused by an `isPlainData` bound matching M4's.
3. **A live-check assertion could pass with nothing to compare.**
   `msg.includes(tok)` coerces an `undefined` token to the string
   `'undefined'`, so a failed token exchange would have satisfied the redaction
   case. Now gated on the token actually being one.

Fixes took the offline suite 41 → 44 cases and the sweep 29 → 32 mutations,
all killed; the live suite was **re-run after the fix round** (10/10, exit 0)
rather than reusing the pre-fix run. Credential and client id confirmed absent
from the tracked tree AND from all 33 commits of history.

**Honest limits, recorded rather than cleaned up:**

- The live check costs quota: it CREATEs and DELETEs one slot for the trap case.
  Verified restored (`LIST` = 1 of 10) after every run.
- Token caching has NO time-based expiry, deliberately — refresh is driven by
  the server's own `401` (one retry, then loud failure), which keeps this
  module free of any wall-clock read. A revoked-but-unexpired token is handled
  by the same path; a token that expires mid-`getFacts` costs one extra round
  trip, not a failure.
- `/check`'s `maxAge` behaviour was not re-tested (unused by M5), and is
  recorded above as untested rather than carried forward as verified.
- "Unwired axis" could not be demonstrated by an axis being missing — all three
  are wired. It is demonstrated instead by a state the Playground genuinely
  produces and the adapter genuinely cannot answer from (`{"roaming":true}`,
  no country), which is the honest version of the same proof.

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
