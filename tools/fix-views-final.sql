-- 修复 final:给视图套一层 SELECT *, asp_cancel=NULL AS asp_cancel(包装层法)
USE HSDZ_MES;
SET NOCOUNT ON;
-- 先 DROP 所有现存视图
DECLARE @n sysname, @d nvarchar(max);
DECLARE c CURSOR FOR SELECT name FROM sys.views WHERE name LIKE 'v[_]%';
OPEN c; FETCH NEXT FROM c INTO @n;
WHILE @@FETCH_STATUS = 0 BEGIN SET @d = N'DROP VIEW [' + @n + N']'; EXEC(@d); FETCH NEXT FROM c INTO @n; END
CLOSE c; DEALLOCATE c;
-- 重建:DETAIL 视图(包装层:SELECT *, NULL AS asp_cancel FROM (原查询) t)
EXEC('CREATE VIEW v_purchase_in_detail AS SELECT t.*, CAST(NULL AS char(1)) AS asp_cancel FROM (SELECT h.*, l.id AS line_id, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位], l.[数量], l.[实收数量], l.[单价], l.[金额], l.[备注] AS [行备注] FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON h.[单据编号]=l.[单据编号]) t');
EXEC('CREATE VIEW v_finish_in_detail AS SELECT t.*, CAST(NULL AS char(1)) AS asp_cancel FROM (SELECT h.*, l.id AS line_id, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位], l.[数量], l.[实收数量], l.[单价], l.[金额], l.[备注] AS [行备注] FROM bd_finish_in h LEFT JOIN bl_finish_in l ON h.[单据编号]=l.[单据编号]) t');
EXEC('CREATE VIEW v_other_in_detail AS SELECT t.*, CAST(NULL AS char(1)) AS asp_cancel FROM (SELECT h.*, l.id AS line_id, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位], l.[数量], l.[实收数量], l.[单价], l.[金额], l.[备注] AS [行备注] FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号]=l.[单据编号]) t');
EXEC('CREATE VIEW v_sale_out_detail AS SELECT t.*, CAST(NULL AS char(1)) AS asp_cancel FROM (SELECT h.*, l.id AS line_id, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位], l.[数量], l.[成本金额], l.[备注] AS [行备注] FROM bd_sale_out h LEFT JOIN bl_sale_out l ON h.[单据编号]=l.[单据编号]) t');
EXEC('CREATE VIEW v_material_out_detail AS SELECT t.*, CAST(NULL AS char(1)) AS asp_cancel FROM (SELECT h.*, l.id AS line_id, l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位], l.[数量], l.[成本金额], l.[备注] AS [行备注] FROM bd_material_out h LEFT JOIN bl_material_out l ON h.[单据编号]=l.[单据编号]) t');
EXEC('CREATE VIEW v_other_out_detail AS SELECT t.*, CAST(NULL AS char(1)) AS asp_cancel FROM (SELECT h.*, l.id AS line_id, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位], l.[数量], l.[金额], l.[备注] AS [行备注] FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号]=l.[单据编号]) t');
EXEC('CREATE VIEW v_manu_order_detail AS SELECT t.*, CAST(NULL AS char(1)) AS asp_cancel FROM (SELECT h.*, l.id AS line_id FROM bd_manu_order h LEFT JOIN bl_manu_order l ON h.[合同号]=l.[合同号]) t');
EXEC('CREATE VIEW v_dispatch_detail AS SELECT t.*, CAST(NULL AS char(1)) AS asp_cancel FROM (SELECT h.*, l.id AS line_id FROM bd_dispatch h LEFT JOIN bl_dispatch l ON h.[单据编号]=l.[单据编号]) t');
EXEC('CREATE VIEW v_outsource_issue_detail AS SELECT t.*, CAST(NULL AS char(1)) AS asp_cancel FROM (SELECT h.*, l.id AS line_id FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号]) t');
EXEC('CREATE VIEW v_outsource_in_detail AS SELECT t.*, CAST(NULL AS char(1)) AS asp_cancel FROM (SELECT h.*, l.id AS line_id FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号]=l.[单据编号]) t');
PRINT 'DETAIL 10 OK';
-- STATS 视图(带 asp_cancel,REPORT 字段自动发现)
EXEC('CREATE VIEW v_purchase_in_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_finish_in_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_finish_in h LEFT JOIN bl_finish_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_other_in_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_sale_out_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_sale_out h LEFT JOIN bl_sale_out l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_material_out_stats AS SELECT h.[单据日期], h.asp_cancel, l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_material_out h LEFT JOIN bl_material_out l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_other_out_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_manu_order_stats AS SELECT h.asp_cancel, l.[产品编码], l.[产品名称], COUNT(DISTINCT h.[合同号]) AS [单据数], SUM(COALESCE(l.[计划数量],0)) AS [计划数量], SUM(COALESCE(l.[完工数量],0)) AS [完工数量] FROM bd_manu_order h LEFT JOIN bl_manu_order l ON h.[合同号]=l.[合同号] GROUP BY h.asp_cancel, l.[产品编码], l.[产品名称]');
EXEC('CREATE VIEW v_dispatch_stats AS SELECT h.[单据日期], h.asp_cancel, l.[生产车间], l.[工序编码], l.[工序名称], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [派工单数], SUM(COALESCE(l.[计划数量],0)) AS [计划数量], SUM(COALESCE(l.[派工数量],0)) AS [派工数量], SUM(COALESCE(l.[已派工数量],0)) AS [已派工数量], SUM(COALESCE(l.[累计汇报数量],0)) AS [累计汇报数量], MAX(l.[派工加工状态]) AS [派工加工状态] FROM bd_dispatch h LEFT JOIN bl_dispatch l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[生产车间], l.[工序编码], l.[工序名称], l.[计量单位]');
EXEC('CREATE VIEW v_outsource_issue_stats AS SELECT h.[单据日期], h.asp_cancel, h.[委外供应商], l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [发料单数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_outsource_in_stats AS SELECT h.[单据日期], h.asp_cancel, h.[委外供应商], l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [入库单数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位]');
PRINT 'STATS 10 OK';
SELECT COUNT(*) AS views FROM sys.views WHERE name LIKE 'v[_]%';

