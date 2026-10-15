/* migrate-stock-detail-add-lot.sql — 库存明细把**批号**分类加回来(一行 = 仓库 + 存货 + 批号)
 *
 * 【用户口径 2026-10-15 第九轮】
 *   「重新修改库存明细加入回来批号进行分类」——第四轮曾按「先只按仓库编码和存货编码分类」把批号合并掉,
 *   现按用户要求**加回批号维度**:一行 = 一个 (仓库编码, 存货编码, 批号),仓库名称/存货名称仍保留。
 *
 * 【改法】`v_stock_kucun` 重建成**三键聚合**(数据源仍是 kucun),多出一列 `批号`;面板字段加到 10 列:
 *   仓库编码 · 仓库名称 · 存货编码 · 存货名称 · **批号** · 规格型号 · 累计入库量 · 累计出库量 · 现存量 · 更新时间
 *   行数回到「(物料,仓库,批号) 组合数」= kucun 行数(正式库约 2507)。
 *
 * 【不变的部分(别误伤)】
 *   · 月结结转行仍是**不带批号、按 (物料,仓库) 汇总**(第七轮口径:一个月一套结转);
 *   · 展开明细仍只陈列「上一个月的结转」(第八轮口径)——所以前端**不传批号**,那张无批号结转行照样命中。
 * 幂等:视图 CREATE OR ALTER;字段先删后插。两账套都执行(先正式后测试)。
 */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ═══ ① 三键聚合视图(含批号) ═══ */
CREATE OR ALTER VIEW dbo.v_stock_kucun AS
SELECT ROW_NUMBER() OVER (ORDER BY m.仓库编码, m.存货编码, m.批号) AS id,
       m.仓库编码, m.仓库名称, m.存货编码, m.存货名称, m.批号, m.规格型号,
       m.累计入库量, m.累计出库量, m.现存量, m.更新时间,
       CAST('N' AS nvarchar(1)) AS asp_cancel
FROM (
  SELECT k.ckdm AS 仓库编码,
         ISNULL(w.仓库名称, N'') AS 仓库名称,
         k.wzdm AS 存货编码,
         ISNULL(i.存货名称, N'') AS 存货名称,
         ISNULL(k.lot_no, N'') AS 批号,
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
  GROUP BY k.ckdm, k.wzdm, ISNULL(k.lot_no, N''), w.仓库名称, i.存货名称, i.规格型号
) m;
GO

/* ═══ ② 面板仍指向视图(id/date_col 不变) ═══ */
UPDATE yj_panel SET line_table = 'v_stock_kucun', date_col = '更新时间', pk_col = 'id'
 WHERE panel_code = 'STOCK_DETAIL';
PRINT N'[面板] STOCK_DETAIL → v_stock_kucun(仓库 + 存货 + 批号)';
GO

/* ═══ ③ 字段重登记(10 列) ═══ */
DELETE FROM yj_field WHERE panel_code = 'STOCK_DETAIL';
GO
DECLARE @f TABLE (col_name sysname, label nvarchar(50), data_type nvarchar(20), ref_panel varchar(40),
                  ref_field nvarchar(128) NULL, display_field nvarchar(128) NULL, place varchar(40), seq int, width int);
INSERT INTO @f VALUES
  ('仓库编码', N'仓库编码', N'参照', 'WH',  N'仓库编码', N'仓库名称', 'query,detail', 10, 130),
  ('仓库名称', N'仓库名称', N'文本', NULL,  NULL,       NULL,       'detail',       20, 160),
  ('存货编码', N'存货编码', N'参照', 'INV', N'存货编码', N'存货名称', 'query,detail', 30, 140),
  ('存货名称', N'存货名称', N'文本', NULL,  NULL,       NULL,       'detail',       40, 220),
  ('批号',     N'批号',     N'文本', NULL,  NULL,       NULL,       'detail',       50, 140),
  ('规格型号', N'规格型号', N'文本', NULL,  NULL,       NULL,       'detail',       60, 150),
  ('累计入库量', N'累计入库量', N'小数', NULL, NULL,     NULL,       'detail',       70, 110),
  ('累计出库量', N'累计出库量', N'小数', NULL, NULL,     NULL,       'detail',       80, 110),
  ('现存量',   N'现存量',     N'小数', NULL, NULL,       NULL,       'detail',       90, 110),
  ('更新时间', N'更新时间',   N'日期时间', NULL, NULL,    NULL,       'detail',      100, 150);

INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width,
                      editable, required, hidden, visible)
SELECT 'STOCK_DETAIL', f.col_name, f.label, f.data_type, f.ref_panel, f.ref_field, f.display_field, f.place, f.seq, f.width,
       0, 0, 0, 1
FROM @f f;
DECLARE @n int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_DETAIL');
PRINT N'[字段] STOCK_DETAIL 字段行 = ' + CAST(@n AS nvarchar(10)) + N'(应 10)';
GO

/* ═══ 自检 ═══ */
DECLARE @bad int = 0;
-- 视图必须有三键组合那么多行(= kucun 行数),且带 批号 列
DECLARE @vrows int = (SELECT COUNT(*) FROM dbo.v_stock_kucun);
DECLARE @krows int = (SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y');
IF @vrows <> @krows SET @bad = @bad + 1;
IF COL_LENGTH('dbo.v_stock_kucun', '批号') IS NULL SET @bad = @bad + 1;
-- 聚合不能丢量
IF (SELECT CAST(SUM(现存量) AS decimal(18,4)) FROM dbo.v_stock_kucun)
   <> (SELECT CAST(SUM(ISNULL(yl,0)) AS decimal(18,4)) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y') SET @bad = @bad + 1;
-- 字段 10 行、每个 col_name 都是视图真实列、批号在册
DECLARE @cnt int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_DETAIL');
IF @cnt <> 10 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'STOCK_DETAIL' AND col_name = N'批号') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'STOCK_DETAIL' AND col_name = N'存货名称') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = 'STOCK_DETAIL'
             AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.v_stock_kucun') AND c.name = f.col_name))
  SET @bad = @bad + 1;
-- 月结结转行必须仍是不带批号(第七轮口径),别被这次改动静默带跑
IF EXISTS (SELECT 1 FROM inh WHERE 单据类型 = N'月结结转' AND ISNULL(asp_cancel,'N') <> 'Y' AND 批号 IS NOT NULL)
  SET @bad = @bad + 1;

DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[自检] %s:v_stock_kucun %d 行(= kucun 三键行数 %d);字段 %d 行(应 10);不符项 %d 条',
          10, 1, @dbn, @vrows, @krows, @cnt, @bad);
IF @bad = 0
  RAISERROR(N'[OK] 库存明细已加回「批号」分类(仓库+存货+批号),名称字段保留', 10, 1);
ELSE
  RAISERROR(N'[FAIL] 加回批号自检未过(见上一行数字)', 16, 1);
GO
