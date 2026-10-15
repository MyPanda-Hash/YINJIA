/* migrate-stock-report-dup-fields-20261015.sql — 库存报表字段重复清洗(库存状况表/库存台账/收发存汇总表)
 *
 * 用户报障(2026-10-15):「库存状况表出现字段重复」。
 * 实测(取数自跑起来的 8090 接口 /api/px/getPanelConfig,修复前):
 *   STOCK_BALANCE 下发 13 列 = 仓库编码 | 仓库编码 | 仓库 | 仓库 | 存货编码 | 存货编码 | 存货 | 存货 | 规格型号 | 主计量 | 现存量 | 结存单价 | 结存金额
 *   STOCK_LEDGER  33 列(仓库/存货各两遍 + 多出 开始日期/结束日期)
 *   STOCK_SUMMARY 23 列(同上);STOCK_DETAIL 9 列干净。
 *
 * 根因:tools/migrate-server-converge-20261007.sql(④ 补缺 yj_field)的存在性守卫是
 *   **(panel_code, col_name, place) 三元组** —— `WHERE NOT EXISTS(... g.place = v.place)`;
 *   而这三张报表面板的原始字段 place 是**合并值 'query,detail'**(查询弹窗条件与列表列共用一行),
 *   收敛快照里带的 place 是 'detail' ⇒ 守卫判「不存在」→ 把同一字段再插一遍(id 变大、宽度 130、无参照绑定)。
 *   后果:PanelConfigService.buildGridColumns 对 flat 面板取 `def.fields()` 全量 ⇒ 同名两列下发;
 *   而 QueryService.rowToLabels 按 label 收敛成一个键 ⇒ 界面两列内容完全一样(用户看到的「字段重复」)。
 *   同批被收敛脚本复活的还有 开始日期/结束日期:这两个字段早在链上更靠前的
 *   migrate-report-dialog-fields.sql(2026-09-17,清单 429 行)就被显式删掉过
 *   (弹窗日期段改为前端内置控件,不再走 yj_field),属「删了又被插回来」。
 *
 * 口径(唯一权威 = 各面板原始定义脚本,清洗后 = 原始设计):
 *   STOCK_BALANCE  9 列  (migrate-stock-balance.sql:仓库编码·仓库·存货编码·存货·规格型号·主计量·现存量·结存单价·结存金额)
 *   STOCK_LEDGER  29 列  (去掉复活的 开始日期/结束日期 + 重复的 仓库/存货)
 *   STOCK_SUMMARY 19 列  (同上;列 = 仓库编码·仓库·存货编码·存货·期次·规格型号·主单位·期初×3·本期入库×3·本期出库×3·期末结存×3)
 *   STOCK_DETAIL   9 列  (本来就干净,本脚本不碰)
 *
 * 两条清洗规则(均带守卫,重复执行 = 0 行):
 *   A) 同面板同 label 多行 → 删掉 place 不含 query 的那一行,**保留带 query 的原行**
 *      (查询弹窗的仓库/存货条件、参照绑定 ref_panel/ref_field 都在原行身上;删原行会把查询弹窗打瘸)。
 *   B) STOCK_LEDGER / STOCK_SUMMARY 的 开始日期/结束日期 字段行 → 按 migrate-report-dialog-fields.sql 口径删除。
 *      视图里的 开始日期/结束日期 派生列(migrate-stock-ledger-query.sql / migrate-stock-summary-query.sql 建的)
 *      **保留不动** —— 它们是查询字段的 SELECT 载体,删列会连带改视图定义,风险与收益不成比例。
 *
 * 为什么不直接改 migrate-server-converge-20261007.sql:它是 2026-10-07 的一次性服务器收敛脚本,
 *   改动任一字节都会被 DbSync 按内容哈希判为「重跑」,而它内含②删行/①补列等大范围动作,重放风险大于收益;
 *   本脚本登记在 db-migrations.txt **链尾**,全链重放(含收敛脚本被重放)之后仍以本脚本为准 ⇒ 重复行不会复活。
 *
 * 自检:三面板 label 重复数 = 0;开始日期/结束日期 行 = 0;字段数 = 9/29/19;库存明细仍 9 列。
 * 幂等;两账套均执行(先正式后测试):
 *   tools\ 下: java -cp lib\mssql-jdbc.jar DbSync.java run migrate-stock-report-dup-fields-20261015.sql
 *              YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar DbSync.java run migrate-stock-report-dup-fields-20261015.sql
 */
