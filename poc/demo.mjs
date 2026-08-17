// PoC M6 — the one-command demo. Run: node poc/demo.mjs [--backend mock|orange]
//
// This is the surface a CAMARA/AAIF reader sees, so it explains itself as it
// goes. It composes M1 (attestation core), M2 (blind envelope), M3 (floor gate)
// and M4/M5 (facts) into the four assertions of PRD §4.1 — each one followed by
// its NEGATIVE FLIP, because an assertion that cannot fail proves nothing.
//
// Exit 0 = everything held. Exit 1 = something failed. Exit 2 = the chosen
// backend could not start at all (e.g. `--backend orange` with no credential):
// a prerequisite failure is not a test result, and it is never a silent
// fallback to the mock.
//
// M6 owns exactly four things no module owns, and each one is load-bearing:
//   1. the transport frame `{iss, payload, sig}` (M1 emits Buffers, M2 carries
//      one Buffer, nothing in between named the encoding);
//   2. the CANONICAL PREDICATE STRING both sides must derive byte-identically
//      (M1 signs a string id, M4 evaluates an object — a lossy mapping here
//      silently re-opens "an answer can never answer a different question");
//   3. the single-use NONCE STORE (M1's nonce check is stateless BINDING; replay
//      rejection is the requester's job, by M1's own documented limit);
//   4. the REASON CLAMP (M3 builds rejection reasons from wire input and does
//      not bound them; M2's seal() THROWS above the envelope capacity — so an
//      unclamped refusal would crash the operator instead of refusing).
//
// Claims discipline (repo invariant): Mode A is ATTESTED WINDOWED DISCLOSURE.
// Nothing here is zero-knowledge and nothing here says it is.
import { randomBytes, generateKeyPairSync, sign as edSign, verify as edVerify } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { attest, verifyAttestation, hasDuplicateTopLevelKey } from './m1-attestation.mjs';
import { generateEnvelopeKeys, seal, open, OAEP_CAPACITY } from './m2-envelope.mjs';
import { checkFloor } from './m3-floor.mjs';
import { createMockFacts, evaluatePredicate } from './m4-facts-mock.mjs';
import { createOrangeFacts } from './m5-facts-orange.mjs';

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const DAY_MS = 86400000;

// ─────────────────────────────── the one clock ───────────────────────────────
// ONE injected instant for the whole run: the operator's facts, the answer's
// expiry, and every requester-side check read this same value. Two clocks would
// make the expiry assertion a race, and a wall clock would make the printed
// evidence unreproducible — the same reason M4 stores backstories as "N days
// ago" and M5 differences Orange's absolute date back against an injected now.
export const NOW = Date.UTC(2026, 7, 17);
export const VALIDITY_MS = 60_000;

// The Orange Playground CUSTOM slot (built-ins silently shadow writes — M5's
// measured trap). Same number either backend, so the backend really is the only
// thing that differs.
export const DEMO_NUMBER = '+990100000099';
const SWAPPED_DAYS_AGO = 137;   // deliberately not a round number
const FLIPPED_DAYS_AGO = 3;

// ─────────────────── what the operator publishes, in one place ───────────────
// The consumer-agent reference floor (proposal §3.4). A request may TIGHTEN
// every axis and may never loosen one (profile rule 5 / FR4).
export const PUBLISHED_FLOOR = Object.freeze({ simType: 'voice+data', tenureMin: 'P2Y', swapAgeMin: 'P90D' });

// DECISION #1 (2026-08-17, user-signed): PREDICATE THRESHOLDS ARE QUANTISED.
//
// Every individual response in this demo is a windowed bit and leaks nothing.
// The SEQUENCE is a different matter, and the M6 composition spike measured it:
// with a free-choice threshold, 9 perfectly legal, signed, sealed, metered
// queries binary-searched the subscriber's exact swap age (137 days, recovered
// exactly) — the raw value the one invariant exists to protect, reassembled out
// of bits that were each individually clean. No module is wrong: M3 gates
// FLOORS, not predicate thresholds, and profile rule 1 hands the threshold to
// the requester on purpose ("the window is in the QUESTION").
//
// So the window the requester may choose from is PUBLISHED and COARSE. Off-menu
// is refused loudly, never quietly rounded to the nearest bucket — rounding
// would answer a question nobody asked, and silently widen or tighten it.
// Quantisation does not stop the oracle, it CAPS ITS RESOLUTION at the bucket:
// the walk still reveals which of four buckets the subscriber sits in (2 bits),
// and never the day. The residual walk is priced by the other two mitigations —
// see the honest-limit paragraph in the CAMARA proposal §3.5.
//
// Only ordered thresholds get a menu, and the absence of one is a statement,
// not an oversight: `roamingIn` takes a SET, which has no ordering to bisect (an
// exhaustive walk of ~249 countries costs 249 metered queries to learn the one
// country — i.e. the answer itself, which the rate limit and the per-query bill
// are the correct defence against), and `reachable` is already a single bit at
// full resolution, so there is nothing left to quantise.
export const PUBLISHED_THRESHOLD_MENU = Object.freeze({
  simSwapAge: Object.freeze(['P30D', 'P90D', 'P180D', 'P365D']),
});

// ─────────────────────────── M6-owned: the transport frame ───────────────────
// M1 emits/consumes Buffers; M2 carries exactly one Buffer. Nothing owns the
// {payloadBytes, signature, iss} encoding, so M6 mints one. `iss` rides OUTSIDE
// the signature on purpose: it is a key-resolution HINT (profile rule 3), and
// the response side below never lets it choose a key.
export function packSigned({ payloadBytes, signature }, iss) {
  return Buffer.from(JSON.stringify({
    iss,
    payload: payloadBytes.toString('base64'),
    sig: signature.toString('base64'),
  }), 'utf8');
}

