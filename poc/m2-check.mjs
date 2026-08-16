// PoC module M2 — standalone check. Run: node poc/m2-check.mjs
// Negatives first: every malformed, tampered, wrong-key and hub-side attempt is shown
// being rejected before the happy end-to-end path is shown working.
import { randomBytes, generateKeyPairSync } from 'node:crypto';
import { generateEnvelopeKeys, seal, open, OAEP_CAPACITY } from './m2-envelope.mjs';
import { attest, verifyAttestation } from './m1-attestation.mjs';
import { makeHarness } from './check-harness.mjs';

console.log('generating keys (3x RSA-4096 + 1x Ed25519), a few seconds...');
const operator = generateEnvelopeKeys();
const rp = generateEnvelopeKeys();
const hub = generateEnvelopeKeys(); // the hub is a party on the wire, not an outsider
const operatorSig = generateKeyPairSync('ed25519'); // the M1 attestation key
console.log('keys ready\n');

const now = Date.now(); // captured once: no sleeps, no clock races
const nonce = () => randomBytes(16).toString('hex');

// Shared harness (see check-harness.mjs): exact-reason assertions, so the module
// misreporting a wrong-length buffer as a well-formed-but-undecryptable one (or
// vice versa) is a FAIL.
const { check, conclude } = makeHarness({ field: 'ok', okWord: 'OK' });

// A realistic profile-mode request: a predicate, the floor it must be evaluated against,
// and the requester's nonce. No identifier, no raw value.
const buildRequest = (n, predicate = 'sim_swap_since_90d') => Buffer.from(JSON.stringify({
  predicate,
  floor: { simType: 'voice+data', tenureMin: 'P2Y', swapAgeMin: 'P90D' },
  nonce: n,
}), 'utf8');

// One buffer on the wire: base64 both attestation fields so the pair survives as bytes.
const serialize = (a) => Buffer.from(JSON.stringify({
  payloadBytes: a.payloadBytes.toString('base64'),
  signature: a.signature.toString('base64'),
}), 'utf8');
const deserialize = (buf) => {
  const o = JSON.parse(buf.toString('utf8'));
  return {
    payloadBytes: Buffer.from(o.payloadBytes, 'base64'),
    signature: Buffer.from(o.signature, 'base64'),
  };
};

// 1 OVERSIZE SEAL — the one deliberate throw in M2. The payload is the SENDER's own data,
// so overflow is a bug in the sender's code, not untrusted input: it must be loud. Silent
// truncation would put a half message on the wire that the recipient cannot detect.
{
  let threw = false, message = '';
  try {
    seal(operator.publicKey, Buffer.alloc(500, 0x41));
  } catch (e) {
    threw = true;
    message = e.message;
  }
  const names = message.includes('500') && message.includes(String(OAEP_CAPACITY));
  check('1 OVERSIZE SEAL', false, { ok: false, reason: threw ? 'threw' : 'no throw' }, 'threw',
    { label: `message names size 500 and cap ${OAEP_CAPACITY} ("${message}")`, ok: names });
}

// 2 DERIVED CAPACITY — the oversize guard must come from the RECIPIENT's key, never a
// constant. 300 bytes is legal for RSA-4096 and impossible for RSA-2048 (cap 190 = 256-66):
// against a hard-coded 446 it sails past the JS guard and dies inside OpenSSL as 'data too
// large for key size', which is the unhelpful failure the guard exists to replace. So the
// assert is that the JS guard fires FIRST and names the real numbers — and explicitly that
// the message is NOT OpenSSL's raw text. The same guard has no capacity to derive from a
// non-RSA recipient, so an Ed25519 key must be named as such rather than reaching OpenSSL.
{
  const small = generateKeyPairSync('rsa', { modulusLength: 2048 });
  let threw = false, message = '';
  try {
    seal(small.publicKey, Buffer.alloc(300, 0x41));
  } catch (e) {
    threw = true;
    message = e.message;
  }
  const names = message.includes('300') && message.includes('190') && message.includes('2048');
  const notRaw = !/data too large/i.test(message);

  let edMessage = '';
  try {
    seal(generateKeyPairSync('ed25519').publicKey, Buffer.alloc(10, 0x41));
  } catch (e) {
    edMessage = e.message;
  }
  const edClear = edMessage.includes('must be an RSA KeyObject');

  check('2 DERIVED CAPACITY', false, { ok: false, reason: threw ? 'threw' : 'no throw' }, 'threw',
    { label: `message names size 300, derived cap 190 and RSA-2048, and is not OpenSSL's raw` +
      ` error ("${message}"); non-RSA recipient named clearly ("${edMessage}")`,
      ok: names && notRaw && edClear });
}

