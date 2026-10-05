/* migrate-plang-split-cols.sql(2026-10-05):工单切单(9.29 生产管理批次 ①)——plang 补父子关联三列
 *
 * 口径来源(会议):「选中在产工单 → 切单 → 输入切出数量 → 生成子工单(复制原单产品/工艺/交期),
 *   原单数量同步核减;子工单可再打印、进入正常报工流转」。
 *
 * 列口径沿用 bd_manu_order 既有拆单写法(tools/migrate-manu-order-schedule.sql:28-30、61-62):
 *   源工单号 空 = 原始工单;子工单填 源工单号=父单号 + 拆分序号=父单第几拆(从 1 起)。
 * 增补 源工单行id:plang 的主键 id 才是行身份(同一 pl_no 可有多行=多批次/多订单行),
 *   撤回切单要精确还原到**父行**(tools/... 注释:同天多行同批次号,(pl_no,pl_xc,批次号) 不再唯一),
 *   故用 id 精确指向,不用 (pl_no+行号+批次) 拼钥匙。
 *
 * 实现:WorkOrderSplitService(split / unsplit);子单取**新工单号**——报工工序封顶按
 *   SUM(pl_sl) WHERE pl_no 计算,同号无法「两单分别报工」(验收第 1 条)。
 * 幂等可重跑;两账套均执行。
 */

IF COL_LENGTH('plang', N'源工单号') IS NULL ALTER TABLE plang ADD [源工单号] nvarchar(50) NULL;
IF COL_LENGTH('plang', N'源工单行id') IS NULL ALTER TABLE plang ADD [源工单行id] bigint NULL;
IF COL_LENGTH('plang', N'拆分序号') IS NULL ALTER TABLE plang ADD [拆分序号] int NULL;
GO

/* ============ 新增列中文注明(全量部署规范:新增列必须带 MS_Description) ============ */
DECLARE @cols TABLE (tbl sysname, col sysname, cmt nvarchar(300));
INSERT INTO @cols VALUES
 (N'plang', N'源工单号', N'切单源工单号(空=原始工单;9.29 批次①工单切单,父子关联)'),
 (N'plang', N'源工单行id', N'切单源工单行id(=父行 plang.id;撤回切单按此精确还原)'),
 (N'plang', N'拆分序号', N'切单序号(源工单的第几拆,从 1 起;空=原始工单)');
DECLARE @t sysname, @c sysname, @m nvarchar(300);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, cmt FROM @cols;
OPEN cur FETCH NEXT FROM cur INTO @t, @c, @m;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                 WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(@t), @c, 'ColumnId')
                   AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @m, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @t, @c, @m;
END
CLOSE cur DEALLOCATE cur;
GO

/* ============ 自检(失败即整个脚本判失败,DbSync 不写登记,修复后重跑) ============ */
IF COL_LENGTH('plang', N'源工单号') IS NULL
   OR COL_LENGTH('plang', N'源工单行id') IS NULL
   OR COL_LENGTH('plang', N'拆分序号') IS NULL
  RAISERROR(N'plang 切单三列缺失', 16, 1);
ELSE PRINT N'plang 切单三列就绪(源工单号/源工单行id/拆分序号)';
GO