SET NOCOUNT ON;
GO

/* ═══ A) 同面板同 label 重复行:删掉 place 不含 query 的重复行,保留带 query 的原行 ═══ */
DECLARE @delA int = 0;
DELETE f
FROM yj_field f
JOIN yj_field g
  ON g.panel_code = f.panel_code
 AND g.label      = f.label
 AND g.id         < f.id
 AND g.place LIKE N'%query%'
WHERE f.panel_code IN (N'STOCK_BALANCE', N'STOCK_LEDGER', N'STOCK_SUMMARY')
  AND f.place NOT LIKE N'%query%';
SET @delA = @@ROWCOUNT;

/* ═══ B) 开始日期/结束日期 残留行(收敛脚本复活的已删字段) ═══ */
DECLARE @delB int = 0;
DELETE FROM yj_field
WHERE panel_code IN (N'STOCK_LEDGER', N'STOCK_SUMMARY')
  AND col_name IN (N'开始日期', N'结束日期');
SET @delB = @@ROWCOUNT;

-- ⚠ 用 RAISERROR(...,10) 而不是 PRINT:DbSync 只把「错误码非 0 的信息级消息」打到控制台
--   (PRINT 的消息码恒为 0,会被静默吞掉,看不到删了几行 —— 见 DbSync.java:230)。
DECLARE @dbn0 sysname = DB_NAME();
RAISERROR(N'[OK] %s:删除重复字段行 A=%d 行,B(开始/结束日期)=%d 行',
          10, 1, @dbn0, @delA, @delB);
GO

/* ═══ 自检 ═══ */
DECLARE @bad int = 0;

-- ① 三面板不得再有同名 label
DECLARE @dup int;
SELECT @dup = COUNT(*) FROM (
  SELECT panel_code, label FROM yj_field
  WHERE panel_code IN (N'STOCK_BALANCE', N'STOCK_LEDGER', N'STOCK_SUMMARY')
  GROUP BY panel_code, label HAVING COUNT(*) > 1) d;
IF @dup <> 0 SET @bad = @bad + 1;

-- ② 开始日期/结束日期 不得残留
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code IN (N'STOCK_LEDGER', N'STOCK_SUMMARY')
             AND col_name IN (N'开始日期', N'结束日期')) SET @bad = @bad + 1;

-- ③ 字段数回到原始设计
DECLARE @bal int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'STOCK_BALANCE');
DECLARE @led int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'STOCK_LEDGER');
DECLARE @sum int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'STOCK_SUMMARY');
DECLARE @det int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'STOCK_DETAIL');
IF @bal <> 9  SET @bad = @bad + 1;
IF @led <> 29 SET @bad = @bad + 1;
IF @sum <> 19 SET @bad = @bad + 1;
IF @det <> 9  SET @bad = @bad + 1;

-- ④ 保留下来的 仓库/存货 必须还是「查询条件 + 参照绑定」那一行(别把该留的删了)
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'STOCK_BALANCE'
      AND col_name IN (N'仓库', N'存货') AND place LIKE N'%query%' AND ref_panel IN (N'WH', N'INV')) <> 2 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'STOCK_LEDGER', N'STOCK_SUMMARY')
      AND col_name IN (N'仓库', N'存货') AND place LIKE N'%query%' AND ref_panel IN (N'WH', N'INV')) <> 4 SET @bad = @bad + 1;

-- ⑤ 库存状况表的查询位仍在(9 列里 4 个查询字段:仓库编码/仓库/存货编码/存货)
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'STOCK_BALANCE' AND place LIKE N'%query%') <> 4 SET @bad = @bad + 1;

DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[自检] %s:库存报表字段 STOCK_BALANCE=%d(应 9) STOCK_LEDGER=%d(应 29) STOCK_SUMMARY=%d(应 19) STOCK_DETAIL=%d(应 9);同名 label 重复 %d 组;不符项 %d 条',
          10, 1, @dbn, @bal, @led, @sum, @det, @dup, @bad);
IF @bad = 0
  RAISERROR(N'[OK] 库存报表字段重复已清洗(库存状况表不再有重复列)', 10, 1);
ELSE
  RAISERROR(N'[FAIL] 库存报表字段清洗自检未过(见上一行数字)', 16, 1);
GO
