/* _cleanup-rd-module-all.sql —— 研发管理模块(RD_*)测试单据与数据清理
 *
 * 口径(2026-10-13 用户要求):把研发管理模块的测试单据与数据清一遍,准备正式录入。
 *   ① 清:所有 RD_* 面板的业务表(头表 + 行表)全部行;
 *      以及挂在这些单据上的流程留痕(yj_doc_status / yj_form_approval / yj_message /
 *      yj_doc_modify_log / yj_attachment 里 panel_code 属 RD_* 的部分)。
 *   ② 留:面板与字段元数据(yj_panel / yj_field / yj_translation)一行不动
 *      —— 清的是数据,不是配置。
 *   ③ 留:rd_progress 的**头行**(项目进度查询是单单据面板,全库只有一张单,
 *      删了 syncPlanToProgress 就没有落点了);它的**明细行照清**。
 *   ④ 留:号池 s_allno 一行不动(项目铁律:号池只增不删,删了会重发号)。
 *   ⑤ 留:RD_SHARE_FILE 用的 yj_share_file 是共享表,不属于研发模块数据,不动。
 *   ⑥ 留:RD_SINTER_TOL 的 rd_sinter_tolerance(60 行)**型号规格基础字典** —— 该面板无 head_table、
 *      code_col=型号,内容是型号→模具/中心杆/炭棒尺寸与公差,创建人 system 批量导入 ⇒ 不是测试单据数据。
 *
 * 幂等:重复执行第二次就是「0 行」。两账套都要跑(先 HSDZ_MES,后 HSDZ_MES_TEST)。
 *
 * 用法(★ 默认只报数不删):
 *   sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d HSDZ_MES -C -f 65001 -i <本文件> -W -s"|"
 * 确认条数无误后,把下面 @APPLY 改成 1 再跑一遍即真删。
 */

SET NOCOUNT ON;
DECLARE @APPLY bit = 1;   -- ★ 0 = 只报数;1 = 真删。(2026-10-13 已干跑核对条数后置 1)

IF OBJECT_ID('tempdb..#heads') IS NOT NULL DROP TABLE #heads;
IF OBJECT_ID('tempdb..#lines') IS NOT NULL DROP TABLE #lines;

CREATE TABLE #heads (tbl sysname PRIMARY KEY, panel nvarchar(64), pname nvarchar(200), n int NULL);
CREATE TABLE #lines (tbl sysname PRIMARY KEY, panel nvarchar(64), pname nvarchar(200), n int NULL);

/* ── ① 收集待清表:RD_* 面板的头表(排除单单据的 rd_progress 与共享表 yj_share_file) ── */
INSERT INTO #heads (tbl, panel, pname)
SELECT DISTINCT p.head_table, MIN(p.panel_code), MIN(p.panel_name)
  FROM yj_panel p
 WHERE p.panel_code LIKE N'RD[_]%' AND p.head_table IS NOT NULL
   AND p.head_table <> N'yj_share_file'
   AND p.head_table <> N'rd_progress'
   AND OBJECT_ID(p.head_table) IS NOT NULL
 GROUP BY p.head_table;

/* ── ② 收集待清表:RD_* 面板的行表(rd_progress_detail 也要清) ── */
INSERT INTO #lines (tbl, panel, pname)
SELECT DISTINCT p.line_table, MIN(p.panel_code), MIN(p.panel_name)
  FROM yj_panel p
 WHERE p.panel_code LIKE N'RD[_]%' AND p.line_table IS NOT NULL
   AND p.line_table <> N'yj_share_file'
   -- ★ 排除基础规格字典:RD_SINTER_TOL(烧结尺寸表)没有 head_table、code_col=型号,
   --   60 行是「型号→模具尺寸/中心杆尺寸/炭棒内外径/公差/长度范围」的规格表,
   --   创建人 system、2026-09-21 09:52:16 毫秒级连续批量导入 ⇒ 是基础数据,不是测试单据数据。
   AND p.line_table <> N'rd_sinter_tolerance'
   AND OBJECT_ID(p.line_table) IS NOT NULL
 GROUP BY p.line_table;

/* ── ③ 逐表数行数 ── */
DECLARE @tbl sysname, @sql nvarchar(400), @n int;
DECLARE c1 CURSOR FOR SELECT tbl FROM #heads;
OPEN c1; FETCH NEXT FROM c1 INTO @tbl;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'SELECT @x = COUNT(*) FROM ' + QUOTENAME(@tbl);
  EXEC sp_executesql @sql, N'@x int OUTPUT', @n OUTPUT;
  UPDATE #heads SET n = @n WHERE tbl = @tbl;
  FETCH NEXT FROM c1 INTO @tbl;
END
CLOSE c1; DEALLOCATE c1;

DECLARE c2 CURSOR FOR SELECT tbl FROM #lines;
OPEN c2; FETCH NEXT FROM c2 INTO @tbl;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'SELECT @x = COUNT(*) FROM ' + QUOTENAME(@tbl);
  EXEC sp_executesql @sql, N'@x int OUTPUT', @n OUTPUT;
  UPDATE #lines SET n = @n WHERE tbl = @tbl;
  FETCH NEXT FROM c2 INTO @tbl;
END
CLOSE c2; DEALLOCATE c2;

SELECT N'[待清-头表]' AS 类别, panel AS 面板, pname AS 面板名, tbl AS 表, n AS 现有行数
  FROM #heads WHERE n > 0
UNION ALL
SELECT N'[待清-行表]', panel, pname, tbl, n FROM #lines WHERE n > 0
ORDER BY 1 DESC, 5 DESC;

