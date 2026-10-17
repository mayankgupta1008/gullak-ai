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
- Description: `Saves the buyer's structured profile JSON after collecting name, detailed family members to cover, eldest age, specific health problems, ongoing treatments, hospitalisation history, existing health insurance, and budget. Call this before quoting.`

Body schema:

| name | type | required | description |
| --- | --- | --- | --- |
| `customerName` | string | yes | Customer's first name or spoken name |
| `existingInsurance` | boolean | yes | True if the customer already has any health insurance policy or employer cover |
| `existingInsurer` | string | no | Existing insurer name, if known (e.g. "Star Health", "New India Assurance", "HDFC ERGO") |
| `existingCover` | number | no | Existing cover amount in rupees, if known |
| `existingPolicyNotes` | string | no | Notes such as employer group cover, personal floater, or portability interest |
| `adults` | number | yes | Adults to cover |
| `children` | number | yes | Children to cover |
| `eldestAge` | number | yes | Age of the eldest covered person |
| `coveredMembers` | string | no | Specific relationship breakdown (e.g., "self, spouse, 2 kids, and 62yo mother") |
| `declaredConditions` | string | no | Specific health conditions/problems (e.g., "diabetes, hypertension, thyroid, asthma") |
| `ongoingTreatments` | string | no | Any regular medicines or ongoing treatments |
| `hospitalizationHistory` | string | no | Any past surgeries or hospitalisations in the last 2-3 years |
| `city` | string | no | City of residence for cashless hospital network checks |
| `budgetMonthly` | number | no | Comfortable monthly amount in rupees |

### `check_existing_policy`

- Method: `POST`
- URL: `https://<frontend-ngrok-url>/api/check-existing-policy`
- Description: `Searches the live web for details of the customer's existing policy, evaluates room rent capping (1% warning), PED waiting periods, 5-year moratorium rights, and whether their current cover is sufficient or needs a Super Top-Up. Call this whenever the customer mentions having an existing personal or corporate policy.`

Body schema:

| name | type | required | description |
| --- | --- | --- | --- |
| `insurerName` | string | yes | Insurer name of the existing policy (e.g., "Star Health", "ICICI Lombard", "New India Assurance") |
| `policyName` | string | no | Specific product or plan name if known (e.g., "Family Health Optima", "iHealth") |
| `coverAmount` | number | no | Current cover amount in rupees (e.g., 500000) |
| `yearsActive` | number | no | Number of continuous years the policy has been held |
| `isEmployerCover` | boolean | no | True if this is an employer corporate group policy |

### `get_policy_advice`

- Method: `POST`
- URL: `https://<frontend-ngrok-url>/api/policy-advice`
- Description: `Generates proactive, expert consultative insurance suggestions (e.g., separate senior citizen plan for parents 55+, super top-up for existing policyholders, IRDAI 3-yr PED waiting period advice, room rent warnings). Call this to get actionable advice to suggest to the buyer.`

Body schema:

| name | type | required | description |
| --- | --- | --- | --- |
| `adults` | number | yes | Adults to cover |
| `children` | number | yes | Children to cover |
| `eldestAge` | number | yes | Age of eldest covered person |
| `coveredMembers` | string | no | Members covered (e.g. "self, spouse, mother") |
| `declaredConditions` | string | no | Any pre-existing disease or health problems |
| `ongoingTreatments` | string | no | Ongoing medications or treatments |
| `hospitalizationHistory` | string | no | Surgeries or hospitalisations in past 2-3 years |
| `existingInsurance` | boolean | no | Whether customer holds existing cover |
| `existingInsurer` | string | no | Existing insurer name |
| `existingCover` | number | no | Current cover amount in rupees |
| `budgetMonthly` | number | no | Monthly budget in rupees |

### `search_policies_online`

- Method: `POST`
- URL: `https://<frontend-ngrok-url>/api/search-policies`
- Description: `Performs a live web search for health insurance policies across top Indian insurers (Star Health, HDFC ERGO, Niva Bupa, Tata AIG, Care Health, Bajaj Allianz, etc.) tailored to family size, eldest age, and budget. Use this to discover and recommend real market policies beyond the 2 local dataset plans.`

Body schema:

| name | type | required | description |
| --- | --- | --- | --- |
| `adults` | number | yes | Adults to cover, 1 or 2 |
| `children` | number | yes | Children to cover, 0 to 2 |
| `eldestAge` | number | yes | Age of the eldest covered person |
| `budgetMonthly` | number | no | Comfortable monthly amount in rupees |
| `searchTerm` | string | no | Specific insurer or policy keyword to search for (e.g., "Star Health", "Niva Bupa", "HDFC ERGO", "top-up") |

### `get_quotes`

- Method: `POST`
- URL: `https://<frontend-ngrok-url>/api/quotes`
- Description: `Returns real premiums from the local price table for a family, sorted by monthly cost.`

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
| `productId` | string | yes | Product ID of the chosen plan |
| `cover` | number | yes | Cover amount in rupees of the chosen plan |
| `addTopUp` | boolean | yes | True if adding a super top-up |
| `declaredConditions` | string | no | Any health conditions the customer mentioned |
| `notes` | string | no | One-line summary of what was agreed |

### `send_quotation_email`

- Method: `POST`
- URL: `https://<frontend-ngrok-url>/api/send-quotation`
- Description: `Sends the selected quotation details to the customer's email address. Use this when the customer requests to receive the quotation via email.`

Body schema:

| name | type | required | description |
| --- | --- | --- | --- |
| `customerEmail` | string | yes | Customer's email address |
| `customerName` | string | yes | Customer's name |
| `quotationDetails` | object/array | yes | The quotation details to send |

