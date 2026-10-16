SET NOCOUNT ON;
PRINT '=== scjl 全列 ===';
SELECT STUFF((SELECT ' | ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('scjl') ORDER BY c.column_id FOR XML PATH('')),1,3,'') AS 列;
GO
PRINT '=== scjl 报工行(正确列名) ===';
SELECT id, [报工单号], gldh AS 工单号, [工单行号], gxdm AS 工序, sl AS 数量, wgzt AS 完工, wgsj AS 完工时间, [批次号], scxmc AS 产线, post_no AS 入库单号, delmark
FROM scjl ORDER BY id;
GO
PRINT '=== yj_doc_status 列 ===';
SELECT STUFF((SELECT ' | ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('yj_doc_status') ORDER BY c.column_id FOR XML PATH('')),1,3,'') AS 列;
GO
PRINT '=== 报工单状态分布 ===';
SELECT * FROM yj_doc_status WHERE doc_no IN (SELECT DISTINCT [报工单号] FROM scjl WHERE [报工单号] IS NOT NULL);
GO
PRINT '=== 仓库档案(仓别) ===';
SELECT * FROM wh;
GO
PRINT '=== 仓位档案前 20 ===';
SELECT TOP 20 * FROM whloc;
GO
