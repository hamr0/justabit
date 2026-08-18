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
import { evaluatePredicate, factQuery } from './m4-facts-mock.mjs';
import { makeHarness } from './check-harness.mjs';

const { check, conclude } = makeHarness({ field: 'answered', okWord: 'OK' });

const NOW = Date.UTC(2026, 7, 16);
const DAY = 86400000;
const N = '+990100000099';                                  // the custom slot
const BUILTIN = '+990100000000';

// A SIM-swap question, above the `/check` cap so it exercises the date surface —
// the SAME surface every un-guarded `getFacts(N, NOW)` call below used to reach
// unconditionally, before the SIM axis became conditional (case 59 pins that
// change). Cases probing generic sim-swap error classification / age math need
// SOMETHING that asks the SIM question, or the axis is simply never read.
const SIM_Q = { needSim: true, swapAgeThresholdMs: 365 * DAY };
// The roaming/reachability axis signals, mirroring SIM_Q's role now that both
// are conditional too (closing the 2026-08-18 open design item): a case that
// wants a generic transport/auth/redaction path exercised, or the roaming/
// reachability behaviour itself, needs one of these or `getFacts` makes zero
// live calls at all and never reaches the code under test.
const ROAM_Q = { needRoaming: true };
const REACH_Q = { needReachability: true };

// A SYNTHETIC credential of the real shape (base64 of `clientId:secret`). Never
// the real one — a fixture that needed a secret could not run on a clone.
const CLIENT_ID = 'CLIENTID0000000000000000000000AA';
const SECRET = 'SECRET000000000000000000000000000000000000BB';
const B64 = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64');
const CRED = `Basic ${B64}`;                 // as the credential is actually stored
const TOKEN = 'TOKEN.eyJmYWtlIjoidG9rZW4ifQ.SIGNATURE0000';
const ADMIN_TOKEN = 'ADMINTOKEN.eyJmYWtlIjoiYWRtaW4ifQ.SIGNATURE1111';
const TOKEN_URL_ADMIN = 'https://api.orange.com/oauth/v3/token';

// The reference backstory. `deviceSwappedDaysAgo` joined the closed field set on
// 2026-08-17 (3 -> 6 predicate round) and carries a DIFFERENT day count from the
// SIM axis, so a write or read that confuses the two cannot pass.
const PARIS = Object.freeze({ lat: 48.8566, long: 2.3522 });
const REGISTERED = 'Alice Arnaud';                          // the Playground's own stored name
const STORY = { swappedDaysAgo: 120, deviceSwappedDaysAgo: 200, roamingCountry: null, reachable: true, location: PARIS, registeredName: REGISTERED };

// ==================== CAPTURED responses (verbatim, 2026-08-16) =============
// Only the client id inside the 403 body is substituted for the synthetic one;
// every other byte is as received.
const C = Object.freeze({
  token: `{"token_type":"Bearer","access_token":"${TOKEN}","expires_in":3600,"scope":"openid"}`,
  // The ADMIN surface's token is a DIFFERENT string, because the two token
  // endpoints are not interchangeable (measured 2026-08-16: the CAMARA token is
  // refused by the Admin API with `401 UNAUTHENTICATED`, and the Admin token by
  // sim-swap with `403 "Request must be authorized"`). A replay that answered
  // both endpoints with the SAME token could not tell a per-surface cache from
  // a shared one — see case 47.
  tokenAdmin: `{"token_type":"Bearer","access_token":"${ADMIN_TOKEN}","expires_in":3600,"scope":"admin"}`,
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
  // CAPTURED 2026-08-17 (standalone Playground sweep, findings log). The two
  // `/check` surfaces answer a BOOLEAN about a `maxAge` window in HOURS, capped
  // at 2400 — boundary-tested on both (2400 -> 200, 2401 -> 400). The device
  // date surface answers `latestDeviceChange`, a different field name from
  // sim-swap's, which is why the axis table carries the field rather than
  // assuming one.
  checkNotSwapped: '{"swapped":false}',
  checkSwapped: '{"swapped":true}',
  deviceDate: '{"latestDeviceChange":"2026-08-11T04:00:16.516Z"}',
  checkMaxAge: '{"status":400,"code":"INVALID_ARGUMENT","message":"\"maxAge\" must be less than or equal to 2400"}',
  malformedBasic: '{"error":"invalid_client","error_description":"Basic authentication is malformed"}',
});

// A stored Admin dataset, as READ returns it. Unlike `C` above this is
// CONSTRUCTED, not captured: the seven-key SHAPE is the measured one
// (`location, reachability, roaming, simSwap, deviceSwap, tenure, kyc`) and the
// three axes M5 reads carry real captured values, but the filler in the four
// axes M5 never touches is arbitrary — `kyc.name` here is not the built-in
// record's own value. Said explicitly so the "captured verbatim" claim above is
// not over-read to cover this helper.
// The observation instant, availability flag and radius the Admin store
// REQUIRES beside a position — MEASURED 2026-08-17 by a live convergence probe
// (`+990100000099`): round 1 needed `lastLocationTime`, round 2 needed
// `available`, round 3 (all five fields present) converged 200 OK and read back
// intact. `lastLocationTime` is the injected clock itself, so the default stored
// dataset below mirrors what an honouring slot would hold — and a case that
// wants some OTHER axis to mismatch is not derailed by this one.
const NOW_ISO = new Date(NOW).toISOString();
const LOCATION_RADIUS_M = 500;
const stored = ({ sim = '2026-04-01T12:00:00.000Z', device = '2026-08-11T04:00:16.516Z', roaming = { roaming: false }, reach = 'CONNECTED_DATA', geo = { latitude: PARIS.lat, longitude: PARIS.long, lastLocationTime: NOW_ISO, available: true, radius: LOCATION_RADIUS_M }, kyc = { name: REGISTERED } } = {}) =>
  JSON.stringify({ data: { location: geo, reachability: { reachabilityStatus: reach }, roaming, simSwap: { latestSimChange: sim }, deviceSwap: { latestDeviceChange: device }, tenure: { contractType: 'PAYM' }, kyc } });

// The stored dataset that MIRRORS a write, i.e. the READ an honouring slot
// answers with. Written as one helper because the write-verification now covers
// FOUR axes (deviceSwap joined on 2026-08-17) and a route that mirrored three of
// them would fail verification for a reason that has nothing to do with the case.
const mirror = (data) => stored({
  sim: data.simSwap.latestSimChange,
  device: data.deviceSwap.latestDeviceChange,
  roaming: data.roaming,
  reach: data.reachability.reachabilityStatus,
  geo: data.location,
  kyc: data.kyc,
});

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
    // Each token endpoint answers with ITS OWN token, so a case can prove the
    // adapter keeps one per surface rather than sharing one across both.
    const r = isToken
      ? { status: 200, text: String(url) === TOKEN_URL_ADMIN ? C.tokenAdmin : C.token }
      : route(url, body, calls.length - 1, rec);
    return { status: r.status, text: async () => r.text };
  };
  return { fetchImpl, calls };
}
// The default happy route: every CAMARA read answers, admin READ mirrors the
// last write. Cases override only the piece they are about.
const reads = ({ swap = C.swap, roam = C.roamFalse, reach = C.reachData,
  swapCheck = C.checkNotSwapped, deviceDate = C.deviceDate, deviceCheck = C.checkSwapped } = {}) => (url) => {
  // The `/check` route is matched BEFORE the date route: both urls contain the
  // API name, so an order-insensitive match would answer a `/check` call with a
  // date body and the axis would silently go absent.
  if (url.includes('sim-swap/v1/check')) return { status: 200, text: swapCheck };
  if (url.includes('sim-swap')) return { status: 200, text: swap };
  if (url.includes('device-swap/v1/check')) return { status: 200, text: deviceCheck };
  if (url.includes('device-swap')) return { status: 200, text: deviceDate };
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
// A reachability question is asked explicitly (REACH_Q), since that axis is
// now conditional too (closing the 2026-08-18 open design item) — with no
// query at all `getFacts` would make zero live calls and never mint a header.
{
  const { facts, calls } = mk(reads());
  await facts.getFacts(N, NOW, REACH_Q);
  const auth = calls.find((c) => c.isToken)?.auth;
  check('3 BASIC PREFIX NORMALIZED (not doubled)', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `header=${auth === `Basic ${B64}`}`, ok: auth === `Basic ${B64}` });
}

// 4 A REJECTED CREDENTIAL FAILS LOUD, AND SAYS WHICH KNOB TO TURN. A
// reachability question is asked explicitly (REACH_Q) for the same reason
// case 3 does — see there.
{
  const bad = createOrangeFacts({ basicAuth: CRED, fetchImpl: async () => ({ status: 401, text: async () => C.malformedBasic }) });
  const r = await athrew(() => bad.getFacts(N, NOW, REACH_Q));
  checkThrew('4 REJECTED CREDENTIAL FAILS LOUD', r, names(r, 'token rejected', 'ORANGE_BASIC_AUTH'));
}

// ===================== REDACTION: nothing secret can be printed =============

// 5 THE CREDENTIAL NEVER SURVIVES INTO A MESSAGE. The probe is the realistic
// one: a server that echoes the request back. Without the secret set, the whole
// credential rides into the throw and from there into any log. A reachability
// question is asked explicitly (REACH_Q) for the same reason case 3 does.
{
  const { facts } = mk(() => ({ status: 500, text: `upstream said: ${B64} and ${CRED}` }));
  const r = await athrew(() => facts.getFacts(N, NOW, REACH_Q));
  check('5 CREDENTIAL REDACTED FROM ERRORS', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: 'no credential substring', ok: r.threw && !r.msg.includes(B64) && !r.msg.includes(SECRET) && r.msg.includes('[REDACTED]') });
}

