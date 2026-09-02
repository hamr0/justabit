> SENT 2026-09-02, public, on the cross-posted WIMSE/OAuth thread.
> Subject: Re: [WIMSE] Re: Binding OAuth-authorized calls to specific
> tool-call arguments in agentic/MCP flows.
> To: Jijie Wei <pki@varwof.com>, Sangam Das <info@sangamdas.com>.
> Cc: wimse@ietf.org, oauth@ietf.org.
> Reply on a public mailing-list thread — see
> `oauth-wg-thread-received-2026-09-02.md` (this same directory) for the
> inbound messages it replies to (Jijie Wei's opening message and AIC
> description, Sangam Das's std/mcp-v1 test-vector mapping and two
> predicates, Jijie's host-wrap-before-dispatch reply).
> Verbatim record of the user's own text — do not edit. No reply from
> Jijie Wei or Sangam Das has been received to this message yet.

To: Jijie Wei <pki@varwof.com>, Sangam Das <info@sangamdas.com>
Cc: wimse@ietf.org, oauth@ietf.org
Subject: Re: [WIMSE] Re: Binding OAuth-authorized calls to specific tool-call
         arguments in agentic/MCP flows

Jijie, Sangam,

Sangam's two predicates are, I think, the right decomposition, and I want to
supply vocabulary for the first one and disagree slightly about the second.

draft-hamr-oauth-agent-delegation-01 posted to the Datatracker on 2026-09-02.
It occupies the delegation-chain-and-floors layer, not the per-call binding
layer, and it cites draft-das-agentic-tool-binding as the latter. I have not
run scenario-demo.py either, and I make no claim about the AIC implementation.

1. On "effectively a class grant for the named tool"

That is exactly the object my draft calls an action class floor, and I would
rather we converge on one word for it than each keep our own.

Section "Action Class Floors" registers actionClass as an ordered enumeration
r < w < x, where r is read-only, w is an idempotent write, and x is a
consequential non-idempotent action. A link's value is a CEILING on the whole
link, not a statement about any single operation — which is precisely
Sangam's "class grant" property, including its weakness: read_file with
path=/etc/shadow satisfies the class the same way read_file with path=/tmp/a
does. The floor is evaluated once when a link is issued or verified. It does
not narrow per invocation and it is not intended to.

Mapping your four-row matrix onto it is instructive, and the interesting row
is not bash:

  read_file, list_dir   r
  bash                  x
  delete_file           w or x, depending on who is asked

delete_file repeated has the same effect as performing it once, so the
idempotence test in my draft classes it w. Most operators would call it x.
That disagreement is the reason my draft carries a second axis, classSource,
ranked method < declared: a verifier may derive a request's class from the
method (cheap, lossy) or require it to have been declared by the issuer
(expensive, exact). Your certificate declaring {"tools":[...]} is the
declared case. A gateway inferring a class from the JSON-RPC method name is
the method case. They are not interchangeable and my draft makes a chain say
which it permits.

If that is useful, take the enumeration; it costs you nothing and it stops
tool-identity denial and argument-subset denial being described in the same
words, which is the conflation Sangam asked to avoid.

2. On enforcement placement — where I do not yet agree

Sangam: "only the first enforcement point moves earlier." Jijie: a host wrap
before dispatch is the natural extension for local function tables.

My -01 subsection "Verifier Placement" says the opposite, or appears to. It
says classification and admission are performed by the verifier at the
resource or credential boundary, not by any harness or orchestration layer
upstream of it; that a harness coordinating an agent's actions does not
itself admit a request; and that an agent declining to attempt an action it
expects to be refused does not, by that restraint, satisfy the section.

I wrote that to close a specific failure: a system that reports compliance
because the harness was told about a floor and behaved, while the boundary
would have permitted the request had it arrived. That failure is real and I
am not withdrawing the requirement.

But your case is not that case, and my wording does not distinguish them.
Two readings, and I cannot tell from my own text which one it licenses:

  (i) For an in-process tool with no gateway, the host's function table IS
      the resource boundary. The host wrap is then the verifier, and there is
      no disagreement between us at all.

  (ii) The host wrap is upstream of the boundary. It is then defense in
       depth, welcome but not admission, and the boundary check still has to
       happen — which for a purely local tool means it never happens.

If (i), my section needs a sentence saying so, because a reader will assume
"boundary" means "network boundary". If (ii), my section is too strict for
local dispatch and I would like to know that before -02.

I lean toward (i): the boundary is defined by what refuses, not by whether a
socket is involved. Tell me if that breaks the AIC model, where the
credential is transport-identity anchored and a local path may present no
AIC-JWT at all. That is the sharpest version of the question, and I think
it is Sangam's placement point restated as a definition problem rather than
a deployment one.

3. What I would keep in the write-up

Sangam's suggestion to keep the four-row table together with both predicates,
plus one line naming which predicate each denial exercises. bash is a
class denial. read_file path=/etc/shadow would be an argument-subset denial,
and the current vectors cannot produce it — which is a property of the
vectors, worth stating rather than leaving to inference.

Best,
Amr Hassan
draft-hamr-oauth-agent-delegation-01

No reply from Jijie Wei or Sangam Das has been received to this message.
