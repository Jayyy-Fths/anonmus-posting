'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  posts: [],
  filter: { category: 'all', sort: 'new', search: '' },
};

// ─── Theme (Feature 13: light/dark mode) ─────────────────────────────────────
let darkMode = localStorage.getItem('anontea_theme') !== 'light';
function applyTheme() {
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = darkMode ? '☀️' : '🌙';
}
function toggleTheme() {
  darkMode = !darkMode;
  localStorage.setItem('anontea_theme', darkMode ? 'dark' : 'light');
  applyTheme();
}
applyTheme();

// ─── Bookmarks (Feature 1) ────────────────────────────────────────────────────
const bookmarks = new Set(JSON.parse(localStorage.getItem('anontea_bookmarks') || '[]'));
function saveBookmarks() { localStorage.setItem('anontea_bookmarks', JSON.stringify([...bookmarks])); }
function isBookmarked(id) { return bookmarks.has(id); }
function toggleBookmark(e, id) {
  e.stopPropagation();
  if (bookmarks.has(id)) { bookmarks.delete(id); toast('Bookmark removed'); }
  else { bookmarks.add(id); toast('Bookmarked! 🔖'); }
  saveBookmarks();
  loadPosts();
}

// ─── Liked comments (Feature 10) ─────────────────────────────────────────────
const likedComments = new Set(JSON.parse(localStorage.getItem('anontea_liked_comments') || '[]'));
function saveLikedComments() { localStorage.setItem('anontea_liked_comments', JSON.stringify([...likedComments])); }
function hasLikedComment(id) { return likedComments.has(id); }

// ─── Flagged posts (Feature 12) ───────────────────────────────────────────────
const flaggedPosts = new Set(JSON.parse(localStorage.getItem('anontea_flagged') || '[]'));
function saveFlagged() { localStorage.setItem('anontea_flagged', JSON.stringify([...flaggedPosts])); }

// ─── Draft saving (Feature 17) ───────────────────────────────────────────────
const DRAFT_KEY = 'anontea_draft';
function saveDraft() {
  const title   = document.getElementById('post-title').value;
  const content = document.getElementById('post-content').value;
  if (title || content) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      title,
      content,
      category: document.getElementById('post-category').value,
      tags:     document.getElementById('post-tags').value,
    }));
  } else {
    localStorage.removeItem(DRAFT_KEY);
  }
}
function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    if (!d.title && !d.content) return;
    document.getElementById('post-title').value    = d.title    || '';
    document.getElementById('post-content').value  = d.content  || '';
    document.getElementById('post-category').value = d.category || 'general';
    document.getElementById('post-tags').value     = d.tags     || '';
    document.getElementById('title-count').textContent   = `${(d.title   || '').length} / 150`;
    document.getElementById('content-count').textContent = `${(d.content || '').length} / 5000`;
    toast('Draft restored ✏️');
  } catch {}
}
function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

// ─── Nickname memory (Feature 18) ────────────────────────────────────────────
const NICK_KEY = 'anontea_nickname';
function getSavedNick() { return localStorage.getItem(NICK_KEY) || ''; }
function saveNick(name) { if (name) localStorage.setItem(NICK_KEY, name); }

// ─── Nickname generator (Feature 19) ─────────────────────────────────────────
const NICK_ADJ  = ['Mysterious','Silent','Brewing','Spilling','Sipping','Cozy','Shadowy','Secret','Whispering','Hidden','Fuzzy','Sneaky','Sleepy'];
const NICK_NOUN = ['Teacup','Brewer','Spiller','Gossip','Kettle','Sipper','Ghost','Oracle','Oolong','Chai','Matcha','Boba','Leaf'];
function generateNick() {
  const a = NICK_ADJ [Math.floor(Math.random() * NICK_ADJ.length)];
  const n = NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
  return `${a}${n}${Math.floor(Math.random() * 99) + 1}`;
}
function fillRandomNick() {
  const input = document.querySelector('.comment-form [name="nickname"]');
  if (input) { input.value = generateNick(); input.focus(); }
}

// ─── Recently viewed (Feature 20) ────────────────────────────────────────────
const RECENT_KEY = 'anontea_recent';
function addRecentlyViewed(id, title) {
  const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter(r => r.id !== id);
  list.unshift({ id, title, time: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
  renderRecentlyViewed();
}
function renderRecentlyViewed() {
  const sec = document.getElementById('recent-section');
  if (!sec) return;
  const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  if (recent.length === 0) { sec.style.display = 'none'; return; }
  sec.style.display = '';
  document.getElementById('recent-list').innerHTML = recent.map(r =>
    `<div class="recent-item" onclick="openPost('${esc(r.id)}')">
      <span class="recent-title">${esc(r.title)}</span>
      <span class="recent-time">${timeAgo(r.time)}</span>
    </div>`
  ).join('');
}

// ─── Confetti (Feature 21) ────────────────────────────────────────────────────
function spawnConfetti() {
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { position:'fixed', top:'0', left:'0', width:'100%', height:'100%', pointerEvents:'none', zIndex:'9999' });
  document.body.appendChild(canvas);
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx  = canvas.getContext('2d');
  const COLS = ['#f0a020','#c85a8a','#22c97a','#f59e0b','#3b82f6','#ec4899'];
  const pts  = Array.from({ length: 90 }, () => ({
    x:     Math.random() * canvas.width,
    y:     -(Math.random() * canvas.height * 0.5),
    r:     Math.random() * 7 + 3,
    color: COLS[Math.floor(Math.random() * COLS.length)],
    vy:    Math.random() * 3 + 2,
    vx:    (Math.random() - 0.5) * 2.5,
    spin:  (Math.random() - 0.5) * 0.2,
    angle: Math.random() * Math.PI * 2,
  }));
  let raf;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pts.forEach(p => {
      p.y += p.vy; p.x += p.vx; p.angle += p.spin;
      if (p.y < canvas.height + 20) alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
      ctx.restore();
    });
    if (alive) { raf = requestAnimationFrame(draw); }
    else        { canvas.remove(); }
  }
  draw();
  setTimeout(() => { cancelAnimationFrame(raf); canvas.remove(); }, 3500);
}

