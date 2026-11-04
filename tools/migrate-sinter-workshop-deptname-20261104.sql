/* ============================================================================
 * migrate-sinter-workshop-deptname-20261104.sql
 *
 * 目的(用户 2026-11-04 口径 A:「单据里存『1#车间』这类部门名称,模具表照旧存 1/2/3/4」)
 *
 *   烧结工艺清单(RD_MOLD_PROC)与成型配方(RD_MOLD_FORMULA)的「生产车间」参照部门档案时,
 *   ref_field 取的是 **部门编码**(D05)。而生产模具表 rd_sinter_tolerance.车间 存的是
 *   **裸车间号**(1 / 2 / 3 / 4,另有 1/3 表示两车间共用) ⇒ 两边永远对不上,
 *   选完车间筛不出任何型号(60 行模具数据一条都用不上)。
 *
 *   改成取 **部门名称**(1#车间 / 2#车间 …):
 *     · 与调度单 DISPATCH 既有做法一致(它本来就用 部门名称,是同一个面板字段口径);
 *     · 纸面显示的就是 "1#车间",比 D05 可读;
 *     · 前端按**车间号**归一再比(core/mold/workshopNo.js:`1#车间` ≡ `1`),
 *       所以模具表那 60 行标准库数据一个字都不用动。
 *
 *   ⚠ 存量数据:改动前 rd_mold_proc_head.生产车间 全为空(实测 11 行全空),无需数据迁移;
 *     若将来发现历史单据存了 D05 这类编码,前端按车间号归一取不到数字 ⇒ 筛不到型号(不会错配)。
 *
 *   幂等:重复执行命中 0 行。
 *   两个账套都要执行(先正式 HSDZ_MES,后测试 HSDZ_MES_TEST)。
 * ========================================================================= */
SET NOCOUNT ON;

UPDATE f
SET f.ref_field = N'部门名称',
    f.display_field = N'部门名称'
FROM yj_field f
WHERE f.label = N'生产车间'
  AND f.ref_panel = N'DEPT'
  AND f.panel_code IN (N'RD_MOLD_PROC', N'RD_MOLD_FORMULA')
  AND ISNULL(f.ref_field, N'') = N'部门编码';

PRINT N'[sinter-workshop] yj_field 更新: ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ── 自检:这两张面板的「生产车间」必须已指向 部门名称 ─────────────────── */
DECLARE @bad int = (
    SELECT COUNT(*) FROM yj_field
    WHERE label = N'生产车间' AND ref_panel = N'DEPT'
      AND panel_code IN (N'RD_MOLD_PROC', N'RD_MOLD_FORMULA')
      AND ISNULL(ref_field, N'') <> N'部门名称'
);
IF @bad <> 0
BEGIN
    RAISERROR(N'自检失败:仍有 %d 行「生产车间」不是按部门名称参照', 16, 1, @bad);
    RETURN;
END

PRINT N'[sinter-workshop] OK(生产车间 → 部门名称)';