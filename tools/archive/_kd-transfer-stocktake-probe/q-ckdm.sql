SET NOCOUNT ON;
SELECT wzdm, '['+ckdm+']' AS ckdm_raw, LEN(ckdm) AS len, DATALENGTH(ckdm)/2 AS chars, yl FROM kucun WHERE wzdm=N'YJ-AJ-016-1';
PRINT '=== 用带空格/不带空格分别查 ===';
SELECT COUNT(*) AS 精确匹配 FROM kucun WHERE wzdm=N'YJ-AJ-016-1' AND ckdm=N'CK00006';
SELECT COUNT(*) AS RTRIM匹配 FROM kucun WHERE wzdm=N'YJ-AJ-016-1' AND RTRIM(ckdm)=N'CK00006';
