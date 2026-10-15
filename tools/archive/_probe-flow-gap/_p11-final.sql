SET NOCOUNT ON;
PRINT '=== QC_FIRST_INSP 面板配置 ===';
SELECT panel_code, panel_name, mode, head_table, line_table, detail_key, prefix FROM yj_panel WHERE panel_code IN ('QC_FIRST_INSP','QC_PROC_INSP','QC_MOLD_INSP','QC_CUT_INSP','QC_ASM_INSP','WO_REPORT','MANU_ORDER','WORK_ORDER_LIST');
GO
PRINT '=== 仓库档案 bs_wh ===';
SELECT * FROM bs_wh;
GO
PRINT '=== 仓位档案 bs_wh_loc 前 20 ===';
SELECT TOP 20 * FROM bs_wh_loc;
GO
PRINT '=== WO_REPORT 流转链明细 ===';
SELECT source_form_no, source_line_key, target_panel_code, target_form_no, link_status, create_by, CONVERT(varchar(19),create_time,120) AS 建立时间 FROM form_flow_link WHERE source_panel_code='WO_REPORT' ORDER BY create_time;
GO
PRINT '=== 首件检验单:明细表行数 vs 单头 ===';
SELECT (SELECT COUNT(*) FROM qc_first_insp_head) AS 首件单头, (SELECT COUNT(*) FROM qc_first_insp_detail) AS 首件明细,
       (SELECT COUNT(*) FROM qc_first_insp_head WHERE 工单号 IS NOT NULL AND 工单号<>'') AS 带工单号,
       (SELECT COUNT(*) FROM qc_proc_insp_detail) AS 制程明细,
       (SELECT COUNT(*) FROM qc_mold_insp_detail) AS 成型明细,
       (SELECT COUNT(*) FROM qc_cut_insp_detail) AS 切炭明细,
       (SELECT COUNT(*) FROM qc_asm_insp_detail) AS 组装明细;
GO
PRINT '=== 制程检验单明细(全部 27) ===';
SELECT 单据编号, 表区, 行号, 检验项目, 检验要求, 实测数值, 单项判定, 结果判断, 不良数量, 格数, ISNULL(asp_cancel,'N') AS 作废 FROM qc_proc_insp_detail ORDER BY id;
GO
PRINT '=== 首件检验单详情(含空判断) ===';
SELECT TOP 5 * FROM qc_first_insp_head ORDER BY id DESC;
GO
