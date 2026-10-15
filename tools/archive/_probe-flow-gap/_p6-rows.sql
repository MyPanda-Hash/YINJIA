SET NOCOUNT ON;
PRINT '=== B. plang 生产工单行 ===';
SELECT id, pl_no, pl_xc, scx, dm, mc, pl_sl, xq_sl, rk_sl, lot_no, ja, od_no, cp_date, st_date, asp_user1, asp_time1 FROM plang;
GO
PRINT '=== C. scjl 报工行 ===';
SELECT id, sc_no, gldh, gd_id, gxdm, sl, wgzt, wgsj, asp_user1, asp_time1, lot_no, scxmc, post_no, delmark FROM scjl ORDER BY id;
GO
PRINT '=== D. 首件检验单头 ===';
SELECT id, [单据编号], [单据日期], [工单号], [工单行号], [报工单号], [工序], [批次号], [产品名称], [检验类别], [送检数量], [检验数量], [检验员], [检验日期], [总结论], [处理方式], [单据状态], asp_user1, CONVERT(varchar(19),asp_time1,120) AS 创建时间, ISNULL(asp_cancel,'N') AS 作废 FROM qc_first_insp_head ORDER BY id;
GO
PRINT '=== E. 制程检验单头 ===';
SELECT id, [单据编号], [单据日期], [工单号], [工单行号], [报工单号], [工序], [批次号], [产品名称], [检验类别], [送检数量], [检验数量], [检验员], [总结论], [单据状态], asp_user1, CONVERT(varchar(19),asp_time1,120) AS 创建时间, ISNULL(asp_cancel,'N') AS 作废 FROM qc_proc_insp_head ORDER BY id;
GO
PRINT '=== F. 成型检验单头 ===';
SELECT id, [单据编号], [工单号], [工单行号], [报工单号], [工序], [批次号], [送检数量], [检验数量], [总结论], [单据状态], asp_user1, CONVERT(varchar(19),asp_time1,120) AS 创建时间, ISNULL(asp_cancel,'N') AS 作废 FROM qc_mold_insp_head ORDER BY id;
GO
PRINT '=== G. 切炭检验单头 ===';
SELECT id, [单据编号], [工单号], [工单行号], [报工单号], [工序], [批次号], [送检数量], [检验数量], [总结论], [单据状态], asp_user1, CONVERT(varchar(19),asp_time1,120) AS 创建时间, ISNULL(asp_cancel,'N') AS 作废 FROM qc_cut_insp_head ORDER BY id;
GO
PRINT '=== H. 组装成品检验单头 ===';
SELECT id, [单据编号], [工单号], [工单行号], [报工单号], [工序], [批次号], [送检数量], [检验数量], [总结论], [单据状态], asp_user1, CONVERT(varchar(19),asp_time1,120) AS 创建时间, ISNULL(asp_cancel,'N') AS 作废 FROM qc_asm_insp_head ORDER BY id;
GO
PRINT '=== I. 单据状态分布 ===';
SELECT panel_code, status, COUNT(*) AS n FROM yj_doc_status
WHERE panel_code IN ('QC_FIRST_INSP','QC_PROC_INSP','QC_MOLD_INSP','QC_CUT_INSP','QC_ASM_INSP','QC_FIN_SPEC','WO_REPORT','MANU_ORDER')
GROUP BY panel_code, status ORDER BY panel_code, status;
GO
