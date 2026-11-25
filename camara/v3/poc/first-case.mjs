// PoC V3-M4 — the first case (spec 4.5): a shop deals with an AI agent; SimSwap
// /check and Tenure /check-tenure, signed by the operator, verified by the SHOP
// (not the caller). Run: node camara/v3/poc/first-case.mjs  (exit 0 only if all hold)
// Demo data: two scripted lines, read by a tiny backend below. The Tenure rule here
// is just start <= tenureDate; it is not a test of CAMARA's table.
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { makeHarness } from './check-harness.mjs';
import { operatorAnswer, entryFor } from './menu.mjs';
import {
  verifyAnswer, verifyRefusal, makeNonceStore, parseDuration, SIM_SWAP_CHECK as S, TENURE_CHECK as T,
} from './m1-jws.mjs';

const { check, conclude } = makeHarness({ field: 'ok', okWord: 'ACCEPT' });
const today = new Date();
const day = 86400000;
const iso = (n) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - n * day).toISOString().slice(0, 10);

// Scripted lines: days ago of the last swap (null = never) and of the line start.
const LINES = { clean: { swap: 200, start: 1000 }, recent: { swap: 30, start: 1000 } };
const makeBackend = (line, spy) => (api, entry) => {
  spy.reads++;
  const days = parseDuration(entry);
  if (api === S.api) return { swapped: line.swap !== null && line.swap < days, contractType: 'PAYG' };
  return { tenureDateCheck: iso(line.start) <= iso(days), contractType: 'PAYG' };
};

const operatorKey = generateKeyPairSync('ed25519');
const resolveKey = (kid) => (kid === 'op-1' ? operatorKey.publicKey : null);
const iat = Math.floor(Date.now() / 1000);
const signOpts = { privateKey: operatorKey.privateKey, kid: 'op-1', base: { iss: 'operator', aud: 'agent-7', iat, exp: iat + 300 } };

// The shop: its own nonce store, issues nonces, verifies what the agent hands over.
const shop = makeNonceStore();
const newNonce = () => { const n = randomUUID(); shop.issue(n); return n; };
const verdict = (r) => ({ ok: r.ok, reason: r.ok ? undefined : (r.reason.code ?? r.reason.name) });
const shopVerify = (token, schema, expectedEntry) =>
  verdict(verifyAnswer(token, resolveKey, schema, { expectedIss: 'operator', expectedAud: 'agent-7', expectedEntry, nonceStore: shop, now: iat + 1 }));

// The agent's side: builds the Sync26 body, asks the operator, hands the response over.
const ctx = { today };
const ask = (api, line, body, spy = { reads: 0 }) => operatorAnswer(api, { ...body, nonce: newNonce() }, ctx, makeBackend(line, spy), signOpts);
const swapBody = { maxAge: 2160 };
const tenureBody = { tenureDate: iso(730) };

// Leak scan: raw values must not appear in any response or decoded payload.
const decode = (t) => Buffer.from(t.split('.')[1], 'base64url').toString('utf8');
const scan = (things, banned) => {
  const text = things.map((x) => JSON.stringify(x) + (x && x.attestation ? decode(x.attestation) : '')).join('\n');
  return banned.filter((b) => text.includes(b));
};

// ---- positive: the flow ----
const spy = { reads: 0 };
const swapResp = ask(S.api, LINES.clean, swapBody, spy);
const tenureResp = ask(T.api, LINES.clean, tenureBody, spy);
const swapTok = swapResp.attestation, tenureTok = tenureResp.attestation;
check('P1 SimSwap P90D signed, shop needs P60D, swapped:false', true, shopVerify(swapTok, S, 'P60D'),
  undefined, { label: 'answer swapped=false and the only keys are swapped+attestation', ok: swapResp.swapped === false && Object.keys(swapResp).join() === 'swapped,attestation' });
check('P2 Tenure P2Y signed, shop needs P2Y, tenureDateCheck:true', true, shopVerify(tenureTok, T, 'P2Y'),
  undefined, { label: 'only keys are tenureDateCheck+attestation (no contractType)', ok: Object.keys(tenureResp).join() === 'tenureDateCheck,attestation' });

// ---- negative controls ----
check('N1 replay of the accepted SimSwap token', false, shopVerify(swapTok, S, 'P60D'), 'NONCE_REJECTED');
check('N2 replay of the accepted Tenure token', false, shopVerify(tenureTok, T, 'P2Y'), 'NONCE_REJECTED');

{
  const t = ask(S.api, LINES.clean, swapBody).attestation;
  const i = t.length - 10; // inside the signature segment
  const flipped = t.slice(0, i) + (t[i] === 'A' ? 'B' : 'A') + t.slice(i + 1);
  check('N3 one changed byte in a fresh token', false, shopVerify(flipped, S, 'P60D'), 'JwsRejected');
}
{
  const t = ask(S.api, LINES.clean, swapBody).attestation;
  check('N4 shop needs P120D, token signed at P90D', false, shopVerify(t, S, 'P120D'), 'LOOSER');
}
{
  const t = ask(S.api, LINES.recent, swapBody).attestation;
  check('N5 recent swap: signed swapped:true at P90D, shop needs P60D', false, shopVerify(t, S, 'P60D'), 'NOT_PASS');
}
const offSpy = { reads: 0 };
const off = ask(S.api, LINES.clean, { maxAge: 1440 }, offSpy);
const offV = verdict(verifyRefusal(off.attestation, resolveKey, {
  expectedIss: 'operator', expectedAud: 'agent-7', expectedApi: S.api, nonceStore: shop, now: iat + 1 }));
check('N6 off-menu maxAge 1440: signed OUT_OF_RANGE refusal, shop verifies it, no answer, no read', true, offV, undefined,
  { label: 'no swapped key and 0 backend reads', ok: off.swapped === undefined && offSpy.reads === 0 && off.error === 'OUT_OF_RANGE' });

// ---- leak scan, and proof it can fail ----
const banned = [iso(LINES.clean.swap), iso(LINES.recent.swap), iso(LINES.clean.start), tenureBody.tenureDate, 'maxAge', 'contractType'];
const hits = scan([swapResp, tenureResp, off], banned);
check('L1 no response or decoded payload carries a raw value', true, { ok: hits.length === 0 }, undefined, { label: `hits=${JSON.stringify(hits)}`, ok: hits.length === 0 });
const leaky = { swapped: false, lastSwap: iso(LINES.clean.swap), contractType: 'PAYG' };
check('L2 guard: the scan flags a deliberately leaky object', false, { ok: scan([leaky], banned).length === 0 }, undefined);
// entryFor is what a caller keeps as expectedEntry; show it agrees with the shop's need.
check('E1 the caller maps its own request to the entry P90D', true, { ok: entryFor(S.api, swapBody, ctx) === 'P90D' }, undefined);

conclude(11);
