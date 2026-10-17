# ezpolicy

A browser voice agent that helps a family review health insurance before the next 30-day cover cycle. It asks what changed in health, family and budget, recommends cover using real event-dataset prices, and submits the proposal the customer agrees to.

Built for the **Bachatt x Digia Voice AI Buildathon** (Fintech track), 17 Oct 2026, Gurugram.

> **Agents picking this up in a new chat:** read this file first, then `agent/setup.md`. The working voice path is Sarvam AI inside the web app opened on a phone over HTTPS. Do not revive outbound telephony unless the user explicitly asks; that path already burned time on provider setup. **Update the Status table after every change.**

## Status

| Step | State |
| --- | --- |
| 1. Extract insurance data from the event zip | Done: `scripts/extract_insurance.py` writes `backend/data/insurance.json` |
| 2. Backend API: customer, quotes, proposals, activity | Done: implemented in `backend/src/index.ts`; quote/proposal logic kept provider-neutral |
| 3. Sarvam browser voice integration | Done in code: `frontend/src/BrowserCall.tsx` uses `sarvam-conv-ai-sdk/browser`; `POST /api/session` returns non-secret Sarvam session config; `/api/sarvam/*` proxies signed-URL requests with `SARVAM_API_KEY` server-side |
| 4. Sarvam dashboard agent and tools | Pending user setup: create agent, paste prompt/rules from `agent/setup.md`, configure `get_customer`, `get_quotes`, `submit_proposal`, then paste Sarvam IDs into `.env` |
| 5. Frontend home page and live activity | Done: phone opens the Vite/ngrok URL, taps "Talk to ezpolicy now", and `GET /api/activity` shows tool activity |
| 6. End-to-end voice test | Pending real Sarvam credentials and a committed Sarvam agent version |

## How the demo works

1. The page shows a demo customer picker.
2. The phone opens the app through HTTPS, usually `ngrok http 5173`.
3. Tapping **Talk to ezpolicy now** calls `POST /api/session`; the backend selects the active customer and returns Sarvam org/workspace/app IDs, never the API key.
4. The Sarvam browser SDK requests a signed WebSocket URL through `/api/sarvam/*`; the backend forwards to Sarvam and injects `SARVAM_API_KEY`.
5. The Sarvam agent talks in Hindi or English and calls backend API tools through the backend ngrok URL:
   - `get_customer` -> `GET /api/customer/active`
   - `get_quotes` -> `POST /api/quotes`
   - `submit_proposal` -> `POST /api/proposals`
6. The page polls `GET /api/activity` and shows quote/proposal activity live.

```text
Phone browser (Vite :5173 over HTTPS)
  -> /api/session
  -> Sarvam browser SDK
  -> /api/sarvam/* proxy -> Sarvam signed WebSocket

Sarvam API tools
  -> backend ngrok URL
  -> /api/customer/active, /api/quotes, /api/proposals
```

## Repo Layout

| Path | What |
| --- | --- |
| `backend/src/index.ts` | Express 5 API, Sarvam session config, Sarvam proxy, customer/quote/proposal/activity routes |
| `backend/data/insurance.json` | Extracted dataset; gitignored, rebuild with the script |
| `scripts/extract_insurance.py` | Reads the event zip, writes `insurance.json`, self-checks prices |
| `agent/setup.md` | Sarvam dashboard setup, prompt, rules sheet, API tool definitions |
| `frontend/src/BrowserCall.tsx` | Sarvam browser voice session |
| `frontend/src/App.tsx` | ezpolicy landing/demo page and live activity panel |
| `frontend/vite.config.ts` | Proxies `/api` to the backend and allows ngrok hosts |
| `docker-compose.yaml` | `frontend` :5173, `backend` :5001, optional WAHA receipt service |

## Data

Source: `~/Desktop/buildathon_data.zip` -> `buildathon/insurance/*.csv` (event mock data; never commit it).
Tables used: `insurance_products`, `premium_rate_cards`, `policies`, `applications`, `policy_members`.

- 3 plans: Care Health base cover (billed daily; Rs 1/3/5 lakh), ICICI Lombard base cover (monthly; Rs 1/3/5 lakh), Care Health super top-up (monthly; Rs 10 lakh with a Rs 5 lakh deductible).
- 282 rate-card rows (price by cover x adults x children x eldest-age band); 586 active customers.
- "Today" in the data is **2026-10-14**; member ages are computed as of that date.
- Self-check: 583 of 586 active policies reproduce their actual premium from the rate card.

