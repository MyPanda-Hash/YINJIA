-- 委外发料单/委外入库单 明细表+统计表(与库存核算六单据同形态)
USE HSDZ_MES;
SET NOCOUNT ON;
GO
-- ===== 委外发料单 =====
EXEC('CREATE OR ALTER VIEW v_outsource_issue_detail AS
SELECT h.[单据编号], h.[单据日期], h.[业务类型], h.[委外供应商], h.[委外加工单号], h.[仓库] AS [发料仓库], h.[部门], h.[经手人], h.[来源单据], h.[来源单号],
       l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额], l.[仓库] AS [材料仓库], l.[行中止]
FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号] = l.[单据编号];');
EXEC('CREATE OR ALTER VIEW v_outsource_issue_stats AS
SELECT h.[单据日期], h.[委外供应商], l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位],
       COUNT(DISTINCT h.[单据编号]) AS [发料单数],
       SUM(COALESCE(l.[数量], 0)) AS [数量], SUM(COALESCE(l.[金额], 0)) AS [金额]
FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号] = l.[单据编号]
GROUP BY h.[单据日期], h.[委外供应商], l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位];');
-- ===== 委外入库单 =====
EXEC('CREATE OR ALTER VIEW v_outsource_in_detail AS
SELECT h.[单据编号], h.[单据日期], h.[业务类型], h.[委外供应商], h.[委外加工单号], h.[仓库], h.[经手人], h.[来源单据], h.[来源单号],
       l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位], l.[实收数量], l.[单价], l.[金额], l.[现存量], l.[行中止]
FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号] = l.[单据编号];');
EXEC('CREATE OR ALTER VIEW v_outsource_in_stats AS
SELECT h.[单据日期], h.[委外供应商], l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位],
       COUNT(DISTINCT h.[单据编号]) AS [入库单数],
       SUM(COALESCE(l.[实收数量], 0)) AS [实收数量], SUM(COALESCE(l.[金额], 0)) AS [金额]
FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号] = l.[单据编号]
GROUP BY h.[单据日期], h.[委外供应商], l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位];');
GO
DECLARE @panels TABLE (code varchar(50), name nvarchar(100), vw sysname);
INSERT INTO @panels VALUES
('OUTSOURCE_ISSUE_DETAIL', N'委外发料单明细表', 'v_outsource_issue_detail'),
('OUTSOURCE_ISSUE_STATS', N'委外发料单统计表', 'v_outsource_issue_stats'),
('OUTSOURCE_IN_DETAIL', N'委外入库单明细表', 'v_outsource_in_detail'),
('OUTSOURCE_IN_STATS', N'委外入库单统计表', 'v_outsource_in_stats');
DECLARE @code varchar(50), @name nvarchar(100), @view sysname;
DECLARE c CURSOR FOR SELECT code, name, vw FROM @panels;
OPEN c; FETCH NEXT FROM c INTO @code, @name, @view;
WHILE @@FETCH_STATUS = 0 BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code=@code)
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
    VALUES (@code, @name, N'智能供应链', 'flat', @view, NULL, NULL, 'id', NULL, NULL, NULL, 100, 'items', N'智能供应链');
  DECLARE @cols TABLE (name sysname);
  INSERT INTO @cols SELECT c2.name FROM sys.columns c2 WHERE c2.object_id = OBJECT_ID(@view) AND c2.name <> 'id';
  DECLARE @n sysname, @i int = 0;
  DECLARE cc CURSOR FOR SELECT name FROM @cols;
  OPEN cc; FETCH NEXT FROM cc INTO @n;
  WHILE @@FETCH_STATUS = 0 BEGIN
    SET @i += 10;
    IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code=@code AND col_name=@n)
      INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
      VALUES (@code, @n, @n, N'文本', NULL, NULL, NULL, NULL, N'detail', @i, 130, 1, 0, 0, 1);
    FETCH NEXT FROM cc INTO @n;
  END
  CLOSE cc; DEALLOCATE cc;
  FETCH NEXT FROM c INTO @code, @name, @view;
END
CLOSE c; DEALLOCATE c;
GO
SELECT 'issue_detail' AS k, COUNT(*) AS rows FROM v_outsource_issue_detail
UNION ALL SELECT 'issue_stats', COUNT(*) FROM v_outsource_issue_stats
UNION ALL SELECT 'in_detail', COUNT(*) FROM v_outsource_in_detail
UNION ALL SELECT 'in_stats', COUNT(*) FROM v_outsource_in_stats
UNION ALL SELECT 'fields', (SELECT COUNT(*) FROM yj_field WHERE panel_code LIKE 'OUTSOURCE_%_D%' OR panel_code LIKE 'OUTSOURCE_%_S%');
GO