// 6 THE BEARER TOKEN NEVER SURVIVES EITHER — it is guarded the moment it is
// minted, BEFORE the first request that could echo it back. A reachability
// question is asked explicitly (REACH_Q) for the same reason case 3 does.
{
  const { facts } = mk(() => ({ status: 500, text: `echo of your header: Bearer ${TOKEN}` }));
  const r = await athrew(() => facts.getFacts(N, NOW, REACH_Q));
  check('6 BEARER TOKEN REDACTED FROM ERRORS', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: 'no token substring', ok: r.threw && !r.msg.includes(TOKEN) });
}

// 7 THE CLIENT ID NEVER SURVIVES. Not hypothetical: Orange ECHOES the client id
// inside every unknown-number 403, and a 403 body is exactly what a diagnostic
// wants to quote. A reachability question is asked explicitly (REACH_Q) for
// the same reason case 3 does.
{
  const { facts } = mk(() => ({ status: 403, text: C.forbiddenAuth.replace('Request must be authorized', `denied for ${CLIENT_ID}`) }));
  const r = await athrew(() => facts.getFacts(N, NOW, REACH_Q));
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
// the body, which is the branch the pattern layer exists to protect. A
// reachability question is asked explicitly (REACH_Q) for the same reason
// case 3 does.
{
  const raw = 'not-base64-at-all-just-a-string';
  const t = transport(() => ({ status: 500, text: `{"message":"+990100000077 does not exist for ${CLIENT_ID}"}` }));
  const facts = createOrangeFacts({ basicAuth: raw, fetchImpl: t.fetchImpl });
  const r = await athrew(() => facts.getFacts(N, NOW, REACH_Q));
  check('8 CLIENT ID REDACTED WITH NO DERIVABLE SECRET', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: 'pattern layer alone', ok: r.threw && r.msg.includes('does not exist for [REDACTED]') && !r.msg.includes(CLIENT_ID) });
}

// 9 A DIAGNOSTIC BUILT FROM A RESPONSE BODY IS CLAMPED. M4 measured a 100KB
// reason string from wire input; a response body is the same footgun on the
// operator side, and it lands in logs verbatim. A reachability question is
// asked explicitly (REACH_Q) for the same reason case 3 does.
{
  const { facts } = mk(() => ({ status: 500, text: 'x'.repeat(50000) }));
  const r = await athrew(() => facts.getFacts(N, NOW, REACH_Q));
  check('9 ERROR BODY CLAMPED', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: `len=${r.msg.length}`, ok: r.threw && r.msg.length < 400 });
}

// ======================= ERROR CLASSIFICATION ==============================

// 10 403 + "does not exist for" MEANS UNKNOWN NUMBER, and the message says so —
// reading it as an auth failure sends you debugging the wrong thing. A SIM
// question is asked explicitly (SIM_Q) since the axis is conditional (case 59).
{
  const { facts } = mk((url) => (url.includes('sim-swap') ? { status: 403, text: C.forbiddenUnknown } : { status: 200, text: '{}' }));
  const r = await athrew(() => facts.getFacts(N, NOW, SIM_Q));
  checkThrew('10 403 UNKNOWN NUMBER CLASSIFIED', r, names(r, 'unknown number', N, 'not bad auth'));
}

// 11 …BUT A 403 WITHOUT IT IS *NOT* AN UNKNOWN NUMBER. CHANGED at the
// 2026-08-16 re-verification: the recorded finding said every sim-swap 403
// means unknown number. It does not — a request carrying the WRONG SURFACE's
// token answers `403 "Request must be authorized"`. Collapsing the two would
// have the operator hunting a backstory bug over a token bug. A SIM question is
// asked explicitly (SIM_Q) since the axis is conditional (case 59).
{
  const { facts } = mk((url) => (url.includes('sim-swap') ? { status: 403, text: C.forbiddenAuth } : { status: 200, text: '{}' }));
  const r = await athrew(() => facts.getFacts(N, NOW, SIM_Q));
  // Asserted on the CLASSIFICATION, not a loose substring: the unknown-number
  // error is the one that opens `unknown number: <num>`, and this message
  // deliberately contains the words "not an unknown number" in its explanation.
  // A regression routing this 403 to the wrong branch still trips the regex.
  check('11 403 AUTH FAULT NOT MISREAD AS UNKNOWN NUMBER', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: 'classified not-authorized, not unknown-number', ok: r.threw && r.msg.includes('not authorized') && !/^unknown number:/.test(r.msg) });
}

// 12 A 401 REFRESHES THE TOKEN ONCE AND RETRIES — the only signal that a token
// is stale (there is no clock in this module, by design). A SIM question is
// asked explicitly (SIM_Q) since the axis is conditional (case 59).
{
  let first = true;
  const { facts, calls } = mk((url) => {
    if (url.includes('sim-swap') && first) { first = false; return { status: 401, text: C.unauthenticated }; }
    return reads()(url);
  });
  const r = await athrew(() => facts.getFacts(N, NOW, SIM_Q));
  const tokenCalls = calls.filter((c) => c.isToken).length;
  checkOk('12 401 REFRESHES TOKEN AND RETRIES', r,
    { label: `token calls=${tokenCalls}, swapAgeMs present=${r.value && 'swapAgeMs' in r.value}`, ok: !r.threw && tokenCalls === 2 && 'swapAgeMs' in r.value });
}

// 13 A SECOND 401 FAILS LOUD — exactly one retry. Spinning on a credential
// problem turns an auth fault into a quota burn and never recovers. A
// reachability question is asked explicitly (REACH_Q) for the same reason
// case 3 does.
{
  let tokenCalls = 0;
  const t = transport(() => ({ status: 401, text: C.unauthenticated }));
  const facts = createOrangeFacts({ basicAuth: CRED, fetchImpl: t.fetchImpl });
  const r = await athrew(() => facts.getFacts(N, NOW, REACH_Q));
  tokenCalls = t.calls.filter((c) => c.isToken).length;
  check('13 SECOND 401 FAILS LOUD (one retry only)', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: `token calls=${tokenCalls}`, ok: r.threw && tokenCalls === 2 && r.msg.includes('401') });
}

// 14 AN UNEXPECTED STATUS FAILS LOUD AND NAMES IT. A SIM question is asked
// explicitly (SIM_Q) since the axis is conditional (case 59) — the 503 hits
// the first live call this transport makes either way (the token endpoint is
// unaffected, so this stays a general request-path assertion).
{
  const { facts } = mk(() => ({ status: 503, text: '{"code":"UNAVAILABLE"}' }));
  const r = await athrew(() => facts.getFacts(N, NOW, SIM_Q));
  checkThrew('14 UNEXPECTED STATUS FAILS LOUD', r, names(r, '503', 'sim-swap'));
}

// 15 A 200 WITH A NON-JSON BODY FAILS LOUD rather than yielding `undefined`
// facts. `res.json()` would throw a bare SyntaxError naming nothing. A SIM
// question is asked explicitly (SIM_Q) since the axis is conditional (case 59).
{
  const { facts } = mk((url) => (url.includes('sim-swap') ? { status: 200, text: '<html>maintenance</html>' } : reads()(url)));
  const r = await athrew(() => facts.getFacts(N, NOW, SIM_Q));
  checkThrew('15 NON-JSON 200 FAILS LOUD', r, names(r, 'non-JSON', 'sim-swap'));
}

// ============ THE HEADLINE: null MEANS NOT ROAMING, ABSENT MEANS UNKNOWN ====

// ROAM_Q is required now that the roaming axis is conditional too (closing the
// 2026-08-18 open design item) — without it `getFacts` never reads the axis
// this helper exists to exercise, and every case below would pass vacuously
// on an always-absent `roamingCountry` instead of on the scripted response.
const factsWith = async (roam) => (await mk(reads({ roam })).facts.getFacts(N, NOW, ROAM_Q));

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

// REACH_Q is required now that the reachability axis is conditional too
// (closing the 2026-08-18 open design item) — without it `getFacts` never
// reads the axis these four cases exist to exercise, and each would pass
// vacuously on an always-absent `reachable` instead of on the scripted
// response.

// 23 NOT_CONNECTED → false (a real answer, not an absence).
{
  const f = await mk(reads({ reach: C.reachNone })).facts.getFacts(N, NOW, REACH_Q);
  check('23 NOT_CONNECTED → reachable false', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `value=${String(f.reachable)}`, ok: f.reachable === false });
}

// 24 CONNECTED_SMS → true. Both CONNECTED_* spellings are reachable; a table
// missing one would silently report an SMS-reachable subscriber as unknown.
{
  const f = await mk(reads({ reach: C.reachSms })).facts.getFacts(N, NOW, REACH_Q);
  check('24 CONNECTED_SMS → reachable true', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `value=${String(f.reachable)}`, ok: f.reachable === true });
}

// 25 AN UNKNOWN STATUS → ABSENT, never a guessed polarity. A new enum value
// added upstream must not silently become `false`.
{
  const f = await mk(reads({ reach: '{"reachabilityStatus":"CONNECTED_SATELLITE"}' })).facts.getFacts(N, NOW, REACH_Q);
  check('25 unknown reachability status → ABSENT', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `present=${'reachable' in f}`, ok: !('reachable' in f) });
}

