import { Hono } from "hono";
import { manifestHandler } from "./routes/manifest";
import { uploadHandler } from "./routes/upload";

export interface IEnv {
  DB: D1Database;
  BUCKET: R2Bucket;
  BUCKET_URL: string;
  MAX_UPDATES_TO_KEEP: number;
  ALLOWED_UPLOAD_IPS?: string;
}

const app = new Hono<{ Bindings: IEnv }>();

app.get("/manifest", manifestHandler);
app.post("/upload", uploadHandler);
app.get("/health", (context) => {
  return context.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

export default app;
