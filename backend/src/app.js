import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import analysisRoutes from "./routes/analyses.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { env } from "./config/env.js";

export const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.clientOrigins }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

app.use("/api/auth", authRoutes);
app.use("/api/analyses", analysisRoutes);

app.use(notFound);
app.use(errorHandler);
