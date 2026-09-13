/* ═══════════════════════════════════════════════════════════════════════════════
   _cleanup-merged-panels-20260911.sql — 并入面板旧单据清理(一次性脚本,2026-09-11)

   口径(见 CONTEXT.md「产品文件文书面板」2026-09-11 决策):
     成型配方(RD_MOLD_FORMULA)与组装BOM表(RD_ASM_BOM)已并入成型/组装工艺清单的第 2 页签,
     这两个面板的**已有单据按用户口径直接清理**(都是本地开发期测试数据)。
     先备份(表改名,不覆盖、不删备份数据),再事务化删除业务行与状态行。

   ⚠ 本脚本是**一次性破坏性脚本,禁止登记进 tools/db-migrations.txt**(登记=每次清单同步都删业务数据,
     与 migrate-rd-cleanup.sql / _doc_part3_cleanup.sql 同类先例)。只能人工手工执行。

   只动这四张表 + 两张表对应的 yj_doc_status 行:
     rd_mold_formula_head / rd_mold_formula_detail / rd_asm_bom_head / rd_asm_bom_detail
   一律不碰:rd_mold_proc_* / rd_asm_proc_* / s_allno / yj_usage_log / yj_form_approval /
             yj_doc_modify_log / rd_dev_task(历史下发记录留审计)

   幂等/可重跑:每一步都先判存在性 —— 已改过名的表不会让脚本报错中止,
   重跑时「0. 基线」用动态 SQL 取现状、备份步骤自动跳过、删除步骤只清残留。

   🔴 2026-09-11 执行记录与已修复的缺口(如实记录,不要当成本脚本是干净的):
     本脚本第一版有两处 bug(① 备份表 yj_doc_status_bak 建表后显式插 id 撞 IDENTITY 报 8101;
     ② FOR XML PATH 取列清单要求 QUOTED_IDENTIFIER ON,sqlcmd 默认 OFF 报 1934),
     两次执行都在事务里失败回滚,但**表改名是 DDL、回滚不掉**,且旧版脚本没有"备份表非空才允许清空"
     这道闸 —— 结果四张业务表的 12 行在第二次执行时被清空并提交。
     已做的补救:从 `deploy\HSDZ_MES_local.bak`(2026-09-10 20:25 的完整备份)还原到临时库
     `HSDZ_MES_0911_tmp`,按原 id 把 12 行**回填进 <表>_bak_20260911**(核对:MF 头 3/明细 2、
     AB 头 3/明细 4),临时库随后删除,操作记录在 tools\_restore-merged-panel-backups.sql。
     所以现在四张备份表里是**真数据**,不是空壳。
     本版新增的闸门:① 备份表 0 行而业务表还有数据 → 直接回滚拒绝清空(见 2.3);
     ② **绝不再清空 <表>_bak_20260911** —— 那是唯一的原始数据副本(见 2.4)。
     这 12 行经确认仍是本地开发期探针垃圾数据(产品编号 "58"/"样值"、单据 MF2609070002-4 /
     AB22609070004-0002),用户口径本就是"直接清理";回填只为守住"先备份再删"这条要求。

   执行(PowerShell,注意 -f 65001 —— 不带会让含中文的 SQL 静默不生效):
     sqlcmd -S localhost -d HSDZ_MES -U yinjia -P 'Yinjia@2026' -W -s '|' -i tools\_cleanup-merged-panels-20260911.sql -f 65001
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
-- 本次执行把所有步骤包在一个显式事务里:任一步失败则整体回滚,不会留下"删一半"的中间态。
-- (表改名 sp_rename 也在事务内,失败一并回滚。)

/* ── 0. 清理前:行数快照(含两个主面板,用于「行数不变」佐证)──────────────────── */
PRINT '====== 0. 清理前基线 ======';
DECLARE @snap nvarchar(max) = N'';
DECLARE @t sysname, @q nvarchar(max);
DECLARE cur_s CURSOR LOCAL FAST_FORWARD FOR
    SELECT v.n FROM (VALUES
        (N'rd_mold_formula_head'), (N'rd_mold_formula_detail'), (N'rd_asm_bom_head'), (N'rd_asm_bom_detail'),
        (N'rd_mold_proc_head'), (N'rd_mold_proc_detail'), (N'rd_asm_proc_head'), (N'rd_asm_proc_detail')) v(n);
