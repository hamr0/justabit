# Attested Windowed Disclosure — a horizontal profile for CAMARA network APIs

### with CarrierAttestation as the new-case proposal for what no existing API covers

**Author:** Amr Hassan, independent telecom consultant (10 yrs wholesale roaming / signaling / SoR)
**Status:** Draft v0.2 — pre-submission (not yet filed; supporters not yet recruited)
**Date:** 2026-08-15
**Targets:** CAMARA Commonalities (profile as design guideline) · ICM (consent/auth hooks) · existing sub-projects (adoption PRs) · APIBacklog (CarrierAttestation new case — template mapping in §10)
**Companion:** the agent/delegation side is proposed separately to the IETF OAuth Working Group (`ietf-agent-delegation.md`); the two meet at the RFC 9421 header and neither depends on the other.

---

## 1. Executive summary

CAMARA APIs today follow a **lookup model**: a requester sends a
subscriber identifier (MSISDN) to an operator and receives a fact back ("SIM
not swapped", "number verified", "device roaming in FR"). The answer is
minimal; the **query path is not**. Every check ships an identifier, creates a
carrier-side log of *which requester asked about which subscriber and when*, and
returns raw values (timestamps, countries, the phone number itself) that are
linkable across requesters and across time.

This proposal's primary deliverable is a **horizontal profile** — "attested
windowed disclosure" — that any catalog API answering questions about a
subscriber or device can adopt:

> The requester states a **predicate**, a **floor**, and a fresh **nonce**;
> the operator answers with a **signed boolean bound to that nonce, with an
> expiry** — never the underlying raw value. Floors are **monotone**: any
> party downstream may tighten, never loosen. Carried through an aggregator,
> the exchange is end-to-end encrypted: the hub **fulfills and bills but
> cannot read**.

The catalog is already halfway here by its own hand — `/retrieve-age-band`
coarsens a response because raw timestamps over-disclose; `GET
/device-phone-number` already takes no request body at all, deriving the
line from the 3-legged access token instead of an identifier;
`kyc-age-verification` already ships as a boolean predicate API in the
catalog. The ask is not "approve my API" but **finish what you started,
catalog-wide.** Same trust root (the operator), same
commercial model (per-query billing and aggregator revenue share unchanged),
zero new surveillance byproduct.

A second, additive consumption mode — **holder presentment** (§5) — is
sketched for the cases the profile alone cannot reach (no inbound identifier
at all, no operator query log); it is roadmap, not the wedge.

## 1.1 Why now

This project's stance: subscriber identity data should not become a
tradeable asset — a position, not a finding.

A2P SMS shows what a middle layer able to *see* per-message value produces:
grey routing and artificially inflated traffic (AIT — SMS generated purely
to earn termination revenue) are documented, GSMA-named integrity failures,
both depending on a hub that can read per-message value. Business messaging
has shifted toward app channels (WhatsApp Business, RCS), eroding SMS's
share — even as total A2P spend keeps growing; a share shift, not a decline.

Any architecture where a hub can read identifiers, predicates, or answers
carries the structural *option* to accumulate and monetize them against the
ecosystem, whether or not any operator has done so — the prospective risk
this project addresses. The profile removes that capability rather than
prohibiting the behaviour. GDPR/ePrivacy already require consent and
purpose limitation before subscriber data leaves the network; a
raw-disclosure API is legally fragile by construction, a signed boolean
is not.

Result: win-win-win, no party trusting another's restraint — operator
keeps custody and answers a boolean; aggregator stays blind, bills per
answer, keeps revenue share; subscriber keeps privacy.

Agents are the sharpest "why now." MWC26 demonstrated agents autonomously
invoking network APIs (QoD on Orange, Mplify LSO on Colt, Number
Verification via Google Firebase) — agents acting as network principals.
Agentic consumption scales the query-log/identifier problem to machine
speed, far above human call volume. A SIM cannot be an agent's *principal
root* — prepaid SIMs are ~$1 and farmable — while subscription-quality
predicates are near-free for real subscribers, expensive at farm scale. A
floor-gated credential (`voice+data ∧ tenure ≥ 2y ∧ swapAge ≥ 90d`,
postpaid optional) over RFC 9421 is the clean foundation. The
agent/delegation side is proposed separately to the IETF OAuth Working
Group (`ietf-agent-delegation.md`).

## 2. Problem statement

| Leak | Lookup model today | Consequence |
|---|---|---|
| Identifier travels | requester → aggregator → operator, carrying MSISDN | requester must hold/process the number even when it only needs a boolean; GDPR minimization tension |
| Query log | Operator/aggregator logs (requester, subscriber, time, API) | A new cross-industry metadata stream: who banks where, who registered on which platform, when |
| Linkability | Responses keyed to the same identifier everywhere | Any two requesters (or one requester over time) can correlate a subscriber's checks |
| Consent opacity | Consent gathered out-of-band, subscriber never sees the flow | Weak Art. 6/7 GDPR story; ePrivacy exposure |

Fraud-prevention APIs are CAMARA's top commercial use case (GSMA Open
Gateway, MWC 2026: 300+ commercial launches, 65 markets). Scaling the lookup
model scales the metadata stream with it. Data-minimization regulation (GDPR
Art. 5(1)(c), eIDAS 2.0 wallet principles, sectoral fraud-liability rules
pushing banks toward these APIs) lands on the **buyers** of these APIs — they
need the fact without the custody. The lookup model cannot deliver that.

### 2.1 How CAMARA answers this today (state of the art)

The catalog already splits into two shapes — proof that the predicate
instinct exists, and that it stopped halfway:

| API | Predicate-shaped ("verify") | Raw-value-shaped ("retrieve") |
|---|---|---|
| SIM Swap (v2.1.0, r3.3) | `POST /check` → boolean `swapped` vs maxAge; `POST /retrieve-age-band` → coarsened recency band (1–17, provider-optional) | `POST /retrieve-date` → `latestSimChange` actual timestamp (RFC 3339) |
| Number Verification (v2.1.0, r3.2) | `POST /verify` → boolean `devicePhoneNumberVerified` | `GET /device-phone-number` → **actual `devicePhoneNumber`** off the network-auth token |
| Device Swap | check → boolean | retrieve-date → actual timestamp |
| Device Roaming Status | — | `/retrieve` → flag + actual country; subscription mode **pushes country changes** |
| Location | Verification → yes/no/partial vs radius | Retrieval → actual area |
| KYC (split into 3 repos post-Spring25) | `kyc-match` → per-field match scores; **`kyc-age-verification` → boolean age-threshold predicate** | **`kyc-fill-in` → returns name/address/birthdate from operator KYC records** |

*Verified against spec YAMLs and repos 2026-08-14, re-verified 2026-08-24
(SimSwap and NumberVerification hold; KYC split into three repos — see
§References).* Three verified precedents frame this proposal as completion,
not novelty: **(a)** `/retrieve-age-band` is already a windowing move —
CAMARA itself ships a precision-coarsened variant, conceding raw timestamps
over-disclose; **(b)** `GET /device-phone-number` takes no request body at
all — it derives the line from the 3-legged access token, so the
identifier-free shape is already structural in the catalog (its sibling
`POST /verify` still requires an identifier); **(c)** `kyc-age-verification`
is already in the catalog and proves the boolean-predicate pattern has a
home there. What is missing is the query-path and retention discipline
around them.

