import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Analysis } from "../models/Analysis.js";
import { requireAuth } from "../middleware/auth.js";
import { extractResumeText, SUPPORTED_TYPES } from "../services/parser.js";
import { analyzeWithLLM, embedText } from "../services/ai.js";
import { recommendJobs } from "../services/recommend.js";
import {
  cosineSimilarity,
  filterRewrites,
  formattingChecks,
  keywordScore,
  overallScore,
  semanticScore,
} from "../services/scoring.js";
import { AppError } from "../utils/AppError.js";

const router = Router();
router.use(requireAuth);

// Files stay in memory and are never written to disk; only extracted text is stored.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    SUPPORTED_TYPES[file.mimetype] ? cb(null, true) : cb(new AppError(400, "Only PDF and DOCX resumes are supported")),
});

// Each analysis costs AI calls; protect the free-tier quota.
const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.userId,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Analysis limit reached (10 per 15 minutes). Please try again later." },
});

const analyzeSchema = z.object({
  jobDescription: z.string().trim().min(100, "Paste the full job description (at least 100 characters)").max(20000),
  jobTitle: z.string().trim().max(120).optional(),
  company: z.string().trim().max(120).optional(),
});

router.post("/", analyzeLimiter, upload.single("resume"), async (req, res) => {
  if (!req.file) throw new AppError(400, "Upload a resume (PDF or DOCX)");
  const { jobDescription, jobTitle, company } = analyzeSchema.parse(req.body);

  const resumeText = await extractResumeText(req.file.buffer, req.file.mimetype);

  // The LLM call and both embeddings run in parallel.
  const [{ data: llm, model: aiModel }, resumeEmbedding, jdEmbedding] = await Promise.all([
    analyzeWithLLM(resumeText, jobDescription),
    embedText(resumeText),
    embedText(jobDescription),
  ]);

  const keyword = keywordScore(resumeText, llm.requiredSkills, llm.preferredSkills);
  const semantic = semanticScore(cosineSimilarity(resumeEmbedding, jdEmbedding));
  const formatting = formattingChecks(resumeText);
  const scores = {
    keyword: keyword.score,
    semantic,
    formatting: formatting.score,
  };
  scores.overall = overallScore(scores);

  const analysis = await Analysis.create({
    user: req.userId,
    fileName: req.file.originalname,
    jobTitle,
    company,
    jobDescription,
    resumeText,
    resumeEmbedding,
    scores,
    matchedSkills: keyword.matched,
    missingSkills: keyword.missing,
    preferredMissing: keyword.preferredMissing,
    formattingChecks: formatting.checks,
    summary: llm.summary,
    roleFit: llm.roleFit,
    strengths: llm.strengths,
    improvements: llm.improvements,
    rewrittenBullets: filterRewrites(llm.rewrittenBullets, resumeText, [...llm.requiredSkills, ...llm.preferredSkills]),
    aiModel,
  });

  res.status(201).json({ analysis: publicAnalysis(analysis) });
});

router.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const filter = { user: req.userId };

  const [items, total] = await Promise.all([
    Analysis.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("fileName jobTitle company scores roleFit createdAt"),
    Analysis.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

router.get("/:id", async (req, res) => {
  const analysis = await Analysis.findOne({ _id: req.params.id, user: req.userId });
  if (!analysis) throw new AppError(404, "Analysis not found");
  res.json({ analysis: publicAnalysis(analysis) });
});

router.get("/:id/recommendations", async (req, res) => {
  const analysis = await Analysis.findOne({ _id: req.params.id, user: req.userId }).select("+resumeEmbedding");
  if (!analysis) throw new AppError(404, "Analysis not found");
  const limit = Math.min(10, Number(req.query.limit) || 5);
  res.json(await recommendJobs(analysis.resumeEmbedding, limit));
});

router.delete("/:id", async (req, res) => {
  const result = await Analysis.deleteOne({ _id: req.params.id, user: req.userId });
  if (!result.deletedCount) throw new AppError(404, "Analysis not found");
  res.status(204).end();
});

function publicAnalysis(doc) {
  const { resumeText, resumeEmbedding, __v, ...rest } = doc.toObject();
  return rest;
}

export default router;
