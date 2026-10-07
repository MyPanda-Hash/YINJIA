SET NOCOUNT ON;
SELECT N'--- 最近的材料出库单(头) ---' AS s;
SELECT TOP 8 单据编号, 单据日期, 业务类型, 生产车间, 领用人, 部门编码, 经手人编码, 领料类型,
       是否已转ERP, ERP单号, 备注
FROM bd_material_out ORDER BY 单据编号 DESC;

SELECT N'--- 这些单据的明细行(关键列) ---' AS s;
SELECT TOP 30 l.单据编号, l.行号, l.材料编码, l.材料名称, l.计量单位, l.单位id, l.数量, l.单价,
       l.仓库编码, l.批号, l.规格型号, l.成本, l.单位成本, ISNULL(l.asp_cancel,'-') AS 作废
FROM bl_material_out l
WHERE l.单据编号 IN (SELECT TOP 8 单据编号 FROM bd_material_out ORDER BY 单据编号 DESC)
ORDER BY l.单据编号 DESC, l.行号;

SELECT N'--- bl_material_out 关键列是否存在 ---' AS s;
SELECT c.name AS 列名 FROM sys.columns c WHERE c.object_id = OBJECT_ID('bl_material_out')
  AND c.name IN (N'材料编码', N'物料编码', N'存货编码', N'材料名称') ORDER BY c.name;

SELECT N'--- 行数/空材料编码行数(最近 8 张) ---' AS s;
SELECT 单据编号, COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(材料编码,'')='' THEN 1 ELSE 0 END) AS 材料编码为空行数
FROM bl_material_out
WHERE 单据编号 IN (SELECT TOP 8 单据编号 FROM bd_material_out ORDER BY 单据编号 DESC)
GROUP BY 单据编号 ORDER BY 单据编号 DESC;
