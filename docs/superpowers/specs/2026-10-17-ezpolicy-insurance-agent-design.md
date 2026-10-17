# ezpolicy — Health Insurance Renewal & Advisor Voice Agent

Design doc · 17 Oct 2026 · Bachatt × Digia Voice AI Buildathon (Fintech track)
Status: **approved 12:10 IST; building.**

**Updates after review (12:30 IST) — these override the sections below:**

- **Real phone call, not a browser call.** A button in the page calls `POST /api/call`. The backend asks ElevenLabs to dial `DEMO_PHONE` from `.env` (the only number it ever dials) through a Twilio number imported into ElevenLabs. During a phone call there is no browser in the loop, so `get_quotes` and `submit_proposal` are **webhook (server) tools** that reach the backend through an ngrok tunnel. `fill_proposal` is dropped. The page polls `GET /api/activity` to show the quotes and the proposal reference live. Setup steps, prompt and rules sheet: `agent/setup.md`.
- **Submission at 3:30 = a basic working demo of the app.**
- **"Cycle check-in", not "renewal".** All policies are new (June 2026 onwards) and run on 30-day AutoPay cycles, so a cycle end is a billing date. The agent never says "renewal due" and never warns about grace periods or lapses. Read "renewal" below as "cycle check-in"; the grace-period rule is removed from the rules sheet.
- **Why not switch to ICICI** (₹24/month cheaper for Abhishek): porting keeps waiting-period credit, but the new insurer underwrites afresh and may decline or charge more given Payal's history. That risk isn't worth ₹288 a year. This replaces "lose years of continuity".

## 1. What and why

Families on pay-as-you-go health cover (premium debited daily or monthly by UPI AutoPay) rarely revisit their policy. Two moments cost them money and protection:

- **Buying:** they pick a plan without matching it to their family, ages, health history and budget.
- **Renewal, or after a health change:** they let the policy lapse, or switch to a "better" plan, without knowing that a fresh policy treats a known condition as pre-existing (waiting period up to 3 years) and throws away the continuity they have built.

ezpolicy is a voice agent (Hindi or English) that:

1. **Renewal call (main demo):** "calls" the customer as their policy cycle ends, asks what changed (new diagnosis, new family member, budget), and recommends renew / raise cover / add top-up / switch, with every price taken from the data. It then fills and submits the renewal + top-up proposal on screen.
2. **Pre-purchase advisor (stretch):** the user calls in; the agent asks about family, ages, health and budget, and recommends a plan.

Handbook fit: "Act for me" problem space; idea-library item "Catches the renewal before it lapses and sets it up". Follows the handbook loop: raw data → financial picture → understanding → recommendation → action.

## 2. Goals, non-goals, anti-goals

**Goals**

- G1. One working renewal call for a real dataset customer, in a browser, in Hindi or English.
- G2. Every number the agent says comes from the dataset through a tool: premiums from `premium_rate_cards`, members and conditions from `policy_members`, current plan from `policies` / `applications`.
- G3. Tell the user something they didn't know: their cover gap, the top-up deductible gap, the continuity risk of switching or lapsing.
- G4. One action gets done: a renewal / top-up proposal is filled on screen and submitted (mock), with a reference number.
- G5 (stretch). Pre-purchase mode with the same agent.

**Non-goals (today)**

- Real phone calls or telephony (handbook: a browser link is enough).
- Real purchase, payment or insurer integration.
- WhatsApp, logins, dashboards (handbook skip list).
- Term or life insurance. Scope is medical (health) insurance only.
- HDFC or any insurer not in the dataset — no prices, so nothing to quote.
- Insurer-brochure RAG (stretch, only after a mentor confirms it fits "event dataset only").

**Anti-goals (a failure even if it "works")**

- The agent states a premium, cover amount, deductible or rule that did not come from a tool, the profile or the rules sheet.
- The agent predicts disease ("you may get cancer") or gives medical advice.
- The agent recommends a fresh policy after a diagnosis without explaining waiting-period risk, or implies that valid portability necessarily loses continuity credits.
- Long monologues, or a voice that can't be interrupted.
- Any real personal data in the demo.

## 3. Constraints

