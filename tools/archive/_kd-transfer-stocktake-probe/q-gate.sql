SET NOCOUNT ON;
SELECT id, '['+ISNULL(lot_no,'<NULL>')+']' AS lot, yl, DATALENGTH(lot_no) AS bytes, asp_cancel FROM kucun WHERE wzdm=N'YJ-AJ-016-1' AND ckdm=N'CK00006';
PRINT '=== 用闸门同款条件 ===';
SELECT id, ISNULL(yl,0) AS yl FROM kucun WHERE wzdm=N'YJ-AJ-016-1' AND ckdm=N'CK00006' AND ISNULL(RTRIM(lot_no), N'') = '';
