-- Insert admin
INSERT INTO "Admin" (username, "passwordHash", "mustChangePassword", "updatedAt")
VALUES ('admin', '$2b$10$4pO7Xa4q3lKTwh.VYG2Kp.bGp4dIccAGVYa6dZfPCxcGW8XzTcZGK', false, CURRENT_TIMESTAMP);

-- Verify
SELECT id, username, "passwordHash" FROM "Admin";
