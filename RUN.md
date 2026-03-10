# How to Run This Project

## Prerequisites

1. **Node.js** (v18 or later) - Download from https://nodejs.org
2. **PostgreSQL** (v14 or later) - Download from https://www.postgresql.org/download
3. **Git** - For cloning the repository

---

## Step 1: Clone the Repository

```bash
git clone <repository-url>
cd shift-setting
```

---

## Step 2: Install Dependencies

```bash
npm install
```

---

## Step 3: Set Up PostgreSQL

### Option A: Fresh Installation (Windows)

1. Download and install PostgreSQL from https://www.postgresql.org/download
2. During installation:
   - Set port to `5432`
   - Set superuser password (remember this!)
3. Create the database:
   ```bash
   psql -h localhost -U postgres -c "CREATE DATABASE shift_setting;"
   ```
   (Enter your password when prompted)

### Option B: Docker

```bash
docker run --name shift-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=shift_setting -p 5432:5432 -d postgres:16
```

---

## Step 4: Configure Environment Variables

1. Copy the example env file:
   ```bash
   copy .env .env.local
   ```

2. Edit `.env` and update the DATABASE_URL if needed:
   ```
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/shift_setting
   AUTH_SECRET=any-random-string-at-least-32-chars
   ```

   Replace `YOUR_PASSWORD` with your PostgreSQL password.

---

## Step 5: Set Up the Database

```bash
# Apply migrations (creates tables)
npx prisma migrate dev

# Seed the initial admin account
npx prisma db seed
```

If `db seed` doesn't work, run this SQL in pgAdmin or psql:

```sql
INSERT INTO "Admin" (id, username, "passwordHash", "mustChangePassword", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin',
  '$2b$10$WGgJ133AOP00YTg8xsUaJe.ABPS6dh6MvIo8.PGumwrwORperKKNq',
  true,
  NOW(),
  NOW()
);
```

---

## Step 6: Start the App

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Login Credentials

- **Username:** `admin`
- **Password:** `123`

> On first login, you'll be prompted to change your password (minimum 8 characters, 1 uppercase letter).

---

## Troubleshooting

### "Cannot connect to database"
- Make sure PostgreSQL is running
- Check that DATABASE_URL in `.env` has the correct password

### "Port 3000 is already in use"
```bash
# Find and kill the process
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Build errors
```bash
rm -rf .next
npm run build
```
