import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  posts: defineTable({
    title:    v.string(),
    content:  v.string(),
    category: v.string(),
    tags:     v.array(v.string()),
    reactions: v.record(v.string(), v.number()),
  }),

  comments: defineTable({
    postId:   v.id("posts"),
    content:  v.string(),
    nickname: v.string(),
  }).index("by_post", ["postId"]),
});
