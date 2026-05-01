// File: assets/js/theme.js
// Place in: /assets/js/theme.js
// Handles dark/light theme switching across the whole system.
// Employee pages default to light, admin/deliverer default to dark.
// The preference is saved so it persists between page visits.

const Theme = {

    // Call this at the very top of every page's DOMContentLoaded
    // Pass the default if no saved preference exists
    init(defaultTheme = 'dark') {
        const saved = localStorage.getItem('boms_theme') || defaultTheme;
        this.apply(saved);
    },

    apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('boms_theme', theme);

        // Update the toggle button icon if one exists on the page
        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.textContent = theme === 'dark' ? '☀️' : '🌙';
            btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
        }
    },

    toggle() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        this.apply(current === 'dark' ? 'light' : 'dark');
    },

    current() {
        return document.documentElement.getAttribute('data-theme') || 'dark';
    }
};

// Inject all CSS variables for both themes into the document.
// Using :root[data-theme] so a single JS call flips everything.
(function injectThemeCSS() {
    const style = document.createElement('style');
    style.textContent = `

        /* Dark theme (default for admin and deliverer) */
        :root[data-theme="dark"],
        :root:not([data-theme]) {
            --bg:          #0F0E0C;
            --surface:     #141310;
            --card:        #1E1C19;
            --card-hover:  #252320;
            --border:      rgba(255,255,255,.07);
            --border-mid:  rgba(255,255,255,.12);
            --text:        #F5F0E8;
            --text-sub:    #9E9B92;
            --text-muted:  #6B6860;
            --white:       #FFFFFF;
            --input-bg:    #141310;
            --shadow:      0 4px 24px rgba(0,0,0,.4);
            --flame:       #FF4B1F;
            --flame-soft:  rgba(255,75,31,.12);
            --amber:       #FF9F0A;
            --green:       #34C759;
            --red:         #FF3B30;
            --blue:        #5AC8FA;
            --purple:      #BF5AF2;
        }

        /* Light theme (default for employee pages) */
        :root[data-theme="light"] {
            --bg:          #F5F1EB;
            --surface:     #EDEAE3;
            --card:        #FFFFFF;
            --card-hover:  #FAF8F5;
            --border:      rgba(0,0,0,.08);
            --border-mid:  rgba(0,0,0,.14);
            --text:        #1A1916;
            --text-sub:    #6B6860;
            --text-muted:  #9E9B92;
            --white:       #FFFFFF;
            --input-bg:    #F5F1EB;
            --shadow:      0 2px 12px rgba(0,0,0,.08);
            --flame:       #E8390D;
            --flame-soft:  rgba(232,57,13,.1);
            --amber:       #D97706;
            --green:       #16A34A;
            --red:         #DC2626;
            --blue:        #0284C7;
            --purple:      #7C3AED;
        }

        /* Base styles that use the variables — apply to every page */
        html, body {
            background: var(--bg);
            color: var(--text);
            transition: background .2s, color .2s;
        }

        /* Theme toggle button — place this in sidebar or header */
        .theme-toggle-btn {
            background: none;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: .4rem .6rem;
            color: var(--text-sub);
            cursor: pointer;
            font-size: .9rem;
            transition: all .15s;
            line-height: 1;
        }
        .theme-toggle-btn:hover {
            border-color: var(--flame);
            color: var(--flame);
        }
    `;
    document.head.insertBefore(style, document.head.firstChild);
})();