# BOMS — Business Operation Management System
## EVA Gas Trading | Full Technical Reference

---

## 1. WHAT THE SYSTEM IS

BOMS is a web-based management system for EVA Gas Trading, an LPG retailer with two branches (Branch A — Malilipot, Branch B — Legazpi, Albay). It replaces manual notebook-based operations with a centralized digital system.

**Architecture type:** RESTful API + Single Page HTML (separated frontend/backend)

**Why this architecture (say this in your defense):**
The previous monolithic system mixed database queries, business logic, and HTML display in one PHP file per page. The new architecture separates these into three distinct layers: the database, the API (PHP that only returns JSON), and the frontend (HTML/JS that only handles display). This makes the system secure, mobile-ready, and maintainable — any device that can send an HTTP request can use the same API, including a future mobile app.

---

## 2. TECH STACK

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | PHP 8.x | Handles all business logic, returns JSON |
| Database | MySQL / MariaDB | Stores all data |
| Database driver | PDO (PHP Data Objects) | Safer than mysqli, prevents SQL injection |
| Authentication | JWT (JSON Web Token) | Stateless login — no sessions |
| Frontend | HTML5 + Vanilla JavaScript | UI pages, no framework needed |
| Charts | Chart.js 4.4 (CDN) | Sales and report charts |
| Fonts | Google Fonts (Sora + Space Mono) | UI typography |
| Server | Apache (via XAMPP / Codespaces) | Serves PHP files |

---

## 3. HOW TO RUN THE SYSTEM

### Option A — GitHub Codespaces (current setup)
Your project is already in Codespaces. Once files are placed correctly:
1. Open the Codespace terminal
2. Make sure Apache is running (it usually auto-starts)
3. Visit your Codespace URL + `/public/login.html`

### Option B — XAMPP (local, for demo/defense)
1. Install XAMPP from https://www.apachefriends.org
2. Place the entire BOMS folder inside `C:/xampp/htdocs/BOMS`
3. Start Apache and MySQL from the XAMPP Control Panel
4. Open phpMyAdmin at `http://localhost/phpmyadmin`
5. Create a database named `boms_evagas`
6. Run all SQL files from the `/database/` folder (see order below)
7. Open browser at `http://localhost/BOMS/public/login.html`

### SQL Files — Run in this exact order:
```
1. database/users_update.sql         ← must be first (other tables reference users)
2. database/products_update.sql
3. database/sales_update.sql         ← requires products
4. database/deliveries_update.sql    ← requires products and users
5. database/employees_update.sql
6. database/payroll_update.sql       ← requires employees
7. database/expenses_update.sql      ← requires users
```

