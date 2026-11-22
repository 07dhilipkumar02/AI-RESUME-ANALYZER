import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { app } from "./app.js";

try {
  await connectDB();
} catch (err) {
  console.error(`Could not connect to MongoDB: ${err.message}`);
  process.exit(1);
}

app.listen(env.PORT, () => {
  console.log(`API running on http://localhost:${env.PORT}`);
});
