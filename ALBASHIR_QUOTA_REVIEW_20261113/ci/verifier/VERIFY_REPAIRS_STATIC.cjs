#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_V62 = path.join(ROOT, 'sql', 'REVIEW_ONLY_release_new_photo_upload_quota_v6_2_LOCAL_CANDIDATE.sql');
const SOURCE_V63 = path.join(ROOT, 'sql', 'REVIEW_ONLY_release_new_photo_upload_quota_v6_3_LOCAL_CANDIDATE.sql');
const TEST_SQL = path.join(ROOT, 'ci', 'generated', 'release_new_photo_upload_quota_v6_3_TEST_ONLY.sql');
const TEST_DIR = path.join(ROOT, 'ci', 'tests');
const EXPECTED_V62_SHA256 = 'fcde0f620de2de3b5086f089b814554a06655a651c38ccec0ec83f65e1343164';

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

// Remove comments without treating comment-like characters inside literals as comments.
function stripComments(sql) {
  let out = '';
  let i = 0;
  let state = 'normal';
  let dollarTag = '';
  while (i < sql.length) {
    const c = sql[i];
    const n = sql[i + 1];
    if (state === 'line') {
      if (c === '\n') { out += '\n'; state = 'normal'; } else { out += ' '; }
      i += 1;
      continue;
    }
    if (state === 'block') {
      if (c === '*' && n === '/') { out += '  '; i += 2; state = 'normal'; }
      else { out += c === '\n' ? '\n' : ' '; i += 1; }
      continue;
    }
    if (state === 'single') {
      out += c;
      if (c === "'" && n === "'") { out += n; i += 2; continue; }
      if (c === "'") state = 'normal';
      i += 1;
      continue;
    }
    if (state === 'double') {
      out += c;
      if (c === '"' && n === '"') { out += n; i += 2; continue; }
      if (c === '"') state = 'normal';
      i += 1;
      continue;
    }
    if (state === 'dollar') {
      if (sql.startsWith(dollarTag, i)) { out += dollarTag; i += dollarTag.length; state = 'normal'; }
      else { out += c; i += 1; }
      continue;
    }
    if (c === '-' && n === '-') { out += '  '; i += 2; state = 'line'; continue; }
    if (c === '/' && n === '*') { out += '  '; i += 2; state = 'block'; continue; }
    if (c === "'") { out += c; state = 'single'; i += 1; continue; }
    if (c === '"') { out += c; state = 'double'; i += 1; continue; }
    if (c === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) { dollarTag = match[0]; out += dollarTag; i += dollarTag.length; state = 'dollar'; continue; }
    }
    out += c;
    i += 1;
  }
  return out;
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function getFunctionBody(sql) {
  const clean = stripComments(sql);
  const start = clean.indexOf('AS $function$');
  requireCondition(start >= 0, 'function dollar-quoted body is missing');
  const bodyStart = start + 'AS $function$'.length;
  const end = clean.indexOf('$function$', bodyStart);
  requireCondition(end > bodyStart, 'function dollar-quoted body is unterminated');
  // The outer dollar quote makes function-body comments literal to the SQL
  // lexer, so strip them once more after extracting the PL/pgSQL source.
  return stripComments(clean.slice(bodyStart, end));
}

// Extract a single PL/pgSQL statement from a known function body anchor.
// The terminator is the first semicolon after the anchor; patterns cannot flow
// into later statements or use an earlier unlocked SELECT as false evidence.
function statementFrom(body, anchor, label) {
  const at = body.indexOf(anchor);
  requireCondition(at >= 0, `${label}: statement anchor not found`);
  const end = body.indexOf(';', at);
  requireCondition(end > at, `${label}: statement terminator not found`);
  return body.slice(at, end + 1);
}

function verifyLockOrder(sql) {
  const body = getFunctionBody(sql);
  const quota = statementFrom(body, 'PERFORM q.scope_key', 'quota locking query');
  const claim = statementFrom(body, 'SELECT *\n  INTO v_claim', 'claim locking query');
  requireCondition(/FROM\s+private\.new_photo_upload_quotas\b/i.test(quota), 'quota lock statement targets the wrong table');
  requireCondition(/ORDER\s+BY\s+q\.scope_key\s+COLLATE\s+"C"\s+ASC\s+FOR\s+UPDATE/i.test(quota), 'quota lock statement lacks ordered COLLATE "C" FOR UPDATE');
  requireCondition(/FROM\s+private\.new_photo_upload_claims\b/i.test(claim), 'claim lock statement targets the wrong table');
  requireCondition(/FOR\s+UPDATE/i.test(claim), 'claim lock statement lacks FOR UPDATE');
  requireCondition(body.indexOf(quota) < body.indexOf(claim), 'claim row is locked before quota rows');
}

