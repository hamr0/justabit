// PoC module V3-M2 — the published menu. Pure: no crypto, no network, no clock
// (the caller passes `today`). Zero dependencies.
//
// The operator publishes the QUESTIONS it answers, as a short closed set of
// durations per API (not a range: a range lets a requester find the raw date
// by asking again with a moved value). Each entry is one yes/no question:
// The menu is keyed by the schema `api` value (m1-jws.mjs), one name for one thing:
//   sim-swap/v2/check             P90D  "no SIM swap in the last 90 days?"   requester sends maxAge 2160
//   kyc-tenure/v0.3/check-tenure  P2Y   "tenure of 2 years or more?"         requester sends tenureDate
//                                       = the UTC date today minus 730 days (1Y = 365D)
// The requester still sends the Sync26 request body (only its one field is read). The operator maps it to the entry
// HERE, before any backend read. An off-menu value is refused with Sync26's
// 400 OUT_OF_RANGE: never rounded, nothing read. The signed answer names the
// entry (option 1, user decision 2026-11-23): no hours value and no date is
// signed. Dates are UTC only; near midnight UTC a requester may be refused once
// and must ask again (fail-closed, no tolerance window).
import {
  parseDuration, isCalendarDate, SIM_SWAP_CHECK, TENURE_CHECK, attachAttestation, attestRefusal, OUT_OF_RANGE,
} from './m1-jws.mjs';

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export const SIMSWAP_MAX_HOURS = 2400; // Sync26 SimSwap maxAge cap
const API_FIELD = Object.freeze({ [SIM_SWAP_CHECK.api]: 'maxAge', [TENURE_CHECK.api]: 'tenureDate' });
const MAX_TENURE_DAYS = 36500; // P100Y
const REFUSE = Object.freeze({ ok: false, code: 'OUT_OF_RANGE' });

// An entry is usable for an API when it parses, is not zero, and (SimSwap) its
// hours fit under Sync26's 2400 h cap.
function entryDays(api, entry) {
  const days = parseDuration(entry);
  if (days === null || days === 0) return null;
  if (api === SIM_SWAP_CHECK.api && days * 24 > SIMSWAP_MAX_HOURS) return null;
  // no line is older than 100 years; keeps the UTC date math in range
  if (api === TENURE_CHECK.api && days > MAX_TENURE_DAYS) return null;
  return days;
}

export const DEFAULT_MENU = Object.freeze({
  [SIM_SWAP_CHECK.api]: Object.freeze(['P90D']),
  [TENURE_CHECK.api]: Object.freeze(['P2Y']),
});

// Validate and freeze an operator's menu. Throws on anything unusable: an
// unknown API, a bad entry, P0D, a duplicate, or a SimSwap entry above the
// 2400 h cap (P101D and longer, P365D, P1Y). An API may be ABSENT (the operator
// does not offer it; checkMenu then refuses it), but a list that is present
// must be a non-empty array.
export function loadMenu(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('menu must be an object');
  const keys = Object.keys(obj);
  for (const k of keys) if (!hasOwn(API_FIELD, k)) throw new Error(`menu names an unknown API: ${k}`);
  const out = {};
  for (const api of Object.keys(API_FIELD)) {
    if (!hasOwn(obj, api)) continue;
    const list = obj[api];
    if (!Array.isArray(list) || list.length === 0) throw new Error(`menu list for ${api} must be a non-empty array`);
    for (const e of list) {
      if (entryDays(api, e) === null) throw new Error(`menu entry ${JSON.stringify(e)} is not usable for ${api}`);
    }
    if (new Set(list.map((e) => entryDays(api, e))).size !== list.length) throw new Error(`menu list for ${api} has a duplicate`);
    out[api] = Object.freeze([...list]);
  }
  return Object.freeze(out);
}

