/* ============================================================
   loading.js — আমাদের এলাকা
   ------------------------------------------------------------
   এই ফাইলেই থাকছে:
   1) APP_CONFIG + Firebase Init
   2) Global State (AppState)
   3) Toast + Loading
   4) Utils (Bangla number, time, escape)
   5) Auth helpers (login/register/logout/listener)
   6) External image upload (Firebase Storage ছাড়া)
   7) Firestore generic helpers
   8) Bangla error messages
   ============================================================ */

/* ============================================================
   1) APP CONFIG — এখানেই সব সেটিং
   ============================================================ */
const APP_CONFIG = {
  APP_NAME: "আমার এলাকা",
  AREA_NAME: "আমার এলাকা",
  AREA_ID: "ঢাকা",

  // Admin দের UID এখানে বসান
  // Firebase Console → Authentication → Users → UID কপি করুন
  ADMIN_UIDS: [
  "OXw33nuTk0Tkisfwf8MQz7lxJof2"
],

 IMAGE_HOST: "imgbb",
IMGBB_KEY: "e2949edba56f90a622727c4e118c63e0",

  MAX_IMAGE_SIZE: 10 * 1024 * 1024,   // 10 MB
  MAX_IMAGES_PER_POST: 5,
  MAX_IMAGE_WIDTH: 1600,
  IMAGE_QUALITY: 0.82,

  POSTS_PER_PAGE: 10,
  COMMENTS_PER_PAGE: 20,

  // Contact info (contact.js এ ব্যবহার হবে)
  CONTACT_PHONE: "+8801952170524",
  CONTACT_EMAIL: "misynkobd@gmail.com",
  CONTACT_WHATSAPP: "8801952170524",
  CONTACT_FACEBOOK: "https://www.facebook.com/share/1ZMP5PBU9q/"
};

/* ============================================================
   2) FIREBASE INIT
   ============================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyCTO1DJDd8JFJkJ1PLLRhXgYHfdq3Idaxk",
  authDomain: "our-mugda.firebaseapp.com",
  databaseURL: "https://our-mugda-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "our-mugda",
  storageBucket: "our-mugda.firebasestorage.app",
  messagingSenderId: "470405450367",
  appId: "1:470405450367:web:082a330887b138c511cd4a",
  measurementId: "G-EEPCEG1VRL"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const FieldValue = firebase.firestore.FieldValue;
const Timestamp = firebase.firestore.Timestamp;
const increment = FieldValue.increment;

// Session persistence (WebView-friendly)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
// Firestore offline persistence — reads instant from cache
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("persistence not enabled", err.code);
});
/* ============================================================
   3) GLOBAL STATE
   ============================================================ */
const AppState = {
  user: null,             // Firebase user
  userProfile: null,      // Firestore users/{uid}
  role: "guest",          // guest | user | moderator | admin

  currentCategory: "all",
  currentScreen: "home",

  postsCursor: null,
  postsLoading: false,
  postsEnd: false,

  pendingAction: null,
  pendingCallback: null,

  unreadNotifCount: 0,

  editingPostId: null,
  currentPostId: null,
  currentPostData: null,

  imageQueue: [],         // {file, url, status, id}

  searchCategory: "all",
  searchQuery: "",

  screenHistory: []
};

/* ============================================================
   4) TOAST
   ============================================================ */
