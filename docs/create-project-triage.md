# Triage: "Could not create project"

When creating a project fails, use DevTools **Network** → select **`POST /api/projects`** (or **Fetch/XHR** filter).

## Read the response

| HTTP status | `code` (JSON body) | Meaning |
|-------------|-------------------|---------|
| 403 | `csrf_rejected` | Origin host did not match the request host(s). Check URL vs deployment domain (www, preview URL). |
| 400 | `validation_failed` | Body failed Zod (name length, URL shape). See `details` in JSON. |
| 400 | `invalid_json` | Body was not JSON. |
| 400 | `invalid_figma_url` | URL did not yield a file key ([extractFileKey](../src/lib/figma/client.ts)). |
| 409 | `duplicate_file` | That Figma file key is already linked (`FigmaFile.fileKey` is globally unique). Remove the file from the other project or use another file. |
| 400 | `prisma_fk` | Foreign key issue (rare on create). |
| 500 | `prisma_*` | Prisma known error other than duplicate/FK; check server logs and DB. |
| 500 | `server_error` | Unexpected error (often DB connectivity or non-Prisma exception). |

The toast **"Could not create project. Try again."** matches the API **`error`** field for **500** responses above.

If the response body is **HTML** (sign-in page), the session expired: you were redirected by middleware, not by the route handler.

## Git bisect (find a regression)

```bash
git bisect start
git bisect bad main
git bisect good <commit_where_create_worked>
# Then test create project; git bisect good|bad until done
```

Focus files: `src/app/api/projects/route.ts`, `src/lib/csrf.ts`, `src/middleware.ts`.

## Database check (duplicate file)

Same design URL → same **file key**. Query linked keys or inspect **`FigmaFile`** for an existing row with that key before assuming a CSRF or deploy bug.

## Automated API test (local)

1. Add **`E2E_AUTH_SECRET`** (any random string) to **`.env.local`** alongside **`DATABASE_URL`** (same DB the dev server uses).
2. Run:  
   `npm run test:e2e -- e2e/create-project-api.spec.ts`  
   The suite **`POST /api/projects`** twice with the same Figma URL and expects **201** then **409** `duplicate_file`.

Never define **`E2E_AUTH_SECRET`** on production environments.