### Edit DB credentials before running:
Open `api/config/database.php` and update:
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'boms_evagas');   // your database name
define('DB_USER', 'root');           // your MySQL username
define('DB_PASS', '');               // your MySQL password (blank for XAMPP default)
```

---

## 4. DEFAULT LOGIN CREDENTIALS

All test accounts use the password: **password123**

| Username | Password | Role | Branch |
|----------|----------|------|--------|
| admin_a | password123 | Admin | Branch A (Malilipot) |
| admin_b | password123 | Admin | Branch B (Legazpi) |
| staff1 | password123 | Employee | Branch A |
| staff2 | password123 | Employee | Branch B |
| rider1 | password123 | Deliverer | Branch A |
| rider2 | password123 | Deliverer | Branch B |

**IMPORTANT:** These are test accounts. Before going live, change all passwords using PHP's `password_hash()` function. The passwords are hashed using bcrypt — never stored as plain text.

---

## 5. HOW AUTHENTICATION WORKS (JWT)

This is the most important technical concept to understand for your defense.

**Old system (session-based):**
```
User logs in → PHP creates a session on the server → server remembers the user
Problem: only works on the same server, can't be used by a mobile app
```

**New system (JWT token-based):**
```
1. User submits username + password to POST /api/auth/login.php
2. PHP checks credentials against the users table
3. If correct, PHP generates a JWT token — a long encoded string
4. Token is sent back to the browser and saved in localStorage
5. Every future request includes the token in the header:
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
6. PHP reads the token, verifies it wasn't tampered with, extracts user info
7. No database lookup needed for auth — the token contains everything
```

**What's inside the token (the payload):**
```json
{
  "user_id": 1,
  "role": "admin",
  "branch_id": 1,
  "exp": 1735689600
}
```

**The JWT secret key** is in `api/helpers/jwt.php`:
```php
define('JWT_SECRET', 'boms_evagas_secret_2025_change_this');
```
Change this to a random string before going live. If this leaks, anyone can forge tokens.

**Token expiry:** 8 hours. After 8 hours the user is automatically logged out and must log in again.

---

## 6. ROLE ACCESS MATRIX

| Feature | Admin | Employee | Deliverer |
|---------|-------|----------|-----------|
| Dashboard | Full analytics | Today's sales | Own delivery stats |
| Products | Full CRUD | View (for POS) | — |
| Inventory | Full + adjust | View stock levels | — |
| Sales/POS | View all | Create sales | — |
| Deliveries | Full CRUD | Create + assign | Update own status |
| Employees | Full CRUD | — | — |
| Payroll | Full | — | — |
| Expenses | Full CRUD | — | — |
| Reports | All 5 report types | — | — |
| Other branch data | Read-only (reports/analytics) | — | — |

**Branch rule:** Admin A can view Branch B's reports and analytics, but cannot modify Branch B's data. The API enforces this server-side using `requireBranchAccess()` — it cannot be bypassed from the frontend.

---

## 7. FILE STRUCTURE (52 files total)

```
BOMS/
│
├── .htaccess                          ← Apache URL config
│
├── api/                               ← PHP BACKEND (returns JSON only, never HTML)
│   ├── config/
│   │   └── database.php               ← DB connection (PDO)
│   ├── helpers/
│   │   ├── auth_check.php             ← requireAuth() + requireBranchAccess()
│   │   ├── jwt.php                    ← generateToken() + verifyToken()
│   │   └── response.php               ← sendSuccess() + sendError()
│   ├── auth/
│   │   ├── login.php                  ← POST: returns JWT token
│   │   └── logout.php                 ← POST: tells frontend to clear token
│   ├── dashboard/
│   │   └── index.php                  ← GET: all dashboard stats
│   ├── products/
│   │   └── index.php                  ← GET/POST/PUT/DELETE products
│   ├── inventory/
│   │   └── index.php                  ← GET stock list, PUT stock adjustment
│   ├── sales/
│   │   └── index.php                  ← GET sales history, POST new sale + deduct stock
│   ├── deliveries/
│   │   └── index.php                  ← GET/POST/PUT/DELETE deliveries
│   ├── employees/
│   │   └── index.php                  ← GET/POST/PUT/DELETE employees
│   ├── payroll/
│   │   └── index.php                  ← GET/POST compute, PUT release, DELETE draft
│   ├── expenses/
│   │   └── index.php                  ← GET/POST/PUT/DELETE expenses
│   └── reports/
│       └── index.php                  ← GET ?type=summary|sales|expenses|payroll|inventory
│
├── assets/
│   ├── css/                           ← (global CSS if needed, currently inline per page)
│   └── js/
│       ├── api.js                     ← central fetch() wrapper, auto-attaches JWT header
│       ├── auth.js                    ← Auth.login(), Auth.logout(), Auth.guard()
│       └── components/
│           ├── sidebar.js             ← admin sidebar (injected into every admin page)
│           ├── sidebar_employee.js    ← employee sidebar
│           └── sidebar_deliverer.js   ← deliverer sidebar
│       └── admin/
│           ├── dashboard.js
│           ├── products.js
│           ├── inventory.js
│           ├── sales.js               ← (handled inline in sales.html)
│           ├── deliveries.js
│           ├── employees.js
│           ├── payroll.js
│           ├── expenses.js
│           └── reports.js
│
├── public/                            ← HTML FRONTEND (pure HTML, zero PHP)
│   ├── login.html                     ← shared login page for all roles
│   ├── admin/
│   │   ├── dashboard.html
│   │   ├── products.html
│   │   ├── inventory.html
│   │   ├── sales.html
│   │   ├── deliveries.html
│   │   ├── employees.html
│   │   ├── payroll.html
│   │   ├── expenses.html
│   │   └── reports.html
│   ├── employee/
│   │   ├── dashboard.html
│   │   ├── pos.html                   ← Point of Sale
│   │   ├── orders.html                ← Today's sales view
│   │   └── inventory.html             ← Read-only stock view
│   └── deliverer/
│       ├── dashboard.html
│       └── deliveries.html            ← Assigned routes, update status
│
└── database/                          ← SQL SCHEMAS (run once in phpMyAdmin)
    ├── users_update.sql
    ├── products_update.sql
    ├── sales_update.sql
    ├── deliveries_update.sql
    ├── employees_update.sql
    ├── payroll_update.sql
    └── expenses_update.sql
