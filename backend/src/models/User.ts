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
  chartData: {
    planets: [
      {
        planet: String,
        sign: String,
        degree: Number,
        house: Number,
      },
    ],
    ascendant: String,
    houses: [String],
    rawData: mongoose.Schema.Types.Mixed,
  },
  createdAt: { type: Date, default: Date.now },
}, { collection: "astro_users" });

const User = mongoose.model("User", userSchema);

export { User };
export default User;