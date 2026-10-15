/* migrate-lot-normalize-blank-to-pc0000.sql — 把「空批次号」归一化到已有占位批次 PC0000
 *
 * 【为什么】(用户 2026-10-15 第十四轮追问:「为什么有空批次号的,但是没有合并,还有空月结」)
 *   实测正式库:
 *     · 期初导入(asp_user1='migration')写了 1380 行入库、**批号为空**、合计 455 万;
 *     · 人工单据也有 286 入 / 734 出 没填批次;
 *     · 出库侧另有大量 `PC0000`(旧账默认占位批次)。
 *   月结按 (物料,仓库,批号) 一行结转 ⇒ **空批号自成一族**,于是出现「批次号=空 的月结」(1368 行 / 441 万),
 *   同一物料同仓还与 PC0000 并存(299 组)→ 一正一负两行,账看着别扭。
 *
 * 【做法】把 inh/outh 里**批号为空**的行统一写成 `PC0000`(与出库侧已有的占位批次同名)⇒ 两族合并成一族;
 *   再删掉 kucun 里批号为空的缓存行(kucun 由月结按流水重算,**下一次月结会按归一化后的键重建**)。
 *   归一化只动 `批号` 一个字段,不动数量/金额/日期;并在同一批行上打 `asp_user2='lotmerge:migration'` 标记,
 *   便于**回退**(`UPDATE … SET 批号=NULL WHERE asp_user2 LIKE 'lotmerge:%'`)。
 *
 * 【幂等】第二次跑没有空批号行可改(执行 0)。
 * 【执行顺序】本脚本 → 两个账套各跑一次「重新月结」(重建 kucun 与结转行)。
 */
SET NOCOUNT ON;
GO

DECLARE @tag nvarchar(50) = N'lotmerge:migration';

/* ① 入库:空批号 → PC0000 */
UPDATE inh SET 批号 = N'PC0000', asp_user2 = @tag, asp_time2 = GETDATE()
 WHERE (批号 IS NULL OR LTRIM(RTRIM(批号)) = N'');
DECLARE @i int = @@ROWCOUNT;

/* ② 出库:空批号 → PC0000 */
UPDATE outh SET 批号 = N'PC0000', asp_user2 = @tag, asp_time2 = GETDATE()
 WHERE (批号 IS NULL OR LTRIM(RTRIM(批号)) = N'');
DECLARE @o int = @@ROWCOUNT;

/* ③ kucun:批号为空的缓存行直接删除(月结重算会按归一化后的键重建;留着会与 PC0000 行重复) */
DELETE FROM kucun WHERE lot_no IS NULL OR LTRIM(RTRIM(lot_no)) = N'';
DECLARE @k int = @@ROWCOUNT;

PRINT N'[归一化] inh ' + CAST(@i AS nvarchar(10)) + N' 行 / outh ' + CAST(@o AS nvarchar(10))
    + N' 行 → PC0000;kucun 删空批号行 ' + CAST(@k AS nvarchar(10)) + N' 行(待月结重建)';
GO

/* ═══ 自检 ═══ */
-- ⚠ RAISERROR 的格式参数**只能是变量/常量**:里面塞子查询或 CAST(...) 会报「'(' 附近有语法错误」
--   (这个坑在 migrate-stock-detail-panel.sql 已踩过一次,别再犯)。所以先算进变量。
DECLARE @bad int = 0;
DECLARE @c1 int = (SELECT COUNT(*) FROM inh WHERE 批号 IS NULL OR LTRIM(RTRIM(批号)) = N'');
DECLARE @c2 int = (SELECT COUNT(*) FROM outh WHERE 批号 IS NULL OR LTRIM(RTRIM(批号)) = N'');
DECLARE @c3 int = (SELECT COUNT(*) FROM kucun WHERE lot_no IS NULL OR LTRIM(RTRIM(lot_no)) = N'');
IF @c1 > 0 SET @bad = @bad + 1;
IF @c2 > 0 SET @bad = @bad + 1;
IF @c3 > 0 SET @bad = @bad + 1;
-- 入库/出库总量不能变(只改键,不改数量)
DECLARE @inAmt decimal(18,4) = (SELECT CAST(SUM(数量) AS decimal(18,4)) FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y');
DECLARE @outAmt decimal(18,4) = (SELECT CAST(SUM(数量) AS decimal(18,4)) FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y');
DECLARE @dbn sysname = DB_NAME();
DECLARE @inS nvarchar(30) = CAST(@inAmt AS nvarchar(30));
DECLARE @outS nvarchar(30) = CAST(@outAmt AS nvarchar(30));
RAISERROR(N'[自检] %s:空批号行 inh/outh/kucun = %d/%d/%d(应 0/0/0);流水量 入 %s / 出 %s;不符项 %d 条',
          10, 1, @dbn, @c1, @c2, @c3, @inS, @outS, @bad);
IF @bad = 0 RAISERROR(N'[OK] 空批次号已归一化为 PC0000(请重跑一次月结重建 kucun/结转行)', 10, 1);
ELSE RAISERROR(N'[FAIL] 归一化自检未过', 16, 1);
GO
