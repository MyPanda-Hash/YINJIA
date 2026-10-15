/* migrate-lot-rename-to-batchno.sql — 把「批号」统一改叫「批次号」,并把出库单的批次号改为**不必填**
 *
 * 【用户口径 2026-10-15 第十七轮】
 *   「把所有出库单的批号字段都改成批次号。批次号不用必填。」
 *   (上一轮已说过「把所有的批号字段都改成批次号」⇒ 本脚本**全库统一**:凡是 label=批号 的字段一律改叫
 *    批次号;并把 批号/lot_no 这类字段的 required 清成 0。)
 *
 * 【只改 label,不动 col_name】物理列仍叫 `批号`/`lot_no` —— ADR-0001:数据键不随显示名变化;
 *   面板引擎按 label→col 映射取数,所以改 label 不影响取数,但**参照字段引用的是 label**:
 *   已核对 `yj_field.ref_field/display_field` 里**没有任何**指向 '批号' 的引用(0 行),故本次改名安全。
 *
 * 【required 清 0】**出库单**(MATERIAL_OUT / OTHER_OUT / SALE_OUT)三张是本次重点;
 *   顺带把其它面板的 批号/lot_no 也一并清 0(用户"批次号不用必填"的口径)。
 *
 * 幂等:改名只匹配 label=批号;required 只把 1 改成 0。两账套都执行(先正式后测试)。
 */
SET NOCOUNT ON;
GO

/* ═══ ① 改显示名:批号 → 批次号 ═══ */
UPDATE yj_field SET label = N'批次号' WHERE label = N'批号';
DECLARE @renamed int = @@ROWCOUNT;

/* ═══ ② 批次号不必填(出库单为重点,其余同族一并清) ═══ */
UPDATE yj_field SET required = 0
 WHERE required = 1 AND (label = N'批次号' OR col_name IN (N'批号', N'lot_no'));
DECLARE @req int = @@ROWCOUNT;

PRINT N'[改名] 批号 → 批次号 ' + CAST(@renamed AS nvarchar(10)) + N' 行;清必填 ' + CAST(@req AS nvarchar(10)) + N' 行';
GO

/* ═══ 自检 ═══ */
-- ⚠ RAISERROR 的参数只能是变量(别塞子查询/CAST 表达式 —— 这个坑踩过两次)
DECLARE @bad int = 0;
DECLARE @left int = (SELECT COUNT(*) FROM yj_field WHERE label = N'批号');
DECLARE @reqLeft int = (SELECT COUNT(*) FROM yj_field WHERE required = 1 AND col_name IN (N'批号', N'lot_no'));
DECLARE @outReq int = (SELECT COUNT(*) FROM yj_field
                        WHERE panel_code IN (N'MATERIAL_OUT', N'OTHER_OUT', N'SALE_OUT')
                          AND col_name IN (N'批号', N'lot_no') AND required = 1);
DECLARE @outCnt int = (SELECT COUNT(*) FROM yj_field
                        WHERE panel_code IN (N'MATERIAL_OUT', N'OTHER_OUT', N'SALE_OUT')
                          AND col_name IN (N'批号', N'lot_no') AND label = N'批次号');
IF @left > 0 SET @bad = @bad + 1;
IF @reqLeft > 0 SET @bad = @bad + 1;
IF @outReq > 0 SET @bad = @bad + 1;
IF @outCnt < 3 SET @bad = @bad + 1;    -- 三张出库单各自的批次号字段都应在册
DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[自检] %s:残留 label=批号 %d 行(应 0);批号/lot_no 仍必填 %d 行(应 0);出库三单必填 %d(应 0);出库三单批次号字段 %d 个(应 ≥3);不符项 %d 条',
          10, 1, @dbn, @left, @reqLeft, @outReq, @outCnt, @bad);
IF @bad = 0 RAISERROR(N'[OK] 「批号」已全库改叫「批次号」,出库单批次号不必填', 10, 1);
ELSE RAISERROR(N'[FAIL] 改名/必填自检未过', 16, 1);
GO
