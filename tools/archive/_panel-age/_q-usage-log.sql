SET NOCOUNT ON;
SELECT 'yj_usage_log 列' AS k, c.name AS col FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.yj_usage_log') ORDER BY c.column_id;
GO
SELECT TOP 6 * FROM dbo.yj_usage_log ORDER BY 1 DESC;
GO
SELECT TOP 12 ISNULL(panel_name,N'(空)') AS panel_name, COUNT(*) AS n FROM dbo.yj_usage_log GROUP BY panel_name ORDER BY n DESC;
GO
SELECT ISNULL(panel_name,N'(空)') AS panel_name, COUNT(*) AS n FROM dbo.yj_usage_log
WHERE panel_name IN (N'工序质检单',N'检验记录单',N'不良品处理单',N'炭棒不良退货登记',N'批号追溯',
                     N'采购入库单',N'来料检验单',N'销售出库单',N'送料暂收单',N'生产工单')
GROUP BY panel_name ORDER BY n DESC;
