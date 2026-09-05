// ============================================================
// FILE: assets/js/api.js
// PURPOSE: One place for all API calls.
//          Every JS file uses this instead of writing
//          fetch() from scratch every time.
//
// HOW IT WORKS:
//   - Automatically adds the Authorization token to every request
//   - If server says 401 (token expired), redirects to login
//   - Returns the response data or throws an error
// ============================================================

const API_BASE = '/BOMS-EVAgas/api'; // all API calls start with /api

const Api = {

    // Low-level request method (other methods call this)
    async request(endpoint, method = 'GET', body = null) {
        const token = localStorage.getItem('boms_token'); // get saved token

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                // If we have a token, attach it — the server reads this
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };

        if (body) {
            options.body = JSON.stringify(body); // convert JS object to JSON string
        }

        const response = await fetch(`${API_BASE}/${endpoint}`, options);
        const data = await response.json();

        // A 401 from a protected endpoint means the saved token is expired or invalid.
        // Login intentionally returns 401 for invalid credentials, which must remain on this page.
        if (response.status === 401 && endpoint !== 'auth/login.php') {
            Auth.logout(); // clears localStorage
            window.location.href = '/BOMS-EVAgas/public/index.html';
            return;
        }

        // If the API returned success:false, throw so callers can catch it
        if (!data.success) {
            throw new Error(data.message || 'Something went wrong.');
        }

        return data.data; // return the actual payload
    },

    // Convenience methods — use these in your page JS files
    get(endpoint)              { return this.request(endpoint, 'GET'); },
    post(endpoint, body)       { return this.request(endpoint, 'POST', body); },
    put(endpoint, body)        { return this.request(endpoint, 'PUT', body); },
    delete(endpoint)           { return this.request(endpoint, 'DELETE'); },
};