// 26 A PROTOTYPE KEY IS NOT A STATUS. `REACHABLE['constructor']` inherits a
// truthy function from Object.prototype; an unguarded `table[k]` lookup would
// make `reachable` a FUNCTION, which `evaluatePredicate` then refuses — but
// only by luck. Guarded at the source instead.
{
  const f = await mk(reads({ reach: '{"reachabilityStatus":"constructor"}' })).facts.getFacts(N, NOW, REACH_Q);
  check('26 prototype key is not a reachability status', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `present=${'reachable' in f}`, ok: !('reachable' in f) });
}

// ============================== swap age ===================================

// 27 THE AGE IS DIFFERENCED AGAINST THE INJECTED CLOCK — the one line M5
// replaces in M4, now doing real work: an absolute ISO instant from Orange
// minus the same `now` the caller supplied. A SIM question is asked explicitly
// (SIM_Q) since the axis is conditional (case 59).
{
  const swappedAt = NOW - 120 * DAY;
  const { facts } = mk(reads({ swap: JSON.stringify({ latestSimChange: new Date(swappedAt).toISOString() }) }));
  const f = await facts.getFacts(N, NOW, SIM_Q);
  check('27 swapAgeMs = injected now − latestSimChange', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `days=${f.swapAgeMs / DAY}`, ok: f.swapAgeMs === 120 * DAY });
}

// 28 AN UNPARSEABLE DATE → ABSENT. `Date.parse('nonsense')` is NaN, and a NaN
// age compares `false` against every floor — a signed "not old enough" about a
// SIM nobody could date. A SIM question is asked explicitly (SIM_Q) since the
// axis is conditional (case 59) — without it the axis is simply never read,
// which would make this case pass VACUOUSLY rather than for the reason it names.
{
  const f = await mk(reads({ swap: '{"latestSimChange":"not-a-date"}' })).facts.getFacts(N, NOW, SIM_Q);
  check('28 unparseable latestSimChange → swapAgeMs ABSENT', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `present=${'swapAgeMs' in f}`, ok: !('swapAgeMs' in f) });
}

// 29 A FUTURE SWAP DATE → ABSENT, never a negative age. A SIM question is asked
// explicitly (SIM_Q) since the axis is conditional (case 59) — same vacuous-pass
// risk as case 28.
{
  const f = await mk(reads({ swap: JSON.stringify({ latestSimChange: new Date(NOW + 5 * DAY).toISOString() }) })).facts.getFacts(N, NOW, SIM_Q);
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
  const r = await athrew(() => facts.setBackstory(BUILTIN, { ...STORY }, NOW));
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
    if (body?.action === 'READ') return { status: 200, text: mirror(written) };
    return { status: 200, text: '{}' };
  });
  const r = await athrew(() => facts.setBackstory(N, { ...STORY, roamingCountry: 'FR', reachable: false }, NOW));
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
    if (body?.action === 'READ') return { status: 200, text: mirror(written) };
    return { status: 200, text: '{}' };
  });
  const r = await athrew(() => facts.setBackstory(N, { ...STORY, swappedDaysAgo: 30 }, NOW));
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
    if (body?.action === 'READ') return { status: 200, text: mirror(sent) };
    return { status: 200, text: '{}' };
  });
  await facts.setBackstory(N, { ...STORY }, NOW);
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
      if (body?.action === 'READ') return { status: 200, text: mirror(sent) };
      return { status: 200, text: '{}' };
    });
    await facts.setBackstory(N, { ...STORY, swappedDaysAgo: 1, roamingCountry }, NOW);
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
  const r = await athrew(() => facts.setBackstory(N, { ...STORY, swapedDaysAgo: 120 }, NOW));
  checkThrew('36 TYPO\'D BACKSTORY FIELD THROWS', r, names(r, 'unknown field', 'swapedDaysAgo'));
}

// 37 A COERCIBLE swappedDaysAgo THROWS — `'120'` and `null` both arithmetic
// -coerce, and either would write a confident wrong date.
{
  const { facts } = mk(() => ({ status: 200, text: stored() }));
  const r = await athrew(() => facts.setBackstory(N, { ...STORY, swappedDaysAgo: '120' }, NOW));
  checkThrew('37 STRING swappedDaysAgo THROWS (no coercion)', r, names(r, 'swappedDaysAgo', 'NOT coerced'));
}

// 38 A LOWERCASE COUNTRY THROWS. `['FR'].includes('fr')` is false, so a
// lowercase country silently answers "not roaming in FR" about someone who is.
{
  const { facts } = mk(() => ({ status: 200, text: stored() }));
  const r = await athrew(() => facts.setBackstory(N, { ...STORY, roamingCountry: 'fr' }, NOW));
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

// ====== 45-47 added by the 2026-08-16 adversarial review round ==============
// 45 and 46 close a defect an independent 30-case check found on ONE line — the
// write-verification diagnostic, which is the message the module's most
// load-bearing guard produces. 47 closes a required mutant the 44-case suite
// could not kill.

// 45 THE WRITE-VERIFY DIAGNOSTIC REDACTS. Every other throw in the module runs
// its wire text through `redact()`; this one quoted the STORED value verbatim,
// so a secret echoed back inside an Admin READ body rode straight into the
// error — and this is the one error a demo run is most likely to print. Rule 3
// of the module header says the credential, every token and the client id never
// reach a string this module can print or throw; before this case, exactly one
// path broke it. The stored value here is a real member of the redactor's known
// set (the credential's own secret half).
{
  const { facts } = mk((url, body) => {
    if (body?.action === 'UPDATE') return { status: 200, text: stored({ sim: SECRET }) };
    if (body?.action === 'READ') return { status: 200, text: stored({ sim: SECRET }) };
    return { status: 200, text: '{}' };
  });
  const r = await athrew(() => facts.setBackstory(N, { ...STORY, swappedDaysAgo: 1 }, NOW));
  check('45 WRITE-VERIFY DIAGNOSTIC REDACTS THE STORED VALUE', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: `no secret substring=${r.threw && !r.msg.includes(SECRET)}`,
      ok: r.threw && r.msg.includes('write verification FAILED') && !r.msg.includes(SECRET) && r.msg.includes('[REDACTED]') });
}

// 46 …AND CLAMPS BEFORE IT RENDERS, exactly as case 43 requires of the other
// diagnostics. The old line was `JSON.stringify(String(v)).slice(0, 60)`, which
// serializes the WHOLE stored value and only then bounds the output: measured
// 2354ms on a 2e8-char value, and a RangeError ("Invalid string length") at
// V8's max string length — which replaced this loud, actionable message with an
// opaque one at precisely the moment the operator needs it.
//
// The assertion is on the RENDERED SHAPE, not on elapsed time, so it is
// deterministic rather than a timing race: `brief()` bounds first and therefore
// always emits a properly closed, ellipsis-terminated string (`…"`), while a
// clamp-AFTER regression emits a string sliced off mid-value with no closing
// quote at all.
{
  const huge = 'z'.repeat(1e7);
  const { facts } = mk((url, body) => {
    if (body?.action === 'UPDATE') return { status: 200, text: stored({ sim: huge }) };
    if (body?.action === 'READ') return { status: 200, text: stored({ sim: huge }) };
    return { status: 200, text: '{}' };
  });
  const t0 = Date.now();
  const r = await athrew(() => facts.setBackstory(N, { ...STORY, swappedDaysAgo: 1 }, NOW));
  const ms = Date.now() - t0;
  check('46 WRITE-VERIFY DIAGNOSTIC CLAMPED BEFORE RENDERING', false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: `len=${r.msg.length} ms=${ms} closed-and-elided=${r.threw && r.msg.includes('…"')}`,
      ok: r.threw && r.msg.includes('write verification FAILED') && r.msg.includes('…"') && r.msg.length < 500 });
}

// 47 ONE TOKEN PER SURFACE — never a shared one. The two token endpoints are
// NOT interchangeable (measured 2026-08-16: the CAMARA token on the Admin API
// answers `401 UNAUTHENTICATED`, the Admin token on sim-swap answers `403
// "Request must be authorized"`), so a cache that handed either surface
// whichever token was minted FIRST would break whichever call happened to come
// second — and the failure would surface as an auth fault far from its cause.
// One adapter instance drives BOTH surfaces here, which is the only arrangement
// that can tell a per-surface cache from a shared one. A reachability question
// is asked explicitly (REACH_Q) since that axis is conditional too (closing
// the 2026-08-18 open design item) — without it the camara surface would
// never be reached at all and this case would be checking nothing on that side.
{
  let written = null;
  const { facts, calls } = mk((url, body) => {
    if (body?.action === 'UPDATE') { written = body.data; return { status: 200, text: stored(written) }; }
    if (body?.action === 'READ') return { status: 200, text: mirror(written) };
    return reads()(url);
  });
  await facts.setBackstory(N, { ...STORY, swappedDaysAgo: 1 }, NOW);  // admin surface
  await facts.getFacts(N, NOW, REACH_Q);                                                            // camara surface
  const adminCalls = calls.filter((c) => !c.isToken && c.url.includes('/admin/'));
  const camaraCalls = calls.filter((c) => !c.isToken && c.url.includes('/playground/api/'));
  const adminOk = adminCalls.length > 0 && adminCalls.every((c) => c.auth === `Bearer ${ADMIN_TOKEN}`);
  const camaraOk = camaraCalls.length > 0 && camaraCalls.every((c) => c.auth === `Bearer ${TOKEN}`);
  check('47 ONE TOKEN PER SURFACE (never shared across surfaces)', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `admin ${adminCalls.length} calls all admin-token=${adminOk}, camara ${camaraCalls.length} calls all camara-token=${camaraOk}`,
      ok: adminOk && camaraOk });
}

