-- migrate-stock-ledger-query.sql — 库存台账查询弹窗(与收发存汇总同款)
-- ① 弹窗字段 = 开始/结束日期(必填,日期控件)+仓库/存货(参照 WH/INV)
-- ② v_stock_ledger 补 开始日期/结束日期 回显列(=单据日期,SELECT 载体;过滤走 单据日期 闭区间)
-- ③ 编码列/单据类型退为仅明细列;仓库/存货 data_type 文本→参照(isRef 需)
SET NOCOUNT ON;

-- ══ 1) 重建 v_stock_ledger(+2 回显列;与 migrate-inv-accounting.sql 同定义加两列) ══
-- 注:普通视图无 SCHEMABINDING,重建 ledger 不需要先删依赖它的 v_stock_summary
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
                                  ROWS UNBOUNDED PRECEDING) AS 结存数量,
         SUM(m.金额*m.sign) OVER (PARTITION BY m.仓库, m.存货编码 ORDER BY m.单据日期, m.src, m.rid
                                  ROWS UNBOUNDED PRECEDING) AS 结存金额
  FROM mov m LEFT JOIN dbo.bs_wh w ON w.仓库名称 = m.仓库
)
SELECT ROW_NUMBER() OVER (ORDER BY 仓库, 存货编码, 单据日期, src, rid) AS id,
       CONVERT(nvarchar(10), 单据日期, 120) AS 开始日期,
       CONVERT(nvarchar(10), 单据日期, 120) AS 结束日期,
       仓库编码, 仓库, 存货编码, 存货, 规格型号, 计量单位,
       单据日期, 单据类型, 单据编号, 业务类型, 往来单位,
       CASE WHEN sign=1 THEN 数量 ELSE 0 END AS 收入数量,
       CASE WHEN sign=1 AND 数量<>0 THEN 金额/数量 ELSE 0 END AS 收入单价,
       CASE WHEN sign=1 THEN 金额 ELSE 0 END AS 收入金额,
       CASE WHEN sign=-1 THEN 数量 ELSE 0 END AS 发出数量,
       CASE WHEN sign=-1 AND 数量<>0 THEN 金额/数量 ELSE 0 END AS 发出单价,
       CASE WHEN sign=-1 THEN 金额 ELSE 0 END AS 发出金额,
       结存数量,
       CASE WHEN 结存数量<>0 THEN 结存金额/结存数量 ELSE 0 END AS 结存平均单价,
       结存金额,
       CAST(''N'' AS char(1)) AS asp_cancel
FROM run;
');
GO

-- ══ 2) 查询字段:日期段(必填,日期控件) ══
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='STOCK_LEDGER' AND col_name=N'开始日期')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('STOCK_LEDGER', N'开始日期', N'开始日期', N'日期', N'query', 5, 110, 0, 1, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='STOCK_LEDGER' AND col_name=N'结束日期')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('STOCK_LEDGER', N'结束日期', N'结束日期', N'日期', N'query', 6, 110, 0, 1, 0, 1);

-- ══ 3) 仓库/存货关联基础档案(文本→参照,否则 isRef 不下发 refPanel) ══
UPDATE yj_field SET data_type = N'参照', ref_panel = N'WH', ref_field = N'仓库名称', display_field = N'仓库名称'
WHERE panel_code='STOCK_LEDGER' AND col_name = N'仓库';
UPDATE yj_field SET data_type = N'参照', ref_panel = N'INV', ref_field = N'存货名称', display_field = N'存货名称'
WHERE panel_code='STOCK_LEDGER' AND col_name = N'存货';

-- ══ 4) 编码列/单据类型退出查询区(保留明细列) ══
UPDATE yj_field SET place = N'detail' WHERE panel_code='STOCK_LEDGER' AND col_name IN (N'仓库编码', N'存货编码', N'单据类型');

SELECT col_name, data_type, ref_panel, place FROM yj_field WHERE panel_code='STOCK_LEDGER' AND place LIKE N'%query%' ORDER BY seq;
PRINT N'库存台账查询弹窗字段调整完成';
