-- 最终修复:DETAIL 视图用 h.* (含 asp_cancel) + l.列(排除重复),不加外层包装
USE HSDZ_MES;
SET NOCOUNT ON;
DECLARE @dn sysname, @dd nvarchar(max);
DECLARE dc CURSOR FOR SELECT name FROM sys.views WHERE name LIKE 'v[_]%';
OPEN dc; FETCH NEXT FROM dc INTO @dn;
WHILE @@FETCH_STATUS = 0 BEGIN SET @dd = N'DROP VIEW [' + @dn + N']'; EXEC(@dd); FETCH NEXT FROM dc INTO @dn; END
CLOSE dc; DEALLOCATE dc;

DECLARE @pairs TABLE (code varchar(50), head sysname, line sysname, noCol sysname);
INSERT INTO @pairs VALUES
('purchase_in','bd_purchase_in','bl_purchase_in','单据编号'),('finish_in','bd_finish_in','bl_finish_in','单据编号'),
('other_in','bd_other_in','bl_other_in','单据编号'),('sale_out','bd_sale_out','bl_sale_out','单据编号'),
('material_out','bd_material_out','bl_material_out','单据编号'),('other_out','bd_other_out','bl_other_out','单据编号'),
('manu_order','bd_manu_order','bl_manu_order','合同号'),('dispatch','bd_dispatch','bl_dispatch','单据编号'),
('outsource_issue','bd_outsource_issue','bl_outsource_issue','单据编号'),('outsource_in','bd_outsource_in','bl_outsource_in','单据编号');
DECLARE @code varchar(50), @h sysname, @l sysname, @nc sysname, @lc nvarchar(max), @sql nvarchar(max);
DECLARE p CURSOR FOR SELECT code, head, line, noCol FROM @pairs;
OPEN p; FETCH NEXT FROM p INTO @code, @h, @l, @nc;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @lc = '';
  SELECT @lc = @lc + ', l.[' + c.name + ']' FROM sys.columns c
  WHERE c.object_id = OBJECT_ID(@l)
    AND c.name NOT IN ('id','asp_user1','asp_time1','asp_cancel','asp_user2','asp_time2', @nc)
    AND c.name NOT IN (SELECT c2.name FROM sys.columns c2 WHERE c2.object_id = OBJECT_ID(@h))
  ORDER BY c.column_id;
  SET @sql = N'CREATE VIEW v_' + @code + '_detail AS SELECT h.*' + @lc + N' FROM ' + @h + N' h LEFT JOIN ' + @l + N' l ON h.[' + @nc + N']=l.[' + @nc + N']';
  EXEC(@sql);
  FETCH NEXT FROM p INTO @code, @h, @l, @nc;
END
CLOSE p; DEALLOCATE p;
PRINT 'DETAIL 10 OK';
EXEC('CREATE VIEW v_purchase_in_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_finish_in_stats AS SELECT h.[单据日期], h.asp_cancel, l.[产品名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_finish_in h LEFT JOIN bl_finish_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[产品名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_other_in_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_sale_out_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[销售金额],0)) AS [金额] FROM bd_sale_out h LEFT JOIN bl_sale_out l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_material_out_stats AS SELECT h.[单据日期], h.asp_cancel, l.[材料名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_material_out h LEFT JOIN bl_material_out l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[材料名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_other_out_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_manu_order_stats AS SELECT h.asp_cancel, l.[产品名称], COUNT(DISTINCT h.[合同号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [计划数量], SUM(COALESCE(l.[累计汇报套数(工序单位)],0)) AS [完工数量] FROM bd_manu_order h LEFT JOIN bl_manu_order l ON h.[合同号]=l.[合同号] GROUP BY h.asp_cancel, l.[产品名称]');
EXEC('CREATE VIEW v_dispatch_stats AS SELECT h.[单据日期], h.asp_cancel, l.[生产车间], l.[工序名称], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [派工单数], SUM(COALESCE(l.[计划数量],0)) AS [计划数量], SUM(COALESCE(l.[派工数量],0)) AS [派工数量], SUM(COALESCE(l.[累计汇报数量],0)) AS [累计汇报数量], MAX(l.[派工加工状态]) AS [派工加工状态] FROM bd_dispatch h LEFT JOIN bl_dispatch l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[生产车间], l.[工序名称], l.[计量单位]');
EXEC('CREATE VIEW v_outsource_issue_stats AS SELECT h.[单据日期], h.asp_cancel, h.[委外供应商], l.[材料名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [发料单数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], l.[材料名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_outsource_in_stats AS SELECT h.[单据日期], h.asp_cancel, h.[委外供应商], l.[产品名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [入库单数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], l.[产品名称], l.[规格型号], l.[计量单位]');
PRINT 'STATS 10 OK';
SELECT COUNT(*) AS views FROM sys.views WHERE name LIKE 'v[_]%';
