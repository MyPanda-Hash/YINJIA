SELECT panel_code, label, place, required, visible, hidden FROM yj_field
WHERE RTRIM(panel_code) = 'PU_ORDER' AND place LIKE '%detail%' AND label IN (N'单价', N'仓库', N'含税单价')
ORDER BY label, place;
