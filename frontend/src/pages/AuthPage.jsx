import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { errorMessage } from "../lib/api.js";
import Alert from "../components/Alert.jsx";
import Spinner from "../components/Spinner.jsx";

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isRegister) await register(form);
      else await login({ email: form.email, password: form.password });
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto mb-4 h-12 w-12" />
          <h1 className="text-2xl font-bold text-slate-900">
            {isRegister ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Score your resume against any job description in under a minute.
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-4">
          <Alert>{error}</Alert>
          {isRegister && (
            <div>
              <label htmlFor="name" className="label">Full name</label>
              <input id="name" className="input" value={form.name} onChange={update("name")} required autoComplete="name" />
            </div>
          )}
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" className="input" value={form.email} onChange={update("email")} required autoComplete="email" />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              value={form.password}
              onChange={update("password")}
              required
              minLength={isRegister ? 8 : undefined}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
            {isRegister && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy && <Spinner className="h-4 w-4" />}
            {isRegister ? "Create account" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          {isRegister ? "Already have an account? " : "New here? "}
          <Link to={isRegister ? "/login" : "/register"} className="font-semibold text-brand-600 hover:text-brand-700">
            {isRegister ? "Log in" : "Create an account"}
          </Link>
        </p>
      </div>
    </div>
  );
}
