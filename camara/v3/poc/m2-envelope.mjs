// PoC module M2 (V3-M2b) — blind envelope. The hub routes RP <-> operator, meters, and bills;
// it is STRUCTURALLY unable to read what it carries. A JWE (RFC 7516) in compact form,
// alg RSA-OAEP-256, enc A256GCM (RFC 7518), node:crypto only.
//
// How it works: a fresh 256-bit content key per message; AES-256-GCM (fresh 96-bit IV, the
// protected header as additional authenticated data) encrypts the payload; RSA-OAEP-SHA256
// encrypts only the 32-byte content key. So the RSA block limit no longer bounds the payload.
// The payload is padded first (ISO/IEC 7816-4: 0x80, then 0x00, to exactly 1024 B),
// so every message up to 1023 B has one sealed length and the byte-metering log cannot tell
// `true` from `false`. The profile adds the padding inside the JWE plaintext; the JWE form
// is unchanged. The header is one constant, compared as text; there is no header parser.
//
// Honest limits, stated on purpose: the envelope hides CONTENT ONLY. The hub still sees
// message COUNT, message TIMING, and which RP is talking to which operator — that is
// exactly the metadata it needs to meter and bill, and it is not hidden here. A payload over
// 1023 B is refused by seal() (the sender's own fault); there is no second size. No timing-oracle defence
// is claimed (JS is not constant-time, and RFC 7516 section 11.5's random-key fall-through is
// left out on purpose). This is demo transport: a standard JWE profile, but no outside party
// has reviewed it. The earlier note that a bigger payload "would need a vetted AEAD hybrid
// scheme adopted as an explicit, separate decision" is that decision: V3-M2b, user, 2026-11-24.
import {
  generateKeyPairSync, publicEncrypt, privateDecrypt, constants,
  createCipheriv, createDecipheriv, randomBytes,
} from 'node:crypto';

const OAEP = { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };

// base64url of exactly {"alg":"RSA-OAEP-256","enc":"A256GCM"}. The one header, ever.
const HEADER = 'eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0';

// One envelope size. Every sealed message carries exactly ENVELOPE_PLAIN bytes of padded
// plaintext, so every sealed message has one length (for a given recipient key size).
const ENVELOPE_PLAIN = 1024;
export const MAX_PAYLOAD = ENVELOPE_PLAIN - 1; // one byte is the 0x80 padding marker
const b64len = (n) => Math.ceil((n * 4) / 3);
// Exact wire length: header . wrapped key (ceil(bits/8) bytes) . iv (12) . ciphertext . tag (16).
const sealedLength = (bits) => HEADER.length + 4 + b64len(Math.ceil(bits / 8)) + b64len(12) + b64len(ENVELOPE_PLAIN) + b64len(16);

// Every actor creates confidentiality keys the same way, so no actor is a special case.
export function generateEnvelopeKeys() {
  return generateKeyPairSync('rsa', { modulusLength: 4096 });
}

// Sender side. The payload and key are the sender's OWN, so a fault is a bug in the sender's
// code: throw loudly.
export function seal(recipientPublicKey, payloadBytes) {
  if (!Buffer.isBuffer(payloadBytes)) throw new Error('seal: payloadBytes must be a Buffer');
  const bits = recipientPublicKey?.asymmetricKeyDetails?.modulusLength;
  if (recipientPublicKey?.asymmetricKeyType !== 'rsa' || typeof bits !== 'number') {
    throw new Error(
      'seal: recipientPublicKey must be an RSA KeyObject (asymmetricKeyType rsa with a modulusLength, ' +
      `got ${recipientPublicKey?.asymmetricKeyType ?? typeof recipientPublicKey})`
    );
  }
  if (bits < 2048) throw new Error('seal: RSA modulus must be at least 2048 bits');
  if (payloadBytes.length > MAX_PAYLOAD) {
    throw new Error(`seal: payload is ${payloadBytes.length} B, over the ${MAX_PAYLOAD} B envelope size`);
  }
  const padded = Buffer.alloc(ENVELOPE_PLAIN); // zero-filled
  payloadBytes.copy(padded);
  padded[payloadBytes.length] = 0x80;
  const cek = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', cek, iv);
  cipher.setAAD(Buffer.from(HEADER, 'ascii'));
  const ct = Buffer.concat([cipher.update(padded), cipher.final()]);
  const key = publicEncrypt({ key: recipientPublicKey, ...OAEP }, cek);
  return Buffer.from([HEADER, key.toString('base64url'), iv.toString('base64url'),
    ct.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.'), 'ascii');
}

// Recipient side. The ciphertext is UNTRUSTED WIRE INPUT — anyone can send anything — so
// nothing here may throw: every failure is a returned verdict. One straight sequence in ONE
// try/catch: any fault at any step returns the same reason, so no step is an oracle. The
// wire is read as latin1 (one byte, one character), and each part must be canonical
// base64url: it must re-encode to the same text, so one message has one encoding.
export function open(privateKey, ciphertext) {
  if (!Buffer.isBuffer(ciphertext)) return { ok: false, reason: 'malformed ciphertext' };
  try {
    // The one sealed length, checked first: nothing of any other size reaches the crypto.
    const bits = privateKey?.asymmetricKeyDetails?.modulusLength;
    if (typeof bits !== 'number' || ciphertext.length !== sealedLength(bits)) throw new Error();
    const parts = ciphertext.toString('latin1').split('.');
    if (parts.length !== 5) throw new Error();
    if (parts[0] !== HEADER) throw new Error();
    const [, k, i, c, t] = parts.map((p) => {
      const b = Buffer.from(p, 'base64url');
      if (b.toString('base64url') !== p) throw new Error();
      return b;
    });
    if (i.length !== 12 || t.length !== 16) throw new Error();
    const cek = privateDecrypt({ key: privateKey, ...OAEP }, k);
    const d = createDecipheriv('aes-256-gcm', cek, i, { authTagLength: 16 });
    d.setAAD(Buffer.from(parts[0], 'ascii'));
    d.setAuthTag(t);
    const plain = Buffer.concat([d.update(c), d.final()]);
    if (plain.length !== ENVELOPE_PLAIN) throw new Error();
    let n = plain.length - 1;
    while (n >= 0 && plain[n] === 0x00) n--;
    if (n < 0 || plain[n] !== 0x80) throw new Error();
    return { ok: true, payloadBytes: plain.subarray(0, n) };
  } catch {
    return { ok: false, reason: 'undecryptable' };
  }
}