// 48 THE STORED COUNTRY LIST IS JOINED WITHOUT COERCING IT. Added at the v0.3.0
// release gate, and a direct sibling of 45/46: those closed the RENDER of the
// write-verify diagnostic, this closes the line that BUILDS the value it
// renders. `Array.prototype.join` calls `String()` on every element, so a
// JSON-parsed `{"toString":"x"}` inside the stored `countryName` threw a bare
// `TypeError: Cannot convert object to primitive value` from `got`'s
// construction — BEFORE the comparison loop, so the loud message never ran at
// all. Measured pre-fix: 40 chars, no "write verification FAILED"; the same
// mismatch reached through a benign element gave 418. That is the module's most
// load-bearing guard replaced by an opaque error at the moment it matters.
//
// The four legs matter together: a hostile element must still FAIL LOUD and
// render as its kind, a benign mismatching element must still produce the loud
// message AND name its value (a guard that broke the rendering of `'Spain'`
// would be worse than the bug), a legitimate one-element list must still
// COMPARE EQUAL (a guard that broke `["FR"] === "FR"` likewise), and an
// over-long list must be bounded rather than walked.
{
  const sim = new Date(NOW - 1 * DAY).toISOString();
  // The device axis has to MATCH, or the verification loop stops on it and the
  // country leg — the subject of this case — is never reached.
  const device = new Date(NOW - STORY.deviceSwappedDaysAgo * DAY).toISOString();
  const mkCountry = (countryName) => mk((url, body) => {
    const s = stored({ sim, device, roaming: { roaming: true, countryName }, reach: 'CONNECTED_DATA' });
    if (body?.action === 'UPDATE' || body?.action === 'READ') return { status: 200, text: s };
    return { status: 200, text: '{}' };
  }).facts;

  const hostile = await athrew(() => mkCountry([JSON.parse('{"toString":"x"}')])
    .setBackstory(N, { ...STORY, swappedDaysAgo: 1, roamingCountry: 'FR' }, NOW));
  const benign = await athrew(() => mkCountry(['Spain'])
    .setBackstory(N, { ...STORY, swappedDaysAgo: 1, roamingCountry: 'FR' }, NOW));
  const equal = await athrew(() => mkCountry(['FR'])
    .setBackstory(N, { ...STORY, swappedDaysAgo: 1, roamingCountry: 'FR' }, NOW));
  const many = await athrew(() => mkCountry(Array.from({ length: 5000 }, () => 'FR'))
    .setBackstory(N, { ...STORY, swappedDaysAgo: 1, roamingCountry: 'FR' }, NOW));

  const loud = (r) => r.threw && r.msg.includes('write verification FAILED');
  check('48 STORED COUNTRY LIST JOINED WITHOUT COERCION', false,
    { answered: !hostile.threw, reason: hostile.threw ? 'threw' : 'did not throw' }, 'threw',
    { label: `hostile renders as kind=${loud(hostile) && hostile.msg.includes('[object]')}, `
      + `benign loud=${loud(benign)}, legit ["FR"] still matches=${!equal.threw}, `
      + `5000 elements bounded=${loud(many) && many.msg.length < 500}`,
      ok: loud(hostile) && hostile.msg.includes('[object]')
        && loud(benign) && benign.msg.includes('Spain')
        && !equal.threw
        && loud(many) && many.msg.length < 500 });
}

// ========= 2026-08-17: the 3 -> 6 predicate round, sim/device swap surfaces ====
// `/check` was measured to EXIST and answer on both sim-swap and device-swap, with
// `maxAge` in HOURS capped at 2400 (boundary-tested 2400 -> 200, 2401 -> 400). It
// is the profile-conforming surface — a bit about a window, and the operator never
// learns the date — so the adapter uses it wherever the asked bucket fits and
// falls back to the date surface only above the cap.

// 49 THE SURFACE IS CHOSEN FROM THE MEASURED CAP, PER BUCKET. This is the case
// that can actually red: it reads which URL went on the wire for each published
// bucket, and what `maxAge` rode with it. P30D and P90D fit under 2400 hours;
// P180D and P365D cannot be expressed by `/check` AT ALL, so asking it anyway —
// or rounding down to a window it can express — would answer a question nobody
// asked, signed. The control is the no-threshold call: with no bucket named,
// the SIM axis is not read AT ALL (case 59 pins that change) — there is no
// surface to choose between when nobody asked the question.
{
  const buckets = [[30, 'check', 720], [90, 'check', 2160], [180, 'date', null], [365, 'date', null]];
  const seen = [];
  for (const [days] of buckets) {
    const { facts, calls } = mk(reads());
    await facts.getFacts(N, NOW, { needSim: true, swapAgeThresholdMs: days * DAY });
    const c = calls.filter((x) => !x.isToken && x.url.includes('sim-swap'));
    seen.push({ surface: c[0].url.endsWith('/check') ? 'check' : 'date', maxAge: c[0].body.maxAge ?? null, n: c.length });
  }
  const { facts: plain, calls: plainCalls } = mk(reads());
  await plain.getFacts(N, NOW);
  const noThresholdCalls = plainCalls.filter((x) => !x.isToken && x.url.includes('sim-swap')).length;
  check('49 /check UNDER THE MEASURED CAP, THE DATE SURFACE ABOVE IT', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `P30D/P90D/P180D/P365D -> ${JSON.stringify(seen.map((x) => `${x.surface}${x.maxAge ? `:${x.maxAge}h` : ''}`))}; `
      + `no threshold -> ${noThresholdCalls} sim-swap calls`,
      ok: seen.every((x, i) => x.surface === buckets[i][1] && x.maxAge === buckets[i][2] && x.n === 1)
        && seen.every((x) => x.maxAge === null || x.maxAge <= 2400)
        && noThresholdCalls === 0 });
}

// 50 THE `/check` POLARITY, BOTH WAYS, AND NO COERCION. `swapped:false` means NOT
// swapped inside the window, i.e. the age is AT LEAST the window — the negation is
// the entire mapping, and a flipped one is a silent wrong answer that looks
// perfectly well-formed on the wire. The third leg is the measured coercion trap:
// the STRING `"false"` is truthy, so an unguarded read would report "swapped
// recently" for a subscriber who was not; it leaves the axis ABSENT instead.
{
  const ask = async (text) => {
    const { facts } = mk(reads({ swapCheck: text }));
    return facts.getFacts(N, NOW, { needSim: true, swapAgeThresholdMs: 90 * DAY });
  };
  const notSwapped = await ask(C.checkNotSwapped);
  const swapped = await ask(C.checkSwapped);
  const stringy = await ask('{"swapped":"false"}');
  const missing = await ask('{}');
  check('50 /check POLARITY AND NO COERCION', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `swapped:false -> atLeast ${notSwapped.swapAgeAtLeast}, swapped:true -> ${swapped.swapAgeAtLeast}, `
      + `"false" -> present=${'swapAgeAtLeast' in stringy}, {} -> present=${'swapAgeAtLeast' in missing}`,
      ok: notSwapped.swapAgeAtLeast === true && notSwapped.swapAgeAtLeastMs === 90 * DAY
        && swapped.swapAgeAtLeast === false && swapped.swapAgeAtLeastMs === 90 * DAY
        && !('swapAgeMs' in notSwapped)
        && !('swapAgeAtLeast' in stringy) && !('swapAgeAtLeastMs' in stringy)
        && !('swapAgeAtLeast' in missing) });
}

// 51 THE DEVICE AXIS IS READ ONLY WHEN A DEVICE QUESTION WAS ASKED, and it reads
// its OWN field name. Two things pinned together. The conditional read is not an
// optimisation: every read is a metered live call about one subscriber, so reading
// a fact nobody asked about is an operator query with no question behind it. And
// `latestDeviceChange` is a DIFFERENT field from sim-swap's `latestSimChange` — a
// table that reused the sim field would leave the axis absent, which reads as
// "unavailable" rather than as the bug it is.
{
  const { facts: quiet, calls: quietCalls } = mk(reads());
  await quiet.getFacts(N, NOW, { needSim: true, swapAgeThresholdMs: 90 * DAY });
  const { facts: asked, calls: askedCalls } = mk(reads());
  const f = await asked.getFacts(N, NOW, { needDevice: true, deviceSwapAgeThresholdMs: 365 * DAY });
  const deviceCalls = (cs) => cs.filter((x) => !x.isToken && x.url.includes('device-swap')).length;
  const wantAge = NOW - Date.parse(JSON.parse(C.deviceDate).latestDeviceChange);
  check('51 THE DEVICE AXIS IS READ ONLY WHEN ASKED', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `sim-only question -> ${deviceCalls(quietCalls)} device calls; device question -> ${deviceCalls(askedCalls)}; deviceSwapAgeMs=${f.deviceSwapAgeMs}`,
      ok: deviceCalls(quietCalls) === 0 && deviceCalls(askedCalls) === 1 && f.deviceSwapAgeMs === wantAge });
}

