// PoC module M6 — standalone check. Run: node poc/m6-check.mjs
//
// ZERO credentials, zero network — including the `--backend orange` cases, which
// drive M5 through an INJECTED transport replaying captured Playground bytes
// (the same technique m5-check.mjs uses, for the same reason: an offline suite
// that reached the network would be a live gate wearing an offline label).
//
// Negatives first, as in every module: each guard M6 adds is shown REFUSING, and
// then shown ACCEPTING with that one guard disabled — a control that cannot
// accept means the negative was vacuous, and a guard never disabled has not been
// proven load-bearing.
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { attest } from './m1-attestation.mjs';
import { generateEnvelopeKeys, seal, open, OAEP_CAPACITY } from './m2-envelope.mjs';
import { checkFloor } from './m3-floor.mjs';
import { makeHarness } from './check-harness.mjs';
import * as M5 from './m5-facts-orange.mjs';
import {
  NOW, VALIDITY_MS, DEMO_NUMBER, PUBLISHED_FLOOR, PUBLISHED_THRESHOLD_MENU, REQUEST_FIELDS, SUBSCRIBER_AT,
  REGISTERED_NAME, NEAR_MISS_SCORE,
  WIRE_REASON_JSON_MAX, NONCE_JSON_MAX, FACTS_UNAVAILABLE,
  packSigned, unpackSigned, canonicalPredicate, clampReason, rawNeedles, opaqueNeedles, withoutNonce, withoutAsked, scan,
  createBackend, createWorld, createHub, generateKeys, roundTrip, parseArgs, main, runDemo,
} from './demo.mjs';

const { check, conclude } = makeHarness({ field: 'ok', okWord: 'OK' });

const DAY_MS = 86400000;
const SWAPPED_DAYS_AGO = 137;
// A DIFFERENT day count from the SIM axis (added 2026-08-17 with the 3 -> 6
// round): a story where both swap axes agreed would let a mapping that reads the
// wrong axis pass every case in this file.
const DEVICE_SWAPPED_DAYS_AGO = 211;
const PREDICATE = { type: 'simSwapAge', operator: 'gte', value: 'P90D' };
const DEVICE_PREDICATE = { type: 'deviceSwapAge', operator: 'gte', value: 'P90D' };
const TIGHTER = { swapAgeMin: 'P180D' };
const NEEDLES = rawNeedles(SWAPPED_DAYS_AGO, { deviceDaysAgo: DEVICE_SWAPPED_DAYS_AGO });
const OPAQUE = opaqueNeedles(NEEDLES);
const STORY = { swappedDaysAgo: SWAPPED_DAYS_AGO, deviceSwappedDaysAgo: DEVICE_SWAPPED_DAYS_AGO, roamingCountry: 'FR', reachable: true, location: SUBSCRIBER_AT, registeredName: REGISTERED_NAME };
// The requester's area is centred somewhere DIFFERENT from the subscriber, so no
// case can pass by the two rendering as the same string.
const NEAR_AREA = { lat: 48.86, long: 2.35, radiusM: 10000 };

// The size a reason occupies inside the signed claims — the thing the clamp
// actually bounds, and the thing seal() actually measures. Asserting on
// `.length` (UTF-16 code units) is what let a 121-unit / 363-byte reason through
// before the 2026-08-17 review.
const claimBytes = (s) => Buffer.byteLength(JSON.stringify(s), 'utf8');

// Sign arbitrary bytes as the RP and seal them for the operator: what an
// attacker does, and the only way to build request bytes `attest()` will not
// produce (duplicate keys, a missing nonce, a non-frame).
const asRp = (w, bytes) =>
  seal(w.keys.opEnc.publicKey, packSigned({ payloadBytes: bytes, signature: edSign(null, bytes, w.keys.rpSig.privateKey) }, w.keys.rpIss));
const sendRaw = async (w, obj, controls) => {
  try { return await w.operator.handle(asRp(w, Buffer.from(JSON.stringify(obj), 'utf8')), controls); } catch (e) { return { kind: 'THREW', reason: `${e.constructor.name}: ${e.message}` }; }
};

// A fresh world per case where state matters (the nonce store, the hub log), so
// no case can pass because an earlier one left the right thing lying around.
// The KEY SET is shared across worlds on purpose: RSA-4096 generation is ~2.7s
// per key here, and one set per case would put this suite past two minutes
// while asserting nothing extra. Every case that actually turns on key identity
// (10 pinning, 15 forged refusal, 8 impostor) mints its own keys inside itself.
const KEYS = generateKeys();
async function mockWorld() {
  const backend = await createBackend('mock');
  await backend.setBackstory(DEMO_NUMBER, STORY, NOW);
  return createWorld({ backend, keys: KEYS });
}
const ok = (name, pass, extra) => check(name, true, { ok: pass === true, reason: pass === true ? 'ok' : 'failed' }, 'ok', extra);
const rejects = (name, verdict, expectedReason, extra) =>
  check(name, false, { ok: verdict.accepted === true, reason: verdict.reason }, expectedReason, extra);

const W = await mockWorld();

// ══════════════════════════════ NEGATIVES ════════════════════════════════════

// 1 NONCE REPLAY — the single-use store is M6's, because M1's nonce check is
// stateless BINDING and says so in its own comments. The control is the whole
// case: with the store bypassed the SAME bytes verify again, which is exactly
// M1's documented limit and not a defect in it.
{
  const q = W.rp.buildRequest(PREDICATE, TIGHTER);
  const r = await roundTrip(W, q);
  const replay = W.rp.verifyResponse(r.atRp, q.nonce, NOW + 2_000);
  const control = W.rp.verifyResponse(r.atRp, q.nonce, NOW + 2_000, { skipNonceStore: true, fallbackPredicate: PREDICATE });
  rejects('1 NONCE REPLAY', replay, 'unknown or already-used nonce',
    { label: 'store-off control ACCEPTS the same replay', ok: r.verdict.accepted === true && control.accepted === true });
}

// 2 EXPIRED — checked on FIRST presentation past the expiry. Presenting a second
// time would hit the single-use store first and assert the wrong guard.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const late = await roundTrip(w, q, { nowMs: NOW + 2 * VALIDITY_MS });
  const w2 = await mockWorld();
  const q2 = w2.rp.buildRequest(PREDICATE, TIGHTER);
  const inTime = await roundTrip(w2, q2, { nowMs: NOW + VALIDITY_MS - 1 });
  rejects('2 EXPIRED', late.verdict, 'expired',
    { label: 'one ms inside the window the SAME shape is accepted', ok: inTime.verdict.accepted === true });
}

// 3 LEAKY OPERATOR — an operator that ships the age alongside the bit. TWO
// independent defences must fire: the wire scan reds, and M1's closed claim set
// rejects the response. If only one fired, the other was decoration.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const r = await roundTrip(w, q, { operator: { leakRaw: true } });
  const hits = scan(unpackSigned(r.out.plain).signed.payloadBytes, NEEDLES);
  rejects('3 LEAKY OPERATOR', r.verdict, 'unexpected fields: swapAgeMs',
    { label: `wire scan also reds (hits=${JSON.stringify(hits)})`, ok: hits.includes('swapAgeMs') && hits.includes(String(SWAPPED_DAYS_AGO * DAY_MS)) });
}

// 4 BELOW-FLOOR REFUSED — FR4. The refusal must be SIGNED and no bit may be
// computed; the control shows the silent widening is one missing call away.
{
  const w = await mockWorld();
  const r = await roundTrip(w, w.rp.buildRequest(PREDICATE, { swapAgeMin: 'P30D' }));
  const c = await roundTrip(w, w.rp.buildRequest(PREDICATE, { swapAgeMin: 'P30D' }), { operator: { skipFloorGate: true } });
  rejects('4 BELOW-FLOOR REFUSED', r.verdict, 'operator refused: below floor: swapAgeMin P30D < P90D',
    { label: 'no attestation produced; gate-off control ANSWERS the same request',
      ok: r.out.floorRejected === true && r.out.claims.result === undefined && c.out.kind === 'answer' && c.verdict.accepted === true });
}

// 5 OFF-MENU THRESHOLD REFUSED — decision #1. Refused BEFORE any fact is read,
// because a computed-then-discarded answer is still an oracle query. With the
// menu off, the same free-choice threshold is answered — one rung of the walk
// the spike used to recover the exact swap age.
{
  const w = await mockWorld();
  const off = { type: 'simSwapAge', operator: 'gte', value: 'P137D' };
  const r = await roundTrip(w, w.rp.buildRequest(off, TIGHTER));
  const c = await roundTrip(w, w.rp.buildRequest(off, TIGHTER), { operator: { skipMenu: true } });
  const onMenu = await roundTrip(w, w.rp.buildRequest({ type: 'simSwapAge', operator: 'gte', value: 'P365D' }, TIGHTER));
  rejects('5 OFF-MENU THRESHOLD REFUSED', r.verdict,
    'operator refused: threshold not on the published menu for simSwapAge (allowed: P30D, P90D, P180D, P365D)',
    { label: 'menu-off control ANSWERS it; every menu entry still answers',
      ok: r.out.menuRejected === true && c.out.kind === 'answer' && c.out.claims.result === true && onMenu.verdict.accepted === true });
}

