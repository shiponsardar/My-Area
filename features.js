/* ============================================================
   features.js — আমাদের এলাকা
   Full clean version — index-free queries
   ============================================================ */

const CATEGORY_LIST = [
  { id: "all",          label: "সব",             emoji: "📋" },
  { id: "general",      label: "সাধারণ",         emoji: "📰" },
  { id: "opinion",      label: "মতামত",          emoji: "🗣️" },
  { id: "problem",      label: "এলাকার সমস্যা",   emoji: "🚨" },
  { id: "tolet",        label: "টু-লেট",         emoji: "🏠" },
  { id: "missing",      label: "নিখোঁজ",         emoji: "🔎" },
  { id: "found",        label: "পাওয়া গেছে",     emoji: "👤" },
  { id: "lostfound",    label: "হারানো/পাওয়া",   emoji: "📦" },
  { id: "announcement", label: "বিজ্ঞপ্তি",      emoji: "📢" },
  { id: "job",          label: "চাকরি",          emoji: "💼" },
  { id: "buysell",      label: "কেনাবেচা",       emoji: "🛍️" },
  { id: "urgent",       label: "জরুরি",          emoji: "🆘" },
  { id: "pet",          label: "পোষা প্রাণী",    emoji: "🐾" },
  { id: "education",    label: "শিক্ষা",         emoji: "🎓" },
  { id: "business",     label: "স্থানীয় ব্যবসা", emoji: "🏪" },
  { id: "event",        label: "অনুষ্ঠান",       emoji: "🎉" },
  { id: "other",        label: "অন্যান্য",       emoji: "📋" }
];

const CATEGORY_MAP = Object.fromEntries(CATEGORY_LIST.map(c => [c.id, c]));

const REACTIONS = {
  like:    { emoji: "❤️", label: "ভালো লেগেছে" },
  helpful: { emoji: "👍", label: "সহায়ক" },
  sad:     { emoji: "😢", label: "দুঃখজনক" },
  angry:   { emoji: "😡", label: "আপত্তিকর" }
};

/* ============================================================
   NAVIGATION
   ============================================================ */
function navigateTo(screen) {
  if (AppState.currentScreen === screen) return;

  if (screen !== "post-detail" && screen !== "post-list") {
    AppState.screenHistory.push(AppState.currentScreen);
    if (AppState.screenHistory.length > 20) AppState.screenHistory.shift();
  }

  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById("screen-" + screen);
  if (target) target.classList.add("active");

  const navMap = {
    "home": "home",
    "announcements": "announcements",
    "notifications": "notifications",
    "profile": "profile"
  };
  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.nav === navMap[screen]);
  });

  const hideNav = ["auth", "post-detail", "admin"].includes(screen);
  const navWrap = document.getElementById("bottom-nav-wrap");
  if (navWrap) navWrap.classList.toggle("hidden", hideNav);

  AppState.currentScreen = screen;
  window.scrollTo({ top: 0, behavior: "instant" });

  if (screen === "home") loadHomeFeed(true);
  else if (screen === "announcements") loadAnnouncements();
  else if (screen === "notifications") loadNotifications();
  else if (screen === "profile") updateProfileUI();
  else if (screen === "search") setTimeout(() => document.getElementById("search-input")?.focus(), 200);
}

function navigateBack() {
  const prev = AppState.screenHistory.pop();
  if (prev) {
    AppState.currentScreen = "";
    navigateTo(prev);
  } else {
    navigateTo("home");
  }
}

/* ============================================================
   HOME FEED — INDEX-FREE VERSION
   ============================================================ */
async function loadHomeFeed(reset = false) {
  if (AppState.postsLoading) return;
  if (!reset && AppState.postsEnd) return;

  AppState.postsLoading = true;

  const feed = document.getElementById("home-feed");
  const skeleton = document.getElementById("home-skeleton");
  const empty = document.getElementById("home-empty");
  const loadMore = document.getElementById("home-load-more");
  const featured = document.getElementById("home-featured-list");
  const featuredSection = document.getElementById("home-featured-section");

  if (reset) {
    AppState.postsCursor = null;
    AppState.postsEnd = false;
    if (feed) feed.innerHTML = "";
    if (empty) empty.classList.add("hidden");
    if (featured) featured.innerHTML = "";
    if (featuredSection) featuredSection.classList.add("hidden");
    if (skeleton) skeleton.classList.remove("hidden");
  } else {
    if (loadMore) loadMore.classList.remove("hidden");
  }

  try {
    let query = db.collection("posts")
      .orderBy("createdAt", "desc")
      .limit(APP_CONFIG.POSTS_PER_PAGE * 2);

    if (!reset && AppState.postsCursor) {
      query = query.startAfter(AppState.postsCursor);
    }

    const snap = await query.get();

    if (skeleton) skeleton.classList.add("hidden");
    if (loadMore) loadMore.classList.add("hidden");

    if (snap.docs.length > 0) {
      AppState.postsCursor = snap.docs[snap.docs.length - 1];
    }
    if (snap.docs.length < APP_CONFIG.POSTS_PER_PAGE) {
      AppState.postsEnd = true;
    }

    let posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    posts = posts.filter(p => p.status === "approved");
    if (AppState.currentCategory !== "all") {
      posts = posts.filter(p => p.categoryId === AppState.currentCategory);
    }

    if (reset && posts.length === 0 && snap.docs.length === 0) {
      if (empty) empty.classList.remove("hidden");
      AppState.postsEnd = true;
      AppState.postsLoading = false;
      return;
    }

    if (reset) {
      const feat = posts.filter(p => p.featured || p.categoryId === "urgent").slice(0, 3);
      if (feat.length > 0 && featuredSection) {
        featuredSection.classList.remove("hidden");
        const fList = document.getElementById("home-featured-list");
        if (fList) fList.innerHTML = feat.map(p => renderPostCard(p, { featured: true })).join("");
      }
    }

    if (feed && posts.length > 0) {
      feed.insertAdjacentHTML("beforeend", posts.map(p => renderPostCard(p)).join(""));
    }

    await hydrateAuthors(posts);
  } catch (err) {
    console.error("feed load error", err);
    if (skeleton) skeleton.classList.add("hidden");
    if (loadMore) loadMore.classList.add("hidden");
    if (reset && empty) empty.classList.remove("hidden");
    showToast(banglaFirestoreError(err), "error");
  }

  AppState.postsLoading = false;
}

/* ============================================================
   AUTHOR HYDRATION
   ============================================================ */
async function hydrateAuthors(posts) {
  const uids = [...new Set(posts.map(p => p.userId).filter(Boolean))];
  if (!uids.length) return;

  AppState._userCache = AppState._userCache || {};
  const missing = uids.filter(uid => !AppState._userCache[uid]);
  if (!missing.length) {
    applyAuthors(posts);
    return;
  }

  try {
    const chunks = [];
    for (let i = 0; i < missing.length; i += 10) {
      chunks.push(missing.slice(i, i + 10));
    }
    for (const chunk of chunks) {
      const snap = await db.collection("users").where("uid", "in", chunk).get();
      snap.forEach(d => {
        const data = d.data();
        AppState._userCache[data.uid] = {
          name: data.name || "ব্যবহারকারী",
          photoURL: data.photoURL || ""
        };
      });
    }
    missing.forEach(uid => {
      if (!AppState._userCache[uid]) {
        AppState._userCache[uid] = { name: "ব্যবহারকারী", photoURL: "" };
      }
    });
    applyAuthors(posts);
  } catch (err) {
    console.warn("author hydration failed", err);
  }
}

function applyAuthors(posts) {
  posts.forEach(p => {
    const cache = AppState._userCache && AppState._userCache[p.userId];
    if (!cache) return;
    const els = document.querySelectorAll('[data-post-id="' + p.id + '"] .js-author-name');
    els.forEach(el => { el.textContent = cache.name; });
    const avatars = document.querySelectorAll('[data-post-id="' + p.id + '"] .js-author-avatar');
    avatars.forEach(el => {
      if (cache.photoURL) {
        el.innerHTML = '<img src="' + escapeHtml(cache.photoURL) + '" alt="" loading="lazy">';
      } else {
        el.textContent = initialsFromName(cache.name);
      }
    });
  });
}

/* ============================================================
   POST CARD RENDERER
   ============================================================ */