OPEN cur_s;
FETCH NEXT FROM cur_s INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(@t, 'U') IS NOT NULL
    BEGIN
        SET @q = N'SELECT @c = COUNT(*) FROM ' + QUOTENAME(@t);
        DECLARE @c int;
        EXEC sp_executesql @q, N'@c int OUTPUT', @c = @c OUTPUT;
        SET @snap = @snap + N'BEFORE|' + @t + N'|' + CAST(@c AS nvarchar(20)) + N'  ';
    END
    ELSE IF OBJECT_ID(@t + N'_bak_20260911', 'U') IS NOT NULL
    BEGIN
        SET @q = N'SELECT @c = COUNT(*) FROM ' + QUOTENAME(@t + N'_bak_20260911');
        DECLARE @c2 int;
        EXEC sp_executesql @q, N'@c int OUTPUT', @c = @c2 OUTPUT;
        SET @snap = @snap + N'BEFORE|' + @t + N'(已改名为备份表)|' + CAST(@c2 AS nvarchar(20)) + N'  ';
    END
    ELSE SET @snap = @snap + N'BEFORE|' + @t + N'|(表不存在)  ';
    FETCH NEXT FROM cur_s INTO @t;
END
CLOSE cur_s; DEALLOCATE cur_s;
PRINT @snap;

SELECT 'BEFORE_STATUS|' + panel_code + '|' + doc_no + '|' + ISNULL(archived, '') AS 状态行
FROM yj_doc_status WHERE panel_code IN ('RD_MOLD_FORMULA','RD_ASM_BOM') ORDER BY panel_code, doc_no;

BEGIN TRAN;

/* ── 1. 备份:表改名 <表>_bak_20260911(存在则跳过,绝不覆盖)──────────────────── */
PRINT '====== 1. 备份(rename,不覆盖)======';
IF OBJECT_ID('rd_mold_formula_head', 'U') IS NOT NULL AND OBJECT_ID('rd_mold_formula_head_bak_20260911', 'U') IS NULL
BEGIN EXEC sp_rename 'rd_mold_formula_head', 'rd_mold_formula_head_bak_20260911'; PRINT '备份 rd_mold_formula_head → _bak_20260911'; END
ELSE PRINT '跳过 rd_mold_formula_head(已备份或表不存在)';

IF OBJECT_ID('rd_mold_formula_detail', 'U') IS NOT NULL AND OBJECT_ID('rd_mold_formula_detail_bak_20260911', 'U') IS NULL
BEGIN EXEC sp_rename 'rd_mold_formula_detail', 'rd_mold_formula_detail_bak_20260911'; PRINT '备份 rd_mold_formula_detail → _bak_20260911'; END
ELSE PRINT '跳过 rd_mold_formula_detail(已备份或表不存在)';

IF OBJECT_ID('rd_asm_bom_head', 'U') IS NOT NULL AND OBJECT_ID('rd_asm_bom_head_bak_20260911', 'U') IS NULL
BEGIN EXEC sp_rename 'rd_asm_bom_head', 'rd_asm_bom_head_bak_20260911'; PRINT '备份 rd_asm_bom_head → _bak_20260911'; END
ELSE PRINT '跳过 rd_asm_bom_head(已备份或表不存在)';

IF OBJECT_ID('rd_asm_bom_detail', 'U') IS NOT NULL AND OBJECT_ID('rd_asm_bom_detail_bak_20260911', 'U') IS NULL
BEGIN EXEC sp_rename 'rd_asm_bom_detail', 'rd_asm_bom_detail_bak_20260911'; PRINT '备份 rd_asm_bom_detail → _bak_20260911'; END
ELSE PRINT '跳过 rd_asm_bom_detail(已备份或表不存在)';

