'use strict';
require('dotenv').config();
const express = require('express');
const path    = require('path');
const storage = require('./storage');

const app  = express();
const PORT = process.env.PORT || 4000;

const VALID_EMOJIS = new Set(['🔥', '😱', '☕', '💀', '👀']);
const CATEGORY_IDS = new Set(['general', 'school', 'drama', 'relationships', 'work', 'social', 'online']);

// ─── Rate limiting ────────────────────────────────────────────────────────────
const rateLimits = new Map();
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [key, entry] of rateLimits) {
    if (entry.start < cutoff) rateLimits.delete(key);
  }
}, 300000);

function checkRate(ip, action, max) {
  const key = `${ip}|${action}`;
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now - entry.start > 60000) {
    rateLimits.set(key, { count: 1, start: now });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/posts', async (req, res) => {
  try {
    const posts = await storage.getPosts(req.query);
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/posts', async (req, res) => {
  if (!checkRate(req.ip, 'post', 5))
    return res.status(429).json({ error: 'Slow down — max 5 posts per minute' });

  const { title, content, category, tags } = req.body;
  if (typeof title !== 'string' || !title.trim())
    return res.status(400).json({ error: 'Title is required' });
  if (typeof content !== 'string' || !content.trim())
    return res.status(400).json({ error: 'Content is required' });

  try {
    const post = await storage.createPost({
      title,
      content,
      category: CATEGORY_IDS.has(category) ? category : 'general',
      tags: Array.isArray(tags)
        ? tags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim().slice(0, 30)).slice(0, 5)
        : [],
    });
    res.status(201).json(post);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/posts/:id', async (req, res) => {
  try {
    const post = await storage.getPost(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    res.json(post);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/posts/:id/react', async (req, res) => {
  if (!checkRate(req.ip, 'react', 60))
    return res.status(429).json({ error: 'Too many reactions' });

  const { emoji, delta } = req.body;
  if (!VALID_EMOJIS.has(emoji))
    return res.status(400).json({ error: 'Invalid emoji' });

  try {
    const result = await storage.reactToPost(req.params.id, emoji, delta);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/posts/:id/comments', async (req, res) => {
  if (!checkRate(req.ip, 'comment', 10))
    return res.status(429).json({ error: 'Slow down — max 10 comments per minute' });

  const { content, nickname } = req.body;
  if (typeof content !== 'string' || !content.trim())
    return res.status(400).json({ error: 'Comment cannot be empty' });

  try {
    const comment = await storage.createComment(req.params.id, {
      content,
      nickname: typeof nickname === 'string' ? nickname : 'Anonymous',
    });
    if (!comment) return res.status(404).json({ error: 'Post not found' });
    res.status(201).json(comment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    res.json(await storage.getCategories());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  const mode = process.env.CONVEX_URL ? '☁️  Convex' : '📁  local JSON';
  console.log(`\n  ☕  ANON.TEA  →  http://localhost:${PORT}  (${mode})\n`);
});
