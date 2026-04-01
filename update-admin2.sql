-- Update password with fresh hash
UPDATE "Admin" SET "passwordHash" = '$2b$10$9RXgwIldk15gWfQqByy1JuOYJ0SmgbqQU56LA1eZ3eF/UmvAq5J7y' WHERE username = 'admin';

-- Verify
SELECT id, username, "passwordHash" FROM "Admin";
