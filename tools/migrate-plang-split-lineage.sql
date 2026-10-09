/* migrate-plang-split-lineage.sql(2026-10-05):切单血缘补全 —— 根工单号 / 是否切单 / 切单操作日志
 *
 * 依据(两会议一致口径,见本批交付说明):切单 = 把一张在产工单的**部分数量**拆出,生成一张新工单
 *   (复制原单产品/工艺/配料基准),两单并行往下流转;拆分维度=**数量不是工序**;子单可再切(多级),
 *   聚合一律**按根单**;现场要一眼看出同源 ⇒ 子单号 = 原工单号-序号。
 *
 * 已在 ① 落地的部分(tools/migrate-plang-split-cols.sql):源工单号(=父单号)/源工单行id(=父行 plang.id)/
 *   拆分序号。本次补:
 *   · 根工单号 —— 多级切分时的聚合锚(顶级单=空;子单=父单的根,父单无根则父自身单号);
 *   · 是否切单 —— Y=由切单产生(排产/报表可一眼区分原单与子单);
 *   · wo_split_log —— 切单操作日志:谁、何时、从哪张单、切出多少、生成哪张子单、是否已撤回
 *     (现有 yj_usage_log 只有动作痕迹,拿不到「从哪单切出多少」的历史账)。
 *
 * ⚠ 命名按项目硬规范用**中文列名**(ADR-0001:数据键永远中文,字典只翻显示)——方案里的
 *   parent_wo_id/root_wo_id/wo_seq/split_flag 对应到 源工单号/根工单号/拆分序号/是否切单。
 * 幂等可重跑;两账套均执行。
 */

IF COL_LENGTH('plang', N'根工单号') IS NULL ALTER TABLE plang ADD [根工单号] nvarchar(50) NULL;
IF COL_LENGTH('plang', N'是否切单') IS NULL ALTER TABLE plang ADD [是否切单] nvarchar(1) NULL;
GO

/* 存量子单(① 已切出的)补根:父单无根则取父自身单号 */
UPDATE c SET c.[根工单号] = ISNULL(p.[根工单号], p.pl_no), c.[是否切单] = N'Y'
  FROM plang c JOIN plang p ON p.id = c.[源工单行id]
 WHERE ISNULL(c.[源工单行id], 0) <> 0 AND ISNULL(c.[根工单号], N'') = N'';
GO

/* 切单操作日志:一行一次操作(切单/撤回切单),供追溯与对账 */
IF OBJECT_ID('dbo.wo_split_log') IS NULL
CREATE TABLE dbo.wo_split_log (
  id          bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_wo_split_log PRIMARY KEY,
  操作类型    nvarchar(20)  NOT NULL,        -- 切单 / 撤回切单
  父工单号    nvarchar(50)  NULL,
  父工单行id  bigint        NULL,
  子工单号    nvarchar(50)  NULL,
  根工单号    nvarchar(50)  NULL,
  切单序号    int           NULL,
  切出数量    decimal(18,4) NULL,
  父单剩余量  decimal(18,4) NULL,
  子单交期    date          NULL,
  原因备注    nvarchar(200) NULL,
  asp_user1   nvarchar(50)  NULL,            -- 操作人
  asp_time1   datetime2     NULL CONSTRAINT df_wo_split_log_t1 DEFAULT (getdate()),
  asp_user2   nvarchar(50)  NULL,            -- 撤回人(撤回行=本人)
  asp_time2   datetime2     NULL,
  asp_cancel  nvarchar(1)   NULL CONSTRAINT df_wo_split_log_cancel DEFAULT (N'N')
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_wo_split_log_parent' AND object_id = OBJECT_ID(N'dbo.wo_split_log'))
  CREATE INDEX ix_wo_split_log_parent ON dbo.wo_split_log (父工单号, 子工单号);
GO

/* 中文注明(全量部署规范) */
DECLARE @tbl sysname = N'plang';
DECLARE @cols TABLE (col sysname, cmt nvarchar(300));
INSERT INTO @cols VALUES
 (N'根工单号', N'切单血缘根(多级切分时聚合用;顶级原单为空)'),
 (N'是否切单', N'是否由切单产生 Y/N(Y=子工单)');
DECLARE @c sysname, @m nvarchar(300);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, cmt FROM @cols;
OPEN cur FETCH NEXT FROM cur INTO @c, @m;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                 WHERE ep.major_id = OBJECT_ID(N'dbo.' + @tbl) AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tbl), @c, 'ColumnId')
                   AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @m, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @c, @m;
END
CLOSE cur DEALLOCATE cur;
GO

DECLARE @t2 sysname = N'wo_split_log', @c2 sysname, @m2 nvarchar(300);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.wo_split_log') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'切单操作日志(一行一次:切单/撤回切单;来源单·数量·子单·操作人)',
       N'SCHEMA', N'dbo', N'TABLE', @t2;
DECLARE @c2s TABLE (col sysname, cmt nvarchar(300));
INSERT INTO @c2s VALUES
 (N'操作类型', N'切单 / 撤回切单'), (N'父工单号', N'从哪张单切出'), (N'父工单行id', N'父行 plang.id(撤回精确还原用)'),
 (N'子工单号', N'生成的子工单(号规则=父单号-序号)'), (N'根工单号', N'血缘根(多级聚合)'), (N'切单序号', N'父单的第几拆'),
 (N'切出数量', N'本次切出量'), (N'父单剩余量', N'切后父单排产数量'), (N'子单交期', N'子单计划完工日(可改,默认=父单交期)'),
 (N'原因备注', N'急单/分波等人工说明'), (N'asp_user1', N'操作人'), (N'asp_user2', N'撤回人'), (N'asp_cancel', N'撤回标记(留痕不删)');
DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR SELECT col, cmt FROM @c2s;
OPEN cur2 FETCH NEXT FROM cur2 INTO @c2, @m2;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                 WHERE ep.major_id = OBJECT_ID(N'dbo.' + @t2) AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @t2), @c2, 'ColumnId')
                   AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @m2, N'SCHEMA', N'dbo', N'TABLE', @t2, N'COLUMN', @c2;
  FETCH NEXT FROM cur2 INTO @c2, @m2;
END
CLOSE cur2 DEALLOCATE cur2;
GO

/* 自检 */
IF COL_LENGTH('plang', N'根工单号') IS NULL OR COL_LENGTH('plang', N'是否切单') IS NULL
  RAISERROR(N'plang 血缘两列缺失', 16, 1);
ELSE IF OBJECT_ID('dbo.wo_split_log') IS NULL
  RAISERROR(N'wo_split_log 未建成', 16, 1);
ELSE IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.wo_split_log'))
  RAISERROR(N'wo_split_log 缺中文注明', 16, 1);
ELSE PRINT N'切单血缘就绪(plang.根工单号/是否切单 + wo_split_log)';
GO
