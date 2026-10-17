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

// Built from the event dataset by scripts/extract_insurance.py
const data: { today: string; rateCards: RateCard[]; customers: Record<string, Customer> } = JSON.parse(
  readFileSync(new URL("../data/insurance.json", import.meta.url), "utf8"),
);

// ponytail: one demo call at a time, all in memory; fine for a prototype
let activeUserId: string | null = null;
const activity: object[] = [];
const log = (type: string, detail: object) => activity.push({ type, at: new Date().toISOString(), ...detail });

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/customer/:userId", (req, res) => {
  const customer = data.customers[req.params.userId];
  if (!customer) {
    res.status(404).json({ error: "customer not found" });
    return;
  }
  res.json({ today: data.today, ...customer });
});

// Tool: the voice agent calls this (ElevenLabs webhook) before saying any price.
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
app.post("/api/proposals", (req, res) => {
  const userId = String(req.body?.userId ?? activeUserId ?? "");
  if (!data.customers[userId]) {
    res.status(400).json({ error: "unknown userId" });
    return;
  }
  const reference = `EZP-${randomInt(100000, 1000000)}`;
  log("proposal", { ...req.body, userId, reference });
  res.status(201).json({ reference, status: "submitted" });
});

// Starts a real phone call: ElevenLabs agent dials out through the Twilio number linked in ElevenLabs.
app.post("/api/call", async (req, res) => {
  const customer = data.customers[String(req.body?.userId ?? "")];
  if (!customer) {
    res.status(400).json({ error: "unknown userId" });
    return;
  }
  const cycleEnd = new Date(customer.policies[0].cycleEnd).toLocaleDateString("en-IN", { day: "numeric", month: "long" });
  const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "", "content-type": "application/json" },
    body: JSON.stringify({
      agent_id: process.env.ELEVENLABS_AGENT_ID,
      agent_phone_number_id: process.env.ELEVENLABS_PHONE_NUMBER_ID,
      // Only ever dials our own number from .env, so the public tunnel can't be used to call anyone else.
      to_number: process.env.DEMO_PHONE,
      conversation_initiation_client_data: {
        dynamic_variables: {
          customer_name: customer.name.split(" ")[0], // "Abhishek ji" sounds natural on a call
          today: data.today,
          cycle_end: cycleEnd,
          customer_profile: JSON.stringify(customer),
        },
      },
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    res.status(502).json({ error: "ElevenLabs outbound call failed", detail: result });
    return;
  }
  activeUserId = customer.userId;
  activity.length = 0;
  log("call", { customer: customer.name, ...result });
  res.json(result);
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
