'use strict';
require('dotenv').config();

const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');

const CONVEX_URL = process.env.CONVEX_URL;

// Convex stores reactions with ASCII keys; convert back to emoji for the frontend.
const KEY_TO_EMOJI = { fire: '🔥', scream: '😱', coffee: '☕', skull: '💀', eyes: '👀' };
function toEmojiReactions(r) {
  const out = {};
  for (const [k, v] of Object.entries(r)) out[KEY_TO_EMOJI[k] ?? k] = v;
  return out;
}
function normalizeConvexPost(post) {
  return { ...post, reactions: toEmojiReactions(post.reactions) };
}

// ─── Convex HTTP helpers ──────────────────────────────────────────────────────
// Used when CONVEX_URL is set in .env. Calls your deployed Convex functions.

async function convexQuery(funcPath, args = {}) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: funcPath, args, format: 'json' }),
  });
  const data = await res.json();
  if (data.status !== 'success') throw new Error(data.errorMessage || 'Convex query failed');
  return data.value;
}

async function convexMutation(funcPath, args = {}) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: funcPath, args, format: 'json' }),
  });
  const data = await res.json();
  if (data.status !== 'success') throw new Error(data.errorMessage || 'Convex mutation failed');
  return data.value;
}

// ─── JSON file fallback ───────────────────────────────────────────────────────
// Used when CONVEX_URL is not set. Data lives in data/db.json.

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH  = path.join(DATA_DIR, 'db.json');
if (!CONVEX_URL) fs.mkdirSync(DATA_DIR, { recursive: true });

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    const initial = { posts: [], comments: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial));
    return initial;
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data));
}

const CATEGORIES = [
  { id: 'general',       label: '📣 General' },
  { id: 'school',        label: '🏫 School' },
  { id: 'drama',         label: '💔 Drama' },
  { id: 'relationships', label: '💑 Relationships' },
  { id: 'work',          label: '💼 Work' },
  { id: 'social',        label: '🎉 Social' },
  { id: 'online',        label: '📱 Online' },
];
const CATEGORY_IDS = new Set(CATEGORIES.map(c => c.id));

function postScore(post, commentCount) {
  return Object.values(post.reactions).reduce((s, v) => s + v, 0) * 2 + commentCount;
}

// ─── Storage API ──────────────────────────────────────────────────────────────
// All functions are async so they work the same way whether using Convex or JSON.

module.exports = {

  async getPosts({ category, sort, search } = {}) {
    if (CONVEX_URL) {
      const posts = await convexQuery('posts:list', { category, sort, search });
      return posts.map(normalizeConvexPost);
    }

    const db = readDB();
    const commentCounts = new Map();
    for (const c of db.comments) {
      commentCounts.set(c.postId, (commentCounts.get(c.postId) || 0) + 1);
    }

    let posts = db.posts.map(p => ({
      ...p,
      commentCount: commentCounts.get(p.id) || 0,
    }));

    if (category && category !== 'all')
      posts = posts.filter(p => p.category === category);

    if (search) {
      const q = search.toLowerCase();
      posts = posts.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    if (sort === 'hot') {
      posts.sort((a, b) => postScore(b, b.commentCount) - postScore(a, a.commentCount));
    } else {
      posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return posts;
  },

  async getPost(id) {
    if (CONVEX_URL) {
      const post = await convexQuery('posts:get', { id });
      return post ? normalizeConvexPost(post) : null;
    }

    const db = readDB();
    const post = db.posts.find(p => p.id === id);
    if (!post) return null;
    const comments = db.comments
      .filter(c => c.postId === id)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return { ...post, commentCount: comments.length, comments };
  },

  async createPost({ title, content, category, tags }) {
    if (CONVEX_URL) {
      const post = await convexMutation('posts:create', { title, content, category, tags });
      return normalizeConvexPost(post);
    }

    const db = readDB();
    const post = {
      id: crypto.randomUUID(),
      title: title.trim().slice(0, 150),
      content: content.trim().slice(0, 5000),
      category: CATEGORY_IDS.has(category) ? category : 'general',
      tags: Array.isArray(tags)
        ? tags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim().slice(0, 30)).slice(0, 5)
        : [],
      reactions: { '🔥': 0, '😱': 0, '☕': 0, '💀': 0, '👀': 0 },
      createdAt: new Date().toISOString(),
    };
    db.posts.unshift(post);
    writeDB(db);
    return { ...post, commentCount: 0 };
  },

  async reactToPost(id, emoji, delta) {
    if (CONVEX_URL) {
      const result = await convexMutation('posts:react', { id, emoji, delta });
      return { reactions: toEmojiReactions(result.reactions) };
    }

    const db = readDB();
    const post = db.posts.find(p => p.id === id);
    if (!post) return null;
    const d = delta === -1 ? -1 : 1;
    post.reactions[emoji] = Math.max(0, (post.reactions[emoji] || 0) + d);
    writeDB(db);
    return { reactions: post.reactions };
  },

  async createComment(postId, { content, nickname }) {
    if (CONVEX_URL) {
      return convexMutation('comments:create', { postId, content, nickname });
    }

    const db = readDB();
    const post = db.posts.find(p => p.id === postId);
    if (!post) return null;
    const comment = {
      id: crypto.randomUUID(),
      postId,
      content: content.trim().slice(0, 1000),
      nickname: (typeof nickname === 'string' && nickname.trim())
        ? nickname.trim().slice(0, 30)
        : 'Anonymous',
      createdAt: new Date().toISOString(),
    };
    db.comments.push(comment);
    writeDB(db);
    return comment;
  },

  async deletePost(id) {
    if (CONVEX_URL) {
      return convexMutation('posts:remove', { id });
    }

    const db = readDB();
    const idx = db.posts.findIndex(p => p.id === id);
    if (idx === -1) return null;
    db.posts.splice(idx, 1);
    db.comments = db.comments.filter(c => c.postId !== id);
    writeDB(db);
    return { ok: true };
  },

  async getCategories() {
    if (CONVEX_URL) {
      return convexQuery('posts:categories', {});
    }

    const db = readDB();
    return CATEGORIES.map(c => ({
      ...c,
      count: db.posts.filter(p => p.category === c.id).length,
    }));
  },
};
