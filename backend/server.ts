import dotenv from "dotenv"
import app from "./src/app.js";
import connectDb from "./src/config/db.js";

dotenv.config()
connectDb()

app.listen(8000, () => {
    console.log("Server is running on port 8000")
})