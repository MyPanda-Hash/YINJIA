SET NOCOUNT ON;
PRINT N'--- 正式库:每张单实际用到的结果格数(非空的最大序号) ---';
WITH rowmax AS (
  SELECT 单据编号,
         CASE
           WHEN ISNULL(结果20,N'')<>N'' THEN 20 WHEN ISNULL(结果19,N'')<>N'' THEN 19
           WHEN ISNULL(结果18,N'')<>N'' THEN 18 WHEN ISNULL(结果17,N'')<>N'' THEN 17
           WHEN ISNULL(结果16,N'')<>N'' THEN 16 WHEN ISNULL(结果15,N'')<>N'' THEN 15
           WHEN ISNULL(结果14,N'')<>N'' THEN 14 WHEN ISNULL(结果13,N'')<>N'' THEN 13
           WHEN ISNULL(结果12,N'')<>N'' THEN 12 WHEN ISNULL(结果11,N'')<>N'' THEN 11
           WHEN ISNULL(结果10,N'')<>N'' THEN 10 WHEN ISNULL(结果9,N'')<>N'' THEN 9
           WHEN ISNULL(结果8,N'')<>N'' THEN 8 WHEN ISNULL(结果7,N'')<>N'' THEN 7
           WHEN ISNULL(结果6,N'')<>N'' THEN 6 WHEN ISNULL(结果5,N'')<>N'' THEN 5
           WHEN ISNULL(结果4,N'')<>N'' THEN 4 WHEN ISNULL(结果3,N'')<>N'' THEN 3
           WHEN ISNULL(结果2,N'')<>N'' THEN 2 ELSE 1 END AS n
    FROM dbo.qc_insp_rec_detail WHERE ISNULL(asp_cancel,'N')<>'Y'
), docmax AS (SELECT 单据编号, MAX(n) AS n FROM rowmax GROUP BY 单据编号)
SELECT h.结果列数 AS 现存列数, COALESCE(m.n,1) AS 实际用到, COUNT(*) AS 单数
  FROM dbo.qc_insp_rec h LEFT JOIN docmax m ON m.单据编号 = h.单据编号
 GROUP BY h.结果列数, COALESCE(m.n,1) ORDER BY 1,2;
PRINT N'--- 有 结果2..结果20 任一非空的明细行 ---';
SELECT COUNT(*) AS 行数 FROM dbo.qc_insp_rec_detail
 WHERE ISNULL(asp_cancel,'N')<>'Y'
   AND (ISNULL(结果2,N'')<>N'' OR ISNULL(结果3,N'')<>N'' OR ISNULL(结果4,N'')<>N'' OR ISNULL(结果5,N'')<>N'' OR ISNULL(结果6,N'')<>N'');
