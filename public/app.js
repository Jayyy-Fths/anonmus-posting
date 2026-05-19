'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  posts: [],
  filter: { category: 'all', sort: 'new', search: '' },
};

// ─── Admin mode ───────────────────────────────────────────────────────────────
let adminMode = sessionStorage.getItem('anontea_admin') === '1';

function toggleAdminMode() {
  if (adminMode) {
    adminMode = false;
    sessionStorage.removeItem('anontea_admin');
    sessionStorage.removeItem('anontea_admin_secret');
    document.getElementById('admin-toggle').classList.remove('active');
    toast('Admin mode off');
    loadPosts();
    return;
  }
  const secret = prompt('Admin password:');
  if (!secret) return;
  sessionStorage.setItem('anontea_admin_secret', secret);
  sessionStorage.setItem('anontea_admin', '1');
  adminMode = true;
  document.getElementById('admin-toggle').classList.add('active');
  toast('Admin mode on — trash buttons visible');
  loadPosts();
}

async function deletePost(e, postId) {
  e.stopPropagation();
  if (!confirm('Delete this post permanently? This cannot be undone.')) return;
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

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
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
}

// ─── Category labels ──────────────────────────────────────────────────────────
const CAT_LABEL = {
  general: '📣 General', school: '🏫 School', drama: '💔 Drama',
  relationships: '💑 Relationships', work: '💼 Work', social: '🎉 Social', online: '📱 Online',
};

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

  const newBadge = isNew(post.createdAt)
    ? `<span class="post-card-new-badge">NEW</span>` : '';

  const adminDelete = adminMode
    ? `<div class="admin-actions" onclick="event.stopPropagation()">
        <button class="admin-delete-btn" onclick="deletePost(event,'${esc(post.id)}')">🗑️ Delete post</button>
       </div>`
    : '';

  return `
    <article class="post-card" onclick="openPost('${esc(post.id)}')">
      ${newBadge}
      <div class="post-card-top">
        <span class="cat-badge">${esc(CAT_LABEL[post.category] || post.category)}</span>
        ${tags}
      </div>
      <div class="post-card-title">${esc(post.title)}</div>
      <div class="post-card-snippet">${esc(post.content)}</div>
      <div class="post-card-footer">
        <div class="post-reactions">${pills}</div>
        <div class="post-meta">
          <span>💬 ${post.commentCount}</span>
          <span>${timeAgo(post.createdAt)}</span>
        </div>
      </div>
      ${adminDelete}
    </article>`;
}

// ─── Load Posts ───────────────────────────────────────────────────────────────
async function loadPosts() {
  const grid = document.getElementById('posts-grid');
  const empty = document.getElementById('empty-state');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div> Brewing the tea...</div>';
  empty.classList.add('hidden');

  try {
    const params = new URLSearchParams({ category: state.filter.category, sort: state.filter.sort });
    if (state.filter.search) params.set('search', state.filter.search);
    state.posts = await api('GET', `/api/posts?${params}`);

    if (state.posts.length === 0) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      grid.innerHTML = state.posts.map(renderCard).join('');
    }
    renderHot();
    renderTicker();
  } catch {
    grid.innerHTML = '<div class="loading">Could not load posts. Is the server running?</div>';
  }
}

// ─── Hot Section ─────────────────────────────────────────────────────────────
function hotScore(p) {
  return Object.values(p.reactions).reduce((s, v) => s + v, 0) * 2 + p.commentCount;
}

function renderHot() {
  const sec = document.getElementById('hot-section');
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

// ─── Load Categories ──────────────────────────────────────────────────────────
async function loadCategories() {
  try {
    const cats = await api('GET', '/api/categories');
    const container = document.getElementById('categories');
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn';
      btn.dataset.cat = cat.id;
      btn.textContent = cat.count > 0 ? `${cat.label} (${cat.count})` : cat.label;
      btn.addEventListener('click', () => setCategory(cat.id));
      container.appendChild(btn);
    });
  } catch {}
}

function setCategory(cat) {
  state.filter.category = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  loadPosts();
}

function setSort(sort) {
  state.filter.sort = sort;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === sort));
  loadPosts();
}

// ─── React from card ──────────────────────────────────────────────────────────
async function reactCard(e, postId, emoji) {
  e.stopPropagation();
  const was = hasReacted(postId, emoji);
  setReacted(postId, emoji, !was);
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
  try {
    const post = await api('GET', `/api/posts/${id}`);
    renderPostDetail(post);
  } catch {
    area.innerHTML = '<div class="loading">Could not load this post.</div>';
  }
}

