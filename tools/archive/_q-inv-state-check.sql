/* 收尾核验(只读):库存报表任务在 HSDZ_MES 的落地状态 */
SET NOCOUNT ON;
GO
PRINT '== ① 对象是否就位(视图/物化表) ==';
SELECT o.name, o.type_desc, o.create_date, o.modify_date
  FROM sys.objects o
 WHERE o.name IN ('v_stock_movement','inv_cost_ledger','v_stock_ledger','v_stock_summary','v_stock_balance')
 ORDER BY o.type_desc, o.name;
GO
PRINT '== ② inv_cost_ledger 覆盖与勾稽 ==';
SELECT COUNT(*) AS 行数,
       SUM(CASE WHEN 结存金额 IS NULL THEN 1 ELSE 0 END) AS 结存金额空,
       SUM(结存金额) AS 总结存金额,
       SUM(发出成本金额) AS 累计发出成本
  FROM inv_cost_ledger;
GO
PRINT '== ③ 流水覆盖(无成本行的流水应为 0) ==';
SELECT COUNT(*) AS 无成本行数
  FROM v_stock_movement m
 WHERE NOT EXISTS (SELECT 1 FROM inv_cost_ledger c WHERE c.src = m.src AND c.rid = m.rid);
GO
PRINT '== ④ STOCK_BALANCE 仓库/存货 应为 参照 ==';
SELECT panel_code, col_name, data_type, ref_panel
  FROM yj_field
 WHERE panel_code = N'STOCK_BALANCE' AND col_name IN (N'仓库', N'存货');
GO
PRINT '== ⑤ STOCK_LEDGER 六个新列是否注册 ==';
SELECT col_name, label, place, data_type
  FROM yj_field
 WHERE panel_code = N'STOCK_LEDGER'
   AND col_name IN (N'批号', N'往来单位编码', N'经手人', N'含税金额', N'税额', N'发出单据金额')
 ORDER BY seq;
GO
PRINT '== ⑥ 视图列抽查(台账应有 发出单据金额 列) ==';
SELECT c.name AS 列名
  FROM sys.columns c
 WHERE c.object_id = OBJECT_ID('dbo.v_stock_ledger')
   AND c.name IN (N'批号', N'往来单位编码', N'经手人', N'含税金额', N'税额', N'发出单据金额', N'发出金额');
GO
