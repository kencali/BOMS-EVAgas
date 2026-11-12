# BOMS — Technical Reference

## Current implementation reference — EVA Gas Trading

**Project root:** `C:\xampp\htdocs\BOMS-EVAgas`
**Architecture:** PHP JSON APIs + static HTML/CSS/vanilla JavaScript frontend
**Last updated:** 2026-11-12

This document describes the code currently present in the repository. It intentionally does not list passwords, JWT values, database credentials, or production host settings.

## 1. Architecture

```text
BOMS-EVAgas/
├── api/
│   ├── auth/                 login and logout endpoints
│   ├── config/               environment loader and PDO connection
│   ├── customer/             public customer delivery-request API
│   ├── dashboard/            Admin dashboard statistics
│   ├── deliveries/           delivery lifecycle and completion transaction
│   ├── employees/            employee records
│   ├── expenses/             expense records
│   ├── helpers/              auth, JWT, response, rate limit, location helpers
│   ├── inventory/            stock view and adjustments
│   ├── payroll/              payroll records
│   ├── products/             product records
│   ├── reports/              Admin report data
│   ├── routes/               route planning, location confirmation, Rider routes
│   └── sales/                POS sales and stock transaction
├── assets/
│   ├── css/                  shared, component, responsive, and page CSS
│   ├── images/               gas-cylinder image and local BOMS favicon
│   └── js/                   API/auth helpers, components, and role page scripts
├── database/
│   ├── migrations/           managed forward-only migrations
│   └── *.sql                 earlier/manual SQL artifacts; do not replay blindly
├── docs/                     operating, feature, and deployment documentation
└── public/
    ├── index.html            login page
    ├── admin/                Admin interfaces
    ├── customer/             public delivery-request portal
    ├── deliverer/            Rider dashboard, deliveries, and My Route
    └── employee/             Staff interfaces
```

The frontend uses `assets/js/api.js` for API requests. It derives the API base from the page path, supporting local XAMPP paths such as `/BOMS-EVAgas/public/...` and a production site served directly from `public/` when hosting is configured appropriately.

## 2. Authentication and authorization

### Login and JWT

1. `POST api/auth/login.php` accepts JSON credentials.
2. Login verifies the stored password hash, applies login throttling, and returns a JWT plus user role, branch, display name, and role redirect.
3. `assets/js/auth.js` stores the token locally and `assets/js/api.js` sends `Authorization: Bearer <token>` on protected requests.
4. `api/helpers/jwt.php` signs/verifies JWTs with `BOMS_JWT_SECRET`; token lifetime is eight hours.
5. `api/helpers/auth_check.php` validates the current `users` record on every protected request. A disabled account, changed role/branch, or changed `token_version` invalidates an earlier token.

### Roles and branch isolation

| Role | Scope |
|---|---|
| `admin` | Full own-branch write access; explicitly allowed cross-branch read access where endpoint policy permits it. |
| `employee` | Own-branch operational access only. |
| `deliverer` | Own assigned deliveries and own saved route only. |
| public customer | Only customer-request submission and reference/phone status lookup. |

`requireBranchAccess()` blocks cross-branch writes and permits cross-branch reads only for Admin users. Endpoint-specific checks further restrict Rider assignments and deliverer lookup behavior.

## 3. Configuration and security

### Environment

Server-side values are loaded through `api/config/env.php`.

Required production configuration includes:

```text
BOMS_APP_ENV=production
BOMS_JWT_SECRET=<32+ character random secret>
BOMS_DB_HOST=<host>
BOMS_DB_PORT=<port>
BOMS_DB_NAME=<database>
BOMS_DB_USER=<least-privilege application account>
BOMS_DB_PASS=<non-empty password>
```

Local `.env` is Git-ignored. The tracked `.env.example` contains placeholders only. Replacing the JWT signing secret invalidates all issued tokens.

### HTTP behavior

- Authenticated JSON APIs send `Cache-Control: no-store, private, max-age=0`.
- CORS allows only configured origins; local development uses local origins when no configured list is supplied.
- `.htaccess` forwards the Authorization header, prevents direct `.env` access, sets security headers where Apache supports them, and enables HTTPS redirect only when production configuration opts in.
- CSP allows the project’s current external resources: Google Fonts, Leaflet CDN assets, and OpenStreetMap tiles. Do not weaken it simply to remove source-map console warnings.

### Remaining security limitation

JWT is stored in browser local storage. This keeps the current architecture working but means an XSS vulnerability could expose a token. Moving to HttpOnly cookies requires a separate CSRF-aware design and is not partially implemented.

## 4. API reference

All endpoints return the standard shape:

```json
{ "success": true, "data": {} }
```

Errors return:

```json
{ "success": false, "message": "..." }
```

### Auth

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `api/auth/login.php` | Public | Login and role redirect data. |
| POST | `api/auth/logout.php` | Authenticated client | Local logout workflow. |

### Operations

