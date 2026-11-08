# SEC-004 operations guide

## Environment

Keep `.env`, backup folders, PHP error logs, and database credentials outside the public document root and outside Git. The tracked `.env.example` lists the required database/JWT values and optional backup settings.

The current repository stores `api/` and `assets/` beside `public/`. Before changing a production virtual host to use `public/` as its document root, configure the host to expose the existing `/api` and `/assets` paths safely (for example through explicit aliases/routing with directory listing disabled), or deploy an equivalent approved layout. Do not expose the project root merely to make those paths work. Test the final paths with an authenticated request and a CSS/JS asset request.

The browser API client derives its API base from the page path: local XAMPP pages under `/BOMS-EVAgas/public/` use `/BOMS-EVAgas/api`; a production site served directly from `public/` uses `/api`. If a deployment uses another prefix, set `data-api-base="/prefix"` on the page's `<html>` element.

## Migrations

Managed forward-only SQL migrations belong in `database/migrations/` and must use this filename format:

`YYYYMMDDHHMMSS_short_description.sql`

Do not move older SQL files into this directory: they were applied manually and are not safe to replay against an existing database. New migrations should be small, reviewed, and backed up first. Never put `DROP`, `TRUNCATE`, or routine data deletion in a BOMS migration.

Run from the project root:

```powershell
C:\xampp\php\php.exe scripts\migrate.php --status
C:\xampp\php\php.exe scripts\migrate.php --apply
```

`--status` is read-only. `--apply` creates `schema_migrations` if needed, obtains a database advisory lock, runs pending files in filename order, then records the filename and SHA-256 checksum only after success. It stops on the first failure and never silently skips it. Do not edit an applied migration; create a new migration instead. MySQL DDL can commit implicitly, so inspect a failed migration and restore from a backup only after authorization.

Use a separate deployment account with only the schema privileges needed for migrations. The normal application account should remain least-privilege.

## Backups

Set these server-side values (or add them only to the ignored local `.env`):

```text
BOMS_BACKUP_DIR=C:\xampp\backups\boms
BOMS_MYSQLDUMP_PATH=C:\xampp\mysql\bin\mysqldump.exe
BOMS_BACKUP_RETENTION_DAYS=30
```

`BOMS_BACKUP_DIR` must be outside the public document root. Restrict that folder to the server/service account and authorized administrators. The backup command creates a timestamped logical SQL dump using `mysqldump --single-transaction --routines --events --triggers`; credentials are passed through a temporary file and are never placed on the command line or written to the project.

```powershell
C:\xampp\php\php.exe scripts\database-backup.php
```

The command writes `boms_YYYYMMDD_HHMMSS.sql` and an operational `backup.log`. It does not delete any prior backup unless `--prune` is explicitly supplied:

```powershell
C:\xampp\php\php.exe scripts\database-backup.php --prune
```

Verify the retention period and a restoration test before scheduling `--prune`. On Windows, create a Task Scheduler task running the command above with “Run whether user is logged on or not”, a protected service account, and a daily schedule. On production hosting, use the host scheduler/cron under the web application's service account, with the same outside-web-root backup location and access controls.

### Restoration procedure

1. Obtain authorization and select the timestamped backup to recover.
2. Verify its filename, non-zero size, access permissions, and optionally its SHA-256 hash.
3. Create a separate empty test database; never test against the active BOMS database.
4. Restore to that test database with the local MySQL/MariaDB client.
5. Check tables, foreign-key relationships, expected user roles, sales, sale items, delivery records, inventory quantities, payroll, and expenses.
6. Have an authorized administrator review the result and decide whether a production restoration is necessary.
7. Before any final production restoration, take a new backup of the active database and follow the host's approved maintenance procedure.

The project does not automatically restore databases. A backup is not considered proven until the separate test restoration succeeds.

## Caching and assets

Authenticated API responses continue to return `Cache-Control: no-store, private`. Static CSS, JavaScript, images, fonts, and icons use `ETag` (file modification time and size) plus `Cache-Control: public, max-age=0, must-revalidate`. This gives each deployed file revision a validator-based version without editing asset URLs across every page: browsers reuse unchanged assets but revalidate before using a changed one.

Ensure Apache `mod_headers` is enabled in production. Do not add cache headers to PHP/API responses that override the API's private no-store policy.

## Pagination and query conventions

Existing operational list endpoints retain their current response formats and fixed caps where present (sales and deliveries) to avoid breaking the established UI. Current local record counts are small, so pagination was not introduced prematurely. If a module grows beyond its practical UI limit, add a server-validated `page` and `page_size` parameter with a maximum, preserve existing branch/role filters, return a total count, and keep dashboards/reports based on the complete filtered dataset—not the display page.

Sales date filtering uses index-friendly half-open ranges (`sale_date >= start` and `< end + 1 day`) rather than `DATE(sale_date)`. This preserves inclusive calendar-date results while allowing the existing `(branch_id, sale_date)` index to be considered.
