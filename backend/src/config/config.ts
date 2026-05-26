import "dotenv/config";

const config = {
	port: Number(process.env.PORT ?? 8000),
    mongoUri: process.env.MONGO_URI ?? "",
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "",
};

if (!config.mongoUri) {
	throw new Error("MONGO_URI is not set");
}

export default config;