// ─── Admin mode ───────────────────────────────────────────────────────────────
let adminMode = sessionStorage.getItem('anontea_admin') === '1';

function toggleAdminMode() {
  if (adminMode) {
    adminMode = false;
    sessionStorage.removeItem('anontea_admin');
    sessionStorage.removeItem('anontea_admin_secret');
    document.getElementById('admin-toggle').classList.remove('active');
    document.getElementById('_admin-pw-wrap')?.remove();
    toast('Admin mode off');
    loadPosts();
    return;
  }
  // prompt() is blocked in iframes/VS Code Simple Browser — use inline input instead
  const existing = document.getElementById('_admin-pw-wrap');
  if (existing) { existing.remove(); return; }
  const wrap = document.createElement('div');
  wrap.id = '_admin-pw-wrap';
  wrap.style.cssText = 'position:fixed;bottom:60px;right:18px;z-index:9999;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius);padding:14px;display:flex;gap:8px;box-shadow:0 8px 30px rgba(0,0,0,0.5)';
  const inp = document.createElement('input');
  inp.type = 'password';
  inp.placeholder = 'Admin password';
  inp.style.cssText = 'background:#0d0d1a;border:1px solid var(--border2);border-radius:var(--radius-sm);padding:8px 12px;color:var(--text);font-family:var(--font);font-size:13px;outline:none;width:150px';
  const btn = document.createElement('button');
  btn.textContent = 'Enter';
  btn.style.cssText = 'background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border:none;padding:8px 14px;border-radius:999px;font-family:var(--font);font-weight:700;font-size:13px;cursor:pointer';
  const submit = () => {
    const secret = inp.value.trim();
    wrap.remove();
    if (!secret) return;
    sessionStorage.setItem('anontea_admin_secret', secret);
    sessionStorage.setItem('anontea_admin', '1');
    adminMode = true;
    document.getElementById('admin-toggle').classList.add('active');
    toast('Admin mode on — trash buttons visible');
    loadPosts();
  };
  btn.addEventListener('click', submit);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') wrap.remove(); });
  wrap.append(inp, btn);
  document.body.appendChild(wrap);
  inp.focus();
}

// ─── Two-click confirmation (replaces confirm() which is blocked in iframes) ──
const _pendingConfirm = {};
function twoClickConfirm(key, msg) {
  if (_pendingConfirm[key]) { delete _pendingConfirm[key]; return true; }
  _pendingConfirm[key] = true;
  setTimeout(() => delete _pendingConfirm[key], 3000);
  toast(msg, 'error');
  return false;
}

async function deletePost(e, postId) {
  e.stopPropagation();
  if (!twoClickConfirm('del-' + postId, '⚠️ Click 🗑️ again to confirm permanent delete')) return;
  const secret = sessionStorage.getItem('anontea_admin_secret') || '';
  try {
    const res = await fetch(`/api/posts/${postId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${secret}` },
    });
    if (res.status === 401) { toast('Wrong admin password', 'error'); return; }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast(d.error || 'Delete failed', 'error');
      return;
    }
    toast('Post deleted.');
    closeAllModals();
    await loadPosts();
  } catch (err) {
    toast('Delete failed: ' + err.message, 'error');
  }
}

// ─── Pin post (Feature 11) ────────────────────────────────────────────────────
async function pinPost(e, postId) {
  e.stopPropagation();
  const secret = sessionStorage.getItem('anontea_admin_secret') || '';
  try {
    const res = await fetch(`/api/posts/${postId}/pin`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secret}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 401) { toast('Wrong admin password', 'error'); return; }
    const { pinned } = await res.json();
    toast(pinned ? '📌 Post pinned to top' : 'Post unpinned');
    await loadPosts();
  } catch (err) {
    toast('Pin failed: ' + err.message, 'error');
  }
}

// ─── Flag post (Feature 12) ───────────────────────────────────────────────────
async function flagPost(e, postId) {
  e.stopPropagation();
  if (flaggedPosts.has(postId)) { toast('Already reported', 'error'); return; }
  if (!twoClickConfirm('flag-' + postId, '🚩 Click again to confirm report')) return;
  flaggedPosts.add(postId);
  saveFlagged();
  try {
    await api('POST', `/api/posts/${postId}/flag`, {});
    toast('Post reported. Thank you!');
  } catch (err) {
    flaggedPosts.delete(postId);
    saveFlagged();
    toast(err.message, 'error');
  }
}

