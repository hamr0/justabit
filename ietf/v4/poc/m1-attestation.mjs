// PoC module M1 — attestation core. The operator signs a windowed answer;
// the requester verifies it. Ed25519, node:crypto only, zero dependencies.
import { sign, verify } from 'node:crypto';

// Operator side. `claims` = { predicate, result, nonce, exp } (exp = unix ms).
// The claims are serialized ONCE and those exact bytes are what gets signed and
// shipped — sign-what-you-ship. No canonicalization scheme is needed because the
// verifier never re-serializes: it checks the signature over the bytes it received.
export function attest(privateKey, claims) {
  const payloadBytes = Buffer.from(JSON.stringify(claims), 'utf8');
  const signature = sign(null, payloadBytes, privateKey);
  return { payloadBytes, signature };
}

// Step 3.5 helper. Scans the EXACT payload text for a repeated top-level key.
// JSON.parse is last-wins on duplicates (RFC 8259 leaves them undefined; other
// parsers take first, or reject), so without this check one validly signed byte
// string could read result:true to one verifier and result:false to another —
// operator equivocation. Keys are DECODED before comparison (the escaped spelling
// "\u0072esult" IS "result"). Only depth-1 keys matter: any nested value fails the
// type checks anyway.
//
// EXPORTED 2026-08-17 for M6 (decision log), because a signed REQUEST is signed
// bytes too and the equivocation is symmetric: one signature over bytes carrying
// `floor` twice lets the operator read the loose floor while the requester
// believes the tight one. Verifying a request cannot reuse verifyAttestation
// (that demands the closed ANSWER set {predicate,result,nonce,exp}, which a
// request does not have), so this byte-level scan is the one piece M6 must borrow
// rather than re-implement — a second copy of this loop is a second thing to get
// wrong, and it would be the copy facing the wire first.
//
// PRECONDITION, and the reason this is an export rather than a rewrite: `text`
// MUST already have parsed as JSON. On valid JSON every quote-delimited run this
// walks is a well-formed string token, so the key slice below cannot throw; on
// arbitrary bytes it can (`"\q"` is not a JSON string). M1 itself calls it in
// exactly that order — signature, then parse, then this — and M6 does the same.
export function hasDuplicateTopLevelKey(text) {
  const seen = new Set();
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      const start = i;
      for (i++; i < text.length; i++) {
        if (text[i] === '\\') i++;
        else if (text[i] === '"') break;
      }
      let j = i + 1;
      while (j < text.length && ' \t\n\r'.includes(text[j])) j++;
      if (depth === 1 && text[j] === ':') {
        const key = JSON.parse(text.slice(start, i + 1)); // safe: whole text already parsed
        if (seen.has(key)) return true;
        seen.add(key);
      }
    } else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
  }
  return false;
}

// Requester side. `response` = { payloadBytes, signature } as returned by attest —
// untrusted, straight off the wire, so nothing in it may throw.
// `expected` = { predicate, nonce, nowMs } — the caller's OWN input, trusted.
// Checks run in order, first failure wins. The order matters: nothing from the
// payload is trusted — or even parsed — until the signature over the raw bytes holds.
export function verifyAttestation(trustedPublicKey, response, expected) {
  // 1. Shape of the response itself — a transport/caller fault, not a forgery, so it
  // gets its own reason: 'bad signature' here would misreport plumbing as an attack.
  // BOTH fields must be Buffers: anything else off the wire (a base64 string signature,
  // an object, undefined) is plumbing, and is named as such before crypto is touched.
  if (!Buffer.isBuffer(response?.payloadBytes) || !Buffer.isBuffer(response.signature)) {
    return { accepted: false, reason: 'malformed response' };
  }

  // 2. Signature over the RAW bytes, before any parse. Measured on Node 22: a malformed
  // signature *Buffer* returns false, it does not throw — and step 1 now guarantees a
  // Buffer, so untrusted input can no longer reach this try/catch at all. It stays as a
  // defensive backstop for the one remaining thrower: a broken or wrong-type TRUSTED KEY
  // supplied by the caller's own config (measured on Node 22: e.g. a string key makes
  // crypto.verify throw ERR_OSSL_UNSUPPORTED). Even that is a rejection, not an exception.
  let signatureOk = false;
  try {
    signatureOk = verify(null, response.payloadBytes, trustedPublicKey, response.signature);
  } catch {
    return { accepted: false, reason: 'bad signature (malformed)' };
  }
  if (!signatureOk) return { accepted: false, reason: 'bad signature' };

  // 3. Parse. A validly signed payload can still be any JSON value (`null`, an array,
  // a bare number), so it must be an object before any field is read — reading
  // `.predicate` off `null` would throw.
  let claims;
  try {
    claims = JSON.parse(response.payloadBytes.toString('utf8'));
  } catch {
    return { accepted: false, reason: 'unparseable payload' };
  }
  if (typeof claims !== 'object' || claims === null || Array.isArray(claims)) {
    return { accepted: false, reason: 'malformed claims' };
  }

  // 3.5 Duplicate keys. `claims` above is V8's LAST-wins reading of the bytes; a
  // first-wins parser reads the same signed bytes differently. Both readings verify,
  // so the ambiguity itself is the attack — reject it at the byte level.
  if (hasDuplicateTopLevelKey(response.payloadBytes.toString('utf8'))) {
    return { accepted: false, reason: 'duplicate claim keys' };
  }

  // 4. Predicate. A missing predicate fails the typeof, so an unlabelled answer
  // can never be read as an answer to whatever the requester happened to ask.
  if (typeof claims.predicate !== 'string' || claims.predicate !== expected.predicate) {
    return { accepted: false, reason: 'predicate mismatch' };
  }

  // 5. Result. A profile-mode answer IS a signed boolean — a missing result, or a truthy
  // stand-in like the string 'false', is not an answer and must not be read as one by a
  // caller that only tests `claims.result`.
  if (typeof claims.result !== 'boolean') {
    return { accepted: false, reason: 'missing or non-boolean result' };
  }

  // 6. Nonce — binds the answer to this request. The typeof guard is load-bearing: without
  // it, claims carrying no nonce would match an `expected` whose nonce is also undefined,
  // i.e. fail open on the caller's own mistake. Note this is BINDING, not replay
  // protection: the verifier is stateless, so the same response re-presented against the
  // SAME expected nonce within exp verifies again. Issuing single-use, per-request nonces
  // is the requester's job, out of scope for M1.
  if (typeof claims.nonce !== 'string' || claims.nonce !== expected.nonce) {
    return { accepted: false, reason: 'nonce mismatch' };
  }

  // 7. Expiry. Missing or non-numeric exp counts as expired, never as "no deadline".
  if (!(typeof claims.exp === 'number' && claims.exp > expected.nowMs)) {
    return { accepted: false, reason: 'expired' };
  }

  // 8. Closed claim set. The one invariant of profile mode is that the answer IS a signed
  // boolean and NEVER carries the underlying raw value. A leaky operator that ships e.g. a
  // swap timestamp or a birthdate alongside the bit would otherwise have every check above
  // pass, and the raw value would reach the requester in `claims`. So the set is closed:
  // anything outside {predicate, result, nonce, exp} is a rejection, not a passthrough.
  const allowed = new Set(['predicate', 'result', 'nonce', 'exp']);
  const extra = Object.keys(claims).filter((k) => !allowed.has(k));
  if (extra.length > 0) {
    return { accepted: false, reason: `unexpected fields: ${extra.join(', ')}` };
  }

  return { accepted: true, reason: 'ok', claims };
}