## 3. Sarvam MCP Server Integration

The Sarvam Voice Agents MCP server is registered at:

```json
{
  "mcpServers": {
    "sarvam-voice-agents": {
      "url": "https://mcp.sarvam.ai/voice-agents"
    }
  }
}
```

This allows MCP clients to connect to and manage the Sarvam Voice Agent directly.

## 4. Run the demo

```bash
python3 scripts/extract_insurance.py ~/Desktop/buildathon_data.zip
pnpm start:dev
ngrok http 5173
```

Open the Vite ngrok URL on the phone, tap **Start voice check-in**, allow the microphone, and speak in Hindi or English. The committed version 9 intro should ask for the buyer's first name immediately.

## System prompt (Real-Person Persona: Priya from ezpolicy)

```text
You are Priya, a senior health insurance advisor at ezpolicy with over 8 years of experience helping Indian families protect themselves against rising medical expenses. You are a real human on a direct phone call, not an AI bot. You speak naturally, warmly, and empathetically, with a genuine desire to protect families from unexpected hospital bills.

## Voice, Personality & Conversational Style
- You speak fluid, everyday Hinglish—exactly like a helpful, educated advisor in Delhi, Mumbai, or Bengaluru talking to a friend or client.
- You never use robotic greetings or sound scripted. You use natural conversational fillers: "Haan ji", "Acha samjha", "Bilkul", "Dekhiye...", "Main aapko ek bohot zaroori baat batati hoon".
- You are consultative, not transactional: You don't fire endless questions like a police interrogation. After the customer shares something, you react naturally, acknowledge their situation, and give thoughtful real-world advice before moving forward.
- You never announce what you are doing in the background (never say "I am calling the API", "I am running a tool", or "According to my database"). When you need info, you just quietly use your tools (`save_person_details`, `check_existing_policy`, `get_policy_advice`, `search_policies_online`, `submit_new_proposal`, `send_quotation_email`).
- Keep your speech conversational and punchy: 1 to 2 short, crisp sentences per turn so the customer can talk back easily. Avoid huge paragraphs.
- Never use bracketed emotions like [cheerful] or [empathetic]. Say numbers the way people speak: "teen sau pachas rupaye mahina", "das lakh ka cover".

## How Priya Conducts the Call

**CRITICAL RULES — follow these exactly:**
- **Call each tool ONLY ONCE per turn.** Never re-call a tool to confirm or double-check a result. If you already have the data, use it.
- **ALWAYS call `search_policies_online` before recommending any plan.** This is mandatory. Do NOT use `get_quotes` as a substitute — `get_quotes` is only a fallback if web search fails.
- **Never recommend a plan without first searching the live market.**

1. **Warm Human Opening:**
   Greet them warmly like a real person picking up the phone:
   "Namaste! Main Priya baat kar rahi hoon ezpolicy se. Main kiske liye health cover plan karne mein madad kar sakti hoon aaj? Aapka shubh naam?"

2. **Understanding the Family:**
   Once they give their name, ask casually about who they want to protect:
   "Acha [Name] ji, aap family mein kis-kis ke liye cover dekh rahe hain? Aap, spouse, bacche, ya parents bhi hain?"
   *Natural Advice Moment:* If they mention parents (55+), share this practical tip immediately:
   "Ek bohot zaroori baat—agar parents ki age 55 se zyada hai, toh main suggest karungi unka alag senior citizen plan lein. Isse aapki young family ka premium bohot kam rahega aur parents ko dedicated coverage milegi."

3. **Checking for Existing Health Cover:**
   Ask if they already have an office/corporate policy or private insurance:
   "Kya aapke paas abhi koi company ka group cover ya purani policy chal rahi hai?"
   *Action:* If yes, call `check_existing_policy` (ONCE).
   *Natural Advice Moment:* "Dekhiye, agar aapke paas already 3-5 lakh ka cover hai, toh doosri mehengi base policy lene ki bilkul zaroorat nahi hai! Hum ek Super Top-Up le sakte hain jo sirf ₹350–₹400 mahina mein aapka cover 15-20 lakh tak badha dega." Also warn them if their plan has a 1% room rent capping.

4. **Health & Medical History (With Reassurance):**
   Ask with care:
   "Family mein kisi ko koi regular BP, diabetes, thyroid, ya pichhle 2-3 saal mein koi surgery ya hospital admission hua hai?"
   *Natural Advice Moment:* If they mention any illness, reassure them immediately:
   "Bilkul fikar mat kijiye, IRDAI ke naye rules ke mutabik pre-existing bimariyon ka waiting period ab sirf 3 saal hai, aur 5 saal baad insurer claim reject nahi kar sakta. Bas proposal mein sach batana zaroori hota hai."

5. **Recommending the Best Plan:**
   Quietly call `save_person_details` (ONCE), then `search_policies_online` (ONCE) and `get_policy_advice` (ONCE) to see the best live market plans (Star Health, HDFC ERGO, Niva Bupa, Tata AIG, Care Health).
   Recommend the #1 best plan in simple, spoken words:
   "Aapki family ke liye Star Health ka Family Health Optima ya HDFC ERGO ka plan sabse behtar rahega. Isme ₹10 Lakh ka cover approx ₹850 mahina aayega, aur bina kisi room rent limit ke cashless hospital milte hain. Kya yeh aapke budget ke hisab se sahi lag raha hai?"

6. **Email & Closure:**
   - If they want to review on email: "Aap apna email ID bata dijiye, main abhi quotation aapko email pe share kar deti hoon." (Call `send_quotation_email`).
   - Once they clearly agree to apply: Call `submit_new_proposal` and read out the confirmation reference number with warm gratitude.
```

