import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant", "tool"], required: true },
  content: { type: String, required: true },
  toolCall: String,
  timestamp: { type: Date, default: Date.now },
});

const conversationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  messages: [messageSchema],
  updatedAt: { type: Date, default: Date.now },
}, { collection: "astro_conversations" });

const Conversation = mongoose.model("Conversation", conversationSchema);

export { Conversation };
export default Conversation;