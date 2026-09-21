SET NOCOUNT ON;
PRINT N'=== 单据状态表:各面板单数/状态分布 ===';
SELECT panel_code,
       COUNT(*) AS 单数,
       SUM(CASE WHEN ISNULL(saved,0)=1 THEN 1 ELSE 0 END) AS 已保存,
       SUM(CASE WHEN ISNULL(shr,'')<>'' THEN 1 ELSE 0 END) AS 已审核,
       SUM(CASE WHEN ISNULL(erp_no,'')<>'' THEN 1 ELSE 0 END) AS 已转ERP
FROM yj_doc_status
GROUP BY panel_code ORDER BY panel_code;
GO
PRINT N'=== C11:其他入库/其他出库面板与字段 ===';
SELECT f.panel_code, f.col_name, f.label, f.place, f.editable, f.visible, f.ref_panel
FROM yj_field f
WHERE f.panel_code IN (SELECT panel_code FROM yj_panel WHERE panel_name LIKE N'%其他入库%' OR panel_name LIKE N'%其他出库%')
ORDER BY f.panel_code, f.place, f.seq;
GO
PRINT N'=== C12:库存相关面板字段类型(参照 or 文本) ===';
SELECT f.panel_code, p.panel_name, f.col_name, f.label, f.data_type, f.ref_panel, f.ref_field, f.display_field, f.visible
FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE p.panel_name LIKE N'%库存%' OR p.panel_name LIKE N'%收发存%' OR p.panel_name LIKE N'%台账%'
ORDER BY f.panel_code, f.seq;
GO
PRINT N'=== C12:库存相关视图/表行数 ===';
SELECT t.name AS 表名, SUM(p.rows) AS 行数
FROM sys.tables t JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
WHERE t.name LIKE N'%stock%' OR t.name LIKE N'%inv%' OR t.name LIKE N'%warehouse%'
GROUP BY t.name ORDER BY t.name;
GO
SELECT v.name AS 视图名 FROM sys.views v WHERE v.name LIKE N'%stock%' OR v.name LIKE N'%inv%';
GO
