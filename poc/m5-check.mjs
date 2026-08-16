// PoC module M5 — standalone OFFLINE check. Run: node poc/m5-check.mjs
//
// ZERO credentials, zero network, deterministic: it runs on a clean clone. The
// transport is injected and replays responses CAPTURED VERBATIM from the live
// Playground on 2026-08-16 (raw dumps behind the findings entry). So this suite
// proves the mapping, the error classification, the redaction and the
// read-after-write defence against the bytes Orange actually sends — while
// `m5-check-live.mjs` proves the same adapter still gets those bytes today.
//
// Negatives first, as in every module: each fail-open the spike could produce
// is shown being refused before a single happy path runs.
import { createOrangeFacts } from './m5-facts-orange.mjs';
import { evaluatePredicate } from './m4-facts-mock.mjs';
import { makeHarness } from './check-harness.mjs';

const { check, conclude } = makeHarness({ field: 'answered', okWord: 'OK' });

const NOW = Date.UTC(2026, 7, 16);
const DAY = 86400000;
const N = '+990100000099';                                  // the custom slot
const BUILTIN = '+990100000000';

// A SYNTHETIC credential of the real shape (base64 of `clientId:secret`). Never
// the real one — a fixture that needed a secret could not run on a clone.
const CLIENT_ID = 'CLIENTID0000000000000000000000AA';
const SECRET = 'SECRET000000000000000000000000000000000000BB';
const B64 = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64');
const CRED = `Basic ${B64}`;                 // as the credential is actually stored
const TOKEN = 'TOKEN.eyJmYWtlIjoidG9rZW4ifQ.SIGNATURE0000';

// ==================== CAPTURED responses (verbatim, 2026-08-16) =============
// Only the client id inside the 403 body is substituted for the synthetic one;
// every other byte is as received.
const C = Object.freeze({
  token: `{"token_type":"Bearer","access_token":"${TOKEN}","expires_in":3600,"scope":"openid"}`,
  swap: '{"latestSimChange":"2026-04-01T12:00:00.000Z"}',
  roamFalse: '{"roaming":false}',
  roamFR: '{"roaming":true,"countryCode":208,"countryName":["FR"]}',
  roamNoCountry: '{"roaming":true}',
  roamSpain: '{"roaming":true,"countryCode":34,"countryName":["Spain"]}',
  roamMulti: '{"roaming":true,"countryCode":208,"countryName":["FR","MC"]}',
  roamFalseWithCountry: '{"roaming":false,"countryCode":208,"countryName":["FR"]}',
  reachData: '{"reachabilityStatus":"CONNECTED_DATA"}',
  reachSms: '{"reachabilityStatus":"CONNECTED_SMS"}',
  reachNone: '{"reachabilityStatus":"NOT_CONNECTED"}',
  forbiddenUnknown: `{"code":"FORBIDDEN","status":403,"message":"+990100000077 does not exist for ${CLIENT_ID}"}`,
  forbiddenAuth: '{"code":"FORBIDDEN","status":403,"message":"Request must be authorized"}',
  unauthenticated: '{"status":401,"code":"UNAUTHENTICATED","message":"Request not authenticated due to missing, invalid, or expired credentials"}',
  notFound: '{"code":"BAD_REQUEST","status":400,"message":"PhoneNumber Not Found"}',
  malformedBasic: '{"error":"invalid_client","error_description":"Basic authentication is malformed"}',
});

// A stored Admin dataset, as READ returns it.
const stored = ({ sim = '2026-04-01T12:00:00.000Z', roaming = { roaming: false }, reach = 'CONNECTED_DATA' } = {}) =>
  JSON.stringify({ data: { location: { available: true }, reachability: { reachabilityStatus: reach }, roaming, simSwap: { latestSimChange: sim }, deviceSwap: { latestDeviceChange: '2026-08-11T04:00:16.516Z' }, tenure: { contractType: 'PAYM' }, kyc: { name: 'Alice Arnaud' } } });

