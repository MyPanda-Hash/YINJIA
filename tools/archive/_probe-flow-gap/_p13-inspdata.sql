SET NOCOUNT ON;
PRINT '=== 报工自动生成的检验单:数据填了没有 ===';
SELECT '成型' AS 类别, h.单据编号, h.工单号, h.报工单号, h.检验数量, h.检验员, h.总结论, h.处理方式,
       (SELECT COUNT(*) FROM qc_mold_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') AS 明细行,
       (SELECT COUNT(*) FROM qc_mold_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.实测数值,N'')<>N'') AS 有实测值
FROM qc_mold_insp_head h WHERE h.报工单号 IS NOT NULL AND h.报工单号<>''
UNION ALL
SELECT '切炭', h.单据编号, h.工单号, h.报工单号, h.检验数量, h.检验员, h.总结论, h.处理方式,
       (SELECT COUNT(*) FROM qc_cut_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'N' AND ISNULL(d.asp_cancel,'N')<>'Y'),
       (SELECT COUNT(*) FROM qc_cut_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.实测数值,N'')<>N'')
FROM qc_cut_insp_head h WHERE h.报工单号 IS NOT NULL AND h.报工单号<>''
UNION ALL
SELECT '组装', h.单据编号, h.工单号, h.报工单号, h.检验数量, h.检验员, h.总结论, h.处理方式,
       (SELECT COUNT(*) FROM qc_asm_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y'),
       (SELECT COUNT(*) FROM qc_asm_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.实测数值,N'')<>N'')
FROM qc_asm_insp_head h WHERE h.报工单号 IS NOT NULL AND h.报工单号<>''
ORDER BY 类别, 单据编号;
GO
PRINT '=== 首件检验:任何一张带工单号/明细? ===';
SELECT (SELECT COUNT(*) FROM qc_first_insp_head WHERE ISNULL(工单号,N'')<>N'') AS 带工单号单头,
       (SELECT COUNT(*) FROM qc_first_insp_head WHERE ISNULL(检验数量,0)<>0) AS 有检验数量,
       (SELECT COUNT(*) FROM qc_first_insp_detail) AS 明细行总数,
       (SELECT COUNT(*) FROM form_flow_link WHERE target_panel_code='QC_FIRST_INSP') AS 流转链数;
GO
PRINT '=== 成型工艺清单 QC 检验要求(首件预铺数据源) ===';
SELECT TOP 5 t.name AS 表, (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id=t.object_id) AS 列数
FROM sys.tables t WHERE t.name LIKE 'rd_mold_proc%';
GO
PRINT '=== bs_inv 是否检验类字段 ===';
SELECT STUFF((SELECT ' | ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('bs_inv') AND c.name LIKE N'%检%' ORDER BY c.column_id FOR XML PATH('')),1,3,'') AS 检验相关列;
GO
PRINT '=== 检验项目/检验方案 基础档案 ===';
SELECT 'QC_ITEM' AS 表, COUNT(*) AS 行数 FROM qc_item UNION ALL SELECT 'QC_PLAN', COUNT(*) FROM qc_plan UNION ALL SELECT 'reject', COUNT(*) FROM reject;
GO
PRINT '=== 检验单对应面板按钮(报工单) ===';
SELECT panel_code, COUNT(*) AS 字段数 FROM yj_field WHERE panel_code IN ('WO_REPORT','QC_FIRST_INSP','QC_PROC_INSP') GROUP BY panel_code;
GO
