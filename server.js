'use strict';
require('dotenv').config();
const express    = require('express');
const path       = require('path');
const nodemailer = require('nodemailer');
const storage    = require('./storage');

// ─── Email alert ──────────────────────────────────────────────────────────────
let _mailer = null;
function getMailer() {
  if (!_mailer) {
    _mailer = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return _mailer;
}

async function sendEmailAlert(postTitle, postId) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  const to = process.env.ALERT_EMAIL || process.env.EMAIL_USER;
  try {
    await getMailer().sendMail({
      from: `"ANON.TEA" <${process.env.EMAIL_USER}>`,
      to,
      subject: `🚩 Report on ANON.TEA: "${postTitle}"`,
      html: `
        <div style="font-family:sans-serif;max-width:480px">
          <h2 style="color:#ff2d78">🚩 Post Reported</h2>
          <p>Someone flagged a post on <strong>ANON.TEA</strong>.</p>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:6px 0;color:#888">Post title</td><td style="padding:6px 0"><strong>${postTitle}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#888">Post ID</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${postId}</td></tr>
          </table>
          <p style="margin-top:20px;color:#888;font-size:12px">Log in as admin and delete it if it violates your rules.</p>
        </div>`,
    });
    console.log(`[ANON.TEA] Report email sent for post: "${postTitle}"`);
  } catch (err) {
    console.error('[ANON.TEA] Email alert failed:', err.message);
  }
}

const app  = express();
const PORT = process.env.PORT || 4000;

const VALID_EMOJIS = new Set(['🔥', '😱', '☕', '💀', '👀']);
const CATEGORY_IDS = new Set(['general', 'school', 'drama', 'relationships', 'work', 'social', 'online']);

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Upstash Redis when UPSTASH_REDIS_REST_URL is set (Vercel / serverless).
// Falls back to an in-memory Map for local dev.
const rateLimits = new Map();
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [key, entry] of rateLimits) {
    if (entry.start < cutoff) rateLimits.delete(key);
  }
}, 300000);

let _redis = null;
function getRedis() {
  if (!_redis) {
    const { Redis } = require('@upstash/redis');
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

async function checkRate(ip, action, max) {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const redis = getRedis();
    const key = `rl:${ip}:${action}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    return count <= max;
  }
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

app.post('/api/upload-url', async (req, res) => {
  try {
    const uploadUrl = await storage.generateUploadUrl();
    if (!uploadUrl) return res.status(503).json({ error: 'Image uploads require Convex backend' });
    res.json({ url: uploadUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/posts', async (req, res) => {
  if (!await checkRate(req.ip, 'post', 5))
    return res.status(429).json({ error: 'Slow down — max 5 posts per minute' });

  const { title, content, category, tags, imageId } = req.body;
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
      imageId: typeof imageId === 'string' ? imageId : undefined,
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
  if (!await checkRate(req.ip, 'react', 60))
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
  if (!await checkRate(req.ip, 'comment', 10))
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

app.delete('/api/posts/:id', async (req, res) => {
  const auth = req.headers.authorization;
  if (!process.env.ADMIN_SECRET || auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const result = await storage.deletePost(req.params.id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/posts/:id/view', async (req, res) => {
  try {
    const result = await storage.incrementView(req.params.id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/posts/:id/pin', async (req, res) => {
  const auth = req.headers.authorization;
  if (!process.env.ADMIN_SECRET || auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const result = await storage.pinPost(req.params.id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/posts/:id/flag', async (req, res) => {
  if (!await checkRate(req.ip, 'flag', 5))
    return res.status(429).json({ error: 'Too many reports' });
  try {
    const result = await storage.flagPost(req.params.id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    // Fire-and-forget email — don't let a mail failure block the response
    sendEmailAlert(result.title || 'Unknown post', req.params.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/comments/:id/like', async (req, res) => {
  if (!await checkRate(req.ip, 'like', 30))
    return res.status(429).json({ error: 'Too many likes' });
  try {
    const result = await storage.likeComment(req.params.id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
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

// Local dev: start the server directly. Vercel: export app as a handler.
if (require.main === module) {
  app.listen(PORT, () => {
    const mode = process.env.CONVEX_URL ? '☁️  Convex' : '📁  local JSON';
    console.log(`\n  ☕  ANON.TEA  →  http://localhost:${PORT}  (${mode})\n`);
  });
}

module.exports = app;
