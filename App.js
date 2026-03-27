/* ════════════════════════════════════
   SKILL FINDER — app.js
   ════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  onSnapshot, query, where, updateDoc, getDocs, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

/* ── CONFIG ── */
const cfg = {
  apiKey: "AIzaSyBERjheukFQoN3K8Gi3jzv3Tmh9hnYz6mo",
  authDomain: "paulivbook.firebaseapp.com",
  projectId: "paulivbook",
  storageBucket: "paulivbook.firebasestorage.app",
  messagingSenderId: "413150157712",
  appId: "1:413150157712:web:76676d39bc36cde0ea3115"
};
const fbApp = initializeApp(cfg);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);

const SUPA_URL = "https://bfvqfyalncexluhpotcd.supabase.co";
const SUPA_KEY = "sb_publishable_XtW7V_u1sPHkmX4xtkGgbg_JsxQpJj3";
const supabase = window.supabase.createClient(SUPA_URL, SUPA_KEY);

const ADMIN_EMAILS = ["jrpaul245@gmail.com"];

/* ── STATE ── */
let currentUser = null;
let currentUserSettings = {};
let currentFilter = "";
let currentSearch = "";
let ratingTarget = { postId: null, name: null, uid: null, email: null };
let msgTarget = { uid: null, name: null, email: null };
let currentHireTab = "sent";
let pendingRating = 0;
let currentMediaType = "photo";
let modState = "idle";
let allPeopleDocs = [];

/* ════════════════════════════════════
   HELPERS
   ════════════════════════════════════ */

function colorFromName(name) {
  const colors = ["#5cb800","#3b82f6","#e84040","#f59e0b","#8b5cf6","#ec4899","#14b8a6"];
  return colors[(name || "").charCodeAt(0) % colors.length];
}

function getAvatarHtml(p, size = 46) {
  const color = p.avatarColor || colorFromName(p.name);
  if (p.avatarUrl) {
    return `<img src="${p.avatarUrl}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;"
      onerror="this.outerHTML='<div class=\\'av\\' style=\\'width:${size}px;height:${size}px;background:${color};flex-shrink:0;\\'>${p.name.charAt(0).toUpperCase()}</div>'">`;
  }
  return `<div class="av" style="width:${size}px;height:${size}px;background:${color};flex-shrink:0;">${p.name.charAt(0).toUpperCase()}</div>`;
}

/* ════════════════════════════════════
   MODAL OPEN / CLOSE
   ════════════════════════════════════ */

window.openModal = function (type) {
  document.getElementById("overlay-" + type).classList.add("open");
  if (type === "post") resetModeration();
};
window.closeModal = function (type) {
  document.getElementById("overlay-" + type).classList.remove("open");
};

/* ════════════════════════════════════
   LIGHTBOX
   ════════════════════════════════════ */

window.openLightbox = function (src) {
  document.getElementById("lightbox-img").src = src;
  document.getElementById("lightbox").classList.add("open");
  document.body.style.overflow = "hidden";
};
window.closeLightbox = function () {
  document.getElementById("lightbox").classList.remove("open");
  document.body.style.overflow = "";
};
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeLightbox(); closeModal("userprofile"); }
});

/* ════════════════════════════════════
   THEME
   ════════════════════════════════════ */

function applyDark() {
  const r = document.documentElement.style;
  r.setProperty("--bg","#111714"); r.setProperty("--surface","#1c221a");
  r.setProperty("--surface2","#252c22"); r.setProperty("--text","#eaf2e5");
  r.setProperty("--text2","#99a98e"); r.setProperty("--border","#2e362a");
}
function applyLight() {
  const r = document.documentElement.style;
  r.setProperty("--bg","#f4f6f2"); r.setProperty("--surface","#ffffff");
  r.setProperty("--surface2","#f0f2ee"); r.setProperty("--text","#1a1f16");
  r.setProperty("--text2","#5a6354"); r.setProperty("--border","#e0e5da");
}
window.setTheme = function (t) {
  currentUserSettings.theme = t;
  if (t === "dark") applyDark(); else applyLight();
  setDoc(doc(db, "userSettings", currentUser.uid), { ...currentUserSettings, theme: t });
};

/* ════════════════════════════════════
   AUTH & USER SETTINGS
   ════════════════════════════════════ */

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById("sidebarName").textContent = user.displayName || user.email.split("@")[0];
    document.getElementById("settingsEmail").textContent = user.email;
    const uSnap = await getDoc(doc(db, "userSettings", user.uid));
    if (uSnap.exists()) { currentUserSettings = uSnap.data(); applyUserSettings(); }
    if (ADMIN_EMAILS.includes(user.email)) {
      document.getElementById("adminNav").style.display = "flex";
      document.getElementById("sidebarRole").textContent = "Admin";
    }
    listenInbox();
    listenHireRequests();
    listenFeed();
  } else {
    window.location.href = "index.html";
  }
});