*A note on the reference PoC, since it reads the non-conforming surface.* The
PoC's operator adapter calls `POST /retrieve-date` and windows the timestamp
locally into the signed boolean. That is deliberate and it is not a
counter-example to the profile, for three reasons worth stating plainly. First,
**the profile governs what crosses the wire to the requester, not what the
operator holds** — the operator's own subscriber data includes the raw date, and
windowing is precisely what it does *to* that value; the PoC proves the point by
scanning the sealed response bytes for the raw needles and finding only the bit.
Second, `POST /check` is unusable for this profile for a **measured** reason: its
`maxAge` is expressed in hours with a cap of 2400 (≈100 days, measured against
the Orange Network APIs Playground 2026-08-14), so it cannot express the PoC
operator's published `P180D` or `P365D` windows at all. Third,
`POST /retrieve-age-band` is the surface that *would* fit — it is
provider-optional, and ~~its availability on that Playground is unverified: it
was never probed, and is recorded as untested rather than assumed in either
direction.~~ **CLOSED 2026-08-17, unfavourably: it was probed, and it is not
there** — `400 {"code":"BAD_REQUEST","message":"unhandled path"}`, the
Playground's own signal for an unwired route. So the coarse surface the profile
would prefer is *absent* on the one live operator sandbox this PoC can reach,
and band → bucket mapping cannot be demonstrated live at all. This is exactly
the gap §3 asks CAMARA to close catalog-wide, now measured rather than
anticipated: a conforming coarse surface should be a profile obligation, not a
per-provider option an integrator may find missing. (The boolean `POST /check`
*does* exist and answer on that Playground — it is the `maxAge` cap above, not
the endpoint, that keeps it from serving the whole menu.)

Privacy is currently handled procedurally: ICM's OIDC consent profile (a
`purpose` parameter on the query), aggregator DPAs (the middleman still sees
every query), and the "responses are minimal" argument (true only for
check-variants, silent about the inbound identifier and the query log).
**Consent today is a string logged next to the query.** The verify/retrieve
split is the internal precedent this profile completes: verify-shaped answers
deserve verify-shaped query paths.

## 3. The profile (normative)

**Applies to:** any API answering questions about a subscriber/device
(sim-swap, number-verification, device-roaming-status, location-verification,
kyc-\*, device-status, …).

### 3.1 Definitions

- **Window** — the disclosure width of a response. The narrowest window that
  answers anything at all is one bit.
- **Predicate** — a question with a boolean answer evaluated by the operator
  over facts it already holds ("swapAge ≥ 90d", "device in FR", "tenure ≥ 2y").
- **Floor** — the minimum predicate set a requester demands. Floors are
  **monotone**: they may be tightened by any party downstream, never loosened.
- **Nonce** — requester-supplied freshness value echoed inside the signed
  response.
- **Validity** — the response's lifetime; bounded by the query's duration
  where applicable, always short.

**Roles:**

| Role | Definition |
|---|---|
| Customer | The subscriber the question is about |
| Operator | Holds the facts, signs the boolean answer |
| Aggregator | The blind hub; relays and bills, reads nothing |
| Requester | Asks the question (a bank, a content service, an agent platform) |

**RP** means *roaming partner*, its standard telecom sense. The party asking
a predicate question is the **requester** — never abbreviated, and never
"RP" for "relying party."

### 3.2 Normative rules (profile mode)

An API operation conforming to this profile:

1. **MUST** return only the predicate result (boolean) or a declared band —
   never the underlying raw value (timestamp, country, number, address).
2. **MUST** echo the requester's nonce and the predicate being answered
   inside the signed response payload and **MUST** include an expiry;
   verifiers **MUST** reject responses whose predicate is not the one asked,
   and replayed or expired responses. Signature verification alone is
   stateless — replay rejection additionally requires single-use,
   per-request nonces on the requester side. Verifiers **MUST** reject a
   signed payload containing a duplicate claim key (compared after JSON
   escape decoding): RFC 8259 leaves duplicate names undefined, so one
   signature-valid payload could otherwise read as *true* to a last-wins
   parser and *false* to a first-wins parser — a signing operator's
   equivocation channel.
3. **MUST** sign responses with a key resolvable through the operator trust
   directory (per-PLMN public keys). Verifiers **MUST** pin the expected
   operator key (or issuer) *before* verification and **MUST NOT** let an
   unsigned key-resolution hint (e.g. an `iss` field outside the signed
   claims) select which directory key to trust — otherwise any
   directory-listed operator, routed by an untrusted aggregator, could
   answer a query addressed to a different operator.
4. **MUST NOT** carry a subscriber identifier in the request where it is
   derivable from the access token (generalizes the shape `GET
   /device-phone-number` already takes: no request body at all, the line
   resolved from the 3-legged token instead of a supplied identifier).
5. **MUST** treat floors as monotone: an intermediary or delegate may tighten,
   never widen; a request below the operator's published floor is rejected,
   not silently answered. Three properties make that check mean something on
   the wire rather than in prose:
   - Floor axes are a **CLOSED set**. An unknown or misspelled axis **MUST**
     be a rejection, never ignored: an ignored typo silently drops the
     constraint the requester believes is enforced — the same silent widening
     the rule exists to forbid, arriving through a spelling mistake.
   - Duration floor values **MUST** be expressed as `P<n>D` or `P<n>Y` only,
     with 1 year = 365 days **declared** as the one stated approximation.
     Month-denominated durations (`P3M`) **MUST** be rejected as ambiguous: a
     month is 28–31 days, so "is `P3M` ≥ `P90D`?" has no honest single answer,
     and answering it either way is a window the requester did not agree to.
   - Verifier-side comparison **MUST** be numeric after parsing, never
     lexicographic. `'P100D' < 'P90D'` is *true* as strings, so a string
     compare rejects a genuinely tighter request while admitting others —
     the ordering the rule depends on simply does not exist over the text.
6. **MUST** be end-to-end encrypted between requester and operator when
   carried through an aggregator; the aggregator handles metering envelopes
   only (count, route, bill) — it **MUST NOT** be able to read identifiers,
   predicates, or answers. (§8.1: a middle layer that can read holds the
   structural option to accumulate and monetize; this rule removes the
   capability rather than relying on restraint.) Envelopes **MUST NOT** expose
   payload size to
   the aggregator: profile-mode envelopes are fixed-length or padded, so the
   metering log carries no content signal (a length-tracking transport turns
   the billing record itself into a side channel).
7. **SHOULD** offer banded responses only as a transitional step from raw
   values (the `/retrieve-age-band` pattern); bands are a wider window than a
   predicate and need justification.
8. Widening the window beyond one bit **MUST** be an explicit, distinct
   operation the subscriber-side consent flow can see — never a parameter
   default.

### 3.3 Adoption checklist for existing APIs

| API | Profile-mode change |
|---|---|
| sim-swap | `/check` conforms with nonce+expiry added; `/retrieve-date` excluded from profile mode |
| number-verification | `/verify` conforms with nonce+expiry; `/device-phone-number` excluded |
| device-roaming-status | replace country retrieval with country/region predicates ("in FR?", "in EU?") |
| location-verification | already predicate-shaped; add nonce+expiry, drop retrieval variant |
| kyc | `kyc-age-verification` conforms; `kyc-match` conforms **only if the score is withheld** — see the retraction below; `kyc-fill-in` excluded |

