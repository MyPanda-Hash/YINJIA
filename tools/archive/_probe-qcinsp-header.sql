SET NOCOUNT ON;
-- 仅取表头相关行(不受 50 行截断影响),两库同口径对比
SELECT id, place, seq, col_name, label, hidden, visible FROM yj_field WHERE panel_code='QC_INSP' AND place LIKE '%header%' ORDER BY seq, id;
GO
-- 全库体检:同一面板同列名多行且都占 header 位的(重复渲染风险)
SELECT panel_code, col_name, COUNT(*) cnt FROM yj_field WHERE place LIKE '%header%' GROUP BY panel_code, col_name HAVING COUNT(*)>1 ORDER BY panel_code;
GO