function applyUserSettings() {
  const s = currentUserSettings;
  const initials = (s.displayName || currentUser.email || "?").charAt(0).toUpperCase();
  const color = s.avatarColor || "#5cb800";
  const sidebarAv = document.getElementById("sidebarAv");

  if (s.avatarUrl) {
    sidebarAv.innerHTML = `<img src="${s.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    sidebarAv.textContent = initials;
    sidebarAv.style.background = color;
  }

  const prev = document.getElementById("settingsAvPreview");
  if (s.avatarUrl) {
    prev.innerHTML = `<img src="${s.avatarUrl}" style="width:64px;height:64px;object-fit:cover;border-radius:50%;">`;
    prev.style.background = "transparent";
  } else {
    prev.innerHTML = initials;
    prev.style.background = color;
  }

  document.getElementById("settingsName").value = s.displayName || "";
  document.getElementById("settingsBio").value = s.bio || "";
  document.getElementById("settingsPortfolio").value = s.portfolioUrl || "";
  document.querySelectorAll(".swatch").forEach(sw => sw.classList.toggle("selected", sw.dataset.color === color));
  if (s.theme === "dark") applyDark(); else applyLight();
}

window.pickColor = function (el) {
  document.querySelectorAll(".swatch").forEach(s => s.classList.remove("selected"));
  el.classList.add("selected");
  const c = el.dataset.color;
  const prev = document.getElementById("settingsAvPreview");
  prev.innerHTML = (currentUserSettings.displayName || currentUser.email || "?").charAt(0).toUpperCase();
  prev.style.background = c;
  currentUserSettings.avatarUrl = "";
};

window.saveSettings = async function () {
  const color = document.querySelector(".swatch.selected")?.dataset.color || "#5cb800";
  const settings = {
    displayName: document.getElementById("settingsName").value,
    bio: document.getElementById("settingsBio").value,
    portfolioUrl: document.getElementById("settingsPortfolio").value,
    avatarColor: color,
    avatarUrl: currentUserSettings.avatarUrl || "",
    theme: currentUserSettings.theme || "light"
  };
  await setDoc(doc(db, "userSettings", currentUser.uid), settings);
  currentUserSettings = settings;
  applyUserSettings();
  alert("✅ Settings saved!");
};

window.logoutUser = async function () {
  if (confirm("Logout?")) await signOut(auth);
};

/* ════════════════════════════════════
   NAVIGATION
   ════════════════════════════════════ */

window.goTo = function (page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("page-" + page).classList.add("active");
  document.querySelector(`[data-page="${page}"]`).classList.add("active");
  if (page === "hire-requests") renderHireTab(currentHireTab);
  if (page === "admin") loadAdminData();
  if (window.innerWidth <= 768) document.getElementById("sidebar").classList.remove("open");
};

window.toggleSidebar = function () {
  document.getElementById("sidebar").classList.toggle("open");
};

/* ════════════════════════════════════
   FEED
   ════════════════════════════════════ */

function listenFeed() {
  onSnapshot(query(collection(db, "people")), snap => {
    allPeopleDocs = [...snap.docs].sort((a, b) => b.data().createdAt - a.data().createdAt);
    renderFeed();
  });
}

function renderFeed() {
  const feed = document.getElementById("feed");
  feed.innerHTML = "";
  let count = 0;
  const search = currentSearch.toLowerCase().trim();

  allPeopleDocs.forEach(d => {
    const p = d.data(); const id = d.id;
    if (search && !(
      p.name.toLowerCase().includes(search) ||
      p.title.toLowerCase().includes(search) ||
      p.skills.toLowerCase().includes(search)
    )) return;
    if (currentFilter && !(p.tags || []).includes(currentFilter)) return;

    count++;
    const isOwner = currentUser && p.uid === currentUser.uid;
    const avg = p.ratingCount ? (p.ratingSum / p.ratingCount).toFixed(1) : null;
    const tagsHtml = (p.tags || []).map(t => `<span class="tag">${t}</span>`).join("");
    const portfolioHtml = p.portfolioUrl ? `<a class="portfolio-link" href="${p.portfolioUrl}" target="_blank">🔗 Portfolio</a>` : "";
    const starsHtml = avg ? `<div style="display:flex;align-items:center;gap:5px;margin-top:4px;">
      <span style="color:#f59e0b;font-size:13px;">${"★".repeat(Math.round(avg))}</span>
      <span style="font-size:.75rem;color:var(--text3);">${avg} (${p.ratingCount})</span></div>` : "";

    let mediaHtml = "";
    if (p.proofVideoUrl) mediaHtml = `<video class="proof-video" src="${p.proofVideoUrl}" controls preload="metadata" playsinline></video>`;
    else if (p.proofUrl) mediaHtml = `<img src="${p.proofUrl}" class="proof-img" alt="Proof photo" onclick="openLightbox('${p.proofUrl}')" title="Click to view full size">`;

    const card = document.createElement("div");
    card.className = "card profile-card";
    card.innerHTML = `
      <div class="ph clickable-profile" onclick="openUserProfile('${p.uid}','${id}')" title="View full profile">
        ${getAvatarHtml(p, 46)}
        <div style="flex:1;">
          <div class="name">${p.name}</div>
          <div class="title">${p.title}</div>
          ${starsHtml}
        </div>
        <span style="font-size:.7rem;color:var(--text3);align-self:flex-start;margin-top:2px;" title="View profile">👁</span>
      </div>
      <div class="tag-row">${tagsHtml}</div>
      <p class="skills-text">${p.skills}</p>
      ${portfolioHtml}
      ${mediaHtml}
      <div class="btn-row">
        ${isOwner ? `
          <span class="owner-label">Your post</span>
          <button class="btn btn-secondary" onclick="openEditPost('${id}')">✏️ Edit</button>
          <button class="btn btn-danger" onclick="deletePost('${id}')">🗑</button>
        ` : `
          <button class="btn btn-secondary" onclick="openUserProfile('${p.uid}','${id}')">👤 Profile</button>
          <button class="btn btn-primary" onclick="openHire('${id}','${p.name}','${p.email || ""}')">💼 Hire</button>
          <button class="btn btn-info" onclick="openMessage('${p.uid}','${p.name}','${p.email || ""}')">💬 Msg</button>
          <button class="btn btn-secondary" onclick="openRate('${id}','${p.name}','${p.uid}','${p.email || ""}')">⭐</button>
        `}
      </div>`;
    feed.appendChild(card);
  });

  if (count === 0) feed.innerHTML = `<div class="empty-state"><div class="icon">😶</div><p>No profiles found.</p></div>`;
}

window.setFilter = function (f) {
  currentFilter = f;
  document.querySelectorAll("[data-filter]").forEach(el => el.classList.toggle("active-filter", el.dataset.filter === f));
  renderFeed();
};

document.getElementById("searchInput").addEventListener("input", e => {
  currentSearch = e.target.value;
  renderFeed();
});

/* ════════════════════════════════════
   POST CRUD
   ════════════════════════════════════ */

window.openEditPost = async function (id) {
  const snap = await getDoc(doc(db, "people", id));
  const p = snap.data();
  document.getElementById("postModalTitle").textContent = "Edit Profile";
  document.getElementById("editPostId").value = id;
  document.getElementById("fullName").value = p.name;
  document.getElementById("jobTitle").value = p.title;
  document.getElementById("skills").value = p.skills;
  document.getElementById("postPortfolio").value = p.portfolioUrl || "";
  document.querySelectorAll("#tagCheckboxes input[type=checkbox]").forEach(cb => { cb.checked = (p.tags || []).includes(cb.value); });
  openModal("post");
};

document.getElementById("skillForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (modState === "blocked") { alert("Hindi pwede i-post. I-remove ang inappropriate na media."); return; }
  if (modState === "checking") { alert("Sandali lang, nag-che-check pa ang content..."); return; }

  const submitBtn = document.getElementById("postSubmitBtn");
  submitBtn.textContent = "Posting..."; submitBtn.disabled = true;
  const editId = document.getElementById("editPostId").value;
  const tags = [...document.querySelectorAll("#tagCheckboxes input:checked")].map(c => c.value);
  const status = document.getElementById("proofUploadStatus");
  let proofUrl = ""; let proofVideoUrl = "";

  if (currentMediaType === "photo") {
    const proofFile = document.getElementById("proofFileInput").files[0];
    if (proofFile) {
      status.style.display = "block"; status.textContent = "Uploading photo...";
      const ext = proofFile.name.split(".").pop();
      const path = `proofs/${currentUser.uid}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, proofFile, { upsert: true, contentType: proofFile.type });
      if (!upErr) { const { data } = supabase.storage.from("avatars").getPublicUrl(path); proofUrl = data.publicUrl + "?t=" + Date.now(); }
      else { status.textContent = "⚠️ Photo upload failed."; }
    }
  } else {
    const videoFile = document.getElementById("proofVideoInput").files[0];
    if (videoFile) {
      status.style.display = "block"; status.textContent = "Uploading video... (may take a moment)";
      const ext = videoFile.name.split(".").pop() || "mp4";
      const path = `videos/${currentUser.uid}_${Date.now()}.${ext}`;
      const { error: vErr } = await supabase.storage.from("avatars").upload(path, videoFile, { upsert: true, contentType: videoFile.type });
      if (!vErr) { const { data } = supabase.storage.from("avatars").getPublicUrl(path); proofVideoUrl = data.publicUrl + "?t=" + Date.now(); status.textContent = "✅ Video uploaded!"; }
      else { status.textContent = "⚠️ Video upload failed: " + vErr.message; }
    }
  }

  const data = {
    name: document.getElementById("fullName").value,
    title: document.getElementById("jobTitle").value,
    skills: document.getElementById("skills").value,
    tags,
    portfolioUrl: document.getElementById("postPortfolio").value,
    proofUrl, proofVideoUrl,
    uid: currentUser.uid, email: currentUser.email,
    avatarColor: currentUserSettings.avatarColor || "#5cb800",
    avatarUrl: currentUserSettings.avatarUrl || ""
  };

  if (editId) {
    await updateDoc(doc(db, "people", editId), data);
  } else {
    await addDoc(collection(db, "people"), { ...data, createdAt: Date.now(), ratingSum: 0, ratingCount: 0 });
  }

  document.getElementById("editPostId").value = "";
  document.getElementById("postModalTitle").textContent = "Create Profile";
  document.getElementById("skillForm").reset();
  document.getElementById("proofPreview").style.display = "none";
  document.getElementById("videoPreviewWrap").style.display = "none";
  document.getElementById("proofUploadStatus").style.display = "none";
  switchMediaType("photo");
  resetModeration();
  submitBtn.textContent = "Post"; submitBtn.disabled = false;
  closeModal("post");
});

