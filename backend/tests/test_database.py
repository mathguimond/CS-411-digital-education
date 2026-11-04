from sqlalchemy import inspect, text
from app.database import Base, database_url
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
            self.assertEqual(connection.scalar(text('select version_num from alembic_version')), '0001_study')
        self.assertTrue(self.client.get('/api/health').json['database_ready'])
