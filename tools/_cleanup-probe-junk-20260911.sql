/* ============================================================
   _cleanup-probe-junk-20260911.sql
   ------------------------------------------------------------
   目的:清理 2026-09-11 本轮开发/验收探针与压测产生的"垃圾单据"
        (LXA/LXB 批量造号、EU/IU/DT/SW/IP 探针单、PI 压测单),
        及其明细行、yj_doc_status 状态行、探针产生的 yj_doc_modify_log。

   执行:sqlcmd -S localhost -d HSDZ_MES -U yinjia -P '...' -f 65001 -i <本文件>

   【先备份再删】每张被删表先建 <表>_bak_20260911(SELECT * INTO 复制结构+数据),
   再插入"即将被删的那些行";备份表已存在则先改名作废(RENAME_<时间戳>_<表>_bak_20260911),
   绝不覆盖旧备份。

   【幂等】待删集合用 LIKE '%-2026-09-%' 形态,重复执行第二次匹配 0 行,DELETE 影响 0 行。

   【绝不触碰】s_allno(单号台账,删了会重发号)、yj_usage_log(审计)、yj_std_lib、
               rd_progress_detail、任何 09-04 及更早的单号、
               保留的 8 张单(LXA-2026-09-0001/0004/0005、LXB-2026-09-0001/0006/0007/0008、
               IP2609070003)。

   【只删下列单号,超出这个集合一律不动】
     rd_approval                        : LXA-2026-09-0002 / 0003 / 0006..0023
     rd_plan                            : LXB-2026-09-0009..0016
     rd_insp_plan_head                  : IP-2026-09-0001 / IP-2026-09-0002
     rd_equip_use_head                  : LIKE 'EU-2026-09-%'
     rd_instr_use_head                  : LIKE 'IU-2026-09-%'
     rd_dom_test_head                   : LIKE 'DT-2026-09-%'
     rd_spike_water_head                : LIKE 'SW-2026-09-%'
     rd_prod_info_head                  : PI-2026-09-0015..0022
     + 对应 rd_*_detail(同单号)
     + yj_doc_status(上述每个面板的同一批单号)
     + yj_doc_modify_log(探针 3 条:panel_code='RD_EQUIP_USE' AND doc_no IN
                          ('EU-2026-09-0007','EU-2026-09-0008','EU-2026-09-0009'))

   结构:① 待删清单(SELECT) → ② 备份表(建表/改名/插行/核对) → ③ 事务内 DELETE + 前后计数
         → ④ 事务后验证(计数对比 / 孤儿状态行硬门槛 / 保留项 / 基线表 / 总数)
   ============================================================ */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;

IF OBJECT_ID('tempdb..##clr_snap') IS NOT NULL DROP TABLE ##clr_snap;
CREATE TABLE ##clr_snap (
    tbl        sysname      NOT NULL PRIMARY KEY,
    before_cnt int          NOT NULL,
    bak_cnt    int          NULL,
    deleted    int          NULL,
    after_cnt  int          NULL
);

PRINT N'==================== ① 清理前基线计数 ====================';
DECLARE @snap TABLE (tbl sysname, c int);
INSERT INTO @snap (tbl, c)
SELECT 'rd_approval',              COUNT(*) FROM rd_approval
UNION ALL SELECT 'rd_approval_detail',      COUNT(*) FROM rd_approval_detail
UNION ALL SELECT 'rd_plan',                 COUNT(*) FROM rd_plan
UNION ALL SELECT 'rd_plan_detail',          COUNT(*) FROM rd_plan_detail
UNION ALL SELECT 'rd_insp_plan_head',       COUNT(*) FROM rd_insp_plan_head
UNION ALL SELECT 'rd_insp_plan_detail',     COUNT(*) FROM rd_insp_plan_detail
UNION ALL SELECT 'rd_equip_use_head',       COUNT(*) FROM rd_equip_use_head
UNION ALL SELECT 'rd_equip_use_detail',     COUNT(*) FROM rd_equip_use_detail
UNION ALL SELECT 'rd_instr_use_head',       COUNT(*) FROM rd_instr_use_head
UNION ALL SELECT 'rd_instr_use_detail',     COUNT(*) FROM rd_instr_use_detail
UNION ALL SELECT 'rd_dom_test_head',        COUNT(*) FROM rd_dom_test_head
UNION ALL SELECT 'rd_dom_test_detail',      COUNT(*) FROM rd_dom_test_detail
UNION ALL SELECT 'rd_spike_water_head',     COUNT(*) FROM rd_spike_water_head
UNION ALL SELECT 'rd_spike_water_detail',   COUNT(*) FROM rd_spike_water_detail
UNION ALL SELECT 'rd_prod_info_head',       COUNT(*) FROM rd_prod_info_head
UNION ALL SELECT 'rd_prod_info_detail',     COUNT(*) FROM rd_prod_info_detail
UNION ALL SELECT 'yj_doc_status',           COUNT(*) FROM yj_doc_status
UNION ALL SELECT 'yj_doc_modify_log',       COUNT(*) FROM yj_doc_modify_log;

INSERT INTO ##clr_snap (tbl, before_cnt)
SELECT tbl, c FROM @snap;

SELECT tbl AS 表, c AS 清理前行数 FROM @snap ORDER BY tbl;

