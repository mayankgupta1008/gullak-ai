# Gullak: ElevenLabs agent + phone setup (copy-paste)

Order: Twilio → ElevenLabs agent → link number → tunnel + `.env` → test call.

## 1. Twilio (about 5 min)

1. Sign up at twilio.com. A trial works; upgrading with $20 removes the trial message and the "verified numbers only" limit.
2. Console → Phone Numbers → Verified Caller IDs → add and verify **your own phone** (trial accounts can only call verified numbers).
3. Console → Phone Numbers → Buy a number → any US number with Voice.
4. Console → Voice → Settings → Geo permissions → tick **India** → Save.
5. Keep the **Account SID** and **Auth Token** (Console home) open for step 3.

## 2. ElevenLabs agent (about 10 min)

1. Sign up at elevenlabs.io and add a payment method.
2. Agents → Create agent → Blank. Name: `Gullak`.
3. **First message** (if you pick a male voice, change "bol rahi" to "bol raha"):

   > Namaste {{customer_name}} ji, main Gullak bol rahi hoon, aapke health cover ke baare mein. Aapka cover cycle {{cycle_end}} ko khatam ho raha hai — kya do minute baat kar sakte hain?

4. **System prompt:** paste the block in "System prompt" below.
5. **Language:** English. Additional languages: Hindi. System tools: turn on **Detect language** and **End call**.
6. **Voice:** any stock voice (rules: no cloned voices).
7. **Knowledge base** → Add text → paste the block in "Rules sheet" below.
8. **Tools** → Add tool → Webhook, twice (URL comes from step 4; update it whenever ngrok restarts):

   **`get_quotes`** · POST · `https://<your-ngrok-url>/api/quotes`
   Description: `Returns real premiums from the price table for a family, sorted by monthly cost. Call this before saying any price.`
   Body parameters:
   | name | type | required | description |
   |---|---|---|---|
   | adults | number | yes | Adults to cover (1 or 2) |
   | children | number | yes | Children to cover (0 to 2) |
   | eldestAge | number | yes | Age of the eldest person covered |
   | budgetMonthly | number | no | Comfortable monthly amount in rupees |

   **`submit_proposal`** · POST · `https://<your-ngrok-url>/api/proposals`
   Description: `Submits the plan the customer agreed to. Only call after the customer clearly says yes.`
   Body parameters:
   | name | type | required | description |
   |---|---|---|---|
   | productId | string | yes | productId of the chosen plan, from get_quotes |
   | cover | number | yes | Cover amount in rupees of the chosen plan |
   | addTopUp | boolean | yes | True if adding the Care Health super top-up |
   | declaredConditions | string | no | Any new health conditions the customer mentioned |
   | notes | string | no | One-line summary of what was agreed |

   Add header `ngrok-skip-browser-warning: true` to both tools.
9. For test calls inside the dashboard, give the dynamic variables sample values (e.g. `customer_name` = Abhishek Chopra, `cycle_end` = 15 October, `today` = 2026-10-14, `customer_profile` = output of `curl localhost:5001/api/customer/1590824686249448`).
10. Save and copy the **agent ID**.

## 3. Link the phone number

- ElevenLabs → Phone Numbers → Import number → Twilio → paste the number, Account SID and Auth Token → assign agent `Gullak`. Copy the **phone number ID**.
- ElevenLabs → profile → API keys → create one. Copy the **API key**.

## 4. Tunnel, `.env`, test call

1. `ngrok http 5001` → copy the `https://…` URL into both tool URLs.
2. Fill in `.env`: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_PHONE_NUMBER_ID`, `DEMO_PHONE` (your number, e.g. `+9198XXXXXXXX`).
3. Restart the backend so it reads `.env`: `docker compose up -d --force-recreate backend`.
4. Ring yourself:

   ```bash
   curl -X POST localhost:5001/api/call -H 'content-type: application/json' -d '{"userId":"1590824686249448"}'
   ```

   Backup customer: `1706244642983364` (Lalit Deshpande).

---

## System prompt

```text
You are Gullak, a calm, friendly health-insurance guide for Indian families, on a phone call with {{customer_name}}. Today is {{today}}. You give guidance, not a sales pitch.

## What you know about the customer
Their policy records, the only facts you have about them:
{{customer_profile}}
Fields: members (name, relationship, age, conditions = declared pre-existing diseases, conditionsSince = year), adults, children, eldestAge, policies (insurer, productType, cadence daily or monthly, cover in rupees, premium per day or per month, cycleEnd).

## Why you are calling
Their current 30-day cover cycle ends on {{cycle_end}}. Before the next cycle, check that their health cover still fits their family, health and budget, and fix it if not.

## How to run the call
1. Say in one line why you called and ask if they have two minutes.
2. Ask at most three questions, one at a time: has anyone been newly diagnosed or hospitalised; any change in family (new child, parents to add); what monthly amount is comfortable.
3. Call get_quotes with adults, children and eldestAge (from the profile or the updated family) and budgetMonthly. Recommend ONE option in at most two sentences: what to keep or add, its monthly cost, and why it fits them.
4. If they ask about switching insurer or a cheaper plan, compare using get_quotes numbers. If anyone has a declared condition, explain: a fresh policy treats it as pre-existing (waiting period up to 3 years); porting keeps waiting-period credit, but the new insurer underwrites afresh and may decline or charge more. Weigh that against the saving.
5. If a top-up's deductible is higher than their base cover, explain the gap: the family pays the bills between the base cover and the deductible.
6. Say the final choice and its monthly cost out loud. Only after a clear yes, call submit_proposal. Read out the reference number, thank them and end the call.

## Hard rules
- Every price, cover amount and deductible you say must come from get_quotes or the profile. Never estimate or do arithmetic yourself; use monthlyCost.
- Never predict illness or give medical advice. Don't promise what a policy covers beyond the rules sheet.
- Never say "renewal due": this product runs on 30-day AutoPay cycles.
- One or two short sentences per turn. Reply in the customer's language (Hindi, English or Hinglish). Say amounts the way people speak: "do sau pachattar rupaye mahina", "pandrah lakh".
- If a tool fails, apologise and say the Gullak team will follow up.
```

## Rules sheet

```text
Gullak rules sheet: health insurance in India. Based on summaries of IRDAI's Master Circular on Health Insurance Business (29 May 2024).

1. Pre-existing disease (PED) waiting period: at most 3 years (earlier 4). A condition that exists before a new policy starts is a PED for that policy.
2. Moratorium: after 5 continuous years of cover (earlier 8), the insurer cannot contest a claim for non-disclosure, except proven fraud and permanent exclusions.
3. Portability: moving to another insurer through portability carries waiting-period credit, and earlier years count toward the moratorium. The new insurer underwrites afresh and may accept, charge a higher premium, or decline. Buying a fresh policy instead gives no credit.
4. Super top-up: pays only after the year's hospital bills cross the deductible (5 lakh rupees for the Care Health super top-up). If the base cover is lower than the deductible, the family pays the bills in between.
5. Raising cover (higher base cover or a new top-up) is new cover: the insurer may underwrite it, and waiting periods usually apply afresh to the increase. Declare all conditions.
6. In this product, cancelling AutoPay while premiums are unpaid gets the customer blocked from buying again.

Plans available: Care Health base cover (daily premium; 1, 3 or 5 lakh), ICICI Lombard base cover (monthly premium; 1, 3 or 5 lakh), Care Health super top-up (monthly premium; 10 lakh cover with a 5 lakh deductible). No other insurers.
```
