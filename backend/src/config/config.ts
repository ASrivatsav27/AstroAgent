import "dotenv/config";

const config = {
	port: Number(process.env.PORT ?? 8000),
    mongoUri: process.env.MONGO_URI ?? "",
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "",
    OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
    MODEL: "openai/gpt-oss-20b:free",
};
console.log("API KEY:", config.OPENROUTER_API_KEY);
console.log(config.MODEL)
if (!config.mongoUri) {
	throw new Error("MONGO_URI is not set");
}

export default config;

