web: gunicorn --chdir backend app.main:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 30 --access-logfile -
release: cd backend && flask --app app.main db-upgrade
