// ============================================================
// FILE: assets/js/components/sidebar.js
// PURPOSE: Builds the sidebar HTML once — used by EVERY admin page.
//          No more copy-pasting sidebar HTML into each .php file.
//          Just add <div id="sidebar"></div> + this script.
//
// ALSO HANDLES:
//   - Highlights the active page link automatically
//   - Shows user name + branch from localStorage
//   - Logout button
// ============================================================

function renderSidebar() {
    const user = Auth.getUser();

    // Nav links — add new pages here
    const navLinks = [
        { href: '/BOMS-EVAgas/public/admin/dashboard.html',  label: 'Dashboard',  icon: '▦' },
        { href: '/BOMS-EVAgas/public/admin/products.html',   label: 'Products',   icon: '⊞' },
        { href: '/BOMS-EVAgas/public/admin/inventory.html',  label: 'Inventory',  icon: '⊟' },
        { href: '/BOMS-EVAgas/public/admin/sales.html',      label: 'Sales',      icon: '₱' },
        { href: '/BOMS-EVAgas/public/admin/deliveries.html', label: 'Deliveries', icon: '⊕' },
        { href: '/BOMS-EVAgas/public/admin/pos.html', label: 'Point of Sale', icon: '₱' },
        { href: '/BOMS-EVAgas/public/admin/employees.html',  label: 'Employees',  icon: '⊛' },
        { href: '/BOMS-EVAgas/public/admin/payroll.html',    label: 'Payroll',    icon: '⊜' },
        { href: '/BOMS-EVAgas/public/admin/expenses.html',   label: 'Expenses',   icon: '⊖' },
        { href: '/BOMS-EVAgas/public/admin/reports.html',    label: 'Reports',    icon: '⊙' },
    ];

    const currentPath = window.location.pathname;

    const linksHTML = navLinks.map(link => {
        const isActive = currentPath.includes(link.href.split('/').pop().replace('.html', ''));
        return `
            <li>
                <a href="${link.href}" class="nav-link ${isActive ? 'active' : ''}">
                    <span class="nav-icon">${link.icon}</span>
                    <span class="nav-label">${link.label}</span>
                </a>
            </li>
        `;
    }).join('');

    const branchName = user.branch_id === 1 ? 'Branch A · Malilipot' : 'Branch B · Legazpi';

    document.getElementById('sidebar').innerHTML = `
        <aside class="sidebar">

            <!-- Logo / Brand -->
            <div class="sidebar-brand">
                <div class="brand-flame">🔥</div>
                <div>
                    <div class="brand-name">BOMS</div>
                    <div class="brand-sub">EVA Gas Trading</div>
                </div>
            </div>

            <!-- Branch badge -->
            <div class="branch-badge">
                <span class="branch-dot"></span>
                ${branchName}
            </div>

            <!-- Nav -->
            <nav class="sidebar-nav">
                <ul>${linksHTML}</ul>
            </nav>

            <!-- User + Logout at bottom -->
            <div class="sidebar-footer">
                <div class="sidebar-user">
                    <div class="user-avatar">${(user.name || 'A')[0].toUpperCase()}</div>
                    <div class="user-info">
                        <div class="user-name">${user.name || 'Admin'}</div>
                        <div class="user-role">${user.role}</div>
                    </div>
                </div>
                <button class="btn-logout" onclick="Auth.logout()">
                    Sign out
                </button>
            </div>

        </aside>
    `;
}

