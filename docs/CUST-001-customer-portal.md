# CUST-001 customer portal

## Workflow

1. A customer opens `/public/customer/index.html`, sees only active in-stock LPG products for `BOMS_CUSTOMER_BRANCH_ID` (default Branch 1), and supplies a delivery pin.
2. The customer API validates all fields, product availability, quantity, request token, and the coordinates against the Malilipot, Albay reverse-geocoding check.
3. After the CUST-001 migration is applied, the request is saved in the existing `deliveries` table as `request_source=Customer`, `request_status=Pending Review`, `delivery_status=Pending`, with no rider assignment and `location_confirmed=0`.
4. Admin approves or rejects the request in Admin Deliveries. Rejection follows the existing cancelled delivery outcome. Approval does not create a sale or deduct stock.
5. Admin reviews/adjusts and confirms the location using the existing location-confirmation modal. The stored submitted coordinates remain separate from the confirmed workflow.
6. Once approved, confirmed, assigned, and still Pending/On the way, the request is eligible for the existing Admin Route Planning and Rider My Route workflow.
7. Only the existing explicit delivery-completion action can create the delivery sale and deduct stock.

## Required migration

Review and back up the database, then apply the proposed migration using the migration runner:

```powershell
C:\xampp\php\php.exe scripts\migrate.php --status
C:\xampp\php\php.exe scripts\migrate.php --apply
```

The migration is intentionally not applied automatically. It adds request metadata and a database-backed public-request throttle table; it does not delete or alter existing delivery records.

## External services

- Leaflet JavaScript/CSS from `unpkg.com` and OpenStreetMap tiles for the map.
- A Nominatim-compatible geocoding service for search and server-side reverse validation, configured with `BOMS_GEOCODER_BASE_URL` when the default is unavailable.
- OSRM remains required only after Admin sends eligible deliveries to existing route planning.

The customer portal does not treat browser GPS as verified. Browser location permission is optional, and the server independently validates submitted coordinates. If geocoding is unavailable, a request is rejected safely and no delivery is created.

## Production notes

Use HTTPS, preserve the current CSP, and ensure the deployed site permits the existing approved Leaflet/OSM domains. Do not expose `.env`, migrations, backups, or PHP scripts under the public web root. Configure `BOMS_CUSTOMER_BRANCH_ID` explicitly if customer requests should target a branch other than Malilipot.
