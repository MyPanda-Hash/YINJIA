SET NOCOUNT ON;
SELECT 序号, 检测元素, LEN(检测元素) AS len, 收费, 检测标准备注 FROM dbo.qc_sample_reg
WHERE ISNULL(asp_cancel, N'N') <> N'Y' AND (检测元素 LIKE N'%外送%' OR 检测元素 LIKE N'不能%');
SELECT '误差非空(在册)' AS k, COUNT(*) AS v FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel, N'N') <> N'Y' AND 检测误差 IS NOT NULL;
SELECT TOP 3 检测元素, 检测误差, asp_cancel FROM dbo.qc_sample_reg WHERE 检测误差 IS NOT NULL;
