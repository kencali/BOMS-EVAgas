// Shared mobile navigation for the three role sidebars.
// It reuses the rendered sidebar so navigation, account details, and logout stay in one source of truth.
const BomsMobileNavigation = (() => {
    function close() {
        document.body.classList.remove('boms-nav-open');
        const button = document.querySelector('.mobile-nav-toggle');
        if (button) button.setAttribute('aria-expanded', 'false');
    }

    function init() {
        if (document.querySelector('.mobile-nav-shell')) return;
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;
        const mainContent = document.querySelector('.main-content');
        if (mainContent && !mainContent.id) mainContent.id = 'main-content';

        const shell = document.createElement('div');
        shell.className = 'mobile-nav-shell';
        shell.innerHTML = `
            <header class="mobile-topbar">
                <a class="mobile-brand" href="#main-content" aria-label="BOMS main content">
                    <span class="mobile-brand-icon">${BomsIcons.icon('flame')}</span>
                    <span><strong>BOMS</strong><small>EVA Gas Trading</small></span>
                </a>
                <button class="mobile-nav-toggle" type="button" aria-label="Open navigation" aria-controls="mobile-nav-drawer" aria-expanded="false">
                    <span>${BomsIcons.icon('menu')}</span><span class="mobile-menu-label">Menu</span>
                </button>
            </header>
            <button class="mobile-nav-backdrop" type="button" aria-label="Close navigation"></button>
            <aside class="mobile-nav-drawer" id="mobile-nav-drawer" aria-label="Mobile navigation"></aside>`;
        document.body.prepend(shell);

        const drawer = shell.querySelector('.mobile-nav-drawer');
        const clonedSidebar = sidebar.cloneNode(true);
        clonedSidebar.classList.add('mobile-sidebar-content');
        clonedSidebar.removeAttribute('id');
        drawer.appendChild(clonedSidebar);

        const toggle = shell.querySelector('.mobile-nav-toggle');
        toggle.addEventListener('click', () => {
            const isOpen = document.body.classList.toggle('boms-nav-open');
            toggle.setAttribute('aria-expanded', String(isOpen));
        });
        shell.querySelector('.mobile-nav-backdrop').addEventListener('click', close);
        drawer.querySelectorAll('a').forEach(link => link.addEventListener('click', close));
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') close();
        });
    }

    return { init, close };
})();
