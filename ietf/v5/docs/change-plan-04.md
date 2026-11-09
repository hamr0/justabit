# Change plan for draft-hamr-oauth-agent-delegation-04

Status: DRAFT for user approval, 2026-11-08. Nothing edited yet.

Scope (user, 2026-11-08): "add that model, the new numbers and broadening
of x to ietf, nothing more than that."

Base: posted -03, `ietf/v4/docs/draft-hamr-oauth-agent-delegation-03.xml`
(frozen). Work copy: `ietf/v5/docs/draft-hamr-oauth-agent-delegation-04.xml`.

Sources (all read 2026-11-08):
- rwxmap tag v0.11.0, commit feff27a, 2026-11-07. `docs/product/prd.md:104-138`
  (D137 text), `docs/wiki/decisions-log.md:148-153` (D134-D139), README exam #5.
- rwxlite tag v0.3.1, commit 5069dfa, 2026-11-07. fp32 sha256
  bbe1997d43020724f9eab9e42e8f6337e9640fe46f764b6fceac1eb1d000a3cf.
- rwx session answers, 2026-11-08 (training size, labellers), and its
  correction the same day: cite exam #6, not exam #5.
- RFC 10008, "The HTTP QUERY Method" (fetched from rfc-editor.org).

## Rows

| # | Section (-03 line) | Change | Why |
|---|---|---|---|
| 1 | actionClass, x (695-699) | Add the D137 test to x | broadened x |
| 2 | actionClass, new paragraph after the list | Access grants are x | broadened x |
| 3 | Classification (737-749) | QUERY = r, only if Q1 = yes | rwxmap D134 |
| 4 | Scope bullet in the Introduction (190-194) | New figures | new numbers |
| 5 | Menu Publication (828-841) | GET no longer "without reading names"; new figures | new version, new numbers |
| 6 | Implementation Status, rwxmap (1313-1365) | Rewrite to v4 rules, add rwxlite, exam #6 table, drop Jev (Q2) | all three |
| 7 | References | RWXMAP date November 2026; add RWXLITE; add RFC 10008 if Q1 | citations |
| 8 | Header | docName -04; date set on submission day | revision |
| 9 | New appendix "Changes since -03" | List rows 1-7 | revision |

Not changed: bareguard text (stays pinned at 962ed98), floors, budgets,
attenuation, menus, PoC citations, Test Vectors.

## Exact text

### Row 1. x definition (replaces the x `<dd>`)

the call cannot be undone: after it, no later call can put things back
the way they were, including anything anyone could have done in
between. This happens in two ways. The thing is gone: the call deletes
or purges it, or stops a job and its work is lost. Or it is out of the
caller's hands: the call sends, publishes, charges, refunds, or starts
a run, or it hands a secret or a right to someone.

### Row 2. New paragraph, before "Whose resource a call changes ..."

A call that grants or widens who can do what to which resource is x,
because someone can use the new access before it is taken back: for
example an access policy, a role or permission binding, an access
control list, a share or an invitation, or a deploy key. A call that
only narrows access is w. A call that sets or replaces access and does
not say whether it widens or narrows it is x. A policy that does not
control access, such as autoscaling, lifecycle, retention, or routing,
is w unless it is x for another reason.

### Row 3. Classification (only if Q1 = yes)

"GET, HEAD, and OPTIONS default to r" becomes "GET, HEAD, OPTIONS, and
QUERY [RFC10008] default to r".

### Row 4. Introduction scope bullet (replaces "One such tool ... 0.8% (...).")

One such tool, rwxmap [RWXMAP], with a small local classifier,
rwxlite [RWXLITE], was scored once on 1588 calls from five APIs neither
had seen. It gave the right class for 90.3% of calls, a tighter class
than needed for 7.5%, and a looser class for 2.2%
(implementation-status).

### Row 5. Menu Publication

Sentence A, replaces "It keeps GET, HEAD, and OPTIONS calls at r
without reading their names, so the risk in (security) applies.":

It keeps GET, HEAD, and OPTIONS calls at r unless the name is a one-way
action, such as logout or revoke, so the risk in (security) still
applies to a GET that changes something under another name.

(If Q1 = yes: "GET, HEAD, OPTIONS, and QUERY".)

Sentence B, replaces "One such tool, scored once on 4279 calls ...
0.8%;":

One such tool, scored once on 1588 calls from five APIs it had not
seen, gave the right class for 90.3% of calls, a tighter class than
needed for 7.5%, and a looser class than needed for 2.2%;

### Row 6. Implementation Status, rwxmap (replaces the rwxmap paragraph, table, limits paragraph, and Jev paragraph)

