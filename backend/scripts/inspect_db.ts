import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";
import Conversation from "../src/models/Conversation.js";

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI || "");
  console.log("Connected to MongoDB");

  const users = await User.find({}).limit(10);
  console.log("USERS:", JSON.stringify(users, null, 2));

  const conversations = await Conversation.find({}).limit(10);
  console.log("CONVERSATIONS:", JSON.stringify(conversations, null, 2));

  await mongoose.disconnect();
}

main().catch(console.error);