> **RETRACTED 2026-08-17 — "`kyc-match` conforms (scores are bands)" was
> measurably wrong.** Measured against the Orange Network APIs Playground:
> a correct name returns `{"nameMatch":"true"}` with no score; `"Bob Wrong"`
> returns `{"nameMatch":"false","nameMatchScore":53}`; and `"Alice Arnaut"` —
> the registered name with **one letter changed** — returns
> `{"nameMatch":"false","nameMatchScore":97}`. That is not a band. A band
> coarsens: it destroys resolution inside the bucket. A similarity score does
> the opposite — it preserves the *distance to the answer* and hands it to the
> requester, who can hill-climb it to the subscriber's real registered name.
> It is strictly worse than binary guessing, which has no gradient to follow.
> Under this profile `kyc-match` conforms only in the shape §3.3.1 now shows:
> the requester declares its own match threshold in the question off a published
> coarse menu, the operator compares internally, and **only the boolean crosses
> the wire.** Left visible rather than edited away — a retraction is the record.

#### 3.3.1 What that looks like on the wire (illustrative, non-normative)

**This table is an EXAMPLE of adoption, not a rule.** It adds nothing to §3.2 —
the normative profile enumerates no predicate types and mandates no field
names. It exists because "conforms with nonce+expiry added" is abstract until
you see the same subscriber fact in both shapes, and because reviewers
consistently ask what a catalog API *returns* under the profile.

| Catalog API | Retrieval shape today | Profile-mode shape (illustrative) |
|---|---|---|
| sim-swap `/retrieve-date` | `{"latestSimChange":"2026-04-18T00:00:00Z"}` | excluded from profile mode; the question becomes ↓ |
| sim-swap `/check` | `{"swapped": true}` over a `maxAge` window | `{"claims":{"predicate":"simSwapAge≥P90D","result":true,"nonce":"…","exp":1786060800000},"iss":"…","sig":"…"}` |
| number-verification `/verify` | `{"devicePhoneNumberVerified":true}` | same, plus nonce+expiry binding and a signature over the closed claim set |
| number-verification `/device-phone-number` | `{"devicePhoneNumber":"+33…"}` | excluded from profile mode (returns the identifier itself) |
| kyc `kyc-age-verification` | `{"ageCheck":"true"}` | `{"claims":{"predicate":"age≥18","result":true,…},"sig":"…"}` |
| kyc `kyc-match` | per-attribute match **scores** (`{"nameMatch":"false","nameMatchScore":97}`) | `{"claims":{"predicate":"numberMatch gte 90 \"Alice Arnaut\"","result":true,…},"sig":"…"}` — threshold in, boolean out; **the score never crosses the wire** (retraction above); **wired in the PoC 2026-08-17** |
| kyc `kyc-fill-in` | attribute values | excluded from profile mode |
| device-roaming-status † | `{"roaming":true,"countryName":["FR"]}` | `{"claims":{"predicate":"roamingIn[FR,DE]","result":true,…},"sig":"…"}` — country in, boolean out |
| device-reachability-status † | `{"reachabilityStatus":"CONNECTED_DATA"}` | `{"claims":{"predicate":"reachable=true","result":true,…},"sig":"…"}` |
| device-swap `/check`, `/retrieve-date` † | `{"swapped":true}` / `{"latestDeviceChange":"2026-08-11T…"}` | `{"claims":{"predicate":"deviceSwapAge≥P90D",…},"sig":"…"}` — identical shape to `simSwapAge`, same bucket menu; **wired in the PoC 2026-08-17** |
| location-verification `/verify` † | `{"verificationResult":"TRUE\|FALSE\|PARTIAL","lastLocationTime":"2026-08-11T…"}` | `{"claims":{"predicate":"presentIn in {\"lat\":48.86,\"long\":2.35,\"radiusM\":10000}","result":true,…},"sig":"…"}` — **`PARTIAL` refuses, it is not rounded**; `lastLocationTime` stays operator-side; **wired in the PoC 2026-08-17** |

Three things the table is meant to make concrete:

1. **The window is in the QUESTION, and only the answer crosses.** The
   requester names the threshold it needs (`P90D`); the operator returns the
   bit. The date, the country and the status stay operator-side — rule 2 is a
   property of the response shape, not a promise in prose.
2. **"Excluded" is not "deprecated".** `/retrieve-date` and
   `/device-phone-number` remain exactly as they are for the three-legged and
   consented flows they already serve. Profile mode is an additional mode, and
   §3.2 rule 8 keeps a widening back to retrieval an explicit, consent-visible
   operation rather than a silent one.
3. **A fact the operator cannot supply must be REFUSED, not defaulted.** The
   right-hand column has no "unknown" row on purpose: an unanswerable predicate
   returns *no answer*, never `result:false`. A missing fact rendered as a
   confident negative is indistinguishable on the wire from a real one, and it
   is signed. This is the one row of the table with teeth, and it is the
   failure the PoC's M5 module measured against a live operator sandbox: the
   Orange Playground genuinely returns "roaming, country unknown", and folding
   that into "not roaming" answers "not in FR" about a subscriber who may be
   standing in France.

The middle column reflects current catalog responses (baseline verified
2026-08-14, re-verified 2026-08-24; see §11). The right-hand column is this
profile applied to them.

Two limits and one deferral on that, stated rather than glossed:

- **† The `device-*` and `location-verification` rows are NOT covered by the §11
  baseline.** That baseline re-verified SimSwap v2.1.0, NumberVerification
  v2.1.0, and the three post-split KYC repos (kyc-match, kyc-fill-in,
  kyc-age-verification — see §References) only. The roaming and reachability
  shapes in the middle column are what the **Orange Network APIs Playground**
  returned when the PoC's M5 module read them live (2026-08-16); the
  device-swap and location-verification shapes are from a standalone endpoint
  sweep of the same Playground (2026-08-17) — a vendor sandbox, not a CAMARA
  spec surface. They are included because the PoC exercises them; they carry
  the sandbox's authority, not the catalog's, and they get re-verified against
  the catalog before this document is submitted.
- **The right-hand column is the profile's envelope, and the PoC produces that
  envelope — it does not produce these specific predicates.** The PoC (M1)
  signs the closed claim set `{predicate, result, nonce, exp}` and carries `sig`
  as a SIBLING of `claims`, with `exp` as Unix epoch milliseconds — which is
  what the rows above show, and what `spec/carrier-attestation.yaml` requires.
  Predicate *ids* like `roamingIn[FR,DE]` are illustrative spellings; the
  normative profile enumerates no predicate types (§3.2) and the PoC answers
  three axes, not nine. An earlier version of this paragraph claimed "the shapes
  in it are the ones the PoC actually produces" while the rows showed `sig`
  INSIDE the claims and a quoted `exp` — a shape M1 rejects outright
  (`unexpected fields: sig`). The claim was checkable and did not check out, so
  it is corrected here rather than dropped.
