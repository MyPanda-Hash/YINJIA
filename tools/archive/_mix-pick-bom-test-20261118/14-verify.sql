SET NOCOUNT ON;
PRINT '--- A. 写入结果 ---';
SELECT 来源, COUNT(DISTINCT 单据编号) AS 单据数, COUNT(DISTINCT 产品编码) AS 产品数, COUNT(*) AS 行数
FROM bs_asm_bom WHERE 来源 LIKE N'测试库演示%' GROUP BY 来源;
GO
SELECT COUNT(*) AS mate行数, COUNT(DISTINCT m_no) AS mate产品数 FROM mate WHERE bz LIKE N'测试库演示·混料配方套用%';
GO
PRINT '--- B. 抽样:S062**TB 的清单 ---';
SELECT 单据编号, 行序, 子件编码, 子件名称, 计量单位, 标准用量, 用量分子, 用量分母
FROM bs_asm_bom WHERE 产品编码 = N'S062**TB' ORDER BY 行序;
GO
PRINT '--- C. 抽样:mate(A-48-16) ---';
SELECT m_no, xc, wzdm2, wzmc2, jldw2, bzl, bz FROM mate WHERE m_no = N'A-48-16' ORDER BY xc;
GO
PRINT '--- D. 每个半成品清单行数 ---';
SELECT 产品编码, COUNT(*) AS 行数 FROM bs_asm_bom WHERE 来源 = N'测试库演示_混料配方套用_20261118' GROUP BY 产品编码 ORDER BY 产品编码;