window.deletePost = async function (id) {
  if (confirm("Delete this post?")) await deleteDoc(doc(db, "people", id));
};

/* ════════════════════════════════════
   MEDIA UPLOAD / PREVIEW
   ════════════════════════════════════ */

window.switchMediaType = function (type) {
  currentMediaType = type;
  document.getElementById("togglePhoto").classList.toggle("active", type === "photo");
  document.getElementById("toggleVideo").classList.toggle("active", type === "video");
  document.getElementById("photoUploadSection").style.display = type === "photo" ? "block" : "none";
  document.getElementById("videoUploadSection").style.display = type === "video" ? "block" : "none";
  resetModeration();
};

window.previewProof = async function (input) {
  const file = input.files[0]; if (!file) return;
  const preview = document.getElementById("proofPreview");
  preview.src = URL.createObjectURL(file); preview.style.display = "block";
  await runModeration(file, "photo");
};

window.previewVideo = async function (input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 50 * 1024 * 1024) { alert("Video too large! Max 50MB."); input.value = ""; return; }
  const wrap = document.getElementById("videoPreviewWrap");
  const vid = document.getElementById("videoPreviewEl");
  vid.src = URL.createObjectURL(file); wrap.style.display = "block";
  await runModeration(file, "video");
};

/* ════════════════════════════════════
   AI CONTENT MODERATION
   ════════════════════════════════════ */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

