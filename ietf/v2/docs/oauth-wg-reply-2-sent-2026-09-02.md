> SENT 2026-09-02, public, on the cross-posted WIMSE/OAuth thread.
> Subject: Re: [WIMSE] Re: Binding OAuth-authorized calls to specific
> tool-call arguments in agentic/MCP flows.
> To: Sangam Das <info@sangamdas.com>, Jijie Wei <pki@varwof.com>.
> Cc: wimse@ietf.org, oauth@ietf.org.
> Second reply on this thread — see `oauth-wg-reply-sent-2026-09-02.md`
> (this same directory) for the first, and
> `oauth-wg-sangam-reply-received-2026-09-02.md` (this same directory)
> for the inbound message this one answers (Sangam Das's placement rule,
> bypass test, and four-predicate correction).
> Verbatim record of the user's own text — do not edit. No reply from
> Jijie Wei or Sangam Das has been received to this message yet.

To: Sangam Das <info@sangamdas.com>, Jijie Wei <pki@varwof.com>
Cc: wimse@ietf.org, oauth@ietf.org
Subject: Re: [WIMSE] Re: Binding OAuth-authorized calls to specific tool-call
         arguments in agentic/MCP flows

Sangam, Jijie,

Both points taken.

On the four predicates: the correction is right and my wording was wrong. I
offered actionClass as vocabulary for "class grant" in a way that reads as
collapsing tool identity into r/w/x, and that is not a distinction worth
losing. read_file("/etc/shadow") being simultaneously permitted by tool
identity, classed r, and unrejectable on path subset is exactly the case that
needs three names rather than one.

For the record the draft itself does not make that error: the layering
section places tool name and argument set at the per-invocation layer, and
says a floor constrains a category of action across a chain, "not the
arguments of any single call". The fix is to my email, not to the text. I
support the four-predicate list for the write-up — a denial naming which
predicate failed is strictly better than four things sharing the words
"policy denial".

On placement, I am adopting the rule, and I would like to cite it. Jijie
proposed the host wrap; Sangam gave it a definition:

  The relevant boundary is the first point whose successful admission is
  necessary for the effect to occur.

That is better than what -01 has. My subsection says admission is not
performed by a harness or orchestration layer upstream of the boundary. That
is not wrong, but it never says what makes something the boundary, so it
leaves a verifier author to decide by intuition. The formulation above
decides it, and the bypass test makes it checkable: "if another path can
produce the same effect without crossing the verifier, the claimed boundary
is not yet load-bearing." A normative section needs a test two implementers
can run and agree on. Mine did not have one.

It also preserves the failure the subsection was written to close, so I can
take it without loosening anything: a harness that merely knows about a
floor, where the resource stays reachable by another path, fails the bypass
test. The rule is a tightening with a definition attached.

One drafting problem I will have to handle carefully, raised as my work and
not as an objection. "First point whose admission is necessary" is
unambiguous along a single path. Where a resource has two disjoint guarded
paths, no single point is necessary for the effect, so read strictly there is
no boundary at all — while the bypass test gives the answer I think you both
intend, which is that each path needs its own verifier. So the property is
per path, not per system, and -02 will have to say so explicitly or the two
halves of the rule can be read against each other. If you meant it per
system, tell me, because then I have it wrong.

May I name you both for this, or would you prefer the citation without the
attribution? Either is fine; I would rather ask than assume.

Best,
Amr Hassan
draft-hamr-oauth-agent-delegation-01
