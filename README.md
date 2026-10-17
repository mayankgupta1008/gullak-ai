# Gullak AI

A voice agent that phones a family about their health insurance before their next cover cycle. It asks what changed (health, family, budget), recommends the right cover using real prices from the event dataset, and submits the change the customer agrees to.

Built for the **Bachatt × Digia Voice AI Buildathon** (Fintech track), 17 Oct 2026, Gurugram.
Deadlines: build ends **3:00 PM IST**; a basic working demo is submitted by **3:30 PM**; the final five demo live 4–6 PM.

> **Agents picking this up in a new chat:** read this file first, then `docs/superpowers/specs/2026-10-17-gullak-insurance-agent-design.md` (design and decisions) and `agent/setup.md` (agent prompt, tools, phone setup). **Update the Status table after every change.**

## Status

| Step | State |
| --- | --- |
| 1. Extract insurance data from the event zip | ✅ `scripts/extract_insurance.py` → `backend/data/insurance.json` |
| 2. Backend API: customer, quotes, proposals | ✅ tested with curl, typecheck passes |
| 3. `POST /api/call` (ElevenLabs outbound call via Twilio) + activity log | ✅ code tested; returns 502 until the `.env` keys are set |
| 4. ElevenLabs agent + Twilio number + ngrok (manual, see `agent/setup.md`) | ⏳ in progress (user) |
| 5. Frontend home page: responsive ezpolicy design, Hindi/English interactive preview, cover explorer, FAQs, customer picker, demo call and live activity; Vite `/api` proxy | ✅ production build and design source lint pass; browser inspection blocked by sandbox. Root `pnpm dev` runs the home page without `.env`; `.env.example` documents voice credentials; Docker proxy targets backend service |
| 6. End-to-end test call (Hindi + English), backup video, submit | ⏳ |

## How the demo works

1. The page shows a demo customer and a **Call** button.
2. `POST /api/call`: the backend asks ElevenLabs to dial `DEMO_PHONE` (our own phone) from the Twilio number imported into ElevenLabs, passing the customer's profile as dynamic variables.
3. The ElevenLabs agent "Gullak" (Hindi or English) runs a two-minute **cycle check-in**: new diagnoses, family changes, budget.
4. During the call it uses webhook tools on our backend through an ngrok HTTPS tunnel:
   - `get_quotes` → `POST /api/quotes` (real premiums from the rate cards)
   - `submit_proposal` → `POST /api/proposals` (returns a `GUL-xxxxxx` reference)
5. The page polls `GET /api/activity` and shows the quotes and the proposal reference live.

```text
Browser (Vite :5173) ── POST /api/call ──► Express backend (:5001) ──► ElevenLabs outbound-call API ──► Twilio ──► phone
        ▲                                        ▲
        └──── GET /api/activity (polling) ───────┤
                                                 └── ngrok HTTPS ◄── ElevenLabs agent webhook tools (get_quotes, submit_proposal)
```

## Repo layout

| Path | What |
| --- | --- |
| `backend/src/index.ts` | All API routes (Express 5 on Node 24 native TypeScript) |
| `backend/data/insurance.json` | Extracted dataset; gitignored, rebuild with the script |
| `scripts/extract_insurance.py` | Reads the event zip, writes `insurance.json`, self-checks prices |
| `agent/setup.md` | ElevenLabs agent prompt, rules sheet, tool definitions, Twilio and ngrok steps |
| `frontend/` | React 19 + Vite 8 ezpolicy home page and demo call controls |
| `docs/superpowers/specs/2026-10-17-gullak-insurance-agent-design.md` | Design doc and decisions |
| `docker-compose.yaml` | `frontend`, `backend`, and `waha` (unused: WhatsApp is on the handbook skip list) |

## Data

Source: `~/Desktop/buildathon_data.zip` → `buildathon/insurance/*.csv` (event mock data; never commit it).
Tables used: `insurance_products`, `premium_rate_cards`, `policies`, `applications`, `policy_members`.

