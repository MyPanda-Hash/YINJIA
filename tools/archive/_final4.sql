SET NOCOUNT ON;
GO
-- ① v_lot_trace:外包加 id
DECLARE @d nvarchar(max) = (SELECT CONVERT(nvarchar(max), definition) FROM sys.sql_modules WHERE object_id=OBJECT_ID('v_lot_trace'));
DECLARE @b nvarchar(max) = SUBSTRING(@d, CHARINDEX(' AS ', @d) + 4, LEN(@d));
EXEC('CREATE OR ALTER VIEW v_lot_trace AS SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, t.* FROM (' + @b + ') t');
GO
-- ② v_outsource_in_stats:加 产品编码(真列)
EXEC(N'CREATE OR ALTER VIEW v_outsource_in_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[委外供应商], h.[仓库], l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [入库单数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], h.[仓库], l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位]');
GO
-- ③ v_outsource_issue_stats:加 材料编码(真列)
EXEC(N'CREATE OR ALTER VIEW v_outsource_issue_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[委外供应商], h.[仓库], l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [发料单数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], h.[仓库], l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位]');
GO
-- ④ v_outsource_issue_detail:外包补 材料仓库(布局列)
DECLARE @d2 nvarchar(max) = (SELECT CONVERT(nvarchar(max), definition) FROM sys.sql_modules WHERE object_id=OBJECT_ID('v_outsource_issue_detail'));
DECLARE @b2 nvarchar(max) = SUBSTRING(@d2, CHARINDEX(' AS ', @d2) + 4, LEN(@d2));
EXEC('CREATE OR ALTER VIEW v_outsource_issue_detail AS SELECT x.*, NULL AS [材料仓库] FROM (' + @b2 + ') x');
