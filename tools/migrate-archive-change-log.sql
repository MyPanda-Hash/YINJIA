/* migrate-archive-change-log.sql — 档案式面板「修改记录」留痕表(2026-09-22)
   背景:来料检验要求(QC_INSP_REQ)是档案式整表面板(非单据),没有「申请修改→审批→再归档」闭环,
   但它同样是多人维护的全局资料,用户要求有与立项申请同义的「修改记录」可查。
   做法:每次存档(saveArchive 整表 upsert)在库侧留一条:
     谁(user_name)、何时(saved_at)、本次新增/删除/修改了几行(change_meta)、字段级变化(changes)。
   与 yj_doc_modify_log 分开建表:那张表是「申请修改/审批/再归档」闭环的快照表(rearchive_* 未收尾判定),
   语义不同,混用会让归档面板的日志被当成"未收尾修改"。
   只增不改:重跑幂等。执行后无需重启后端。
   执行:sqlcmd -S localhost -U yinjia -P *** -d HSDZ_MES -C -f 65001 -i 本文件
*/
SET NOCOUNT ON;
GO

-- ═════════════ 1. 建表(不存在才建) ═════════════
IF OBJECT_ID('dbo.yj_archive_change_log', 'U') IS NULL
CREATE TABLE dbo.yj_archive_change_log (
    id           bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
    panel_code   nvarchar(50)  NOT NULL,          -- 面板编码(如 QC_INSP_REQ)
    doc_no       nvarchar(100) NULL,              -- 档案式无单据号:存虚拟单编号(面板名),便于日后其它面板复用
    user_name    nvarchar(50)  NULL,              -- 本次保存的操作人
    saved_at     datetime2     NOT NULL DEFAULT GETDATE(),
    change_meta  nvarchar(max) NULL,              -- 行变化摘要 JSON {addedRows,removedRows,changedRows,addedSamples,removedSamples,changedSamples,truncated}
    changes      nvarchar(max) NULL,              -- 字段级变化 JSON [{label,kind,old,new}](kind: 变化/补充/清空)
    create_at    datetime2     NOT NULL DEFAULT GETDATE()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_archive_change_log_panel')
    CREATE INDEX ix_archive_change_log_panel ON dbo.yj_archive_change_log (panel_code, id);
GO

-- ═════════════ 2. 表/列中文注明(AGENTS.md 2026-09-14 起强制) ═════════════
DECLARE @t sysname = N'yj_archive_change_log';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = 0 AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'档案式面板修改记录(每次存档留一条:操作人/时间/行变化摘要/字段级变化;只增不改)',
       N'SCHEMA', N'dbo', N'TABLE', @t;
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'档案式面板修改记录(每次存档留一条:操作人/时间/行变化摘要/字段级变化;只增不改)',
       N'SCHEMA', N'dbo', N'TABLE', @t;

DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols VALUES
  (N'panel_code',  N'面板编码(如 QC_INSP_REQ 来料检验要求;档案式整表面板)'),
  (N'doc_no',      N'单据号(档案式面板无单据号,存虚拟单编号=面板名,便于日后其它面板复用)'),
  (N'user_name',   N'本次保存的操作人(登录账号)'),
  (N'saved_at',    N'本次保存时间'),
  (N'change_meta', N'行变化摘要 JSON:{addedRows,removedRows,changedRows,addedSamples,removedSamples,changedSamples,truncated}'),
  (N'changes',     N'字段级变化 JSON 数组:[{label:字段名,kind:变化|补充|清空,old:原值,new:新值}]'),
  (N'create_at',   N'入库时间(默认 GETDATE())');

DECLARE @c sysname, @d nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(@t, @c) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = COLUMNPROPERTY(ep.major_id, @c, 'ColumnId')
                 AND ep.name = 'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
    ELSE
      EXEC sp_addextendedproperty    N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  END
  FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

-- ═════════════ 3. 验证 ═════════════
SELECT 'table'           AS item, CAST(COUNT(*) AS nvarchar(10)) AS val FROM sys.tables WHERE name = 'yj_archive_change_log'
UNION ALL SELECT 'index',           CAST(COUNT(*) AS nvarchar(10)) FROM sys.indexes WHERE name = 'ix_archive_change_log_panel'
UNION ALL SELECT 'col_comments',    CAST(COUNT(*) AS nvarchar(10)) FROM sys.extended_properties
         WHERE major_id = OBJECT_ID('yj_archive_change_log') AND name = 'MS_Description' AND minor_id > 0
UNION ALL SELECT 'table_comment',   CAST(COUNT(*) AS nvarchar(10)) FROM sys.extended_properties
         WHERE major_id = OBJECT_ID('yj_archive_change_log') AND name = 'MS_Description' AND minor_id = 0
UNION ALL SELECT 'rows_now',        CAST(COUNT(*) AS nvarchar(10)) FROM yj_archive_change_log;
GO
