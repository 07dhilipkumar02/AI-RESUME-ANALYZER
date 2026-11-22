import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../lib/api.js";
import { scoreTone } from "../components/Scores.jsx";
import Alert from "../components/Alert.jsx";
import Spinner from "../components/Spinner.jsx";

export default function HistoryPage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api
      .get("/analyses", { params: { page, limit: 10 } })
      .then((res) => setData(res.data))
      .catch((err) => setError(errorMessage(err)));
  }, [page]);

  useEffect(load, [load]);

  const remove = async (id) => {
    if (!window.confirm("Delete this analysis?")) return;
    try {
      await api.delete(`/analyses/${id}`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Your analyses</h1>
        <Link to="/" className="btn-primary">New analysis</Link>
      </div>
      <Alert>{error}</Alert>

      {!data ? (
        <div className="flex justify-center py-16 text-brand-600">
          <Spinner className="h-8 w-8" />
        </div>
      ) : data.items.length === 0 ? (
        <div className="card text-center">
          <p className="text-slate-600">No analyses yet.</p>
          <Link to="/" className="mt-3 inline-block font-semibold text-brand-600">Analyze your first resume →</Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((a) => (
              <li key={a._id} className="card flex items-center gap-4 !p-4">
                <span className={`w-12 text-center text-2xl font-bold ${scoreTone(a.scores.overall).text}`}>
                  {a.scores.overall}
                </span>
                <Link to={`/analyses/${a._id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800 hover:text-brand-700">
                    {[a.jobTitle, a.company].filter(Boolean).join(" · ") || "Untitled job"}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {a.fileName} · {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </Link>
                <div className="hidden gap-4 text-xs text-slate-500 sm:flex">
                  <span>Keywords {a.scores.keyword}</span>
                  <span>Fit {a.scores.semantic}</span>
                  <span>Format {a.scores.formatting}</span>
                </div>
                <button onClick={() => remove(a._id)} className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700" aria-label="Delete analysis">
                  Delete
                </button>
              </li>
            ))}
          </ul>
          {data.pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3 text-sm">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Previous</button>
              <span className="text-slate-500">Page {data.page} of {data.pages}</span>
              <button className="btn-ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
