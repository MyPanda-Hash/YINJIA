SET NOCOUNT ON;
-- 清理探针残留(早前 upsert 测试行的收编件)
DELETE FROM bs_currency WHERE 编码 = N'ZZZ' AND 名称 = N'终验币别';
SELECT 编码, 名称 FROM bs_currency ORDER BY id;
