SET NOCOUNT ON;
PRINT '=== 全库检验明细:真正填了实测数值的行 ===';
SELECT '制程检验 qc_proc_insp_detail' AS 明细表,
       COUNT(*) AS 总行,
       SUM(CASE WHEN ISNULL(实测数值,N'')<>N'' THEN 1 ELSE 0 END) AS 有实测值,
       SUM(CASE WHEN ISNULL(结果判断,N'')<>N'' OR ISNULL(单项判定,N'')<>N'' THEN 1 ELSE 0 END) AS 有判定
FROM qc_proc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT '成型检验 qc_mold_insp_detail', COUNT(*),
       SUM(CASE WHEN ISNULL(实测数值,N'')<>N'' THEN 1 ELSE 0 END),
       SUM(CASE WHEN ISNULL(判定,N'')<>N'' THEN 1 ELSE 0 END)
FROM qc_mold_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT '切炭检验 qc_cut_insp_detail', COUNT(*),
       SUM(CASE WHEN ISNULL(实测数值,N'')<>N'' THEN 1 ELSE 0 END),
       SUM(CASE WHEN ISNULL(判定,N'')<>N'' THEN 1 ELSE 0 END)
FROM qc_cut_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT '组装成品检验 qc_asm_insp_detail', COUNT(*),
       SUM(CASE WHEN ISNULL(实测数值,N'')<>N'' THEN 1 ELSE 0 END),
       SUM(CASE WHEN ISNULL(结果判断,N'')<>N'' THEN 1 ELSE 0 END)
FROM qc_asm_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT '首件检验 qc_first_insp_detail', COUNT(*), 0, 0 FROM qc_first_insp_detail;
GO
PRINT '=== 组装成品检验明细(有数量的) ===';
SELECT 单据编号, 表区, 检验项目, 检验要求, 实测数值, 结果判断, 合格数量, 不合格数量, 数量, 处理方式 FROM qc_asm_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
PRINT '=== 已完成入库产出的证据:finish_in 相关 ===';
SELECT (SELECT COUNT(*) FROM bd_finish_in) AS 成品入库头, (SELECT COUNT(*) FROM bl_finish_in) AS 成品入库行,
       (SELECT COUNT(*) FROM form_flow_link WHERE target_panel_code='FINISH_IN') AS 生成链数,
       (SELECT COUNT(*) FROM bd_material_out) AS 材料出库头, (SELECT COUNT(*) FROM bl_material_out) AS 材料出库行;
GO
