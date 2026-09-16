SET NOCOUNT ON;
SELECT COUNT(*) AS 分类数,
  SUM(CASE WHEN ISNULL(上级编码,'')<>'' THEN 1 ELSE 0 END) AS 有上级编码,
  SUM(CASE WHEN ISNULL(备注,'')<>'' THEN 1 ELSE 0 END) AS 有备注,
  SUM(CASE WHEN ISNULL(创建人,'')<>'' THEN 1 ELSE 0 END) AS 有创建人,
  SUM(CASE WHEN ISNULL(修改人,'')<>'' THEN 1 ELSE 0 END) AS 有修改人
FROM bs_material_group WHERE 外部数据ID IS NOT NULL;
SELECT TOP 4 编码, 名称, 级次, 上级编码, 创建人, 修改时间 FROM bs_material_group WHERE 外部数据ID IS NOT NULL AND ISNULL(上级编码,'')<>'' ORDER BY id;
