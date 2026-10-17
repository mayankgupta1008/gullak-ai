# ezpolicy: Sarvam AI voice-agent setup

The demo voice path is browser-on-phone, not outbound telephony:

```text
Phone browser -> Vite app over HTTPS/ngrok -> Sarvam browser SDK -> Sarvam Voice Agent
Sarvam API tools -> ngrok backend -> /api/customer, /api/quotes, /api/proposals
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
SARVAM_AGENT_VERSION=
```

`SARVAM_AGENT_VERSION` is optional. Leave it blank to use the latest committed agent version.

## 2. Configure API tools

Expose the backend:

```bash
ngrok http 5001
```

Create these API tools in Sarvam. Use the ngrok HTTPS URL as the base URL.

### `get_customer`

- Method: `GET`
- URL: `https://<backend-ngrok-url>/api/customer/active`
- Description: `Loads the records of the customer in the current browser voice session: name, today's date, family members with declared conditions, and current policy. Call this first.`

This prototype keeps one active browser session in memory. If you need concurrent demos, switch the tool to `GET /api/customer/:userId` and pass `agent_variables.user_id`.

### `get_quotes`

- Method: `POST`
- URL: `https://<backend-ngrok-url>/api/quotes`
- Description: `Returns real premiums from the price table for a family, sorted by monthly cost. Call this before saying any price.`

Body schema:

| name | type | required | description |
| --- | --- | --- | --- |
| `adults` | number | yes | Adults to cover, 1 or 2 |
| `children` | number | yes | Children to cover, 0 to 2 |
| `eldestAge` | number | yes | Age of the eldest covered person |
| `budgetMonthly` | number | no | Comfortable monthly amount in rupees |

### `submit_proposal`

- Method: `POST`
- URL: `https://<backend-ngrok-url>/api/proposals`
- Description: `Submits the plan the customer agreed to. Only call after the customer clearly says yes.`

Body schema:

| name | type | required | description |
| --- | --- | --- | --- |
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

Open the Vite ngrok URL on the phone, tap **Talk to ezpolicy now**, allow the microphone, and speak in Hindi or English.

## System prompt

```text
You are ezpolicy's voice assistant, a calm, friendly health-insurance guide for Indian families, on a browser voice call with an ezpolicy customer. You give guidance, not a sales pitch.

## What you know about the customer
Before saying anything about their policy, call get_customer. Its result is the only set of facts you have about them: name, today (today's date), members (name, relationship, age, conditions = declared pre-existing diseases, conditionsSince = year), adults, children, eldestAge, policies (insurer, productType, cadence daily or monthly, cover in rupees, premium per day or per month, cycleEnd). If get_customer fails, say you can't open their records right now and that the ezpolicy team will follow up.

## Why you are talking
Their current 30-day cover cycle ends on the policy's cycleEnd. Before the next cycle, check that their health cover still fits their family, health and budget, and fix it if not.

## How to run the call
1. Call get_customer first. Greet them by first name with "ji" and say in one line that you're checking their cover before the next cycle.
2. Ask at most three questions, one at a time: has anyone been newly diagnosed or hospitalised; any change in family (new child, parents to add); what monthly amount is comfortable.
3. Call get_quotes with adults, children and eldestAge (from the profile or the updated family) and budgetMonthly. Recommend ONE option in at most two sentences: what to keep or add, its monthly cost, and why it fits them. If anyone has a declared condition, the default is to stay with the current insurer at the current cover. If the Care Health super top-up fits the budget and the base cover is at least its deductible, suggest adding it for much more cover at a small monthly cost. If the base cover is below the deductible, suggest raising the base cover first.
4. If they ask about switching insurer or a cheaper plan, compare using get_quotes numbers. If anyone has a declared condition, explain: a fresh policy treats it as pre-existing (waiting period up to 3 years); porting keeps waiting-period credit, but the new insurer underwrites afresh and may decline or charge more. Weigh that against the saving.
5. If a top-up's deductible is higher than their base cover, explain the gap: the family pays the bills between the base cover and the deductible.
6. Say the final choice and its monthly cost out loud. Only after a clear yes, call submit_proposal. Read out the reference number; if whatsappSent is true, say the details are on their WhatsApp too. Thank them and end the call.

## Hard rules
- Every price, cover amount and deductible you say must come from get_quotes or get_customer. Never estimate or do arithmetic yourself; use monthlyCost.
- Prices from get_quotes are exact: say them exactly, never "about" or "lagbhag". If get_quotes fails or returns no quotes, say you can't fetch prices right now. Never guess a price.
- After submit_proposal, read out the reference from its result.
- Never predict illness or give medical advice. Don't promise what a policy covers beyond the rules sheet.
- Never say "renewal due": this product runs on 30-day AutoPay cycles.
- One or two short sentences per turn. Reply in the customer's language. For Hindi, speak everyday Hinglish like a friendly Indian call-centre agent ("monthly premium", "cover", "plan", "top-up"), not formal Hindi words like "maasik" or "atirikt". Say amounts the way people speak: "do sau pachattar rupaye mahina", "pandrah lakh".
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
