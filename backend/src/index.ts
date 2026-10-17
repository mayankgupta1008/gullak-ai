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

type Member = {
  name: string;
  relationship: string;
  age: number;
  conditions: string[];
  conditionsSince: number | null;
};

type Policy = {
  policyId: string;
  productId: string;
  insurer: string;
  productType: string;
  cadence: "daily" | "monthly";
  cover: number;
  premium: number;
  cycleEnd: string;
  deductible?: number;
};

type Customer = {
  userId: string;
  name: string;
  members: Member[];
  adults: number;
  children: number;
  eldestAge: number;
  policies: Policy[];
};

type SarvamSessionConfig = {
  orgId: string;
  workspaceId: string;
  appId: string;
  version?: number;
  userIdentifier: string;
  agentVariables: Record<string, string>;
};

type ProposalBody = {
  userId?: unknown;
  customerName?: unknown;
  productId?: unknown;
  cover?: unknown;
  addTopUp?: unknown;
  declaredConditions?: unknown;
  personDetails?: unknown;
  notes?: unknown;
};

type PersonDetailsBody = {
  customerName?: unknown;
  existingInsurance?: unknown;
  existingInsurer?: unknown;
  existingCover?: unknown;
  existingPolicyNotes?: unknown;
  adults?: unknown;
  children?: unknown;
  eldestAge?: unknown;
  declaredConditions?: unknown;
  budgetMonthly?: unknown;
};

type PersonDetails = {
  customerName: string;
  existingInsurance: boolean | null;
  existingInsurer: string;
  existingCover: number | null;
  existingPolicyNotes: string;
  adults: number | null;
  children: number | null;
  eldestAge: number | null;
  declaredConditions: string;
  budgetMonthly: number | null;
};

// Built from the event dataset by scripts/extract_insurance.py
const data: { today: string; rateCards: RateCard[]; customers: Record<string, Customer> } = JSON.parse(
  readFileSync(new URL("../data/insurance.json", import.meta.url), "utf8"),
);

// ponytail: one demo call at a time, all in memory; fine for a prototype
let activeUserId: string | null = null;
let activePersonDetails: PersonDetails | null = null;
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

const CONFIGURED_DEMO_USER_IDS = (process.env.DEMO_USER_IDS ?? "1590824686249448,1706244642983364")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const DEMO_USER_IDS = CONFIGURED_DEMO_USER_IDS.filter((id) => data.customers[id]);
const DEFAULT_USER_ID = DEMO_USER_IDS[0] ?? Object.keys(data.customers)[0];
const SARVAM_RUNTIME_BASE = process.env.SARVAM_RUNTIME_BASE ?? "https://apps.sarvam.ai/api/app-runtime/";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function customerProfile(customer: Customer) {
  return { today: data.today, ...customer };
}

function voiceContext(customer: Customer) {
  const policy = customer.policies[0];
  const quoteSummary = data.rateCards
    .filter((r) => r.adults === customer.adults && r.children === customer.children && r.ageMin <= customer.eldestAge && customer.eldestAge <= r.ageMax)
    .map((r) => {
      const monthlyCost = r.cadence === "daily" ? r.premium * 30 : r.premium;
      return `${r.productId}: ${r.insurer} ${r.productType} cover ${r.cover} deductible ${r.deductible} monthlyCost ${monthlyCost}`;
    })
    .sort()
    .join("; ");
  const memberSummary = customer.members
    .map((member) => {
      const conditions = member.conditions.length ? ` conditions ${member.conditions.join(", ")}` : " no declared conditions";
      const since = member.conditionsSince ? ` since ${member.conditionsSince}` : "";
      return `${member.name} ${member.relationship} age ${member.age}${conditions}${since}`;
    })
    .join("; ");
  const policySummary = policy
    ? `${policy.insurer} ${policy.productType} cover ${policy.cover} premium ${policy.premium} ${policy.cadence} cycleEnd ${policy.cycleEnd}`
    : "No active policy";
  return {
    customer_summary: `${customer.name}; today ${data.today}; adults ${customer.adults}; children ${customer.children}; eldestAge ${customer.eldestAge}; members ${memberSummary}; current policy ${policySummary}`,
    member_summary: memberSummary,
    current_policy_summary: policySummary,
    quote_summary: quoteSummary,
    customer_profile: JSON.stringify(customerProfile(customer)),
  };
}

function optionalWholeNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function optionalMoney(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function optionalBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();
    if (["true", "yes", "haan", "ha", "y"].includes(normalised)) return true;
    if (["false", "no", "nahin", "nahi", "n"].includes(normalised)) return false;
  }
  return null;
}

function personDetailsContext(details: PersonDetails): string {
  const existingInsurance =
    details.existingInsurance === null
      ? "existing health insurance not answered"
      : details.existingInsurance
        ? `has existing health insurance${details.existingInsurer ? ` with ${details.existingInsurer}` : ""}${details.existingCover ? `, cover ${details.existingCover}` : ""}${details.existingPolicyNotes ? `, notes ${details.existingPolicyNotes}` : ""}`
        : "no existing health insurance";
  const family = `adults ${details.adults ?? "unknown"}, children ${details.children ?? "unknown"}, eldestAge ${details.eldestAge ?? "unknown"}`;
  const health = details.declaredConditions ? `declared conditions: ${details.declaredConditions}` : "no declared conditions mentioned";
  const budget = details.budgetMonthly ? `budgetMonthly ${details.budgetMonthly}` : "budget not answered";
  return `Buyer ${details.customerName || "name not answered"}; ${existingInsurance}; ${family}; ${health}; ${budget}.`;
}

