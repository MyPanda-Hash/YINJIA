SET NOCOUNT ON;
PRINT '--- A. T042 相关存货 ---';
SELECT 存货编码, 存货名称, 规格型号, 计量单位 FROM bs_inv WHERE 存货编码 LIKE N'T042%' ORDER BY 存货编码;
PRINT '--- B. 同品类(A+级烧结炭棒/滤芯)产品的半成品规格,挑模板用 ---';
SELECT TOP 30 b.产品编码, b.产品名称, i.规格型号 AS 半成品规格, b.单据编号
FROM bs_asm_bom b
LEFT JOIN bs_inv i ON i.存货编码 = b.子件编码
WHERE b.产品名称 = N'A+级烧结炭棒/滤芯' AND UPPER(ISNULL(b.子件编码,N'')) LIKE N'%**TB'
  AND ISNULL(b.asp_cancel,'N') <> 'Y' AND ISNULL(b.状态,N'启用') <> N'停用'
ORDER BY b.产品编码;