- **Deferred, not dropped: `tenure`, `simType`, `presentIn`, `numberMatch`.**
  The illustrative sketch's `Predicate` enum listed seven types; on 2026-08-17
  it was **trimmed to the three the PoC wires end to end** — `simSwapAge`,
  `roamingIn`, `reachable`. The other four were aspirational: nothing computes
  them, so a reader could send a schema-valid request the reference operator
  refuses, which is an enum answering for facts that do not exist. Each has a
  real place in the profile and returns when something computes it: `tenure`
  and `simType` are already **floor axes** (`tenureMin`, `simType` in `Floor`)
  and belong in §3.4's agent-grade floor either way — `tenure` additionally
  carries the unresolved MNP problem (§9.8), so minting it as a predicate ahead
  of that would ship the open question as though it were settled;
  `presentIn` is location-verification's shape and is already predicate-shaped
  in the catalog (§3.3); and `numberMatch` is number-verification's `/verify`,
  which conforms today and needs no new predicate id. The **normative** profile
  enumerates no predicate types at all (§3.2), so this trim narrows an
  illustrative artifact and changes nothing anyone would implement against.

  **Update, same day (2026-08-17) — three of those four come back, plus one that
  was never on the list; DESIGN, not yet built.** An endpoint sweep of the
  Playground found live sources for them, and the trim's rule was never "three
  types" — it was *wire only what a real fact source answers*. Signed off for
  the next build round: `simSwapAge`, **`deviceSwapAge`** (new; `device-swap`
  `/check` and `/retrieve-date` both answer), `roamingIn`, `presentIn`
  (`location-verification/v1/verify` answers, with the `PARTIAL` third state
  above), `numberMatch` (`kyc-match/v1/match` answers) and `reachable`.
  `tenure` and `simType` stay out for a **measured** reason, not a presumed one:
  the operator-side data exists (the Playground's admin dataset carries a
  `tenure` axis), but no CAMARA read endpoint was found at either
  `tenure/v1/retrieve` or `sim-tenure/v1/retrieve` — both `400 "unhandled
  path"`. `tenure`'s MNP problem (§9.8) is unchanged and still unresolved.
  Two corrections this update forces on the paragraph above it: `numberMatch`'s
  backing surface is `kyc-match`'s scored comparison, **not** number-verification
  `/verify` — and "conforms today and needs no new predicate id" does not
  survive the measured score gradient (retraction, §3.3). Until that build round
  lands, `spec/carrier-attestation.yaml` still lists three types; this paragraph
  describes a signed-off design, and the enum follows the code, never the plan.

  **Built, 2026-08-17 — `deviceSwapAge` is wired end to end** and the sketch enum
  now lists four types (`simSwapAge`, `deviceSwapAge`, `roamingIn`, `reachable`).
  It took the identical shape to `simSwapAge`, which is the point rather than a
  saving: same published bucket menu, same `≥` compare, so the two questions
  share one grammar and there is no second place for the window to widen. One
  thing the build MEASURED and the design had only asserted: the reference adapter
  now calls the profile-conforming surface wherever it can. `/check` answers a
  boolean about a `maxAge` window in HOURS capped at 2400 (boundary-tested), so a
  `P30D` or `P90D` question is answered by `/check` — the operator never reads a
  date at all — and only `P180D`/`P365D`, which that cap cannot express, fall back
  to `/retrieve-date` with the windowing done operator-side. That is the profile's
  own preference showing up as an endpoint choice rather than as prose, and it is
  the one place a catalog surface already does what §3.2 rule 1 asks for.

  **Found, 2026-08-17 (accidental, from a live-run negative-control bug, not
  designed for) — `/check` closes off a whole class of operator mistake, not
  just a requester's exposure.** A `P90D` question never puts a raw date into
  the operator's own working set at all, so there is nothing to leak even if
  the operator ships extra fields by accident — the M1 closed-claim-set defence
  still catches it, but on `/check` there is a SECOND, structural reason it
  cannot happen: the value is absent, not merely rejected. `/retrieve-date`
  (`P180D`/`P365D`) has no such structural floor and relies on the closed claim
  set alone. **Corroborated live, 2026-08-18** (user run at tip `3276ed0`,
  `node poc/m5-check-live.mjs` 19/19): the cap boundary is confirmed on the
  wire itself — `P90D` routes through `check maxAge=2160h` → `true`, `P365D`
  routes through `retrieve-date` (no `maxAge`) → `false`. See
  `docs/logs/findings.md`, 2026-08-17/18, for the full mechanism.

  `presentIn` and `numberMatch` follow in the same round.

  **Built, 2026-08-17 — `presentIn` is wired, and the third state is the whole
  point.** `location-verification/v1/verify` answers `TRUE`, `FALSE` and
  `PARTIAL`, and under this profile `PARTIAL` produces a signed REFUSAL carrying
  no bit — never a rounded `true` or `false`, because a rounded answer is signed
  and indistinguishable on the wire from a real one. Three things the build
  settled:
  - **The policy is PUBLISHED and tighten-only, using rule 5's existing floor
    machinery rather than a new mechanism.** `partialPolicy` is a floor axis with
    one legal value (`refuse`), so a request asking to have `PARTIAL` rounded for
    it is a LOOSENING and dies at the floor gate before any fact is read. There is
    no parameter anywhere that turns the rounding on.
  - **The area is the QUESTION, and it is canonicalised by key, not by typing
    order.** `JSON.stringify` serialises an object in insertion order, which for a
    parsed request is whatever the requester typed — two requesters asking about
    the same circle would otherwise derive two different signed predicate strings,
    and one would get its own correct answer back as a predicate mismatch.
  - **`lastLocationTime` is never read.** Not filtered on the way out: there is no
    line that reads it, so there is nothing to filter. This is what §3.5's
    "profile mode constrains what an operator forwards, not only which endpoint it
    calls" looks like in code.

  One honest residual the build makes concrete rather than removes: an AREA is a
  dial (centre plus radius) and a requester willing to pay for queries can walk it
  toward a position, exactly as a duration threshold can be bisected. `presentIn`
  gets no quantisation menu — the signed decision does not give it one — so the
  cap here is the operator's own resolution (below which the answer is a refusal,
  not a finer bit) plus the rate-limit and per-query-billing backstop of §3.5.
  Stated as a residual rather than closed.

  **Built, 2026-08-17 — `numberMatch` is wired, and it is the row where the raw
  value the profile protects is the RESPONSE ITSELF.** The requester declares its
  threshold off the published menu (`60 | 70 | 80 | 90`) and the name it holds; the
  operator compares internally; only the boolean leaves. Three notes the build
  adds to the retraction above:
  - **The claimed value is part of the SIGNED question.** It is an input to the
    comparison, not a window, so it does not ride in the threshold field — but it
    must be in the signed predicate string, or an answer about "does *Bob* match?"
    would verify as an answer about "does *Alice* match?".
  - **The operator learns what the requester claims.** That is inherent to
    `kyc-match` — a comparison needs both sides — and it is disclosure in the
    OTHER direction from everything else in this profile. It is recorded rather
    than glossed: profile mode narrows what the OPERATOR discloses; it does not
    make the requester's own query private, and Mode A retains the query log
    (§3.5, first bullet).
  - **An exact operator-side match carries no score at all** in the measured
    response, so "compare the score against the threshold" is not sufficient on
    its own: a perfect match must satisfy every threshold WITHOUT one, or the
    conforming implementation answers `false` to the strongest possible match.

### 3.4 Agent-grade floor (reference profile)

Agents are the "why now" (§1.1). Consumer-agent floor, only tightenable:

