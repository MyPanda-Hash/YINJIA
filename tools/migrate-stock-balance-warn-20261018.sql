-- migrate-stock-balance-warn-20261018.sql
-- 目的(2026-10-18 用户口径「统一到同一视图 v_stock_balance」):
--   库存页「现存量 TOP」用 v_stock_balance,而流程看板的负库存/出库预警仍读遗留批次表 kucun
--   —— 同一块看板两个「负库存」数(实测 v_stock_balance 780 行 < 0,kucun 315 行 < 0)对不上。
--   本脚本给 v_stock_balance 增列「预警数量」:取 kucun 按 (仓库编码, 存货编码) 聚合的 MAX
--   (实测 30 个有阈值的组合阈值唯一,不存在多值歧义),流程看板 thereafter 只读本视图。
--   注意 kucun 仍保留批次级预警数量,出库审批闸门 StockWarnService 继续用批次口径,本次不动。
--
-- 幂等:CREATE OR ALTER VIEW(可重放);两账套都要执行。
SET NOCOUNT ON;
GO

CREATE OR ALTER VIEW dbo.v_stock_balance AS
SELECT ROW_NUMBER() OVER (ORDER BY m.仓库, m.存货编码, m.存货) AS id,
       m.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.主计量,
       SUM(m.数量*m.sign) AS 现存量,
       CASE WHEN SUM(m.数量*m.sign)<>0 THEN SUM(m.金额*m.sign)/SUM(m.数量*m.sign) ELSE 0 END AS 结存单价,
       SUM(m.金额*m.sign) AS 结存金额,
       ISNULL(MAX(k.预警数量),0) AS 预警数量,
       CAST('N' AS char(1)) AS asp_cancel
FROM (
  -- 在库:现存量按 仓库键+存货 聚合;金额 = 收入金额 − 移动加权发出成本(取自物化表)
  SELECT m.仓库键, m.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.计量单位 AS 主计量,
         m.收入数量 - m.发出数量 AS 数量,
         m.收入金额 - ISNULL(c.发出成本金额,0) AS 金额, 1 AS sign
  FROM dbo.v_stock_movement m
  LEFT JOIN dbo.inv_cost_ledger c ON c.src = m.src AND c.rid = m.rid
) m
-- 预警数量:遗留批次表 kucun 按 仓库+存货 聚合(同一组合阈值唯一;无阈值的行补 0)
LEFT JOIN (
  SELECT RTRIM(wzdm) AS 存货编码, RTRIM(ckdm) AS 仓库编码, MAX(ISNULL(预警数量,0)) AS 预警数量
  FROM dbo.kucun
  WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(预警数量,0) > 0
  GROUP BY RTRIM(wzdm), RTRIM(ckdm)
) k ON k.存货编码 = m.存货编码 AND k.仓库编码 = m.仓库编码
-- 与成本分区键同口径(含 仓库键):否则同编码不同名称写法会被拆成两行,与成本口径不一致
GROUP BY m.仓库键, m.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.主计量;
GO
