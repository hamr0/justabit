# Attested Windowed Disclosure — a horizontal profile for CAMARA network APIs

### with CarrierAttestation as the new-case proposal for what no existing API covers

**Author:** Amr Hassan, independent telecom consultant (10 yrs wholesale roaming / signaling / SoR)
**Status:** Draft v0.2 — pre-submission (not yet filed; supporters not yet recruited)
**Date:** 2026-08-15
**Targets:** CAMARA Commonalities (profile as design guideline) · ICM (consent/auth hooks) · existing sub-projects (adoption PRs) · APIBacklog (CarrierAttestation new case — template mapping in §10)
**Companion:** the agent/delegation side is proposed separately to AAIF (`aaif-agent-auth.md`); the two meet at the RFC 9421 header and neither depends on the other.

---

## 1. Executive summary

CAMARA APIs today follow a **lookup model**: a relying party (RP) sends a
subscriber identifier (MSISDN) to an operator and receives a fact back ("SIM
not swapped", "number verified", "device roaming in FR"). The answer is
minimal; the **query path is not**. Every check ships an identifier, creates a
carrier-side log of *which RP asked about which subscriber and when*, and
returns raw values (timestamps, countries, the phone number itself) that are
linkable across RPs and across time.

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
coarsens a response because raw timestamps over-disclose; 3-legged flows
mandate identifier-free requests; `kyc-age-verification` is a boolean
predicate API in production. The ask is not "approve my API" but **finish
what you started, catalog-wide.** Same trust root (the operator), same
commercial model (per-query billing and aggregator revenue share unchanged),
zero new surveillance byproduct.

A second, additive consumption mode — **holder presentment** (§5) — is
sketched for the cases the profile alone cannot reach (no inbound identifier
at all, no operator query log); it is roadmap, not the wedge.

## 2. Problem statement

| Leak | Lookup model today | Consequence |
|---|---|---|
| Identifier travels | RP → aggregator → operator, carrying MSISDN | RP must hold/process the number even when it only needs a boolean; GDPR minimization tension |
| Query log | Operator/aggregator logs (RP, subscriber, time, API) | A new cross-industry metadata stream: who banks where, who registered on which platform, when |
| Linkability | Responses keyed to the same identifier everywhere | Any two RPs (or one RP over time) can correlate a subscriber's checks |
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
| KYC (r2.2, split into 3 repos post-Spring25) | `kyc-match` → per-field match scores; **`kyc-age-verification` → boolean age-threshold predicate** | **`kyc-fill-in` → returns name/address/birthdate from operator KYC records** |

*Verified against spec YAMLs and repos 2026-08-14 (all Incubating stage since
Feb 2025).* Three verified precedents frame this proposal as completion, not
novelty: **(a)** `/retrieve-age-band` is already a windowing move — CAMARA
itself ships a precision-coarsened variant, conceding raw timestamps
over-disclose; **(b)** in 3-legged flows the spec **mandates** identifier-free
requests — `phoneNumber` "MUST NOT be included" when derivable from the
access token; **(c)** `kyc-age-verification` proves the boolean-predicate
pattern is already accepted in production. What is missing is the query-path
and retention discipline around them.

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
   derivable from the access token (generalizes the existing 3-legged rule:
   `phoneNumber` "MUST NOT be included").
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
   predicates, or answers. (The A2P lesson, §8.1: middle layers that can
   read, eventually monetize.) Envelopes **MUST NOT** expose payload size to
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
| kyc | `kyc-age-verification` conforms; `kyc-match` conforms (scores are bands); `kyc-fill-in` excluded |

#### 3.3.1 What that looks like on the wire (illustrative, non-normative)

**This table is an EXAMPLE of adoption, not a rule.** It adds nothing to §3.2 —
the normative profile enumerates no predicate types and mandates no field
names. It exists because "conforms with nonce+expiry added" is abstract until
you see the same subscriber fact in both shapes, and because reviewers
consistently ask what a catalog API *returns* under the profile.

| Catalog API | Retrieval shape today | Profile-mode shape (illustrative) |
|---|---|---|
| sim-swap `/retrieve-date` | `{"latestSimChange":"2026-04-18T00:00:00Z"}` | excluded from profile mode; the question becomes ↓ |
| sim-swap `/check` | `{"swapped": true}` over a `maxAge` window | `{"predicate":"simSwapAge≥P90D","result":true,"nonce":"…","exp":"…","sig":"…"}` |
| number-verification `/verify` | `{"devicePhoneNumberVerified":true}` | same, plus nonce+expiry binding and a signature over the closed claim set |
| number-verification `/device-phone-number` | `{"devicePhoneNumber":"+33…"}` | excluded from profile mode (returns the identifier itself) |
| kyc `kyc-age-verification` | `{"ageCheck":"true"}` | `{"predicate":"age≥18","result":true,…}` |
| kyc `kyc-match` | per-attribute match scores | conforms as-is — scores are already bands (rule 7) |
| kyc `kyc-fill-in` | attribute values | excluded from profile mode |
| device-roaming-status | `{"roaming":true,"countryName":["FR"]}` | `{"predicate":"roamingIn[FR,DE]","result":true,…}` — country in, boolean out |
| device-reachability-status | `{"reachabilityStatus":"CONNECTED_DATA"}` | `{"predicate":"reachable=true","result":true,…}` |

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
2026-08-14; see §11). The right-hand column is this profile applied to them —
the shapes in it are the ones the PoC actually produces, not sketches.

