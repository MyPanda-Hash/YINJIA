-- migrate-qc-insp-req-filecode-basis.sql — 要求表增「文件编码/检验依据」两列(每张表都在物料编号后面)
--                                             + 检验报告的这两项改为靠物料编码带入且不可修改
--
-- 用户口径(2026-10-04 第五轮):
--   ①「检验报告里面的文件编码与检验依据,要靠物料编码来对应填入,并且不可以修改」;
--   ②「为每个表格(两个面板)都增加这两列在物料编码后面」。
--
-- 落地:
--   · 两个要求表(qc_insp_req / qc_insp_req_series)各加 2 列 `文件编码`/`检验依据` nvarchar(100) NULL;
--   · yj_field 为两个要求面板各登记这 2 个字段(place='detail',seq 25/28 —— 排在 物料编号(seq 20)之后、
--     固定表列(seq 30+)之前);前端两张表的列序也把这两列放在 物料编号 后面
--     (固定表面板在 qcInspReqConfig.js 每张表的 cols 里加;系列面板在 qcInspReqCols 的"匹配键列"里加);
--   · **检验报告(QC_INSP_REC)** 的 文件编码/检验依据 由「可编辑」改为**不可修改**(yj_field.editable=0),
--     值由报告按物料编码带入(带入口径见 core/qc/qcInspReqCarry.js 的 carryHeadOf:取命中行首个非空值;
--     要求表没填时保留报告原值/默认 YJ-QR-96 / YJ-Q-30)。
--
-- 幂等:列/字段/译名均加存在性守卫。两账套都要执行:
--   正式 java -cp lib\mssql-jdbc.jar DbSync.java run migrate-qc-insp-req-filecode-basis.sql
--   测试 YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar DbSync.java run migrate-qc-insp-req-filecode-basis.sql
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库时不得被切走)
GO

-- ═════════════ 1. 两个要求表各加两列 ═════════════
IF COL_LENGTH('qc_insp_req', N'文件编码') IS NULL ALTER TABLE qc_insp_req ADD [文件编码] nvarchar(100) NULL;
IF COL_LENGTH('qc_insp_req', N'检验依据') IS NULL ALTER TABLE qc_insp_req ADD [检验依据] nvarchar(100) NULL;
IF COL_LENGTH('qc_insp_req_series', N'文件编码') IS NULL ALTER TABLE qc_insp_req_series ADD [文件编码] nvarchar(100) NULL;
IF COL_LENGTH('qc_insp_req_series', N'检验依据') IS NULL ALTER TABLE qc_insp_req_series ADD [检验依据] nvarchar(100) NULL;
PRINT N'[OK] 两张要求表的 文件编码/检验依据 列已就位';
GO
-- 列级中文注明(AGENTS.md 2026-09-14 起强制)
DECLARE @cols TABLE (t sysname, c sysname, d nvarchar(300));
INSERT INTO @cols VALUES
  (N'qc_insp_req', N'文件编码', N'文件编码(该物料的检验文件编号;检验报告按物料编码带入,报告内不可修改)'),
  (N'qc_insp_req', N'检验依据', N'检验依据(该物料的检验依据文件号;检验报告按物料编码带入,报告内不可修改)'),
  (N'qc_insp_req_series', N'文件编码', N'文件编码(该物料的检验文件编号;检验报告按物料编码带入,报告内不可修改)'),
  (N'qc_insp_req_series', N'检验依据', N'检验依据(该物料的检验依据文件号;检验报告按物料编码带入,报告内不可修改)');
DECLARE @t sysname, @c sysname, @d nvarchar(300);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT t, c, d FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @t, @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(@t)
             AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(@t), @c, 'ColumnId') AND ep.name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  ELSE
    EXEC sp_addextendedproperty    N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @t, @c, @d;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[OK] 列注明已写';
GO

-- ═════════════ 2. 两个要求面板登记这两个字段(排在 物料编号 之后) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REQ' AND col_name=N'文件编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
VALUES ('QC_INSP_REQ', N'文件编码', N'文件编码', N'文本', N'detail', 25, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REQ' AND col_name=N'检验依据')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
VALUES ('QC_INSP_REQ', N'检验依据', N'检验依据', N'文本', N'detail', 28, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REQ_SERIES' AND col_name=N'文件编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
VALUES ('QC_INSP_REQ_SERIES', N'文件编码', N'文件编码', N'文本', N'detail', 25, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REQ_SERIES' AND col_name=N'检验依据')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
VALUES ('QC_INSP_REQ_SERIES', N'检验依据', N'检验依据', N'文本', N'detail', 28, 130, 1, 0, 0, 1);
PRINT N'[OK] 两个要求面板的 文件编码/检验依据 字段已登记(seq 25/28,紧跟 物料编号)';
GO

-- ═════════════ 3. 检验报告:这两项改为不可修改(靠物料编码带入) ═════════════
UPDATE yj_field SET editable = 0
 WHERE panel_code = 'QC_INSP_REC' AND col_name IN (N'文件编码', N'检验依据') AND editable <> 0;
PRINT N'[OK] 检验报告 文件编码/检验依据 已置为不可修改 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 个字段';
GO
-- 面板缓存刷新:本脚本只改元数据,服务端 PanelRegistry 30s TTL 自动重载;这里无需额外动作。
-- (若想立刻生效可重启应用或等 TTL —— 前端切页签/保存后也会重取配置。)

-- ═════════════ 自检 ═════════════
SELECT N'列' AS k, t.name AS 表, c.name AS 列, CAST(ep.value AS nvarchar(120)) AS 注明
  FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name='MS_Description'
 WHERE t.name IN ('qc_insp_req','qc_insp_req_series') AND c.name IN (N'文件编码', N'检验依据') ORDER BY t.name, c.name;
SELECT N'要求面板字段' AS k, panel_code, col_name, label, place, seq, editable
  FROM yj_field WHERE panel_code IN ('QC_INSP_REQ','QC_INSP_REQ_SERIES') AND col_name IN (N'文件编码', N'检验依据')
 ORDER BY panel_code, seq;
SELECT N'检验报告字段(应为 editable=0)' AS k, col_name, place, seq, editable
  FROM yj_field WHERE panel_code = 'QC_INSP_REC' AND col_name IN (N'文件编码', N'检验依据') ORDER BY seq;
GO
