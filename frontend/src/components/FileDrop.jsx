import { useRef, useState } from "react";

const ACCEPT = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};
const MAX_BYTES = 5 * 1024 * 1024;

export default function FileDrop({ file, onChange, onError }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const pick = (f) => {
    if (!f) return;
    if (!ACCEPT[f.type]) return onError("Only PDF and DOCX files are supported.");
    if (f.size > MAX_BYTES) return onError("File is too large (max 5 MB).");
    onError("");
    onChange(f);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files?.[0]);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
        dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-500 hover:bg-slate-50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <svg className="mb-3 h-9 w-9 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 16V4m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
      </svg>
      {file ? (
        <>
          <p className="font-medium text-slate-800">{file.name}</p>
          <p className="text-xs text-slate-500">
            {(file.size / 1024).toFixed(0)} KB · {ACCEPT[file.type]} · click to change
          </p>
        </>
      ) : (
        <>
          <p className="font-medium text-slate-800">Drop your resume here or click to browse</p>
          <p className="text-xs text-slate-500">PDF or DOCX, up to 5 MB</p>
        </>
      )}
    </div>
  );
}
