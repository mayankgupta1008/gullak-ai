# ezpolicy

A browser voice agent that helps a person buy medical health insurance. It asks for name, existing health insurance if any, family members to cover, eldest age, health declarations and budget, saves a structured buyer profile JSON, recommends cover using real event-dataset prices, and submits the proposal the customer agrees to.

Built for the **Bachatt x Digia Voice AI Buildathon** (Fintech track), 17 Oct 2026, Gurugram.

> **Agents picking this up in a new chat:** read this file first, then `agent/setup.md`. The working voice path is Sarvam AI inside the web app opened on a phone over HTTPS. Do not revive outbound telephony unless the user explicitly asks; that path already burned time on provider setup. **Update the Status table after every change.**

## Status

| Step | State |
| --- | --- |
| 1. Extract insurance data from the event zip | Done: `scripts/extract_insurance.py` writes `backend/data/insurance.json` |
| 2. Backend API: profile, quotes, proposals, activity | Done: implemented in `backend/src/index.ts`; `/api/session` starts a new-purchase session without preloading any old customer record; `/api/person-details` stores the buyer's structured profile JSON for the current call |
| 3. Sarvam browser voice integration | Done in code: `frontend/src/BrowserCall.tsx` uses `sarvam-conv-ai-sdk/browser`; `POST /api/session` returns non-secret Sarvam session config with empty customer variables for a new buyer; `/api/sarvam/*` proxies signed-URL requests with `SARVAM_API_KEY` server-side |
| 4. Sarvam dashboard agent and tools | Done: Sarvam MCP configured `ezpolicy` app `ezpolicy-4ae97723-494f`; updated prompt and rules to use live web search (`search_policies_online`) across top Indian insurers instead of hardcoded policies; added MCP server `sarvam-voice-agents` (`https://mcp.sarvam.ai/voice-agents`); `.env` pins the app/version |
| 5. Frontend home page and live activity | Done: phone opens the Vite/ngrok URL, starts a voice check-in, and the same frontend ngrok URL forwards `/api/*` to the backend for Sarvam tools; the visible UI has no customer picker, does not hardcode customer names or personal details, and keeps the call button in `End call` mode while a browser session is active; activity feed tracks live web search results |
| 6. Live internet policy search functionality | Implemented: Added live web search in `/api/search-policies` scraping and extracting real-time policies across top Indian insurers (Star Health, HDFC ERGO, Niva Bupa, Tata AIG, Care Health, etc.) with real URLs, features, and tailored premiums, backed by a curated catalog; integrated with Sarvam agent as `search_policies_online` |
| 7. Email quotation functionality | Implemented: Added email input modal in frontend UI and integrated with backend email sending functionality; users can request quotations via email after receiving a proposal |
| 8. End-to-end voice test | Pending live browser voice test with real Sarvam runtime; committed Sarvam agent version now exists |

## How the demo works

1. The page shows one start button for a health cover purchase call.
2. The phone opens the app through HTTPS, usually `ngrok http 5173`.
3. Tapping **Start voice check-in** calls `POST /api/session`; the backend starts a new buyer session and returns Sarvam org/workspace/app IDs plus empty customer `agentVariables`, never the API key.
4. The Sarvam browser SDK requests a signed WebSocket URL through `/api/sarvam/*`; the backend forwards to Sarvam and injects `SARVAM_API_KEY`.
5. The Sarvam agent talks in Hindi or English. It asks for the buyer's details, saves the structured buyer profile JSON, then calls backend API tools through the frontend ngrok URL's `/api` proxy:
   - `save_person_details` -> `POST /api/person-details`
   - `get_quotes` -> `POST /api/quotes`
   - `submit_new_proposal` -> `POST /api/proposals`
6. The page polls `GET /api/activity` and shows quote/proposal activity live.