function renderPostCard(post, opts) {
  opts = opts || {};
  const cat = CATEGORY_MAP[post.categoryId] || { label: post.categoryId || "পোস্ট", emoji: "📋" };
  const cache = (AppState._userCache && AppState._userCache[post.userId]) || { name: "ব্যবহারকারী", photoURL: "" };
  const time = formatTime(post.createdAt);
  const isUrgent = post.categoryId === "urgent" || post.urgent;
  const isFeatured = opts.featured || post.featured;

  const images = Array.isArray(post.images) ? post.images.filter(Boolean) : [];
  let imgHtml = "";
  if (images.length === 1) {
    imgHtml = '<div class="post-image"><img src="' + escapeHtml(images[0]) + '" alt="" loading="lazy"></div>';
  } else if (images.length > 1) {
    imgHtml = '<div class="post-images-grid">' +
      images.slice(0, 4).map(u => '<img src="' + escapeHtml(u) + '" alt="" loading="lazy">').join("") +
      '</div>';
  }

  const reactions = post.reactionsCount || 0;
  const comments = post.commentsCount || 0;

  return '<article class="post-card ' + (isUrgent ? "urgent" : "") + ' ' + (isFeatured ? "featured" : "") + '" ' +
    'data-post-id="' + escapeHtml(post.id) + '" data-action="open-post">' +
    '<div class="post-head">' +
      '<div class="avatar js-author-avatar">' +
        (cache.photoURL
          ? '<img src="' + escapeHtml(cache.photoURL) + '" alt="">'
          : escapeHtml(initialsFromName(cache.name))) +
      '</div>' +
      '<div class="post-author">' +
        '<div class="name js-author-name">' + escapeHtml(cache.name) + '</div>' +
        '<div class="post-meta">' +
          '<span class="cat-tag ' + (isUrgent ? "urgent" : "") + ' ' + (isFeatured ? "featured" : "") + '">' +
            cat.emoji + ' ' + escapeHtml(cat.label) +
          '</span>' +
          '<span class="dot"></span>' +
          '<span>' + escapeHtml(time) + '</span>' +
        '</div>' +
      '</div>' +
      '<button class="post-menu-btn" data-action="post-menu" data-stop="1" aria-label="মেনু">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/>' +
        '</svg>' +
      '</button>' +
    '</div>' +
    '<div class="post-body">' +
      (post.title ? '<h3 class="post-title">' + escapeHtml(post.title) + '</h3>' : "") +
      (post.description ? '<p class="post-desc">' + escapeHtml(post.description) + '</p>' : "") +
      imgHtml +
      (post.location
        ? '<div class="post-location">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' +
            '</svg>' +
            escapeHtml(post.location) +
          '</div>'
        : "") +
    '</div>' +
    '<div class="post-stats">' +
      (reactions > 0
        ? '<span class="reactions-inline"><span class="reaction-bubble">❤️</span>' +
          toBanglaNumber(reactions) + ' জন প্রতিক্রিয়া জানিয়েছেন</span>'
        : "") +
      '<span style="margin-left:auto;">' + toBanglaNumber(comments) + ' টি মন্তব্য</span>' +
    '</div>' +
    '<div class="post-actions">' +
      '<button class="post-action js-react-btn" data-action="react" data-stop="1">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>' +
        '</svg>' +
        '<span>প্রতিক্রিয়া</span>' +
      '</button>' +
      '<button class="post-action" data-action="open-post" data-stop="1">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
        '</svg>' +
        '<span>মন্তব্য</span>' +
      '</button>' +
      '<button class="post-action js-save-btn" data-action="save" data-stop="1">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' +
        '</svg>' +
        '<span>সংরক্ষণ</span>' +
      '</button>' +
      '<button class="post-action" data-action="share" data-stop="1">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
          '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
          '<line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>' +
        '</svg>' +
        '<span>শেয়ার</span>' +
      '</button>' +
      '<button class="post-action" data-action="report" data-stop="1">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>' +
          '<line x1="4" y1="22" x2="4" y2="15"/>' +
        '</svg>' +
        '<span>রিপোর্ট</span>' +
      '</button>' +
    '</div>' +
  '</article>';
}

/* ============================================================
   POST DETAIL
   ============================================================ */
async function openPostDetail(postId) {
  AppState.currentPostId = postId;
  navigateTo("post-detail");
  const content = document.getElementById("detail-content");
  if (!content) return;

  content.innerHTML =
    '<div class="sk-card">' +
      '<div class="sk-row">' +
        '<div class="skeleton sk-avatar"></div>' +
        '<div style="flex:1;">' +
          '<div class="skeleton sk-line w40" style="margin-bottom:6px;"></div>' +
          '<div class="skeleton sk-line w60" style="height:10px;"></div>' +
        '</div>' +
      '</div>' +
      '<div class="skeleton sk-line title"></div>' +
      '<div class="skeleton sk-line desc"></div>' +
      '<div class="skeleton sk-img"></div>' +
    '</div>';

  try {
    const snap = await db.collection("posts").doc(postId).get();
    if (!snap.exists) {
      content.innerHTML =
        '<div class="empty-state">' +
          '<div class="icon">❓</div>' +
          '<h3>পোস্টটি খুঁজে পাওয়া যায়নি।</h3>' +
          '<p>সম্ভবত এটি মুছে ফেলা হয়েছে।</p>' +
        '</div>';
      return;
    }
    const post = { id: snap.id, ...snap.data() };
    AppState.currentPostData = post;
    await hydrateAuthors([post]);
    renderPostDetail(post);
    loadComments(postId);
  } catch (err) {
    console.error(err);
    content.innerHTML =
      '<div class="empty-state">' +
        '<div class="icon">⚠️</div>' +
        '<h3>লোড করতে সমস্যা হয়েছে।</h3>' +
        '<p>' + escapeHtml(banglaFirestoreError(err)) + '</p>' +
      '</div>';
  }
}

function renderPostDetail(post) {
  const content = document.getElementById("detail-content");
  if (!content) return;

  const cat = CATEGORY_MAP[post.categoryId] || { label: "পোস্ট", emoji: "📋" };
  const cache = (AppState._userCache && AppState._userCache[post.userId]) || { name: "ব্যবহারকারী", photoURL: "" };
  const images = Array.isArray(post.images) ? post.images.filter(Boolean) : [];

  let html = '<div class="detail-card mb-3">';
  html += '<div class="post-head">';
  html += '<div class="avatar">' + (cache.photoURL
    ? '<img src="' + escapeHtml(cache.photoURL) + '" alt="">'
    : escapeHtml(initialsFromName(cache.name))) + '</div>';
  html += '<div class="post-author">';
  html += '<div class="name">' + escapeHtml(cache.name) + '</div>';
  html += '<div class="post-meta"><span class="cat-tag">' + cat.emoji + ' ' + escapeHtml(cat.label) + '</span>';
  html += '<span class="dot"></span><span>' + escapeHtml(formatTime(post.createdAt)) + '</span></div>';
  html += '</div></div>';

  if (post.title) html += '<h2 style="font-size:19px;font-weight:700;margin:8px 0;">' + escapeHtml(post.title) + '</h2>';
  if (post.description) html += '<p style="font-size:15px;line-height:1.7;color:var(--gray-700);white-space:pre-wrap;word-break:break-word;">' + escapeHtml(post.description) + '</p>';

  if (images.length) {
    html += '<div style="display:flex;flex-direction:column;gap:8px;margin:12px 0;">';
    images.forEach(u => {
      html += '<img src="' + escapeHtml(u) + '" alt="" style="width:100%;border-radius:14px;" loading="lazy">';
    });
    html += '</div>';
  }

  if (post.location) {
    html += '<div class="post-location" style="margin-top:8px;">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' +
      '</svg>' + escapeHtml(post.location) + '</div>';
  }

  html += renderCategoryMeta(post);

  if (post.contact) {
    html += '<button class="btn btn-primary btn-block mt-3" data-action="call-contact" data-contact="' + escapeHtml(post.contact) + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>' +
      '</svg>যোগাযোগ করুন</button>';
  }

  html += '<div class="post-actions mt-3" style="border-top:1px solid var(--border);padding-top:8px;">';
  html += '<button class="post-action" data-action="react" data-post-id="' + escapeHtml(post.id) + '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>' +
    '</svg><span>প্রতিক্রিয়া (' + toBanglaNumber(post.reactionsCount || 0) + ')</span></button>';
  html += '<button class="post-action" data-action="save" data-post-id="' + escapeHtml(post.id) + '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' +
    '</svg><span>সংরক্ষণ</span></button>';
  html += '<button class="post-action" data-action="share" data-post-id="' + escapeHtml(post.id) + '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
    '</svg><span>শেয়ার</span></button>';
  html += '<button class="post-action" data-action="report" data-post-id="' + escapeHtml(post.id) + '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>' +
    '</svg><span>রিপোর্ট</span></button>';
  html += '</div></div>';

  html += '<div class="detail-card">';
  html += '<h3 style="font-size:16px;font-weight:700;margin-bottom:8px;">💬 মন্তব্য (<span id="detail-comment-count">০</span>)</h3>';
  html += '<div id="detail-comments">' +
    '<div class="skeleton sk-line w100" style="height:44px;margin-bottom:8px;"></div>' +
    '<div class="skeleton sk-line w100" style="height:44px;"></div>' +
  '</div>';
  html += '</div>';

  content.innerHTML = html;

  const bar = document.getElementById("detail-comment-bar");
  if (bar) bar.classList.remove("hidden");
}

function renderCategoryMeta(post) {
  const meta = post.metadata || {};
  const cat = post.categoryId;
  const rows = [];

  const addRow = (label, value) => {
    if (!value) return;
    rows.push(
      '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">' +
        '<span style="min-width:110px;font-size:13px;color:var(--gray-500);">' + escapeHtml(label) + '</span>' +
        '<span style="font-size:13.5px;color:var(--gray-800);font-weight:500;word-break:break-word;">' + escapeHtml(value) + '</span>' +
      '</div>'
    );
  };

  if (cat === "tolet") {
    addRow("বাসার ধরন", meta.houseType);
    addRow("ভাড়া", meta.rent);
    addRow("বেডরুম", meta.bedrooms);
    addRow("বাথরুম", meta.bathrooms);
    addRow("কবে থেকে", meta.availableFrom);
  } else if (cat === "missing") {
    addRow("ব্যক্তির নাম", meta.personName);
    addRow("বয়স", meta.age);
    addRow("লিঙ্গ", meta.gender);
    addRow("শেষ দেখা", meta.lastSeen);
    addRow("তারিখ", meta.lastSeenDate);
    addRow("পোশাক/চেনার তথ্য", meta.clothing);
  } else if (cat === "found") {
    addRow("কোথায়", meta.foundAt);
    addRow("আনুমানিক বয়স", meta.approxAge);
    addRow("কবে", meta.foundDate);
  } else if (cat === "lostfound") {
    addRow("কী", meta.itemName);
    addRow("ধরন", meta.type);
    addRow("কোথায়", meta.whereFound);
    addRow("কবে", meta.whenFound);
  } else if (cat === "problem") {
    addRow("সমস্যার ধরন", meta.problemType);
    addRow("জরুরি মাত্রা", meta.severity);
  } else if (cat === "job") {
    addRow("চাকরির নাম", meta.jobTitle);
    addRow("প্রতিষ্ঠান", meta.company);
    addRow("কাজের স্থান", meta.workplace);
    addRow("বেতন", meta.salary);
    addRow("যোগ্যতা", meta.qualification);
  } else if (cat === "buysell") {
    addRow("পণ্যের নাম", meta.itemName);
    addRow("দাম", meta.price);
    addRow("অবস্থা", meta.condition);
  } else if (cat === "announcement") {
    addRow("তারিখ", meta.date);
  }

  if (!rows.length) return "";
  return '<div style="margin-top:12px;">' + rows.join("") + '</div>';
}

