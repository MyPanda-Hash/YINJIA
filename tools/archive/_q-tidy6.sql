SET NOCOUNT ON;
SELECT N'DEMO 产品信息表' AS k, CAST(COUNT(*) AS nvarchar(10)) AS n FROM rd_prod_info_head WHERE 产品编号 LIKE N'DEMO-%'
UNION ALL SELECT N'demo 账号', CAST(COUNT(*) AS nvarchar(10)) FROM yj_user WHERE username LIKE N'demo[_]%'
UNION ALL SELECT N'DEMO 成型清单', CAST(COUNT(*) AS nvarchar(10)) FROM rd_mold_proc_head WHERE 产品编号 LIKE N'DEMO-%'
UNION ALL SELECT N'DEMO 变更单', CAST(COUNT(*) AS nvarchar(10)) FROM rd_change_head WHERE 产品编号 LIKE N'DEMO-%'
UNION ALL SELECT N'DEMO 状态行', CAST(COUNT(*) AS nvarchar(10)) FROM yj_doc_status WHERE doc_no LIKE N'DEMO-%';
GO
