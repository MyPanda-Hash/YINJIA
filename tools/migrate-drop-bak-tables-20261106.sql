/* =============================================================================
   migrate-drop-bak-tables-20261106.sql
   一次性清掉服务器库上残留的**全部备份/临时表**,把「备份表」收回体检基线 0。

   【为什么要有这一支(2026-11-06 用户口径)】
     用户口径:「同时需要删除这些备份表,本地之前应该操作过的但是没有在服务器上执行」。
     本地 HSDZ_MES / HSDZ_MES_TEST 实测:备份/临时表 = 0;
     服务器(HSDZ_MES,2026-11-06 21:22 备份还原实测)= **38 张**,其中
       _bak_pc0000_* (5) / _bak_qcdraft_* (7) / _bak_qcmix_* (11) / _bak_qcregen_* (10)
       + 后缀式 qc_*_bak_* (7: 首件/制程检验的头与明细快照,2026-10-21/22 手工建)
     ⚠ 前者两支脚本在服务器上被 **baseline 成「只登记不执行」**,原因是它们**互相闸死**:
       · migrate-drop-bak-snapshots-20261021.sql 的闸门③「名单外不得有其它备份表」
         被 _bak_qcmix_* 、_bak_qcregen_* 、qc_*_bak_* 挡住;
       · migrate-drop-bak-qc-snapshots-20261102.sql 的闸门①
         被 _bak_pc0000_* + qc_*_bak_* 挡住。
       ⇒ 单独跑哪一支都会被自己的闸门拒绝,合在一支里按**共同名单**一次判、一次删,
         才是这两族同时存在时唯一能过的路径。

   【删的是什么】内容都是对应业务表的整行拷贝(任务前快照),不是业务事实本身:
     · _bak_pc0000_*      = PC0000 批号归一(migrate-pc0000-to-null-20261019.sql)前的原行 + 基线/中间表
     · _bak_qcdraft_*     = 检验单「空壳草稿」清理前的头/明细/状态快照
     · _bak_qcmix_*       = 品质模块 2026-10-21 09:24 整理前的整行快照
     · _bak_qcregen_*     = 2026-10-21 09:07 重新生成前的整行快照
     · qc_*_bak_*         = 2026-10-21/22 服务器侧手工清理前的首件/制程检验整表快照(仅服务器有)

   【删前取证(2026-11-06,对服务器 21:22 备份还原的独立快照库 HSDZ_MES_SRV 实测)】
     ① 全仓 grep(java/vue/js/mjs/sql):无任何面板/后端/前端引用,仅 tools/archive 下的探针与
        一份结构对比文本提到过;
     ② 38 张表全部命中本脚本名单;名单外无其它 `%bak%` / `RENAME_%` / `tmp_%` / `t1` / `t2`;
     ③ 无视图/过程/函数/触发器依赖,无外键指向(闸门④/⑤ 复验);
     ④ 后缀式快照与现役表行数对比:qc_first_insp_head 435 ≥ 432、qc_first_insp_detail
        39069 ≥ 38799、qc_proc_insp_head 453 ≥ 441、qc_proc_insp_detail 2540 ≥ 2535
        ⇒ 现役表是快照的超集,快照确为冗余(闸门④ 复验);
     ⑤ ID 级回灌检查:草稿快照里的检验单在现役 qc_proc_insp_head / qc_first_insp_head 命中 = 0
        ⇒ 被清理的单没有回流(闸门② 复验);
     ⑥ 删前安全网:`HSDZ_MES_manual_20261106-212242.bak`(服务器 21:22 全库备份)与部署前
        自动备份 —— **不可回滚的删除靠这两份 .bak 兜底**。

   【五道闸门:任一不过 → 只报错、一张表都不删】
     ① PC0000 归一生效:kucun(lot_no)/inh(批号)/outh(批号) 三处 PC0000 残留必须 = 0
        —— 归一被回退时,快照就是唯一凭据,不能删;
     ② 快照里的检验单不得回流到现役 qc_proc_insp_head / qc_first_insp_head(id 命中 = 0);
     ③ 名单外不得有其它备份/临时表 —— 本脚本**只删名单内**,绝不「顺手全清」;
     ④ 后缀式快照( qc_*_bak_* )必须「同名现役表存在且行数 ≥ 快照」——证明快照是冗余;
     ⑤ 不得有数据库对象依赖这些表(视图/过程/函数/触发器/外键)。

   【为什么按家族通配而不是写死名字】
     快照表名带任务名/日期(如 _bak_pc0000_<yyyyMMdd>_kucun),整链重放 / 换机重建会生成
     新日期同族表;写死名字会漏。闸门③保证不误删名单外的表。

   【幂等】目标表不存在即跳过(已删 = 天然 no-op),复跑打印「[跳过]」。
   【执行】两账套都要跑(先 HSDZ_MES,后 HSDZ_MES_TEST):
     cd tools
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-bak-tables-20261106.sql
     YINJIA_SQL_DB=HSDZ_MES_TEST java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-bak-tables-20261106.sql
   【验证】删后 java -cp lib\mssql-jdbc.jar verify/DbNormAudit.java → 第 10 项应 PASS(备份/临时表 0)
   【回滚】不可回滚(数据即快照本身);要重建只能从 HSDZ_MES_manual_20261106-212242.bak 还原。
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ───────── 名单(家族通配)—— 名单外的备份表一律不碰,由闸门③ 报出来 ───────── */
DECLARE @fam1 nvarchar(80) = N'\_bak\_pc0000\_%';   /* PC0000 归一快照族 */
DECLARE @fam2 nvarchar(80) = N'\_bak\_qc%';         /* 品质整理快照族(qcdraft/qcmix/qcregen/qcrec/...) */
DECLARE @fam3 nvarchar(80) = N'qc\_%\_bak\_%';       /* 后缀式快照(服务器手工建的 qc_*_bak_<日期>) */

