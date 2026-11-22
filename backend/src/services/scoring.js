// Deterministic scoring. The LLM extracts skills and writes feedback; the
// numbers themselves are computed here so they are reproducible and explainable.

export const WEIGHTS = { keyword: 0.45, semantic: 0.35, formatting: 0.2 };

/** Lowercase and turn punctuation into spaces, keeping + and # (c++, c#). */
export function normalize(text) {
  return ` ${String(text)
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/** Spelling variants of a skill: "Node.js" -> ["node js", "nodejs", "node"]. */
export function skillVariants(skill) {
  const base = normalize(skill).trim();
  if (!base) return [];
  const variants = new Set([base, base.replace(/ /g, "")]);
  if (base.endsWith(" js")) variants.add(base.slice(0, -3));
  if (base.endsWith("js") && !base.endsWith(" js") && base.length > 4) variants.add(`${base.slice(0, -2)} js`);
  return [...variants].filter((v) => v.length > 0);
}

export function containsSkill(normalizedText, skill) {
  return skillVariants(skill).some((v) => normalizedText.includes(` ${v} `));
}

/** Share of the job's required skills that literally appear in the resume, as ATS keyword filters work. */
export function keywordScore(resumeText, requiredSkills = [], preferredSkills = []) {
  const text = normalize(resumeText);
  const required = dedupe(requiredSkills);
  const preferred = dedupe(preferredSkills).filter((s) => !required.some((r) => sameSkill(r, s)));

  const matched = required.filter((s) => containsSkill(text, s));
  const missing = required.filter((s) => !containsSkill(text, s));
  const preferredMatched = preferred.filter((s) => containsSkill(text, s));
  const preferredMissing = preferred.filter((s) => !containsSkill(text, s));

  // Required skills count fully, preferred skills count half.
  const possible = required.length + preferred.length * 0.5;
  const earned = matched.length + preferredMatched.length * 0.5;
  const score = possible === 0 ? 0 : Math.round((earned / possible) * 100);

  return { score, matched: [...matched, ...preferredMatched], missing, preferredMissing };
}

export function cosineSimilarity(a, b) {
  if (!a?.length || a.length !== b?.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/**
 * Map raw cosine similarity to 0-100. Embeddings of any two English documents
 * rarely score below ~0.5, and a strong resume/JD pair lands around 0.85+,
 * so the useful range is stretched across the scale.
 */
export function semanticScore(similarity, low = 0.5, high = 0.88) {
  const scaled = ((similarity - low) / (high - low)) * 100;
  return Math.round(Math.min(100, Math.max(0, scaled)));
}

/** Structural checks that real ATS parsers depend on. */
export function formattingChecks(resumeText) {
  const text = resumeText;
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean).length;
  const hasSection = (names) => names.some((n) => new RegExp(`(^|\\n)\\s*${n}\\b`, "i").test(text));

  const checks = [
    {
      label: "Email address",
      passed: /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text),
      detail: "Recruiters and ATS need a parseable email.",
    },
    {
      label: "Phone number",
      passed: /(\+?\d[\d\s-]{8,}\d)/.test(text),
      detail: "Include a phone number with country code.",
    },
    {
      label: "Experience section",
      passed: hasSection(["experience", "work experience", "professional experience", "employment"]),
      detail: "Use a standard heading such as \"Professional Experience\".",
    },
    {
      label: "Education section",
      passed: hasSection(["education", "academic"]),
      detail: "Use a standard \"Education\" heading.",
    },
    {
      label: "Skills section",
      passed: hasSection(["skills", "technical skills", "core skills"]),
      detail: "A dedicated skills section helps keyword matching.",
    },
    {
      label: "Dates on roles",
      passed: /(19|20)\d{2}/.test(text),
      detail: "Add month/year dates to each role.",
    },
    {
      label: "Measurable results",
      passed: /\d+\s?(%|percent|x\b|users|customers|clients|projects|ms\b|seconds|hours|lakh|crore|k\b)/i.test(lower),
      detail: "Add at least a few numbers (users, %, time saved).",
    },
    {
      label: "Length",
      passed: words >= 250 && words <= 1100,
      detail: `${words} words. Aim for 250-1100 (1-2 pages).`,
    },
  ];

  const score = Math.round((checks.filter((c) => c.passed).length / checks.length) * 100);
  return { score, checks };
}

/**
 * Guard against invented claims: drop any AI rewrite that mentions a job skill
 * the resume never mentions. The LLM is told not to do this, but doesn't always comply.
 */
export function filterRewrites(rewrites = [], resumeText, skills = []) {
  const resume = normalize(resumeText);
  return rewrites.filter((r) => {
    const improved = normalize(r.improved);
    const original = normalize(r.original);
    // A skill the rewrite newly introduces must show up at least twice in the resume:
    // once in a skills list alone is not evidence it was used in this role or project.
    return !skills.some(
      (s) => containsSkill(improved, s) && !containsSkill(original, s) && countSkill(resume, s) < 2
    );
  });
}

export function countSkill(normalizedText, skill) {
  return skillVariants(skill).reduce((n, v) => n + (normalizedText.split(` ${v} `).length - 1), 0);
}

export function overallScore({ keyword, semantic, formatting }) {
  return Math.round(keyword * WEIGHTS.keyword + semantic * WEIGHTS.semantic + formatting * WEIGHTS.formatting);
}

function sameSkill(a, b) {
  return normalize(a).replace(/ /g, "") === normalize(b).replace(/ /g, "");
}

function dedupe(skills) {
  const out = [];
  for (const s of skills || []) {
    const clean = String(s).trim();
    if (clean && !out.some((o) => sameSkill(o, clean))) out.push(clean);
  }
  return out;
}
