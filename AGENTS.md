# Agent Guidelines for shift-setting

## Project Overview
Next.js 16 payroll/timesheet management app with PostgreSQL, Prisma ORM, and NextAuth authentication.

## Commands

### Development
```bash
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking
```

### Testing
```bash
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
npx jest __tests__/uploadApi.test.ts      # Single file
npx jest --testPathPattern="csvParser"   # Match by pattern
npx jest --testNamePattern="should parse" # Match by name
```
Note: PDF parser tests are skipped due to ESM issues.

### Database (Prisma)
```bash
npx prisma migrate dev --name <name>  # Create and apply migration
npx prisma migrate deploy             # Production migrations
npx prisma generate                   # Generate client
npx prisma studio                     # GUI at localhost:5555
npm run prisma:seed                   # Seed database
```

## Code Style Guidelines

### TypeScript
- **Strict mode enabled** - no implicit any, strict null checks
- Use explicit type annotations for function parameters/returns
- Use `interface` for object shapes, `type` for unions/aliases
- Avoid `any` - use `unknown` with proper type narrowing

### Imports & Naming
- Use path alias `@/` for project imports
- Order: external packages → internal modules → relative imports
- Prefer named exports over default exports
- **Files**: kebab-case for utilities, PascalCase for components
- **Variables/functions**: camelCase
- **Types**: PascalCase (`PayrollEntryData`)
- **Constants**: SCREAMING_SNAKE_CASE

### Formatting
- 2 spaces indentation
- Single quotes for strings, no semicolons
- Trailing commas in multi-line objects/arrays

### Error Handling (API Routes)
```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await prisma.model.create({ data: {...} });
    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    console.error("Error in POST:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### Server Actions Pattern
- Place in `actions/` directory with `"use server"` at top
- Return `{ success: boolean, error?: string }`
- Use `revalidatePath()` after mutations

### Prisma/Database
- Use `prisma.$transaction()` for multi-table operations
- Handle nullable fields with `if (!field)` checks
- Use `include` for related data, `select` to limit fields
- Use `@relation` with `onDelete: Cascade` for dependent records

### React Components
- Use Server Components by default; add `"use client"` only when needed
- TypeScript interfaces for component props

### CSS
- Tailwind CSS v4 with `@tailwindcss/postcss`
- Custom CSS in `app/globals.css`

## Project Structure
```
├── app/              # Next.js App Router (api/, admin/, login/)
├── actions/          # Server Actions
├── components/       # React components
├── lib/              # Utilities, db client, parsers
├── prisma/           # Schema, migrations, seed
└── __tests__/        # Jest test files
```

## Authentication
- NextAuth v5 with credentials provider
- JWT session strategy, 7-day expiry
- Password hashing with bcryptjs

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - NextAuth secret for token signing

## Database Schema
- **Admin** - User accounts with password hash
- **Employee** - Employee records with base pay per day
- **Timesheet** - Uploaded files with date ranges
- **TimesheetRow** - Individual rows (unique employeeId + date)
- **Payroll** - Generated payroll periods
- **PayrollEntry** - Employee entries with attendance tracking

## Key Workflows

### Timesheet Upload
1. Upload xlsx/csv/pdf via `/api/timesheets/upload`
2. Parse and merge with existing rows
3. Save via `POST /api/timesheets` or `PUT /api/timesheets/[id]`

### Payroll Generation
1. Select pending timesheet
2. Enter date range and filters
3. Generate payroll via `POST /api/payroll`
4. Timesheet marked as processed

### Duplicate Prevention
- Database check via `GET /api/payroll/check-duplicate?timesheetId=xxx`

## Security Guidelines
- Never log sensitive data (passwords, tokens)
- Validate all user input in API routes and server actions
- Use Prisma's parameterized queries (automatic)
- Hash passwords with bcryptjs before storing
- Always check session/auth before sensitive operations
