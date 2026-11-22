import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../lib/api.js";
import { ScoreBar, ScoreRing, SkillChips, scoreTone } from "../components/Scores.jsx";
import Alert from "../components/Alert.jsx";
import Spinner from "../components/Spinner.jsx";

const FIT_STYLE = {
  strong: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  moderate: "bg-amber-50 text-amber-700 ring-amber-200",
  weak: "bg-red-50 text-red-700 ring-red-200",
};
const PRIORITY_STYLE = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

export default function AnalysisPage() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [recs, setRecs] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setAnalysis(null);
    setRecs(null);
    api
      .get(`/analyses/${id}`)
      .then((res) => setAnalysis(res.data.analysis))
      .catch((err) => setError(errorMessage(err)));
    api
      .get(`/analyses/${id}/recommendations`)
      .then((res) => setRecs(res.data))
      .catch(() => setRecs({ jobs: [] }));
  }, [id]);

  if (error) return <Alert>{error}</Alert>;
  if (!analysis) {
    return (
      <div className="flex justify-center py-20 text-brand-600">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const { scores } = analysis;
  const title = [analysis.jobTitle, analysis.company].filter(Boolean).join(" · ") || "Job analysis";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/analyses" className="text-sm text-slate-500 hover:text-slate-800">← All analyses</Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">
            {analysis.fileName} · {new Date(analysis.createdAt).toLocaleString()}
          </p>
        </div>
        <Link to="/" className="btn-primary">New analysis</Link>
      </div>

      {/* Score overview */}
      <section className="card grid items-center gap-6 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <ScoreRing score={scores.overall} />
          {analysis.roleFit && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${FIT_STYLE[analysis.roleFit]}`}>
              {analysis.roleFit} fit
            </span>
          )}
        </div>
        <div className="space-y-4">
          <p className="leading-relaxed text-slate-700">{analysis.summary}</p>
          <ScoreBar label="Keyword match" weight="45%" score={scores.keyword} hint="Job skills found word-for-word in your resume, as ATS filters check them." />
          <ScoreBar label="Semantic fit" weight="35%" score={scores.semantic} hint="How closely your experience matches the job's meaning, measured with embeddings." />
          <ScoreBar label="ATS formatting" weight="20%" score={scores.formatting} hint="Structure checks that resume parsers depend on." />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Skills</h2>
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-600">Matched ({analysis.matchedSkills.length})</h3>
            <SkillChips skills={analysis.matchedSkills} tone="good" />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-600">Missing required ({analysis.missingSkills.length})</h3>
            <SkillChips skills={analysis.missingSkills} tone="bad" empty="None. Every required skill appears in your resume." />
          </div>
          {analysis.preferredMissing?.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-600">Missing nice-to-have</h3>
              <SkillChips skills={analysis.preferredMissing} tone="warn" />
            </div>
          )}
          <p className="text-xs text-slate-500">Only add a missing skill if you can back it up in an interview.</p>
        </section>

        <section className="card">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">ATS formatting checks</h2>
          <ul className="space-y-2.5">
            {analysis.formattingChecks.map((c) => (
              <li key={c.label} className="flex gap-3 text-sm">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${c.passed ? "bg-emerald-500" : "bg-red-500"}`}>
                  {c.passed ? "✓" : "!"}
                </span>
                <span>
                  <span className="font-medium text-slate-800">{c.label}</span>
                  {!c.passed && <span className="block text-slate-500">{c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {analysis.strengths?.length > 0 && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Strengths for this role</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            {analysis.strengths.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">What to improve</h2>
        <ol className="space-y-4">
          {analysis.improvements.map((imp, i) => (
            <li key={i} className="flex gap-3">
              <span className={`h-fit shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold uppercase ${PRIORITY_STYLE[imp.priority]}`}>
                {imp.priority}
              </span>
              <div className="text-sm">
                <p className="font-medium text-slate-800">
                  {imp.section}: <span className="font-normal">{imp.issue}</span>
                </p>
                <p className="mt-0.5 text-slate-600">{imp.suggestion}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {analysis.rewrittenBullets?.length > 0 && (
        <section className="card">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Suggested bullet rewrites</h2>
          <p className="mb-4 text-sm text-slate-500">Replace placeholders like [X%] with your real numbers. Never invent them.</p>
          <div className="space-y-4">
            {analysis.rewrittenBullets.map((b, i) => (
              <RewriteCard key={i} bullet={b} />
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Jobs that match your resume</h2>
          {recs?.source && recs.source !== "none" && (
            <span className="text-xs text-slate-400">
              {recs.source === "atlas-vector-search" ? "Atlas Vector Search" : "cosine similarity"}
            </span>
          )}
        </div>
        {!recs ? (
          <Spinner className="h-5 w-5 text-brand-600" />
        ) : recs.jobs.length === 0 ? (
          <p className="text-sm text-slate-500">No jobs in the database yet. Run <code>npm run seed:jobs</code> in the backend.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {recs.jobs.map((job) => (
              <li key={job._id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{job.title}</p>
                    <p className="text-sm text-slate-500">
                      {job.company}
                      {job.location && ` · ${job.location}`}
                      {job.experience && ` · ${job.experience}`}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${scoreTone(job.match).text}`}>{job.match}%</span>
                </div>
                <div className="mt-3">
                  <SkillChips skills={job.skills?.slice(0, 6)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RewriteCard({ bullet }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bullet.improved);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="rounded-xl border border-slate-200 p-4 text-sm">
      <p className="text-slate-500 line-through decoration-slate-300">{bullet.original}</p>
      <p className="mt-2 font-medium text-slate-900">{bullet.improved}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{bullet.reason}</p>
        <button onClick={copy} className="btn-ghost shrink-0 py-1 text-xs">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
