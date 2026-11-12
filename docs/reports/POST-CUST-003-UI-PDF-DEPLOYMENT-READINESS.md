# Post-CUST-003 UI, PDF, and deployment readiness review

**Date:** 2026-11-12  
**Scope:** local source inspection and targeted local changes only. No hosting account, live database, or production credentials were used.

## 1. Executive summary

This work improved the customer-header presentation, browser branding, Admin delivery-update indication, Admin route-page mobile containment, Rider dashboard route visibility, POS receipt printing, and the remaining CUST-003 backend guard.

The project is **not ready for public InfinityFree deployment**. The code has a safer configuration model than the original local-only setup, but production deployment still requires a verified secure document-root layout, a production environment file outside the web root, production database setup, applied migration verification, backup/restore proof, and live hosting compatibility tests for cURL-based routing and geocoding.

## 2. Files modified

- `assets/images/boms-favicon.svg` — local BOMS flame favicon.
- `public/index.html`, all current Admin, Employee, Deliverer, and Customer HTML entry pages — reference the common favicon.
- `assets/css/pages/customer-portal.css` — removes the browser default outer body margin that detached the public header.
- `assets/css/pages/routes.css` — narrows route-page layout behavior on small screens and prevents route content from forcing horizontal overflow.
- `public/admin/routes.html` — reformatted existing page without changing route behavior; adds favicon.
- `public/deliverer/dashboard.html`, `assets/js/deliverer/dashboard.js`, and `assets/css/pages/deliverer-dashboard.css` — dashboard route overview.
- `public/deliverer/route.html`, `assets/js/deliverer/route.js`, and `assets/js/components/rider-route-map.js` — shared Rider route rendering.
- `assets/js/components/sidebar.js`, `assets/css/light-theme.css`, and `api/deliveries/index.php` — Admin customer-request update indicator.
- `api/routes/index.php` — approved-request requirement before Admin location confirmation.
- `public/admin/pos.html`, `public/employee/pos.html`, `assets/js/admin/pos.js`, and `assets/js/employee/pos.js` — print receipt action.

Existing uncommitted CUST-001/CUST-003 changes were preserved and not discarded.

## 3. Customer header and branding

The customer page had no `margin: 0` on its body class, so the browser default body margin made the header look inset and detached. The change removes only that outer margin. It does not change card or field borders.

The new local SVG favicon uses the EVA/BOMS orange-and-flame identity. It has no external dependency and is referenced by all current HTML entry pages.

## 4. Notification indicator implementation

Only Admin Deliveries received an indicator because customer request submissions have a reliable server timestamp and branch association. The sidebar calls a lightweight endpoint that returns the latest customer-request timestamp for the authenticated Admin's branch. A red dot appears only when that timestamp is newer than the timestamp last seen by that Admin and branch in browser local storage.

Opening Admin Deliveries clears the stored unseen state. First use establishes a baseline rather than treating old records as new. This is page-load/refresh detection, **not real-time notification**, and local storage does not synchronize seen state across devices or browsers.

## 5. Admin Route Planning responsive fix

The route content now has an explicit shrinkable main content area and clipped horizontal overflow. At 480px and below, planning controls stack; the route map is constrained to its card width. Existing desktop two-column layout and Leaflet resize behavior remain unchanged.

The Leaflet `leaflet.js.map` console item is a source-map retrieval warning from the external Leaflet CDN. It is not evidence that Leaflet runtime code failed. CSP was not weakened to hide it.

## 6. Rider My Route map on dashboard

The Rider Dashboard now loads `routes/index.php?mine=1` after authentication and uses the same extracted renderer as My Route. It displays only the route returned for the authenticated Rider, including the saved road geometry, branch marker, numbered stops, customer/address/status popup information, summary, and ordered stop list.

When no route exists, the dashboard hides the map and displays a no-route state. My Route remains the full dedicated view; it now uses the shared renderer, preventing route display drift between the two pages.

## 7. PDF / receipt / report review

| Module | Recommended output | Approach | Status |
|---|---|---|---|
| POS | Individual sales receipt | Browser print / Save as PDF | Implemented for Admin and Employee POS |
| Sales | Date-filtered sales report and single-sale receipt | Print-specific report layout after filter support review | Recommended, not implemented |
| Inventory | Current stock and low-stock report | Browser print from existing Reports inventory data | Recommended, not implemented |
| Deliveries | Operational delivery report | Browser print; avoid customer phone unless operationally required | Recommended, not implemented |
| Route Planning | Rider stop sheet | Browser print after route-plan retrieval is made report-oriented | Recommended, not implemented |
| Expenses | Date-range expense summary | Browser print from Reports API | Recommended, not implemented |
| Payroll | Payroll summary / individual payslip | Server-authorized print view with strict Admin access | Recommended, not implemented |
| Employees | Roster | Optional browser print | Recommended, not implemented |
| Products | Price list | Optional browser print | Recommended, not implemented |
| Dashboard | Management snapshot | Browser print only when period and source data are explicit | Recommended, not implemented |

