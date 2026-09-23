SET NOCOUNT ON;
SELECT COUNT(*) AS SL_RECV面板数 FROM yj_panel WHERE panel_code='SL_RECV';
GO
SELECT t.name AS 表名, COUNT(*) AS 列数,
       STUFF((SELECT N' | ' + c2.name FROM sys.columns c2 WHERE c2.object_id=t.object_id ORDER BY c2.column_id FOR XML PATH(''), TYPE).value('.','nvarchar(max)'),1,3,N'') AS 列清单
FROM sys.tables t WHERE t.name IN ('bs_qc_item','bs_qc_plan','bs_inv') GROUP BY t.name;
GO
SELECT COUNT(*) AS 检验项目数 FROM bs_qc_item;
GO
SELECT TOP 20 * FROM bs_qc_item;
GO
SELECT COUNT(*) AS 检验方案数 FROM bs_qc_plan;
GO
SELECT TOP 10 * FROM bs_qc_plan;
GO
SELECT COUNT(*) AS role_panel行数 FROM yj_role_panel;
GO