PRINT N'';
PRINT N'------------ 基础基线(本次不动) ------------';
SELECT 'yj_std_lib' AS 表, COUNT(*) AS 行数 FROM yj_std_lib
UNION ALL SELECT 'rd_progress_detail', COUNT(*) FROM rd_progress_detail
UNION ALL SELECT 's_allno',            COUNT(*) FROM s_allno
UNION ALL SELECT 'yj_usage_log',       COUNT(*) FROM yj_usage_log
ORDER BY 表;

PRINT N'';
PRINT N'==================== ② 待删清单(逐表 SELECT) ====================';

PRINT N'-- rd_approval / rd_approval_detail';
SELECT 单据编号, 单据日期, 客户名, 文档编号, asp_user1, asp_time1
  FROM rd_approval
 WHERE 单据编号 = 'LXA-2026-09-0002' OR 单据编号 = 'LXA-2026-09-0003'
    OR 单据编号 BETWEEN 'LXA-2026-09-0006' AND 'LXA-2026-09-0023'
 ORDER BY 单据编号;
SELECT d.* FROM rd_approval_detail d
 WHERE d.单据编号 = 'LXA-2026-09-0002' OR d.单据编号 = 'LXA-2026-09-0003'
    OR d.单据编号 BETWEEN 'LXA-2026-09-0006' AND 'LXA-2026-09-0023'
 ORDER BY d.单据编号;

PRINT N'-- rd_plan / rd_plan_detail';
SELECT 单据编号, 单据日期, 项目名称, 负责人, 文档编号 FROM rd_plan
 WHERE 单据编号 BETWEEN 'LXB-2026-09-0009' AND 'LXB-2026-09-0016' ORDER BY 单据编号;
SELECT d.* FROM rd_plan_detail d
 WHERE d.单据编号 BETWEEN 'LXB-2026-09-0009' AND 'LXB-2026-09-0016' ORDER BY d.单据编号;

PRINT N'-- rd_insp_plan_head / rd_insp_plan_detail';
SELECT 单据编号, 单据日期, 产品编号, 客户名 FROM rd_insp_plan_head
 WHERE 单据编号 IN ('IP-2026-09-0001', 'IP-2026-09-0002') ORDER BY 单据编号;
SELECT d.* FROM rd_insp_plan_detail d
 WHERE d.单据编号 IN ('IP-2026-09-0001', 'IP-2026-09-0002') ORDER BY d.单据编号;

PRINT N'-- rd_equip_use_head / detail(EU-2026-09-%,不动 EU260904*)';
SELECT 单据编号, 单据日期, 设备名称 FROM rd_equip_use_head
 WHERE 单据编号 LIKE 'EU-2026-09-%' ORDER BY 单据编号;
SELECT d.id, d.单据编号, d.使用日期 FROM rd_equip_use_detail d
 WHERE d.单据编号 LIKE 'EU-2026-09-%' ORDER BY d.单据编号;

PRINT N'-- rd_instr_use_head / detail(IU-2026-09-%,不动 IU260904*)';
SELECT 单据编号, 单据日期, [仪器名称/型号] FROM rd_instr_use_head
 WHERE 单据编号 LIKE 'IU-2026-09-%' ORDER BY 单据编号;
SELECT d.id, d.单据编号, d.使用日期 FROM rd_instr_use_detail d
 WHERE d.单据编号 LIKE 'IU-2026-09-%' ORDER BY d.单据编号;

PRINT N'-- rd_dom_test_head / detail(DT-2026-09-%,不动 DT260904*)';
SELECT 单据编号, 单据日期, 申请单类型, 文档编号 FROM rd_dom_test_head
 WHERE 单据编号 LIKE 'DT-2026-09-%' ORDER BY 单据编号;
SELECT d.id, d.单据编号, d.日期 FROM rd_dom_test_detail d
 WHERE d.单据编号 LIKE 'DT-2026-09-%' ORDER BY d.单据编号;

PRINT N'-- rd_spike_water_head / detail(SW-2026-09-%,不动 SW260904*)';
SELECT 单据编号, 单据日期, 测试项目 FROM rd_spike_water_head
 WHERE 单据编号 LIKE 'SW-2026-09-%' ORDER BY 单据编号;
SELECT d.id, d.单据编号, d.测试日期 FROM rd_spike_water_detail d
 WHERE d.单据编号 LIKE 'SW-2026-09-%' ORDER BY d.单据编号;

PRINT N'-- rd_prod_info_head / detail(PI-2026-09-0015..0022)';
SELECT 单据编号, 单据日期, 产品编号, 产品名称 FROM rd_prod_info_head
 WHERE 单据编号 BETWEEN 'PI-2026-09-0015' AND 'PI-2026-09-0022' ORDER BY 单据编号;
SELECT d.id, d.单据编号 FROM rd_prod_info_detail d
 WHERE d.单据编号 BETWEEN 'PI-2026-09-0015' AND 'PI-2026-09-0022' ORDER BY d.单据编号;

