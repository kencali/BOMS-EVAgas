// ============================================================
// FILE: assets/js/auth.js
// PURPOSE: Handles everything login-related on the frontend.
//
// CONTAINS:
//   Auth.login()   - submits the login form
//   Auth.logout()  - clears token and goes to login page
//   Auth.guard()   - call at the top of every protected page
//   Auth.getUser() - returns the current user's info
// ============================================================

const Auth = {

    // ── LOGIN ──────────────────────────────────────────────
    // Called when user clicks the Login button
    async login(username, password) {
        try {
            const data = await Api.post('auth/login.php', { username, password });

            // Save token and user info to localStorage
            // (localStorage = browser's memory, survives page refresh)
            localStorage.setItem('boms_token',     data.token);
            localStorage.setItem('boms_role',      data.role);
            localStorage.setItem('boms_branch_id', data.branch_id);
            localStorage.setItem('boms_name',      data.full_name);

            // Go to the correct dashboard based on role
            window.location.href = data.redirect;

        } catch (error) {
            // Show error message on the login page
            return error.message; // returns the error so the form can display it
        }
    },

    // ── LOGOUT ─────────────────────────────────────────────
    logout() {
        // Clear everything from localStorage
        localStorage.removeItem('boms_token');
        localStorage.removeItem('boms_role');
        localStorage.removeItem('boms_branch_id');
        localStorage.removeItem('boms_name');

        window.location.href = '/BOMS-EVAgas/public/index.html';
    },

    // ── GUARD ──────────────────────────────────────────────
    // Put Auth.guard() OR Auth.guard(['admin']) at the top of protected pages.
    // If the user isn't logged in, they get sent to login immediately.
    // If they don't have the right role, they get sent to their own dashboard.
    guard(allowedRoles = []) {
        const token = localStorage.getItem('boms_token');
        const role  = localStorage.getItem('boms_role');

        if (!token) {
            // Not logged in at all
            window.location.href = '/BOMS-EVAgas/public/index.html';
            return false;
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
            // Logged in but wrong role — send to their dashboard
            const dashboards = {
                admin:     '/BOMS-EVAgas/public/admin/dashboard.html',
                employee:  '/BOMS-EVAgas/public/employee/dashboard.html',
                deliverer: '/BOMS-EVAgas/public/deliverer/dashboard.html',
            };
            window.location.href = dashboards[role] || '/BOMS-EVAgas/public/index.html';
            return false;
        }

        return true;
    },

    // ── GET CURRENT USER ───────────────────────────────────
    // Returns the current user's info saved in localStorage
    getUser() {
        return {
            role:      localStorage.getItem('boms_role'),
            branch_id: parseInt(localStorage.getItem('boms_branch_id')),
            name:      localStorage.getItem('boms_name'),
        };
    },
};