// ============================== replay transport ===========================
// `route(url, parsedBody, callIndex)` returns `{status, text}`. Every call is
// recorded so a case can assert on what went ON THE WIRE (the header shape, the
// write payload) and not only on what came back.
function transport(route) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    const isToken = String(opts?.headers?.['Content-Type']).includes('urlencoded');
    let body = null;
    if (!isToken && typeof opts?.body === 'string') { try { body = JSON.parse(opts.body); } catch { body = opts.body; } }
    const rec = { url, auth: opts?.headers?.Authorization, body, isToken };
    calls.push(rec);
    const r = isToken ? { status: 200, text: C.token } : route(url, body, calls.length - 1, rec);
    return { status: r.status, text: async () => r.text };
  };
  return { fetchImpl, calls };
}
// The default happy route: every CAMARA read answers, admin READ mirrors the
// last write. Cases override only the piece they are about.
const reads = ({ swap = C.swap, roam = C.roamFalse, reach = C.reachData } = {}) => (url) => {
  if (url.includes('sim-swap')) return { status: 200, text: swap };
  if (url.includes('roaming')) return { status: 200, text: roam };
  if (url.includes('reachability')) return { status: 200, text: reach };
  return { status: 404, text: '{}' };
};

const mk = (route, cred = CRED) => {
  const t = transport(route);
  return { facts: createOrangeFacts({ basicAuth: cred, fetchImpl: t.fetchImpl }), calls: t.calls };
};

// Async equivalents of the harness's sync throw helpers (M4's `threws` pattern).
const athrew = async (fn) => {
  try { return { threw: false, msg: 'did not throw', value: await fn() }; }
  catch (e) { return { threw: true, msg: e instanceof Error ? e.message : String(e) }; }
};
const checkThrew = (name, r, extra) =>
  check(name, false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw', extra);
const checkOk = (name, r, extra) =>
  check(name, true, { answered: r.threw ? false : true, reason: r.threw ? r.msg : 'ok' }, 'ok', extra);
const names = (r, ...frags) => ({ label: `error names ${frags.join(' + ')}`, ok: r.threw && frags.every((f) => r.msg.includes(f)) });

// ================= PREREQUISITES: no credential is never a green run ========

// 1 NO CREDENTIAL THROWS — the "no silent mock fallback" rule. An adapter that
// quietly answered from a stub without credentials would make the live gate
// meaningless: the check would pass on a machine that never reached Orange.
checkThrew('1 NO CREDENTIAL THROWS',
  await athrew(() => createOrangeFacts({ fetchImpl: async () => {} })),
  names(await athrew(() => createOrangeFacts({ fetchImpl: async () => {} })), 'missing credential', 'ORANGE_BASIC_AUTH'));

// 2 WHITESPACE-ONLY CREDENTIAL THROWS — `'  '` is absent, not a credential.
checkThrew('2 BLANK CREDENTIAL THROWS',
  await athrew(() => createOrangeFacts({ basicAuth: '   ', fetchImpl: async () => {} })),
  names(await athrew(() => createOrangeFacts({ basicAuth: '   ', fetchImpl: async () => {} })), 'missing credential'));

// 3 `Basic ` PREFIX IS STRIPPED, NOT DOUBLED. MEASURED 2026-08-16: the stored
// credential (and the README runbook's `| head -1`) is ALREADY scheme-prefixed,
// so a naive `Basic ${cred}` sends `Basic Basic …` and BOTH token endpoints
// answer 400/401 "Basic authentication is malformed". This case reads the
// header that actually went out — the negative is a header with two `Basic`s.
{
  const { facts, calls } = mk(reads());
  await facts.getFacts(N, NOW);
  const auth = calls.find((c) => c.isToken)?.auth;
  check('3 BASIC PREFIX NORMALIZED (not doubled)', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `header=${auth === `Basic ${B64}`}`, ok: auth === `Basic ${B64}` });
}

// 4 A REJECTED CREDENTIAL FAILS LOUD, AND SAYS WHICH KNOB TO TURN.
{
  const t = transport(() => ({ status: 200, text: '{}' }));
  const bad = createOrangeFacts({ basicAuth: CRED, fetchImpl: async () => ({ status: 401, text: async () => C.malformedBasic }) });
  const r = await athrew(() => bad.getFacts(N, NOW));
  checkThrew('4 REJECTED CREDENTIAL FAILS LOUD', r, names(r, 'token rejected', 'ORANGE_BASIC_AUTH'));
  void t;
}

// ===================== REDACTION: nothing secret can be printed =============