// 3 MALFORMED CIPHERTEXT — a string off the wire instead of bytes. Plumbing, not an
// attack, so it gets its own reason and is caught BEFORE crypto is touched.
check('3 MALFORMED CIPHERTEXT', false, open(operator.privateKey, 'not a buffer'), 'malformed ciphertext');

// 4 GARBAGE CIPHERTEXT — 512 random bytes, i.e. the right length, wrong content.
check('4 GARBAGE CIPHERTEXT', false, open(operator.privateKey, randomBytes(512)), 'undecryptable');

// 5 WRONG LENGTH CIPHERTEXT — 100 random bytes. A different failure mode inside OpenSSL,
// but the same verdict: telling the two apart is how a padding oracle gets built.
check('5 WRONG LENGTH CIPHERTEXT', false, open(operator.privateKey, randomBytes(100)), 'undecryptable');

// 6 TAMPER — a legitimate envelope with one bit flipped in transit (byte 200), e.g. by the
// hub. The rejection is the assert; that it does not crash is already open()'s contract.
{
  const ct = Buffer.from(seal(operator.publicKey, buildRequest(nonce())));
  ct[200] ^= 0x01;
  check('6 TAMPER', false, open(operator.privateKey, ct), 'undecryptable');
}

// 7 WRONG RECIPIENT — sealed to the operator, the RP tries to open it. Routing is not
// readership: being on the path buys nothing.
{
  const ct = seal(operator.publicKey, buildRequest(nonce()));
  check('7 WRONG RECIPIENT', false, open(rp.privateKey, ct), 'undecryptable');
}

// 8 HUB BLIND — the strongest attack the hub can mount with the material it legitimately
// holds. Decryption takes a PRIVATE key, and the only private key the hub has is its OWN:
// the trust directory it serves holds public keys, which cannot decrypt anything (measured
// on Node 22: privateDecrypt rejects a public KeyObject as the wrong key type before any
// RSA math runs — an "attempt" with directory keys would assert nothing about the crypto,
// since it would "fail" identically under a null cipher). So the honest attack set is the
// hub's own private key against BOTH ciphertexts it routes, plus a raw substring scan of
// the ciphertexts for the plaintext nonce and predicate, which must find nothing.
{
  const n = nonce();
  const predicate = 'sim_swap_since_90d';
  const requestCt = seal(operator.publicKey, buildRequest(n, predicate));
  const attestation = attest(operatorSig.privateKey, { predicate, result: true, nonce: n, exp: now + 60000 });
  const responseCt = seal(rp.publicKey, serialize(attestation));

  const attempts = [
    { what: 'request vs hub OWN private key', v: open(hub.privateKey, requestCt) },
    { what: 'response vs hub OWN private key', v: open(hub.privateKey, responseCt) },
  ];
  const recovered = attempts.filter((a) => a.v.ok);
  const leaks = [n, predicate].filter(
    (s) => requestCt.includes(Buffer.from(s, 'utf8')) || responseCt.includes(Buffer.from(s, 'utf8'))
  );
  for (const a of attempts) console.log(`     hub tried ${a.what} -> ${a.v.ok ? 'RECOVERED ' + a.v.payloadBytes.length + ' bytes' : 'rejected (' + a.v.reason + ')'}`);
  // The reason reports the ACTUAL event, observed from open()'s own reason strings —
  // never derived from the verdict alone, so a module that starts failing for the
  // wrong reason (e.g. 'malformed ciphertext' everywhere) turns this case red.
  const allUndecryptable = attempts.every((a) => a.v.reason === 'undecryptable');
  check('8 HUB BLIND', false,
    { ok: recovered.length > 0,
      reason: recovered.length ? 'recovered'
        : (allUndecryptable ? 'undecryptable' : `unexpected reasons: ${attempts.map((a) => a.v.reason).join(', ')}`) },
    'undecryptable',
    { label: `${attempts.length} attempts, ${recovered.length} recoveries, ${leaks.length} plaintext substring hits`, ok: leaks.length === 0 });
}