// 5b MENU COVERS ONLY ORDERED THRESHOLDS — the absence of a menu for `roamingIn`
// and `reachable` is a decision, not an oversight (a set has no ordering to
// bisect; a boolean is already at full resolution). Pinned so that "quantise
// everything" cannot be added later by accident, and so the published menu
// cannot silently gain or lose a bucket.
{
  const w = await mockWorld();
  const roam = await roundTrip(w, w.rp.buildRequest({ type: 'roamingIn', operator: 'in', value: ['FR', 'BE'] }, TIGHTER));
  const reach = await roundTrip(w, w.rp.buildRequest({ type: 'reachable', operator: 'eq', value: true }, TIGHTER));
  // WIDENED 2026-08-17: the menu now covers BOTH ordered duration thresholds and
  // still covers neither unordered one. The published buckets are pinned
  // byte-for-byte and the two duration menus are pinned IDENTICAL, because the
  // signed decision is that `deviceSwapAge` takes the SAME menu — a drifted
  // second menu is a second place for the window to widen quietly.
  ok('6 MENU SCOPE', roam.verdict.accepted === true && reach.verdict.accepted === true,
    { label: 'menu keys are exactly the three ORDERED types; the two duration menus are identical; no menu for the unordered ones',
      ok: JSON.stringify(Object.keys(PUBLISHED_THRESHOLD_MENU).sort()) === '["deviceSwapAge","numberMatch","simSwapAge"]'
        && JSON.stringify(PUBLISHED_THRESHOLD_MENU.simSwapAge) === '["P30D","P90D","P180D","P365D"]'
        && JSON.stringify(PUBLISHED_THRESHOLD_MENU.deviceSwapAge) === JSON.stringify(PUBLISHED_THRESHOLD_MENU.simSwapAge)
        && JSON.stringify(PUBLISHED_THRESHOLD_MENU.numberMatch) === '[60,70,80,90]' });
}

// 7 DUPLICATE-KEY REQUEST REFUSED — decision #2, using M1's exported scanner.
// `attest()` cannot produce these bytes (JSON.stringify de-dups), so they are
// signed directly — which is what an attacker does anyway.
{
  const w = await mockWorld();
  const text = JSON.stringify({ number: DEMO_NUMBER, predicate: PREDICATE, floor: { swapAgeMin: 'P365D' }, nonce: 'dup-nonce-01' })
    .replace('"nonce"', '"floor":{"swapAgeMin":"P90D"},"nonce"');
  const bytes = Buffer.from(text, 'utf8');
  const sealed = seal(w.keys.opEnc.publicKey, packSigned({ payloadBytes: bytes, signature: edSign(null, bytes, w.keys.rpSig.privateKey) }, w.keys.rpIss));
  const r = await w.operator.handle(sealed);
  const c = await w.operator.handle(sealed, { skipDupKeyScan: true });
  check('7 DUPLICATE-KEY REQUEST', false, { ok: r.kind === 'answer', reason: r.reason },
    'duplicate top-level key in request (ambiguous bytes — re-request cleanly)',
    { label: 'scan-off control ANSWERS the same bytes, reading the LAST floor',
      ok: c.kind === 'answer' && JSON.parse(text).floor.swapAgeMin === 'P90D' });
}

// 8 IMPOSTOR REQUEST — signed by a key that is not the claimed RP's. Rejected
// before any fact is read; this is the seam that closes M2's audit open item,
// and the control shows the operator would otherwise answer anyone who can
// reach its public envelope key.
{
  const w = await mockWorld();
  const impostor = generateKeyPairSync('ed25519');
  const req = { number: DEMO_NUMBER, predicate: PREDICATE, floor: TIGHTER, nonce: 'impostor-nonce' };
  const sealed = seal(w.keys.opEnc.publicKey, packSigned(attest(impostor.privateKey, req), w.keys.rpIss));
  const r = await w.operator.handle(sealed);
  const c = await w.operator.handle(sealed, { skipRequestAuth: true });
  check('8 IMPOSTOR REQUEST', false, { ok: r.kind === 'answer', reason: r.reason }, 'bad request signature',
    { label: 'auth-off control gives the forged request a SIGNED answer', ok: c.kind === 'answer' });
}

// 9 UNKNOWN ISSUER — the key comes from the directory, never from the wire.
{
  const w = await mockWorld();
  const req = { number: DEMO_NUMBER, predicate: PREDICATE, floor: TIGHTER, nonce: 'n' };
  const r = await w.operator.handle(seal(w.keys.opEnc.publicKey, packSigned(attest(w.keys.rpSig.privateKey, req), 'rp:not-in-directory')));
  check('9 UNKNOWN ISSUER', false, { ok: r.kind === 'answer', reason: r.reason }, 'unknown issuer',
    { label: 'unsealed: an operator cannot sign a refusal to a party it cannot name', ok: r.sealed === null && r.stage === 'transport' });
}

// 10 RESPONSE KEY PINNING — profile rule 3. A DIFFERENT directory-listed party
// answers a query addressed to the operator, with a truthful `iss` pointing at
// its own real directory key. Forging a key that is in NO directory entry cannot
// tell pinning from hint-following, which is why the attacker here is listed.
{
  const w = await mockWorld();
  const claims = { predicate: canonicalPredicate(PREDICATE), result: true, nonce: 'side-nonce', exp: NOW + VALIDITY_MS };
  const sealed = seal(w.keys.rpEnc.publicKey, packSigned(attest(w.keys.rpSig.privateKey, claims), w.keys.rpIss));
  w.rp.pending.set('side-nonce', { predicate: canonicalPredicate(PREDICATE) });
  const pinned = w.rp.verifyResponse(sealed, 'side-nonce', NOW + 1_000);
  w.rp.pending.set('side-nonce', { predicate: canonicalPredicate(PREDICATE) });
  const hint = w.rp.verifyResponse(sealed, 'side-nonce', NOW + 1_000, { trustIssHint: true });
  rejects('10 RESPONSE KEY PINNING', pinned, 'bad signature',
    { label: 'iss-hint control ACCEPTS the same answer', ok: hint.accepted === true });
}

// 11 WRONG-THRESHOLD ANSWER — the operator answers `gte P1D` to a `gte P90D`
// question. Only an INJECTIVE canonical string catches this: the spike proved a
// mapping that drops the threshold leaves every test green while both sides
// happily derive the same lossy string.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const r = await roundTrip(w, q, { operator: { answerPredicate: { type: 'simSwapAge', operator: 'gte', value: 'P1D' } } });
  rejects('11 WRONG-THRESHOLD ANSWER', r.verdict, 'predicate mismatch',
    { label: `signed '${r.out.claims.predicate}' vs asked '${canonicalPredicate(PREDICATE)}'`,
      ok: r.out.claims.predicate !== canonicalPredicate(PREDICATE) });
}

// 12 UNSCRIPTED NUMBER — M4/M5 THROW rather than fabricate a backstory, and the
// number came off the wire, so M6 must catch it and refuse loudly. A crash here
// would take the operator down on an input anyone can send.
//
// CHANGED 2026-08-17 by the adversarial review. This case used to assert that
// the refusal NAMES THE NUMBER — i.e. it pinned the defect. The backend's whole
// exception message was being forwarded verbatim into a SIGNED refusal, so on
// the Orange path an upstream 500 would ship a core-network hostname to the
// requester (AGENT_RULES invariant 4). The number itself is not the disclosure —
// it is data the requester sent — but the message carrying it is, and the number
// is not needed either, because the nonce already binds this refusal to that
// exact request. So the case now pins the OPPOSITE: one stable reason, with the
// operator's own diagnostic kept locally and never sealed. Case 33 is the
// general form of that assertion.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER, { number: '+990999999999' });
  const r = await roundTrip(w, q);
  check('12 UNSCRIPTED NUMBER', false, { ok: r.out.kind === 'answer', reason: r.out.reason ? 'refused' : 'crashed' }, 'refused',
    { label: 'signed, nonce-bound, stable reason; the backend message stays operator-side',
      ok: r.verdict.refused === true
        && r.out.reason === FACTS_UNAVAILABLE
        && claimBytes(r.out.reason) <= WIRE_REASON_JSON_MAX
        && !r.out.reason.includes('+990999999999')
        && String(r.out.operatorDetail).includes('no backstory scripted') });
}

// 13 UNANSWERABLE PREDICATE — profile §3.3.1: a fact the operator cannot supply
// is REFUSED, never defaulted. `result:false` here would be a signed confident
// negative about a question that was never answerable.
{
  const w = await mockWorld();
  const r = await roundTrip(w, w.rp.buildRequest({ type: 'simSwapAgeTypo', operator: 'gte', value: 'P90D' }, TIGHTER));
  check('13 UNANSWERABLE PREDICATE', false, { ok: r.out.kind === 'answer', reason: r.out.kind }, 'reject',
    { label: 'the signed refusal carries NO result field — not a defaulted false',
      ok: r.out.claims.result === undefined && Object.keys(r.out.claims).sort().join(',') === 'error,exp,nonce' && r.verdict.refused === true });
}

// 14 A NON-RECIPIENT KEY DOES NOT OPEN THE CIPHERTEXT + the log carries metering
// only. Renamed 2026-08-17: the old title ("BLIND HUB") claimed more than the
// code checked. The hub's blindness is STRUCTURAL — it is never handed a key
// that opens either leg — and a structural property has no failing case to
// write; what the `open` below exercises is RSA-OAEP. The assertions that CAN
// fail are the log ones, and the chatty control is what makes them mean
// anything: a scanner that cannot red is not a scanner.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const r = await roundTrip(w, q);
  const hubKeys = generateEnvelopeKeys();
  const tried = open(hubKeys.privateKey, r.atRp);
  const logNeedles = [...NEEDLES, 'simSwapAge', 'P90D'];
  const clean = scan(withoutNonce(JSON.stringify(w.hub.log), q.nonce), logNeedles);
  const chatty = createHub();
  chatty.route(w.keys.rpIss, w.keys.opIss, r.atRp, { chatty: `${DEMO_NUMBER} asked simSwapAge P90D → true` });
  check('14 NON-RECIPIENT KEY OPENS NOTHING', false, { ok: tried.ok, reason: tried.reason }, 'undecryptable',
    { label: `log clean against all ${logNeedles.length} needles (hits=${JSON.stringify(clean)}); chatty control reds the SAME scanner`,
      ok: clean.length === 0 && scan(JSON.stringify(chatty.log), logNeedles).length > 0 });
}