// 5 THE CREDENTIAL NEVER SURVIVES INTO A MESSAGE. The probe is the realistic
// one: a server that echoes the request back. Without the secret set, the whole
// credential rides into the throw and from there into any log.
{
  const { facts } = mk(() => ({ status: 500, text: `upstream said: ${B64} and ${CRED}` }));
  const r = await athrew(() => facts.getFacts(N, NOW));
  check('5 CREDENTIAL REDACTED FROM ERRORS', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: 'no credential substring', ok: r.threw && !r.msg.includes(B64) && !r.msg.includes(SECRET) && r.msg.includes('[REDACTED]') });
}

// 6 THE BEARER TOKEN NEVER SURVIVES EITHER — it is guarded the moment it is
// minted, BEFORE the first request that could echo it back.
{
  const { facts } = mk(() => ({ status: 500, text: `echo of your header: Bearer ${TOKEN}` }));
  const r = await athrew(() => facts.getFacts(N, NOW));
  check('6 BEARER TOKEN REDACTED FROM ERRORS', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: 'no token substring', ok: r.threw && !r.msg.includes(TOKEN) });
}

// 7 THE CLIENT ID NEVER SURVIVES. Not hypothetical: Orange ECHOES the client id
// inside every unknown-number 403, and a 403 body is exactly what a diagnostic
// wants to quote.
{
  const { facts } = mk(() => ({ status: 403, text: C.forbiddenAuth.replace('Request must be authorized', `denied for ${CLIENT_ID}`) }));
  const r = await athrew(() => facts.getFacts(N, NOW));
  check('7 CLIENT ID REDACTED FROM 403 BODY', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: 'no client id substring', ok: r.threw && !r.msg.includes(CLIENT_ID) });
}

// 8 …AND STILL REDACTED WHEN NO CLIENT ID COULD BE DERIVED. If the credential
// is not base64 (someone pastes `id:secret` raw), the known-secret layer has
// nothing to match on — the pattern layer has to carry it alone. This case
// exists so removing that layer cannot pass on case 7's strength.
//
// The status is 500, NOT 403, and that is the whole point. The first version of
// this case used a 403 and was VACUOUS: a body containing "does not exist for"
// routes to the unknown-number branch, whose message is built from the NUMBER
// and never quotes the body at all — so the client id could not have leaked
// however the redactor behaved. Caught by the mutation sweep (deleting the
// pattern layer left the case green). A 500 reaches the branch that DOES quote
// the body, which is the branch the pattern layer exists to protect.
{
  const raw = 'not-base64-at-all-just-a-string';
  const t = transport(() => ({ status: 500, text: `{"message":"+990100000077 does not exist for ${CLIENT_ID}"}` }));
  const facts = createOrangeFacts({ basicAuth: raw, fetchImpl: t.fetchImpl });
  const r = await athrew(() => facts.getFacts(N, NOW));
  check('8 CLIENT ID REDACTED WITH NO DERIVABLE SECRET', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: 'pattern layer alone', ok: r.threw && r.msg.includes('does not exist for [REDACTED]') && !r.msg.includes(CLIENT_ID) });
}

// 9 A DIAGNOSTIC BUILT FROM A RESPONSE BODY IS CLAMPED. M4 measured a 100KB
// reason string from wire input; a response body is the same footgun on the
// operator side, and it lands in logs verbatim.
{
  const { facts } = mk(() => ({ status: 500, text: 'x'.repeat(50000) }));
  const r = await athrew(() => facts.getFacts(N, NOW));
  check('9 ERROR BODY CLAMPED', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: `len=${r.msg.length}`, ok: r.threw && r.msg.length < 400 });
}

// ======================= ERROR CLASSIFICATION ==============================

// 10 403 + "does not exist for" MEANS UNKNOWN NUMBER, and the message says so —
// reading it as an auth failure sends you debugging the wrong thing.
{
  const { facts } = mk((url) => (url.includes('sim-swap') ? { status: 403, text: C.forbiddenUnknown } : { status: 200, text: '{}' }));
  const r = await athrew(() => facts.getFacts(N, NOW));
  checkThrew('10 403 UNKNOWN NUMBER CLASSIFIED', r, names(r, 'unknown number', N, 'not bad auth'));
}

