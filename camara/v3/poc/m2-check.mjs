// PoC module M2 — standalone check. Run: node camara/v3/poc/m2-check.mjs
// Negatives first: every malformed, tampered, wrong-key and hub-side attempt is shown
// being rejected before the happy end-to-end path is shown working.
import {
  randomBytes, generateKeyPairSync, createCipheriv, createDecipheriv, publicEncrypt, privateDecrypt, constants,
} from 'node:crypto';
import { generateEnvelopeKeys, seal, open, MAX_PAYLOAD } from './m2-envelope.mjs';
import { attest, verifyAttestation } from './m1-attestation.mjs';
import { makeHarness } from './check-harness.mjs';
import { attestAnswer, attestRefusal, SIM_SWAP_CHECK, TENURE_CHECK, OUT_OF_RANGE } from './m1-jws.mjs';

console.log('generating keys (3x RSA-4096 + 1x Ed25519), a few seconds...');
const operator = generateEnvelopeKeys();
const rp = generateEnvelopeKeys();
const hub = generateEnvelopeKeys(); // the hub is a party on the wire, not an outsider
const operatorSig = generateKeyPairSync('ed25519'); // the M1 attestation key
console.log('keys ready\n');

const now = Date.now(); // captured once: no sleeps, no clock races
const nonce = () => randomBytes(16).toString('hex');
// V3-M2b: every payload up to 1023 B seals to one length (JWE compact, 1024 B padded body).
const SEALED_LEN = 2142;

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

// 1 LARGE PAYLOAD SEALS — V3-M2b: the RSA block limit no longer applies, because RSA wraps
// only a 32-byte content key. A MAX_PAYLOAD (1023 B, over the old 446 B cap) payload seals and
// opens to the same bytes; one byte more throws at seal (no second size exists).
{
  const big = randomBytes(MAX_PAYLOAD);
  let sealed, threw = false;
  try { sealed = seal(operator.publicKey, big); } catch { threw = true; }
  const back = threw ? { ok: false, reason: 'seal threw' } : open(operator.privateKey, sealed);
  let over = false;
  try { seal(operator.publicKey, randomBytes(MAX_PAYLOAD + 1)); } catch { over = true; }
  check('1 LARGE PAYLOAD SEALS', true, { ok: back.ok, reason: back.ok ? 'ok' : back.reason }, 'ok',
    { label: 'a MAX_PAYLOAD payload seals and opens to the same bytes; MAX_PAYLOAD+1 throws',
      ok: !threw && back.ok === true && back.payloadBytes.equals(big) && over });
}

// 2 SENDER FAULTS THROW — the payload and key are the SENDER's own data, so a fault is a bug
// in the sender's code and must be loud: a non-Buffer payload, a non-RSA key (Ed25519 has no
// modulus; DSA has one but is not RSA) and an RSA-1024 key each throw with a message that
// says what is wrong.
{
  const msgOf = (fn) => { try { fn(); return ''; } catch (e) { return e.message; } };
  const mBuf = msgOf(() => seal(operator.publicKey, 'not a buffer'));
  const mEd = msgOf(() => seal(generateKeyPairSync('ed25519').publicKey, Buffer.alloc(10, 0x41)));
  const mDsa = msgOf(() => seal(generateKeyPairSync('dsa', { modulusLength: 2048, divisorLength: 256 }).publicKey, Buffer.alloc(10, 0x41)));
  const mSmall = msgOf(() => seal(generateKeyPairSync('rsa', { modulusLength: 1024 }).publicKey, Buffer.alloc(10, 0x41)));
  check('2 SENDER FAULTS THROW', false, { ok: false, reason: mBuf && mEd && mDsa && mSmall ? 'threw' : 'no throw' }, 'threw',
    { label: `named clearly: ("${mBuf}") ("${mEd}") ("${mDsa}") ("${mSmall}")`,
      ok: mBuf.includes('Buffer') && mEd.includes('must be an RSA KeyObject') && mDsa.includes('must be an RSA KeyObject') && mSmall.includes('2048') });
}

// 3 MALFORMED CIPHERTEXT — a string off the wire instead of bytes. Plumbing, not an
// attack, so it gets its own reason and is caught BEFORE crypto is touched.
check('3 MALFORMED CIPHERTEXT', false, open(operator.privateKey, 'not a buffer'), 'malformed ciphertext');

