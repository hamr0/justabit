# CAMARA track — deliverables & process

## What we deliver to CAMARA

1. **The horizontal profile** (`docs/02-profile/`) → Commonalities as a design
   guideline proposal + ICM discussion for the consent/auth hooks. Primary ask:
   "finish what the catalog already started (`/retrieve-age-band`,
   identifier-free 3-legged, `kyc-age-verification`) — catalog-wide."
2. **Adoption PRs** to existing sub-projects (sim-swap first: nonce+expiry on
   `/check`) — small diffs that make existing APIs the profile's examples.
3. **CarrierAttestation new-case proposal** (`docs/01-proposal/`, distilled into
   the official API-proposal template) → PR to `camaraproject/APIBacklog` with
   named supporters — only for what nothing existing covers: agent-grade floor
   profiles, Mode B presentment.
4. **The PoC** (`poc/`) — Mode A demo on Orange Network APIs Playground; the
   demo that converts WG discussion into an agenda item.
5. If approved: CAMARA creates a Sandbox API repository in `camaraproject/`;
   we maintain it there. This repo stays the staging ground and PoC home.

## Process facts (grounded 2026-08)

- Template + filled examples: `github.com/camaraproject/APIBacklog`,
  `documentation/` (+ `SupportingDocuments/API proposals/`).
- Submission = PR to APIBacklog; discussed in Backlog WG; needs supporters;
  TSC approval → Sandbox repo.
- Staleness rules: frozen after 6+ weeks GitHub inactivity or owner missing
  3 consecutive WG meetings. Sustained presence is part of the deliverable.
- Sub-project cadence example (SimSwap, "Number Insights" sub-project):
  meetings every 4 weeks, Thu 07:30 UTC; mailing list; wiki minutes.
- Participation is open (Linux Foundation) — no membership fee to contribute;
  supporters historically come from member operators (ICM: DT, Orange,
  Telefónica are the privacy-forward usual suspects).

## Sequence

1. Circulate profile draft in ICM / GitHub Discussion — collect reactions,
   identify 2–3 operator supporters.
2. Build PoC (needs Orange Playground credentials).
3. File: Commonalities guideline proposal + first adoption PR (sim-swap).
4. File: APIBacklog PR for CarrierAttestation with named supporters.
5. Attend cadence; expect quarters, not weeks.