// CSS for sidebar — injected once so every page gets it automatically
(function injectSidebarStyles() {
    if (!document.querySelector('link[href*="/assets/css/light-theme.css"]')) {
        const theme = document.createElement('link');
        theme.id = 'boms-light-theme';
        theme.rel = 'stylesheet';
        theme.href = '/BOMS-EVAgas/assets/css/light-theme.css';
        document.head.appendChild(theme);
    }
    const style = document.createElement('style');
    style.textContent = `
        /* ── Layout shell ─────────────────────────────── */
        .layout {
            display: flex;
            min-height: 100vh;
            background: var(--bg);
            color: var(--text);
            font-family: 'Sora', sans-serif;
        }

        /* ── Sidebar ───────────────────────────────────── */
        .sidebar {
            width: 240px;
            min-width: 240px;
            background: var(--card);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            padding: 1.5rem 0;
            position: sticky;
            top: 0;
            height: 100vh;
            overflow-y: auto;
        }

        /* Brand */
        .sidebar-brand {
            display: flex;
            align-items: center;
            gap: .75rem;
            padding: 0 1.25rem 1.25rem;
            border-bottom: 1px solid var(--border);
        }
        .brand-flame { font-size: 1.6rem; line-height: 1; }
        .brand-name  { font-size: 1rem; font-weight: 700; color: var(--text); letter-spacing: .04em; }
        .brand-sub   { font-size: .65rem; color: var(--text-sub); letter-spacing: .06em; text-transform: uppercase; }

        /* Branch badge */
        .branch-badge {
            display: flex;
            align-items: center;
            gap: .5rem;
            padding: .75rem 1.25rem;
            font-size: .72rem;
            color: var(--text-sub);
            letter-spacing: .06em;
            text-transform: uppercase;
        }
        .branch-dot {
            width: 6px; height: 6px;
            background: #FF4B1F;
            border-radius: 50%;
            flex-shrink: 0;
        }

        /* Nav */
        .sidebar-nav { flex: 1; padding: .5rem 0; }
        .sidebar-nav ul { list-style: none; margin: 0; padding: 0; }

        .nav-link {
            display: flex;
            align-items: center;
            gap: .75rem;
            padding: .65rem 1.25rem;
            color: var(--text-sub);
            text-decoration: none;
            font-size: .84rem;
            border-radius: 0;
            transition: color .15s, background .15s;
            border-left: 2px solid transparent;
        }
        .nav-link:hover { color: var(--text); background: #fff5ef; }
        .nav-link.active {
            color: #FF4B1F;
            background: rgba(255,75,31,.08);
            border-left-color: #FF4B1F;
            font-weight: 600;
        }
        .nav-icon  { font-size: .9rem; width: 18px; text-align: center; flex-shrink: 0; }
        .nav-label { flex: 1; }

        /* Footer */
        .sidebar-footer {
            padding: 1rem 1.25rem 0;
            border-top: 1px solid var(--border);
        }
        .sidebar-user {
            display: flex;
            align-items: center;
            gap: .75rem;
            margin-bottom: .75rem;
        }
        .user-avatar {
            width: 32px; height: 32px;
            background: linear-gradient(135deg, #FF4B1F, #FF9F0A);
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: .8rem; font-weight: 700; color: white;
            flex-shrink: 0;
        }
        .user-name { font-size: .82rem; font-weight: 600; color: var(--text); }
        .user-role { font-size: .68rem; color: var(--text-sub); text-transform: capitalize; }

        .btn-logout {
            width: 100%;
            padding: .55rem;
            background: rgba(255,59,48,.1);
            border: 1px solid rgba(255,59,48,.2);
            border-radius: 8px;
            color: #FF6B61;
            font-family: 'Sora', sans-serif;
            font-size: .78rem;
            font-weight: 600;
            cursor: pointer;
            transition: background .15s;
        }
        .btn-logout:hover { background: rgba(255,59,48,.2); }

        /* ── Main content area ─────────────────────────── */
        .main-content {
            flex: 1;
            padding: 2rem 2.5rem;
            overflow-y: auto;
            max-width: calc(100vw - 240px);
        }

        /* ── Page header ───────────────────────────────── */
        .page-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 2rem;
        }
        .page-title { font-size: 1.6rem; font-weight: 700; color: var(--text); }
        .page-subtitle { font-size: .82rem; color: var(--text-sub); margin-top: .2rem; }

        /* ── Responsive ────────────────────────────────── */
        @media (max-width: 768px) {
            .sidebar { display: none; }
            .main-content { padding: 1.25rem; max-width: 100vw; }
        }
    `;
    document.head.appendChild(style);
})();
