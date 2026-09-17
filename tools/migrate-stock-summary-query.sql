-- migrate-stock-summary-query.sql — 收发存汇总表查询条件调整(T+ 查询弹窗口径)
-- 弹窗字段 = 开始日期/结束日期(必填,日期控件)+仓库/存货(参照);编码列与期次退为仅明细列
-- 后端 QueryService 对 开始/结束日期 已特殊处理为期次闭区间(不走 LIKE,视图无同名列)
SET NOCOUNT ON;

-- ══ 0) 视图补 开始日期/结束日期 派生列(月初/月末):查询字段的 SELECT 载体, ══
--     值由期次派生仅供展示;过滤走 QueryService 的期次闭区间特判(不用这两列)
IF OBJECT_ID('dbo.v_stock_summary') IS NOT NULL DROP VIEW dbo.v_stock_summary;
GO
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

-- 日期段(弹窗内渲染日期控件)
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='STOCK_SUMMARY' AND col_name=N'开始日期')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('STOCK_SUMMARY', N'开始日期', N'开始日期', N'日期', N'query', 5, 110, 0, 1, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='STOCK_SUMMARY' AND col_name=N'结束日期')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('STOCK_SUMMARY', N'结束日期', N'结束日期', N'日期', N'query', 6, 110, 0, 1, 0, 1);

-- 编码列/期次退出查询区(保留明细列;仓库/存货参照仍在查询区)
UPDATE yj_field SET place = N'detail' WHERE panel_code='STOCK_SUMMARY' AND col_name IN (N'仓库编码', N'存货编码', N'期次');

-- 仓库/存货 关联基础档案(data_type 必须=参照 才会下发 refPanel;此前是文本导致参照失效)
UPDATE yj_field SET data_type = N'参照', ref_panel = N'WH', ref_field = N'仓库名称', display_field = N'仓库名称'
WHERE panel_code='STOCK_SUMMARY' AND col_name = N'仓库';
UPDATE yj_field SET data_type = N'参照', ref_panel = N'INV', ref_field = N'存货名称', display_field = N'存货名称'
WHERE panel_code='STOCK_SUMMARY' AND col_name = N'存货';

-- 译名(全局共享,缺则补)
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结束日期' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结束日期', 'en', N'End date', 'manual');

SELECT col_name, place FROM yj_field WHERE panel_code='STOCK_SUMMARY' AND place LIKE N'%query%' ORDER BY seq;
PRINT N'收发存汇总查询字段调整完成';
