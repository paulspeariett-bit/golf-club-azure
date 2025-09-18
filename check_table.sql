-- Check the organizations table structure
\d organizations;

-- Or alternatively:
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'organizations';