// 52 THE DEVICE WRITE IS VERIFIED LIKE EVERY OTHER AXIS. `deviceSwap`'s Admin
// write shape moved from ASSUMED to MEASURED-GOOD on 2026-08-17 (a live
// convergence probe read it back verbatim after a converged write — see the
// comment at `data` in m5-facts-orange.mjs), but the read-after-write guard stays
// wired regardless: a slot that stores it verifies, and a slot that echoes it
// back WITHOUT storing it fails LOUD naming the axis, instead of scripting a
// device history that never took effect. Both directions, so neither can pass
// alone — the guard does not get weaker just because the shape got stronger.
{
  let written = null;
  const honouring = mk((url, body) => {
    if (body?.action === 'UPDATE') { written = body.data; return { status: 200, text: stored(written) }; }
    if (body?.action === 'READ') return { status: 200, text: mirror(written) };
    return { status: 200, text: '{}' };
  }).facts;
  const okWrite = await athrew(() => honouring.setBackstory(N, { ...STORY }, NOW));

  // The shadowing slot: it stores the SIM date but keeps its own device date —
  // the exact half-honoured write the built-in cast produces.
  const shadowing = mk((url, body) => {
    if (body?.action === 'UPDATE') return { status: 200, text: stored(body.data) };
    if (body?.action === 'READ') {
      return { status: 200, text: stored({ sim: new Date(NOW - STORY.swappedDaysAgo * DAY).toISOString() }) };
    }
    return { status: 200, text: '{}' };
  }).facts;
  const shadowed = await athrew(() => shadowing.setBackstory(N, { ...STORY }, NOW));

  // ...and the SAME question for the location axis — now the BEST-MEASURED of the
  // three (the 2026-08-17 convergence probe settled its full five-field shape;
  // see the comment at `data`). Added after an independent mutation sweep DELETED
  // the geo axis from the verification loop and this suite stayed green — the
  // guard that makes the shape survivable was itself unpinned, and staying
  // wired matters exactly as much now that the shape is measured. This slot
  // stores the sim and device dates and keeps its own position.
  const shadowGeo = mk((url, body) => {
    if (body?.action === 'UPDATE') return { status: 200, text: stored(body.data) };
    if (body?.action === 'READ') {
      return { status: 200, text: stored({
        sim: new Date(NOW - STORY.swappedDaysAgo * DAY).toISOString(),
        device: new Date(NOW - STORY.deviceSwappedDaysAgo * DAY).toISOString(),
        geo: { latitude: 1.5, longitude: 2.5 },
      }) };
    }
    return { status: 200, text: '{}' };
  }).facts;
  const geoShadowed = await athrew(() => shadowGeo.setBackstory(N, { ...STORY }, NOW));
  // ...and a null location writes NOTHING and verifies nothing, so a slot with a
  // position of its own is not a write failure. Without this leg the case would
  // pass on a module that demanded a stored position it never wrote.
  const nullGeo = await athrew(() => shadowGeo.setBackstory(N, { ...STORY, location: null }, NOW));

  // ...and the THIRD axis, `kyc` — likewise moved to MEASURED-GOOD on
  // 2026-08-17. Added after an independent sweep deleted the kycName axis from
  // the verification loop with this suite still green — the identical gap the
  // geo axis had, in the identical place, which is the argument for pinning each
  // axis rather than one representative of them, measured or not.
  const shadowName = mk((url, body) => {
    if (body?.action === 'UPDATE') return { status: 200, text: stored(body.data) };
    if (body?.action === 'READ') {
      return { status: 200, text: stored({
        sim: new Date(NOW - STORY.swappedDaysAgo * DAY).toISOString(),
        device: new Date(NOW - STORY.deviceSwappedDaysAgo * DAY).toISOString(),
        kyc: { name: 'Bernard Blanc' },
      }) };
    }
    return { status: 200, text: '{}' };
  }).facts;
  const nameShadowed = await athrew(() => shadowName.setBackstory(N, { ...STORY }, NOW));
  const nullName = await athrew(() => shadowName.setBackstory(N, { ...STORY, registeredName: null }, NOW));
  const wantDevice = new Date(NOW - STORY.deviceSwappedDaysAgo * DAY).toISOString();
  checkOk('52 ALL THREE MEASURED-GOOD WRITE SHAPES ARE STILL READ BACK AND COMPARED', okWrite,
    { label: `honoured write verifies (wrote deviceSwap ${written?.deviceSwap?.latestDeviceChange}, location ${JSON.stringify(written?.location)}); `
      + `shadowed device date=${shadowed.threw}, shadowed position=${geoShadowed.threw}, shadowed name=${nameShadowed.threw} all fail loud; `
      + `null location and null name write nothing=${!nullGeo.threw && !nullName.threw}`,
      ok: !okWrite.threw
        && written.deviceSwap.latestDeviceChange === wantDevice
        // The full five-field location shape the convergence probe settled,
        // including `available`/`radius` as their own write values (the ONE
        // decision made for the whole round: 500, not the probe's placeholder 0).
        && written.location.available === true && written.location.radius === LOCATION_RADIUS_M
        && shadowed.threw
        && shadowed.msg.includes('stored latestDeviceChange is')
        && shadowed.msg.includes('write verification FAILED')
        && geoShadowed.threw && geoShadowed.msg.includes('stored geo is')
        && !nullGeo.threw
        && nameShadowed.threw && nameShadowed.msg.includes('stored kycName is')
        && !nullName.threw });
}

// 53 THE THREE LOCATION STATES MAP THROUGH, AND `lastLocationTime` DOES NOT.
// MEASURED 2026-08-17: `location-verification/v1/verify` answers TRUE, FALSE and
// PARTIAL — and ships `lastLocationTime`, an exact timestamp, on EVERY response
// including the boolean-looking ones. That value is legitimately the operator's
// and it stops at this module: there is no line that reads it, which is what this
// case checks by scanning the whole returned facts object for it.
//
// PARTIAL is carried THROUGH as itself rather than collapsed here, because
// deciding what PARTIAL means is the profile's job (refuse it, M4) and not the
// transport's. An unrecognised verdict, and a PROTOTYPE key, leave the axis absent
// rather than guessing a polarity — the same footgun this suite pins for
// reachability, which is why the verdict vocabulary is a frozen array and not a
// table lookup.
{
  const AREA = { lat: 48.86, long: 2.35, radiusM: 10000 };
  const ts = '2026-08-11T04:00:16.503Z';
  const ask = async (verify) => {
    const { facts } = mk((url) => (url.includes('location-verification')
      ? { status: 200, text: verify }
      : reads()(url)));
    return facts.getFacts(N, NOW, { needLocation: true, area: AREA });
  };
  const yes = await ask(`{"verificationResult":"TRUE","lastLocationTime":"${ts}"}`);
  const no = await ask(`{"verificationResult":"FALSE","lastLocationTime":"${ts}"}`);
  const partial = await ask(`{"verificationResult":"PARTIAL","matchRate":100,"lastLocationTime":"${ts}"}`);
  const unknown = await ask(`{"verificationResult":"MAYBE","lastLocationTime":"${ts}"}`);
  const proto = await ask(`{"verificationResult":"constructor","lastLocationTime":"${ts}"}`);
  const all = JSON.stringify([yes, no, partial, unknown, proto]);
  check('53 THREE LOCATION STATES MAP THROUGH; lastLocationTime DOES NOT', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `TRUE/FALSE/PARTIAL -> ${yes.presentVerdict}/${no.presentVerdict}/${partial.presentVerdict}; `
      + `MAYBE present=${'presentVerdict' in unknown}, prototype key present=${'presentVerdict' in proto}; `
      + `timestamp anywhere in the facts=${all.includes(ts) || all.includes('lastLocationTime')}`,
      ok: yes.presentVerdict === 'TRUE' && no.presentVerdict === 'FALSE' && partial.presentVerdict === 'PARTIAL'
        && !('presentVerdict' in unknown) && !('presentVerdict' in proto)
        && !all.includes(ts) && !all.includes('lastLocationTime') && !all.includes('matchRate') });
}

// 54 THE LOCATION ENDPOINT IS CALLED ONLY WITH A QUESTION, AND CARRIES IT EXACTLY.
// This endpoint takes the QUESTION as its input, so there is no such thing as
// reading it "in general" — with no area asked about, it must not be called at
// all. When it IS called, the area the requester asked about must arrive intact:
// a centre or radius mangled on the way out produces a verdict about a different
// circle, and that verdict is then SIGNED against the original question.
//
// The request shape itself is ASSUMED (CAMARA's own `{device, area:{areaType,
// center, radius}}` spelling; the sweep recorded that the route answers, not the
// body it sent), so what is pinned here is that the VALUES ride through
// unchanged — the part a wrong shape guess would not silently corrupt.
{
  const AREA = { lat: 48.8566, long: 2.3522, radiusM: 1500 };
  const { facts: quiet, calls: quietCalls } = mk(reads());
  await quiet.getFacts(N, NOW);
  const { facts: asked, calls: askedCalls } = mk((url) => (url.includes('location-verification')
    ? { status: 200, text: '{"verificationResult":"TRUE","lastLocationTime":"2026-08-11T04:00:16.503Z"}' }
    : reads()(url)));
  await asked.getFacts(N, NOW, { needLocation: true, area: AREA });
  const locCalls = (cs) => cs.filter((x) => !x.isToken && x.url.includes('location-verification'));
  const sent = locCalls(askedCalls)[0]?.body;
  check('54 THE LOCATION ENDPOINT IS CALLED ONLY WITH A QUESTION', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `no area -> ${locCalls(quietCalls).length} calls; with an area -> ${locCalls(askedCalls).length}, body ${JSON.stringify(sent?.area)}`,
      ok: locCalls(quietCalls).length === 0 && locCalls(askedCalls).length === 1
        && sent.device.phoneNumber === N
        && sent.area.center.latitude === AREA.lat && sent.area.center.longitude === AREA.long
        && sent.area.radius === AREA.radiusM && sent.area.areaType === 'CIRCLE' });
}

