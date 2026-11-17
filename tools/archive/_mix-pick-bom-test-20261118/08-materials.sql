SET NOCOUNT ON;
PRINT '--- A. 配方里出现的物料在测试库存货档案里有没有、单位是什么 ---';
SELECT v.物料编号,
       ISNULL(i.存货编码, N'(缺)') AS 档案, ISNULL(i.存货名称, N'') AS 名称,
       ISNULL(i.计量单位, N'(空)') AS 单位
FROM (VALUES (N'YJ-XH-001'),(N'YJ-YPS-002'),(N'PS-2'),(N'YJ-ZX-003'),(N'YJ-SLD-009'),(N'HP-12'),
             (N'YJ-XH-002'),(N'YJ-ZX-004'),(N'YJ-YKRS-007'),(N'KG-AJE-A01'),(N'AGC-80250'),
             (N'PMC-80325'),(N'YJ-ZX-001'),(N'HP-08'),(N'YJ-YKRS-001'),(N'Sr-35200'),
             (N'YJ-YPS-001'),(N'BHP-12')) v(物料编号)
LEFT JOIN bs_inv i ON i.存货编码 = v.物料编号 AND ISNULL(i.asp_cancel,'N') <> 'Y'
ORDER BY v.物料编号;
PRINT '--- B. mate 列可空性 ---';
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'mate' AND COLUMN_NAME IN (N'm_no',N'm_date',N'wzdm1',N'wzmc1',N'jldw1',N'xc',N'wzdm2',N'wzmc2',N'gg2',N'jldw2',N'bzl',N'sl2',N'in_dj',N'jine',N'bz',N'asp_cancel')
ORDER BY ORDINAL_POSITION;
PRINT '--- C. seed 脚本有没有登记进 db-migrations ---';
