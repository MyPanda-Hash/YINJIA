SET NOCOUNT ON
SELECT '角色数: '+CAST(COUNT(*) AS varchar) FROM yj_role
SELECT '授权行总数: '+CAST(COUNT(*) AS varchar) FROM yj_role_panel
SELECT '角色: '+r.role_name+N' (id='+CAST(r.id AS varchar)+N') 授权 '+CAST(COUNT(rp.panel_code) AS varchar)+N' 个面板' FROM yj_role r LEFT JOIN yj_role_panel rp ON rp.role_id=r.id GROUP BY r.id, r.role_name
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('yj_role_panel')
