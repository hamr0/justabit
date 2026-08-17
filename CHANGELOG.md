# Changelog

## Unreleased (0.4.0 — M6)

- **LIVE FIX: the Admin `location` write shape was wrong, and it said so.** The
  user's first live Playground run of the 3 → 6 tree measured
  `admin UPDATE failed (status 400): {"code":"BAD_REQUEST","status":400,
  "message":"\"data.location.lastLocationTime\" is required"}`. The adapter wrote
  the bare `{latitude, longitude}` pair; the Orange Admin store will not hold a
  position without an observation instant. **This is the assumed-shape design
  working**: the axis was labelled the weakest of three guesses precisely because
  a wrong one had to fail LOUD naming the axis rather than script a position that
  never took effect, and that is what happened on first contact.
  - The instant is `new Date(nowMs).toISOString()` — **off the INJECTED clock,
    never `Date.now()`**, so the same demo writes the same bytes on every run.
  - **It is scripting, not disclosure.** `getFacts` still never reads a
    `lastLocationTime` from anywhere, and all three of its spellings (epoch ms,
    ISO, ISO date) plus the field name joined the demo's wire-byte needle
    inventory (22 → 26 needles, three more planted leaks in m6 case 18), so a
    future line that let it out reds.
  - It is verified by the same read-after-write loop as every other axis, as its
    own axis `geoAt`.
  - **Generalisable, and recorded against `kyc`:** an OBSERVED READ shape does not
    tell you the REQUIRED WRITE field set. The run **aborted at location**, so the
    `kyc: {name}` write shape is **still untested** and stays labelled ASSUMED.
  - Counts moved: **m5 offline 56 → 57**. m6 stays 45 and demo stays 33, but both
    changed, so all three are AGENT-RUN with a **user re-run PENDING**.
- **Part 3: `numberMatch` — the predicate set is now the signed SIX.** The
  requester declares its match threshold off the published menu
  (`60 | 70 | 80 | 90`) and the name it holds; the operator compares internally;
  **only the boolean crosses the wire.** This is the row where the raw value the
  profile protects is the catalog response itself: `kyc-match` returns a
  similarity SCORE, and a score is a gradient rather than a band (a wrong name
  scored 53; the registered name with ONE letter changed scored 97), so an
  unquantised threshold against it is a warmer/colder oracle that hill-climbs to
  the subscriber's real registered name.
  - **`claimed` is the only predicate field that is neither a type nor a
    window** — the attribute value the requester wants compared. Legal only for
    the types that declare it, refused by name elsewhere, and part of the SIGNED
    predicate string (otherwise an answer about "does Bob match?" verifies as an
    answer about "does Alice match?").
  - **Two measured response shapes a naive implementation gets wrong:**
    `nameMatch` is the STRING `"true"`/`"false"` (and `"false"` is truthy, so an
    unguarded read reports a non-match as a match), and an EXACT match carries no
    score at all (so "compare score against threshold" alone answers `false` to
    the strongest possible match).
  - **Recorded, not glossed: the operator learns what the requester claims.**
    Inherent to a comparison, and disclosure in the other direction. Profile mode
    narrows what the OPERATOR discloses; it does not make the requester's query
    private.
  - **A real FLAKE caught and fixed:** a new case scanned the two-character needle
    `97` against RSA ciphertext and an unblanked random nonce — a ~1-in-8 false
    red, the exact short-needle trap this repo already documented. Split by
    artifact class, as the wire scanner already was.
  - **A second unpinned guard of the same shape as part 2's:** the kyc-name
    write-back survived mutation in the same place the location one did.
