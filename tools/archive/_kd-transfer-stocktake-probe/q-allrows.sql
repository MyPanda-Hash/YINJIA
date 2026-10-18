SET NOCOUNT ON;
PRINT '=== 是否存在 lot_no 为空串(非NULL)的行 ===';
SELECT COUNT(*) AS 空串行 FROM kucun WHERE lot_no = '';
SELECT COUNT(*) AS NULL行 FROM kucun WHERE lot_no IS NULL;
PRINT '=== YJ-AJ-016-1 在 CK00006 到底几行(不加任何条件) ===';
SELECT COUNT(*) AS 行数 FROM kucun WHERE wzdm=N'YJ-AJ-016-1' AND ckdm=N'CK00006';
PRINT '=== 服务可能读到的:/kucun 全表该物料 ===';
SELECT id, ckdm, ISNULL(lot_no,'<NULL>') lot, yl FROM kucun WHERE wzdm=N'YJ-AJ-016-1' ORDER BY id;
