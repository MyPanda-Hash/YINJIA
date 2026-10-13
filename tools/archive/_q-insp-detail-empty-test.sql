-- _q-insp-detail-empty-test.sql — 刚生成的工序检验单:明细是否为空 + 新列是否在册(测试账套)
SET NOCOUNT ON;
DECLARE @t TABLE (面板 nvarchar(20), 单据编号 nvarchar(64), 报工单号 nvarchar(64), 工单号 nvarchar(64), 工单行号 nvarchar(32), 批次号 nvarchar(64), 生成时间 datetime, 明细行 int);
INSERT INTO @t
SELECT N'QC_MOLD_INSP', h.[单据编号], h.[报工单号], h.[工单号], TRY_CAST(h.[工单行号] AS nvarchar(32)), h.[批次号], h.asp_time1,
       (SELECT COUNT(*) FROM dbo.qc_mold_insp_detail d WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y')
FROM dbo.qc_mold_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'QC_CUT_INSP', h.[单据编号], h.[报工单号], h.[工单号], TRY_CAST(h.[工单行号] AS nvarchar(32)), h.[批次号], h.asp_time1,
       (SELECT COUNT(*) FROM dbo.qc_cut_insp_detail d WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y')
FROM dbo.qc_cut_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'QC_ASM_INSP', h.[单据编号], h.[报工单号], h.[工单号], TRY_CAST(h.[工单行号] AS nvarchar(32)), h.[批次号], h.asp_time1,
       (SELECT COUNT(*) FROM dbo.qc_asm_insp_detail d WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y')
FROM dbo.qc_asm_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y';
SELECT TOP 10 面板, 单据编号, 报工单号, 工单号, 工单行号, 批次号, 生成时间, 明细行 FROM @t ORDER BY 生成时间 DESC;

-- 明细里到底有什么(证明"不预填"指的是不写明细,而不是写了空行)
SELECT N'QC_MOLD_INSP' AS 面板, d.[单据编号], d.[检验项目], d.[表区], d.[合格数量], d.[不合格数量], d.[判定], d.[数量]
FROM dbo.qc_mold_insp_detail d WHERE ISNULL(d.asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'QC_CUT_INSP', d.[单据编号], d.[检验项目], d.[表区], d.[合格数量], d.[不合格数量], d.[判定], d.[数量]
FROM dbo.qc_cut_insp_detail d WHERE ISNULL(d.asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'QC_ASM_INSP', d.[单据编号], d.[检验项目], d.[表区], d.[合格数量], d.[不合格数量], d.[判定], d.[数量]
FROM dbo.qc_asm_insp_detail d WHERE ISNULL(d.asp_cancel,'N')<>'Y'
ORDER BY 单据编号 DESC;

-- 新列在册情况
SELECT panel_code, label, data_type, place, seq, visible, hidden, editable
FROM dbo.yj_field
WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP') AND label IN (N'合格数量', N'不合格数量')
ORDER BY panel_code, seq;
SELECT scope, ref_key, locale, text FROM dbo.yj_translation WHERE scope=N'field' AND ref_key IN (N'合格数量', N'不合格数量') ORDER BY ref_key, locale;
