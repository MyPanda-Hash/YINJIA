/* =============================================================================
   migrate-mold-recipe-design-unit-20261111.sql
   -----------------------------------------------------------------------------
   用户口径(2026-11-11,研发管理优化 第 3 条):
     「① 物料1第一行无带出的设计添加量数据 ② 粉料段和胶粉导出的设计添加量没有百分比号单位
       (若为功能料-颗粒属性则单位为 g/支) ③ 设计添加量合计 = 非颗粒料比例(%)相加,颗粒料按 g/支」
     追问单位显示 → 「**纸面和导出件都带单位**」。

   本脚本只做**存量数据规整**,不动任何业务数值:
     把配方表那些行的 设计添加量 补上单位(粉料/胶粉 = %,功能料-颗粒 / 折算物料 = g/支),
     数字统一成 2 位小数:
       · 10   → 10.00%      (粉料)
       · 30.5 → 30.50%      (胶粉)
       · 3    → 3.00 g/支   (功能料-颗粒 / 折算物料)

   为什么不靠"下次重算":用户看的就是**已经存下来的单子**。代码侧的新口径
     (core/mold/recipeSheet.buildPatch → 落格带单位)只对"配方计算 → 填入单据"之后的新写入生效;
     存量单据不规整一遍,纸面上那些格子仍然是 `10`、`3`(用户报的正是这个)。
     规整后 parseRatio/parseNumber 都读得回来(core/mold/recipeSheet.js 的 stripUnit),重算不受影响。

   两张行表(实测,别写错 —— 写成一张会漏掉真正在用的那张):
     · rd_mold_proc_detail   ← **RD_MOLD_PROC(炭棒工艺管控清单)的行表**,配方表与修订记录共用,
                                靠 [表区] 列区分;
     · rd_mold_formula_detail← RD_MOLD_FORMULA 的行表(没有 [表区] 列,整张就是配方行)。

   ⚠ 三条边界(缺一条就会误伤):
     ① rd_mold_proc_detail 只碰 `表区 = 配方表` 的行 —— 修订记录的 设计添加量 是历史快照,不许改;
     ② 已经有单位的不重复加(`%` / `g/支` 两种都判);
     ③ 没有物料(编号与名称皆空)的行不碰 —— 那些是空白行,给它们写 `0.00%` 只会让空行看起来像有数据。

   物理列:两张表 设计添加量 都是 nvarchar(50)(实测),最长写入约 12 字符,不会截断。

   幂等:WHERE 里排除了已带单位的行 ⇒ 重复执行 0 行更新。
   执行:两个账套都要跑(先 HSDZ_MES,后 HSDZ_MES_TEST)。
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---------- ① RD_MOLD_PROC 行表:只规整「配方表」这个表区 ---------- */
DECLARE @n int;

UPDATE rd_mold_proc_detail
SET 设计添加量 =
        CASE WHEN ISNUMERIC(LTRIM(RTRIM(设计添加量))) = 1
             THEN CONVERT(nvarchar(30), CAST(LTRIM(RTRIM(设计添加量)) AS decimal(18, 2)))
             ELSE LTRIM(RTRIM(设计添加量)) END
      + CASE WHEN 物料种类 LIKE N'%颗粒%' OR 物料种类 LIKE N'%折算%'
             THEN N' g/支' ELSE N'%' END
WHERE 表区 = N'配方表'
  AND ISNULL(设计添加量, N'') <> N''
  AND 设计添加量 NOT LIKE N'%[%]%'          -- 已带百分号的跳过
  AND 设计添加量 NOT LIKE N'%g/支%'         -- 已带克/支的跳过
  AND (ISNULL(物料编号, N'') <> N'' OR ISNULL(物料名称, N'') <> N'');  -- 空白行不碰

SET @n = @@ROWCOUNT;
PRINT N'[OK] rd_mold_proc_detail(配方表) 设计添加量 补单位: ' + CAST(@n AS nvarchar(8)) + N' 行';
GO

/* ---------- ② RD_MOLD_FORMULA 行表(没有 [表区] 列,整张都是配方行) ---------- */
DECLARE @m int;

UPDATE rd_mold_formula_detail
SET 设计添加量 =
        CASE WHEN ISNUMERIC(LTRIM(RTRIM(设计添加量))) = 1
             THEN CONVERT(nvarchar(30), CAST(LTRIM(RTRIM(设计添加量)) AS decimal(18, 2)))
             ELSE LTRIM(RTRIM(设计添加量)) END
      + CASE WHEN 物料种类 LIKE N'%颗粒%' OR 物料种类 LIKE N'%折算%'
             THEN N' g/支' ELSE N'%' END
WHERE ISNULL(设计添加量, N'') <> N''
  AND 设计添加量 NOT LIKE N'%[%]%'
  AND 设计添加量 NOT LIKE N'%g/支%'
  AND (ISNULL(物料编号, N'') <> N'' OR ISNULL(物料名称, N'') <> N'');

SET @m = @@ROWCOUNT;
PRINT N'[OK] rd_mold_formula_detail 设计添加量 补单位: ' + CAST(@m AS nvarchar(8)) + N' 行';
GO

/* ---------- ③ 自证:配方表里不该再有"没单位的非空值" ---------- */
SELECT N'rd_mold_proc_detail' AS 表名,
       SUM(CASE WHEN ISNULL(设计添加量, N'') <> N'' THEN 1 ELSE 0 END) AS 有值行,
       SUM(CASE WHEN ISNULL(设计添加量, N'') <> N''
                 AND 设计添加量 NOT LIKE N'%[%]%' AND 设计添加量 NOT LIKE N'%g/支%'
                THEN 1 ELSE 0 END) AS 仍然没单位行
FROM rd_mold_proc_detail WHERE 表区 = N'配方表'
UNION ALL
SELECT N'rd_mold_formula_detail',
       SUM(CASE WHEN ISNULL(设计添加量, N'') <> N'' THEN 1 ELSE 0 END),
       SUM(CASE WHEN ISNULL(设计添加量, N'') <> N''
                 AND 设计添加量 NOT LIKE N'%[%]%' AND 设计添加量 NOT LIKE N'%g/支%'
                THEN 1 ELSE 0 END)
FROM rd_mold_formula_detail;
GO
