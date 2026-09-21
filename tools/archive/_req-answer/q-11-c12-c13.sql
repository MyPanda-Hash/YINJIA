SET NOCOUNT ON;
PRINT N'=== C12:库存/收发存 面板 仓库/存货 字段类型 ===';
SELECT TOP 45 f.panel_code, p.panel_name, f.col_name, f.label, f.data_type, f.place, f.visible, f.ref_panel
FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE (p.panel_name LIKE N'%库存%' OR p.panel_name LIKE N'%收发存%')
  AND (f.col_name LIKE N'%仓库%' OR f.col_name LIKE N'%存货%' OR f.col_name LIKE N'%物料%' OR f.col_name LIKE N'%商品%')
ORDER BY f.panel_code, f.seq;
GO
PRINT N'=== C12:库存相关表行数 ===';
SELECT t.name AS 表名, SUM(p.rows) AS 行数
FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
WHERE t.name LIKE N'%stock%' OR t.name LIKE N'%inv%'
GROUP BY t.name ORDER BY t.name;
GO
SELECT v.name AS 视图名 FROM sys.views v WHERE v.name LIKE N'%stock%' OR v.name LIKE N'%inv%';
GO
PRINT N'=== C13:采购入库单 ERP/来源 字段 ===';
SELECT c.column_id, c.name AS 列名 FROM sys.columns c WHERE c.object_id = OBJECT_ID('bd_purchase_in')
  AND (c.name LIKE N'%外部%' OR c.name LIKE N'%ERP%' OR c.name LIKE N'%来源%' OR c.name LIKE N'%推送%')
ORDER BY c.column_id;
GO
PRINT N'=== C13:采购入库单 外部单据号 填充率 ===';
SELECT COUNT(*) AS 入库单数 FROM bd_purchase_in;
GO
