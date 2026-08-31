-- 修复 v3:重建所有视图(asp_cancel),纯 EXEC 动态 SQL 避免 GO 分批问题
USE HSDZ_MES;
SET NOCOUNT ON;
DECLARE @s nvarchar(max);
-- DROP all
DECLARE @name sysname, @dropSql nvarchar(max);
DECLARE c CURSOR FOR SELECT v.name FROM sys.views v WHERE v.name LIKE 'v[_]%';
OPEN c; FETCH NEXT FROM c INTO @name;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @dropSql = N'DROP VIEW [' + @name + N']';
  EXEC(@dropSql);
  FETCH NEXT FROM c INTO @name;
END
CLOSE c; DEALLOCATE c;

-- 重建 DETAIL 视图(h.* + l.* + asp_cancel 从 h 表)
SET @s = '
CREATE VIEW v_purchase_in_detail AS SELECT h.*, l.*, h.asp_cancel AS v_cancel FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON h.[单据编号] = l.[单据编号];
CREATE VIEW v_finish_in_detail AS SELECT h.*, l.*, h.asp_cancel AS v_cancel FROM bd_finish_in h LEFT JOIN bl_finish_in l ON h.[单据编号] = l.[单据编号];
CREATE VIEW v_other_in_detail AS SELECT h.*, l.*, h.asp_cancel AS v_cancel FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号] = l.[单据编号];
CREATE VIEW v_sale_out_detail AS SELECT h.*, l.*, h.asp_cancel AS v_cancel FROM bd_sale_out h LEFT JOIN bl_sale_out l ON h.[单据编号] = l.[单据编号];
CREATE VIEW v_material_out_detail AS SELECT h.*, l.*, h.asp_cancel AS v_cancel FROM bd_material_out h LEFT JOIN bl_material_out l ON h.[单据编号] = l.[单据编号];
CREATE VIEW v_other_out_detail AS SELECT h.*, l.*, h.asp_cancel AS v_cancel FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号] = l.[单据编号];
CREATE VIEW v_manu_order_detail AS SELECT h.*, l.*, h.asp_cancel AS v_cancel FROM bd_manu_order h LEFT JOIN bl_manu_order l ON h.[合同号] = l.[合同号];
CREATE VIEW v_dispatch_detail AS SELECT h.*, l.*, h.asp_cancel AS v_cancel FROM bd_dispatch h LEFT JOIN bl_dispatch l ON h.[单据编号] = l.[单据编号];
CREATE VIEW v_outsource_issue_detail AS SELECT h.*, l.*, h.asp_cancel AS v_cancel FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号] = l.[单据编号];
CREATE VIEW v_outsource_in_detail AS SELECT h.*, l.*, h.asp_cancel AS v_cancel FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号] = l.[单据编号];
';
EXEC(@s);
PRINT 'DETAIL 10 个 OK';

-- 重建 STATS 视图(分组 + asp_cancel 在 GROUP BY)
SET @s = N'
CREATE VIEW v_purchase_in_stats AS
SELECT h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [单据数],
  SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位];

CREATE VIEW v_finish_in_stats AS
SELECT h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [单据数],
  SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_finish_in h LEFT JOIN bl_finish_in l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位];

CREATE VIEW v_other_in_stats AS
SELECT h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [单据数],
  SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位];

CREATE VIEW v_sale_out_stats AS
SELECT h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [单据数],
  SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_sale_out h LEFT JOIN bl_sale_out l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位];

CREATE VIEW v_material_out_stats AS
SELECT h.[单据日期], h.asp_cancel, l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [单据数],
  SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_material_out h LEFT JOIN bl_material_out l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位];

CREATE VIEW v_other_out_stats AS
SELECT h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [单据数],
  SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, l.[存货编码], l.[存货], l.[规格型号], l.[计量单位];

CREATE VIEW v_manu_order_stats AS
SELECT h.asp_cancel, l.[产品编码], l.[产品名称],
  COUNT(DISTINCT h.[合同号]) AS [单据数],
  SUM(COALESCE(l.[计划数量],0)) AS [计划数量], SUM(COALESCE(l.[完工数量],0)) AS [完工数量]
FROM bd_manu_order h LEFT JOIN bl_manu_order l ON h.[合同号]=l.[合同号]
GROUP BY h.asp_cancel, l.[产品编码], l.[产品名称];

CREATE VIEW v_dispatch_stats AS
SELECT h.[单据日期], h.asp_cancel, l.[生产车间], l.[工序编码], l.[工序名称], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [派工单数],
  SUM(COALESCE(l.[计划数量],0)) AS [计划数量], SUM(COALESCE(l.[派工数量],0)) AS [派工数量],
  SUM(COALESCE(l.[已派工数量],0)) AS [已派工数量], SUM(COALESCE(l.[累计汇报数量],0)) AS [累计汇报数量],
  MAX(l.[派工加工状态]) AS [派工加工状态]
FROM bd_dispatch h LEFT JOIN bl_dispatch l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, l.[生产车间], l.[工序编码], l.[工序名称], l.[计量单位];

CREATE VIEW v_outsource_issue_stats AS
SELECT h.[单据日期], h.asp_cancel, h.[委外供应商], l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [发料单数],
  SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位];

CREATE VIEW v_outsource_in_stats AS
SELECT h.[单据日期], h.asp_cancel, h.[委外供应商], l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [入库单数],
  SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位];
';
EXEC(@s);
PRINT 'STATS 10 个 OK';

