# FigBack

Turn Figma comments into organized, prioritized design feedback.

FigBack watches your Figma files for new comments, classifies them with AI, and generates visual digests your team can act on.

- **Auto-sync** comments from any Figma file
- **AI classification** with Gemini, GPT, or Claude (priority, category, effort)
- **Visual digests** with executive summaries and action items
- **Integrations** with Slack, Confluence, and push notifications

---

## Deploy Your Own Copy (No Coding Required)

You don't need to be a developer to set this up. Follow these steps and you'll have your own FigBack instance running in about 15 minutes.

### Step 1: Fork this repository

Go to [github.com/miroslavgruevski-dsgn/FigBack](https://github.com/miroslavgruevski-dsgn/FigBack) and click the **Fork** button in the top right. This creates your own copy of the project. If you don't have a GitHub account, create one first (free).

### Step 2: Deploy to Vercel

Click the button below to deploy. Sign in to Vercel with your GitHub account when prompted.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/miroslavgruevski-dsgn/FigBack)

Choose the free "Hobby" plan. The first deploy will fail because we haven't added the required settings yet. That's expected.

### Step 3: Add a database

1. In your Vercel project, click the **Storage** tab in the left sidebar
2. Click **Create Database**
3. Select **Neon Postgres**
4. Pick the **Free** plan and click **Continue**
5. Finish the setup. Vercel automatically connects the database for you.

### Step 4: Set up Google sign-in

This lets your team sign in with their Google accounts.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project (call it "FigBack")
2. In the left sidebar, go to **APIs & Services > OAuth consent screen**
3. Choose **Internal** (if your org uses Google Workspace) or **External**
4. Fill in the app name ("FigBack") and your email, then click through the remaining steps
5. Go to **Credentials** in the left sidebar
6. Click **Create Credentials > OAuth 2.0 Client ID**
7. Set application type to **Web application**
8. Under **Authorized redirect URIs**, click **Add URI** and enter:
   `https://YOUR-PROJECT.vercel.app/api/auth/callback/google`
   (replace `YOUR-PROJECT` with your actual Vercel domain, e.g. `fig-back.vercel.app`)
9. Click **Create**
10. Copy the **Client ID** and **Client Secret**. You'll need these in Step 7.

> Note: it can take 5-10 minutes for Google to activate a new OAuth client. If sign-in fails right after setup, wait and try again.

### Step 5: Get a Figma token

1. Go to [Figma Account Settings](https://www.figma.com/developers/api#access-tokens)
2. Scroll down to **Personal access tokens**
3. Click **Generate new token**
4. Give it a name (e.g. "FigBack") and make sure it has **File content** and **File comments** read access
5. Copy the token. You'll need this in Step 7.

### Step 6: Get an AI key

FigBack uses AI to classify comments. The easiest option is Google's Gemini (free tier available):

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **Create API Key**
3. Copy the key. You'll need this in Step 7.

### Step 7: Generate secrets

FigBack needs three random secret strings. Go to [generate.plus/en/base64](https://generate.plus/en/base64), set length to 32, and generate three separate values. You'll use them as:

- `AUTH_SECRET`
- `CRON_SECRET`
- `IMAGE_SIGN_SECRET`

### Step 8: Add environment variables on Vercel

1. In your Vercel project, go to **Settings** (left sidebar) then **Environment Variables**
2. Add each of the following (click **Add Another** between each one):

| Key | Value |
|---|---|
| `AUTH_GOOGLE_ID` | Client ID from Step 4 |
| `AUTH_GOOGLE_SECRET` | Client Secret from Step 4 |
| `AUTH_SECRET` | First random string from Step 7 |
| `AUTH_TRUST_HOST` | `true` |
| `ALLOWED_EMAIL_DOMAIN` | `symphony.is` (or leave empty to allow any email) |
| `FIGMA_ACCESS_TOKEN` | Token from Step 5 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | API key from Step 6 |
| `CRON_SECRET` | Second random string from Step 7 |
| `IMAGE_SIGN_SECRET` | Third random string from Step 7 |

3. Make sure **Environments** is set to "All Environments"
4. Click **Save**

### Step 9: Redeploy

1. Go to the **Deployments** tab in your Vercel project
2. Find the latest deployment
3. Click the **three dots menu** (⋯) on the right
4. Click **Redeploy** and confirm

Wait for the build to finish (about 1-2 minutes).

### Step 10: Sign in and start using FigBack

Visit your Vercel URL (e.g. `https://fig-back.vercel.app`) and sign in with your Google account. The onboarding flow will guide you through connecting Figma files and running your first analysis.

---

## Developer Setup

If you want to run FigBack locally for development.

### Prerequisites

- Node.js 20+
- PostgreSQL database (local or hosted)
- Environment variables (see `.env.example`)

### Install and run

```bash
git clone https://github.com/miroslavgruevski-dsgn/FigBack.git && cd FigBack
cp .env.example .env.local
npm install
```

Fill in `.env.local` following the instructions inside `.env.example`, then:

```bash
npx prisma migrate deploy
npm run dev
```

The app starts at `http://localhost:3000`.

### Environment Variables

See `.env.example` for the full list with setup instructions for each service.

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `FIGMA_ACCESS_TOKEN` | [Figma Settings](https://www.figma.com/developers/api#access-tokens) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `CRON_SECRET` / `IMAGE_SIGN_SECRET` | `openssl rand -base64 32` |

Google OAuth redirect URIs:
- Dev: `http://localhost:3000/api/auth/callback/google`
- Prod: `https://your-domain.com/api/auth/callback/google`

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run check` | Lint + typecheck |
| `npm run test` | Run Playwright E2E tests |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:push` | Push schema changes (dev only) |
| `npm run db:studio` | Open Prisma Studio |

---

## Tech Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS v4, shadcn/ui
- Prisma, PostgreSQL
- Vercel AI SDK (Gemini / GPT / Claude)
- Auth.js v5 (Google OAuth)
- Vercel Blob Storage

## Troubleshooting

**"invalid_client" error when signing in with Google**
Google can take 5-10 minutes to activate a new OAuth client. Wait and try again. Also double-check that your redirect URI matches your actual Vercel URL exactly.

**"Access Denied" after signing in**
FigBack restricts sign-in to `@symphony.is` emails by default. To change this, update the `ALLOWED_EMAIL_DOMAIN` environment variable on Vercel (or remove it to allow any email).

**Build fails on Vercel**
Make sure all required environment variables are set (Step 8). The most common cause is a missing `AUTH_SECRET` or `DATABASE_URL`.

**Cron job error on Hobby plan**
The free Vercel plan only supports daily cron jobs. FigBack is already configured for this. If you see a cron-related error, redeploy and it should resolve.

## License

MIT
