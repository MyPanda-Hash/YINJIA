DECLARE @ids TABLE (id int);
INSERT INTO @ids (id) SELECT id FROM dbo.plang WHERE pl_no IN (N'GD-2026-11-0015', N'GD-2026-11-0016')
  AND od_no = N'ZL-20261016-01';
SELECT '待删工单行' AS 项, COUNT(*) AS 行数 FROM @ids;
DELETE FROM dbo.wo_process_line WHERE 工单行id IN (SELECT id FROM @ids);
DELETE FROM dbo.form_flow_link WHERE target_panel_code = 'PLANG' AND target_form_no IN (N'GD-2026-11-0015', N'GD-2026-11-0016');
DELETE FROM dbo.plang WHERE id IN (SELECT id FROM @ids);
SELECT '残留工单行' AS 项, COUNT(*) AS 行数 FROM dbo.plang WHERE pl_no IN (N'GD-2026-11-0015', N'GD-2026-11-0016');
SELECT '残留占用链' AS 项, COUNT(*) AS 行数 FROM dbo.form_flow_link WHERE target_form_no IN (N'GD-2026-11-0015', N'GD-2026-11-0016');
SELECT 'ZL-20261016-01 剩余工单行' AS 项, COUNT(*) AS 行数 FROM dbo.plang WHERE od_no = N'ZL-20261016-01';
GO
