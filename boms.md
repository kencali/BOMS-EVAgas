# BOMS — Current System Overview

## EVA Gas Trading | Business Operation Management System

**Current stack:** HTML, CSS, vanilla JavaScript, PHP 8.x, MySQL/MariaDB, Leaflet, and OSRM.
**Local project path:** `C:\xampp\htdocs\BOMS-EVAgas`
**Current state:** stable local capstone system with Admin, Employee, Rider/Deliverer, and public Customer delivery-request interfaces.

## What BOMS currently does

BOMS manages two EVA Gas Trading branches:

- **Branch A — Malilipot, Albay**
- **Branch B — Legazpi, Albay**

It supports products and inventory, walk-in POS sales, delivery lifecycle management, rider assignment, route planning, employees, payroll, expenses, reports, and customer delivery requests.

## User interfaces

| User | Current access |
|---|---|
| Admin | Dashboard, products, inventory, sales, POS, deliveries, route planning, employees, payroll, expenses, and reports. |
| Employee | Branch dashboard, POS, today’s sales, deliveries relevant to the employee’s branch, and stock view. |
| Rider / Deliverer | Own delivery statistics, assigned deliveries, route overview, My Route map, and permitted status updates. |
| Customer | Public LPG delivery request form, map location pinning, request reference, and status lookup. |

## Current business rules

### Walk-in POS

- Admins and Employees can process walk-in sales in their own branch.
- A sale creates `sales` and `sale_items` records in one transaction.
- Stock is locked/rechecked and deducted atomically so stock cannot become negative through normal concurrent POS requests.
- A compact receipt can be printed or saved as PDF after a successful sale.

### Deliveries and delivery sales

- Creating a delivery checks available stock but **does not deduct stock** and **does not create a sale**.
- Pending or On-the-way deliveries can be cancelled before completion without stock deduction or a sale.
- Completion occurs only through the explicit **Mark Delivered** action.
- Completion rechecks stock in a transaction, creates one linked `delivery` sale and `sale_items`, deducts stock once, records `Delivered`, `delivered_at`, and `sale_confirmed = 1`.
- Delivered or sale-confirmed deliveries cannot be completed again, edited, or cancelled through the supported workflow.

### Customer delivery requests

- The customer portal creates a `Pending Review` request and stores the submitted map location separately.
- Customer submission does not create a sale, deduct stock, assign a rider, or complete a delivery.
- An Admin must approve the request before its delivery status can proceed or its location can be confirmed.
- Admin location confirmation validates Malilipot, Albay coordinates and saves the final approved point with `location_confirmed = 1`.
- Route planning requires an assigned rider, an approved request where applicable, a valid confirmed location, and at least two selected stops.

### Route planning

- Admin route planning is single-rider planning only.
- BOMS stores the Admin-recommended stop sequence and OSRM road geometry.
- Riders cannot change the optimized stop order.
- The Rider Dashboard and My Route page both show the Rider’s own currently planned route; no live rider GPS is claimed or implemented.

## Current visual and UI conventions

- Light-only interface with EVA orange/red as the primary accent.
- Locally generated Lucide-style SVG icons.
- Responsive shared sidebar/drawer behavior.
- A local BOMS flame favicon is used by all current entry pages.
- Admin Deliveries has a lightweight, non-real-time notification dot for newly submitted customer requests. Its seen state is stored per Admin and branch in that browser’s local storage.

## Security and operational state

- JWT signing and database credentials come from environment configuration, not source-code constants.
- JWTs expire after eight hours; protected API calls recheck the current account’s status, role, branch, and token version.
- API responses with authenticated business data use private no-store caching.
- CORS uses configured trusted origins rather than a wildcard.
- Login is rate-limited and uses generic invalid-credential messages.
- `.env` files are ignored by Git and must remain outside the public web root in production.

## Important files

```text
api/                    PHP JSON endpoints, auth, configuration, helpers
public/                 HTML entry pages by role
assets/css/             shared, component, and page-level styling
assets/js/              API/auth helpers, role components, and page logic
assets/images/          cylinder asset and BOMS favicon
database/migrations/    forward-only migrations
docs/                   operational and feature documentation
```

## Deployment status

**NO-GO — not ready for public deployment yet.**

Before deployment, complete the manual browser and role test matrix, verify production environment configuration, apply migrations to the intended database, prove a separate-database backup restoration, and verify the target host can safely support the public/API/assets layout and external routing/geocoding dependencies.

For the detailed audit, see `docs/reports/POST-CUST-003-UI-PDF-DEPLOYMENT-READINESS.md`.
