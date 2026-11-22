// All AI provider calls live in this file. To switch providers (e.g. OpenAI),
// reimplement analyzeWithLLM() and embedText() with the same return shapes.
import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const MAX_RESUME_CHARS = 20000;

// A request that hangs (connection stalls without erroring) would otherwise keep the user
// waiting forever. Each call gets its own timeout, and the whole analysis a hard deadline.
const LLM_TIMEOUT_MS = Number(process.env.AI_LLM_TIMEOUT_MS) || 40_000;
const EMBED_TIMEOUT_MS = Number(process.env.AI_EMBED_TIMEOUT_MS) || 20_000;
const ANALYSIS_DEADLINE_MS = Number(process.env.AI_DEADLINE_MS) || 100_000;
const MAX_JD_CHARS = 15000;

const analysisSchema = {
  type: "object",
  properties: {
    requiredSkills: {
      type: "array",
      items: { type: "string" },
      description: "Hard skills, tools and technologies the job description requires. Short canonical names, e.g. 'React.js', 'MongoDB'.",
    },
    preferredSkills: {
      type: "array",
      items: { type: "string" },
      description: "Skills the job description lists as nice-to-have, preferred or a plus.",
    },
    summary: { type: "string", description: "2-3 sentence overall assessment of fit for this specific job." },
    roleFit: { type: "string", enum: ["strong", "moderate", "weak"] },
    strengths: { type: "array", items: { type: "string" }, description: "3-5 concrete strengths relevant to this job." },
    improvements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          section: { type: "string" },
          issue: { type: "string" },
          suggestion: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["section", "issue", "suggestion", "priority"],
      },
    },
    rewrittenBullets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          improved: { type: "string" },
          reason: { type: "string" },
        },
        required: ["original", "improved", "reason"],
      },
    },
  },
  required: ["requiredSkills", "preferredSkills", "summary", "roleFit", "strengths", "improvements", "rewrittenBullets"],
};

function buildPrompt(resumeText, jobDescription) {
  return `You are an experienced technical recruiter reviewing a resume against one job description.

Rules:
- Extract skills from the JOB DESCRIPTION only for requiredSkills and preferredSkills. Do not include soft skills.
- Base every statement about the candidate strictly on the RESUME text. Never invent employers, projects, skills or numbers.
- improvements: 4-8 items, most important first, each specific to this resume and job.
- rewrittenBullets: pick up to 5 weak bullet points copied exactly from the resume and rewrite each with a strong action verb and the job's language.
  If a number would help but the resume gives none, insert a placeholder like [X%] or [N users] instead of inventing one.
  A rewrite may only mention tools, technologies and activities that the original bullet or the resume already mentions.
  Do not add job-description skills the candidate has not shown.

JOB DESCRIPTION:
"""
${jobDescription.slice(0, MAX_JD_CHARS)}
"""

RESUME:
"""
${resumeText.slice(0, MAX_RESUME_CHARS)}
"""`;
}

// Overloaded (503), rate-limited (429) and server errors are worth retrying.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Dropped or timed-out connections ("fetch failed", ECONNRESET, ETIMEDOUT...) carry no HTTP
// status. They are usually a brief network blip and worth retrying too.
const NETWORK_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"]);
function isNetworkError(err) {
  const code = err?.cause?.code ?? err?.code;
  return (
    (err instanceof TypeError && /fetch failed/i.test(err.message)) ||
    NETWORK_CODES.has(code) ||
    isTimeout(err)
  );
}

function isTimeout(err) {
  return err?.name === "AbortError" || err?.name === "TimeoutError" || /aborted|timed? ?out/i.test(err?.message ?? "");
}

/**
 * Ask the LLM for skill extraction and written feedback (scores are computed elsewhere).
 * Tries the primary model, then each fallback model, with short backoff on temporary errors.
 * Returns { data, model } so the analysis records which model actually answered.
 */
export async function analyzeWithLLM(resumeText, jobDescription) {
  const models = [env.GEMINI_MODEL, ...env.fallbackModels.filter((m) => m !== env.GEMINI_MODEL)];
  const prompt = buildPrompt(resumeText, jobDescription);
  const deadline = Date.now() + ANALYSIS_DEADLINE_MS;
  let lastError;

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 5_000) throw toAppError(lastError ?? timeoutError(), "The AI analysis failed");
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            httpOptions: { timeout: Math.min(LLM_TIMEOUT_MS, remaining) },
            temperature: 0.2,
            responseMimeType: "application/json",
            responseJsonSchema: analysisSchema,
          },
        });
        return { data: JSON.parse(response.text), model };
      } catch (err) {
        lastError = err;
        const status = errorStatus(err);
        // A bad key or bad request won't fix itself on another try.
        if (status === 400 || status === 401 || status === 403) throw toAppError(err, "The AI analysis failed");
        // Unknown model name, or a request that hung until timeout: go straight to the next
        // model rather than spending the deadline waiting on the same one again.
        if (status === 404 || isTimeout(err)) break;
        // Malformed JSON gets one more try; temporary errors get backoff (1s, 2s).
        const retryable = RETRYABLE.has(status) || isNetworkError(err) || err instanceof SyntaxError;
        if (!retryable) break;
        if (attempt < 3) await sleep(1000 * attempt);
      }
    }
    console.warn(
      `Model ${model} unavailable (${errorStatus(lastError) ?? lastError?.cause?.code ?? lastError?.message}), trying next model`
    );
  }
  throw toAppError(lastError, "The AI analysis failed");
}

function errorStatus(err) {
  return err?.status ?? err?.code;
}

/** Embed text for similarity and vector search. gemini-embedding-2 auto-normalizes truncated vectors. */
export async function embedText(text) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.embedContent({
        model: env.GEMINI_EMBEDDING_MODEL,
        contents: text.slice(0, 24000),
        config: { outputDimensionality: env.EMBEDDING_DIMENSIONS, httpOptions: { timeout: EMBED_TIMEOUT_MS } },
      });
      return response.embeddings[0].values;
    } catch (err) {
      lastError = err;
      if (!(RETRYABLE.has(errorStatus(err)) || isNetworkError(err))) break;
      if (attempt < 3) await sleep(1000 * attempt);
    }
  }
  throw toAppError(lastError, "Embedding request failed");
}

function timeoutError() {
  return Object.assign(new Error("AI request timed out"), { name: "TimeoutError" });
}

function toAppError(err, fallback) {
  if (isTimeout(err)) {
    return new AppError(504, "The AI service took too long to respond. Please try again.");
  }
  if (isNetworkError(err)) {
    return new AppError(503, "Couldn't reach the AI service. Check your internet connection and try again.");
  }
  const status = errorStatus(err);
  if (status === 429) return new AppError(429, "AI rate limit reached. Please wait a minute and try again.");
  if (status === 503 || status === 500 || status === 502 || status === 504) {
    return new AppError(503, "The AI service is busy right now. Please try again in a minute.");
  }
  if (status === 404) {
    return new AppError(502, "The AI model name in .env was not found. Check GEMINI_MODEL and GEMINI_FALLBACK_MODELS.");
  }
  if (status === 400 || status === 403) {
    return new AppError(502, "The AI provider rejected the request. Check GEMINI_API_KEY and the model names in .env.");
  }
  console.error(fallback, err);
  return new AppError(502, `${fallback}. Please try again.`);
}
