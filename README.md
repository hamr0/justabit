# justabit

**Just a bit. Never more, never less.**

A standards effort to make telecom network APIs answer with exactly what the
requester needs — a windowed, nonce-bound, expiring boolean — and nothing else,
ever. Operators keep the revenue; aggregators stay blind carriage; requesters
get compliance-grade minimal answers; subscribers stop leaking.

> **Status: pre-submission draft.** Nothing here has been filed to any standards
> body yet. This repo is the staging ground for two tracks:
> **CAMARA** (operator/attestation side) and **AAIF** (agent/delegation side).

## The one-sentence problem

CAMARA / GSMA Open Gateway network APIs answer useful questions (SIM swapped?
number real? device roaming?) but the current lookup model ships identifiers on
the wire, returns raw values (timestamps, countries, the phone number itself),
lets the middle layer see everything, and leaves retainable data everywhere.
Consent today is a string logged next to the query.

## The one-sentence fix

**Attested windowed disclosure**: the requester states a predicate and a floor,
supplies a nonce, and receives a signed boolean bound to that nonce, valid for
the duration of the query — end-to-end encrypted past the aggregator, which
fulfills and bills but cannot read.

## Two modes

| | Mode A — attested query response | Mode B — holder presentment |
|---|---|---|
| Rail | today's RP → aggregator → operator, unchanged billing | attestation on subscriber device, agent/holder presents |
| Removes | over-disclosure, middle-layer visibility, retainability | additionally: inbound identifier, operator query log |
| Status | the adoption wedge (proposed first) | the roadmap (ZK enters here) |

**Claims discipline** (inherited from zkagent: *the name may be aspirational;
the claims may not*): Mode A is attested windowed disclosure — it must never be
described as zero-knowledge. ZK language is reserved for Mode B.

## Repo map

```
docs/01-proposal/    carrier-attestation-proposal.md — the master proposal
docs/02-profile/     attested-windowed-disclosure.md — the horizontal profile
                     (the actual standard: normative rules any API can adopt)
docs/03-submissions/ camara-plan.md, aaif-plan.md — per-body deliverables & process
spec/                carrier-attestation.yaml — OpenAPI sketch (CAMARA-style)
poc/                 Mode A demo against Orange Network APIs Playground
```

## Lineage

- **zkagent** — the *window* vocabulary (disclosure width, narrow by default,
  monotone tightening) and the delegation model agents carry.
- **8een** — the one-bit verifier pattern, trust-anchor handling, and the
  evidence discipline (claims pinned to file/line/commit; retractions kept).
- **CAMARA's own specs** — `/retrieve-age-band`, identifier-free 3-legged
  requests, `kyc-age-verification`: the catalog is already halfway here.
  This profile finishes the trajectory, catalog-wide.

## License

Apache 2.0 (CAMARA-compatible).