- **Time:** build ends **3:00 PM**; demo submission closes **3:30 PM** (late entries are not judged). Mentors pick a final five; 4–6 PM live demos, 3 minutes each, a judge plays the user.
- **Rules:** voice is mandatory; event dataset only (no real financial data); B2C only; generic voices only (no cloning); own voice-platform account, no event credits.
- **Judging:** Understands (data read right, nothing made up) · Recommends (something useful they didn't know) · Acts (something got done) · Voice (natural, quick, handles interruptions, Hindi or English).
- **Repo today:** pnpm workspace.
  - `backend/`: Express 5 on Node 24 native TypeScript (`node --watch src/index.ts`; relative imports need the `.ts` extension). Only `GET /api/health` exists.
  - `frontend/`: React 19 + Vite 8 + TypeScript 7. `pnpm -F frontend lint` is broken on TS 7 — ignore lint. `vite.config.ts` has no `/api` proxy yet.
  - `docker-compose.yaml` exists (including a WAHA WhatsApp service) but is not used for the demo.
- **Accounts:** ElevenLabs account with a payment method. No ElevenLabs config exists in the repo yet.

## 4. Data (event dataset)

Source: `~/Desktop/buildathon_data.zip` → `buildathon/insurance/*.csv`. Copy only what is needed into `backend/data/` and add that folder to `.gitignore` (organisers' data; the repo is on GitHub).

| Table | Used for | Key columns |
|---|---|---|
| `insurance_products` | the 3 plans | `product_id`, `product_type` (`base_cover` / `super_topup`), `insurer_code`, `billing_cadence`, `cover_amount_options` |
| `premium_rate_cards` | every price | `product_id`, `cover_amount`, `adult_count`, `child_count`, `eldest_age_band_min`, `eldest_age_band_max`, `premium_amount`, `deductible_amount` |
| `policies` | current plan, renewal date | `user_id`, `application_id`, `product_id`, `status`, `current_cycle_start`, `current_cycle_end`, `next_payment_at`, `cycle_premium` |
| `applications` | current cover, family size | `application_id`, `cover_amount`, `adult_count`, `child_count`, `eldest_age`, `address` |
| `policy_members` | who is covered, health | `application_id`, `relationship`, `first_name`, `last_name`, `dob`, `has_pre_existing_disease`, `disease_flags`, `ped_since` |

The CSVs contain quoted list fields such as `["diabetes", "heart_surgery"]`; parse them with a real CSV parser, never by splitting on commas.

**Plans in the data**

| Plan | Billing | Cover options | Price rows |
|---|---|---|---|
| Care Health base cover | daily | ₹1L / ₹3L / ₹5L | 144 |
| ICICI Lombard base cover | monthly | ₹1L / ₹3L / ₹5L | 108 |
| Care Health super top-up | monthly | ₹10L, **₹5L deductible** | 30 |

Age bands differ by product (Care uses bands like 46–50; ICICI uses wider bands like 36–45). Always match on the eldest member's age falling within `eldest_age_band_min`–`max`.

Sample prices, 2 adults + 2 children: Care, eldest 46–50: ₹70 / ₹86 / ₹99 per day for ₹1L / ₹3L / ₹5L. ICICI, eldest 36–45: ₹1,469 / ₹2,186 / ₹3,253 per month. Top-up, eldest 18–35: ₹482 per month.

**Size:** 586 active policies; 2,902 covered members, 225 with a pre-existing disease (diabetes 87, general surgery 80, organ replacement 77, others 71, heart surgery 63); 50 active family policies include a member with a pre-existing disease.

**"Today" = 14 Oct 2026.** Active cycles end between 14 Oct and 12 Nov 2026, so the data snapshot is 14 Oct. Pass this to the agent as its date, otherwise every renewal looks overdue.

**Demo customers** (both on Care Health daily base cover, current cycle 16 Sep – 15 Oct):

- **Abhishek Chopra** — primary. `user_id 1590824686249448`, Ahmedabad. Self (born 1993) + spouse Payal (born 1994; diabetes and heart surgery, since 2010). Cover ₹5L at ₹41/day.
  Story: his ₹5L base cover lines up exactly with the top-up's ₹5L deductible, so adding the ₹10L super top-up (2 adults, eldest 18–35: ₹275/month) creates a nominal ₹15L base-plus-top-up structure, subject to underwriting, waiting periods and policy terms; it is not a promise of immediate ₹15L claim eligibility. Buying a fresh ICICI policy can introduce fresh waiting periods for Payal's conditions; valid portability can preserve eligible waiting-period credit. Never imply that every insurer switch resets continuity.
- **Lalit Deshpande** — backup, and proof it works for anyone. `user_id 1706244642983364`, Tiruvallur. Self (born 1979; heart surgery and organ replacement, since 2010), spouse Simran, children Vivaan (2023) and Sakshi (2012). Cover only ₹1L at ₹70/day.
  Story: a top-up alone won't help, because its ₹5L deductible sits above his ₹1L base and leaves a ₹4L gap the family pays. Raise the base to ₹5L (₹99/day) first.

## 5. How it works (decided)

```
backend/data/*.json   ← one-time extract from the zip
        │
Express backend (:5001)
  GET  /api/customer/:userId  → profile: members, conditions, current plan, cover, premium, cycle end
  POST /api/quotes            → rate-card lookup, ranked by monthly cost
  POST /api/proposals         → stores the submitted proposal in memory, returns a reference
        ▲   Vite proxies /api → :5001
Browser (:5173)
  "ezpolicy calling…" screen → @elevenlabs/react session with dynamic variables
  live transcript · quotes table · proposal card that fills during the call
        ▲
ElevenLabs agent (configured in the dashboard)
  system prompt + rules sheet (knowledge base) + client tools: get_quotes, fill_proposal, submit_proposal
```

### Backend

- **Extract once:** a script reads the five CSVs straight from the zip and writes compact JSON into `backend/data/`. The server loads the JSON at startup.
- **`GET /api/customer/:userId`** returns: name, city, insurer, product type, billing cadence, cover amount, premium per cycle, cycle start / end, next payment, and each member's name, relationship, age (as of 14 Oct 2026), conditions and `ped_since`. Also `adults`, `children`, `eldestAge`.
- **`POST /api/quotes`** with `{ adults, children, eldestAge, budgetMonthly?, includeTopUp? }` returns every matching rate-card row as `{ productId, insurer, productType, cadence, cover, premium, monthlyCost, deductible, withinBudget }`, sorted by `monthlyCost`.
  - Daily → monthly = premium × 30; say so in the response.
  - No matching row for a combination → return nothing for it. Never interpolate.
- **`POST /api/proposals`** with `{ userId, productId, cover, addTopUp, declaredConditions, notes }` returns `{ reference: "EZP-" + 6 digits, status: "submitted" }` and keeps the proposal in an in-memory array. This is the "something got done" in the demo.

### Agent (ElevenLabs dashboard)

- **Dynamic variables** at session start: `customer_name`, `today` (2026-10-14), `mode` (`renewal` | `new`), `cycle_end`, `customer_profile` (the `/api/customer` JSON).
- **First message (renewal), e.g.:** "Namaste {{customer_name}} ji, main ezpolicy hoon. Aapki health policy {{cycle_end}} ko renew hone wali hai — do minute baat kar sakte hain?"
- **Prompt rules:**
  - Never state a price, cover or deductible unless it came from `get_quotes` or the profile. Never do arithmetic; `get_quotes` already returns monthly cost.
  - Before recommending, ask at most three things: anything newly diagnosed or any hospital stay; any change in family (new child, parents to add); monthly budget.
  - If anyone has a condition (old or new), explain continuity before any switch: a fresh policy may apply a PED waiting period (up to 3 years under the referenced framework); valid portability can preserve eligible credits. Never infer continuous insured years from `ped_since` or the current billing cycle. Explain moratorium or grace only from reviewed, applicable rules.
  - Explain the top-up deductible whenever the base cover is below it.
  - Never predict illness; no medical advice. This is guidance, not a sale; any new cover is subject to the insurer's acceptance.
  - Say the final choice out loud, call `fill_proposal`, read back the summary, and call `submit_proposal` only after an explicit yes.
  - At most two sentences per turn. Mirror the user's language (Hindi, English or Hinglish).
- **Client tools**, each set to wait for the response (blocking) in the dashboard:
  - `get_quotes` → `POST /api/quotes`, returns the JSON.
  - `fill_proposal` → updates the proposal card on screen, returns "ok".
  - `submit_proposal` → `POST /api/proposals`, returns the reference.
- **Knowledge base:** the rules sheet in section 6 as text, in full-context mode (it is short). Insurer brochures via RAG are a stretch goal.
- **Language:** English plus Hindi as an additional language, with automatic language detection. A generic stock voice.
- **Turn-taking and interruptions:** platform defaults.
- **Access:** public agent (agent ID in the frontend) for the hackathon; disable it or make it private after the event.

### Frontend

- One page.
  - Left: incoming-call card ("ezpolicy calling…", customer name, Accept / Decline). On accept, fetch `/api/customer/:id` and start the ElevenLabs session with the dynamic variables. Show status, a speaking indicator and the live transcript.
  - Right: quotes table (after `get_quotes`), proposal card (filled by `fill_proposal`), confirmation badge with the reference (after `submit_proposal`).
- A switcher between the two demo customers (shows it is not hard-coded).
- Add `server.proxy: { '/api': 'http://localhost:5001' }` to `vite.config.ts`. Agent ID from `VITE_ELEVENLABS_AGENT_ID` in `frontend/.env.local` (already gitignored).

## 6. Provisional rules sheet (review before knowledge-base upload)

Sources are secondary summaries of IRDAI's Master Circular on Health Insurance Business (29 May 2024). Review the primary circular, applicability and subsequent amendments before using these as current guidance. Item 7 needs evidence from additional event tables; it is not established by the five-table import. See the implementation companion for evidence limitations.

1. **Pre-existing disease (PED) waiting period:** at most 3 years (it was 4). A condition that exists before a new policy starts is a PED for that policy.
2. **Moratorium:** after 5 continuous years of cover (it was 8), the insurer can't contest a claim for non-disclosure, except proven fraud and permanent exclusions in the policy.
3. **Portability:** moving insurer through portability carries waiting-period credit, and the old insurer's years count toward the moratorium. Buying a fresh policy instead does not.
4. **Grace period:** The referenced framework describes 15 days for monthly instalments and 30 days for quarterly, half-yearly or annual instalments. Do not map a daily AutoPay debit to a policy instalment frequency or invent a daily-product grace period. Confirm the actual policy terms before giving a deadline or promising cover during a missed payment.
5. **Super top-up:** pays only once the year's bills cross the deductible (₹5L here). If the base cover is smaller than the deductible, the family pays the bills between the two.
6. **Raising cover:** any increase (higher base cover or a new top-up) is new cover. The insurer may underwrite it, and waiting periods usually apply afresh to the increase. Declare all conditions.
7. **Unverified product rule — omit from the agent until checked:** the original design claims cancelling AutoPay while premiums are unpaid blocks repurchase. This requires validation against `insurance_eligibility_blocks` and `receivables`; those tables are outside the five-table import.

## 7. Demo (3 minutes, live; a judge plays Abhishek)

- **0:00–0:20 — who it's for:** "Families on pay-as-you-go health cover lose years of waiting-period credit when a renewal slips or they switch in a hurry. ezpolicy calls first."
- **0:20–2:20 — the call:** the agent opens on the renewal and asks what changed. The judge mentions a health change or a budget. The agent pulls quotes, distinguishes fresh-purchase risk from portability credits, and recommends renewal plus considering the ₹10L top-up at ₹275/month if affordable. It explains that the nominal ₹15L structure is subject to underwriting and new-cover waiting periods. The judge chooses an option and explicitly approves mock submission after readback.
- **2:20–3:00 — what got done:** the proposal card filled live and the reference number.
- **If it breaks:** say what should have happened and move on.
- **Backup:** screen recording of one full successful call, made by 2:50 PM.

## 8. Plan

| Time | Person A — data + backend + page | Person B — agent + tools | Done when |
|---|---|---|---|
| 12:10–12:50 | Extract JSON; `/api/customer`, `/api/quotes`; Vite proxy | ElevenLabs signup + payment; create agent; prompt; rules sheet; voice | `/api/quotes` matches the rate card for Abhishek |
| 12:50–1:30 | `/api/proposals`; check quotes for both customers | Client tools defined in the dashboard; test call in the dashboard with the profile pasted in | Agent recommends correctly in English → **Level 2** |
| 1:30–2:20 | Page: call card, session, transcript | Wire client tools to the UI cards; dynamic variables | Full call in the browser, proposal submitted → **Level 3** |
| 2:20–2:40 | Hindi on; test on someone outside the team; shorten replies | ← same | They follow it unaided |
| 2:40–3:00 | Record the backup video; submit | ← same | Submitted before 3:15 PM |

Solo: same order, one person.

**Cut order if behind (final fallback below the full acceptance target):** pre-purchase mode → customer switcher → Hindi → proposal card (stop at Level 2: quotes + recommendation).

**Stretch (only if Level 3 works by 2:15):** pre-purchase mode (`mode=new`: the agent asks family, ages, health and budget, then calls `get_quotes`); insurer brochure PDFs in the knowledge base (mentor OK first).

## 9. Left to the builder

- Extraction script details and file layout in `backend/data/`.
- Exact prompt wording, first message, voice choice.
- UI layout and styling.
- Exact JSON shapes beyond the fields listed above.

## 10. Calls made for you (check these)

- Main demo = renewal call; pre-purchase = stretch.
- HDFC is out (no data): Care Health vs ICICI Lombard, plus the Care top-up.
- "Today" inside the agent = 14 Oct 2026.
- Primary demo customer = Abhishek Chopra; backup = Lalit Deshpande.
- Public ElevenLabs agent; extracted data gitignored; Docker and WAHA unused for the demo.

## 11. Implementation companion

See [the detailed implementation plan](../plans/2026-10-17-ezpolicy-implementation-plan.md) for file ownership, API contracts, server calculations, agent tools, build phases and acceptance checks. This design remains a proposal; dataset figures above have not been revalidated in this checkout. The ZIP is currently missing at the documented location.