/* ───────── 待删清单(行数取 sys.partitions,不需要额外权限)───────── */
DECLARE @pending TABLE (name sysname PRIMARY KEY, rc int);
INSERT INTO @pending (name, rc)
SELECT t.name,
       ISNULL((SELECT SUM(p.rows) FROM sys.partitions p
                WHERE p.object_id = t.object_id AND p.index_id IN (0, 1)), 0)
  FROM sys.tables t
 WHERE t.name LIKE @fam1 ESCAPE N'\'
    OR t.name LIKE @fam2 ESCAPE N'\'
    OR t.name LIKE @fam3 ESCAPE N'\';

DECLARE @cnt int = (SELECT COUNT(*) FROM @pending);
DECLARE @list nvarchar(max) = N'';
SELECT @list = @list + CASE WHEN @list = N'' THEN N'' ELSE N'; ' END
             + QUOTENAME(name) + N'(' + CAST(rc AS nvarchar(12)) + N' 行)'
  FROM @pending ORDER BY name;
PRINT N'[发现] 名单内备份表 ' + CAST(@cnt AS nvarchar(6)) + N' 张:' + ISNULL(@list, N'(无)');

/* ───────── 闸门① PC0000 归一生效 ───────── */
DECLARE @pc int = 0;
IF COL_LENGTH('dbo.kucun', 'lot_no') IS NOT NULL
  SET @pc = @pc + (SELECT COUNT(*) FROM kucun WHERE RTRIM(ISNULL(lot_no, N'')) = N'PC0000');
IF COL_LENGTH('dbo.inh', N'批号') IS NOT NULL
  SET @pc = @pc + (SELECT COUNT(*) FROM inh WHERE RTRIM(ISNULL([批号], N'')) = N'PC0000');
IF COL_LENGTH('dbo.outh', N'批号') IS NOT NULL
  SET @pc = @pc + (SELECT COUNT(*) FROM outh WHERE RTRIM(ISNULL([批号], N'')) = N'PC0000');

/* ───────── 闸门② 快照里的检验单没回流(表不存在=已删,跳过) ───────── */
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
        OR name LIKE N'tmp\_%'    ESCAPE N'\'
        OR name IN (N't1', N't2'))
   AND name NOT LIKE @fam1 ESCAPE N'\'
   AND name NOT LIKE @fam2 ESCAPE N'\'
   AND name NOT LIKE @fam3 ESCAPE N'\';