// 55 `nameMatch` IS A STRING ON THE WIRE, AND `"false"` IS TRUTHY. The single most
// consequential coercion in this module: measured 2026-08-17, `kyc-match` answers
// `{"nameMatch":"true"}` or `{"nameMatch":"false","nameMatchScore":53}` — STRINGS,
// not booleans. An unguarded `if (body.nameMatch)` therefore reports a NON-match
// as a match, because the string `"false"` is truthy. Both spellings are compared
// explicitly and anything else leaves the axis ABSENT.
//
// The other legs are the measured response SHAPE: an exact match carries NO score
// at all (so a module demanding one would refuse a perfect match), and a score
// outside 0-100 or of the wrong type is dropped rather than carried into a
// comparison.
{
  const ask = async (text) => {
    const { facts } = mk((url) => (url.includes('kyc-match') ? { status: 200, text } : reads()(url)));
    return facts.getFacts(N, NOW, { needKyc: true, claimedName: 'Alice Arnaut' });
  };
  const yes = await ask('{"nameMatch":"true"}');
  const no = await ask('{"nameMatch":"false","nameMatchScore":97}');
  const boolish = await ask('{"nameMatch":false,"nameMatchScore":97}');      // a real boolean is NOT the measured shape
  const unknown = await ask('{"nameMatch":"maybe"}');
  const badScore = await ask('{"nameMatch":"false","nameMatchScore":"97"}');
  const outOfRange = await ask('{"nameMatch":"false","nameMatchScore":101}');
  check('55 nameMatch IS A STRING; "false" IS NOT A MATCH', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `"true"->${yes.nameMatch} (score present=${'nameMatchScore' in yes}), "false"+97->${no.nameMatch}/${no.nameMatchScore}, `
      + `boolean false->present=${'nameMatch' in boolish}, "maybe"->present=${'nameMatch' in unknown}, `
      + `"97"->score present=${'nameMatchScore' in badScore}, 101->present=${'nameMatchScore' in outOfRange}`,
      ok: yes.nameMatch === true && !('nameMatchScore' in yes)
        && no.nameMatch === false && no.nameMatchScore === 97
        && !('nameMatch' in boolish) && !('nameMatch' in unknown)
        && badScore.nameMatch === false && !('nameMatchScore' in badScore)
        && outOfRange.nameMatch === false && !('nameMatchScore' in outOfRange) });
}

// 56 THE KYC ENDPOINT IS CALLED ONLY WITH A CLAIM, AND CARRIES IT EXACTLY. Like
// location, this endpoint takes the requester's claim as its input, so there is no
// reading it "in general" — with no name claimed it must not be called at all
// (every metered call is a query about a subscriber, and a comparison nobody asked
// for is a query with no question behind it). When it IS called, the claimed name
// must arrive unchanged: a mangled claim produces a score about a different name,
// and that verdict is then SIGNED against the original question.
{
  const CLAIM = 'Alice Arnaut';
  const { facts: quiet, calls: quietCalls } = mk(reads());
  await quiet.getFacts(N, NOW);
  const { facts: asked, calls: askedCalls } = mk((url) => (url.includes('kyc-match')
    ? { status: 200, text: '{"nameMatch":"false","nameMatchScore":97}' }
    : reads()(url)));
  await asked.getFacts(N, NOW, { needKyc: true, claimedName: CLAIM });
  const kycCalls = (cs) => cs.filter((x) => !x.isToken && x.url.includes('kyc-match'));
  const sent = kycCalls(askedCalls)[0]?.body;
  check('56 THE KYC ENDPOINT IS CALLED ONLY WITH A CLAIM', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `no claim -> ${kycCalls(quietCalls).length} calls; with a claim -> ${kycCalls(askedCalls).length}, body ${JSON.stringify(sent)}`,
      ok: kycCalls(quietCalls).length === 0 && kycCalls(askedCalls).length === 1
        && sent.phoneNumber === N && sent.name === CLAIM
        && Object.keys(sent).sort().join(',') === 'name,phoneNumber' });
}

// 57 THE POSITION CARRIES AN OBSERVATION INSTANT, OFF THE INJECTED CLOCK, AND IT
// STAYS OPERATOR-SIDE. Added 2026-08-17 after the USER's live Playground run
// measured the location write shape wrong:
//
//   admin UPDATE failed (status 400): {"code":"BAD_REQUEST","status":400,
//   "message":"\"data.location.lastLocationTime\" is required"}
//
// The Admin store will not take a position without an observation instant. Three
// legs, and they are three different failure modes rather than one restated:
//
//   * THE FIELD IS SENT, and it equals `new Date(injected now).toISOString()`.
//     The assertion is against a clock set to 2026 while the process runs in
//     whatever year it runs — so a regression to `Date.now()` (the one forbidden
//     spelling in this module) reds here rather than at the next live run, and
//     the ~1-in-31-million chance that a wall clock happens to agree is the
//     assertion doing its job.
//   * IT IS VERIFIED like every other axis: a slot that stores the position and
//     rewrites the instant fails LOUD naming `geoAt` — its own axis, because a
//     mismatch folded into `geo` would read as "the position did not store",
//     which is a different bug with a different fix. A `null` location still
//     writes nothing and verifies nothing.
//   * IT NEVER BECOMES A FACT. Writing an instant operator-side is scripting;
//     reading one back to the requester would be disclosure. `getFacts` is asked
//     for the location axis and the whole returned object is scanned for the
//     instant in every spelling — the same scan case 53 applies to the
//     `lastLocationTime` that rides the CAMARA response.
{
  const AREA = { lat: 48.86, long: 2.35, radiusM: 10000 };
  let sent = null;
  const honouring = mk((url, body) => {
    if (body?.action === 'UPDATE') { sent = body.data; return { status: 200, text: stored(body.data) }; }
    if (body?.action === 'READ') return { status: 200, text: mirror(sent) };
    return { status: 200, text: '{}' };
  }).facts;
  const wrote = await athrew(() => honouring.setBackstory(N, { ...STORY }, NOW));

  // The slot that keeps its OWN observation instant while storing the position.
  const rewriting = mk((url, body) => {
    if (body?.action === 'UPDATE') return { status: 200, text: stored(body.data) };
    if (body?.action === 'READ') {
      return { status: 200, text: stored({
        sim: new Date(NOW - STORY.swappedDaysAgo * DAY).toISOString(),
        device: new Date(NOW - STORY.deviceSwappedDaysAgo * DAY).toISOString(),
        geo: { latitude: PARIS.lat, longitude: PARIS.long, lastLocationTime: '2020-03-15T10:00:00.000Z' },
      }) };
    }
    return { status: 200, text: '{}' };
  }).facts;
  const rewritten = await athrew(() => rewriting.setBackstory(N, { ...STORY }, NOW));
  const nullGeo = await athrew(() => rewriting.setBackstory(N, { ...STORY, location: null }, NOW));

  // ...and the read side: the instant must not reach the facts from either
  // direction — the one the operator wrote, or the one the CAMARA verify answers.
  const { facts: reader } = mk((url) => (url.includes('location-verification')
    ? { status: 200, text: `{"verificationResult":"TRUE","lastLocationTime":"${NOW_ISO}"}` }
    : reads()(url)));
  const f = await reader.getFacts(N, NOW, { needLocation: true, area: AREA });
  const leaked = JSON.stringify(f);

  check('57 THE POSITION CARRIES AN INSTANT OFF THE INJECTED CLOCK, OPERATOR-SIDE ONLY', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `wrote location=${JSON.stringify(sent?.location)} (injected now ${NOW_ISO}); `
      + `rewritten instant fails loud naming geoAt=${rewritten.threw && rewritten.msg.includes('stored geoAt is')}; `
      + `null location writes nothing=${!nullGeo.threw}; instant anywhere in the facts=${leaked.includes(NOW_ISO) || leaked.includes('lastLocationTime')}`,
      ok: !wrote.threw
        && sent.location.lastLocationTime === NOW_ISO
        && Object.keys(sent.location).sort().join(',') === 'available,lastLocationTime,latitude,longitude,radius'
        && sent.location.available === true && sent.location.radius === LOCATION_RADIUS_M
        && rewritten.threw && rewritten.msg.includes('stored geoAt is')
        && rewritten.msg.includes('write verification FAILED')
        && !nullGeo.threw
        && !leaked.includes(NOW_ISO) && !leaked.includes('lastLocationTime')
        && !leaked.includes(String(NOW)) && f.presentVerdict === 'TRUE' });
}