```
simType  = voice+data      # excludes data-only IoT/M2M SIMs — the farm's cheap
                           # input; consumer voice+data SIMs are KYC'd in most
                           # markets and costlier
tenure   ≥ 2 years         # aged subscriptions are slow/expensive to mass-produce
swapAge  ≥ 90 days         # kills swap-and-reset
class    = postpaid        # optional tightening
```

Failing the floor after a ban means starting over with a fresh SIM that fails
`tenure` on day one — identity reset becomes expensive. This is **economic
scarcity** (cost-bounded), distinct from a document root's cryptographic
scarcity (k-bounded).

Machine agents (fleets, vehicles — no human document exists) get a
**separate** machine-agent profile that deliberately embraces M2M SIMs:
predicates over fleet contract tenure, account standing, mobility-pattern
organicity. The two profiles must not be conflated: `voice+data` exclusion is
a *consumer-agent* floor filtering farms, not a statement that M2M SIMs are
illegitimate.

**Honest limit:** floors raise the cost of an agent identity; they do not
create uniqueness. One subscription can back many agents — rate/reputation
keys to the per-service tag, and "one accountable human" still requires a
document-rooted principal layer above this profile.

### 3.5 Residuals, stated honestly

- Profile mode (Mode A) retains the operator-side query log (requester asked
  about subscriber S). Acceptable where the requester already holds its
  customer's number (KYC, fraud); removed only by holder presentment (§5).
- The operator always knows it attested fact T about subscriber S at time t —
  never to whom it was ultimately presented (Mode B) or beyond the requester
  (Mode A).
- The trust directory is the single centralization point; governance belongs
  with existing GSMA key-distribution rails (RAEX/IR.21-shaped) — see §9.9.
- A blind aggregator still sees traffic metadata: message count, timing, and
  the requester↔operator pairing (who queries whom, when). Rule 6 removes content,
  not the fact of the query; measured and recorded in the PoC findings log.
- Even a *predicate-shaped* catalog endpoint hands back raw values beside its
  verdict. Measured 2026-08-17: **every** `location-verification/v1/verify`
  response carries `lastLocationTime`, an exact timestamp, next to a
  `TRUE`/`FALSE`/`PARTIAL` result. So "this API is already predicate-shaped"
  (§3.3) is a statement about the headline field, not the payload. Profile mode
  therefore constrains what an operator *forwards*, not only which endpoint it
  calls — those values are legitimately the operator's, and they stop there.

**The repeated-query oracle — measured, and only partly closed.** Every
individual profile-mode response is a windowed bit and leaks nothing beyond it.
A *sequence* of them is a different object. Rule 1 deliberately puts the window
in the QUESTION, which leaves the threshold to the requester; so a requester
willing to pay for N queries can binary-search the underlying value out of N
individually clean booleans. This is measured, not hypothetical: the PoC's M6
composition spike recovered a subscriber's exact SIM-swap age — 137 days — in
**nine** signed, nonce-bound, expiring, end-to-end-encrypted, fully metered
queries, every one of which passed every rule in §3.2 and left the raw value
nowhere on the wire. No rule is violated and no module is wrong; the leak is the
sequence, not any response, and floors do not reach it (a floor constrains the
*profile* demanded, not the threshold asked). Three mitigations were weighed:

1. **Quantised thresholds — ADOPTED in the reference implementation.** The
   operator publishes a coarse menu of legal thresholds next to its floor
   (`P30D | P90D | P180D | P365D` in the PoC) and **refuses** anything off it.
   It refuses rather than rounds: rounding to the nearest bucket answers a
   question nobody asked, and silently widens or tightens the window the
   requester agreed to. This **caps** the oracle's resolution at the bucket —
   roughly two bits over a year — it does **not** close it, and it is stated as
   a cap rather than a fix. Only *ordered* thresholds get a menu: a
   set-membership predicate has no ordering to bisect, and a boolean predicate
   is already at full resolution.

   *Extension, 2026-08-17 (BUILT).* The same rule reached a second ordered axis
   the moment `deviceSwapAge` was wired: a device swap age is bisectable exactly
   as a SIM swap age is, so it takes the SAME published menu
   (`P30D | P90D | P180D | P365D`) rather than a menu of its own. Sharing the
   menu is deliberate — a second, separately-maintained bucket list is a second
   thing that can quietly widen, and two facts answering the same shape of
   question should not teach a reader two grammars. The reference implementation
   refuses an off-menu device threshold with the same reason shape as the SIM one,
   and a disabled-menu control shows the same rung being answered.

   *Extension, 2026-08-17 (BUILT).* The same rule reaches
   a third ordered axis now that `numberMatch` is wired: `kyc-match` returns a
   similarity **score**, and a free-choice match threshold is bisectable exactly
   as a duration threshold is. The published menu there is **60 | 70 | 80 | 90
   and nothing else**, the comparison happens operator-side, and the score never
   crosses the wire. A threshold is offered at all — rather than one operator
   value imposed on everyone — because requesters genuinely differ: names
   vary by accent, middle name, transliteration and typo, which is why the
   catalog returns a score in the first place. Rule 1 already puts that window
   in the question; the menu is what keeps it from being a dial. Measured
   urgency for this one: the score is a *gradient*, not a band (a name one
   letter off scored 97 against a wrong name's 53), so an unquantised,
   unwithheld score is hill-climbable to the registered value — see the
   retraction in §3.3. In the reference implementation an off-menu match
   threshold is refused before any comparison is made, and a disabled-menu control
   answers the same rung — one step of exactly that walk.

   *One measurement worth recording beside it.* The PoC's mock operator needed a
   score source of its own, and Jaro-Winkler — chosen independently, as a
   plausible standard string metric — reproduces BOTH measured Playground values
   exactly: 97 for the one-letter near miss and 53 for the unrelated name. Two
   agreeing points is evidence and not proof, and nothing in this profile depends
   on which metric an operator uses; it is noted because a reader reproducing the
   PoC will see the same numbers and should know why.

   *And one axis where the honest answer is to refuse — BUILT 2026-08-17.*
   `location-verification` returns a third state, `PARTIAL`, when the asked-for
   radius is finer than the operator can resolve. Under this profile `PARTIAL` is
   **not rounded** to `true` or `false`: it refuses, exactly as a straddling band
   or a missing fact does, because a rounded answer is signed and
   indistinguishable on the wire from a real one. The operator publishes its
   `PARTIAL` policy alongside its floor and a requester may only tighten it
   (rule 5) — no new mechanism, and in the reference implementation that is
   literally true: `partialPolicy` is a floor AXIS with one legal value, so a
   request asking for rounding is refused by the same gate that refuses a
   below-floor window, before any fact is read.

   *And one residual this axis adds, stated rather than glossed.* An area is a
   dial — centre plus radius — so a requester willing to pay for queries can walk
   it toward a position exactly as a duration threshold can be bisected.
   `presentIn` gets no bucket menu (there is no natural coarse set of circles the
   way there is of durations), so the cap here is the operator's own resolution,
   below which the answer is a refusal rather than a finer bit, plus mitigation 2
   below. That is weaker than the duration menu and is not presented as equal to
   it.
2. **Per-subject rate limits and per-query billing — ADOPTED as the economic
   backstop.** Mode A's commercial rail is also its defence: every rung of a
   walk is a separately metered, separately billed query against one subject,
   visible in the operator's own query log (which Mode A retains anyway, first
   bullet above). A walk is therefore expensive, rate-limitable and *auditable*
   — which is a different and weaker claim than "prevented", and is meant as one.
