## PostgreSQL Installation

- Downloaded from https://www.postgresql.org/download/ and installed via the Windows installer (server + pgAdmin + CLI tools).
- Install config used: port `5432`, superuser `postgres`, password set during install; server runs at `localhost:5432`.

### PATH configuration

- Add `C:\\Program Files\\PostgreSQL\\<version>\\bin` to PATH in the edit the system environment variables so commands like `psql --version` work.

### Stack Builder

- Skipped (no extra extensions required for this project). Use it later for PostGIS/other tools if needed.

## VS Code PostgreSQL extensions

- Install `SQLTools` and `SQLTools PostgreSQL/CockroachDB` driver (Extensions panel `Ctrl+Shift+X`).
- Add connection (`Ctrl+Shift+P` → `SQLTools: Add New Connection` → PostgreSQL):
  - Name: `Dev DB`
  - Group: `Shift Setting`
  - Server: `localhost`
  - Port: `5432`
  - Database: `shift_setting`
  - User: `postgres`, Password: your value, SSL: disabled (local).
- Connect via SQLTools sidebar and test with `SELECT version();`.

## Project database setup

- `.env` is set to `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shift_setting?schema=public`.
- Create DB if missing: `psql -h localhost -U postgres -c "CREATE DATABASE shift_setting;"`.
- Apply Prisma schema: `npx prisma migrate deploy` (creates tables: Timesheet, TimesheetRow, Payroll, PayrollEntry).
- Verify connectivity: `psql -h localhost -U postgres -d shift_setting -c "\\dt"`.

## Next.js connection details (current code)

- Driver: `pg` via Prisma adapter; code in `lib/db.ts` builds a `Pool` and passes it to `PrismaClient`.
- Usage in API routes (e.g., `app/api/timesheets/route.ts`) relies on `prisma` from `lib/db.ts`.
- Ensure `DATABASE_URL` matches your local credentials; restart dev server after changing it.

## Alternate installs (if not using the Windows installer)

- macOS: `brew install postgresql` → `brew services start postgresql`.
- Windows (Chocolatey): `choco install postgresql` → add `bin` to PATH.
- Docker: `docker run --name shift-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=shift_setting -p 5432:5432 -d postgres:16`.

