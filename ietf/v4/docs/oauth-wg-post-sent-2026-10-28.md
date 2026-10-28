> SENT 2026-10-28, OAuth WG mailing list (oauth@ietf.org), confirmed sent by the user (text unchanged from the session draft, per the user).
> Subject: draft-hamr-oauth-agent-delegation-03: scoping agents with r/w/x, and open questions
> Verbatim record of the user's own text — do not edit.

Hi all,

I posted -03 of draft-hamr-oauth-agent-delegation last week:
https://datatracker.ietf.org/doc/draft-hamr-oauth-agent-delegation/

Agents that can call anything are useful and scary at the same time. We give a probabilistic model real access, then trust a harness and some guardrails to hold it. I see three problems with agentic automation: scoped permissions, personhood, and scale.

Most guardrails I have seen fall into three groups:
- Binary access with observability on top. Calls are tagged read, write or dangerous, and you find out after something has happened. This is reactive. It mostly helps you manage which agent gets which API.
- Fine-grained IAM or one API key per permission set. This does not scale. Someone has to define every fine-grained API, give it a clear name, and tick every IAM box. It also adds more APIs to manage.
- Scoped MCP servers, spawned per need and run in a sandbox. This has the same issue. If there is no way to decide what the scope is, a w or an x call can still escape.

All three come down to someone's own reading of what should be guarded. Each implementation answers that question its own way. The internet was built on standards: we could not enforce anything if one side used numbers only and the other used alphanumeric. Agent authorization is the same. Without a shared standard for what a call does, there is nothing common to enforce.

There are other shapes too: policy gateways in front of tools, human approval, and rules in the model's prompt. But a limit that the model enforces on itself is not a limit, and gateways and approvals still need someone to write every rule.

RFC 9421 tells you who signed a request. It does not tell you who the agent acts for or what it may do. The drafts in this space split that into three layers: (a) who may act on whose behalf, (b) what exactly may be done per call, and (c) what was approved and consumed. My draft works on layer (a), plus floors.

To make scoping simple, I reused the chmod r/w/x that we all know and applied it to API catalogues and to calls on the fly. r reads and changes nothing. w changes something that a later call can set back. x cannot be undone. I built rwxmap [1] to do this mechanically. On 4279 calls from three APIs that its rules had not seen (Cloudflare, PagerDuty, Sentry), it gave the right class for 82.3%. It gave a tighter class than needed for 16.9%, and a looser class for 0.8%. An optional language-model pass (Jev) raised the right class to 93.0%, with 0.5% looser, but a model does not give the same answer twice, so that run cannot be reproduced. From the many runs I did, most of the misses are between w and x, and r is almost clean. 26 of the 34 looser results are PUT or PATCH calls, and rwxmap marks those for a person to check.

Most of the over-tight results are POST calls. POST means two things: create something, or send a query and get an answer. The less common APIs use it mostly for queries. Ironically, HTTP methods were meant to say what a call does, but providers never agreed on how to use them, and each one's own reading is what led to this mess in the first place. That is one more reason for a standard.

rwxmap is not meant to be the perfect answer, and it means little without adoption. It is meant to solve the cold-start problem for API providers: how to scope the APIs they publish in OpenAPI catalogues. It does most of the job and marks the rest, the too-tight and too-loose calls, for the provider to finish. It writes its result into slots that already exist, so nobody needs a new format: MCP annotations (readOnlyHint, destructiveHint), WebMCP hints (readOnlyHint, consequentialHint), and x-rwx in OpenAPI.

rwxmap works with bareguard [2], my agent gate. You give each agent a chmod-style grant (r--, rw-, rwx). bareguard refuses any call whose letter the grant does not hold, and a child agent's grant is cut to its parent's. rwxmap writes the file that bareguard reads, so you can scope the agent and scope the APIs on the fly. bareguard can also ask a person before it allows a call that rwxmap marked as too loose.

The draft goes one step further. Each class can carry a count: rBudget, wBudget, xBudget. "rw+2x" means r and w with no limit, and at most 2 x calls. No number means no limit for that class. A child link can never get a wider class, a higher count, a wider scope, or a later expiry than its parent. A verifier rejects the whole chain if one link breaks this.

On personhood, I do not claim to prove one person per agent. What the draft uses is a signal that is costly to fake. In CAMARA [3] I proposed that operators return a signed yes/no instead of passing personal data over several hops. The floor is voice+data (to rule out M2M and data-only devices), a line held for 2 years, and no SIM swap in the last 90 days. zkagent [4] reads a passport or ID card chip with a phone app and returns one yes/no bit, with no document data.

The open challenges, in my opinion:
- Intent-based authorization. I have heard that some people have partly solved it, but I have not looked into it in depth.
- The crypto side. A link is a signed, timed token. A parent link stays valid after it is narrowed into a child, and the draft has no fix for that.
- Enforcement. The rules are in the draft, but no implementation enforces all of them yet. bareguard enforces the letters and the parent cut, but not the per-class counts or the expiry. The counts are kept per verifier, so N verifiers can together admit N times a budget. bareguard also asks a person only on too-loose calls, not on too-tight ones.

These are not my focus or my strength. I am open to collaboration, and to citing other work that fills these gaps.

Happy to answer questions.

Amr

[1] rwxmap: https://github.com/hamr0/rwxmap
[2] bareguard: https://github.com/hamr0/bareguard
[3] CAMARA Commonalities #705: https://github.com/camaraproject/Commonalities/issues/705
[4] zkagent: https://github.com/hamr0/zkagent