// 15 FORGED REFUSAL — the blind hub invents a denial. It cannot: refusals past
// authentication are SIGNED, so a hub-authored one fails the pinned key. This is
// why refusals are signed at all rather than returned as plain transport errors.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const hubSig = generateKeyPairSync('ed25519');
  const forged = seal(w.keys.rpEnc.publicKey,
    packSigned(attest(hubSig.privateKey, { error: 'below floor: swapAgeMin P30D < P90D', nonce: q.nonce, exp: NOW + VALIDITY_MS }), w.keys.opIss));
  const v = w.rp.verifyResponse(forged, q.nonce, NOW + 1_000);
  rejects('15 FORGED REFUSAL', v, 'bad signature',
    { label: 'not reported as a refusal — a forgery is not an operator decision', ok: v.refused === undefined });
}

// 16 UNDECRYPTABLE REQUEST — untrusted bytes must produce a verdict, never a
// throw, all the way through the composition.
{
  const w = await mockWorld();
  const r = await w.operator.handle(Buffer.alloc(512, 7));
  const notBuffer = await w.operator.handle('not a buffer');
  check('16 UNDECRYPTABLE REQUEST', false, { ok: r.kind === 'answer', reason: r.reason }, 'undecryptable',
    { label: 'a non-Buffer is also a verdict, not a throw', ok: notBuffer.reason === 'malformed ciphertext' });
}

// ══════════════════════════════ POSITIVES / SEAMS ════════════════════════════

// 17 HAPPY PATH — one full round trip, closed claim set, and the ONE disclosure.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const r = await roundTrip(w, q);
  ok('17 HAPPY PATH', r.verdict.accepted === true && r.out.claims.result === true,
    { label: 'claim set is exactly {predicate, result, nonce, exp}',
      ok: JSON.stringify(Object.keys(r.verdict.claims)) === '["predicate","result","nonce","exp"]' });
}

// 18 NO RAW VALUE ON THE WIRE — every artifact the requester or the hub can hold,
// against every value the operator holds.
//
// WIDENED 2026-08-17 by the adversarial review, which was right that the old
// needle set was five long-form spellings of the SAME swap timestamp: a planted
// `{"c":"FR"}` (the roaming country VALUE), `{"m":"+990100000099"}`,
// `{"d":"2026-04-02"}` and `{"swapDays":137}` all scored ZERO while the label
// read "no raw value in ANY wire artifact". The inventory is now complete; what
// varies is which artifact a given needle can honestly be scanned against —
// OPAQUE bytes (ciphertext, base64-bearing frames) take the long forms only,
// because a 2-character country code lands in 512 random bytes about one run in
// 8. PLAINTEXT takes all nine, with the random hex nonce blanked so the 3-digit
// day count asserts instead of flaking. The control plants all four of the leaks
// the old set was blind to, so this case can now fail for each of them.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const r = await roundTrip(w, q);
  const opaque = [r.atRp, r.out.plain];
  const plain = [
    withoutNonce(unpackSigned(r.out.plain).signed.payloadBytes.toString('utf8'), q.nonce),
    withoutNonce(JSON.stringify(w.hub.log), q.nonce),
  ];
  const hits = [...opaque.flatMap((a) => scan(a, OPAQUE)), ...plain.flatMap((a) => scan(a, NEEDLES))];
  const planted = [
    `{"swapAgeMs":${SWAPPED_DAYS_AGO * DAY_MS}}`,
    `{"swapDays":${SWAPPED_DAYS_AGO}}`,
    '{"c":"FR"}',
    `{"m":"${DEMO_NUMBER}"}`,
    '{"d":"2026-04-02"}',
    // WIDENED 2026-08-17 with the 3 -> 6 round: the DEVICE swap instant is a
    // second raw timestamp and is exactly as disclosive as the first. Each new
    // fact the operator holds gets its own planted leak, because the review's
    // lesson was that an inventory covering ONE value five ways reads as complete
    // and is not.
    `{"deviceSwapAgeMs":${DEVICE_SWAPPED_DAYS_AGO * DAY_MS}}`,
    `{"deviceSwapDays":${DEVICE_SWAPPED_DAYS_AGO}}`,
    `{"dd":"${new Date(NOW - DEVICE_SWAPPED_DAYS_AGO * DAY_MS).toISOString()}"}`,
    // The subscriber's own POSITION, and the operator's own word for "I cannot
    // resolve this subscriber" — both facts about the subscriber, neither ever an
    // echoed question (a refusal carries no predicate at all).
    `{"lat":${SUBSCRIBER_AT.lat}}`,
    `{"lon":${SUBSCRIBER_AT.long}}`,
    '{"verdict":"PARTIAL"}',
    // The KYC record and the similarity gradient. The score is the raw value this
    // predicate exists to withhold, and the registered name is what a walk of it
    // would recover.
    `{"registered":"${REGISTERED_NAME}"}`,
    `{"nameMatchScore":${NEAR_MISS_SCORE}}`,
  ];
  ok('18 NO RAW VALUE ON THE WIRE', hits.length === 0,
    { label: `${NEEDLES.length} needles (${OPAQUE.length} of them opaque-safe); the same scanner reds on all ${planted.length} planted leaks`,
      ok: NEEDLES.length === 22 && planted.every((p) => scan(Buffer.from(p), NEEDLES).length > 0) });
}

// 19 INJECTIVE CANONICALISATION — the two collisions the spike found, closed.
// The threshold is part of the string, and `["FR","BE"]` does not render the
// same as the single-element set `["FR,BE"]` (the obvious `join(',')` spelling
// made them identical, and M4 only happened to reject the second one).
{
  const c = canonicalPredicate;
  const thresholdKept = c({ type: 'simSwapAge', operator: 'gte', value: 'P90D' }) !== c({ type: 'simSwapAge', operator: 'gte', value: 'P1D' });
  const setsDistinct = c({ type: 'roamingIn', operator: 'in', value: ['FR', 'BE'] }) !== c({ type: 'roamingIn', operator: 'in', value: ['FR,BE'] });
  const typesDistinct = c({ type: 'reachable', operator: 'eq', value: true }) !== c({ type: 'reachable', operator: 'eq', value: 'true' });
  ok('19 INJECTIVE CANONICALISATION', thresholdKept && setsDistinct && typesDistinct,
    { label: `e.g. ${JSON.stringify(c({ type: 'roamingIn', operator: 'in', value: ['FR', 'BE'] }))}`,
      ok: c(PREDICATE) === 'simSwapAge gte "P90D"' });
}

// 20 REASON CLAMP — M3 builds reasons from wire input and does not bound them;
// M2's seal() THROWS above the envelope capacity. Unclamped, a long enough
// refusal makes the operator CRASH instead of refuse. Both halves measured here:
// the unclamped reason throws at seal, the clamped one seals.
{
  const w = await mockWorld();
  const long = checkFloor(PUBLISHED_FLOOR, { swapAgeMin: `P${'9'.repeat(600)}Q` });
  const sealIt = (reason) => {
    try {
      seal(w.keys.rpEnc.publicKey, packSigned(attest(w.keys.opSig.privateKey, { error: reason, nonce: 'n', exp: NOW + VALIDITY_MS }), w.keys.opIss));
      return null;
    } catch (e) { return e.message; }
  };
  const rawThrew = sealIt(long.reason);
  const clampedThrew = sealIt(clampReason(long.reason));
  ok('20 REASON CLAMP', rawThrew !== null && clampedThrew === null,
    { label: `unclamped ${claimBytes(long.reason)} B → '${String(rawThrew).slice(0, 40)}…'; clamped ${claimBytes(clampReason(long.reason))} B seals`,
      ok: long.allowed === false && claimBytes(clampReason(long.reason)) <= WIRE_REASON_JSON_MAX && clampReason(42) === 'rejected' });
}

// 21 LARGEST WIRE-REACHABLE FLOOR VALUE — how reachable case 20 actually is:
// the 446-byte envelope caps the REQUEST too, which caps how long a wire value
// (and therefore an M3 reason) can be. The operator must survive the worst one a
// requester can physically send, and refuse it rather than crash.
{
  const w = await mockWorld();
  let biggest = null;
  for (let n = 1; n <= 400; n++) {
    try { biggest = { n, req: w.rp.buildRequest(PREDICATE, { swapAgeMin: `P${'9'.repeat(n)}Q` }) }; } catch { break; }
  }
  const r = await roundTrip(w, biggest.req);
  ok('21 LARGEST WIRE-REACHABLE FLOOR VALUE', r.out.kind === 'reject',
    { label: `max wire value ${biggest.n + 2} chars → refused, signed, sealed`,
      ok: r.verdict.refused === true && claimBytes(r.out.reason) <= WIRE_REASON_JSON_MAX });
}

