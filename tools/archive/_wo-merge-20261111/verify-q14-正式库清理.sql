SELECT COUNT(*) AS 残留工单行 FROM dbo.plang WHERE pl_no IN (N'GD-2026-11-0015', N'GD-2026-11-0016');
SELECT COUNT(*) AS 残留占用链 FROM dbo.form_flow_link WHERE target_form_no IN (N'GD-2026-11-0015', N'GD-2026-11-0016');
SELECT COUNT(*) AS 该订单工单行 FROM dbo.plang WHERE od_no = N'ZL-20261016-01';
SELECT COUNT(*) AS 该订单占用链 FROM dbo.form_flow_link WHERE source_form_no = N'ZL-20261016-01';
GO
