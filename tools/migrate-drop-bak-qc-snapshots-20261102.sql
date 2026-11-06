/* =============================================================================
   migrate-drop-bak-qc-snapshots-20261102.sql
   清理 2026-10-21 品质模块几轮数据整理留下的**清理前行快照表**(_bak_qc*_20261021*),
   把全库「备份/临时表」收回体检基线 0(规范:docs/development/数据库规范.md; AGENTS.md 表清单 §0)

   【用户口径 2026-11-02】红框点名的就是这批 `_bak_qc*` 表,确认「先备份 → 写迁移脚本删除」。

   【删的是什么】10-21 四次整理任务的整行快照(正式库 30 张 / 测试库 11 张),全仓 grep 无产品代码引用:
     07:48  _bak_qcrec_*(4: 头/approval/detail/status)、_bak_qccat_detail_20261021、_bak_qctcin_ref_20261021
     08:10  _bak_qcinsp_empty_*(5: 头/approval/detail/flow/status)
     09:07  _bak_qcregen_20261021_*(9: bd_purchase_in/bl_purchase_in/form_flow_link/qc_catalog/
                                  qc_insp/qc_insp_rec/qc_insp_rec_detail/qc_return/yj_doc_status)
     09:24  _bak_qcmix_20261021_*(10: form_flow_link/qc_catalog_detail/qc_insp/qc_insp_detail/
                                  qc_insp_rec/qc_insp_rec_detail/qc_return/qc_return_detail/
                                  yj_doc_status/yj_form_approval)
   命名规律:`_bak_<任务名>_20261021_<原表名>`,内容是**对应业务表的整行拷贝**,不是业务事实本身。

   【删前取证(2026-11-02,两账套)】
     ① 全仓 grep(java/vue/js/mjs/sql)只有 tools/archive/_qc-* 下的探针命中,后端/前端**零引用**;
     ② `tools/db-inuse-tables.txt` **未登记**、tools 下的 *.sql 无创建它们的脚本(当时手敲 SQL 建的);
     ③ 名单外**没有**其它 `%bak%` / `RENAME_%` / `tmp_%` / `t1` / `t2` 表(闸门① 复验);
     ④ **没有任何视图/存储过程/函数依赖**这些表(闸门② 复验);
     ⑤ 行数与现役对比:qc_insp 17>快照 12、qc_insp_rec 16=16、form_flow_link 1166>快照 186
        ⇒ 快照是旧状态;唯一「快照行数更多」的是 `_bak_qccat_detail_20261021` 46 行 vs
        现役 qc_catalog_detail 16 行,即被 10-21 清理掉的 30 行旧目录明细 —— 用户已知悉并确认删除。
     ⑥ 删前安全网:`HSDZ_MES-manual-20261102-135402.bak` / `HSDZ_MES_TEST-manual-20261102-135402.bak`
        (D:\sql\data,COMPRESSION,msdb 记录 is_damaged=0)。**不可回滚的删除靠这份 .bak 兜底。**

   【三道闸门:任一不过 → 只报错、一张表都不删】
     ① 名单外不得有其它备份/临时表(*bak* / RENAME_* / tmp_* / t1 / t2)
        —— 有就先人工确认,本脚本**只删本家族**,绝不「顺手全清」;
     ② 不得有数据库对象(视图/过程/函数/触发器)依赖这些表
        —— 有依赖时 DROP 会失败或留下坏对象,必须先改依赖;
     ③ 家族为空即跳过(已删/本库从未产生),保证幂等。
     🔴 删除整段放在 `ELSE`(闸门通过才进入),不依赖「RAISERROR 会不会中止批次」——
        这是 2026-10-21 踩过的坑:RAISERROR 不中止批次,闸门报警后 DROP 仍会执行。

   【为什么按家族通配而不是写死 30 个名字】
     同族表名带任务名/日期,整链重放或换机重建会生成**新日期**的同族表,写死名字会漏。
     闸门①② 保证不误删名单外的表。

   【幂等】已删 = 天然 no-op,复跑打印「[跳过]」。
   【执行】两账套都要跑(先 HSDZ_MES,后 HSDZ_MES_TEST):
     cd tools
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-bak-qc-snapshots-20261102.sql
     YINJIA_SQL_DB=HSDZ_MES_TEST java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-bak-qc-snapshots-20261102.sql
   【验证】删后 java -cp lib\mssql-jdbc.jar verify/DbNormAudit.java → 第 10 项应 PASS(备份/临时表 0)
   【回滚】不可回滚(数据即快照本身);要重建只能从上面两份 .bak 还原。
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @fam nvarchar(80) = N'\_bak\_qc%20261021%';   /* 本家族:10-21 品质整理的快照表 */