/* ── 2. 状态行备份 + 业务行清空 ──────────────────────────────────────────────── */
PRINT '====== 2. 状态行备份 + 清空 ======';

-- 2.1 状态行备份
--     口径与 _cleanup-probe-junk-20260911.sql 一致:备份表已存在就先改名作废(RENAME_<时间戳>_...),绝不覆盖。
--     备份表由 SELECT * INTO 复制结构,**自带 IDENTITY(id)**;显式插原 id 要开 IDENTITY_INSERT,
--     而开 IDENTITY_INSERT 要求 SET QUOTED_IDENTIFIER ON(sqlcmd 默认 OFF,实测报 1934)——
--     索性不搬原 id:备份表自己发新 id,业务键(panel_code/doc_no)与其余列原样搬过去即可。
IF NOT EXISTS (SELECT 1 FROM yj_doc_status_bak_20260911 WHERE panel_code IN ('RD_MOLD_FORMULA','RD_ASM_BOM'))
BEGIN
    DECLARE @stamp nvarchar(40) = CONVERT(nvarchar(20), GETDATE(), 112) + N'_' + REPLACE(CONVERT(nvarchar(8), GETDATE(), 108), N':', N'');
    IF OBJECT_ID('yj_doc_status_bak_20260911', 'U') IS NOT NULL
    BEGIN
        DECLARE @legacy sysname = N'RENAME_' + @stamp + N'_yj_doc_status_bak_20260911';
        EXEC sp_rename N'yj_doc_status_bak_20260911', @legacy;
        PRINT '已存在备份表,改名作废 → ' + @legacy;
    END

    SELECT * INTO yj_doc_status_bak_20260911 FROM yj_doc_status WHERE 1 = 0;
    PRINT '建备份表 yj_doc_status_bak_20260911(结构复制,空)';

    INSERT INTO yj_doc_status_bak_20260911
        (panel_code, doc_no, shr, shsj, canceled, cancel_by, cancel_at, pending, pending_by, pending_at,
         update_at, stopped, stop_by, stop_at, saved, archived, deleting, delete_req_by, delete_req_at,
         modify_state, modify_req_by, modify_req_at, modify_appr_by, modify_appr_at, archived_at)
    SELECT panel_code, doc_no, shr, shsj, canceled, cancel_by, cancel_at, pending, pending_by, pending_at,
           update_at, stopped, stop_by, stop_at, saved, archived, deleting, delete_req_by, delete_req_at,
           modify_state, modify_req_by, modify_req_at, modify_appr_by, modify_appr_at, archived_at
    FROM yj_doc_status WHERE panel_code IN ('RD_MOLD_FORMULA','RD_ASM_BOM');
    PRINT '状态行已备份到 yj_doc_status_bak_20260911';
END
ELSE PRINT '状态行备份已存在(本轮不重复备份)';

-- 2.2 删状态行(只删这两个面板)
DELETE FROM yj_doc_status WHERE panel_code IN ('RD_MOLD_FORMULA','RD_ASM_BOM');
PRINT '已删状态行 ' + CAST(@@ROWCOUNT AS nvarchar) + ' 行';

-- 2.3 闸门:**备份表必须真的有数据**才允许清空业务表。
--     第一版漏了这道闸 —— 表已经改名成备份表、备份表却被清空,等于"备份形同虚设"(实测踩过)。
DECLARE @bakCnt int = ISNULL((SELECT COUNT(*) FROM rd_mold_formula_head_bak_20260911), 0)
                    + ISNULL((SELECT COUNT(*) FROM rd_mold_formula_detail_bak_20260911), 0)
                    + ISNULL((SELECT COUNT(*) FROM rd_asm_bom_head_bak_20260911), 0)
                    + ISNULL((SELECT COUNT(*) FROM rd_asm_bom_detail_bak_20260911), 0);
DECLARE @liveCnt int = 0;
IF OBJECT_ID('rd_mold_formula_head', 'U') IS NOT NULL
    SELECT @liveCnt = @liveCnt + COUNT(*) FROM rd_mold_formula_head;
