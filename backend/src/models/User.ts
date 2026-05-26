import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  birthDetails: {
    date: String,
    time: String,
    place: String,
    lat: Number,
    lng: Number,
    timezone: String,
  },
  createdAt: { type: Date, default: Date.now },
}, { collection: "astro_users" });

const User = mongoose.model("User", userSchema);

export { User };
export default User;