/* ───────── 待删清单(行数取 sys.partitions,不需要额外权限)───────── */
DECLARE @pending TABLE (name sysname PRIMARY KEY, rc int);
INSERT INTO @pending (name, rc)
SELECT t.name,
       ISNULL((SELECT SUM(p.rows) FROM sys.partitions p
                WHERE p.object_id = t.object_id AND p.index_id IN (0, 1)), 0)
  FROM sys.tables t
 WHERE t.name LIKE @fam ESCAPE N'\';

DECLARE @cnt int = (SELECT COUNT(*) FROM @pending);
DECLARE @list nvarchar(max) = N'';
SELECT @list = @list + CASE WHEN @list = N'' THEN N'' ELSE N'; ' END
             + QUOTENAME(name) + N'(' + CAST(rc AS nvarchar(12)) + N' 行)'
  FROM @pending ORDER BY name;
PRINT N'[发现] 待删快照表 ' + CAST(@cnt AS nvarchar(6)) + N' 张:' + ISNULL(@list, N'(无)');

/* ───────── 闸门① 名单外不得有其它备份/临时表 ───────── */
DECLARE @extra nvarchar(max) = N'';
SELECT @extra = @extra + CASE WHEN @extra = N'' THEN N'' ELSE N', ' END + QUOTENAME(name)
  FROM sys.tables
 WHERE (name LIKE N'%bak%'
        OR name LIKE N'rename\_%' ESCAPE N'\'
        OR name LIKE N'tmp\_%'    ESCAPE N'\'
        OR name IN (N't1', N't2'))
   AND name NOT LIKE @fam ESCAPE N'\';

/* ───────── 闸门② 不得有视图/过程/函数/触发器依赖这些表 ───────── */
DECLARE @deps nvarchar(max) = N'';
SELECT @deps = @deps + CASE WHEN @deps = N'' THEN N'' ELSE N', ' END + QUOTENAME(o.name)
  FROM (SELECT DISTINCT o.object_id, o.name
          FROM sys.sql_expression_dependencies d
          JOIN sys.objects o ON o.object_id = d.referencing_id
          JOIN sys.tables  t ON t.object_id = d.referenced_id
         WHERE t.name LIKE @fam ESCAPE N'\') o;

/* ───────── 闸门汇总:通过才删,不通过只报错 ───────── */
DECLARE @abort nvarchar(1500) = N'';
IF @extra <> N''
  SET @abort = @abort + N'① 名单外还有备份/临时表:' + @extra + N'; ';
IF @deps <> N''
  SET @abort = @abort + N'② 有数据库对象依赖待删快照表:' + @deps + N'; ';

IF @abort <> N''
BEGIN
  RAISERROR(N'[中止] 闸门未通过,一张表都不删:%s', 16, 1, @abort);
  PRINT N'[中止] 未执行任何 DROP —— 上述问题处理完再复跑本脚本';
END
ELSE
BEGIN
  PRINT N'[闸门] ① 名单外备份/临时表 = 0  ② 依赖这些表的对象 = 0 —— 通过 ✔';

  IF @cnt = 0
    PRINT N'[跳过] 本家族的表已不存在(幂等:此前已删或本库从未产生)';
  ELSE
  BEGIN
    DECLARE @drop nvarchar(max) = N'';
    SELECT @drop = @drop + N'DROP TABLE ' + QUOTENAME(name) + N';' + CHAR(10)
      FROM @pending ORDER BY name;

    BEGIN TRANSACTION;
    EXEC sp_executesql @drop;
    IF EXISTS (SELECT 1 FROM sys.tables WHERE name LIKE @fam ESCAPE N'\')
    BEGIN
      ROLLBACK TRANSACTION;
      RAISERROR(N'[失败] 仍有快照表未删净,已整体回滚', 16, 1);
    END
    ELSE
    BEGIN
      COMMIT TRANSACTION;
      PRINT N'[完成] 已删除 ' + CAST(@cnt AS nvarchar(6)) + N' 张快照表,事务已提交';
    END
  END

  /* 收尾自检:本家族必须清零 */
  DECLARE @left int = (SELECT COUNT(*) FROM sys.tables WHERE name LIKE @fam ESCAPE N'\');
  IF @left > 0
    RAISERROR(N'[自检失败] 仍残留 %d 张本家族表', 16, 1, @left);
  ELSE
    PRINT N'[自检] 本家族残留 = 0 ✔';
END
