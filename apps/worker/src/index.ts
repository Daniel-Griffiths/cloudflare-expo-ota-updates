import { Hono } from "hono";
import { manifestHandler } from "./routes/manifest";
import { uploadHandler } from "./routes/upload";

export interface IEnv {
  DB: D1Database;
  BUCKET: R2Bucket;
  BUCKET_URL: string;
  MAX_UPDATES_TO_KEEP: string;
  ALLOWED_UPLOAD_IPS?: string;
}

const app = new Hono<{ Bindings: IEnv }>();

app.get("/manifest", manifestHandler);
app.post("/upload", uploadHandler);
app.notFound(() => {
  return new Response(null, { status: 404 });
});

export default app;
