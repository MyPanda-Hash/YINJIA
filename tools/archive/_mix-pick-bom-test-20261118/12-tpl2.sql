SET NOCOUNT ON;
PRINT '--- A. 同品类里规格接近 34*12* 的 ---';
SELECT b.产品编码, i.规格型号 AS 半成品规格, b.单据编号
FROM bs_asm_bom b LEFT JOIN bs_inv i ON i.存货编码 = b.子件编码
WHERE b.产品名称 = N'A+级烧结炭棒/滤芯' AND UPPER(ISNULL(b.子件编码,N'')) LIKE N'%**TB'
  AND ISNULL(b.asp_cancel,'N') <> 'Y' AND ISNULL(b.状态,N'启用') <> N'停用'
  AND (ISNULL(i.规格型号,N'') LIKE N'34*12%' OR ISNULL(i.规格型号,N'') LIKE N'%12*24%')
ORDER BY b.产品编码;
PRINT '--- B. 模板 B-35-05-3_V0001 行数 ---';
SELECT 行序, 子件编码, 子件名称, 计量单位, 标准用量, 用量分子, 用量分母 FROM bs_asm_bom WHERE 单据编号 = N'B-35-05-3_V0001' ORDER BY 行序;
PRINT '--- C. 每个待补半成品被多少产品的组装清单引用 ---';
SELECT 子件编码, COUNT(DISTINCT 产品编码) AS 被引用产品数 FROM bs_asm_bom
WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据编号 IS NOT NULL
  AND UPPER(子件编码) LIKE N'%**TB'
  AND 子件编码 IN (N'S031**TB',N'S042**TB',N'S062**TB',N'A-48-16**TB')
GROUP BY 子件编码;
