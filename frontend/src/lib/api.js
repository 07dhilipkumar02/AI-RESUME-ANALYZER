import axios from "axios";

const TOKEN_KEY = "ara_token";

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.startsWith("/auth/")) onUnauthorized();
    return Promise.reject(err);
  }
);

/** Turn an axios error into a message a user can act on. */
export function errorMessage(err) {
  if (err.code === "ECONNABORTED") return "The request took too long. Please try again.";
  if (!err.response) return "Can't reach the server. Is the backend running?";
  const data = err.response.data || {};
  if (data.details?.length) return data.details.map((d) => d.message).join(". ");
  return data.error || "Something went wrong";
}
