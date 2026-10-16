SET NOCOUNT ON;
PRINT '=== A. 生产工单到底存哪张表 ===';
SELECT 'bl_manu_order' AS t, COUNT(*) AS n FROM bl_manu_order
UNION ALL SELECT 'bd_manu_order', COUNT(*) FROM bd_manu_order
UNION ALL SELECT 'plang', COUNT(*) FROM plang
UNION ALL SELECT 'plang_pc', COUNT(*) FROM plang_pc
UNION ALL SELECT 'bs_prod_line', COUNT(*) FROM bs_prod_line
UNION ALL SELECT 'v_manu_schedule', COUNT(*) FROM v_manu_schedule;
GO
PRINT '=== B. plang 行(生产工单行) ===';
SELECT TOP 20 id, 工单号, 工单行号, 产品编码, 产品名称, 数量, 工艺路线, 当前工序, 完工状态, ja, 批次号, scx
FROM plang;
GO
PRINT '=== C. scjl 报工行 ===';
SELECT TOP 20 id, 报工单号, gldh AS 工单号, [工单行号], gxdm AS 工序, sl AS 数量, wgzt AS 完工, asp_user1 AS 创建人, asp_time1 AS 创建时间, [批次号], post_no
FROM scjl ORDER BY id;
GO
PRINT '=== D. 首件检验单头(前 30) ===';
SELECT TOP 30 id, 单据编号, 工单号, [工单行号], [批次号], 报工单号, 检验类别, 检验数量, 送检数量,
       CONVERT(varchar(19), asp_time1, 120) AS 创建时间, asp_user1 AS 创建人, ISNULL(asp_cancel,'N') AS 作废
FROM qc_first_insp_head ORDER BY id;
GO
PRINT '=== E. 制程检验单头(前 30) ===';
SELECT TOP 30 id, 单据编号, 工单号, [工单行号], [批次号], 报工单号, 检验类别, 检验数量, 送检数量,
       CONVERT(varchar(19), asp_time1, 120) AS 创建时间, asp_user1 AS 创建人, ISNULL(asp_cancel,'N') AS 作废
FROM qc_proc_insp_head ORDER BY id;
GO
PRINT '=== F. 成型/切炭/组装 检验单头(前 40) ===';
SELECT TOP 40 '成型' AS 类别, 单据编号, 工单号, [批次号], 报工单号, 检验数量, CONVERT(varchar(19), asp_time1,120) AS 创建时间, ISNULL(asp_cancel,'N') AS 作废
FROM qc_mold_insp_head
UNION ALL
SELECT TOP 40 '切炭', 单据编号, 工单号, [批次号], 报工单号, 检验数量, CONVERT(varchar(19), asp_time1,120), ISNULL(asp_cancel,'N')
FROM qc_cut_insp_head
UNION ALL
SELECT TOP 40 '组装', 单据编号, 工单号, [批次号], 报工单号, 检验数量, CONVERT(varchar(19), asp_time1,120), ISNULL(asp_cancel,'N')
FROM qc_asm_insp_head;
GO
PRINT '=== G. 各检验面板单据状态分布 ===';
SELECT panel_code, status, COUNT(*) AS n FROM yj_doc_status
WHERE panel_code IN ('QC_FIRST_INSP','QC_PROC_INSP','QC_MOLD_INSP','QC_CUT_INSP','QC_ASM_INSP','QC_FIN_SPEC','WO_REPORT','MANU_ORDER')
GROUP BY panel_code, status ORDER BY panel_code, status;
GO
