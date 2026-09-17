-- migrate-stock-ledger-open-close.sql — 库存台账加期初/期末结存列(T+ 同款语义)
-- PANDA 真源:movements() 首源=INIT_BALANCE 期初建账单(direction=INITIAL,单据类型=期初结存);
-- 我们无建账单 → 期初=本行发生前累计(LAG 窗口),期末=本行累计(即结存)。
-- 日期段过滤时窗口在 WHERE 前计算 → 首行期初=期前全部累计=该时段期初结存;末行期末=期末结存。
SET NOCOUNT ON;

-- ══ 1) 重建 v_stock_ledger(+期初/期末各3列;期末=原结存口径) ══
IF OBJECT_ID('dbo.v_stock_summary') IS NOT NULL DROP VIEW dbo.v_stock_summary; -- 依赖先卸(末尾重建)
IF OBJECT_ID('dbo.v_stock_ledger') IS NOT NULL DROP VIEW dbo.v_stock_ledger;
GO
EXEC(N'
CREATE VIEW dbo.v_stock_ledger AS
WITH mov AS (
  SELECT h.单据日期, N''采购入库单'' AS 单据类型, l.单据编号, N''入库'' AS 业务类型, h.供应商 AS 往来单位,
         l.仓库, l.存货编码, l.存货名称 AS 存货, l.规格型号, l.计量单位,
         CAST(l.实收数量 AS decimal(18,4)) AS 数量, ISNULL(CAST(l.金额 AS decimal(18,4)),0) AS 金额, 1 AS sign, 1 AS src, l.id AS rid
  FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
    AND (h.单据状态=N''已审核'' OR ISNULL(h.单据状态2,'''')=''C'')
  UNION ALL
  SELECT h.单据日期, N''产成品入库单'', l.单据编号, N''入库'', NULL,
         l.仓库, l.产品编码, l.产品名称, l.规格型号, l.计量单位,
         CAST(l.实收数量 AS decimal(18,4)), ISNULL(CAST(l.金额 AS decimal(18,4)),0), 1, 2, l.id
  FROM bl_finish_in l JOIN bd_finish_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT h.单据日期, N''其他入库单'', l.单据编号, N''入库'', NULL,
         l.仓库, l.存货编码, l.存货名称, l.规格型号, l.计量单位,
         CAST(l.数量 AS decimal(18,4)), ISNULL(CAST(l.金额 AS decimal(18,4)),0), 1, 3, l.id
  FROM bl_other_in l JOIN bd_other_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT h.单据日期, N''委外入库单'', l.单据编号, N''入库'', NULL,
         l.仓库, l.产品编码, l.产品名称, l.规格型号, l.计量单位,
         CAST(l.实收数量 AS decimal(18,4)), ISNULL(CAST(l.金额 AS decimal(18,4)),0), 1, 4, l.id
  FROM bl_outsource_in l JOIN bd_outsource_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT h.单据日期, N''销售出库单'', l.单据编号, N''出库'', h.客户,
         l.仓库, l.存货编码, l.存货名称, l.规格型号, l.计量单位,
         CAST(l.数量 AS decimal(18,4)), ISNULL(CAST(l.销售金额 AS decimal(18,4)),0), -1, 5, l.id
  FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
    AND (h.单据状态=N''已审核'' OR ISNULL(h.单据状态2,'''')=''C'')
  UNION ALL
  SELECT h.单据日期, N''材料出库单'', l.单据编号, N''出库'', NULL,
         l.仓库, l.材料编码, l.材料名称, l.规格型号, l.计量单位,
         CAST(l.数量 AS decimal(18,4)), ISNULL(CAST(l.金额 AS decimal(18,4)),0), -1, 6, l.id
  FROM bl_material_out l JOIN bd_material_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT h.单据日期, N''其他出库单'', l.单据编号, N''出库'', NULL,
         l.仓库, l.存货编码, l.存货名称, l.规格型号, l.计量单位,
         CAST(l.数量 AS decimal(18,4)), ISNULL(CAST(l.金额 AS decimal(18,4)),0), -1, 7, l.id
  FROM bl_other_out l JOIN bd_other_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT h.单据日期, N''委外发料单'', l.单据编号, N''出库'', NULL,
         l.仓库, l.材料编码, l.材料名称, l.规格型号, l.计量单位,
         CAST(l.数量 AS decimal(18,4)), ISNULL(CAST(l.金额 AS decimal(18,4)),0), -1, 8, l.id
  FROM bl_outsource_issue l JOIN bd_outsource_issue h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
),
run AS (
  SELECT m.*, w.仓库编码,
         SUM(m.数量*m.sign) OVER (PARTITION BY m.仓库, m.存货编码 ORDER BY m.单据日期, m.src, m.rid
                                  ROWS UNBOUNDED PRECEDING) AS 累计数量,
         SUM(m.金额*m.sign) OVER (PARTITION BY m.仓库, m.存货编码 ORDER BY m.单据日期, m.src, m.rid
                                  ROWS UNBOUNDED PRECEDING) AS 累计金额
  FROM mov m LEFT JOIN dbo.bs_wh w ON w.仓库名称 = m.仓库
)
SELECT ROW_NUMBER() OVER (ORDER BY 仓库, 存货编码, 单据日期, src, rid) AS id,
       CONVERT(nvarchar(10), 单据日期, 120) AS 开始日期,
       CONVERT(nvarchar(10), 单据日期, 120) AS 结束日期,
       仓库编码, 仓库, 存货编码, 存货, 规格型号, 计量单位,
       单据日期, 单据类型, 单据编号, 业务类型, 往来单位,
       ISNULL(LAG(累计数量) OVER (PARTITION BY 仓库, 存货编码 ORDER BY 单据日期, src, rid), 0) AS 期初数量,
       CASE WHEN ISNULL(LAG(累计数量) OVER (PARTITION BY 仓库, 存货编码 ORDER BY 单据日期, src, rid), 0) <> 0
            THEN ISNULL(LAG(累计金额) OVER (PARTITION BY 仓库, 存货编码 ORDER BY 单据日期, src, rid), 0)
                 / ISNULL(LAG(累计数量) OVER (PARTITION BY 仓库, 存货编码 ORDER BY 单据日期, src, rid), 0)
            ELSE 0 END AS 期初平均单价,
       ISNULL(LAG(累计金额) OVER (PARTITION BY 仓库, 存货编码 ORDER BY 单据日期, src, rid), 0) AS 期初金额,
       CASE WHEN sign=1 THEN 数量 ELSE 0 END AS 收入数量,
       CASE WHEN sign=1 AND 数量<>0 THEN 金额/数量 ELSE 0 END AS 收入单价,
       CASE WHEN sign=1 THEN 金额 ELSE 0 END AS 收入金额,
       CASE WHEN sign=-1 THEN 数量 ELSE 0 END AS 发出数量,
       CASE WHEN sign=-1 AND 数量<>0 THEN 金额/数量 ELSE 0 END AS 发出单价,
       CASE WHEN sign=-1 THEN 金额 ELSE 0 END AS 发出金额,
       累计数量 AS 期末数量,
       CASE WHEN 累计数量<>0 THEN 累计金额/累计数量 ELSE 0 END AS 期末平均单价,
       累计金额 AS 期末金额,
       CAST(''N'' AS char(1)) AS asp_cancel
FROM run;
');
GO

-- ══ 2) 台账面板字段:结存3列 → 期初3列+期末3列(列组同构收发存汇总) ══
DELETE FROM yj_field WHERE panel_code='STOCK_LEDGER' AND col_name IN (N'结存数量', N'结存平均单价', N'结存金额');
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='STOCK_LEDGER' AND col_name=N'期初数量')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, col_group)
  VALUES ('STOCK_LEDGER', N'期初数量',     N'期初数量',     N'小数', N'detail', 180, 90,  0, 0, 0, 1, N'期初结存');
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='STOCK_LEDGER' AND col_name=N'期初平均单价')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, col_group)
  VALUES ('STOCK_LEDGER', N'期初平均单价', N'期初平均单价', N'小数', N'detail', 190, 100, 0, 0, 0, 1, N'期初结存');
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='STOCK_LEDGER' AND col_name=N'期初金额')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, col_group)
  VALUES ('STOCK_LEDGER', N'期初金额',     N'期初金额',     N'小数', N'detail', 200, 100, 0, 0, 0, 1, N'期初结存');
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='STOCK_LEDGER' AND col_name=N'期末数量')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, col_group)
  VALUES ('STOCK_LEDGER', N'期末数量',     N'期末数量',     N'小数', N'detail', 210, 90,  0, 0, 0, 1, N'期末结存');
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='STOCK_LEDGER' AND col_name=N'期末平均单价')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, col_group)
  VALUES ('STOCK_LEDGER', N'期末平均单价', N'期末平均单价', N'小数', N'detail', 220, 100, 0, 0, 0, 1, N'期末结存');
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='STOCK_LEDGER' AND col_name=N'期末金额')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, col_group)
  VALUES ('STOCK_LEDGER', N'期末金额',     N'期末金额',     N'小数', N'detail', 230, 100, 0, 0, 0, 1, N'期末结存');

