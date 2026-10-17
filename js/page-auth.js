import { API, AuthState, SharedNav, initStarfield, showToast } from '/js/social.js';

initStarfield('starfield-canvas');
SharedNav.init('auth');

const tabLogin = document.getElementById('tab-login-btn');
const tabReg = document.getElementById('tab-register-btn');
const formLogin = document.getElementById('login-form');
const formReg = document.getElementById('register-form');
const urlParams = new URLSearchParams(window.location.search);
const nextUrl = urlParams.get('next') || '/social';

function setMode(mode) {
  if (mode === 'register') {
    tabReg.classList.add('active');
    tabLogin.classList.remove('active');
    formReg.style.display = 'block';
    formLogin.style.display = 'none';
    window.history.replaceState(null, '', `/register${window.location.search}`);
  } else {
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
    formLogin.style.display = 'block';
    formReg.style.display = 'none';
    window.history.replaceState(null, '', `/login${window.location.search}`);
  }
}

if (window.location.pathname.includes('/register')) {
  setMode('register');
}

tabLogin.addEventListener('click', () => setMode('login'));
tabReg.addEventListener('click', () => setMode('register'));

// Live Nickname Availability Check
const nickInput = document.getElementById('reg-nickname');
const nickStatus = document.getElementById('nick-availability');
let debounceTimer;

nickInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const val = nickInput.value.trim();
  if (!val) {
    nickStatus.textContent = '';
    return;
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(val)) {
    nickStatus.textContent = 'INVALID SYNTAX';
    nickStatus.style.color = 'var(--accent-alert)';
    return;
  }
  nickStatus.textContent = 'CHECKING...';
  nickStatus.style.color = 'var(--text-muted)';

  debounceTimer = setTimeout(async () => {
    try {
      await API.get(`/api/users/${encodeURIComponent(val)}`, { silent: true });
      nickStatus.textContent = 'TAKEN';
      nickStatus.style.color = 'var(--accent-alert)';
    } catch (e) {
      if (e.status === 404) {
        nickStatus.textContent = 'AVAILABLE';
        nickStatus.style.color = 'var(--accent-success)';
      } else {
        nickStatus.textContent = '';
      }
    }
  }, 350);
});

// Password strength hint (minimum 10 chars as per baseline security requirements)
const passInput = document.getElementById('reg-password');
const strengthBar = document.getElementById('strength-bar');
const strengthLabel = document.getElementById('strength-label');

passInput.addEventListener('input', () => {
  const val = passInput.value;
  let score = 0;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  if (val.length === 0) {
    strengthBar.style.width = '0%';
    strengthLabel.textContent = '';
  } else if (val.length < 10 || score <= 1) {
    strengthBar.style.width = '33%';
    strengthBar.style.background = 'var(--accent-alert)';
    strengthLabel.textContent = 'WEAK (< 10 CHARS)';
    strengthLabel.style.color = 'var(--accent-alert)';
  } else if (score === 2 || score === 3) {
    strengthBar.style.width = '66%';
    strengthBar.style.background = 'var(--accent-gold)';
    strengthLabel.textContent = 'MODERATE';
    strengthLabel.style.color = 'var(--accent-gold)';
  } else {
    strengthBar.style.width = '100%';
    strengthBar.style.background = 'var(--accent-success)';
    strengthLabel.textContent = 'STRONG';
    strengthLabel.style.color = 'var(--accent-success)';
  }
});

// Form Submissions with button loading states & field validation
const loginBtn = formLogin.querySelector('button[type="submit"]');
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (typeof UI !== 'undefined') UI.clearFieldErrors(formLogin);
  const usernameEl = document.getElementById('login-username');
  const passwordEl = document.getElementById('login-password');
  const username = usernameEl.value.trim();
  const password = passwordEl.value;

  if (typeof UI !== 'undefined') UI.setLoading(loginBtn, true, 'AUTHENTICATING...');
  try {
    const res = await API.post('/api/login', { username, password }, { silent: true, form: formLogin });
    showToast(`Authenticated as @${res.user.nickname}`, 'success');
    await AuthState.fetchUser();
    setTimeout(() => {
      window.location.href = nextUrl;
    }, 300);
  } catch (err) {
    if (typeof UI !== 'undefined') UI.setLoading(loginBtn, false);
    showToast(err.message || 'Authentication failed', 'error');
  }
});

const regBtn = formReg.querySelector('button[type="submit"]');
formReg.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (typeof UI !== 'undefined') UI.clearFieldErrors(formReg);
  const nameEl = document.getElementById('reg-name');
  const nickEl = document.getElementById('reg-nickname');
  const emailEl = document.getElementById('reg-email');
  const passEl = document.getElementById('reg-password');

  const name = nameEl.value.trim();
  const nickname = nickEl.value.trim();
  const email = emailEl.value.trim();
  const password = passEl.value;

  if (password.length < 10) {
    if (typeof UI !== 'undefined') {
      UI.fieldError(passEl, 'Password must be at least 10 characters long');
    }
    showToast('Password must be at least 10 characters long', 'error');
    return;
  }

  if (typeof UI !== 'undefined') UI.setLoading(regBtn, true, 'CREATING OBSERVER...');
  try {
    const res = await API.post('/api/register', { name, nickname, email, password }, { silent: true, form: formReg });
    showToast(`Observer callsign @${res.user.nickname} created!`, 'success');
    await AuthState.fetchUser();
    setTimeout(() => {
      window.location.href = nextUrl;
    }, 400);
  } catch (err) {
    if (typeof UI !== 'undefined') UI.setLoading(regBtn, false);
    showToast(err.message || 'Registration failed', 'error');
  }
});

// If already logged in, redirect away
AuthState.fetchUser().then(user => {
  if (user) {
    window.location.href = nextUrl;
  }
});
