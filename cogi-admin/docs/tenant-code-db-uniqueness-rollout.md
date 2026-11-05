# Tenant code DB-level uniqueness rollout (PostgreSQL)

## Scope

- Add functional unique index: `public.tenants (lower(btrim(code))) WHERE code IS NOT NULL`
- Keep existing tenant data unchanged.
- Map PostgreSQL unique violation `23505` to HTTP 409 only when index/constraint is `tenants_code_ci_unique`.

## Migration transaction behavior and DDL choice

Strapi user migrations are wrapped in a transaction by default:

- [`users.js`](../node_modules/@strapi/database/dist/migrations/users.js) uses `wrapTransaction(db)(migration.up)`
- [`common.js`](../node_modules/@strapi/database/dist/migrations/common.js) executes `db.transaction(...)`

Because of this, `CREATE UNIQUE INDEX CONCURRENTLY` is **not** used in this migration (PostgreSQL forbids it inside a transaction block).  
The migration uses `CREATE UNIQUE INDEX` and validates the created index metadata.

## Pre-check (required before rollout)

Run:

```bash
npm run precheck:tenant-code-uniqueness
```

The pre-check fails fast when any of the following is found:

- duplicate `lower(btrim(code))`
- `NULL` code
- empty code after trim
- leading/trailing whitespace
- existing `tenants_code_ci_unique` index that is not `unique` / `indisvalid` / `indisready` / expected expression

Exit code:

- `0`: all checks pass
- `1`: failed checks or execution error
- `2`: unsupported DB client (script is PostgreSQL-only)

## Rollout

1. Run pre-check and ensure exit code `0`.
2. Run Strapi migrations in your deployment flow.
3. Verify index status:
   - `indisunique = true`
   - `indisvalid = true`
   - `indisready = true`
   - `pg_get_indexdef` matches `lower(btrim(code))` expression

## Rollback

Rollback migration (or run equivalent SQL):

```sql
DROP INDEX IF EXISTS public.tenants_code_ci_unique;
```

Then rerun pre-check to confirm expected post-rollback state (index absent).
