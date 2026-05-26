import express from "express"
import type { Request, Response } from "express";
import AstroRouter from "./routes/astro.js";

const app = express()
app.use(express.json())
app.get("/health", (req:Request, res:Response) => {
    res.json({
        message:"Server is running"
    })
})

app.use("/api",AstroRouter)


export default app