import express from "express";
import {
	birthChartController,
	chatController,
	chatStreamController,
	saveBirthDetails,
	getUser,
	getConversation,
} from "../controllers/astro.controller.js";

const AstroRouter = express.Router();

AstroRouter.post("/birth-chart", birthChartController);
AstroRouter.post("/chat", chatController);
AstroRouter.post("/chat/stream", chatStreamController);
AstroRouter.post("/user/birth-details", saveBirthDetails);
AstroRouter.get("/user/:userId", getUser);
AstroRouter.get("/conversation/:userId", getConversation);

export default AstroRouter;