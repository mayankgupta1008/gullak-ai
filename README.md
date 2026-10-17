# ezpolicy

A planned Hindi/English voice assistant for health insurance renewal. It will read organiser-provided insurance data, explain supported options and submit a mock proposal after customer confirmation.

The application is currently a React/Vite and Express starter. Voice, quote and proposal features are not implemented yet.

- [Product design](docs/superpowers/specs/2026-10-17-ezpolicy-insurance-agent-design.md)
- [Detailed implementation plan](docs/superpowers/plans/2026-10-17-ezpolicy-implementation-plan.md)

The plan covers architecture, data import, API contracts, quote calculations, ElevenLabs tools, UI behavior, build phases and acceptance checks. It records the missing dataset and local toolchain prerequisites.

The local project has been renamed to `ezpolicy`. Git history and the existing hosted origin are preserved; the hosted repository has not been renamed. Restore repository URL metadata once the hosted name is finalized.

Organiser data belongs in ignored `backend/data/`. Do not commit extracted customer records or secrets. This simulated flow does not issue insurance or collect payments.
