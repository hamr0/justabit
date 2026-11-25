# CAMARA v3 — signed one-bit answers on Sync26: the readout

**Status (2026-11-25): built and tested on a mock; NOT filed.** This page
explains the whole v3 proposal and its proof of concept (PoC) in one place.
It is a guide, not the spec. The normative text is
[`docs/product/camara-v3-spec.md`](../../docs/product/camara-v3-spec.md).
The contract (requirements, order, open items) is
[`docs/product/prd.md`](../../docs/product/prd.md). The evidence for every
step is in [`docs/logs/findings.md`](../../docs/logs/findings.md).

---

## 1. The idea in one sentence

The operator signs the yes/no answer it already gives, bound to a nonce
that the relying party issued, with an expiry, and never with the raw
value behind it.

This is "attested windowed disclosure". It is **not** zero-knowledge. The
privacy comes from disclosing one bit, not from cryptography that hides
the bit.

## 2. The problem

CAMARA APIs such as SimSwap `/check` and Tenure `/check-tenure` already
answer with yes or no. That answer is protected by TLS only:

- Only the direct caller can rely on it, and only at the moment of the call.
- A party that did not make the call cannot check it.
- An auditor cannot check it later without calling the operator again.

Example: a shop deals with an AI agent. The shop wants to know that an
established phone line, with no recent SIM swap, stands behind the agent.
The agent's side can ask the operator. But the shop cannot trust an
answer that it only hears from the agent.

## 3. What CAMARA already does, and what v3 adds

The Sync26 releases (read 2026-11-23) already moved toward this idea. v3
cites that work and does not claim it as new:

| Already in CAMARA (Sync26) | Where |
|---|---|
| A yes/no answer instead of the raw value | SimSwap `/check` (`swapped`), Tenure `/check-tenure` (`tenureDateCheck`) |
| An operator limit refused loudly with `400 OUT_OF_RANGE` | SimSwap r4.3, Tenure r3.4, kyc-age-verification r2.3 |
| `not_available` as a third answer | kyc-age-verification, kyc-match |
| Replay protection on the access token | NumberVerification r4.2 (single use, at most 300 s) |

v3 adds only the four things that are missing:

| Gap | What v3 adds | Spec |
|---|---|---|
| 1. The answer is not signed | A JWS signature over the answer, the verifier's nonce, the question and an expiry | §4.1 |
| 2. The operator's limits are not published | A published menu: a short set of questions per API | §4.2 |
| 3. Nothing stops a looser question | Tighten only: a verifier accepts its own question or a stricter one, never a looser one | §4.3 |
| 4. Open values are still raw | A range instead of the point value (waits on SimSwapTimeFrame) | §4.4 |

## 4. The first case: a shop, an agent and an operator

```
   SHOP (verifier)              AGENT'S SIDE (caller)           OPERATOR
   ---------------              ---------------------           --------
1. issues nonce N  ----------->
2.                              POST /sim-swap/v2/check
                                { phoneNumber, maxAge: 2160,
                                  nonce: N }  ------------------->
3.                                                              checks the menu
                                                                (2160 h = P90D: on menu)
                                                                reads its own data
                                                                signs the answer
                              <-------------- { swapped: false,
                                                attestation: <JWS> }
4.                <----------- hands the response over
5. verifies the JWS:
   - operator key, signature
   - exp not passed
   - N is its own nonce, first use
   - api and entry: P90D is the same as,
     or stricter than, what the shop needs (P60D)
   - swapped:false is the pass answer
   -> ACCEPT
```

The same flow runs for Tenure `/check-tenure` with `tenureDate` = today
minus 730 days (menu entry `P2Y`).

The shop never sees the swap date or the subscription start date. It sees
one signed bit about one published question.

## 5. What goes on the wire

### 5.1 The request

Today's Sync26 request body, plus one optional field:

| Field | Meaning |
|---|---|
| `nonce` | Issued by the party that will rely on the answer (the verifier). The caller passes it on. |

- A request with no `nonce` gets today's response, unchanged.
- A `nonce` that is present but is not a non-empty string (`null`, `""`)
  is refused. It is never treated as absent.

### 5.2 The response

A signed response carries the answer field and `attestation`, and nothing
else:

```json
{ "swapped": false, "attestation": "<compact JWS>" }
```

Other fields of today's response are left out. Example: Tenure's
`contractType` is not in a signed response, so nothing unsigned travels
beside the signature.

### 5.3 The signed payload

JOSE header: `{ "alg": "EdDSA", "kid": "<operator key id>" }`.

Payload, a closed set of eight claims:

| Claim | Meaning |
|---|---|
| `iss` | The operator that signed |
| `aud` | The operator's direct caller |
| `nonce` | The verifier's nonce, from the request |
| `iat`, `exp` | Issue time and expiry (seconds) |
| `api` | The operation asked, e.g. `sim-swap/v2/check` |
| `entry` | The menu question, e.g. `P90D` |
| `swapped` or `tenureDateCheck` | The answer: one boolean |

