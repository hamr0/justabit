# IETF -03 change plan

Date: 2026-10-22.
Status: APPROVED by the user 2026-10-22, with Q1-Q3 answered ("rewrite it
based on what i have given you, bareguard add intro to what it does today,
changes keep updating as it fits"). P1-P4 run before any XML change.
Source: `ietf/v4/docs/draft-hamr-oauth-agent-delegation-03.xml`, opened as a
copy of the posted `-02` with only the two revision stamps changed.
Branch: `ietf/03-rwx-reframe`.
Rulings: A1, B1, C1, D (no axis) — `docs/logs/findings.md`, 2026-10-22.

## 1. Rule for the edit

Technical calls are the user's. The agent's part is wording, clarity, and
checks against sources. This follows the OAuth WG notice of 2026-09-06.
The Introduction is drafted by the agent from the user's own points of
2026-10-22, and only from them; the user approves it before it is placed.
Every sentence must pass one test: could the author explain it at the mic
without notes. Plain IETF flow, no showy wording.

This is a reframe, not a rewrite. The size goal is to stay at or under
`-02`'s 34 text pages.

## 2. Checks before any text is written

| # | Check | Why |
|---|---|---|
| P1 | Fetch GitHub's fine-grained token permission levels, from the page the user gave: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens?apiVersion=2026-03-10 | The A1 comparison is a claim about another party's product |
| P2 | Fetch the WebMCP spec's hint names | rwxmap writes `readOnlyHint` and `consequentialHint`; the draft must not cite names from rwxmap's output alone |
| P3 | Re-fetch the MCP tool annotation names | `readOnlyHint` and `destructiveHint` are cited in the text |
| P4 | Pin one rwxmap commit and re-run the exam score from it the same day | rwxmap figures change; never carry one forward |

## 3. Rows

| # | Section (in `-02` line numbers) | Change | Kind |
|---|---|---|---|
| 1 | Header (lines 2, 5) | Revision stamps -02 to -03 | done at opening |
| 2 | Header date (line 17) | Set at submission | at submission |
| 3 | Abstract | Check only. It names r, w, x without defining them. Change only if the user wants the chmod reading named | check |
| 4 | Introduction, third bullet (lines 116-127) | Class definitions to the chmod reading | agent draft from the user's points; user approves |
| 5 | Introduction, fourth bullet (lines 129-147) | The cold-start problem; the M3 figures; the MCP mapping sentence | agent draft from the user's points; user approves |
| 6 | Introduction, problem paragraphs (lines 51-80) | How providers scope today, coarse and per provider, not per agent (needs P1) | agent draft from the user's points; user approves |
| 7 | §actionClass (lines 629-660) | Replace the definitions with D87. Remove "Whether a call can be undone is not the test". Unsure goes to x | normative |
| 8 | §Classification (lines 686-714) | DELETE method default w to x. "PUT, DELETE, or PATCH" becomes "PUT or PATCH" where it lists calls that are really x | normative |
| 9 | §Classification, last sentence | C1: a harness may classify a new API during a run, before it admits that API's first call | normative |
| 10 | §Publication (lines 763-788) | Tool description under D87; M3 figures; spec discovery often finds nothing; outputs (OpenAPI extension, MCP annotations, WebMCP hints, needs P2) | non-normative |
| 11 | §Publication | MCP mapping: r gives readOnlyHint true; w gives both false; x gives destructiveHint true (needs P3) | non-normative |
| 12 | §Implementation Status, rwxmap (lines 1235-1268) | New steps, pinned commit, M3 table, per-vendor rates, model-written labels, Jev figure with the shared-brief limit (B1), figures not comparable to `-02`'s | evidence |
| 13 | §Implementation Status, justabit PoC (lines 1206-1233) | State the PoC's class defaults as they are at submission (DELETE w, PATCH x today) | evidence |
| 14 | §Security Considerations | A1 honest-limit sentence: a w call can change another person's setting; a menu signer may class it as x | normative-adjacent |
| 15 | Test Vectors (lines 1614-1657) | Check V4, V6, V9, V11 do not depend on DELETE = w or on reach. V9 uses POST = x, unchanged | check |
| 16 | New appendix: Changes since -02 | The definition is replaced, not refined; DELETE default; C1 sentence; figures not comparable | new |
| 17 | [RWXMAP] reference (line 1513) | Title and date checked against the repo | check |
| 18 | Sweep | Every "own things", "beyond the caller", "repeatable", "undone", "another party" hit in the XML, README, CLAUDE.md, prd.md | sweep |
| 19 | §Implementation Status, new bareguard entry | What bareguard does today: r/w/x letters per tool, a three-letter ceiling per agent, a child no higher than its parent, unlisted calls denied, a human asked on rwxmap's `loose` marker. Taken from bareguard's README at a pinned commit | evidence |

## 4. Questions, decided 2026-10-22

- **Q1.** The agent drafts the Introduction from the user's points; the user approves it.
- **Q2.** bareguard gets an Implementation Status entry (row 19).
- **Q3.** The Changes appendices stay and are updated as the edit goes; "Changes since -02" is added (row 16).

## 5. After the text

The PoC is a separate module with its own go: `m7-actionclass.mjs` to
DELETE = x and PATCH = w, new cases, and their negative controls.
