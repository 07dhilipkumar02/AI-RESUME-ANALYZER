import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(5000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  // Comma-separated models tried in order when the main model is busy.
  GEMINI_FALLBACK_MODELS: z.string().default("gemini-3.5-flash-lite"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-2"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().min(128).max(3072).default(768),
  VECTOR_INDEX_NAME: z.string().default("job_vector_index"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`Invalid environment configuration:\n${problems}\nCopy .env.example to .env and fill it in.`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  clientOrigins: parsed.data.CLIENT_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean),
  fallbackModels: parsed.data.GEMINI_FALLBACK_MODELS.split(",").map((m) => m.trim()).filter(Boolean),
};
