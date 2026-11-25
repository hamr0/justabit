#!/usr/bin/env python3
"""Check camara/v3/spec/carrier-attestation.yaml against the v3 PoC code.

Usage: sketch-check.py [path-to-yaml]   (default: the repo file)
Needs python3, PyYAML and node. Exit 0 = every check passed, non-zero = fail.

Checks:
  1. The YAML parses and every $ref resolves.
  2. Drift: payload schemas equal the claim sets that REAL calls of
     camara/v3/poc/m1-jws.mjs produce; refusal reasons, API names, and the menu
     example text equal the code and camara/v3/poc/menu.json.
  3. Leak guard: no payload schema names maxAge, tenureDate, latestSimChange,
     contractType or a date/date-time format; no response schema has contractType.
"""
import base64
import json
import subprocess
import sys
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
POC = HERE.parent / 'poc'
YAML_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / 'carrier-attestation.yaml'

NODE = r"""
import { generateKeyPairSync } from 'node:crypto';
import { attestAnswer, attestRefusal, SIM_SWAP_CHECK, TENURE_CHECK, KNOWN_APIS, REFUSAL_REASONS } from '__M1__';
const { privateKey } = generateKeyPairSync('ed25519');
const base = { iss: 'op', aud: 'rq', nonce: 'n1', iat: 1000, exp: 2000 };
const out = {};
const sim = attestAnswer(privateKey, 'k1', base, SIM_SWAP_CHECK, { entry: 'P90D' }, { swapped: true });
const ten = attestAnswer(privateKey, 'k1', base, TENURE_CHECK, { entry: 'P2Y' }, { tenureDateCheck: true });
const ref = attestRefusal(privateKey, 'k1', base, 'OUT_OF_RANGE', SIM_SWAP_CHECK.api);
for (const [k, t] of [['sim', sim], ['tenure', ten], ['refusal', ref]]) {
  if (typeof t !== 'string') { console.error('sign failed: ' + k); process.exit(3); }
  const [h, p] = t.split('.');
  out[k] = { header: JSON.parse(Buffer.from(h, 'base64url')), payload: JSON.parse(Buffer.from(p, 'base64url')) };
}
out.apis = { sim: SIM_SWAP_CHECK.api, tenure: TENURE_CHECK.api };
out.knownApis = [...KNOWN_APIS];
out.reasons = [...REFUSAL_REASONS];
console.log(JSON.stringify(out));
""".replace('__M1__', (POC / 'm1-jws.mjs').as_uri())

failures = []


def report(name, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else ': ' + detail))
    if not ok:
        failures.append(name)


# ---- 1. parse and $ref ------------------------------------------------------
try:
    doc = yaml.safe_load(YAML_PATH.read_text())
    assert isinstance(doc, dict)
except Exception as e:  # noqa: BLE001
    print('FAIL parse: %s' % e)
    sys.exit(1)


def resolve(ref):
    if not isinstance(ref, str) or not ref.startswith('#/'):
        raise KeyError(ref)
    node = doc
    for part in ref[2:].split('/'):
        if not isinstance(node, dict) or part not in node:
            raise KeyError(ref)
        node = node[part]
    return node


def walk(node, fn, seen=None):
    """Visit every dict/list; follow $ref once per target."""
    seen = set() if seen is None else seen
    if isinstance(node, dict):
        fn(node)
        for k, v in node.items():
            if k == '$ref' and isinstance(v, str):
                if v not in seen:
                    seen.add(v)
                    walk(resolve(v), fn, seen)
            else:
                walk(v, fn, seen)
    elif isinstance(node, list):
        for v in node:
            walk(v, fn, seen)


broken = []


refs_seen = []
def all_refs(node):
    if isinstance(node, dict):
        for k, v in node.items():
            if k == '$ref':
                refs_seen.append(v)
            else:
                all_refs(v)
    elif isinstance(node, list):
        for v in node:
            all_refs(v)

all_refs(doc)
for r in refs_seen:
    try:
        resolve(r)
    except KeyError:
        broken.append(r)
report('1 parse and $ref resolve (%d refs)' % len(refs_seen), not broken and len(refs_seen) > 0, 'broken: %s' % broken)
if broken:
    sys.exit(1)

# ---- real output from the code ------------------------------------------------
try:
    proc = subprocess.run(['node', '--input-type=module', '-e', NODE], capture_output=True, text=True, timeout=60)
except Exception as e:  # noqa: BLE001
    print('FAIL node call: %s' % e)
    sys.exit(2)
if proc.returncode != 0:
    print('FAIL node call exit %d: %s' % (proc.returncode, proc.stderr.strip()[:300]))
    sys.exit(2)
code = json.loads(proc.stdout)
schemas = doc['components']['schemas']


def props(schema):
    """Property names of a schema, merging allOf and following $ref."""
    if '$ref' in schema:
        return props(resolve(schema['$ref']))
    out = set(schema.get('properties', {}))
    for part in schema.get('allOf', []):
        out |= props(part)
    return out


