-- ============================================================================
-- 修正 4 张库存报表(flat 模式)面板的 module_group
-- 日期:2026-10-10
-- 背景:STOCK_BALANCE / STOCK_LEDGER / STOCK_STATUS / STOCK_SUMMARY 的
--       module_group 不是 NULL 也不是「库存核算」,而是 4 个半角问号 "????"
--       (CAST(... AS VARBINARY(20)) 实测 3F003F003F003F00,LEN=4 / DATALENGTH=8)。
--       这是早期某次经非 UTF-8 通道写入时被替换掉的乱码残留。
--       后果:权限矩阵里冒出一个名为 "????" 的分组;这 4 张面板也永远落不进
--       「智能供应链」(ReportService.NAV_GROUP 里「库存核算」→ 智能供应链)。
-- 修法:写回合法值「库存核算」,由 ReportService.navGroup 归并到「智能供应链」。
--       不改列语义、不动读权限放行(PanelPermissionService 按同 module_group 放行,
--       改前 "????" 与改后「库存核算」都不是面板的既有 module_group,
--       故放行集合只可能变大不会变小 —— 保守方向)。
-- 执行:HSDZ_MES 与 HSDZ_MES_TEST 双账套各执行一次。
-- ============================================================================

-- 执行前核对(应为 4 行、raw 恒为 0x3F003F003F003F00)
SELECT panel_code, CAST(module_group AS VARBINARY(20)) AS raw_before
FROM yj_panel
WHERE module_group LIKE '%?%';

UPDATE yj_panel
SET module_group = N'库存核算'
WHERE panel_code IN ('STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_STATUS', 'STOCK_SUMMARY')
  AND module_group LIKE '%?%';

-- 执行后核对(应为 4 行、raw_before 为 NULL、raw_after 为 0xBA5E3575B67B7B97)
SELECT panel_code,
       CAST(module_group AS VARBINARY(20)) AS raw_after,
       module_group
FROM yj_panel
WHERE panel_code IN ('STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_STATUS', 'STOCK_SUMMARY');
