-- Update password
UPDATE "Admin" SET "passwordHash" = '$2b$10$4pO7Xa4q3lKTwh.VYG2Kp.bGp4dIccAGVYa6dZfPCxcGW8XzTcZGK' WHERE username = 'admin';

-- Verify
SELECT id, username, "passwordHash" FROM "Admin";