function extractVideoThumbnail(videoFile) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(videoFile);
    const video = document.createElement("video");
    video.src = url; video.muted = true; video.playsInline = true; video.currentTime = 0.5;
    video.addEventListener("seeked", () => {
      const canvas = document.getElementById("videoThumbCanvas");
      canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 360;
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      URL.revokeObjectURL(url); resolve(dataUrl.split(",")[1]);
    }, { once: true });
    video.addEventListener("error", () => { URL.revokeObjectURL(url); resolve(null); }, { once: true });
    video.load();
  });
}

async function moderateImageBase64(base64Data, mediaType = "image/jpeg") {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 200,
        system: `You are a strict content moderation system for a professional skills marketplace. Your ONLY job is to decide if an uploaded image is safe or not. BLOCKED: nudity, sexual content, graphic violence, hate symbols. ALLOWED: professional work samples, headshots, portfolios, diagrams. Respond ONLY with valid JSON: {"safe": true} or {"safe": false, "reason": "short reason"}`,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
          { type: "text", text: "Is this image safe to post on a professional skills marketplace?" }
        ]}]
      })
    });
    const data = await response.json();
    const text = (data.content || []).map(c => c.text || "").join("").trim();
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return { safe: !!parsed.safe, reason: parsed.reason || "" };
  } catch (err) {
    console.warn("Moderation API error:", err);
    return { safe: true, reason: "" };
  }
}

async function runModeration(file, type = "photo") {
  const banner = document.getElementById("modBanner");
  const msgEl = document.getElementById("modMsg");
  const spinner = document.getElementById("modSpinner");
  const submitBtn = document.getElementById("postSubmitBtn");
  modState = "checking";
  banner.className = "mod-banner checking"; spinner.style.display = "inline-block";
  msgEl.textContent = "Checking content..."; submitBtn.disabled = true;

  let base64 = null; let mimeType = "image/jpeg";
  if (type === "photo") { mimeType = file.type || "image/jpeg"; base64 = await fileToBase64(file); }
  else { base64 = await extractVideoThumbnail(file); mimeType = "image/jpeg"; }

  if (!base64) { modState = "ok"; banner.className = "mod-banner ok"; spinner.style.display = "none"; msgEl.textContent = "✅ Content looks good!"; submitBtn.disabled = false; return true; }

  const result = await moderateImageBase64(base64, mimeType);
  if (result.safe) {
    modState = "ok"; banner.className = "mod-banner ok"; spinner.style.display = "none";
    msgEl.textContent = "✅ Content looks good!"; submitBtn.disabled = false; return true;
  } else {
    modState = "blocked"; banner.className = "mod-banner blocked"; spinner.style.display = "none";
    msgEl.textContent = "🚫 Hindi pwede i-upload ang media na ito. " + (result.reason || "Bastos o inappropriate ang content.");
    submitBtn.disabled = true; return false;
  }
}

function resetModeration() {
  modState = "idle";
  const banner = document.getElementById("modBanner");
  banner.className = "mod-banner"; banner.style.display = "none";
  document.getElementById("postSubmitBtn").disabled = false;
}

/* ════════════════════════════════════
   CROP MODAL
   ════════════════════════════════════ */

let cropState = { file:null,scale:1,offsetX:0,offsetY:0,isDragging:false,startX:0,startY:0,lastOffsetX:0,lastOffsetY:0,naturalW:0,naturalH:0,containerW:0,containerH:0 };

