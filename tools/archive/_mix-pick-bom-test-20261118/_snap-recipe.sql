SET NOCOUNT ON;
PRINT '--- A. 烧结工艺清单头(产品键) ---';
SELECT 单据编号, 产品编号, 产品名称, 版本号, 工序, 表区 FROM rd_mold_proc_head ORDER BY 单据编号;
PRINT '--- B. 烧结配方行样例(12) ---';
SELECT TOP 12 d.单据编号, d.表区, d.序号, d.物料种类, d.物料编号, d.物料名称, d.实际添加比例, d.单支物料含量, d.设计添加量
FROM rd_mold_proc_detail d ORDER BY d.单据编号, d.序号;
PRINT '--- C. X烧结头(产品键) ---';
SELECT 单据编号, 产品编号, 炭棒编号, 产品名称, 版本号 FROM rd_x_sinter_head ORDER BY 单据编号;
PRINT '--- D. X烧结配方行样例(12) ---';
SELECT TOP 12 d.单据编号, d.表区, d.序号, d.物料种类, d.物料编号, d.物料名称, d.设计添加量, d.添加比例, d.单支含量g
FROM rd_x_sinter_detail d ORDER BY d.单据编号, d.序号;
PRINT '--- E. mate 全量(产品 + 子件) ---';
SELECT m_no, xc, wzdm2, wzmc2, gg2, jldw2, bzl, sl2 FROM mate WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY m_no, xc;
