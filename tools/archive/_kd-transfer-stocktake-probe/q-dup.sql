SET NOCOUNT ON;
PRINT '=== 该键的所有 kucun 行(含重复?) ===';
SELECT id, wzdm, ckdm, ISNULL(lot_no,'<NULL>') lot, yl, asp_cancel FROM kucun WHERE wzdm=N'YJ-AJ-016-1' AND ckdm=N'CK00006';
PRINT '=== 按 NULL 匹配的所有行 ===';
SELECT id, yl FROM kucun WHERE wzdm=N'YJ-AJ-016-1' AND ckdm=N'CK00006' AND ISNULL(RTRIM(lot_no), N'') = '';
