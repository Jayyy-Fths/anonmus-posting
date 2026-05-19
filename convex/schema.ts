import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  posts: defineTable({
    title:    v.string(),
    content:  v.string(),
    category: v.string(),
    tags:     v.array(v.string()),
    reactions: v.object({
      fire:   v.number(),
      scream: v.number(),
      coffee: v.number(),
      skull:  v.number(),
      eyes:   v.number(),
    }),
    views:   v.optional(v.number()),
    pinned:  v.optional(v.boolean()),
    flags:   v.optional(v.number()),
    imageId: v.optional(v.id("_storage")),
  }),

  comments: defineTable({
    postId:   v.id("posts"),
    content:  v.string(),
    nickname: v.string(),
    likes:    v.optional(v.number()),
  }).index("by_post", ["postId"]),
});
