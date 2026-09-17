/* ============================================================
   login.js — আমাদের এলাকা
   ------------------------------------------------------------
   - Auth tab switching
   - Login / Register / Forgot submit
   - Login-required dialog
   - Logout
   - Auth ↔ App screen switching
   - App startup (splash + auth state listener)
   ============================================================ */

/* ============================================================
   HELPER: Screen show/hide
   ============================================================ */
function showAuthScreen() {
  const app = document.getElementById("app");
  const splash = document.getElementById("splash");

  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const authScreen = document.getElementById("screen-auth");
  if (authScreen) authScreen.classList.add("active");

  const navWrap = document.getElementById("bottom-nav-wrap");
  if (navWrap) navWrap.classList.add("hidden");

  if (splash) splash.classList.add("hide");
  document.body.style.overflow = "";
}

function showAppScreen() {
  const navWrap = document.getElementById("bottom-nav-wrap");
  if (navWrap) navWrap.classList.remove("hidden");
}

/* ============================================================
   AUTH TAB SWITCHING
   ============================================================ */
function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.authTab === tab);
  });

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const forgotForm = document.getElementById("forgot-form");

  if (loginForm) loginForm.classList.toggle("active", tab === "login");
  if (registerForm) registerForm.classList.toggle("active", tab === "register");
  if (forgotForm) forgotForm.classList.toggle("active", tab === "forgot");

  setTimeout(() => {
    if (tab === "login") {
      const el = document.getElementById("login-email");
      if (el) el.focus();
    } else if (tab === "register") {
      const el = document.getElementById("reg-name");
      if (el) el.focus();
    } else if (tab === "forgot") {
      const el = document.getElementById("forgot-email");
      if (el) el.focus();
    }
  }, 120);
}

/* ============================================================
   BUTTON LOADING HELPER
   ============================================================ */