IF OBJECT_ID('rd_asm_bom_head', 'U') IS NOT NULL
    SELECT @liveCnt = @liveCnt + COUNT(*) FROM rd_asm_bom_head;

IF @bakCnt = 0 AND @liveCnt > 0
BEGIN
    ROLLBACK;
    PRINT '❌ 回滚:备份表 0 行但业务表还有 ' + CAST(@liveCnt AS nvarchar) + ' 张表头 —— 拒绝清空(先补齐备份)';
END
ELSE
BEGIN
-- 2.4 清空**残留的原名表**(正常路径下它们已被改名成备份表,所以这里通常是空转;
--     若 1.x 的改名没跑成(表已不存在),这几段也不会执行)。
--     ⚠ 绝不清空 <表>_bak_20260911 —— 那是唯一的原始数据副本。
IF OBJECT_ID('rd_mold_formula_detail', 'U') IS NOT NULL
BEGIN DELETE FROM rd_mold_formula_detail; PRINT '清空 rd_mold_formula_detail(残留原名表)'; END
IF OBJECT_ID('rd_mold_formula_head', 'U') IS NOT NULL
BEGIN DELETE FROM rd_mold_formula_head; PRINT '清空 rd_mold_formula_head(残留原名表)'; END
IF OBJECT_ID('rd_asm_bom_detail', 'U') IS NOT NULL
BEGIN DELETE FROM rd_asm_bom_detail; PRINT '清空 rd_asm_bom_detail(残留原名表)'; END
IF OBJECT_ID('rd_asm_bom_head', 'U') IS NOT NULL
BEGIN DELETE FROM rd_asm_bom_head; PRINT '清空 rd_asm_bom_head(残留原名表)'; END

DECLARE @left int = (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code IN ('RD_MOLD_FORMULA','RD_ASM_BOM'));
IF @left > 0
BEGIN
    ROLLBACK;
    PRINT '❌ 回滚:状态行仍有残留 ' + CAST(@left AS nvarchar) + ' 行(备份表里数据仍在,可人工排查)';
END
ELSE
BEGIN
    COMMIT;
    PRINT '✅ 已提交:状态行已清空、四张业务表已改名备份(备份表累计 ' + CAST(@bakCnt AS nvarchar) + ' 行原始数据)';
END
END
GO

/* ── 3. 清理后:核对 ────────────────────────────────────────────────────────── */
PRINT '====== 3. 清理后核对 ======';
DECLARE @out2 nvarchar(max) = N'', @t2 sysname, @q2 nvarchar(max), @c3 int;
DECLARE cur_a CURSOR LOCAL FAST_FORWARD FOR
    SELECT v.n FROM (VALUES
        (N'rd_mold_proc_head'), (N'rd_asm_proc_head'),
        (N'rd_mold_formula_head_bak_20260911'), (N'rd_mold_formula_detail_bak_20260911'),
        (N'rd_asm_bom_head_bak_20260911'), (N'rd_asm_bom_detail_bak_20260911'),
        (N'yj_doc_status_bak_20260911')) v(n);
OPEN cur_a;
FETCH NEXT FROM cur_a INTO @t2;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(@t2, 'U') IS NULL SET @out2 = @out2 + N'AFTER|' + @t2 + N'|(表不存在)  ';
    ELSE
    BEGIN
        SET @q2 = N'SELECT @c = COUNT(*) FROM ' + QUOTENAME(@t2);
        EXEC sp_executesql @q2, N'@c int OUTPUT', @c = @c3 OUTPUT;
        SET @out2 = @out2 + N'AFTER|' + @t2 + N'|' + CAST(@c3 AS nvarchar(20)) + N'  ';
    END
    FETCH NEXT FROM cur_a INTO @t2;
END
CLOSE cur_a; DEALLOCATE cur_a;
SELECT @out2 + N'AFTER|yj_doc_status(RD_MOLD_FORMULA)|' + CAST((SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = 'RD_MOLD_FORMULA') AS nvarchar)
     + N'  AFTER|yj_doc_status(RD_ASM_BOM)|' + CAST((SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = 'RD_ASM_BOM') AS nvarchar) AS 清理后;