/* ───────── 闸门④ 后缀式快照必须「同名现役表存在且行数 ≥ 快照」 ───────── */
DECLARE @thin nvarchar(max) = N'';
SELECT @thin = @thin + CASE WHEN @thin = N'' THEN N'' ELSE N', ' END
             + QUOTENAME(p.name) + N'(快照 ' + CAST(p.rc AS nvarchar(12))
             + N' > 现役 ' + CAST(ISNULL(l.rc, -1) AS nvarchar(12)) + N')'
  FROM @pending p
  OUTER APPLY (
     SELECT ISNULL((SELECT SUM(pt.rows) FROM sys.partitions pt
                     WHERE pt.object_id = lt.object_id AND pt.index_id IN (0, 1)), -1) AS rc
       FROM sys.tables lt
      WHERE lt.name = LEFT(p.name, CHARINDEX(N'_bak', p.name) - 1)
  ) l
 WHERE p.name LIKE @fam3 ESCAPE N'\'
   AND (l.rc IS NULL OR l.rc = -1 OR p.rc > l.rc);

/* ───────── 闸门⑤ 不得有数据库对象/外键依赖 ───────── */
DECLARE @dep nvarchar(max) = N'';
SELECT @dep = @dep + CASE WHEN @dep = N'' THEN N'' ELSE N', ' END + QUOTENAME(d.tbl_name) + N'<-' + QUOTENAME(d.obj_name)
  FROM (
    SELECT p.name AS tbl_name, o.name AS obj_name
      FROM @pending p
      JOIN sys.sql_modules m ON m.definition LIKE N'%' + p.name + N'%'
      JOIN sys.objects o ON o.object_id = m.object_id
  ) d;
SELECT @dep = ISNULL(@dep, N'') + CASE WHEN @dep = N'' THEN N'' ELSE N', ' END + QUOTENAME(fk.name)
  FROM sys.foreign_keys fk
  JOIN @pending p ON OBJECT_NAME(fk.referenced_object_id) = p.name;

/* ───────── 闸门汇总:通过才删,不通过只报错 ───────── */
DECLARE @abort nvarchar(2000) = N'';
IF @pc > 0
  SET @abort = @abort + N'① PC0000 归一未生效/被回退(残留 ' + CAST(@pc AS nvarchar(12)) + N' 行); ';
IF @aliveProc + @aliveFst > 0
  SET @abort = @abort + N'② 快照里的检验单又回到业务表(制程 ' + CAST(@aliveProc AS nvarchar(12))
                     + N' / 首件 ' + CAST(@aliveFst AS nvarchar(12)) + N' 行); ';
IF @extra <> N''
  SET @abort = @abort + N'③ 名单外还有备份/临时表:' + @extra + N'; ';
IF @thin <> N''
  SET @abort = @abort + N'④ 后缀式快照不比现役表小:' + @thin + N'; ';
IF @dep <> N''
  SET @abort = @abort + N'⑤ 有对象依赖这些表:' + @dep + N'; ';

IF @abort <> N''
BEGIN
  RAISERROR(N'[中止] 闸门未通过,一张表都不删:%s', 16, 1, @abort);
  PRINT N'[中止] 未执行任何 DROP —— 上述问题处理完再复跑本脚本';
END
ELSE
BEGIN
  PRINT N'[闸门] ① PC0000 残留 = 0  ② 快照草稿单回流 = 0  ③ 名单外备份/临时表 = 0  ④ 后缀式快照冗余 = 是  ⑤ 依赖 = 0 —— 全部通过 ✔';

  IF @cnt = 0
    PRINT N'[跳过] 名单内的表已不存在(幂等:此前已删或本库从未产生)';
  ELSE
  BEGIN
    DECLARE @drop nvarchar(max) = N'';
    SELECT @drop = @drop + N'DROP TABLE ' + QUOTENAME(name) + N';' + CHAR(10)
      FROM @pending ORDER BY name;

    BEGIN TRANSACTION;
    EXEC sp_executesql @drop;
    IF EXISTS (SELECT 1 FROM sys.tables
                WHERE name LIKE @fam1 ESCAPE N'\'
                   OR name LIKE @fam2 ESCAPE N'\'
                   OR name LIKE @fam3 ESCAPE N'\')
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
END
