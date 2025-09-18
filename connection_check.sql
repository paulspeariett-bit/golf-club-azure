-- Basic connection check queries
-- Run these one by one to verify your connection

-- 1. Check which database you're connected to
SELECT current_database();

-- 2. Check your current user
SELECT current_user;

-- 3. Very basic test - should always return something
SELECT 1 as test;

-- 4. Check PostgreSQL version
SELECT version();

-- 5. List all databases (you might not have permission for this)
SELECT datname FROM pg_database;