```

---

## 8. DATABASE TABLES

### users
Stores login accounts for all three roles.
```
id | username | password (hashed) | role | branch_id | full_name | created_at
```

### products
LPG products available per branch.
```
id | branch_id | product_name | category | price | stock | status | created_at
```

### sales
One row per transaction (the receipt header).
```
id | branch_id | total_amount | amount_tendered | change_amount | created_by | sale_date
```

### sale_items
One row per product per transaction (the receipt line items).
```
id | sale_id | product_id | quantity | unit_price | subtotal
```
Note: `sale_id` links back to `sales`. One sale can have many sale_items. This is called a **one-to-many relationship**.

### deliveries
```
id | branch_id | customer_name | customer_phone | customer_address
   | product_id | quantity | delivery_status | assigned_to | notes
   | created_by | created_at | delivered_at
```
`delivery_status` values: `Pending | On the way | Delivered | Cancelled`

### employees
HR records — separate from the users table.
```
id | branch_id | full_name | position | phone | address | hire_date | daily_rate | status | created_at
```
Note: `employees` and `users` are separate tables intentionally. A deliverer can be in `employees` for payroll without needing a system login account. They are separate concerns.

### payroll
```
id | branch_id | employee_id | period_start | period_end
   | days_worked | daily_rate | gross_pay | deductions | net_pay
   | status | created_by | created_at
```
`status` values: `Draft | Released`
Formula: `gross_pay = days_worked × daily_rate`, `net_pay = gross_pay - deductions`

### expenses
```
id | branch_id | category | description | amount | expense_date | created_by | created_at
```
Categories: `Utilities | Supplies | Maintenance | Salary | Other`

---

## 9. API ENDPOINT REFERENCE

All endpoints are in `/api/`. All return JSON. All require a JWT token in the Authorization header except login.

```
POST   /api/auth/login.php                              → returns token + role + redirect URL
POST   /api/auth/logout.php                             → tells frontend to clear token

GET    /api/dashboard/index.php?branch_id=N             → all dashboard stats
GET    /api/dashboard/index.php?branch_id=N&branch_id=2 → other branch (read-only)

GET    /api/products/index.php                          → list products
GET    /api/products/index.php?id=N                     → single product
POST   /api/products/index.php                          → create [admin]
PUT    /api/products/index.php?id=N                     → update [admin]
DELETE /api/products/index.php?id=N                     → soft-delete [admin]

GET    /api/inventory/index.php?branch_id=N             → stock list + summary
GET    /api/inventory/index.php?branch_id=N&low=1       → low-stock only
PUT    /api/inventory/index.php?id=N                    → adjust stock [admin]

