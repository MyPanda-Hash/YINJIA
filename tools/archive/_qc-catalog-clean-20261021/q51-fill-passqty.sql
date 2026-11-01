SET NOCOUNT ON;
UPDATE dt
SET dt.合格数量 = dt.送检数量, dt.asp_user2 = N'qc-approve-20261021', dt.asp_time2 = GETDATE()
FROM qc_insp_detail dt
JOIN qc_insp h ON h.单据编号 = dt.单据编号
WHERE h.单据编号 IN (N'IJ-2026-10-0001', N'IJ-2026-10-0200')
  AND ISNULL(h.asp_cancel,N'N') <> 'Y'
  AND ISNULL(dt.asp_cancel,N'N') <> 'Y'
  AND (dt.合格数量 IS NULL OR dt.合格数量 = 0)
  AND dt.送检数量 IS NOT NULL;
SELECT @@ROWCOUNT fixed_qty;
SELECT dt.单据编号, dt.物料编码, dt.送检数量, dt.合格数量 FROM qc_insp_detail dt
WHERE dt.单据编号 IN (N'IJ-2026-10-0001',N'IJ-2026-10-0200') AND ISNULL(dt.asp_cancel,N'N')<>'Y' ORDER BY dt.单据编号,dt.id;
