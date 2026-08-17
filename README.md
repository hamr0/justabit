```
                    ╭──────────────────────────────────────╮
                    │   ╦╦ ╦╔═╗╔╦╗╔═╗╔╗ ╦╔╦╗               │
                    │   ║║ ║╚═╗ ║ ╠═╣╠╩╗║ ║                │
                    │  ╚╝╚═╝╚═╝ ╩ ╩ ╩╚═╝╩ ╩                │
                    │                                      │
                    │   predicate + floor + nonce          │
                    │        ──→ one signed bit            │
                    ╰──╮───────────────────────────────────╯
                       ╰── network APIs that answer, not disclose
```

<p align="center">
  <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhamr0%2Fjustabit%2Fmain%2Frelease.json&query=%24.version&label=version&color=2a4f8c" alt="version (from release.json)">
  <img src="https://img.shields.io/badge/status-pre--submission%20draft-orange" alt="status: pre-submission draft">
  <img src="https://img.shields.io/badge/tracks-CAMARA%20%2B%20AAIF-2a4f8c" alt="tracks: CAMARA + AAIF">
  <img src="https://img.shields.io/badge/license-Apache%202.0-2a4f8c" alt="license: Apache 2.0">
</p>

**"Just a bit. Never more, never less."**

A standards effort to make telecom network APIs answer with exactly what the requester
needs — a windowed, nonce-bound, expiring boolean — and nothing else, ever. Operators keep
the revenue; aggregators stay blind carriage; requesters get compliance-grade minimal
answers; subscribers stop leaking.

CAMARA / GSMA Open Gateway network APIs answer useful questions (SIM swapped? number real?
device roaming?) but the current lookup model ships identifiers on the wire, returns raw
values (timestamps, countries, the phone number itself), lets the middle layer see
everything, and leaves retainable data everywhere. Consent today is a string logged next to
the query.

The fix is **attested windowed disclosure**: the requester states a predicate and a floor,
supplies a nonce, and receives a signed boolean bound to that nonce, valid for the duration
of the query — end-to-end encrypted past the aggregator, which fulfills and bills but
cannot read.

> **Status: pre-submission draft.** Nothing here has been filed to any standards body yet.
> This repo is the staging ground for two tracks: **CAMARA** (operator/attestation side)
> and **AAIF** (agent/delegation side).

## Two modes

How much the response mode removes is the spine of the proposal, so it is the first thing
an adopter chooses.

**Mode A — attested query response.** Today's rail unchanged: RP → aggregator → operator,
same per-query billing and revenue share. Only the payload discipline changes. Removes
over-disclosure, middle-layer visibility, and response retainability.
> *"Was this SIM swapped in the last 90 days?"* → a signed `true`, nonce-bound, expiring.

**Mode B — holder presentment.** Attestations issued to the subscriber's device; the
holder or agent presents proofs. Additionally removes the inbound identifier and the
operator query log. Requires holder-side software.
> *"This device is in a licensed region"* — proven without the operator being asked.

**Claims discipline** (inherited from zkagent: *the name may be aspirational; the claims
may not*): Mode A is attested windowed disclosure — it must never be described as
zero-knowledge. ZK language is reserved for Mode B. Mode A is the wedge; Mode B is the
roadmap.

## The profile

The primary deliverable is not a narrow new API but a **horizontal profile** — normative
rules any API answering questions about a subscriber or device can adopt. An operation
conforming to profile mode:

```
1. MUST return only the predicate result (boolean) or a declared band —
   never the underlying raw value (timestamp, country, number, address).
2. MUST echo the requester's nonce and the predicate being answered inside
   the signed response and MUST include an expiry; verifiers MUST reject
   wrong-predicate, replayed, or expired responses — and any payload with
   a duplicate claim key (one signed blob must never read true to one
   parser and false to another).
3. MUST sign with a key resolvable through the operator trust directory;
   verifiers MUST pin the expected operator key before verifying — an
   unsigned hint must never choose which key to trust.
4. MUST NOT carry a subscriber identifier derivable from the access token.
5. MUST treat floors as monotone — tightened downstream, never loosened.
6. MUST be end-to-end encrypted requester↔operator through an aggregator;
   the hub handles metering envelopes only and MUST NOT be able to read —
   envelopes MUST NOT expose payload size (fixed-length or padded).
7. SHOULD offer banded responses only as a transition from raw values.
8. Widening the window beyond one bit MUST be an explicit, distinct
   operation the consent flow can see — never a parameter default.
```

Full text with definitions, the per-API adoption checklist, and the residuals stated
honestly: [`docs/02-proposals/camara-attested-windowed-disclosure.md`](docs/02-proposals/camara-attested-windowed-disclosure.md) §3.

