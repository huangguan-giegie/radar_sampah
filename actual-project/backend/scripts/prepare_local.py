"""Prepare persistent local secrets and connect Vite to this backend."""
from pathlib import Path
import secrets


def prepare() -> None:
    backend = Path(__file__).resolve().parents[1]
    env = backend / ".env"
    if not env.exists():
        env.write_text(
            f"AUTH_JWT_SECRET={secrets.token_urlsafe(48)}\n"
            "DATABASE_URL=sqlite:///radar_sampah.db\n"
            "FRONTEND_ORIGINS=http://127.0.0.1:5173,http://localhost:5173\n"
            "PHOTO_STORAGE_DIR=tmp/private-photos\n"
            "PORT=5000\n", encoding="utf-8",
        )
    frontend_env = backend.parent / "frontend" / ".env.local"
    if not frontend_env.exists():
        frontend_env.write_text("VITE_API_BASE_URL=/api\n", encoding="utf-8")
    print("Local configuration ready. Existing settings and secrets were preserved.")


if __name__ == "__main__":
    prepare()