// Untrusted wire input: a verdict (`null`), never a throw.
export function unpackSigned(bytes) {
  let o;
  try { o = JSON.parse(bytes.toString('utf8')); } catch { return null; }
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return null;
  if (typeof o.iss !== 'string' || typeof o.payload !== 'string' || typeof o.sig !== 'string') return null;
  // Buffer.from(x,'base64') is LENIENT — garbage decodes to garbage and surfaces
  // one step later as 'bad signature'. Honest limit, stated rather than hidden:
  // a transport typo is therefore reported as a forgery, the exact conflation
  // M1's own step 1 avoids for the shape it owns.
  return {
    iss: o.iss,
    signed: { payloadBytes: Buffer.from(o.payload, 'base64'), signature: Buffer.from(o.sig, 'base64') },
  };
}

// ───────────────────── M6-owned: the canonical predicate string ──────────────
// M1 signs a predicate STRING; M4 evaluates a predicate OBJECT. Both sides must
// derive byte-identical strings or a correct answer is rejected as 'predicate
// mismatch' — and, far worse, a LOSSY mapping makes two different questions
// render the same, so an answer to one reads as an answer to the other with a
// valid signature over it. The spike proved both halves: dropping the threshold
// left every test green while the operator answered `gte P1D` to a `gte P90D`
// question, and the obvious `[FR,BE]` spelling collided with the single-element
// set `['FR,BE']`.
//
// So the mapping is INJECTIVE by construction: `JSON.stringify` of the validated
// value distinguishes `["FR","BE"]` from `["FR,BE"]`, and the threshold is
// always part of the string. Called only AFTER `evaluatePredicate` has answered,
// so `type`/`operator` are known literals and `value` is a validated string,
// boolean, or array of two-letter codes — nothing here can run caller code.
export function canonicalPredicate(p) {
  return `${p.type} ${p.operator} ${JSON.stringify(p.value)}`;
}

// ────────────────────────── M6-owned: the reason clamp ───────────────────────
// A refusal crosses the wire too. M3 builds its reasons from WIRE input and does
// not bound them (deliberately — the clamp belongs on the side that knows the
// envelope capacity), and M2's seal() THROWS above that capacity. Unclamped, a
// long enough floor value would make the operator CRASH instead of refuse.
// Measured at the spike: the worst reason one request envelope can provoke still
// fits a signed refusal — but only as a coincidence of two independently chosen
// constants (M2's 446-byte cap and M3's reason prefix), so this is cheap
// insurance, not decoration.
export const WIRE_REASON_MAX = 120;
export function clampReason(r) {
  if (typeof r !== 'string') return 'rejected';
  return r.length > WIRE_REASON_MAX ? `${r.slice(0, WIRE_REASON_MAX)}…` : r;
}

// ══════════════════════════════ the three actors ═════════════════════════════

// ── the blind hub ────────────────────────────────────────────────────────────
// It routes, meters and bills. It holds no key that opens anything it carries.
export function createHub() {
  const log = [];
  let seq = 0;
  return {
    log,
    // `controls.chatty` is the negative control for assertion 3 and nothing else:
    // a hub operator adding a "helpful" debug field. It is the whole point that
    // this is a POLICY choice on their side, and that the same scanner catches it.
    route(from, to, ciphertext, controls = {}) {
      const entry = { seq: ++seq, from, to, bytes: ciphertext.length, bill: 'EUR 0.002' };
      if (controls.chatty) entry.debug = controls.chatty;
      log.push(entry);
      return ciphertext;
    },
  };
}

