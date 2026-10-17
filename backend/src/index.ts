import express from "express";
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";

type RateCard = {
  productId: string;
  insurer: string;
  productType: string;
  cadence: "daily" | "monthly";
  cover: number;
  adults: number;
  children: number;
  ageMin: number;
  ageMax: number;
  premium: number;
  deductible: number;
};

type Customer = { userId: string; name: string; policies: { cycleEnd: string }[] };
type SarvamSessionConfig = {
  orgId: string;
  workspaceId: string;
  appId: string;
  version?: number;
  userIdentifier: string;
  agentVariables: Record<string, string>;
};

// Built from the event dataset by scripts/extract_insurance.py
const data: { today: string; rateCards: RateCard[]; customers: Record<string, Customer> } = JSON.parse(
  readFileSync(new URL("../data/insurance.json", import.meta.url), "utf8"),
);

// ponytail: one demo call at a time, all in memory; fine for a prototype
let activeUserId: string | null = null;
const activity: object[] = [];
const log = (type: string, detail: object) => activity.push({ type, at: new Date().toISOString(), ...detail });

// Best-effort WhatsApp receipt to DEMO_PHONE through the self-hosted WAHA container; a failure never blocks a proposal.
async function sendWhatsApp(text: string): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.WAHA_URL ?? "http://waha:3000"}/api/sendText`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Api-Key": process.env.WAHA_API_KEY ?? "" },
      body: JSON.stringify({ session: "default", chatId: `${(process.env.DEMO_PHONE ?? "").replace(/\D/g, "")}@c.us`, text }),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const DEFAULT_USER_ID = "1590824686249448"; // Abhishek Chopra, primary demo customer
const SARVAM_RUNTIME_BASE = process.env.SARVAM_RUNTIME_BASE ?? "https://apps.sarvam.ai/api/app-runtime/";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

// Tool: the agent calls this first on every call (phone, WhatsApp or web) to load who it's talking to.
// Must stay above /api/customer/:userId.
app.get("/api/customer/active", (_req, res) => {
  const customer = data.customers[activeUserId ?? DEFAULT_USER_ID];
  if (!activity.length) log("call", { customer: customer.name });
  res.json({ today: data.today, ...customer });
});

app.get("/api/customer/:userId", (req, res) => {
  const customer = data.customers[req.params.userId];
  if (!customer) {
    res.status(404).json({ error: "customer not found" });
    return;
  }
  res.json({ today: data.today, ...customer });
});

// Tool: the voice agent calls this before saying any price.
app.post("/api/quotes", (req, res) => {
  // Params come from the voice agent's tool call, so numbers may arrive as strings.
  const adults = Number(req.body?.adults);
  const children = Number(req.body?.children);
  const eldestAge = Number(req.body?.eldestAge);
  const budget = Number(req.body?.budgetMonthly);
  const budgetMonthly = budget > 0 ? budget : null;
  if (![adults, children, eldestAge].every(Number.isInteger)) {
    res.status(400).json({ error: "adults, children and eldestAge must be whole numbers" });
    return;
  }
  const quotes = data.rateCards
    .filter((r) => r.adults === adults && r.children === children && r.ageMin <= eldestAge && eldestAge <= r.ageMax)
    .map(({ productId, insurer, productType, cadence, cover, premium, deductible }) => {
      const monthlyCost = cadence === "daily" ? premium * 30 : premium;
      const withinBudget = budgetMonthly === null ? null : monthlyCost <= budgetMonthly;
      return { productId, insurer, productType, cadence, cover, premium, deductible, monthlyCost, withinBudget };
    })
    .sort((a, b) => a.monthlyCost - b.monthlyCost);
  log("quotes", { request: { adults, children, eldestAge, budgetMonthly }, quotes });
  res.json({ note: "monthlyCost = daily premium x 30. No quote means the data has no price for it.", quotes });
});

// Tool: the voice agent calls this after the customer says yes.
app.post("/api/proposals", async (req, res) => {
  const userId = String(req.body?.userId ?? activeUserId ?? DEFAULT_USER_ID);
  const customer = data.customers[userId];
  if (!customer) {
    res.status(400).json({ error: "unknown userId" });
    return;
  }
  const reference = `EZP-${randomInt(100000, 1000000)}`;
  const whatsappSent = await sendWhatsApp(
    `✅ ezpolicy: proposal ${reference} submitted for ${customer.name}.\n${req.body?.notes ?? ""}\n` +
      "Demo prototype: any new cover is subject to the insurer's approval.",
  );
  log("proposal", { ...req.body, userId, reference, whatsappSent });
  res.status(201).json({ reference, status: "submitted", whatsappSent });
});

// Outbound telephony is intentionally disabled. The live demo runs on a phone browser over HTTPS.
app.post("/api/call", (_req, res) => {
  res.status(410).json({ error: "Outbound phone calls are disabled. Use the in-app Sarvam voice session." });
});

// Starts a voice session inside the page: picks the customer tools will load and returns non-secret Sarvam config.
app.post("/api/session", (req, res) => {
  const customer = data.customers[String(req.body?.userId ?? "")];
  if (!customer) {
    res.status(400).json({ error: "unknown userId" });
    return;
  }
  try {
    activeUserId = customer.userId;
    activity.length = 0;
    log("call", { customer: customer.name, channel: "app" });

    const version = Number(process.env.SARVAM_AGENT_VERSION);
    const config: SarvamSessionConfig = {
      orgId: requiredEnv("SARVAM_ORG_ID"),
      workspaceId: requiredEnv("SARVAM_WORKSPACE_ID"),
      appId: requiredEnv("SARVAM_APP_ID"),
      version: Number.isInteger(version) && version > 0 ? version : undefined,
      userIdentifier: customer.userId,
      agentVariables: {
        user_id: customer.userId,
        customer_name: customer.name,
        today: data.today,
      },
    };
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Sarvam session is not configured" });
  }
});

// Sarvam browser SDK proxy. The browser gets a signed WebSocket URL without ever seeing SARVAM_API_KEY.
app.use("/api/sarvam", async (req, res) => {
  try {
    const target = new URL(req.url.replace(/^\/+/, ""), SARVAM_RUNTIME_BASE);
    const headers = new Headers();
    headers.set("X-API-Key", requiredEnv("SARVAM_API_KEY"));
    const accept = req.get("accept");
    if (accept) headers.set("accept", accept);
    if (req.body && Object.keys(req.body).length > 0) headers.set("content-type", "application/json");

    const response = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    res.status(response.status);
    const contentType = response.headers.get("content-type");
    const retryAfter = response.headers.get("x-retry-after");
    if (contentType) res.setHeader("content-type", contentType);
    if (retryAfter) res.setHeader("x-retry-after", retryAfter);
    res.send(text);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Sarvam proxy failed" });
  }
});

// The demo page polls this to show what the agent did during the call.
app.get("/api/activity", (_req, res) => {
  res.json(activity);
});

const PORT = Number(process.env.PORT) || 5001;

app.listen(PORT, (error) => {
  if (error) throw error;
  console.log(`Backend running on port ${PORT}`);
});