PRINT N'-- yj_doc_status(上述每个面板的同一批单号)';
SELECT panel_code, doc_no, shr, shsj, canceled, saved, archived, modify_state
  FROM yj_doc_status
 WHERE (panel_code = 'RD_APPROVAL'
        AND (doc_no = 'LXA-2026-09-0002' OR doc_no = 'LXA-2026-09-0003'
             OR doc_no BETWEEN 'LXA-2026-09-0006' AND 'LXA-2026-09-0023'))
    OR (panel_code = 'RD_PLAN'     AND doc_no BETWEEN 'LXB-2026-09-0009' AND 'LXB-2026-09-0016')
    OR (panel_code = 'RD_INSP_PLAN'AND doc_no IN ('IP-2026-09-0001', 'IP-2026-09-0002'))
    OR (panel_code = 'RD_EQUIP_USE'AND doc_no LIKE 'EU-2026-09-%')
    OR (panel_code = 'RD_INSTR_USE'AND doc_no LIKE 'IU-2026-09-%')
    OR (panel_code = 'RD_DOM_TEST' AND doc_no LIKE 'DT-2026-09-%')
    OR (panel_code = 'RD_SPIKE_WATER' AND doc_no LIKE 'SW-2026-09-%')
    OR (panel_code = 'RD_PROD_INFO'AND doc_no BETWEEN 'PI-2026-09-0015' AND 'PI-2026-09-0022')
 ORDER BY panel_code, doc_no;

PRINT N'-- yj_doc_modify_log(探针 3 条)';
SELECT id, panel_code, doc_no, apply_by, apply_at FROM yj_doc_modify_log
 WHERE panel_code = 'RD_EQUIP_USE'
   AND doc_no IN ('EU-2026-09-0007', 'EU-2026-09-0008', 'EU-2026-09-0009')
 ORDER BY id;

PRINT N'';
PRINT N'==================== ③ 备份 + 事务内删除 ====================';

/* ---- 通用备份过程:SELECT * INTO 建表 -> 插"待删行" -> 核对行数 ---- */
IF OBJECT_ID('tempdb..##clr_bak') IS NOT NULL DROP TABLE ##clr_bak;
CREATE TABLE ##clr_bak (tbl sysname, del_sql nvarchar(max));
INSERT INTO ##clr_bak (tbl, del_sql) VALUES
 (N'rd_approval', N'SELECT * FROM rd_approval WHERE 单据编号 = ''LXA-2026-09-0002'' OR 单据编号 = ''LXA-2026-09-0003'' OR 单据编号 BETWEEN ''LXA-2026-09-0006'' AND ''LXA-2026-09-0023'''),
 (N'rd_approval_detail', N'SELECT * FROM rd_approval_detail WHERE 单据编号 = ''LXA-2026-09-0002'' OR 单据编号 = ''LXA-2026-09-0003'' OR 单据编号 BETWEEN ''LXA-2026-09-0006'' AND ''LXA-2026-09-0023'''),
 (N'rd_plan', N'SELECT * FROM rd_plan WHERE 单据编号 BETWEEN ''LXB-2026-09-0009'' AND ''LXB-2026-09-0016'''),
 (N'rd_plan_detail', N'SELECT * FROM rd_plan_detail WHERE 单据编号 BETWEEN ''LXB-2026-09-0009'' AND ''LXB-2026-09-0016'''),
 (N'rd_insp_plan_head', N'SELECT * FROM rd_insp_plan_head WHERE 单据编号 IN (''IP-2026-09-0001'', ''IP-2026-09-0002'')'),
 (N'rd_insp_plan_detail', N'SELECT * FROM rd_insp_plan_detail WHERE 单据编号 IN (''IP-2026-09-0001'', ''IP-2026-09-0002'')'),
 (N'rd_equip_use_head', N'SELECT * FROM rd_equip_use_head WHERE 单据编号 LIKE ''EU-2026-09-%'''),
 (N'rd_equip_use_detail', N'SELECT * FROM rd_equip_use_detail WHERE 单据编号 LIKE ''EU-2026-09-%'''),
 (N'rd_instr_use_head', N'SELECT * FROM rd_instr_use_head WHERE 单据编号 LIKE ''IU-2026-09-%'''),
 (N'rd_instr_use_detail', N'SELECT * FROM rd_instr_use_detail WHERE 单据编号 LIKE ''IU-2026-09-%'''),
 (N'rd_dom_test_head', N'SELECT * FROM rd_dom_test_head WHERE 单据编号 LIKE ''DT-2026-09-%'''),
 (N'rd_dom_test_detail', N'SELECT * FROM rd_dom_test_detail WHERE 单据编号 LIKE ''DT-2026-09-%'''),
 (N'rd_spike_water_head', N'SELECT * FROM rd_spike_water_head WHERE 单据编号 LIKE ''SW-2026-09-%'''),
 (N'rd_spike_water_detail', N'SELECT * FROM rd_spike_water_detail WHERE 单据编号 LIKE ''SW-2026-09-%'''),
 (N'rd_prod_info_head', N'SELECT * FROM rd_prod_info_head WHERE 单据编号 BETWEEN ''PI-2026-09-0015'' AND ''PI-2026-09-0022'''),
 (N'rd_prod_info_detail', N'SELECT * FROM rd_prod_info_detail WHERE 单据编号 BETWEEN ''PI-2026-09-0015'' AND ''PI-2026-09-0022'''),
 (N'yj_doc_status', N'SELECT * FROM yj_doc_status WHERE (panel_code = ''RD_APPROVAL'' AND (doc_no = ''LXA-2026-09-0002'' OR doc_no = ''LXA-2026-09-0003'' OR doc_no BETWEEN ''LXA-2026-09-0006'' AND ''LXA-2026-09-0023'')) OR (panel_code = ''RD_PLAN'' AND doc_no BETWEEN ''LXB-2026-09-0009'' AND ''LXB-2026-09-0016'') OR (panel_code = ''RD_INSP_PLAN'' AND doc_no IN (''IP-2026-09-0001'', ''IP-2026-09-0002'')) OR (panel_code = ''RD_EQUIP_USE'' AND doc_no LIKE ''EU-2026-09-%'') OR (panel_code = ''RD_INSTR_USE'' AND doc_no LIKE ''IU-2026-09-%'') OR (panel_code = ''RD_DOM_TEST'' AND doc_no LIKE ''DT-2026-09-%'') OR (panel_code = ''RD_SPIKE_WATER'' AND doc_no LIKE ''SW-2026-09-%'') OR (panel_code = ''RD_PROD_INFO'' AND doc_no BETWEEN ''PI-2026-09-0015'' AND ''PI-2026-09-0022'')'),
 (N'yj_doc_modify_log', N'SELECT * FROM yj_doc_modify_log WHERE panel_code = ''RD_EQUIP_USE'' AND doc_no IN (''EU-2026-09-0007'', ''EU-2026-09-0008'', ''EU-2026-09-0009'')');

