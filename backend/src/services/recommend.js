import { Job } from "../models/Job.js";
import { env } from "../config/env.js";
import { cosineSimilarity } from "./scoring.js";

const PUBLIC_FIELDS = { title: 1, company: 1, location: 1, experience: 1, skills: 1, url: 1 };

/**
 * Find the jobs closest to a resume embedding.
 * Uses Atlas Vector Search ($vectorSearch); falls back to in-app cosine
 * similarity if the index does not exist yet (e.g. local MongoDB).
 */
export async function recommendJobs(resumeEmbedding, limit = 5) {
  if (!resumeEmbedding?.length) return { source: "none", jobs: [] };

  try {
    const jobs = await Job.aggregate([
      {
        $vectorSearch: {
          index: env.VECTOR_INDEX_NAME,
          path: "embedding",
          queryVector: resumeEmbedding,
          numCandidates: Math.max(limit * 20, 100),
          limit,
        },
      },
      { $project: { ...PUBLIC_FIELDS, similarity: { $meta: "vectorSearchScore" } } },
    ]);
    if (jobs.length) return { source: "atlas-vector-search", jobs: jobs.map(withPercent) };
  } catch (err) {
    console.warn(`Vector search unavailable, using fallback: ${err.message}`);
  }

  const all = await Job.find({}).select({ ...PUBLIC_FIELDS, embedding: 1 }).lean();
  const ranked = all
    // Same 0-1 scale as $vectorSearch so both paths report comparable match percentages.
    .map(({ embedding, ...job }) => ({ ...job, similarity: (1 + cosineSimilarity(resumeEmbedding, embedding)) / 2 }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
  return { source: "in-app-cosine", jobs: ranked.map(withPercent) };
}

function withPercent(job) {
  // $vectorSearch cosine scores are normalised to 0-1 as (1 + cosine) / 2.
  return { ...job, match: Math.round(job.similarity * 100) };
}
