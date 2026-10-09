SET NOCOUNT ON;
DECLARE @names TABLE (n nvarchar(120) PRIMARY KEY);
INSERT INTO @names (n) VALUES
 (N'migrate-lab-sheets-date-fields-2026-10-07.sql'), (N'migrate-server-converge-20261007.sql'),
 (N'migrate-fourdoc-bloodline-cols-20261008.sql'), (N'migrate-fourdoc-missing-cols-20261008.sql'),
 (N'migrate-fourdoc-baseline-restore-20261008.sql'),
 (N'migrate-whloc-rename-bin-20261008.sql'), (N'migrate-whloc-area-a-raw-20261008.sql'),
 (N'migrate-whloc-clean-coord-20261008.sql'), (N'migrate-whloc-rest-20261008.sql'),
 (N'migrate-whloc-zone-logic-20261008.sql'), (N'migrate-whloc-newplant-20261008.sql'),
 (N'migrate-whloc-newplant-drop-20261008.sql'), (N'migrate-whloc-zonepick-20261008.sql'),
 (N'migrate-align-ledger-fields-20261008.sql'), (N'migrate-align-ledger-fields2-20261008.sql'),
 (N'migrate-wh-kingdee-only-20261008.sql'), (N'migrate-drop-extra-docs-pu-req-20261008.sql'),
 (N'migrate-fix-report-views-id-aspcancel-20261009.sql'), (N'migrate-drop-qc-unused-panels-20261009.sql');
PRINT N'库 = ' + DB_NAME();
SELECT n.n AS 脚本, CASE WHEN l.script_name IS NULL THEN N'❌ 未登记(本次会执行)' ELSE N'✅ 已登记(跳过)' END AS 状态, l.applied_at AS 登记时间
  FROM @names n LEFT JOIN yj_schema_log l ON l.script_name = n.n
 ORDER BY CASE WHEN l.script_name IS NULL THEN 0 ELSE 1 END, n.n;
PRINT N'-- 四单面板/字段现状(基线闸口径)';
SELECT (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_RECV') AS QC_RECV字段,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_INSP') AS QC_INSP字段,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_RETURN') AS QC_RETURN字段,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code='PURCHASE_IN') AS PURCHASE_IN字段;
PRINT N'-- bs_wh 现状(仓位数)';
SELECT COUNT(*) AS 未作废仓库数 FROM bs_wh WHERE ISNULL(asp_cancel,N'N')<>N'Y';
SELECT RTRIM(仓库编码) AS 编码, RTRIM(仓库名称) AS 名称, ISNULL(状态,N'') AS 状态 FROM bs_wh WHERE ISNULL(asp_cancel,N'N')<>N'Y' ORDER BY 仓库编码;
PRINT N'-- 已下架面板是否还在(应为 0 行)';
SELECT COUNT(*) AS 残留下架面板 FROM yj_panel WHERE panel_code IN ('PU_REQ','QC_OP','QC_RECORD','QC_DISPOSAL','ROD_RETURN','LOT_TRACE');
