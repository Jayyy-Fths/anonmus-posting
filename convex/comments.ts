import { mutation } from "./_generated/server";
import { v } from "convex/values";

// POST /api/posts/:id/comments
export const create = mutation({
  args: {
    postId:   v.id("posts"),
    content:  v.string(),
    nickname: v.string(),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");

    const id = await ctx.db.insert("comments", {
      postId:   args.postId,
      content:  args.content.trim().slice(0, 1000),
      nickname: args.nickname.trim().slice(0, 30) || "Anonymous",
    });

    const comment = (await ctx.db.get(id))!;
    return {
      id:        comment._id,
      postId:    comment.postId,
      content:   comment.content,
      nickname:  comment.nickname,
      createdAt: new Date(comment._creationTime).toISOString(),
    };
  },
});