// ─── Comment like (Feature 10) ────────────────────────────────────────────────
async function likeComment(e, commentId) {
  e.stopPropagation();
  if (hasLikedComment(commentId)) { toast('Already liked!'); return; }
  const btn = e.target.closest('.comment-like-btn');
  likedComments.add(commentId);
  saveLikedComments();
  if (btn) btn.classList.add('liked');
  try {
    const { likes } = await api('POST', `/api/comments/${commentId}/like`, {});
    if (btn) btn.querySelector('.like-count').textContent = likes;
  } catch (err) {
    likedComments.delete(commentId);
    saveLikedComments();
    if (btn) btn.classList.remove('liked');
    toast(err.message, 'error');
  }
}

// ─── Image upload (picture feature) ──────────────────────────────────────────
let pendingImageFile = null;

function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) { toast('Please pick an image file', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5 MB', 'error'); return; }
  pendingImageFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('image-preview-img').src = e.target.result;
    document.getElementById('image-preview-wrap').classList.remove('hidden');
    document.getElementById('image-upload-placeholder').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  pendingImageFile = null;
  const input = document.getElementById('post-image');
  if (input) input.value = '';
  document.getElementById('image-preview-img').src = '';
  document.getElementById('image-preview-wrap').classList.add('hidden');
  document.getElementById('image-upload-placeholder').classList.remove('hidden');
}

// Wire up file input + drag-and-drop after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('post-image');
  if (fileInput) fileInput.addEventListener('change', () => handleImageFile(fileInput.files[0]));

  // Draft auto-save listeners
  ['post-title', 'post-content', 'post-tags'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', saveDraft);
  });
  document.getElementById('post-category')?.addEventListener('change', saveDraft);

  // Back to top (Feature 27)
  const backTopBtn = document.getElementById('back-to-top');
  if (backTopBtn) {
    window.addEventListener('scroll', () => {
      backTopBtn.classList.toggle('visible', window.scrollY > 300);
    }, { passive: true });
    backTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  const area = document.getElementById('image-upload-area');
  if (area) {
    area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
    area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
    area.addEventListener('drop', e => {
      e.preventDefault();
      area.classList.remove('drag-over');
      handleImageFile(e.dataTransfer.files[0]);
    });
  }
});

// ─── Local reaction tracking ──────────────────────────────────────────────────
const reacted = JSON.parse(localStorage.getItem('anontea_reactions') || '{}');
function saveReacted() { localStorage.setItem('anontea_reactions', JSON.stringify(reacted)); }
function hasReacted(postId, emoji) { return !!reacted[`${postId}::${emoji}`]; }
function setReacted(postId, emoji, val) {
  const key = `${postId}::${emoji}`;
  if (val) reacted[key] = true; else delete reacted[key];
  saveReacted();
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function isNew(dateStr) {
  return Date.now() - new Date(dateStr).getTime() < 3600000;
}

// Feature 7: reading time estimate
function readingTime(content) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return `~${Math.max(1, Math.round(words / 200))} min read`;
}

