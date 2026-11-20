SET NOCOUNT ON;
SELECT h.单据编号, ISNULL(h.总结论,N'') v, COUNT(d.id) rows_
FROM qc_asm_insp_head h LEFT JOIN qc_asm_insp_detail d ON d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y'
WHERE h.单据编号 IN (N'ZJ-2026-11-0010',N'ZJ-2026-11-0008',N'ZJ-2026-11-0007',N'ZJ-2026-10-0007',N'ZJ-2026-10-0006')
GROUP BY h.单据编号, h.总结论;