// 11 …BUT A 403 WITHOUT IT IS *NOT* AN UNKNOWN NUMBER. CHANGED at the
// 2026-08-16 re-verification: the recorded finding said every sim-swap 403
// means unknown number. It does not — a request carrying the WRONG SURFACE's
// token answers `403 "Request must be authorized"`. Collapsing the two would
// have the operator hunting a backstory bug over a token bug.
{
  const { facts } = mk((url) => (url.includes('sim-swap') ? { status: 403, text: C.forbiddenAuth } : { status: 200, text: '{}' }));
  const r = await athrew(() => facts.getFacts(N, NOW));
  // Asserted on the CLASSIFICATION, not a loose substring: the unknown-number
  // error is the one that opens `unknown number: <num>`, and this message
  // deliberately contains the words "not an unknown number" in its explanation.
  // A regression routing this 403 to the wrong branch still trips the regex.
  check('11 403 AUTH FAULT NOT MISREAD AS UNKNOWN NUMBER', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: 'classified not-authorized, not unknown-number', ok: r.threw && r.msg.includes('not authorized') && !/^unknown number:/.test(r.msg) });
}

// 12 A 401 REFRESHES THE TOKEN ONCE AND RETRIES — the only signal that a token
// is stale (there is no clock in this module, by design).
{
  let first = true;
  const { facts, calls } = mk((url) => {
    if (url.includes('sim-swap') && first) { first = false; return { status: 401, text: C.unauthenticated }; }
    return reads()(url);
  });
  const r = await athrew(() => facts.getFacts(N, NOW));
  const tokenCalls = calls.filter((c) => c.isToken).length;
  checkOk('12 401 REFRESHES TOKEN AND RETRIES', r,
    { label: `token calls=${tokenCalls}, swapAgeMs present=${r.value && 'swapAgeMs' in r.value}`, ok: !r.threw && tokenCalls === 2 && 'swapAgeMs' in r.value });
}

// 13 A SECOND 401 FAILS LOUD — exactly one retry. Spinning on a credential
// problem turns an auth fault into a quota burn and never recovers.
{
  let tokenCalls = 0;
  const t = transport(() => ({ status: 401, text: C.unauthenticated }));
  const facts = createOrangeFacts({ basicAuth: CRED, fetchImpl: t.fetchImpl });
  const r = await athrew(() => facts.getFacts(N, NOW));
  tokenCalls = t.calls.filter((c) => c.isToken).length;
  check('13 SECOND 401 FAILS LOUD (one retry only)', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: `token calls=${tokenCalls}`, ok: r.threw && tokenCalls === 2 && r.msg.includes('401') });
}

// 14 AN UNEXPECTED STATUS FAILS LOUD AND NAMES IT.
{
  const { facts } = mk(() => ({ status: 503, text: '{"code":"UNAVAILABLE"}' }));
  const r = await athrew(() => facts.getFacts(N, NOW));
  checkThrew('14 UNEXPECTED STATUS FAILS LOUD', r, names(r, '503', 'sim-swap'));
}

// 15 A 200 WITH A NON-JSON BODY FAILS LOUD rather than yielding `undefined`
// facts. `res.json()` would throw a bare SyntaxError naming nothing.
{
  const { facts } = mk((url) => (url.includes('sim-swap') ? { status: 200, text: '<html>maintenance</html>' } : reads()(url)));
  const r = await athrew(() => facts.getFacts(N, NOW));
  checkThrew('15 NON-JSON 200 FAILS LOUD', r, names(r, 'non-JSON', 'sim-swap'));
}

// ============ THE HEADLINE: null MEANS NOT ROAMING, ABSENT MEANS UNKNOWN ====

const factsWith = async (roam) => (await mk(reads({ roam })).facts.getFacts(N, NOW));

// 16 roaming:false → THE KEY IS PRESENT AND null. An honest "not roaming".
{
  const f = await factsWith(C.roamFalse);
  check('16 roaming:false → roamingCountry PRESENT and null', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `present=${'roamingCountry' in f} value=${String(f.roamingCountry)}`, ok: 'roamingCountry' in f && f.roamingCountry === null });
}

// 17 roaming:true + one alpha-2 country → that country.
{
  const f = await factsWith(C.roamFR);
  check('17 roaming:true + ["FR"] → "FR"', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `value=${String(f.roamingCountry)}`, ok: f.roamingCountry === 'FR' });
}

// 18 roaming:true WITH NO COUNTRY → THE KEY IS ABSENT. The measured shape
// (`{"roaming":true}`) and the whole reason the two spellings exist: the
// subscriber IS roaming and the country is UNKNOWN. Mapping it to `null` would
// answer "not roaming in FR" about someone who may be standing in FR.
{
  const f = await factsWith(C.roamNoCountry);
  check('18 roaming:true + NO country → roamingCountry ABSENT', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `present=${'roamingCountry' in f}`, ok: !('roamingCountry' in f) });
}