GET    /api/sales/index.php?date_from=Y-m-d&date_to=Y-m-d → sales list
GET    /api/sales/index.php?id=N                        → single sale with items
POST   /api/sales/index.php                             → create sale, deducts stock [employee/admin]

GET    /api/deliveries/index.php?branch_id=N            → list deliveries
GET    /api/deliveries/index.php?deliverers=1           → list deliverer users (for dropdown)
POST   /api/deliveries/index.php                        → create delivery [admin/employee]
PUT    /api/deliveries/index.php?id=N                   → full update [admin]
PUT    /api/deliveries/index.php?id=N&action=status     → status-only update [deliverer/admin]
DELETE /api/deliveries/index.php?id=N                   → cancel delivery [admin]

GET    /api/employees/index.php?branch_id=N             → list employees
POST   /api/employees/index.php                         → add employee [admin]
PUT    /api/employees/index.php?id=N                    → update [admin]
DELETE /api/employees/index.php?id=N                    → deactivate [admin]

GET    /api/payroll/index.php?period_start=Y&period_end=Y → list payroll for period
POST   /api/payroll/index.php                           → compute batch [admin]
PUT    /api/payroll/index.php?id=N                      → edit deductions [admin]
PUT    /api/payroll/index.php?id=N&action=release       → release one [admin]
PUT    /api/payroll/index.php?action=release_all        → release all draft [admin]
DELETE /api/payroll/index.php?id=N                      → delete draft [admin]

GET    /api/expenses/index.php?date_from=Y&date_to=Y    → list expenses
POST   /api/expenses/index.php                          → add expense [admin]
PUT    /api/expenses/index.php?id=N                     → edit [admin]
DELETE /api/expenses/index.php?id=N                     → delete [admin]