function verifyCore(sql) {
  const clean = stripComments(sql);
  const body = getFunctionBody(sql);
  requireCondition(/SECURITY\s+DEFINER/i.test(clean), 'SECURITY DEFINER is missing');
  requireCondition(/SET\s+search_path\s+TO\s+'pg_catalog'/i.test(clean), 'fixed pg_catalog search_path is missing');
  requireCondition(/SET\s+row_security\s+TO\s+'off'/i.test(clean), 'row_security setting is missing');
  requireCondition(!/\bSET\s+CONSTRAINTS\b/i.test(body), 'function body changes caller constraint modes');
  requireCondition(!/\bGREATEST\s*\(\s*0\s*,\s*[^)]*attempt_count/i.test(body), 'counter underflow is masked with GREATEST');
  requireCondition(!/pg_catalog\.(?:coalesce|nullif)\s*\(/i.test(body), 'special SQL expression was qualified as an ordinary function');
  requireCondition(!/current_setting\s*\(\s*'(?:(?:request\.jwt\.claim\.role)|role)'/i.test(body), 'caller-controlled role GUC is used as an authorization signal');
  requireCondition(/pg_catalog\.pg_constraint/i.test(body) && /pg_catalog\.pg_trigger/i.test(body), 'catalog guard does not inspect both constraints and triggers');
  requireCondition(/v_verified_scopes\s*<>\s*3/i.test(body), 'post-loop three-scope verification is missing');
  verifyLockOrder(sql);
}

function verifyQ14Tests() {
  const f = stripComments(read(path.join(TEST_DIR, 'Q14f.sql')));
  const guards = stripComments(read(path.join(TEST_DIR, 'Q14f_target_guards.sql')));
  const g = stripComments(read(path.join(TEST_DIR, 'Q14g.sql')));
  const h = stripComments(read(path.join(TEST_DIR, 'Q14h.sql')));
  requireCondition(!/request\.jwt\.claim\.role/i.test(`${f}\n${g}\n${h}`), 'Q14f/g/h unnecessarily rely on a JWT claim GUC');
  requireCondition(/shared_deferrable_invariant_con/i.test(f) && /q14f_sibling_ledger/i.test(f), 'Q14f off-target duplicate-name deferred-FK case is incomplete');
  requireCondition(/IS\s+DISTINCT\s+FROM\s+3/i.test(f) && /IS\s+DISTINCT\s+FROM\s+1/i.test(f), 'Q14f lacks NULL-safe row/counter assertions');
  requireCondition(/new_photo_upload_quotas[\s\S]*DEFERRABLE/i.test(guards) && /new_photo_upload_claims[\s\S]*DEFERRABLE/i.test(guards), 'independent target-table deferrable guards are missing');
  requireCondition(/SET\s+CONSTRAINTS[\s\S]*?DEFERRED/i.test(g) && /SET\s+CONSTRAINTS[\s\S]*?IMMEDIATE/i.test(g), 'Q14g caller modes are not set');
  requireCondition(/SQLSTATE\s+'23503'/i.test(g), 'Q14g does not assert the exact immediate FK SQLSTATE');
  requireCondition(/WHEN\s+SQLSTATE\s+'P0001'/i.test(h) && /quota count not positive/i.test(h), 'Q14h does not isolate the intended SQLSTATE/message');
  requireCondition(/v_rows\s+IS\s+DISTINCT\s+FROM\s+3/i.test(h), 'Q14h lacks explicit three-row existence checks');
  requireCondition(/IS\s+DISTINCT\s+FROM/i.test(h), 'Q14h lacks NULL-safe assertions');
  requireCondition(!/WHEN\s+OTHERS/i.test(h), 'Q14h catches arbitrary errors');
}

function verify() {
  const v62 = read(SOURCE_V62);
  const v63 = read(SOURCE_V63);
  const testVariant = read(TEST_SQL);
  requireCondition(crypto.createHash('sha256').update(v62).digest('hex') === EXPECTED_V62_SHA256, 'locked v6.2 source fingerprint changed');
  requireCondition((stripComments(v62).match(/\$deployment_lock\$/g) || []).length === 2, 'v6.2 deployment lock is missing or altered');
  requireCondition((stripComments(v63).match(/\$deployment_lock\$/g) || []).length === 2, 'v6.3 review candidate must retain the deployment lock');
  requireCondition(!stripComments(testVariant).includes('$deployment_lock$'), 'derived test variant still contains a deployment lock');
  verifyCore(v63);
  verifyCore(testVariant);
  const v63Body = getFunctionBody(v63);
  requireCondition(!/current_setting\s*\(\s*'(?:(?:request\.jwt\.claim\.role)|role)'/i.test(v63Body), 'v6.3 uses a role GUC for authorization');
  requireCondition(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.release_new_photo_upload_quota\(uuid\)\s+FROM\s+PUBLIC/i.test(v63), 'PUBLIC EXECUTE revoke is missing');
  requireCondition(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.release_new_photo_upload_quota\(uuid\)\s+TO\s+service_role/i.test(v63), 'service_role EXECUTE grant is missing');
  verifyQ14Tests();
}

function selfTest() {
  verify();
  const valid = read(TEST_SQL);
  const badLock = valid.replace(/ORDER BY q\.scope_key COLLATE "C" ASC\s+FOR UPDATE/i, 'ORDER BY q.scope_key COLLATE "C" ASC');
  assert.notEqual(badLock, valid, 'negative fixture failed to mutate quota lock');
  assert.throws(() => verifyLockOrder(badLock), /ordered COLLATE/,
    'negative test: checker did not reject a quota lock with ORDER BY but no FOR UPDATE');
  const badGuc = valid.replace('v_emp_scope text;', "v_emp_scope text;\n  v_req_jwt_role text := current_setting('request.jwt.claim.role', true);");
  assert.notEqual(badGuc, valid, 'negative fixture failed to add GUC');
  assert.throws(() => verifyCore(badGuc), /GUC/,
    'negative test: checker did not reject caller-controlled authorization GUC');
  const badUnderflow = valid.replace('q.attempt_count - 1', 'GREATEST(0, q.attempt_count - 1)');
  assert.notEqual(badUnderflow, valid, 'negative fixture failed to add underflow masking');
  assert.throws(() => verifyCore(badUnderflow), /GREATEST/,
    'negative test: checker did not reject masked underflow');
  console.log('PASS: negative static mutations were all detected (lock, GUC authorization, underflow).');
}

try {
  if (process.argv.includes('--self-test')) selfTest();
  else {
    verify();
    console.log('PASS: static structure and review-only invariants checked; this is not a PostgreSQL execution PASS.');
  }
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
