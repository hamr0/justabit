> RECEIVED 2026-09-02, public thread. Cross-posted to wimse@ietf.org and
> oauth@ietf.org.
> Subject: Re: [WIMSE] Re: Binding OAuth-authorized calls to specific
> tool-call arguments in agentic/MCP flows.
> Sangam Das's reply to `oauth-wg-reply-sent-2026-09-02.md` (this same
> directory), addressed to Amr Hassan and Jijie Wei. Resolves both open
> questions from that message: placement (his reading (i), with a
> qualification, plus a general boundary rule and a bypass test) and a
> correction to this repo's own outbound wording on actionClass (four
> predicates should stay explicit rather than being named as one). The
> user's reply to this message is `oauth-wg-reply-2-sent-2026-09-02.md`
> (this same directory).
> This is a public mailing-list thread, so it is recorded VERBATIM as
> pasted by the user, unlike the private EMILIA pre-flight thread
> elsewhere in this directory, whose convention strips quoted
> third-party email.

VERBATIM as pasted by the user, 2026-09-02. From Sangam Das, on the
cross-posted WIMSE/OAuth thread "Binding OAuth-authorized calls to specific
tool-call arguments in agentic/MCP flows". Replying to Amr Hassan and
Jijie Wei.

Amr, Jijie,

Thanks. This helps, particularly the boundary definition.

On placement, I mean your reading (i), with one qualification.

For an in-process tool, if the host function table is the first boundary that can actually admit or refuse the consequential invocation, then that function-table boundary is the enforcement boundary. No network hop is required.

I would phrase the general rule as:

The relevant boundary is the first point whose successful admission is necessary for the effect to occur.

So if a host wrapper validates the AIC and the protected function cannot be reached except through that wrapper, the wrapper can be the boundary. If the same function can still be invoked through another local path that bypasses the wrapper, then the wrapper is only upstream defence-in-depth and does not satisfy the property by itself.

That is the placement point I was trying to express. "Boundary" should be defined by effectuation dependency, not by whether a socket exists.

On actionClass, I think there is one distinction worth preserving.

I am happy to use r / w / x as the vocabulary for the action-class axis, but I would not make it synonymous with the current AIC named-tool allowlist.

For example:

AIC:
tools = ["read_file", "list_dir"]

establishes a tool-identity predicate.

Separately:

read_file -> r
list_dir  -> r
bash      -> x

establishes an action-class predicate.

And separately again:

read_file:
    path-prefix = /tmp/

would establish an argument-subset predicate if such a field were actually bound in the certificate.

Those predicates answer different questions.

read_file("/etc/shadow") can therefore simultaneously be:

    permitted by tool identity;
    classed as r;
    not rejectable on path subset under the present vectors, because no path constraint is bound.

That last point is what I meant by saying the current named-tool authorization behaves as a class grant for that tool. I was not intending to collapse tool membership into the r/w/x consequence classification.

So for the write-up I would now keep the predicates explicit:

    tool identity;
    action class;
    argument subset, where present; and
    enforcement placement / necessary effect boundary.

Then a denial can state exactly which predicate failed rather than using "policy denial" for all four.

And yes, I agree that for a purely local tool the absence of a network credential boundary should not mean that no admissible enforcement boundary exists. If the protected local dispatch is where the operation becomes executable, that can be the boundary.

That definition also makes the bypass test straightforward: if another path can produce the same effect without crossing the verifier, the claimed boundary is not yet load-bearing.

Best,

Sangam
