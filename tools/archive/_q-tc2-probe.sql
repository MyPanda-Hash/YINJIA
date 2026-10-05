-- _q-tc2-probe.sql — 特采改按钮前的现状取证(只读)
SET NOCOUNT ON;

GO
PRINT N'=== 1. 三面板定义 ===';
SELECT panel_code, panel_name, mode, head_table, line_table, prefix, module_group
FROM yj_panel WHERE panel_code IN ('QC_INSP','QC_RETURN','QC_TC_IN','PURCHASE_IN','QC_RECV') ORDER BY panel_code;

GO
PRINT N'=== 2. QC_INSP 全部字段 ===';
SELECT place, seq, col_name, label, data_type, hidden, visible, editable
FROM yj_field WHERE panel_code='QC_INSP' ORDER BY place, seq, id;

GO
PRINT N'=== 3. QC_RETURN 全部字段 ===';
SELECT place, seq, col_name, label, data_type, hidden, visible, editable
FROM yj_field WHERE panel_code='QC_RETURN' ORDER BY place, seq, id;

GO
PRINT N'=== 4. QC_TC_IN 全部字段 ===';
SELECT place, seq, col_name, label, data_type, hidden, visible, editable
FROM yj_field WHERE panel_code='QC_TC_IN' ORDER BY place, seq, id;

GO
PRINT N'=== 5. 送检数量 相关列(全库) ===';
SELECT t.name AS tbl, c.name AS col, ty.name AS typ
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('qc_insp','qc_insp_detail','qc_return','qc_return_detail','qc_tc_in','bl_purchase_in')
  AND c.name LIKE N'%送检%' ORDER BY t.name, c.name;

GO
PRINT N'=== 6. 表结构:qc_insp_detail / qc_return / qc_return_detail ===';
SELECT t.name AS tbl, c.name AS col, ty.name AS typ, c.max_length, c.is_nullable
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('qc_insp_detail','qc_return','qc_return_detail','qc_tc_in')
ORDER BY t.name, c.column_id;

GO
PRINT N'=== 7. 数据量 ===';
SELECT N'qc_insp' AS t, COUNT(*) AS n FROM qc_insp
UNION ALL SELECT N'qc_insp_detail', COUNT(*) FROM qc_insp_detail
UNION ALL SELECT N'qc_return', COUNT(*) FROM qc_return
UNION ALL SELECT N'qc_return_detail', COUNT(*) FROM qc_return_detail
UNION ALL SELECT N'qc_tc_in', COUNT(*) FROM qc_tc_in;

GO
PRINT N'=== 8. 链路 form_flow_link 涉及 QC_INSP/QC_RETURN/QC_TC_IN 的行 ===';
SELECT source_panel_code, target_panel_code, link_status, COUNT(*) AS n
FROM form_flow_link WHERE source_panel_code IN ('QC_INSP','QC_RETURN','QC_TC_IN') OR target_panel_code IN ('QC_INSP','QC_RETURN','QC_TC_IN')
GROUP BY source_panel_code, target_panel_code, link_status ORDER BY 1,2,3;

GO
PRINT N'=== 9. 检验明细特采勾选现状 ===';
SELECT ISNULL(特采,0) AS tc, COUNT(*) AS n FROM qc_insp_detail GROUP BY ISNULL(特采,0);

GO
PRINT N'=== 10. 单据状态表列 ===';
SELECT c.name, ty.name AS typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id = OBJECT_ID('yj_doc_status') ORDER BY c.column_id;
GO
PRINT N'=== 10b. 三面板单据状态 ===';
SELECT panel_code, 单据状态, COUNT(*) AS n FROM yj_doc_status WHERE panel_code IN ('QC_INSP','QC_RETURN','QC_TC_IN') GROUP BY panel_code, 单据状态 ORDER BY 1,2;
