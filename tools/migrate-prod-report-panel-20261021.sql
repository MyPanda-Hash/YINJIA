-- ============================================================================
-- 工序报工页面面板授权 + 译名(2026-10-21)
--
-- 背景:新页面级虚拟面板 PROD_REPORT(定义在 PagePanelRegistry,不落 yj_panel 表),
--   权限矩阵读的是 yj_role_panel(role_id → yj_role.id);不给行 = 矩阵里看不到、也进不去。
--
-- 授予 view/query/report(照 PROD_PICK 的套路:PROD_PICK 是 view,query,pick,role_id 1~4)。
-- 底层真正的记账仍受 WO_REPORT 面板权限约束 —— 本页面只是采集入口。
--
-- 幂等:重复执行不出错。
-- ============================================================================

SET NOCOUNT ON;

-- ① 权限:每个角色一行(缺才插)
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'PROD_REPORT', N'N', N'view,query,report'
  FROM yj_role r
 WHERE NOT EXISTS (
         SELECT 1 FROM yj_role_panel x
          WHERE x.role_id = r.id AND x.panel_code = N'PROD_REPORT'
       );

-- 已存在但缺 report 词的行补齐(不覆盖已有词,保留人工调整)
UPDATE yj_role_panel
   SET perms = CASE
                 WHEN ISNULL(perms, '') = '' THEN N'view,query,report'
                 ELSE perms + N',report' END
 WHERE panel_code = N'PROD_REPORT'
   AND ISNULL(perms, '') NOT LIKE '%report%';

-- ② 面板名译名(AGENTS 多语言强制规范)
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'panel', N'工序报工', 'en', N'Process reporting', 'manual'
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'工序报工' AND locale='en');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'panel', N'工序报工', 'ja', N'工程報告', 'manual'
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'工序报工' AND locale='ja');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'panel', N'工序报工', 'ko', N'공정 보고', 'manual'
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'工序报工' AND locale='ko');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'panel', N'工序报工', 'vi', N'Báo cáo công đoạn', 'manual'
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'工序报工' AND locale='vi');

-- ③ 自检:必须 [PASS]
SELECT CASE WHEN EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code = N'PROD_REPORT')
       THEN '[PASS] PROD_REPORT 已授权' ELSE '[FAIL] 未授权' END AS 自检1;

SELECT CASE WHEN EXISTS (
         SELECT 1 FROM yj_role_panel
          WHERE panel_code = N'PROD_REPORT' AND ISNULL(perms,'') NOT LIKE '%report%'
       ) THEN '[FAIL] 有角色缺 report 词' ELSE '[PASS] 所有授权行都含 report' END AS 自检2;

SELECT CASE WHEN EXISTS (
         SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'工序报工' AND locale='en'
       ) THEN '[PASS] 面板名译名(en)已就绪' ELSE '[FAIL] 缺面板名译名' END AS 自检3;

SELECT x.role_id, r.role_name, x.perms
  FROM yj_role_panel x LEFT JOIN yj_role r ON r.id = x.role_id
 WHERE x.panel_code = N'PROD_REPORT' ORDER BY x.role_id;
