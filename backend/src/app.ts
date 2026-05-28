import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import AstroRouter from "./routes/astro.js";

const app = express();

const allowedOrigins = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  // Vercel deployments
  /^https:\/\/.*\.vercel\.app$/,
  // Netlify deployments
  /^https:\/\/.*\.netlify\.app$/,
  // Render deployments
  /^https:\/\/.*\.onrender\.com$/,
  // Railway deployments
  /^https:\/\/.*\.railway\.app$/,
  // Custom domain — set FRONTEND_URL env var to override
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, same-origin SSR)
      if (!origin) return callback(null, true);
      const allowed = allowedOrigins.some((pattern) =>
        pattern instanceof RegExp ? pattern.test(origin) : pattern === origin
      );
      if (allowed) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", AstroRouter);

export default app;
