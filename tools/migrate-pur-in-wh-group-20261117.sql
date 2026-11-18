/* ============================================================================
 * migrate-pur-in-wh-group-20261117.sql
 *   采购入库单「多仓库入库」:明细行补一个「源行id」标记(幂等 / 两账套 / 带中文注明)
 *
 * 【为什么需要这一列(2026-11-17 用户口径)】
 *   「这个操作是要可以回退的,而且从那一行分出来的,进去的时候缩进还在。」
 *   多仓库入库是把**一行拆成多行**;要让用户再打开弹窗时看到"这几行是从哪一行分出来的"
 *   (缩进),并且能**合并回一行**(回退),就必须把"同组"关系落到库里。
 *   靠 (存货编码, 批次号, 批号, 源单行号) 猜是不行的:同一批货本来就可能有多行
 *   (例如同批次分两次检验/两次入库),猜错会把本该独立的两行合成一行。
 *
 * 【列定义】
 *   bl_purchase_in.[源行id] int NULL —— 拆分组的锚点:组内所有行(含原行自己)都写**原始行 id**;
 *   没拆过的行保持 NULL。原行 id == 源行id 的那一行就是"父行",其余是它的子行。
 *
 * 【存量数据】
 *   不做猜测性回填 —— 加列之前已经拆过的行(仅测试账套有)保持 NULL,按"独立行"对待,
 *   用户重新拆一次即会写入正确的组标记。正式库(HSDZ_MES)此前没有拆过任何行。
 *
 * 【幂等】COL_LENGTH 守卫;列已存在即跳过。带列级 MS_Description(数据库规范硬要求)。
 * 【执行】两账套各跑一遍(先 HSDZ_MES,后 HSDZ_MES_TEST),放到「执行 0、失败 0」。
 * ============================================================================ */
SET NOCOUNT ON;
GO

IF COL_LENGTH('dbo.bl_purchase_in', N'源行id') IS NULL
BEGIN
  ALTER TABLE dbo.bl_purchase_in ADD [源行id] int NULL;
  PRINT N'[新增] bl_purchase_in.源行id';
END
ELSE
  PRINT N'[跳过] bl_purchase_in.源行id 已存在';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('dbo.bl_purchase_in')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bl_purchase_in'), N'源行id', 'ColumnId')
                  AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'多仓库入库的拆分组锚点:组内所有行(含原行)都记原始行 id,原行 id=源行id 的那行是父行;空=没拆过(2026-11-17)',
       N'SCHEMA', N'dbo', N'TABLE', N'bl_purchase_in', N'COLUMN', N'源行id';

-- 自检:列必须在
IF COL_LENGTH('dbo.bl_purchase_in', N'源行id') IS NULL
  RAISERROR(N'[自检失败] bl_purchase_in.源行id 未建成功', 16, 1);
ELSE
  PRINT N'[自检] bl_purchase_in.源行id OK';
GO
