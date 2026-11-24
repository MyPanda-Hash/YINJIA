/* ============================================================================
 * migrate-drop-inv-process-inspection-20261124.sql
 *   删除商品档案「是否过程检验」开关(列 + 面板字段 + 字段译名)
 *
 * 【用户口径(2026-11-24)】
 *   「需要自动出单……需要实现当前产品编码存在对应的出货检验计划就出什么单:存在 1PCS 就出功能,
 *    存在 1% 出表观,而不是在商品中选择对这个商品选择是或否。」
 *   「直接删除掉这个列吧,否则影响后续的系统判断。」
 *   ⇒ 判据改到《出货检验计划》/《成型工艺清单》按产品编码判(代码:ProcessInspPlanGate,
 *     调用方 QcInspAutoService 自动出单 + ButtonService 产成品入库门禁),本列整列下线。
 *
 * 【本脚本(幂等、两账套可重复执行)】
 *   §0 前置:列/字段/译名三处现状只读打印;
 *   §1 删 yj_field(INV / label=是否过程检验);
 *   §2 删 yj_translation(scope='field', ref_key=是否过程检验);
 *   §3 删 bs_inv 上的默认约束(若有)后 DROP COLUMN 是否过程检验;
 *   §4 自检:列不存在、yj_field 0 行、译名 0 行。
 *
 * ⚠ 本脚本**只删这一个开关**,不动 bs_inv 其它列(含历史字段「是否检验」bit 与来料检验文本);
 *   不动任何检验单/入库单数据。改判据已在代码里,回滚 = 重新执行 2026-11-14 的建列脚本 + 还原代码。
 * ============================================================================ */

/* ---------- §0 现状 ---------- */
IF COL_LENGTH(N'dbo.bs_inv', N'是否过程检验') IS NULL
    PRINT N'  [SKIP] bs_inv.是否过程检验 已不存在';
ELSE
    PRINT N'  [INFO] bs_inv.是否过程检验 存在,准备删除';
DECLARE @f int = (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = N'INV' AND label = N'是否过程检验');
DECLARE @t int = (SELECT COUNT(*) FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = N'是否过程检验');
PRINT N'  [INFO] yj_field(INV/是否过程检验) 行数 = ' + CAST(@f AS nvarchar(10));
PRINT N'  [INFO] yj_translation(field/是否过程检验) 行数 = ' + CAST(@t AS nvarchar(10));
GO

/* ---------- §1 面板字段 ---------- */
DELETE FROM dbo.yj_field WHERE panel_code = N'INV' AND label = N'是否过程检验';
PRINT N'  [DEL] yj_field INV/是否过程检验 × ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- §2 字段译名 ---------- */
DELETE FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = N'是否过程检验';
PRINT N'  [DEL] yj_translation field/是否过程检验 × ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- §3 删列(先摘默认约束) ---------- */
IF COL_LENGTH(N'dbo.bs_inv', N'是否过程检验') IS NOT NULL
BEGIN
    DECLARE @df sysname;
    SELECT @df = dc.name
      FROM sys.default_constraints dc
      JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
     WHERE dc.parent_object_id = OBJECT_ID(N'dbo.bs_inv') AND c.name = N'是否过程检验';
    IF @df IS NOT NULL
    BEGIN
        EXEC(N'ALTER TABLE dbo.bs_inv DROP CONSTRAINT [' + @df + N']');
        PRINT N'  [DROP] 默认约束 ' + @df;
    END
    ALTER TABLE dbo.bs_inv DROP COLUMN [是否过程检验];
    PRINT N'  [DROP] 列 bs_inv.是否过程检验';
END
ELSE PRINT N'  [SKIP] 列已不存在';
GO

/* ---------- §4 自检 ---------- */
IF COL_LENGTH(N'dbo.bs_inv', N'是否过程检验') IS NOT NULL
    RAISERROR(N'[FAIL] bs_inv.是否过程检验 仍在', 16, 1);
IF EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'INV' AND label = N'是否过程检验')
    RAISERROR(N'[FAIL] yj_field 仍有 INV/是否过程检验', 16, 1);
IF EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = N'是否过程检验')
    RAISERROR(N'[FAIL] yj_translation 仍有 field/是否过程检验', 16, 1);
PRINT N'[PASS] 自检通过:bs_inv.是否过程检验 已删除 + yj_field/译名清零';
GO
