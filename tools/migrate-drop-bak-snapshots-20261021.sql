/* =============================================================================
   migrate-drop-bak-snapshots-20261021.sql
   清理两条数据整理任务留下的回滚快照表(_bak_pc0000_* / _bak_qcdraft_*),
   把全库「备份/临时表」收回体检基线 0(规范见 docs/development/数据库规范.md、AGENTS.md)

   【用户口径 2026-10-21】「这些表是作为之前危险删除操作的备份文件存在对吗?如果是这样的话
   当前可以删除掉这些表了」⇒ 确认是快照、两条任务均已验收,故现在删除。

   【删的是什么】两张任务各自的整行快照,全仓 grep 无任何面板/代码引用:
     A. PC0000 归一(migrate-pc0000-to-null-20261019.sql)留下的 5 张
        _bak_pc0000_<日期>_kucun(1080)/_inh(1076)/_outh(4668) = 归一前的 PC0000 原行
        _bak_pc0000_baseline(1 行) = 归一前基线(行数 1473 / 余量 -347842.826,供跨批次自检)
        _bak_pc0000_merge(0 行)    = 合并「PC0000 行 + 无批号行」时的聚合中间表
     B. 制程/首件检验单「空壳草稿」清理(2026-10-21,tools/archive/_qc-insp-purge-20261021/)
        _bak_qcdraft_proc_head(15)/_fst_head(63)/_fst_status(9) + 4 张 0 行快照
        —— 命中的单「除自动单号外没有任何业务数据」,故明细/审批本来就没有行

   【三道闸门:任一不过 → 只报错、一张表都不删】
     ① PC0000 归一生效:kucun / inh / outh 三表 PC0000 残留必须 = 0
        —— 若有人把归一倒回(重跑 migrate-lot-normalize-blank-to-pc0000.sql),
           快照就是唯一凭据,此时不能删;
     ② 快照里的草稿单不得又回到业务表:快照 id 在 qc_proc_insp_head / qc_first_insp_head
        的命中数必须 = 0 —— 有人把删掉的单灌回来了,就不能删快照;
     ③ 名单外不得有其它备份/临时表(*bak* / RENAME_* / tmp_*):有就先人工确认。
        本脚本**只删两个家族**,绝不「顺手全清」。

   🔴 【本次踩坑(2026-10-21,已修)】闸门曾写成 `IF 有问题 RAISERROR(...)` 然后继续往下走 ——
      **RAISERROR 不会中止批次**(只是给客户端发一个错误消息,后面的语句照跑),
      结果闸门报警了、DROP 还是执行了。故本版把删除整段放进 `ELSE`
      (闸门通过才进入),不再依赖"报错会不会停下"这种不确定行为;
      闸门③原来用 `IF @extra IS NOT NULL`,而空串也 IS NOT NULL ⇒ 误报,
      改为 `IF @extra <> N''`。

   【为什么按家族通配而不是写死 12 个名字】
     两个快照脚本的表名带 GETDATE() 日期后缀(如 _bak_pc0000_<yyyyMMdd>_kucun);
     整链重放 / 换机重建时会生成**新日期**的同族表,写死名字会漏。闸门③保证不误删别的表。

   【幂等】目标表不存在即跳过(已删 = 天然 no-op),复跑打印「[跳过]」。
   【执行】两账套都要跑(先 HSDZ_MES,后 HSDZ_MES_TEST):
     cd tools
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-bak-snapshots-20261021.sql
     YINJIA_SQL_DB=HSDZ_MES_TEST java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-bak-snapshots-20261021.sql
   【验证】删后 java -cp lib\mssql-jdbc.jar verify/DbNormAudit.java → 第 10 项应 PASS(备份/临时表 0)
   【回滚】不可回滚(数据即快照本身)。删前已用闸门①② 证明两条变更落地;若要重建同口径数据,
     只能从数据库备份 .bak 还原 —— 这也是先跑闸门再 DROP 的原因。
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @famA nvarchar(60) = N'\_bak\_pc0000\_%';    /* PC0000 归一快照族 */
DECLARE @famB nvarchar(60) = N'\_bak\_qcdraft\_%';   /* 检验单空壳清理快照族 */

/* ───────── 待删清单(行数取 sys.partitions,不需要额外权限)───────── */
DECLARE @pending TABLE (name sysname PRIMARY KEY, rc int);
INSERT INTO @pending (name, rc)
SELECT t.name,
       ISNULL((SELECT SUM(p.rows) FROM sys.partitions p
                WHERE p.object_id = t.object_id AND p.index_id IN (0, 1)), 0)
  FROM sys.tables t
 WHERE t.name LIKE @famA ESCAPE N'\' OR t.name LIKE @famB ESCAPE N'\';

DECLARE @cnt int = (SELECT COUNT(*) FROM @pending);
DECLARE @list nvarchar(max) = N'';
SELECT @list = @list + CASE WHEN @list = N'' THEN N'' ELSE N'; ' END
             + QUOTENAME(name) + N'(' + CAST(rc AS nvarchar(12)) + N' 行)'
  FROM @pending ORDER BY name;