### 3.4 Agent-grade floor (reference profile)

Agents are the "why now" (§7.2). Consumer-agent floor, only tightenable:

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
  the RP↔operator pairing (who queries whom, when). Rule 6 removes content,
  not the fact of the query; measured and recorded in the PoC findings log.

## 4. Two consumption modes

**Mode A — attested query response (primary; the adoption wedge).** The
existing rail, commercially unchanged: RP → aggregator → operator, per-query
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
- **Verifier / RP** — any service; verifies proofs against operator public
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
  domain and a session nonce — replay-useless elsewhere; two RPs cannot
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
  RP-facing wire entirely.
- **Issuance leg** (subscriber ↔ operator): no identifier is sent — network
  authentication on the live cellular session ("silent auth", the existing
  `number-verification` mechanism) tells the operator which SIM is asking.
- **Attestation subject**: a blinded commitment with per-RP scope and
  time-window epoch: `tag = HASH(subscriber_secret, rp_scope, epoch)`. The RP
  sees a predicate proof bound to this tag + its session nonce — nothing
  longitudinal, nothing cross-RP.
- **Windowing note**: fraud predicates need *freshness*, not continuity — the
  epoch window deliberately prevents even a single RP from building a profile
  over time. Bannable-identity cases use stable per-RP tags so consequence
  sticks. Stability vs. windowing is a per-attestation-type knob, not an
  architectural fork.
- **Precedent**: 5G already conceals the permanent identifier on the air
  interface (SUPI → one-time SUCI); CAMARA already supports identifier-free
  implicit identification (IP/session-based). This extends an accepted
  principle — long-lived identifiers must not travel — from the radio and
  session layers to the API layer.

### 5.5 What this is NOT

- Not a replacement or breaking change to any existing CAMARA API — the
  lookup model remains for server-to-server cases with consent.
- Not an identity system — attests network facts only; deliberately
  composable with (not competing with) EUDI wallet PID.
- Not a new consent framework — it *is* consent made structural: nothing
  moves without the holder presenting.

### 5.6 Design principles

1. **Attest facts, never identities** — operators sign predicates; RPs
   consume booleans.
2. **No long-lived identifier leaves the operator** — MSISDN/IMSI resolved
   internally at issuance (silent auth); the wire carries
   `HASH(sim_secret, rp_scope, epoch)`.
3. **Holder-mediated: consent is structural** — nothing flows operator→RP
   directly; no presentment, no data, no log.
4. **Nonce'd + expiring** — replay-dead, retention-hostile; what an RP stores
   is correlation-worthless.
5. **Disclosure window, narrow by default, monotone tightening** — one bit by
   default; widening requires an explicit, holder-visible request; floors
   only tighten downstream.
6. **Time window as a per-type knob** — epoch-windowed tags for fraud
   predicates, stable per-RP tags for bannable identity. Same derivation,
   different epoch policy.
7. **Policy at the edge, facts at the core** — operator = issuer of attested
   facts and published floors; RP = chooses required predicates; neither sees
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

`Device Roaming Status` in lookup mode is a **tracking API** — RPs learn
where subscribers are, continuously. The same facts as predicates:

| Use case | Predicate proven | What the RP does NOT learn |
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

### 7.2 Agentic AI — the "why now"

