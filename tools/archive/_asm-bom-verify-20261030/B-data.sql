SET NOCOUNT ON;
-- ===== B1: 总行数 / 单据数 / 产品数 / 来源 / 软删 =====
SELECT 'B1-总行数' AS what, COUNT(*) AS cnt FROM bs_asm_bom;
GO
SELECT 'B1-单据数' AS what, COUNT(DISTINCT 单据编号) AS cnt FROM bs_asm_bom;
GO
SELECT 'B1-产品数' AS what, COUNT(DISTINCT 产品编码) AS cnt FROM bs_asm_bom;
GO
SELECT 'B1-来源' AS what, 来源, COUNT(*) AS cnt FROM bs_asm_bom GROUP BY 来源;
GO
SELECT 'B1-软删' AS what, asp_cancel, COUNT(*) AS cnt FROM bs_asm_bom GROUP BY asp_cancel;
GO
SELECT 'B1-状态' AS what, 状态, COUNT(*) AS cnt FROM bs_asm_bom GROUP BY 状态;
GO
SELECT 'B1-默认BOM' AS what, ISNULL(默认BOM,'<NULL>') AS v, COUNT(*) AS cnt FROM bs_asm_bom GROUP BY 默认BOM;
GO
SELECT 'B1-创建人' AS what, asp_user1, COUNT(*) AS cnt FROM bs_asm_bom GROUP BY asp_user1;
GO
-- ===== B2: 工序全=组装 =====
SELECT 'B2-工序分布' AS what, 工序, COUNT(*) AS cnt FROM bs_asm_bom GROUP BY 工序;
GO
SELECT 'B2-非组装行' AS what, COUNT(*) AS cnt FROM bs_asm_bom WHERE 工序 <> N'组装';
GO
-- ===== B3: 标准用量 = ROUND(分子/分母,4) =====
SELECT 'B3-分母为0' AS what, COUNT(*) AS cnt FROM bs_asm_bom WHERE 用量分母 = 0;
GO
SELECT 'B3-偏差行(>0.00005)' AS what, COUNT(*) AS cnt
FROM bs_asm_bom WHERE ABS(标准用量 - ROUND(用量分子 / 用量分母, 4)) > 0.00005;
GO
SELECT 'B3-偏差行(精确!=' AS what, COUNT(*) AS cnt
FROM bs_asm_bom WHERE 标准用量 <> ROUND(用量分子 / 用量分母, 4);
GO
SELECT TOP 10 'B3-偏差样例' AS what, 单据编号, 子件编码, 标准用量, 用量分子, 用量分母, ROUND(用量分子/用量分母,4) AS calc
FROM bs_asm_bom WHERE ABS(标准用量 - ROUND(用量分子 / 用量分母, 4)) > 0.00005;
GO
SELECT 'B3-ROUND与decimal差异行' AS what, COUNT(*) AS cnt FROM bs_asm_bom
WHERE ABS(CAST(标准用量 AS decimal(38,10)) - CAST(ROUND(用量分子 / 用量分母, 4) AS decimal(38,10))) > 0.000001;
GO
-- ===== B4: 行序每单 1..n 连续 =====
SELECT 'B4-行序异常单据数' AS what, COUNT(*) AS cnt FROM (
  SELECT 单据编号 FROM bs_asm_bom GROUP BY 单据编号
  HAVING MIN(行序) <> 1 OR MAX(行序) <> COUNT(*) OR COUNT(DISTINCT 行序) <> COUNT(*)) x;
GO
SELECT TOP 10 'B4-行序异常单' AS what, 单据编号, MIN(行序) AS mn, MAX(行序) AS mx, COUNT(*) AS c, COUNT(DISTINCT 行序) AS dc
FROM bs_asm_bom GROUP BY 单据编号
HAVING MIN(行序) <> 1 OR MAX(行序) <> COUNT(*) OR COUNT(DISTINCT 行序) <> COUNT(*);
GO
-- ===== B5: 单据编号唯一(每单一个产品) =====
SELECT 'B5-一单多产品单数' AS what, COUNT(*) AS cnt FROM (
  SELECT 单据编号 FROM bs_asm_bom GROUP BY 单据编号 HAVING COUNT(DISTINCT 产品编码) > 1) x;