// 19 A COUNTRY *NAME* IS NOT A COUNTRY CODE → ABSENT. The Playground's own
// BUILT-IN records carry `["Spain"]`; coercing it would put "Spain" where "ES"
// belongs and make every membership test quietly false.
{
  const f = await factsWith(C.roamSpain);
  check('19 countryName ["Spain"] NOT coerced → ABSENT', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `present=${'roamingCountry' in f}`, ok: !('roamingCountry' in f) });
}

// 20 A MULTI-COUNTRY LIST IS AMBIGUOUS → ABSENT. `["FR","MC"]` is producible;
// picking `[0]` would fabricate a single answer out of a genuine ambiguity.
{
  const f = await factsWith(C.roamMulti);
  check('20 countryName ["FR","MC"] ambiguous → ABSENT', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `present=${'roamingCountry' in f}`, ok: !('roamingCountry' in f) });
}

// 21 roaming:false WITH A STALE COUNTRY → null. Producible (measured); the
// `roaming` flag is the authoritative half, so this is "not roaming", not a
// country.
{
  const f = await factsWith(C.roamFalseWithCountry);
  check('21 roaming:false + stale country → null', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `value=${String(f.roamingCountry)}`, ok: 'roamingCountry' in f && f.roamingCountry === null });
}

// 22 THE PAIR, THROUGH M4's UNMODIFIED evaluatePredicate. This is the case the
// whole distinction exists for, and it is asserted at the seam that consumes
// it: `null` yields a real signed answer (`false` — not roaming in FR), ABSENT
// yields a REFUSAL. One conflating adapter turns the refusal into a confident
// "no" about a subscriber whose location is unknown.
{
  const notRoaming = await factsWith(C.roamFalse);
  const unknown = await factsWith(C.roamNoCountry);
  const q = { type: 'roamingIn', operator: 'in', value: ['FR'] };
  const a = evaluatePredicate(notRoaming, q);
  const b = evaluatePredicate(unknown, q);
  check('22 null ANSWERS false, ABSENT REFUSES (M4 evaluatePredicate)', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `null→${a.answered}/${a.result}, absent→${b.answered}/'${b.reason}'`,
      ok: a.answered === true && a.result === false && b.answered === false && b.reason === 'fact unavailable: roamingCountry' });
}

// ============================ reachability =================================

// 23 NOT_CONNECTED → false (a real answer, not an absence).
{
  const f = await mk(reads({ reach: C.reachNone })).facts.getFacts(N, NOW);
  check('23 NOT_CONNECTED → reachable false', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `value=${String(f.reachable)}`, ok: f.reachable === false });
}

// 24 CONNECTED_SMS → true. Both CONNECTED_* spellings are reachable; a table
// missing one would silently report an SMS-reachable subscriber as unknown.
{
  const f = await mk(reads({ reach: C.reachSms })).facts.getFacts(N, NOW);
  check('24 CONNECTED_SMS → reachable true', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `value=${String(f.reachable)}`, ok: f.reachable === true });
}

// 25 AN UNKNOWN STATUS → ABSENT, never a guessed polarity. A new enum value
// added upstream must not silently become `false`.
{
  const f = await mk(reads({ reach: '{"reachabilityStatus":"CONNECTED_SATELLITE"}' })).facts.getFacts(N, NOW);
  check('25 unknown reachability status → ABSENT', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `present=${'reachable' in f}`, ok: !('reachable' in f) });
}

// 26 A PROTOTYPE KEY IS NOT A STATUS. `REACHABLE['constructor']` inherits a
// truthy function from Object.prototype; an unguarded `table[k]` lookup would
// make `reachable` a FUNCTION, which `evaluatePredicate` then refuses — but
// only by luck. Guarded at the source instead.
{
  const f = await mk(reads({ reach: '{"reachabilityStatus":"constructor"}' })).facts.getFacts(N, NOW);
  check('26 prototype key is not a reachability status', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `present=${'reachable' in f}`, ok: !('reachable' in f) });
}

// ============================== swap age ===================================

