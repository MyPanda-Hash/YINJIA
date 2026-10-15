-- 只读核实:MANU_ORDER 旧面板在数据库是否还存在(2026-10-16)
-- 全部为 SELECT,不做任何写操作。

PRINT N'=== ① yj_panel 中遗留生产域面板是否还在 ==='
SELECT panel_code, panel_name, head_table, line_table, mode
FROM yj_panel
WHERE panel_code IN (N'MANU_ORDER',N'MANU_SCHEDULE',N'WO_ORDER',N'WO_SCHEDULE',N'LINE_LOAD',N'LINE_CAP',N'WO_KIT',N'MANU_ORDER_DETAIL',N'MANU_ORDER_STATS')
ORDER BY panel_code

PRINT N'=== ①b 生产工单真身(对照) ==='
SELECT panel_code, panel_name, head_table, line_table, mode
FROM yj_panel
WHERE panel_code IN (N'WORK_ORDER_LIST',N'PLANG') OR panel_name LIKE N'%生产工单%'
ORDER BY panel_code

PRINT N'=== ② yj_field 是否还登记了这些旧面板字段 ==='
SELECT panel_code, COUNT(*) AS 字段数
FROM yj_field
WHERE panel_code IN (N'MANU_ORDER',N'MANU_SCHEDULE',N'WO_ORDER',N'WO_SCHEDULE')
GROUP BY panel_code ORDER BY panel_code

PRINT N'=== ③ 权限(role_panel)是否还挂接这些旧面板 ==='
SELECT panel_code, COUNT(*) AS 授权角色数
FROM yj_role_panel
WHERE panel_code IN (N'MANU_ORDER',N'MANU_SCHEDULE',N'WO_ORDER',N'WO_SCHEDULE')
GROUP BY panel_code ORDER BY panel_code

PRINT N'=== ④ 旧物理表 bd_manu_order / bl_manu_order 残留数据 ==='
SELECT N'bd_manu_order' AS 表, COUNT(*) AS 行数 FROM bd_manu_order WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'bl_manu_order', COUNT(*) FROM bl_manu_order WHERE ISNULL(asp_cancel,'N')<>'Y'

PRINT N'=== ⑤ 当前生产工单真身 plang 数据量 ==='
SELECT COUNT(*) AS plang行数 FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'

PRINT N'=== ⑥ MANU_ORDER 通道占用链是否还活着 ==='
SELECT N'target=MANU_ORDER' AS 方向, link_status, COUNT(*) AS 条数
FROM form_flow_link WHERE target_panel_code='MANU_ORDER' GROUP BY link_status
UNION ALL
SELECT N'source=MANU_ORDER', link_status, COUNT(*) FROM form_flow_link WHERE source_panel_code='MANU_ORDER' GROUP BY link_status

PRINT N'=== ⑦ yj_panel 里是否仍有面板名含加工单(旧 MANU_ORDER 语义) ==='
SELECT panel_code, panel_name FROM yj_panel
WHERE panel_name LIKE N'%加工单%' OR panel_name LIKE N'%生产加工%' ORDER BY panel_code