// ── the operator ─────────────────────────────────────────────────────────────
// The pipeline order is the design. Nothing from the request is trusted, parsed
// or acted on before the signature over the exact bytes holds, and no FACT is
// touched before the floor and the menu have both passed — an answer computed
// and then discarded is still an answer the operator produced.
export function createOperator({ keys, directory, backend, floor = PUBLISHED_FLOOR, menu = PUBLISHED_THRESHOLD_MENU }) {
  // Not sealed: there is no identified requester yet, so there is nobody to seal
  // to and no nonce to bind to. An operator cannot sign a refusal to a party it
  // cannot name — so these come back in the clear, and the requester must treat
  // them as untrusted hearsay (the hub could have made them up).
  const transportReject = (reason) => ({ kind: 'reject', stage: 'transport', reason, sealed: null });

  // Sealed and SIGNED: past this point the requester is authenticated and the
  // nonce is known. Signing refusals matters — otherwise the blind hub could
  // forge a denial-of-service by inventing rejections, and the requester could
  // not tell that from an operator that genuinely refused.
  const signedReject = (reason, nonce) => {
    const claims = { error: clampReason(reason), nonce, exp: NOW + VALIDITY_MS };
    const bytes = packSigned(attest(keys.opSig.privateKey, claims), keys.opIss);
    return { kind: 'reject', stage: 'operator', reason: claims.error, claims, plain: bytes, sealed: seal(keys.rpEnc.publicKey, bytes) };
  };

  // `controls` exists so each negative can be shown FAILING as well as holding:
  // a guard that is never disabled has not been proven load-bearing. A reader
  // running the demo passes none of them.
  async function handle(sealedRequest, controls = {}) {
    // 1. M2 — open the envelope. Untrusted: a verdict, never a throw.
    const opened = open(keys.opEnc.privateKey, sealedRequest);
    if (!opened.ok) return transportReject(opened.reason);

    // 2. M6 — unpack the transport frame.
    const unpacked = unpackSigned(opened.payloadBytes);
    if (unpacked === null) return transportReject('malformed request');

    // 3. Directory lookup BY `iss`. This is the request side, where looking up
    //    an issuer is exactly right: the operator is deciding whether it knows
    //    this requester at all. (The RESPONSE side must never do this — see the
    //    pinning comment in createRP.)
    const entry = hasOwn(directory, unpacked.iss) ? directory[unpacked.iss] : null;
    if (entry === null) return transportReject('unknown issuer');

    // 4. Request authenticity, over the exact bytes, before anything is parsed.
    //    This is the seam that closes M2's audit open item: without it, anyone
    //    who can reach the operator's public envelope key can pose as any RP.
    if (!controls.skipRequestAuth) {
      let sigOk = false;
      try {
        sigOk = edVerify(null, unpacked.signed.payloadBytes, entry.sigPub, unpacked.signed.signature);
      } catch { return transportReject('bad request signature (malformed)'); }
      if (!sigOk) return transportReject('bad request signature');
    }

    // 5. Parse — first moment any content is read.
    const text = unpacked.signed.payloadBytes.toString('utf8');
    let req;
    try { req = JSON.parse(text); } catch { return transportReject('unparseable request'); }
    if (typeof req !== 'object' || req === null || Array.isArray(req)) return transportReject('malformed request claims');

    // 6. DECISION #2 (2026-08-17, user-signed) — duplicate top-level keys, using
    //    M1's own exported scanner over the exact signed bytes, in M1's own order
    //    (signature → parse → scan; the scanner's stated precondition is that the
    //    text already parsed). One signature over bytes carrying `floor` twice
    //    reads as P90D to a last-wins parser and P365D to a first-wins one: the
    //    operator enforces one, the requester believes the other, and both hold a
    //    valid signature. The remedy is a clean re-request with a fresh nonce —
    //    never a partial acceptance, and NEVER a pick between the two values.
    if (!controls.skipDupKeyScan && hasDuplicateTopLevelKey(text)) {
      return transportReject('duplicate top-level key in request (ambiguous bytes — re-request cleanly)');
    }

    // 7. Shape. A nonce is required before any refusal can be signed and bound.
    if (typeof req.nonce !== 'string') return transportReject('missing nonce');
    if (typeof req.number !== 'string') return signedReject('missing subscriber', req.nonce);

    // 8. M3 — the monotone floor gate, BEFORE any fact is touched.
    if (!controls.skipFloorGate) {
      const verdict = checkFloor(floor, req.floor);
      if (!verdict.allowed) return { ...signedReject(verdict.reason, req.nonce), floorRejected: true };
    }

    // 9. The published threshold menu (decision #1), also before any fact is
    //    touched: a computed-then-discarded answer is still an oracle query.
    //    Nothing wire-supplied enters this diagnostic — the type is checked to be
    //    one of the menu's own keys and the value is never echoed — so there is
    //    nothing here to clamp and nothing to run.
    if (!controls.skipMenu) {
      const type = typeof req.predicate?.type === 'string' ? req.predicate.type : null;
      if (type !== null && hasOwn(menu, type) && !menu[type].includes(req.predicate.value)) {
        return { ...signedReject(`threshold not on the published menu for ${type} (allowed: ${menu[type].join(', ')})`, req.nonce), menuRejected: true };
      }
    }

    // Control for the injective-canonicalisation negative, applied HERE and not
    // earlier on purpose: the attack it models is an operator that accepts a
    // perfectly legitimate question — passing the floor gate and the menu — and
    // then answers a DIFFERENT one. Substituting before those gates would model
    // a requester asking the other question instead, which they would simply be
    // refused for, and the case would assert the wrong guard entirely.
    if (controls.answerPredicate) req.predicate = controls.answerPredicate;

    // 10. Facts — operator-internal, never wire-bound. Both adapters THROW on an
    //     unscripted number (M4's decision 4: a fabricated fact is worse than no
    //     answer, because it gets signed), and the number came off the wire, so
    //     the throw is caught here and answered as a loud refusal. `await` covers
    //     both backends: M4 is synchronous, M5 is not, and that is the only shape
    //     difference between them.
    let facts;
    try {
      facts = await backend.getFacts(req.number, NOW);
    } catch (e) {
      return signedReject(e instanceof Error ? e.message : 'facts unavailable', req.nonce);
    }

    // 11. M4 — facts + predicate → the BIT. Never throws; an unanswerable
    //     predicate comes back refused, never as a defaulted `false`.
    const ev = evaluatePredicate(facts, req.predicate);
    if (!ev.answered) return signedReject(ev.reason, req.nonce);

    // 12. Canonicalise AFTER M4 has validated — canonicalising first would run
    //     caller-supplied code (Array.prototype.join over a wire array) on
    //     unvalidated input, which the spike watched happen.
    const claims = {
      predicate: canonicalPredicate(req.predicate),
      result: ev.result,
      nonce: req.nonce,
      exp: NOW + VALIDITY_MS,
    };
    // The leaky-operator control for assertion 1: ship the age alongside the bit.
    if (controls.leakRaw) claims.swapAgeMs = facts.swapAgeMs;

    // 13. M1 signs, M6 packs, M2 seals.
    const plain = packSigned(attest(keys.opSig.privateKey, claims), keys.opIss);
    return { kind: 'answer', claims, plain, sealed: seal(keys.rpEnc.publicKey, plain) };
  }

  return { handle };
}