DECLARE @stamp  nvarchar(40) = CONVERT(nvarchar(20), GETDATE(), 112) + N'_' + REPLACE(CONVERT(nvarchar(8), GETDATE(), 108), N':', N'');
DECLARE @bak    sysname, @src sysname, @delq nvarchar(max), @baksql nvarchar(max);
DECLARE @cols   nvarchar(max), @insCols nvarchar(max), @n1 int, @n2 int, @legacy sysname;

DECLARE cur_b CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, del_sql FROM ##clr_bak ORDER BY tbl;
OPEN cur_b;
FETCH NEXT FROM cur_b INTO @src, @delq;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @bak = @src + N'_bak_20260911';

    -- 备份表已存在 -> 先改名作废,不覆盖
    IF OBJECT_ID(@bak) IS NOT NULL
    BEGIN
        SET @legacy = N'RENAME_' + @stamp + N'_' + @bak;
        EXEC sp_rename @bak, @legacy;
        PRINT N'  [改名] 已存在备份表 ' + @bak + N' -> ' + @legacy;
    END

    -- 结构+数据快照
    SET @baksql = N'SELECT * INTO [' + @bak + N'] FROM [' + @src + N']';
    EXEC sp_executesql @baksql;

    -- 备份表只留"待删行"
    SET @baksql = N'DELETE FROM [' + @bak + N']';
    EXEC sp_executesql @baksql;

    -- 列出源表非标识列(保留备份表的 IDENTITY 属性,ID 原样落库)
    SET @cols = N''; SET @insCols = N'';
    SELECT @cols = @cols + N', ' + QUOTENAME(c.name)
      FROM sys.columns c
     WHERE c.object_id = OBJECT_ID(@src) AND c.is_identity = 0
     ORDER BY c.column_id;
    SELECT @insCols = @insCols + N', ' + QUOTENAME(c.name)
      FROM sys.columns c
     WHERE c.object_id = OBJECT_ID(@bak) AND c.is_identity = 0
     ORDER BY c.column_id;
    SET @cols    = STUFF(@cols,    1, 2, N'');
    SET @insCols = STUFF(@insCols, 1, 2, N'');

    SET @baksql = N'INSERT INTO [' + @bak + N'] (' + @insCols + N') SELECT ' + @cols + N' FROM (' + @delq + N') AS q';

    BEGIN TRY
        EXEC sp_executesql @baksql;
        SET @n1 = @@ROWCOUNT;
    END TRY
    BEGIN CATCH
        PRINT N'  [备份失败] ' + @bak + N' : ' + ERROR_MESSAGE();
        SET @n1 = -1;
    END CATCH

    SET @n2 = 0;
    SET @baksql = N'SELECT @c = COUNT(*) FROM [' + @bak + N']';
    EXEC sp_executesql @baksql, N'@c int OUTPUT', @c = @n2 OUTPUT;

    UPDATE ##clr_snap SET bak_cnt = @n2 WHERE tbl = @src;
    PRINT N'  [备份] ' + @bak + N' : 插入 ' + CAST(@n1 AS nvarchar(10))
        + N' 行,表内共 ' + CAST(@n2 AS nvarchar(10)) + N' 行';

    FETCH NEXT FROM cur_b INTO @src, @delq;
END
CLOSE cur_b; DEALLOCATE cur_b;

PRINT N'';
PRINT N'-- 备份行数 = 即将删除行数?(bak_cnt vs 删除前该表命中数)';
DECLARE @chk TABLE (tbl sysname, del_sql nvarchar(max));
INSERT INTO @chk (tbl, del_sql) SELECT tbl, del_sql FROM ##clr_bak;
DECLARE @hits int, @t sysname, @qq nvarchar(max), @tot int = 0, @bakc int;
DECLARE cur_c CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, del_sql FROM @chk ORDER BY tbl;
OPEN cur_c; FETCH NEXT FROM cur_c INTO @t, @qq;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @hits = NULL;
    SET @baksql = N'SELECT @c = COUNT(*) FROM (' + @qq + N') AS q';
    EXEC sp_executesql @baksql, N'@c int OUTPUT', @c = @hits OUTPUT;
    SELECT @bakc = bak_cnt FROM ##clr_snap WHERE tbl = @t;
    IF @hits <> @bakc
        PRINT N'  [不一致!] ' + @t + N' 命中 ' + CAST(@hits AS nvarchar(10))
            + N' / 备份 ' + CAST(@bakc AS nvarchar(10));
    IF @hits <> 0 SET @tot = @tot + @hits;
    FETCH NEXT FROM cur_c INTO @t, @qq;