// 22 BACKEND SEAM — the FR5 claim. The orange backend runs through an INJECTED
// transport replaying captured Playground bytes (zero credentials, zero
// network). Hold the keys and the nonce fixed and the two backends produce a
// BYTE-IDENTICAL signed frame, signature included, since Ed25519 is
// deterministic.
//
// THE HEADLINE WAS TRIMMED 2026-08-17. It used to call this "the strongest form
// the FR5 claim can take", and the review was right that it is nearly vacuous on
// its own: the signed claims are backend-INDEPENDENT except for the boolean, so
// the frame stays identical even when the orange leg reports a swap age nowhere
// near the mock's. Byte-identity proves what it proves — the WIRE carries the
// bit and nothing about where the bit came from, which is the whole profile
// invariant restated at the seam — and it needs the two assertions beside it to
// mean FR5:
//   * the orange leg really drove M5 (the replayed calls include the sim-swap
//     read and the admin READ that M5's write-verification depends on), and
//   * the orange leg really drives the BIT: replay a 5-day-old swap through the
//     same transport and the same question comes back `false` while the mock
//     still says `true`. Without that, an orange adapter that ignored its own
//     response would pass the identity check perfectly.
{
  const CRED = `Basic ${Buffer.from('CLIENTID0000000000000000000000AA:SECRET000000000000000000000000000000000000BB').toString('base64')}`;
  const swapIso = new Date(NOW - SWAPPED_DAYS_AGO * DAY_MS).toISOString();
  const deviceIso = new Date(NOW - DEVICE_SWAPPED_DAYS_AGO * DAY_MS).toISOString();
  const calls = [];
  // `daysAgo` drives BOTH the replayed date bodies and the replayed `/check`
  // verdict, from ONE story — so the two surfaces cannot disagree by accident and
  // a case that flips the story flips whichever surface actually ran.
  const makeFetch = (iso, sink, { daysAgo = SWAPPED_DAYS_AGO, deviceIsoAt = deviceIso } = {}) => async (url, opts) => {
    const isToken = String(opts?.headers?.['Content-Type']).includes('urlencoded');
    const body = !isToken && typeof opts?.body === 'string' ? JSON.parse(opts.body) : null;
    sink.push({ url, action: body?.action, maxAge: body?.maxAge });
    const reply = (status, text) => ({ status, text: async () => text });
    if (isToken) return reply(200, '{"token_type":"Bearer","access_token":"T.OK.0000","expires_in":3600}');
    if (url.includes('/admin/')) {
      // READ mirrors the write, so the module's load-bearing read-after-write
      // verification passes; UPDATE echoes, exactly as the real API does.
      if (body.action === 'READ') {
        return reply(200, JSON.stringify({ data: { simSwap: { latestSimChange: iso }, deviceSwap: { latestDeviceChange: deviceIsoAt }, location: body.data?.location ?? { latitude: SUBSCRIBER_AT.lat, longitude: SUBSCRIBER_AT.long }, kyc: body.data?.kyc ?? { name: REGISTERED_NAME }, roaming: { roaming: true, countryName: ['FR'] }, reachability: { reachabilityStatus: 'CONNECTED_DATA' } } }));
      }
      return reply(200, JSON.stringify({ data: body.data ?? {} }));
    }
    // `/check` before the date route: both urls carry the API name, so an
    // order-insensitive match would answer a `/check` call with a date body.
    // `swapped` is TRUE when the swap falls INSIDE the asked window.
    if (url.includes('sim-swap/v1/check')) return reply(200, JSON.stringify({ swapped: daysAgo * DAY_MS < body.maxAge * 3600000 }));
    if (url.includes('sim-swap')) return reply(200, JSON.stringify({ latestSimChange: iso }));
    if (url.includes('device-swap/v1/check')) return reply(200, JSON.stringify({ swapped: (NOW - Date.parse(deviceIsoAt)) < body.maxAge * 3600000 }));
    if (url.includes('device-swap')) return reply(200, JSON.stringify({ latestDeviceChange: deviceIsoAt }));
    if (url.includes('location-verification')) return reply(200, '{"verificationResult":"TRUE","lastLocationTime":"2026-08-11T04:00:16.503Z"}');
    // `nameMatch` is a STRING on the wire, exactly as captured.
    if (url.includes('kyc-match')) {
      return reply(200, body.name === REGISTERED_NAME
        ? '{"nameMatch":"true"}'
        : `{"nameMatch":"false","nameMatchScore":${NEAR_MISS_SCORE}}`);
    }
    if (url.includes('roaming')) return reply(200, '{"roaming":true,"countryName":["FR"]}');
    if (url.includes('reachability')) return reply(200, '{"reachabilityStatus":"CONNECTED_DATA"}');
    return reply(404, '{}');
  };
  const orange = await createBackend('orange', { basicAuth: CRED, fetchImpl: makeFetch(swapIso, calls) });
  await orange.setBackstory(DEMO_NUMBER, STORY, NOW);
  const wo = createWorld({ backend: orange, keys: KEYS });
  const wm = await mockWorld();
  const NONCE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const ro = await roundTrip(wo, wo.rp.buildRequest(PREDICATE, TIGHTER, { nonce: NONCE }));
  const rm = await roundTrip(wm, wm.rp.buildRequest(PREDICATE, TIGHTER, { nonce: NONCE }));
  const bytesOf = (r) => unpackSigned(r.out.plain).signed.payloadBytes.toString('utf8');

  // The leg that makes the identity above mean something: the SAME transport
  // shape replaying a 5-day-old swap must flip the bit, so the orange adapter is
  // demonstrably reading its own responses rather than agreeing by coincidence.
  const freshCalls = [];
  const freshIso = new Date(NOW - 5 * DAY_MS).toISOString();
  const orangeFresh = await createBackend('orange', { basicAuth: CRED, fetchImpl: makeFetch(freshIso, freshCalls, { daysAgo: 5 }) });
  await orangeFresh.setBackstory(DEMO_NUMBER, { ...STORY, swappedDaysAgo: 5 }, NOW);
  const wf = createWorld({ backend: orangeFresh, keys: KEYS });
  const rf = await roundTrip(wf, wf.rp.buildRequest(PREDICATE, TIGHTER, { nonce: 'b1b2c3d4e5f60718293a4b5c6d7e8f90' }));

  ok('22 BACKEND SEAM', ro.verdict.accepted === true && rm.verdict.accepted === true && ro.out.plain.equals(rm.out.plain),
    { label: `identical frame; claims ${JSON.stringify(bytesOf(ro))} over ${calls.length} replayed calls, none live; `
      + `a 5-day-old replayed swap flips the same question to ${rf.out.claims?.result}`,
      ok: bytesOf(ro) === bytesOf(rm)
        && calls.some((c) => c.url.includes('sim-swap')) && calls.some((c) => c.action === 'READ')
        // ...and the surface that actually ran is the PROFILE-CONFORMING one:
        // a `P90D` question is 2160 hours, inside the measured 2400-hour cap, so
        // the orange leg asked `/check` and the operator never read a date at
        // all. Pinned here rather than only in m5-check because this is the leg
        // that produces the signed frame the identity claim is about.
        && calls.some((c) => c.url.endsWith('/sim-swap/v1/check') && c.maxAge === 2160)
        && !calls.some((c) => c.url.includes('/sim-swap/v1/retrieve-date'))
        && rf.verdict.accepted === true && rf.out.claims.result === false && rm.out.claims.result === true });
}

// 23 ONE EVALUATION STEP — M5 exports `createOrangeFacts` and nothing else, so
// both backends share M4's `evaluatePredicate`. If M5 ever grew its own copy,
// the backends would be two code paths and case 22's equality would be proving
// far less than it looks like it proves. (The `extra` here used to be the
// literal `ok: true` — flagged 2026-08-17 as a label with nothing behind it.)
ok('23 ONE EVALUATION STEP', Object.keys(M5).sort().join(',') === 'createOrangeFacts',
  { label: `M5 exports=${JSON.stringify(Object.keys(M5).sort())}`,
    ok: Object.keys(M5).length === 1 && typeof M5.createOrangeFacts === 'function' && M5.evaluatePredicate === undefined });

// 24 ENTRY POINT — argument parsing and the COULD-NOT-START half of the
// exit-code contract (the started-then-crashed half is case 28). The orange leg
// runs with ORANGE_BASIC_AUTH DELETED for the duration: on a machine that has
// the credential, leaving it set would make this offline suite talk to the live
// Playground, which is precisely what it must never do.
{
  const saved = process.env.ORANGE_BASIC_AUTH;
  delete process.env.ORANGE_BASIC_AUTH;
  // The prerequisite banner is the demo's job to print, not this suite's — the
  // contract under test is the EXIT CODE, so the banner is swallowed rather than
  // left to look like a failure in the middle of a green run.
  const realErr = console.error;
  console.error = () => {};
  let noCred; let badArg; let badBackend;
  try {
    noCred = await main(['--backend', 'orange']);
    badArg = await main(['--oops']);
    badBackend = await main(['--backend', 'sqlite']);
  } finally {
    console.error = realErr;
    if (saved !== undefined) process.env.ORANGE_BASIC_AUTH = saved;
  }
  ok('24 ENTRY POINT', noCred === 2 && badArg === 2 && badBackend === 2,
    { label: 'defaults to mock; --backend=x accepted; unknown value refused',
      ok: parseArgs([]).backend === 'mock' && parseArgs(['--backend=orange']).backend === 'orange' && parseArgs(['--backend', 'x']).error !== undefined });
}

// 25 THE DEMO ITSELF — run it and check the contract a reader depends on: exit
// 0, a RESULT line, and CLAIMS DISCIPLINE. Every mention of zero-knowledge in
// the output must be a NEGATION; the repo invariant is that Mode A is attested
// windowed disclosure and is never described as ZK, and the demo is the one
// place that discipline is enforced in an artifact rather than in prose.
{
  const backend = await createBackend('mock');
  const lines = [];
  const real = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  let code;
  try { code = await runDemo(backend); } finally { console.log = real; }
  const zk = lines.filter((l) => /zero.knowledge|\bZK\b/i.test(l));
  const allNegated = zk.length > 0 && zk.every((l) => /never|not |NOT |reserved for Mode B/.test(l));
  const result = lines.find((l) => l.startsWith('RESULT: '));
  ok('25 THE DEMO ITSELF', code === 0 && result === 'RESULT: 33/33',
    { label: `${zk.length} ZK mentions, all negations=${allNegated}; ${result}`, ok: allNegated });
}