// ── the requester (RP) ───────────────────────────────────────────────────────
export function createRP({ keys, directory }) {
  // M6-owned: the single-use nonce store. M1's nonce check is stateless BINDING
  // and says so in its own comments — the same response re-presented against the
  // same expected nonce verifies again, forever, until it expires. Replay
  // rejection therefore lives entirely here, which is why the negative below
  // disables THIS and not anything in M1.
  const pending = new Map();

  // `nonce` is injectable for the same reason M4's clock is: a caller that
  // supplies one gets a byte-reproducible transcript, which is how the M6 check
  // proves the two backends produce IDENTICAL signed claim bytes. Left alone it
  // is 16 fresh random bytes per request, which is the only behaviour the demo
  // itself ever uses.
  function buildRequest(predicate, floorDemanded, { number = DEMO_NUMBER, nonce = randomBytes(16).toString('hex') } = {}) {
    // The subscriber number rides INSIDE the sealed, signed request, so the hub
    // never sees it (note 1 in the demo output). It stands in for token-derived
    // identity: a real 3-legged deployment derives the subject from the access
    // token and omits the identifier entirely — the NumberVerification precedent,
    // where identifier omission is already normative, generalised by profile
    // rule 4.
    const req = { number, predicate, floor: floorDemanded, nonce };
    pending.set(nonce, { predicate: canonicalPredicate(predicate) });
    const plain = packSigned(attest(keys.rpSig.privateKey, req), keys.rpIss);
    // seal() THROWS if the RP's own request will not fit one envelope — the
    // sender's own fault per M2, loud here, never a truncated half-request.
    return { nonce, plain, sealed: seal(keys.opEnc.publicKey, plain) };
  }

  // A signed operator REFUSAL. Deliberately a separate function from
  // verifyAttestation and deliberately incapable of returning an accepted
  // answer: a refusal has no `result`, and no code path here mints one.
  function verifyRefusal(pinnedKey, signed, nonce, nowMs) {
    let ok = false;
    try { ok = edVerify(null, signed.payloadBytes, pinnedKey, signed.signature); } catch { return null; }
    if (!ok) return null;
    let claims;
    try { claims = JSON.parse(signed.payloadBytes.toString('utf8')); } catch { return null; }
    if (typeof claims !== 'object' || claims === null || Array.isArray(claims)) return null;
    const keys_ = Object.keys(claims).sort().join(',');
    if (keys_ !== 'error,exp,nonce') return null;
    if (typeof claims.error !== 'string' || claims.nonce !== nonce) return null;
    if (!(typeof claims.exp === 'number' && claims.exp > nowMs)) return null;
    return claims.error;
  }

  function verifyResponse(sealedResponse, nonce, nowMs, controls = {}) {
    const opened = open(keys.rpEnc.privateKey, sealedResponse);
    if (!opened.ok) return { accepted: false, reason: opened.reason };
    const unpacked = unpackSigned(opened.payloadBytes);
    if (unpacked === null) return { accepted: false, reason: 'malformed response' };

    // Single-use nonce FIRST: a replay must die before any crypto is spent on it.
    const expected = pending.get(nonce);
    if (expected === undefined && !controls.skipNonceStore) {
      return { accepted: false, reason: 'unknown or already-used nonce' };
    }

    // KEY PINNING (profile rule 3). The RP pins the operator key it expects for
    // this PLMN; `iss` off the wire is a hint and never selects the key. The
    // signature authenticates iss→key, NOT that this issuer was entitled to
    // answer — so letting `iss` pick the key lets ANY directory-listed party,
    // routed by an untrusted aggregator, answer a query addressed to someone
    // else. `controls.trustIssHint` exists only to show exactly that.
    const pinned = controls.trustIssHint && hasOwn(directory, unpacked.iss)
      ? directory[unpacked.iss].sigPub
      : directory[keys.opIss].sigPub;

    const want = expected ?? { predicate: canonicalPredicate(controls.fallbackPredicate) };
    const v = verifyAttestation(pinned, unpacked.signed, { predicate: want.predicate, nonce, nowMs });
    // CONSUMED on any verified exchange, answer or refusal: one nonce, one
    // exchange. The remedy for a refusal is a fresh request with a fresh nonce.
    if (!controls.skipNonceStore) pending.delete(nonce);
    if (v.accepted) return v;

    const refusal = verifyRefusal(pinned, unpacked.signed, nonce, nowMs);
    if (refusal !== null) return { accepted: false, refused: true, reason: `operator refused: ${refusal}` };
    return v;
  }

  return { pending, buildRequest, verifyResponse };
}

// ══════════════════════════ the backend seam (FR5) ═══════════════════════════
// The ONLY difference between `--backend mock` and `--backend orange`. Both
// adapters expose the same two operations over the same injected clock, and
// `evaluatePredicate` is M4's in BOTH cases — M5 deliberately does not
// reimplement it, which is what makes the swap a swap rather than a second code
// path. `fetchImpl`/`basicAuth` are dependency injection so the M6 check can
// replay captured Orange bytes offline: one code path, no test-only branch.
export async function createBackend(mode, { basicAuth, fetchImpl } = {}) {
  if (mode === 'mock') {
    const facts = createMockFacts();
    return {
      label: 'mock — zero credentials, zero network, deterministic',
      // M4's setBackstory takes no clock (its backstories are already relative);
      // M5's takes one, because it converts to an absolute date for Orange. The
      // uniform 3-argument shape here is the whole adapter difference.
      setBackstory: async (number, backstory) => facts.setBackstory(number, backstory),
      getFacts: async (number, nowMs) => facts.getFacts(number, nowMs),
    };
  }
  if (mode === 'orange') {
    const facts = createOrangeFacts({ basicAuth, fetchImpl });
    return {
      label: 'orange — live Orange Network APIs Playground',
      setBackstory: (number, backstory, nowMs) => facts.setBackstory(number, backstory, nowMs),
      getFacts: (number, nowMs) => facts.getFacts(number, nowMs),
    };
  }
  throw new Error(`unknown backend: ${JSON.stringify(mode)} (use mock or orange)`);
}

// A whole world: keys, directory, hub, operator, RP. Keys are exchanged OUT OF
// BAND and never ride inside a payload (M2 decision, 2026-08-15). Two key types
// per actor, because signing and confidentiality are different jobs: Ed25519 for
// M1 signatures, RSA-4096 for M2 envelopes.
export function generateKeys() {
  return {
    opSig: generateKeyPairSync('ed25519'),
    rpSig: generateKeyPairSync('ed25519'),
    opEnc: generateEnvelopeKeys(),
    rpEnc: generateEnvelopeKeys(),
    opIss: 'op:demo-plmn-001',
    rpIss: 'rp:demo-agent-01',
  };
}

