# BOMS – Business Operation Management System
## EVA Gas Trading | Refactored RESTful Architecture

> **Why the refactor?** Your current monolithic structure mixes PHP logic, HTML rendering, and DB calls in one file (e.g., `sales.php` handles routing, queries, and display). The new structure separates **API (backend)** from **Frontend (HTML/JS)**, making it mobile-ready, easier to defend, and cleaner to maintain.

---

## Architecture Overview

```
BOMS-EVAGas/
│
├── api/                          ← PHP REST API (Backend only, returns JSON)
│   ├── config/
│   │   ├── Database.php          ← PDO connection singleton
│   │   ├── Cors.php              ← CORS headers for cross-origin requests
│   │   └── Config.php            ← App constants (JWT_SECRET, etc.)
│   │
│   ├── middleware/
│   │   ├── AuthMiddleware.php    ← Validates JWT token on every request
│   │   └── RoleMiddleware.php    ← Checks role: admin | employee | deliverer
│   │
│   ├── models/                   ← Database logic only (SQL queries)
│   │   ├── User.php
│   │   ├── Product.php
│   │   ├── Order.php
│   │   ├── Inventory.php
│   │   ├── Delivery.php
│   │   ├── Employee.php
│   │   ├── Payroll.php
│   │   ├── Expense.php
│   │   └── Report.php
│   │
│   ├── controllers/              ← Handles request → calls model → returns JSON
│   │   ├── AuthController.php    ← login, logout, refresh token
│   │   ├── ProductController.php ← CRUD for LPG products
│   │   ├── OrderController.php   ← create, view, update orders (POS)
│   │   ├── InventoryController.php
│   │   ├── DeliveryController.php ← assign, update, track deliveries
│   │   ├── EmployeeController.php
│   │   ├── PayrollController.php
│   │   ├── ExpenseController.php
│   │   └── ReportController.php  ← sales summary, inventory report, payroll report
│   │
│   ├── routes/
│   │   ├── api.php               ← Main router (maps URL → controller method)
│   │   └── endpoints.md          ← API documentation (for your defense)
│   │
│   ├── helpers/
│   │   ├── JwtHelper.php         ← Generate/decode JWT tokens
│   │   └── ResponseHelper.php    ← Standardized JSON response format
│   │
│   └── index.php                 ← API entry point (all requests go here)
│
├── public/                       ← Frontend (HTML + Vanilla JS, no PHP)
│   │
│   ├── login.html                ← Shared login page (redirects by role)
│   │
│   ├── admin/                    ← Admin (Owner) views
│   │   ├── dashboard.html        ← Sales overview, inventory summary
│   │   ├── products.html         ← Add/edit/delete LPG products
│   │   ├── inventory.html        ← Stock levels, adjustments
│   │   ├── employees.html        ← Employee list, add/edit
│   │   ├── payroll.html          ← Payroll computation, history
│   │   ├── expenses.html         ← Expense logging
│   │   ├── deliveries.html       ← All deliveries overview
│   │   ├── reports.html          ← Sales, inventory, payroll reports
│   │   └── settings.html         ← Branch settings, user accounts
│   │
│   ├── employee/                 ← Employee (Shop Staff) views
│   │   ├── dashboard.html        ← Today's orders, stock summary
│   │   ├── pos.html              ← Point of Sale (process orders)
│   │   ├── orders.html           ← View/manage customer orders
│   │   └── inventory.html        ← View stock levels (read-only)
│   │
│   └── deliverer/                ← Deliverer views
│       ├── dashboard.html        ← Today's assigned deliveries
│       ├── deliveries.html       ← List of deliveries (pending, done)
│       └── route.html            ← Route map / delivery directions
│
├── assets/
│   ├── css/
│   │   ├── style.css             ← Global styles
│   │   ├── sidebar.css
│   │   └── components.css        ← Reusable UI components
│   │
│   ├── js/
│   │   ├── core/
│   │   │   ├── api.js            ← Central fetch() wrapper (adds JWT header)
│   │   │   ├── auth.js           ← Login, logout, token storage
│   │   │   └── router.js         ← Role-based redirect on page load
│   │   │
│   │   ├── admin/
│   │   │   ├── dashboard.js
│   │   │   ├── products.js
│   │   │   ├── inventory.js
│   │   │   ├── employees.js
│   │   │   ├── payroll.js
│   │   │   ├── expenses.js
│   │   │   └── reports.js
│   │   │
│   │   ├── employee/
│   │   │   ├── pos.js            ← Cart logic, order submission
│   │   │   └── orders.js
│   │   │
│   │   └── deliverer/
│   │       ├── deliveries.js
│   │       └── route.js          ← Google Maps / Leaflet.js integration
│   │
│   └── img/
│       └── logo.png
│
├── database/
│   ├── boms_schema.sql           ← Full DB schema
│   └── boms_seed.sql             ← Sample data for testing/defense
│
├── .htaccess                     ← Redirect all /api/* to api/index.php
└── README.md
```

---

## Key Differences from Your Current Structure

