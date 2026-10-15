/* migrate-stock-detail-drop-price.sql — 库存明细面板摘掉「结存单价」列(用户 2026-10-15 口径)
 *
 * 用户原话:「还有不用显示结存单价。」
 * 口径依据(实测):`kucun.price` 只有 277/2281 行有值(应用入库时带的单据单价),期初导入那 2004 行全空
 *   ⇒ 这一列在界面上绝大多数是空白,列在那儿反而误导(见 docs/development/库存表清单.md §1.2)。
 *
 * 做法:删掉 `yj_field` 里 STOCK_DETAIL.price 那一行(只动面板登记,**不动 kucun 的物理列**)。
 *   · 面板脚本 `migrate-stock-detail-panel.sql` 同批改为**不再注册这一列**(避免它日后重跑又把它建回来);
 *   · 本脚本负责把**已经建过**的库摘掉(幂等:没有该行就是 no-op)。
 *   · 译名(`yj_translation` 里 field/结存单价 那 10 条)**保留**:标签是全局共享的,别的面板将来仍可能用到,
 *     删了反而要重灌。
 *
 * 幂等;两账套都执行(先正式后测试)。
 */
SET NOCOUNT ON;
GO

DECLARE @n int;
SELECT @n = COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_DETAIL' AND col_name = N'price';
IF @n > 0
BEGIN
  DELETE FROM yj_field WHERE panel_code = 'STOCK_DETAIL' AND col_name = N'price';
  PRINT N'[OK] 已摘掉 STOCK_DETAIL.结存单价(' + CAST(@n AS nvarchar(10)) + N' 行)';
END
ELSE PRINT N'[SKIP] STOCK_DETAIL 本来就没有 结存单价 列';
GO

/* ═══ 自检 ═══ */
DECLARE @bad int = 0;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'STOCK_DETAIL' AND col_name = N'price') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_DETAIL') <> 7 SET @bad = @bad + 1;
-- 其余六列必须还在(别把该留的删了)
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_DETAIL'
      AND col_name IN (N'wzdm', N'ckdm', N'lot_no', N'rkl', N'ckl', N'yl', N'update_date')) <> 7 SET @bad = @bad + 1;

DECLARE @dbn sysname = DB_NAME();
DECLARE @cnt int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_DETAIL');
RAISERROR(N'[自检] %s:STOCK_DETAIL 字段 %d 行(应 7,不含 结存单价);不符项 %d 条', 10, 1, @dbn, @cnt, @bad);
IF @bad = 0
  RAISERROR(N'[OK] 库存明细已按用户口径摘掉「结存单价」列', 10, 1);
ELSE
  RAISERROR(N'[FAIL] 摘列自检未过(见上一行数字)', 16, 1);
GO
