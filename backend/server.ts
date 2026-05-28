import dotenv from "dotenv";
import app from "./src/app.js";
import connectDb from "./src/config/db.js";

dotenv.config();
connectDb();

const PORT = process.env.PORT ?? 8000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
