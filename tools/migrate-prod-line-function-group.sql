/* migrate-prod-line-function-group.sql(2026-10-05):产线按《新系统产线命名.xlsx》归功能分类
 *
 * 依据(用户提供文件:C:\...\2026-09\新系统产线命名.xlsx,Sheet1「新系统产线命名」,
 *   表头=「工序/工艺 | 生产线」,A 列合并分组):
 *     成型(烧结):  1号车间 / 2号车间 / 3号车间 / 4号车间 / 自动线1 / 自动线2 / 自动线3
 *     成型(X烧结): 1号机 ~ 7号机
 *     切炭:        切炭1(老厂) / 切炭2(自动) / 切炭3(新厂) / 切炭4(X)
 *     组装:        组装1(老厂) / 组装2(新厂) / 装箱1(老厂) / 装箱2(新厂)   ← 装箱归「组装」功能
 *   用户明确:「文件内为功能分类而不是车间分类」⇒ 分组维度 = **工序/工艺(功能)**,只三个值:成型/切炭/组装。
 *
 * 处置:把产线档案的「生产车间」对齐为文件的功能分类(该列是系统既有的**唯一分组维度**:
 *   排产按车间过滤(③)、调拨的"目标线∈目标车间"校验(②)、当前工序显示(B)都读它;
 *   不另起一个平行维度,避免两套分组打架)。
 *
 * 归并规则(可审计、幂等):
 *   · 生产线 LIKE 成型% / %机 / %号车间 / 自动线%      → 成型
 *   · 生产线 LIKE 切炭%                                  → 切炭
 *   · 生产线 LIKE 组装% / 装箱%                          → 组装
 *   ⚠ 文件只列了 22 条线;DB 另有 8 条线未列入文件(成型1~5线 / 切炭线 / 组装线 / 装箱线),
 *     按**同名功能**归入对应功能(成型1~5线→成型、切炭线→切炭、组装线+装箱线→组装)——
 *     这是本迁移唯一的推断项,已在交付说明中标注,可一条 UPDATE 回退。
 *
 * 幂等可重跑;两账套均执行。
 */

PRINT N'── 归并前:产线功能分布 ──';
SELECT ISNULL(生产车间, N'(空)') AS 生产车间, COUNT(*) AS 产线数 FROM bs_prod_line
 WHERE ISNULL(asp_cancel, 'N') <> 'Y' GROUP BY 生产车间 ORDER BY 产线数 DESC;

UPDATE bs_prod_line
   SET 生产车间 = CASE
         WHEN 生产线 LIKE N'成型%' OR 生产线 LIKE N'%机' OR 生产线 LIKE N'%号车间' OR 生产线 LIKE N'自动线%' THEN N'成型'
         WHEN 生产线 LIKE N'切炭%' THEN N'切炭'
         WHEN 生产线 LIKE N'组装%' OR 生产线 LIKE N'装箱%' THEN N'组装'
         ELSE 生产车间
       END,
       asp_user2 = N'migrate-prod-line-function-group',
       asp_time2 = GETDATE()
 WHERE ISNULL(asp_cancel, 'N') <> 'Y';
GO

PRINT N'── 归并后:产线功能分布(应只剩 成型/切炭/组装)──';
SELECT ISNULL(生产车间, N'(空)') AS 工序工艺, COUNT(*) AS 产线数 FROM bs_prod_line
 WHERE ISNULL(asp_cancel, 'N') <> 'Y' GROUP BY 生产车间 ORDER BY 产线数 DESC;
GO

/* 中文注明对齐(说明该列存的是**功能分类**,来源=《新系统产线命名.xlsx》) */
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(N'dbo.bs_prod_line')
             AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_prod_line'), N'生产车间', 'ColumnId')
             AND ep.name = N'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'工序/工艺(功能分类):成型/切炭/组装 —— 按《新系统产线命名.xlsx》归并(装箱归组装);排产过滤/调拨校验/当前工序均读此列',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_prod_line', N'COLUMN', N'生产车间';
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'工序/工艺(功能分类):成型/切炭/组装 —— 按《新系统产线命名.xlsx》归并(装箱归组装);排产过滤/调拨校验/当前工序均读此列',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_prod_line', N'COLUMN', N'生产车间';
GO

/* 自检:① 取值只剩三个功能 ② 无空值 ③ 产线总数没变(30 条,只改属性不增删) */
DECLARE @bad int = 0, @cnt int, @badcnt int;
SELECT @cnt = COUNT(*) FROM bs_prod_line WHERE ISNULL(asp_cancel,'N') <> 'Y';
SELECT @badcnt = COUNT(*) FROM bs_prod_line
 WHERE ISNULL(asp_cancel,'N') <> 'Y'
   AND ISNULL(生产车间, N'') NOT IN (N'成型', N'切炭', N'组装');
IF @badcnt > 0 SET @bad = @bad + 1;
IF @cnt <> 30 SET @bad = @bad + 1;
IF @bad > 0
  RAISERROR(N'产线功能归并自检失败(存在非 成型/切炭/组装 的取值,或产线总数不为 30)', 16, 1);
ELSE PRINT N'产线功能分类就绪:30 条线 → 成型/切炭/组装 三类';
GO