- 3 plans: Care Health base cover (billed daily; ₹1/3/5 lakh), ICICI Lombard base cover (monthly; ₹1/3/5 lakh), Care Health super top-up (monthly; ₹10 lakh with a ₹5 lakh deductible).
- 282 rate-card rows (price by cover × adults × children × eldest-age band); 586 active customers.
- "Today" in the data is **2026-10-14**; member ages are computed as of that date.
- Self-check: 583 of 586 active policies reproduce their actual premium from the rate card.

Demo customers:

- `1590824686249448` **Abhishek Chopra** (primary): self 33, spouse Payal 32 (diabetes and heart surgery since 2010). Care ₹5L at ₹41/day = ₹1,230/month. ICICI ₹5L is ₹1,206/month; the ₹10L top-up is ₹275/month.
- `1706244642983364` **Lalit Deshpande** (backup): family of 4; self 46 (heart surgery and organ replacement since 2010). Care ₹1L at ₹70/day, which is below the top-up's ₹5L deductible.

## API

| Route | Body | Returns |
| --- | --- | --- |
| `GET /api/health` | | `{ status }` |
| `GET /api/customer/:userId` | | profile: members (age, conditions, conditionsSince), adults, children, eldestAge, policies, today |
| `POST /api/quotes` | `{ adults, children, eldestAge, budgetMonthly? }` (numbers or numeric strings) | `{ note, quotes[] }`; each quote has productId, insurer, productType, cadence, cover, premium, deductible, monthlyCost (daily × 30), withinBudget; sorted by monthlyCost |
| `POST /api/proposals` | `{ userId?, productId, cover, addTopUp, declaredConditions?, notes? }`; userId defaults to the active call's customer | `{ reference: "GUL-xxxxxx", status }` |
| `POST /api/call` | `{ userId }` | ElevenLabs response (`conversation_id`, …); 502 with ElevenLabs' error if the call fails |
| `GET /api/activity` | | events for the current call: `call`, `quotes`, `proposal` |

## Environment (`.env`, gitignored)

| Key | Meaning |
| --- | --- |
| `ELEVENLABS_API_KEY` | ElevenLabs API key |
| `ELEVENLABS_AGENT_ID` | ID of the agent "Gullak" |
| `ELEVENLABS_PHONE_NUMBER_ID` | ID of the Twilio number imported into ElevenLabs |
| `DEMO_PHONE` | Our own phone in E.164 (`+91…`); the only number `/api/call` ever dials |
| `WAHA_*` | Unused WhatsApp service |

## Run

To view the home page, run these commands from `ezpolicy/`:

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`. This runs the frontend without Docker or `.env`. The language/topic preview, cover explorer, and FAQs work without the backend. Real demo calls and activity need the configured backend.

For the full Docker voice-call demo, first copy `.env.example` to `.env` and fill in the ElevenLabs IDs, API key and demo phone. Extract the event dataset before starting the backend:

```bash
python3 scripts/extract_insurance.py ~/Desktop/buildathon_data.zip   # once: writes backend/data/insurance.json
pnpm start:dev                                                       # docker compose: frontend :5173, backend :5001
ngrok http 5001                                                      # put the https URL into both ElevenLabs tools
curl -X POST localhost:5001/api/call -H 'content-type: application/json' -d '{"userId":"1590824686249448"}'
```

After editing `.env`, run `docker compose up -d --force-recreate backend`.

## Rules for anyone changing this

- **Medical (health) insurance only.** No term or life insurance. No HDFC or other insurers (no prices in the data).
- **Nothing made up:** every price, cover and deductible the agent says comes from `get_quotes` or the profile; the LLM never does arithmetic.
- **Never say "renewal":** policies run on 30-day AutoPay cycles, so the call is a "cycle check-in".
- The agent never predicts illness or gives medical advice.
- Prototype: no auth, in-memory state, one call at a time. Keep `/api/call` dialling only `DEMO_PHONE`.
- Backend is Node 24 native TypeScript: relative imports need the `.ts` extension; erasable syntax only (no enums or namespaces). `pnpm -F backend typecheck` must pass.
- `pnpm -F frontend lint` is broken on TypeScript 7; ignore it.
- Handbook skip list: real bank APIs, logins, WhatsApp, dashboards.
