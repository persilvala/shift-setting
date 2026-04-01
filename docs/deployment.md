# Deployment Guide

## Vercel Deployment

### Initial Setup
```bash
npm i -g vercel
vercel login
vercel
```

### Environment Variables
Add these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_SUPABASE_URL` | (if using Supabase features) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (if using Supabase features) |

### Deploy Commands
```bash
vercel              # Preview deploy
vercel --prod       # Production deploy
vercel --prod --yes # Auto-confirm
```

---

## Database: Neon Setup

### Why Neon?
- Free tier: 0.5 GB storage, ~4 hours compute/month
- Works seamlessly with Vercel (no IP blocking issues)
- Serverless - scales to zero when idle

### Creating a Neon Project
1. Go to https://neon.tech
2. Sign up with GitHub
3. Create a new project: `shift-setting`
4. Copy the connection string (Prisma format)

### Local Development
Add to `.env`:
```bash
DATABASE_URL="postgresql://user:password@host/neondb?sslmode=require"
```

### Running Migrations
```bash
npx prisma migrate deploy
```

### Seeding Admin User
```bash
npm run prisma:seed
# or
npx tsx prisma/seed.ts
```

Default admin credentials:
- Username: `admin`
- Password: `123`

---

## Supabase (Deprecated)

We initially tried Supabase but encountered IP blocking issues with Vercel. The connection string format that works with Supabase:

### Pooler Connection (Port 6543)
```bash
postgresql://postgres:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Direct Connection (Port 5432)
```bash
postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require
```

Note: Supabase's free tier may block Vercel IPs. Neon is recommended for Vercel deployments.

---

## Key Files Modified

### lib/db.ts
```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### next.config.ts
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
};

export default nextConfig;
```

---

## Troubleshooting

### Login Not Working
1. Check Vercel logs: `vercel logs shift-setting`
2. Verify DATABASE_URL is set in Vercel
3. Test locally: `npx tsx prisma/seed.ts`

### Build Failures
- Ensure `postinstall` script runs `prisma generate`
- ESLint errors: Add to `next.config.ts`:
  ```typescript
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  ```

### Database Connection Timeout
- Switch to Neon (recommended for Vercel)
- Or check Supabase IP allowlist settings

---

## Rollback to Local Development

To switch back to local PostgreSQL:
1. Update `.env`:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shift_setting"
   ```
2. Run migrations: `npx prisma migrate dev`
3. Seed: `npm run prisma:seed`