function setButtonLoading(btn, isLoading, loadingText) {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span><span>${loadingText || "অপেক্ষা করুন..."}</span>`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalText) {
      btn.innerHTML = btn.dataset.originalText;
      delete btn.dataset.originalText;
    }
  }
}

/* ============================================================
   LOGIN FORM SUBMIT
   ============================================================ */
async function handleLoginSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("login-submit");
  const emailEl = document.getElementById("login-email");
  const passEl = document.getElementById("login-password");

  const email = (emailEl && emailEl.value || "").trim();
  const password = (passEl && passEl.value || "");

  if (!email || !password) {
    showToast("ইমেইল ও পাসওয়ার্ড দুটোই দিন", "warn");
    return;
  }

  setButtonLoading(btn, true, "লগইন হচ্ছে...");

  try {
    await loginUser(email, password);
    showToast("সফলভাবে লগইন হয়েছে", "success");
  } catch (err) {
    console.error(err);
    showToast(banglaAuthError(err), "error");
    setButtonLoading(btn, false);
  }
}

/* ============================================================
   REGISTER FORM SUBMIT
   ============================================================ */
async function handleRegisterSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("register-submit");

  const name = (document.getElementById("reg-name").value || "").trim();
  const email = (document.getElementById("reg-email").value || "").trim();
  const password = document.getElementById("reg-password").value || "";
  const area = (document.getElementById("reg-area").value || "").trim();
  const phone = (document.getElementById("reg-phone").value || "").trim();
  const agree = document.getElementById("reg-agree").checked;

  if (!name) { showToast("আপনার নাম লিখুন", "warn"); return; }
  if (!email) { showToast("ইমেইল লিখুন", "warn"); return; }
  if (!password || password.length < 6) {
    showToast("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে", "warn");
    return;
  }
  if (!area) { showToast("আপনার এলাকা লিখুন", "warn"); return; }
  if (!agree) {
    showToast("কমিউনিটি নিয়ম মেনে চলতে সম্মত হন", "warn");
    return;
  }

  setButtonLoading(btn, true, "অ্যাকাউন্ট খোলা হচ্ছে...");

  try {
    await registerUser({ name, email, password, area, phone });
    showToast("স্বাগতম! আপনার অ্যাকাউন্ট তৈরি হয়েছে।", "success");
  } catch (err) {
    console.error(err);
    showToast(banglaAuthError(err), "error");
    setButtonLoading(btn, false);
  }
}

/* ============================================================
   FORGOT PASSWORD SUBMIT
   ============================================================ */
async function handleForgotSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("forgot-submit");
  const email = (document.getElementById("forgot-email").value || "").trim();

  if (!email) {
    showToast("আপনার ইমেইল লিখুন", "warn");
    return;
  }

  setButtonLoading(btn, true, "পাঠানো হচ্ছে...");

  try {
    await sendPasswordReset(email);
    showToast("পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে", "success");
    setTimeout(() => switchAuthTab("login"), 900);
  } catch (err) {
    console.error(err);
    showToast(banglaAuthError(err), "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

function requireLogin(callback) {
  if (isLoggedIn()) {
    if (typeof callback === "function") callback();
    return true;
  }
  AppState.pendingCallback = callback || null;
  const overlay = document.getElementById("login-required-overlay");
  if (overlay) overlay.classList.add("active");
  return false;
}

function closeLoginRequiredDialog() {
  const overlay = document.getElementById("login-required-overlay");
  if (overlay) overlay.classList.remove("active");
}

/* ============================================================
   AFTER LOGIN — আগের কাজে ফেরত
   ============================================================ */
function runPendingCallback() {
  const cb = AppState.pendingCallback;
  AppState.pendingCallback = null;
  AppState.pendingAction = null;
  if (typeof cb === "function") {
    setTimeout(() => {
      try { cb(); } catch (err) { console.error("pending callback err:", err); }
    }, 100);
  }
}

/* ============================================================
   AUTH STATE CHANGE
   ============================================================ */
function handleAuthStateChange(user) {
  const splash = document.getElementById("splash");

  if (user) {
    if (typeof updateProfileUI === "function") updateProfileUI();

    const onAuthScreen = document.getElementById("screen-auth").classList.contains("active");
    const hasPending = !!AppState.pendingCallback;

    if (onAuthScreen) {
      if (hasPending) {
        if (typeof navigateTo === "function") navigateTo("home");
        runPendingCallback();
      } else {
        if (typeof navigateTo === "function") navigateTo("home");
      }
    } else {
      if (hasPending) runPendingCallback();
    }

    if (typeof loadUnreadNotifications === "function") {
      loadUnreadNotifications();
    }
  } else {
    showAppScreen();
    if (typeof updateProfileUI === "function") updateProfileUI();
  }

  if (splash && !splash.classList.contains("hide")) {
    setTimeout(() => splash.classList.add("hide"), 500);
  }
}

/* ============================================================
   LOGOUT
   ============================================================ */
async function handleLogout() {
  const overlay = document.createElement("div");
  overlay.className = "overlay center active";
  overlay.style.zIndex = "150";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-icon warn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </div>
      <h3>লগআউট করবেন?</h3>
      <p>আপনি কি নিশ্চিত যে আপনি লগআউট করতে চান?</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-act="no">থাকুন</button>
        <button class="btn btn-danger" data-act="yes">লগআউট</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act && e.target !== overlay) return;

    if (act === "yes") {
      overlay.remove();
      showLoading("লগআউট হচ্ছে...");
      try {
        await logoutUser();
        showToast("লগআউট হয়েছে", "success");
        showAuthScreen();
        switchAuthTab("login");
        document.getElementById("login-form")?.reset();
      } catch (err) {
        console.error(err);
      } finally {
        hideLoading();
      }
    } else if (act === "no" || e.target === overlay) {
      overlay.remove();
    }
  });
}

/* ============================================================
   GUEST BROWSE
   ============================================================ */
function handleGuestBrowse() {
  showAppScreen();
  const splash = document.getElementById("splash");
  if (splash) splash.classList.add("hide");

  if (typeof navigateTo === "function") {
    navigateTo("home");
  } else {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById("screen-home")?.classList.add("active");
  }
}

/* ============================================================
   EVENT BINDING
   ============================================================ */
function bindAuthEvents() {
  document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      switchAuthTab(tab.dataset.authTab);
    });
  });

  document.querySelectorAll(".forgot-link").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      switchAuthTab("forgot");
    });
  });

  document.querySelectorAll(".back-to-login").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      switchAuthTab("login");
    });
  });

  document.querySelectorAll(".rules-link").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof navigateTo === "function") navigateTo("rules");
    });
  });

  document.querySelectorAll(".browse-guest-btn").forEach(btn => {
    btn.addEventListener("click", handleGuestBrowse);
  });

  document.getElementById("login-form")?.addEventListener("submit", handleLoginSubmit);
  document.getElementById("register-form")?.addEventListener("submit", handleRegisterSubmit);
  document.getElementById("forgot-form")?.addEventListener("submit", handleForgotSubmit);

  document.querySelectorAll("[data-action='dismiss-login']").forEach(btn => {
    btn.addEventListener("click", () => {
      closeLoginRequiredDialog();
      AppState.pendingCallback = null;
      AppState.pendingAction = null;
    });
  });

  document.querySelectorAll("[data-action='go-login']").forEach(btn => {
    btn.addEventListener("click", () => {
      closeLoginRequiredDialog();
      showAuthScreen();
      switchAuthTab("login");
    });
  });

  document.querySelectorAll("[data-action='open-login']").forEach(btn => {
    btn.addEventListener("click", () => {
      showAuthScreen();
      switchAuthTab("login");
    });
  });

  document.querySelectorAll("[data-action='open-register']").forEach(btn => {
    btn.addEventListener("click", () => {
      showAuthScreen();
      switchAuthTab("register");
    });
  });

  document.querySelectorAll("[data-action='logout']").forEach(el => {
    el.addEventListener("click", handleLogout);
  });

  document.getElementById("login-required-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "login-required-overlay") {
      closeLoginRequiredDialog();
      AppState.pendingCallback = null;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLoginRequiredDialog();
    }
  });
}

/* ============================================================
   APP STARTUP
   ============================================================ */
function bootAuth() {
  bindAuthEvents();

  const bootTime = Date.now();

  initAuthListener((user) => {
    const elapsed = Date.now() - bootTime;
    const minSplash = 250;
    const wait = Math.max(0, minSplash - elapsed);

    setTimeout(() => {
      const splash = document.getElementById("splash");

      if (user) {
        if (typeof navigateTo === "function") {
          navigateTo("home");
        } else {
          document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
          document.getElementById("screen-home")?.classList.add("active");
        }
        showAppScreen();
      } else {
        showAuthScreen();
      }

      if (splash) splash.classList.add("hide");

      if (typeof updateProfileUI === "function") updateProfileUI();

     if (user && typeof loadUnreadNotifications === "function") {
  setTimeout(loadUnreadNotifications, 800);
}
    }, wait);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootAuth);
} else {
  bootAuth();
}

window.showAuthScreen = showAuthScreen;
window.showAppScreen = showAppScreen;
window.switchAuthTab = switchAuthTab;
window.requireLogin = requireLogin;
window.closeLoginRequiredDialog = closeLoginRequiredDialog;
window.runPendingCallback = runPendingCallback;
window.handleLogout = handleLogout;
window.setButtonLoading = setButtonLoading;

console.log("%cআমাদের এলাকা • login.js loaded", "color:#0d9488;font-weight:700;");