/* migrate-route-workshop-options-20261021.sql
 *
 * 工艺路线「生产车间」下拉改成**真实产线车间**,并补齐全空车间(2026-10-21 用户口径:
 * 「当前生产的工单对当前的生产排产只有对应的工序名称才能进入到对应的生产线,
 *   当前组装和装箱工序都是同样进入组装生产线才对」)。
 *
 * ── 问题(两处,互相加剧)────────────────────────────────────────────────
 * ① ROUTE 面板的 生产车间 字段 dict_sql 写死成 熔铸车间 / 轧制车间 / 精整车间 / 测试车间
 *    —— 那是另一套(钢铁类)的历史值;炭棒产线档案里的车间只有 成型 / 切炭 / 组装。
 *    用户在工艺路线里给「成型 → 装箱」这类路线根本**选不到**车间,只能留空
 *    (实测 GY-2026-10-0001 两条明细的 生产车间 全为空,见 2026-10-20 王光珍 新增的装箱行)。
 * ② 生产车间 一旦为空,排产时"这道工序该进哪类产线"就没有任何判据 ⇒ 排线弹窗把**全部产线**
 *    摆出来,装箱被排到了成型线(实测 GD-2026-10-0202 行6:装箱 → 2号车间/成型)。
 *
 * ── 本脚本做什么 ───────────────────────────────────────────────────────
 * ① dict_sql 改为**产线档案里真实存在的车间 ∪ 路线里已存在的历史车间值**
 *    (遗留的熔铸/轧制/精整/测试路线照旧可维护,不会被新下拉锁死;产线档案改车间后下拉自动跟随);
 * ② 把**已有路线**里空着、而工序名可判归属的 生产车间 补齐:
 *    成型→成型 · 切炭→切炭 · 组装→组装 · **装箱→组装**(与后端 ProcessShop 同一份口径)。
 *    只填空值,不动任何已填的车间;不动业务单据、不动字段顺序/可见性/权限。
 *
 * 幂等:①按 panel+col_name 定位、值不同才写;②只命中 ISNULL(车间,'')='' 的行。
 * 两账套都执行(先正式 HSDZ_MES、后 HSDZ_MES_TEST)。
 */

-- ① 工艺路线「生产车间」下拉:真实车间 ∪ 历史车间值(去重、有序)
DECLARE @shopDict NVARCHAR(MAX) = N'SELECT v FROM ('
    + N' SELECT DISTINCT 生产车间 AS v FROM dbo.bs_prod_line'
    + N'  WHERE ISNULL(asp_cancel,N''N'') <> N''Y'' AND ISNULL(生产车间,N'''') <> N'''''
    + N' UNION'
    + N' SELECT DISTINCT 生产车间 FROM dbo.bs_route'
    + N'  WHERE ISNULL(asp_cancel,N''N'') <> N''Y'' AND ISNULL(生产车间,N'''') <> N'''''
    + N') t ORDER BY v';

UPDATE yj_field
   SET dict_sql = @shopDict
 WHERE panel_code = 'ROUTE'
   AND col_name = N'生产车间'
   AND (dict_sql IS NULL OR dict_sql <> @shopDict);

PRINT N'工艺路线 生产车间 下拉 = ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' 行更新(0=已是新口径)';

-- ② 补齐已有路线的空车间(只填空白、只认可判定的四道工序)
UPDATE r
   SET 生产车间 = CASE r.工序名称
                      WHEN N'装箱' THEN N'组装'
                      WHEN N'组装' THEN N'组装'
                      WHEN N'成型' THEN N'成型'
                      WHEN N'切炭' THEN N'切炭'
                  END,
       asp_user2 = N'migrate-route-workshop-options-20261021',
       asp_time2 = SYSDATETIME()
  FROM dbo.bs_route r
 WHERE ISNULL(r.asp_cancel, 'N') <> 'Y'
   AND ISNULL(r.生产车间, N'') = N''
   AND r.工序名称 IN (N'装箱', N'组装', N'成型', N'切炭');

PRINT N'路线空车间补齐 = ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' 行(0=无待补)';

-- 自检:此后不应再有「已知工序 + 空车间」的路线
DECLARE @blank INT = (SELECT COUNT(*) FROM dbo.bs_route
                       WHERE ISNULL(asp_cancel, 'N') <> 'Y' AND ISNULL(生产车间, N'') = N''
                         AND 工序名称 IN (N'装箱', N'组装', N'成型', N'切炭'));
PRINT N'自检:已知工序仍空车间 = ' + CAST(@blank AS NVARCHAR(10)) + N' 行(必须为 0)';

PRINT N'migrate-route-workshop-options-20261021 就绪(幂等)';
