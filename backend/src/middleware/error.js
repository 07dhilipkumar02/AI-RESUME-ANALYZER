import multer from "multer";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";

export function notFound(req, _res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 5 MB)" : err.message;
    return res.status(400).json({ error: message });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(404).json({ error: "Not found" });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
}
