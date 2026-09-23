SET NOCOUNT ON;
SELECT N'MP', TOP1.单据编号, ISNULL(TOP1.产品编号,N''), ISNULL(TOP1.产品名称,N''), ISNULL(TOP1.变更来源单号,N''),
       CAST((SELECT COUNT(*) FROM rd_mold_proc_detail d WHERE d.单据编号 = TOP1.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') AS nvarchar(10))
  FROM (SELECT TOP 1 * FROM rd_mold_proc_head WHERE 变更来源单号 = N'CHG-2026-09-0012' ORDER BY id DESC) TOP1;
SELECT N'AP', h.单据编号, ISNULL(h.产品编号,N''), ISNULL(h.产品名称,N''), ISNULL(h.变更来源单号,N''), N'0'
  FROM rd_asm_proc_head h WHERE h.变更来源单号 = N'CHG-2026-09-0012';
SELECT N'MPSRC', N'MP-2026-09-0107', CAST((SELECT COUNT(*) FROM rd_mold_proc_detail d WHERE d.单据编号=N'MP-2026-09-0107' AND ISNULL(d.asp_cancel,'N')<>'Y') AS nvarchar(10)), N'', N'', N'';