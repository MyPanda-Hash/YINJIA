SET NOCOUNT ON;
SELECT h.[单据编号], h.[单据日期], s.[状态] AS doc_status, h.asp_cancel
  FROM dbo.qc_asm_insp_head h
  LEFT JOIN dbo.yj_doc_status s ON s.[单据编号] = h.[单据编号] AND s.[表名] LIKE '%qc_asm_insp_head%'
 WHERE h.[单据编号] IN (N'ZJ-2026-11-0009', N'ZJ-2026-11-0007', N'ZJ-2026-11-0011');