/* ── ④ 流程留痕待删行数(按 panel_code 前缀 RD_) ── */
SELECT N'yj_doc_status'   AS 表, COUNT(*) AS 待删行数 FROM yj_doc_status   WHERE panel_code LIKE N'RD[_]%'
UNION ALL SELECT N'yj_form_approval', COUNT(*) FROM yj_form_approval WHERE panel_code LIKE N'RD[_]%'
UNION ALL SELECT N'yj_message',       COUNT(*) FROM yj_message m WHERE EXISTS (
        SELECT 1 FROM yj_doc_status s WHERE s.doc_no = m.单据编号 AND s.panel_code LIKE N'RD[_]%')
UNION ALL SELECT N'yj_doc_modify_log', COUNT(*) FROM yj_doc_modify_log WHERE panel_code LIKE N'RD[_]%';

/* ── ⑤ 必须保留的东西(自证没被误伤) ── */
SELECT N'保留:rd_progress 头行(单单据面板)' AS 保留项, CAST(COUNT(*) AS nvarchar(10)) AS 现有行数 FROM rd_progress
UNION ALL SELECT N'保留:RD_* 面板元数据', CAST(COUNT(*) AS nvarchar(10)) FROM yj_panel WHERE panel_code LIKE N'RD[_]%'
UNION ALL SELECT N'保留:RD_* 字段元数据', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code LIKE N'RD[_]%'
UNION ALL SELECT N'保留:号池 s_allno(只增不删)', CAST(COUNT(*) AS nvarchar(10)) FROM s_allno
UNION ALL SELECT N'保留:yj_share_file(共享表,非研发数据)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_share_file;

IF @APPLY = 0
BEGIN
  PRINT N'── DRY RUN(@APPLY=0):以上仅为报数,未删除任何一行。确认后把 @APPLY 改成 1 再跑。──';
  RETURN;
END

/* ══════════════════ 以下仅在 @APPLY=1 时执行 ══════════════════ */
PRINT N'── APPLY(@APPLY=1):开始删除 ──';
BEGIN TRAN;

  /* ⑥ 先删流程留痕(业务行还在,单号还能查到) */
  DELETE FROM yj_message WHERE 单据编号 IN (
      SELECT doc_no FROM yj_doc_status WHERE panel_code LIKE N'RD[_]%');
  PRINT N'yj_message       删除 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

  DELETE FROM yj_form_approval WHERE panel_code LIKE N'RD[_]%';
  PRINT N'yj_form_approval 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

  IF OBJECT_ID('yj_doc_modify_log') IS NOT NULL
  BEGIN
    DELETE FROM yj_doc_modify_log WHERE panel_code LIKE N'RD[_]%';
    PRINT N'yj_doc_modify_log 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
  END

  DELETE FROM yj_doc_status WHERE panel_code LIKE N'RD[_]%';
  PRINT N'yj_doc_status    删除 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

  /* ⑦ 附件(若该表按 panel_code 记账) */
  IF OBJECT_ID('yj_attachment') IS NOT NULL AND COL_LENGTH('yj_attachment', N'panel_code') IS NOT NULL
  BEGIN
    DELETE FROM yj_attachment WHERE panel_code LIKE N'RD[_]%';
    PRINT N'yj_attachment    删除 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
  END

  /* ⑧ 业务行表 → 头表(逐表闭式删除) */
  DECLARE c3 CURSOR FOR SELECT tbl FROM #lines;
  OPEN c3; FETCH NEXT FROM c3 INTO @tbl;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    SET @sql = N'DELETE FROM ' + QUOTENAME(@tbl) + N'; SELECT @x = @@ROWCOUNT;';
    EXEC sp_executesql @sql, N'@x int OUTPUT', @n OUTPUT;
    PRINT N'[行表] ' + @tbl + N' 删除 ' + CAST(@n AS nvarchar(10)) + N' 行';
    FETCH NEXT FROM c3 INTO @tbl;
  END
  CLOSE c3; DEALLOCATE c3;

  DECLARE c4 CURSOR FOR SELECT tbl FROM #heads;
  OPEN c4; FETCH NEXT FROM c4 INTO @tbl;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    SET @sql = N'DELETE FROM ' + QUOTENAME(@tbl) + N'; SELECT @x = @@ROWCOUNT;';
    EXEC sp_executesql @sql, N'@x int OUTPUT', @n OUTPUT;
    PRINT N'[头表] ' + @tbl + N' 删除 ' + CAST(@n AS nvarchar(10)) + N' 行';
    FETCH NEXT FROM c4 INTO @tbl;
  END
  CLOSE c4; DEALLOCATE c4;

  /* ⑨ 单单据面板:头行保留,明细清空 */
  DELETE FROM rd_progress_detail;
  PRINT N'[单单据] rd_progress_detail 删除 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(头行保留)';

COMMIT;

/* ⑩ 删除后自证 */
SELECT N'[对照] 头表删除前行数合计' AS 项, CAST(
    ISNULL((SELECT SUM(n) FROM #heads), 0) AS nvarchar(10)) AS 值;
SELECT N'[删除后] rd_progress 头行(应=1)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM rd_progress
UNION ALL SELECT N'[删除后] RD_* 面板元数据(应不变)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_panel WHERE panel_code LIKE N'RD[_]%'
UNION ALL SELECT N'[删除后] RD_* 字段元数据(应不变)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code LIKE N'RD[_]%';
PRINT N'── 清理完成 ──';

DROP TABLE #heads; DROP TABLE #lines;