3. **A monotone tighten-only repeat rule — CONSIDERED, NOT ADOPTED.** Requiring
   each subsequent question about the same subject to be at least as tight as
   the last defeats bisection and leaves only a one-directional walk: for the
   subscriber above that is one query per step, 137 instead of 9 — about 15×
   the cost, and still a complete recovery. It buys a constant factor, not a
   property. It also makes a legitimate second question about the same
   subscriber depend on the first, and the profile has no way to scope, share
   or expire that state across requesters. Recorded here as considered and
   declined rather than left unmentioned.

Quantisation is a property of the reference implementation and of an operator's
published policy, **not** a normative rule: §3.2 enumerates no predicate types
and no thresholds, and the right place to settle a menu is per-API adoption
(§3.3). It is stated here because the alternative — presenting per-response
windowing as if it bounded a requester's total knowledge — is the kind of claim
WG scrutiny should catch, and it is better caught by the author.

## 4. Two consumption modes

**Mode A — attested query response (primary; the adoption wedge).** The
existing rail, commercially unchanged: requester → aggregator → operator, per-query
billing and revenue share as today. What changes is payload discipline: the
profile of §3 applied end-to-end, with the aggregator blind (§8.1).

Claims discipline: Mode A is **attested windowed disclosure**, not
zero-knowledge, and must never be described as ZK. Its residuals are §3.5.

**Mode B — holder presentment (extension; agentic and no-identifier cases).**
Attestations issued to the subscriber's device; the holder or agent presents
proofs (§5). Removes the inbound identifier and the operator query log
entirely; requires holder-side software; ZK proper enters here. **Mode A is
the wedge; Mode B is the roadmap.**

## 5. Mode B design sketch (roadmap)

### 5.1 Roles

- **Issuer** — the operator (exposed through Open Gateway / aggregators),
  signing attestations of network facts it already computes for existing
  CAMARA APIs.
- **Holder** — the subscriber's device (SIM-bound app, OS wallet, or EUDI
  wallet), receiving and storing attestations; generates proofs.
- **Verifier / requester** — any service; verifies proofs against operator public
  keys (published, e.g., JWKS per PLMN). No API subscription needed to
  *verify* — verification is offline math.

### 5.2 Attestation (issued object)

Short-lived signed credential, e.g.:

```
{
  "iss": "opengateway.operator.example (PLMN 26201)",
  "sub": <blinded subscriber commitment — NOT the MSISDN>,
  "fact": { "type": "simSwap", "lastSwapAge": ">90d" }
        | { "type": "roamingStatus", "roaming": true, "country": "FR" } | ...,
  "iat" / "exp": minutes-to-hours validity,
  "cnf": holder key binding (proof-of-possession)
}
```

Format candidates (decide in WG): **SD-JWT VC** (selective disclosure,
simplest operator on-ramp), **BBS+** (unlinkable multi-show), **zk-SNARK over
a signed statement** (full predicate flexibility). Recommendation: profile
SD-JWT VC for v1 (aligns with eIDAS 2.0 / OpenID4VCI+VP tooling operators
will need anyway); keep the proof layer pluggable so BBS+/SNARK presentments
can be added without re-issuing.

### 5.3 Presentment

- Proof of a **predicate**, not the raw fact: "swap age > N days",
  "roaming ∈ EU", "number prefix ∈ +49", "device reachable within last hour".
- **Scope binding**: the proof is cryptographically bound to the verifier's
  domain and a session nonce — replay-useless elsewhere; two requesters cannot
  correlate presentments.
- **Metadata uniformity**: fixed proof sizes/versions so the presentment
  itself cannot fingerprint the holder.
- Transport-agnostic: HTTPS, OpenID4VP, QR/optical presentment for in-person
  or air-gapped flows.

### 5.4 Identifier model — no MSISDN/IMSI on the wire

- CAMARA today identifies the device by `phoneNumber` (MSISDN),
  `networkAccessIdentifier`, or device IP/port; IMSI never leaves the
  operator domain. Swapping MSISDN for IMSI would not reduce linkability —
  both are long-lived tracking keys. Mode B removes the identifier from the
  requester-facing wire entirely.
- **Issuance leg** (subscriber ↔ operator): no identifier is sent — network
  authentication on the live cellular session ("silent auth", the existing
  `number-verification` mechanism) tells the operator which SIM is asking.
- **Attestation subject**: a blinded commitment with per-requester scope and
  time-window epoch: `tag = HASH(subscriber_secret, rp_scope, epoch)`. The requester
  sees a predicate proof bound to this tag + its session nonce — nothing
  longitudinal, nothing cross-requester.
- **Windowing note**: fraud predicates need *freshness*, not continuity — the
  epoch window deliberately prevents even a single requester from building a profile
  over time. Bannable-identity cases use stable per-requester tags so consequence
  sticks. Stability vs. windowing is a per-attestation-type knob, not an
  architectural fork.
- **Precedent**: 5G already conceals the permanent identifier on the air
  interface (SUPI → one-time SUCI); CAMARA's own `Device` object already
  accepts network-side identification (IP address / network access
  identifier) in place of the permanent subscriber identifier — not
  identifier-free, but not the permanent identifier either. This extends an
  accepted principle — long-lived identifiers must not travel — from the
  radio and session layers to the API layer.

### 5.5 What this is NOT

- Not a replacement or breaking change to any existing CAMARA API — the
  lookup model remains for server-to-server cases with consent.
- Not an identity system — attests network facts only; deliberately
  composable with (not competing with) EUDI wallet PID.
- Not a new consent framework — it *is* consent made structural: nothing
  moves without the holder presenting.

### 5.6 Design principles

1. **Attest facts, never identities** — operators sign predicates; requesters
   consume booleans.
2. **No long-lived identifier leaves the operator** — MSISDN/IMSI resolved
   internally at issuance (silent auth); the wire carries
   `HASH(sim_secret, rp_scope, epoch)`.
3. **Holder-mediated: consent is structural** — nothing flows operator→requester
   directly; no presentment, no data, no log.
4. **Nonce'd + expiring** — replay-dead, retention-hostile; what a requester stores
   is correlation-worthless.
5. **Disclosure window, narrow by default, monotone tightening** — one bit by
   default; widening requires an explicit, holder-visible request; floors
   only tighten downstream.
6. **Time window as a per-type knob** — epoch-windowed tags for fraud
   predicates, stable per-requester tags for bannable identity. Same derivation,
   different epoch policy.
7. **Policy at the edge, facts at the core** — operator = issuer of attested
   facts and published floors; requester = chooses required predicates; neither sees
   the other's counterparty.
8. **Additive and standards-riding** — no changes to existing APIs;
   SD-JWT VC / OpenID4VP / RFC 9421.

## 6. Phase plan and submission shape

| Phase | Predicate family | Backing CAMARA API | Flagship use case |
|---|---|---|---|
| 1 | **SIM swap age** | `sim-swap` | Bank authorizes transfer on "unswapped ≥ N days" — never receives a timestamp |
| 2 | **Number verification** | `number-verification` | Sign-up proves control + carrier verification without exposing the number |
| 3 | **Roaming & presence predicates** | `device-roaming-status`, `location-verification` | §7.1 — the multi-case expansion |
| 4 | **Device/tenure/KYC predicates** | `device-status`, `kyc-match` | "Account tenure > 2y", "postpaid", KYC match as boolean |

