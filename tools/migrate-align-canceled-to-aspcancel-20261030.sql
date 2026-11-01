/* ============================================================================
   migrate-align-canceled-to-aspcancel-20261030.sql
   「状态表已作废」与「业务表 asp_cancel」口径对齐(2026-10-30)

   【背景·这次踩的坑】
     作废/删除单据走 ButtonService.voidDoc,只写 yj_doc_status.canceled='Y',
     **不动业务表 asp_cancel** ⇒ 同一个"这张单还在不在"的问题有两套答案:
       · 面板列表 / 项目流程管控 / 项目进度查询  —— 排掉 canceled='Y' 的(看不到)
       · 桌面看板 docStats                      —— 只看 asp_cancel(算得出来)
     2026-10-30 服务器实测:rd_approval 19 张全活着(asp_cancel='N'),
     但 yj_doc_status 19/19 canceled='Y' ⇒ 面板 0 张、看板 19 张,差 19。
     代码侧已把四处判活全部补上状态表过滤(见 rdVoidPrune.test.js);本脚本补**存量数据**。

   【用户口径】
     2026-10-30 用户确认:「是,确实要清掉」—— 这些单据是 2026-10-10 ~ 10-30 期间
     在界面上逐个删除的(13 个账号,今天 13:20~13:25 集中清了一批),
     不是版本不兼容、也不是误删,所以**不恢复**,只把业务表标记补齐。

   【本脚本做什么】
     对每张 RD_ 面板:凡是 yj_doc_status 里 canceled='Y' 的单据,
     把它的业务表头行 asp_cancel 也置 'Y'(打 asp_user2='align-cancel-20261030' 便于回溯)。
     · 只动**已经在状态表里作废**的单据,不碰任何活着的数据;
     · 幂等:已对齐的不会再被选中 ⇒ 复跑 0 行;
     · 自检:执行后「canceled='Y' 但 asp_cancel<>'Y'」必须为 0,否则整体回滚。

   ⚠ 两账套都要跑(先 HSDZ_MES 后 HSDZ_MES_TEST),已登记 tools/db-migrations.txt。
   ⚠ 只覆盖研发区(RD_*)。其它模块若有同样不一致,按本脚本同一写法另出脚本。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @db sysname = DB_NAME();
DECLARE @sql nvarchar(max) = N'';
DECLARE @msg nvarchar(max) = N'';
DECLARE @done int = 0;

/* 拼每张 RD_ 面板的对齐语句;表/列名全部来自 yj_panel 元数据并做白名单校验 */
SELECT @sql = @sql
      + N'UPDATE t SET t.asp_cancel = ''Y'', t.asp_user2 = N''align-cancel-20261030'', t.asp_time2 = GETDATE()'
      + N' FROM ' + QUOTENAME(p.head_table) + N' t'
      + N' WHERE ISNULL(t.asp_cancel,''N'') <> ''Y'''
      + N'   AND EXISTS (SELECT 1 FROM yj_doc_status s'
      + N'                WHERE s.panel_code = ''' + p.panel_code + N''''
      + N'                  AND s.canceled = ''Y'''
      + N'                  AND s.doc_no = CAST(t.' + QUOTENAME(p.group_col) + N' AS nvarchar(100)));'
      + N' SET @done = @done + @@ROWCOUNT;',
       @msg = @msg + N'  · ' + p.panel_code + N' → ' + p.head_table + CHAR(13) + CHAR(10)
FROM yj_panel p
WHERE p.panel_code LIKE 'RD[_]%'
  AND p.head_table IS NOT NULL AND p.group_col IS NOT NULL
  AND OBJECT_ID(p.head_table) IS NOT NULL
  AND EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(p.head_table) AND c.name = N'asp_cancel');

IF LEN(@sql) = 0
BEGIN
    COMMIT TRAN;
    PRINT N'[SKIP] ' + @db + N':没有可对齐的研发面板(或都缺 asp_cancel 列)';
    RETURN;
END

EXEC sp_executesql @sql, N'@done int OUTPUT', @done = @done OUTPUT;

PRINT N'[DB] ' + @db;
PRINT N'[OK] 对齐 ' + CAST(@done AS nvarchar(20)) + N' 行业务表 asp_cancel=Y';
PRINT @msg;

/* ── 自检:状态表作废但业务表未标记的,必须 0 条 ── */
DECLARE @left int = 0;
DECLARE @chk nvarchar(max) = N'';
SELECT @chk = @chk
      + N'SELECT @left = @left + (SELECT COUNT(*) FROM ' + QUOTENAME(p.head_table) + N' t'
      + N'  WHERE ISNULL(t.asp_cancel,''N'') <> ''Y'''
      + N'    AND EXISTS (SELECT 1 FROM yj_doc_status s'
      + N'                 WHERE s.panel_code = ''' + p.panel_code + N''''
      + N'                   AND s.canceled = ''Y'''
      + N'                   AND s.doc_no = CAST(t.' + QUOTENAME(p.group_col) + N' AS nvarchar(100))));'
FROM yj_panel p
WHERE p.panel_code LIKE 'RD[_]%'
  AND p.head_table IS NOT NULL AND p.group_col IS NOT NULL
  AND OBJECT_ID(p.head_table) IS NOT NULL
  AND EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(p.head_table) AND c.name = N'asp_cancel');

IF LEN(@chk) > 0 EXEC sp_executesql @chk, N'@left int OUTPUT', @left = @left OUTPUT;

IF @left <> 0
BEGIN
    ROLLBACK TRAN;
    RAISERROR(N'[FAIL] %s:对齐后仍有 %d 行「状态表已作废、业务表未标记」,已回滚', 16, 1, @db, @left);
    RETURN;
END

COMMIT TRAN;
PRINT N'[SELF-CHECK OK] 状态表与业务表作废口径一致';