// Feature 8: consistent avatar color per nickname
const AVATAR_COLORS = ['#f0a020','#c85a8a','#22c97a','#3b82f6','#f59e0b','#ec4899','#06b6d4','#84cc16'];
function avatarColor(nickname) {
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) hash = (Math.imul(31, hash) + nickname.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── URL State (Feature 4) ────────────────────────────────────────────────────
function updateURL() {
  const params = new URLSearchParams();
  if (state.filter.category !== 'all') params.set('cat', state.filter.category);
  if (state.filter.sort !== 'new')     params.set('sort', state.filter.sort);
  if (state.filter.search)             params.set('q', state.filter.search);
  const str = params.toString();
  history.replaceState(null, '', location.pathname + (str ? '?' + str : '') + (location.hash || ''));
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch {
    console.error(`[ANON.TEA] Bad response from ${method} ${url}`, { status: res.status, body: text.slice(0, 500) });
    throw new Error(`Server error (status ${res.status}) — check the browser console`);
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

// ─── Modal ────────────────────────────────────────────────────────────────────
let openModalId = null;

function openModal(id) {
  closeAllModals();
  const modal = document.getElementById(id);
  const backdrop = document.getElementById('backdrop');
  modal.classList.remove('hidden');
  backdrop.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  openModalId = id;
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  document.getElementById('backdrop').classList.add('hidden');
  document.body.style.overflow = '';
  openModalId = null;
  const box = document.querySelector('#post-modal .modal-box');
  if (_readScroll && box) { box.removeEventListener('scroll', _readScroll); _readScroll = null; }
  const bar = document.getElementById('reading-progress');
  if (bar) { bar.style.width = '0%'; }
}

// ─── Category labels ──────────────────────────────────────────────────────────
const CAT_LABEL = {
  general: '📣 General', school: '🏫 School', drama: '💔 Drama',
  relationships: '💑 Relationships', work: '💼 Work', social: '🎉 Social', online: '📱 Online',
};

// ─── Search highlight (Feature 23) ───────────────────────────────────────────
function highlight(text, query) {
  if (!query || !query.trim()) return esc(text);
  const safeQ = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Split on raw text first so HTML escaping never splits an entity
  return text.split(new RegExp(`(${safeQ})`, 'gi'))
    .map((part, i) => i % 2 === 1 ? `<mark>${esc(part)}</mark>` : esc(part))
    .join('');
}

// ─── Tea Level bar (Feature 24) ──────────────────────────────────────────────
function teaScore(post) {
  return Object.values(post.reactions).reduce((s, v) => s + v, 0) * 2 +
         (post.commentCount || 0) * 3 +
         (post.views || 0) * 0.05;
}

// ─── Reading progress (Feature 25) ───────────────────────────────────────────
let _readScroll = null;
function attachReadingProgress() {
  const box = document.querySelector('#post-modal .modal-box');
  const bar = document.getElementById('reading-progress');
  if (!box || !bar) return;
  if (_readScroll) box.removeEventListener('scroll', _readScroll);
  bar.style.width = '0%';
  _readScroll = () => {
    const scrollable = box.scrollHeight - box.clientHeight;
    const pct = scrollable > 0 ? (box.scrollTop / scrollable) * 100 : 100;
    bar.style.width = Math.min(100, pct) + '%';
  };
  box.addEventListener('scroll', _readScroll, { passive: true });
}

// ─── Floating reaction emoji (Feature 26) ────────────────────────────────────
function spawnReactionFloat(e, emoji) {
  const el = document.createElement('span');
  el.className = 'reaction-float';
  el.textContent = emoji;
  el.style.left = e.clientX + 'px';
  el.style.top  = e.clientY + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

// ─── Render: Post Card ────────────────────────────────────────────────────────
function renderCard(post) {
  const tags = (post.tags || []).slice(0, 3)
    .map(t => `<span class="tag-badge">#${esc(t)}</span>`).join('');

  const pills = Object.entries(post.reactions).map(([emoji, count]) => {
    const r = hasReacted(post.id, emoji);
    return `<button class="reaction-pill${r ? ' reacted' : ''}"
      onclick="reactCard(event,'${esc(post.id)}','${emoji}')" title="React with ${emoji}">
      <span>${emoji}</span><span class="rcount">${count}</span>
    </button>`;
  }).join('');

  const ageMs       = Date.now() - new Date(post.createdAt).getTime();
  const freshClass  = ageMs < 3600000 ? ' fresh-hot' : ageMs < 21600000 ? ' fresh-warm' : '';
  const freshBadge  = ageMs < 3600000
    ? `<span class="fresh-badge hot">🔥 hot</span>`
    : ageMs < 21600000 ? `<span class="fresh-badge warm">✨ new</span>` : '';
  const newBadge    = isNew(post.createdAt) ? `<span class="post-card-new-badge">NEW</span>` : '';
  const pinnedBadge = post.pinned ? `<span class="post-card-pinned-label">📌 Pinned</span>` : '';
  const rt          = readingTime(post.content);
  const bkIcon      = isBookmarked(post.id) ? '🔖' : '🏷️';
  const q           = state.filter.search;
  const maxScore    = Math.max(1, ...state.posts.map(teaScore));
  const barPct      = Math.round((teaScore(post) / maxScore) * 100);

  const imageHtml = post.imageUrl
    ? `<div class="post-card-image"><img src="${esc(post.imageUrl)}" alt="" loading="lazy" /></div>`
    : '';

  const adminActions = adminMode
    ? `<div class="admin-actions" onclick="event.stopPropagation()">
        <button class="admin-delete-btn" onclick="deletePost(event,'${esc(post.id)}')">🗑️ Delete</button>
        <button class="admin-pin-btn" onclick="pinPost(event,'${esc(post.id)}')">${post.pinned ? '📌 Unpin' : '📌 Pin'}</button>
       </div>`
    : '';

  return `
    <article class="post-card${post.pinned ? ' pinned' : ''}${freshClass}" onclick="openPost('${esc(post.id)}')">
      ${newBadge}
      ${imageHtml}
      <div class="post-card-top">
        <button class="cat-badge" onclick="event.stopPropagation();setCategory('${esc(post.category)}')" title="Filter by category">${esc(CAT_LABEL[post.category] || post.category)}</button>
        ${pinnedBadge}${freshBadge}
        ${tags}
      </div>
      <div class="post-card-title">${highlight(post.title, q)}</div>
      <div class="post-card-snippet">${highlight(post.content, q)}</div>
      <div class="post-card-footer">
        <div class="post-reactions">${pills}</div>
        <div class="post-meta">
          <span>💬 ${post.commentCount}</span>
          <span>👁 ${post.views || 0}</span>
          <span>${rt}</span>
          <span>${timeAgo(post.createdAt)}</span>
          <button class="bookmark-small-btn${isBookmarked(post.id) ? ' bookmarked' : ''}"
            onclick="toggleBookmark(event,'${esc(post.id)}')"
            title="${isBookmarked(post.id) ? 'Remove bookmark' : 'Bookmark'}">${bkIcon}</button>
        </div>
      </div>
      <div class="tea-level-track" title="Engagement level"><div class="tea-level-fill" style="width:${barPct}%"></div></div>
      ${adminActions}
    </article>`;
}

// ─── Load Posts ───────────────────────────────────────────────────────────────
async function loadPosts() {
  const grid  = document.getElementById('posts-grid');
  const empty = document.getElementById('empty-state');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div> Brewing the tea...</div>';
  empty.classList.add('hidden');

  try {
    const isBookmarksView = state.filter.category === '__bookmarks__';
    const params = new URLSearchParams({
      category: isBookmarksView ? 'all' : state.filter.category,
      sort:     state.filter.sort,
    });
    if (state.filter.search && !isBookmarksView) params.set('search', state.filter.search);

    let posts = await api('GET', `/api/posts?${params}`);

    if (isBookmarksView) {
      posts = posts.filter(p => bookmarks.has(p.id));
      if (state.filter.search) {
        const q = state.filter.search.toLowerCase();
        posts = posts.filter(p =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          (p.tags || []).some(t => t.toLowerCase().includes(q))
        );
      }
    }

    state.posts = posts;
    updateURL();

    // Update sidebar stats widget
    const statPostsEl    = document.getElementById('stat-posts');
    const statCommentsEl = document.getElementById('stat-comments');
    const statReactEl    = document.getElementById('stat-reactions');
    if (statPostsEl) statPostsEl.textContent = posts.length;
    if (statCommentsEl) statCommentsEl.textContent = posts.reduce((s, p) => s + (p.commentCount || 0), 0);
    if (statReactEl)    statReactEl.textContent     = posts.reduce((s, p) => s + Object.values(p.reactions).reduce((r, v) => r + v, 0), 0);

    if (state.posts.length === 0) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      grid.innerHTML = state.posts.map(renderCard).join('');
    }
    renderHot();
    renderTicker();
    renderTrendingTags();
  } catch {
    grid.innerHTML = '<div class="loading">Could not load posts. Is the server running?</div>';
  }
}

// ─── Hot Section ─────────────────────────────────────────────────────────────
function hotScore(p) {
  return Object.values(p.reactions).reduce((s, v) => s + v, 0) * 2 + p.commentCount;
}

function renderHot() {
  const sec       = document.getElementById('hot-section');
  const container = document.getElementById('hot-posts');
  const top = [...state.posts].sort((a, b) => hotScore(b) - hotScore(a)).slice(0, 3);

  if (top.every(p => hotScore(p) === 0)) { sec.style.display = 'none'; return; }
  sec.style.display = '';

  const ranks = ['🥇', '🥈', '🥉'];
  container.innerHTML = top.map((p, i) => `
    <div class="hot-card" onclick="openPost('${esc(p.id)}')">
      <div class="hot-card-rank">${ranks[i]}</div>
      <div class="hot-card-title">${esc(p.title)}</div>
      <div class="hot-card-stats">
        <span>🔥 ${Object.values(p.reactions).reduce((s,v)=>s+v,0)} reactions</span>
        <span>💬 ${p.commentCount} comments</span>
        <span>${timeAgo(p.createdAt)}</span>
      </div>
    </div>`).join('');
}

// ─── Ticker ───────────────────────────────────────────────────────────────────
function renderTicker() {
  const el = document.getElementById('ticker');
  if (state.posts.length === 0) { el.textContent = 'No tea yet — be the first to spill! ☕'; return; }
  el.textContent = state.posts.slice(0, 10).map(p => `☕  ${p.title}`).join('   ·   ') + '   ·   ';
}

// ─── Trending Tags (Feature 3) ────────────────────────────────────────────────
function renderTrendingTags() {
  const section = document.getElementById('tags-section');
  if (!section) return;
  const tagCounts = new Map();
  for (const post of state.posts) {
    for (const tag of (post.tags || [])) {
      if (tag) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  if (tagCounts.size === 0) { section.style.display = 'none'; return; }
  section.style.display = '';
  const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  document.getElementById('tags-cloud').innerHTML = sorted.map(([tag, count]) =>
    `<button class="tag-cloud-btn" onclick="filterByTag('${esc(tag)}')">#${esc(tag)} <span class="tag-cloud-count">${count}</span></button>`
  ).join('');
}

function filterByTag(tag) {
  state.filter.search = tag;
  document.getElementById('search').value = tag;
  updateURL();
  loadPosts();
}

// ─── Load Categories (Feature 14: count badges) ───────────────────────────────
async function loadCategories() {
  try {
    const cats = await api('GET', '/api/categories');
    const container = document.getElementById('categories');
    // Rebuild non-"All" buttons
    container.querySelectorAll('.cat-btn:not([data-cat="all"])').forEach(b => b.remove());

    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn';
      btn.dataset.cat = cat.id;
      btn.innerHTML = esc(cat.label) + (cat.count > 0
        ? ` <span class="cat-count-badge">${cat.count}</span>` : '');
      btn.addEventListener('click', () => setCategory(cat.id));
      container.appendChild(btn);
    });

    // Bookmarks pseudo-category (Feature 1)
    if (!document.querySelector('[data-cat="__bookmarks__"]')) {
      const bkBtn = document.createElement('button');
      bkBtn.className = 'cat-btn';
      bkBtn.dataset.cat = '__bookmarks__';
      bkBtn.textContent = '🔖 Bookmarks';
      bkBtn.addEventListener('click', () => setCategory('__bookmarks__'));
      container.appendChild(bkBtn);
    }

    // Restore active state
    document.querySelectorAll('.cat-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.cat === state.filter.category)
    );
  } catch {}
}

function setCategory(cat) {
  state.filter.category = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  updateURL();
  loadPosts();
}

function setSort(sort) {
  state.filter.sort = sort;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === sort));
  updateURL();
  loadPosts();
}

// ─── React from card ──────────────────────────────────────────────────────────
async function reactCard(e, postId, emoji) {
  e.stopPropagation();
  const was = hasReacted(postId, emoji);
  setReacted(postId, emoji, !was);
  if (!was) spawnReactionFloat(e, emoji);
  try {
    await api('POST', `/api/posts/${postId}/react`, { emoji, delta: was ? -1 : 1 });
    await loadPosts();
  } catch (err) {
    setReacted(postId, emoji, was);
    toast(err.message, 'error');
  }
}

// ─── Open Post Modal ──────────────────────────────────────────────────────────
async function openPost(id) {
  openModal('post-modal');
  const area = document.getElementById('post-content-area');
  area.innerHTML = '<div class="loading" style="padding:80px 0"><div class="spinner"></div> Loading...</div>';
  // Feature 2: view counter (fire-and-forget)
  api('POST', `/api/posts/${id}/view`, {}).catch(() => {});
  try {
    const post = await api('GET', `/api/posts/${id}`);
    renderPostDetail(post);
  } catch {
    area.innerHTML = '<div class="loading">Could not load this post.</div>';
  }
}

// ─── Similar posts (Feature 22) ──────────────────────────────────────────────
function renderSimilarPosts(post) {
  const myTags = new Set(post.tags || []);
  if (myTags.size === 0) return '';
  const similar = state.posts
    .filter(p => p.id !== post.id && (p.tags || []).some(t => myTags.has(t)))
    .slice(0, 3);
  if (similar.length === 0) return '';
  return `
    <div class="similar-posts">
      <h4 class="similar-title">☕ Related Tea</h4>
      <div class="similar-list">
        ${similar.map(p => `
          <div class="similar-card" onclick="openPost('${esc(p.id)}')">
            <span class="similar-card-title">${esc(p.title)}</span>
            <span class="similar-card-meta">${timeAgo(p.createdAt)} · 💬 ${p.commentCount}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ─── Render Post Detail ───────────────────────────────────────────────────────
function renderPostDetail(post) {
  const area = document.getElementById('post-content-area');

  const tags = (post.tags || []).map(t => `<span class="tag-badge">#${esc(t)}</span>`).join('');

  const reactBtns = Object.entries(post.reactions).map(([emoji, count]) => {
    const r = hasReacted(post.id, emoji);
    const btnId = `rbl-${post.id}-${emoji.codePointAt(0)}`;
    return `<button class="reaction-btn-large${r ? ' reacted' : ''}" id="${btnId}"
      onclick="reactDetail('${esc(post.id)}','${emoji}',event)">
      ${emoji} <span class="rcount">${count}</span>
    </button>`;
  }).join('');

  // Feature 8: avatar colors; Feature 9: char countdown; Feature 10: comment likes
  const commentsHtml = post.comments.length === 0
    ? `<div class="no-comments">No comments yet — be the first to reply!</div>`
    : post.comments.map(c => {
        const color  = avatarColor(c.nickname);
        const liked  = hasLikedComment(c.id);
        return `
          <div class="comment-item">
            <div class="comment-nick">
              <span class="comment-avatar" style="background:${color}"></span>
              ~ ${esc(c.nickname)}
            </div>
            <div class="comment-body">${esc(c.content)}</div>
            <div class="comment-footer">
              <span class="comment-time">${timeAgo(c.createdAt)}</span>
              <button class="comment-like-btn${liked ? ' liked' : ''}" onclick="likeComment(event,'${esc(c.id)}')">
                👍 <span class="like-count">${c.likes || 0}</span>
              </button>
            </div>
          </div>`;
      }).join('');

  const isFlagged = flaggedPosts.has(post.id);
  const bkLabel   = isBookmarked(post.id) ? '🔖 Saved' : '🏷️ Save';

  // Feature 11: admin pin; Feature 12: flag count for admin
  const adminBtns = adminMode
    ? `<button class="admin-delete-detail-btn" onclick="deletePost(event,'${esc(post.id)}')">🗑️ Delete</button>
       <button class="admin-pin-btn admin-pin-detail" onclick="pinPost(event,'${esc(post.id)}')">${post.pinned ? '📌 Unpin' : '📌 Pin'}</button>
       ${post.flags > 0 ? `<span class="flag-count-badge">🚩 ${post.flags} report${post.flags !== 1 ? 's' : ''}</span>` : ''}`
    : '';

  area.innerHTML = `
    <div class="post-detail">
      <div class="post-detail-meta">
        <span class="cat-badge">${esc(CAT_LABEL[post.category] || post.category)}</span>
        ${tags}
        <span class="post-detail-time">${timeAgo(post.createdAt)}</span>
      </div>
      <h1 class="post-detail-title">${esc(post.title)}</h1>
      <div class="post-detail-stats">
        <span>👁 ${post.views || 0} views</span>
        <span>📖 ${readingTime(post.content)}</span>
        ${post.pinned ? '<span>📌 Pinned</span>' : ''}
      </div>
      ${post.imageUrl ? `<div class="post-detail-image"><img src="${esc(post.imageUrl)}" alt="Post image" /></div>` : ''}
      <div class="post-detail-body">${esc(post.content)}</div>

      <div class="post-detail-reactions">
        ${reactBtns}
        <button class="share-btn" onclick="sharePost('${esc(post.id)}','${esc(post.title)}')">🔗 Share</button>
        <button class="bookmark-detail-btn${isBookmarked(post.id) ? ' bookmarked' : ''}" onclick="toggleBookmark(event,'${esc(post.id)}')">${bkLabel}</button>
        <button class="flag-btn${isFlagged ? ' flagged' : ''}" onclick="flagPost(event,'${esc(post.id)}')" title="Report post">${isFlagged ? '🚩 Reported' : '🚩'}</button>
        ${adminBtns}
      </div>

      <div class="comments-section">
        <h3 class="comments-title" id="comments-title-${esc(post.id)}">💬 ${post.comments.length} Comment${post.comments.length !== 1 ? 's' : ''}</h3>
        <div class="comment-list" id="comment-list-${esc(post.id)}">${commentsHtml}</div>
        <form class="comment-form" onsubmit="submitComment(event,'${esc(post.id)}')">
          <div class="comment-form-row">
            <div class="nick-row">
              <input type="text" name="nickname" placeholder="Nickname (optional)" maxlength="30" autocomplete="off" />
              <button type="button" class="nick-gen-btn" onclick="fillRandomNick()" title="Generate random nickname">🎲</button>
            </div>
            <div class="comment-textarea-wrap">
              <textarea name="content" placeholder="Add your two cents..." maxlength="1000" required rows="2" oninput="updateCommentCount(this)"></textarea>
              <span class="comment-char-count" id="comment-char-count">0 / 1000</span>
            </div>
          </div>
          <button type="submit" class="comment-submit">Reply ✉️</button>
        </form>
      </div>
      ${renderSimilarPosts(post)}
    </div>`;
  const nickInput = area.querySelector('[name="nickname"]');
  if (nickInput) nickInput.value = getSavedNick();
  addRecentlyViewed(post.id, post.title);
  attachReadingProgress();
}

// Feature 9: live comment char countdown
function updateCommentCount(el) {
  const count = document.getElementById('comment-char-count');
  if (count) count.textContent = `${el.value.length} / 1000`;
}

// ─── React in detail view ─────────────────────────────────────────────────────
async function reactDetail(postId, emoji, e) {
  const was   = hasReacted(postId, emoji);
  setReacted(postId, emoji, !was);
  const btnId = `rbl-${postId}-${emoji.codePointAt(0)}`;
  const btn   = document.getElementById(btnId);
  if (e && !was) spawnReactionFloat(e, emoji);
  // Optimistic UI: toggle class and nudge count immediately
  if (btn) {
    btn.classList.toggle('reacted', !was);
    const rc = btn.querySelector('.rcount');
    if (rc) rc.textContent = Math.max(0, +rc.textContent + (was ? -1 : 1));
  }
  try {
    const { reactions } = await api('POST', `/api/posts/${postId}/react`, { emoji, delta: was ? -1 : 1 });
    // Correct with server truth
    if (btn) btn.querySelector('.rcount').textContent = reactions[emoji] ?? 0;
  } catch (err) {
    // Revert optimistic update
    setReacted(postId, emoji, was);
    if (btn) {
      btn.classList.toggle('reacted', was);
      const rc = btn.querySelector('.rcount');
      if (rc) rc.textContent = Math.max(0, +rc.textContent + (was ? 1 : -1));
    }
    toast(err.message, 'error');
  }
}

// ─── Share (Feature 15: enhanced with post title) ─────────────────────────────
function sharePost(id, title = '') {
  const url   = `${location.origin}${location.pathname}#post=${id}`;
  const label = title
    ? `"${title.slice(0, 40)}${title.length > 40 ? '…' : ''}"`
    : 'post';
  navigator.clipboard.writeText(url)
    .then(() => toast(`Link copied for ${label} ✔`))
    .catch(() => toast('Copy this: ' + url));
}

// ─── Random post (Feature 6) ──────────────────────────────────────────────────
function openRandomPost() {
  if (state.posts.length === 0) { toast('No posts yet!', 'error'); return; }
  openPost(state.posts[Math.floor(Math.random() * state.posts.length)].id);
}

// ─── New Post Form ────────────────────────────────────────────────────────────
document.getElementById('new-post-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const btn = document.getElementById('submit-post-btn');
  btn.disabled = true;
  btn.textContent = 'Spilling...';

  const title    = document.getElementById('post-title').value;
  const content  = document.getElementById('post-content').value;
  const category = document.getElementById('post-category').value;
  const tagsRaw  = document.getElementById('post-tags').value;
  const tags     = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

  try {
    // Upload image first if one was selected
    let imageId = null;
    if (pendingImageFile) {
      btn.textContent = 'Uploading image...';
      try {
        const { url: uploadUrl } = await api('POST', '/api/upload-url', {});
        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': pendingImageFile.type },
          body: pendingImageFile,
        });
        if (!uploadRes.ok) throw new Error('Upload failed');
        const result = await uploadRes.json();
        imageId = result.storageId;
      } catch (imgErr) {
        toast('Image upload failed — posting without image', 'error');
      }
      btn.textContent = 'Spilling...';
    }

    await api('POST', '/api/posts', { title, content, category, tags, imageId });
    closeAllModals();
    this.reset();
    removeImage();
    document.getElementById('title-count').textContent   = '0 / 150';
    document.getElementById('content-count').textContent = '0 / 5000';
    toast('Tea has been spilled! ☕🔥');
    clearDraft();
    spawnConfetti();
    state.filter = { category: 'all', sort: 'new', search: '' };
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === 'new'));
    document.getElementById('search').value = '';
    await loadCategories();
    await loadPosts();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'SPILL IT 🔥';
  }
});

