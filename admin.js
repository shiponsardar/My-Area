/* ============================================================
   admin.js — আমাদের এলাকা
   ------------------------------------------------------------
   Admin Panel:
   - Guard check (শুধু admin/moderator)
   - ড্যাশবোর্ড stats
   - ব্যবহারকারী ব্যবস্থাপনা (block/unblock/moderator)
   - পোস্ট মডারেশন (approve/reject/delete/feature/archive)
   - অপেক্ষমাণ পোস্ট queue
   - রিপোর্ট ব্যবস্থাপনা
   - বিজ্ঞপ্তি তৈরি/পরিচালনা
   - অডিট লগ
   ============================================================ */

/* ============================================================
   GUARD — শুধু admin/moderator ঢুকতে পারবে
   ============================================================ */
function openAdminPanel() {
  if (!AppState.user) {
    requireLogin(() => openAdminPanel());
    return;
  }
  if (!isAdminRole(AppState.role)) {
    showToast("এই পেজটি শুধু অ্যাডমিনদের জন্য", "error");
    return;
  }
  navigateTo("admin");
  switchAdminTab("dashboard");
}

/* ============================================================
   TAB SWITCHING
   ============================================================ */
function switchAdminTab(tab) {
  document.querySelectorAll(".admin-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.adminTab === tab);
  });
  document.querySelectorAll(".admin-tab-content").forEach(c => {
    c.classList.toggle("hidden", c.dataset.adminContent !== tab);
  });

  if (tab === "dashboard") loadAdminDashboard();
  else if (tab === "users") loadAdminUsers();
  else if (tab === "posts") loadAdminPosts();
  else if (tab === "pending") loadAdminPending();
  else if (tab === "reports") loadAdminReports();
  else if (tab === "announcements") loadAdminAnnouncements();
  else if (tab === "audit") loadAdminAudit();
}

/* ============================================================
   DASHBOARD
   ============================================================ */
async function loadAdminDashboard() {
  const $users = document.getElementById("admin-stat-users");
  const $active = document.getElementById("admin-stat-active");
  const $posts = document.getElementById("admin-stat-posts");
  const $pending = document.getElementById("admin-stat-pending");
  const $reports = document.getElementById("admin-stat-reports");
  const $comments = document.getElementById("admin-stat-comments");
  const $recent = document.getElementById("admin-recent-activity");

  [$users, $active, $posts, $pending, $reports, $comments].forEach(el => {
    if (el) el.textContent = "...";
  });

  try {
    const [usersSnap, postsSnap, pendingSnap, reportsSnap, commentsSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("posts").where("status", "==", "approved").get(),
      db.collection("posts").where("status", "==", "pending").get(),
      db.collection("reports").where("status", "==", "pending").get(),
      db.collection("comments").get()
    ]);

    const totalUsers = usersSnap.size;
    let activeUsers = 0;
    usersSnap.forEach(d => {
      const u = d.data();
      if (u.status !== "blocked" && u.status !== "suspended") activeUsers++;
    });

    if ($users) $users.textContent = toBanglaNumber(totalUsers);
    if ($active) $active.textContent = toBanglaNumber(activeUsers);
    if ($posts) $posts.textContent = toBanglaNumber(postsSnap.size);
    if ($pending) $pending.textContent = toBanglaNumber(pendingSnap.size);
    if ($reports) $reports.textContent = toBanglaNumber(reportsSnap.size);
    if ($comments) $comments.textContent = toBanglaNumber(commentsSnap.size);

    // Recent activity
    if ($recent) {
      const recentPosts = await db.collection("posts")
        .orderBy("createdAt", "desc").limit(5).get();

      if (recentPosts.empty) {
        $recent.innerHTML = `<div style="padding:20px;text-align:center;color:var(--gray-500);font-size:13px;">কোনো সাম্প্রতিক কার্যক্রম নেই।</div>`;
      } else {
        $recent.innerHTML = recentPosts.docs.map(d => {
          const p = d.data();
          const cat = CATEGORY_MAP[p.categoryId] || { label: "পোস্ট", emoji: "📋" };
          return `
            <div class="admin-list-item">
              <div class="avatar sm">${cat.emoji}</div>
              <div class="info">
                <h4>${escapeHtml(p.title || "(শিরোনাম নেই)")}</h4>
                <p>${escapeHtml(cat.label)} • ${escapeHtml(formatTime(p.createdAt))}</p>
              </div>
              <span class="status-pill ${p.status === "approved" ? "approved" : p.status === "pending" ? "pending" : "rejected"}">
                ${p.status === "approved" ? "অনুমোদিত" : p.status === "pending" ? "অপেক্ষমাণ" : "বাতিল"}
              </span>
            </div>`;
        }).join("");
      }
    }
  } catch (err) {
    console.error("dashboard error", err);
    showToast(banglaFirestoreError(err), "error");
  }
}

