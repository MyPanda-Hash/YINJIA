/* migrate-stock-detail-group-by-wh-item.sql — 库存明细改为**按(仓库编码, 存货编码)归类**,并补名称字段
 *
 * 【用户口径 2026-10-15 第四轮】
 *   「那就先只按仓库编码和存货编码分类,还有仓库名称,存货名称字段不能少」
 *   即:不再按 `kucun` 的三键(物料,仓库,批号)一行一行铺,而是**把批号合并掉**,
 *   一行 = 一个 (仓库编码, 存货编码),并带上 `仓库名称` / `存货名称`(从 bs_wh / bs_inv 取)。
 *
 * 【为什么必须加视图】
 *   面板 flat 取数是 `SELECT t.<col> FROM <line_table> t WHERE …`(见 QueryService.queryFlat),
 *   **不能带 GROUP BY**;要"合并批号 + join 档案出名称"只有两条路:改引擎加聚合模式,或加一层视图。
 *   兄弟报表(库存状况表/台账/收发存汇总)走的都是视图路线 ⇒ 本面板也改成
 *   `line_table = dbo.v_stock_kucun`(与它们同款,含 `id` = ROW_NUMBER、`asp_cancel` = 常量 'N')。
 *   ⚠ 这**不是**放弃 kucun:视图的数据源就是 kucun,聚合与取名都在这层完成。
 *
 * 【字段(9 列)】仓库编码 · 仓库名称 · 存货编码 · 存货名称 · 规格型号 · 累计入库量 · 累计出库量 · 现存量 · 更新时间
 *   查询区 = 仓库编码 / 存货编码(都声明为**参照** ⇒ 弹窗按名称挑、过滤按编码精确等值;
 *   左栏「分仓库」多选走 condition._whCodes,后端按 仓库编码 IN 过滤)。
 *
 * 幂等:视图 CREATE OR ALTER;字段行先删后插(该面板的登记由本脚本接管);授权不动。两账套都执行。
 */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ═══ ① 聚合视图:一行 = 一个 (仓库编码, 存货编码) ═══ */
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
  -- 仓库/存货名称:bs_wh 有同名重复行 ⇒ 一律 OUTER APPLY TOP 1(与库存三报表同款,避免行翻倍)
  OUTER APPLY (SELECT TOP 1 x.仓库名称 FROM dbo.bs_wh x WHERE x.仓库编码 = k.ckdm ORDER BY x.id) w
  OUTER APPLY (SELECT TOP 1 x.存货名称, x.规格型号 FROM dbo.bs_inv x WHERE x.存货编码 = k.wzdm) i
  WHERE ISNULL(k.asp_cancel, 'N') <> 'Y'
  GROUP BY k.ckdm, k.wzdm, w.仓库名称, i.存货名称, i.规格型号
) m;
GO

/* ═══ ② 面板指向视图 ═══ */
UPDATE yj_panel SET line_table = 'v_stock_kucun', date_col = '更新时间', pk_col = 'id'
 WHERE panel_code = 'STOCK_DETAIL';
PRINT N'[面板] STOCK_DETAIL → v_stock_kucun(按仓库+存货归类)';
GO

/* ═══ ③ 字段重登记(9 列;先删后插,该面板登记由本脚本接管) ═══ */
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
PRINT N'[字段] STOCK_DETAIL 字段行 = ' + CAST(@n AS nvarchar(10)) + N'(应 9)';
GO

/* ═══ ④ 译名(新标签;已有全局译名的自动跳过) ═══ */
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', v.k, v.loc, v.txt, 'manual'
FROM (VALUES
  (N'仓库名称', 'en', N'Warehouse Name'), (N'仓库名称', 'ja', N'倉庫名'), (N'仓库名称', 'ko', N'창고명'),
  (N'仓库名称', 'zh-TW', N'倉庫名稱'), (N'仓库名称', 'es', N'Nombre del almacén'), (N'仓库名称', 'fr', N'Nom de l’entrepôt'),
  (N'仓库名称', 'de', N'Lagername'), (N'仓库名称', 'ru', N'Название склада'), (N'仓库名称', 'vi', N'Tên kho'), (N'仓库名称', 'th', N'ชื่อคลังสินค้า'),
  (N'存货名称', 'en', N'Item Name'), (N'存货名称', 'ja', N'品目名'), (N'存货名称', 'ko', N'품목명'),
  (N'存货名称', 'zh-TW', N'存貨名稱'), (N'存货名称', 'es', N'Nombre del artículo'), (N'存货名称', 'fr', N'Nom de l’article'),
  (N'存货名称', 'de', N'Artikelname'), (N'存货名称', 'ru', N'Наименование номенклатуры'), (N'存货名称', 'vi', N'Tên hàng'), (N'存货名称', 'th', N'ชื่อสินค้า')
) AS v(k, loc, txt)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope = 'field' AND t.ref_key = v.k AND t.locale = v.loc);
PRINT N'[译名] 仓库名称/存货名称 已补齐(已有语言跳过)';
GO

/* ═══ 自检 ═══ */
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.v_stock_kucun', N'V') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'STOCK_DETAIL' AND line_table = 'v_stock_kucun'
                 AND date_col = N'更新时间' AND pk_col = 'id') SET @bad = @bad + 1;
-- 字段 9 行,且每个 col_name 都是视图的真实列(否则取数直接报「列名无效」)
DECLARE @cnt int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_DETAIL');
IF @cnt <> 9 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = 'STOCK_DETAIL'
             AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.v_stock_kucun') AND c.name = f.col_name))
  SET @bad = @bad + 1;
-- 用户点名要的两个名称字段必须在
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'STOCK_DETAIL' AND col_name = N'仓库名称') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'STOCK_DETAIL' AND col_name = N'存货名称') SET @bad = @bad + 1;
-- 视图行数应 = (物料,仓库) 两键组合数(聚合生效)
DECLARE @vrows int = (SELECT COUNT(*) FROM dbo.v_stock_kucun);
DECLARE @krows int = (SELECT COUNT(*) FROM (SELECT wzdm, ckdm FROM kucun GROUP BY wzdm, ckdm) t);
IF @vrows <> @krows SET @bad = @bad + 1;
-- 现存量合计必须与 kucun 一致(聚合不能丢量)
IF (SELECT CAST(SUM(现存量) AS decimal(18,4)) FROM dbo.v_stock_kucun)
   <> (SELECT CAST(SUM(ISNULL(yl,0)) AS decimal(18,4)) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y') SET @bad = @bad + 1;

DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[自检] %s:v_stock_kucun %d 行(= (物料,仓库) 组合 %d);字段 %d 行(应 9);不符项 %d 条',
          10, 1, @dbn, @vrows, @krows, @cnt, @bad);
IF @bad = 0
  RAISERROR(N'[OK] 库存明细已按(仓库编码,存货编码)归类,并带上 仓库名称/存货名称', 10, 1);
ELSE
  RAISERROR(N'[FAIL] 归类改造自检未过(见上一行数字)', 16, 1);
GO
