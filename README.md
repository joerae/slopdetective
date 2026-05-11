<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e9474fa6-1f1f-435f-bb7b-5b100cf63441

## Run Locally

**Prerequisites:** Node.js

This is a Vite React app. Do not open `index.html` directly and do not use the VS Code "Go Live" button for development; Vite needs to compile and serve `index.tsx`.

1. Install dependencies the first time you set up the project, or any time dependencies change:
   ```powershell
   npm.cmd install
   ```
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   ```powershell
   npm.cmd run dev
   ```
4. Open the local Vite URL in your browser:
   ```text
   http://localhost:3000/
   ```
   If Vite reports a different port because `3000` is already in use, open the URL printed in the terminal instead.

If you are using Command Prompt instead of PowerShell, `npm install` and `npm run dev` are also fine. In PowerShell on this machine, use `npm.cmd` because the `npm.ps1` wrapper may be blocked by Windows execution policy.

## API Key on Netlify

The Gemini API key must stay server-side. The browser app calls `/.netlify/functions/analyze`, and that Netlify Function reads `process.env.GEMINI_API_KEY`.

For Netlify:

1. In the Netlify project, add an environment variable named `GEMINI_API_KEY`.
2. If Netlify asks for scopes, make sure the variable is available to **Functions**.
3. Mark it as secret / contains secret values.
4. Do not create a `VITE_GEMINI_API_KEY` or otherwise expose the key to frontend code.

For local development, keep `GEMINI_API_KEY` in `.env.local`. That file is ignored by Git.

## Error Logging

Logging is intentionally simple for now: structured JSON to the local terminal and to Netlify Function logs.

What gets logged:

- `analysis_started`
- `analysis_completed`
- `analysis_failed`
- `client_error`
- `client_error_logging_failed`

Each log entry includes a `requestId` so a user-facing error can be matched to the function logs.

`analysis_failed` entries also include:

- `model`
- `errorCode`
- `statusCode`
- `retryable`

The browser error response includes the same `requestId`, plus a clearer `error` message for common Gemini failures:

- `gemini_quota`: Gemini quota or rate limit was reached. Check the Gemini API key quota or billing if it persists.
- `gemini_auth`: Gemini rejected the API key. Check `GEMINI_API_KEY`.
- `gemini_timeout`: Gemini did not respond before the request timed out.
- `gemini_unavailable`: Gemini is temporarily unavailable.
- `gemini_bad_response`: Gemini returned an empty or unreadable response.
- `missing_api_key`: `GEMINI_API_KEY` is not configured for the function.
- `invalid_request`: The browser sent an invalid analysis request.
- `analysis_failed`: An unclassified failure occurred; use the `requestId` to inspect the function log.

What does not get logged:

- Submitted text
- Gemini API keys
- Full request bodies

Local logs appear in the terminal running `npm.cmd run dev`. If the dev server was started in the background by Codex, check `vite-dev.out.log` and `vite-dev.err.log`.

Netlify logs are under the deployed site's **Logs & Metrics > Functions** area. Check the `analyze` function for Gemini/API failures and the `log-error` function for browser-side errors reported by the app.

For longer retention or alerting later, add a dedicated service such as Sentry, Better Stack, Datadog, or a Netlify log drain.

## Gemini Model

The server uses `gemini-3-flash-preview`, and the UI shows `Gemini 3 Flash Preview Online`.

## NPM, not Powershell for Codex
Hey Codex, whenever you try to run Powershell commands, stuff seems to get blocked. And then you try rerunning as npm.cmd and it works. So try that way first.
