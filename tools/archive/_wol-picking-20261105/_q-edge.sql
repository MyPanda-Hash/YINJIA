SET NOCOUNT ON;
/* 边界自测(只读):验证整词修剪在 首/中/尾/唯一/多词 各位置的输出 */
WITH v(perms) AS (SELECT * FROM (VALUES
  (N'picking'), (N'picking,view'), (N'view,picking'), (N'view,picking,query'),
  (N'view,query'), (N'view,picking,picking,query') ) AS x(p)),
s1 AS (SELECT perms, N',' + ISNULL(perms,'') + N',' AS w FROM v),
s2 AS (SELECT perms, CASE WHEN N',' + ISNULL(perms,'') + N',' = N',picking,' THEN N',view,' ELSE REPLACE(N',' + ISNULL(perms,'') + N',', N',picking,', N',') END AS w1 FROM s1),
s3 AS (SELECT perms, CASE WHEN LEFT(w1,1)=N',' THEN SUBSTRING(w1,2,LEN(w1)-1) ELSE w1 END AS w2 FROM s2)
SELECT perms AS 原值,
       CASE WHEN RIGHT(w2,1)=N',' THEN LEFT(w2,LEN(w2)-1) ELSE w2 END AS 迁移后
  FROM s3;
