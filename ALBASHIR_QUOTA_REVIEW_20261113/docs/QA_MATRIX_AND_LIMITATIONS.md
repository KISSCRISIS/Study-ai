# ALBASHIR — Q01–Q14 verification matrix

**All rows are NOT RUN in this assistant's local environment unless explicitly stated.**
The uploaded `FINAL_REPORT.md` contains claimed PostgreSQL 16.15 results but no raw, independently verified logs. Do not transfer those PASS values to this matrix.

| ID | Synthetic test script | Current execution | Scope limitation |
|---|---|---|---|
| Q01 normal release | `08_QA_PG16_Q01_Q09_AND_Q14.sql` | NOT RUN | Needs Docker PostgreSQL 16 |
| Q02 repeated release | `08_...sql` | NOT RUN | Needs Docker PostgreSQL 16 |
| Q03 cancel claim update trigger | `08_...sql` | NOT RUN | Needs Docker PostgreSQL 16 |
| Q04 rewrite claim status trigger | `08_...sql` | NOT RUN | Needs Docker PostgreSQL 16 |
| Q05 suppress quota update | `08_...sql` | NOT RUN | Needs Docker PostgreSQL 16 |
| Q06 finite AFTER quota counter rewrite | `08_...sql` | NOT RUN | Needs Docker PostgreSQL 16 |
| Q07 zero counter | `08_...sql` | NOT RUN | Needs Docker PostgreSQL 16 |
| Q08 missing quota scope | `08_...sql` | NOT RUN | Owner policy still unapproved |
| Q09 rolled quota window | `08_...sql` | NOT RUN | Owner policy still unapproved |
| Q10 same-lease concurrent RELEASE | `09_RUN_QA_PG16_LOCAL_ONLY.py` | NOT RUN | Two real psql sessions, positive observed blocking, both orders |
| Q11 RELEASE vs actual FINALIZE/CLAIMED | No valid original function | BLOCKED | Uploaded script only simulates FINALIZE with UPDATE |
| Q12 RELEASE A vs actual successful FINALIZE B/CONSUMED | No valid original function | BLOCKED | Uploaded script only simulates FINALIZE with UPDATE |
| Q13 CLAIM / CONSUME / SUPERSEDE / CLEANUP | No valid original functions | BLOCKED | Cannot prove lock-order compatibility |
| Q14 finite AFTER claim rewrite | `08_QA_PG16_Q01_Q09_AND_Q14.sql` | NOT RUN | Needs PG16; deferred triggers unreviewed |
| Q14 deferred triggers | No actual trigger inventory | BLOCKED | Cannot guarantee commit-time invariants |
| Access control | `08_...sql` | NOT RUN | Synthetic ACL only, not actual Supabase ACL |

## PGlite and Chromium
- **PGlite:** appropriate for parsing/simple transactional regression only; does **not** replace a real two-session PG16 lock contention test. The supplied original PGlite/Chromium fixtures depend on missing SQL / Edge handler files. Do not strip assertions or claim PASS based on synthetic stubs.
- **Chromium:** should cover the actual frontend and Edge upload handler after those sources and isolated test deployment are available. A SQL-only candidate is not sufficient for browser-level proof. No Chromium integration test is claimed in this package.

## Explicit PASS requirement
Any test with an expected error must assert the precise SQLSTATE and final persisted state, and fail the process on mismatch. `Q10` requires *positive* observation of `pg_blocking_pids(waiter)`, a single successful release, a single `ALREADY_RELEASED`, and exactly one decrement across all three scopes after COMMIT.

## Release decision
**NO-GO** unless all Q01–Q14 actual paths pass, full original SQL/trigger/ACL snapshots match the reviewed contract, and a rollback from the verified prior function definition is rehearsed. PostgreSQL 16 synthetic testing alone cannot make this a GO.