/* 3.1 孤儿状态行核查:按 yj_panel.mode='doc' 动态遍历全部 doc 面板,
       统计「有状态行但业务表里没有该单号」的数量(明细里列出的面板为异常,合计应为 0)。
       group_col 取 yj_panel.group_col;该列在两张表里都不存在的面板记入跳过分组单独列出。 */
DECLARE @pc nvarchar(50), @head nvarchar(100), @line nvarchar(100), @k nvarchar(100),
        @sql nvarchar(max), @n int, @total int = 0, @det nvarchar(max) = N'', @skip nvarchar(max) = N'',
        @scanned int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT panel_code, head_table, line_table, ISNULL(NULLIF(group_col, ''), N'单据编号')
    FROM yj_panel WHERE mode = 'doc' AND head_table IS NOT NULL AND head_table <> '';
OPEN cur;
FETCH NEXT FROM cur INTO @pc, @head, @line, @k;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(@head, 'U') IS NULL OR COL_LENGTH(@head, @k) IS NULL
        SET @skip = @skip + @pc + N' ';
    ELSE
    BEGIN
        SET @scanned = @scanned + 1;
        SET @sql = N'SELECT @c = COUNT(*) FROM yj_doc_status s WHERE s.panel_code = @p'
                 + N' AND NOT EXISTS (SELECT 1 FROM ' + QUOTENAME(@head) + N' h WHERE CAST(h.' + QUOTENAME(@k) + N' AS nvarchar(100)) = s.doc_no)'
                 + CASE WHEN @line IS NOT NULL AND @line <> @head AND OBJECT_ID(@line, 'U') IS NOT NULL AND COL_LENGTH(@line, @k) IS NOT NULL
                        THEN N' AND NOT EXISTS (SELECT 1 FROM ' + QUOTENAME(@line) + N' d WHERE CAST(d.' + QUOTENAME(@k) + N' AS nvarchar(100)) = s.doc_no)'
                        ELSE N'' END;
        EXEC sp_executesql @sql, N'@p nvarchar(50), @c int OUTPUT', @p = @pc, @c = @n OUTPUT;
        IF @n > 0 SET @det = @det + @pc + N'=' + CAST(@n AS nvarchar) + N' ';
        SET @total = @total + @n;
    END
    FETCH NEXT FROM cur INTO @pc, @head, @line, @k;
END
CLOSE cur; DEALLOCATE cur;

SELECT 'ORPHAN_SCAN|扫描 doc 面板数|' + CAST(@scanned AS nvarchar)                            AS 孤儿核查
UNION ALL SELECT 'ORPHAN_SCAN|孤儿状态行合计|' + CAST(@total AS nvarchar)                     AS 孤儿核查
UNION ALL SELECT 'ORPHAN_SCAN|明细|' + ISNULL(NULLIF(@det, N''), N'(0 —— 全部单据都有业务行)') AS 孤儿核查
UNION ALL SELECT 'ORPHAN_SCAN|跳过(表/列不存在)|' + ISNULL(NULLIF(@skip, N''), N'(无)')        AS 孤儿核查;

/* 3.2 未触碰表基线(s_allno / yj_usage_log 等,应与清理前一致) */
SELECT 'UNTOUCHED|s_allno|' + CAST((SELECT COUNT(*) FROM s_allno) AS nvarchar) AS 未触碰
UNION ALL SELECT 'UNTOUCHED|yj_usage_log|' + CAST((SELECT COUNT(*) FROM yj_usage_log) AS nvarchar)
UNION ALL SELECT 'UNTOUCHED|yj_form_approval|' + CAST((SELECT COUNT(*) FROM yj_form_approval) AS nvarchar)
UNION ALL SELECT 'UNTOUCHED|yj_doc_modify_log|' + CAST((SELECT COUNT(*) FROM yj_doc_modify_log) AS nvarchar)
UNION ALL SELECT 'UNTOUCHED|rd_dev_task|' + CAST((SELECT COUNT(*) FROM rd_dev_task) AS nvarchar);
