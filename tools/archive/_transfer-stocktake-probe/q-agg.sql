SET NOCOUNT ON;
SELECT wzdm, ckdm, SUM(yl) 合计, COUNT(*) 批号数 FROM kucun
WHERE (wzdm=N'YJ-YKRS-007' AND ckdm=N'YCL-01') OR (wzdm=N'YJ-SX-062' AND ckdm=N'CK00006')
   OR (wzdm=N'YJ-HKB-003' AND ckdm=N'CK00006') OR (wzdm=N'YJ-DK-001' AND ckdm=N'CK00005')
GROUP BY wzdm, ckdm;
PRINT '=== 明细 ===';
SELECT wzdm, ckdm, ISNULL(lot_no,N'(NULL)') lot, yl FROM kucun
WHERE (wzdm=N'YJ-YKRS-007' AND ckdm=N'YCL-01') OR (wzdm=N'YJ-SX-062' AND ckdm=N'CK00006')
ORDER BY wzdm, lot;