def required(schema):
    if '$ref' in schema:
        return required(resolve(schema['$ref']))
    out = set(schema.get('required', []))
    for part in schema.get('allOf', []):
        out |= required(part)
    return out


def enum_of(schema, name):
    p = schema['properties'][name]
    return list(resolve(p['$ref']).get('enum', []) if '$ref' in p else p.get('enum', []))


# ---- 2. drift -----------------------------------------------------------------
drift = []
try:
    pairs = [('AttestationPayloadSimSwap', 'sim', 'sim'), ('AttestationPayloadTenure', 'tenure', 'tenure'), ('RefusalPayload', 'refusal', None)]
    for sname, ckey, akey in pairs:
        s = schemas[sname]
        claims = set(code[ckey]['payload'])
        if props(s) != claims:
            drift.append('%s properties %s != code %s' % (sname, sorted(props(s)), sorted(claims)))
        if required(s) != claims:
            drift.append('%s required %s != code %s' % (sname, sorted(required(s)), sorted(claims)))
        if s.get('additionalProperties') is not False:
            drift.append('%s is not closed (additionalProperties: false)' % sname)
        if akey:
            if enum_of(s, 'api') != [code['apis'][akey]]:
                drift.append('%s api enum %s != %s' % (sname, enum_of(s, 'api'), code['apis'][akey]))
    if sorted(enum_of(schemas['RefusalPayload'], 'api')) != sorted(code['knownApis']):
        drift.append('RefusalPayload api enum != KNOWN_APIS')
    if enum_of(schemas['RefusalPayload'], 'error') != code['reasons']:
        drift.append('RefusalPayload error enum %s != REFUSAL_REASONS %s' % (enum_of(schemas['RefusalPayload'], 'error'), code['reasons']))
    for ckey in ('sim', 'tenure', 'refusal'):
        if sorted(props(schemas['AttestationHeader'])) != sorted(code[ckey]['header']) or enum_of(schemas['AttestationHeader'], 'alg') != [code[ckey]['header']['alg']]:
            drift.append('AttestationHeader != code header (%s)' % ckey)
    # paths equal the known APIs (path = '/' + api)
    if sorted(p.lstrip('/') for p in doc['paths']) != sorted(code['knownApis']):
        drift.append('paths %s != KNOWN_APIS %s' % (sorted(doc['paths']), sorted(code['knownApis'])))
    # 200 response = answer key + attestation, nothing else
    for path, akey in (('/' + code['apis']['sim'], 'sim'), ('/' + code['apis']['tenure'], 'tenure')):
        answer_keys = set(code[akey]['payload']) - {'iss', 'aud', 'nonce', 'iat', 'exp', 'api', 'entry'}
        resp = doc['paths'][path]['post']['responses']['200']['content']['application/json']['schema']
        if props(resp) != answer_keys | {'attestation'}:
            drift.append('%s 200 properties %s != answer %s + attestation' % (path, sorted(props(resp)), sorted(answer_keys)))
    # menu example text equals menu.json
    menu = json.loads((POC / 'menu.json').read_text())
    if sorted(menu) != sorted(code['knownApis']):
        drift.append('menu.json keys != KNOWN_APIS')
    for api, entries in menu.items():
        line = '"%s": %s' % (api, json.dumps(entries))
        for path in doc['paths']:
            if line not in doc['paths'][path]['post'].get('description', ''):
                drift.append('menu line missing in %s description: %s' % (path, line))
except Exception as e:  # noqa: BLE001
    drift.append('exception: %r' % (e,))
report('2 drift against m1-jws.mjs, menu.json', not drift, '; '.join(drift))

# ---- 3. leak guard --------------------------------------------------------------
FORBIDDEN = {'maxAge', 'tenureDate', 'latestSimChange', 'contractType'}
leaks = []


def leak_visit(where):
    def f(n):
        for name in n.get('properties', {}) if isinstance(n.get('properties'), dict) else []:
            if name in FORBIDDEN:
                leaks.append('%s has property %s' % (where, name))
        if n.get('format') in ('date', 'date-time'):
            leaks.append('%s has format %s' % (where, n['format']))
    return f


for sname in ('AttestationPayloadSimSwap', 'AttestationPayloadTenure', 'RefusalPayload'):
    walk(schemas[sname], leak_visit(sname))
report('3a leak guard: payload schemas', not leaks, '; '.join(leaks))

leaks2 = []


def cc_visit(where):
    def f(n):
        if isinstance(n.get('properties'), dict) and 'contractType' in n['properties']:
            leaks2.append('%s has contractType' % where)
    return f


for path, item in doc['paths'].items():
    for code_, resp in item['post']['responses'].items():
        walk(resp, cc_visit('%s %s' % (path, code_)))
report('3b leak guard: no contractType in any response schema', not leaks2, '; '.join(leaks2))

print('exit %d' % (1 if failures else 0))
sys.exit(1 if failures else 0)