GO
SELECT 'B5-一产品多单数' AS what, COUNT(*) AS cnt FROM (
  SELECT 产品编码 FROM bs_asm_bom GROUP BY 产品编码 HAVING COUNT(DISTINCT 单据编号) > 1) x;
GO
SELECT TOP 10 'B5-一产品多单样例' AS what, 产品编码, COUNT(DISTINCT 单据编号) AS docs, MIN(默认BOM) AS b1, MAX(默认BOM) AS b2
FROM bs_asm_bom GROUP BY 产品编码 HAVING COUNT(DISTINCT 单据编号) > 1;
GO
SELECT TOP 10 'B5-一单多产品样例' AS what, 单据编号, COUNT(DISTINCT 产品编码) AS prods FROM bs_asm_bom GROUP BY 单据编号 HAVING COUNT(DISTINCT 产品编码) > 1;
GO
-- ===== B6: 计量单位回填 =====
SELECT 'B6-计量单位空' AS what, COUNT(*) AS cnt FROM bs_asm_bom WHERE 计量单位 IS NULL OR LTRIM(RTRIM(计量单位)) = '';
GO
SELECT TOP 20 'B6-空计量单位样例' AS what, 单据编号, 子件编码, 子件名称 FROM bs_asm_bom WHERE 计量单位 IS NULL OR LTRIM(RTRIM(计量单位)) = '' ORDER BY 单据编号, 行序;
GO
SELECT 'B6-计量单位分布Top' AS what, TOP 15 计量单位, COUNT(*) AS cnt FROM bs_asm_bom GROUP BY 计量单位 ORDER BY COUNT(*) DESC;
GO
-- ===== B7: 指定抽查产品的明细 =====
SELECT 'B7-抽查' AS what, 单据编号, 产品编码, 产品名称, 规格型号, 工序, 版本号, 默认BOM, 工艺路线名称, 来源, 状态, 行序, 子件编码, 子件名称, 子件规格, 计量单位, 标准用量, 用量分子, 用量分母, 损耗量, 行备注
FROM bs_asm_bom
WHERE 产品编码 IN (N'A-32-09', N'A-42-04', N'D-01-49', N'S051-2', N'T201')
ORDER BY 产品编码, 行序;
GO
SELECT 'B7-抽查单头差' AS what, 产品编码, COUNT(DISTINCT 单据编号) AS docs, COUNT(*) AS rows, COUNT(DISTINCT 版本号) AS vers
FROM bs_asm_bom WHERE 产品编码 IN (N'A-32-09', N'A-42-04', N'D-01-49', N'S051-2', N'T201') GROUP BY 产品编码;
GO
-- ===== B8: 8 个无 BOM 产品必须不在表中 =====
SELECT 'B8-无BOM产品命中' AS what, 产品编码, COUNT(*) AS cnt FROM bs_asm_bom
WHERE 产品编码 IN (N'A-32-13', N'A-32-17', N'A-32-26', N'B-65-04', N'C-95-32', N'D-01-18', N'S092-2', N'T042-6')
GROUP BY 产品编码;
GO
SELECT 'B8-命中数' AS what, COUNT(*) AS cnt FROM bs_asm_bom
WHERE 产品编码 IN (N'A-32-13', N'A-32-17', N'A-32-26', N'B-65-04', N'C-95-32', N'D-01-18', N'S092-2', N'T042-6');
GO
-- ===== B9: 产品清单(供与 Excel/plang 交集比对) =====
SELECT DISTINCT 产品编码, 单据编号 FROM bs_asm_bom ORDER BY 产品编码;
GO
