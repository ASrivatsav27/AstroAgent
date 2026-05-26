import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import AstroRouter from "./routes/astro.js";

const app = express();

app.use(
    cors({
        origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
        credentials: true,
    })
);
app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
    res.json({
        message: "Server is running",
    });
});

app.use("/api", AstroRouter);


export default app;