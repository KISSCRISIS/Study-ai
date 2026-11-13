#!/usr/bin/env python3
"""Synthetic-only same-lease two-session concurrency regression for PostgreSQL 16.

Proves that simultaneous release invocations cannot double-decrement in the
specific scenario covered. Does NOT prove global deadlock-freedom.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import subprocess
import sys
import threading

LEASE = '14a00000-0000-4000-8000-00000000014a'

def psql(cid: str, db: str, sql: str) -> str:
    command = ['docker','exec','-i',cid,'psql','-X','-A','-t','-q',
               '-v','ON_ERROR_STOP=1','-U','postgres','-d',db]
    p = subprocess.run(command, input=sql, text=True, capture_output=True, timeout=30, check=False)
    if p.returncode:
        raise RuntimeError(f'psql exit={p.returncode}; stderr={p.stderr}; stdout={p.stdout}')
    return p.stdout.strip()

def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit('usage: Q14l_concurrency.py <created-container-id> <synthetic-db>')
    cid, db = sys.argv[1:]
    if db != 'review_q14l':
        raise SystemExit('refusing unexpected database')

    barrier = threading.Barrier(2)
    def release() -> str:
        barrier.wait(timeout=10)
        out = psql(cid, db, f'''BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL lock_timeout = '10s';
SELECT public.release_new_photo_upload_quota('{LEASE}'::uuid)->>'reason';
COMMIT;
''')
        reasons = [line for line in out.splitlines() if line in ('RELEASED','ALREADY_RELEASED')]
        if len(reasons) != 1:
            raise AssertionError(f'unexpected release response: {out!r}')
        return reasons[0]

    with ThreadPoolExecutor(max_workers=2) as pool:
        f1, f2 = pool.submit(release), pool.submit(release)
        reasons = sorted([f1.result(), f2.result()])
    if reasons != ['ALREADY_RELEASED','RELEASED']:
        raise AssertionError(f'expected one release and one idempotent call, got {reasons!r}')

    rows = psql(cid, db, """SELECT scope_key || '|' || attempt_count
FROM private.new_photo_upload_quotas
WHERE scope_key IN ('emp:q14j','src:q14j','global') ORDER BY scope_key;
""")
    actual = dict(x.split('|',1) for x in rows.splitlines())
    if actual != {'emp:q14j':'1','global':'4','src:q14j':'2'}:
        raise AssertionError(f'quota counts changed unexpectedly: {actual!r}')
    status = psql(cid, db, f"SELECT status FROM private.new_photo_upload_claims WHERE lease_id='{LEASE}'::uuid;")
    if status != 'RELEASED':
        raise AssertionError(f'unexpected final claim status {status!r}')
    print('PASS: simultaneous same-lease release calls yielded one RELEASED, one ALREADY_RELEASED, and exactly one decrement')
    print('LIMITATION: does not exercise other lifecycle functions or prove system-wide deadlock freedom')

if __name__ == '__main__':
    main()
