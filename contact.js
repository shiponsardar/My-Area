/* ============================================================
   contact.js — আমাদের এলাকা
   ------------------------------------------------------------
   - Contact page (phone/email/whatsapp/facebook)
   - Message form → WhatsApp / Email
   - Community Rules (Firestore settings/rules → fallback default)
   - Contact / Rules screen navigation binding
   ============================================================ */

/* ============================================================
   DEFAULT RULES (Firestore না থাকলে এগুলো দেখাবে)
   ============================================================ */
const DEFAULT_RULES = [
  "সবসময় ভদ্র ভাষা ব্যবহার করুন।",
  "ভুল তথ্য ছড়াবেন না — সব খবর যাচাই করে পোস্ট করুন।",
  "অন্যের ব্যক্তিগত তথ্য প্রকাশ করবেন না।",
  "প্রতারণামূলক বা ভুয়া পোস্ট করা নিষিদ্ধ।",
  "অশালীন কোনো কনটেন্ট পোস্ট করবেন না।",
  "জরুরি বিজ্ঞপ্তিতে যাচাই করা তথ্য দিন।",
  "একই পোস্ট বারবার করবেন না (স্প্যাম নিষিদ্ধ)।",
  "কমিউনিটির সদস্যদের প্রতি সম্মান রাখুন।"
];

/* ============================================================
   BANGLA DIGITS HELPER
   ============================================================ */
function bn(n) {
  return typeof toBanglaNumber === "function" ? toBanglaNumber(n) : String(n);
}

/* ============================================================
   1) CONTACT PAGE — dynamic links populate
   ============================================================ */
function populateContactLinks() {
  const cfg = window.APP_CONFIG || {};

  const phone = cfg.CONTACT_PHONE || "";
  const email = cfg.CONTACT_EMAIL || "";
  const whatsapp = cfg.CONTACT_WHATSAPP || "";
  const facebook = cfg.CONTACT_FACEBOOK || "";

  // Phone
  const phoneRow = document.querySelector('#screen-contact a[href^="tel:"]');
  if (phoneRow) {
    phoneRow.href = phone ? `tel:${phone}` : "#";
    const sub = phoneRow.querySelector("div:last-child > div:last-child");
    if (sub) sub.textContent = phone ? formatPhoneBn(phone) : "সংরক্ষিত নেই";
    if (!phone) phoneRow.style.opacity = "0.5";
  }

  // Email
  const mailRow = document.querySelector('#screen-contact a[href^="mailto:"]');
  if (mailRow) {
    mailRow.href = email ? `mailto:${email}` : "#";
    const sub = mailRow.querySelector("div:last-child > div:last-child");
    if (sub) sub.textContent = email || "সংরক্ষিত নেই";
    if (!email) mailRow.style.opacity = "0.5";
  }

  // WhatsApp
  const waRow = document.querySelector('#screen-contact a[href*="wa.me"]');
  if (waRow) {
    waRow.href = whatsapp ? `https://wa.me/${whatsapp}` : "#";
    if (!whatsapp) waRow.style.opacity = "0.5";
  }

  // Facebook
  const fbRow = document.querySelector('#screen-contact a[href*="facebook"]');
  if (fbRow) {
    fbRow.href = facebook || "#";
    if (!facebook) fbRow.style.opacity = "0.5";
  }
}

function formatPhoneBn(phone) {
  const digits = String(phone).replace(/\D/g, "");
  // "8801700000000" → "০১৭০০-০০০০০০"
  const clean = digits.startsWith("88") ? digits.slice(2) : digits;
  if (clean.length === 11) {
    return bn(clean.slice(0, 5)) + "-" + bn(clean.slice(5));
  }
  return bn(clean);
}

/* ============================================================
   2) MESSAGE FORM → WhatsApp / Email
   ============================================================ */