- **Part 2: `presentIn` — and the third state is the whole point.**
  `location-verification/v1/verify` answers `TRUE`, `FALSE` and `PARTIAL`
  (measured), and `PARTIAL` produces a signed REFUSAL carrying no bit rather than
  a rounded `true`/`false`: a rounded answer is signed and indistinguishable on
  the wire from a real one.
  - **The PARTIAL policy is a published FLOOR AXIS** (`partialPolicy`, one legal
    value `refuse`), so "the operator publishes it and the requester may only
    tighten it" is the existing rule-5 machinery rather than a new mechanism — a
    request asking to have PARTIAL rounded for it dies at the floor gate before
    any fact is read. **This moved a user-validated module: `m3-check` 24 → 25.**
  - **The area is canonicalised by KEY, not by typing order.** `JSON.stringify`
    serialises in insertion order, so two spellings of the same circle would
    otherwise derive two signed predicate strings and one requester would get its
    own correct answer back as a `predicate mismatch`.
  - **`lastLocationTime` is never read** — not filtered on the way out; there is
    no line that reads it. Same for the subscriber's own position: the mock
    computes a real great-circle verdict and returns the VERDICT, never the place.
  - **An honest residual, added rather than removed:** an area is a dial (centre
    plus radius) and is walkable toward a position the way a duration threshold is
    bisectable. `presentIn` gets no bucket menu, so the cap is the operator's own
    resolution plus the rate-limit/billing backstop — weaker than the duration
    menu, and said to be weaker.
  - **A mutation SURVIVED on the first pass** and found a real gap: the
    read-after-write comparison that makes this round's assumed Admin write shapes
    survivable was pinned for the device axis and not for the location one.
- **The wired predicate set goes 3 → 6 (user-signed, PRD §9). Part 1:
  `deviceSwapAge`.** Every wired type is backed by an endpoint OBSERVED answering
  live; nothing is minted for a fact no source computes. `deviceSwapAge` takes the
  IDENTICAL shape to `simSwapAge` — same published bucket menu
  (`P30D | P90D | P180D | P365D`), same `≥` compare, its own fact — because two
  questions of the same shape must not teach a reader two grammars, and a second
  menu is a second place for the window to widen quietly.
  - **The reference adapter now calls the PROFILE-CONFORMING surface where it
    can.** `/check` answers a bit about a `maxAge` window in HOURS capped at 2400
    (boundary-tested), so `P30D`/`P90D` questions go to `/check` — on that path
    the operator never reads a date at all — and only `P180D`/`P365D`, which the
    cap cannot express, fall back to `/retrieve-date`. No rounding down to a
    window `/check` can express: that answers a question nobody asked, signed.
  - **A coarse `/check` answer carries the window it was computed for**, and the
    compare refuses unless that window EQUALS the threshold asked — otherwise an
    adapter could answer "not swapped in 30 days" to a "90 days?" question with a
    bit that is signed, verifiable and wrong.
  - **New seam `factQuery` (M4).** Three of the six predicates make the operator
    ask its own upstream a question-shaped question, so part of the predicate has
    to reach the adapter. It goes through one validating chokepoint — never
    throws, invokes nothing caller-supplied, returns frozen primitives or `{}` —
    rather than handing `req.predicate` to the module that builds outbound HTTP.
  - **The wire-byte scanner now excludes what the QUESTION itself carried**, and
    asserts the size of that exclusion. Found by the scan going red on its first
    run: `roamingIn ["FR","BE"]` puts `FR` in the signed claims by design (rule 2
    requires the answer to name its predicate). Honest limit recorded: the scan is
    therefore blind to a leak of the same value on the axis being asked about —
    M1's closed claim set is what prevents that, not the scanner.
  - **Stated, not claimed:** the Admin write shape for the `deviceSwap` axis and
    the `{phoneNumber, maxAge}` body of the two `/check` routes are ASSUMED
    (mirrored from measured siblings), never observed. Read-after-write
    verification is what makes a wrong guess fail LOUD instead of silently
    scripting a history that never took effect; the live run settles it.
  - **Counts: `m4-check` 33 → 36, `m5-check` 48 → 52, `m6-check` 38 → 40,
    `poc/demo.mjs` 22 → 27.** All AGENT-RUN by exit code; **user run PENDING.**
    Twelve mutations against the round's new guards, twelve killed.

