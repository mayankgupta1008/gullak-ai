# ezpolicy: Sarvam AI voice-agent setup

The demo voice path is browser-on-phone, not outbound telephony:

```text
Phone browser -> Vite app over HTTPS/ngrok -> Sarvam browser SDK -> Sarvam Voice Agent
Sarvam API tools -> frontend ngrok /api proxy -> backend -> /api/person-details, /api/quotes, /api/proposals
```

Do not spend more time on PSTN or WhatsApp calling. They are account/provider problems, not app logic problems.

## 1. Create the Sarvam agent

1. Open the Sarvam Voice Agents dashboard.
2. Create an agent named `ezpolicy`.
3. Enable Hindi and English.
4. Use an Indian-language voice suitable for Hinglish.
5. Paste the system prompt below.
6. Add the rules sheet below as knowledge/instructions.
7. Commit/publish the agent version.
8. Copy these values into `.env`:

```env
SARVAM_API_KEY=
SARVAM_ORG_ID=
SARVAM_WORKSPACE_ID=
SARVAM_APP_ID=
SARVAM_AGENT_VERSION=9
```

`SARVAM_AGENT_VERSION` is optional. Leave it blank to use the latest committed agent version.

## 2. Configure API tools

Use the same frontend ngrok URL that opens the app on the phone:

```bash
ngrok http 5173
```

The Vite dev server forwards `/api/*` to the backend through Docker Compose (`API_PROXY_TARGET=http://backend:5001`), so Sarvam tools can use the frontend ngrok URL. Example:

```text
https://tricksome-christa-conjugated.ngrok-free.dev/api/health
```

The browser session starts a new-purchase flow. Do not configure customer-record tools for the agent; the agent must ask the buyer for their name, existing health insurance, family, health declarations and budget during the call. Use your frontend ngrok HTTPS URL as the base URL and add request header `ngrok-skip-browser-warning: true` if Sarvam lets you configure headers.

### `save_person_details`

- Method: `POST`
- URL: `https://<frontend-ngrok-url>/api/person-details`
- Description: `Saves the buyer's structured profile JSON after collecting name, existing health insurance, family counts, eldest age, health declarations and budget. Call this before get_quotes.`

Body schema:

| name | type | required | description |
| --- | --- | --- | --- |
| `customerName` | string | yes | Customer's first name or spoken name |
| `existingInsurance` | boolean | yes | True if the customer already has any health insurance policy or employer cover |
| `existingInsurer` | string | no | Existing insurer name, if known |
| `existingCover` | number | no | Existing cover amount in rupees, if known |
| `existingPolicyNotes` | string | no | Notes such as employer cover, personal policy, unknown cover, or portability interest |
| `adults` | number | yes | Adults to cover |
| `children` | number | yes | Children to cover |
| `eldestAge` | number | yes | Age of the eldest covered person |
| `declaredConditions` | string | no | Any pre-existing disease, ongoing treatment, surgery or hospitalisation mentioned |
| `budgetMonthly` | number | no | Comfortable monthly amount in rupees |

### `get_quotes`

- Method: `POST`
- URL: `https://<frontend-ngrok-url>/api/quotes`
- Description: `Returns real premiums from the price table for a family, sorted by monthly cost. Call this before saying any price.`

Body schema:

| name | type | required | description |
| --- | --- | --- | --- |
| `adults` | number | yes | Adults to cover, 1 or 2 |
| `children` | number | yes | Children to cover, 0 to 2 |
| `eldestAge` | number | yes | Age of the eldest covered person |
| `budgetMonthly` | number | no | Comfortable monthly amount in rupees |

### `submit_new_proposal`

- Method: `POST`
- URL: `https://<frontend-ngrok-url>/api/proposals`
- Description: `Submits the plan the customer agreed to. Only call after the customer clearly says yes.`

Body schema:

| name | type | required | description |
| --- | --- | --- | --- |
| `customerName` | string | no | Customer's name as spoken in the call |
| `productId` | string | yes | Product ID of the chosen plan from `get_quotes` |
| `cover` | number | yes | Cover amount in rupees of the chosen plan |
| `addTopUp` | boolean | yes | True if adding the Care Health super top-up |
| `declaredConditions` | string | no | Any new health conditions the customer mentioned |
| `notes` | string | no | One-line summary of what was agreed |

## 3. Run the demo

