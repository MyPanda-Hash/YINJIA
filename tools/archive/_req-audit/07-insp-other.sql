SET NOCOUNT ON;
PRINT '=== 1. 品质管理模块面板 ===';
SELECT panel_code, panel_name, mode, head_table, line_table FROM yj_panel WHERE module_group=N'品质管理';
GO
PRINT '=== 2. QC_TC 特采申请单 字段 ===';
SELECT col_name, label, data_type, dict_sql, visible FROM yj_field WHERE panel_code='QC_TC' ORDER BY seq;
GO
PRINT '=== 3. 检验项目/检验方案 基础数据行数 ===';
SELECT (SELECT COUNT(*) FROM bs_qc_item) AS qc_item_rows;
GO
SELECT TOP 40 * FROM bs_qc_item;
GO
SELECT TOP 30 * FROM bs_qc_plan;
GO
PRINT '=== 4. 其他入库/其他出库 字段 ===';
SELECT panel_code, col_name, label, data_type, dict_sql, visible FROM yj_field WHERE panel_code IN ('OTHER_IN','OTHER_OUT') AND (place LIKE '%header%' OR place IS NULL) ORDER BY panel_code, seq;
GO
PRINT '=== 5. 采购订单 关键字段(二维码/供应商/状态) ===';
SELECT col_name, label, data_type, dict_sql, editable, visible FROM yj_field WHERE panel_code='PU_ORDER' AND (label LIKE N'%供应商%' OR label LIKE N'%状态%' OR label LIKE N'%码%' OR label LIKE N'%批次%' OR label LIKE N'%单号%') ORDER BY seq;
GO
PRINT '=== 6. 搜索含 特采/让步 的字段与字典 ===';
SELECT panel_code, col_name, label, dict_sql FROM yj_field WHERE label LIKE N'%特采%' OR label LIKE N'%让步%' OR dict_sql LIKE N'%特采%' OR dict_sql LIKE N'%让步%';
GO
PRINT '=== 7. QC_INSP 单价列可见性与权限 ===';
SELECT panel_code, col_name, label, visible, editable, seq FROM yj_field WHERE panel_code='QC_INSP' AND label IN (N'单价', N'送检数量', N'合格数量', N'总结论', N'处置方式');
GO
PRINT '=== 8. 三单数据量 ===';
SELECT N'QC_RECV' AS t, COUNT(*) AS n FROM bd_qc_recv UNION ALL SELECT N'QC_INSP', COUNT(*) FROM bd_qc_insp UNION ALL SELECT N'QC_RETURN', COUNT(*) FROM bd_qc_return UNION ALL SELECT N'PURCHASE_IN', COUNT(*) FROM bd_purchase_in UNION ALL SELECT N'OTHER_IN', COUNT(*) FROM bd_other_in UNION ALL SELECT N'OTHER_OUT', COUNT(*) FROM bd_other_out UNION ALL SELECT N'PU_ORDER', COUNT(*) FROM bd_pu_order;
