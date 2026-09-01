/* 报表面板类别统一(报表表头筛选与排序补丁配套):
   所有 mode='flat' 的报表面板 category 统一为 N'报表',
   使前端 reportMode 生效(工具栏"栏目"+列头排序/筛选);
   菜单分组不受影响(走 module_group)。
   同时清空面板配置缓存(config/config_at)使 panelCategory 立即刷新。 */
USE HSDZ_MES;
SET NOCOUNT ON;
UPDATE yj_panel SET category = N'报表', config = NULL, config_at = NULL
WHERE mode = 'flat' AND category <> N'报表';
SELECT panel_code, category, module_group FROM yj_panel WHERE mode = 'flat' ORDER BY panel_code;
GO