// 27 THE AGE IS DIFFERENCED AGAINST THE INJECTED CLOCK — the one line M5
// replaces in M4, now doing real work: an absolute ISO instant from Orange
// minus the same `now` the caller supplied.
{
  const swappedAt = NOW - 120 * DAY;
  const { facts } = mk(reads({ swap: JSON.stringify({ latestSimChange: new Date(swappedAt).toISOString() }) }));
  const f = await facts.getFacts(N, NOW);
  check('27 swapAgeMs = injected now − latestSimChange', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `days=${f.swapAgeMs / DAY}`, ok: f.swapAgeMs === 120 * DAY });
}

// 28 AN UNPARSEABLE DATE → ABSENT. `Date.parse('nonsense')` is NaN, and a NaN
// age compares `false` against every floor — a signed "not old enough" about a
// SIM nobody could date.
{
  const f = await mk(reads({ swap: '{"latestSimChange":"not-a-date"}' })).facts.getFacts(N, NOW);
  check('28 unparseable latestSimChange → swapAgeMs ABSENT', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `present=${'swapAgeMs' in f}`, ok: !('swapAgeMs' in f) });
}

// 29 A FUTURE SWAP DATE → ABSENT, never a negative age.
{
  const f = await mk(reads({ swap: JSON.stringify({ latestSimChange: new Date(NOW + 5 * DAY).toISOString() }) })).facts.getFacts(N, NOW);
  check('29 future latestSimChange → swapAgeMs ABSENT', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `present=${'swapAgeMs' in f}`, ok: !('swapAgeMs' in f) });
}

// 30 FACTS ARE FROZEN — an M6 caller mutating them in place would rewrite the
// input to the bit after the fact.
{
  const f = await mk(reads()).facts.getFacts(N, NOW);
  let mutated = false;
  try { f.swapAgeMs = 0; mutated = f.swapAgeMs === 0; } catch { mutated = false; }
  check('30 facts are frozen', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `mutated=${mutated}`, ok: Object.isFrozen(f) && !mutated });
}

// =================== READ-AFTER-WRITE: the module's whole point =============

// 31 THE TRAP. Captured verbatim from the live built-in run: `UPDATE` answered
// `200` echoing the written date back, and the very next `READ` carried the
// built-in's own date instead. A module that trusted the echo would script a
// backstory that never took effect and assert against it happily.
{
  const MARK = new Date(NOW - 120 * DAY).toISOString();
  const { facts } = mk((url, body) => {
    if (body?.action === 'UPDATE') return { status: 200, text: stored({ sim: MARK }) };      // the echo LIES
    if (body?.action === 'READ') return { status: 200, text: stored({ sim: '2020-03-15T10:00:00.000Z' }) }; // the truth
    return { status: 200, text: '{}' };
  });
  const r = await athrew(() => facts.setBackstory(BUILTIN, { swappedDaysAgo: 120, roamingCountry: null, reachable: true }, NOW));
  checkThrew('31 THE TRAP: echoed-but-unstored write FAILS LOUD', r,
    names(r, 'write verification FAILED', 'echoed the write back', 'Built-in numbers'));
}

// 32 THE NEGATIVE CONTROL — the same call against a slot that HONOURS the write
// must SUCCEED. Without this, case 31 would pass on a module that rejected
// every write, and the guard would look load-bearing while proving nothing.
{
  let written = null;
  const { facts } = mk((url, body) => {
    if (body?.action === 'UPDATE') { written = body.data; return { status: 200, text: stored(written) }; }
    if (body?.action === 'READ') return { status: 200, text: stored({ sim: written.simSwap.latestSimChange, roaming: written.roaming, reach: written.reachability.reachabilityStatus }) };
    return { status: 200, text: '{}' };
  });
  const r = await athrew(() => facts.setBackstory(N, { swappedDaysAgo: 120, roamingCountry: 'FR', reachable: false }, NOW));
  checkOk('32 CONTROL: an honoured write VERIFIES', r, { label: 'no throw', ok: !r.threw });
}