// 26 CLOSED REQUEST FIELD SET — the outermost layer, and the last one that was
// left open. Found by an adversarial probe of demo.mjs AFTER it was first
// written and green: a request carrying `floors` (one letter off) had its floor
// silently DROPPED, so the operator applied its own P90D and signed an answer
// while the requester believed it had demanded P365D. Silent widening through a
// spelling mistake — M3's closed-axis argument, one level further out, and
// invisible to every module because no module owns this envelope. The control
// reproduces the widening exactly.
{
  const w = await mockWorld();
  const typo = { number: DEMO_NUMBER, predicate: PREDICATE, floors: { swapAgeMin: 'P365D' }, nonce: 'typo-1' };
  const bytes = Buffer.from(JSON.stringify(typo), 'utf8');
  const sealed = seal(w.keys.opEnc.publicKey, packSigned({ payloadBytes: bytes, signature: edSign(null, bytes, w.keys.rpSig.privateKey) }, w.keys.rpIss));
  const r = await w.operator.handle(sealed);
  const c = await w.operator.handle(sealed, { skipRequestFields: true });
  // A field NAME is requester-chosen text: an unprintable one must not ride into
  // the reason verbatim, where an embedded newline could forge a log line.
  const nasty = { number: DEMO_NUMBER, predicate: PREDICATE, floor: {}, nonce: 'typo-2', ['a\nb\u0000']: 1 };
  const nastyBytes = Buffer.from(JSON.stringify(nasty), 'utf8');
  const nastyOut = await w.operator.handle(seal(w.keys.opEnc.publicKey,
    packSigned({ payloadBytes: nastyBytes, signature: edSign(null, nastyBytes, w.keys.rpSig.privateKey) }, w.keys.rpIss)));
  check('26 CLOSED REQUEST FIELD SET', false, { ok: r.kind === 'answer', reason: r.reason }, 'unexpected request fields: floors',
    { label: 'set-open control reproduces the silent widening; unprintable names are not echoed',
      ok: c.kind === 'answer' && c.claims.result === true
        && JSON.stringify(REQUEST_FIELDS) === '["number","predicate","floor","nonce"]'
        && nastyOut.reason === 'unexpected request fields: (unprintable field name)' });
}

// 27 HOSTILE PREDICATE NEVER THROWS — the composition's own "wire input never
// throws" contract, which each module states for itself and nobody had stated
// for the seam between them. Every shape here arrives through a real JSON
// transit and must come back as a verdict, not an exception: the operator is
// reachable by anyone who has its public envelope key.
{
  const w = await mockWorld();
  const send = async (predicate, nonce) => {
    const req = { number: DEMO_NUMBER, predicate, floor: { swapAgeMin: 'P180D' }, nonce };
    const sealed = seal(w.keys.opEnc.publicKey, packSigned(attest(w.keys.rpSig.privateKey, req), w.keys.rpIss));
    try { return await w.operator.handle(sealed); } catch (e) { return { kind: 'THREW', reason: `${e.constructor.name}: ${e.message}` }; }
  };
  const shapes = [null, undefined, ['simSwapAge'], 'simSwapAge gte P90D', 7, true,
    { type: { a: 1 }, operator: 'gte', value: 'P90D' },
    { type: 'simSwapAge', operator: 'gte', value: { a: 1 } },
    { type: 'roamingIn', operator: 'in', value: ['FR', null] },
    { type: 'roamingIn', operator: 'in', value: [] }];
  const outs = [];
  for (let i = 0; i < shapes.length; i++) outs.push(await send(shapes[i], `hostile-${i}`));
  const threw = outs.filter((o) => o.kind === 'THREW');
  const answered = outs.filter((o) => o.kind === 'answer');
  ok('27 HOSTILE PREDICATE NEVER THROWS', threw.length === 0 && answered.length === 0,
    { label: `${outs.length} shapes, ${threw.length} threw, ${answered.length} answered${threw.length ? `: ${threw[0].reason}` : ''}`,
      ok: outs.every((o) => typeof o.reason === 'string' && claimBytes(o.reason) <= WIRE_REASON_JSON_MAX) });
}

// 28 A CRASHED MOCK RUN IS A FAILURE, NOT A SKIP — the other half of the
// exit-code contract, and a defect found 2026-08-17 by probing what a genuine
// regression looks like to a gate. Exit 2 means THE CHOSEN BACKEND COULD NOT
// RUN. `--backend mock` has no prerequisites at all — no credential, no
// network, nothing that can be unavailable — so a backend that STARTED and then
// threw can only be a code regression, and must exit 1. It used to exit 2, and
// a CI gate that (correctly) treats 2 as skip-on-prerequisite would have
// swallowed the regression silently: the optimistic-rounding failure, at the
// process boundary. Under `--backend orange` the same throw stays 2, because
// there an unreachable live operator genuinely IS a prerequisite failure.
//
// The backend is injected rather than mutated: it start()s cleanly and throws
// on first use, which is exactly the shape a regression has and NOT the shape
// case 24 covers.
{
  const crashing = async () => ({
    label: 'crashing — starts clean, throws on first use',
    setBackstory: async () => { throw new Error('simulated mid-run regression'); },
    getFacts: async () => { throw new Error('simulated mid-run regression'); },
  });
  const saved = process.env.ORANGE_BASIC_AUTH;
  delete process.env.ORANGE_BASIC_AUTH;
  const realErr = console.error;
  const realLog = console.log;
  console.error = () => {};
  let mockCrash; let orangeCrash;
  try {
    console.log = () => {};
    mockCrash = await main(['--backend', 'mock'], { createBackendImpl: crashing });
    orangeCrash = await main(['--backend', 'orange'], { createBackendImpl: crashing });
  } finally {
    console.log = realLog;
    console.error = realErr;
    if (saved !== undefined) process.env.ORANGE_BASIC_AUTH = saved;
  }
  // The clean mock run is asserted alongside, so this case cannot pass by
  // making EVERY mock run exit 1.
  const cleanBackend = await createBackend('mock');
  console.log = () => {};
  let clean;
  try { clean = await runDemo(cleanBackend); } finally { console.log = realLog; }
  ok('28 CRASHED MOCK RUN IS 1, NOT 2', mockCrash === 1 && orangeCrash === 2,
    { label: `mock mid-run throw=${mockCrash} (regression, must be 1), orange mid-run throw=${orangeCrash} (prerequisite, must be 2), clean mock=${clean}`,
      ok: clean === 0 });
}

// ═══════════════ THE 2026-08-17 ADVERSARIAL REVIEW (cases 29-38) ═════════════
// Four real defects and ten mutation survivors. Every case below either replays
// a defect this suite did not catch, or pins a guard an independent mutation
// sweep proved could be DELETED with the suite still green — which is the same
// thing said twice: the code was right and nothing was holding it there.

// 29 THE REFUSAL BUDGET IS COMPUTED, NOT ASSUMED — the two ways `handle()` could
// be made to THROW on a request that fits one envelope. Both arrive through the
// ordinary path, from anyone holding the operator's public envelope key, and
// both were live at 8238d02:
//   * an unbounded echoed NONCE (200 characters on an otherwise minimal
//     request), and
//   * a clamp counting UTF-16 CODE UNITS while seal() counts BYTES (a floor
//     value of 40 astral characters clamped to 121 units = 363 bytes).
// The third assertion is the arithmetic itself: the WORST refusal the two bounds
// admit — a 68-byte nonce beside a maximal multibyte reason — must actually seal
// into one envelope. That is the line that would red if `iss` grew, which is the
// one input the stated arithmetic assumes.
{
  const w = await mockWorld();
  const longNonce = await sendRaw(w, { nonce: 'N'.repeat(200), zz: 1 });
  const astral = await sendRaw(w, { number: DEMO_NUMBER, floor: { swapAgeMin: `P${'\u{1F600}'.repeat(40)}D` }, nonce: 'mb' });
  const clamped = clampReason(`P${'\u{1F600}'.repeat(40)}D is not a duration`);

  const worstNonce = 'n'.repeat(NONCE_JSON_MAX - 2);
  const worstReason = clampReason('\u{1F600}'.repeat(400));
  const worstFrame = packSigned(attest(w.keys.opSig.privateKey, { error: worstReason, nonce: worstNonce, exp: NOW + VALIDITY_MS }), w.keys.opIss);
  let worstSealed = null;
  try { worstSealed = seal(w.keys.rpEnc.publicKey, worstFrame); } catch (e) { worstSealed = e.message; }

  check('29 REFUSAL BUDGET', false, { ok: longNonce.kind !== 'reject', reason: longNonce.reason },
    'nonce too long to echo in a signed refusal',
    { label: `astral floor value refuses (${claimBytes(clamped)} B claim, was 363 raw); worst admissible refusal = ${worstFrame.length}/${OAEP_CAPACITY} B and seals`,
      ok: astral.kind === 'reject' && astral.sealed !== null
        && claimBytes(clamped) <= WIRE_REASON_JSON_MAX
        && Buffer.from(clamped, 'utf8').toString('utf8') === clamped   // still valid UTF-8: no character was split
        && worstFrame.length <= OAEP_CAPACITY && Buffer.isBuffer(worstSealed) });
}

// 30 AN ANSWER THAT WILL NOT FIT IS REFUSED, NOT A CRASH — found 2026-08-17
// while fixing case 29, and not on the review's list. A request that fits one
// envelope does NOT imply an answer that does: `roamingIn` takes a SET, and the
// canonical predicate re-escapes every quote in it, so the answer frame grows
// faster than the request did. 18 two-letter codes fit a 446-byte request and
// produced a 448-byte answer frame; seal() threw straight out of handle().
{
  const w = await mockWorld();
  let biggest = null;
  for (let n = 1; n <= 40; n++) {
    const value = Array.from({ length: n }, (_, i) => `${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i * 7) % 26))}`);
    try { biggest = { n, req: w.rp.buildRequest({ type: 'roamingIn', operator: 'in', value }, {}) }; } catch { break; }
  }
  let r;
  try { r = await roundTrip(w, biggest.req); } catch (e) { r = { out: { kind: 'THREW', reason: e.message } }; }
  // ...and the control: one code fewer still ANSWERS, so this case pins the
  // overflow boundary rather than "roamingIn is broken".
  const smallValue = Array.from({ length: biggest.n - 4 }, (_, i) => `${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i * 7) % 26))}`);
  const small = await roundTrip(w, w.rp.buildRequest({ type: 'roamingIn', operator: 'in', value: smallValue }, {}));
  check('30 OVERSIZE ANSWER', false, { ok: r.out.kind === 'answer', reason: r.out.reason },
    'answer does not fit one envelope',
    { label: `${biggest.n} country codes fit the request and overflow the answer; ${smallValue.length} still answers`,
      ok: r.out.kind === 'reject' && r.out.sealed !== null && small.verdict.accepted === true });
}

