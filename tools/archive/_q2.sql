SET NOCOUNT ON;
SELECT COUNT(*) AS 商品总数,
       SUM(CASE WHEN ISNULL(所属类别,'') <> '' THEN 1 ELSE 0 END) AS 有所属类别,
       SUM(CASE WHEN ISNULL(属性,'') <> '' THEN 1 ELSE 0 END) AS 有属性,
       SUM(CASE WHEN ISNULL(条形码,'') <> '' THEN 1 ELSE 0 END) AS 有条形码,
       SUM(CASE WHEN ISNULL(规格型号,'') <> '' THEN 1 ELSE 0 END) AS 有规格
FROM bs_inv WHERE 外部数据ID IS NOT NULL;
SELECT TOP 5 存货编码, 所属类别, 属性 FROM bs_inv WHERE 外部数据ID IS NOT NULL AND ISNULL(所属类别,'') <> '' ORDER BY id;
-- 客户/供应商的映射字段填充率
SELECT COUNT(*) AS 客户数,
       SUM(CASE WHEN ISNULL(khlb,'')<>'' THEN 1 ELSE 0 END) AS 有分类,
       SUM(CASE WHEN ISNULL(khjb,'')<>'' THEN 1 ELSE 0 END) AS 有价格等级,
       SUM(CASE WHEN ISNULL(ywman,'')<>'' THEN 1 ELSE 0 END) AS 有业务员,
       SUM(CASE WHEN ISNULL(sui_no,'')<>'' THEN 1 ELSE 0 END) AS 有税号,
       SUM(CASE WHEN asp_cancel='Y' THEN 1 ELSE 0 END) AS 停用
FROM dm_kh WHERE 外部数据ID IS NOT NULL;
SELECT COUNT(*) AS 供应商数,
       SUM(CASE WHEN ISNULL(gysfl,'')<>'' THEN 1 ELSE 0 END) AS 有分类,
       SUM(CASE WHEN ISNULL(ywman,'')<>'' THEN 1 ELSE 0 END) AS 有采购员,
       SUM(CASE WHEN ISNULL(bank,'')<>'' THEN 1 ELSE 0 END) AS 有开户行
FROM dm_gf WHERE 外部数据ID IS NOT NULL;
-- 分类/单位/部门 层级映射
SELECT COUNT(*) AS 商品分类数, SUM(CASE WHEN ISNULL(上级编码,'')<>'' THEN 1 ELSE 0 END) AS 有上级
FROM bs_material_group WHERE 外部数据ID IS NOT NULL;
