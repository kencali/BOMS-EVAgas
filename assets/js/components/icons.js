// Local Lucide-style SVG icon helper. No CDN or image dependency required.
const BomsIcons = (() => {
    const paths = {
        dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        package: '<path d="m21 16-9 5-9-5V8l9-5 9 5Z"/><path d="m3.3 7.8 8.7 5 8.7-5M12 22V12.8"/>',
        boxes: '<path d="m21 16-9 5-9-5V8l9-5 9 5Z"/><path d="m3.3 7.8 8.7 5 8.7-5M12 22V12.8"/><path d="M7.5 5.5 16.5 10"/>',
        wallet: '<path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7"/><path d="M16 14h.01"/>',
        truck: '<path d="M10 17h4V5H2v12h3"/><path d="M14 8h4l4 4v5h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
        users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
        receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 4-2V2l-3 2-3-2-3 2-3-2Z"/><path d="M8 9h8M8 13h8"/>',
        chart: '<path d="M3 3v18h18"/><path d="m7 16 4-5 3 3 5-7"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
        refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8"/><path d="M3 21v-5h5M21 3v5h-5"/>',
        cart: '<circle cx="8" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M2 3h3l2.5 12h11l2-8H6"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        x: '<path d="m6 6 12 12M18 6 6 18"/>',
        alert: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
        trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        play: '<path d="m8 5 11 7-11 7Z"/>',
        arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        flame: '<path d="M12 22c4 0 7-2.8 7-7.1 0-3.1-1.7-5.3-4.1-7.9.1 2.6-1.2 3.8-2.2 4.4C13 7.7 10.5 5.3 8 3c.1 3.5-3 5.3-3 10.2C5 18.2 8.1 22 12 22Z"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
        moon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z"/>',
        sunrise: '<path d="M3 18h18M5 14l2-2 2 2 3-4 3 4 2-2 2 2M12 2v4M4.9 6.9l1.4 1.4M19.1 6.9l-1.4 1.4"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.1-2.1.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5.3v-3h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.1 2.1-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v3h-.2a1.7 1.7 0 0 0-1.5 1Z"/>',
    };
    function icon(name, label = '') {
        const content = paths[name] || paths.alert;
        const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
        return `<svg class="boms-icon" ${aria} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
    }
    function replaceAll(root = document) {
        root.querySelectorAll('[data-icon]').forEach(el => {
            el.innerHTML = icon(el.dataset.icon, el.dataset.iconLabel || '');
            el.classList.add('boms-icon-wrap');
        });
    }
    document.addEventListener('DOMContentLoaded', () => replaceAll());
    return { icon, replaceAll };
})();
