/* ============================================================
   i18n-mobile-scan-20261030.sql — 「手机扫码」导航改版的库侧元数据(译名 + 权限)

   用户口径(2026-10-30):
     「把生产领料和工序报工这两个 app 的面版重新放在一个新的『手机扫码』(和生产计划平级)导航下。
      工序报工不变。生产领料重写。」

   本脚本做两件事(都不改物理表结构):
    ① yj_translation 补面板名译名:手机扫码 / 生产领料 / 工序报工 / 自动打印(9 语言);
    ② yj_role_panel 给三个新面板码补授权行(MOBILE_PICK / MOBILE_REPORT / PRINT_STATION)。

   ------------------------------------------------------------
   ★ 为什么授权"补"而不是"改"
   ------------------------------------------------------------
   面板码换了名(PROD_PICK → MOBILE_PICK、PROD_REPORT → MOBILE_REPORT),但**旧授权行保留**:
     · 后端 PagePanelRegistry 把旧码登记为别名(byCode 回落到新定义,canonical/aliasesOf 归一);
     · 故既有 yj_role_panel 里按旧码授的权,在新页面上照样生效,不会因为改名把人挡在门外。
   这里再按**旧行的权限词**补一行新码 —— 让「角色与面板权限」矩阵里点开的是新码那一行,
   管理员看到的与菜单一致;旧行留着做兼容,不删。

   ★ 自动打印为什么默认只给管理员
   ------------------------------------------------------------
   这是一台电脑的打印机配置权(词 = config)。给所有角色 = 谁都能把公司的打印机配乱。
   故 PRINT_STATION 只给管理员(admin)补一行,**其余角色由管理员在组织架构里按需勾**。
   旧口径同理:PROD_PICK/PROD_REPORT 当年是"改前对所有人开放 ⇒ 补权保持现状",这里照旧。

   幂等:全部 INSERT ... WHERE NOT EXISTS;可重复执行。
   两账套都执行(正式 HSDZ_MES 先、测试 HSDZ_MES_TEST 后),已登记 tools/db-migrations.txt。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ---------- ① 面板名译名(scope='panel';9 语言) ---------- */
DECLARE @tr TABLE (ref_key nvarchar(200), locale varchar(10), text nvarchar(300));
INSERT INTO @tr (ref_key, locale, text) VALUES
 (N'手机扫码', 'en', N'Mobile Scanning'),
 (N'手机扫码', 'ja', N'モバイルスキャン'),
 (N'手机扫码', 'ko', N'모바일 스캔'),
 (N'手机扫码', 'es', N'Escaneo móvil'),
 (N'手机扫码', 'fr', N'Scan mobile'),
 (N'手机扫码', 'de', N'Mobiles Scannen'),
 (N'手机扫码', 'ru', N'Мобильное сканирование'),
 (N'手机扫码', 'vi', N'Quét di động'),
 (N'手机扫码', 'th', N'สแกนมือถือ'),

 -- 生产领料:en 译名此前已有(PROD_PICK 时代),这里补齐其余语言;旧译名不覆盖
 (N'生产领料', 'ja', N'生産材料払出'),
 (N'生产领料', 'ko', N'생산 자재 출고'),
 (N'生产领料', 'es', N'Retirada de producción'),
 (N'生产领料', 'fr', N'Prélèvement de production'),
 (N'生产领料', 'de', N'Produktionsentnahme'),
 (N'生产领料', 'ru', N'Выдача в производство'),
 (N'生产领料', 'vi', N'Xuất vật tư sản xuất'),
 (N'生产领料', 'th', N'เบิกวัสดุการผลิต'),

 -- 工序报工:同上一批早已有 en/ja/ko/vi,补齐 es/fr/de/ru/th
 (N'工序报工', 'es', N'Informe de proceso'),
 (N'工序报工', 'fr', N'Rapport de processus'),
 (N'工序报工', 'de', N'Prozessbericht'),
 (N'工序报工', 'ru', N'Отчёт по операциям'),
 (N'工序报工', 'th', N'รายงานกระบวนการ'),

 (N'自动打印', 'en', N'Auto Print'),
 (N'自动打印', 'ja', N'自動印刷'),
 (N'自动打印', 'ko', N'자동 인쇄'),
 (N'自动打印', 'es', N'Impresión automática'),
 (N'自动打印', 'fr', N'Impression auto'),
 (N'自动打印', 'de', N'Automatischer Druck'),
 (N'自动打印', 'ru', N'Автопечать'),
 (N'自动打印', 'vi', N'In tự động'),
 (N'自动打印', 'th', N'พิมพ์อัตโนมัติ');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'panel', t.ref_key, t.locale, t.text, 'manual'
  FROM @tr t
 WHERE NOT EXISTS (
         SELECT 1 FROM yj_translation x
          WHERE x.scope = 'panel' AND x.ref_key = t.ref_key AND x.locale = t.locale);
