SET NOCOUNT ON;
PRINT '=== AJ-016-1 / AJ-016-2 在 kucun 是否同一行 ===';
SELECT wzdm, ISNULL(lot_no,'<NULL>') lot, yl FROM kucun WHERE ckdm=N'CK00006' AND wzdm IN (N'YJ-AJ-016-1',N'YJ-AJ-016-2');
PRINT '=== 金蝶原始:这两行数量 ===';
PRINT '  YJ-AJ-016-1: 10827   YJ-AJ-016-2: 10827  => 合计 21654';
PRINT '=== CK00006 该两个物料合计 ===';
SELECT SUM(yl) 合计 FROM kucun WHERE ckdm=N'CK00006' AND wzdm IN (N'YJ-AJ-016-1',N'YJ-AJ-016-2');
