SET NOCOUNT ON;
SELECT wzdm, ckdm, '['+ISNULL(lot_no,'<NULL>')+']' AS lot, yl FROM kucun WHERE wzdm LIKE 'TEST-MAT-%';
SELECT COUNT(*) AS literal_lot FROM kucun WHERE lot_no = N'(未填批号)';