| Old (Monolithic)             | New (RESTful)                            |
|------------------------------|------------------------------------------|
| `admin/sales.php` does everything | `SalesController.php` (logic) + `sales.html` (UI) |
| Auth via `session_start()` in each file | JWT token validated by `AuthMiddleware.php` |
| HTML mixed with PHP/SQL       | Pure HTML + JS calls API endpoints       |
| No role enforcement per page  | `RoleMiddleware.php` blocks unauthorized requests |
| Hard to use on mobile         | Any device can call the API (mobile-ready) |
| `includes/header.php` per page | Shared `sidebar.css` + JS renders layout |

---

## API Endpoint Structure (for your defense)

```
POST   /api/auth/login               → returns JWT token + role
POST   /api/auth/logout

GET    /api/products                  → list all products
POST   /api/products                  → add product        [admin only]
PUT    /api/products/{id}             → edit product       [admin only]
DELETE /api/products/{id}             → delete product     [admin only]

GET    /api/inventory                 → stock levels
PUT    /api/inventory/{id}            → adjust stock       [admin, employee]

GET    /api/orders                    → all orders
POST   /api/orders                    → create order (POS) [employee]
PUT    /api/orders/{id}/status        → update status

GET    /api/deliveries                → all deliveries
POST   /api/deliveries                → assign delivery    [admin, employee]
PUT    /api/deliveries/{id}/status    → mark done/ongoing  [deliverer]

GET    /api/employees                 → employee list      [admin]
POST   /api/employees                 → add employee       [admin]

GET    /api/payroll                   → payroll records    [admin]
POST   /api/payroll/compute           → compute payroll    [admin]

GET    /api/reports/sales             → sales report       [admin]
GET    /api/reports/inventory         → inventory report   [admin]
GET    /api/reports/payroll           → payroll report     [admin]
```

---

## How JWT Auth Works (Simple Explanation for Defense)

```
1. User logs in → POST /api/auth/login { username, password }
2. API verifies credentials → returns { token: "eyJ...", role: "admin" }
3. Frontend stores token in localStorage
4. Every API request includes: Authorization: Bearer eyJ...
5. AuthMiddleware.php decodes the token → confirms identity
6. RoleMiddleware.php checks role → blocks if unauthorized
```

---

## Migration Path from Your Existing Code

Since your system is **already working**, you don't need to rewrite everything.
Follow this order:

1. **Create `api/` folder** → move DB logic from your PHP files into models/controllers
2. **Create `api/index.php`** → simple router that reads `$_SERVER['REQUEST_URI']`
3. **Convert one module first** (suggest: Products) → test with Postman/Thunder Client
4. **Strip PHP from your HTML** → replace with `fetch('/api/products')` calls in JS
5. **Add JWT** → replace `session_start()` with `JwtHelper::generate()` on login
6. **Repeat per module** → Orders → Inventory → Deliveries → Payroll → Reports

> **Tip for defense:** You can explain this as a "phased migration" — your working monolithic system is Phase 1, and the RESTful version is Phase 2 (what you're presenting as the improved architecture). This shows awareness of software engineering evolution.

---

## Role Access Matrix

| Feature              | Admin ✅ | Employee ✅ | Deliverer ✅ |
|----------------------|---------|------------|-------------|
| Dashboard            | Full    | Limited    | Own only    |
| POS / Orders         | View    | Full       | —           |
| Inventory            | Full    | View       | —           |
| Deliveries           | Full    | Assign     | Update own  |
| Route Map            | View    | View       | Full        |
| Employees            | Full    | —          | —           |
| Payroll              | Full    | —          | —           |
| Expenses             | Full    | —          | —           |
| Reports              | Full    | —          | —           |
| Settings             | Full    | —          | —           |

## Simplified System Tree Architechture

BOMS-EVAGas/
│
├── api/                          ← All PHP (backend, returns JSON)
│   ├── config/
│   │   └── database.php          ← DB connection
│   ├── auth/
│   │   └── login.php             ← Login → returns token
│   ├── products/
│   │   └── index.php             ← GET/POST/PUT/DELETE products
│   ├── orders/
│   │   └── index.php
│   ├── inventory/
│   │   └── index.php
│   ├── deliveries/
│   │   └── index.php
│   ├── payroll/
│   │   └── index.php
│   ├── reports/
│   │   └── index.php
│   └── helpers/
│       ├── auth_check.php        ← Validates token + role
│       └── response.php          ← Sends back clean JSON
│
├── public/                       ← All HTML pages (no PHP here)
│   ├── login.html
│   ├── admin/
│   │   ├── dashboard.html
│   │   ├── products.html
│   │   ├── inventory.html
│   │   ├── employees.html
│   │   ├── payroll.html
│   │   ├── deliveries.html
│   │   └── reports.html
│   ├── employee/
│   │   ├── dashboard.html
│   │   ├── pos.html
│   │   └── orders.html
│   └── deliverer/
│       ├── dashboard.html
│       └── deliveries.html
│
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── api.js                ← One file: handles all fetch() calls
│       ├── auth.js               ← Login/logout/token
│       ├── admin/
│       │   ├── dashboard.js
│       │   ├── products.js
│       │   ├── inventory.js
│       │   ├── employees.js
│       │   ├── payroll.js
│       │   └── reports.js
│       ├── employee/
│       │   ├── pos.js
│       │   └── orders.js
│       └── deliverer/
│           └── deliveries.js
│
├── database/
│   └── boms.sql                  ← Your full DB schema
│
└── .htaccess