// UTC date (YYYY-MM-DD) `days` before the UTC date of `today`.
function utcDateMinus(today, days) {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// Map a Sync26 request BODY to a menu entry. `body` is the whole request body
// (for example { phoneNumber, maxAge, nonce }); only this API's field (`maxAge`
// or `tenureDate`) is read, and only as an OWN property (an inherited field
// does not count). Other keys are ignored: they are never signed and never
// reach readBackend. If the field is absent the body is refused: Sync26's 240 h
// default for maxAge (= P10D) is not on the default menu, and a default the
// requester did not ask for is not a question it asked.
// Never throws on WIRE input (the body, the api value, ctx.menu). A caller bug
// is different: a Tenure question with a missing or invalid ctx.today throws
// TypeError, so a wiring mistake is not hidden as OUT_OF_RANGE.
// This holds for every Tenure question, even when the menu does not offer
// Tenure: `today` is a wiring requirement of the caller, not of the menu.
// ctx = { menu?, today: Date, thresholdR?: 'YYYY-MM-DD' }. A given ctx.menu is
// run through loadMenu; if that throws, the answer is a refusal.
// thresholdR: an entry whose date is before the operator's Tenure threshold R
// cannot be answered, so it is refused. A thresholdR that is present but not
// a real calendar date refuses (fail closed).
export function checkMenu(api, body, ctx) {
  // Caller-bug check: BEFORE and OUTSIDE the wire-input try/catch below.
  if (api === TENURE_CHECK.api) {
    const t = ctx?.today;
    if (!(t instanceof Date) || Number.isNaN(t.getTime())) throw new TypeError('checkMenu: ctx.today must be a valid Date for the Tenure API');
  }
  try {
    const { menu: given, today, thresholdR } = ctx ?? {};
    const menu = given === undefined ? DEFAULT_MENU : loadMenu(given);
    if (typeof api !== 'string' || !hasOwn(API_FIELD, api) || !hasOwn(menu, api)) return REFUSE;
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return REFUSE;
    const field = API_FIELD[api];
    if (!hasOwn(body, field)) return REFUSE;
    const v = body[field];
    for (const entry of menu[api]) {
      const days = entryDays(api, entry);
      if (days === null) continue;
      if (api === SIM_SWAP_CHECK.api) {
        if (typeof v === 'number' && Number.isInteger(v) && v === days * 24) return { ok: true, entry };
      } else {
        if (!isCalendarDate(v)) continue;
        const want = utcDateMinus(today, days);
        if (v !== want) continue;
        if (thresholdR !== undefined && !isCalendarDate(thresholdR)) return REFUSE;
        if (thresholdR !== undefined && want < thresholdR) return REFUSE;
        return { ok: true, entry };
      }
    }
    return REFUSE;
  } catch {
    return REFUSE;
  }
}

// Requester side: the entry its own Sync26 request body maps to (same
// published menu), or null. Call it when the request is BUILT, with the same
// `today` used to compute tenureDate, and keep the result for verifyAnswer as
// `expectedEntry`. Do not recompute it at verify time: across UTC midnight the
// date no longer matches and the answer would fail ENTRY_MISMATCH.
export function entryFor(api, body, ctx) {
  const c = checkMenu(api, body, ctx);
  return c.ok ? c.entry : null;
}

// The guard: `readBackend` runs ONLY after checkMenu says ok. Off menu returns
// { refused: 'OUT_OF_RANGE' } and reads nothing. Sync on purpose: the read-
// before-check order is then visible in the code, not hidden behind an await.
export function answerWithMenu(api, body, ctx, readBackend) {
  const c = checkMenu(api, body, ctx);
  if (!c.ok) return { refused: c.code };
  return { entry: c.entry, answer: readBackend(api, c.entry) };
}

// V3-M4: the operator side in one call. The signed entry comes ONLY from
// answerWithMenu (the menu), never from the request or the caller. `body` is the
// Sync26 request body (its `nonce`, if any, is the verifier's). signOpts =
// { privateKey, kid, base: { iss, aud, iat, exp } }. Off menu: with a nonce, a
// signed OUT_OF_RANGE refusal naming the API; without one, today's plain error.
// A nonce that is present but not a non-empty string throws (as attachAttestation).
export function operatorAnswer(api, body, ctx, readBackend, signOpts) {
  const r = answerWithMenu(api, body, ctx, readBackend);
  const nonce = body.nonce;
  if (r.refused) {
    if (nonce === undefined) return { error: OUT_OF_RANGE };
    const token = attestRefusal(signOpts.privateKey, signOpts.kid, { ...signOpts.base, nonce }, OUT_OF_RANGE, api);
    if (typeof token !== 'string') throw new Error('refusal could not be signed');
    return { error: OUT_OF_RANGE, attestation: token };
  }
  const schema = [SIM_SWAP_CHECK, TENURE_CHECK].find((s) => s.api === api);
  return attachAttestation(r.answer, nonce, { ...signOpts, schema, params: { entry: r.entry } });
}