/* ============================================================
   USER MANAGEMENT
   ============================================================ */
async function loadAdminUsers(searchQuery = "") {
  const list = document.getElementById("admin-users-list");
  if (!list) return;

  list.innerHTML = `<div class="sk-card"><div class="skeleton sk-line w40" style="margin-bottom:8px;"></div><div class="skeleton sk-line w80"></div></div>`;

  try {
    const snap = await db.collection("users").orderBy("createdAt", "desc").limit(100).get();
    if (snap.empty) {
      list.innerHTML = `<div class="empty-state"><div class="icon">👥</div><h3>কোনো ব্যবহারকারী নেই।</h3></div>`;
      return;
    }

    let users = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      users = users.filter(u =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.area || "").toLowerCase().includes(q)
      );
    }

    if (!users.length) {
      list.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><h3>কোনো ব্যবহারকারী পাওয়া যায়নি।</h3></div>`;
      return;
    }

    list.innerHTML = users.map(u => {
      const status = u.status || "active";
      const role = u.role || "user";
      const isAdmin = APP_CONFIG.ADMIN_UIDS.includes(u.uid);
      const roleLabel = isAdmin ? "অ্যাডমিন" : role === "moderator" ? "মডারেটর" : "সাধারণ";

      return `
        <div class="admin-list-item" data-uid="${escapeHtml(u.uid)}">
          <div class="avatar sm">
            ${u.photoURL
              ? `<img src="${escapeHtml(u.photoURL)}" alt="">`
              : escapeHtml(initialsFromName(u.name))}
          </div>
          <div class="info">
            <h4>${escapeHtml(u.name || "নাম নেই")} <span style="font-size:11px;color:var(--gray-500);font-weight:400;">(${escapeHtml(roleLabel)})</span></h4>
            <p>${escapeHtml(u.email || "")} • ${escapeHtml(u.area || "")}</p>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
            <span class="status-pill ${status === "active" ? "active" : "blocked"}">
              ${status === "active" ? "সক্রিয়" : status === "suspended" ? "স্থগিত" : "ব্লকড"}
            </span>
            <button class="btn btn-sm btn-secondary" data-action="user-menu" data-uid="${escapeHtml(u.uid)}">
              অপশন
            </button>
          </div>
        </div>`;
    }).join("");
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div class="empty-state"><p>${escapeHtml(banglaFirestoreError(err))}</p></div>`;
  }
}

function openUserMenu(uid) {
  const body = document.getElementById("post-menu-body");
  if (!body) return;

  const user = AppState._userCache?.[uid];
  const isSelf = AppState.user?.uid === uid;
  if (isSelf) {
    showToast("নিজের অ্যাকাউন্ট পরিবর্তন করা যাবে না", "warn");
    return;
  }

  body.innerHTML = `
    <button class="profile-menu-item" style="width:100%;" data-action="user-block" data-uid="${escapeHtml(uid)}">
      <div class="mi-icon danger"><span style="font-size:18px;">🚫</span></div>
      <div class="mi-text"><div class="mi-title">সাময়িকভাবে বন্ধ করুন</div><div class="mi-sub">স্থগিত (suspended)</div></div>
    </button>
    <button class="profile-menu-item" style="width:100%;" data-action="user-unblock" data-uid="${escapeHtml(uid)}">
      <div class="mi-icon" style="background:var(--success-50);color:var(--success-600);"><span style="font-size:18px;">✅</span></div>
      <div class="mi-text"><div class="mi-title">আবার সক্রিয় করুন</div><div class="mi-sub">সক্রিয় (active)</div></div>
    </button>
    <button class="profile-menu-item" style="width:100%;" data-action="user-make-mod" data-uid="${escapeHtml(uid)}">
      <div class="mi-icon" style="background:var(--accent-50);color:var(--accent-600);"><span style="font-size:18px;">🛡️</span></div>
      <div class="mi-text"><div class="mi-title">মডারেটর বানান</div><div class="mi-sub">রিপোর্ট ও পোস্ট দেখার অনুমতি</div></div>
    </button>
    <button class="profile-menu-item" style="width:100%;" data-action="user-remove-mod" data-uid="${escapeHtml(uid)}">
      <div class="mi-icon"><span style="font-size:18px;">👤</span></div>
      <div class="mi-text"><div class="mi-title">মডারেটর সরান</div><div class="mi-sub">সাধারণ ব্যবহারকারী</div></div>
    </button>
  `;
  document.getElementById("post-menu-overlay")?.classList.add("active");
}