// 58 `available` AND `radius` ARE THEIR OWN VERIFIED AXES, NOT FOLDED INTO `geo`.
// MEASURED 2026-08-17 by the same convergence probe as case 57: round 2 of the
// live write refused `data.location.available`, and round 3 converged only once
// `radius` rode too — so the Admin store demands BOTH beside the pair `geo`
// already covers. Two shadowing slots, each wrong on exactly one of the two new
// fields, so a bug that dropped either verification arm (or conflated it with
// `geo`/`geoAt`) reds here without touching the other.
{
  const wantSim = new Date(NOW - STORY.swappedDaysAgo * DAY).toISOString();
  const wantDevice = new Date(NOW - STORY.deviceSwappedDaysAgo * DAY).toISOString();
  // Stores everything but flips `available` to false — the honest "not known"
  // spelling this module never writes, so a slot answering it back is a mismatch.
  const shadowAvailable = mk((url, body) => {
    if (body?.action === 'UPDATE') return { status: 200, text: stored(body.data) };
    if (body?.action === 'READ') {
      return { status: 200, text: stored({
        sim: wantSim, device: wantDevice,
        geo: { latitude: PARIS.lat, longitude: PARIS.long, lastLocationTime: NOW_ISO, available: false, radius: LOCATION_RADIUS_M },
      }) };
    }
    return { status: 200, text: '{}' };
  }).facts;
  const availableMismatch = await athrew(() => shadowAvailable.setBackstory(N, { ...STORY }, NOW));

  // Stores everything but keeps the PROBE's OWN placeholder radius (0) rather
  // than the 500 this module writes — the exact wrong number the ONE DECISION
  // above this axis exists to avoid signing.
  const shadowRadius = mk((url, body) => {
    if (body?.action === 'UPDATE') return { status: 200, text: stored(body.data) };
    if (body?.action === 'READ') {
      return { status: 200, text: stored({
        sim: wantSim, device: wantDevice,
        geo: { latitude: PARIS.lat, longitude: PARIS.long, lastLocationTime: NOW_ISO, available: true, radius: 0 },
      }) };
    }
    return { status: 200, text: '{}' };
  }).facts;
  const radiusMismatch = await athrew(() => shadowRadius.setBackstory(N, { ...STORY }, NOW));

  check('58 available AND radius ARE THEIR OWN VERIFIED AXES', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `available flip fails loud naming geoAvailable=${availableMismatch.threw && availableMismatch.msg.includes('stored geoAvailable is')}; `
      + `radius flip (0 vs 500) fails loud naming geoRadius=${radiusMismatch.threw && radiusMismatch.msg.includes('stored geoRadius is')}`,
      ok: availableMismatch.threw && availableMismatch.msg.includes('stored geoAvailable is')
        && availableMismatch.msg.includes('write verification FAILED')
        && radiusMismatch.threw && radiusMismatch.msg.includes('stored geoRadius is')
        && radiusMismatch.msg.includes('write verification FAILED') });
}

// 59 THE SIM AXIS IS READ ONLY WHEN A SIM QUESTION WAS ASKED — the same
// conditional pattern case 51 pins for the device axis, now applied to the SIM
// axis it was deliberately exempted from. `reachable`/`roamingIn`/`presentIn`/
// `numberMatch` carry no SIM threshold, so an unconditional read was pulling a
// raw `/retrieve-date` value operator-side for a question that never needed it —
// undercutting the `/check` argument that there is no raw value to leak in the
// first place. The negative: a non-SIM question makes ZERO sim-swap calls. The
// positive: a SIM question still makes exactly one.
{
  const { facts: quiet, calls: quietCalls } = mk(reads());
  await quiet.getFacts(N, NOW);                              // e.g. reachable / roamingIn / presentIn / numberMatch: no SIM threshold at all
  const { facts: asked, calls: askedCalls } = mk(reads());
  const f = await asked.getFacts(N, NOW, { needSim: true, swapAgeThresholdMs: 90 * DAY });
  const simCalls = (cs) => cs.filter((x) => !x.isToken && x.url.includes('sim-swap')).length;
  check('59 THE SIM AXIS IS READ ONLY WHEN ASKED', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `non-sim question -> ${simCalls(quietCalls)} sim-swap calls; sim question -> ${simCalls(askedCalls)}; swapAgeAtLeast=${f.swapAgeAtLeast}`,
      ok: simCalls(quietCalls) === 0 && simCalls(askedCalls) === 1 && 'swapAgeAtLeast' in f });
}

// 60 getFacts RE-VALIDATES `q.area` AND `q.claimedName` ITSELF, never trusting a
// caller that skipped `factQuery` — the reason stated at `q` in
// m5-facts-orange.mjs: `createOrangeFacts` is M5's ONE export, so a caller that
// never went through `factQuery` reaches these bodies directly. Reproduced from
// a proven gap (2026-08-18, mutation-tested offline): with the re-validation
// removed, a hostile `q.area = {lat:'north', long:{}, radiusM:-1}` builds and
// SENDS `{"areaType":"CIRCLE","center":{"latitude":"north","longitude":{}},
// "radius":-1}` to `location-verification`, and a 50,041-character
// `claimedName` is sent verbatim as `name` to `kyc-match` — both scored 58/58
// (this suite's own pre-fix count) whether the guard was present or reverted,
// because no case pinned the OUTBOUND BODY. Fixed, NEITHER call is sent at all:
// the axis is simply absent, so there is no wire body to inspect — asserted
// here as zero calls to each endpoint (what actually reaches the wire), not
// merely on the returned fact.
{
  const HOSTILE_AREA = { lat: 'north', long: {}, radiusM: -1 };
  const HOSTILE_NAME = 'x'.repeat(50041);
  const { facts: areaFacts, calls: areaCalls } = mk(reads());
  const af = await areaFacts.getFacts(N, NOW, { needLocation: true, area: HOSTILE_AREA });
  const { facts: nameFacts, calls: nameCalls } = mk(reads());
  const nf = await nameFacts.getFacts(N, NOW, { needKyc: true, claimedName: HOSTILE_NAME });
  const locSent = areaCalls.filter((x) => !x.isToken && x.url.includes('location-verification'));
  const kycSent = nameCalls.filter((x) => !x.isToken && x.url.includes('kyc-match'));
  check('60 getFacts RE-VALIDATES q.area / q.claimedName, NEVER TRUSTS THE CALLER', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `hostile area -> ${locSent.length} location-verification calls (would-be body ${JSON.stringify(locSent[0]?.body?.area)}); `
      + `50041-char claimedName -> ${kycSent.length} kyc-match calls (would-be name len ${kycSent[0]?.body?.name?.length});`
      + ` presentVerdict present=${'presentVerdict' in af}, nameMatch present=${'nameMatch' in nf}`,
      ok: locSent.length === 0 && kycSent.length === 0
        && !('presentVerdict' in af) && !('nameMatch' in nf) });
}

// 61 THE ROAMING AXIS IS READ ONLY WHEN ASKED — closing the 2026-08-18 open
// design item, the same conditional pattern cases 51/59 pin for the device and
// SIM axes, now applied to the two axes that had NO query value of their own
// (`roamingIn`/`reachable`) and so were exempted from the earlier round. The
// negative: a query with no roaming signal makes ZERO `device-roaming-status`
// calls. The positive: `needRoaming: true` still makes exactly one.
{
  const { facts: quiet, calls: quietCalls } = mk(reads());
  await quiet.getFacts(N, NOW, SIM_Q);                          // a SIM question, no roaming signal at all
  const { facts: asked, calls: askedCalls } = mk(reads());
  const f = await asked.getFacts(N, NOW, ROAM_Q);
  const roamCalls = (cs) => cs.filter((x) => !x.isToken && x.url.includes('roaming')).length;
  check('61 THE ROAMING AXIS IS READ ONLY WHEN ASKED', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `non-roaming question -> ${roamCalls(quietCalls)} roaming calls; roaming question -> ${roamCalls(askedCalls)}; roamingCountry present=${'roamingCountry' in f}`,
      ok: roamCalls(quietCalls) === 0 && roamCalls(askedCalls) === 1 && 'roamingCountry' in f });
}

// 62 THE REACHABILITY AXIS IS READ ONLY WHEN ASKED — same closing fix, same
// pattern, the other exempted axis.
{
  const { facts: quiet, calls: quietCalls } = mk(reads());
  await quiet.getFacts(N, NOW, SIM_Q);                          // a SIM question, no reachability signal at all
  const { facts: asked, calls: askedCalls } = mk(reads());
  const f = await asked.getFacts(N, NOW, REACH_Q);
  const reachCalls = (cs) => cs.filter((x) => !x.isToken && x.url.includes('reachability')).length;
  check('62 THE REACHABILITY AXIS IS READ ONLY WHEN ASKED', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `non-reachability question -> ${reachCalls(quietCalls)} reachability calls; reachability question -> ${reachCalls(askedCalls)}; reachable present=${'reachable' in f}`,
      ok: reachCalls(quietCalls) === 0 && reachCalls(askedCalls) === 1 && 'reachable' in f });
}

// 63 FAIL-CLOSED: NO QUERY -> ZERO LIVE CALLS -> REFUSAL, NEVER A GUESSED BIT.
// The negative control for cases 61/62 taken to its actual consequence: a
// caller that asks `roamingIn`/`reachable` through the real seam (`factQuery`)
// without the predicate's own value validating gets no axis signal, `getFacts`
// makes NO live call for either axis, and `evaluatePredicate` REFUSES rather
// than answering from an absent fact — the fail-closed chain end to end, not
// just the call count in isolation.
{
  const { facts, calls } = mk(reads());
  // A malformed roamingIn (empty set) and a well-formed reachable predicate
  // that the caller simply never asked about (no query built from it at all):
  // both must leave `getFacts` making zero calls for their own axis.
  const f = await facts.getFacts(N, NOW, factQuery({ type: 'roamingIn', operator: 'in', value: [] }));
  const roamVerdict = evaluatePredicate(f, { type: 'roamingIn', operator: 'in', value: ['FR'] });
  const reachVerdict = evaluatePredicate(f, { type: 'reachable', operator: 'eq', value: true });
  const roamCalls = calls.filter((x) => !x.isToken && x.url.includes('roaming')).length;
  const reachCalls = calls.filter((x) => !x.isToken && x.url.includes('reachability')).length;
  check('63 FAIL-CLOSED: NO QUERY -> ZERO CALLS -> REFUSAL', false,
    { answered: roamVerdict.answered, reason: roamVerdict.reason }, 'fact unavailable: roamingCountry', {
      label: `roaming calls=${roamCalls}, reachability calls=${reachCalls}; `
        + `roamingIn -> ${roamVerdict.answered}/'${roamVerdict.reason}'; reachable -> ${reachVerdict.answered}/'${reachVerdict.reason}'`,
      ok: roamCalls === 0 && reachCalls === 0
        && roamVerdict.answered === false && roamVerdict.reason === 'fact unavailable: roamingCountry'
        && reachVerdict.answered === false && reachVerdict.reason === 'fact unavailable: reachable',
    });
}

