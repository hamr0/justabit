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
  <img src="https://img.shields.io/badge/status-filed%20%2F%20submitted%2C%20not%20adopted-yellow" alt="status: filed / submitted, not adopted">
  <img src="https://img.shields.io/badge/tracks-CAMARA%20%2B%20IETF-2a4f8c" alt="tracks: CAMARA + IETF">
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

> **Status: filed and submitted, not approved or adopted.** CAMARA: issue #330 and PR #331
> are filed and open, awaiting Working Group evaluation; a v2 rescope is being reshaped as a
> Commonalities enhancement and has not yet been filed. IETF: `draft-hamr-oauth-agent-delegation-00`
> is submitted and live on the Datatracker as an individual draft — not a working-group
> document, not adopted. This repo is the staging ground for two tracks: **CAMARA**
> (operator/attestation side) and **IETF** (agent/delegation side).

## Two modes

How much the response mode removes is the spine of the proposal, so it is the first thing
an adopter chooses.

**Mode A — attested query response.** Today's rail unchanged: requester → aggregator → operator,
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
honestly: [`camara/v1/docs/camara-attested-windowed-disclosure.md`](camara/v1/docs/camara-attested-windowed-disclosure.md) §3 (v1, as filed).

## Why a profile, not one more API

CAMARA's own catalog is already halfway here and stopped. `/retrieve-age-band` (unreleased,
`main` only — not in any tagged SimSwap release) coarsens a
response because raw timestamps over-disclose. `GET /device-phone-number` already takes no
request body at all — it derives the line from the 3-legged access token instead of asking
for an identifier. `kyc-age-verification` already ships as a boolean predicate API in the
catalog. Every one of those is the working group's own precedent.

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
docs/product/       prd.md — the PRD that leads everything: requirements,
                    sequence, no-go list
                    camara-attested-windowed-disclosure.md — stub: file
                    moved 2026-08-31, kept so the filed APIBacklog links
                    keep resolving (GitHub has no redirects)
docs/logs/          findings.md — dated evidence + decision log
docs/archive/       aaif-agent-auth.md — superseded 2026-08-25, dated
                    record only (agent side now lives at
                    ietf/v1/docs/ietf-agent-delegation.md)
camara/v1/docs/     frozen record of what was actually filed 2026-08-28:
                    camara-attested-windowed-disclosure.md (the CAMARA
                    proposal), camara-filing-issue.md (step 1: the GitHub
                    issue body), camara-filing-template.md (step 2: the
                    filled API-proposal template), plus the 2026-08-31
                    reviewer feedback
camara/v1/poc/      Mode A demo: mock backend by default, Orange Network
                    APIs Playground as a swappable live backend
camara/v1/spec/     carrier-attestation.yaml — OpenAPI sketch (CAMARA-style)
camara/v2/docs/     working copy being reshaped per the 2026-08-31 feedback
                    — not filed
camara/v2/poc/      working copy of camara/v1/poc/, copied unchanged
camara/v2/spec/     working copy of camara/v1/spec/, copied unchanged
ietf/v1/docs/       frozen record of draft-hamr-oauth-agent-delegation-00
                    as posted 2026-08-31 (agent/delegation side, OAuth WG
                    target); ietf-agent-delegation.md is the companion
                    prose proposal
ietf/v1/poc/        the actionClass floor axis spike (M7) this -00 record
                    was validated against; copied unchanged into v2
ietf/v2/docs/       working copy for -01 (not yet submitted): items 1-2 and
                    Appendix A direction 4 done (Floor Axis Registry; Position
                    Among Delegation Layers; harness-side experience);
                    items 3-4 pending
ietf/v2/poc/        copy of ietf/v1/poc/; only the run-path comment in
                    m7-check.mjs differs (2026-09-01); spike-a/ holds the
                    catalogue-survey dataset (specs/ omitted, reproducible
                    from its SHA column), moved in 2026-09-01
```

## The two tracks

Each track cites the other as its counterpart; neither depends on the other's approval.

- **[CAMARA](camara/v1/docs/camara-attested-windowed-disclosure.md)** — the
  operator/attestation side (v1, as filed; v2 rescoping working copy at
  `camara/v2/docs/`). What the operator attests and how it travels. Profile to
  Commonalities, consent hooks to ICM, adoption PRs to sim-swap and roaming-status,
  new-case proposal to APIBacklog (template pre-filled in §10).
- **[IETF](ietf/v1/docs/ietf-agent-delegation.md)** — the agent/delegation side (v1, as
  posted; v2 -01 working copy at `ietf/v2/docs/`, not yet submitted). What the
  agent carries and how permissions flow: floor-gated SIM attestation, scoped monotone
  delegations, presentment via RFC 9421. The OAuth Working Group (`oauth@ietf.org`) is
  the target.

**They meet at the RFC 9421 header.**

## The PoC

A Mode A demo proving four assertions — each shown with its negative: windowing (never a
raw value on the wire), nonce + validity (replay fails, responses expire), blind hub (the
hub's own log shown on screen — metering records only, reads yield ciphertext), and
monotone floor (looser queries rejected, never silently widened).

**Status:** all six modules M1–M6 are built and user-validated at their current counts.
Run the demo with
**`node camara/v1/poc/demo.mjs`** — zero credentials, zero network, against a built-in mock operator
with scriptable backstories; `--backend orange` re-proves the same code path live on the
Network APIs Playground with a free Orange developer account. Each module also has its own
check, negatives first, exit code 0 only if every case holds: `m1-check.mjs` (20 cases),
`m2-check.mjs` (10), `m3-check.mjs` (26), `m4-check.mjs` (40), `m5-check.mjs` (60, an
offline replay of live-captured responses; `m5-check-live.mjs` re-proves 19 cases against
the real Playground) and `m6-check.mjs` (46, offline in both backend modes).
**The user ran the full validation suite on their own machine at code commit `4446517` /
docs commit `c921508` (2026-08-18 08:16): every suite clean, zero `FAIL`, zero
`TypeError`, zero `Error:` lines in the entire log** — `m1-check.mjs` 20/20,
`m2-check.mjs` 10/10, `m3-check.mjs` 26/26, `m4-check.mjs` 40/40, `m5-check.mjs` 60/60,
`m6-check.mjs` 46/46, `demo.mjs` (mock) 33/33, `demo.mjs --backend orange` (live, real
Orange Playground) 33/33, `m5-check-live.mjs` (live, real Orange Playground) 19/19.
**Both gates are MET at `4446517`** — G1 (M1–M4 + M6 all user-validated) and G2 (M5
user-validated live) — the first time in this project both have been met at the same
commit, on a tree that had already been through two `/code-review` rounds with every
fix mutation-proven. This record covers `4446517`/`c921508` only, per this repo's
standing rule that a user record does not transfer to a later change. See
`docs/logs/findings.md`, 2026-08-18 (latest).
Requirements live in the [PRD §4](docs/product/prd.md); status, setup and caveats in
[`camara/v1/poc/README.md`](camara/v1/poc/README.md).

## Lineage

- **zkagent** — the *window* vocabulary (disclosure width, narrow by default, monotone
  tightening) and the delegation model agents carry.
- **8een** — the one-bit verifier pattern, trust-anchor handling, and the evidence
  discipline (claims pinned to file/line/commit; retractions kept).
- **CAMARA's own specs** — `/retrieve-age-band` (unreleased, `main` only), `GET
  /device-phone-number`'s no-body shape, `kyc-age-verification`: the catalog is already
  halfway here. This profile finishes the trajectory, catalog-wide.

## License

Apache License, Version 2.0 (CAMARA-compatible) — see [LICENSE](LICENSE).
