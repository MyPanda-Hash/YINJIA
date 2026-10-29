/* 一次性核查(2026-10-25):供应商账号是否已彻底脱离 yj_user。
   放在 tools/archive/ 下,不进迁移链(DbSync run 时手动指定)。 */
SET NOCOUNT ON;
SELECT N'供应商账号数' AS 项, COUNT(*) AS 值 FROM dbo.yj_supplier_account
UNION ALL
SELECT N'yj_user 中的镜像行(应为 0)', COUNT(*)
  FROM dbo.yj_supplier_account a JOIN dbo.yj_user u ON u.username = a.username
UNION ALL
SELECT N'已有口令(启用中应全部有)', COUNT(*)
  FROM dbo.yj_supplier_account WHERE password_hash IS NOT NULL AND password_hash <> N''
UNION ALL
SELECT N'启用中但无口令(应为 0)', COUNT(*)
  FROM dbo.yj_supplier_account WHERE enabled = '1' AND (password_hash IS NULL OR password_hash = N'');
GO
SELECT a.username AS 账号, a.supplier_code AS 供应商, a.enabled AS 启用,
       CASE WHEN a.password_hash IS NULL OR a.password_hash = N'' THEN N'无' ELSE N'有' END AS 口令,
       ISNULL(a.real_name, N'') AS 姓名, ISNULL(a.phone, N'') AS 电话
  FROM dbo.yj_supplier_account a ORDER BY a.username;
GO