// 64 SIM/DEVICE FAIL CLOSED WHEN `needSim`/`needDevice` IS TRUE BUT THE
// THRESHOLD DOES NOT VALIDATE. Added with the 2026-08-18 signal unification:
// gating moved from "the threshold key is present" (under which an invalid
// value could never arrive without entry being denied at all) to
// `needSim`/`needDevice === true`, which a caller can set without ever
// supplying a valid threshold. Before `readSwapAxis`'s own guard was added, a
// present-but-invalid threshold fell straight into the `/retrieve-date`
// branch — a raw-date read for a window nobody validated. Fixed, a MISSING
// threshold, a non-integer one, and a negative/zero one all make ZERO calls on
// EITHER surface, for BOTH axes: this axis was never asked a question `/check`
// or `/retrieve-date` could honestly answer.
{
  const simCalls = (cs) => cs.filter((x) => !x.isToken && x.url.includes('sim-swap')).length;
  const deviceCalls = (cs) => cs.filter((x) => !x.isToken && x.url.includes('device-swap')).length;

  const { facts: missing, calls: missingCalls } = mk(reads());
  const fMissing = await missing.getFacts(N, NOW, { needSim: true });

  const { facts: negative, calls: negativeCalls } = mk(reads());
  const fNegative = await negative.getFacts(N, NOW, { needSim: true, swapAgeThresholdMs: -1 });

  const { facts: zero, calls: zeroCalls } = mk(reads());
  const fZero = await zero.getFacts(N, NOW, { needSim: true, swapAgeThresholdMs: 0 });

  const { facts: stringy, calls: stringyCalls } = mk(reads());
  const fStringy = await stringy.getFacts(N, NOW, { needSim: true, swapAgeThresholdMs: '90' });

  const { facts: deviceMissing, calls: deviceMissingCalls } = mk(reads());
  const fDeviceMissing = await deviceMissing.getFacts(N, NOW, { needDevice: true });

  const noAxis = (f) => !('swapAgeAtLeast' in f) && !('swapAgeAtLeastMs' in f) && !('swapAgeMs' in f);
  const noDeviceAxis = (f) => !('deviceSwapAgeAtLeast' in f) && !('deviceSwapAgeAtLeastMs' in f) && !('deviceSwapAgeMs' in f);

  check('64 SIM/DEVICE FAIL CLOSED: needXxx TRUE BUT THE THRESHOLD DOES NOT VALIDATE', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `missing threshold -> ${simCalls(missingCalls)} sim calls, axis present=${!noAxis(fMissing)}; `
      + `negative -> ${simCalls(negativeCalls)} sim calls, axis present=${!noAxis(fNegative)}; `
      + `zero -> ${simCalls(zeroCalls)} sim calls, axis present=${!noAxis(fZero)}; `
      + `string "90" -> ${simCalls(stringyCalls)} sim calls, axis present=${!noAxis(fStringy)}; `
      + `device, missing threshold -> ${deviceCalls(deviceMissingCalls)} device calls, axis present=${!noDeviceAxis(fDeviceMissing)}`,
      ok: simCalls(missingCalls) === 0 && noAxis(fMissing)
        && simCalls(negativeCalls) === 0 && noAxis(fNegative)
        && simCalls(zeroCalls) === 0 && noAxis(fZero)
        && simCalls(stringyCalls) === 0 && noAxis(fStringy)
        && deviceCalls(deviceMissingCalls) === 0 && noDeviceAxis(fDeviceMissing) });
}

// 65 LOCATION/KYC FAIL CLOSED WHEN `needLocation`/`needKyc` IS TRUE BUT THE
// VALUE IS ABSENT. Complements case 60, which pins a signal-true, VALUE-
// MALFORMED shape (a hostile area / an oversized claim): this pins the other
// half — the signal true with no `area`/`claimedName` field at all. Both must
// make zero calls to the endpoint they claim to be asking about, the same
// fail-closed outcome as a malformed value.
{
  const { facts: noArea, calls: noAreaCalls } = mk(reads());
  const fNoArea = await noArea.getFacts(N, NOW, { needLocation: true });
  const { facts: noClaim, calls: noClaimCalls } = mk(reads());
  const fNoClaim = await noClaim.getFacts(N, NOW, { needKyc: true });
  const locCalls = (cs) => cs.filter((x) => !x.isToken && x.url.includes('location-verification')).length;
  const kycCalls = (cs) => cs.filter((x) => !x.isToken && x.url.includes('kyc-match')).length;
  check('65 LOCATION/KYC FAIL CLOSED: needXxx TRUE BUT THE VALUE IS ABSENT', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `needLocation, no area -> ${locCalls(noAreaCalls)} calls, presentVerdict present=${'presentVerdict' in fNoArea}; `
      + `needKyc, no claimedName -> ${kycCalls(noClaimCalls)} calls, nameMatch present=${'nameMatch' in fNoClaim}`,
      ok: locCalls(noAreaCalls) === 0 && !('presentVerdict' in fNoArea)
        && kycCalls(noClaimCalls) === 0 && !('nameMatch' in fNoClaim) });
}

// 66 ALL FOUR VALUE-BEARING AXES ARE GATED ON THE SIGNAL, NOT ON THEIR OWN
// VALUE'S PRESENCE — the actual unification this round makes. Before it, SIM
// and DEVICE gated on `hasOwn(q, thresholdKey)` and location/KYC gated on
// `validArea(q.area) !== undefined` / a valid `q.claimedName`, so a query
// carrying a well-formed VALUE with no `needXxx` signal at all still triggered
// a live read under the old code. This is the negative that pins the gate
// moved onto the SIGNAL: a well-formed threshold/area/claim with its `needXxx`
// flag OMITTED must make ZERO calls on every one of the four axes, mirroring
// what cases 61/62 already prove for roaming/reachability (which never had a
// value of their own to gate on in the first place).
{
  const simCalls = (cs) => cs.filter((x) => !x.isToken && x.url.includes('sim-swap')).length;
  const deviceCalls = (cs) => cs.filter((x) => !x.isToken && x.url.includes('device-swap')).length;
  const locCalls = (cs) => cs.filter((x) => !x.isToken && x.url.includes('location-verification')).length;
  const kycCalls = (cs) => cs.filter((x) => !x.isToken && x.url.includes('kyc-match')).length;

  const { facts: simNoSignal, calls: simNoSignalCalls } = mk(reads());
  const fSimNoSignal = await simNoSignal.getFacts(N, NOW, { swapAgeThresholdMs: 90 * DAY });   // no needSim

  const { facts: deviceNoSignal, calls: deviceNoSignalCalls } = mk(reads());
  const fDeviceNoSignal = await deviceNoSignal.getFacts(N, NOW, { deviceSwapAgeThresholdMs: 90 * DAY });   // no needDevice

  const AREA = { lat: 48.86, long: 2.35, radiusM: 10000 };
  const { facts: locNoSignal, calls: locNoSignalCalls } = mk(reads());
  const fLocNoSignal = await locNoSignal.getFacts(N, NOW, { area: AREA });   // no needLocation

  const { facts: kycNoSignal, calls: kycNoSignalCalls } = mk(reads());
  const fKycNoSignal = await kycNoSignal.getFacts(N, NOW, { claimedName: 'Alice Arnaut' });   // no needKyc

  check('66 SIM/DEVICE/LOCATION/KYC GATE ON THE SIGNAL, NOT ON THEIR OWN VALUE', true, { answered: true, reason: 'ok' }, 'ok',
    { label: `well-formed threshold, no needSim -> ${simCalls(simNoSignalCalls)} sim calls, axis present=${'swapAgeAtLeast' in fSimNoSignal || 'swapAgeMs' in fSimNoSignal}; `
      + `well-formed threshold, no needDevice -> ${deviceCalls(deviceNoSignalCalls)} device calls, axis present=${'deviceSwapAgeAtLeast' in fDeviceNoSignal || 'deviceSwapAgeMs' in fDeviceNoSignal}; `
      + `well-formed area, no needLocation -> ${locCalls(locNoSignalCalls)} location calls, presentVerdict present=${'presentVerdict' in fLocNoSignal}; `
      + `well-formed claim, no needKyc -> ${kycCalls(kycNoSignalCalls)} kyc calls, nameMatch present=${'nameMatch' in fKycNoSignal}`,
      ok: simCalls(simNoSignalCalls) === 0 && !('swapAgeAtLeast' in fSimNoSignal) && !('swapAgeMs' in fSimNoSignal)
        && deviceCalls(deviceNoSignalCalls) === 0 && !('deviceSwapAgeAtLeast' in fDeviceNoSignal) && !('deviceSwapAgeMs' in fDeviceNoSignal)
        && locCalls(locNoSignalCalls) === 0 && !('presentVerdict' in fLocNoSignal)
        && kycCalls(kycNoSignalCalls) === 0 && !('nameMatch' in fKycNoSignal) });
}

conclude(66);