Each phase = one attestation type + one predicate profile + one reference
verifier. Phase 1 alone is a complete, demoable story.

**Submission shape — profile first, new API second:**

- **Commonalities** (owns catalog-wide design guidelines): §3 as a
  design-guideline profile any API can adopt.
- **ICM** (owns consent/auth profiles): the consent-is-structural argument
  and the auth-flow hooks.
- **Per-API adoption PRs** to existing sub-projects (sim-swap first:
  nonce+expiry on `/check`) — small diffs; existing APIs become the profile's
  examples.
- **CarrierAttestation as the new-case repo** (§10) only for what no existing
  API covers: agent-grade floor profiles, Mode B presentment.

## 7. Why this generalizes

### 7.1 The roaming expansion

`Device Roaming Status` in lookup mode is a **tracking API** — requesters learn
where subscribers are, continuously. The same facts as predicates:

| Use case | Predicate proven | What the requester does NOT learn |
|---|---|---|
| Bank fraud rules | "device is (not) roaming" / "device in country of card transaction" | which country, travel history, MSISDN |
| Content licensing | "device in licensed region R" | exact country, identity |
| Travel insurance activation | "roaming outside home country since date D" | destination |
| Regulatory / sanctions gating | "device NOT in embargoed region" | actual location |
| Duty-of-care / workforce | "employee's device reached destination country" | carrier, number |
| Roaming-aware pricing/offers | "currently roaming on partner PLMN" | subscriber identity until opt-in |

One issuance rail + pluggable predicates ⇒ every new CAMARA status API
becomes a new attestation type for free. **This is not one API; it is a
consumption mode the whole catalog inherits.**

## 8. Stakeholder value

- **Operators**: keep attestation revenue (metered like lookups); shed
  query-log liability (less retained PII, cleaner GDPR/ePrivacy posture); a
  differentiated "privacy-grade" tier where raw APIs face procurement
  resistance.
- **Aggregators** (Vonage/Infobip/Aduna/hyperscalers): a premium product
  tier; verification-side network effects.
- **Relying parties**: data-minimization compliance by construction; no PII
  custody for facts needed only as booleans; offline verification.
- **Subscribers**: facts about their network life move only in minimal form;
  unlinkable across services.
- **CAMARA/GSMA**: an answer to the "telco surveillance API" criticism before
  regulators write it for them; direct eIDAS 2.0 alignment.

### 8.1 The A2P lesson: the aggregator as blind hub

> **RETRACTED 2026-08-28 — two claims in this section were unverified and
> did not hold up.** This section previously opened with "A2P SMS decayed
> because the middle layer could see and arbitrage per-message value: grey
> routes, spam, fake DLRs, SIM farms," and later asserted "history (A2P)
> shows accumulated middle-layer value gets monetized against the
> ecosystem." An adversarial grounding pass on 2026-08-28 found: total A2P
> messaging spend is **growing**, not declining (~$75–90B, 4–7% forecast
> CAGR; SMS A2P volume itself still grows ~2.6% CAGR) — what is real is a
> channel-mix shift, SMS's share eroding toward app-based channels
> (WhatsApp Business, RCS), not a fall of A2P as a category. And no
> regulator finding, enforcement action, or documented incident ties A2P
> aggregators or messaging hubs to overselling or monetising subscriber
> demographic/PII data — the closest superficially-adjacent evidence (FTC
> actions against Gravy Analytics/Mobilewalla) concerns location-data
> brokers in mobile ad-tech/RTB, a different industry, and citing it here
> would be a category error. What A2P **does** evidence, and remains
> grounded, is a mechanism: grey routing and artificially inflated traffic
> (AIT) are documented, GSMA-named integrity failures that depend on a
> middle layer able to *see* per-message value — see §1.1. The corrected
> position follows; the aggregator mechanics below (blind hub, per-query
> billing, Mode A/Mode B behaviour, no-grey-route-surface) are design
> arguments, unaffected by the retraction, and are kept as originally
> written.

A2P SMS demonstrates the mechanism this profile is built to structurally
foreclose: a middle layer that can see per-message value creates the
option to arbitrage it — grey routing and artificially inflated traffic
(AIT) are the documented, GSMA-named cases (§1.1). Trusting an aggregator's
promise not to look is not a structural fix, whether or not any aggregator
has actually broken that promise. This profile removes the capability
rather than relying on the promise:

- **Aggregator role = connection hub.** One signup → every connected network;
  the hub *fulfills and bills*, nothing more.
- **Mode A: per-query billing continues, blind** — request/response are
  end-to-end encrypted requester↔operator; the hub sees metering envelopes (count,
  route, bill) but never numbers, predicates, or answers. Existing
  revenue-share commercials continue unchanged.
- **Mode B: presentment never touches the hub** — issuance passes through as
  ciphertext; verification is against operator keys.
- **No grey-route surface**: arbitrage needs *visible* per-message value; a
  hub that can count but not read has nothing to arbitrage, and billing
  reconciles independently from operator-side and requester-side counts.

The aggregator keeps distribution, contracts, and developer experience — the
revenue role — and loses only the surveillance option and the arbitrage
surface. Stated as a design goal: **the middle layer must not be able to
accumulate value beyond carriage, because a middle layer able to see
per-message value has, in A2P, a documented history of that visibility
being arbitraged (grey routes, AIT) — a structural risk this profile
removes by construction rather than a historical inevitability it assumes.**

## 9. Risks / open questions

1. **"SD-JWT is enough, why ZK?"** — expected pushback. Answer: selective
   disclosure hides *fields*; it does not give unlinkability across
   presentments or predicate proofs over values ("age > 90d" without the
   date). v1 profiles SD-JWT for adoption; the proof layer stays pluggable.
2. **Holder availability** (Mode B) — OS wallets (EUDI) are arriving on the
   right timeline; v1 may need a reference holder app/SDK.
3. **Issuance authentication** — silent auth on the cellular data path is the
   natural mechanism and is already how `number-verification` works.
4. **Operator incentive asymmetry** — the query log has value to operators;
   expect quiet resistance. Counter: regulatory posture + a new billable
   issuance tier + the surveillance criticism CAMARA already attracts.
5. **Aggregator capture** — an aggregator could implement presentment
   proprietarily. Standardizing in CAMARA first is precisely the defense.
6. **Author bandwidth** — solo + staleness rules; mitigate by recruiting a
   member-company co-owner early.
7. **Billing** — resolved for Mode A by design (blind metering preserves
   per-query billing and revenue share). Metered issuance applies only to
   Mode B and is deferred with it.
8. **MNP vs tenure** — porting resets the operator relationship, so
   `tenure ≥ 2y` punishes honest porters, not farms. Options: porting-aware
   continuity attestation (old operator attests tenure at port), or combined
   tenure across ports. Open design question.
9. **Trust directory** — verifiers need operator public keys per PLMN: a
   PKD-analog. GSMA RAEX/IR.21-style distribution is the natural rail; who
   governs it is the one unavoidable centralization point.
10. **Cloud agents cannot silent-auth** — the SIM is in the human's pocket;
    agents run in datacenters. Issuance lands on the holder's phone; agents
    carry scoped, expiring, monotonically-tightened delegations from it.
    Architectural requirement, not an option.
