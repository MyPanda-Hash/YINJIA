-- _q-insp-detail-empty.sql — 「检验单明细不预填」现状:近 12 张工序检验单的头字段 + 明细行数
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
SELECT TOP 15 面板, 单据编号, 报工单号, 工单号, 工单行号, 批次号, 生成时间, 明细行 FROM @t ORDER BY 生成时间 DESC;