The implemented POS receipt uses the existing authoritative sale response and modal values; it does not recalculate totals. The print stylesheet isolates the receipt to a compact 78mm print layout. No PDF library was added. Multi-page reports should not be added until pagination and source-filter requirements are verified.

## 8. CUST-003 backend follow-up

The confirmed gap existed: `confirm_location` filtered by branch and delivery status but not customer request approval. The route now adds `request_status = 'Approved'` when the customer-request schema is present, while retaining branch and Pending/On-the-way checks. A direct authenticated Admin API call can no longer confirm a Pending Review or Rejected customer request through that endpoint.

## 9. Security audit findings

### Confirmed protections

- JWT signing secret and database credentials are environment-driven, not hard-coded in the reviewed configuration.
- JWTs expire after eight hours and `requireAuth` rechecks active account status, role, branch, and token version.
- Login uses password verification, generic credential errors, and the local rate-limit helper.
- API JSON responses set `Cache-Control: no-store, private`.
- PDO prepared statements are used across sampled endpoint paths.
- POS sale processing uses a transaction, row locks, and an atomic stock condition.
- CORS uses an environment-configured allowed-origin list rather than a wildcard.
- `.env` is Git-ignored and `.htaccess` blocks direct `.env` access.

### Remaining risks / work before production

- Browser JWT storage remains `localStorage`; an XSS vulnerability could expose the token. A cookie migration has CSRF trade-offs and should be designed separately, not applied partially.
- The application uses external Leaflet, OpenStreetMap tiles, OSRM, Google Fonts, and Nominatim. Their availability and rate limits are operational dependencies.
- Do a full endpoint-by-endpoint authorization test with separate Admin, Employee, and Rider accounts before release; source inspection and a small API sample are not equivalent to a complete penetration test.
- Do not expose the repository root, backups, logs, database migrations, or `.env` files through the production document root.

## 10. Functional and technical tests

### Automated checks completed

- PHP syntax passed: `api/routes/index.php`, `api/deliveries/index.php`.
- JavaScript syntax passed: shared Rider route renderer, Rider dashboard, Rider My Route, Admin sidebar, and both POS scripts.
- Authenticated local request to the new delivery-notification endpoint returned HTTP 200 and valid JSON.
- An authenticated Admin delivery-list request returned the customer request and its submitted coordinate fields.
- `git diff --check` passed.

### Not completed / requires manual validation

- Real browser checks at 320, 360, 375, 390, 412, 768, 1024, and 1366 pixels.
- Leaflet map rendering with an assigned Rider route and with no route.
- Admin location confirmation against live geocoding, including rejected and cancelled records.
- Browser print-preview and physical/PDF receipt layout.
- Route planning and OSRM behavior from the target hosting network.
- Full Admin/Employee/Rider functional testing, concurrent-sale testing, backup restore testing, and migration status against the intended production database.

## 11. Deployment assessment

**Verdict: NO-GO — NOT READY TO DEPLOY publicly.**

The required items before a deployment decision are:

1. Configure production environment variables and a dedicated least-privilege database user; do not reuse XAMPP credentials.
2. Choose and verify a hosting layout that serves `public/` safely while making the required `api/` and `assets/` paths available without exposing the project root.
3. Apply and verify migrations against a backup of the production database; do not assume local migration status is production status.
4. Run and document a separate-database backup restoration test.
5. Confirm the host has PHP 8.2+ compatible PDO MySQL and cURL support, outbound HTTPS access for OSRM/Nominatim, HTTPS, Apache headers/rewrite support, and correct database hostname values.
6. Perform the manual role, branch-isolation, delivery-sale, customer-request, route, mobile, and print test matrix.
7. Use a paid/shared VPS or managed host if scheduled backups, CLI migrations, reliable external HTTP behavior, and support are required. InfinityFree free hosting does not provide cron jobs, which prevents the documented automated backup approach.

InfinityFree's published support information indicates modern PHP/PDO support but no free-hosting cron jobs. That makes its free tier unsuitable for the project's intended automated operational backups and limits reliable production operations.
