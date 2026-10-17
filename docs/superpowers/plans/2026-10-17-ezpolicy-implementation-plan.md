# ezpolicy Implementation Plan

Status: superseded by the Sarvam browser voice implementation.

The current app uses:

- React/Vite page opened on a phone over HTTPS.
- `sarvam-conv-ai-sdk/browser` for live voice.
- Express `/api/session` for non-secret Sarvam session config.
- Express `/api/sarvam/*` as the server-side API-key proxy.
- Sarvam dashboard API tools calling the existing backend insurance routes.

Do not rebuild outbound phone calling for the demo. The practical demo path is already the phone browser.

## Remaining Setup

1. Create the Sarvam Voice Agent.
2. Paste the prompt and rules from `agent/setup.md`.
3. Configure `get_customer`, `get_quotes`, and `submit_proposal` API tools.
4. Copy `SARVAM_API_KEY`, `SARVAM_ORG_ID`, `SARVAM_WORKSPACE_ID`, and `SARVAM_APP_ID` into `.env`.
5. Run `pnpm start:dev`, expose the app with `ngrok http 5173`, and expose the backend for tools with `ngrok http 5001`.

## Acceptance

- `pnpm -F backend typecheck` passes.
- `pnpm -F frontend build` passes.
- `/api/session` returns Sarvam config for the selected demo customer.
- `/api/sarvam/*` forwards signed-URL requests and fails with a Sarvam auth/resource error when dummy credentials are used.
- `/api/call` returns `410 Gone`.
