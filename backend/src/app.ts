import express from "express"
import type { Request ,Response} from "express";
const app = express()

app.get("/health", (req:Request, res:Response) => {
    res.json({
        message:"Server is running"
    })
})




export default app