Demo customers:

- `1590824686249448` **Abhishek Chopra**: self 33, spouse Payal 32 (diabetes and heart surgery since 2010). Care Rs 5L at Rs 41/day = Rs 1,230/month. ICICI Rs 5L is Rs 1,206/month; the Rs 10L top-up is Rs 275/month.
- `1706244642983364` **Lalit Deshpande**: family of 4; self 46 (heart surgery and organ replacement since 2010). Care Rs 1L at Rs 70/day, which is below the top-up's Rs 5L deductible.

## API

| Route | Body | Returns |
| --- | --- | --- |
| `GET /api/health` | | `{ status }` |
| `GET /api/customer/:userId` | | profile: members, adults, children, eldestAge, policies, today |
| `GET /api/customer/active` | | profile for the current browser voice session; defaults to Abhishek |
| `POST /api/quotes` | `{ adults, children, eldestAge, budgetMonthly? }` | `{ note, quotes[] }`; each quote has productId, insurer, productType, cadence, cover, premium, deductible, monthlyCost, withinBudget |
| `POST /api/proposals` | `{ userId?, productId, cover, addTopUp, declaredConditions?, notes? }` | `{ reference: "EZP-xxxxxx", status, whatsappSent }` |
| `POST /api/session` | `{ userId }` | Sarvam session config: `orgId`, `workspaceId`, `appId`, optional `version`, `userIdentifier`, `agentVariables` |
| `/api/sarvam/*` | Sarvam browser SDK signed-URL request | Proxies to `SARVAM_RUNTIME_BASE` and injects `SARVAM_API_KEY` |
| `POST /api/call` | | Gone for practical purposes: returns 410 because outbound telephony is disabled |
| `GET /api/activity` | | events for the current voice session: `call`, `quotes`, `proposal` |

## Environment

Copy `.env.example` to `.env`:

| Key | Meaning |
| --- | --- |
| `SARVAM_API_KEY` | Sarvam API key. Server-side only. Never expose it in `VITE_*` |
| `SARVAM_ORG_ID` | Sarvam organization ID |
| `SARVAM_WORKSPACE_ID` | Sarvam workspace ID |
| `SARVAM_APP_ID` | Sarvam Voice Agent app ID |
| `SARVAM_AGENT_VERSION` | Optional committed agent version; blank means latest committed version |
| `SARVAM_RUNTIME_BASE` | Defaults to `https://apps.sarvam.ai/api/app-runtime/` |
| `DEMO_PHONE` | Optional: WAHA receipt target. Not used for voice calling |
| `WAHA_API_KEY`, `WAHA_DASHBOARD_PASSWORD`, `WHATSAPP_SWAGGER_PASSWORD` | Optional WAHA receipt service credentials |

## Run

```bash
pnpm install
python3 scripts/extract_insurance.py ~/Desktop/buildathon_data.zip
pnpm start:dev
ngrok http 5173
```

Open the Vite ngrok URL on the phone. Microphone access requires HTTPS; localhost is only enough for laptop testing.

For Sarvam API tools, expose the backend too:

```bash
ngrok http 5001
```

Paste that backend HTTPS URL into the Sarvam API tools defined in `agent/setup.md`.

After editing `.env`, run:

```bash
docker compose up -d --force-recreate backend
```

## Rules For Changing This

- Medical health insurance only. No term/life insurance. No HDFC or other insurers because there are no prices in the data.
- Every price, cover and deductible the agent says must come from `get_quotes` or the customer profile.
- Never say "renewal": policies run on 30-day AutoPay cycles, so this is a "cycle check-in".
- The agent never predicts illness or gives medical advice.
- Prototype state is in memory and supports one active voice session at a time.
- Backend is Node 24 native TypeScript: relative imports need `.ts` extensions; erasable syntax only.
- `pnpm -F backend typecheck` and `pnpm -F frontend build` should pass.
- `pnpm -F frontend lint` is known broken on TypeScript 7.
- WAHA is only for optional receipt messages. Do not use it for calls.
