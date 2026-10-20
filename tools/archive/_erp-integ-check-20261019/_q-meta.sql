SET NOCOUNT ON;
PRINT N'-- bs_equip 列';
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.bs_equip') ORDER BY c.column_id;
PRINT N'-- /erp/integ/meta 的 devices 查询(原样)';
SELECT TOP 5 设备编码, 设备名称, ISNULL(所属部门, N'') AS 所属部门
  FROM (SELECT DISTINCT 设备编码, 设备名称, 所属部门 FROM bs_equip
         WHERE ISNULL(asp_cancel, N'N') <> N'Y' AND ISNULL(停用, 0) = 0) t
 ORDER BY 设备编码;
PRINT N'-- /erp/integ/meta 的 panels 查询(原样)';
SELECT COUNT(*) AS 面板数 FROM yj_panel;
PRINT N'-- /erp/integ/config 的 items 查询(原样)';
SELECT COUNT(*) AS 接口数 FROM erp_integ_api WHERE ISNULL(asp_cancel, N'N') <> N'Y';
PRINT N'-- panelFields 查询(以 PURCHASE_IN 为例)';
SELECT TOP 5 [label] AS 字段名, [place] AS 位置, [seq] AS 顺序 FROM yj_field
 WHERE panel_code = N'PURCHASE_IN' AND ISNULL(visible,1) = 1 ORDER BY [seq], [id];
