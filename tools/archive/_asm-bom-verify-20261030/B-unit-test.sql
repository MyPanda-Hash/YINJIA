SET NOCOUNT ON;
SELECT 'test-bs_inv命中' AS what, v.子件编码,
  (SELECT COUNT(*) FROM bs_inv i WHERE i.存货编码 = v.子件编码) AS inv_rows,
  (SELECT COUNT(*) FROM bs_inv i WHERE i.存货编码 = v.子件编码 AND ISNULL(i.计量单位,'') <> '') AS inv_rows_with_unit
FROM (SELECT DISTINCT 子件编码 FROM bs_asm_bom WHERE 计量单位 IS NULL OR LTRIM(RTRIM(计量单位))='') v
ORDER BY v.子件编码;
GO
SELECT 'test-bs_inv总行' AS what, COUNT(*) AS cnt FROM bs_inv;
GO
