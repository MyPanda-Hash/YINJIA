SET NOCOUNT ON;
SELECT 'B6-无bs_inv子件行' AS what, COUNT(*) AS cnt
FROM bs_asm_bom b WHERE NOT EXISTS (SELECT 1 FROM bs_inv i WHERE i.存货编码 = b.子件编码);
GO
SELECT 'B6-单位与bs_inv不符行' AS what, COUNT(*) AS cnt
FROM bs_asm_bom b
WHERE b.计量单位 IS NOT NULL AND b.计量单位 <> ''
  AND NOT EXISTS (SELECT 1 FROM bs_inv i WHERE i.存货编码 = b.子件编码 AND LTRIM(RTRIM(i.计量单位)) = b.计量单位);
GO
SELECT TOP 10 'B6-不符样例' AS what, b.子件编码, b.计量单位,
       (SELECT TOP 1 i.计量单位 FROM bs_inv i WHERE i.存货编码=b.子件编码) AS inv_unit
FROM bs_asm_bom b
WHERE b.计量单位 IS NOT NULL AND b.计量单位 <> ''
  AND NOT EXISTS (SELECT 1 FROM bs_inv i WHERE i.存货编码 = b.子件编码 AND LTRIM(RTRIM(i.计量单位)) = b.计量单位);
GO
