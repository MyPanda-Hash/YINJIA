SET NOCOUNT ON;
SELECT t.name AS tbl,
  MAX(CASE WHEN c.name='asp_user1' THEN 1 ELSE 0 END) AS u1,
  MAX(CASE WHEN c.name='asp_time1' THEN 1 ELSE 0 END) AS t1,
  MAX(CASE WHEN c.name='asp_user2' THEN 1 ELSE 0 END) AS u2,
  MAX(CASE WHEN c.name='asp_time2' THEN 1 ELSE 0 END) AS t2,
  MAX(CASE WHEN c.name='asp_cancel' THEN 1 ELSE 0 END) AS cc
FROM sys.tables t LEFT JOIN sys.columns c ON c.object_id=t.object_id AND c.name LIKE 'asp_%'
GROUP BY t.name
HAVING MAX(CASE WHEN c.name='asp_user2' THEN 1 ELSE 0 END)=0 OR MAX(CASE WHEN c.name='asp_time2' THEN 1 ELSE 0 END)=0 OR MAX(CASE WHEN c.name='asp_cancel' THEN 1 ELSE 0 END)=0
ORDER BY t.name;