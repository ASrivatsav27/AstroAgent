import express from "express";
import {birthChartController,chatController} from"../controllers/astro.controller.js"

const AstroRouter = express.Router()

AstroRouter.post("/birth-chart", birthChartController)
AstroRouter.post("/chat",chatController)




export default AstroRouter