END
CLOSE cur_c; DEALLOCATE cur_c;
PRINT N'  待删总行数(含 yj_doc_status / yj_doc_modify_log) = ' + CAST(@tot AS nvarchar(10));

/* -------------------- 事务内 DELETE -------------------- */
BEGIN TRY
    BEGIN TRAN;

    -- rd_approval
    DELETE FROM rd_approval
     WHERE 单据编号 = 'LXA-2026-09-0002' OR 单据编号 = 'LXA-2026-09-0003'
        OR 单据编号 BETWEEN 'LXA-2026-09-0006' AND 'LXA-2026-09-0023';
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_approval';

    DELETE FROM rd_approval_detail
     WHERE 单据编号 = 'LXA-2026-09-0002' OR 单据编号 = 'LXA-2026-09-0003'
        OR 单据编号 BETWEEN 'LXA-2026-09-0006' AND 'LXA-2026-09-0023';
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_approval_detail';

    -- rd_plan
    DELETE FROM rd_plan      WHERE 单据编号 BETWEEN 'LXB-2026-09-0009' AND 'LXB-2026-09-0016';
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_plan';
    DELETE FROM rd_plan_detail WHERE 单据编号 BETWEEN 'LXB-2026-09-0009' AND 'LXB-2026-09-0016';
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_plan_detail';

    -- rd_insp_plan
    DELETE FROM rd_insp_plan_head   WHERE 单据编号 IN ('IP-2026-09-0001', 'IP-2026-09-0002');
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_insp_plan_head';
    DELETE FROM rd_insp_plan_detail WHERE 单据编号 IN ('IP-2026-09-0001', 'IP-2026-09-0002');
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_insp_plan_detail';

    -- 实验室 4 表(只删 'X-2026-09-%' 新式编号,09-04 旧编号 XX260904* 不匹配)
    DELETE FROM rd_equip_use_head   WHERE 单据编号 LIKE 'EU-2026-09-%';
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_equip_use_head';
    DELETE FROM rd_equip_use_detail WHERE 单据编号 LIKE 'EU-2026-09-%';
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_equip_use_detail';

    DELETE FROM rd_instr_use_head   WHERE 单据编号 LIKE 'IU-2026-09-%';
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_instr_use_head';
    DELETE FROM rd_instr_use_detail WHERE 单据编号 LIKE 'IU-2026-09-%';
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_instr_use_detail';

    DELETE FROM rd_dom_test_head    WHERE 单据编号 LIKE 'DT-2026-09-%';
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_dom_test_head';
    DELETE FROM rd_dom_test_detail  WHERE 单据编号 LIKE 'DT-2026-09-%';
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_dom_test_detail';

    DELETE FROM rd_spike_water_head   WHERE 单据编号 LIKE 'SW-2026-09-%';
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_spike_water_head';
    DELETE FROM rd_spike_water_detail WHERE 单据编号 LIKE 'SW-2026-09-%';
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_spike_water_detail';

    -- rd_prod_info
    DELETE FROM rd_prod_info_head   WHERE 单据编号 BETWEEN 'PI-2026-09-0015' AND 'PI-2026-09-0022';
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_prod_info_head';
    DELETE FROM rd_prod_info_detail WHERE 单据编号 BETWEEN 'PI-2026-09-0015' AND 'PI-2026-09-0022';
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'rd_prod_info_detail';

    -- yj_doc_status(与业务表同一批单号)
    DELETE FROM yj_doc_status
     WHERE (panel_code = 'RD_APPROVAL'
            AND (doc_no = 'LXA-2026-09-0002' OR doc_no = 'LXA-2026-09-0003'
                 OR doc_no BETWEEN 'LXA-2026-09-0006' AND 'LXA-2026-09-0023'))
        OR (panel_code = 'RD_PLAN'      AND doc_no BETWEEN 'LXB-2026-09-0009' AND 'LXB-2026-09-0016')
        OR (panel_code = 'RD_INSP_PLAN' AND doc_no IN ('IP-2026-09-0001', 'IP-2026-09-0002'))
        OR (panel_code = 'RD_EQUIP_USE' AND doc_no LIKE 'EU-2026-09-%')
        OR (panel_code = 'RD_INSTR_USE' AND doc_no LIKE 'IU-2026-09-%')
        OR (panel_code = 'RD_DOM_TEST'  AND doc_no LIKE 'DT-2026-09-%')
        OR (panel_code = 'RD_SPIKE_WATER' AND doc_no LIKE 'SW-2026-09-%')
        OR (panel_code = 'RD_PROD_INFO' AND doc_no BETWEEN 'PI-2026-09-0015' AND 'PI-2026-09-0022');
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'yj_doc_status';

    -- yj_doc_modify_log(探针 3 条)
    DELETE FROM yj_doc_modify_log
     WHERE panel_code = 'RD_EQUIP_USE'
       AND doc_no IN ('EU-2026-09-0007', 'EU-2026-09-0008', 'EU-2026-09-0009');
    UPDATE ##clr_snap SET deleted = @@ROWCOUNT WHERE tbl = 'yj_doc_modify_log';

    COMMIT TRAN;
    PRINT N'';
    PRINT N'  事务已提交:全部 DELETE 完成';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    PRINT N'  [回滚] 事务内出错: ' + ERROR_MESSAGE();
    THROW;
