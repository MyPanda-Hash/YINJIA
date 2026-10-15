/* migrate-stock-detail-remove-lot.sql — 回退「批号分类」:库存明细回到按 (仓库编码, 存货编码) 归类
 *
 * 【背景】2026-10-15 第十轮按用户要求加过批号维度(migrate-stock-detail-add-lot.sql),
 *   随后用户要求「**回退到增加批号分类之前**」⇒ 本脚本把库改回两键口径:
 *   · v_stock_kucun 重建为 **按 (仓库编码, 存货编码) 聚合**(不再有 `批号` 列);
 *   · 面板字段回到 **9 列**(仓库编码·仓库名称·存货编码·存货名称·规格型号·累计入库量·累计出库量·现存量·更新时间)。
 *
 * 【配套的代码回退已用 git revert 完成】(提交 `2c3a8314` 加批号、`ecaf9c1f` 第十轮):
 *   · 月结结转行回到「按 (物料,仓库) 汇总、批号留空」;
 *   · 展开回到「只陈列上月的结转」(当月单据不铺)。
 *   ⚠ 代码回退**不会**撤销库里已建的三键视图 —— 所以必须跑本脚本,否则面板登记的 9 个字段里
 *     没有 `批号`,而视图里还留着它(无害但口径不一致),更关键的是行粒度还是三键。
 *
 * 幂等:视图 CREATE OR ALTER;字段先删后插。两账套都执行(先正式后测试)。
 */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ═══ ① 两键聚合视图(无批号) ═══ */
CREATE OR ALTER VIEW dbo.v_stock_kucun AS
SELECT ROW_NUMBER() OVER (ORDER BY m.仓库编码, m.存货编码) AS id,
       m.仓库编码, m.仓库名称, m.存货编码, m.存货名称, m.规格型号,
       m.累计入库量, m.累计出库量, m.现存量, m.更新时间,
       CAST('N' AS nvarchar(1)) AS asp_cancel
FROM (
  SELECT k.ckdm AS 仓库编码,
         ISNULL(w.仓库名称, N'') AS 仓库名称,
         k.wzdm AS 存货编码,
         ISNULL(i.存货名称, N'') AS 存货名称,
         ISNULL(i.规格型号, N'') AS 规格型号,
         CAST(SUM(ISNULL(k.rkl, 0)) AS decimal(18,4)) AS 累计入库量,
         CAST(SUM(ISNULL(k.ckl, 0)) AS decimal(18,4)) AS 累计出库量,
         CAST(SUM(ISNULL(k.yl, 0)) AS decimal(18,4)) AS 现存量,
         MAX(k.update_date) AS 更新时间
  FROM dbo.kucun k
  -- 名称一律 OUTER APPLY TOP 1(bs_wh 有同名重复行),避免 join 让行翻倍
  OUTER APPLY (SELECT TOP 1 x.仓库名称 FROM dbo.bs_wh x WHERE x.仓库编码 = k.ckdm ORDER BY x.id) w
  OUTER APPLY (SELECT TOP 1 x.存货名称, x.规格型号 FROM dbo.bs_inv x WHERE x.存货编码 = k.wzdm) i
  WHERE ISNULL(k.asp_cancel, 'N') <> 'Y'
  GROUP BY k.ckdm, k.wzdm, w.仓库名称, i.存货名称, i.规格型号
) m;
GO

/* ═══ ② 面板仍指向视图 ═══ */
UPDATE yj_panel SET line_table = 'v_stock_kucun', date_col = '更新时间', pk_col = 'id'
 WHERE panel_code = 'STOCK_DETAIL';
PRINT N'[面板] STOCK_DETAIL → v_stock_kucun(按 仓库 + 存货,无批号)';
GO

/* ═══ ③ 字段重登记(9 列,不含批号) ═══ */
DELETE FROM yj_field WHERE panel_code = 'STOCK_DETAIL';
GO
DECLARE @f TABLE (col_name sysname, label nvarchar(50), data_type nvarchar(20), ref_panel varchar(40),
                  ref_field nvarchar(128) NULL, display_field nvarchar(128) NULL, place varchar(40), seq int, width int);
INSERT INTO @f VALUES
  ('仓库编码', N'仓库编码', N'参照', 'WH',  N'仓库编码', N'仓库名称', 'query,detail', 10, 130),
  ('仓库名称', N'仓库名称', N'文本', NULL,  NULL,       NULL,       'detail',       20, 160),
  ('存货编码', N'存货编码', N'参照', 'INV', N'存货编码', N'存货名称', 'query,detail', 30, 140),
  ('存货名称', N'存货名称', N'文本', NULL,  NULL,       NULL,       'detail',       40, 220),
  ('规格型号', N'规格型号', N'文本', NULL,  NULL,       NULL,       'detail',       50, 150),
  ('累计入库量', N'累计入库量', N'小数', NULL, NULL,     NULL,       'detail',       60, 110),
  ('累计出库量', N'累计出库量', N'小数', NULL, NULL,     NULL,       'detail',       70, 110),
  ('现存量',   N'现存量',     N'小数', NULL, NULL,       NULL,       'detail',       80, 110),
  ('更新时间', N'更新时间',   N'日期时间', NULL, NULL,    NULL,       'detail',       90, 150);

INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width,
                      editable, required, hidden, visible)
SELECT 'STOCK_DETAIL', f.col_name, f.label, f.data_type, f.ref_panel, f.ref_field, f.display_field, f.place, f.seq, f.width,
       0, 0, 0, 1
FROM @f f;
DECLARE @n int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_DETAIL');
PRINT N'[字段] STOCK_DETAIL 字段行 = ' + CAST(@n AS nvarchar(10)) + N'(应 9,无批号)';
GO

/* ═══ 自检 ═══ */
DECLARE @bad int = 0;
DECLARE @vrows int = (SELECT COUNT(*) FROM dbo.v_stock_kucun);
DECLARE @krows int = (SELECT COUNT(*) FROM (SELECT wzdm, ckdm FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY wzdm, ckdm) t);
IF @vrows <> @krows SET @bad = @bad + 1;
IF COL_LENGTH('dbo.v_stock_kucun', '批号') IS NOT NULL SET @bad = @bad + 1;
IF (SELECT CAST(SUM(现存量) AS decimal(18,4)) FROM dbo.v_stock_kucun)
   <> (SELECT CAST(SUM(ISNULL(yl,0)) AS decimal(18,4)) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y') SET @bad = @bad + 1;
DECLARE @cnt int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_DETAIL');
IF @cnt <> 9 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'STOCK_DETAIL' AND col_name = N'批号') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'STOCK_DETAIL' AND col_name = N'存货名称') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = 'STOCK_DETAIL'
             AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.v_stock_kucun') AND c.name = f.col_name))
  SET @bad = @bad + 1;

DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[自检] %s:v_stock_kucun %d 行(= (物料,仓库) 组合 %d,无批号列);字段 %d 行(应 9);不符项 %d 条',
          10, 1, @dbn, @vrows, @krows, @cnt, @bad);
IF @bad = 0
  RAISERROR(N'[OK] 库存明细已回退到「按 仓库 + 存货 归类」(批号维度已撤)', 10, 1);
ELSE
  RAISERROR(N'[FAIL] 回退自检未过(见上一行数字)', 16, 1);
GO