window.openCropModal = function (input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 10 * 1024 * 1024) { alert("File too large! Max 10MB."); return; }
  input.value = ""; cropState.file = file; openModal("crop");
  const url = URL.createObjectURL(file);
  const img = document.getElementById("cropImg");
  img.style.cssText = "position:absolute;"; img.src = "";
  img.onload = () => {
    cropState.naturalW = img.naturalWidth; cropState.naturalH = img.naturalHeight;
    const container = document.getElementById("cropContainer");
    const cW = container.offsetWidth || 300; const cH = container.offsetHeight || 300;
    cropState.containerW = cW; cropState.containerH = cH;
    const initScale = Math.max(cW / cropState.naturalW, cH / cropState.naturalH);
    cropState.scale = initScale;
    const zoomEl = document.getElementById("cropZoom");
    zoomEl.min = initScale * 0.8; zoomEl.max = initScale * 4; zoomEl.step = 0.001; zoomEl.value = initScale;
    cropState.offsetX = (cW - cropState.naturalW * initScale) / 2;
    cropState.offsetY = (cH - cropState.naturalH * initScale) / 2;
    updateCropTransform();
  };
  setTimeout(() => { img.src = url; }, 80);
};

function updateCropTransform() {
  const img = document.getElementById("cropImg");
  img.style.width = cropState.naturalW * cropState.scale + "px";
  img.style.height = cropState.naturalH * cropState.scale + "px";
  img.style.left = cropState.offsetX + "px";
  img.style.top = cropState.offsetY + "px";
}

document.getElementById("cropZoom").addEventListener("input", function () {
  const newScale = parseFloat(this.value);
  const cx = cropState.containerW / 2, cy = cropState.containerH / 2;
  const ratio = newScale / cropState.scale;
  cropState.offsetX = cx - (cx - cropState.offsetX) * ratio;
  cropState.offsetY = cy - (cy - cropState.offsetY) * ratio;
  cropState.scale = newScale; updateCropTransform();
});

const cropCont = document.getElementById("cropContainer");
cropCont.addEventListener("mousedown", e => { cropState.isDragging=true;cropState.startX=e.clientX;cropState.startY=e.clientY;cropState.lastOffsetX=cropState.offsetX;cropState.lastOffsetY=cropState.offsetY;e.preventDefault(); });
cropCont.addEventListener("touchstart", e => { const t=e.touches[0];cropState.isDragging=true;cropState.startX=t.clientX;cropState.startY=t.clientY;cropState.lastOffsetX=cropState.offsetX;cropState.lastOffsetY=cropState.offsetY; }, { passive:true });
document.addEventListener("mousemove", e => { if(!cropState.isDragging)return;cropState.offsetX=cropState.lastOffsetX+(e.clientX-cropState.startX);cropState.offsetY=cropState.lastOffsetY+(e.clientY-cropState.startY);updateCropTransform(); });
document.addEventListener("touchmove", e => { if(!cropState.isDragging)return;const t=e.touches[0];cropState.offsetX=cropState.lastOffsetX+(t.clientX-cropState.startX);cropState.offsetY=cropState.lastOffsetY+(t.clientY-cropState.startY);updateCropTransform(); }, { passive:true });
document.addEventListener("mouseup", () => { cropState.isDragging=false; });
document.addEventListener("touchend", () => { cropState.isDragging=false; });

