import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { User } from "../models/User.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { AppError } from "../utils/AppError.js";

const router = Router();

// Slow down password guessing.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

router.post("/register", authLimiter, async (req, res) => {
  const { name, email, password } = registerSchema.parse(req.body);
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ name, email, passwordHash });
  res.status(201).json({ token: signToken(user._id), user });
});

router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user || !(await user.checkPassword(password))) {
    throw new AppError(401, "Incorrect email or password");
  }
  res.json({ token: signToken(user._id), user });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new AppError(401, "Account not found");
  res.json({ user });
});

export default router;