| Endpoint | Main operations |
|---|---|
| `api/products/index.php` | Product list and Admin product management. |
| `api/inventory/index.php` | Branch stock view and permitted stock adjustments. |
| `api/sales/index.php` | Read sales, read a sale with items, create POS sale. |
| `api/deliveries/index.php` | List/create/edit/cancel deliveries, Rider status updates, completion, customer-request review, branch-safe deliverer lookup. |
| `api/routes/index.php` | Admin eligible stops, location search/confirmation, route plan creation; Rider `?mine=1` route retrieval. |
| `api/customer/index.php` | Customer request submission, products, and request status lookup. |
| `api/employees/index.php` | Admin employee records. |
| `api/payroll/index.php` | Admin payroll generation and release workflow. |
| `api/expenses/index.php` | Admin expense records. |
| `api/reports/index.php` | Admin summary, sales, expenses, payroll, and inventory data. |
| `api/dashboard/index.php` | Admin branch dashboard data. |

## 5. Delivery-to-sale workflow

### Creation

- Admin or permitted Employee creates a `Pending` delivery.
- Current stock is checked.
- No sale, sale item, or stock deduction is created at this stage.

### Cancellation

- Pending/On-the-way delivery cancellation sets `Cancelled` through the existing flow.
- No sale or stock deduction is created.

### Completion

`completeDelivery()` in `api/deliveries/index.php` is the authoritative completion path:

1. Locks the delivery and validates branch, Rider assignment where relevant, state, and duplicate completion protection.
2. Locks the product, rechecks stock, and generates a unique `sales.reference_no`.
3. Creates one `sales` row with `sale_type = 'delivery'` and the original `delivery_id`.
4. Creates the matching `sale_items` row.
5. Deducts stock atomically.
6. Sets `Delivered`, `delivered_at`, and `sale_confirmed = 1`.
7. Commits all changes or rolls them back together.

## 6. Customer requests and location confirmation

The CUST-001 migration adds delivery request metadata including:

```text
customer_reference
request_source
request_status
submitted_latitude
submitted_longitude
customer_request_token
```

Customer requests begin in `Pending Review`. Admin approval is required before normal delivery progression and before `confirm_location` can save final coordinates. `confirm_location` requires:

- Admin authorization and own-branch access
- `Pending` or `On the way` delivery state
- `Approved` customer request state when customer-request columns exist
- valid Malilipot, Albay coordinates

The final point is saved to `deliveries.latitude` and `deliveries.longitude` with `location_confirmed = 1`. The original customer point remains in `submitted_latitude`/`submitted_longitude` for review context.

## 7. Route planning and Rider maps

Admin Route Planning is single-rider VRP-style stop ordering, not live navigation or GPS tracking.

- `branch_locations` supplies the route start.
- Eligible stops are assigned to the selected Rider, approved where needed, active, and location-confirmed.
- OSRM provides road distance, duration, and geometry.
- A `delivery_routes` record and ordered `delivery_route_stops` records persist the recommendation.
- `api/routes/index.php?mine=1` returns only the authenticated Rider’s latest planned route.
- `assets/js/components/rider-route-map.js` is shared by Rider Dashboard and My Route so both show consistent geometry, branch marker, stop sequence, and statuses.

External OSRM, Nominatim, Leaflet CDN, and OpenStreetMap tiles are dependencies. Routing and location validation have explicit error responses when the providers are unavailable.

## 8. Frontend components

| Component | Purpose |
|---|---|
| `api.js` | Shared authenticated JSON request wrapper. |
| `auth.js` | Login state, guards, logout, role redirects. |
| `components/icons.js` | Local Lucide-style SVG icon registry. |
| `components/sidebar*.js` | Role-specific sidebar construction and responsive drawer integration. |
| `components/mobile-navigation.js` | Mobile header/drawer behavior. |
| `components/rider-route-map.js` | Shared Rider map renderer. |
| `light-theme.css` | Light-only theme variables, shared component styling, print rules. |
| `responsive.css` | Cross-role responsive layout rules. |

## 9. Reports and printing

The Reports API supplies filtered management data for sales, expenses, payroll, inventory, and summary views.

Implemented print output:

- Admin POS receipt
- Employee POS receipt

These use browser print / Save as PDF and existing authoritative sale values. No generic PDF library is installed. Multi-page report PDFs remain planned work because they need pagination, filter preservation, strict permissions, and print-layout validation.

## 10. Database and migrations

- The application uses MySQL/MariaDB through PDO with real prepared statements.
- Managed migrations live in `database/migrations/`.
- `scripts/migrate.php --status` is read-only; `--apply` must be run only after a backup and review.
- Do not replay historical SQL files in `database/prompts_results_dump_sql/` against an existing database.
- Backups and recovery instructions are in `docs/SEC-004-operations.md`.

## 11. Development validation commands

From the project root:

```powershell
C:\xampp\php\php.exe -l api\deliveries\index.php
C:\xampp\php\php.exe -l api\routes\index.php
node --check assets\js\deliverer\dashboard.js
node --check assets\js\components\rider-route-map.js
git diff --check
```

Syntax checks do not replace real browser, role, route, print, or production-host testing.

## 12. Deployment status

**Current verdict: NO-GO for public deployment.**

Before deployment, verify the production document-root strategy, environment values, database migrations, external HTTP support, backups and a separate restore test, HTTPS/security-header behavior, and the complete Admin/Employee/Rider/Customer manual test matrix.

See `docs/reports/POST-CUST-003-UI-PDF-DEPLOYMENT-READINESS.md` for the detailed evidence, remaining risks, and required deployment steps.
