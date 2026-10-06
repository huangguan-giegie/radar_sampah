"""Schema creation must precede table discovery on an isolated deployment."""
from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects import postgresql

import app_core as impl


@pytest.mark.parametrize("schema_exists", [False, True])
def test_configured_postgres_schema_exists_before_migrations(monkeypatch, schema_exists):
    monkeypatch.setenv("DATABASE_SCHEMA", "radar_v2")
    engine = MagicMock()
    engine.dialect.name = "postgresql"
    connection = engine.begin.return_value.__enter__.return_value
    inspector = MagicMock()
    inspector.has_schema.return_value = schema_exists
    monkeypatch.setattr(impl, "inspect", lambda _connection: inspector)
    statements = []
    connection.execute.side_effect = lambda statement: statements.append(str(statement.compile(dialect=postgresql.dialect())))

    class DiscoveryReached(Exception):
        pass

    def discover_tables(_engine):
        assert statements == ([] if schema_exists else ["CREATE SCHEMA IF NOT EXISTS radar_v2"])
        inspector.has_schema.assert_called_once_with("radar_v2")
        raise DiscoveryReached

    monkeypatch.setattr(impl, "migrate_legacy_reports_table", discover_tables)
    with pytest.raises(DiscoveryReached):
        impl.initialise_database(engine)


def test_invalid_schema_is_rejected_before_opening_database(monkeypatch):
    monkeypatch.setenv("DATABASE_SCHEMA", 'radar; DROP SCHEMA public')
    engine = MagicMock()
    engine.dialect.name = "postgresql"
    with pytest.raises(RuntimeError, match="valid PostgreSQL schema name"):
        impl.initialise_database(engine)
    engine.begin.assert_not_called()
