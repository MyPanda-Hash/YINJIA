SET NOCOUNT ON;
-- 逐表检查视图需要的列是否存在
SELECT t.name AS tbl,
  CASE WHEN EXISTS(SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name=N'存货编码') THEN 1 ELSE 0 END AS 有存货编码,
  CASE WHEN EXISTS(SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name=N'存货名称') THEN 1 ELSE 0 END AS 有存货名称,
  CASE WHEN EXISTS(SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name=N'仓库') THEN 1 ELSE 0 END AS 有仓库,
  CASE WHEN EXISTS(SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name=N'规格型号') THEN 1 ELSE 0 END AS 有规格,
  CASE WHEN EXISTS(SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name=N'计量单位') THEN 1 ELSE 0 END AS 有单位,
  CASE WHEN EXISTS(SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name=N'数量') THEN 1 ELSE 0 END AS 有数量,
  CASE WHEN EXISTS(SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name=N'实收数量') THEN 1 ELSE 0 END AS 有实收数量,
  CASE WHEN EXISTS(SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name=N'金额') THEN 1 ELSE 0 END AS 有金额,
  CASE WHEN EXISTS(SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name=N'销售金额') THEN 1 ELSE 0 END AS 有销售金额
FROM sys.tables t WHERE t.name IN ('bl_purchase_in','bl_finish_in','bl_other_in','bl_outsource_in','bl_sale_out','bl_material_out','bl_other_out','bl_outsource_issue')
ORDER BY t.name;
