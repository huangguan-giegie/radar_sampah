# C0 retest checklist

Release-candidate commit: _fill when Iteration 3 is deployed for acceptance testing_.

| Check | Expected | Evidence | Result |
| --- | --- | --- | --- |
| AC2.4.4 cleanup completion | Source report is retained as history and is no longer counted | screenshot + response | Pending |
| AC3.3.3 active freshness | newestCountedReportAt excludes resolved and >90-day reports; beach page shows the date | response + screenshot | Pending |
| Terminology | /method, /method/ai, map marker and legend use the agreed wording | screenshots | Pending |
| D1 invalid beach | Beach not found + Back to map | screenshot + network 404 | Pending |
| D1 offline | You seem to be offline + Retry | screenshot + network/console | Pending |
| F1 cold start | Boot shell is visible before React/API readiness; no write retry | 3G recording or timed screenshots | Pending |
| Beach card | Status card has an opaque background at Remis and other hero images | 390×844 + 320×844 screenshots | Pending |
| D3 draft | Two explicit choices; no browser confirm | screenshot/recording | Pending |
| D5 duplicate | Date + beach shown; raw report ID hidden from warning copy | screenshot | Pending |
| D7 participant ID | Only four digits can be entered before restore | screenshot/recording | Pending |
