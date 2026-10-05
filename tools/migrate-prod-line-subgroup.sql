/* migrate-prod-line-subgroup.sql(2026-10-05):产线补「产线分组」—— 还原《新系统产线命名.xlsx》的两级分类
 *
 * 用户指出:「成型当前不也分为烧结和 X烧结吗?」—— 对。文件 Sheet1 的结构是**两级**:
 *   第 1 级 = 工序/工艺(成型/切炭/组装),第 2 级 = 产线分组(仅成型有:烧结 / X烧结)。
 * 上一版 migrate-prod-line-function-group.sql 只落了第 1 级,把子组压平了 ⇒ 1~4号车间/自动线1~3(烧结)
 *   与 1号机~7号机(X烧结) 混在一个"成型"里,同工序内排队/看板无法区分。
 *
 * 本次补一列 `产线分组`(子组),取值来自文件 B 列:
 *   成型·烧结   = 1号车间 / 2号车间 / 3号车间 / 4号车间 / 自动线1 / 自动线2 / 自动线3
 *   成型·X烧结  = 1号机 / 2号机 / 3号机 / 4号机 / 5号机 / 6号机 / 7号机
 *   切炭、组装   = 文件未分子组 ⇒ 留 NULL(界面按"无子组"处理)
 *   ⚠ 文件未列的 8 条线(成型1~5线/切炭线/组装线/装箱线)同样留 NULL —— 推断项,不臆造子组归属。
 *
 * 幂等可重跑;两账套均执行。
 */

IF COL_LENGTH('bs_prod_line', N'产线分组') IS NULL ALTER TABLE bs_prod_line ADD [产线分组] nvarchar(50) NULL;
GO

/* 按文件名录回填(精确列名,不用前缀猜:子组是文件明确给出的,必须逐条对齐) */
UPDATE bs_prod_line SET 产线分组 = N'烧结'
 WHERE ISNULL(asp_cancel,'N')<>'Y'
   AND 生产线 IN (N'1号车间', N'2号车间', N'3号车间', N'4号车间', N'自动线1', N'自动线2', N'自动线3');
UPDATE bs_prod_line SET 产线分组 = N'X烧结'
 WHERE ISNULL(asp_cancel,'N')<>'Y'
   AND 生产线 IN (N'1号机', N'2号机', N'3号机', N'4号机', N'5号机', N'6号机', N'7号机');
GO

/* 中文注明 */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.bs_prod_line')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_prod_line'), N'产线分组', 'ColumnId')
                 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'产线分组(第 2 级分类):成型下分 烧结 / X烧结(依《新系统产线命名.xlsx》);切炭/组装未分子组,留空',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_prod_line', N'COLUMN', N'产线分组';
GO

/* 自检:成型里两类都有人(烧结 7 / X烧结 7),且分组值只能取自文件 */
DECLARE @s int = (SELECT COUNT(*) FROM bs_prod_line WHERE 产线分组 = N'烧结' AND ISNULL(asp_cancel,'N')<>'Y');
DECLARE @x int = (SELECT COUNT(*) FROM bs_prod_line WHERE 产线分组 = N'X烧结' AND ISNULL(asp_cancel,'N')<>'Y');
DECLARE @bad int = (SELECT COUNT(*) FROM bs_prod_line WHERE ISNULL(产线分组,N'') NOT IN (N'', N'烧结', N'X烧结'));
IF @s <> 7 OR @x <> 7 OR @bad > 0
  RAISERROR(N'产线分组回填异常(期望 烧结=7 / X烧结=7 且无越界值)', 16, 1);
ELSE PRINT N'产线分组就绪:成型 → 烧结 7 条 / X烧结 7 条(其余功能无子组)';
GO