window.applyCrop = async function () {
  const btn = document.getElementById("cropApplyBtn");
  btn.textContent = "Uploading..."; btn.disabled = true;
  const container = document.getElementById("cropContainer");
  const cW = container.clientWidth, cH = container.clientHeight;
  const r = Math.min(cW, cH) * 0.38;
  const cx = cW / 2, cy = cH / 2;
  const OUTPUT = 400;
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT; canvas.height = OUTPUT;
  const ctx = canvas.getContext("2d");
  ctx.beginPath(); ctx.arc(OUTPUT/2, OUTPUT/2, OUTPUT/2, 0, Math.PI * 2); ctx.clip();
  const boxX = cx - r, boxY = cy - r, boxSize = 2 * r;
  const imgX = (boxX - cropState.offsetX) / cropState.scale;
  const imgY = (boxY - cropState.offsetY) / cropState.scale;
  const imgSize = boxSize / cropState.scale;
  const img = document.getElementById("cropImg");
  ctx.drawImage(img, imgX, imgY, imgSize, imgSize, 0, 0, OUTPUT, OUTPUT);

  canvas.toBlob(async blob => {
    if (!blob) { btn.textContent="✅ Use This Photo"; btn.disabled=false; alert("Crop failed."); return; }
    const prog = document.getElementById("uploadProgress");
    prog.style.display = "block"; prog.textContent = "Uploading...";
    const path = `${currentUser.uid}/avatar_${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (error) { prog.textContent="❌ "+error.message; btn.textContent="✅ Use This Photo"; btn.disabled=false; return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = data.publicUrl + "?t=" + Date.now();
    currentUserSettings.avatarUrl = avatarUrl;
    await setDoc(doc(db, "userSettings", currentUser.uid), { ...currentUserSettings, avatarUrl });
    applyUserSettings();
    prog.textContent = "✅ Uploaded!";
    setTimeout(() => { prog.style.display = "none"; }, 2000);
    closeModal("crop"); btn.textContent="✅ Use This Photo"; btn.disabled=false;
  }, "image/jpeg", 0.92);
};

window.cancelCrop = function () {
  closeModal("crop");
  const img = document.getElementById("cropImg");
  if (img.src) URL.revokeObjectURL(img.src);
};

/* ════════════════════════════════════
   HIRE REQUESTS
   ════════════════════════════════════ */

window.openHire = async function (postId, name, recipientEmail) {
  if (!recipientEmail || recipientEmail === "undefined") { alert("No email for this user."); return; }
  if (!confirm(`Send hire request to ${name}?`)) return;
  await addDoc(collection(db, "hireRequests"), {
    fromUid: currentUser.uid, fromEmail: currentUser.email,
    toName: name, toEmail: recipientEmail, postId,
    status: "pending", createdAt: Date.now()
  });
  try { await emailjs.send("service_i9963op", "template_swsoomf", { to_email: recipientEmail, from_email: currentUser.email, message: `${currentUser.email} wants to hire you on Skill Finder!` }); } catch (e) {}
  alert(`✅ Hire request sent to ${name}!`);
};

window.showHireTab = function (tab) {
  currentHireTab = tab;
  document.getElementById("tabSent").className = tab === "sent" ? "btn btn-primary" : "btn btn-secondary";
  document.getElementById("tabReceived").className = tab === "received" ? "btn btn-primary" : "btn btn-secondary";
  renderHireTab(tab);
};

function listenHireRequests() {
  const qR = query(collection(db, "hireRequests"), where("toEmail", "==", currentUser.email));
  onSnapshot(qR, snap => {
    const unread = snap.docs.filter(d => d.data().status === "pending").length;
    const badge = document.getElementById("hireBadge");
    if (unread > 0) { badge.style.display="inline-block"; badge.textContent=unread; } else badge.style.display="none";
  });
}

async function renderHireTab(tab) {
  const cont = document.getElementById("hireContent");
  cont.innerHTML = "<p style='color:var(--text3);font-size:.85rem;padding:20px;'>Loading...</p>";
  const q = tab === "sent"
    ? query(collection(db, "hireRequests"), where("fromUid", "==", currentUser.uid))
    : query(collection(db, "hireRequests"), where("toEmail", "==", currentUser.email));
  const snap = await getDocs(q);
  if (snap.empty) { cont.innerHTML=`<div class="empty-state"><div class="icon">📋</div><p>No requests here.</p></div>`; return; }
  const sorted = [...snap.docs].sort((a, b) => b.data().createdAt - a.data().createdAt);
  let rows = "";
  sorted.forEach(d => {
    const r = d.data(); const id = d.id;
    const dateStr = new Date(r.createdAt).toLocaleDateString();
    const statusClass = `status-${r.status}`;
    const actions = tab === "received" && r.status === "pending"
      ? `<button class="btn btn-primary" style="font-size:.75rem;padding:5px 10px;" onclick="respondHire('${id}','accepted')">Accept</button>
         <button class="btn btn-danger" style="font-size:.75rem;padding:5px 10px;" onclick="respondHire('${id}','declined')">Decline</button>`
      : "—";
    rows += `<tr><td>${tab==="sent"?r.toName:r.fromEmail}</td><td><span class="status-badge ${statusClass}">${r.status}</span></td><td>${dateStr}</td><td>${actions}</td></tr>`;
  });
  cont.innerHTML = `<div style="overflow-x:auto;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border);">
    <table class="req-table"><thead><tr><th>${tab==="sent"?"To":"From"}</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

window.respondHire = async function (id, status) {
  await updateDoc(doc(db, "hireRequests", id), { status });
  renderHireTab("received");
};

/* ════════════════════════════════════
   INBOX / MESSAGES
   ════════════════════════════════════ */

function listenInbox() {
  const q = query(collection(db, "messages"), where("toUid", "==", currentUser.uid));
  onSnapshot(q, snap => {
    const unread = snap.docs.filter(d => !d.data().read).length;
    const badge = document.getElementById("inboxBadge");
    if (unread > 0) { badge.style.display="inline-block"; badge.textContent=unread; } else badge.style.display="none";

    const list = document.getElementById("msgList"); list.innerHTML = "";
    if (snap.empty) { list.innerHTML=`<div class="empty-state"><div class="icon">📭</div><p>No messages yet.</p></div>`; return; }
    const sorted = [...snap.docs].sort((a, b) => b.data().createdAt - a.data().createdAt);
    sorted.forEach(d => {
      const m = d.data(); const id = d.id;
      const time = new Date(m.createdAt).toLocaleString();
      const div = document.createElement("div");
      div.className = "msg-card" + (m.read ? "" : " unread");
      div.onclick = () => markRead(id);
      div.innerHTML = `${!m.read?'<div class="unread-dot"></div>':'<div style="width:8px;"></div>'}
        <div class="msg-body">
          <div class="from">${m.fromEmail}</div>
          <div class="msg-text">${m.message}</div>
          <div class="msg-time">${time}</div>
        </div>`;
      list.appendChild(div);
    });
  });
}

async function markRead(id) {
  await updateDoc(doc(db, "messages", id), { read: true });
}

window.openMessage = function (uid, name, email) {
  msgTarget = { uid, name, email };
  document.getElementById("messageModalTitle").textContent = `Message ${name}`;
  document.getElementById("messageText").value = "";
  openModal("message");
};

window.sendMessage = async function () {
  const msg = document.getElementById("messageText").value.trim(); if (!msg) return;
  await addDoc(collection(db, "messages"), {
    fromUid: currentUser.uid, fromEmail: currentUser.email,
    toUid: msgTarget.uid, toName: msgTarget.name,
    message: msg, read: false, createdAt: Date.now()
  });
  try { await emailjs.send("service_i9963op","template_swsoomf",{to_email:msgTarget.email,from_email:currentUser.email,message:`${currentUser.email} sent you a message: "${msg}"`}); } catch(e) {}
  closeModal("message");
  alert(`✅ Message sent to ${msgTarget.name}!`);
};

/* ════════════════════════════════════
   RATINGS
   ════════════════════════════════════ */

window.openRate = function (postId, name, uid, email) {
  ratingTarget = { postId, name, uid, email };
  pendingRating = 0;
  document.getElementById("rateTarget").textContent = `Rating for: ${name}`;
  document.getElementById("reviewText").value = "";
  document.querySelectorAll("#ratingStars .star").forEach(s => s.classList.remove("lit"));
  openModal("rate");
};

window.setRating = function (v) {
  pendingRating = v;
  document.querySelectorAll("#ratingStars .star").forEach(s => s.classList.toggle("lit", parseInt(s.dataset.v) <= v));
};

window.submitRating = async function () {
  if (!pendingRating) { alert("Please select a star rating."); return; }
  const ref = doc(db, "people", ratingTarget.postId);
  const snap = await getDoc(ref); if (!snap.exists()) return;
  const d = snap.data();
  await updateDoc(ref, { ratingSum: (d.ratingSum || 0) + pendingRating, ratingCount: (d.ratingCount || 0) + 1 });
  await addDoc(collection(db, "reviews"), {
    postId: ratingTarget.postId, toUid: ratingTarget.uid,
    fromUid: currentUser.uid, fromEmail: currentUser.email,
    rating: pendingRating, review: document.getElementById("reviewText").value.trim(),
    createdAt: Date.now()
  });
  closeModal("rate");
  alert("✅ Rating submitted!");
};

/* ════════════════════════════════════
   USER PROFILE / STALK MODAL
   ════════════════════════════════════ */

window.openUserProfile = async function (uid, firstPostId) {
  document.getElementById("upPostsList").innerHTML = `<div class="empty-state" style="padding:20px;"><div class="icon" style="font-size:1.5rem;">⏳</div><p>Loading...</p></div>`;
  document.getElementById("upReviewsSection").style.display = "none";
  document.getElementById("upActionBtns").innerHTML = "";
  openModal("userprofile");

  let userSettings = {};
  try {
    const uSnap = await getDoc(doc(db, "userSettings", uid));
    if (uSnap.exists()) userSettings = uSnap.data();
  } catch (e) {}

  const postsQ = query(collection(db, "people"), where("uid", "==", uid));
  const postsSnap = await getDocs(postsQ);
  const userPosts = [...postsSnap.docs].sort((a, b) => b.data().createdAt - a.data().createdAt);

  let personName = "Unknown", personTitle = "", personEmail = "", personAvatarUrl = "", personAvatarColor = "#5cb800";
  if (userPosts.length > 0) {
    const fp = userPosts[0].data();
    personName = fp.name; personTitle = fp.title; personEmail = fp.email || "";
    personAvatarUrl = userSettings.avatarUrl || fp.avatarUrl || "";
    personAvatarColor = userSettings.avatarColor || fp.avatarColor || colorFromName(fp.name);
  }

  let totalSum = 0, totalCount = 0;
  userPosts.forEach(d => { const p = d.data(); totalSum += (p.ratingSum || 0); totalCount += (p.ratingCount || 0); });
  const avgRating = totalCount > 0 ? (totalSum / totalCount).toFixed(1) : "—";

  const avEl = document.getElementById("upAvatar");
  if (personAvatarUrl) {
    avEl.innerHTML = `<img src="${personAvatarUrl}" style="width:72px;height:72px;object-fit:cover;border-radius:50%;">`;
    avEl.style.background = "transparent";
  } else {
    avEl.innerHTML = personName.charAt(0).toUpperCase();
    avEl.style.background = personAvatarColor;
  }

  document.getElementById("upName").textContent = personName;
  document.getElementById("upTitle").textContent = personTitle;
  document.getElementById("upBio").textContent = userSettings.bio || "No bio yet.";

  const portLink = document.getElementById("upPortfolio");
  const portUrl = userSettings.portfolioUrl || (userPosts[0]?.data().portfolioUrl || "");
  if (portUrl) { portLink.style.display="inline-flex"; portLink.href=portUrl; } else portLink.style.display="none";

  document.getElementById("upStatPosts").textContent = userPosts.length;
  document.getElementById("upStatRating").textContent = avgRating;
  document.getElementById("upStatReviews").textContent = totalCount;

  const isOwn = currentUser && uid === currentUser.uid;
  if (!isOwn && personEmail) {
    document.getElementById("upActionBtns").innerHTML = `
      <button class="btn btn-primary" onclick="openHire('${userPosts[0]?.id||""}','${personName}','${personEmail}')">💼 Hire</button>
      <button class="btn btn-info" onclick="openMessage('${uid}','${personName}','${personEmail}');closeModal('userprofile')">💬 Message</button>
      ${userPosts.length > 0 ? `<button class="btn btn-secondary" onclick="openRate('${userPosts[0].id}','${personName}','${uid}','${personEmail}');closeModal('userprofile')">⭐ Rate</button>` : ""}
    `;
  }

  const postsList = document.getElementById("upPostsList");
  if (userPosts.length === 0) {
    postsList.innerHTML = `<div class="empty-state" style="padding:20px;"><div class="icon" style="font-size:1.5rem;">😶</div><p>No posts yet.</p></div>`;
  } else {
    postsList.innerHTML = "";
    userPosts.forEach(d => {
      const p = d.data();
      const tagsHtml = (p.tags || []).map(t => `<span class="tag">${t}</span>`).join("");
      const avg = p.ratingCount ? (p.ratingSum / p.ratingCount).toFixed(1) : null;
      const ratingHtml = avg ? `<div class="up-post-rating">${"★".repeat(Math.round(avg))} ${avg} (${p.ratingCount} review${p.ratingCount !== 1 ? "s" : ""})</div>` : "";
      let mediaHtml = "";
      if (p.proofVideoUrl) mediaHtml = `<div class="up-post-media"><video src="${p.proofVideoUrl}" controls preload="metadata" playsinline></video></div>`;
      else if (p.proofUrl) mediaHtml = `<div class="up-post-media"><img src="${p.proofUrl}" onclick="openLightbox('${p.proofUrl}')" title="View full size"></div>`;
      const portHtml = p.portfolioUrl ? `<a class="portfolio-link" href="${p.portfolioUrl}" target="_blank" style="font-size:.75rem;">🔗 Portfolio</a>` : "";
      const div = document.createElement("div");
      div.className = "up-post-card";
      div.innerHTML = `
        <div class="up-post-title">${p.title}</div>
        <div class="up-post-tags">${tagsHtml}</div>
        <div class="up-post-skills">${p.skills}</div>
        ${ratingHtml}${portHtml}${mediaHtml}`;
      postsList.appendChild(div);
    });
  }

  if (userPosts.length > 0) {
    const reviewsQ = query(collection(db, "reviews"), where("toUid", "==", uid));
    const reviewsSnap = await getDocs(reviewsQ);
    const reviews = [...reviewsSnap.docs].sort((a, b) => b.data().createdAt - a.data().createdAt);
    const reviewsSection = document.getElementById("upReviewsSection");
    const reviewsList = document.getElementById("upReviewsList");
    if (reviews.length > 0) {
      reviewsSection.style.display = "block";
      reviewsList.innerHTML = "";
      reviews.forEach(rv => {
        const r = rv.data();
        const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
        const dateStr = new Date(r.createdAt).toLocaleDateString();
        const div = document.createElement("div");
        div.className = "up-review-item";
        div.innerHTML = `
          <div class="rv-meta">
            <span class="rv-stars">${stars}</span>
            <span>${r.fromEmail}</span>
            <span>· ${dateStr}</span>
          </div>
          ${r.review ? `<div>${r.review}</div>` : ""}`;
        reviewsList.appendChild(div);
      });
    } else {
      reviewsSection.style.display = "none";
    }
  }
};

/* ════════════════════════════════════
   ADMIN
   ════════════════════════════════════ */

async function loadAdminData() {
  const [postsSnap, msgSnap, hireSnap, settingsSnap] = await Promise.all([
    getDocs(collection(db, "people")),
    getDocs(collection(db, "messages")),
    getDocs(collection(db, "hireRequests")),
    getDocs(collection(db, "userSettings"))
  ]);
  document.getElementById("statPosts").textContent = postsSnap.size;
  document.getElementById("statMessages").textContent = msgSnap.size;
  document.getElementById("statHires").textContent = hireSnap.size;
  document.getElementById("statUsers").textContent = settingsSnap.size;

  let rows = "";
  postsSnap.forEach(d => {
    const p = d.data(); const id = d.id;
    rows += `<tr>
      <td>${p.name}</td><td>${p.title}</td>
      <td style="font-size:.75rem;color:var(--text3);">${p.email || "—"}</td>
      <td><button class="btn btn-danger" style="font-size:.75rem;padding:4px 10px;" onclick="adminDelete('${id}')">Delete</button></td>
    </tr>`;
  });
  document.getElementById("adminTbody").innerHTML = rows || `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px;">No posts.</td></tr>`;
}

window.adminDelete = async function (id) {
  if (confirm("Admin delete this post?")) await deleteDoc(doc(db, "people", id));
};