## Why a profile, not one more API

CAMARA's own catalog is already halfway here and stopped. `/retrieve-age-band` coarsens a
response because raw timestamps over-disclose. Three-legged flows already mandate
identifier-free requests — `phoneNumber` "MUST NOT be included" when derivable from the
token. `kyc-age-verification` already ships a boolean predicate API. Every one of those is
the working group's own precedent.

So the ask is not "approve my API" but "finish what you started, catalog-wide". One
issuance rail plus pluggable predicates means every new status API inherits the mode for
free — and the existing APIs become the profile's examples rather than its casualties.

## The agent-grade floor

Agents are why this is urgent: MWC26 demonstrated agents autonomously invoking network APIs,
which means the query log scales to machine speed. A SIM cannot be an agent's principal root
— prepaid SIMs are farmable — but subscription-quality predicates are near-free for real
subscribers and expensive at farm scale. The reference consumer-agent floor, tightenable
only:

```
simType  = voice+data      # excludes data-only IoT/M2M SIMs
tenure   ≥ 2 years         # aged subscriptions resist mass production
swapAge  ≥ 90 days         # kills swap-and-reset
class    = postpaid        # optional tightening
```

Machine agents (fleets, vehicles — no human document exists) get a *separate* profile that
deliberately embraces M2M SIMs. The two must not be conflated.

**Honest limit:** floors price identity resets — economic scarcity. They do not create
uniqueness. "One accountable human" still requires a document-rooted principal layer above
this profile.

## Repo map

```
docs/01-product/    prd.md — the PRD that leads everything: requirements,
                    sequence, no-go list, decisions log
docs/02-proposals/  camara-attested-windowed-disclosure.md — the CAMARA
                    proposal, carrying the normative profile (the standard)
                    aaif-agent-auth.md — the AAIF proposal (agent side only)
spec/               carrier-attestation.yaml — OpenAPI sketch (CAMARA-style)
poc/                Mode A demo: mock backend by default, Orange Network
                    APIs Playground as a swappable live backend
```

## The two tracks

Each track cites the other as its counterpart; neither depends on the other's approval.

- **[CAMARA](docs/02-proposals/camara-attested-windowed-disclosure.md)** — the
  operator/attestation side. What the operator attests and how it travels. Profile to
  Commonalities, consent hooks to ICM, adoption PRs to sim-swap and roaming-status,
  new-case proposal to APIBacklog (template pre-filled in §10).
- **[AAIF](docs/02-proposals/aaif-agent-auth.md)** — the agent/delegation side. What the
  agent carries and how permissions flow: floor-gated SIM attestation, scoped monotone
  delegations, A2A. Their Identity & Trust WG is the target.

**They meet at the RFC 9421 header.**

## The PoC

A Mode A demo proving four assertions — each shown with its negative: windowing (never a
raw value on the wire), nonce + validity (replay fails, responses expire), blind hub (the
hub's own log shown on screen — metering records only, reads yield ciphertext), and
monotone floor (looser queries rejected, never silently widened).

**Status:** all six modules M1–M6 are built. Run the demo with
**`node poc/demo.mjs`** — zero credentials, zero network, against a built-in mock operator
with scriptable backstories; `--backend orange` re-proves the same code path live on the
Network APIs Playground with a free Orange developer account. Each module also has its own
check, negatives first, exit code 0 only if every case holds: `m1-check.mjs` (20 cases),
`m2-check.mjs` (10), `m3-check.mjs` (23), `m4-check.mjs` (33), `m5-check.mjs` (48, an
offline replay of live-captured responses; `m5-check-live.mjs` re-proves 11 cases against
the real Playground) and `m6-check.mjs` (27, offline in both backend modes).
M1–M5 are validated by runs on the maintainer's own machine; **M6 is not yet — its
counts are agent-run, and that is marked as pending rather than rounded up.**
Requirements live in the [PRD §4](docs/01-product/prd.md); status, setup and caveats in
[`poc/README.md`](poc/README.md).

## Lineage

- **zkagent** — the *window* vocabulary (disclosure width, narrow by default, monotone
  tightening) and the delegation model agents carry.
- **8een** — the one-bit verifier pattern, trust-anchor handling, and the evidence
  discipline (claims pinned to file/line/commit; retractions kept).
- **CAMARA's own specs** — `/retrieve-age-band`, identifier-free 3-legged requests,
  `kyc-age-verification`: the catalog is already halfway here. This profile finishes the
  trajectory, catalog-wide.

## License

Apache License, Version 2.0 (CAMARA-compatible) — see [LICENSE](LICENSE).
