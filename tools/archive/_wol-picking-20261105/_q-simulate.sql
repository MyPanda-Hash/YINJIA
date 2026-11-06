SET NOCOUNT ON;
/* 只读模拟:按迁移脚本的整词修剪逻辑算出新 perms,先看清楚再执行(不写库) */
WITH t AS (
  SELECT id, perms,
         N',' + ISNULL(perms,'') + N',' AS w
    FROM yj_role_panel
   WHERE panel_code = N'WORK_ORDER_LIST' AND ',' + ISNULL(perms,'') + ',' LIKE '%,picking,%'
), s1 AS (
  SELECT id, perms, w,
         CASE WHEN w = N',picking,' THEN N',view,' ELSE REPLACE(w, N',picking,', N',') END AS w1
    FROM t
), s2 AS (
  SELECT id, perms,
         CASE WHEN LEFT(w1,1) = N',' THEN SUBSTRING(w1, 2, LEN(w1) - 1) ELSE w1 END AS w2
    FROM s1
), s3 AS (
  SELECT id, perms,
         CASE WHEN RIGHT(w2,1) = N',' THEN LEFT(w2, LEN(w2) - 1) ELSE w2 END AS new_perms
    FROM s2
)
SELECT DB_NAME() AS db, id, perms AS old_perms, new_perms FROM s3 ORDER BY id;