// 31 A FORGED RESPONSE DOES NOT BURN THE PENDING NONCE — the untrusted hub's
// cheapest attack, and it worked at 8238d02: the store deleted the nonce BEFORE
// the verdict was read, so one injected garbage sealed response made the
// operator's genuine answer arrive to 'unknown or already-used nonce'. A
// one-message denial of service by exactly the party the design assumes is
// hostile. The comment already said "consumed on any VERIFIED exchange"; the
// code consumed on any PRESENTED one.
//
// The replay control is the other half: consuming too LATE would be just as
// wrong, so the genuine answer must still be single-use afterwards.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const hubSig = generateKeyPairSync('ed25519');
  const forged = seal(w.keys.rpEnc.publicKey,
    packSigned(attest(hubSig.privateKey, { predicate: canonicalPredicate(PREDICATE), result: true, nonce: q.nonce, exp: NOW + VALIDITY_MS }), w.keys.opIss));
  const injected = w.rp.verifyResponse(forged, q.nonce, NOW + 1_000);
  const real = await roundTrip(w, q);
  const replay = w.rp.verifyResponse(real.atRp, q.nonce, NOW + 2_000);
  ok('31 FORGED RESPONSE DOES NOT BURN THE NONCE', real.verdict.accepted === true,
    { label: `forgery rejected as '${injected.reason}', genuine answer still accepted, and it is still single-use ('${replay.reason}')`,
      ok: injected.accepted === false && injected.refused === undefined && replay.accepted === false && replay.reason === 'unknown or already-used nonce' });
}

// 32 AN AMBIGUOUS REFUSAL IS REJECTED — profile rule 2 for the SECOND verifier.
// `verifyAttestation` runs M1's duplicate-key scan; `verifyRefusal` did not,
// even though M6 exported that scanner from M1 this very round precisely so the
// request path would not carry a second copy. One signature over
// `{"error":"below floor","error":"off menu",…}` therefore read as one refusal
// to a last-wins parser and a different one to a first-wins parser.
{
  const w = await mockWorld();
  const N = 'dup-refusal';
  const signAsOp = (text) => {
    const by = Buffer.from(text, 'utf8');
    return seal(w.keys.rpEnc.publicKey, packSigned({ payloadBytes: by, signature: edSign(null, by, w.keys.opSig.privateKey) }, w.keys.opIss));
  };
  w.rp.pending.set(N, { predicate: canonicalPredicate(PREDICATE) });
  const dup = w.rp.verifyResponse(signAsOp(`{"error":"below floor","error":"off menu","nonce":"${N}","exp":${NOW + VALIDITY_MS}}`), N, NOW + 1_000);
  // Control: the SAME shape with one error key IS reported as a refusal, so this
  // case pins the scan and not "refusals never verify".
  w.rp.pending.set(N, { predicate: canonicalPredicate(PREDICATE) });
  const clean = w.rp.verifyResponse(signAsOp(`{"error":"off menu","nonce":"${N}","exp":${NOW + VALIDITY_MS}}`), N, NOW + 1_000);
  check('32 AMBIGUOUS REFUSAL', false, { ok: dup.refused === true, reason: dup.reason }, 'duplicate claim keys',
    { label: 'single-error control IS reported as a refusal', ok: clean.refused === true && clean.reason === 'operator refused: off menu' });
}

// 33 NO OPERATOR-INTERNAL DIAGNOSTIC REACHES THE REQUESTER — decision #3. The
// backend's exception message used to ride verbatim into the SIGNED refusal, so
// on the Orange path an upstream 500 would deliver a core-network hostname or
// pool name to whoever asked (AGENT_RULES invariant 4). The backend here throws
// a message shaped like exactly that, and none of it may cross.
{
  const leaky = {
    label: 'leaky — throws an upstream diagnostic',
    setBackstory: async () => {},
    getFacts: async () => { throw new Error('upstream 500 from sim-swap-pool-07.core.example.net (tenant acct-9911, trace 0f3a)'); },
  };
  const w = createWorld({ backend: leaky, keys: KEYS });
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const r = await roundTrip(w, q);
  const secrets = ['sim-swap-pool-07', 'core.example.net', 'acct-9911', '0f3a', 'upstream 500'];
  const sealedText = r.atRp.toString('latin1') + JSON.stringify(r.out.claims) + String(r.verdict.reason);
  check('33 NO INTERNAL DETAIL ON THE WIRE', false, { ok: r.out.kind === 'answer', reason: r.out.reason }, FACTS_UNAVAILABLE,
    { label: `requester sees one stable reason; the operator keeps '${String(r.out.operatorDetail).slice(0, 34)}…' locally`,
      ok: r.verdict.refused === true
        && scan(sealedText, secrets).length === 0
        && secrets.every((s) => String(r.out.operatorDetail).includes(s)) });
}

// 34 A MALFORMED TRANSPORT FRAME IS A VERDICT — `unpackSigned`'s guards, which
// no case reached before (an independent mutation sweep deleted them with the
// suite still green). Every shape below is validly SEALED, so it gets past M2
// and dies exactly where it should.
//
// One of those survivors is NOT pinned here, and saying which is the honest
// half: `Array.isArray(o)` is REDUNDANT. Only `JSON.parse` output reaches it, a
// parsed array's own keys are always its numeric indices, so it can never carry
// own string-valued `iss`/`payload`/`sig` and always dies on the typeof line
// below instead. Proved rather than assumed (guarded and unguarded agreed on 9
// array shapes) and documented at the call site, because a case written to
// "cover" an unreachable branch is a case that cannot fail. Same finding, and
// the same resolution, as M4's redundant `Array.isArray` in `plainSnapshot`.
{
  const w = await mockWorld();
  const sealRaw = (text) => w.operator.handle(seal(w.keys.opEnc.publicKey, Buffer.from(text, 'utf8')));
  const notJson = await sealRaw('}{ not json');
  const anArray = await sealRaw('[1,2,3]');                                     // dies on the typeof guards, not Array.isArray
  const aNumber = await sealRaw('7');                                           // typeof object guard
  const badTypes = await sealRaw('{"iss":"rp:demo-agent-01","payload":"e30=","sig":42}');   // typeof string guards
  const noIss = await sealRaw('{"payload":"e30=","sig":"AA=="}');
  const all = [notJson, anArray, aNumber, badTypes, noIss];
  // Control: a well-formed frame with the same unknown issuer gets PAST unpack
  // and dies one step later, so 'malformed request' is not simply what every
  // sealed byte string returns.
  const wellFormed = await w.operator.handle(seal(w.keys.opEnc.publicKey, packSigned(attest(w.keys.rpSig.privateKey, { nonce: 'n' }), 'rp:nobody')));
  check('34 MALFORMED FRAME', false, { ok: all.some((r) => r.kind === 'answer'), reason: all.map((r) => r.reason).join('|') },
    'malformed request|malformed request|malformed request|malformed request|malformed request',
    { label: `${all.length} frame shapes; a well-formed frame gets past unpack ('${wellFormed.reason}')`,
      ok: wellFormed.reason === 'unknown issuer' });
}

// 35 A REQUEST WITH NO NONCE IS REFUSED IN THE CLEAR — the `typeof req.nonce`
// guard, also never exercised. Unsealed on purpose: an operator cannot sign a
// refusal to a request that gave it nothing to bind one to.
{
  const w = await mockWorld();
  const none = await sendRaw(w, { number: DEMO_NUMBER, predicate: PREDICATE, floor: TIGHTER });
  const wrongType = await sendRaw(w, { number: DEMO_NUMBER, predicate: PREDICATE, floor: TIGHTER, nonce: 7 });
  const withOne = await sendRaw(w, { number: DEMO_NUMBER, predicate: PREDICATE, floor: TIGHTER, nonce: 'n35' });
  check('35 MISSING NONCE', false, { ok: none.kind === 'answer', reason: none.reason }, 'missing nonce',
    { label: `a numeric nonce is also missing ('${wrongType.reason}'); with one, the same request is ANSWERED`,
      ok: wrongType.reason === 'missing nonce' && none.sealed === null && withOne.kind === 'answer' });
}

// 36 NO FACT IS READ BEFORE THE GATES — the justification for the whole pipeline
// ORDER ("a computed-then-discarded answer is still an oracle query"), claimed
// in two case comments and asserted nowhere. An independent mutation sweep moved
// the floor gate to AFTER `getFacts` and this suite stayed green. The backend is
// INSTRUMENTED here, so the claim is now counted rather than described.
{
  const base = await createBackend('mock');
  await base.setBackstory(DEMO_NUMBER, STORY, NOW);
  let reads = 0;
  const spy = { ...base, getFacts: async (...a) => { reads += 1; return base.getFacts(...a); } };
  const w = createWorld({ backend: spy, keys: KEYS });

  reads = 0;
  await roundTrip(w, w.rp.buildRequest(PREDICATE, { swapAgeMin: 'P30D' }));            // below floor
  const afterFloor = reads;
  reads = 0;
  await roundTrip(w, w.rp.buildRequest({ type: 'simSwapAge', operator: 'gte', value: 'P137D' }, TIGHTER));   // off menu
  const afterMenu = reads;
  reads = 0;
  const happy = await roundTrip(w, w.rp.buildRequest(PREDICATE, TIGHTER));             // the control
  const afterHappy = reads;
  ok('36 NO FACT READ BEFORE THE GATES', afterFloor === 0 && afterMenu === 0,
    { label: `getFacts calls — below-floor ${afterFloor}, off-menu ${afterMenu}, accepted ${afterHappy}`,
      ok: afterHappy === 1 && happy.verdict.accepted === true });
}