async function updateUserStatus(uid, status) {
  try {
    await db.collection("users").doc(uid).update({
      status,
      updatedAt: FieldValue.serverTimestamp()
    });
    await logAudit("user_status_" + status, uid);
    showToast(status === "active" ? "ব্যবহারকারী সক্রিয় করা হয়েছে" : "ব্যবহারকারী স্থগিত করা হয়েছে", "success");
    closeAllOverlays();
    loadAdminUsers(document.getElementById("admin-user-search")?.value || "");
  } catch (err) {
    console.error(err);
    showToast(banglaFirestoreError(err), "error");
  }
}

async function updateUserRole(uid, role) {
  try {
    await db.collection("users").doc(uid).update({
      role,
      updatedAt: FieldValue.serverTimestamp()
    });
    await logAudit("user_role_" + role, uid);
    showToast(role === "moderator" ? "মডারেটর বানানো হয়েছে" : "সাধারণ ব্যবহারকারী বানানো হয়েছে", "success");
    closeAllOverlays();
    loadAdminUsers(document.getElementById("admin-user-search")?.value || "");
  } catch (err) {
    console.error(err);
    showToast(banglaFirestoreError(err), "error");
  }
}

/* ============================================================
   POSTS — সব পোস্ট
   ============================================================ */
async function loadAdminPosts() {
  const list = document.getElementById("admin-posts-list");
  if (!list) return;
  list.innerHTML = `<div class="sk-card"><div class="skeleton sk-line w40" style="margin-bottom:8px;"></div><div class="skeleton sk-line w80"></div></div>`;

  try {
    const snap = await db.collection("posts")
      .orderBy("createdAt", "desc").limit(50).get();

    if (snap.empty) {
      list.innerHTML = `<div class="empty-state"><div class="icon">📭</div><h3>কোনো পোস্ট নেই।</h3></div>`;
      return;
    }
    list.innerHTML = snap.docs.map(d => renderAdminPostRow(d.id, d.data())).join("");
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div class="empty-state"><p>${escapeHtml(banglaFirestoreError(err))}</p></div>`;
  }
}

async function loadAdminPending() {
  const list = document.getElementById("admin-pending-list");
  if (!list) return;
  list.innerHTML = `<div class="sk-card"><div class="skeleton sk-line w40" style="margin-bottom:8px;"></div><div class="skeleton sk-line w80"></div></div>`;

  try {
    const snap = await db.collection("posts")
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc").limit(50).get();

    if (snap.empty) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="icon">✅</div>
          <h3>অনুমোদনের অপেক্ষায় কোনো পোস্ট নেই।</h3>
          <p>সব পোস্ট যাচাই করা হয়েছে।</p>
        </div>`;
      return;
    }
    list.innerHTML = snap.docs.map(d => renderAdminPostRow(d.id, d.data(), true)).join("");
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div class="empty-state"><p>${escapeHtml(banglaFirestoreError(err))}</p></div>`;
  }
}

function renderAdminPostRow(id, p, showActions = false) {
  const cat = CATEGORY_MAP[p.categoryId] || { label: "পোস্ট", emoji: "📋" };
  const statusLabel = p.status === "approved" ? "অনুমোদিত"
    : p.status === "pending" ? "অপেক্ষমাণ"
    : p.status === "rejected" ? "বাতিল"
    : p.status === "removed" ? "সরানো"
    : p.status === "archived" ? "আর্কাইভ"
    : "—";
  const statusClass = p.status === "approved" ? "approved"
    : p.status === "pending" ? "pending"
    : "rejected";

  return `
    <div class="admin-list-item" data-post-row="${escapeHtml(id)}" style="flex-direction:column;align-items:stretch;gap:10px;">
      <div style="display:flex;gap:10px;align-items:center;">
        <div class="avatar sm">${cat.emoji}</div>
        <div class="info">
          <h4>${escapeHtml(p.title || "(শিরোনাম নেই)")}</h4>
          <p>${escapeHtml(cat.label)} • ${escapeHtml(formatTime(p.createdAt))}</p>
        </div>
        <span class="status-pill ${statusClass}">${statusLabel}</span>
      </div>
      ${p.description ? `<div style="font-size:12.5px;color:var(--gray-600);line-height:1.5;padding:6px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);">${escapeHtml(p.description.slice(0, 140))}${p.description.length > 140 ? "..." : ""}</div>` : ""}
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-secondary" data-action="admin-view-post" data-post-id="${escapeHtml(id)}">দেখুন</button>
        ${p.status !== "approved" ? `<button class="btn btn-sm btn-primary" data-action="admin-approve" data-post-id="${escapeHtml(id)}">অনুমোদন</button>` : ""}
        ${p.status === "pending" ? `<button class="btn btn-sm btn-danger" data-action="admin-reject" data-post-id="${escapeHtml(id)}">বাতিল</button>` : ""}
        ${!p.featured ? `<button class="btn btn-sm btn-outline" data-action="admin-feature" data-post-id="${escapeHtml(id)}">ফিচার</button>` : `<button class="btn btn-sm btn-outline" data-action="admin-unfeature" data-post-id="${escapeHtml(id)}">আনফিচার</button>`}
        <button class="btn btn-sm btn-ghost" data-action="admin-archive" data-post-id="${escapeHtml(id)}">আর্কাইভ</button>
        <button class="btn btn-sm btn-ghost" style="color:var(--danger-600);" data-action="admin-delete" data-post-id="${escapeHtml(id)}">মুছুন</button>
      </div>
    </div>`;
}

async function adminApprovePost(postId) {
  try {
    await db.collection("posts").doc(postId).update({
      status: "approved",
      approvedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    const post = await db.collection("posts").doc(postId).get();
    const p = post.data();
    if (p?.userId) {
      await db.collection("notifications").add({
        userId: p.userId,
        type: "post_approved",
        text: "আপনার পোস্টটি অনুমোদন করা হয়েছে।",
        postId,
        read: false,
        createdAt: FieldValue.serverTimestamp()
      }).catch(() => {});
    }
    await logAudit("post_approve", postId);
    showToast("পোস্ট অনুমোদন করা হয়েছে", "success");
    refreshCurrentAdminList();
  } catch (err) {
    console.error(err);
    showToast(banglaFirestoreError(err), "error");
  }
}

function adminRejectPost(postId) {
  const body = document.getElementById("post-menu-body");
  if (!body) return;
  body.innerHTML = `
    <div style="padding:6px 16px 4px;">
      <h3 style="font-size:16px;font-weight:700;margin-bottom:4px;">বাতিলের কারণ লিখুন</h3>
      <p style="font-size:13px;color:var(--gray-500);margin-bottom:12px;">ব্যবহারকারী এই বার্তাটি পাবেন।</p>
      <textarea id="reject-reason" class="form-textarea" rows="3" placeholder="যেমন: সম্পূর্ণ তথ্য দেওয়া হয়নি..."></textarea>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn btn-secondary" data-action="close-sheet" style="flex:1;">বাতিল</button>
        <button class="btn btn-danger" style="flex:1;" data-action="admin-reject-confirm" data-post-id="${escapeHtml(postId)}">নিশ্চিত করুন</button>
      </div>
    </div>`;
  document.getElementById("post-menu-overlay")?.classList.add("active");
}

async function adminRejectPostConfirm(postId) {
  const reason = (document.getElementById("reject-reason")?.value || "").trim();
  if (!reason) {
    showToast("বাতিলের কারণ লিখুন", "warn");
    return;
  }
  try {
    await db.collection("posts").doc(postId).update({
      status: "rejected",
      rejectionReason: reason,
      updatedAt: FieldValue.serverTimestamp()
    });
    const post = await db.collection("posts").doc(postId).get();
    const p = post.data();
    if (p?.userId) {
      await db.collection("notifications").add({
        userId: p.userId,
        type: "post_rejected",
        text: `আপনার পোস্টটি অনুমোদন করা হয়নি। কারণ: ${reason}`,
        postId,
        read: false,
        createdAt: FieldValue.serverTimestamp()
      }).catch(() => {});
    }
    await logAudit("post_reject", postId, reason);
    showToast("পোস্ট বাতিল করা হয়েছে", "success");
    closeAllOverlays();
    refreshCurrentAdminList();
  } catch (err) {
    console.error(err);
    showToast(banglaFirestoreError(err), "error");
  }
}

async function adminFeaturePost(postId, featured) {
  try {
    await db.collection("posts").doc(postId).update({
      featured,
      updatedAt: FieldValue.serverTimestamp()
    });
    await logAudit(featured ? "post_feature" : "post_unfeature", postId);
    showToast(featured ? "ফিচার করা হয়েছে" : "ফিচার সরানো হয়েছে", "success");
    refreshCurrentAdminList();
  } catch (err) {
    console.error(err);
    showToast(banglaFirestoreError(err), "error");
  }
}

async function adminArchivePost(postId) {
  try {
    await db.collection("posts").doc(postId).update({
      status: "archived",
      updatedAt: FieldValue.serverTimestamp()
    });
    await logAudit("post_archive", postId);
    showToast("আর্কাইভ করা হয়েছে", "success");
    refreshCurrentAdminList();
  } catch (err) {
    console.error(err);
    showToast(banglaFirestoreError(err), "error");
  }
}

async function adminDeletePost(postId) {
  if (!confirm("পোস্টটি চিরস্থায়ীভাবে মুছে ফেলবেন?")) return;
  try {
    await db.collection("posts").doc(postId).delete();
    await logAudit("post_delete", postId);
    showToast("পোস্ট মুছে ফেলা হয়েছে", "success");
    refreshCurrentAdminList();
  } catch (err) {
    console.error(err);
    showToast(banglaFirestoreError(err), "error");
  }
}

function refreshCurrentAdminList() {
  const active = document.querySelector(".admin-tab.active")?.dataset.adminTab;
  switchAdminTab(active || "dashboard");
}

/* ============================================================
   REPORTS
   ============================================================ */
async function loadAdminReports() {
  const list = document.getElementById("admin-reports-list");
  if (!list) return;
  list.innerHTML = `<div class="sk-card"><div class="skeleton sk-line w40" style="margin-bottom:8px;"></div><div class="skeleton sk-line w80"></div></div>`;

  try {
    const snap = await db.collection("reports")
      .orderBy("createdAt", "desc").limit(50).get();

    if (snap.empty) {
      list.innerHTML = `<div class="empty-state"><div class="icon">✅</div><h3>কোনো রিপোর্ট নেই।</h3></div>`;
      return;
    }

    const reasonLabels = {
      spam: "স্প্যাম", fake: "ভুয়া তথ্য", vulgar: "অশালীন বিষয়",
      harassment: "হয়রানি", fraud: "প্রতারণা",
      privacy: "গোপনীয়তার সমস্যা", other: "অন্যান্য"
    };

    list.innerHTML = snap.docs.map(d => {
      const r = d.data();
      const statusLabel = r.status === "resolved" ? "সমাধান"
        : r.status === "dismissed" ? "খারিজ"
        : "অপেক্ষমাণ";
      const statusClass = r.status === "pending" ? "pending"
        : r.status === "resolved" ? "approved" : "rejected";
      return `
        <div class="admin-list-item" style="flex-direction:column;align-items:stretch;gap:8px;">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
            <div class="info">
              <h4>🚩 ${escapeHtml(reasonLabels[r.reason] || r.reason || "রিপোর্ট")}</h4>
              <p>${escapeHtml(formatTime(r.createdAt))}</p>
            </div>
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </div>
          ${r.description ? `<div style="font-size:12.5px;color:var(--gray-600);line-height:1.5;">${escapeHtml(r.description)}</div>` : ""}
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${r.postId ? `<button class="btn btn-sm btn-secondary" data-action="admin-view-post" data-post-id="${escapeHtml(r.postId)}">পোস্ট দেখুন</button>` : ""}
            ${r.status === "pending" ? `
              <button class="btn btn-sm btn-primary" data-action="report-resolve" data-report-id="${escapeHtml(d.id)}">সমাধান</button>
              <button class="btn btn-sm btn-ghost" data-action="report-dismiss" data-report-id="${escapeHtml(d.id)}">খারিজ</button>
            ` : ""}
            ${r.postId ? `<button class="btn btn-sm btn-danger" data-action="admin-delete" data-post-id="${escapeHtml(r.postId)}">পোস্ট সরান</button>` : ""}
          </div>
        </div>`;
    }).join("");
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div class="empty-state"><p>${escapeHtml(banglaFirestoreError(err))}</p></div>`;
  }
}