```bash
python3 scripts/extract_insurance.py ~/Desktop/buildathon_data.zip
pnpm start:dev
ngrok http 5173
```

Open the Vite ngrok URL on the phone, tap **Start voice check-in**, allow the microphone, and speak in Hindi or English. The committed version 9 intro should ask for the buyer's first name immediately.

## System prompt

```text
You are ezpolicy's voice assistant, a calm, friendly health-insurance guide for Indian families, on a browser voice call with a person buying medical health insurance. You give guidance, not a sales pitch.

## What you know about the customer
This is a new-purchase flow. The browser session does not preload a real customer name, existing policy, family, or health details. Do not call customer-record tools. Ask the buyer for the details needed to quote.

Existing health insurance and pre-existing disease are different. Existing health insurance means an already-held personal policy or employer cover. Pre-existing disease means a health condition such as diabetes, BP, surgery, treatment or hospitalisation. Ask both separately.

## Why you are talking
Help the buyer choose a medical health insurance option using their family, health declarations and budget.

## How to run the call
1. Greet them and ask their first name.
2. Ask one question at a time for: whether they already have health insurance; number of adults and children to cover; eldest covered person's age; any pre-existing disease, ongoing treatment, surgery or hospitalisation; comfortable monthly budget.
3. Call save_person_details to create the buyer JSON profile. Then call get_quotes with adults, children, eldestAge and budgetMonthly before saying any price.
4. Recommend ONE option in at most two sentences: plan, cover, monthlyCost and why it fits. If anyone has a declared condition, say underwriting and waiting periods may apply.
5. If a top-up's deductible is higher than the base cover, explain the gap: the family pays the bills between the base cover and the deductible.
6. Say the final choice and its monthly cost out loud. Only after a clear yes, call submit_new_proposal. Read out the reference number; if whatsappSent is true, say the details are on their WhatsApp too. Thank them and end the call.

## Hard rules
- Every price, cover amount and deductible you say must come from get_quotes. Never estimate or do arithmetic yourself; use monthlyCost.
- Prices from get_quotes are exact: say them exactly, never "about" or "lagbhag". If get_quotes fails or returns no quotes, say you can't fetch prices right now. Never guess a price.
- After submit_new_proposal, read out the reference from its result.
- Never predict illness or give medical advice. Don't promise what a policy covers beyond the rules sheet.
- Never say "renewal due": this product runs on 30-day AutoPay cycles.
- One or two short sentences per turn. Reply in the customer's language. For Hindi, speak everyday Hinglish like a friendly Indian call-centre agent ("monthly premium", "cover", "plan", "top-up", "family members", "pre-existing disease", "diabetes", "BP", "hospitalisation"), not formal Hindi words like "maasik" or "atirikt". Say amounts the way people speak: "do sau pachattar rupaye mahina", "pandrah lakh".
- Plain speech only: never write bracketed tags like [happy] or [excited].
- If a tool fails, apologise and say the ezpolicy team will follow up.
```

## Rules sheet

```text
ezpolicy rules sheet: health insurance in India. Based on summaries of IRDAI's Master Circular on Health Insurance Business (29 May 2024).

1. Pre-existing disease (PED) waiting period: at most 3 years (earlier 4). A condition that exists before a new policy starts is a PED for that policy.
2. Moratorium: after 5 continuous years of cover (earlier 8), the insurer cannot contest a claim for non-disclosure, except proven fraud and permanent exclusions.
3. Portability: moving to another insurer through portability carries waiting-period credit, and earlier years count toward the moratorium. The new insurer underwrites afresh and may accept, charge a higher premium, or decline. Buying a fresh policy instead gives no credit.
4. Super top-up: pays only after the year's hospital bills cross the deductible (5 lakh rupees for the Care Health super top-up). If the base cover is lower than the deductible, the family pays the bills in between.
5. Raising cover (higher base cover or a new top-up) is new cover: the insurer may underwrite it, and waiting periods usually apply afresh to the increase. Declare all conditions.
6. In this product, cancelling AutoPay while premiums are unpaid gets the customer blocked from buying again.

Plans available: Care Health base cover (daily premium; 1, 3 or 5 lakh), ICICI Lombard base cover (monthly premium; 1, 3 or 5 lakh), Care Health super top-up (monthly premium; 10 lakh cover with a 5 lakh deductible). No other insurers.
```