- **M6 adversarial review round (2026-08-17): five ways to crash or deny-service
  the operator, all fixed and mutation-proven.** An independent review filed six
  defects with a repro script; all six reproduced on the first run. Four were
  real, and fixing them surfaced a fifth the review had not found.
  - **The operator could be crashed remotely, three ways** — all on requests
    that fit one envelope, from anyone holding its public envelope key, and all
    breaking the "wire input never throws" contract: an **unbounded echoed
    nonce** (200 characters → `seal()` threw out of `handle`); a **reason clamp
    counting UTF-16 code units where `seal` counts BYTES** (40 astral characters
    → a "clamped" 121-unit / 363-byte reason); and an **answer frame that
    overflows even when the request did not** (18 `roamingIn` country codes fit a
    446-byte request and produce a 448-byte answer, because the canonical
    predicate re-escapes every quote). The refusal budget is now COMPUTED and the
    arithmetic is written down (frame 136 B → payload 310 → claims 231 → reason +
    nonce ≤ 192 B, split 122/70 as JSON-encoded sizes); the clamp bounds encoded
    BYTES and cuts on a code-point boundary; an unechoable nonce is a transport
    reject; an oversize answer is a signed refusal. The comment claiming the
    worst reason had been *measured* to fit was simply false, and is replaced by
    a case that seals the worst admissible refusal (444/446 B).
  - **A forged response permanently burned the pending nonce.** The store
    deleted on any PRESENTED response, not any VERIFIED one, so the untrusted hub
    could inject one garbage sealed message and the operator's genuine answer
    then arrived to `unknown or already-used nonce` — a one-message denial of
    service by the party the design assumes is hostile. The in-code comment
    already stated the correct contract; the code did not implement it.
  - **`verifyRefusal` never ran the duplicate-key scan** that profile rule 2
    requires and `verifyAttestation` performs — in the same round M6 exported
    M1's scanner so the request path would not carry a second copy.
  - **Operator-internal diagnostics were signed and shipped to the requester.**
    The backend's exception message rode verbatim into the refusal; on the Orange
    path an upstream 500 delivers a core-network hostname. The requester now gets
    one stable reason, deliberately not distinguishing "unknown subject" from
    "temporarily unavailable" (that distinction is a subject-existence oracle);
    the full message stays operator-side.
- **Four labels corrected where the headline claimed more than the assertion
  checked** (no false PASS in any of them): a case whose `extra` was the literal
  `ok: true`; a "blind hub" assertion that actually exercised RSA-OAEP
  (blindness is structural and has no failing case — relabelled as narration);
  an "effective floor is visible" line asserting only `accepted === true`; and
  the backend-seam byte-identity headline, which is near-vacuous alone and now
  ships with a leg that CAN fail (a 5-day-old replayed swap flips the bit).
- **The wire-byte scanner was scanning one value five ways.** `rawNeedles` held
  five long-form spellings of the swap timestamp, so `{"swapDays":137}`,
  `{"c":"FR"}` (the roaming country VALUE), `{"m":"+990100000099"}` and
  `{"d":"2026-04-02"}` all scored ZERO while the printed line read "no raw value
  in ANY wire artifact". Inventory widened to nine, with a measured split:
  opaque artifacts take the seven long forms, plaintext takes all nine with the
  random hex nonce blanked so the 3-digit day count asserts instead of flaking.
- **Case counts: `m6-check` 28 → 38, `m3-check` 23 → 24.** Both AGENT-RUN;
  **user re-run PENDING**. The PRD's "every count above is from a run on the
  user's own machine" was false the moment M6/M1/M3 landed above it — it was the
  only place in the repo claiming user validation for M6 — and is corrected.
- **Spec sketch: `AttestRequest` closed with `additionalProperties: false`** (the
  outermost layer, which the code closed this round while the sketch left it
  open), and the `value` example no longer shows `"voice+data"`, a `simType`
  floor value left behind when `simType` left the `Predicate` enum.

- **Retracted, visibly: `kyc-match` does NOT "conform as-is because scores are
  already bands".** Measured against the Orange Playground 2026-08-17: a correct
  name returns `{"nameMatch":"true"}` with no score, a wrong name returns
  `nameMatchScore: 53`, and the registered name with **one letter changed**
  returns **97**. That is a similarity *gradient*, not a coarsening — it
  preserves the distance to the answer and lets a requester hill-climb to the
  subscriber's real registered name, which is strictly worse than binary
  guessing. The claim sat in two places in the CAMARA proposal (the §3.3
  adoption checklist and the §3.3.1 illustrative table); both are corrected, the
  old wording left visible with the measurement beside it. The profile's answer:
  threshold in the question off a published coarse menu, comparison
  operator-side, **only the boolean on the wire**.
