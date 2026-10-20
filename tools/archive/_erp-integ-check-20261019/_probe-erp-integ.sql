SET NOCOUNT ON;
PRINT N'== DB = ' + DB_NAME();

PRINT N'-- 1) 三张配置表是否存在';
SELECT o.name AS 表名 FROM sys.objects o
 WHERE o.name IN (N'erp_integ_api', N'erp_integ_field', N'erp_integ_device');

IF OBJECT_ID(N'dbo.erp_integ_api') IS NOT NULL
BEGIN
    PRINT N'-- 2) 行数';
    DECLARE @a int, @f int, @d int;
    SELECT @a = COUNT(*) FROM erp_integ_api;
    SELECT @f = COUNT(*) FROM erp_integ_field;
    SELECT @d = COUNT(*) FROM erp_integ_device;
    SELECT @a AS 接口行数, @f AS 映射行数, @d AS 设备绑定行数;

    PRINT N'-- 3) 接口按方向/分类/启用分布';
    SELECT 方向, 分类, 启用, COUNT(*) AS 条数
      FROM erp_integ_api GROUP BY 方向, 分类, 启用 ORDER BY 方向, 分类, 启用;

    PRINT N'-- 4) 迁移登记';
    SELECT script_name, applied_at FROM yj_schema_log
     WHERE script_name LIKE N'%erp-integ%' ORDER BY applied_at;

    PRINT N'-- 5) ERP_INTEG 授权行';
    SELECT p.role_id, p.panel_code, p.perms, p.can_approve
      FROM yj_role_panel p WHERE p.panel_code = N'ERP_INTEG' ORDER BY p.role_id;

    PRINT N'-- 6) 设备档案可用行';
    SELECT COUNT(*) AS bs_equip_有效行 FROM bs_equip
     WHERE ISNULL(asp_cancel, N'N') <> N'Y' AND ISNULL(停用, 0) = 0;

    PRINT N'-- 7) ERPLG 面板归属';
    SELECT panel_code, panel_name, category, module_group FROM yj_panel
     WHERE panel_code IN (N'ERPLG', N'ERPLG_ROW');
END
ELSE PRINT N'!! erp_integ_api 不存在';
