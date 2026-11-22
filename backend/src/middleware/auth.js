import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return next(new AppError(401, "Please log in"));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    next(new AppError(401, "Session expired. Please log in again."));
  }
}