// 37 THE REFUSAL VERIFIER IS 4/4 — `verifyRefusal` runs four checks and only the
// signature was pinned; the sweep deleted the closed key set, the nonce binding
// and the expiry with this suite still green. Each is shown REJECTING beside a
// control that differs in that one field only, so none of them can pass by the
// refusal being unverifiable for some other reason.
{
  const w = await mockWorld();
  const N = 'refusal-4';
  const signAsOp = (claims) => seal(w.keys.rpEnc.publicKey, packSigned(attest(w.keys.opSig.privateKey, claims), w.keys.opIss));
  const present = (claims, nonce = N, nowMs = NOW + 1_000) => {
    w.rp.pending.set(nonce, { predicate: canonicalPredicate(PREDICATE) });
    return w.rp.verifyResponse(signAsOp(claims), nonce, nowMs);
  };
  const good = { error: 'below floor', nonce: N, exp: NOW + VALIDITY_MS };
  const control = present(good);
  const extraKey = present({ ...good, note: 'hello' });              // closed key set
  const missingKey = present({ error: 'below floor', nonce: N });    // ...in the other direction
  const wrongNonce = present({ ...good, nonce: 'somebody-elses' });  // nonce binding
  const expired = present({ ...good, exp: NOW - 1 });                // expiry
  const broken = [extraKey, missingKey, wrongNonce, expired];
  ok('37 REFUSAL VERIFIER IS 4/4', broken.every((v) => v.refused !== true),
    { label: `control refuses ('${control.reason}'); +key/-key/wrong-nonce/expired all rejected: ${JSON.stringify(broken.map((v) => v.reason))}`,
      ok: control.refused === true && control.reason === 'operator refused: below floor' });
}

// 38 THE HUB LOG FIELD SET IS CLOSED — needle-scanning the log only catches a
// hub leaking a value the scanner happens to know. A hub adding ANY field passes
// that scan, which is what the sweep showed. The metering record's key set is
// the actual contract (rule 6: metering, not content), so it is pinned as a
// closed set, and the chatty control breaks it by adding exactly one key.
{
  const w = await mockWorld();
  await roundTrip(w, w.rp.buildRequest(PREDICATE, TIGHTER));
  const shape = (log) => [...new Set(log.map((e) => Object.keys(e).sort().join(',')))];
  const chatty = createHub();
  chatty.route(w.keys.rpIss, w.keys.opIss, Buffer.alloc(8), { chatty: 'anything at all' });
  ok('38 HUB LOG FIELD SET IS CLOSED', JSON.stringify(shape(w.hub.log)) === '["bill,bytes,from,seq,to"]',
    { label: `${w.hub.log.length} entries, one shape: ${JSON.stringify(shape(w.hub.log))}; chatty control widens it to ${JSON.stringify(shape(chatty.log))}`,
      ok: JSON.stringify(shape(chatty.log)) === '["bill,bytes,debug,from,seq,to"]' });
}

// ═══════════ THE 3 → 6 PREDICATE ROUND (2026-08-17) — cases 39+ ══════════════
// One case per thing the composition owns for a NEW predicate: that the menu
// actually reaches it, that the axes are independent end to end, and that the
// question reaches the facts backend as validated primitives and never as wire
// input.

// 39 deviceSwapAge END TO END, UNDER THE SAME MENU. Three legs, because the
// cheap way to add a second duration type is to add it to `PREDICATES` and forget
// the menu — and that failure is invisible from the answer side: the bit is
// correct, signed and verifiable, and the oracle the menu exists to cap is simply
// open again on the new axis. So an off-menu DEVICE threshold must be refused with
// the same reason shape as the SIM one, and the menu-off control must answer it.
{
  const w = await mockWorld();
  const onMenu = await roundTrip(w, w.rp.buildRequest(DEVICE_PREDICATE, TIGHTER));
  const off = { type: 'deviceSwapAge', operator: 'gte', value: 'P211D' };   // the exact rung a walk needs
  const refused = await roundTrip(w, w.rp.buildRequest(off, TIGHTER));
  const control = await roundTrip(w, w.rp.buildRequest(off, TIGHTER), { operator: { skipMenu: true } });
  // ...and the two axes are independent through the WHOLE composition, not just
  // in M4: the device story is 211 days and the SIM story is 137, so a mapping
  // that read the wrong fact would answer P180D the same way on both.
  const devP180 = await roundTrip(w, w.rp.buildRequest({ type: 'deviceSwapAge', operator: 'gte', value: 'P180D' }, TIGHTER));
  const simP180 = await roundTrip(w, w.rp.buildRequest({ type: 'simSwapAge', operator: 'gte', value: 'P180D' }, TIGHTER));
  check('39 deviceSwapAge END TO END', false, { ok: refused.out.kind === 'answer', reason: refused.verdict.reason },
    'operator refused: threshold not on the published menu for deviceSwapAge (allowed: P30D, P90D, P180D, P365D)',
    { label: `on-menu P90D → ${onMenu.out.claims?.result}; menu-off control answers the P211D rung (${control.out.claims?.result}); `
      + `device ${DEVICE_SWAPPED_DAYS_AGO}d vs SIM ${SWAPPED_DAYS_AGO}d under P180D → ${devP180.out.claims?.result}/${simP180.out.claims?.result}`,
      ok: onMenu.verdict.accepted === true && onMenu.out.claims.result === true
        && refused.out.menuRejected === true
        && control.out.kind === 'answer' && control.verdict.accepted === true
        && devP180.out.claims.result === true && simP180.out.claims.result === false
        && onMenu.out.claims.predicate === 'deviceSwapAge gte "P90D"' });
}

// 40 THE FACTS BACKEND NEVER SEES WIRE INPUT. The 3 → 6 round added a path from
// the request to the adapter (three of the six predicates make the operator ask
// its own upstream a question-shaped question), and that path is the one place
// where handing `req.predicate` down would put an unvalidated wire object into the
// module that builds outbound HTTP — a hostile getter, a revoked Proxy or a
// 5,000,000-element array, delivered to a live network client instead of being
// refused. So the backend is INSTRUMENTED: every query it is handed is recorded
// and must be frozen plain data carrying primitives only.
//
// The control is the leg that makes it mean something: a LEGAL question must
// actually deliver its threshold, or this case would pass on a seam that always
// handed the adapter nothing.
{
  const base = await createBackend('mock');
  await base.setBackstory(DEMO_NUMBER, STORY, NOW);
  const seen = [];
  const spy = { ...base, getFacts: async (n, t, q) => { seen.push(q); return base.getFacts(n, t, q); } };
  const w = createWorld({ backend: spy, keys: KEYS });

  await roundTrip(w, w.rp.buildRequest(PREDICATE, TIGHTER));                       // legal: carries a threshold
  await roundTrip(w, w.rp.buildRequest(DEVICE_PREDICATE, TIGHTER));                // legal: the other axis
  await roundTrip(w, w.rp.buildRequest({ type: 'roamingIn', operator: 'in', value: ['FR'] }, TIGHTER));
  // Hostile shapes that still get PAST the gates and genuinely REACH this seam.
  // Which shapes those are is itself a finding, measured while writing this case:
  // a hostile value on a MENU'D type (`{type:'simSwapAge', value:{a:1}}`) never
  // arrives at all — the published menu refuses it first, before any fact is read
  // — so the shapes that reach the adapter are the ones on unmenu'd types and the
  // ones that are not predicates at all. Both halves are asserted below.
  const hostile = [
    { type: 'roamingIn', operator: 'in', value: { a: 1 } },
    { type: 'roamingIn', operator: 'in', value: [{}] },
    { type: 'watIsThis', operator: 'gte', value: 'P90D' },
    7, null, 'simSwapAge',
  ];
  for (let i = 0; i < hostile.length; i++) await sendRaw(w, { number: DEMO_NUMBER, predicate: hostile[i], floor: TIGHTER, nonce: `q40-${i}` });
  // ...and the menu'd pair, which must add NOTHING to the tally.
  const beforeMenud = seen.length;
  await sendRaw(w, { number: DEMO_NUMBER, predicate: { type: 'simSwapAge', operator: 'gte', value: { a: 1 } }, floor: TIGHTER, nonce: 'q40-m1' });
  await sendRaw(w, { number: DEMO_NUMBER, predicate: { type: 'deviceSwapAge', operator: 'gte', value: ['P90D'] }, floor: TIGHTER, nonce: 'q40-m2' });
  const menudReached = seen.length - beforeMenud;

  const plain = (q) => q !== null && typeof q === 'object' && !Array.isArray(q)
    && Object.getPrototypeOf(q) === Object.prototype && Object.isFrozen(q)
    && Object.values(q).every((v) => v === null || typeof v !== 'object');
  const legal = seen.slice(0, 3);
  const fromHostile = seen.slice(3);
  ok('40 THE FACTS BACKEND NEVER SEES WIRE INPUT',
    seen.length === 9 && seen.every(plain),
    { label: `${seen.length} queries handed to the backend, all frozen plain primitives; legal → `
      + `${JSON.stringify(legal)}; hostile → ${JSON.stringify(fromHostile)}`,
      ok: legal[0].swapAgeThresholdMs === 90 * DAY_MS
        && legal[1].deviceSwapAgeThresholdMs === 90 * DAY_MS
        && Object.keys(legal[2]).length === 0
        && fromHostile.length === 6 && fromHostile.every((q) => Object.keys(q).length === 0)
        && menudReached === 0 });
}

// 41 presentIn: THE THIRD STATE IS REFUSED, NOT ROUNDED — the round's sharpest
// guard, and the one whose failure mode is a SIGNED confident answer. Measured
// 2026-08-17: `location-verification/v1/verify` answers TRUE, FALSE and PARTIAL
// (Paris at a 100 m radius), and a PARTIAL rounded to either bit is
// indistinguishable on the wire from a real one.
//
// Four legs, because refusing everything would pass a weaker version of this
// case: a resolvable area must ANSWER both ways, the sub-resolution one must
// REFUSE, and the refusal must carry no bit and no 'PARTIAL' on the wire.
{
  const backend = await createBackend('mock');
  await backend.setBackstory(DEMO_NUMBER, STORY, NOW);
  const w = createWorld({ backend, keys: KEYS });
  const ask = (value) => roundTrip(w, w.rp.buildRequest({ type: 'presentIn', operator: 'in', value }, TIGHTER));
  const here = await ask(NEAR_AREA);
  const away = await ask({ lat: 50.85, long: 4.35, radiusM: 10000 });          // Brussels
  const q = w.rp.buildRequest({ type: 'presentIn', operator: 'in', value: { ...NEAR_AREA, radiusM: 100 } }, TIGHTER);
  const partial = await roundTrip(w, q);
  const frame = withoutNonce(unpackSigned(partial.out.plain).signed.payloadBytes.toString('utf8'), q.nonce);
  check('41 presentIn REFUSES PARTIAL', false, { ok: partial.out.kind === 'answer', reason: partial.verdict.reason },
    'operator refused: location partial: refused, never rounded',
    { label: `resolvable areas still ANSWER (near ${here.out.claims?.result}, far ${away.out.claims?.result}); `
      + `the refusal carries no bit and no verdict word (scanned ${NEEDLES.length} needles)`,
      ok: here.verdict.accepted === true && here.out.claims.result === true
        && away.verdict.accepted === true && away.out.claims.result === false
        && partial.out.claims.result === undefined
        && scan(frame, NEEDLES).length === 0 });
}

