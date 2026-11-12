SET NOCOUNT ON;
SELECT r.role_code,
       MAX(CASE WHEN p.panel_code = N'QC_FLOW' AND p.perms LIKE '%view%' THEN 1 ELSE 0 END) AS 有看板,
       MAX(CASE WHEN p.panel_code = N'QC_RECV' AND p.perms LIKE '%view%' THEN 1 ELSE 0 END) AS 有送料,
       MAX(CASE WHEN p.panel_code = N'QC_INSP' AND p.perms LIKE '%view%' THEN 1 ELSE 0 END) AS 有检验,
       MAX(CASE WHEN p.panel_code = N'PURCHASE_IN' AND p.perms LIKE '%view%' THEN 1 ELSE 0 END) AS 有入库
  FROM dbo.yj_role r LEFT JOIN dbo.yj_role_panel p ON p.role_id = r.id
 GROUP BY r.role_code ORDER BY r.role_code;
