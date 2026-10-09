SET NOCOUNT ON;
-- _q-finin-usage.sql — 产成品入库单在生产链里的真实作用(只读)
SELECT 'plang 总行' AS k, COUNT(*) AS n FROM dbo.plang
UNION ALL SELECT 'plang.rk_sl>0(已完工入库)', COUNT(*) FROM dbo.plang WHERE ISNULL(rk_sl,0) > 0
UNION ALL SELECT 'plang.rk_no 非空', COUNT(*) FROM dbo.plang WHERE ISNULL(rk_no,N'') <> N''
UNION ALL SELECT 'plang.ll_no2 非空(领料回填)', COUNT(*) FROM dbo.plang WHERE ISNULL(ll_no2,N'') <> N''
UNION ALL SELECT 'plang.cp_date2 非空(完工日)', COUNT(*) FROM dbo.plang WHERE cp_date2 IS NOT NULL;
GO
SELECT 'scjl 总行' AS k, COUNT(*) AS n FROM dbo.scjl
UNION ALL SELECT 'scjl.post_no 非空(完工单号回填)', COUNT(*) FROM dbo.scjl WHERE ISNULL(post_no,N'') <> N'';
GO
SELECT 'bd_material_out 单数' AS k, COUNT(*) AS n FROM dbo.bd_material_out
UNION ALL SELECT 'bd_material_out 挂工单数', COUNT(*) FROM dbo.bd_material_out WHERE ISNULL(加工单号,N'') <> N''
UNION ALL SELECT 'bd_finish_in 单数', COUNT(*) FROM dbo.bd_finish_in
UNION ALL SELECT 'bd_finish_in 已审核数(状态表 shr 非空)', COUNT(*) FROM dbo.bd_finish_in h JOIN dbo.yj_doc_status s ON s.panel_code='FINISH_IN' AND s.doc_no=h.单据编号 WHERE s.shr IS NOT NULL;
GO
-- 产成品入库单那张唯一单据的完整内容(要备份)
SELECT * FROM dbo.bd_finish_in;
GO
SELECT * FROM dbo.bl_finish_in;
GO
-- 生产工单面板绑定哪张表、有多少工单
SELECT panel_code, panel_name, RTRIM(ISNULL(head_table,'')) AS head_table, RTRIM(ISNULL(line_table,'')) AS line_table
FROM yj_panel WHERE panel_code LIKE 'MANU%' OR panel_code LIKE 'WO%' ORDER BY panel_code;
GO
SELECT TOP 5 pl_no, 批次号, pl_sl, rk_sl, yl, rk_no, cp_date2, asp_cancel FROM dbo.plang ORDER BY id DESC;
