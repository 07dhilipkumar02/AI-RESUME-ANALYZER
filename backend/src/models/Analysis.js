import mongoose from "mongoose";

const improvementSchema = new mongoose.Schema(
  {
    section: String,
    issue: String,
    suggestion: String,
    priority: { type: String, enum: ["high", "medium", "low"], default: "medium" },
  },
  { _id: false }
);

const rewriteSchema = new mongoose.Schema(
  { original: String, improved: String, reason: String },
  { _id: false }
);

const formattingCheckSchema = new mongoose.Schema(
  { label: String, passed: Boolean, detail: String },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fileName: { type: String, required: true },
    jobTitle: { type: String, trim: true, maxlength: 120 },
    company: { type: String, trim: true, maxlength: 120 },
    jobDescription: { type: String, required: true },
    resumeText: { type: String, required: true, select: false },
    resumeEmbedding: { type: [Number], select: false },

    scores: {
      overall: Number,
      keyword: Number,
      semantic: Number,
      formatting: Number,
    },
    matchedSkills: [String],
    missingSkills: [String],
    preferredMissing: [String],
    formattingChecks: [formattingCheckSchema],

    summary: String,
    roleFit: String,
    strengths: [String],
    improvements: [improvementSchema],
    rewrittenBullets: [rewriteSchema],

    aiModel: String,
  },
  { timestamps: true }
);

analysisSchema.index({ user: 1, createdAt: -1 });

export const Analysis = mongoose.model("Analysis", analysisSchema);
