SET NOCOUNT ON;
SELECT bl.单据编号, bl.存货编码, CASE WHEN bl.批号 IS NULL THEN '<NULL>' ELSE '['+bl.批号+']' END lot, LEN(bl.批号) len, bl.数量
FROM bl_transfer bl WHERE bl.单据编号 IN (N'YCD-20260908-00001',N'YCD-20260921-00001') ORDER BY bl.单据编号;
