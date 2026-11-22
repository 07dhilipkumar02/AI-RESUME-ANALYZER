import mongoose from "mongoose";

// Job descriptions used for recommendations. `embedding` is indexed by an
// Atlas Vector Search index (see scripts/seed-jobs.js).
const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: String,
    experience: String,
    description: { type: String, required: true },
    skills: [String],
    url: String,
    embedding: { type: [Number], select: false },
  },
  { timestamps: true }
);

jobSchema.index({ title: 1, company: 1 }, { unique: true });

export const Job = mongoose.model("Job", jobSchema);
