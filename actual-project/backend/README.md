# Marine Observation API

Run locally from this directory:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

The service exposes `/health`, `/api/observations` and a small `POST`
reporting flow. All records are synthetic demo data and are held in memory.
No personal data, external AI, or production database is used in this starter.