// ─── Render Post Detail ───────────────────────────────────────────────────────
function renderPostDetail(post) {
  const area = document.getElementById('post-content-area');

  const tags = (post.tags || []).map(t => `<span class="tag-badge">#${esc(t)}</span>`).join('');

  const reactBtns = Object.entries(post.reactions).map(([emoji, count]) => {
    const r = hasReacted(post.id, emoji);
    const btnId = `rbl-${post.id}-${emoji.codePointAt(0)}`;
    return `<button class="reaction-btn-large${r ? ' reacted' : ''}" id="${btnId}"
      onclick="reactDetail('${esc(post.id)}','${emoji}')">
      ${emoji} <span class="rcount">${count}</span>
    </button>`;
  }).join('');

  const commentsHtml = post.comments.length === 0
    ? `<div class="no-comments">No comments yet — be the first to reply!</div>`
    : post.comments.map(c => `
        <div class="comment-item">
          <div class="comment-nick">~ ${esc(c.nickname)}</div>
          <div class="comment-body">${esc(c.content)}</div>
          <div class="comment-time">${timeAgo(c.createdAt)}</div>
        </div>`).join('');

  area.innerHTML = `
    <div class="post-detail">
      <div class="post-detail-meta">
        <span class="cat-badge">${esc(CAT_LABEL[post.category] || post.category)}</span>
        ${tags}
        <span class="post-detail-time">${timeAgo(post.createdAt)}</span>
      </div>
      <h1 class="post-detail-title">${esc(post.title)}</h1>
      <div class="post-detail-body">${esc(post.content)}</div>

      <div class="post-detail-reactions">
        ${reactBtns}
        <button class="share-btn" onclick="sharePost('${esc(post.id)}')">🔗 Share</button>
        ${adminMode ? `<button class="admin-delete-detail-btn" onclick="deletePost(event,'${esc(post.id)}')">🗑️ Delete post</button>` : ''}
      </div>

      <div class="comments-section">
        <h3 class="comments-title" id="comments-title-${esc(post.id)}">💬 ${post.comments.length} Comment${post.comments.length !== 1 ? 's' : ''}</h3>
        <div class="comment-list" id="comment-list-${esc(post.id)}">${commentsHtml}</div>
        <form class="comment-form" onsubmit="submitComment(event,'${esc(post.id)}')">
          <div class="comment-form-row">
            <input type="text" name="nickname" placeholder="Nickname (optional)" maxlength="30" autocomplete="off" />
            <textarea name="content" placeholder="Add your two cents..." maxlength="1000" required rows="2"></textarea>
          </div>
          <button type="submit" class="comment-submit">Reply ✉️</button>
        </form>
      </div>
    </div>`;
}

// ─── React in detail view ─────────────────────────────────────────────────────
async function reactDetail(postId, emoji) {
  const was = hasReacted(postId, emoji);
  setReacted(postId, emoji, !was);
  const btnId = `rbl-${postId}-${emoji.codePointAt(0)}`;
  const btn = document.getElementById(btnId);
  try {
    const { reactions } = await api('POST', `/api/posts/${postId}/react`, { emoji, delta: was ? -1 : 1 });
    if (btn) {
      btn.querySelector('.rcount').textContent = reactions[emoji];
      btn.classList.toggle('reacted', !was);
    }
  } catch (err) {
    setReacted(postId, emoji, was);
    toast(err.message, 'error');
  }
}

// ─── Share ────────────────────────────────────────────────────────────────────
function sharePost(id) {
  const url = `${location.origin}${location.pathname}#post=${id}`;
  navigator.clipboard.writeText(url)
    .then(() => toast('Link copied! ✔'))
    .catch(() => toast('Copy this: ' + url));
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
    await api('POST', '/api/posts', { title, content, category, tags });
    closeAllModals();
    this.reset();
    document.getElementById('title-count').textContent = '0 / 150';
    document.getElementById('content-count').textContent = '0 / 5000';
    toast('Tea has been spilled! ☕🔥');
    state.filter = { category: 'all', sort: 'new', search: '' };
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === 'new'));
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === 'all'));
    document.getElementById('search').value = '';
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
  const nickname = form.querySelector('[name="nickname"]').value || 'Anonymous';

  try {
    const comment = await api('POST', `/api/posts/${postId}/comments`, { content, nickname });
    const list = document.getElementById(`comment-list-${postId}`);
    const noMsg = list.querySelector('.no-comments');
    if (noMsg) noMsg.remove();

    const div = document.createElement('div');
    div.className = 'comment-item new-comment';
    div.innerHTML = `
      <div class="comment-nick">~ ${esc(comment.nickname)}</div>
      <div class="comment-body">${esc(comment.content)}</div>
      <div class="comment-time">just now</div>`;
    list.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    form.reset();

    const title = document.getElementById(`comments-title-${postId}`);
    if (title) {
      const n = list.querySelectorAll('.comment-item').length;
      title.textContent = `💬 ${n} Comment${n !== 1 ? 's' : ''}`;
    }
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Reply ✉️';
  }
}

// ─── Char counters ────────────────────────────────────────────────────────────
document.getElementById('post-title').addEventListener('input', function() {
  document.getElementById('title-count').textContent = `${this.value.length} / 150`;
});
document.getElementById('post-content').addEventListener('input', function() {
  document.getElementById('content-count').textContent = `${this.value.length} / 5000`;
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
document.getElementById('open-new-post').addEventListener('click', () => openModal('new-post-modal'));
document.getElementById('close-new-post').addEventListener('click', closeAllModals);
document.getElementById('close-post').addEventListener('click', closeAllModals);
document.getElementById('empty-spill').addEventListener('click', () => openModal('new-post-modal'));
document.getElementById('backdrop').addEventListener('click', closeAllModals);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });
document.addEventListener('keydown', e => {
  if (e.key === 'n' && !openModalId && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    openModal('new-post-modal');
  }
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
  await Promise.all([loadCategories(), loadPosts()]);
  await checkHash();
})();