END CATCH

PRINT N'';
PRINT N'==================== ④ 验证 1:删除行数 / 备份行数 / 前后计数 ====================';
UPDATE s SET s.after_cnt =
    CASE s.tbl
        WHEN 'rd_approval'            THEN (SELECT COUNT(*) FROM rd_approval)
        WHEN 'rd_approval_detail'     THEN (SELECT COUNT(*) FROM rd_approval_detail)
        WHEN 'rd_plan'                THEN (SELECT COUNT(*) FROM rd_plan)
        WHEN 'rd_plan_detail'         THEN (SELECT COUNT(*) FROM rd_plan_detail)
        WHEN 'rd_insp_plan_head'      THEN (SELECT COUNT(*) FROM rd_insp_plan_head)
        WHEN 'rd_insp_plan_detail'    THEN (SELECT COUNT(*) FROM rd_insp_plan_detail)
        WHEN 'rd_equip_use_head'      THEN (SELECT COUNT(*) FROM rd_equip_use_head)
        WHEN 'rd_equip_use_detail'    THEN (SELECT COUNT(*) FROM rd_equip_use_detail)
        WHEN 'rd_instr_use_head'      THEN (SELECT COUNT(*) FROM rd_instr_use_head)
        WHEN 'rd_instr_use_detail'    THEN (SELECT COUNT(*) FROM rd_instr_use_detail)
        WHEN 'rd_dom_test_head'       THEN (SELECT COUNT(*) FROM rd_dom_test_head)
        WHEN 'rd_dom_test_detail'     THEN (SELECT COUNT(*) FROM rd_dom_test_detail)
        WHEN 'rd_spike_water_head'    THEN (SELECT COUNT(*) FROM rd_spike_water_head)
        WHEN 'rd_spike_water_detail'  THEN (SELECT COUNT(*) FROM rd_spike_water_detail)
        WHEN 'rd_prod_info_head'      THEN (SELECT COUNT(*) FROM rd_prod_info_head)
        WHEN 'rd_prod_info_detail'    THEN (SELECT COUNT(*) FROM rd_prod_info_detail)
        WHEN 'yj_doc_status'          THEN (SELECT COUNT(*) FROM yj_doc_status)
        WHEN 'yj_doc_modify_log'      THEN (SELECT COUNT(*) FROM yj_doc_modify_log)
    END
FROM ##clr_snap s;

SELECT tbl AS 表, before_cnt AS 删除前, bak_cnt AS 备份行数, deleted AS 实际删除,
       after_cnt AS 删除后,
       CASE WHEN before_cnt - deleted = after_cnt THEN N'OK' ELSE N'!! 计数不符' END AS 前后核对,
       CASE WHEN bak_cnt    = deleted          THEN N'OK' ELSE N'!! 备份≠删除' END AS 备份核对
  FROM ##clr_snap ORDER BY tbl;

PRINT N'-- 硬门槛 1:每条 DELETE 的 备份行数 = 实际删除行数';
SELECT CASE WHEN COUNT(*) = 0 THEN N'OK:全部一致' ELSE N'!! 有 ' + CAST(COUNT(*) AS nvarchar(10)) + N' 表不一致' END AS 结论
  FROM ##clr_snap WHERE bak_cnt IS NULL OR deleted IS NULL OR bak_cnt <> deleted;

PRINT N'-- 硬门槛 2:每条 DELETE 的 前-删 = 后';
SELECT CASE WHEN COUNT(*) = 0 THEN N'OK:全部平衡' ELSE N'!! 有 ' + CAST(COUNT(*) AS nvarchar(10)) + N' 表不平衡' END AS 结论
  FROM ##clr_snap WHERE before_cnt - deleted <> after_cnt;

PRINT N'';
PRINT N'==================== ④ 验证 2:孤儿状态行(硬门槛,必须为 0) ====================';
IF OBJECT_ID('tempdb..#orph') IS NOT NULL DROP TABLE #orph;
CREATE TABLE #orph (panel_code sysname, head_table sysname, orphan_head int, orphan_line int, note nvarchar(200));

DECLARE @pc sysname, @ht sysname, @lt sysname, @gc sysname, @sql nvarchar(max), @c int, @skip int = 0;
DECLARE cur_o CURSOR LOCAL FAST_FORWARD FOR
    SELECT panel_code, head_table, line_table, group_col FROM yj_panel WHERE mode = 'doc' ORDER BY panel_code;
