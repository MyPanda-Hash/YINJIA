SET NOCOUNT ON;
-- 采购入库:面板字段 place 分布(现状)
SELECT place, COUNT(*) AS n FROM yj_field WHERE panel_code='PURCHASE_IN' GROUP BY place ORDER BY place;
SELECT place, COUNT(*) AS n FROM yj_field WHERE panel_code='SALE_OUT' GROUP BY place ORDER BY place;
-- 看混在一起的:header 位但应该是 detail 的(行级数据)
SELECT panel_code, place, col_name, label FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND place LIKE '%header%' AND seq >= 970
  AND (col_name LIKE N'%存货%' OR col_name LIKE N'%物料%' OR col_name LIKE N'%规格%' OR col_name LIKE N'%单价%'
    OR col_name LIKE N'%数量%' OR col_name LIKE N'%税率%' OR col_name LIKE N'%金额%' OR col_name LIKE N'%批号%'
    OR col_name LIKE N'%条形码%' OR col_name LIKE N'%保质期%' OR col_name LIKE N'%源单%'
    OR col_name LIKE N'%辅助属性%' OR col_name LIKE N'%单位%' OR col_name LIKE N'%商品%'
    OR col_name LIKE N'%仓库名称%' OR col_name LIKE N'%仓位%' OR col_name LIKE N'%折%'
    OR col_name LIKE N'%退货%' OR col_name LIKE N'%成本%' OR col_name LIKE N'%赠品%')
ORDER BY panel_code, seq;