There is no `maxAge`, no `tenureDate`, no swap date, no start date, and no
date of any kind.

### 5.4 The signed refusal

An off-menu request gets today's `400 OUT_OF_RANGE` body, unchanged, plus
one `attestation` member. Its payload carries `iss`, `aud`, `nonce`,
`iat`, `exp`, `api` and `error` (`OUT_OF_RANGE` or `UNAVAILABLE`). The
operator reads nothing for an off-menu request.

## 6. The published menu

The operator publishes the questions it answers: a short **set** of
values per API, not a range. The default menu is the agent floor:

| API | Entry | The question | Sent as |
|---|---|---|---|
| SimSwap `/check` | `P90D` | No SIM swap in the last 90 days? | `maxAge` 2160 (hours) |
| Tenure `/check-tenure` | `P2Y` | Tenure of 2 years or more? | `tenureDate` = UTC today minus 730 days |

PoC file: `camara/v3/poc/menu.json`:

```json
{
  "sim-swap/v2/check": ["P90D"],
  "kyc-tenure/v0.3/check-tenure": ["P2Y"]
}
```

Why a set and not a range: with a range, a requester can find the raw
date by asking many times and moving the value. Each menu entry adds one
band that a requester can test, by the operator's own choice.

Rules:
- Off menu: refused with `400 OUT_OF_RANGE`, never rounded to the nearest entry.
- Durations are `P<n>D` or `P<n>Y` only, with `1Y = 365D`. Months are refused.
- The format of the menu, and where it is published, are open (spec §7 item 2).

## 7. How a verifier checks an answer

In this order (spec §4.1):

1. Find the operator's key in its own trusted copy of the operator's
   JWKS, never from a hint inside the token.
2. Verify the signature.
3. Check that `exp` has not passed, and that `nonce` is one it issued
   itself and has not seen answered before.
4. Check the signed `api` and menu entry against its own question (§4.3).
5. Only then act on the answer.

The verifier may be the caller itself, or a party the caller answers to,
such as the shop. A verifier that did not call passes, as the expected
`aud`, the caller identity it is told. The binding to the verifier comes
from its own nonce.

### Tighten only (spec §4.3)

A bigger entry is the stricter question: no swap in 90 days implies no
swap in 60 days; tenure of 2 years implies tenure of 1 year. A verifier
that needs entry R:

| Signed entry E | Answer | Result |
|---|---|---|
| E = R | pass or fail | accept |
| E stricter than R | pass (`swapped: false`, `tenureDateCheck: true`) | accept |
| E stricter than R | fail | reject `NOT_PASS` (a fail at 90 days says nothing about 60 days) |
| E looser than R | any | reject `LOOSER` |

Widening is a new, separate request, never a default. This rule follows
from CAMARA's own definitions: SimSwap's `swapped` covers "the period
within the provided age" (a 60-day period lies inside a 90-day one), and
Tenure's decision table is true for every later date once it is true for
an earlier one.

## 8. What the PoC contains

All code is in `camara/v3/poc/`. Zero dependencies: `node:crypto` and
plain JavaScript only.

| File | What it does | Built in |
|---|---|---|
| `m1-jws.mjs` | The signed answer: JWS sign and verify, the closed claim set, the signed refusal, tighten-only in `verifyAnswer` | V3-M1, V3-M2, V3-M3 |
| `menu.mjs`, `menu.json` | The published menu: maps `maxAge` and `tenureDate` to an entry; refuses off-menu before any read; `operatorAnswer` signs only the entry the menu returned | V3-M2, V3-M4 |
| `first-case.mjs` | The shop flow of section 4, end to end, with its negative controls | V3-M4 |
| `m2-envelope.mjs` | A sealed envelope (JWE, `RSA-OAEP-256` + `A256GCM`, padded to one fixed size) so that a hub in the middle cannot read the answer. Transport for a later blind-hub proposal, not part of this ask | V3-M2b |
| `m1-jws-check.mjs`, `menu-check.mjs`, `m2-check.mjs` | The tests for the files above | |
| `m1`, `m3`-`m6`, `demo.mjs` and their checks | v2 code, copied unchanged (still on the older raw-Ed25519 core) | v2 |

`camara/v3/spec/` holds an illustrative OpenAPI sketch of sections 5.1 to
5.4 (`carrier-attestation.yaml`) and `sketch-check.py`, which checks the
sketch against the real signed output of the PoC. The sketch is not
normative.

### What the tests prove (each check is shown failing too)

