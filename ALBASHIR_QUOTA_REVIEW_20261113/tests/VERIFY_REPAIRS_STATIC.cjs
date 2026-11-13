#!/usr/bin/env node
/**
 * ALBASHIR — Static Verification Suite for vNext_FIXED (v6)
 * User-supplied v6 version, retained for debugging (includes known regex defect).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT_DIR = path.resolve(__dirname, '..');
const SQL_FIXED_PATH = path.join(ROOT_DIR, 'sql', 'REVIEW_ONLY_release_new_photo_upload_quota_vNext_FIXED.sql');
const Q14F_PATH = path.join(ROOT_DIR, 'tests', 'sql', 'Q14f.sql');
const Q14G_PATH = path.join(ROOT_DIR, 'tests', 'sql', 'Q14g.sql');
const Q14H_PATH = path.join(ROOT_DIR, 'tests', 'sql', 'Q14h.sql');

function stripSqlComments(sql) {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function runStaticVerification() {
  const sqlRaw = fs.readFileSync(SQL_FIXED_PATH, 'utf8');
  const sqlCode = stripSqlComments(sqlRaw);

  assert.match(sqlCode, /RAISE\s+EXCEPTION\s+'REVIEW ONLY: DO NOT EXECUTE/i,
    '[FAIL] Deployment lock block is missing or modified.');

  assert.match(sqlCode, /SECURITY\s+DEFINER/i, '[FAIL] Missing SECURITY DEFINER.');
  assert.match(sqlCode, /SET\s+search_path\s+TO\s+'pg_catalog'/i, '[FAIL] Missing SET search_path TO pg_catalog.');
  assert.match(sqlCode, /SET\s+row_security\s+TO\s+'off'/i, '[FAIL] Missing SET row_security TO off.');

  assert.doesNotMatch(sqlCode, /SET\s+CONSTRAINTS\b/i,
    '[FAIL] Function body still contains SET CONSTRAINTS which mutates caller constraint states (Q14f/Q14g).');

  assert.match(sqlCode,
    /t\.tgdeferrable\s*=\s*true\s+OR\s+pg_catalog\.coalesce\(con\.condeferrable,\s*false\)\s*=\s*true/i,
    '[FAIL] Missing fail-closed catalog check for deferrable triggers and constraints.');

  const quotaLockIdx = sqlCode.search(/FROM\s+private\.new_photo_upload_quotas[\s\S]*?ORDER\s+BY\s+q\.scope_key\s+COLLATE\s+"C"\s+ASC\s+FOR\s+UPDATE/i);
  const claimLockIdx = sqlCode.search(/FROM\s+private\.new_photo_upload_claims[\s\S]*?FOR\s+UPDATE/i);

  assert.ok(quotaLockIdx > 0, '[FAIL] Missing canonical COLLATE "C" FOR UPDATE lock on private.new_photo_upload_quotas.');
  assert.ok(claimLockIdx > 0, '[FAIL] Missing FOR UPDATE lock on private.new_photo_upload_claims.');
  assert.ok(quotaLockIdx < claimLockIdx,
    '[FAIL] Lock order violation: private.new_photo_upload_quotas must be locked BEFORE private.new_photo_upload_claims.');

  assert.doesNotMatch(sqlCode, /GREATEST\s*\(\s*0/i,
    '[FAIL] Counter underflow masking via GREATEST(0, ...) is prohibited.');
  assert.match(sqlCode, /IF\s+v_verified_scopes\s*<>\s*3\s+THEN/i,
    '[FAIL] Missing post-loop 3-scope row verification guard (Q14c).');

  for (const [label, filePath, marker] of [
    ['Q14f.sql', Q14F_PATH, 'shared_deferrable_invariant_con'],
    ['Q14g.sql', Q14G_PATH, 'con_init_immediate_made_deferred'],
    ['Q14h.sql', Q14H_PATH, 'v_res_idempotent']
  ]) {
    assert.ok(fs.existsSync(filePath), `[FAIL] Missing required test file: ${label}`);
    const content = fs.readFileSync(filePath, 'utf8');
    assert.match(content, new RegExp(marker), `[FAIL] ${label} is missing expected test marker: ${marker}`);
  }

  console.log('PASS: VERIFY_REPAIRS_STATIC.cjs verified vNext_FIXED (v6) and Q14f/Q14g/Q14h successfully.');
}

runStaticVerification();