// ─── Submit Comment ───────────────────────────────────────────────────────────
async function submitComment(e, postId) {
  e.preventDefault();
  const form = e.target;
  const btn  = form.querySelector('.comment-submit');
  btn.disabled = true;
  btn.textContent = 'Posting...';

  const content  = form.querySelector('[name="content"]').value;
  const nickRaw  = form.querySelector('[name="nickname"]').value;
  const nickname = nickRaw || 'Anonymous';
  saveNick(nickRaw);

  try {
    const comment = await api('POST', `/api/posts/${postId}/comments`, { content, nickname });
    const list    = document.getElementById(`comment-list-${postId}`);
    const noMsg   = list.querySelector('.no-comments');
    if (noMsg) noMsg.remove();

    const color = avatarColor(comment.nickname);
    const div   = document.createElement('div');
    div.className = 'comment-item new-comment';
    div.innerHTML = `
      <div class="comment-nick">
        <span class="comment-avatar" style="background:${color}"></span>
        ~ ${esc(comment.nickname)}
      </div>
      <div class="comment-body">${esc(comment.content)}</div>
      <div class="comment-footer">
        <span class="comment-time">just now</span>
        <button class="comment-like-btn" onclick="likeComment(event,'${esc(comment.id)}')">
          👍 <span class="like-count">0</span>
        </button>
      </div>`;
    list.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    form.reset();

    const ccount = document.getElementById('comment-char-count');
    if (ccount) ccount.textContent = '0 / 1000';

    const titleEl = document.getElementById(`comments-title-${postId}`);
    if (titleEl) {
      const n = list.querySelectorAll('.comment-item').length;
      titleEl.textContent = `💬 ${n} Comment${n !== 1 ? 's' : ''}`;
    }
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Reply ✉️';
  }
}

