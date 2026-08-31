-- 修复 v2:DROP + 重建所有报表视图(带 asp_cancel)
USE HSDZ_MES;
SET NOCOUNT ON;

-- 先全部 DROP
DECLARE @name sysname, @sql nvarchar(max);
DECLARE c CURSOR FOR SELECT v.name FROM sys.views v WHERE v.name LIKE 'v[_]%' ORDER BY v.name;
OPEN c;
FETCH NEXT FROM c INTO @name;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @sql = 'DROP VIEW ' + QUOTENAME(@name);
  EXEC(@sql);
  FETCH NEXT FROM c INTO @name;
END
CLOSE c; DEALLOCATE c;
PRINT '全部 DROP 完成';
GO

-- DETAIL 视图(头行平铺 + h.asp_cancel)
DECLARE @src TABLE (code varchar(50), head sysname, line sysname, noCol sysname);
INSERT INTO @src VALUES
('PURCHASE_IN','bd_purchase_in','bl_purchase_in','单据编号'),
('FINISH_IN','bd_finish_in','bl_finish_in','单据编号'),
('OTHER_IN','bd_other_in','bl_other_in','单据编号'),
('SALE_OUT','bd_sale_out','bl_sale_out','单据编号'),
('MATERIAL_OUT','bd_material_out','bl_material_out','单据编号'),
('OTHER_OUT','bd_other_out','bl_other_out','单据编号'),
('MANU_ORDER','bd_manu_order','bl_manu_order','合同号'),
('OUTSOURCE_ISSUE','bd_outsource_issue','bl_outsource_issue','单据编号'),
('OUTSOURCE_IN','bd_outsource_in','bl_outsource_in','单据编号');
DECLARE @code varchar(50), @h sysname, @l sysname, @n sysname, @sql nvarchar(max);
DECLARE c CURSOR FOR SELECT code, head, line, noCol FROM @src;
OPEN c; FETCH NEXT FROM c INTO @code, @h, @l, @n;
WHILE @@FETCH_STATUS = 0 BEGIN
  -- DETAIL: SELECT 头列 + 行列 + asp_cancel(从行表,行表是 LEFT JOIN 侧,NULL 安全)
  SET @sql = N'CREATE VIEW v_' + LOWER(@code) + N'_detail AS
SELECT h.*, l.*, COALESCE(l.asp_cancel, h.asp_cancel, ''N'') AS asp_cancel
FROM ' + @h + N' h LEFT JOIN ' + @l + N' l ON h.[' + @n + N'] = l.[' + @n + N'];';
  EXEC(@sql);
  -- STATS: 分组聚合 + MAX(asp_cancel)
  SET @sql = N'CREATE VIEW v_' + LOWER(@code) + N'_stats AS
SELECT h.[单据日期], h.asp_cancel,
       l.[存货编码], l.[存货], l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位],
       COUNT(DISTINCT h.[' + @n + N']) AS [单据数],
       SUM(COALESCE(l.[数量], 0)) AS [数量], SUM(COALESCE(l.[实收数量], 0)) AS [实收数量],
       SUM(COALESCE(l.[金额], 0)) AS [金额]
FROM ' + @h + N' h LEFT JOIN ' + @l + N' l ON h.[' + @n + N'] = l.[' + @n + N'] + N'
GROUP BY h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位];';
  EXEC(@sql);
  PRINT @code + ': detail+stats OK';
  FETCH NEXT FROM c INTO @code, @h, @l, @n;
END
CLOSE c; DEALLOCATE c;
GO

-- 派工单报表(已有定义,重建带 asp_cancel)
EXEC('CREATE VIEW v_dispatch_detail AS
SELECT h.*, l.*, COALESCE(l.asp_cancel, h.asp_cancel, ''N'') AS asp_cancel
FROM bd_dispatch h LEFT JOIN bl_dispatch l ON h.[单据编号] = l.[单据编号];');
EXEC('CREATE VIEW v_dispatch_stats AS
SELECT h.[单据日期], h.asp_cancel, l.[生产车间], l.[工序编码], l.[工序名称], l.[计量单位],
       COUNT(DISTINCT h.[单据编号]) AS [派工单数],
       SUM(COALESCE(l.[计划数量], 0)) AS [计划数量], SUM(COALESCE(l.[派工数量], 0)) AS [派工数量],
       SUM(COALESCE(l.[已派工数量], 0)) AS [已派工数量], SUM(COALESCE(l.[累计汇报数量], 0)) AS [累计汇报数量],
       MAX(l.[派工加工状态]) AS [派工加工状态]
FROM bd_dispatch h LEFT JOIN bl_dispatch l ON h.[单据编号] = l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, l.[生产车间], l.[工序编码], l.[工序名称], l.[计量单位];');
PRINT 'dispatch: OK';
GO
SELECT v.name, CASE WHEN EXISTS (SELECT 1 FROM sys.columns c2 WHERE c2.object_id = v.object_id AND c2.name = 'asp_cancel') THEN 'Y' ELSE 'N' END AS has_cancel
FROM sys.views v WHERE v.name LIKE 'v[_]%';