// `keys` is injectable because RSA-4096 generation costs ~2.7s per key on the
// machine this was measured on, and the M6 check builds a fresh world per case
// (fresh nonce store, fresh hub log — the state that can make a case pass for
// the wrong reason). Sharing one key set across those worlds takes the suite
// from minutes to seconds and changes nothing it asserts; the cases that
// genuinely turn on key identity mint their own keys anyway.
export function createWorld({ backend, floor, menu, keys = generateKeys() }) {
  const directory = Object.freeze({
    [keys.opIss]: { sigPub: keys.opSig.publicKey, encPub: keys.opEnc.publicKey },
    [keys.rpIss]: { sigPub: keys.rpSig.publicKey, encPub: keys.rpEnc.publicKey },
  });
  return {
    keys,
    directory,
    hub: createHub(),
    operator: createOperator({ keys, directory, backend, floor, menu }),
    rp: createRP({ keys, directory }),
  };
}

// A full round trip through the hub, both legs, for one request. Exported
// because it is the shape every assertion below uses and the M6 check drives it
// directly for the backend-seam comparison.
export async function roundTrip(world, request, { operator: opControls = {}, rp: rpControls = {}, hub: hubControls = {}, nowMs = NOW + 1_000 } = {}) {
  const atOperator = world.hub.route(world.keys.rpIss, world.keys.opIss, request.sealed, hubControls);
  const out = await world.operator.handle(atOperator, opControls);
  if (out.sealed === null) return { out, verdict: { accepted: false, reason: out.reason } };
  const atRp = world.hub.route(world.keys.opIss, world.keys.rpIss, out.sealed, hubControls);
  return { out, atRp, verdict: world.rp.verifyResponse(atRp, request.nonce, nowMs, rpControls) };
}

// ═══════════════════════════ the wire-byte scanner ═══════════════════════════
// The raw values the operator holds and must never ship. The DAY COUNT itself
// ("137") is deliberately NOT a needle: three digits appear inside a 32-character
// hex nonce roughly once every 140 runs, so scanning for it would produce a
// flaky red that says nothing. The long forms — the age in ms, the swap instant,
// the ISO date, and the internal field names — are the values that would
// actually leak, and they are unmistakable.
export function rawNeedles(daysAgo) {
  const ageMs = daysAgo * DAY_MS;
  const atMs = NOW - ageMs;
  return [String(ageMs), String(atMs), new Date(atMs).toISOString(), 'swapAgeMs', 'roamingCountry'];
}
export function scan(buf, needles) {
  const s = Buffer.isBuffer(buf) ? buf.toString('latin1') : String(buf);
  return needles.filter((n) => s.includes(n));
}

// ════════════════════════════════ the report ═════════════════════════════════
const results = [];
const out = (s = '') => console.log(s);
const section = (title) => out(`\n══ ${title}\n`);
const step = (s) => out(`   · ${s}`);
const note = (s) => out(`     ${s}`);
function qa(question, backstory, answer) {
  out('');
  out(`   Q: ${question}`);
  out(`      (backstory: ${backstory})`);
  out(`   A: ${answer}`);
  out('');
}
function assert(label, ok, evidence) {
  results.push(ok === true);
  out(`   ${ok === true ? 'PASS' : 'FAIL'} ${label}${evidence ? ` — ${evidence}` : ''}`);
}
function flip(label, ok, evidence) {
  results.push(ok === true);
  out(`   negative flip → ${ok === true ? 'PASS' : 'FAIL'}: ${label}${evidence ? ` — ${evidence}` : ''}`);
}

