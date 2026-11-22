export function scoreTone(score) {
  if (score >= 75) return { text: "text-emerald-600", bar: "bg-emerald-500", stroke: "#10b981", label: "Strong" };
  if (score >= 50) return { text: "text-amber-600", bar: "bg-amber-500", stroke: "#f59e0b", label: "Fair" };
  return { text: "text-red-600", bar: "bg-red-500", stroke: "#ef4444", label: "Weak" };
}

export function ScoreRing({ score, size = 148 }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = scoreTone(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone.stroke}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (score / 100) * c}
          style={{ transition: "stroke-dashoffset 800ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${tone.text}`}>{score}</span>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">ATS score</span>
      </div>
    </div>
  );
}

export function ScoreBar({ label, score, weight, hint }) {
  const tone = scoreTone(score);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-700">
          {label} <span className="font-normal text-slate-400">({weight})</span>
        </span>
        <span className={`font-semibold ${tone.text}`}>{score}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${score}%` }} />
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function SkillChips({ skills, tone = "neutral", empty = "None" }) {
  const styles = {
    good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    bad: "bg-red-50 text-red-700 ring-red-200",
    warn: "bg-amber-50 text-amber-700 ring-amber-200",
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  if (!skills?.length) return <p className="text-sm text-slate-400">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {skills.map((s) => (
        <li key={s} className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${styles[tone]}`}>
          {s}
        </li>
      ))}
    </ul>
  );
}
