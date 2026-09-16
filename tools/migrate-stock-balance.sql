-- migrate-stock-balance.sql — 库存状况表(STOCK_BALANCE):参照 PANDA 实时聚合实现
-- 数据源:8 类出入库单据行,按 仓库+存货 聚合现存量/结存金额,视图实时计算
SET NOCOUNT ON;

-- ══ 1) 视图:v_stock_balance ══
SET NOCOUNT ON;
IF OBJECT_ID('dbo.v_stock_balance') IS NOT NULL DROP VIEW dbo.v_stock_balance;
-- 单据状态2(金蝶同步列)由已删除的数据装载脚本创建,DDL 未入链——此处幂等补列,保证链可重放
IF COL_LENGTH('dbo.bd_purchase_in', N'单据状态2') IS NULL ALTER TABLE bd_purchase_in ADD [单据状态2] nvarchar(20) NULL;
IF COL_LENGTH('dbo.bd_sale_out', N'单据状态2') IS NULL ALTER TABLE bd_sale_out ADD [单据状态2] nvarchar(20) NULL;
GO
EXEC(N'
CREATE VIEW dbo.v_stock_balance AS
WITH movements AS (
  -- 入库:有 单据状态2 列的表(金蝶同步)兼容两种状态
  SELECT l.仓库, l.存货编码, l.存货名称 AS 存货, l.规格型号, l.计量单位 AS 主计量,
         CAST(l.实收数量 AS decimal(18,4)) AS 数量, CAST(l.金额 AS decimal(18,4)) AS 金额, 1 AS sign
  FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
    AND (h.单据状态=N''已审核'' OR ISNULL(h.单据状态2,'''')=''C'')
  UNION ALL
  SELECT l.仓库, l.产品编码, l.产品名称, l.规格型号, l.计量单位, CAST(l.实收数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), 1
  FROM bl_finish_in l JOIN bd_finish_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT l.仓库, l.存货编码, l.存货名称, l.规格型号, l.计量单位, CAST(l.数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), 1
  FROM bl_other_in l JOIN bd_other_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT l.仓库, l.产品编码, l.产品名称, l.规格型号, l.计量单位, CAST(l.实收数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), 1
  FROM bl_outsource_in l JOIN bd_outsource_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT l.仓库, l.存货编码, l.存货名称, l.规格型号, l.计量单位, CAST(l.数量 AS decimal(18,4)), CAST(l.销售金额 AS decimal(18,4)), -1
  FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
    AND (h.单据状态=N''已审核'' OR ISNULL(h.单据状态2,'''')=''C'')
  UNION ALL
  SELECT l.仓库, l.材料编码, l.材料名称, l.规格型号, l.计量单位, CAST(l.数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), -1
  FROM bl_material_out l JOIN bd_material_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT l.仓库, l.存货编码, l.存货名称, l.规格型号, l.计量单位, CAST(l.数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), -1
  FROM bl_other_out l JOIN bd_other_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT l.仓库, l.材料编码, l.材料名称, l.规格型号, l.计量单位, CAST(l.数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), -1
  FROM bl_outsource_issue l JOIN bd_outsource_issue h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
)
SELECT ROW_NUMBER() OVER(ORDER BY m.仓库,m.存货编码,m.存货) AS id,
       w.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.主计量,
       SUM(m.数量*m.sign) AS 现存量,
       CASE WHEN SUM(m.数量*m.sign)<>0 THEN SUM(m.金额*m.sign)/SUM(m.数量*m.sign) ELSE 0 END AS 结存单价,
       SUM(m.金额*m.sign) AS 结存金额,
       CAST(''N'' AS char(1)) AS asp_cancel
FROM movements m LEFT JOIN dbo.bs_wh w ON w.仓库名称=m.仓库
GROUP BY w.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.主计量;
');

-- ══ 2) 面板注册 ══
IF NOT EXISTS(SELECT 1 FROM yj_panel WHERE panel_code='STOCK_BALANCE')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, head_table, line_table, pk_col, page_size, panel_name_en)
  VALUES ('STOCK_BALANCE', N'库存状况表', N'报表', 'flat', NULL, 'v_stock_balance', 'id', 50, 'Stock Balance');

-- ══ 3) 面板字段 ══
DELETE FROM yj_field WHERE panel_code='STOCK_BALANCE';
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, ref_panel, ref_field, display_field) VALUES
('STOCK_BALANCE', N'仓库编码', N'仓库编码', N'文本', N'query,detail', 10, 100, 0, 0, 0, 1, NULL, NULL, NULL),
('STOCK_BALANCE', N'仓库',     N'仓库',     N'文本', N'query,detail', 20, 120, 0, 0, 0, 1, 'WH', N'仓库名称', N'仓库名称'),
('STOCK_BALANCE', N'存货编码', N'存货编码', N'文本', N'query,detail', 30, 120, 0, 0, 0, 1, NULL, NULL, NULL),
('STOCK_BALANCE', N'存货',     N'存货',     N'文本', N'query,detail', 40, 200, 0, 0, 0, 1, 'INV', N'存货名称', N'存货名称'),
('STOCK_BALANCE', N'规格型号', N'规格型号', N'文本', N'detail', 50, 140, 0, 0, 0, 1, NULL, NULL, NULL),
('STOCK_BALANCE', N'主计量',   N'主计量',   N'文本', N'detail', 60, 80, 0, 0, 0, 1, NULL, NULL, NULL),
('STOCK_BALANCE', N'现存量',   N'现存量',   N'小数', N'detail', 70, 100, 0, 0, 0, 1, NULL, NULL, NULL),
('STOCK_BALANCE', N'结存单价', N'结存单价', N'小数', N'detail', 80, 100, 0, 0, 0, 1, NULL, NULL, NULL),
('STOCK_BALANCE', N'结存金额', N'结存金额', N'小数', N'detail', 90, 120, 0, 0, 0, 1, NULL, NULL, NULL);

-- ══ 4) 译名(至少 en) ══
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'库存状况表' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'库存状况表', 'en', 'Stock Balance', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'现存量' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'现存量', 'en', 'On Hand', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结存单价' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结存单价', 'en', 'Balance Price', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结存金额' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结存金额', 'en', 'Balance Amount', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'主计量' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'主计量', 'en', 'Base UOM', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'存货' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'存货', 'en', 'Item', 'manual');

-- ══ 5) 表注明 ══
EXEC sp_addextendedproperty @name=N'MS_Description', @value=N'库存状况表:按仓库+存货聚合8类出入库单据行的现存量/结存单价/结存金额(实时计算)',
     @level0type=N'SCHEMA', @level0name=N'dbo', @level1type=N'VIEW', @level1name=N'v_stock_balance';

GO
-- 自检
SELECT COUNT(*) AS 视图行数 FROM v_stock_balance;
SELECT TOP 5 * FROM v_stock_balance;
PRINT N'库存状况表创建完成';
GO
