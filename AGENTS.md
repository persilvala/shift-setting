# Agent Guidelines for shift-setting

## Project Overview
This is a Next.js 16 payroll/timesheet management application with PostgreSQL, Prisma ORM, and NextAuth authentication.

## Commands

### Development
```bash
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run start        # Start production server
```

### Code Quality
```bash
npm run lint         # Run ESLint (uses eslint-config-next with TypeScript)
```

### Testing
```bash
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report

# Run a single test file
npx jest __tests__/uploadApi.test.ts
npx jest --testPathPattern="csvParser"  # Match by filename pattern
npx jest --testNamePattern="should parse"  # Match by test name
```
Note: PDF parser tests are skipped due to ESM module issues (see jest.config.ts).

### Database (Prisma)
```bash
npx prisma migrate dev --name <migration_name>   # Create and apply migration
npx prisma migrate deploy                        # Apply migrations (production)
npx prisma generate                              # Generate Prisma client
npx prisma studio                                # Open Prisma GUI at localhost:5555
npm run prisma:seed                              # Seed database (tsx prisma/seed.ts)
```

## Code Style Guidelines

### TypeScript
- **Strict mode enabled** - no implicit any, strict null checks enforced
- Use explicit type annotations for function parameters and return types
- Use `interface` for object shapes, `type` for unions/aliases
- Avoid `any` - use `unknown` with proper type narrowing when type is unclear

### Imports
- Use path alias `@/` for project imports (configured in tsconfig.json)
- Order: 1) External packages, 2) Internal modules, 3) Relative imports
- Prefer named exports over default exports for better refactoring
- Example: `import { prisma } from "@/lib/db"`

### Naming Conventions
- **Files**: kebab-case for utilities (`csv-parser.ts`), PascalCase for components/classes
- **Variables/functions**: camelCase
- **Types/interfaces**: PascalCase with descriptive names (`PayrollEntryData`)
- **Constants**: SCREAMING_SNAKE_CASE for truly constant values
- **Database models**: PascalCase (Prisma convention)

### Error Handling
- API routes must wrap logic in try/catch with proper `NextResponse.json` error responses
- Always return appropriate HTTP status codes (200, 201, 400, 404, 500)
- Log errors server-side for debugging with `console.error`
- Never expose internal error details to client
- Extract error messages with `error instanceof Error ? error.message : "Unknown error"`

### API Routes Pattern (Next.js App Router)
```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // validation...
    const result = await prisma.model.create({ data: {...} });
    return NextResponse.json({ employee: result }, { status: 201 });
  } catch (error) {
    console.error("Error in POST:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### Server Actions Pattern
- Place server actions in `actions/` directory
- Mark files with `"use server"` at the top
- Return `{ success: boolean, error?: string }` for operations with potential failures
- Use `revalidatePath()` after mutations to refresh cached data
```typescript
"use server";
export async function createItem(data: ItemData): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.item.create({ data });
    revalidatePath("/items");
    return { success: true };
  } catch (e) {
    console.error("createItem error:", e);
    return { success: false, error: "Failed to create item" };
  }
}
```

### Async Patterns
- Always use `await` for Prisma and database operations
- Use `prisma.$transaction()` for operations affecting multiple tables
- Avoid nested promises; prefer sequential await when operations are dependent

### Prisma/Database
- Always validate foreign keys before creating related records
- Use transactions (`prisma.$transaction`) for operations affecting multiple tables
- Handle nullable fields appropriately (check with `if (!field)` before use)
- Include related data with `include` option when needed
- Use `@relation` with `onDelete: Cascade` for dependent records
- Use `select` to limit returned fields when you don't need all columns

### React Components
- Use Server Components by default; add `"use client"` only when needed
- Use TypeScript interfaces for component props
- Prefer composition over prop drilling
- Clean up side effects in `useEffect` with cleanup functions

### CSS/Styling
- Uses Tailwind CSS v4 with `@tailwindcss/postcss`
- Custom CSS in `app/globals.css`
- Use Tailwind utility classes for component styling

### Comments
- Add comments explaining *why*, not *what*
- Avoid redundant comments that restate obvious code
- Use JSDoc for public API functions if needed

### Formatting
- 2 spaces for indentation (project default)
- Single quotes for strings
- No semicolons at end of statements
- Trailing commas in multi-line objects/arrays
- Max line length: ~100 characters (soft limit)

## Project Structure
```
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth handlers
│   │   ├── employees/     # Employee CRUD
│   │   ├── payroll/       # Payroll operations
│   │   ├── timesheets/    # Timesheet upload/parsing
│   │   └── ...
│   ├── admin/             # Admin pages (protected)
│   │   ├── dashboard/
│   │   ├── employees/
│   │   ├── payroll/
│   │   ├── timesheets/
│   │   └── ...
│   ├── login/             # Login page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── actions/               # Server Actions (auth, mutations)
├── components/            # React components
│   ├── layout/           # Layout components
│   ├── payroll/          # Payroll components
│   ├── timesheets/       # Timesheet components
│   └── ...
├── lib/                   # Utilities, db client, types
│   ├── db.ts             # Prisma client singleton
│   ├── types.ts          # Shared TypeScript types
│   ├── attendanceCalculator.ts
│   ├── excelParser.ts
│   └── timesheetParser.ts
├── prisma/                # Schema, migrations, seed
├── __tests__/             # Test files (Jest with ts-jest)
└── scripts/               # Standalone scripts
```

## Authentication
- Uses NextAuth v5 with credentials provider
- JWT session strategy with 7-day expiry
- Password hashing with bcryptjs
- Admin accounts require `mustChangePassword` flag handling

## Environment Variables
Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - NextAuth secret for token signing

## Database Schema Summary
- **Admin** - User accounts with password hash
- **Employee** - Employee records with base pay per day
- **Timesheet** - Uploaded timesheet files with date ranges
- **TimesheetRow** - Individual rows from timesheet uploads
- **Payroll** - Generated payroll periods
- **PayrollEntry** - Individual employee entries in payroll

## Testing Notes
- Tests use Jest with ts-jest preset
- `@/` alias works in tests via moduleNameMapper in jest.config.ts
- Some tests may be skipped (e.g., pdfParser tests due to ESM issues)
- Coverage thresholds: 50% for branches, functions, lines, statements

## Security Guidelines
- Never log sensitive data (passwords, tokens, personal info)
- Validate all user input in API routes and server actions
- Use Prisma's parameterized queries (automatic) for SQL injection prevention
- Hash passwords with bcryptjs before storing
- Always check session/auth before sensitive operations
