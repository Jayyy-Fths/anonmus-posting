import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";

const CATEGORIES = [
  { id: "general",       label: "📣 General" },
  { id: "school",        label: "🏫 School" },
  { id: "drama",         label: "💔 Drama" },
  { id: "relationships", label: "💑 Relationships" },
  { id: "work",          label: "💼 Work" },
  { id: "social",        label: "🎉 Social" },
  { id: "online",        label: "📱 Online" },
];
const CATEGORY_IDS = new Set(CATEGORIES.map(c => c.id));
const VALID_EMOJIS = new Set(["🔥", "😱", "☕", "💀", "👀"]);

// Convex field names must be ASCII — map emoji ↔ storage keys
const EMOJI_TO_KEY: Record<string, string> = {
  "🔥": "fire", "😱": "scream", "☕": "coffee", "💀": "skull", "👀": "eyes",
};

const DEFAULT_REACTIONS = { fire: 0, scream: 0, coffee: 0, skull: 0, eyes: 0 };

// Normalize a Convex doc — reactions use ASCII keys (fire/scream/coffee/skull/eyes)
// The Node.js layer in storage.js converts them back to emoji for the frontend.
function normalize(post: Doc<"posts">, commentCount = 0, imageUrl: string | null = null) {
  return {
    id:           post._id,
    title:        post.title,
    content:      post.content,
    category:     post.category,
    tags:         post.tags,
    reactions:    post.reactions,
    createdAt:    new Date(post._creationTime).toISOString(),
    commentCount,
    views:        post.views  ?? 0,
    pinned:       post.pinned ?? false,
    flags:        post.flags  ?? 0,
    imageUrl,
  };
}

// GET /api/posts
export const list = query({
  args: {
    category: v.optional(v.string()),
    sort:     v.optional(v.string()),
    search:   v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allComments = await ctx.db.query("comments").collect();
    const commentCounts = new Map<string, number>();
    for (const c of allComments) {
      const key = c.postId.toString();
      commentCounts.set(key, (commentCounts.get(key) || 0) + 1);
    }

    let posts = await ctx.db.query("posts").collect();

    if (args.category && args.category !== "all") {
      posts = posts.filter(p => p.category === args.category);
    }

    if (args.search) {
      const q = args.search.toLowerCase();
      posts = posts.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    let results = await Promise.all(posts.map(async p => {
      const imageUrl = p.imageId ? await ctx.storage.getUrl(p.imageId) : null;
      return normalize(p, commentCounts.get(p._id.toString()) || 0, imageUrl);
    }));

    if (args.sort === "hot") {
      const score = (p: ReturnType<typeof normalize>) =>
        Object.values(p.reactions as Record<string, number>).reduce((s, v) => s + v, 0) * 2 + p.commentCount;
      results.sort((a, b) => score(b) - score(a));
    } else if (args.sort === "views") {
      results.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    } else {
      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Pinned posts always float to the top
    results = [
      ...results.filter(p => p.pinned),
      ...results.filter(p => !p.pinned),
    ];

    return results;
  },
});

// GET /api/posts/:id
export const get = query({
  args: { id: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post) return null;

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_post", q => q.eq("postId", args.id))
      .collect();

    const normalizedComments = comments
      .sort((a, b) => a._creationTime - b._creationTime)
      .map(c => ({
        id:        c._id,
        postId:    c.postId,
        content:   c.content,
        nickname:  c.nickname,
        createdAt: new Date(c._creationTime).toISOString(),
        likes:     c.likes ?? 0,
      }));

    const imageUrl = post.imageId ? await ctx.storage.getUrl(post.imageId) : null;
    return {
      ...normalize(post, normalizedComments.length, imageUrl),
      comments: normalizedComments,
    };
  },
});

// POST /api/posts
export const create = mutation({
  args: {
    title:    v.string(),
    content:  v.string(),
    category: v.string(),
    tags:     v.array(v.string()),
    imageId:  v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("posts", {
      title:    args.title.trim().slice(0, 150),
      content:  args.content.trim().slice(0, 5000),
      category: CATEGORY_IDS.has(args.category) ? args.category : "general",
      tags:     args.tags.map(t => t.trim().slice(0, 30)).slice(0, 5),
      reactions: { ...DEFAULT_REACTIONS },
      imageId:  args.imageId,
    });
    const post = (await ctx.db.get(id))!;
    const imageUrl = post.imageId ? await ctx.storage.getUrl(post.imageId) : null;
    return { ...normalize(post, 0, imageUrl), commentCount: 0 };
  },
});

// POST /api/posts/:id/react
export const react = mutation({
  args: {
    id:    v.id("posts"),
    emoji: v.string(),
    delta: v.number(),
  },
  handler: async (ctx, args) => {
    if (!VALID_EMOJIS.has(args.emoji)) throw new Error("Invalid emoji");
    const post = await ctx.db.get(args.id);
    if (!post) throw new Error("Post not found");

    const key = EMOJI_TO_KEY[args.emoji] as keyof typeof post.reactions;
    if (!key) throw new Error("Invalid emoji");
    const reactions = { ...post.reactions };
    const d = args.delta === -1 ? -1 : 1;
    reactions[key] = Math.max(0, (reactions[key] || 0) + d);
    await ctx.db.patch(args.id, { reactions });
    // Return ASCII keys — storage.js converts to emoji
    return { reactions };
  },
});

// DELETE /api/posts/:id
export const remove = mutation({
  args: { id: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post) throw new Error("Post not found");
    if (post.imageId) await ctx.storage.delete(post.imageId);
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_post", q => q.eq("postId", args.id))
      .collect();
    for (const c of comments) await ctx.db.delete(c._id);
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

// POST /api/upload-url  — returns a Convex storage upload URL
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// POST /api/posts/:id/view
export const incrementView = mutation({
  args: { id: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post) throw new Error("Post not found");
    const views = (post.views ?? 0) + 1;
    await ctx.db.patch(args.id, { views });
    return { views };
  },
});

// POST /api/posts/:id/pin  (admin)
export const pin = mutation({
  args: { id: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post) throw new Error("Post not found");
    const pinned = !(post.pinned ?? false);
    await ctx.db.patch(args.id, { pinned });
    return { pinned };
  },
});

// POST /api/posts/:id/flag
export const flag = mutation({
  args: { id: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post) throw new Error("Post not found");
    const flags = (post.flags ?? 0) + 1;
    await ctx.db.patch(args.id, { flags });
    return { flags, title: post.title };
  },
});

// GET /api/categories
export const categories = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("posts").collect();
    return CATEGORIES.map(c => ({
      ...c,
      count: posts.filter(p => p.category === c.id).length,
    }));
  },
});