/* ============================================================
   COMMENTS
   ============================================================ */
async function loadComments(postId) {
  const wrap = document.getElementById("detail-comments");
  if (!wrap) return;

  try {
    const snap = await db.collection("comments")
      .where("postId", "==", postId)
      .get();

    const countEl = document.getElementById("detail-comment-count");
    if (countEl) countEl.textContent = toBanglaNumber(snap.size);

    if (snap.empty) {
      wrap.innerHTML = '<div style="padding:24px;text-align:center;color:var(--gray-500);font-size:13px;">এখনো কোনো মন্তব্য নেই। প্রথম মন্তব্য করুন!</div>';
      return;
    }

    const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    comments.sort((a, b) => {
      const ta = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 0;
      const tb = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 0;
      return tb - ta;
    });

    await hydrateCommentAuthors(comments);
    wrap.innerHTML = comments.map(c => renderComment(c)).join("");
  } catch (err) {
    console.error("comments load error", err);
    wrap.innerHTML = '<div style="padding:16px;color:var(--danger-600);font-size:13px;">মন্তব্য লোড করা যায়নি।</div>';
  }
}

async function hydrateCommentAuthors(comments) {
  const uids = [...new Set(comments.map(c => c.userId).filter(Boolean))];
  AppState._userCache = AppState._userCache || {};
  const missing = uids.filter(uid => !AppState._userCache[uid]);
  if (missing.length) {
    try {
      const chunks = [];
      for (let i = 0; i < missing.length; i += 10) chunks.push(missing.slice(i, i + 10));
      for (const chunk of chunks) {
        const snap = await db.collection("users").where("uid", "in", chunk).get();
        snap.forEach(d => {
          const data = d.data();
          AppState._userCache[data.uid] = {
            name: data.name || "ব্যবহারকারী",
            photoURL: data.photoURL || ""
          };
        });
      }
      missing.forEach(uid => {
        if (!AppState._userCache[uid]) {
          AppState._userCache[uid] = { name: "ব্যবহারকারী", photoURL: "" };
        }
      });
    } catch (e) { /* ignore */ }
  }
}