function handleContactMessageSend() {
  const cfg = window.APP_CONFIG || {};
  const nameEl = document.getElementById("contact-name");
  const infoEl = document.getElementById("contact-info");
  const msgEl = document.getElementById("contact-msg");
  const btn = document.getElementById("contact-send-btn");

  const name = (nameEl?.value || "").trim();
  const info = (infoEl?.value || "").trim();
  const message = (msgEl?.value || "").trim();

  if (!name) {
    showToast("আপনার নাম লিখুন", "warn");
    nameEl?.focus();
    return;
  }
  if (!message || message.length < 5) {
    showToast("বার্তা কমপক্ষে ৫ অক্ষরের হতে হবে", "warn");
    msgEl?.focus();
    return;
  }

  const waNumber = cfg.CONTACT_WHATSAPP || "";
  const emailAddr = cfg.CONTACT_EMAIL || "";

  const fullMessage =
    `আমাদের এলাকা অ্যাপ থেকে বার্তা\n\n` +
    `নাম: ${name}\n` +
    (info ? `যোগাযোগ: ${info}\n` : "") +
    `\nবার্তা:\n${message}`;

  // Priority: WhatsApp → Email → Copy
  if (waNumber) {
    openWhatsApp(waNumber, fullMessage, btn);
  } else if (emailAddr) {
    openEmail(emailAddr, "আমাদের এলাকা — নতুন বার্তা", fullMessage, btn);
  } else {
    copyToClipboard(fullMessage).then(() => {
      showToast("বার্তা কপি হয়েছে — আপনার অ্যাপে পেস্ট করুন", "success");
      clearContactForm();
    });
  }
}

function openWhatsApp(number, message, btn) {
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${number}?text=${encoded}`;

  if (btn) setButtonLoading(btn, true, "খোলা হচ্ছে...");

  try {
    const newWin = window.open(url, "_blank");
    if (!newWin) {
      // Popup block হলে direct assign
      window.location.href = url;
    }
    showToast("WhatsApp খোলা হচ্ছে...", "success");
    setTimeout(() => {
      clearContactForm();
      if (btn) setButtonLoading(btn, false);
    }, 900);
  } catch (err) {
    console.error(err);
    showToast("WhatsApp খোলা যায়নি", "error");
    if (btn) setButtonLoading(btn, false);
  }
}

function openEmail(email, subject, body, btn) {
  const url =
    `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  if (btn) setButtonLoading(btn, true, "খোলা হচ্ছে...");

  try {
    window.location.href = url;
    showToast("ইমেইল অ্যাপ খোলা হচ্ছে...", "success");
    setTimeout(() => {
      clearContactForm();
      if (btn) setButtonLoading(btn, false);
    }, 900);
  } catch (err) {
    console.error(err);
    showToast("ইমেইল অ্যাপ খোলা যায়নি", "error");
    if (btn) setButtonLoading(btn, false);
  }
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  } catch (e) {
    return false;
  }
}