GO

/* ---------- ② 权限:按旧码的权限词,给新码补授权行 ---------- */
-- ① 生产领料:MOBILE_PICK —— 词集 view,query,create,pick,submit,print
--    旧码 PROD_PICK 当年是 view,query,pick;新页面多出 create/submit/print 三个词(生单/提交/打印),
--    这三个动的是钱和库存,故**不给全量**:照旧词的"谁有 pick 谁就有 create+print",
--    而 submit(真正过账)只补齐给**本来就能审核材料出库单**的角色。
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'MOBILE_PICK', N'N', N'view,query,create,pick,print'
  FROM yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'MOBILE_PICK')
   AND EXISTS (SELECT 1 FROM yj_role_panel o
                WHERE o.role_id = r.id AND o.panel_code = N'PROD_PICK');
GO

-- ② 提交权(submit):只给「本来就能审核 MATERIAL_OUT」的角色(管理员另有恒过通道)
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'MOBILE_PICK', N'N', N'view,query,create,pick,submit,print'
  FROM yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'MOBILE_PICK')
   AND EXISTS (SELECT 1 FROM yj_role_panel o
                WHERE o.role_id = r.id AND o.panel_code = N'MATERIAL_OUT' AND o.can_approve = N'Y');
GO

-- ③ 已有 MOBILE_PICK 行但漏了 submit 词的:补词(不覆盖已有词)
UPDATE yj_role_panel
   SET perms = CASE WHEN ISNULL(perms,'') = '' THEN N'view,query,create,pick,submit,print'
                    ELSE perms + N',submit' END
 WHERE panel_code = N'MOBILE_PICK'
   AND ISNULL(perms,'') NOT LIKE '%submit%'
   AND EXISTS (SELECT 1 FROM yj_role_panel o
                WHERE o.role_id = yj_role_panel.role_id AND o.panel_code = N'MATERIAL_OUT' AND o.can_approve = N'Y');
GO

-- ④ 工序报工:MOBILE_REPORT —— 词集与旧码 PROD_REPORT 完全一致(view,query,report)
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'MOBILE_REPORT', N'N', N'view,query,report'
  FROM yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'MOBILE_REPORT')
   AND EXISTS (SELECT 1 FROM yj_role_panel o
                WHERE o.role_id = r.id AND o.panel_code = N'PROD_REPORT');
GO

-- ⑤ 自动打印:PRINT_STATION —— **只给管理员角色**(词 = config,配的是公司打印机)
--    别的角色要在组织架构里按需勾;不在这里一次性放开。
--    ⚠ yj_role 的实际列是 role_code / role_name / is_admin(不是 code/name)——
--      2026-10-30 实测踩到:按 role_code 写才命中,写 code 会静默插 0 行。
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'PRINT_STATION', N'N', N'view,config'
  FROM yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'PRINT_STATION')
   AND (r.is_admin = N'Y' OR r.role_code IN (N'admin', N'ADMIN', N'super', N'superadmin'));
GO

-- ⑥ 兜底:一个 admin 角色都没有时(不同环境命名不一),至少给 id 最小的一个角色,
--    免得「自动打印」在权限矩阵里完全勾不到(config 词授不出去 = 功能等于不存在)。
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT TOP 1 r.id, N'PRINT_STATION', N'N', N'view,config'
  FROM yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.panel_code = N'PRINT_STATION')
 ORDER BY r.id;
GO

/* ---------- ③ 自检 ---------- */
DECLARE @missPanel int, @missRole int;
-- 4 个面板名 × 9 语言 = 36 条(若某些语言已存在则更多,故用 >= 判定每个面板至少 9 种)
SELECT @missPanel = COUNT(*) FROM (
    SELECT ref_key FROM yj_translation
     WHERE scope='panel' AND ref_key IN (N'手机扫码', N'生产领料', N'工序报工', N'自动打印')
     GROUP BY ref_key HAVING COUNT(DISTINCT locale) < 9
) t;
SELECT @missRole = COUNT(DISTINCT panel_code) FROM yj_role_panel
 WHERE panel_code IN (N'MOBILE_PICK', N'MOBILE_REPORT', N'PRINT_STATION');

IF @missPanel > 0
   RAISERROR(N'[FAIL] 有 %d 个面板名译名不足 9 种语言', 16, 1, @missPanel);
IF @missRole < 3
   RAISERROR(N'[FAIL] 新面板码授权只落了 %d/3 个(应 MOBILE_PICK / MOBILE_REPORT / PRINT_STATION)', 16, 1, @missRole);

IF @missPanel = 0 AND @missRole = 3
   PRINT N'[PASS] 面板译名 4×9 语言齐备;MOBILE_PICK / MOBILE_REPORT / PRINT_STATION 授权行就位';
GO
