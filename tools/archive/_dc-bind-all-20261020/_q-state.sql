SET NOCOUNT ON;
SELECT 'device_total' AS k, COUNT(*) AS v FROM bs_dc_device WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'device_enabled', COUNT(*) FROM bs_dc_device WHERE ISNULL(asp_cancel,'N')<>'Y' AND enabled='Y'
UNION ALL SELECT 'has_gateway', COUNT(*) FROM bs_dc_device WHERE ISNULL(asp_cancel,'N')<>'Y' AND gateway_id IS NOT NULL
UNION ALL SELECT 'has_project', COUNT(*) FROM bs_dc_device WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(project_code,'')<>''
UNION ALL SELECT 'scada_Y', COUNT(*) FROM bs_dc_device WHERE ISNULL(asp_cancel,'N')<>'Y' AND scada_drawn='Y'
UNION ALL SELECT 'has_debug', COUNT(*) FROM bs_dc_device WHERE ISNULL(asp_cancel,'N')<>'Y' AND last_debug_at IS NOT NULL
UNION ALL SELECT 'gateways', COUNT(*) FROM bs_dc_gateway WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'rules', COUNT(*) FROM bs_dc_rule WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'points', COUNT(*) FROM bs_dc_point WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
SELECT device_type, COUNT(*) AS n FROM bs_dc_device WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY device_type ORDER BY n DESC;
GO
SELECT id, code, name, protocol, host, port, status, enabled FROM bs_dc_gateway WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
SELECT TOP 5 id, code, name, device_type, gateway_id, project_code, scada_drawn, last_debug_at, heartbeat_seconds FROM bs_dc_device WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id;
GO
