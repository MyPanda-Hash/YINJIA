/* ============================================================
   migrate-usage-log-wo-line-20261015.sql — 2026-10-15
   yj_usage_log(按钮留痕)补「工单行号」+ 存量从 doc_no 拆解回填

   背景(用户口径 2026-10-15):「当前修改流转时间线和领料数据同样要根据工单行号完成」。
   工单追溯的「流转时间线」段数据源就是 yj_usage_log,而该表**只记 doc_no(工单号)**:
     · 同工单多行的留痕全混在一起 —— 行3 的时间线里会出现行1/行2 的排产;
     · 更糟的是有些写入方把行键**拼进 doc_no**(如 `GD-2026-10-0002#111`),而查询用的是
       `doc_no = @工单号` ⇒ 这些留痕**根本匹配不上、直接被丢掉**(实测撤销排产的 7 条留痕全隐形)。
   即"既有口径混乱(有的拼后缀有的不拼),又有数据被静默丢失"。

   处置:
     ① yj_usage_log 补 int 列 [工单行号](= plang.pl_xc,与全局行的标识同一口径)+ 中文注明;
     ② 存量回填:凡 doc_no 里带 `#` 的,拆出「单号」与「行id」⇒ doc_no 还原成**纯单号**、
        [工单行号] 由 行id → plang.pl_xc 解析(plang 行已软删也照样解析:留痕是历史事实,不做过滤);
        解析不出来的(plang 行不存在)只还原 doc_no、[工单行号] 留 NULL ⇒
        按"工单级老留痕"显示,**不再隐形**(比丢掉好);
     ③ 代码侧:ScheduleBoardService / WorkOrderTransferService / WorkOrderSplitService /
        QuickScheduleService / WorkOrderListController 的 6 个写入点在有行上下文时写 [工单行号],
        并**不再**往 doc_no 里拼 `#行id`(行键有了自己的列)。

   ⚠ yj_usage_log 是通用留痕表(UsageLogService 也在写,那些写入没有行上下文 ⇒ 保持 NULL =
     工单级),本脚本只加列 + 拆后缀,不动任何 action/panel 语义。
   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO
IF OBJECT_ID(N'dbo.yj_usage_log', N'U') IS NULL
BEGIN
    PRINT N'[跳过] 无 yj_usage_log 表';
    RETURN;
END
GO
IF COL_LENGTH(N'dbo.yj_usage_log', N'工单行号') IS NULL
    ALTER TABLE dbo.yj_usage_log ADD [工单行号] int NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.yj_usage_log')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_usage_log'), N'工单行号', 'ColumnId')
                 AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
         N'工单行号(该留痕对应的生产工单行,= plang.pl_xc;与工单号合起来唯一定位一张工单。NULL = 工单级留痕/无行上下文)',
         N'SCHEMA', N'dbo', N'TABLE', N'yj_usage_log', N'COLUMN', N'工单行号';
GO
-- 存量拆解:doc_no 形如 '单号#行id' → doc_no 还原纯单号 + 工单行号 = plang.pl_xc
DECLARE @moved int = 0;
;WITH src AS (
    SELECT id,
           LEFT(doc_no, CHARINDEX(N'#', doc_no) - 1) AS 单号,
           TRY_CAST(SUBSTRING(doc_no, CHARINDEX(N'#', doc_no) + 1, 20) AS bigint) AS 行id
      FROM dbo.yj_usage_log
     WHERE CHARINDEX(N'#', doc_no) > 0
)
UPDATE u
   SET u.doc_no = s.单号,
       u.[工单行号] = (SELECT TOP 1 p.pl_xc FROM dbo.plang p WHERE p.id = s.行id)
  FROM dbo.yj_usage_log u JOIN src s ON s.id = u.id
 WHERE u.doc_no LIKE N'%#%';
SET @moved = @@ROWCOUNT;
PRINT N'存量拆解完成:' + CAST(@moved AS nvarchar(10)) + N' 条(行id 解析不到 plang 的,工单行号留 NULL)';
GO
-- 自检:doc_no 里不应再有 '#'(拆解干净)
DECLARE @bad int = (SELECT COUNT(*) FROM dbo.yj_usage_log WHERE doc_no LIKE N'%#%');
IF @bad > 0 RAISERROR(N'仍有 %d 条 doc_no 带 # 未拆解', 16, 1, @bad);
ELSE PRINT N'yj_usage_log.工单行号 就绪(列 + 注明 + 存量拆解干净,幂等)';
GO
