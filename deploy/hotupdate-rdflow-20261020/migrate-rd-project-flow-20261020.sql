/* ============================================================
   migrate-rd-project-flow-20261020.sql
   研发管理 · 项目管理 → 新增「项目流程管控」页面(页面级虚拟面板 PROJECT_FLOW)

   来源(用户 2026-10-20 原话):
     "我填写立项申请之后提交审批,但是我不知道我这个文件到底到哪个流程了,现在是只有到项目实施计划
      填写审批归档之后才会在项目进度查询里面看到,但是中间可能会卡住却不知道,现在在研发管理的项目
      管理里面加上一个项目流程管控,可以在这个面板通过立项申请表的编号进行一个流程查询,看看这个编号
      对应的流程走到哪里了,哪个环节还没有审批,哪个单据审批了下一张单内容还没有开始填写"

   口径:
     · 页面 = 只读盯单页,按立项单号把 10 个环节逐条判出来(前端 core/rd/flowStages.js 纯函数);
     · **不建表、不建视图** —— 数据现算(rd_approval / rd_plan / rd_progress_detail /
       yj_doc_status / yj_form_approval 全为既有表);
     · 面板码 PROJECT_FLOW 登记在 PagePanelRegistry(页面级虚拟面板,与 DC_CONFIG 同款:
       不往 yj_panel 插行,矩阵条目由 SysAdminController 注入);
     · 本脚本只做两件事:① 给**现有全部角色**补 yj_role_panel 授权行 ② 补面板名 en 译名。

   为什么"给全部角色都授权":改前这个能力根本不存在(用户只能靠项目进度查询事后看),
   新页面对所有人开放不会泄露各自看不到的东西(立项/实施计划的查看权仍在各面板权限里,
   本页只是把这些既有单据的状态汇总展示)。日后要收权,在「组织架构 → 角色与面板权限」里取消勾选即可。

   幂等:授权与译名全部 IF NOT EXISTS;末尾自检打印授权角色数。
   两账套均执行(先 HSDZ_MES 后 HSDZ_MES_TEST),已登记 tools/db-migrations.txt。
   ============================================================ */
SET NOCOUNT ON;
GO
IF OBJECT_ID('dbo.yj_role_panel','U') IS NULL OR OBJECT_ID('dbo.yj_role','U') IS NULL
BEGIN
  PRINT N'[SKIP] 缺少 yj_role / yj_role_panel,先跑基础权限脚本';
  RETURN;
END
GO

/* ---------- ① 授权:现有每个角色都给「可见 + 查询」(只读页,无写动作) ---------- */
INSERT INTO dbo.yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'PROJECT_FLOW', 'N', N'view,query'
  FROM dbo.yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel x
                    WHERE x.role_id = r.id AND x.panel_code = N'PROJECT_FLOW');
GO

/* ---------- ② 面板名 en 译名(AGENTS 多语言强制:页面级虚拟面板同样要译名) ---------- */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'项目流程管控' AND locale = 'en')
  INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
  VALUES ('panel', N'项目流程管控', 'en', N'Project Flow Control', 'manual');
GO

/* ---------- ③ 自检 ---------- */
DECLARE @roles int = (SELECT COUNT(*) FROM dbo.yj_role);
DECLARE @granted int = (SELECT COUNT(*) FROM dbo.yj_role_panel WHERE panel_code = N'PROJECT_FLOW');
DECLARE @tr int = (SELECT COUNT(*) FROM dbo.yj_translation
                    WHERE scope = 'panel' AND ref_key = N'项目流程管控' AND locale = 'en');
PRINT N'[CHECK] 角色 ' + CAST(@roles AS nvarchar(10)) + N' 个 / PROJECT_FLOW 授权 ' + CAST(@granted AS nvarchar(10))
      + N' 行 / en 译名 ' + CAST(@tr AS nvarchar(10)) + N' 条';
IF @granted < @roles
  RAISERROR(N'[FAIL] 有角色没拿到 PROJECT_FLOW 授权', 16, 1);
IF @tr = 0
  RAISERROR(N'[FAIL] 缺少面板名 en 译名', 16, 1);
PRINT N'[PASS] migrate-rd-project-flow-20261020.sql 执行完成';
GO