// 33 CREATE-IF-MISSING. An unclaimed number answers `400 "PhoneNumber Not
// Found"` to UPDATE; the adapter claims the slot and re-writes rather than
// giving up — and still verifies afterwards.
{
  let created = false; let written = null;
  const { facts, calls } = mk((url, body) => {
    if (body?.action === 'UPDATE' && !created) return { status: 400, text: C.notFound };
    if (body?.action === 'CREATE') { created = true; return { status: 201, text: stored() }; }
    if (body?.action === 'UPDATE') { written = body.data; return { status: 200, text: stored(written) }; }
    if (body?.action === 'READ') return { status: 200, text: stored({ sim: written.simSwap.latestSimChange, roaming: written.roaming, reach: written.reachability.reachabilityStatus }) };
    return { status: 200, text: '{}' };
  });
  const r = await athrew(() => facts.setBackstory(N, { swappedDaysAgo: 30, roamingCountry: null, reachable: true }, NOW));
  const actions = calls.filter((c) => !c.isToken).map((c) => c.body.action).join(',');
  checkOk('33 CREATE-IF-MISSING then write then verify', r, { label: `actions=${actions}`, ok: !r.threw && actions === 'UPDATE,CREATE,UPDATE,READ' });
}

// 34 RELATIVE → ABSOLUTE HAPPENS HERE, and the exact instant goes on the wire.
// This is the M5 boundary: M4's backstory says "120 days ago" forever, and only
// this module turns that into a date — against the INJECTED clock, so the
// payload is identical on any machine in any year.
{
  let sent = null;
  const { facts } = mk((url, body) => {
    if (body?.action === 'UPDATE') { sent = body.data; return { status: 200, text: stored(body.data) }; }
    if (body?.action === 'READ') return { status: 200, text: stored({ sim: sent.simSwap.latestSimChange, roaming: sent.roaming, reach: sent.reachability.reachabilityStatus }) };
    return { status: 200, text: '{}' };
  });
  await facts.setBackstory(N, { swappedDaysAgo: 120, roamingCountry: null, reachable: true }, NOW);
  const want = new Date(NOW - 120 * DAY).toISOString();
  check('34 relative days → absolute ISO at the M5 boundary', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `sent=${sent.simSwap.latestSimChange}`, ok: sent.simSwap.latestSimChange === want });
}

// 35 THE WRITE SHAPE. `null` writes `{roaming:false}`; a country writes
// `{roaming:true, countryName:[C]}` and deliberately NO `countryCode` — the
// Playground's own codes are inconsistent (dialling code for the built-in Spain
// record, MCC for a scripted French one), so writing one would imply a mapping
// this PoC does not have.
{
  const grab = async (roamingCountry) => {
    let sent = null;
    const { facts } = mk((url, body) => {
      if (body?.action === 'UPDATE') { sent = body.data; return { status: 200, text: stored(body.data) }; }
      if (body?.action === 'READ') return { status: 200, text: stored({ sim: sent.simSwap.latestSimChange, roaming: sent.roaming, reach: sent.reachability.reachabilityStatus }) };
      return { status: 200, text: '{}' };
    });
    await facts.setBackstory(N, { swappedDaysAgo: 1, roamingCountry, reachable: true }, NOW);
    return sent.roaming;
  };
  const off = await grab(null);
  const on = await grab('FR');
  check('35 roaming write shape (no countryCode invented)', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `${JSON.stringify(off)} / ${JSON.stringify(on)}`,
      ok: off.roaming === false && !('countryName' in off) && on.roaming === true && on.countryName.length === 1 && on.countryName[0] === 'FR' && !('countryCode' in on) });
}

// ================== operator-side input: every fault is LOUD ================

// 36 A TYPO'D BACKSTORY FIELD THROWS — M4's sharpest trap, replayed at the live
// boundary: a scripted story that silently never took effect.
{
  const { facts } = mk(() => ({ status: 200, text: stored() }));
  const r = await athrew(() => facts.setBackstory(N, { swapedDaysAgo: 120, roamingCountry: null, reachable: true }, NOW));
  checkThrew('36 TYPO\'D BACKSTORY FIELD THROWS', r, names(r, 'unknown field', 'swapedDaysAgo'));
}

// 37 A COERCIBLE swappedDaysAgo THROWS — `'120'` and `null` both arithmetic
// -coerce, and either would write a confident wrong date.
{
  const { facts } = mk(() => ({ status: 200, text: stored() }));
  const r = await athrew(() => facts.setBackstory(N, { swappedDaysAgo: '120', roamingCountry: null, reachable: true }, NOW));
  checkThrew('37 STRING swappedDaysAgo THROWS (no coercion)', r, names(r, 'swappedDaysAgo', 'NOT coerced'));
}

