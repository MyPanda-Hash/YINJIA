SET NOCOUNT ON;
PRINT '=== YJ-DK-001 / CK00005 ===';
SELECT ISNULL(lot_no,N'(NULL)') lot, yl FROM kucun WHERE wzdm=N'YJ-DK-001' AND ckdm=N'CK00005';
PRINT '=== YJ-HKB-003 / CK00006 ===';
SELECT ISNULL(lot_no,N'(NULL)') lot, yl FROM kucun WHERE wzdm=N'YJ-HKB-003' AND ckdm=N'CK00006';
PRINT '=== 这两物料在 MES 全部仓库的结存合计 ===';
SELECT wzdm, SUM(yl) 合计, COUNT(*) 行数 FROM kucun WHERE wzdm IN (N'YJ-DK-001',N'YJ-HKB-003') GROUP BY wzdm;
