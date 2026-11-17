SET NOCOUNT ON;
PRINT '--- A. 子件里像半成品的编码形态统计(全表) ---';
SELECT CASE WHEN UPPER(子件编码) LIKE N'%**TB' THEN N'**TB(双星)' 
            WHEN UPPER(子件编码) LIKE N'%-TB%' THEN N'-tb(连字符)'
            WHEN UPPER(子件编码) LIKE N'%*TB' THEN N'*TB(单星)'
            ELSE N'其它' END AS 形态,
       COUNT(*) AS 行数, COUNT(DISTINCT 子件编码) AS 编码数
FROM bs_asm_bom
WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(子件编码,N'') <> N''
GROUP BY CASE WHEN UPPER(子件编码) LIKE N'%**TB' THEN N'**TB(双星)' 
              WHEN UPPER(子件编码) LIKE N'%-TB%' THEN N'-tb(连字符)'
              WHEN UPPER(子件编码) LIKE N'%*TB' THEN N'*TB(单星)'
              ELSE N'其它' END
ORDER BY 行数 DESC;
PRINT '--- B. 一个产品 BOM 里有几个 **TB 行(分布) ---';
SELECT semiCnt AS 每产品半成品行数, COUNT(*) AS 产品数 FROM (
  SELECT 产品编码, COUNT(*) AS semiCnt FROM bs_asm_bom
  WHERE ISNULL(asp_cancel,'N') <> 'Y' AND UPPER(ISNULL(子件编码,N'')) LIKE N'%**TB'
  GROUP BY 产品编码
) t GROUP BY semiCnt ORDER BY semiCnt;
PRINT '--- C. 含 2 个半成品行的产品(样例 5) ---';
SELECT TOP 5 产品编码, COUNT(*) AS 半成品行数 FROM bs_asm_bom
WHERE ISNULL(asp_cancel,'N') <> 'Y' AND UPPER(ISNULL(子件编码,N'')) LIKE N'%**TB'
GROUP BY 产品编码 HAVING COUNT(*) > 1;
