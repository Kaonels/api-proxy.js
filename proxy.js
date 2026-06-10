// api/proxy.js — ONE serverless function: data proxy (GET) + AI proxy (POST).
//
// Put this file at  api/proxy.js  in your project.
// For the AI features, add env var ANTHROPIC_API_KEY in Vercel (Settings → Environment Variables).
// Then, in the dashboard's Setup tab, set the proxy field to:  /api/proxy
//
// GET  /api/proxy?url=<polymarket api url>   → forwards Polymarket data (fixes CORS)
// POST /api/proxy   (body = Anthropic request) → adds your key and calls Claude

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  // ---- AI proxy ----
  if (req.method === "POST") {
    if (!process.env.ANTHROPIC_API_KEY)
      return res.status(500).json({ error: "ANTHROPIC_API_KEY not set in Vercel env" });
    try {
      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body,
      });
      res.setHeader("Content-Type", "application/json");
      return res.status(r.status).send(await r.text());
    } catch (e) {
      return res.status(502).json({ error: "ai upstream failed", detail: String(e) });
    }
  }

  // ---- data proxy ----
  const url = req.query.url;
  if (!url || !/^https:\/\/[a-z0-9-]+\.polymarket\.com\//i.test(url))
    return res.status(400).json({ error: "GET needs ?url=<https polymarket url>" });
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
    res.setHeader("Cache-Control", "public, max-age=20");
    return res.status(r.status).send(await r.text());
  } catch (e) {
    return res.status(502).json({ error: "data upstream failed", detail: String(e) });
  }
}
