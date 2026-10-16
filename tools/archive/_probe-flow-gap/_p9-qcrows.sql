SET NOCOUNT ON;
PRINT '=== 首件检验单头(全部) ===';
SELECT 单据编号, 单据日期, 工单号, 工单行号, 报工单号, 工序, 批次号, 产品名称, 报工数量, 检验数量, 检验员, 总结论, 处理方式, 单据状态, asp_user1 AS 建单人, CONVERT(varchar(19),asp_time1,120) AS 建单时间, ISNULL(asp_cancel,'N') AS 作废
FROM qc_first_insp_head ORDER BY id;
GO
PRINT '=== 制程检验单头(全部) ===';
SELECT 单据编号, 单据日期, 检验时间, 检验类别, 工单号, 工单行号, 报工单号, 工序, 批次号, 产品名称, 报工数量, 抽检总量, 检验数量, 检验员, 总结论, 处理方式, 单据状态, asp_user1 AS 建单人, CONVERT(varchar(19),asp_time1,120) AS 建单时间, ISNULL(asp_cancel,'N') AS 作废
FROM qc_proc_insp_head ORDER BY id;
GO
PRINT '=== 成型/切炭/组装检验单头 ===';
SELECT '成型' AS 类别, 单据编号, 工单号, 工单行号, 报工单号, 批次号, 报工数量, 检验数量, 检验员, 总结论, 处理方式, 单据状态, asp_user1 AS 建单人, CONVERT(varchar(19),asp_time1,120) AS 建单时间, ISNULL(asp_cancel,'N') AS 作废 FROM qc_mold_insp_head
UNION ALL
SELECT '切炭', 单据编号, 工单号, 工单行号, 报工单号, 批次号, 报工数量, 检验数量, 检验员, 总结论, 处理方式, 单据状态, asp_user1, CONVERT(varchar(19),asp_time1,120), ISNULL(asp_cancel,'N') FROM qc_cut_insp_head
UNION ALL
SELECT '组装', 单据编号, 工单号, 工单行号, 报工单号, 批次号, 报工数量, 检验数量, 检验员, 总结论, 处理方式, 单据状态, asp_user1, CONVERT(varchar(19),asp_time1,120), ISNULL(asp_cancel,'N') FROM qc_asm_insp_head
ORDER BY 类别, 单据编号;
GO
PRINT '=== 检验单明细抽样(成型 10 行) ===';
SELECT TOP 10 单据编号, 表区, 行号, 检验项目, 检验要求, 检验方法, 实测数值, 判定, 合格数量, 不合格数量, 数量, 处理方式, ISNULL(asp_cancel,'N') AS 作废 FROM qc_mold_insp_detail ORDER BY id;
GO
PRINT '=== 检验单明细抽样(组装 10 行) ===';
SELECT TOP 10 单据编号, 表区, 行号, 检验项目, 检验要求, 实测数值, 结果判断, 合格数量, 不合格数量, 数量, 处理方式, ISNULL(asp_cancel,'N') AS 作废 FROM qc_asm_insp_detail ORDER BY id;
GO
PRINT '=== 单据状态分布 ===';
SELECT panel_code, status, COUNT(*) AS n FROM yj_doc_status
WHERE panel_code IN ('QC_FIRST_INSP','QC_PROC_INSP','QC_MOLD_INSP','QC_CUT_INSP','QC_ASM_INSP','QC_FIN_SPEC')
GROUP BY panel_code, status ORDER BY panel_code, status;
GO
PRINT '=== form_flow_link: 报工→检验 ===';
SELECT * FROM form_flow_link WHERE source_panel_code='WO_REPORT';
GO