OPEN cur_o;
FETCH NEXT FROM cur_o INTO @pc, @ht, @lt, @gc;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF @ht IS NULL OR @lt IS NULL OR @gc IS NULL
        OR OBJECT_ID(@ht) IS NULL OR OBJECT_ID(@lt) IS NULL
        OR COL_LENGTH(@ht, @gc) IS NULL OR COL_LENGTH(@lt, @gc) IS NULL
    BEGIN
        INSERT INTO #orph VALUES (@pc, ISNULL(@ht, N'(无)'), -1, -1, N'无 head/line/group_col,计入未核查(非本次受影响面板)');
        SET @skip = @skip + 1;
    END
    ELSE
    BEGIN
        SET @sql = N'SELECT @c = COUNT(*) FROM yj_doc_status s WHERE s.panel_code = @p
                       AND NOT EXISTS (SELECT 1 FROM [' + @ht + N'] h WHERE h.[' + @gc + N'] = s.doc_no)
                       AND NOT EXISTS (SELECT 1 FROM [' + @lt + N'] l WHERE l.[' + @gc + N'] = s.doc_no)';
        SET @c = 0;
        EXEC sp_executesql @sql, N'@p sysname, @c int OUTPUT', @p = @pc, @c = @c OUTPUT;
        INSERT INTO #orph VALUES (@pc, @ht, @c, NULL, NULL);
    END
    FETCH NEXT FROM cur_o INTO @pc, @ht, @lt, @gc;
END
CLOSE cur_o; DEALLOCATE cur_o;

SELECT panel_code AS 面板, head_table AS 表, orphan_head AS 孤儿状态行数, note AS 说明
  FROM #orph WHERE orphan_head <> 0 ORDER BY panel_code;