// 42 THE PARTIAL POLICY IS PUBLISHED AND TIGHTEN-ONLY. The refusal above must not
// be a hardcoded behaviour a reader has to take on trust: the operator PUBLISHES
// the policy as a floor axis and the requester may only tighten it, which is M3's
// existing rule-5 machinery. So a request asking to have PARTIAL ROUNDED for it —
// the only thing a requester could want here — is a LOOSENING, and dies at the
// floor gate before any fact is read. The control is the same request restating
// the published value, which must be ACCEPTED, or this case would pass on a gate
// that rejected the axis outright.
{
  const backend = await createBackend('mock');
  await backend.setBackstory(DEMO_NUMBER, STORY, NOW);
  const w = createWorld({ backend, keys: KEYS });
  const ask = (floor) => roundTrip(w, w.rp.buildRequest({ type: 'presentIn', operator: 'in', value: NEAR_AREA }, floor));
  const loosen = await ask({ ...TIGHTER, partialPolicy: 'round' });
  const restate = await ask({ ...TIGHTER, partialPolicy: 'refuse' });
  check('42 PARTIAL POLICY IS PUBLISHED, TIGHTEN-ONLY', false,
    { ok: loosen.out.kind === 'answer', reason: loosen.verdict.reason },
    'operator refused: invalid partialPolicy: "round" (profile allows only "refuse")',
    { label: `refused at the FLOOR gate (before any fact); restating the published value is accepted (${restate.out.claims?.result}); published=${PUBLISHED_FLOOR.partialPolicy}`,
      ok: loosen.out.floorRejected === true
        && restate.verdict.accepted === true && restate.out.claims.result === true
        && PUBLISHED_FLOOR.partialPolicy === 'refuse' });
}

// 43 THE AREA IS CANONICALISED BY KEY, NOT BY TYPING ORDER. `JSON.stringify`
// serialises an object in INSERTION order, and a parsed request's insertion order
// is whatever the requester typed. Two requesters asking about the same circle
// would then derive two different signed predicate strings, and one of them would
// get its own correct answer back as a `predicate mismatch` — a self-inflicted
// denial of service that only appears once someone spells the area differently.
//
// The other half is that canonicalisation must stay INJECTIVE while it does that:
// a different area, and a value of a different KIND, must still render
// differently, or the fix would re-open the collision M6 exists to close.
{
  const c = canonicalPredicate;
  const a = { type: 'presentIn', operator: 'in', value: { lat: 48.86, long: 2.35, radiusM: 10000 } };
  const reordered = { type: 'presentIn', operator: 'in', value: { radiusM: 10000, long: 2.35, lat: 48.86 } };
  const wireOrder = JSON.parse('{"type":"presentIn","operator":"in","value":{"radiusM":10000,"long":2.35,"lat":48.86}}');
  const shifted = { type: 'presentIn', operator: 'in', value: { lat: 48.87, long: 2.35, radiusM: 10000 } };
  const wider = { type: 'presentIn', operator: 'in', value: { lat: 48.86, long: 2.35, radiusM: 10001 } };
  ok('43 AREA CANONICALISATION IS ORDER-FREE AND INJECTIVE',
    c(a) === c(reordered) && c(a) === c(wireOrder),
    { label: `same circle three spellings → ${JSON.stringify(c(a))}`,
      ok: c(a) !== c(shifted) && c(a) !== c(wider)
        && c(a) !== c({ type: 'presentIn', operator: 'in', value: JSON.stringify(a.value) })
        && c(a) === 'presentIn in {"lat":48.86,"long":2.35,"radiusM":10000}' });
}

// 44 numberMatch END TO END: THE SCORE NEVER CROSSES, AND THE WALK IS CAPPED. The
// composition's half of the predicate. Three legs that only exist here:
//   * the same subscriber, the same claim, TWO menu thresholds, TWO different
//     bits — so the threshold is genuinely the requester's window and not
//     decoration;
//   * an OFF-MENU threshold is refused before any fact is read, and the menu-off
//     control answers the same rung: that rung is one step of a walk that ends at
//     the subscriber's REGISTERED NAME, because the operator's score is a
//     gradient (97 for one letter off, 53 for a wrong name) rather than a band;
//   * the score, its field name and the registered name are scanned for in every
//     artifact the requester or the hub can hold.
{
  const w = await mockWorld();
  const ask = (claimed, value, controls) =>
    roundTrip(w, w.rp.buildRequest({ type: 'numberMatch', operator: 'gte', value, claimed }, TIGHTER), controls);
  const at90 = await ask(REGISTERED_NAME.replace(/d$/, 't'), 90);      // the measured near miss
  const at60 = await ask('Bob Wrong', 60);
  // The random hex nonce is blanked before a plaintext scan, for the same measured
  // reason the demo's scanner blanks it: a 32-character hex string contains a
  // given 2-digit needle about one run in 60, and a needle that reds a clean run
  // asserts nothing.
  const noNonce = (r) => (t) => withoutNonce(t, r.out.claims?.nonce);
  const q = w.rp.buildRequest({ type: 'numberMatch', operator: 'gte', value: 96, claimed: 'Alice Arnaut' }, TIGHTER);
  const offMenu = await roundTrip(w, q);
  const control = await roundTrip(w, w.rp.buildRequest({ type: 'numberMatch', operator: 'gte', value: 96, claimed: 'Alice Arnaut' }, TIGHTER), { operator: { skipMenu: true } });
  // The needle set splits the SAME way the wire scanner splits, and for the same
  // MEASURED reason: `97` is two characters, and two characters land inside 512
  // random ciphertext bytes about one run in eight. This case FLAKED exactly once
  // that way before the split existed — a needle that reds a clean run asserts
  // nothing, so the short one is scanned only where a hit is real.
  const secrets = [REGISTERED_NAME, String(NEAR_MISS_SCORE), 'nameMatchScore', 'nameMatch'];
  const longSecrets = opaqueNeedles(secrets);
  const opaque = [at90, at60, offMenu].map((r) => r.atRp.toString('latin1'));
  const plain = [at90, at60, offMenu].flatMap((r) => [JSON.stringify(r.out.claims), String(r.verdict.reason)].map(noNonce(r)));
  const artifacts = [...opaque, ...plain];
  const found = [...opaque.flatMap((a) => scan(a, longSecrets)), ...plain.flatMap((a) => scan(a, secrets))];
  check('44 numberMatch END TO END', false, { ok: offMenu.out.kind === 'answer', reason: offMenu.verdict.reason },
    'operator refused: threshold not on the published menu for numberMatch (allowed: 60, 70, 80, 90)',
    { label: `near-miss ≥90 → ${at90.out.claims?.result}; wrong name ≥60 → ${at60.out.claims?.result}; `
      + `menu-off answers the ≥96 rung (${control.out.claims?.result}); `
      + `${opaque.length} opaque artifacts vs the ${longSecrets.length} long forms and ${plain.length} plaintext vs all ${secrets.length} → hits=${JSON.stringify(found)}`,
      ok: at90.verdict.accepted === true && at90.out.claims.result === true
        && at60.verdict.accepted === true && at60.out.claims.result === false
        && offMenu.out.menuRejected === true
        && control.out.kind === 'answer' && control.verdict.accepted === true
        && found.length === 0 && artifacts.length === 9 });
}

// 45 THE CLAIMED NAME IS PART OF THE SIGNED QUESTION. `claimed` is the one
// predicate field that is neither the type nor the window, and leaving it out of
// the canonical string would let an answer about "does Bob match?" verify as an
// answer about "does Alice match?" — the injectivity failure M6's canonical string
// exists to prevent, arriving through the only field the spike never saw.
//
// The control is the substituted-answer attack, applied AFTER the gates exactly as
// case 11 applies it: the operator accepts a legitimate question and answers a
// different one. The requester must reject it.
{
  const w = await mockWorld();
  const c = canonicalPredicate;
  const alice = { type: 'numberMatch', operator: 'gte', value: 90, claimed: 'Alice Arnaut' };
  const bob = { type: 'numberMatch', operator: 'gte', value: 90, claimed: 'Bob Wrong' };
  const q = w.rp.buildRequest(alice, TIGHTER);
  const swapped = await roundTrip(w, q, { operator: { answerPredicate: bob } });
  rejects('45 THE CLAIMED NAME IS PART OF THE SIGNED QUESTION', swapped.verdict, 'predicate mismatch',
    { label: `asked ${JSON.stringify(c(alice))}, signed ${JSON.stringify(swapped.out.claims.predicate)}`,
      ok: c(alice) !== c(bob)
        && c(alice) === 'numberMatch gte 90 "Alice Arnaut"'
        // ...and a quote inside a name cannot forge the separator, because the
        // claim is JSON-quoted rather than concatenated raw.
        && c({ ...alice, claimed: 'A" 90 "B' }) !== c({ ...alice, claimed: 'A', value: 90 })
        && swapped.out.claims.predicate === c(bob) });
}

// The declared case count. A suite that silently loses the cases carrying its
// guarantee still printed a green `RESULT: n/n` before this argument existed
// (measured 2026-08-16 on m4-check: truncated to 18/18 exit 0, emptied to 0/0
// exit 0).
conclude(45);