PRINT N'[发现] 待删备份表 ' + CAST(@cnt AS nvarchar(6)) + N' 张:' + ISNULL(@list, N'(无)');

/* ───────── 闸门① PC0000 归一生效 ───────── */
DECLARE @pc int =
    (SELECT COUNT(*) FROM kucun WHERE RTRIM(ISNULL(lot_no, N'')) = N'PC0000')
  + (SELECT COUNT(*) FROM inh   WHERE RTRIM(ISNULL(批号,  N'')) = N'PC0000')
  + (SELECT COUNT(*) FROM outh  WHERE RTRIM(ISNULL(批号,  N'')) = N'PC0000');

/* ───────── 闸门② 快照里的草稿单没回流(表不存在=已删,跳过) ───────── */
DECLARE @aliveProc int = 0, @aliveFst int = 0;
IF OBJECT_ID(N'_bak_qcdraft_proc_head_20261021', N'U') IS NOT NULL
BEGIN
  DECLARE @q1 nvarchar(600) = N'SELECT @n = COUNT(*) FROM _bak_qcdraft_proc_head_20261021 b
                                 WHERE EXISTS (SELECT 1 FROM qc_proc_insp_head h WHERE h.id = b.id)';
  EXEC sp_executesql @q1, N'@n int OUTPUT', @n = @aliveProc OUTPUT;
END
IF OBJECT_ID(N'_bak_qcdraft_fst_head_20261021', N'U') IS NOT NULL
BEGIN
  DECLARE @q2 nvarchar(600) = N'SELECT @n = COUNT(*) FROM _bak_qcdraft_fst_head_20261021 b
                                 WHERE EXISTS (SELECT 1 FROM qc_first_insp_head h WHERE h.id = b.id)';
  EXEC sp_executesql @q2, N'@n int OUTPUT', @n = @aliveFst OUTPUT;
END

/* ───────── 闸门③ 名单外不得有其它备份/临时表 ───────── */
DECLARE @extra nvarchar(max) = N'';
SELECT @extra = @extra + CASE WHEN @extra = N'' THEN N'' ELSE N', ' END + QUOTENAME(name)
  FROM sys.tables
 WHERE (name LIKE N'%bak%'
        OR name LIKE N'rename\_%' ESCAPE N'\'
        OR name LIKE N'tmp\_%'    ESCAPE N'\')
   AND name NOT LIKE @famA ESCAPE N'\'
   AND name NOT LIKE @famB ESCAPE N'\';

/* ───────── 闸门汇总:通过才删,不通过只报错 ───────── */
DECLARE @abort nvarchar(1500) = N'';
IF @pc > 0
  SET @abort = @abort + N'① PC0000 归一未生效/被回退(残留 ' + CAST(@pc AS nvarchar(12)) + N' 行); ';
IF @aliveProc + @aliveFst > 0
  SET @abort = @abort + N'② 快照里的检验单又回到业务表(制程 ' + CAST(@aliveProc AS nvarchar(12))
                     + N' / 首件 ' + CAST(@aliveFst AS nvarchar(12)) + N' 行); ';
IF @extra <> N''
  SET @abort = @abort + N'③ 名单外还有备份/临时表:' + @extra + N'; ';

IF @abort <> N''
BEGIN
  RAISERROR(N'[中止] 闸门未通过,一张表都不删:%s', 16, 1, @abort);
  PRINT N'[中止] 未执行任何 DROP —— 上述问题处理完再复跑本脚本';
END
ELSE
BEGIN
  PRINT N'[闸门] ① PC0000 残留 = 0  ② 快照草稿单回流 = 0  ③ 名单外备份/临时表 = 0 —— 全部通过 ✔';

  IF @cnt = 0
    PRINT N'[跳过] 目标家族的表已不存在(幂等:此前已删或本库从未产生)';
  ELSE
  BEGIN
    DECLARE @drop nvarchar(max) = N'';
    SELECT @drop = @drop + N'DROP TABLE ' + QUOTENAME(name) + N';' + CHAR(10)
      FROM @pending ORDER BY name;

    BEGIN TRANSACTION;
    EXEC sp_executesql @drop;
    IF EXISTS (SELECT 1 FROM sys.tables
                WHERE name LIKE @famA ESCAPE N'\' OR name LIKE @famB ESCAPE N'\')
    BEGIN
      ROLLBACK TRANSACTION;
      RAISERROR(N'[失败] 仍有备份表未删净,已整体回滚', 16, 1);
    END
    ELSE
    BEGIN
      COMMIT TRANSACTION;
      PRINT N'[完成] 已删除 ' + CAST(@cnt AS nvarchar(6)) + N' 张备份表,事务已提交';
    END
  END

  /* 收尾自检:目标家族必须清零 */
  DECLARE @left int = (SELECT COUNT(*) FROM sys.tables
                        WHERE name LIKE @famA ESCAPE N'\' OR name LIKE @famB ESCAPE N'\');
  IF @left > 0
    RAISERROR(N'[自检失败] 仍残留 %d 张目标家族表', 16, 1, @left);
  ELSE
    PRINT N'[自检] 目标家族残留 = 0 ✔';
END
