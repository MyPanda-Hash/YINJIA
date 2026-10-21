SELECT name AS 表名,
       CASE WHEN name LIKE '\_bak\_pc0000\_%' ESCAPE '\' THEN 'A族pc0000'
            WHEN name LIKE '\_bak\_qcdraft\_%' ESCAPE '\' THEN 'B族qcdraft'
            ELSE '名单外' END AS 归属
  FROM sys.tables
 WHERE name LIKE '%bak%'
    OR name LIKE 'rename\_%' ESCAPE '\'
    OR name LIKE 'tmp\_%'    ESCAPE '\'
 ORDER BY 归属, 表名;
GO
