// PoC module M1 — standalone check. Run: node poc/m1-check.mjs
// Negatives first: each attack and each malformed input is shown being rejected
// before the happy path.
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { attest, verifyAttestation, hasDuplicateTopLevelKey } from './m1-attestation.mjs';
import { makeHarness } from './check-harness.mjs';

const operator = generateKeyPairSync('ed25519');
const impostor = generateKeyPairSync('ed25519');
const now = Date.now(); // captured once: no sleeps, no clock races
const nonce = () => randomBytes(16).toString('hex');
const OK = { predicate: 'age_over_18', result: true, exp: now + 60000 };

// Shared harness (see check-harness.mjs): exact-reason assertions, so the module
// misreporting a plumbing fault as a forgery (or vice versa) is a FAIL.
const { check, conclude } = makeHarness({ field: 'accepted', okWord: 'ACCEPT' });

// 1 MALFORMED RESPONSE — payloadBytes absent. A plumbing fault needs its own reason,
// not 'bad signature', which would read as an attack.
{
  const n = nonce();
  const r = attest(operator.privateKey, { ...OK, nonce: n });
  const v = verifyAttestation(operator.publicKey, { signature: r.signature }, { predicate: OK.predicate, nonce: n, nowMs: now });
  check('1 MALFORMED RESPONSE', false, v, 'malformed response');
}

// 2 SIGNATURE NOT A BUFFER — a base64 string off the wire. The shape gate requires a
// Buffer signature, so this is caught as plumbing BEFORE crypto is touched: it never
// reaches the try/catch, and it is named 'malformed response', not a forgery.
{
  const n = nonce();
  const r = attest(operator.privateKey, { ...OK, nonce: n });
  const wire = { payloadBytes: r.payloadBytes, signature: r.signature.toString('base64') };
  check('2 SIGNATURE NOT A BUFFER', false, verifyAttestation(operator.publicKey, wire, { predicate: OK.predicate, nonce: n, nowMs: now }), 'malformed response');
}

// 3 BROKEN TRUSTED KEY — the response is perfectly well-formed; the caller's OWN key is
// a string. That is caller config, not untrusted input, so this case proves only one
// thing: the try/catch backstop is covered and a bad key is a rejection, not a crash.
{
  const n = nonce();
  const r = attest(operator.privateKey, { ...OK, nonce: n });
  check('3 BROKEN TRUSTED KEY', false, verifyAttestation('not a key', r, { predicate: OK.predicate, nonce: n, nowMs: now }), 'bad signature (malformed)');
}

// 4 GARBAGE SIGNATURE — a short random buffer. Measured on Node 22: a malformed
// *Buffer* is rejected as false, it does not throw.
{
  const n = nonce();
  const r = attest(operator.privateKey, { ...OK, nonce: n });
  const junk = { payloadBytes: r.payloadBytes, signature: randomBytes(7) };
  check('4 GARBAGE SIGNATURE', false, verifyAttestation(operator.publicKey, junk, { predicate: OK.predicate, nonce: n, nowMs: now }), 'bad signature');
}

// 5 TAMPER — one bit flipped in a validly signed payload.
{
  const n = nonce();
  const r = attest(operator.privateKey, { predicate: 'sim_swap_since_90d', result: false, nonce: n, exp: now + 60000 });
  const bytes = Buffer.from(r.payloadBytes);
  bytes[10] ^= 0x01;
  check('5 TAMPER', false, verifyAttestation(operator.publicKey, { payloadBytes: bytes, signature: r.signature }, { predicate: 'sim_swap_since_90d', nonce: n, nowMs: now }), 'bad signature');
}

// 6 WRONG KEY — signed by someone other than the trusted operator.
{
  const n = nonce();
  const r = attest(impostor.privateKey, { ...OK, nonce: n });
  check('6 WRONG KEY', false, verifyAttestation(operator.publicKey, r, { predicate: OK.predicate, nonce: n, nowMs: now }), 'bad signature');
}

// 7 UNPARSEABLE PAYLOAD — a broken operator ships non-JSON bytes. `attest` always
// stringifies, so this signs the garbage DIRECTLY: the signature is VALID over these
// bytes, which proves the parse failure ALONE causes the rejection, after the signature
// check has already passed.
{
  const payloadBytes = Buffer.from('not json {', 'utf8');
  const signature = sign(null, payloadBytes, operator.privateKey);
  check('7 UNPARSEABLE PAYLOAD', false, verifyAttestation(operator.publicKey, { payloadBytes, signature }, { predicate: OK.predicate, nonce: nonce(), nowMs: now }), 'unparseable payload');
}