- **Closed, unfavourably: `sim-swap/v1/retrieve-age-band` does not exist on the
  Playground** — `400 {"code":"BAD_REQUEST","message":"unhandled path"}`. The
  docs carried its availability as UNVERIFIED ("never probed, recorded as
  untested rather than assumed in either direction"); it has now been probed.
  Consequence: band → bucket mapping **cannot be demonstrated live** and stays
  mock-only or documented. The boolean `/check` surface, by contrast, does exist
  and answers on both sim-swap and device-swap, and its `maxAge` cap is now
  boundary-tested (`2400` → 200, `2401` → 400) on both — so `/check` can serve
  `P30D`/`P90D` and cannot express `P180D`/`P365D` at all.
- **Signed off, NOT yet built: the wired predicate set goes 3 → 6.**
  `simSwapAge`, `deviceSwapAge` (new — never one of the original seven),
  `roamingIn`, `presentIn`, `numberMatch`, `reachable` — each backed by an
  endpoint observed answering live. This is the same-day trim's *principle*
  applied to new evidence (wire only what a real fact source answers), not a
  reversal of it. `tenure` and `simType` stay out for a measured reason: the
  data exists operator-side but **no CAMARA read endpoint was found** at either
  `tenure/v1/retrieve` or `sim-tenure/v1/retrieve`. `spec/carrier-attestation.yaml`
  still lists three types — the enum follows the code, never the plan.
  `deviceSwapAge` takes the identical shape to `simSwapAge`; `numberMatch`
  publishes a **60 | 70 | 80 | 90** threshold menu (a free-choice threshold is
  bisectable exactly as the swap date was, and the score gradient makes it
  worse); `presentIn` **refuses** on `location-verification`'s third state
  `PARTIAL` rather than rounding it to yes or no. Five rules apply to all six
  with no exceptions: boolean or refusal; off-menu refused loudly, never
  rounded; unanswerable is a refusal; operator publishes the floor and the
  requester may only tighten; raw values stay operator-side. Recorded in PRD §9;
  the residual probing walk is priced and bounded at the layer above (rate
  limits, per-query billing, the operator's query log) — quantisation caps
  resolution and is not claimed to close the oracle.
- **Recorded: even a predicate-shaped catalog endpoint ships a raw value.**
  Every `location-verification/v1/verify` response carries `lastLocationTime`, an
  exact timestamp, beside its `TRUE`/`FALSE`/`PARTIAL` verdict. "Already
  predicate-shaped" is a statement about the headline field, not the payload.
- **A grounding failure is recorded rather than quietly corrected.** This
  session's orchestrator stated there was "no fact source known" for
  `tenure`/`simType` — while `findings.md` already recorded the Admin data model
  carrying seven axes including `tenure` and `kyc`. The conclusion survives, for
  a different and measured reason; the claim was made without re-reading the
  evidence log, and that is what got written down.
- **M6 built: `poc/demo.mjs`, the one-command reader-facing demo, and
  `poc/m6-check.mjs`, 28 cases. AGENT-RUN 22/22 and 28/28 by exit code; USER
  VALIDATION PENDING, so gate G1 is NOT yet met.** `node poc/demo.mjs` needs no
  credentials and touches no network; `--backend orange` swaps in M5 reading
  `ORANGE_BASIC_AUTH` from the environment and exits **2** with printed
  prerequisites if the credential is absent or the Playground is unreachable —
  never a silent fallback to the mock. Exit 0 only if all 22 assertions hold, 1
  if any fails.
- **Fixed — a crashed mock run was reported as a skipped prerequisite.**
  `main()` mapped ANY mid-run throw to exit 2, but exit 2 means *the chosen
  backend could not run*, and `--backend mock` has no prerequisites at all: no
  credential, no network, nothing that can be unavailable. So a backend that
  STARTED and then threw could only be a code regression, and a CI gate that
  correctly treats 2 as skip-on-prerequisite would have swallowed it in silence.
  Reproduced with a throwing `setBackstory` (exit 2 before, 1 after); mutation-
  proved by case 28, which reds at 27/28 with the fix reverted. Under
  `--backend orange` a mid-run throw stays 2 — an unreachable live operator
  genuinely IS a prerequisite failure. The in-code comment asserted the opposite
  rule and has been corrected. **M6 check: 27 → 28 cases.**
- **The RP nonce store's unbounded growth is now stated** (at the store and in
  the demo's own notes): a request that never receives a response leaves its
  nonce resident forever, and a real deployment evicts on expiry. Documented,
  deliberately not built — the demo would have to fake elapsed time to exercise
  a TTL, and a stated limit beats an untested one.
- **Why the PoC reads a precise SIM-swap date is now written down** where a
  reader hits it (M5 source, CAMARA proposal §2.1, PRD §9): the invariant
  governs the WIRE and the operator legitimately holds the raw value; `/check`
  is unusable for a **measured** reason (its `maxAge` is in hours, capped at
  2400 ≈ 100 days, which cannot express the published `P180D`/`P365D` buckets);
  and `/retrieve-age-band` — the surface that would fit — is provider-optional
  with **availability on the Playground UNVERIFIED, recorded as untested rather
  than assumed.** Documentation only: which endpoint M5 calls is unchanged.
- **Six deviations from the frozen M6 spec are now all recorded**, none left as
  a silent difference. Four were already in the decisions log (the parse-then-
  scan ordering, `findings.md`'s creation, the menu's ordered-thresholds-only
  scope, M3's reason length staying unclamped); the 20 → 22 assertion delta was
  recorded outside §9 and its entry now carries the count its siblings do; the
  three (now four) dependency-injection seams were unrecorded anywhere and have
  a new entry — including the honest note that guard-disabling is a separate,
  deliberately published `controls` seam.
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
- **M6 owns five things no module owns**, each one load-bearing and each one
  pinned: the transport frame `{iss, payload, sig}`; the **injective** canonical
  predicate string (a mutation dropping the threshold left the whole spike green
  while the operator answered `gte P1D` to a `gte P90D` question); the
  single-use nonce store (M1's nonce check is stateless BINDING and says so, so
  replay rejection lives entirely here); the reason clamp (M3 builds reasons
  from wire input unbounded, and M2's `seal()` THROWS above capacity, so an
  unclamped refusal crashes the operator instead of refusing); and the closed
  top-level request field set (below — the fifth was not in the plan, it was
  found by probing the finished file).
- **`poc/m6-check.mjs` is offline in BOTH backend modes.** The `--backend
  orange` seam runs through an injected transport replaying captured Playground
  bytes, and with the keys and the nonce held fixed the two backends produce a
  **byte-identical signed frame** — signature included, since Ed25519 is
  deterministic. That is the strongest form FR5's "only the facts source swaps"
  claim can take. The suite also runs the demo itself and asserts its exit code,
  its 22/22 tally, and **claims discipline**: every mention of zero-knowledge in
  the output must be a negation.
- **The top-level REQUEST field set is CLOSED — a defect found in M6's own code
  by an adversarial probe AFTER it was written and green, not a planned
  feature.** Every layer underneath was already closed (M1's claims, M3's axes,
  M4's predicate fields); the outermost envelope, which no module owns, was not.
  A request carrying `floors` — one letter off — had its floor silently DROPPED:
  `checkFloor` saw no requested floor, applied the operator's own `P90D`, and
  signed an answer while the requester believed it had demanded `P365D`. That is
  silent widening arriving through a spelling mistake — M3's closed-axis
  argument, one level further out. Unknown fields are now refused BY NAME (the
  misspelling is the actionable half), with the name rendered only while short
  and printable so an embedded newline cannot forge a log line. The general
  lesson, recorded in PRD §9: **a closed-set discipline is only as good as its
  outermost layer, and the composition owns a layer none of the modules do.**
- ~~**18 mutations against M6's own guards, 18 killed, 0 survivors**~~ —
  **corrected 2026-08-17.** An independent sweep of **34 meaningful mutations
  found 10 survivors (29% survival)**: the original 18 were self-selected and
  happened to hit only what the suite already pinned. Nine survivors are now
  pinned by new cases (`m6-check` 29–38, `m3-check` 24); the tenth,
  `unpackSigned`'s `Array.isArray`, was **proved redundant** rather than covered
  by a case that could not fail. Left struck through rather than rewritten,
  because a retracted measurement is worth more than a corrected one. See
  `docs/01-product/findings.md` 2026-08-17.
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
