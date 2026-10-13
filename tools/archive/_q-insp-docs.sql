-- _q-insp-docs.sql — 三张工序检验单可打开的单号(2026-10-15 一次性取证)
SET NOCOUNT ON;
DECLARE @t TABLE (面板 nvarchar(20), 单据编号 nvarchar(64), 工单号 nvarchar(64), 工单行号 int, 单据状态 nvarchar(20), 明细行 int);
INSERT INTO @t
SELECT N'QC_MOLD_INSP', h.[单据编号], h.[工单号], TRY_CAST(h.[工单行号] AS int), h.[单据状态],
       (SELECT COUNT(*) FROM dbo.qc_mold_insp_detail d WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y')
FROM dbo.qc_mold_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'QC_CUT_INSP', h.[单据编号], h.[工单号], TRY_CAST(h.[工单行号] AS int), h.[单据状态],
       (SELECT COUNT(*) FROM dbo.qc_cut_insp_detail d WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y')
FROM dbo.qc_cut_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'QC_ASM_INSP', h.[单据编号], h.[工单号], TRY_CAST(h.[工单行号] AS int), h.[单据状态],
       (SELECT COUNT(*) FROM dbo.qc_asm_insp_detail d WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y')
FROM dbo.qc_asm_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y';
SELECT 面板, 单据编号, 工单号, 工单行号, 单据状态, 明细行 FROM @t ORDER BY 面板, 单据编号 DESC;
