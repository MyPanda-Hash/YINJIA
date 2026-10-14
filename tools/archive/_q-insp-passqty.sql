-- _q-insp-passqty.sql — 三张工序检验单:表头数量列 + 明细合格/不合格 现状(2026-10-15)
SET NOCOUNT ON;
SELECT TABLE_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN (N'qc_mold_insp_head', N'qc_cut_insp_head', N'qc_asm_insp_head')
  AND COLUMN_NAME LIKE N'%数量%'
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 表头数量列的实际取值(近 6 张)
SELECT N'QC_MOLD_INSP' AS 面板, [单据编号], [报工数量], [检验数量], [工单号], [工单行号], [批次号]
FROM dbo.qc_mold_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'QC_CUT_INSP', [单据编号], [报工数量], [检验数量], [工单号], [工单行号], [批次号]
FROM dbo.qc_cut_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'QC_ASM_INSP', [单据编号], [报工数量], [检验数量], [工单号], [工单行号], [批次号]
FROM dbo.qc_asm_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
ORDER BY 面板, 单据编号 DESC;

-- 明细里 合格/不合格 现状
SELECT N'QC_MOLD_INSP' AS 面板, [单据编号], [检验项目], [表区], [合格数量], [不合格数量], [数量]
FROM dbo.qc_mold_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'QC_CUT_INSP', [单据编号], [检验项目], [表区], [合格数量], [不合格数量], [数量]
FROM dbo.qc_cut_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'QC_ASM_INSP', [单据编号], [检验项目], [表区], [合格数量], [不合格数量], [数量]
FROM dbo.qc_asm_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'
ORDER BY 面板, 单据编号 DESC;

-- 字段注册情况(含 QC_INSP 对照,确认不会误伤来料检验单)
SELECT panel_code, label, data_type, place, seq, visible, hidden, editable
FROM dbo.yj_field
WHERE label IN (N'合格数量', N'不合格数量', N'报工数量', N'检验数量')
ORDER BY label, panel_code;