async function resolveReport(reportId, status) {
  try {
    await db.collection("reports").doc(reportId).update({
      status,
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: AppState.user.uid
    });
    await logAudit("report_" + status, reportId);
    showToast(status === "resolved" ? "রিপোর্ট সমাধান হয়েছে" : "রিপোর্ট খারিজ হয়েছে", "success");
    loadAdminReports();
  } catch (err) {
    console.error(err);
    showToast(banglaFirestoreError(err), "error");
  }
}

/* ============================================================
   ANNOUNCEMENTS
   ============================================================ */
async function loadAdminAnnouncements() {
  const list = document.getElementById("admin-announcements-list");
  if (!list) return;
  list.innerHTML = `<div class="sk-card"><div class="skeleton sk-line w40" style="margin-bottom:8px;"></div><div class="skeleton sk-line w80"></div></div>`;

  try {
    const snap = await db.collection("announcements")
      .orderBy("createdAt", "desc").limit(50).get();

    if (snap.empty) {
      list.innerHTML = `<div class="empty-state"><div class="icon">📢</div><h3>কোনো বিজ্ঞপ্তি নেই।</h3><p>উপরের বাটনে চাপ দিয়ে তৈরি করুন।</p></div>`;
      return;
    }
    list.innerHTML = snap.docs.map(d => {
      const a = d.data();
      return `
        <div class="admin-list-item" style="flex-direction:column;align-items:stretch;gap:8px;">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
            <div class="info">
              <h4>📢 ${escapeHtml(a.title || "(শিরোনাম নেই)")}</h4>
              <p>${escapeHtml(formatTime(a.createdAt))}</p>
            </div>
            <span class="status-pill ${a.status === "approved" ? "approved" : "pending"}">
              ${a.status === "approved" ? "প্রকাশিত" : "অপেক্ষমাণ"}
            </span>
          </div>
          <div style="font-size:12.5px;color:var(--gray-600);">${escapeHtml((a.description || "").slice(0, 140))}</div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-ghost" style="color:var(--danger-600);" data-action="announcement-delete" data-ann-id="${escapeHtml(d.id)}">মুছুন</button>
          </div>
        </div>`;
    }).join("");
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div class="empty-state"><p>${escapeHtml(banglaFirestoreError(err))}</p></div>`;
  }
}

function openNewAnnouncementForm() {
  const body = document.getElementById("post-menu-body");
  if (!body) return;
  body.innerHTML = `
    <div style="padding:6px 16px 4px;">
      <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">📢 নতুন বিজ্ঞপ্তি</h3>
      <div class="form-group">
        <label class="form-label">শিরোনাম <span class="required">*</span></label>
        <input type="text" id="ann-title" class="form-control" placeholder="বিজ্ঞপ্তির শিরোনাম" />
      </div>
      <div class="form-group">
        <label class="form-label">বিস্তারিত <span class="required">*</span></label>
        <textarea id="ann-desc" class="form-textarea" rows="4" placeholder="বিস্তারিত লিখুন..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">স্থান (ঐচ্ছিক)</label>
        <input type="text" id="ann-location" class="form-control" placeholder="এলাকা" />
      </div>
      <div class="form-group">
        <label class="form-label">তারিখ (ঐচ্ছিক)</label>
        <input type="text" id="ann-date" class="form-control" placeholder="যেমন: ১৫ অক্টোবর" />
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn btn-secondary" data-action="close-sheet" style="flex:1;">বাতিল</button>
        <button class="btn btn-primary" id="save-announcement-btn" style="flex:1;">প্রকাশ করুন</button>
      </div>
    </div>`;
  document.getElementById("post-menu-overlay")?.classList.add("active");

  setTimeout(() => {
    document.getElementById("save-announcement-btn")?.addEventListener("click", saveAnnouncement);
  }, 100);
}

async function saveAnnouncement() {
  const title = (document.getElementById("ann-title")?.value || "").trim();
  const description = (document.getElementById("ann-desc")?.value || "").trim();
  const location = (document.getElementById("ann-location")?.value || "").trim();
  const date = (document.getElementById("ann-date")?.value || "").trim();

  if (!title) { showToast("শিরোনাম লিখুন", "warn"); return; }
  if (!description) { showToast("বিস্তারিত লিখুন", "warn"); return; }

  const btn = document.getElementById("save-announcement-btn");
  if (btn) { btn.disabled = true; btn.textContent = "প্রকাশ হচ্ছে..."; }

  try {
    await db.collection("announcements").add({
      title, description, location, date,
      authorUid: AppState.user.uid,
      authorName: AppState.userProfile?.name || "কর্তৃপক্ষ",
      status: "approved",
      createdAt: FieldValue.serverTimestamp()
    });
    await logAudit("announcement_create", title);
    showToast("বিজ্ঞপ্তি প্রকাশিত হয়েছে", "success");
    closeAllOverlays();
    loadAdminAnnouncements();
  } catch (err) {
    console.error(err);
    showToast(banglaFirestoreError(err), "error");
    if (btn) { btn.disabled = false; btn.textContent = "প্রকাশ করুন"; }
  }
}

async function deleteAnnouncement(id) {
  if (!confirm("বিজ্ঞপ্তিটি মুছে ফেলবেন?")) return;
  try {
    await db.collection("announcements").doc(id).delete();
    await logAudit("announcement_delete", id);
    showToast("মুছে ফেলা হয়েছে", "success");
    loadAdminAnnouncements();
  } catch (err) {
    console.error(err);
    showToast(banglaFirestoreError(err), "error");
  }
}

/* ============================================================
   AUDIT LOG
   ============================================================ */
async function logAudit(action, targetId, note = "") {
  try {
    await db.collection("auditLogs").add({
      action,
      targetId: targetId || "",
      note,
      adminUid: AppState.user?.uid || "",
      adminName: AppState.userProfile?.name || "",
      createdAt: FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.warn("audit log failed", e);
  }
}

async function loadAdminAudit() {
  const list = document.getElementById("admin-audit-list");
  if (!list) return;
  list.innerHTML = `<div class="sk-card"><div class="skeleton sk-line w40" style="margin-bottom:8px;"></div><div class="skeleton sk-line w80"></div></div>`;

  try {
    const snap = await db.collection("auditLogs")
      .orderBy("createdAt", "desc").limit(100).get();

    if (snap.empty) {
      list.innerHTML = `<div class="empty-state"><div class="icon">📜</div><h3>কোনো অডিট লগ নেই।</h3></div>`;
      return;
    }

    const actionLabels = {
      user_status_active: "ব্যবহারকারী সক্রিয়",
      user_status_suspended: "ব্যবহারকারী স্থগিত",
      user_status_blocked: "ব্যবহারকারী ব্লকড",
      user_role_moderator: "মডারেটর বানানো",
      user_role_user: "মডারেটর সরানো",
      post_approve: "পোস্ট অনুমোদন",
      post_reject: "পোস্ট বাতিল",
      post_feature: "পোস্ট ফিচার",
      post_unfeature: "পোস্ট আনফিচার",
      post_archive: "পোস্ট আর্কাইভ",
      post_delete: "পোস্ট মুছে ফেলা",
      report_resolved: "রিপোর্ট সমাধান",
      report_dismissed: "রিপোর্ট খারিজ",
      announcement_create: "বিজ্ঞপ্তি তৈরি",
      announcement_delete: "বিজ্ঞপ্তি মুছে ফেলা"
    };

    list.innerHTML = snap.docs.map(d => {
      const a = d.data();
      return `
        <div class="admin-list-item">
          <div class="info">
            <h4>${escapeHtml(actionLabels[a.action] || a.action || "কার্যক্রম")}</h4>
            <p>${escapeHtml(a.adminName || a.adminUid || "")} • ${escapeHtml(formatTime(a.createdAt))}</p>
            ${a.note ? `<p style="font-size:11px;color:var(--gray-400);margin-top:2px;">${escapeHtml(a.note)}</p>` : ""}
          </div>
        </div>`;
    }).join("");
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div class="empty-state"><p>${escapeHtml(banglaFirestoreError(err))}</p></div>`;
  }
}

