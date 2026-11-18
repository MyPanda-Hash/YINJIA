/* ============================================================================
   rd_sample_nondev_head / rd_sample_nondev_detail 补主键
   ----------------------------------------------------------------------------
   背景(2026-11-17 合并 origin/main 时发现):
     「外部-非开发样品申请单」(RD_SAMPLE_ND)由 `migrate-sample-nondev-20261117.sql`
     用 `SELECT TOP 0 * INTO` 复制 rd_sample_ext_head/_detail 建表。该脚本注释写着
     「再补回主键 identity」,但 SELECT INTO 并不会复制主键约束,脚本里也没有补 ——
     结果是两张表只有 identity 列、**没有 PRIMARY KEY**,DbNormAudit 第 4 项
     「业务表主键与审计四件套」直接 FAIL(rd_sample_nondev_head / _detail 两处)。

   处置:只补 PK 约束,不动任何列与数据(两表当前 0 行,id 为 identity、无重复值)。
   主键列取 id(与 rd_sample_ext_* 同构)。

   幂等:按 sys.key_constraints 判断,已有 PK 就跳过;两账套都要执行。
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT N'=== rd_sample_nondev_* 补主键 ===';

IF OBJECT_ID(N'dbo.rd_sample_nondev_head', N'U') IS NULL
BEGIN
  THROW 50001, N'rd_sample_nondev_head 不存在:请先执行 tools/migrate-sample-nondev-20261117.sql', 1;
END
IF OBJECT_ID(N'dbo.rd_sample_nondev_detail', N'U') IS NULL
BEGIN
  THROW 50002, N'rd_sample_nondev_detail 不存在:请先执行 tools/migrate-sample-nondev-20261117.sql', 1;
END

/* ---------- 1. 头表:补主键 ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.key_constraints
                WHERE type = 'PK' AND parent_object_id = OBJECT_ID(N'dbo.rd_sample_nondev_head'))
BEGIN
  ALTER TABLE dbo.rd_sample_nondev_head
    ADD CONSTRAINT PK_rd_sample_nondev_head PRIMARY KEY CLUSTERED (id);
  PRINT N'[1] 已补 rd_sample_nondev_head 主键(id)';
END
ELSE
  PRINT N'[1] rd_sample_nondev_head 已有主键,跳过';

/* ---------- 2. 行表:补主键 ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.key_constraints
                WHERE type = 'PK' AND parent_object_id = OBJECT_ID(N'dbo.rd_sample_nondev_detail'))
BEGIN
  ALTER TABLE dbo.rd_sample_nondev_detail
    ADD CONSTRAINT PK_rd_sample_nondev_detail PRIMARY KEY CLUSTERED (id);
  PRINT N'[2] 已补 rd_sample_nondev_detail 主键(id)';
END
ELSE
  PRINT N'[2] rd_sample_nondev_detail 已有主键,跳过';

/* ---------- 3. 自检:两张表都必须有 PK,否则中止 ---------- */
DECLARE @pk int = (
  SELECT COUNT(*) FROM sys.key_constraints
   WHERE type = 'PK'
     AND parent_object_id IN (OBJECT_ID(N'dbo.rd_sample_nondev_head'), OBJECT_ID(N'dbo.rd_sample_nondev_detail')));
PRINT N'[3] 主键数量 = ' + CAST(@pk AS nvarchar(10)) + N'(期望 2)';
IF @pk <> 2
  THROW 50003, N'rd_sample_nondev_* 主键仍缺失,请核对第 1/2 步', 1;

PRINT N'RESULT: PASS rd_sample_nondev_head/_detail 已具备主键';
