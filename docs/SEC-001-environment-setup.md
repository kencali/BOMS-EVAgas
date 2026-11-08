# BOMS environment setup

## Local XAMPP development

1. Copy `.env.example` to `.env` in the project root. The project root is outside `public/`.
2. Set `BOMS_APP_ENV=local`.
3. Set `BOMS_JWT_SECRET` to a random value of at least 32 characters. In a trusted terminal, one option is `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`.
4. Set the database values for your own XAMPP database. A blank password is accepted only when `BOMS_APP_ENV=local`; it must not be used for production.
5. Restart Apache after changing Apache-level environment variables. A root-level `.env` is read per PHP request for local development.

## Production hosting

- Configure the web server document root as `public/`, never the project root.
- Supply `BOMS_APP_ENV=production`, `BOMS_JWT_SECRET`, and all `BOMS_DB_*` variables through the host, process manager, Apache virtual host, or equivalent secret manager.
- Do not deploy `.env`; do not place secrets in JavaScript, HTML, Git, or a public directory.
- Use a unique, cryptographically random JWT secret of at least 32 characters. Replacing it invalidates all previously issued JWTs and requires users to sign in again.
- Create a dedicated application database user. For normal runtime it should have only the application privileges required on the BOMS database, typically `SELECT`, `INSERT`, `UPDATE`, and `DELETE`. Use a separate controlled deployment account for schema migrations if needed.
- Use a strong non-empty production database password and restrict database network access to the application host.
- Configure PHP with `display_errors=Off` and error logging enabled outside the public web root.
- Require HTTPS at the host/proxy and redirect HTTP to HTTPS.

## SEC-002 production hardening

- Set `BOMS_CORS_ALLOWED_ORIGINS` to a comma-separated list of exact HTTPS frontend origins. Do not use `*` for authenticated APIs. Local defaults are included only for XAMPP development.
- The application sends `Cache-Control: no-store, private` for API responses. Keep static asset caching in the web-server configuration instead.
- Configure `display_errors=Off`, `log_errors=On`, and an `error_log` path outside the document root in production `php.ini` or the hosting control panel. The application additionally disables display errors when `BOMS_APP_ENV=production`.
- If Apache performs TLS termination, set `BOMS_FORCE_HTTPS=1` in the production virtual host to enable the supplied HTTPS redirect. If a reverse proxy terminates TLS, enforce the redirect and HSTS there and pass `X-Forwarded-Proto: https` only from that trusted proxy.
- The supplied CSP permits the existing self-hosted JavaScript/CSS and Google Fonts. Keep `mod_headers` enabled; test the deployed site after adding any new external dependency.
- Apply `database/20261106_sec002_auth_hardening.sql` once after a backup. It adds account status/token-version fields and a login throttle table. A logout invalidates all active tokens for that account; disabling an account or changing its role/branch also denies old tokens on their next API request.

## Route-planning provider

- Route planning needs outbound HTTPS and DNS access from PHP/XAMPP to an OSRM-compatible road-routing service. It does not use straight-line distance as a fallback.
- By default BOMS uses `https://router.project-osrm.org`. When that public service is blocked by a firewall, DNS policy, proxy, or availability limit, set `BOMS_OSRM_BASE_URL` to an approved, reachable OSRM-compatible instance (for example, a self-hosted OSRM service) and restart Apache if required.
- The Leaflet `.js.map` browser-console CSP notice is a development source-map lookup. It does not affect Leaflet, OSM tiles, or route requests and does not justify weakening the CSP.
