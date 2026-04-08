# FigBack

Turn Figma comments into organized, prioritized design feedback.

FigBack watches your Figma files for new comments, classifies them with AI, and generates visual digests with priorities, action items, and executive summaries.

## Prerequisites

- Node.js 20+
- PostgreSQL database (local or hosted)
- Google Cloud project with OAuth 2.0 credentials
- At least one LLM API key (Google AI, OpenAI, or Anthropic)
- Figma Personal Access Token

## Local Setup

```bash
git clone <repo-url> && cd figback
cp .env.example .env.local
npm install
```

Fill in `.env.local` following the instructions inside `.env.example`, then:

```bash
npx prisma migrate deploy
npm run dev
```

The app starts at `http://localhost:3000`.

## Environment Variables

See `.env.example` for the full list. The essentials:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `FIGMA_ACCESS_TOKEN` | [Figma Settings](https://www.figma.com/developers/api#access-tokens) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `CRON_SECRET` / `IMAGE_SIGN_SECRET` | `openssl rand -base64 32` |

Google OAuth requires an authorized redirect URI:
- Dev: `http://localhost:3000/api/auth/callback/google`
- Prod: `https://your-domain.com/api/auth/callback/google`

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run check` | Lint + typecheck |
| `npm run test` | Run Playwright E2E tests |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:push` | Push schema changes (dev only) |
| `npm run db:studio` | Open Prisma Studio |

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/symphonyis/figback)

Add a Neon Postgres database from the Vercel Marketplace and set the environment variables in your project settings. The `postinstall` script generates the Prisma client automatically.

## Tech Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS v4, shadcn/ui
- Prisma, PostgreSQL
- Vercel AI SDK (Gemini / GPT / Claude)
- Auth.js v5 (Google OAuth)
- Vercel Blob Storage

## License

MIT
