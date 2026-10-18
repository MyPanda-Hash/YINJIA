SELECT name FROM sys.tables WHERE name LIKE '%app%' OR name LIKE '%mobile%' OR name LIKE '%phone%' OR name LIKE '%pda%' ORDER BY name;
SELECT name FROM sys.objects WHERE type IN ('TR','TA') ORDER BY name;
