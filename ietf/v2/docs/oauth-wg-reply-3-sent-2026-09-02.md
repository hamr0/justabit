> SENT 2026-09-02, public, on the cross-posted WIMSE/OAuth thread.
> Subject: Re: [WIMSE] Re: Binding OAuth-authorized calls to specific
> tool-call arguments in agentic/MCP flows.
> To: Sangam Das <info@sangamdas.com>, Jijie Wei <pki@varwof.com>.
> Cc: wimse@ietf.org, oauth@ietf.org.
> Third reply on this thread — see `oauth-wg-reply-2-sent-2026-09-02.md`
> (this same directory) for the second, and
> `oauth-wg-round3-received-2026-09-02.md` (this same directory) for the
> inbound messages this one answers (Jijie Wei's and Sangam Das's
> per-path/closure agreement, the role-not-component framing, and both
> naming permissions).
> Verbatim record of the user's own text — do not edit. The user states
> in this message that it is the last he will put on the lists about
> this; no further reply is expected or recorded.

To: Sangam Das <info@sangamdas.com>, Jijie Wei <pki@varwof.com>
Cc: wimse@ietf.org, oauth@ietf.org
Subject: Re: [WIMSE] Re: Binding OAuth-authorized calls to specific tool-call
         arguments in agentic/MCP flows

Sangam, Jijie,

That settles it, and thank you both — for the answer and for the permission
to name you. The role framing is the part I would have got wrong on my own.

So you can object before it is in a published document rather than after,
here is the substance the Verifier Placement subsection of -02 will carry.
Two separate statements, in this order:

  Boundary identification, per effect-capable path. An enforcement boundary
  is a ROLE in an effectuation path, not a component: the first admission
  point on that path whose successful admission is necessary for the
  protected effect to complete through that path. Different paths can
  realize that role at different components or layers.

  Closure, across all effect-capable paths. Every path capable of producing
  the protected effect MUST cross a boundary qualifying under the statement
  above before that effect can complete. If any alternate path can produce
  the same protected effect without crossing such a boundary, enforcement is
  not closed for that effect.

The second statement's "qualifying" is decided only by the first, which is
why I want them adjacent and in that order. Two disjoint guarded paths need
two verifiers, not one shared component, and I will say that explicitly since
it is the case that broke my shorter reading.

This replaces rather than extends my -01 wording. -01 says admission is not
performed by a harness or orchestration layer "upstream of that boundary",
which under the role framing is the wrong axis — upstream and downstream stop
being the question once the test is whether an admission is necessary for the
effect on that path. The failure the subsection was written to close still
fails, now by the closure statement rather than by the word "upstream": a
harness that merely knows about a floor, where the resource stays reachable
another way, leaves an effect-capable path uncrossed.

Proposed acknowledgment, so you can correct it:

  The in-process enforcement-placement case was raised by Jijie Wei
  (varwof). The enforcement-boundary definition and the bypass formulation
  are due to Sangam Das. The per-path identification and system-wide
  closure split, and the framing of the boundary as a role rather than a
  component, were settled with both on the WIMSE and OAuth lists in
  September 2026.

Sangam, you did not state a preferred form — tell me if you want anything
other than "Sangam Das". Jijie, I have your form as given.

That is the last I will put on the lists about this. If -02 gets the wording
wrong it will be visible on the Datatracker, and I would rather hear it then
than debate the phrasing now.

Best,
Amr Hassan
draft-hamr-oauth-agent-delegation-01