function showToast(message, type = "info", duration = 2600) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icons = {
    success: "✅",
    error: "⚠️",
    warn: "🔔",
    info: "ℹ️"
  };

  toast.innerHTML =
    `<span>${icons[type] || ""}</span>` +
    `<span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity .25s, transform .25s";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 260);
  }, duration);
}

/* ============================================================
   5) LOADING OVERLAY
   ============================================================ */
let __loadingCounter = 0;

function showLoading(text = "লোড হচ্ছে...") {
  __loadingCounter++;
  const overlay = document.getElementById("loading-overlay");
  const label = document.getElementById("loading-text");
  if (label) label.textContent = text;
  if (overlay) overlay.classList.add("active");
}

function hideLoading(force = false) {
  if (force) {
    __loadingCounter = 0;
  } else {
    __loadingCounter = Math.max(0, __loadingCounter - 1);
  }
  if (__loadingCounter === 0) {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.classList.remove("active");
  }
}

/* ============================================================
   6) UTILITIES
   ============================================================ */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function toBanglaNumber(n) {
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n).replace(/\d/g, d => bn[+d]);
}

function formatTime(ts) {
  if (!ts) return "";
  let date;
  if (ts.toDate) date = ts.toDate();
  else if (ts.seconds) date = new Date(ts.seconds * 1000);
  else date = new Date(ts);

  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 30) return "এইমাত্র";
  if (diff < 60) return `${toBanglaNumber(diff)} সেকেন্ড আগে`;
  if (diff < 3600) return `${toBanglaNumber(Math.floor(diff / 60))} মিনিট আগে`;
  if (diff < 86400) return `${toBanglaNumber(Math.floor(diff / 3600))} ঘণ্টা আগে`;
  if (diff < 604800) return `${toBanglaNumber(Math.floor(diff / 86400))} দিন আগে`;

  const months = ["জানু", "ফেব", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];
  return `${toBanglaNumber(date.getDate())} ${months[date.getMonth()]} ${toBanglaNumber(date.getFullYear())}`;
}

function formatDate(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(date.getTime())) return "";
  const months = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  return `${toBanglaNumber(date.getDate())} ${months[date.getMonth()]}, ${toBanglaNumber(date.getFullYear())}`;
}

function initialsFromName(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  return parts.slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

function debounce(fn, wait = 300) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function isAdminRole(role) {
  return role === "admin" || role === "moderator";
}

/* ============================================================
   7) AUTH HELPERS
   ============================================================ */
async function registerUser({ name, email, password, area, phone }) {
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  const user = cred.user;

  try {
    await user.updateProfile({ displayName: name });
  } catch (e) { /* ignore */ }

  await db.collection("users").doc(user.uid).set({
    uid: user.uid,
    name: name || "",
    email: email || "",
    area: area || "",
    areaId: APP_CONFIG.AREA_ID,
    phone: phone || "",
    photoURL: "",
    bio: "",
    role: "user",
    status: "active",
    postsCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastSeen: FieldValue.serverTimestamp()
  });

  return user;
}

async function loginUser(email, password) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  try {
    await db.collection("users").doc(cred.user.uid).update({
      lastSeen: FieldValue.serverTimestamp()
    });
  } catch (e) { /* ignore */ }
  return cred.user;
}

async function logoutUser() {
  try {
    await auth.signOut();
    AppState.user = null;
    AppState.userProfile = null;
    AppState.role = "guest";
  } catch (e) {
    showToast("লগআউট করতে সমস্যা হয়েছে", "error");
    throw e;
  }
}

async function sendPasswordReset(email) {
  await auth.sendPasswordResetEmail(email);
}

async function loadUserProfile(uid) {
  const doc = await db.collection("users").doc(uid).get();
  if (doc.exists) return doc.data();

  // ডকুমেন্ট না থাকলে auto-create (Admin case)
  const user = auth.currentUser;
  const newProfile = {
    uid: uid,
    name: (user && user.displayName) || "ব্যবহারকারী",
    email: (user && user.email) || "",
    area: APP_CONFIG.AREA_NAME,
    areaId: APP_CONFIG.AREA_ID,
    phone: "",
    photoURL: "",
    bio: "",
    role: "user",
    status: "active",
    postsCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastSeen: FieldValue.serverTimestamp()
  };

  try {
    await db.collection("users").doc(uid).set(newProfile);
  } catch (e) {
    console.warn("auto-create user doc failed", e);
  }
  return newProfile;
}

async function updateUserProfile(uid, data) {
  await db.collection("users").doc(uid).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp()
  });
}

/* Auth state listener — callback(user | null) */
function initAuthListener(callback) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      AppState.user = user;
      try {
        const profile = await loadUserProfile(user.uid);
        AppState.userProfile = profile;

        if (APP_CONFIG.ADMIN_UIDS.includes(user.uid)) {
          AppState.role = "admin";
        } else if (profile && profile.role) {
          AppState.role = profile.role;
        } else {
          AppState.role = "user";
        }
      } catch (e) {
        console.warn("profile load failed", e);
        AppState.userProfile = null;
        AppState.role = "user";
      }
    } else {
      AppState.user = null;
      AppState.userProfile = null;
      AppState.role = "guest";
    }
    if (typeof callback === "function") callback(user);
  });
}

function getCurrentUser() {
  return AppState.user;
}

function isLoggedIn() {
  return !!AppState.user;
}

/* ============================================================
   8) EXTERNAL IMAGE UPLOAD
   ------------------------------------------------------------
   Firebase Storage ব্যবহার হচ্ছে না।
   Flow: select → validate → compress → host → URL
   Host পরিবর্তন করতে চাইলে APP_CONFIG.IMAGE_HOST বদলান
   ============================================================ */

async function compressImage(file, maxWidth, quality) {
  maxWidth = maxWidth || APP_CONFIG.MAX_IMAGE_WIDTH;
  quality = quality || APP_CONFIG.IMAGE_QUALITY;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("ফাইল পড়তে সমস্যা হয়েছে"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("ছবিটি পড়া যাচ্ছে না"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("ছবি সংকুচিত করা যায়নি"));
            resolve(blob);
          },
          "image/jpeg",
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function validateImageFile(file) {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!file) return "ফাইল পাওয়া যায়নি";
  if (!allowed.includes(file.type)) return "শুধু JPG, PNG বা WebP ছবি গ্রহণ করা হয়";
  if (file.size > APP_CONFIG.MAX_IMAGE_SIZE) return "ছবির আকার ১০ MB এর বেশি হতে পারে না";
  return null;
}

async function uploadImage(file, onProgress) {
  const err = validateImageFile(file);
  if (err) throw new Error(err);

  if (onProgress) onProgress(5);
  const compressed = await compressImage(file);
  if (onProgress) onProgress(45);

  const url = await uploadToProvider(compressed, file.name);
  if (onProgress) onProgress(100);
  return url;
}

async function uploadToProvider(blob, filename) {
  const provider = APP_CONFIG.IMAGE_HOST;
  if (provider === "catbox") return uploadCatbox(blob, filename);
  if (provider === "imgbb") return uploadImgbb(blob, filename);
  throw new Error("ইমেজ হোস্ট কনফিগার করা হয়নি");
}

/* Catbox.moe — free, no key */
async function uploadCatbox(blob, filename) {
  const safeName = (filename || "image").replace(/\.[^.]+$/, "") + ".jpg";
  const fd = new FormData();
  fd.append("reqtype", "fileupload");
  fd.append("fileToUpload", blob, safeName);

  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: fd
  });

  if (!res.ok) throw new Error("ছবি আপলোড ব্যর্থ (নেটওয়ার্ক সমস্যা)");
  const text = (await res.text()).trim();

  if (!text.startsWith("http")) {
    throw new Error("ছবির URL পাওয়া যায়নি — আবার চেষ্টা করুন");
  }
  return text;
}

/* ImgBB — needs API key */
async function uploadImgbb(blob, filename) {
  const key = APP_CONFIG.IMGBB_KEY;
  if (!key) throw new Error("ImgBB API key সেট করা হয়নি");

  const fd = new FormData();
  fd.append("image", blob, filename || "image.jpg");

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
    method: "POST",
    body: fd
  });
  const data = await res.json();
  if (!data.success) throw new Error("আপলোড ব্যর্থ");
  return data.data.url;
}

async function deleteImage(url) {
  // Free tier-এ delete supported নয় — শুধু reference সরবে
  return true;
}

/* ============================================================
   9) FIRESTORE GENERIC HELPERS
   ============================================================ */
async function fsGet(collection, id) {
  const doc = await db.collection(collection).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function fsAdd(collection, data) {
  const ref = await db.collection(collection).add({
    ...data,
    createdAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

async function fsUpdate(collection, id, data) {
  await db.collection(collection).doc(id).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp()
  });
}

async function fsDelete(collection, id) {
  await db.collection(collection).doc(id).delete();
}

/* ============================================================
   10) BANGLA ERROR MESSAGES
   ============================================================ */
function banglaAuthError(err) {
  const code = (err && err.code) || "";
  const map = {
    "auth/email-already-in-use": "এই ইমেইল দিয়ে আগেই একটি অ্যাকাউন্ট খোলা হয়েছে।",
    "auth/invalid-email": "ইমেইলটি সঠিক নয়।",
    "auth/weak-password": "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।",
    "auth/user-not-found": "এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট নেই।",
    "auth/wrong-password": "পাসওয়ার্ড ভুল হয়েছে।",
    "auth/invalid-credential": "ইমেইল বা পাসওয়ার্ড ভুল হয়েছে।",
    "auth/too-many-requests": "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
    "auth/network-request-failed": "ইন্টারনেট সংযোগ পরীক্ষা করুন।",
    "auth/user-disabled": "এই অ্যাকাউন্টটি সাময়িকভাবে বন্ধ আছে।"
  };
  return map[code] || "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।";
}

function banglaFirestoreError(err) {
  const code = (err && err.code) || "";
  if (code.includes("permission-denied")) return "এই কাজটি করার অনুমতি আপনার নেই।";
  if (code.includes("unavailable")) return "ইন্টারনেট সংযোগ পরীক্ষা করুন।";
  return "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।";
}

/* ============================================================
   EXPOSE — সব global window-এ
   ============================================================ */
window.APP_CONFIG = APP_CONFIG;
window.AppState = AppState;
window.auth = auth;
window.db = db;
window.FieldValue = FieldValue;
window.Timestamp = Timestamp;
window.increment = increment;

window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.escapeHtml = escapeHtml;
window.toBanglaNumber = toBanglaNumber;
window.formatTime = formatTime;
window.formatDate = formatDate;
window.initialsFromName = initialsFromName;
window.debounce = debounce;
window.isAdminRole = isAdminRole;

window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.sendPasswordReset = sendPasswordReset;
window.loadUserProfile = loadUserProfile;
window.updateUserProfile = updateUserProfile;
window.initAuthListener = initAuthListener;
window.getCurrentUser = getCurrentUser;
window.isLoggedIn = isLoggedIn;

window.uploadImage = uploadImage;
window.deleteImage = deleteImage;
window.compressImage = compressImage;

window.fsGet = fsGet;
window.fsAdd = fsAdd;
window.fsUpdate = fsUpdate;
window.fsDelete = fsDelete;

window.banglaAuthError = banglaAuthError;
window.banglaFirestoreError = banglaFirestoreError;

console.log("%cআমাদের এলাকা • loading.js loaded", "color:#0d9488;font-weight:700;");