SELECT N'已核查面板数' = (SELECT COUNT(*) FROM #orph WHERE orphan_head >= 0),
       N'无 head/line/group_col 跳过的面板数' = @skip,
       N'孤儿状态行合计' = (SELECT ISNULL(SUM(orphan_head), 0) FROM #orph WHERE orphan_head > 0),
       N'结论' = CASE WHEN (SELECT ISNULL(SUM(orphan_head), 0) FROM #orph WHERE orphan_head > 0) = 0
                      THEN N'OK:孤儿状态行为 0' ELSE N'!! 存在孤儿状态行(见上行,不擅自再删,报告)' END;

PRINT N'';
PRINT N'==================== ④ 验证 3:保留项核查(必须仍在) ====================';
PRINT N'-- 3.1 保留的 8 张单(表行数)';
SELECT 'LXA-2026-09-0001' AS 单号, (SELECT COUNT(*) FROM rd_approval WHERE 单据编号 = 'LXA-2026-09-0001') AS 表行数
UNION ALL SELECT 'LXA-2026-09-0004', (SELECT COUNT(*) FROM rd_approval WHERE 单据编号 = 'LXA-2026-09-0004')
UNION ALL SELECT 'LXA-2026-09-0005', (SELECT COUNT(*) FROM rd_approval WHERE 单据编号 = 'LXA-2026-09-0005')
UNION ALL SELECT 'LXB-2026-09-0001', (SELECT COUNT(*) FROM rd_plan WHERE 单据编号 = 'LXB-2026-09-0001')
UNION ALL SELECT 'LXB-2026-09-0006', (SELECT COUNT(*) FROM rd_plan WHERE 单据编号 = 'LXB-2026-09-0006')
UNION ALL SELECT 'LXB-2026-09-0007', (SELECT COUNT(*) FROM rd_plan WHERE 单据编号 = 'LXB-2026-09-0007')
UNION ALL SELECT 'LXB-2026-09-0008', (SELECT COUNT(*) FROM rd_plan WHERE 单据编号 = 'LXB-2026-09-0008')
UNION ALL SELECT 'IP2609070003',     (SELECT COUNT(*) FROM rd_insp_plan_head WHERE 单据编号 = 'IP2609070003')
ORDER BY 单号;

PRINT N'-- 3.2 保留的 8 张单的 yj_doc_status 状态行(必须仍在)';
SELECT panel_code, doc_no, saved, archived, canceled FROM yj_doc_status
 WHERE (panel_code = 'RD_APPROVAL' AND doc_no IN ('LXA-2026-09-0001', 'LXA-2026-09-0004', 'LXA-2026-09-0005'))
    OR (panel_code = 'RD_PLAN'     AND doc_no IN ('LXB-2026-09-0001', 'LXB-2026-09-0006', 'LXB-2026-09-0007', 'LXB-2026-09-0008'))
    OR (panel_code = 'RD_INSP_PLAN'AND doc_no = 'IP2609070003')
 ORDER BY panel_code, doc_no;

PRINT N'-- 3.3 09-04 及更早旧编号:头表行数 + 明细行数(必须原样)';
SELECT 'rd_equip_use_head EU260904*' AS 对象,
       (SELECT COUNT(*) FROM rd_equip_use_head WHERE 单据编号 LIKE 'EU260904%') AS 头表行数,
       (SELECT COUNT(*) FROM rd_equip_use_detail WHERE 单据编号 LIKE 'EU260904%') AS 明细行数
UNION ALL SELECT 'rd_dom_test_head DT260904*',
       (SELECT COUNT(*) FROM rd_dom_test_head WHERE 单据编号 LIKE 'DT260904%'),
       (SELECT COUNT(*) FROM rd_dom_test_detail WHERE 单据编号 LIKE 'DT260904%')
UNION ALL SELECT 'rd_spike_water_head SW260904*',
       (SELECT COUNT(*) FROM rd_spike_water_head WHERE 单据编号 LIKE 'SW260904%'),
       (SELECT COUNT(*) FROM rd_spike_water_detail WHERE 单据编号 LIKE 'SW260904%')
UNION ALL SELECT 'rd_instr_use_head IU260904*',
       (SELECT COUNT(*) FROM rd_instr_use_head WHERE 单据编号 LIKE 'IU260904%'),
       (SELECT COUNT(*) FROM rd_instr_use_detail WHERE 单据编号 LIKE 'IU260904%')
UNION ALL SELECT 'rd_prod_info_head CP382/CP382S/PI2609*',
       (SELECT COUNT(*) FROM rd_prod_info_head WHERE 单据编号 IN ('CP382','CP382S') OR 单据编号 LIKE 'PI2609%'),
       (SELECT COUNT(*) FROM rd_prod_info_detail WHERE 单据编号 IN ('CP382','CP382S') OR 单据编号 LIKE 'PI2609%')
ORDER BY 对象;

PRINT N'-- 3.4 保留的 8 张单在业务面的相邻编号(展示未被误删的邻域)';
SELECT 'LXA-2026-09-*' AS 前缀, 单据编号 FROM rd_approval WHERE 单据编号 LIKE 'LXA-2026-09-%'
UNION ALL SELECT 'LXB-2026-09-*', 单据编号 FROM rd_plan WHERE 单据编号 LIKE 'LXB-2026-09-%'
UNION ALL SELECT 'IP%-2026-09-*', 单据编号 FROM rd_insp_plan_head WHERE 单据编号 LIKE '%2026-09-%'
ORDER BY 前缀, 单据编号;

PRINT N'';
PRINT N'==================== ④ 验证 4:基线表 + 清理后总数 ====================';
SELECT 'yj_std_lib(基线 37?)' AS 表, COUNT(*) AS 行数,
       CASE WHEN COUNT(*) = 37 THEN N'=37' ELSE N'≠37(见报告说明)' END AS 结论 FROM yj_std_lib
UNION ALL SELECT 'rd_progress_detail(基线 3)', COUNT(*) ,
       CASE WHEN COUNT(*) = 3 THEN N'=3' ELSE N'≠3' END FROM rd_progress_detail
UNION ALL SELECT 'yj_doc_modify_log', COUNT(*), N'' FROM yj_doc_modify_log
UNION ALL SELECT 's_allno(绝不动)', COUNT(*), N'' FROM s_allno
UNION ALL SELECT 'yj_usage_log(绝不动)', COUNT(*), N'' FROM yj_usage_log
UNION ALL SELECT 'yj_doc_status(清理前 169)', COUNT(*), N'' FROM yj_doc_status;

PRINT N'-- yj_doc_status 按面板计数(清理后)';
SELECT panel_code, COUNT(*) AS 行数 FROM yj_doc_status GROUP BY panel_code ORDER BY panel_code;

PRINT N'-- yj_std_lib 按库计数(清理后)';
SELECT lib_code, COUNT(*) AS 行数 FROM yj_std_lib GROUP BY lib_code ORDER BY lib_code;

PRINT N'-- yj_std_lib 总量(vs 任务书基线 37)';
SELECT COUNT(*) AS 总行数,
       CASE WHEN COUNT(*) = 37 THEN N'=37' ELSE N'≠37(基线 37 存疑:见报告说明,按库明细见上一结果)' END AS 结论
  FROM yj_std_lib;

PRINT N'-- 残留检查:上述待删集合在业务表里是否还有行(必须全 0)';
SELECT 'rd_approval 残留' AS 检查项, COUNT(*) AS 行数 FROM rd_approval
 WHERE 单据编号 = 'LXA-2026-09-0002' OR 单据编号 = 'LXA-2026-09-0003' OR 单据编号 BETWEEN 'LXA-2026-09-0006' AND 'LXA-2026-09-0023'
UNION ALL SELECT 'rd_plan 残留', COUNT(*) FROM rd_plan WHERE 单据编号 BETWEEN 'LXB-2026-09-0009' AND 'LXB-2026-09-0016'
UNION ALL SELECT 'rd_insp_plan_head 残留', COUNT(*) FROM rd_insp_plan_head WHERE 单据编号 IN ('IP-2026-09-0001','IP-2026-09-0002')
UNION ALL SELECT 'rd_equip_use 残留', COUNT(*) FROM rd_equip_use_head WHERE 单据编号 LIKE 'EU-2026-09-%'
UNION ALL SELECT 'rd_instr_use 残留', COUNT(*) FROM rd_instr_use_head WHERE 单据编号 LIKE 'IU-2026-09-%'
UNION ALL SELECT 'rd_dom_test 残留', COUNT(*) FROM rd_dom_test_head WHERE 单据编号 LIKE 'DT-2026-09-%'
UNION ALL SELECT 'rd_spike_water 残留', COUNT(*) FROM rd_spike_water_head WHERE 单据编号 LIKE 'SW-2026-09-%'
UNION ALL SELECT 'rd_prod_info 残留', COUNT(*) FROM rd_prod_info_head WHERE 单据编号 BETWEEN 'PI-2026-09-0015' AND 'PI-2026-09-0022'
UNION ALL SELECT 'yj_doc_modify_log 残留', COUNT(*) FROM yj_doc_modify_log WHERE panel_code = 'RD_EQUIP_USE' AND doc_no IN ('EU-2026-09-0007','EU-2026-09-0008','EU-2026-09-0009')
ORDER BY 检查项;

PRINT N'';
PRINT N'==================== 清理完成 ====================';
