# Security Plan — Marine Observation MVP

## Implemented or intended MVP controls

- Use synthetic and public data only.
- Avoid names, contact details and account identifiers.
- Validate category, timestamp and location fields on the server.
- Mask or aggregate locations for threatened species.
- Keep API keys in deployment environment variables, never in Git.
- Label AI/classification output as illustrative.

## Not yet established

- Production authentication and role-based access.
- Encryption and formal retention/deletion controls.
- PDPA or other formal privacy review.
- Environmental enforcement or scientific validation.
- Production monitoring and incident response.

## Release gates

Do not use real personal data, exact sensitive-species locations or unreviewed external AI output in the demo. Do not claim that a hotspot score proves the source of pollution or directs enforcement action.