/* ============================================================
   EVENT BINDING
   ============================================================ */
function bindAdminEvents() {
  // Tabs
  document.querySelectorAll(".admin-tab").forEach(t => {
    if (t.dataset.bound) return;
    t.dataset.bound = "1";
    t.addEventListener("click", () => switchAdminTab(t.dataset.adminTab));
  });

  // New announcement button
  const newAnnBtn = document.getElementById("new-announcement-btn");
  if (newAnnBtn && !newAnnBtn.dataset.bound) {
    newAnnBtn.dataset.bound = "1";
    newAnnBtn.addEventListener("click", openNewAnnouncementForm);
  }

  // Search users
  const us = document.getElementById("admin-user-search");
  if (us && !us.dataset.bound) {
    us.dataset.bound = "1";
    us.addEventListener("input", debounce((e) => {
      loadAdminUsers(e.target.value.trim());
    }, 350));
  }
}

/* ============================================================
   DELEGATED CLICK HANDLER (admin actions)
   ============================================================ */
document.body.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const postId = el.dataset.postId;
  const uid = el.dataset.uid;
  const reportId = el.dataset.reportId;
  const annId = el.dataset.annId;

  // Admin actions
  if (action === "user-menu") { openUserMenu(uid); return; }
  if (action === "user-block") { await updateUserStatus(uid, "suspended"); return; }
  if (action === "user-unblock") { await updateUserStatus(uid, "active"); return; }
  if (action === "user-make-mod") { await updateUserRole(uid, "moderator"); return; }
  if (action === "user-remove-mod") { await updateUserRole(uid, "user"); return; }

  if (action === "admin-view-post") {
    closeAllOverlays();
    openPostDetail(postId);
    return;
  }
  if (action === "admin-approve") { await adminApprovePost(postId); return; }
  if (action === "admin-reject") { adminRejectPost(postId); return; }
  if (action === "admin-reject-confirm") { await adminRejectPostConfirm(postId); return; }
  if (action === "admin-feature") { await adminFeaturePost(postId, true); return; }
  if (action === "admin-unfeature") { await adminFeaturePost(postId, false); return; }
  if (action === "admin-archive") { await adminArchivePost(postId); return; }
  if (action === "admin-delete") { await adminDeletePost(postId); return; }

  if (action === "report-resolve") { await resolveReport(reportId, "resolved"); return; }
  if (action === "report-dismiss") { await resolveReport(reportId, "dismissed"); return; }

  if (action === "announcement-delete") { await deleteAnnouncement(annId); return; }
});

/* ============================================================
   INIT
   ============================================================ */
function initAdmin() {
  bindAdminEvents();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAdmin);
} else {
  setTimeout(initAdmin, 400);
}

/* ============================================================
   EXPOSE
   ============================================================ */
window.openAdminPanel = openAdminPanel;
window.switchAdminTab = switchAdminTab;
window.loadAdminDashboard = loadAdminDashboard;
window.loadAdminUsers = loadAdminUsers;
window.loadAdminPosts = loadAdminPosts;
window.loadAdminPending = loadAdminPending;
window.loadAdminReports = loadAdminReports;
window.loadAdminAnnouncements = loadAdminAnnouncements;
window.loadAdminAudit = loadAdminAudit;

console.log("%cআমাদের এলাকা • admin.js loaded", "color:#0d9488;font-weight:700;");