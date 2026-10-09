from pathlib import Path


def test_gcp_diagnostics_does_not_mutate_the_database():
    diagnostics = (
        Path(__file__).resolve().parents[3] / "deploy" / "gcp" / "diagnostics.sh"
    ).read_text(encoding="utf-8")

    assert "psycopg.connect" not in diagnostics
    assert "DELETE FROM" not in diagnostics.upper()
    assert "INSERT INTO" not in diagnostics.upper()
    assert "UPDATE " not in diagnostics.upper()
    assert "TRUNCATE " not in diagnostics.upper()
