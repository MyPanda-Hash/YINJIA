SET NOCOUNT ON;
SELECT 'rd_mold_proc_head' AS 表, COUNT(*) AS 行数 FROM rd_mold_proc_head
UNION ALL SELECT 'rd_mold_proc_detail', COUNT(*) FROM rd_mold_proc_detail
UNION ALL SELECT 'bs_qc_item', COUNT(*) FROM bs_qc_item
UNION ALL SELECT 'bs_qc_plan', COUNT(*) FROM bs_qc_plan
UNION ALL SELECT 'bs_reject', COUNT(*) FROM bs_reject
UNION ALL SELECT 'bs_route', COUNT(*) FROM bs_route
UNION ALL SELECT 'bs_op', COUNT(*) FROM bs_op
UNION ALL SELECT 'bs_prod_line', COUNT(*) FROM bs_prod_line
UNION ALL SELECT 'day_report', COUNT(*) FROM day_report
UNION ALL SELECT 'feed_confirm', COUNT(*) FROM feed_confirm
UNION ALL SELECT 'mix_record', COUNT(*) FROM mix_record
UNION ALL SELECT 'pack_confirm', COUNT(*) FROM pack_confirm
UNION ALL SELECT 'prod_abn', COUNT(*) FROM bd_prod_abn
UNION ALL SELECT 'equip_check', COUNT(*) FROM equip_check;
GO
PRINT '=== 生产相关面板字段数 ===';
SELECT panel_code, panel_name, COUNT(f.id) AS 字段数 FROM yj_panel p LEFT JOIN yj_field f ON f.panel_code=p.panel_code
WHERE p.module_group=N'生产制造' GROUP BY panel_code, panel_name ORDER BY panel_code;
GO
PRINT '=== yj_usage_log 生产/品质面板使用留痕 ===';
SELECT panel_code, COUNT(*) AS 次数 FROM yj_usage_log WHERE panel_code IN ('WO_REPORT','QC_FIRST_INSP','QC_PROC_INSP','QC_MOLD_INSP','QC_CUT_INSP','QC_ASM_INSP','FINISH_IN','MATERIAL_OUT') GROUP BY panel_code;
GO
