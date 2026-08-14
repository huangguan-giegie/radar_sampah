# Security Plan - Marine Observation MVP

## Implemented MVP boundary

- Accept synthetic/public demonstration data only.
- Reject names, contact details, account identifiers and secrets from the API
  payload.
- Validate category, timestamp, coordinates, image URL scheme and text fields
  on the server.
- Store database credentials only in Render environment variables.
- Allow the deployed frontend through `FRONTEND_ORIGINS`; do not use an open
  CORS policy in the deployed configuration.
- Mask or aggregate sensitive marine-context locations before display.
- Keep external AI and computer vision disabled.
- Use rule-based classification and illustrative priority with visible limits.

## Not claimed or not implemented

- Production authentication, role-based access or MFA.
- Formal encryption, retention/deletion workflow or PDPA compliance.
- Scientific validation, pollution-source attribution or enforcement workflow.
- Public file upload storage, malware scanning or production incident response.
- Real-time OBIS retrieval or verified species identification.

## Release gates

Before any use beyond the class demo, confirm all of the following:

- a privacy and retention process for real reports;
- authenticated access and a reviewed role model;
- database backups, monitoring and incident handling;
- a reviewed source/update process for marine context data;
- a review of any future external AI or CV data flow;
- a separate approval for publishing locations that could be sensitive.

The deployed demo must never claim that a priority level proves where pollution
came from or directs an official clean-up or enforcement action.