function clearContactForm() {
  const ids = ["contact-name", "contact-info", "contact-msg"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

/* ============================================================
   3) COMMUNITY RULES
   ------------------------------------------------------------
   Firestore: settings/rules  →  { items: [...], updatedAt }
   না থাকলে DEFAULT_RULES
   ============================================================ */
async function loadCommunityRules() {
  const list = document.getElementById("rules-list");
  if (!list) return;

  // Loading skeleton
  list.innerHTML = `
    <div class="skeleton sk-line w100" style="height:44px;margin-bottom:10px;"></div>
    <div class="skeleton sk-line w100" style="height:44px;margin-bottom:10px;"></div>
    <div class="skeleton sk-line w100" style="height:44px;"></div>
  `;

  let rules = DEFAULT_RULES;

  try {
    const doc = await db.collection("settings").doc("rules").get();
    if (doc.exists) {
      const data = doc.data();
      if (Array.isArray(data.items) && data.items.length > 0) {
        rules = data.items.filter(r => typeof r === "string" && r.trim());
      }
    }
  } catch (err) {
    // permission denied হলেও default দেখাবে
    console.warn("rules load failed → using default", err);
  }

  renderRulesList(rules);
  return rules;
}

function renderRulesList(rules) {
  const list = document.getElementById("rules-list");
  if (!list) return;

  if (!rules || !rules.length) {
    list.innerHTML = `
      <div style="padding:20px;text-align:center;color:var(--gray-500);font-size:13px;">
        এখনো কোনো নিয়ম যোগ করা হয়নি।
      </div>
    `;
    return;
  }

  list.innerHTML = rules.map((rule, idx) => `
    <li style="display:flex;gap:12px;">
      <span style="
        width:26px;height:26px;
        background:var(--primary-100);color:var(--primary-700);
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-weight:700;font-size:13px;flex-shrink:0;
      ">${bn(idx + 1)}</span>
      <span style="font-size:14px;line-height:1.6;color:var(--gray-700);">
        ${escapeHtml(rule)}
      </span>
    </li>
  `).join("");
}

/* ============================================================
   4) NAVIGATION HELPERS
   ============================================================ */
function openContactScreen() {
  if (typeof navigateTo === "function") {
    navigateTo("contact");
  } else {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById("screen-contact")?.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // লিংকগুলো refresh
  setTimeout(populateContactLinks, 100);
}

function openRulesScreen() {
  if (typeof navigateTo === "function") {
    navigateTo("rules");
  } else {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById("screen-rules")?.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // rules load
  setTimeout(loadCommunityRules, 100);
}

/* ============================================================
   5) EVENT BINDING
   ============================================================ */
function bindContactEvents() {
  /* ---- Message form submit ---- */
  const sendBtn = document.getElementById("contact-send-btn");
  if (sendBtn && !sendBtn.dataset.bound) {
    sendBtn.dataset.bound = "1";
    sendBtn.addEventListener("click", handleContactMessageSend);
  }

  /* ---- Contact menu item (from profile) ---- */
  document.querySelectorAll("[data-action='contact-us']").forEach(el => {
    if (el.dataset.bound) return;
    el.dataset.bound = "1";
    el.addEventListener("click", openContactScreen);
  });

  /* ---- Community rules menu item (from profile) ---- */
  document.querySelectorAll("[data-action='community-rules']").forEach(el => {
    if (el.dataset.bound) return;
    el.dataset.bound = "1";
    el.addEventListener("click", openRulesScreen);
  });

  /* ---- Rules link in register form ---- */
  document.querySelectorAll(".rules-link").forEach(el => {
    if (el.dataset.bound) return;
    el.dataset.bound = "1";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openRulesScreen();
    });
  });

  /* ---- Enter key on message textarea → submit (Ctrl+Enter দিয়ে) ---- */
  const msgEl = document.getElementById("contact-msg");
  if (msgEl && !msgEl.dataset.bound) {
    msgEl.dataset.bound = "1";
    msgEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleContactMessageSend();
      }
    });
  }
}

/* ============================================================
   6) AUTO POPULATE ON STARTUP
   ============================================================ */
function initContactModule() {
  try {
    populateContactLinks();
    bindContactEvents();

    // Rules আগে থেকেই load করে রাখব না — rules screen-এ গেলে load হবে
    // কিন্তু profile menu তে rules link থাকলে click-এ load হবে (openRulesScreen এ timeout দিয়ে)
  } catch (err) {
    console.warn("contact module init failed", err);
  }
}

/* DOM ready এ bind */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initContactModule);
} else {
  initContactModule();
}

/* ============================================================
   EXPOSE
   ============================================================ */
window.populateContactLinks = populateContactLinks;
window.handleContactMessageSend = handleContactMessageSend;
window.loadCommunityRules = loadCommunityRules;
window.renderRulesList = renderRulesList;
window.openContactScreen = openContactScreen;
window.openRulesScreen = openRulesScreen;
window.bindContactEvents = bindContactEvents;

console.log("%cআমাদের এলাকা • contact.js loaded", "color:#0d9488;font-weight:700;");