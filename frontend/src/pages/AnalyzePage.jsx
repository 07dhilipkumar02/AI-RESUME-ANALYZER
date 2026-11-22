import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errorMessage } from "../lib/api.js";
import FileDrop from "../components/FileDrop.jsx";
import Alert from "../components/Alert.jsx";
import Spinner from "../components/Spinner.jsx";

const STEPS = ["Reading your resume", "Extracting job requirements", "Comparing skills and experience", "Writing suggestions"];
const MIN_JD = 100;

export default function AnalyzePage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!busy) return undefined;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const step = Math.min(Math.floor(elapsed / 4), STEPS.length - 1);

  const jdLength = jobDescription.trim().length;
  const canSubmit = file && jdLength >= MIN_JD && !busy;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setBusy(true);
    const body = new FormData();
    body.append("resume", file);
    body.append("jobDescription", jobDescription);
    if (jobTitle.trim()) body.append("jobTitle", jobTitle.trim());
    if (company.trim()) body.append("company", company.trim());
    try {
      // The backend gives up after ~100 s; this is a safety net in case the connection itself stalls.
      const res = await api.post("/analyses", body, { timeout: 150_000 });
      navigate(`/analyses/${res.data.analysis._id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Analyze your resume</h1>
        <p className="mt-2 text-slate-600">
          Upload your resume and paste the job description. You'll get an ATS score, missing keywords and rewritten
          bullet points tailored to that job.
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-6">
        <Alert>{error}</Alert>

        <div>
          <span className="label">1. Resume</span>
          <FileDrop file={file} onChange={setFile} onError={setError} />
        </div>

        <div>
          <span className="label">2. Job</span>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <input className="input" placeholder="Job title (optional)" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={120} />
            <input className="input" placeholder="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} />
          </div>
          <textarea
            className="input min-h-56 resize-y leading-relaxed"
            placeholder="Paste the full job description here: responsibilities, required skills, qualifications…"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            maxLength={20000}
          />
          <p className={`mt-1 text-xs ${jdLength && jdLength < MIN_JD ? "text-amber-600" : "text-slate-500"}`}>
            {jdLength < MIN_JD ? `At least ${MIN_JD} characters needed (${jdLength} so far).` : `${jdLength.toLocaleString()} characters`}
          </p>
        </div>

        <button type="submit" disabled={!canSubmit} className="btn-primary w-full py-3 text-base">
          {busy ? (
            <>
              <Spinner className="h-5 w-5" /> {STEPS[step]}…
            </>
          ) : (
            "Analyze resume"
          )}
        </button>
        {busy && (
          <p className="text-center text-xs text-slate-500">
            {elapsed}s · {elapsed < 30 ? "This usually takes 10–30 seconds." : "The AI is busy, retrying automatically. This can take up to 2 minutes."}
          </p>
        )}
      </form>
    </div>
  );
}