// ─── Char counters ────────────────────────────────────────────────────────────
function updateCharCount(elId, len, max) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = `${len} / ${max}`;
  el.className   = 'char-count' + (len >= max * 0.95 ? ' danger' : len >= max * 0.8 ? ' warn' : '');
}
document.getElementById('post-title').addEventListener('input', function() {
  updateCharCount('title-count', this.value.length, 150);
});
document.getElementById('post-content').addEventListener('input', function() {
  updateCharCount('content-count', this.value.length, 5000);
});

// ─── Search (debounced) ───────────────────────────────────────────────────────
let searchTimer;
document.getElementById('search').addEventListener('input', function() {
  clearTimeout(searchTimer);
  state.filter.search = this.value.trim();
  searchTimer = setTimeout(loadPosts, 380);
});

// ─── Sort ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => setSort(btn.dataset.sort));
});

// ─── Modal triggers ───────────────────────────────────────────────────────────
document.getElementById('open-new-post').addEventListener('click', () => { openModal('new-post-modal'); loadDraft(); });
document.getElementById('close-new-post').addEventListener('click', closeAllModals);
document.getElementById('close-post').addEventListener('click', closeAllModals);
document.getElementById('empty-spill').addEventListener('click', () => openModal('new-post-modal'));
document.getElementById('backdrop').addEventListener('click', closeAllModals);