// 8 NON-OBJECT CLAIMS — validly signed payload whose JSON is `null`. Signature holds;
// the verifier must reject, not throw reading a field off null.
{
  const r = attest(operator.privateKey, null);
  check('8 NON-OBJECT CLAIMS', false, verifyAttestation(operator.publicKey, r, { predicate: OK.predicate, nonce: nonce(), nowMs: now }), 'malformed claims');
}

// 9 WRONG PREDICATE — a valid answer to a different question.
{
  const n = nonce();
  const r = attest(operator.privateKey, { ...OK, nonce: n });
  check('9 WRONG PREDICATE', false, verifyAttestation(operator.publicKey, r, { predicate: 'sim_swap_since_90d', nonce: n, nowMs: now }), 'predicate mismatch');
}

// 10 MISSING PREDICATE — validly signed, but the answer is unlabelled.
{
  const n = nonce();
  const r = attest(operator.privateKey, { result: true, nonce: n, exp: now + 60000 });
  check('10 MISSING PREDICATE', false, verifyAttestation(operator.publicKey, r, { predicate: OK.predicate, nonce: n, nowMs: now }), 'predicate mismatch');
}

// 11 MISSING RESULT — labelled and in-window, but carries no answer at all.
{
  const n = nonce();
  const r = attest(operator.privateKey, { predicate: OK.predicate, nonce: n, exp: now + 60000 });
  check('11 MISSING RESULT', false, verifyAttestation(operator.publicKey, r, { predicate: OK.predicate, nonce: n, nowMs: now }), 'missing or non-boolean result');
}

// 12 STRING RESULT — the string 'false', which is truthy: a caller testing
// `claims.result` would read it as a yes. A signed boolean is the only answer.
{
  const n = nonce();
  const r = attest(operator.privateKey, { predicate: OK.predicate, result: 'false', nonce: n, exp: now + 60000 });
  check('12 STRING RESULT', false, verifyAttestation(operator.publicKey, r, { predicate: OK.predicate, nonce: n, nowMs: now }), 'missing or non-boolean result');
}

// 13 NONCE MISMATCH — a response bound to nonce A does not verify against nonce B.
// That is BINDING, not replay protection: the verifier is stateless, so the same response
// re-presented against the SAME expected nonce within exp verifies again — issuing
// single-use, per-request nonces is the requester's job, out of scope for M1.
{
  const a = nonce(), b = nonce();
  const r = attest(operator.privateKey, { predicate: 'sim_swap_since_90d', result: false, nonce: a, exp: now + 60000 });
  check('13 NONCE MISMATCH', false, verifyAttestation(operator.publicKey, r, { predicate: 'sim_swap_since_90d', nonce: b, nowMs: now }), 'nonce mismatch');
}

// 14 MISSING NONCE — claims carry no nonce and expected.nonce is undefined too.
// Without the type guard the two compare equal and the check fails OPEN.
{
  const r = attest(operator.privateKey, { predicate: OK.predicate, result: true, exp: now + 60000 });
  check('14 MISSING NONCE', false, verifyAttestation(operator.publicKey, r, { predicate: OK.predicate, nonce: undefined, nowMs: now }), 'nonce mismatch');
}

// 15 EXPIRED — exp already in the past.
{
  const n = nonce();
  const r = attest(operator.privateKey, { ...OK, nonce: n, exp: now - 1000 });
  check('15 EXPIRED', false, verifyAttestation(operator.publicKey, r, { predicate: OK.predicate, nonce: n, nowMs: now }), 'expired');
}

// 16 SMUGGLED RAW VALUE — a leaky operator ships the swap timestamp alongside the bit.
// Every other check passes: right key, right predicate, boolean result, right nonce,
// in window. Only the closed claim set stops the raw value reaching the requester.
{
  const n = nonce();
  const r = attest(operator.privateKey, { predicate: OK.predicate, result: true, nonce: n, exp: now + 60000, swapTimestamp: '2026-01-02' });
  check('16 SMUGGLED RAW VALUE', false, verifyAttestation(operator.publicKey, r, { predicate: OK.predicate, nonce: n, nowMs: now }), 'unexpected fields: swapTimestamp');
}

