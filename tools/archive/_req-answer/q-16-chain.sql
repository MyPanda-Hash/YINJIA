SET NOCOUNT ON;
PRINT N'=== form_flow_link 结构 ===';
SELECT c.column_id, c.name AS 列名 FROM sys.columns c WHERE c.object_id = OBJECT_ID('form_flow_link') ORDER BY c.column_id;
GO
PRINT N'=== 链路占用统计 ===';
SELECT TOP 30 src_panel, dst_panel, COUNT(*) AS 条数,
       SUM(CASE WHEN ISNULL(状态,'')<>N'已释放' THEN 1 ELSE 0 END) AS 生效
FROM form_flow_link GROUP BY src_panel, dst_panel ORDER BY src_panel, dst_panel;
GO
PRINT N'=== 批次台账行数 ===';
SELECT COUNT(*) AS 批次台账行数 FROM lot_trace;
GO
