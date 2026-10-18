SET NOCOUNT ON;
SELECT id, ISNULL(lot_no,'<NULL>') lot, yl, rkl, ckl FROM kucun WHERE wzdm=N'YJ-SX-029' AND ckdm=N'CK00006' ORDER BY id;
