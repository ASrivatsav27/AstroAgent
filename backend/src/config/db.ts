import mongoose from "mongoose";
import config from "./config.js";

const connectDb = async () => {
    try {
        await mongoose.connect(config.mongoUri);
        console.log("Database Connected");
    } catch (error) {
        console.error("Database connection error", error);
        throw error;
    }
};

export default connectDb;