// ════════════════════════════════ the demo ═══════════════════════════════════
export async function runDemo(backend) {
  results.length = 0;   // so a second call in one process reports its own tally
  const world = createWorld({ backend });
  const { hub, rp, keys } = world;
  const NEEDLES = rawNeedles(SWAPPED_DAYS_AGO);
  const SWAP_ISO = new Date(NOW - SWAPPED_DAYS_AGO * DAY_MS).toISOString();

  await backend.setBackstory(DEMO_NUMBER, { swappedDaysAgo: SWAPPED_DAYS_AGO, roamingCountry: 'FR', reachable: true }, NOW);

  out('justabit — Mode A, attested windowed disclosure (never "zero-knowledge")');
  out('');
  out(`   backend      ${backend.label}`);
  out(`   clock        ${new Date(NOW).toISOString()} — injected everywhere, so this run`);
  out('                prints the same bytes today and in 2099');
  out(`   subscriber   ${DEMO_NUMBER} (Orange +990 test range; never a real number)`);
  out(`   floor        published: ${JSON.stringify(PUBLISHED_FLOOR)}`);
  out(`   thresholds   published menu: ${JSON.stringify(PUBLISHED_THRESHOLD_MENU.simSwapAge)} — see note 2`);
  out('   actors       RP "demo bank"  →  blind hub (meters + bills)  →  operator');

  // ───────────────────────────────────────────────────────────── assertion 1
  section('1. Attestation core — the answer is a signed bit, and the raw value never leaves');
  step('the requester picks a threshold off the published menu, seals the question for');
  step('the operator, and hands the envelope to the hub, which cannot open it.');

  const PREDICATE = { type: 'simSwapAge', operator: 'gte', value: 'P90D' };
  const q1 = rp.buildRequest(PREDICATE, { swapAgeMin: 'P180D' });   // tightening: legal
  const r1 = await roundTrip(world, q1);

  step(`operator: floor OK → threshold on menu → reads its own records → signs one bit.`);
  qa('has the SIM behind this number been in place for at least 90 days?',
    `the SIM was swapped ${SWAPPED_DAYS_AGO} days ago, on ${SWAP_ISO}`,
    `${r1.out.claims?.result} — and that is the entire disclosure`);

  assert('answer verified: signature, predicate, nonce, expiry',
    r1.verdict.accepted === true && r1.out.claims.result === true,
    `reason='${r1.verdict.reason}', request ${q1.plain.length} B / response ${r1.out.plain.length} B plaintext (envelope cap ${OAEP_CAPACITY} B)`);
  assert('the signed claim set is closed — exactly {predicate, result, nonce, exp}',
    JSON.stringify(Object.keys(r1.verdict.claims ?? {})) === '["predicate","result","nonce","exp"]',
    `keys=${JSON.stringify(Object.keys(r1.verdict.claims ?? {}))}`);
  note(`signed bytes, verbatim: ${unpackSigned(r1.out.plain).signed.payloadBytes.toString('utf8')}`);

  const artifacts1 = {
    ciphertext: r1.atRp,
    frame: r1.out.plain,
    claimBytes: unpackSigned(r1.out.plain).signed.payloadBytes,
    hubLog: Buffer.from(JSON.stringify(hub.log), 'utf8'),
  };
  const hits1 = Object.values(artifacts1).flatMap((a) => scan(a, NEEDLES));
  assert('no raw value in ANY wire artifact', hits1.length === 0,
    `scanned ${Object.keys(artifacts1).join(', ')} for [${NEEDLES.join(', ')}] → hits=${JSON.stringify(hits1)}`);

  step('and the bit is real, not decoration: re-script the backstory and re-ask.');
  await backend.setBackstory(DEMO_NUMBER, { swappedDaysAgo: FLIPPED_DAYS_AGO, roamingCountry: 'FR', reachable: true }, NOW);
  const q1b = rp.buildRequest(PREDICATE, { swapAgeMin: 'P180D' });
  const r1b = await roundTrip(world, q1b);
  qa('same question, same wire shape, different subscriber history',
    `the SIM was swapped ${FLIPPED_DAYS_AGO} days ago`,
    `${r1b.out.claims?.result}`);
  assert('the bit flips and the ciphertext length does not move',
    r1b.out.claims.result === false && r1b.verdict.accepted === true && r1b.out.sealed.length === r1.out.sealed.length,
    `${r1.out.sealed.length} B both times — RSA-OAEP ciphertext is fixed-length, so the billing record carries no content signal`);
  await backend.setBackstory(DEMO_NUMBER, { swappedDaysAgo: SWAPPED_DAYS_AGO, roamingCountry: 'FR', reachable: true }, NOW);

  // NEGATIVE: an operator that ships the age alongside the bit. Two independent
  // defences must both fire, or the scanner above was asserting nothing.
  const q1c = rp.buildRequest(PREDICATE, { swapAgeMin: 'P180D' });
  const r1c = await roundTrip(world, q1c, { operator: { leakRaw: true } });
  const leakHits = scan(unpackSigned(r1c.out.plain).signed.payloadBytes, NEEDLES);
  flip('a leaky operator reds the SAME scanner, and M1 rejects the response anyway',
    leakHits.length > 0 && r1c.verdict.accepted === false && r1c.verdict.reason === 'unexpected fields: swapAgeMs',
    `hits=${JSON.stringify(leakHits)}; requester verdict='${r1c.verdict.reason}' (closed claim set)`);

  // ───────────────────────────────────────────────────────────── assertion 2
  section('2. Nonce + validity — one question, one answer, and it goes stale');
  step('every request carries a fresh single-use nonce; the operator echoes it INSIDE');
  step('the signature, and the requester spends it on first use.');

  const q2 = rp.buildRequest(PREDICATE, { swapAgeMin: 'P180D' });
  const r2 = await roundTrip(world, q2);
  qa('is this answer the one I asked for, right now?',
    `nonce ${q2.nonce.slice(0, 12)}…, valid for ${VALIDITY_MS / 1000}s from ${new Date(NOW).toISOString()}`,
    `${r2.out.claims?.result} — accepted once`);

  const replay = world.rp.verifyResponse(r2.atRp, q2.nonce, NOW + 2_000);
  assert('replaying the operator\'s own sealed answer is REJECTED',
    replay.accepted === false && replay.reason === 'unknown or already-used nonce', `reason='${replay.reason}'`);

  // Checked on FIRST presentation, at a clock past the expiry — not on a second
  // one, or the single-use store would reject it as a replay before the expiry
  // check was ever reached and the case would assert the wrong guard.
  const q2b = rp.buildRequest(PREDICATE, { swapAgeMin: 'P180D' });
  const r2b = await roundTrip(world, q2b, { nowMs: NOW + 2 * VALIDITY_MS });
  assert('a still-valid signature past its expiry is REJECTED',
    r2b.verdict.accepted === false && r2b.verdict.reason === 'expired',
    `exp=${r2b.out.claims.exp}, checked at ${NOW + 2 * VALIDITY_MS} — the signature is fine; the window is not`);

  // NEGATIVE: replay rejection lives 100% in M6's nonce store — M1 is stateless
  // by design and says so. Turn the store off and the SAME replay sails through.
  const q2c = rp.buildRequest(PREDICATE, { swapAgeMin: 'P180D' });
  const r2c = await roundTrip(world, q2c);
  const replayOk = world.rp.verifyResponse(r2c.atRp, q2c.nonce, NOW + 2_000,
    { skipNonceStore: true, fallbackPredicate: PREDICATE });
  flip('with the single-use store disabled, the SAME replay is ACCEPTED',
    replayOk.accepted === true,
    `M1's nonce check is stateless BINDING, not replay protection — the store is the whole defence, so this is where it had to be disabled to prove it`);

  // ───────────────────────────────────────────────────────────── assertion 3
  section('3. Blind hub — it meters and bills, and it cannot read a thing');
  step('both legs are end-to-end encrypted between requester and operator. The hub');
  step('holds no key that opens them, so blindness is structural, not a promise.');

  const hubKeys = generateEnvelopeKeys();
  const hubTry = open(hubKeys.privateKey, r1.atRp);
  assert('the hub opening a message it just carried gets nothing',
    hubTry.ok === false, `hub open → '${hubTry.reason}'`);

  out('');
  out('   the hub\'s own log, printed verbatim:');
  for (const e of hub.log.slice(0, 4)) out(`     ${JSON.stringify(e)}`);
  out(`     … ${hub.log.length} entries total, all of this shape`);
  out('');

  const LOG_NEEDLES = [...NEEDLES, DEMO_NUMBER, 'simSwapAge', 'P90D', 'P180D'];
  const logHits = scan(JSON.stringify(hub.log), LOG_NEEDLES);
  assert('the log carries metering only: count, route, size, bill',
    logHits.length === 0, `scanned for [${LOG_NEEDLES.join(', ')}] → hits=${JSON.stringify(logHits)}`);
  note('honest limit, unchanged by composition: message COUNT, TIMING and the RP↔operator');
  note('PAIRING stay visible — that is exactly what metering needs. Rule 6 removes content,');
  note('not the fact of the query. Sizes are fixed-length here, so they carry no signal.');

  // NEGATIVE: a hub operator adds one "helpful" debug field.
  const chattyHub = createHub();
  chattyHub.route(keys.rpIss, keys.opIss, r1.atRp,
    { chatty: `${DEMO_NUMBER} asked simSwapAge P90D → true (swapAgeMs ${SWAPPED_DAYS_AGO * DAY_MS})` });
  const chattyHits = scan(JSON.stringify(chattyHub.log), LOG_NEEDLES);
  flip('one "helpful" hub debug field reds the SAME scanner',
    chattyHits.length > 0, `hits=${JSON.stringify(chattyHits)}`);

  // ───────────────────────────────────────────────────────────── assertion 4
  section('4. Monotone floor — a looser window is refused, never quietly widened');
  step(`the operator publishes ${JSON.stringify(PUBLISHED_FLOOR)}. A requester may tighten`);
  step('any axis and may loosen none; an unknown or misspelled axis is a rejection too,');
  step('because an ignored typo drops a constraint the requester believes is enforced.');

  const q4 = rp.buildRequest(PREDICATE, { swapAgeMin: 'P30D' });   // below the published P90D
  const r4 = await roundTrip(world, q4);
  qa('may I have this answer under a WEAKER 30-day profile floor?',
    'the operator publishes a 90-day floor; the request demands 30',
    'no answer at all — a signed refusal, and no attestation was ever produced');
  assert('below-floor request refused, and NO bit was computed',
    r4.out.kind === 'reject' && r4.out.floorRejected === true && r4.verdict.refused === true,
    `requester saw: '${r4.verdict.reason}'`);

  const q4b = rp.buildRequest(PREDICATE, { swapAgeMin: 'P180D', class: 'postpaid' });
  const r4b = await roundTrip(world, q4b);
  assert('tightening two axes is accepted, and the effective floor is visible',
    r4b.verdict.accepted === true,
    `effective floor = ${JSON.stringify(checkFloor(PUBLISHED_FLOOR, { swapAgeMin: 'P180D', class: 'postpaid' }).effective)}`);

  // NEGATIVE: the gate off. The SAME below-floor request now gets a signed answer
  // under a floor the operator never agreed to — silent widening, in one line.
  const q4c = rp.buildRequest(PREDICATE, { swapAgeMin: 'P30D' });
  const r4c = await roundTrip(world, q4c, { operator: { skipFloorGate: true } });
  flip('with the gate disabled, the SAME below-floor request is ANSWERED',
    r4c.out.kind === 'answer' && r4c.verdict.accepted === true,
    `signed claims=${JSON.stringify(r4c.out.claims)} — that is the silent widening, and it is one missing call away`);

  // ─────────────────────────────────────────── guards on the request path
  section('Guards on the request path (the two M6 decisions, 2026-08-17)');

  step('THRESHOLD MENU. Each response above is windowed and clean. A SEQUENCE of them');
  step('is not: the composition spike binary-searched this subscriber\'s exact swap age');
  step(`(${SWAPPED_DAYS_AGO} days, recovered exactly) in 9 legal, signed, metered queries. So the`);
  step('operator publishes a coarse menu and refuses anything off it — never rounding to');
  step('the nearest bucket, which would answer a question nobody asked.');
  const q5 = rp.buildRequest({ type: 'simSwapAge', operator: 'gte', value: 'P137D' }, { swapAgeMin: 'P180D' });
  const r5 = await roundTrip(world, q5);
  qa('has the SIM been in place for at least 137 days? (a threshold of my own choosing)',
    'the exact question the oracle walk needs, and the reason the menu exists',
    'refused — off-menu, and the walk is capped at the bucket');
  assert('off-menu threshold refused, loudly, before any fact is read',
    r5.out.kind === 'reject' && r5.out.menuRejected === true && r5.verdict.refused === true,
    `requester saw: '${r5.verdict.reason}'`);
  const q5b = rp.buildRequest({ type: 'simSwapAge', operator: 'gte', value: 'P365D' }, { swapAgeMin: 'P180D' });
  const r5b = await roundTrip(world, q5b);
  const q5c = rp.buildRequest({ type: 'simSwapAge', operator: 'gte', value: 'P137D' }, { swapAgeMin: 'P180D' });
  const r5c = await roundTrip(world, q5c, { operator: { skipMenu: true } });
  flip('with the menu disabled, the SAME off-menu threshold is ANSWERED (the oracle re-opens)',
    r5c.out.kind === 'answer' && r5c.verdict.accepted === true,
    `it answers "${r5c.out.claims?.result}" to the 137-day question — one rung of the walk. On-menu questions are unaffected: P365D → ${r5b.out.claims?.result}`);
  note('honest limit: quantisation CAPS the oracle at ~2 bits, it does not close it. Per-subject');
  note('rate limits and per-query billing price the residual walk; a tighten-only repeat rule was');
  note('considered and NOT adopted (it slows the walk ~15x and does not stop it). CAMARA proposal §3.5.');

  out('');
  step('DUPLICATE KEYS. A request is signed bytes too. Bytes carrying `floor` twice read');
  step('as P90D to a last-wins parser and P365D to a first-wins one — one signature, two');
  step('readings, and each side believes a different floor was agreed.');
  const dupText = JSON.stringify({ number: DEMO_NUMBER, predicate: PREDICATE, floor: { swapAgeMin: 'P365D' }, nonce: 'dup-nonce-01' })
    .replace('"nonce"', '"floor":{"swapAgeMin":"P90D"},"nonce"');
  const dupBytes = Buffer.from(dupText, 'utf8');
  const dupSealed = seal(keys.opEnc.publicKey, packSigned({ payloadBytes: dupBytes, signature: edSign(null, dupBytes, keys.rpSig.privateKey) }, keys.rpIss));
  const dupOut = await world.operator.handle(hub.route(keys.rpIss, keys.opIss, dupSealed));
  assert('duplicate-key request refused outright — no partial acceptance, no picking a value',
    dupOut.kind === 'reject' && dupOut.reason.startsWith('duplicate top-level key'),
    `reason='${dupOut.reason}'; the remedy is a clean re-request with a fresh nonce`);
  const dupCtrl = await world.operator.handle(hub.route(keys.rpIss, keys.opIss, dupSealed), { skipDupKeyScan: true });
  flip('with the scan disabled, the SAME ambiguous bytes get a signed answer',
    dupCtrl.kind === 'answer',
    `V8 read the LAST floor (${JSON.parse(dupText).floor.swapAgeMin}); a first-wins parser reads P365D — same signature, different agreement`);

  out('');
  step('KEY PINNING. `iss` travels outside the signature, so it is a lookup hint only.');
  const side = { predicate: canonicalPredicate(PREDICATE), result: true, nonce: 'side-nonce', exp: NOW + VALIDITY_MS };
  const sideSealed = seal(keys.rpEnc.publicKey, packSigned(attest(keys.rpSig.privateKey, side), keys.rpIss));
  rp.pending.set('side-nonce', { predicate: canonicalPredicate(PREDICATE) });
  const sidePinned = rp.verifyResponse(sideSealed, 'side-nonce', NOW + 1_000);
  assert('an answer from a DIFFERENT directory-listed party is rejected',
    sidePinned.accepted === false && sidePinned.reason === 'bad signature', `reason='${sidePinned.reason}'`);
  rp.pending.set('side-nonce', { predicate: canonicalPredicate(PREDICATE) });
  flip('letting the unsigned `iss` pick the key ACCEPTS that same answer',
    rp.verifyResponse(sideSealed, 'side-nonce', NOW + 1_000, { trustIssHint: true }).accepted === true,
    'profile rule 3\'s exact attack, live in the composition: any listed operator could answer for any other');

  // ───────────────────────────────────────────────────────────── the notes
  section('Notes the reader is owed');
  out('   1. THE SUBSCRIBER NUMBER. It rides INSIDE the sealed, signed request, so the hub');
  out('      never sees it — but it IS in the request. That is a demo stand-in for');
  out('      token-derived identity: a real 3-legged deployment derives the subject from');
  out('      the access token and omits the identifier entirely (NumberVerification already');
  out('      makes that omission normative; profile rule 4 generalises it catalog-wide).');
  out('   2. THE THRESHOLD MENU is this profile\'s answer to the oracle above, not a CAMARA');
  out('      requirement — the normative profile enumerates no predicate types or thresholds.');
  out('   3. WHAT THIS IS NOT. The operator shim simulates operator-side computation and');
  out('      signing; consent and legal-basis legs are out of scope. Mode A keeps the');
  out('      operator-side query log — the operator always knows who asked about whom.');
  out('      And this is attested windowed disclosure, NOT zero-knowledge: the operator');
  out('      knows the answer it signed. ZK language is reserved for Mode B.');

  const passed = results.filter(Boolean).length;
  out('');
  out(`RESULT: ${passed}/${results.length}`);
  return passed === results.length ? 0 : 1;
}

