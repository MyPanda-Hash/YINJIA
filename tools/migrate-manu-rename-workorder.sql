-- migrate-manu-rename-workorder.sql — 生产加工单 → 生产工单 改名(2026-09-24 用户拍板)
-- 依据:用户 2026-09-24 拍板「把生产加工单改名为生产工单」(做法 A:就地改名,底座不动)。
--   ①面板名:MANU_ORDER 生产加工单→生产工单(+panel_name_en);家族面板 明细表/统计表 同步改名;
--   ②老 WO_ORDER 面板原名就是「生产工单」(2026-09-22 单轨改造已下线菜单,面板/权限保留)→ 改名「生产工单(旧版)」,
--     避免与 MANU_ORDER 两张同名面板 + 译名键冲突;
--   ③panel 译名键随之迁移(ref_key 前移,保留各语言文本,en 校正为 Production Work Order);
--   ④不动:panel_code(MANU_ORDER)、权限矩阵(yj_role_panel)、表结构、form_flow_link 占用链、报工锚。
-- 幂等:UPDATE 带旧名守卫 + IF NOT EXISTS,可重复执行。
SET NOCOUNT ON;

-- ① 面板名
UPDATE yj_panel SET panel_name = N'生产工单', panel_name_en = N'Production Work Order'
WHERE panel_code = 'MANU_ORDER' AND panel_name = N'生产加工单';
UPDATE yj_panel SET panel_name = N'生产工单明细表', panel_name_en = N'Production WO Detail List'
WHERE panel_code = 'MANU_ORDER_DETAIL' AND panel_name = N'生产加工单明细表';
UPDATE yj_panel SET panel_name = N'生产工单统计表', panel_name_en = N'Production WO Statistics'
WHERE panel_code = 'MANU_ORDER_STATS' AND panel_name = N'生产加工单统计表';
-- ② 老面板让位(menu 已下线,面板/权限行保留可回滚)
UPDATE yj_panel SET panel_name = N'生产工单(旧版)', panel_name_en = N'Production WO (legacy)'
WHERE panel_code = 'WO_ORDER' AND panel_name = N'生产工单';

-- ③ panel 译名键迁移(各语言文本随键前移;en 校正)
UPDATE yj_translation SET ref_key = N'生产工单' WHERE scope = 'panel' AND ref_key = N'生产加工单';
UPDATE yj_translation SET ref_key = N'生产工单明细表' WHERE scope = 'panel' AND ref_key = N'生产加工单明细表';
UPDATE yj_translation SET ref_key = N'生产工单统计表' WHERE scope = 'panel' AND ref_key = N'生产加工单统计表';
UPDATE yj_translation SET text = N'Production Work Order' WHERE scope = 'panel' AND ref_key = N'生产工单' AND locale = 'en';
UPDATE yj_translation SET text = N'Production WO Detail List' WHERE scope = 'panel' AND ref_key = N'生产工单明细表' AND locale = 'en';
UPDATE yj_translation SET text = N'Production WO Statistics' WHERE scope = 'panel' AND ref_key = N'生产工单统计表' AND locale = 'en';

IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'生产工单(旧版)' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产工单(旧版)', 'en', N'Production WO (legacy)', 'manual');

SELECT panel_code, panel_name, panel_name_en FROM yj_panel WHERE panel_code IN ('MANU_ORDER','MANU_ORDER_DETAIL','MANU_ORDER_STATS','WO_ORDER');
SELECT ref_key, COUNT(*) AS 语言数 FROM yj_translation WHERE scope='panel' AND ref_key LIKE N'生产工单%' GROUP BY ref_key;
PRINT N'migrate-manu-rename-workorder 完成';
GO