| Claim | Where it is tested |
|---|---|
| The answer is signed and verifies; a changed byte is rejected | `m1-jws-check`, `first-case` N3 |
| A replayed answer is rejected | `first-case` N1, N2 |
| A wrong API, a wrong key or an expired answer is rejected | `m1-jws-check` |
| Off menu is refused, never rounded, and nothing is read | `menu-check`, `first-case` N6 |
| The signed entry comes only from the menu | `first-case` (mutant: menu refusal switched off -> red) |
| A looser question is rejected; a fail at a stricter entry is rejected | `m1-jws-check`, `first-case` N4, N5 |
| No raw value reaches the verifier | `first-case` L1, with L2 proving the scan can fail; `sketch-check` leak guard |
| The envelope hides true from false (one sealed length) | `m2-check` |

### Results (2026-11-25, every run exit 0, user-validated)

| Suite | Result |
|---|---|
| `first-case.mjs` | 11/11 |
| `m1-jws-check.mjs` | 393/393 |
| `menu-check.mjs` | 46/46 |
| `m2-check.mjs` | 17/17 |
| `m1-check`, `m3-check`, `m4-check`, `m5-check`, `m6-check`, `demo` | 20/20, 26/26, 42/42, 67/67, 48/48, 34/34 |
| `camara/v3/spec/sketch-check.py` | exit 0 |

### How to run it

```
cd camara/v3/poc
node first-case.mjs; echo "exit=$?"       # the first case, end to end
node m1-jws-check.mjs; echo "exit=$?"     # the signed answer and tighten-only
node menu-check.mjs; echo "exit=$?"       # the published menu
node m2-check.mjs; echo "exit=$?"         # the sealed envelope
cd ../../.. && python3 camara/v3/spec/sketch-check.py; echo "exit=$?"
```

Each command exits 0 only if every check passes.

## 9. What it supports, and what it does not

**Supports:**
- SimSwap `/check` (r4.3, v2.2.0) and Tenure `/check-tenure` (r3.4,
  v0.3.0), signed, on a mock backend.
- Any verifier: the caller itself, or a party that did not call.
- Signed refusals for off-menu requests.
- Requests with no `nonce`: today's behaviour, unchanged.

**Does not support (yet, or on purpose):**
- SimSwap `/retrieve-date`. It returns a raw date. A signed refusal cannot
  name it today, and a range form waits on SimSwapTimeFrame (V3-M6).
- A live operator. The run on Orange Playground (V3-M5) needs KYC Tenure
  attached to the Playground app first.
- A blind hub. The envelope exists in the PoC, but hiding the identifier
  and the answer from an aggregator is a separate, later proposal.
- The older v2 demo (`demo.mjs`, `m6-check.mjs`) stays on the raw-Ed25519
  core. Moving it showed nothing new and was not done (decision 2026-11-25).

## 10. Honest limits (stated on purpose)

- It is not zero-knowledge. One bit is disclosed.
- An aggregator in the path can still read the identifier and the answer.
- The operator keeps its own query log.
- A SIM is not a person. Tenure and swap age make many fake lines costly;
  they do not prove identity or uniqueness.
- Number portability (MNP) can reset tenure.
- A requester that asks the same question every day can see the day the
  answer changes, and so learn the date. No menu stops this; per-query
  cost and operator rate limits help.
- No aggregator operator has reviewed this design.

## 11. Open items

From `docs/product/prd.md` §4.4, "v3 open items" (items 1 and 8 are
settled):

- The HTTP status of a signed `UNAVAILABLE` refusal.
- An auditor's check after `exp`: signature and claims only, for the record.
- The nonce maximum length (256 in the sketch is a sketch value).
- The form of the sketch paths (full path vs CAMARA's `{apiRoot}` form).
- CAMARA's Tenure table has no row for a line that starts exactly on the
  operator threshold date (S = R). A possible comment to CAMARA.
- V3-S0 live half: is KYC Tenure attached to the Orange Playground app?
- Where signing lives (a Commonalities guideline or the Security and
  Interoperability Profile), the menu format, and the maximum `exp`
  (spec §7).

## 12. Where it stands, and what is next

| Step | State | Commit |
|---|---|---|
| V3-M1 signed answer | done, user-validated | `888ef70` |
| V3-M2 published menu | done, user-validated | `26400c0` |
| V3-M2b sealed envelope | done, user-validated | `a5973d3` |
| OpenAPI sketch | done, user-validated | `574844f` |
| Spec correction (the verifier issues the nonce) | done | `f3abde7`, `cad3566` |
| V3-M3 tighten only | done, user-validated | `fe874d8` |
| V3-M4 first case | done, user-validated | `c4d4200` |
| V3-M5 live on Orange | waits on V3-S0 | |
| Governance/TSC ask (filing text, in the author's own words) | next | |
| V3-M6 range | waits on SimSwapTimeFrame | |

Route (spec §5): response signing goes to CAMARA Governance/TSC first,
with this first case as the example. Commonalities guidance for the menu
and tighten-only follows. Ranges go to SimSwapTimeFrame as a contribution.
It is not a new sub-project.