// 9 SIZE CONSTANT — what the hub's byte-metering log sees. Different predicates and both
// answers produce different plaintext lengths; if the ciphertext length tracked them, the
// billing log itself would be a content side channel.
{
  const n = nonce();
  const payloads = [
    buildRequest(n, 'age_over_18'),
    buildRequest(n, 'tenure_since_p2y_and_line_is_voice_and_data_capable'),
    serialize(attest(operatorSig.privateKey, { predicate: 'age_over_18', result: true, nonce: n, exp: now + 60000 })),
    serialize(attest(operatorSig.privateKey, { predicate: 'sim_swap_since_90d', result: false, nonce: n, exp: now + 60000 })),
  ];
  const lengths = payloads.map((p) => seal(rp.publicKey, p).length);
  const distinct = [...new Set(lengths)];
  console.log(`     plaintext lengths ${payloads.map((p) => p.length).join(', ')} B (cap ${OAEP_CAPACITY}) -> ciphertext lengths ${lengths.join(', ')} B`);
  // One predicate, computed once and reused for the verdict, its reason and the extra:
  // three hand-synced copies of the same condition can silently drift apart.
  const constant = distinct.length === 1 && distinct[0] === 512;
  check('9 SIZE CONSTANT', true, { ok: constant, reason: constant ? 'ok' : 'varies' }, 'ok',
    { label: `${payloads.length} payloads, distinct ciphertext lengths [${distinct.join(', ')}]`, ok: constant });
}

// 10 HAPPY E2E — the full round trip through the REAL shipped M1 module: RP seals a
// request, the operator opens it and reads the exact fields, signs a windowed boolean,
// seals the attestation back, and the RP opens and verifies it. Every step is asserted;
// the final verdict IS M1's verification verdict.
//
// Each parse is gated on the open() it depends on. Parsing unconditionally would mean that
// an open() regressed to { ok: false } — exactly the regression this case should catch —
// TypeErrors on the absent payloadBytes and kills the process before any PASS/FAIL or
// RESULT line is printed. Gated, the dependent steps are recorded as failed and skipped,
// so the regression surfaces as an ordinary FAIL line naming the steps that never ran.
{
  const n = nonce();
  const predicate = 'sim_swap_since_90d';
  const steps = [];
  const skip = (...labels) => { for (const l of labels) steps.push([l, false]); };

  // RP -> operator
  const requestCt = seal(operator.publicKey, buildRequest(n, predicate));
  steps.push(['request sealed to 512 B', requestCt.length === 512]);

  const opened = open(operator.privateKey, requestCt);
  steps.push(['operator opened request', opened.ok === true]);

  let v = { accepted: false, reason: 'operator could not open the request' };
  if (!opened.ok) {
    skip('exact fields', `response within cap ${OAEP_CAPACITY}`, 'RP opened response',
      'result is boolean true');
  } else {
    const req = JSON.parse(opened.payloadBytes.toString('utf8'));
    steps.push(['exact fields', req.predicate === predicate && req.nonce === n &&
      req.floor.simType === 'voice+data' && req.floor.tenureMin === 'P2Y' && req.floor.swapAgeMin === 'P90D']);

    // operator -> RP
    const attestation = attest(operatorSig.privateKey, { predicate: req.predicate, result: true, nonce: req.nonce, exp: now + 60000 });
    const responseBytes = serialize(attestation);
    steps.push([`response ${responseBytes.length} B within cap ${OAEP_CAPACITY}`, responseBytes.length <= OAEP_CAPACITY]);
    const responseCt = seal(rp.publicKey, responseBytes);

    const back = open(rp.privateKey, responseCt);
    steps.push(['RP opened response', back.ok === true]);
    if (!back.ok) {
      v = { accepted: false, reason: 'RP could not open the response' };
      skip('result is boolean true');
    } else {
      v = verifyAttestation(operatorSig.publicKey, deserialize(back.payloadBytes),
        { predicate, nonce: n, nowMs: now });
      steps.push(['result is boolean true', v.claims?.result === true]);
    }
  }

  const failed = steps.filter(([, ok]) => !ok).map(([label]) => label);
  check('10 HAPPY E2E WITH REAL M1', true, { ok: v.accepted, reason: v.reason }, 'ok',
    { label: `${steps.length} steps${failed.length ? ' (failed: ' + failed.join(', ') + ')' : ''}`, ok: failed.length === 0 });
}

// The declared case count. A suite that silently loses the cases carrying its
// guarantee still printed a green `RESULT: n/n` before this argument existed
// (measured 2026-08-16 on m4-check: truncated to 18/18 exit 0, emptied to 0/0
// exit 0).
conclude(10);
