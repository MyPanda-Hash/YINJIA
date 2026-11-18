SET NOCOUNT ON;
SELECT 'A_在册行数' AS k, COUNT(*) AS v FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel, N'N') <> N'Y';
SELECT 'B_作废行' AS k, COUNT(*) AS v FROM dbo.qc_sample_reg WHERE asp_cancel = N'Y';
SELECT 'C_误差非空' AS k, COUNT(*) AS v FROM dbo.qc_sample_reg WHERE 检测误差 IS NOT NULL;
SELECT 'D_改名落全' AS k, COUNT(*) AS v FROM yj_field WHERE col_name = N'内部检出限' AND label = N'标准方法检出限';
SELECT 'E_旧标签残留' AS k, COUNT(*) AS v FROM yj_field WHERE label = N'内部检出限';
SELECT 序号, 检测元素, 内部检出限, 收费, 检测标准 FROM dbo.qc_sample_reg
WHERE ISNULL(asp_cancel, N'N') <> N'Y' AND 检测元素 IN (N'色度', N'外送部分', N'吸附碘值', N'高浓度银', N'总硬度', N'硬度')
ORDER BY 序号;
