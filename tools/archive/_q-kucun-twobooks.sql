SET NOCOUNT ON;
-- ② 两套账对比:kucun(MES 过账账) vs 库存报表口径(v_stock_balance,来自单据流水)
SELECT (SELECT SUM(ISNULL(yl,0)) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun结余合计,
       (SELECT SUM(现存量) FROM v_stock_balance) AS 报表现存量合计,
       (SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun行数,
       (SELECT COUNT(*) FROM v_stock_balance) AS 报表行数,
       (SELECT COUNT(DISTINCT ckdm) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun仓库数,
       (SELECT COUNT(DISTINCT 仓库键) FROM v_stock_movement) AS 报表仓库键数;
GO
-- ③ 逐 (仓库编码,存货编码) 对照:两边都有 / 只有一边
SELECT SUM(CASE WHEN k.存货 IS NOT NULL AND v.存货 IS NOT NULL THEN 1 ELSE 0 END) AS 两边都有,
       SUM(CASE WHEN v.存货 IS NULL THEN 1 ELSE 0 END) AS 只在kucun,
       SUM(CASE WHEN k.存货 IS NULL THEN 1 ELSE 0 END) AS 只在报表
FROM (SELECT ckdm AS 仓库, wzdm AS 存货, SUM(ISNULL(yl,0)) AS 量 FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY ckdm, wzdm) k
FULL JOIN (SELECT 仓库编码 AS 仓库, 存货编码 AS 存货, SUM(现存量) AS 量 FROM v_stock_balance GROUP BY 仓库编码, 存货编码) v
  ON v.仓库=k.仓库 AND v.存货=k.存货;
GO
-- ④ 只在报表里有、kucun 完全没记的仓库(= 报表口径覆盖了 kucun 之外的历史/金蝶单据)
SELECT 仓库编码, 仓库, SUM(现存量) AS 现存量, COUNT(*) AS 存货行数
FROM v_stock_balance
WHERE 仓库编码 NOT IN (SELECT DISTINCT ckdm FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y')
GROUP BY 仓库编码, 仓库 ORDER BY 现存量 DESC;
GO
-- ⑤ STOCK_STATUS 面板的权限与登记
SELECT panel_code, panel_name, category, module_group FROM yj_panel WHERE panel_code='STOCK_STATUS';
GO
SELECT COUNT(*) AS 有权角色数 FROM yj_role_panel WHERE panel_code='STOCK_STATUS';
GO
SELECT role_id, can_view, can_query, can_add, can_modify, can_del FROM yj_role_panel WHERE panel_code='STOCK_STATUS';
GO
