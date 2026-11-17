SET NOCOUNT ON;
PRINT '--- A. 新补的两个产品:半成品是否在存货档案 ---';
SELECT 存货编码, 存货名称, 规格型号, 计量单位 FROM bs_inv
WHERE 存货编码 IN (N'D-01-18', N'D-01-18**TB', N'T042-6', N'T042-6**TB', N'B-92-20', N'B-92-20**TB');
PRINT '--- B. B-92-20 的组装清单长什么样 ---';
SELECT 单据编号, 行序, 子件编码, 子件名称, 计量单位, 标准用量 FROM bs_asm_bom
WHERE 产品编码 = N'B-92-20' AND 工序 = N'组装' AND ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(状态,N'启用') <> N'停用'
ORDER BY 单据编号, 行序;
PRINT '--- C. 用来当模板的「A+级烧结炭棒/滤芯」清单(S062-2_V0001) ---';
SELECT 单据编号, 行序, 子件编码, 子件名称, 子件规格, 计量单位, 标准用量, 用量分子, 用量分母, 损耗量
FROM bs_asm_bom WHERE 单据编号 = N'S062-2_V0001' ORDER BY 行序;
PRINT '--- D. 同名产品的 BOM 单号一览 ---';
SELECT 产品编码, 产品名称, 单据编号, 版本号, ISNULL(默认BOM,N'') AS 默认BOM, 行数 FROM (
  SELECT 产品编码, 产品名称, 单据编号, 版本号, 默认BOM, COUNT(*) OVER (PARTITION BY 单据编号) AS 行数,
         ROW_NUMBER() OVER (PARTITION BY 单据编号 ORDER BY id) AS rn
  FROM bs_asm_bom
  WHERE 产品名称 = N'A+级烧结炭棒/滤芯' AND 工序 = N'组装' AND ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(状态,N'启用') <> N'停用'
) t WHERE rn = 1 ORDER BY 产品编码, 单据编号;
