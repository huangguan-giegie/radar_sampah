"""Register the supplied 82-beach export without inventing missing locations."""

import json
from pathlib import Path
from sqlalchemy import MetaData, bindparam, inspect, select, text, update
from sqlalchemy.schema import CreateTable


def configure_expanded_beaches(impl):
    if getattr(impl, '_expanded_beaches_configured', False):
        return
    original = impl.load_beaches
    catalogue = json.loads((Path(__file__).parent / 'data' / 'expanded_beaches.json').read_text(encoding='utf-8'))
    by_id = {row['id']: row for row in catalogue['beaches']}
    core_ids = {'morib', 'remis', 'kelanang', 'bagan'}

    def load_beaches(engine=None):
        rows = original(engine)
        if engine is None:
            known = {row['id'] for row in rows}
            rows.extend(row for row in catalogue['beaches'] if row['id'] not in known)
        return [{**by_id.get(row['id'], {}), **row,
                 'validatedCore': row['id'] in core_ids,
                 'region': by_id.get(row['id'], {}).get('region', 'selangor'),
                 'locationSource': by_id.get(row['id'], {}).get('locationSource'),
                 'catalogueSource': by_id.get(row['id'], {}).get('catalogueSource'),
                 'locationStatus': by_id.get(row['id'], {}).get('locationStatus', 'Validated core beach')} for row in rows]

    impl.load_beaches = load_beaches
    impl._expanded_beaches_configured = True
    impl.beaches_table.c.lat.nullable = True
    impl.beaches_table.c.lng.nullable = True
    impl.BEACH_SUMMARY_FIELDS += ('validatedCore', 'region', 'locationSource', 'catalogueSource', 'locationStatus')


def refresh_expanded_beach_locations(engine, impl):
    """Refresh curated locations on existing export rows without replacing evidence."""
    catalogue = json.loads((Path(__file__).parent / 'data' / 'expanded_beaches.json').read_text(encoding='utf-8'))
    locations = {row['id']: row for row in catalogue['beaches']
                 if row.get('catalogueSource', {}).get('sourceRow') in range(1, 83)
                 and row['id'] not in {'morib', 'remis', 'kelanang', 'bagan'}}
    if not locations:
        return
    table = impl.beaches_table
    with engine.begin() as connection:
        existing = connection.execute(select(table.c.id, table.c.lat, table.c.lng, table.c.area)
                                      .where(table.c.id.in_(locations))).mappings().all()
        changes = []
        for row in existing:
            location = locations[row['id']]
            if (row['lat'], row['lng'], row['area']) != (location['lat'], location['lng'], location['area']):
                changes.append({'beach_key': row['id'], 'latitude': location['lat'],
                                'longitude': location['lng'], 'beach_area': location['area']})
        if changes:
            connection.execute(update(table).where(table.c.id == bindparam('beach_key'))
                               .values(lat=bindparam('latitude'), lng=bindparam('longitude'),
                                       area=bindparam('beach_area')), changes)


def ensure_optional_beach_coordinates(engine, impl):
    if engine.dialect.name == 'postgresql':
        schema = impl.database_schema()
        table = f'"{schema}".beaches' if schema else 'beaches'
        with engine.begin() as connection:
            connection.execute(text(f'ALTER TABLE {table} ALTER COLUMN lat DROP NOT NULL'))
            connection.execute(text(f'ALTER TABLE {table} ALTER COLUMN lng DROP NOT NULL'))
    elif engine.dialect.name == 'sqlite':
        columns = inspect(engine).get_columns('beaches')
        if all(column['nullable'] for column in columns if column['name'] in {'lat', 'lng'}):
            return
        # SQLite needs a table copy to relax NOT NULL. Keep existing keys,
        # related reports, custom indexes and triggers in one transaction.
        replacement = impl.beaches_table.to_metadata(MetaData(), name='beaches_coordinate_migration')
        names = [column['name'] for column in columns if column['name'] in replacement.c]
        quoted = ', '.join(f'"{name}"' for name in names)
        with engine.connect() as connection:
            foreign_keys = connection.execute(text('PRAGMA foreign_keys')).scalar()
            objects = connection.execute(text("SELECT sql FROM sqlite_master WHERE tbl_name = 'beaches' AND type IN ('index', 'trigger') AND sql IS NOT NULL")).scalars().all()
            connection.commit()
            connection.execute(text('PRAGMA foreign_keys = OFF'))
            connection.commit()
            try:
                with connection.begin():
                    connection.execute(CreateTable(replacement))
                    connection.execute(text(f'INSERT INTO beaches_coordinate_migration ({quoted}) SELECT {quoted} FROM beaches'))
                    connection.execute(text('DROP TABLE beaches'))
                    connection.execute(text('ALTER TABLE beaches_coordinate_migration RENAME TO beaches'))
                    for statement in objects:
                        connection.execute(text(statement))
            finally:
                connection.execute(text(f'PRAGMA foreign_keys = {int(bool(foreign_keys))}'))
                connection.commit()