```text
Phone browser (Vite :5173 over HTTPS)
  -> /api/session
  -> Sarvam browser SDK
  -> /api/sarvam/* proxy -> Sarvam signed WebSocket

Sarvam API tools
  -> frontend ngrok URL /api proxy
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

The frontend does not expose customer names, IDs, policy details or a profile picker. A blank `POST /api/session` starts a new-buyer voice session; the agent collects the buyer's details during the call. Existing health insurance and pre-existing disease are separate fields because confusing them produces bad advice.

## API

| Route | Body | Returns |
| --- | --- | --- |
| `GET /api/health` | | `{ status }` |
| `GET /api/customer/:userId` | | profile: members, adults, children, eldestAge, policies, today |
| `GET /api/customer/active` | | legacy profile route; not used by the new-purchase Sarvam agent |
| `GET /api/customer/active/voice-context` | | legacy compact profile route; not used by the new-purchase Sarvam agent |
| `POST /api/person-details` | `{ customerName, existingInsurance, existingInsurer?, existingCover?, existingPolicyNotes?, adults, children, eldestAge, declaredConditions?, budgetMonthly? }` | Saves current-call buyer profile JSON and returns `message_to_llm` context |
| `GET /api/person-details/active` | | Current-call buyer profile JSON, for debugging |
| `POST /api/quotes` | `{ adults, children, eldestAge, budgetMonthly? }` | `{ note, quotes[] }`; each quote has productId, insurer, productType, cadence, cover, premium, deductible, monthlyCost, withinBudget |
| `POST /api/proposals` | `{ customerName?, productId, cover, addTopUp, declaredConditions?, notes? }` | `{ reference: "EZP-xxxxxx", status, whatsappSent }` |
| `POST /api/session` | `{ userId? }` | Sarvam session config: `orgId`, `workspaceId`, `appId`, optional `version`, `userIdentifier`, empty customer `agentVariables`; blank body starts a new-buyer session |
| `POST /api/search-policies` | `{ adults, children, eldestAge, budgetMonthly?, searchTerm? }` | `{ message, results[], note }` |
| `POST /api/send-quotation` | `{ customerEmail, customerName, quotationDetails }` | `{ message, messageId }` |
| `/api/sarvam/*` | Sarvam browser SDK signed-URL request | Proxies to `SARVAM_RUNTIME_BASE` and injects `SARVAM_API_KEY` |
| `POST /api/call` | | Gone for practical purposes: returns 410 because outbound telephony is disabled |
| `GET /api/activity` | | events for the current voice session: `call`, `quotes`, `proposal`, `search_policies`, `email_sent` |

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
| `EMAIL_SERVICE` | Email service provider (e.g., gmail, outlook, yahoo) |
| `EMAIL_USERNAME` | Email address for sending quotations |
| `EMAIL_PASSWORD` | App password for the email account |

## Run

```bash
pnpm install
python3 scripts/extract_insurance.py ~/Desktop/buildathon_data.zip
pnpm start:dev
ngrok http 5173
```

Open the Vite ngrok URL on the phone. Microphone access requires HTTPS; localhost is only enough for laptop testing.

For Sarvam API tools, use the same frontend ngrok URL with `/api/...` paths. Example: `https://tricksome-christa-conjugated.ngrok-free.dev/api/customer/active`. Add header `ngrok-skip-browser-warning: true` in Sarvam tools if headers are supported.

After editing `.env`, run:

```bash
docker compose up -d --force-recreate backend
```

## Rules For Changing This

- Medical health insurance only. No term/life insurance. No HDFC or other insurers because there are no prices in the data.
- Every price, cover and deductible the agent says must come from `get_quotes` or the customer profile.
- Existing health insurance means an already-held health policy or employer cover; pre-existing disease means a medical condition. Keep them separate everywhere.
- Never say "renewal": this voice path is a new medical-policy purchase flow.
- The agent never predicts illness or gives medical advice.
- Prototype state is in memory and supports one active voice session at a time.
- Backend is Node 24 native TypeScript: relative imports need `.ts` extensions; erasable syntax only.
- `pnpm -F backend typecheck` and `pnpm -F frontend build` should pass.
- `pnpm -F frontend lint` is known broken on TypeScript 7.
- WAHA is only for optional receipt messages. Do not use it for calls.