// ═══════════════════════════════ entry point ═════════════════════════════════
export function parseArgs(argv) {
  let backend = 'mock';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--backend') { backend = argv[++i]; continue; }
    if (a.startsWith('--backend=')) { backend = a.slice('--backend='.length); continue; }
    return { error: `unknown argument: ${JSON.stringify(a)}` };
  }
  if (backend !== 'mock' && backend !== 'orange') {
    return { error: `unknown backend: ${JSON.stringify(backend)} (use mock or orange)` };
  }
  return { backend };
}

const PREREQS = [
  'PREREQUISITES for --backend orange (nothing was answered, and nothing fell back):',
  '  1. A free Orange developer account with a Network APIs Playground app',
  '     (developer.orange.com → My Apps → Add an API → Network APIs Playground).',
  '  2. The app\'s Basic Auth string in the ENVIRONMENT, never in the tree:',
  '       ORANGE_BASIC_AUTH="$(pass camara/orange_network | head -1)" node poc/demo.mjs --backend orange',
  '  3. Network reachability to api.orange.com.',
  '  4. A free custom-number slot (the demo scripts ' + DEMO_NUMBER + '; the app allows 10).',
  '',
  'There is deliberately no silent fallback to the mock backend: a demo that',
  '"worked" without credentials would make the live run prove nothing.',
];

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.error) {
    console.error(`${args.error}\nusage: node poc/demo.mjs [--backend mock|orange]`);
    return 2;
  }
  let backend;
  try {
    backend = await createBackend(args.backend, { basicAuth: process.env.ORANGE_BASIC_AUTH });
  } catch (e) {
    console.error(`backend '${args.backend}' could not start: ${e instanceof Error ? e.message : String(e)}\n`);
    if (args.backend === 'orange') console.error(PREREQS.join('\n'));
    return 2;
  }
  try {
    return await runDemo(backend);
  } catch (e) {
    // Only a BACKEND that cannot start is exit 2. A backend that started and
    // then failed mid-run is still exit 2 rather than 1, because an unreachable
    // operator is a prerequisite failure and not a falsified assertion — and
    // reporting it as a failed assertion would be the more flattering lie.
    console.error(`\nrun aborted: ${e instanceof Error ? e.message : String(e)}`);
    if (args.backend === 'orange') console.error(`\n${PREREQS.join('\n')}`);
    return 2;
  }
}

// Only when RUN, never when imported — poc/m6-check.mjs imports the seams above
// and drives them itself.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