// ─── Keyboard shortcut help modal ────────────────────────────────────────────
function showShortcutHelp() {
  if (document.getElementById('_shortcut-modal')) return;
  const overlay = document.createElement('div');
  overlay.id = '_shortcut-modal';
  overlay.className = 'shortcut-modal-overlay';
  overlay.innerHTML = `
    <div class="shortcut-modal">
      <h2>⌨️ Keyboard Shortcuts</h2>
      <div class="shortcut-row"><span>New post</span><kbd>N</kbd></div>
      <div class="shortcut-row"><span>Focus search</span><kbd>/</kbd></div>
      <div class="shortcut-row"><span>Random post</span><kbd>R</kbd></div>
      <div class="shortcut-row"><span>Toggle bookmarks</span><kbd>B</kbd></div>
      <div class="shortcut-row"><span>Close modal</span><kbd>Esc</kbd></div>
      <div class="shortcut-row"><span>This help</span><kbd>?</kbd></div>
      <button class="shortcut-close-btn" onclick="document.getElementById('_shortcut-modal').remove()">Got it!</button>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ─── Keyboard shortcuts (Features 5 + existing) ───────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const shortcutModal = document.getElementById('_shortcut-modal');
    if (shortcutModal) { shortcutModal.remove(); return; }
    closeAllModals();
    return;
  }
  const active  = document.activeElement;
  const inInput = active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable;
  if (inInput) return;
  if (e.key === 'n' && !openModalId) { openModal('new-post-modal'); return; }
  if (e.key === '/') { e.preventDefault(); document.getElementById('search').focus(); return; }
  if (e.key === 'r' || e.key === 'R') { openRandomPost(); return; }
  if (e.key === 'b' || e.key === 'B') {
    setCategory(state.filter.category === '__bookmarks__' ? 'all' : '__bookmarks__');
    return;
  }
  if (e.key === '?') { showShortcutHelp(); return; }
});

// ─── Hash link (share) ────────────────────────────────────────────────────────
async function checkHash() {
  const m = location.hash.match(/^#post=(.+)/);
  if (m) { history.replaceState(null, '', location.pathname); await openPost(m[1]); }
}

// ─── Auto-refresh ─────────────────────────────────────────────────────────────
setInterval(loadPosts, 30000);

// ─── Init ─────────────────────────────────────────────────────────────────────
(async function init() {
  // Feature 4: restore filter state from URL params
  const params = new URLSearchParams(location.search);
  if (params.has('cat'))  state.filter.category = params.get('cat');
  if (params.has('sort')) state.filter.sort      = params.get('sort');
  if (params.has('q'))    { state.filter.search  = params.get('q'); document.getElementById('search').value = params.get('q'); }

  // Sync sort buttons to restored state
  document.querySelectorAll('.sort-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.sort === state.filter.sort)
  );

  await Promise.all([loadCategories(), loadPosts()]);
  renderRecentlyViewed();
  await checkHash();
})();
