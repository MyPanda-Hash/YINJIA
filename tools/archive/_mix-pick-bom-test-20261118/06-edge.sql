SET NOCOUNT ON;
PRINT '--- A. 三个开不了单的产品:bs_asm_bom 任意行(不加任何过滤) ---';
SELECT 产品编码, 单据编号, 版本号, 状态, asp_cancel, COUNT(*) OVER (PARTITION BY 单据编号) AS 行数
FROM bs_asm_bom WHERE 产品编码 IN (N'A-32-26', N'D-01-18', N'T042-6')
ORDER BY 产品编码, 单据编号;
PRINT '--- B. 这三个产品在存货档案里 ---';
SELECT 存货编码, 存货名称, 规格型号, 计量单位, ISNULL(asp_cancel,'N') AS 作废
FROM bs_inv WHERE 存货编码 IN (N'A-32-26', N'D-01-18', N'T042-6');
PRINT '--- C. 含 -tb 子件的那 11 个编码 ---';
SELECT DISTINCT 子件编码 FROM bs_asm_bom
WHERE ISNULL(asp_cancel,'N') <> 'Y' AND UPPER(子件编码) LIKE N'%-TB%';
PRINT '--- D. 单个单据里出现 2 个不同半成品的单据(看看 break 会不会丢) ---';
SELECT 单据编号, 产品编码, COUNT(DISTINCT 子件编码) AS 半成品数
FROM bs_asm_bom
WHERE ISNULL(asp_cancel,'N') <> 'Y' AND UPPER(ISNULL(子件编码,N'')) LIKE N'%**TB'
GROUP BY 单据编号, 产品编码 HAVING COUNT(DISTINCT 子件编码) > 1;
