// PoC module M2 — blind envelope. The hub routes RP <-> operator, meters, and bills;
// it is STRUCTURALLY unable to read what it carries. RSA-OAEP, node:crypto only.
//
// Honest limits, stated on purpose: the envelope hides CONTENT ONLY. The hub still sees
// message COUNT, message TIMING, and which RP is talking to which operator — that is
// exactly the metadata it needs to meter and bill, and it is not hidden here. This is
// also demo transport: production carries these envelopes over TLS, and a production
// design would use an HPKE-class standard rather than raw RSA-OAEP.
import { generateKeyPairSync, publicEncrypt, privateDecrypt, constants } from 'node:crypto';

const OAEP = { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };

// Every actor creates confidentiality keys the same way, so no actor is a special case.
export function generateEnvelopeKeys() {
  return generateKeyPairSync('rsa', { modulusLength: 4096 });
}

// Plaintext capacity of one envelope: k - 2*hLen - 2, i.e. 512 - 64 - 2 for RSA-4096 with
// OAEP-SHA256. This constant is the RSA-4096 DEMO value; seal() derives the real cap from
// the recipient key, because capacity is a property of that key and not of this module.
// Measured demo payloads sit at 148 B (request) and 270 B (response, 60% of cap) — so ONE
// primitive, with no chunking and no hand-rolled hybrid, covers profile-mode Mode A end to
// end. Anything bigger (Mode B holder presentment, multi-attestation bundles) does NOT fit
// this envelope and would need a vetted AEAD hybrid scheme adopted as an explicit, separate
// decision — never primitives glued together by hand.
export const OAEP_CAPACITY = 446;

// Sender side. The payload is the sender's OWN data, so a payload that cannot fit is a
// fault in the sender's code: throw loudly. Silent truncation would ship a half message
// that the recipient could not tell apart from a whole one.
//
// Capacity is derived from the RECIPIENT's key, never assumed. A hard-coded 446 is only
// correct for RSA-4096: against an RSA-2048 recipient a 191-446 B payload would sail past
// the guard and die inside OpenSSL as 'data too large for key size' — precisely the
// unhelpful failure this guard exists to replace — while a larger recipient key would have
// legal payloads falsely rejected.
export function seal(recipientPublicKey, payloadBytes) {
  if (!Buffer.isBuffer(payloadBytes)) {
    throw new Error('seal: payloadBytes must be a Buffer');
  }
  // A PEM string, a non-RSA KeyObject (e.g. Ed25519, whose details carry no modulus) or the
  // wrong type entirely all land here: there is no capacity to derive, so say so plainly
  // rather than let publicEncrypt fail later with an OpenSSL keytype error.
  const modulusBits = recipientPublicKey?.asymmetricKeyDetails?.modulusLength;
  if (typeof modulusBits !== 'number') {
    throw new Error(
      'seal: recipientPublicKey must be an RSA KeyObject (no modulusLength in asymmetricKeyDetails, ' +
      `got ${recipientPublicKey?.asymmetricKeyType ?? typeof recipientPublicKey})`
    );
  }
  const capacity = modulusBits / 8 - 66; // k - 2*hLen - 2, hLen = 32 for OAEP-SHA256
  if (payloadBytes.length > capacity) {
    throw new Error(
      `seal: payload is ${payloadBytes.length} bytes, over the ${capacity}-byte OAEP capacity ` +
      `of one RSA-${modulusBits} envelope`
    );
  }
  return publicEncrypt({ key: recipientPublicKey, ...OAEP }, payloadBytes);
}

// Recipient side. The ciphertext is UNTRUSTED WIRE INPUT — anyone can send anything — so
// nothing here may throw: every failure is a returned verdict.
// Measured in the spike on Node 22: privateDecrypt throws on EVERY failure mode (a flipped
// bit, a wrong key, random bytes, a wrong-length buffer). So the catch below IS the
// rejection contract, not decoration — remove it and tampered input crashes the recipient.
// The failure modes are also deliberately NOT told apart: a padding oracle is built by
// reporting *why* a decryption failed, so they all collapse to one reason.
export function open(privateKey, ciphertext) {
  if (!Buffer.isBuffer(ciphertext)) {
    return { ok: false, reason: 'malformed ciphertext' };
  }
  try {
    return { ok: true, payloadBytes: privateDecrypt({ key: privateKey, ...OAEP }, ciphertext) };
  } catch {
    return { ok: false, reason: 'undecryptable' };
  }
}
