-- 工序派工单 明细表/统计表(基于 bd_dispatch/bl_dispatch 生成)
USE HSDZ_MES;
SET NOCOUNT ON;
GO
-- 明细视图:头行平铺
EXEC('CREATE OR ALTER VIEW v_dispatch_detail AS
SELECT h.[单据编号], h.[单据日期], h.[业务类型], h.[生产车间], h.[加工单号], h.[预开工日], h.[预完工日], h.[经手人], h.[项目], h.[部门],
       l.[工序编码], l.[工序名称], l.[产品名称], l.[工作中心], l.[设备], l.[班组], l.[工人], l.[加工类型],
       l.[计划数量], l.[已派工数量], l.[派工数量], l.[计量单位], l.[派工加工状态], l.[累计汇报数量], l.[规格型号], l.[备注] AS [行备注]
FROM bd_dispatch h LEFT JOIN bl_dispatch l ON h.[单据编号] = l.[单据编号];');
GO
-- 统计视图:按 车间/工序/日期 分组汇总
EXEC('CREATE OR ALTER VIEW v_dispatch_stats AS
SELECT h.[单据日期], l.[生产车间], l.[工序编码], l.[工序名称], l.[计量单位],
       COUNT(DISTINCT h.[单据编号]) AS [派工单数],
       SUM(COALESCE(l.[计划数量], 0)) AS [计划数量],
       SUM(COALESCE(l.[派工数量], 0)) AS [派工数量],
       SUM(COALESCE(l.[已派工数量], 0)) AS [已派工数量],
       SUM(COALESCE(l.[累计汇报数量], 0)) AS [累计汇报数量],
       MAX(l.[派工加工状态]) AS [派工加工状态]
FROM bd_dispatch h LEFT JOIN bl_dispatch l ON h.[单据编号] = l.[单据编号]
GROUP BY h.[单据日期], l.[生产车间], l.[工序编码], l.[工序名称], l.[计量单位];');
GO
-- 面板注册
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='DISPATCH_DETAIL') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('DISPATCH_DETAIL', N'工序派工单明细表', N'新生产', 'flat', 'v_dispatch_detail', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'items', N'新生产');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='DISPATCH_STATS') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('DISPATCH_STATS', N'工序派工单统计表', N'新生产', 'flat', 'v_dispatch_stats', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'items', N'新生产');
GO
-- 字段注册(明细)
DECLARE @cols TABLE (name sysname, pos int);
INSERT INTO @cols SELECT c.name, c.column_id FROM sys.columns c WHERE c.object_id = OBJECT_ID('v_dispatch_detail') ORDER BY c.column_id;
DECLARE @i int = 0, @n sysname;
DECLARE cur CURSOR FOR SELECT name FROM @cols WHERE name <> 'id';
OPEN cur; FETCH NEXT FROM cur INTO @n;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @i += 10;
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='DISPATCH_DETAIL' AND col_name=@n)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('DISPATCH_DETAIL', @n, @n, N'文本', NULL, NULL, NULL, NULL, N'detail', @i, 140, 1, 0, 0, 1);
  FETCH NEXT FROM cur INTO @n;
END
CLOSE cur; DEALLOCATE cur;
-- 字段注册(统计)
DECLARE @cols2 TABLE (name sysname);
INSERT INTO @cols2 SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('v_dispatch_stats') AND c.name <> 'id';
DECLARE cur2 CURSOR FOR SELECT name FROM @cols2;
OPEN cur2; FETCH NEXT FROM cur2 INTO @n;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @i += 10;
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='DISPATCH_STATS' AND col_name=@n)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('DISPATCH_STATS', @n, @n, N'文本', NULL, NULL, NULL, NULL, N'detail', @i, 120, 1, 0, 0, 1);
  FETCH NEXT FROM cur2 INTO @n;
END
CLOSE cur2; DEALLOCATE cur2;
GO
SELECT '明细视图' AS k, COUNT(*) AS rows FROM v_dispatch_detail
UNION ALL SELECT '统计视图', COUNT(*) FROM v_dispatch_stats
UNION ALL SELECT '明细字段', COUNT(*) FROM yj_field WHERE panel_code='DISPATCH_DETAIL'
UNION ALL SELECT '统计字段', COUNT(*) FROM yj_field WHERE panel_code='DISPATCH_STATS';
GO
