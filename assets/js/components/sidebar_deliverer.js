// ============================================================
// FILE: assets/js/components/sidebar_deliverer.js
// PURPOSE: Sidebar for deliverer-role pages.
// ============================================================

function renderSidebar() {
    const user = Auth.getUser();

    const navLinks = [
        { href: '/BOMS-EVAgas/public/deliverer/dashboard.html',  label: 'Dashboard',        icon: 'dashboard' },
        { href: '/BOMS-EVAgas/public/deliverer/deliveries.html', label: 'My Deliveries',    icon: 'truck' },
        { href: '/BOMS-EVAgas/public/deliverer/route.html',      label: 'My Route',         icon: 'map' },
    ];

    const currentPath = window.location.pathname;

    const linksHTML = navLinks.map(link => {
        const isActive = currentPath.includes(link.href.split('/').pop().replace('.html', ''));
        return `
            <li>
                <a href="${link.href}" class="nav-link ${isActive ? 'active' : ''}">
                    <span class="nav-icon">${BomsIcons.icon(link.icon)}</span>
                    <span class="nav-label">${link.label}</span>
                </a>
            </li>`;
    }).join('');

    const branchName = user.branch_id === 1 ? 'Branch A · Malilipot' : 'Branch B · Legazpi';

    document.getElementById('sidebar').innerHTML = `
        <aside class="sidebar boms-role-sidebar deliverer-sidebar">
            <div class="sidebar-brand">
                <div class="brand-flame">${BomsIcons.icon('flame')}</div>
                <div>
                    <div class="brand-name">BOMS</div>
                    <div class="brand-sub">EVA Gas Trading</div>
                </div>
            </div>
            <div class="branch-badge">
                <span class="branch-dot"></span>
                ${branchName}
            </div>
            <nav class="sidebar-nav">
                <ul>${linksHTML}</ul>
            </nav>
            <div class="sidebar-footer">
                <div class="sidebar-user">
                    <div class="user-avatar">${(user.name || 'D')[0].toUpperCase()}</div>
                    <div class="user-info">
                        <div class="user-name">${user.name || 'Deliverer'}</div>
                        <div class="user-role">${user.role}</div>
                    </div>
                </div>
                <button class="btn-logout" onclick="Auth.logout()">Sign out</button>
            </div>
        </aside>`;
    BomsMobileNavigation.init();
}

(function injectSidebarStyles() {
    if (!document.querySelector('link[href*="/assets/css/light-theme.css"]')) {
        const theme = document.createElement('link');
        theme.id = 'boms-light-theme';
        theme.rel = 'stylesheet';
        theme.href = '/BOMS-EVAgas/assets/css/light-theme.css';
        document.head.appendChild(theme);
    }
    if (!document.querySelector('link[href*="/assets/css/responsive.css"]')) {
        const responsive = document.createElement('link');
        responsive.rel = 'stylesheet';
        responsive.href = '/BOMS-EVAgas/assets/css/responsive.css';
        document.head.appendChild(responsive);
    }
    if (!document.querySelector('link[href*="/assets/css/components/role-sidebar.css"]')) {
        const roleSidebar = document.createElement('link');
        roleSidebar.rel = 'stylesheet';
        roleSidebar.href = '/BOMS-EVAgas/assets/css/components/role-sidebar.css';
        document.head.appendChild(roleSidebar);
    }
    const style = document.createElement('style');
    style.textContent = `
        .layout{display:flex;min-height:100vh;background:var(--bg);color:var(--text);font-family:'Sora',sans-serif;}
        .layout > #sidebar{width:240px;min-width:240px;flex:0 0 240px;}
        .sidebar.deliverer-sidebar{width:240px;background:#fff;border-right:1px solid var(--border);display:flex;flex-direction:column;padding:0;position:fixed;top:0;bottom:0;left:0;height:100vh;overflow:hidden;z-index:80;}
        .deliverer-sidebar .sidebar-brand{display:flex;align-items:center;gap:.75rem;padding:1.25rem;border:0;background:linear-gradient(135deg,#f65a24,#e84a1b 65%,#c93b16);}
        .deliverer-sidebar .brand-flame{font-size:1.6rem;color:#fff;}
        .deliverer-sidebar .brand-name{font-size:1rem;font-weight:700;color:#fff!important;letter-spacing:.04em;}
        .deliverer-sidebar .brand-sub{font-size:.65rem;color:rgba(255,255,255,.82)!important;letter-spacing:.06em;text-transform:uppercase;}
        .deliverer-sidebar .branch-badge{display:flex;align-items:center;gap:.5rem;padding:.68rem 1.25rem;font-size:.7rem;color:#fff!important;background:#d94218;letter-spacing:.06em;text-transform:uppercase;}
        .deliverer-sidebar .branch-dot{width:6px;height:6px;background:#fff;border-radius:50%;flex-shrink:0;}
        .sidebar-nav{flex:1;min-height:0;overflow-y:auto;padding:.7rem 0;}
        .sidebar-nav ul{list-style:none;margin:0;padding:0;}
        .deliverer-sidebar .nav-link{display:flex;align-items:center;gap:.75rem;padding:.68rem 1.25rem;color:var(--text-sub)!important;text-decoration:none;font-size:.84rem;border-left:0!important;transition:color .15s,background .15s;}
        .deliverer-sidebar .nav-link:hover{color:var(--text)!important;background:#fff5ef!important;}
        .deliverer-sidebar .nav-link.active{color:var(--flame)!important;background:#fff0e8!important;font-weight:600;}
        .deliverer-sidebar .nav-link.active::before{content:'';position:absolute;left:0;top:.45rem;bottom:.45rem;width:3px;background:var(--flame);border-radius:0 3px 3px 0;}
        .nav-icon{font-size:.9rem;width:18px;text-align:center;flex-shrink:0;}
        .deliverer-sidebar .sidebar-footer{margin-top:auto;flex-shrink:0;padding:1rem 1.25rem;border-top:1px solid var(--border);background:#fff8f4;}
        .sidebar-user{display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem;}
        .user-avatar{width:32px;height:32px;background:linear-gradient(135deg,#FF4B1F,#FF9F0A);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;color:white;flex-shrink:0;}
        .deliverer-sidebar .user-name{font-size:.82rem;font-weight:600;color:var(--text)!important;}
        .deliverer-sidebar .user-role{font-size:.68rem;color:var(--text-sub)!important;text-transform:capitalize;}
        .btn-logout{width:100%;padding:.55rem;background:rgba(255,59,48,.1);border:1px solid rgba(255,59,48,.2);border-radius:8px;color:#FF6B61;font-family:'Sora',sans-serif;font-size:.78rem;font-weight:600;cursor:pointer;transition:background .15s;}
        .btn-logout:hover{background:rgba(255,59,48,.2);}
        .main-content{flex:1;padding:2rem 2.5rem;overflow-y:auto;}
        @media(min-width:769px) and (max-width:1024px){.layout > #sidebar{width:220px;min-width:220px;flex-basis:220px;}.sidebar.deliverer-sidebar{width:220px;}}
        @media(max-width:768px){.layout > #sidebar{display:none;width:0;min-width:0;flex-basis:0;}.sidebar{display:none;}.main-content{padding:1.25rem;max-width:100vw;}.mobile-sidebar-content.deliverer-sidebar{display:flex;position:static;height:100%;width:100%;overflow:hidden!important;}}
    `;
    document.head.appendChild(style);
})();