11. **Residual issuance metadata** — the operator inevitably knows it issued
    attestation type T to subscriber S at time t (never to whom it was
    presented). Stated honestly; batched/scheduled issuance blurs timing
    correlation.

## 10. APIBacklog template mapping (CarrierAttestation new case)

Pre-filled against `documentation/API-proposal-template.md` (re-verified
2026-08-14, re-verified again 2026-08-24 and 2026-08-25, including the
scope-alignment section added to the template). Copy-paste at filing time
after re-verification. Supporters are populated by the Working Group during
evaluation, downstream of filing — the template's own Supporters field
reads verbatim: "List of supporters. *NOTE: That shall be added by the
Working Group.*" — so supporters are not a precondition here (PRD no-go 12,
retired 2026-08-25). Filing sequence: open the issue in
`camaraproject/APIBacklog` first, using its issue template, then submit the
PR adding this filled template, linked to that issue.

- **API family name:** CarrierAttestation
- **API family owner:** Cairenes Solutions
- **API summary:** Signed, nonce-bound, expiring predicate attestations over
  network facts operators already compute (SIM-swap age, tenure, subscription
  class), under monotone floors — for the cases no existing API covers:
  agent-grade floor bundles (§3.4) and holder presentment (§5). Business
  cases: (1) bank authorizes a transfer on "unswapped ≥ 90d" without
  receiving a timestamp; (2) an AI agent presents a floor-gated carrier
  credential ("voice+data ∧ tenure ≥ 2y ∧ swapAge ≥ 90d") to a service that
  never learns the MSISDN; (3) content service verifies "device in licensed
  region" without location custody.
- **Northbound API type:** Service API.
- **Scope fit with CAMARA:** customer-facing northbound exposure of telco
  network capabilities (subscription facts, SIM lifecycle, network
  authentication); no east-west/federation surface. Consumption modes are
  additive to existing catalog APIs, per Project Charter scope.
- **Proposal owner declaration:** the proposal owner confirms this proposal
  has been reviewed against the current CAMARA Project Charter scope (see
  §11 for the Charter reference) and fits within it as described above.
- **Telco capability exposed:** operator-held subscription and SIM-lifecycle
  facts (swap recency, tenure, SIM type/class) plus network-session
  authentication (silent auth), exposed as signed predicates rather than raw
  values.
- **Overlap with existing CAMARA APIs:** reviewed 2026-08-14 — no overlap.
  Existing APIs (sim-swap, number-verification, kyc-age-verification) are
  the *adoption targets* of the horizontal profile (§3, proposed via
  Commonalities); CarrierAttestation covers only what none of them expose:
  floor-bundle attestations and holder presentment.
- **Explicit out-of-scope items:** raw-value retrieval of any kind; identity
  assertion (no name/document facts); consent framework changes (rides ICM);
  the aggregator's commercial model (unchanged by design).
- **Technical viability:** every attested fact is already computed for
  existing catalog APIs; issuance authentication = the network-auth mechanism
  `number-verification` uses today; signing/verification = SD-JWT VC + JWKS
  per PLMN (standard tooling operators need for eIDAS 2.0 regardless).
- **Commercial viability:** open-source reference PoC in this repo (`poc/`,
  Node, zero dependencies); SD-JWT VC / OpenID4VCI/VP open-source stacks
  available; per-query billing preserved in Mode A by construction.
- **YAML code available:** YES — illustrative sketch at
  `spec/carrier-attestation.yaml` (non-normative draft).
- **Validated in lab/productive environments:** YES, sandbox tier only — the
  Mode A PoC was run live against the Orange Network APIs Playground, an
  operator public sandbox environment (not a production network), exercising
  Orange's test tier with scripted test numbers. User-run, by exit code, all
  green: `m5-check-live.mjs` 20/20 and `demo.mjs --backend orange` 35/35
  (CHANGELOG 0.5.0, 2026-08-18), with an injected clock and quota accounted
  1-of-10 custom slots at both start and end. No production environment has
  been exercised.
- **Validated with real customers:** NO.
- **Validated with operators:** NO — no operator has reviewed or validated
  this proposal. Naming supporters is Working Group business that happens
  during evaluation, downstream of filing (see header note above); no
  recruitment is currently underway.
- **Supporters in API Backlog Working Group:** left blank per the template's
  own instruction: "List of supporters. *NOTE: That shall be added by the
  Working Group.*" (Our own targeting note, not a claim of existing support:
  ICM's privacy-forward operator pool — DT, Orange, Telefónica — looks like
  the likely fit to approach once the issue and PR exist.)

## 11. References

- CAMARA API Backlog process & template:
  https://github.com/camaraproject/APIBacklog
  (`documentation/APIbacklog.md`; `documentation/API-proposal-template.md`,
  re-verified 2026-08-14, re-verified again 2026-08-25; filled examples under
  `documentation/SupportingDocuments/API proposals/`)
- CAMARA governance/structure: https://camaraproject.org/structure/ ·
  https://github.com/camaraproject/Governance/blob/main/ProjectStructureAndRoles.md
  · Project Charter:
  https://github.com/camaraproject/Governance/blob/main/ProjectCharter.md
- Device Roaming Status API: https://camaraproject.org/device-roaming-status/
  · Orange sandbox: https://developer.orange.com/apis/camara-device-roaming-status
- GSMA Open Gateway status (MWC 2026: 86 groups / 300+ networks / 80% of
  connections / 300+ launches / 65 markets):
  https://www.gsma.com/newsroom/article/from-ambition-to-execution-how-open-gateway-is-scaling-the-global-api-economy/
- Open Gateway 1Q26 update:
  https://camaraproject.org/wp-content/uploads/sites/12/2026/02/Open-Gateway-1Q26-Update.pdf
- Spec verification (2026-08-14, re-verified 2026-08-24): SimSwap v2.1.0
  (`/check`, `/retrieve-date`, `/retrieve-age-band`):
  https://github.com/camaraproject/SimSwap · NumberVerification v2.1.0
  (`/verify`, `/device-phone-number`; TS.43 or OIDC `prompt=none`, 3-legged,
  AMR-validated): https://github.com/camaraproject/NumberVerification ·
  KnowYourCustomer split into three repos post-Spring25: kyc-match (r1.2,
  v0.4.0) https://github.com/camaraproject/KnowYourCustomerMatch ·
  kyc-fill-in (r1.3, v0.4.1)
  https://github.com/camaraproject/KnowYourCustomerFill-in ·
  kyc-age-verification (r1.3, v0.2.1, Sandbox per its lifecycle badge, though
  its own README body text still says "Incubating stage since February 2025" —
  a contradiction, not resolved here)
  https://github.com/camaraproject/KnowYourCustomerAgeVerification
- MWC26 agentic demo:
  https://www.mwcbarcelona.com/articles/mplify-colt-orange-google-cloud-and-gsma-open-gateway-demonstrate-agentic-connected-experiences-at-mwc26-barcelona
- Format layer candidates: SD-JWT VC (IETF OAuth WG), OpenID4VCI / OpenID4VP,
  W3C Verifiable Credentials 2.0, BBS+ (W3C/DIF)
- eIDAS 2.0 / EUDI Wallet ARF — holder-wallet convergence timeline
- One existing implementation of the document-rooted principal layer referenced
  in §3.4/§1.1 exists in the authors' prior work (8een/zkagent); this proposal
  is standards-neutral and does not depend on it.
