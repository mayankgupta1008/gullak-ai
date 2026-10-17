# ezpolicy Insurance Agent Design

Status: updated 17 October 2026. The current voice provider is **Sarvam AI Voice Agents** running inside the web app opened on a phone browser.

## Current Demo Channel

The app no longer depends on outbound telephony. The judge opens the Vite/ngrok URL on a phone, taps **Talk to ezpolicy now**, grants microphone access, and speaks to the Sarvam browser voice session.

```text
Phone browser -> frontend/src/BrowserCall.tsx -> Sarvam browser SDK
Sarvam SDK -> /api/sarvam/* backend proxy -> Sarvam signed WebSocket
Sarvam API tools -> backend ngrok URL -> customer, quotes, proposals
```

## Backend Contract

- `GET /api/customer/active`: returns the active demo customer for the current in-memory session.
- `GET /api/customer/:userId`: returns an explicit customer profile.
- `POST /api/quotes`: computes rate-card-backed quotes. The model must not calculate prices.
- `POST /api/proposals`: submits the agreed proposal and returns `EZP-xxxxxx`.
- `POST /api/session`: validates the selected customer and returns non-secret Sarvam IDs.
- `/api/sarvam/*`: forwards Sarvam runtime requests and injects `SARVAM_API_KEY` server-side.
- `POST /api/call`: intentionally returns `410 Gone`; outbound phone calling is not part of the demo path.

## Agent Instructions

Use `agent/setup.md` as the source of truth for the Sarvam dashboard prompt, rules sheet, and API tool schemas.

Hard rules:

- Health insurance only.
- Use only the event-dataset rate cards.
- Say "cycle check-in", not "renewal".
- Every price comes from `get_quotes`.
- Every customer fact comes from `get_customer`.
- Submit only after clear consent.
