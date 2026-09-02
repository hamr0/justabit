> RECEIVED 2026-09-02, public thread. Cross-posted to wimse@ietf.org and
> oauth@ietf.org.
> Subject: Re: [WIMSE] Re: Binding OAuth-authorized calls to specific
> tool-call arguments in agentic/MCP flows.
> Two replies, from Jijie Wei and Sangam Das, both answering
> `oauth-wg-reply-2-sent-2026-09-02.md` (this same directory) — the
> user's per-path drafting question and the naming request. Order below
> is the order the user pasted them; the relative send order of the two
> is not established here.
> The user's reply to this message is `oauth-wg-reply-3-sent-2026-09-02.md`
> (this same directory).
> This is a public mailing-list thread, so it is recorded VERBATIM as
> pasted by the user, unlike the private EMILIA pre-flight thread
> elsewhere in this directory, whose convention strips quoted
> third-party email.

VERBATIM as pasted by the user, 2026-09-02. Two replies on the cross-posted
WIMSE/OAuth thread "Binding OAuth-authorized calls to specific tool-call
arguments in agentic/MCP flows", answering the user's per-path question and
the naming request. Order below is the order the user pasted them; the
relative send order of the two is not established here.

--- Jijie Wei ---

Amr,

Yes — please feel free to name me as well. Preferred form: Jijie Wei
(varwof).

I agree with Sangam's split, and it matches how we model AIC
enforcement:

- boundary identification is per effect-capable path: the first
  admission point on that path whose successful admission is necessary
  for the effect to complete through that path;
- the closure / anti-bypass invariant is system-wide: every path
  capable of producing the protected effect MUST cross a qualifying
  enforcement boundary.

Two disjoint guarded paths to the same effect therefore do not need a
shared physical verifier — each path needs its own. That is also why
gateway-http and an in-process host wrap are two enforcement points
carrying the same certificate and bounds, not one "AIC verifier"
component.

One wording suggestion for -02: define the boundary as a role in an
effectuation path, then state the closure invariant separately. That
keeps "role, not component" from being read as "one component must be
common to all paths".

Best,
Jijie Wei

--- Sangam Das ---

Amr, Jijie,

Yes, that is the interpretation I intended.

The enforcement point is per effect-capable path, while the closure property is system-wide.

If the same protected effect can be reached through two disjoint paths, then each path needs a verifier whose successful admission is necessary for the effect to complete through that path.

So, for paths P1 and P2:

P1 -> verifier V1 -> effect
P2 -> verifier V2 -> effect

there does not need to be one physical verifier common to both paths.

The system-level requirement is instead:

every path capable of producing the protected effect MUST cross a qualifying enforcement boundary before that effect can complete.

That also gives the bypass test its system meaning. If any alternate path can produce the same protected effect without crossing such a verifier, enforcement is not closed for that effect.

So I would distinguish:

    boundary identification: per path; and
    anti-bypass / closure invariant: across all effect-capable paths.

This is also why I would avoid defining the boundary by component identity. It is a role in the effectuation path. Different paths may realize that role at different components or layers.

Your two-path example is useful because it catches an ambiguity in the shorter formulation. I agree that -02 should make the per-path aspect explicit.

And yes, please feel free to name me for the boundary definition and bypass formulation. I am comfortable with attribution.

Best,

Sangam
