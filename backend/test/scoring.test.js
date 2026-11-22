import { test } from "node:test";
import assert from "node:assert/strict";
import {
  containsSkill,
  cosineSimilarity,
  formattingChecks,
  keywordScore,
  normalize,
  overallScore,
  semanticScore,
} from "../src/services/scoring.js";

test("matches common spelling variants of a skill", () => {
  const text = normalize("Built APIs with NodeJS, React and Mongo DB. Also C++ and C#.");
  assert.ok(containsSkill(text, "Node.js"));
  assert.ok(containsSkill(text, "React.js"));
  assert.ok(containsSkill(text, "C++"));
  assert.ok(containsSkill(text, "C#"));
  assert.ok(!containsSkill(text, "Java"));
});

test("does not match a skill inside another word", () => {
  const text = normalize("JavaScript developer");
  assert.ok(!containsSkill(text, "Java"));
});

test("keyword score counts preferred skills at half weight", () => {
  const r = keywordScore("React Node.js", ["React.js", "Node.js", "MongoDB", "Docker"], ["AWS", "Redis"]);
  // earned 2 of possible 4 + 2*0.5 = 5
  assert.equal(r.score, 40);
  assert.deepEqual(r.missing, ["MongoDB", "Docker"]);
  assert.deepEqual(r.preferredMissing, ["AWS", "Redis"]);
});

test("keyword score dedupes skills listed as both required and preferred", () => {
  const r = keywordScore("React", ["React.js"], ["ReactJS"]);
  assert.equal(r.score, 100);
});

test("cosine similarity and semantic scaling", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(semanticScore(0.4), 0);
  assert.equal(semanticScore(0.95), 100);
  assert.equal(semanticScore(0.69), 50);
});

test("formatting checks pass on a well-structured resume", () => {
  const body = Array(300).fill("word").join(" ");
  const resume = `Jane Doe\njane@example.com | +91 98765 43210\nProfessional Experience\nDeveloper 2022 - 2024\nReduced load time by 40%\nEducation\nB.E. 2016\nSkills\nReact\n${body}`;
  const r = formattingChecks(resume);
  assert.equal(r.score, 100);
});

test("overall score is the weighted sum", () => {
  assert.equal(overallScore({ keyword: 100, semantic: 100, formatting: 100 }), 100);
  assert.equal(overallScore({ keyword: 80, semantic: 60, formatting: 50 }), 67);
});

test("filterRewrites drops rewrites that add skills the resume lacks", async () => {
  const { filterRewrites } = await import("../src/services/scoring.js");
  const resume = "Built REST APIs with Node.js and React. Used MongoDB.";
  const rewrites = [
    { original: "a", improved: "Built REST APIs with Node.js serving [N] users", reason: "" },
    { original: "b", improved: "Built APIs and deployed them with Docker on AWS", reason: "" },
  ];
  const kept = filterRewrites(rewrites, resume, ["Node.js", "Docker", "AWS"]);
  assert.equal(kept.length, 1);
  assert.match(kept[0].improved, /Node\.js/);
});

test("filterRewrites drops skills that appear only once (e.g. only in a skills list)", async () => {
  const { filterRewrites } = await import("../src/services/scoring.js");
  const resume = "Skills: React, Node.js, Docker, AWS\nExperience\nBuilt REST APIs with Node.js.";
  const rewrites = [
    { original: "Built REST APIs.", improved: "Built REST APIs with Node.js for [N] clients", reason: "" },
    { original: "Built REST APIs.", improved: "Built REST APIs and deployed services using Docker on AWS", reason: "" },
  ];
  const kept = filterRewrites(rewrites, resume, ["Node.js", "Docker", "AWS"]);
  assert.equal(kept.length, 1);
  assert.match(kept[0].improved, /clients/);
});
