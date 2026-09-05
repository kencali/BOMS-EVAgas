  // ── Redirect if already logged in ─────────────────────────
  // If they visit index.html but are already logged in, skip to dashboard
  (function() {
    const token = localStorage.getItem('boms_token');
    const role  = localStorage.getItem('boms_role');
    if (token && role) {
      const map = {
        admin:     '/BOMS-EVAgas/public/admin/dashboard.html',
        employee:  '/BOMS-EVAgas/public/employee/dashboard.html',
        deliverer: '/BOMS-EVAgas/public/deliverer/dashboard.html',
      };
      window.location.href = map[role] || '/BOMS-EVAgas/public/index.html';
    }
  })();

  // ── Show error on the page ─────────────────────────────────
  function showError(msg) {
    const el = document.getElementById('errorMsg');
    el.textContent = msg;
    el.classList.add('show');
  }

  function hideError() {
    document.getElementById('errorMsg').classList.remove('show');
  }

  // ── Handle login click ─────────────────────────────────────
  async function handleLogin() {
    hideError();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
      showError('Please enter your username and password.');
      return;
    }

    // Show loading spinner on button
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.classList.add('loading');

    const error = await Auth.login(username, password);

    // If Auth.login() returned an error message, show it
    if (error) {
      document.getElementById('password').value = '';
      showError(error);
      btn.disabled = false;
      btn.classList.remove('loading');
    }
    // If no error → Auth.login already redirected to dashboard
  }

  // ── Allow pressing Enter to login ─────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