rwxmap [RWXMAP] is a work-in-progress tool that builds a menu from an
OpenAPI description. Its fixed rules start from the method default of
(classification) and then read words. A GET is raised to x when its
name is a one-way action, such as logout, revoke, or close. A PUT or
PATCH is raised to x by a path word, such as role, member, token, or
webhook, or by a verb that sets a credential. A POST is lowered to w by
a content noun, such as tag, file, or comment, or by a verb from a
short list, and to r by a read verb, such as list, get, or search.
Where it is still unsure, it keeps x; it never guesses a looser class.
It marks two kinds of call for a person to check: a PUT, PATCH, or POST
left at w or r, which may be too loose, and an x that may be tighter
than needed. It writes its result as an OpenAPI extension, MCP tool
annotations, WebMCP hints, and a file that bareguard reads. It signs
nothing.

rwxmap can pass the marked calls to rwxlite [RWXLITE], a small
classifier that runs on the local machine. rwxlite is the
all-MiniLM-L6-v2 sentence model, about 22.7 million weights,
fine-tuned to pick r, w, or x and exported to ONNX. It was trained on
about 102,700 labelled calls from about 690 public API providers. It
does not sample, so the same input gives the same answer. An int8
build is about 23 MB. rwxmap runs the fp32 build, about 91 MB, by
default, and the two builds do not always agree. rwxlite can raise a
marked class, and it lowers one only when its confidence reaches a set
threshold.

rwxmap 0.11.0 with rwxlite 0.3.1 (fp32, threshold 0.90), installed from
the npm registry, was scored once, on 2026-11-08, on 1588 calls from
five complete API descriptions that neither its rules nor rwxlite's
training had seen: Grafana, NocoDB, Radarr, Cloudsmith, and Invoice
Ninja. Nothing was changed after the scoring.

| Result against the truth labels | Released default (rules and rwxlite) | Rules alone | rwxlite alone |
|---|---|---|---|
| right class | 1434 (90.3%) | 1305 (82.2%) | 1288 (81.1%) |
| tighter class than needed | 119 (7.5%) | 240 (15.1%) | 287 (18.1%) |
| looser class than needed (leak) | 35 (2.2%) | 43 (2.7%) | 13 (0.8%) |

"rwxlite alone" means rwxlite classes every call, and any call below a
confidence of 95% is x and marked for review.

Two limits apply. The truth labels were written by two blind
labellers, both the same language model, which agreed on 98.5% of
calls; the author ruled the other 24. Agreement between two copies of
one model shows consistency, not truth. And these results use the
broader x of (action-class-values) and new truth labels, so they cannot
be compared with the figures in -03.

### Row 7. References

- RWXMAP: date November 2026.
- New informative RWXLITE: "rwxlite: A Small r/w/x Classifier for API
  Operations", A. Hassan, Independent, November 2026,
  https://github.com/hamr0/rwxlite. (Title to be confirmed against the
  rwxlite README before the splice.)
- If Q1 = yes: RFC 10008, from the canonical bibliography XML.

### Row 9. Changes since -03 (new appendix, first in the list)

- Broadened x in (action-class-values): the test is whether a later
  call can put things back, including anything done in between; a call
  that grants or widens access is x.
- (If Q1) QUERY added to the r method default.
- Implementation Status: rwxmap 0.11.0 rules and the rwxlite classifier,
  with figures from one new scoring on 1588 calls; the Jev figures are
  removed.
- Introduction and Menu Publication figures updated to match.

## Open questions for the user

- Q1. QUERY. Under -03, QUERY falls under "any other method", so it
  defaults to x. RFC 10008 defines QUERY as safe, and rwxmap now treats it
  as r (D134). Adding it LOOSENS the -03 default for one method.
  Recommend: yes. It is safe by its RFC, and this matches rwxmap.
- Q2. Jev. The -03 Jev figures used the old truth and old x, and Jev was
  not scored on the new exam. Recommend: drop the Jev paragraph.
- Q3. CLOSED 2026-11-08 by rwx's correction: cite exam #6 (rwxmap
  0.11.0 as released, scored once 2026-11-08). Exam #5 figures are history
  and are not cited. Record: rwxmap local branch exam6-prep, commit
  ba07cc2, `docs/wiki/exam-prereg-exam6.md:163-173,257` (read by the main
  session). The draft does not give the record's path until it is on
  GitHub main.

## To verify before the splice

- V1. DONE 2026-11-08. Exam #5 vendors are outside rwxlite's training
  data at provider level: rwxmap `docs/wiki/exam-prereg-exam5.md:51-58`
  and rwxlite `docs/wiki/exam5-leakage.md` (commit 33b484f), all 7 clean.
  The check covers provider fields only (exam-prereg-exam5.md:315).
- V2. OPEN. RWXLITE reference title: the rwxlite README has no formal
  title (its banner reads "a small, local gut check for what an API call
  can do"). The user picks the title.
- V3. DONE 2026-11-08. rwxlite can raise a class: rwxmap
  `src/secondpass.js:25` ("L > M (raise) -> accept L"). Row 6 text says so.
