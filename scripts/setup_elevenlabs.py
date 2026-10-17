"""Create or update the ezpolicy ElevenLabs agent, its webhook tools, and (once Twilio keys are in .env) the phone number.

Re-run whenever the public URL changes. Keys come from .env; prompt texts come from agent/setup.md.
Usage: python3 scripts/setup_elevenlabs.py [public_base_url]   # default: the running ngrok tunnel
"""
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / ".env"
API = "https://api.elevenlabs.io/v1"
LIBRARY_VOICE = ("7398804d9eaf2f463899a907587c33a390591775784f87857b6d0e1e4e3e66f6", "KYiVPerWcenyBTIvWbfY")  # "Sia", Hindi
FALLBACK_VOICE = "EXAVITQu4vr4xnSDxMaL"  # premade "Sarah"
DEMO_USER = "1590824686249448"  # Abhishek Chopra, used for dashboard test placeholders

env = dict(re.findall(r"^([A-Z_]+)=(.*)$", ENV.read_text(), re.M))


def call(method, path, body=None, fail_ok=False):
    req = urllib.request.Request(
        API + path,
        method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={"xi-api-key": env["ELEVENLABS_API_KEY"], "content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        if fail_ok:
            return None
        sys.exit(f"{method} {path} -> {e.code}: {e.read().decode()[:1500]}")


def set_env(key, value):
    text = ENV.read_text()
    if re.search(rf"^{key}=", text, re.M):
        text = re.sub(rf"^{key}=.*$", lambda _: f"{key}={value}", text, flags=re.M)
    else:
        text += f"\n{key}={value}\n"
    ENV.write_text(text)
    env[key] = value


base = sys.argv[1] if len(sys.argv) > 1 else json.load(
    urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels"))["tunnels"][0]["public_url"]

md = (ROOT / "agent" / "setup.md").read_text()
prompt, rules = re.findall(r"```text\n(.*?)```", md, re.S)
first_message = re.search(r"^\s*> (Namaste .*)$", md, re.M).group(1)

# --- webhook tools: create, or point existing ones at the current URL ---
TOOLS = {
    "get_quotes": ("/api/quotes", "Returns real premiums from the price table for a family, sorted by monthly cost. Call this before saying any price.", {
        "adults": ("number", "Adults to cover (1 or 2)"),
        "children": ("number", "Children to cover (0 to 2)"),
        "eldestAge": ("number", "Age of the eldest person covered"),
        "budgetMonthly": ("number", "Comfortable monthly amount in rupees, if the customer gave one"),
    }, ["adults", "children", "eldestAge"]),
    "submit_proposal": ("/api/proposals", "Submits the plan the customer agreed to. Only call after the customer clearly says yes.", {
        "productId": ("string", "productId of the chosen plan, from get_quotes"),
        "cover": ("number", "Cover amount in rupees of the chosen plan"),
        "addTopUp": ("boolean", "True if adding the Care Health super top-up"),
        "declaredConditions": ("string", "Any new health conditions the customer mentioned"),
        "notes": ("string", "One-line summary of what was agreed"),
    }, ["productId", "cover", "addTopUp"]),
}
existing = {t["tool_config"]["name"]: t["id"] for t in call("GET", "/convai/tools").get("tools", [])}
tool_ids = []
for name, (path, description, params, required) in TOOLS.items():
    config = {"tool_config": {
        "type": "webhook",
        "name": name,
        "description": description,
        "api_schema": {
            "url": base + path,
            "method": "POST",
            "request_headers": {"ngrok-skip-browser-warning": "true"},
            "request_body_schema": {
                "type": "object",
                "description": f"Arguments for {name}",
                "properties": {k: {"type": t, "description": d} for k, (t, d) in params.items()},
                "required": required,
            },
        },
    }}
    if name in existing:
        call("PATCH", f"/convai/tools/{existing[name]}", config)
        tool_ids.append(existing[name])
    else:
        tool_ids.append(call("POST", "/convai/tools", config)["id"])

# --- voice: add the Hindi library voice once, else fall back to a premade one ---
mine = {v["name"]: v["voice_id"] for v in call("GET", "/voices")["voices"]}
voice_id = mine.get("Sia ezpolicy")
if not voice_id:
    added = call("POST", f"/voices/add/{LIBRARY_VOICE[0]}/{LIBRARY_VOICE[1]}", {"new_name": "Sia ezpolicy"}, fail_ok=True)
    voice_id = added["voice_id"] if added else FALLBACK_VOICE

# --- agent ---
profile = json.loads((ROOT / "backend" / "data" / "insurance.json").read_text())["customers"][DEMO_USER]
system = lambda kind: {"name": kind, "description": "", "type": "system", "params": {"system_tool_type": kind}}
agent = {
    "name": "ezpolicy",
    "conversation_config": {
        "agent": {
            "first_message": first_message,
            "language": "hi",
            "dynamic_variables": {"dynamic_variable_placeholders": {
                "customer_name": profile["name"].split()[0],
                "today": "2026-10-14",
                "cycle_end": "15 October",
                "customer_profile": json.dumps(profile),
            }},
            "prompt": {
                "prompt": f"{prompt}\n## Rules sheet\n{rules}",
                "llm": "gemini-2.5-flash",
                "tool_ids": tool_ids,
                "built_in_tools": {"end_call": system("end_call"), "language_detection": system("language_detection")},
            },
        },
        "tts": {"voice_id": voice_id},
        "language_presets": {"en": {"overrides": {"agent": {"first_message": (
            "Hello {{customer_name}}, this is ezpolicy calling about your health cover. "
            "Your cover cycle ends on {{cycle_end}}. Do you have two minutes?")}}}},
    },
}
if env.get("ELEVENLABS_AGENT_ID"):
    call("PATCH", f"/convai/agents/{env['ELEVENLABS_AGENT_ID']}", agent)
else:
    set_env("ELEVENLABS_AGENT_ID", call("POST", "/convai/agents/create", agent)["agent_id"])

# --- phone number: import the Twilio number once its keys are in .env, then assign the agent ---
if not env.get("ELEVENLABS_PHONE_NUMBER_ID") and all(env.get(k) for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER")):
    number = call("POST", "/convai/phone-numbers", {
        "provider": "twilio",
        "label": "ezpolicy",
        "phone_number": env["TWILIO_PHONE_NUMBER"],
        "sid": env["TWILIO_ACCOUNT_SID"],
        "token": env["TWILIO_AUTH_TOKEN"],
    })
    set_env("ELEVENLABS_PHONE_NUMBER_ID", number["phone_number_id"])
if env.get("ELEVENLABS_PHONE_NUMBER_ID"):
    call("PATCH", f"/convai/phone-numbers/{env['ELEVENLABS_PHONE_NUMBER_ID']}", {"agent_id": env["ELEVENLABS_AGENT_ID"]})

print(f"tools -> {base}  ({', '.join(TOOLS)})")
print(f"voice: {'Sia (Hindi library voice)' if voice_id != FALLBACK_VOICE else 'Sarah (premade fallback)'}")
print(f"agent: {env['ELEVENLABS_AGENT_ID']}")
print(f"phone number: {env.get('ELEVENLABS_PHONE_NUMBER_ID') or 'not yet: add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to .env and re-run'}")
