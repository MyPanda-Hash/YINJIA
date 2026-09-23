SET NOCOUNT ON;
GO
SELECT N'S1-32: yj_user 账号/角色/管理员' AS sec, username, role_id, is_admin FROM yj_user ORDER BY username;
GO
SELECT N'S1-37: 含 approval 的表名' AS sec, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%approval%' OR TABLE_NAME LIKE '%audit%' ORDER BY TABLE_NAME;
GO
SELECT N'S1-34: yj_doc_status 总行数 + 按 panel_code' AS sec, panel_code, COUNT(*) AS n FROM yj_doc_status GROUP BY panel_code ORDER BY panel_code;
GO
SELECT N'S1-35: yj_doc_status 状态标志组合分布(全库)' AS sec,
       ISNULL(canceled,'-') AS canceled, ISNULL(stopped,'-') AS stopped, ISNULL(archived,'-') AS archived,
       ISNULL(pending,'-') AS pending, ISNULL(saved,'-') AS saved, ISNULL(modify_state,'-') AS modst,
       CASE WHEN shr IS NULL THEN 0 ELSE 1 END AS has_shr, COUNT(*) AS n
FROM yj_doc_status GROUP BY canceled, stopped, archived, pending, saved, modify_state, CASE WHEN shr IS NULL THEN 0 ELSE 1 END
ORDER BY n DESC;
GO
SELECT N'S1-38: yj_doc_approval 结构与行数(若存在)' AS sec, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME='yj_doc_approval' ORDER BY ORDINAL_POSITION;
GO