// 4 GARBAGE CIPHERTEXT — the real header and five canonical base64url parts of the right
// lengths (key 512 B, IV 12 B, body 1024 B, tag 16 B), all random: right shape, wrong
// content, so open() reaches RSA decryption and fails there.
const HDR = seal(rp.publicKey, Buffer.alloc(1)).toString('latin1').split('.')[0]; // the one header, as sealed
const jwe = (...lens) => Buffer.from([HDR, ...lens.map((n) => randomBytes(n).toString('base64url'))].join('.'), 'ascii');
check('4 GARBAGE CIPHERTEXT', false, open(operator.privateKey, jwe(512, 12, 1024, 16)), 'undecryptable');

// 5 WRONG LENGTH CIPHERTEXT — the same shape with a short random key part (100 B, not 512 B).
// It is refused at open()'s first check, the exact total length (the short key part makes the
// wire shorter than a sealed message), so nothing reaches RSA; the verdict is the same single
// reason as every other fault.
check('5 WRONG LENGTH CIPHERTEXT', false, open(operator.privateKey, jwe(100, 12, 1024, 16)), 'undecryptable');

// 6 TAMPER — a legitimate envelope with one bit flipped in transit, e.g. by the hub. The flip
// lands in the ciphertext part (part 4), so the GCM tag check catches it. The rejection is the
// assert; that it does not crash is already open()'s contract.
{
  const parts = seal(operator.publicKey, buildRequest(nonce())).toString('latin1').split('.');
  const body = Buffer.from(parts[3], 'base64url');
  body[200] ^= 0x01; // byte 200 of the decoded ciphertext
  parts[3] = body.toString('base64url');
  const ct = Buffer.from(parts.join('.'), 'ascii');
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
  console.log(`     plaintext lengths ${payloads.map((p) => p.length).join(', ')} B -> sealed lengths ${lengths.join(', ')} B`);
  // One predicate, computed once and reused for the verdict, its reason and the extra:
  // three hand-synced copies of the same condition can silently drift apart.
  const constant = distinct.length === 1 && distinct[0] === SEALED_LEN;
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
  steps.push([`request sealed to ${SEALED_LEN} B`, requestCt.length === SEALED_LEN]);

  const opened = open(operator.privateKey, requestCt);
  steps.push(['operator opened request', opened.ok === true]);

  let v = { accepted: false, reason: 'operator could not open the request' };
  if (!opened.ok) {
    skip('exact fields', 'RP opened response',
      'result is boolean true');
  } else {
    const req = JSON.parse(opened.payloadBytes.toString('utf8'));
    steps.push(['exact fields', req.predicate === predicate && req.nonce === n &&
      req.floor.simType === 'voice+data' && req.floor.tenureMin === 'P2Y' && req.floor.swapAgeMin === 'P90D']);

    // operator -> RP
    const attestation = attest(operatorSig.privateKey, { predicate: req.predicate, result: true, nonce: req.nonce, exp: now + 60000 });
    const responseBytes = serialize(attestation);
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


// ---- V3-M2b additions: length hiding, one failure reason, fresh key/IV, round trip ----
const OAEP256 = { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };
const b64 = (b) => Buffer.from(b).toString('base64url');

// Test-local builder: valid JWE crypto over a caller-chosen header and caller-chosen
// (already padded) plaintext. Lets the tests make inputs the real seal() never would.
function build(pub, header, plain) {
  const cek = randomBytes(32), iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', cek, iv);
  c.setAAD(Buffer.from(header, 'ascii'));
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.from([header, b64(publicEncrypt({ key: pub, ...OAEP256 }, cek)), b64(iv), b64(ct),
    b64(c.getAuthTag())].join('.'), 'ascii');
}
// Negative control: seal with NO padding. The hub would see the length of the answer.
const sealNoPad = (pub, p) => build(pub, HDR, p);

// 11 LENGTH HIDING — real signed answers from m1-jws.mjs at worst-case field lengths
// (as m1-jws-check cases 33/33b): SimSwap true/false, Tenure true/false, and a refusal all
// seal to ONE length. Negative control: the same payloads without padding differ, so the
// padding is what hides the length.
{
  const mkBase = () => ({ iss: 'a'.repeat(30), aud: 'b'.repeat(30), nonce: nonce(), iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 300 });
  const kid = 'k'.repeat(20);
  const tok = (t) => { if (typeof t !== 'string') throw new Error('signing failed'); return Buffer.from(t, 'utf8'); };
  const answers = [
    tok(attestAnswer(operatorSig.privateKey, kid, mkBase(), SIM_SWAP_CHECK, { entry: 'P90D' }, { swapped: true })),
    tok(attestAnswer(operatorSig.privateKey, kid, mkBase(), SIM_SWAP_CHECK, { entry: 'P90D' }, { swapped: false })),
    tok(attestAnswer(operatorSig.privateKey, kid, mkBase(), TENURE_CHECK, { entry: 'P2Y' }, { tenureDateCheck: true })),
    tok(attestAnswer(operatorSig.privateKey, kid, mkBase(), TENURE_CHECK, { entry: 'P2Y' }, { tenureDateCheck: false })),
    tok(attestRefusal(operatorSig.privateKey, kid, mkBase(), OUT_OF_RANGE, TENURE_CHECK.api)),
  ];
  const sealedLens = new Set(answers.map((p) => seal(rp.publicKey, p).length));
  const rawLens = new Set(answers.map((p) => sealNoPad(rp.publicKey, p).length));
  const trips = answers.every((p) => open(rp.privateKey, seal(rp.publicKey, p)).payloadBytes?.equals(p));
  console.log(`     payload sizes ${answers.map((p) => p.length).join(', ')} B -> sealed ${[...sealedLens].join(', ')} B; no-padding control gives ${rawLens.size} distinct lengths`);
  const ok = sealedLens.size === 1 && [...sealedLens][0] === SEALED_LEN && rawLens.size > 1 && trips;
  check('11 LENGTH HIDING', true, { ok, reason: ok ? 'ok' : 'varies' }, 'ok',
    { label: `5 answers, ${sealedLens.size} sealed length, negative control ${rawLens.size} lengths, round trip ${trips}`, ok });
}

// 12 ONE FAILURE REASON — every fault gives 'undecryptable' and never throws: 200 random
// single-character edits and 200 raw byte flips in each of the 5 parts, a wrong key, truncated,
// empty, a 6th part, a validly built different header, bad padding, and non-canonical base64url
// (trailing bits changed, '+' for '-'). Negative control: a step-reporting open gives >1 reason.
{
  const msg = seal(rp.publicKey, serialize(attest(operatorSig.privateKey, { predicate: 'age_over_18', result: true, nonce: nonce(), exp: now + 60000 })));
  const text = msg.toString('latin1');
  const ps = text.split('.');
  const starts = []; let off = 0;
  for (const p of ps) { starts.push(off); off += p.length + 1; }
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const rnd = (n) => randomBytes(4).readUInt32BE() % n;
  const inputs = []; // [label, buffer, key]
  for (let part = 0; part < 5; part++) {
    for (let r = 0; r < 200; r++) {
      const pos = starts[part] + rnd(ps[part].length);
      const t = text.split(''); let ch;
      do { ch = B64[rnd(64)]; } while (ch === t[pos]);
      t[pos] = ch;
      inputs.push([`text flip part ${part}`, Buffer.from(t.join(''), 'latin1'), rp.privateKey]);
      const b = Buffer.from(msg); b[pos] ^= 1 + rnd(255);
      inputs.push([`byte flip part ${part}`, b, rp.privateKey]);
    }
  }
  const zeros = Buffer.alloc(1024);
  const noMark = Buffer.alloc(1024); noMark[5] = 0x41;
  const otherHdr = b64('{"alg":"RSA-OAEP","enc":"A256GCM"}');
  const goodPad = Buffer.alloc(1024); goodPad[3] = 0x80;
  // non-canonical base64url, same bytes: change the last char of the tag to one with the same
  // top bits (the unused trailing bits differ); and '+' for '-' in the encrypted key.
  const lastCh = ps[4][ps[4].length - 1];
  const sibling = B64[B64.indexOf(lastCh) ^ 1];
  let withDash = text; while (!withDash.split('.')[1].includes('-')) withDash = seal(rp.publicKey, Buffer.alloc(1)).toString('latin1');
  const dp = withDash.split('.'); dp[1] = dp[1].replace('-', '+');
  inputs.push(['wrong private key', msg, hub.privateKey]);
  inputs.push(['truncated', msg.subarray(0, msg.length - 40), rp.privateKey]);
  inputs.push(['empty', Buffer.alloc(0), rp.privateKey]);
  inputs.push(['6th part', Buffer.from(text + '.AAAA', 'latin1'), rp.privateKey]);
  inputs.push(['different header, validly built', build(rp.publicKey, otherHdr, goodPad), rp.privateKey]);
  inputs.push(['padding: no 0x80', build(rp.publicKey, HDR, zeros), rp.privateKey]);
  inputs.push(['padding: last non-zero is not 0x80', build(rp.publicKey, HDR, noMark), rp.privateKey]);
  inputs.push(['non-canonical: trailing bits', Buffer.from([ps[0], ps[1], ps[2], ps[3], ps[4].slice(0, -1) + sibling].join('.'), 'latin1'), rp.privateKey]);
  inputs.push(['non-canonical: + for -', Buffer.from(dp.join('.'), 'latin1'), rp.privateKey]);
  const control = open(rp.privateKey, build(rp.publicKey, HDR, goodPad)).ok === true; // same builder, good padding: must open

  // Negative control: an open that tells the caller WHICH step failed.
  const stepOpen = (key, c) => {
    const q = c.toString('latin1').split('.');
    if (q.length !== 5) return 'parts';
    if (q[0] !== HDR) return 'header';
    let cek;
    try { cek = privateDecrypt({ key, ...OAEP256 }, Buffer.from(q[1], 'base64url')); } catch { return 'rsa'; }
    try {
      const d = createDecipheriv('aes-256-gcm', cek, Buffer.from(q[2], 'base64url'), { authTagLength: 16 });
      d.setAAD(Buffer.from(q[0], 'ascii')); d.setAuthTag(Buffer.from(q[4], 'base64url'));
      Buffer.concat([d.update(Buffer.from(q[3], 'base64url')), d.final()]);
    } catch { return 'gcm'; }
    return 'pad';
  };
  const bad = {}; const stepReasons = new Set();
  for (const [label, buf, key] of inputs) {
    stepReasons.add(stepOpen(key, buf)); // always, even when open() throws
    let r;
    try { r = open(key, buf); } catch { bad[`${label} THREW`] = 1; continue; }
    if (r.ok) bad[`${label} ACCEPTED`] = 1;
    else if (r.reason !== 'undecryptable') bad[`${label} reason=${r.reason}`] = 1;
  }
  const nbad = Object.keys(bad).length;
  const ok = nbad === 0 && control && stepReasons.size > 1;
  check('12 ONE FAILURE REASON', false, { ok: nbad > 0, reason: nbad === 0 ? 'undecryptable' : 'mixed' }, 'undecryptable',
    { label: `${inputs.length} faulty inputs, good-padding control opens ${control}, step-reporting control gives ${stepReasons.size} reasons` +
      (nbad ? `; BAD ${JSON.stringify(bad)}` : ''), ok });
}

// 13 FRESH KEY AND IV — 1000 seals of one payload: every content key (the encrypted key part
// decrypted with the recipient private key; RSA-OAEP output is randomized, so comparing the
// encrypted parts alone cannot see a reused content key) and every IV differs.
{
  const p = buildRequest('fixed');
  const ceks = new Set(), ivs = new Set();
  for (let i = 0; i < 1000; i++) {
    const q = seal(rp.publicKey, p).toString('latin1').split('.');
    ceks.add(privateDecrypt({ key: rp.privateKey, ...OAEP256 }, Buffer.from(q[1], 'base64url')).toString('hex'));
    ivs.add(q[2]);
  }
  const ok = ceks.size === 1000 && ivs.size === 1000;
  check('13 FRESH KEY AND IV', true, { ok, reason: ok ? 'ok' : 'repeat' }, 'ok',
    { label: `1000 seals, ${ceks.size} distinct content keys, ${ivs.size} distinct IVs`, ok });
}

// 14 ROUND TRIP — sizes at and around every boundary, and payloads that end in the padding
// bytes themselves (0x80 / 0x00), which the strip rule must not confuse with padding.
{
  const cases = [0, 1, 446, 461, MAX_PAYLOAD].map((n) => randomBytes(n));
  for (const n of [1, 446, MAX_PAYLOAD]) { cases.push(Buffer.alloc(n, 0x80)); cases.push(Buffer.alloc(n, 0x00)); }
  const t80 = randomBytes(300); t80[299] = 0x80; cases.push(t80);
  const t00 = randomBytes(300); t00[299] = 0x00; t00[298] = 0x00; cases.push(t00);
  const ok = cases.every((p) => { const r = open(rp.privateKey, seal(rp.publicKey, p)); return r.ok && r.payloadBytes.equals(p); });
  // A modulus that is not a multiple of 8 bits: the wrapped key is ceil(bits/8) bytes, not bits/8.
  const odd = generateKeyPairSync('rsa', { modulusLength: 2052 });
  const oddBack = open(odd.privateKey, seal(odd.publicKey, cases[3]));
  const oddOk = oddBack.ok && oddBack.payloadBytes.equals(cases[3]);
  check('14 ROUND TRIP', true, { ok: ok && oddOk, reason: ok && oddOk ? 'ok' : 'mismatch' }, 'ok',
    { label: `${cases.length} payloads, byte-exact; an RSA-2052 key seals and opens (opens ${oddOk})`, ok: ok && oddOk });
}

// Test-local builder for 15 and 16: a validly built JWE (real header, real RSA-OAEP-256 wrapped
// key, real AES-256-GCM, valid tag) with a caller-chosen IV length, tag length and plaintext
// length, whose TOTAL length can be made to equal the sealed length exactly. open() checks the
// total length first, so a wrong IV or body that changes the byte count never reaches the
// checks these cases are about. The compensation: the RSA-OAEP output is a 512 B number, and
// when its leading bytes are 0x00 they can be dropped (privateDecrypt accepts the shorter
// key part, measured on Node 22), which frees base64url characters for a longer IV or body.
// Seals are repeated until the wrapped key starts with `zeros` zero bytes (1 in 256 per zero).
function buildExact(pub, { ivLen = 12, tagLen = 16, plain, zeros = 0 }) {
  const cek = randomBytes(32), iv = randomBytes(ivLen);
  const c = createCipheriv('aes-256-gcm', cek, iv, { authTagLength: tagLen });
  c.setAAD(Buffer.from(HDR, 'ascii'));
  const ct = Buffer.concat([c.update(plain), c.final()]);
  let wrapped;
  do { wrapped = publicEncrypt({ key: pub, ...OAEP256 }, cek); } while (!wrapped.subarray(0, zeros).every((x) => x === 0));
  return Buffer.from([HDR, b64(wrapped.subarray(zeros)), b64(iv), b64(ct), b64(c.getAuthTag())].join('.'), 'ascii');
}
// Does a wire pass open()'s length, header, 5-part, canonical-decode and IV/tag checks? Returns
// the step that stops it, or 'none'. A test-side mirror, used only to label what an input reaches.
function reaches(wire) {
  if (wire.length !== SEALED_LEN) return 'total length';
  const q = wire.toString('latin1').split('.');
  if (q.length !== 5) return 'part count';
  if (q[0] !== HDR) return 'header';
  const b = q.slice(1).map((x) => Buffer.from(x, 'base64url'));
  if (b.some((x, j) => x.toString('base64url') !== q[j + 1])) return 'decode';
  if (b[1].length !== 12 || b[3].length !== 16) return 'iv/tag length';
  return 'none';
}
const padTo = (n) => { const p = Buffer.alloc(n); p[0] = 0x41; p[1] = 0x80; return p; }; // 'A', marker, zeros

// 15 SHORT IV — a validly built JWE with a 14-byte IV, not the 12 the profile fixes, whose
// total length is exactly the sealed length: the 2-byte-shorter wrapped key (two leading 0x00
// dropped) pays for the 2 extra IV characters, the body is the full 1024 B with a valid pad,
// and the tag is valid. It passes the length, header and decode checks and authenticates, so
// ONLY open()'s IV/tag length check refuses it. Mutation-proved: with that check removed this
// case opens (red). Second wire: a 15-byte tag (valid GCM tag, 1026 B body pays for the 2
// missing characters); it reaches the same check, but is ALSO refused by Node's setAuthTag
// when the check is absent, so it does not prove the tag half and is not claimed to.
{
  const wire = buildExact(rp.publicKey, { ivLen: 14, plain: padTo(1024), zeros: 2 });
  const tagWire = buildExact(rp.publicKey, { tagLen: 15, plain: padTo(1026) });
  const stop = reaches(wire), stopTag = reaches(tagWire);
  check('15 SHORT IV', false, open(rp.privateKey, wire), 'undecryptable',
    { label: `14 B IV, exact ${wire.length} B total; passes length, header, decode, stopped only by: ${stop}; 15 B tag wire (${tagWire.length} B) stopped by: ${stopTag}, refused ${open(rp.privateKey, tagWire).reason}`,
      ok: wire.length === SEALED_LEN && stop === 'iv/tag length' && tagWire.length === SEALED_LEN && stopTag === 'iv/tag length'
        && open(rp.privateKey, tagWire).reason === 'undecryptable' });
}

// 16 UNPADDED BODY — a validly built JWE whose plaintext is 1025 B ('A', the 0x80 marker, then
// zeros: a perfectly valid pad, one byte too long). IV 12, tag 16, total length exactly the
// sealed length (the wrapped key's one leading 0x00 dropped pays for the 1 extra body
// character). It passes the length, header, decode and IV/tag checks, authenticates, and its
// padding is valid, so ONLY open()'s plaintext-length check refuses it. Mutation-proved: with
// that check removed it opens (red).
{
  const wire = buildExact(rp.publicKey, { plain: padTo(1025), zeros: 1 });
  const stop = reaches(wire);
  check('16 UNPADDED BODY', false, open(rp.privateKey, wire), 'undecryptable',
    { label: `1025 B plaintext, exact ${wire.length} B total; passes length, header, decode, IV/tag (stopped by: ${stop}); only the plaintext-length check refuses`,
      ok: wire.length === SEALED_LEN && stop === 'none' });
}

// 17 SIZE BOUND — open() reads one sealed length and refuses anything else BEFORE any crypto.
// A 50 MB JWE with real key wrap and real GCM (it WOULD decrypt) is refused in well under the
// time a decrypt takes, and an input one byte longer or shorter than a sealed message is
// refused too. Timing is the only way to see "without decrypting", so the bound is loose
// (100 ms; a 50 MB decrypt takes about 0.5 s here) and the verdicts are asserted exactly.
{
  const bigPlain = Buffer.alloc(50 * 1024 * 1024); bigPlain[0] = 0x41; bigPlain[1] = 0x80;
  const bigWire = build(rp.publicKey, HDR, bigPlain);
  const good = seal(rp.publicKey, buildRequest(nonce()));
  const longer = Buffer.concat([good, Buffer.from('A')]);
  const shorter = good.subarray(0, good.length - 1);
  globalThis.gc?.();
  // Minimum of 3 calls: one slow call (GC, scheduler) cannot fail the bound; a missing length
  // check makes EVERY call take a full decrypt.
  let rBig, ms = Infinity;
  for (let i = 0; i < 3; i++) {
    const t0 = process.hrtime.bigint();
    rBig = open(rp.privateKey, bigWire);
    ms = Math.min(ms, Number(process.hrtime.bigint() - t0) / 1e6);
  }
  const rL = open(rp.privateKey, longer), rS = open(rp.privateKey, shorter);
  const ok = rBig.ok === false && rBig.reason === 'undecryptable' && ms < 100
    && rL.reason === 'undecryptable' && rS.reason === 'undecryptable' && open(rp.privateKey, good).ok === true;
  console.log(`     50 MB input refused in ${ms.toFixed(2)} ms (min of 3)`);
  check('17 SIZE BOUND', false, rBig, 'undecryptable',
    { label: `50 MB well-formed JWE refused in ${ms.toFixed(1)} ms (< 100); +1 B and -1 B refused; exact length still opens`, ok });
}

// The declared case count. A suite that silently loses the cases carrying its
// guarantee still printed a green `RESULT: n/n` before this argument existed
// (measured 2026-08-16 on m4-check: truncated to 18/18 exit 0, emptied to 0/0
// exit 0).
conclude(17);
