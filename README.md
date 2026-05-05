<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e9474fa6-1f1f-435f-bb7b-5b100cf63441

## Run Locally

**Prerequisites:** Node.js

This is a Vite React app. Do not open `index.html` directly and do not use the VS Code "Go Live" button for development; Vite needs to compile and serve `index.tsx`.

1. Install dependencies:
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

If you are using Command Prompt instead of PowerShell, `npm install` and `npm run dev` are also fine. In PowerShell on this machine, use `npm.cmd` because the `npm.ps1` wrapper may be blocked by Windows execution policy.
