SET NOCOUNT ON;
PRINT '=== A. 生产过程主链 行数 ===';
SELECT '生产工单头 bd_manu_order' AS 对象, COUNT(*) AS 行数 FROM bd_manu_order
UNION ALL SELECT '生产工单行 plang', COUNT(*) FROM plang
UNION ALL SELECT '排产行 plang_pc', COUNT(*) FROM plang_pc
UNION ALL SELECT '工序报工 scjl', COUNT(*) FROM scjl
UNION ALL SELECT '报工(已审核 wgzt=Y)', COUNT(*) FROM scjl WHERE ISNULL(wgzt,'N')='Y'
UNION ALL SELECT '工序台账 wo_process_line', COUNT(*) FROM wo_process_line
UNION ALL SELECT '产成品入库头 bd_finish_in', COUNT(*) FROM bd_finish_in
UNION ALL SELECT '产成品入库行 bl_finish_in', COUNT(*) FROM bl_finish_in
UNION ALL SELECT '材料出库头 bd_material_out', COUNT(*) FROM bd_material_out
UNION ALL SELECT '销售出库头 bd_sale_out', COUNT(*) FROM bd_sale_out;
GO
PRINT '=== B. 检验/品质单据 行数(生产过程侧) ===';
SELECT '首件检验单头 qc_first_insp_head' AS 对象, COUNT(*) AS 行数 FROM qc_first_insp_head
UNION ALL SELECT '首件检验单明细 qc_first_insp_detail', COUNT(*) FROM qc_first_insp_detail
UNION ALL SELECT '制程检验单头 qc_proc_insp_head', COUNT(*) FROM qc_proc_insp_head
UNION ALL SELECT '制程检验单明细 qc_proc_insp_detail', COUNT(*) FROM qc_proc_insp_detail
UNION ALL SELECT '成型检验单头 qc_mold_insp_head', COUNT(*) FROM qc_mold_insp_head
UNION ALL SELECT '成型检验单明细 qc_mold_insp_detail', COUNT(*) FROM qc_mold_insp_detail
UNION ALL SELECT '切炭检验单头 qc_cut_insp_head', COUNT(*) FROM qc_cut_insp_head
UNION ALL SELECT '切炭检验单明细 qc_cut_insp_detail', COUNT(*) FROM qc_cut_insp_detail
UNION ALL SELECT '组装成品检验单头 qc_asm_insp_head', COUNT(*) FROM qc_asm_insp_head
UNION ALL SELECT '组装成品检验单明细 qc_asm_insp_detail', COUNT(*) FROM qc_asm_insp_detail
UNION ALL SELECT '成品检验规范头 qc_fin_spec_head', COUNT(*) FROM qc_fin_spec_head
UNION ALL SELECT '单据流转链 form_flow_link', COUNT(*) FROM form_flow_link;
GO
PRINT '=== C. 报工 → 检验单 流转链(按源/目标面板) ===';
SELECT source_panel_code, target_panel_code, COUNT(*) AS n
FROM form_flow_link GROUP BY source_panel_code, target_panel_code ORDER BY n DESC;
GO
PRINT '=== D. scjl 报工按工序统计 ===';
SELECT ISNULL(gxdm,N'(空)') AS 工序, COUNT(*) AS 单数, SUM(ISNULL(sl,0)) AS 数量,
       SUM(CASE WHEN ISNULL(wgzt,'N')='Y' THEN 1 ELSE 0 END) AS 已审核
FROM scjl GROUP BY gxdm ORDER BY 单数 DESC;
GO
