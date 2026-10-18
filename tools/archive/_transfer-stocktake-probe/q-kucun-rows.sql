SET NOCOUNT ON;
SELECT id, wzdm, '['+ISNULL(lot_no,'<NULL>')+']' AS lot, yl, LEN(lot_no) AS lotlen FROM kucun WHERE wzdm IN (N'YJ-AJ-016-1',N'YJ-AJ-016-2',N'HP-08',N'HP-12',N'YJ-SX-003-1') AND ckdm=N'CK00006' ORDER BY wzdm, id;
