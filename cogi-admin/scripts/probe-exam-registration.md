# Probe Exam Registration

HTTP-only probe for learner-facing exam registration against an already running Strapi dev instance.

## Preconditions

- Use only on the dev database.
- Strapi must already be running and reachable.
- Default base URL: `http://localhost:1340`
- The script does **not** start or restart Strapi.

## Env

- `STRAPI_BASE_URL`
  Default: `http://localhost:1340`
- `PROBE_HTTP_TIMEOUT_MS`
  Default: `10000`

DB connection is read from `cogi-admin/.env`.

## Modes

Full run:

```powershell
node scripts/probe-exam-registration.js
```

Setup only:

```powershell
node scripts/probe-exam-registration.js --setup-only
```

Cleanup only:

```powershell
node scripts/probe-exam-registration.js --cleanup .tmp/probe-exam-registration-<runId>.json
```

Keep fixtures for debugging:

```powershell
node scripts/probe-exam-registration.js --keep-fixtures
```

Dry run:

```powershell
node scripts/probe-exam-registration.js --dry-run
```

## Manifest

Every run writes a manifest to:

```text
.tmp/probe-exam-registration-<runId>.json
```

The manifest tracks created IDs so cleanup can delete only probe-owned records.

## Server Down Behavior

- In full mode or setup-only mode, the script checks `STRAPI_BASE_URL` first.
- If the server is down, it prints `SERVER_NOT_READY`, does not create fixtures, and exits non-zero.
- Cleanup-only mode can still run while the server is down because it uses direct DB cleanup with manifest IDs.

## Safety

- JWTs and passwords are not logged.
- Cleanup deletes only manifest-owned records.
- `--keep-fixtures` preserves data for debugging and leaves the manifest in place.