// Tool: the agent calls this first on every call (phone, WhatsApp or web) to load who it's talking to.
// Must stay above /api/customer/:userId.
app.get("/api/customer/active", (_req, res) => {
  const customer = data.customers[activeUserId ?? DEFAULT_USER_ID];
  if (!activity.length) log("call", {});
  res.json(customerProfile(customer));
});

// Fast voice tool: compact, preformatted facts for the LLM. This avoids making Sarvam infer from a large JSON blob.
app.get("/api/customer/active/voice-context", (_req, res) => {
  const customer = data.customers[activeUserId ?? DEFAULT_USER_ID];
  if (!activity.length) log("call", {});
  res.json({ message_to_llm: voiceContext(customer).customer_summary, ...customerProfile(customer) });
});

app.get("/api/customer/:userId", (req, res) => {
  const customer = data.customers[req.params.userId];
  if (!customer) {
    res.status(404).json({ error: "customer not found" });
    return;
  }
  res.json(customerProfile(customer));
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

// Tool: the agent calls this after collecting buyer details, before quoting.
app.post("/api/person-details", (req, res) => {
  const body = req.body as PersonDetailsBody;
  const adults = optionalWholeNumber(body.adults);
  const children = optionalWholeNumber(body.children);
  const eldestAge = optionalWholeNumber(body.eldestAge);
  if (adults === null || children === null || eldestAge === null) {
    res.status(400).json({ error: "adults, children and eldestAge are required whole numbers" });
    return;
  }

  activePersonDetails = {
    customerName: String(body.customerName ?? "").trim(),
    existingInsurance: optionalBoolean(body.existingInsurance),
    existingInsurer: String(body.existingInsurer ?? "").trim(),
    existingCover: optionalMoney(body.existingCover),
    existingPolicyNotes: String(body.existingPolicyNotes ?? "").trim(),
    adults,
    children,
    eldestAge,
    declaredConditions: String(body.declaredConditions ?? "").trim(),
    budgetMonthly: optionalMoney(body.budgetMonthly),
  };

  const context = personDetailsContext(activePersonDetails);
  log("person_details", { personDetails: activePersonDetails, context });
  res.json({ status: "saved", personDetails: activePersonDetails, message_to_llm: context });
});

app.get("/api/person-details/active", (_req, res) => {
  res.json({ personDetails: activePersonDetails, message_to_llm: activePersonDetails ? personDetailsContext(activePersonDetails) : "" });
});

// Tool: the voice agent calls this after the customer says yes.
app.post("/api/proposals", async (req, res) => {
  const body = req.body as ProposalBody;
  const productId = String(body.productId ?? "").trim();
  const cover = Number(body.cover);
  if (!productId || !Number.isFinite(cover)) {
    res.status(400).json({ error: "productId and cover are required" });
    return;
  }
  const customerName = String(body.customerName ?? "").trim() || "customer";
  const reference = `EZP-${randomInt(100000, 1000000)}`;
  const whatsappSent = await sendWhatsApp(
    `ezpolicy: proposal ${reference} submitted for ${customerName}.\n${body.notes ?? ""}\n` +
      "Demo prototype: any new cover is subject to the insurer's approval.",
  );
  log("proposal", { productId, cover, addTopUp: Boolean(body.addTopUp), reference, whatsappSent, personDetails: activePersonDetails });
  res.status(201).json({ reference, status: "submitted", whatsappSent });
});

// Outbound telephony is intentionally disabled. The live demo runs on a phone browser over HTTPS.
app.post("/api/call", (_req, res) => {
  res.status(410).json({ error: "Outbound phone calls are disabled. Use the in-app Sarvam voice session." });
});

// Starts a new-buyer voice session inside the page. Customer facts are collected by the agent, not preloaded.
app.post("/api/session", (req, res) => {
  const requestedUserId = String(req.body?.userId ?? "");
  const customer = requestedUserId ? data.customers[requestedUserId] : null;
  if (requestedUserId && !customer) {
    res.status(400).json({ error: "unknown customer" });
    return;
  }
  try {
    activeUserId = customer?.userId ?? null;
    activePersonDetails = null;
    activity.length = 0;
    log("call", { channel: "app" });

    const version = Number(process.env.SARVAM_AGENT_VERSION);
    const sessionId = customer?.userId ?? `new-buyer-${Date.now().toString(36)}-${randomInt(1000, 10000)}`;
    const config: SarvamSessionConfig = {
      orgId: requiredEnv("SARVAM_ORG_ID"),
      workspaceId: requiredEnv("SARVAM_WORKSPACE_ID"),
      appId: requiredEnv("SARVAM_APP_ID"),
      version: Number.isInteger(version) && version > 0 ? version : undefined,
      userIdentifier: sessionId,
      agentVariables: {
        user_id: customer?.userId ?? "",
        customer_name: customer?.name ?? "",
        today: data.today,
        adults: customer ? String(customer.adults) : "",
        children: customer ? String(customer.children) : "",
        eldestAge: customer ? String(customer.eldestAge) : "",
        purchase_mode: customer ? "existing_customer" : "new_purchase",
        customer_summary: customer ? voiceContext(customer).customer_summary : "",
        member_summary: customer ? voiceContext(customer).member_summary : "",
        current_policy_summary: customer ? voiceContext(customer).current_policy_summary : "",
        quote_summary: customer ? voiceContext(customer).quote_summary : "",
        customer_profile: customer ? voiceContext(customer).customer_profile : "",
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
