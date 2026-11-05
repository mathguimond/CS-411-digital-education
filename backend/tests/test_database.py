from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import MetaData, Table, inspect, select, text
from app.database import Base, Participant, database_url, utcnow
from study_fixture import StudyCase


class DatabaseTests(StudyCase):
    def test_heroku_urls_use_psycopg_and_tls_without_overriding_explicit_local_test_options(self):
        self.assertEqual(database_url('postgres://user:password@host/db'), 'postgresql+psycopg://user:password@host/db?sslmode=require')
        self.assertEqual(database_url('postgresql://user:password@host/db?sslmode=disable'), 'postgresql+psycopg://user:password@host/db?sslmode=disable')

    def test_release_migration_is_repeatable_and_matches_the_models(self):
        engine = self.app.extensions['study_database']
        # StudyCase creates a private temporary database/schema, never production storage.
        Base.metadata.drop_all(engine)
        runner = self.app.test_cli_runner()
        first = runner.invoke(args=['db-upgrade'])
        self.assertEqual(first.exit_code, 0, first.output)
        second = runner.invoke(args=['db-upgrade'])
        self.assertEqual(second.exit_code, 0, second.output)
        inspector = inspect(engine)
        for table in Base.metadata.sorted_tables:
            self.assertEqual({column.name for column in table.columns}, {column['name'] for column in inspector.get_columns(table.name)})
        with engine.connect() as connection:
            self.assertEqual(connection.scalar(text('select version_num from alembic_version')), '0002_participant_consent')
        self.assertTrue(self.client.get('/api/health').json['database_ready'])

    def test_consent_migration_preserves_existing_data_without_claiming_prior_consent(self):
        engine = self.app.extensions['study_database']
        Base.metadata.drop_all(engine)
        participant_id = str(uuid4())
        config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
        with engine.begin() as connection:
            config.attributes['connection'] = connection
            command.upgrade(config, '0001_study')
            legacy = Table('participants', MetaData(), autoload_with=connection)
            connection.execute(legacy.insert(), {'id': participant_id, 'token_hash': 'f' * 64, 'gender': 'female', 'age': '22', 'school_level': 'bachelor', 'degree': 'Existing record', 'referrer': 'jan', 'condition': 'ai', 'lesson_version': 'study-v4', 'created_at': utcnow(), 'snapshot': {'answers': {'intro-base': 'A saved explanation.'}}, 'revision': 5})
        result = self.app.test_cli_runner().invoke(args=['db-upgrade'])
        self.assertEqual(result.exit_code, 0, result.output)
        with engine.connect() as connection:
            record = connection.execute(select(Participant).where(Participant.id == participant_id)).mappings().one()
            self.assertEqual(record['degree'], 'Existing record')
            self.assertEqual(record['snapshot']['answers']['intro-base'], 'A saved explanation.')
            self.assertEqual(record['revision'], 5)
            for field in ['consented_at', 'consent_version', 'consent_text']:
                self.assertIsNone(record[field])