function renderComment(c) {
  const cache = (AppState._userCache && AppState._userCache[c.userId]) || { name: "ব্যবহারকারী", photoURL: "" };
  const isMine = AppState.user && AppState.user.uid === c.userId;
  return '<div class="comment" data-comment-id="' + escapeHtml(c.id) + '">' +
    '<div class="avatar sm">' +
      (cache.photoURL
        ? '<img src="' + escapeHtml(cache.photoURL) + '" alt="">'
        : escapeHtml(initialsFromName(cache.name))) +
    '</div>' +
    '<div class="comment-body">' +
      '<div class="comment-head">' +
        '<span class="comment-author">' + escapeHtml(cache.name) + '</span>' +
        '<span class="comment-time">' + escapeHtml(formatTime(c.createdAt)) + '</span>' +
      '</div>' +
      '<div class="comment-text">' + escapeHtml(c.text || "") + '</div>' +
      '<div class="comment-actions">' +
        '<button data-action="reply-comment" data-comment-id="' + escapeHtml(c.id) + '">উত্তর দিন</button>' +
        (isMine ? '<button data-action="delete-comment" data-comment-id="' + escapeHtml(c.id) + '" style="color:var(--danger-500);">মুছুন</button>' : "") +
        '<button data-action="report-comment" data-comment-id="' + escapeHtml(c.id) + '">রিপোর্ট</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

async function submitComment(text, parentId) {
  parentId = parentId || null;
  if (!AppState.user) {
    requireLogin(() => submitComment(text, parentId));
    return;
  }
  const postId = AppState.currentPostId;
  if (!postId) return;

  text = (text || "").trim();
  if (!text) return;

  try {
    await db.collection("comments").add({
      postId: postId,
      parentId: parentId,
      userId: AppState.user.uid,
      text: text,
      status: "approved",
      createdAt: FieldValue.serverTimestamp()
    });

    await db.collection("posts").doc(postId).update({
      commentsCount: increment(1)
    }).catch(() => {});

    const post = AppState.currentPostData;
    if (post && post.userId && post.userId !== AppState.user.uid) {
      await db.collection("notifications").add({
        userId: post.userId,
        type: "comment",
        text: "আপনার পোস্টে নতুন মন্তব্য এসেছে।",
        postId: postId,
        fromUid: AppState.user.uid,
        read: false,
        createdAt: FieldValue.serverTimestamp()
      }).catch(() => {});
    }

    showToast("মন্তব্য যোগ হয়েছে", "success");

    const input = document.getElementById("detail-comment-input");
    if (input) input.value = "";
    document.getElementById("detail-comment-send")?.setAttribute("disabled", "true");

    loadComments(postId);
  } catch (err) {
    console.error(err);
    showToast(banglaFirestoreError(err), "error");
  }
}

async function deleteComment(commentId) {
  if (!AppState.user) return;
  try {
    await db.collection("comments").doc(commentId).delete();
    await db.collection("posts").doc(AppState.currentPostId).update({
      commentsCount: increment(-1)
    }).catch(() => {});
    showToast("মন্তব্য মুছে ফেলা হয়েছে", "success");
    loadComments(AppState.currentPostId);
  } catch (err) {
    console.error(err);
    showToast("মুছতে সমস্যা হয়েছে", "error");
  }
}

/* ============================================================
   REACTIONS
   ============================================================ */
function openReactionPicker(postId) {
  if (!AppState.user) {
    requireLogin(() => openReactionPicker(postId));
    return;
  }
  AppState._reactionTarget = postId;
  document.getElementById("reaction-overlay")?.classList.add("active");
}

async function toggleReaction(postId, reactionType) {
  if (!AppState.user) return;
  const rid = postId + "_" + AppState.user.uid;
  const ref = db.collection("reactions").doc(rid);

  try {
    const existing = await ref.get();
    if (existing.exists) {
      const cur = existing.data().type;
      if (cur === reactionType) {
        await ref.delete();
        await db.collection("posts").doc(postId).update({
          reactionsCount: increment(-1)
        }).catch(() => {});
        showToast("প্রতিক্রিয়া সরানো হয়েছে", "info");
      } else {
        await ref.update({ type: reactionType, updatedAt: FieldValue.serverTimestamp() });
        showToast("প্রতিক্রিয়া পরিবর্তন হয়েছে", "success");
      }
    } else {
      await ref.set({
        postId: postId,
        userId: AppState.user.uid,
        type: reactionType,
        createdAt: FieldValue.serverTimestamp()
      });
      await db.collection("posts").doc(postId).update({
        reactionsCount: increment(1)
      }).catch(() => {});
      showToast("প্রতিক্রিয়া যোগ হয়েছে", "success");
    }
  } catch (err) {
    console.error(err);
    showToast("সমস্যা হয়েছে", "error");
  }
}

/* ============================================================
   SAVE
   ============================================================ */
async function toggleSave(postId) {
  if (!AppState.user) {
    requireLogin(() => toggleSave(postId));
    return;
  }
  const sid = AppState.user.uid + "_" + postId;
  const ref = db.collection("savedPosts").doc(sid);

  try {
    const existing = await ref.get();
    if (existing.exists) {
      await ref.delete();
      showToast("সংরক্ষণ থেকে সরানো হয়েছে", "info");
    } else {
      await ref.set({
        userId: AppState.user.uid,
        postId: postId,
        createdAt: FieldValue.serverTimestamp()
      });
      showToast("সংরক্ষিত হয়েছে", "success");
    }
  } catch (err) {
    console.error(err);
    showToast("সমস্যা হয়েছে", "error");
  }
}

/* ============================================================
   SHARE
   ============================================================ */
async function sharePost(postId) {
  const url = window.location.origin + "/?post=" + postId;
  const post = AppState.currentPostData;
  const title = (post && post.title) || "আমাদের এলাকা — পোস্ট";

  if (navigator.share) {
    try {
      await navigator.share({ title: title, text: title, url: url });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
    } else {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    showToast("লিংক কপি হয়েছে", "success");
  } catch (e) {
    showToast("শেয়ার করা যায়নি", "error");
  }
}

/* ============================================================
   REPORT
   ============================================================ */
function openReport(postId) {
  if (!AppState.user) {
    requireLogin(() => openReport(postId));
    return;
  }
  AppState._reportTarget = postId;
  document.querySelectorAll('input[name="report-reason"]').forEach(r => r.checked = false);
  const d = document.getElementById("report-desc");
  if (d) d.value = "";
  document.getElementById("report-overlay")?.classList.add("active");
}

async function submitReport() {
  const postId = AppState._reportTarget;
  const reasonEl = document.querySelector('input[name="report-reason"]:checked');
  const desc = (document.getElementById("report-desc")?.value || "").trim();

  if (!reasonEl) {
    showToast("রিপোর্টের কারণ নির্বাচন করুন", "warn");
    return;
  }

  showLoading("পাঠানো হচ্ছে...");
  try {
    await db.collection("reports").add({
      postId: postId,
      userId: AppState.user.uid,
      reason: reasonEl.value,
      description: desc,
      status: "pending",
      createdAt: FieldValue.serverTimestamp()
    });
    showToast("রিপোর্ট পাঠানো হয়েছে। ধন্যবাদ।", "success");
    closeAllOverlays();
  } catch (err) {
    console.error(err);
    showToast(banglaFirestoreError(err), "error");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   SEARCH
   ============================================================ */
async function performSearch(query) {
  const resultsEl = document.getElementById("search-results");
  const emptyEl = document.getElementById("search-empty");
  const idleEl = document.getElementById("search-idle");
  if (!resultsEl) return;

  query = (query || "").trim();

  if (!query) {
    resultsEl.innerHTML = "";
    emptyEl.classList.add("hidden");
    idleEl.classList.remove("hidden");
    return;
  }
  idleEl.classList.add("hidden");

  resultsEl.innerHTML =
    '<div class="sk-card"><div class="skeleton sk-line w40" style="margin-bottom:8px;"></div><div class="skeleton sk-line w80"></div></div>' +
    '<div class="sk-card"><div class="skeleton sk-line w40" style="margin-bottom:8px;"></div><div class="skeleton sk-line w80"></div></div>';

  try {
    const q = query.toLowerCase();
    const snap = await db.collection("posts")
      .orderBy("createdAt", "desc")
      .limit(80)
      .get();

    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const filtered = all.filter(p => {
      if (p.status !== "approved") return false;
      const hay = ((p.title || "") + " " + (p.description || "") + " " + (p.location || "")).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
      const cat = AppState.searchCategory;
      if (cat === "all" || cat === "posts") return true;
      if (cat === "announcements") return p.categoryId === "announcement";
      return p.categoryId === cat;
    }).slice(0, 30);

    if (!filtered.length) {
      resultsEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");
    await hydrateAuthors(filtered);
    resultsEl.innerHTML = filtered.map(p => renderPostCard(p)).join("");
  } catch (err) {
    console.error(err);
    resultsEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger-600);">' + escapeHtml(banglaFirestoreError(err)) + '</div>';
  }
}

/* ============================================================
   PROFILE
   ============================================================ */
function updateProfileUI() {
  const loggedOut = document.getElementById("profile-logged-out");
  const loggedIn = document.getElementById("profile-logged-in");
  const adminItems = document.querySelectorAll(".admin-only");

  if (!AppState.user) {
    if (loggedOut) loggedOut.classList.remove("hidden");
    if (loggedIn) loggedIn.classList.add("hidden");
    adminItems.forEach(el => el.classList.add("hidden"));
    return;
  }

  if (loggedOut) loggedOut.classList.add("hidden");
  if (loggedIn) loggedIn.classList.remove("hidden");

  const p = AppState.userProfile || {};
  const name = p.name || AppState.user.displayName || "ব্যবহারকারী";
  const photo = p.photoURL || AppState.user.photoURL || "";

  const avatarEl = document.getElementById("profile-avatar");
  if (avatarEl) {
    if (photo) avatarEl.innerHTML = '<img src="' + escapeHtml(photo) + '" alt="">';
    else avatarEl.textContent = initialsFromName(name);
  }

  const nameEl = document.getElementById("profile-name");
  if (nameEl) nameEl.textContent = name;

  const areaEl = document.getElementById("profile-area");
  if (areaEl) areaEl.textContent = p.area || APP_CONFIG.AREA_NAME;

  const joinedEl = document.getElementById("stat-joined");
  if (joinedEl) {
    if (p.createdAt) {
      const d = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
      joinedEl.textContent = toBanglaNumber(d.getFullYear());
    } else {
      joinedEl.textContent = "—";
    }
  }

  loadProfileCounts();

  if (isAdminRole(AppState.role)) {
    adminItems.forEach(el => el.classList.remove("hidden"));
  } else {
    adminItems.forEach(el => el.classList.add("hidden"));
  }
}

async function loadProfileCounts() {
  if (!AppState.user) return;
  const uid = AppState.user.uid;
  try {
    const [postsSnap, savedSnap] = await Promise.all([
      db.collection("posts").where("userId", "==", uid).get(),
      db.collection("savedPosts").where("userId", "==", uid).get()
    ]);
    const statPosts = document.getElementById("stat-posts");
    const statSaved = document.getElementById("stat-saved");
    if (statPosts) statPosts.textContent = toBanglaNumber(postsSnap.size);
    if (statSaved) statSaved.textContent = toBanglaNumber(savedSnap.size);
  } catch (err) {
    console.warn("counts failed", err);
  }
}

function openEditProfile() {
  if (!AppState.user) return;
  const p = AppState.userProfile || {};
  document.getElementById("edit-name").value = p.name || AppState.user.displayName || "";
  document.getElementById("edit-area").value = p.area || "";
  document.getElementById("edit-phone").value = p.phone || "";
  document.getElementById("edit-bio").value = p.bio || "";

  const av = document.getElementById("edit-avatar");
  if (av) {
    if (p.photoURL) av.innerHTML = '<img src="' + escapeHtml(p.photoURL) + '" alt="">';
    else av.textContent = initialsFromName(p.name || AppState.user.displayName || "?");
  }

  // reset avatar input state
  AppState._newAvatarUrl = null;
  const ai = document.getElementById("edit-avatar-input");
  if (ai) ai.value = "";

  document.getElementById("edit-profile-overlay")?.classList.add("active");
}

async function saveProfileChanges() {
  if (!AppState.user) return;
  const name = document.getElementById("edit-name").value.trim();
  const area = document.getElementById("edit-area").value.trim();
  const phone = document.getElementById("edit-phone").value.trim();
  const bio = document.getElementById("edit-bio").value.trim();

  if (!name) {
    showToast("নাম লিখুন", "warn");
    return;
  }

  const btn = document.getElementById("save-profile-btn");
  setButtonLoading(btn, true, "সংরক্ষণ হচ্ছে...");

  try {
    const updateData = { name: name, area: area, phone: phone, bio: bio };
    if (AppState._newAvatarUrl) {
      updateData.photoURL = AppState._newAvatarUrl;
    }

    // auto-create যদি ডকুমেন্ট না থাকে
    const ref = db.collection("users").doc(AppState.user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set(Object.assign({
        uid: AppState.user.uid,
        email: AppState.user.email || "",
        role: "user",
        status: "active",
        postsCount: 0,
        createdAt: FieldValue.serverTimestamp()
      }, updateData, { updatedAt: FieldValue.serverTimestamp() }));
    } else {
      await ref.update(Object.assign({}, updateData, { updatedAt: FieldValue.serverTimestamp() }));
    }

    AppState.userProfile = Object.assign({}, AppState.userProfile || {}, updateData);
    AppState._newAvatarUrl = null;

    showToast("প্রোফাইল আপডেট হয়েছে", "success");
    closeAllOverlays();
    updateProfileUI();
  } catch (err) {
    console.error(err);
    showToast(banglaFirestoreError(err), "error");
  } finally {
    setButtonLoading(btn, false);
  }
}
/* ============================================================
   MY POSTS / SAVED POSTS
   ============================================================ */
async function openMyPosts() {
  if (!AppState.user) return;
  navigateTo("post-list");
  document.getElementById("post-list-title").textContent = "আমার পোস্ট";
  const content = document.getElementById("post-list-content");
  content.innerHTML = '<div class="sk-card"><div class="skeleton sk-line w40" style="margin-bottom:8px;"></div><div class="skeleton sk-line w80"></div></div>';

  try {
    const snap = await db.collection("posts")
      .where("userId", "==", AppState.user.uid)
      .get();

    if (snap.empty) {
      content.innerHTML =
        '<div class="empty-state">' +
          '<div class="icon">📝</div>' +
          '<h3>আপনি এখনো কোনো পোস্ট করেননি।</h3>' +
          '<p>প্রথম পোস্ট তৈরি করে এলাকার মানুষদের সাথে যুক্ত হোন।</p>' +
          '<button class="btn btn-primary" data-action="open-create">পোস্ট তৈরি করুন</button>' +
        '</div>';
      return;
    }

    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    posts.sort((a, b) => {
      const ta = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 0;
      const tb = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 0;
      return tb - ta;
    });

    await hydrateAuthors(posts);
    content.innerHTML = posts.map(p => {
      let statusBadge = "";
      if (p.status === "pending") statusBadge = '<span class="status-pill pending" style="margin-left:6px;">অপেক্ষমাণ</span>';
      else if (p.status === "rejected") statusBadge = '<span class="status-pill rejected" style="margin-left:6px;">বাতিল</span>';
      return renderPostCard(p).replace("</h3>", "</h3>" + statusBadge);
    }).join("");
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="empty-state"><p>' + escapeHtml(banglaFirestoreError(err)) + '</p></div>';
  }
}

async function openSavedPosts() {
  if (!AppState.user) return;
  navigateTo("post-list");
  document.getElementById("post-list-title").textContent = "সংরক্ষিত পোস্ট";
  const content = document.getElementById("post-list-content");
  content.innerHTML = '<div class="sk-card"><div class="skeleton sk-line w40" style="margin-bottom:8px;"></div><div class="skeleton sk-line w80"></div></div>';

  try {
    const savedSnap = await db.collection("savedPosts")
      .where("userId", "==", AppState.user.uid)
      .get();

    if (savedSnap.empty) {
      content.innerHTML =
        '<div class="empty-state">' +
          '<div class="icon">🔖</div>' +
          '<h3>আপনি এখনো কোনো পোস্ট সংরক্ষণ করেননি।</h3>' +
          '<p>পোস্টের 🔖 আইকনে চাপ দিয়ে সংরক্ষণ করুন।</p>' +
        '</div>';
      return;
    }

    const ids = savedSnap.docs.map(d => d.data().postId);
    const posts = [];
    for (const id of ids) {
      try {
        const doc = await db.collection("posts").doc(id).get();
        if (doc.exists) posts.push({ id: doc.id, ...doc.data() });
      } catch (e) { /* skip */ }
    }

    if (!posts.length) {
      content.innerHTML = '<div class="empty-state"><div class="icon">🔖</div><h3>কোনো পোস্ট পাওয়া যায়নি।</h3></div>';
      return;
    }

    await hydrateAuthors(posts);
    content.innerHTML = posts.map(p => renderPostCard(p)).join("");
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="empty-state"><p>' + escapeHtml(banglaFirestoreError(err)) + '</p></div>';
  }
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
async function loadUnreadNotifications() {
  if (!AppState.user) return;
  try {
    const snap = await db.collection("notifications")
      .where("userId", "==", AppState.user.uid)
      .where("read", "==", false)
      .get();
    AppState.unreadNotifCount = snap.size;

    const badges = document.querySelectorAll("#home-notif-badge, #nav-notif-badge");
    badges.forEach(b => {
      if (snap.size > 0) {
        b.textContent = toBanglaNumber(snap.size);
        b.classList.remove("hidden");
      } else {
        b.classList.add("hidden");
      }
    });
  } catch (err) {
    console.warn("unread notif failed", err);
  }
}

async function loadNotifications() {
  const list = document.getElementById("notifications-list");
  const empty = document.getElementById("notifications-empty");
  if (!list) return;

  if (!AppState.user) {
    list.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    return;
  }

  list.innerHTML = '<div class="sk-card"><div class="skeleton sk-line w100" style="height:52px;margin-bottom:8px;"></div><div class="skeleton sk-line w100" style="height:52px;"></div></div>';

  try {
    const snap = await db.collection("notifications")
      .where("userId", "==", AppState.user.uid)
      .get();

    if (snap.empty) {
      list.innerHTML = "";
      if (empty) empty.classList.remove("hidden");
      return;
    }

    if (empty) empty.classList.add("hidden");
    const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    notifs.sort((a, b) => {
      const ta = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 0;
      const tb = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 0;
      return tb - ta;
    });

    list.innerHTML = notifs.map(n =>
      '<div class="notif-item ' + (n.read ? "" : "unread") + '" data-notif-id="' + escapeHtml(n.id) + '"' +
        (n.postId ? ' data-post-id="' + escapeHtml(n.postId) + '"' : "") + '>' +
        '<div class="notif-icon">🔔</div>' +
        '<div class="notif-body">' +
          '<div class="notif-text">' + escapeHtml(n.text || "") + '</div>' +
          '<div class="notif-time">' + escapeHtml(formatTime(n.createdAt)) + '</div>' +
        '</div>' +
      '</div>'
    ).join("");
  } catch (err) {
    console.error(err);
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--danger-600);">' + escapeHtml(banglaFirestoreError(err)) + '</div>';
  }
}

async function markAllNotificationsRead() {
  if (!AppState.user) return;
  try {
    const snap = await db.collection("notifications")
      .where("userId", "==", AppState.user.uid)
      .where("read", "==", false)
      .get();

    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();

    showToast("সব পড়া হয়েছে", "success");
    loadNotifications();
    loadUnreadNotifications();
  } catch (err) {
    console.error(err);
    showToast("সমস্যা হয়েছে", "error");
  }
}

/* ============================================================
   ANNOUNCEMENTS (বিজ্ঞপ্তি)
   ============================================================ */
async function loadAnnouncements() {
  const list = document.getElementById("announcements-list");
  const empty = document.getElementById("announcements-empty");
  if (!list) return;

  list.innerHTML = '<div class="sk-card"><div class="skeleton sk-line w40" style="margin-bottom:8px;"></div><div class="skeleton sk-line w80"></div></div>';

  try {
    const snap = await db.collection("announcements")
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();

    if (snap.empty) {
      list.innerHTML = "";
      if (empty) empty.classList.remove("hidden");
      return;
    }
    if (empty) empty.classList.add("hidden");

    list.innerHTML = snap.docs.map(d => {
      const a = { id: d.id, ...d.data() };
      return '<div class="post-card">' +
        '<div class="post-head">' +
          '<div class="avatar" style="background:linear-gradient(140deg,var(--accent-200),var(--accent-400));">📢</div>' +
          '<div class="post-author">' +
            '<div class="name">' + escapeHtml(a.authorName || "কর্তৃপক্ষ") + '</div>' +
            '<div class="post-meta">' +
              '<span class="cat-tag featured">📢 বিজ্ঞপ্তি</span>' +
              '<span class="dot"></span>' +
              '<span>' + escapeHtml(formatTime(a.createdAt)) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="post-body">' +
          (a.title ? '<h3 class="post-title">' + escapeHtml(a.title) + '</h3>' : "") +
          (a.description ? '<p class="post-desc" style="-webkit-line-clamp:unset;">' + escapeHtml(a.description) + '</p>' : "") +
          (a.date ? '<div class="post-location">📅 ' + escapeHtml(a.date) + '</div>' : "") +
          (a.location ? '<div class="post-location">📍 ' + escapeHtml(a.location) + '</div>' : "") +
        '</div>' +
      '</div>';
    }).join("");
  } catch (err) {
    console.error(err);
    list.innerHTML = '<div class="empty-state"><p>' + escapeHtml(banglaFirestoreError(err)) + '</p></div>';
  }
}

/* ============================================================
   CREATE POST
   ============================================================ */
function openCreateFlow() {
  if (!AppState.user) {
    requireLogin(() => openCreateFlow());
    return;
  }
  document.querySelectorAll(".create-cat-card").forEach(c => c.classList.remove("selected"));
  document.getElementById("create-overlay")?.classList.add("active");
}

function selectCreateCategory(catId) {
  closeAllOverlays();
  setTimeout(() => { openPostForm(catId); }, 220);
}

const POST_FORM_DEFS = {
  general: {
    title: "সাধারণ পোস্ট",
    fields: [
      { id: "title", label: "শিরোনাম", type: "text", placeholder: "পোস্টের শিরোনাম লিখুন", required: true },
      { id: "description", label: "বিস্তারিত লিখুন", type: "textarea", placeholder: "বিস্তারিত লিখুন...", required: true },
      { id: "location", label: "স্থান", type: "text", placeholder: "কোথায় ঘটেছে বা বিষয়টি কোথাকার?" },
      { id: "contact", label: "যোগাযোগ নম্বর", type: "tel", placeholder: "01XXXXXXXXX", optional: true }
    ]
  },
  opinion: {
    title: "মতামত",
    fields: [
      { id: "title", label: "শিরোনাম", type: "text", placeholder: "আপনার মতামতের শিরোনাম", required: true },
      { id: "description", label: "বিস্তারিত", type: "textarea", placeholder: "আপনার মতামত লিখুন...", required: true },
      { id: "location", label: "এলাকা", type: "text", placeholder: "কোন এলাকার কথা?" }
    ]
  },
  problem: {
    title: "এলাকার সমস্যা",
    fields: [
      { id: "title", label: "শিরোনাম", type: "text", placeholder: "সমস্যার শিরোনাম", required: true },
      { id: "problemType", label: "সমস্যার ধরন", type: "select", options: ["রাস্তা", "পানি", "বিদ্যুৎ", "গ্যাস", "ময়লা", "নর্দমা", "আলো", "অন্যান্য"], required: true },
      { id: "description", label: "সমস্যার বিবরণ", type: "textarea", placeholder: "সমস্যাটি বিস্তারিত লিখুন...", required: true },
      { id: "location", label: "স্থান", type: "text", placeholder: "কোথায় সমস্যা?", required: true },
      { id: "severity", label: "জরুরি মাত্রা", type: "select", options: ["স্বাভাবিক", "মাঝারি", "জরুরি", "খুব জরুরি"] },
      { id: "contact", label: "যোগাযোগ নম্বর", type: "tel", placeholder: "01XXXXXXXXX", optional: true }
    ]
  },
  tolet: {
    title: "বাসা / ফ্ল্যাট ভাড়া",
    fields: [
      { id: "title", label: "শিরোনাম", type: "text", placeholder: "যেমন: ২ বেড ফ্ল্যাট ভাড়া", required: true },
      { id: "houseType", label: "বাসার ধরন", type: "select", options: ["ফ্যামিলি ফ্ল্যাট", "সাবলেট", "ব্যাচেলর মেস", "অফিস", "দোকান"], required: true },
      { id: "rent", label: "ভাড়া (টাকা)", type: "number", placeholder: "যেমন: ১৫০০০", required: true },
      { id: "bedrooms", label: "বেডরুম", type: "number", placeholder: "যেমন: ২" },
      { id: "bathrooms", label: "বাথরুম", type: "number", placeholder: "যেমন: ২" },
      { id: "location", label: "ঠিকানা/এলাকা", type: "text", placeholder: "যেমন: মুগদা, ঢাকা", required: true },
      { id: "availableFrom", label: "কবে থেকে পাওয়া যাবে", type: "text", placeholder: "যেমন: ১লা নভেম্বর থেকে" },
      { id: "description", label: "বিস্তারিত", type: "textarea", placeholder: "অন্যান্য সুবিধা লিখুন..." },
      { id: "contact", label: "যোগাযোগ নম্বর", type: "tel", placeholder: "01XXXXXXXXX", required: true }
    ]
  },
  missing: {
    title: "নিখোঁজ ব্যক্তি",
    fields: [
      { id: "personName", label: "নিখোঁজ ব্যক্তির নাম", type: "text", placeholder: "পূর্ণ নাম", required: true },
      { id: "age", label: "বয়স", type: "number", placeholder: "যেমন: ২৫", required: true },
      { id: "gender", label: "লিঙ্গ", type: "select", options: ["পুরুষ", "মহিলা", "অন্যান্য"], required: true },
      { id: "lastSeen", label: "শেষ কোথায় দেখা গেছে", type: "text", placeholder: "এলাকা বা স্থান", required: true },
      { id: "lastSeenDate", label: "শেষ দেখার তারিখ", type: "text", placeholder: "যেমন: ১০ অক্টোবর", required: true },
      { id: "clothing", label: "পরনের পোশাক / চেনার তথ্য", type: "textarea", placeholder: "যেমন: সাদা শার্ট, কালো প্যান্ট...", required: true },
      { id: "description", label: "অতিরিক্ত তথ্য", type: "textarea", placeholder: "অন্যান্য তথ্য..." },
      { id: "contact", label: "যোগাযোগ নম্বর", type: "tel", placeholder: "01XXXXXXXXX", required: true }
    ]
  },
  found: {
    title: "পাওয়া গেছে",
    fields: [
      { id: "foundAt", label: "কোথায় পাওয়া গেছে", type: "text", placeholder: "স্থান / এলাকা", required: true },
      { id: "approxAge", label: "আনুমানিক বয়স", type: "text", placeholder: "যেমন: ৩০-৩৫" },
      { id: "foundDate", label: "কবে পাওয়া গেছে", type: "text", placeholder: "যেমন: আজ সকাল ১০টা", required: true },
      { id: "description", label: "পরিচয় সম্পর্কিত তথ্য", type: "textarea", placeholder: "যা যা মনে আছে লিখুন...", required: true },
      { id: "contact", label: "যোগাযোগের তথ্য", type: "tel", placeholder: "01XXXXXXXXX", required: true }
    ]
  },
  lostfound: {
    title: "হারানো / পাওয়া",
    fields: [
      { id: "itemName", label: "কী হারিয়েছে / পাওয়া গেছে", type: "text", placeholder: "যেমন: কালো মানিব্যাগ", required: true },
      { id: "type", label: "ধরন", type: "select", options: ["হারিয়েছে", "পাওয়া গেছে"], required: true },
      { id: "whereFound", label: "কোথায়", type: "text", placeholder: "স্থান", required: true },
      { id: "whenFound", label: "কবে", type: "text", placeholder: "তারিখ / সময়", required: true },
      { id: "description", label: "বিস্তারিত", type: "textarea", placeholder: "বিস্তারিত লিখুন..." },
      { id: "contact", label: "যোগাযোগ", type: "tel", placeholder: "01XXXXXXXXX", required: true }
    ]
  },
  announcement: {
    title: "বিজ্ঞপ্তি",
    fields: [
      { id: "title", label: "বিজ্ঞপ্তির শিরোনাম", type: "text", placeholder: "শিরোনাম", required: true },
      { id: "description", label: "বিস্তারিত", type: "textarea", placeholder: "বিস্তারিত লিখুন...", required: true },
      { id: "location", label: "স্থান", type: "text", placeholder: "কোথায়?" },
      { id: "date", label: "তারিখ", type: "text", placeholder: "যেমন: ১৫ অক্টোবর" },
      { id: "contact", label: "যোগাযোগ", type: "tel", placeholder: "01XXXXXXXXX", optional: true }
    ]
  },
  job: {
    title: "চাকরি",
    fields: [
      { id: "jobTitle", label: "চাকরির নাম", type: "text", placeholder: "যেমন: সেলস অফিসার", required: true },
      { id: "company", label: "প্রতিষ্ঠানের নাম", type: "text", placeholder: "যেমন: ABC ট্রেডার্স", required: true },
      { id: "workplace", label: "কাজের স্থান", type: "text", placeholder: "যেমন: মুগদা, ঢাকা", required: true },
      { id: "salary", label: "বেতন", type: "text", placeholder: "যেমন: ১৫,০০০ - ২০,০০০" },
      { id: "qualification", label: "যোগ্যতা", type: "text", placeholder: "যেমন: এইচএসসি/স্নাতক" },
      { id: "description", label: "বিস্তারিত", type: "textarea", placeholder: "কাজের সময়, শর্তাবলী..." },
      { id: "contact", label: "যোগাযোগ", type: "tel", placeholder: "01XXXXXXXXX", required: true }
    ]
  },
  buysell: {
    title: "কেনাবেচা",
    fields: [
      { id: "itemName", label: "পণ্যের নাম", type: "text", placeholder: "যেমন: Samsung Galaxy A10", required: true },
      { id: "price", label: "দাম", type: "text", placeholder: "যেমন: ৮,০০০ টাকা", required: true },
      { id: "condition", label: "অবস্থা", type: "select", options: ["নতুন", "ব্যবহৃত (ভালো)", "ব্যবহৃত (মাঝারি)", "মেরামত দরকার"], required: true },
      { id: "location", label: "স্থান", type: "text", placeholder: "এলাকা", required: true },
      { id: "description", label: "বিস্তারিত", type: "textarea", placeholder: "অন্যান্য তথ্য..." },
      { id: "contact", label: "যোগাযোগ", type: "tel", placeholder: "01XXXXXXXXX", required: true }
    ]
  },
  urgent: {
    title: "জরুরি",
    fields: [
      { id: "title", label: "শিরোনাম", type: "text", placeholder: "সংক্ষেপে লিখুন", required: true },
      { id: "description", label: "বিস্তারিত", type: "textarea", placeholder: "কী হয়েছে, কোথায়, কখন...", required: true },
      { id: "location", label: "স্থান", type: "text", placeholder: "কোথায়?" },
      { id: "contact", label: "যোগাযোগ", type: "tel", placeholder: "01XXXXXXXXX" }
    ]
  },
  pet: {
    title: "হারানো পোষা প্রাণী",
    fields: [
      { id: "title", label: "শিরোনাম", type: "text", placeholder: "যেমন: বিড়াল হারিয়ে গেছে", required: true },
      { id: "type", label: "ধরন", type: "select", options: ["হারিয়েছে", "পাওয়া গেছে"], required: true },
      { id: "description", label: "বিস্তারিত", type: "textarea", placeholder: "রঙ, চিহ্ন, কোথায় হারিয়েছে...", required: true },
      { id: "location", label: "স্থান", type: "text", placeholder: "এলাকা" },
      { id: "contact", label: "যোগাযোগ", type: "tel", placeholder: "01XXXXXXXXX", required: true }
    ]
  },
  education: {
    title: "শিক্ষা",
    fields: [
      { id: "title", label: "শিরোনাম", type: "text", placeholder: "যেমন: গণিত টিউশন", required: true },
      { id: "description", label: "বিস্তারিত", type: "textarea", placeholder: "বিস্তারিত লিখুন...", required: true },
      { id: "location", label: "স্থান", type: "text", placeholder: "এলাকা" },
      { id: "contact", label: "যোগাযোগ", type: "tel", placeholder: "01XXXXXXXXX" }
    ]
  },
  business: {
    title: "স্থানীয় ব্যবসা",
    fields: [
      { id: "title", label: "ব্যবসার নাম", type: "text", placeholder: "যেমন: রহিম স্টোর", required: true },
      { id: "description", label: "বিস্তারিত", type: "textarea", placeholder: "কী কী পাওয়া যায়, ছাড় ইত্যাদি...", required: true },
      { id: "location", label: "ঠিকানা", type: "text", placeholder: "এলাকা" },
      { id: "contact", label: "যোগাযোগ", type: "tel", placeholder: "01XXXXXXXXX", required: true }
    ]
  },
  event: {
    title: "অনুষ্ঠান",
    fields: [
      { id: "title", label: "অনুষ্ঠানের নাম", type: "text", placeholder: "যেমন: ঈদ পুনর্মিলনী", required: true },
      { id: "date", label: "তারিখ ও সময়", type: "text", placeholder: "যেমন: ১৫ অক্টোবর, বিকাল ৪টা", required: true },
      { id: "location", label: "স্থান", type: "text", placeholder: "কোথায় হবে?" },
      { id: "description", label: "বিস্তারিত", type: "textarea", placeholder: "অনুষ্ঠান সম্পর্কে লিখুন..." },
      { id: "contact", label: "যোগাযোগ", type: "tel", placeholder: "01XXXXXXXXX" }
    ]
  },
  other: {
    title: "অন্যান্য",
    fields: [
      { id: "title", label: "শিরোনাম", type: "text", placeholder: "শিরোনাম লিখুন", required: true },
      { id: "description", label: "বিস্তারিত", type: "textarea", placeholder: "বিস্তারিত লিখুন...", required: true },
      { id: "location", label: "স্থান", type: "text", placeholder: "এলাকা" },
      { id: "contact", label: "যোগাযোগ", type: "tel", placeholder: "01XXXXXXXXX" }
    ]
  }
};

function openPostForm(catId) {
  const def = POST_FORM_DEFS[catId] || POST_FORM_DEFS.general;
  AppState._createCategory = catId;
  AppState.imageQueue = [];

  const titleEl = document.getElementById("post-form-title");
  if (titleEl) titleEl.textContent = def.title;

  const fieldsWrap = document.getElementById("post-form-fields");
  if (!fieldsWrap) return;

  fieldsWrap.innerHTML = def.fields.map(f => {
    const required = f.required ? '<span class="required">*</span>' : "";
    const optional = f.optional ? ' <span class="optional">(ঐচ্ছিক)</span>' : "";
    if (f.type === "textarea") {
      return '<div class="form-group">' +
        '<label class="form-label">' + escapeHtml(f.label) + ' ' + required + optional + '</label>' +
        '<textarea class="form-control form-textarea" name="' + f.id + '" placeholder="' + escapeHtml(f.placeholder || "") + '"></textarea>' +
      '</div>';
    }
    if (f.type === "select") {
      return '<div class="form-group">' +
        '<label class="form-label">' + escapeHtml(f.label) + ' ' + required + optional + '</label>' +
        '<select class="form-select" name="' + f.id + '">' +
          '<option value="">নির্বাচন করুন</option>' +
          (f.options || []).map(o => '<option value="' + escapeHtml(o) + '">' + escapeHtml(o) + '</option>').join("") +
        '</select>' +
      '</div>';
    }
    return '<div class="form-group">' +
      '<label class="form-label">' + escapeHtml(f.label) + ' ' + required + optional + '</label>' +
      '<input type="' + f.type + '" class="form-control" name="' + f.id + '" placeholder="' + escapeHtml(f.placeholder || "") + '" />' +
    '</div>';
  }).join("");

  const grid = document.getElementById("image-preview-grid");
  if (grid) grid.innerHTML = "";

  document.getElementById("post-form-overlay")?.classList.add("active");
}

function handleImageSelect(files) {
  const fileArr = Array.from(files || []);
  if (!fileArr.length) return;

  const remaining = APP_CONFIG.MAX_IMAGES_PER_POST - AppState.imageQueue.length;
  if (remaining <= 0) {
    showToast("সর্বোচ্চ " + toBanglaNumber(APP_CONFIG.MAX_IMAGES_PER_POST) + " টি ছবি যোগ করা যাবে", "warn");
    return;
  }

  const toAdd = fileArr.slice(0, remaining);
  const grid = document.getElementById("image-preview-grid");
  if (!grid) return;

  toAdd.forEach(file => {
    const itemId = "img_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    const queueItem = { id: itemId, file: file, url: "", status: "uploading", progress: 0 };
    AppState.imageQueue.push(queueItem);

    const previewURL = URL.createObjectURL(file);
    const el = document.createElement("div");
    el.className = "image-preview-item";
    el.dataset.imgId = itemId;
    el.innerHTML =
      '<img src="' + previewURL + '" alt="">' +
      '<div class="upload-overlay">' +
        '<div class="progress-ring"></div>' +
        '<div>আপলোড হচ্ছে...</div>' +
      '</div>' +
      '<button class="remove-btn" data-action="remove-image" data-img-id="' + itemId + '">✕</button>';
    grid.appendChild(el);

    uploadImage(file, (pct) => {
      const overlay = el.querySelector(".upload-overlay div:last-child");
      if (overlay) overlay.textContent = toBanglaNumber(pct) + "%";
    }).then(url => {
      queueItem.url = url;
      queueItem.status = "done";
      const ov = el.querySelector(".upload-overlay");
      if (ov) ov.remove();
      URL.revokeObjectURL(previewURL);
    }).catch(err => {
      console.error(err);
      queueItem.status = "error";
      const overlay = el.querySelector(".upload-overlay");
      if (overlay) overlay.innerHTML = '<div style="font-size:22px;">⚠️</div><div>ব্যর্থ</div>';
      showToast(err.message || "ছবি আপলোড ব্যর্থ", "error");
    });
  });
}

function removeImageFromQueue(itemId) {
  AppState.imageQueue = AppState.imageQueue.filter(x => x.id !== itemId);
  const el = document.querySelector('.image-preview-item[data-img-id="' + itemId + '"]');
  if (el) el.remove();
}

async function submitPost() {
  if (!AppState.user) return;
  const catId = AppState._createCategory || "general";
  const def = POST_FORM_DEFS[catId] || POST_FORM_DEFS.general;
  const fieldsWrap = document.getElementById("post-form-fields");
  if (!fieldsWrap) return;

  const data = {};
  const metadata = {};
  let validationError = "";

  def.fields.forEach(f => {
    const el = fieldsWrap.querySelector('[name="' + f.id + '"]');
    const val = (el && el.value || "").trim();
    if (f.required && !val) {
      if (!validationError) validationError = f.label + " পূরণ করুন";
    }
    if (f.id === "description" || f.id === "title" || f.id === "location" || f.id === "contact") {
      data[f.id] = val;
    } else {
      metadata[f.id] = val;
    }
  });

  if (validationError) {
    showToast(validationError, "warn");
    return;
  }

  const uploading = AppState.imageQueue.some(x => x.status === "uploading");
  if (uploading) {
    showToast("ছবি আপলোড শেষ হওয়া পর্যন্ত অপেক্ষা করুন", "warn");
    return;
  }

  const imageURLs = AppState.imageQueue.filter(x => x.status === "done").map(x => x.url);

  const btn = document.getElementById("post-submit-btn");
  setButtonLoading(btn, true, "পাঠানো হচ্ছে...");

  try {
    const user = AppState.user;
    const profile = AppState.userProfile || {};

    await db.collection("posts").add({
      userId: user.uid,
      userName: profile.name || user.displayName || "",
      userPhoto: profile.photoURL || "",
      areaId: APP_CONFIG.AREA_ID,
      areaName: profile.area || APP_CONFIG.AREA_NAME,
      categoryId: catId,
      title: data.title || "",
      description: data.description || "",
      location: data.location || "",
      contact: data.contact || "",
      images: imageURLs,
      metadata: metadata,
      status: "pending",
      featured: false,
      reactionsCount: 0,
      commentsCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    await db.collection("users").doc(user.uid).update({
      postsCount: increment(1)
    }).catch(() => {});

    showToast("আপনার পোস্ট পাঠানো হয়েছে। অনুমোদনের পর প্রকাশিত হবে।", "success", 3200);

    closeAllOverlays();
    AppState.imageQueue = [];
    AppState._createCategory = null;

    if (AppState.currentScreen === "home") loadHomeFeed(true);
  } catch (err) {
    console.error(err);
    showToast(banglaFirestoreError(err), "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

/* ============================================================
   OVERLAY HELPERS
   ============================================================ */
function closeAllOverlays() {
  document.querySelectorAll(".overlay.active").forEach(o => o.classList.remove("active"));
}

/* ============================================================
   POST MENU
   ============================================================ */
function openPostMenu(postId) {
  const body = document.getElementById("post-menu-body");
  if (!body) return;
  body.innerHTML =
    '<button class="profile-menu-item" style="width:100%;" data-action="save" data-post-id="' + escapeHtml(postId) + '">' +
      '<div class="mi-icon"><span style="font-size:20px;">🔖</span></div>' +
      '<div class="mi-text"><div class="mi-title">সংরক্ষণ করুন</div></div>' +
    '</button>' +
    '<button class="profile-menu-item" style="width:100%;" data-action="share" data-post-id="' + escapeHtml(postId) + '">' +
      '<div class="mi-icon"><span style="font-size:20px;">↗</span></div>' +
      '<div class="mi-text"><div class="mi-title">শেয়ার করুন</div></div>' +
    '</button>' +
    '<button class="profile-menu-item" style="width:100%;" data-action="report" data-post-id="' + escapeHtml(postId) + '">' +
      '<div class="mi-icon danger"><span style="font-size:20px;">🚩</span></div>' +
      '<div class="mi-text"><div class="mi-title" style="color:var(--danger-600);">রিপোর্ট করুন</div></div>' +
    '</button>';
  document.getElementById("post-menu-overlay")?.classList.add("active");
}

/* ============================================================
   GLOBAL EVENT DELEGATION
   ============================================================ */
function bindGlobalEvents() {
  document.body.addEventListener("click", async (e) => {
    const actionEl = e.target.closest("[data-action]");
    const navEl = e.target.closest("[data-nav]");
    const catEl = e.target.closest("[data-cat]");
    const createCat = e.target.closest("[data-create-cat]");
    const searchCat = e.target.closest("[data-search-cat]");
    const reactEl = e.target.closest("[data-reaction]");

    if (catEl && !e.target.closest("#search-filters")) {
      document.querySelectorAll("#home-catbar .cat-chip").forEach(c => c.classList.remove("active"));
      catEl.classList.add("active");
      AppState.currentCategory = catEl.dataset.cat;
      loadHomeFeed(true);
      return;
    }

    if (searchCat) {
      document.querySelectorAll("#search-filters .cat-chip").forEach(c => c.classList.remove("active"));
      searchCat.classList.add("active");
      AppState.searchCategory = searchCat.dataset.searchCat;
      performSearch(document.getElementById("search-input")?.value || "");
      return;
    }

    if (navEl) {
      const target = navEl.dataset.nav;
      if (target === "create") openCreateFlow();
      else if (target === "home") navigateTo("home");
      else if (target === "announcements") navigateTo("announcements");
      else if (target === "notifications") navigateTo("notifications");
      else if (target === "profile") navigateTo("profile");
      return;
    }

    if (createCat) {
      selectCreateCategory(createCat.dataset.createCat);
      return;
    }

    if (reactEl) {
      const type = reactEl.dataset.reaction;
      const postId = AppState._reactionTarget;
      document.getElementById("reaction-overlay")?.classList.remove("active");
      if (postId) await toggleReaction(postId, type);
      return;
    }

    if (actionEl) {
      const action = actionEl.dataset.action;
      const postId = actionEl.dataset.postId || actionEl.closest("[data-post-id]")?.dataset.postId;

      if (action === "close-sheet" || action === "dismiss-login") { closeAllOverlays(); return; }
      if (action === "back") { navigateBack(); return; }
      if (action === "back-to-home") { navigateTo("home"); return; }
      if (action === "back-to-create") { closeAllOverlays(); setTimeout(openCreateFlow, 200); return; }
      if (action === "open-create") { openCreateFlow(); return; }
      if (action === "open-login") { showAuthScreen(); switchAuthTab("login"); return; }
      if (action === "open-register") { showAuthScreen(); switchAuthTab("register"); return; }
      if (action === "go-login") { closeAllOverlays(); showAuthScreen(); switchAuthTab("login"); return; }
      if (action === "edit-profile") { openEditProfile(); return; }
      if (action === "my-posts") { openMyPosts(); return; }
      if (action === "saved-posts") { openSavedPosts(); return; }
      if (action === "logout") { handleLogout(); return; }
      if (action === "admin-panel") {
        if (typeof openAdminPanel === "function") openAdminPanel();
        return;
      }
      if (action === "open-post") { if (postId) openPostDetail(postId); return; }
      if (action === "react") { if (postId) openReactionPicker(postId); return; }
      if (action === "save") { if (postId) toggleSave(postId); return; }
      if (action === "share") { if (postId) sharePost(postId); return; }
      if (action === "report") { if (postId) openReport(postId); return; }
      if (action === "post-menu") { if (postId) openPostMenu(postId); return; }
      if (action === "remove-image") { removeImageFromQueue(actionEl.dataset.imgId); return; }
      if (action === "call-contact") {
        const contact = actionEl.dataset.contact;
        if (contact) window.location.href = "tel:" + contact.replace(/\s+/g, "");
        return;
      }
      if (action === "delete-comment") { deleteComment(actionEl.dataset.commentId); return; }
      if (action === "reply-comment") {
        const input = document.getElementById("detail-comment-input");
        if (input) {
          input.value = "";
          input.placeholder = "উত্তরে লিখুন...";
          input.focus();
          AppState._replyTo = actionEl.dataset.commentId;
        }
        return;
      }
      if (action === "report-comment") { showToast("মন্তব্য রিপোর্ট করা হয়েছে", "success"); return; }
    }

    if (e.target.classList && e.target.classList.contains("overlay")) {
      e.target.classList.remove("active");
    }
  });

  const commentInput = document.getElementById("detail-comment-input");
  const commentSend = document.getElementById("detail-comment-send");
  if (commentInput && commentSend) {
    commentInput.addEventListener("input", () => {
      commentSend.disabled = !commentInput.value.trim();
    });
    commentInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (commentInput.value.trim()) {
          submitComment(commentInput.value.trim(), AppState._replyTo || null);
          AppState._replyTo = null;
          commentInput.placeholder = "মন্তব্য লিখুন...";
        }
      }
    });
    commentSend.addEventListener("click", () => {
      if (commentInput.value.trim()) {
        submitComment(commentInput.value.trim(), AppState._replyTo || null);
        AppState._replyTo = null;
        commentInput.placeholder = "মন্তব্য লিখুন...";
      }
    });
  }

  document.getElementById("post-submit-btn")?.addEventListener("click", submitPost);

  const uploadZone = document.getElementById("image-upload-zone");
  const imageInput = document.getElementById("image-input");
  if (uploadZone && imageInput) {
    uploadZone.addEventListener("click", () => imageInput.click());
    imageInput.addEventListener("change", (e) => {
      handleImageSelect(e.target.files);
      imageInput.value = "";
    });
  }

  document.getElementById("save-profile-btn")?.addEventListener("click", saveProfileChanges);

  document.getElementById("change-avatar-btn")?.addEventListener("click", () => {
    showToast("প্রোফাইল ছবি পরিবর্তন শীঘ্রই যোগ হবে", "info");
  });

  document.getElementById("report-submit-btn")?.addEventListener("click", submitReport);

  document.getElementById("home-search-btn")?.addEventListener("click", () => navigateTo("search"));
  document.getElementById("home-notif-btn")?.addEventListener("click", () => navigateTo("notifications"));

  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", debounce((e) => {
      performSearch(e.target.value);
    }, 400));
  }

  document.getElementById("mark-all-read-btn")?.addEventListener("click", markAllNotificationsRead);
// Profile avatar change handler
const changeAvBtn = document.getElementById("change-avatar-btn");
const avInput = document.getElementById("edit-avatar-input");
if (changeAvBtn && avInput && !changeAvBtn.dataset.bound) {
  changeAvBtn.dataset.bound = "1";
  changeAvBtn.addEventListener("click", () => avInput.click());
  avInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const av = document.getElementById("edit-avatar");
    const oldHtml = av ? av.innerHTML : "";
    if (av) av.innerHTML = '<div class="progress-ring" style="margin:auto;"></div>';
    try {
      const url = await uploadImage(file);
      AppState._newAvatarUrl = url;
      if (av) av.innerHTML = '<img src="' + escapeHtml(url) + '" alt="">';
      showToast("ছবি প্রস্তুত — নিচে সংরক্ষণ করুন", "success");
    } catch (err) {
      console.error(err);
      if (av) av.innerHTML = oldHtml;
      showToast(err.message || "ছবি আপলোড ব্যর্থ", "error");
    }
  });
}
  window.addEventListener("scroll", () => {
    if (AppState.currentScreen !== "home") return;
    if (AppState.postsLoading || AppState.postsEnd) return;
    const scrollY = window.scrollY + window.innerHeight;
    const docH = document.body.scrollHeight;
    if (docH - scrollY < 600) {
      loadHomeFeed(false);
    }
  });

  document.addEventListener("click", async (e) => {
    const item = e.target.closest(".notif-item");
    if (!item) return;
    const id = item.dataset.notifId;
    const postId = item.dataset.postId;

    try {
      if (id) {
        await db.collection("notifications").doc(id).update({ read: true });
        item.classList.remove("unread");
        loadUnreadNotifications();
      }
    } catch (err) { /* ignore */ }

    if (postId) openPostDetail(postId);
  });

  document.getElementById("home-see-all")?.addEventListener("click", () => {
    AppState.currentCategory = "all";
    document.querySelectorAll("#home-catbar .cat-chip").forEach(c => {
      c.classList.toggle("active", c.dataset.cat === "all");
    });
    loadHomeFeed(true);
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get("post")) {
    setTimeout(() => openPostDetail(params.get("post")), 800);
  }

  window.addEventListener("popstate", () => {
    if (document.querySelector(".overlay.active")) {
      closeAllOverlays();
      history.pushState(null, "", window.location.href);
      return;
    }
    navigateBack();
  });
  history.pushState(null, "", window.location.href);
}

/* ============================================================
   INIT
   ============================================================ */
function initFeatures() {
  bindGlobalEvents();

  const areaNameEl = document.getElementById("home-area-name");
  if (areaNameEl) areaNameEl.textContent = APP_CONFIG.AREA_NAME;

  if (AppState.currentScreen === "home") {
    loadHomeFeed(true);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFeatures);
} else {
  setTimeout(initFeatures, 300);
}

/* ============================================================
   EXPOSE
   ============================================================ */
window.navigateTo = navigateTo;
window.navigateBack = navigateBack;
window.loadHomeFeed = loadHomeFeed;
window.renderPostCard = renderPostCard;
window.openPostDetail = openPostDetail;
window.loadComments = loadComments;
window.submitComment = submitComment;
window.toggleReaction = toggleReaction;
window.toggleSave = toggleSave;
window.sharePost = sharePost;
window.openReport = openReport;
window.submitReport = submitReport;
window.performSearch = performSearch;
window.updateProfileUI = updateProfileUI;
window.openMyPosts = openMyPosts;
window.openSavedPosts = openSavedPosts;
window.openEditProfile = openEditProfile;
window.saveProfileChanges = saveProfileChanges;
window.loadNotifications = loadNotifications;
window.loadUnreadNotifications = loadUnreadNotifications;
window.markAllNotificationsRead = markAllNotificationsRead;
window.loadAnnouncements = loadAnnouncements;
window.openCreateFlow = openCreateFlow;
window.openPostForm = openPostForm;
window.submitPost = submitPost;
window.openPostMenu = openPostMenu;
window.closeAllOverlays = closeAllOverlays;
window.CATEGORY_LIST = CATEGORY_LIST;
window.CATEGORY_MAP = CATEGORY_MAP;

console.log("%cআমাদের এলাকা • features.js loaded", "color:#0d9488;font-weight:700;");