-- ══ 3) 汇总视图重建(第1步已卸载,此处复原;定义同 migrate-stock-summary-query.sql) ══
EXEC(N'
CREATE VIEW dbo.v_stock_summary AS
WITH monthly AS (
  SELECT 仓库编码, 仓库, 存货编码, 存货, 规格型号, 计量单位 AS 主单位,
         ISNULL(CONVERT(nvarchar(7), 单据日期, 120), N''未填日期'') AS 期次,
         SUM(收入数量) AS 本期入库数量, SUM(收入金额) AS 本期入库金额,
         SUM(发出数量) AS 本期出库数量, SUM(发出金额) AS 本期出库金额
  FROM dbo.v_stock_ledger
  GROUP BY 仓库编码, 仓库, 存货编码, 存货, 规格型号, 计量单位,
           ISNULL(CONVERT(nvarchar(7), 单据日期, 120), N''未填日期'')
),
run AS (
  SELECT monthly.*,
         SUM(本期入库数量 - 本期出库数量) OVER (PARTITION BY 仓库编码, 仓库, 存货编码, 存货
              ORDER BY 期次 ROWS UNBOUNDED PRECEDING) AS 期末结存数量,
         SUM(本期入库金额 - 本期出库金额) OVER (PARTITION BY 仓库编码, 仓库, 存货编码, 存货
              ORDER BY 期次 ROWS UNBOUNDED PRECEDING) AS 期末结存金额
  FROM monthly
),
calc AS (
  SELECT *, 期末结存数量 - (本期入库数量 - 本期出库数量) AS 期初数量,
            期末结存金额 - (本期入库金额 - 本期出库金额) AS 期初金额
  FROM run
)
SELECT ROW_NUMBER() OVER (ORDER BY 仓库, 存货编码, 期次) AS id,
       CASE WHEN 期次 LIKE ''[0-9][0-9][0-9][0-9]-[0-9][0-9]'' THEN 期次 + ''-01'' END AS 开始日期,
       CASE WHEN 期次 LIKE ''[0-9][0-9][0-9][0-9]-[0-9][0-9]''
            THEN CONVERT(nvarchar(10), DATEADD(DAY, -1, DATEADD(MONTH, 1, 期次 + ''-01'')), 120) END AS 结束日期,
       仓库编码, 仓库, 存货编码, 存货, 规格型号, 主单位, NULL AS 辅单位, 期次,
       期初数量, CASE WHEN 期初数量<>0 THEN 期初金额/期初数量 ELSE 0 END AS 期初平均单价, 期初金额,
       本期入库数量, CASE WHEN 本期入库数量<>0 THEN 本期入库金额/本期入库数量 ELSE 0 END AS 入库平均单价, 本期入库金额,
       本期出库数量, CASE WHEN 本期出库数量<>0 THEN 本期出库金额/本期出库数量 ELSE 0 END AS 出库平均单价, 本期出库金额,
       期末结存数量, CASE WHEN 期末结存数量<>0 THEN 期末结存金额/期末结存数量 ELSE 0 END AS 期末平均单价, 期末结存金额,
       CAST(''N'' AS char(1)) AS asp_cancel
FROM calc;
');
GO

-- 自检:同一存货流水,期初+收入-发出=期末 逐行勾稽
SELECT TOP 5 单据日期, 单据类型, 期初数量, 收入数量, 发出数量, 期末数量,
       CASE WHEN 期初数量+收入数量-发出数量=期末数量 THEN N'✓' ELSE N'✗' END AS 勾稽
FROM v_stock_ledger WHERE 仓库 IS NOT NULL ORDER BY id;
PRINT N'台账期初/期末列完成';
