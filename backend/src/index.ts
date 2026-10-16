import express from "express";

const app = express();

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = Number(process.env.PORT) || 5001;

app.listen(PORT, (error) => {
  if (error) throw error;
  console.log(`Backend running on port ${PORT}`);
});
