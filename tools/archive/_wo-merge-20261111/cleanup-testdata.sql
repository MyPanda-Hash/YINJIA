DECLARE @ids TABLE (id int);
INSERT INTO @ids (id) SELECT id FROM dbo.plang WHERE pl_no IN (N'GD-2026-11-0002', N'GD-2026-11-0003', N'GD-2026-11-0004');
SELECT '待删工单行' AS 项, COUNT(*) AS 行数 FROM @ids;
DELETE FROM dbo.wo_process_line WHERE 工单行id IN (SELECT id FROM @ids);
SELECT '删台账' AS 项, @@ROWCOUNT AS 行数;
DELETE FROM dbo.form_flow_link WHERE target_panel_code = 'PLANG' AND target_form_no IN (N'GD-2026-11-0002', N'GD-2026-11-0003', N'GD-2026-11-0004');
SELECT '删占用链' AS 项, @@ROWCOUNT AS 行数;
DELETE FROM dbo.plang WHERE id IN (SELECT id FROM @ids);
SELECT '删工单行' AS 项, @@ROWCOUNT AS 行数;
SELECT COUNT(*) AS 残留行 FROM dbo.plang WHERE pl_no IN (N'GD-2026-11-0002', N'GD-2026-11-0003', N'GD-2026-11-0004');
SELECT COUNT(*) AS 订单剩余占用 FROM dbo.form_flow_link WHERE source_form_no = N'ZL-20261016-01' AND target_form_no LIKE N'GD-2026-11-%';
GO