// 38 A LOWERCASE COUNTRY THROWS. `['FR'].includes('fr')` is false, so a
// lowercase country silently answers "not roaming in FR" about someone who is.
{
  const { facts } = mk(() => ({ status: 200, text: stored() }));
  const r = await athrew(() => facts.setBackstory(N, { swappedDaysAgo: 1, roamingCountry: 'fr', reachable: true }, NOW));
  checkThrew('38 LOWERCASE COUNTRY THROWS', r, names(r, 'roamingCountry', 'alpha-2'));
}

// 39 A NON-TEST NUMBER NEVER REACHES ORANGE — the +990 bound, enforced before
// any network call. A real subscriber number must never touch the Playground.
{
  const { facts, calls } = mk(() => ({ status: 200, text: '{}' }));
  const r = await athrew(() => facts.getFacts('+33612345678', NOW));
  checkThrew('39 NON-TEST NUMBER REJECTED BEFORE ANY CALL', r,
    { label: `names +990 test range=${r.threw && r.msg.includes('+990 test range')}, network calls=${calls.length}`,
      ok: r.threw && r.msg.includes('+990 test range') && calls.length === 0 });
}

// 40 AN INVALID CLOCK THROWS — the clock is injected, never read, so a caller
// that forgets it must not silently get "now".
{
  const { facts } = mk(reads());
  const r = await athrew(() => facts.getFacts(N, undefined));
  checkThrew('40 INVALID now THROWS', r, names(r, 'invalid now', 'injected'));
}

// 41 M5 DOES NOT REIMPLEMENT evaluatePredicate. The adapter seam is the point:
// swapping the facts SOURCE must not touch the step that turns facts into the
// bit, because that step is where the profile invariant lives. A second copy
// here is how the two backends would drift apart.
{
  const mod = await import('./m5-facts-orange.mjs');
  const exports = Object.keys(mod).sort().join(',');
  check('41 M5 exports no evaluatePredicate (M4\'s is reused)', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `exports=${exports}`, ok: exports === 'createOrangeFacts' });
}

// ============ 42-44 diagnostics cannot be turned into a weapon ==============
// Added by the security pass on this branch, carrying M4's release-gate lesson
// across rather than re-learning it: an operator-side fault must fail LOUD, and
// a diagnostic that runs caller code cannot promise that.

// 42 A HOSTILE `toString` DOES NOT RUN. M4 measured this exact shape killing
// the process at exit 134 — fatal OOM inside V8, which no try/catch can
// degrade, and a dead process cannot report the fault it died on. The value
// here would allocate ~300MB if any conversion hook were invoked.
{
  const { facts } = mk(reads());
  const bomb = { toString() { return 'x'.repeat(3e8); }, valueOf() { return 'x'.repeat(3e8); } };
  const r = await athrew(() => facts.getFacts(bomb, NOW));
  check('42 hostile toString is never invoked by a diagnostic', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: `len=${r.msg.length}`, ok: r.threw && r.msg.includes('[object]') && r.msg.length < 300 });
}

// 43 A HUGE FIELD NAME IS CLAMPED BEFORE IT IS RENDERED, not after — bounding
// the OUTPUT still serializes the whole input first.
{
  const { facts } = mk(reads());
  const r = await athrew(() => facts.setBackstory(N, { ['k'.repeat(200000)]: 1, swappedDaysAgo: 1, roamingCountry: null, reachable: true }, NOW));
  check('43 huge backstory field name clamped before rendering', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: `len=${r.msg.length}`, ok: r.threw && r.msg.includes('unknown field') && r.msg.length < 300 });
}

// 44 A PROTOTYPE-BORNE AXIS IS REFUSED. Destructuring reads it and would USE
// it, while `Object.keys` never sees it — so the unknown-field check that
// catches a typo'd axis would pass straight over a story set on the prototype.
// M4 measured the mirror image (a prototype-borne axis DROPPED, defaults used);
// either direction is a scripted story that is not the story in force.
{
  const { facts, calls } = mk(reads());
  const proto = { swappedDaysAgo: 999 };
  const r = await athrew(() => facts.setBackstory(N, Object.create(proto, {
    roamingCountry: { value: null, enumerable: true }, reachable: { value: true, enumerable: true },
  }), NOW));
  check('44 prototype-borne backstory axis REFUSED before any write', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: `names plain-object=${r.threw && r.msg.includes('not a plain object')}, network calls=${calls.length}`,
      ok: r.threw && r.msg.includes('not a plain object') && calls.length === 0 });
}

conclude(44);