GET    /api/reports/index.php?type=summary&branch_id=N  → all KPIs in one call
GET    /api/reports/index.php?type=sales                → sales report with monthly trend
GET    /api/reports/index.php?type=expenses             → expenses by category
GET    /api/reports/index.php?type=payroll              → payroll for a period
GET    /api/reports/index.php?type=inventory            → stock levels + total stock value
```

---

## 10. HOW KEY MODULES WORK

### Point of Sale (POS)
1. Employee opens `/public/employee/pos.html`
2. JS calls `GET /api/products/index.php` → products load as clickable tiles
3. Employee taps a product → added to cart in JS memory
4. Employee enters tendered amount → JS calculates change live
5. Employee clicks Process Sale → JS calls `POST /api/sales/index.php`
6. PHP validates stock, inserts into `sales` + `sale_items`, deducts `products.stock`
7. All 3 DB operations (insert sale + insert items + update stock) are wrapped in a
   **database transaction** — if any step fails, all steps are rolled back (no ghost records)
8. Receipt popup shows on success

### Payroll Computation
1. Admin selects period dates and enters days worked
2. Clicks Compute → JS calls `POST /api/payroll/index.php`
3. PHP fetches all active employees for the branch
4. For each employee: `gross_pay = days_worked × daily_rate`
5. Inserts one row per employee into `payroll` table (status = Draft)
6. `INSERT IGNORE` prevents duplicates if admin runs computation twice
7. Admin can edit individual records (adjust deductions)
8. Admin clicks Release → status changes to `Released` (cannot be edited after)

### Branch Analytics
1. Each DB table has a `branch_id` column (1 or 2)
2. Every API query filters by `branch_id`
3. `requireBranchAccess($user, $requestedBranch, 'read')` allows cross-branch reads
4. `requireBranchAccess($user, $requestedBranch, 'write')` blocks cross-branch writes
5. On the frontend, the Add/Edit/Delete buttons are hidden when viewing the other branch
6. This means the restriction is enforced twice: frontend (UX) and backend (security)

---

## 11. SECURITY FEATURES

These are talking points for your defense:

| Feature | How it works |
|---------|-------------|
| Password hashing | Passwords stored using `password_hash()` bcrypt — never plain text |
| JWT auth | Stateless tokens — server doesn't store sessions |
| PDO prepared statements | All SQL queries use `?` placeholders — prevents SQL injection |
| Role enforcement | `requireAuth('admin')` on every protected API endpoint |
| Branch enforcement | `requireBranchAccess()` prevents cross-branch data modification |
| Soft delete | Records marked Inactive, never truly deleted — preserves audit trail |
| XSS prevention | All user data passed through `escHtml()` before inserting into DOM |
| CORS headers | Controlled in `response.php` — restricts which origins can call the API |

---

## 12. COMMON PROBLEMS AND FIXES

### "No token provided" error on every page after login
Apache strips the Authorization header by default. Add this to `.htaccess`:
```apache
SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1
```

### Login works but dashboard shows no data
The `branch_id` column is missing from one of your tables. Check that you ran all SQL files.

### Products page shows "Failed to load"
Check that your DB credentials in `api/config/database.php` are correct.

### POS says "Not enough stock" on a product that has stock
The `stock` column in your products table might be named differently (e.g. `stock_quantity`).
Check the SQL migration file comment for the rename command.

### Payroll compute creates 0 records
The `employees` table has no active employees for that branch, or the `status` column values are not exactly `'Active'` (case-sensitive).

---

## 13. THINGS TO CHANGE BEFORE GOING LIVE (PRODUCTION)

1. **Change JWT_SECRET** in `api/helpers/jwt.php` to a long random string
2. **Change all test passwords** — update the users table
3. **Set DB_PASS** to your actual MySQL password
4. **Remove sample data** from the SQL files (the INSERT INTO sections at the bottom)
5. **Disable PHP error display** — add to `api/config/database.php`:
   ```php
   ini_set('display_errors', 0);
   error_reporting(0);
   ```
6. **Restrict CORS** in `api/helpers/response.php` — change `*` to your actual domain:
   ```php
   header('Access-Control-Allow-Origin: https://yourdomain.com');
   ```

---

## 14. WHAT TO SAY DURING DEFENSE

**"What architecture did you use?"**
RESTful API architecture. The backend is PHP that only returns JSON. The frontend is HTML and JavaScript that fetches from the API. They are completely separated, so any client — browser, mobile app, or tablet — can use the same backend.

**"How do you handle security?"**
Three layers: JWT authentication verifies identity on every request, role middleware checks permissions, and branch access control prevents cross-branch data modification. Passwords are hashed with bcrypt and all queries use PDO prepared statements to prevent SQL injection.

**"Why did you use JWT instead of sessions?"**
Sessions are stored on the server and only work on the same server. JWT tokens are self-contained — they carry the user's identity and role inside the token itself, verified by a signature. This makes the system stateless, meaning it can scale to multiple servers and be used by mobile apps without any changes to the backend.

**"What is the difference between the users table and employees table?"**
Users are login accounts — they represent who can access the system. Employees are HR records — they represent who gets paid. A store owner might want to track payroll for a helper who doesn't have system access. Separating them gives flexibility and keeps concerns clean.

**"How does the two-branch system work?"**
Every data table has a branch_id column. Every API query filters by the requesting user's branch_id. Admins can read data from the other branch for analytics and reporting, but all write operations are restricted to their own branch. This is enforced server-side — the frontend cannot override it.

---

## 15. QUICK REFERENCE — SCRIPT LOAD ORDER

Every HTML page must load scripts in this exact order or things will break:
```html
<script src="/assets/js/api.js"></script>        ← 1st: fetch wrapper
<script src="/assets/js/auth.js"></script>        ← 2nd: login/logout/guard
<script src="/assets/js/components/sidebar.js"></script>  ← 3rd: sidebar render
<script src="/assets/js/admin/[pagename].js"></script>    ← 4th: page logic
```
Reason: each file depends on the one before it. `auth.js` uses `Api` from `api.js`. Page JS uses `Auth` from `auth.js`. If order is wrong, you get "Auth is not defined" errors.