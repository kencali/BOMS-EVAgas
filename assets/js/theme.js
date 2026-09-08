// File: assets/js/theme.js
// Place in: /assets/js/theme.js
// Applies the system-wide light-only visual variables.

const Theme = {

    init() {
        this.apply();
    },

    apply() {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.removeItem('boms_theme');
    },

    current() {
        return 'light';
    }
};

// Inject all CSS variables for both themes into the document.
// Using :root[data-theme] so a single JS call flips everything.
(function injectThemeCSS() {
    const style = document.createElement('style');
    style.textContent = `

        :root, :root[data-theme="light"] {
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
