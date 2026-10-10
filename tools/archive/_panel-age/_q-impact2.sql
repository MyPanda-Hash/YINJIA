SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#objs') IS NOT NULL DROP TABLE #objs;
CREATE TABLE #objs (name sysname PRIMARY KEY);
INSERT INTO #objs(name) VALUES
 ('bd_pu_req'),('bl_pu_req'),('bd_other_in'),('bl_other_in'),('bd_other_out'),('bl_other_out'),
 ('bd_outsource_in'),('bl_outsource_in'),('bd_outsource_issue'),('bl_outsource_issue'),
 ('v_other_in_detail'),('v_other_in_stats'),('v_other_out_detail'),('v_other_out_stats'),
 ('v_outsource_in_detail'),('v_outsource_in_stats'),('v_outsource_issue_detail'),('v_outsource_issue_stats'),
 ('v_stock_balance'),('v_stock_summary'),('v_stock_ledger'),('v_stock_movement');
GO
SELECT o.name AS obj, ISNULL(STRING_AGG(CAST(OBJECT_NAME(d.referencing_id) AS nvarchar(400)), N', '), N'(none)') AS referenced_by
FROM #objs o
LEFT JOIN sys.sql_expression_dependencies d ON d.referenced_id = OBJECT_ID(o.name)
GROUP BY o.name ORDER BY o.name;
GO
SELECT c.name AS form_flow_link_col FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.form_flow_link') ORDER BY c.column_id;
