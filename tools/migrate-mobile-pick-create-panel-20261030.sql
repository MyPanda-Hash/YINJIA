/* ============================================================
   migrate-mobile-pick-create-panel-20261030.sql — 「生成工单领料/退料单」独立面板:授权 + 译名

   用户口径(2026-10-30 第二轮):
     「还有少了一个『生成工单领料/退料单』这个面版,这个面版的功能和生成领料是有区别的
       (不是一个面版),重新分析需求」
   三问确认:① 定位 = 电脑上的开单工作台(可扫多张工单批量生成、列表看已生成的单);
             ② 职责 = 只管生单,生完引导去「生产领料」领;③ 菜单排在生产领料**之前**。

   ------------------------------------------------------------
   ★ 为什么需要这张独立的权限行(不能复用 MOBILE_PICK)
   ------------------------------------------------------------
   两个面板是**两个岗位**:开单是计划员/生管在电脑上批量开,领料是车间在手机上逐项扫。
   若共用 MOBILE_PICK 的授权:
     · 给车间开了 pick/submit,他就同时能"开单"(凭空给工单生成一对新单),职责混在一起;
     · 给计划员开了 create,他就同时能"提交过账"(动库存),超出他的职责。
   ⇒ 各自一行,权限短语分开授:
        MOBILE_PICK_CREATE = view,query,create,print   (只到"生单"这一步)
        MOBILE_PICK        = view,query,create,pick,submit,print
     (MOBILE_PICK 保留 create 词 —— 领料页的「去生成」按钮与后端 generate 接口仍按它判,
      两个面板对本行数据是同一批人时管理员可以两行都勾。)

   授权口径:按 MOBILE_PICK 现有授权角色**整份复制**(改前那些账号两个面板都能进 ⇒ 补权保持现状);
   管理员恒可。幂等:全部 INSERT ... WHERE NOT EXISTS。
   两账套都执行,已登记 tools/db-migrations.txt。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ---------- ① 面板名译名(scope='panel';9 语言) ---------- */
DECLARE @tr TABLE (locale varchar(10), text nvarchar(300));
INSERT INTO @tr (locale, text) VALUES
 ('en', N'Create Pick/Return Slips'),
 ('ja', N'払出/返却伝票作成'),
 ('ko', N'출고/반납 전표 생성'),
 ('es', N'Crear vales de retirada/devolución'),
 ('fr', N'Créer bons de prélèvement/retour'),
 ('de', N'Entnahme-/Rückgabescheine erstellen'),
 ('ru', N'Создать накладные выдачи/возврата'),
 ('vi', N'Tạo phiếu xuất/trả'),
 ('th', N'สร้างใบเบิก/คืน');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'panel', N'生成工单领料/退料单', t.locale, t.text, 'manual'
  FROM @tr t
 WHERE NOT EXISTS (
         SELECT 1 FROM yj_translation x
          WHERE x.scope = 'panel' AND x.ref_key = N'生成工单领料/退料单' AND x.locale = t.locale);
GO

/* ---------- ② 授权:按 MOBILE_PICK 现有角色整份复制 ---------- */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT rp.role_id, N'MOBILE_PICK_CREATE', N'N', N'view,query,create,print'
  FROM yj_role_panel rp
 WHERE rp.panel_code = N'MOBILE_PICK'
   AND NOT EXISTS (
         SELECT 1 FROM yj_role_panel x
          WHERE x.role_id = rp.role_id AND x.panel_code = N'MOBILE_PICK_CREATE');
GO

-- 兜底:MOBILE_PICK 一行授权都没有的环境(新库/测试库),至少把管理员补上,
-- 否则「生成工单领料/退料单」在权限矩阵里勾不到 = 功能等于不存在。
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'MOBILE_PICK_CREATE', N'N', N'view,query,create,print'
  FROM yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.panel_code = N'MOBILE_PICK_CREATE')
   AND (r.is_admin = N'Y' OR r.role_code IN (N'admin', N'ADMIN', N'super', N'superadmin'));
GO

/* ---------- ③ 自检 ---------- */
DECLARE @trCnt int, @roleCnt int;
SELECT @trCnt = COUNT(DISTINCT locale) FROM yj_translation
 WHERE scope = 'panel' AND ref_key = N'生成工单领料/退料单';
SELECT @roleCnt = COUNT(*) FROM yj_role_panel WHERE panel_code = N'MOBILE_PICK_CREATE';

IF @trCnt < 9
   RAISERROR(N'[FAIL] 「生成工单领料/退料单」面板名译名只有 %d 种语言(应 9)', 16, 1, @trCnt);
IF @roleCnt = 0
   RAISERROR(N'[FAIL] MOBILE_PICK_CREATE 一条授权行都没有(权限矩阵里会勾不到)', 16, 1);

IF @trCnt >= 9 AND @roleCnt > 0
   PRINT N'[PASS] 生成工单领料/退料单:9 语言译名齐备,' + CAST(@roleCnt AS nvarchar(10)) + N' 个角色已授权';
GO
