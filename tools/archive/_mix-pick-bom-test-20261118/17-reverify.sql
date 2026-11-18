SET NOCOUNT ON;
SELECT 单据编号, 行序, 子件编码, 子件名称, 计量单位, 标准用量 FROM bs_asm_bom
WHERE 来源 = N'测试库演示_组装清单套用_20261118' ORDER BY 单据编号, 行序;
GO
SELECT 来源, COUNT(DISTINCT 单据编号) AS 单据数, COUNT(*) AS 行数 FROM bs_asm_bom WHERE 来源 LIKE N'测试库演示%' GROUP BY 来源;
GO
SELECT COUNT(*) AS mate行数, COUNT(DISTINCT m_no) AS 产品数 FROM mate WHERE bz LIKE N'测试库演示·混料配方套用%';
