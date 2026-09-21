SET NOCOUNT ON;
PRINT N'=== C4:送料暂收单头表 sl_recv 全部列 ===';
SELECT c.column_id, c.name AS 列名 FROM sys.columns c WHERE c.object_id = OBJECT_ID('sl_recv') ORDER BY c.column_id;
GO
PRINT N'=== C11:其他入库单字段(含 入库类别 字典) ===';
SELECT f.col_name, f.label, f.data_type, f.dict_sql, f.place, f.editable, f.visible, f.ref_panel
FROM yj_field f WHERE f.panel_code = 'OTHER_IN' ORDER BY f.place, f.seq;
GO
PRINT N'=== C11:其他出库单字段 ===';
SELECT f.col_name, f.label, f.data_type, f.dict_sql, f.place, f.editable, f.visible, f.ref_panel
FROM yj_field f WHERE f.panel_code = 'OTHER_OUT' ORDER BY f.place, f.seq;
GO
PRINT N'=== C7:检验单 行级驱动字段(合格数量等) ===';
SELECT c.column_id, c.name AS 列名 FROM sys.columns c WHERE c.object_id = OBJECT_ID('qc_insp_detail') ORDER BY c.column_id;
GO
