// Embeds the sample job descriptions in scripts/jobs.json, upserts them into
// MongoDB, and creates the Atlas Vector Search index used for recommendations.
//   npm run seed:jobs
import { readFile } from "node:fs/promises";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { connectDB } from "../src/config/db.js";
import { Job } from "../src/models/Job.js";
import { embedText } from "../src/services/ai.js";

const jobs = JSON.parse(await readFile(new URL("./jobs.json", import.meta.url), "utf8"));

await connectDB();

let count = 0;
for (const job of jobs) {
  const text = `${job.title} at ${job.company}\nSkills: ${job.skills.join(", ")}\n${job.description}`;
  const embedding = await embedText(text);
  await Job.updateOne(
    { title: job.title, company: job.company },
    { $set: { ...job, embedding } },
    { upsert: true }
  );
  count++;
  console.log(`  embedded ${count}/${jobs.length}: ${job.title}`);
  // Stay well under free-tier per-minute limits.
  await new Promise((r) => setTimeout(r, 700));
}
console.log(`Upserted ${count} jobs.`);

try {
  const existing = await Job.collection.listSearchIndexes(env.VECTOR_INDEX_NAME).toArray();
  if (existing.length) {
    console.log(`Vector index "${env.VECTOR_INDEX_NAME}" already exists.`);
  } else {
    await Job.collection.createSearchIndex({
      name: env.VECTOR_INDEX_NAME,
      type: "vectorSearch",
      definition: {
        fields: [{ type: "vector", path: "embedding", numDimensions: env.EMBEDDING_DIMENSIONS, similarity: "cosine" }],
      },
    });
    console.log(`Created vector index "${env.VECTOR_INDEX_NAME}". Atlas needs about a minute to build it.`);
  }
} catch (err) {
  console.warn(
    `Could not create the vector index automatically (${err.message}).\n` +
      "This needs MongoDB Atlas. Recommendations still work through the in-app fallback.\n" +
      "To create it manually, see README.md > Vector Search index."
  );
}

await mongoose.disconnect();
