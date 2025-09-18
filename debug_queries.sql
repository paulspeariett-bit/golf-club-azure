-- Check if organizations table exists in any schema
SELECT 
    schemaname, 
    tablename 
FROM pg_tables 
WHERE tablename = 'organizations';

-- List all available schemas
SELECT schema_name 
FROM information_schema.schemata 
ORDER BY schema_name;

-- List all tables in the public schema
SELECT 
    table_name, 
    table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- If the table exists, show its structure (run this after confirming the table exists)
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'organizations'
-- ORDER BY ordinal_position;