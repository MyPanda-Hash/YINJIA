/* ============================================================================
 * migrate-qc-insp-req-trim-fixed-cols-20261111.sql
 * 来料检验要求 / 来料检验要求(系列):删掉固定检验列,只留 物料编号·文件编码·检验依据 + 自定义列
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-11):「将来料检验要求和来料检验要求(系列)的字段删除只保留物料编码和
 *   文件编码和检验依据这 3 个字段和自定义的字段。」
 *   追问确认:①**连物理列一起删**(历史数据丢失,已先打整库备份);②自定义字段必须是
 *   「一个父目录 + 两个子目录」的格式;③检验报告带入按 父目录第 1 行 / 子目录1 第 2 行 /
 *   子目录2 第 3 行,数据落在子行。
 *
 * 本脚本(幂等;两账套均执行):
 *   ① `qc_insp_req` 删掉 32 个固定检验列(折叠棉/炭棒/…/脏污、头发丝);
 *      **保留**:id、物料类别(页签键)、物料编号、文件编码、检验依据、备用1..备用140、asp_* 审计列;
 *   ② `qc_insp_req_series` 本来就只有这 4 个业务列(检核用,不删);
 *   ③ `yj_field` 删掉对应的字段注册行(label = 被删列名),自定义列(备用N)与 3 个前置列原样保留;
 *   ④ 自检:两张表只剩白名单列 + 备用列,且 yj_field 里不再有被删字段。
 *
 * ⚠ 备份:D:\SQLData\HSDZ_MES-before-reqfields-20261111.bak / HSDZ_MES_TEST-before-reqfields-...
 * ⚠ 只允许在本机两个账套执行(防误伤巡检库/服务器库)。
 * ========================================================================== */

SET NOCOUNT ON;
GO
IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
BEGIN
    RAISERROR(N'本脚本只用于本机 HSDZ_MES / HSDZ_MES_TEST;当前库 %s 拒绝执行', 16, 1, 1);
    RETURN;
END
GO

/* ---- ① 删 qc_insp_req 的固定检验列(保留白名单 + 备用N + asp_*) ---- */
DECLARE @keep TABLE (name sysname PRIMARY KEY);
INSERT INTO @keep (name) VALUES (N'id'), (N'物料类别'), (N'物料编号'), (N'文件编码'), (N'检验依据');

DECLARE @drop TABLE (name sysname);
INSERT INTO @drop (name)
SELECT c.name FROM sys.columns c
 WHERE c.object_id = OBJECT_ID(N'dbo.qc_insp_req')
   AND c.name NOT IN (SELECT name FROM @keep)
   AND c.name NOT LIKE N'备用%'
   AND c.name NOT LIKE N'asp[_]%';

DECLARE @name sysname, @sql nvarchar(400), @n int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM @drop;
OPEN cur;
FETCH NEXT FROM cur INTO @name;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'ALTER TABLE dbo.qc_insp_req DROP COLUMN [' + @name + N'];';
    EXEC sp_executesql @sql;
    SET @n += 1;
    FETCH NEXT FROM cur INTO @name;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[删列] qc_insp_req 删除固定检验列: ' + CAST(@n AS nvarchar(10)) + N' 个';
GO

/* ---- ② yj_field:被删列对应的字段注册行一并删掉(自定义列=备用N、3 个前置列保留) ---- */
DELETE FROM yj_field
 WHERE panel_code = N'QC_INSP_REQ'
   AND col_name NOT IN (N'物料类别', N'物料编号', N'文件编码', N'检验依据')
   AND col_name NOT LIKE N'备用%';
PRINT N'[字段] QC_INSP_REQ 删除字段注册行: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* 系列面板:业务列本来就只有 4 个,这里只清掉"列已不存在"的脏注册行 */
DELETE FROM yj_field
 WHERE panel_code = N'QC_INSP_REQ_SERIES'
   AND col_name NOT IN (N'物料类别', N'物料编号', N'文件编码', N'检验依据')
   AND col_name NOT LIKE N'备用%';
PRINT N'[字段] QC_INSP_REQ_SERIES 删除字段注册行: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ---- ③ 自检 ---- */
IF EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.qc_insp_req')
             AND c.name NOT IN (N'id', N'物料类别', N'物料编号', N'文件编码', N'检验依据')
             AND c.name NOT LIKE N'备用%' AND c.name NOT LIKE N'asp[_]%')
    RAISERROR(N'qc_insp_req 仍有非白名单列未删除', 16, 1);
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REQ'
             AND col_name NOT IN (N'物料类别', N'物料编号', N'文件编码', N'检验依据')
             AND col_name NOT LIKE N'备用%')
    RAISERROR(N'QC_INSP_REQ 仍有被删列的字段注册行', 16, 1);

SELECT N'qc_insp_req 列数' AS 项, COUNT(*) AS 值 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.qc_insp_req')
UNION ALL SELECT N'qc_insp_req 行数', COUNT(*) FROM dbo.qc_insp_req
UNION ALL SELECT N'QC_INSP_REQ 字段', COUNT(*) FROM yj_field WHERE panel_code = N'QC_INSP_REQ'
UNION ALL SELECT N'QC_INSP_REQ_SERIES 字段', COUNT(*) FROM yj_field WHERE panel_code = N'QC_INSP_REQ_SERIES';

SELECT label, col_name, col_group, tab_key FROM yj_field
 WHERE panel_code IN (N'QC_INSP_REQ', N'QC_INSP_REQ_SERIES') ORDER BY panel_code, seq;

PRINT N'✅ 来料检验要求两面板已瘦身(只留 物料编号/文件编码/检验依据 + 自定义列)';
GO