// 17 DUPLICATE KEY — one signed blob carrying "result" twice (true then false).
// JSON.parse is last-wins, other parsers are first-wins: without rejection a signing
// operator can equivocate — the SAME signature-valid bytes read as YES by one
// verifier and NO by another. Every other check passes (the closed set can't see it:
// Object.keys shows one 'result'). Only the byte-level duplicate scan stops it.
{
  const n = nonce();
  const payloadBytes = Buffer.from(
    `{"predicate":"age_over_18","result":true,"nonce":"${n}","exp":${now + 60000},"result":false}`, 'utf8');
  const signature = sign(null, payloadBytes, operator.privateKey);
  check('17 DUPLICATE KEY', false, verifyAttestation(operator.publicKey, { payloadBytes, signature }, { predicate: OK.predicate, nonce: n, nowMs: now }), 'duplicate claim keys');
}

// 18 ESCAPED DUPLICATE KEY — same attack, second key spelled "\u0072esult": different
// BYTES, same PARSED key. Detection must compare decoded keys, not raw text.
{
  const n = nonce();
  const payloadBytes = Buffer.from(
    `{"predicate":"age_over_18","result":true,"nonce":"${n}","exp":${now + 60000},"\\u0072esult":false}`, 'utf8');
  const signature = sign(null, payloadBytes, operator.privateKey);
  check('18 ESCAPED DUPLICATE KEY', false, verifyAttestation(operator.publicKey, { payloadBytes, signature }, { predicate: OK.predicate, nonce: n, nowMs: now }), 'duplicate claim keys');
}

// 19 HAPPY — right key, right predicate, right nonce, not expired. Payload fidelity
// (what comes back out is what went in) is folded into this one verdict.
{
  const n = nonce();
  const signed = { ...OK, nonce: n };
  const v = verifyAttestation(operator.publicKey, attest(operator.privateKey, signed), { predicate: OK.predicate, nonce: n, nowMs: now });
  const fidelity = v.accepted && v.claims?.result === signed.result && v.claims?.predicate === signed.predicate;
  check('19 HAPPY', true, v, 'ok', { label: 'payload fidelity', ok: fidelity });
}

// 20 EXPORTED DUPLICATE SCANNER — cases 17/18 reach the byte-level scan through
// verifyAttestation; from 2026-08-17 the scan is EXPORTED as well, because M6
// must run it over a signed REQUEST and a request has no
// {predicate,result,nonce,exp} for verifyAttestation to check against. Pinned on
// the bare function so the export cannot rot into a second, divergent copy:
// the same two attacks (raw and escape-spelled) are caught, a clean payload is
// not, a depth-2 duplicate is NOT a top-level duplicate — and the half that only
// matters for a request, a duplicated `floor`, is caught even though nothing in
// that payload looks like a claim (one signature, two readings: the operator can
// enforce P90D while the requester believes it demanded P365D).
{
  const dupClaim = '{"predicate":"p","result":true,"result":false}';
  const dupEscaped = '{"predicate":"p","\\u0072esult":true,"result":false}';
  const dupFloor = '{"number":"+990100000099","floor":{"swapAgeMin":"P365D"},"floor":{"swapAgeMin":"P90D"},"nonce":"n"}';
  const clean = '{"predicate":"p","result":true,"nonce":"n","exp":1}';
  const nested = '{"predicate":"p","floor":{"a":1,"a":2},"nonce":"n"}';
  const v = hasDuplicateTopLevelKey(dupFloor)
    ? { accepted: false, reason: 'duplicate claim keys' }
    : { accepted: true, reason: 'scanner missed a duplicated floor' };
  check('20 EXPORTED DUPLICATE SCANNER', false, v, 'duplicate claim keys',
    { label: 'claim + escaped dups caught; clean and depth-2 payloads pass',
      ok: hasDuplicateTopLevelKey(dupClaim) === true
        && hasDuplicateTopLevelKey(dupEscaped) === true
        && hasDuplicateTopLevelKey(clean) === false
        && hasDuplicateTopLevelKey(nested) === false });
}

// The declared case count. A suite that silently loses the cases carrying its
// guarantee still printed a green `RESULT: n/n` before this argument existed
// (measured 2026-08-16 on m4-check: truncated to 18/18 exit 0, emptied to 0/0
// exit 0).
conclude(20);
