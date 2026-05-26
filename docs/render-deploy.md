# Render deploy

This project can be deployed on Render as two free Docker web services:

- `ransomware-readiness-web`: public frontend URL
- `ransomware-readiness-api`: FastAPI backend used by `/api`

The OpenAI API key is configured only on the backend service.

## Steps

1. Push `render.yaml` to GitHub.
2. Open Render Dashboard.
3. Create a new Blueprint from this repository.
4. When Render asks for `OPENAI_API_KEY`, paste the real key.
5. Wait until both services are deployed.
6. Open the `ransomware-readiness-web` URL.

The app should be opened from the frontend URL. The frontend calls the backend through `/api`, and Caddy proxies that request to the backend service.

## Backend environment

The Blueprint sets:

```env
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-5.4-mini
OPENAI_BASE_URL=https://api.openai.com/v1
APP_ENV=production
DATABASE_URL=sqlite:////tmp/sessions.db
```

`OPENAI_API_KEY` is intentionally marked with `sync: false`, so it is entered in Render and not committed to git.

## Notes

This free demo configuration stores SQLite session data in `/tmp`. Session data may be lost when the service restarts, sleeps, or is redeployed.

For a larger production deployment, move sessions to managed Postgres or attach persistent storage, and add stronger access controls before sharing the link broadly.