MWC26 demonstrated agents autonomously invoking network APIs (QoD on Orange
via Open Gateway, Mplify LSO on Colt, Number Verification via Google
Firebase) — agents observing, deciding, and acting as network principals. Two
consequences:

1. **The query-log problem scales to machine speed.** Agentic consumption
   means high-frequency automated calls; in the lookup model every one ships
   an identifier and lands in a log. The §2 metadata stream grows by orders
   of magnitude precisely as agents mainstream.
2. **Carrier predicates as SIM-farm resistance for agent auth.** A SIM cannot
   be an agent's *principal root* — prepaid SIMs are ~$1 and farmable — but
   subscription-quality predicates (§3.4) are near-free for real subscribers
   and expensive at farm scale. Layering: a human-scarcity principal proof
   proves the accountable human; a delegation credential names the agent;
   carrier floors price out the farm. Complementary trust roots, one wire
   format (W3C VC + RFC 9421). The agent/delegation side is proposed to AAIF
   separately (`aaif-agent-auth.md`).

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

A2P SMS decayed because the middle layer could see and arbitrage per-message
value: grey routes, spam, fake DLRs, SIM farms. The trust model was "the
aggregator promises not to" — and it always eventually did. This profile
fixes that structurally, not contractually:

- **Aggregator role = connection hub.** One signup → every connected network;
  the hub *fulfills and bills*, nothing more.
- **Mode A: per-query billing continues, blind** — request/response are
  end-to-end encrypted RP↔operator; the hub sees metering envelopes (count,
  route, bill) but never numbers, predicates, or answers. Existing
  revenue-share commercials continue unchanged.
- **Mode B: presentment never touches the hub** — issuance passes through as
  ciphertext; verification is against operator keys.
- **No grey-route surface**: arbitrage needs *visible* per-message value; a
  hub that can count but not read has nothing to arbitrage, and billing
  reconciles independently from operator-side and RP-side counts.

The aggregator keeps distribution, contracts, and developer experience — the
revenue role — and loses only the surveillance option and the arbitrage
surface. Stated as a design goal: **the middle layer must not be able to
accumulate value beyond carriage, because history (A2P) shows accumulated
middle-layer value gets monetized against the ecosystem.**

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
2026-08-14, including the scope-alignment section added to the template).
Copy-paste at filing time after re-verification; **do not file before
supporters are named** (see PRD no-go 12).

- **API family name:** CarrierAttestation
- **API family owner:** [independent contributor — co-owner from a member
  company to be recruited; see supporters]
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
- **Validated in lab/productive environments:** planned — Mode A PoC against
  Orange Network APIs Playground (mocked operator tier), lab tier as
  demo material. Will be updated to YES/lab before filing.
- **Validated with real customers:** NO.
- **Validated with operators:** NO (pre-submission; supporter recruitment in
  progress).
- **Supporters in API Backlog Working Group:** [to be named before filing —
  2–3 operator delegates; ICM's privacy-forward pool: DT, Orange, Telefónica]

## 11. References

- CAMARA API Backlog process & template:
  https://github.com/camaraproject/APIBacklog
  (`documentation/APIbacklog.md`; `documentation/API-proposal-template.md`,
  re-verified 2026-08-14; filled examples under
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
- Spec verification (2026-08-14): SimSwap v2.1.0 (`/check`,
  `/retrieve-date`, `/retrieve-age-band`):
  https://github.com/camaraproject/SimSwap · NumberVerification v2.1.0
  (`/verify`, `/device-phone-number`; TS.43 or OIDC `prompt=none`, 3-legged,
  AMR-validated): https://github.com/camaraproject/NumberVerification ·
  KnowYourCustomer r2.2 (`kyc-match`, `kyc-fill-in`, `kyc-age-verification`):
  https://github.com/camaraproject/KnowYourCustomer
- MWC26 agentic demo:
  https://www.mwcbarcelona.com/articles/mplify-colt-orange-google-cloud-and-gsma-open-gateway-demonstrate-agentic-connected-experiences-at-mwc26-barcelona
- Format layer candidates: SD-JWT VC (IETF OAuth WG), OpenID4VCI / OpenID4VP,
  W3C Verifiable Credentials 2.0, BBS+ (W3C/DIF)
- eIDAS 2.0 / EUDI Wallet ARF — holder-wallet convergence timeline
- One existing implementation of the document-rooted principal layer referenced
  in §3.4/§7.2 exists in the authors' prior work (8een/zkagent); this proposal
  is standards-neutral and does not depend on it.
