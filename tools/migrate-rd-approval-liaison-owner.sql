-- migrate-rd-approval-liaison-owner.sql
-- 立项申请(RD_APPROVAL)加「对接人」「项目责任人」两个流程字段 + 研发审核角色开审批权
-- 幂等,两个账套都要执行(先 HSDZ_MES 正式,后 HSDZ_MES_TEST 测试)
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════════
   用户口径(2026-10-08,原话):
     「销售端提出需求 —— 申请前需刘博或冯工同意(这个的意思就是填写立项申请)」
     「冯总审核及定级 ← 红字批注(这个就是对立项申请进行审批与定级)」
     「定级完之后就要分发对接人,这个对接人可以自己选择是哪一个账号,分发之后对应对接人
       账号可以进行签核然后分发下去,就是确认责任人,也可以选择账号,确认责任人之后就
       可以在项目实施计划里面进行对应单据的填写,填写完通过审批之后归档进入项目进度查询
       追踪项目进度」

   目标流程(本脚本服务第 3、4 步):
     1 销售填立项申请 RD_APPROVAL
     2 冯总审批 + 定级(同一步骤两个动作)
     3 **分发对接人**:从账号列表选一个账号 → 写「对接人」
     4 该账号登录后**签核**并从账号列表选人 → 写「项目责任人」
     5 项目责任人在 RD_PLAN 填单(RD_PLAN.负责人 由「项目责任人」参照带入)
     6 RD_PLAN 审批归档 → 进 RD_PROGRESS 追踪

   存量占用核查(动手前实测,HSDZ_MES):
     · rd_approval 共 46 列,备用1..备用20 全 nvarchar(1000) NULL;
     · 现有 2 行数据 备用1 非空 = 0、备用2 非空 = 0 ⇒ 可安全占用;
     · yj_field 里 RD_APPROVAL 的 备用1/备用2 未被任何字段引用;
     · 「对接人」「项目责任人」在全库 yj_field 中 0 命中(标签不撞);
     · ⚠「责任人」标签已被 QC_BHC/QC_BHZ/QC_JJF/QC_SCP/RD_SPEC_DOC/RD_MOLD_PROC/
       RD_ASM_PROC/RD_ASM_BOM 占用 ⇒ 本脚本字段名必须带「项目」前缀,不得叫「责任人」。

   取值口径:两个字段都存**账号(username)**,不是姓名 —— 与同族先例一致:
     · rd_dev_task.file_owner 存账号(实测 glm53/cp);
     · rd_prod_info_head.责任人/审核人一级/审核人二级 存姓名(实测 系统管理员/彭于晏);
     · 用户口径明说「可以自己选择是哪一个账号」⇒ 从账号列表选,落库即账号。
   显示时前端拼「姓名（账号）」(与分发责任人弹窗同款)。

   hidden=1:两个字段由流程程序读写,不进通用表头网格,也不进纸面
     (RD_APPROVAL 纸面由 docSheetConfigs.js 的 rows 驱动,不列出的 key 不渲染)
     —— 与 RD_SPEC_DOC 等四文件的「是否受控/受控日期」同口径。
   写入点(配套代码,同批提交):
     · 分发对接人 → ButtonService.dispatchLiaison
     · 确认责任人 → ButtonService.confirmProjectOwner
     · 反审核清空 → ButtonService.unaudit
     · redaim 剥离 → ButtonService.save(body.remove)
   ═══════════════════════════════════════════════════════════════════════════ */

-- ① 字段登记
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_APPROVAL' AND col_name = N'备用1' AND place = N'header')
BEGIN
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                        display_field, place, seq, width, editable, required, hidden, visible)
  VALUES (N'RD_APPROVAL', N'备用1', N'对接人', N'文本', NULL, NULL, NULL,
          NULL, N'header', 210, 80, 0, 0, 1, 1);
  PRINT N'[OK] 字段登记:对接人(备用1)';
END
ELSE
  PRINT N'[--] 字段已存在:对接人(备用1)';
GO

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_APPROVAL' AND col_name = N'备用2' AND place = N'header')
BEGIN
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                        display_field, place, seq, width, editable, required, hidden, visible)
  VALUES (N'RD_APPROVAL', N'备用2', N'项目责任人', N'文本', NULL, NULL, NULL,
          NULL, N'header', 215, 80, 0, 0, 1, 1);
  PRINT N'[OK] 字段登记:项目责任人(备用2)';
END
ELSE
  PRINT N'[--] 字段已存在:项目责任人(备用2)';
GO

-- ② 列级中文注明(备用列原注「备用列池成员」,现承载明确语义)
DECLARE @t nvarchar(80) = N'rd_approval';
DECLARE @note1 nvarchar(400) = N'对接人(原备用列池成员 备用1;2026-10-08 起承载立项申请的对接人账号。流程:冯总审批并定级后由「分发对接人」写入选中账号,该账号登录后签核并「确认责任人」。存 username 非姓名,见 migrate-rd-approval-liaison-owner.sql)';
DECLARE @note2 nvarchar(400) = N'项目责任人(原备用列池成员 备用2;2026-10-08 起承载立项申请确认的项目责任人账号。流程:对接人签核时从账号列表选定,写入后作为 RD_PLAN.负责人 的参照来源(REF_SYNONYMS: 项目责任人 → 负责人)。存 username 非姓名)';

IF COL_LENGTH(@t, N'备用1') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(@t)
              AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(@t), N'备用1', 'ColumnId') AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @note1, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', N'备用1';
  ELSE
    EXEC sp_addextendedproperty N'MS_Description', @note1, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', N'备用1';
END
IF COL_LENGTH(@t, N'备用2') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(@t)
              AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(@t), N'备用2', 'ColumnId') AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @note2, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', N'备用2';
  ELSE
    EXEC sp_addextendedproperty N'MS_Description', @note2, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', N'备用2';
END
PRINT N'[OK] rd_approval.备用1/备用2 中文注明已更新';
GO

-- ③ 译名(10 语言;已存在的同 scope/ref_key/locale 不覆盖)
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', v.ref_key, v.locale, v.text, N'manual'
FROM (VALUES
  (N'对接人',   'en',    N'Liaison'),
  (N'对接人',   'zh-TW', N'對接人'),
  (N'对接人',   'ja',    N'担当窓口'),
  (N'对接人',   'ko',    N'담당 연락책'),
  (N'对接人',   'es',    N'Enlace'),
  (N'对接人',   'fr',    N'Interlocuteur'),
  (N'对接人',   'de',    N'Ansprechpartner'),
  (N'对接人',   'ru',    N'Контактное лицо'),
  (N'对接人',   'vi',    N'Người đầu mối'),
  (N'对接人',   'th',    N'ผู้ประสานงาน'),
  (N'项目责任人', 'en',    N'Project Owner'),
  (N'项目责任人', 'zh-TW', N'專案責任人'),
  (N'项目责任人', 'ja',    N'プロジェクト責任者'),
  (N'项目责任人', 'ko',    N'프로젝트 책임자'),
  (N'项目责任人', 'es',    N'Responsable del proyecto'),
  (N'项目责任人', 'fr',    N'Responsable du projet'),
  (N'项目责任人', 'de',    N'Projektverantwortlicher'),
  (N'项目责任人', 'ru',    N'Ответственный за проект'),
  (N'项目责任人', 'vi',    N'Người phụ trách dự án'),
  (N'项目责任人', 'th',    N'ผู้รับผิดชอบโครงการ')
) AS v(ref_key, locale, text)
WHERE NOT EXISTS (
  SELECT 1 FROM yj_translation x
  WHERE x.scope = N'field' AND x.ref_key = v.ref_key AND x.locale = v.locale);
PRINT N'[OK] 译名(对接人/项目责任人 × 10 语言)已补';
GO

-- ④ 研发审核角色(rd_review,实测 role_id=4,唯一成员 cp 陈秀丽)开 RD_APPROVAL 审批权
--    缘由:定级之后由「分发对接人」推进,该动作挂在审批侧;此前研发链 RD_APPROVAL
--    三个角色(2/4/5)can_approve 全为 'N' ⇒ 全库只有 admin 能审批/定级。
--    只开 RD_APPROVAL 一项,不动 RD_PLAN/RD_DOM_TEST/RD_PROGRESS。
DECLARE @role4 int = (SELECT TOP 1 id FROM yj_role WHERE role_code = N'rd_review');
IF @role4 IS NOT NULL
BEGIN
  UPDATE yj_role_panel SET can_approve = N'Y'
  WHERE role_id = @role4 AND panel_code = N'RD_APPROVAL' AND ISNULL(can_approve, N'N') <> N'Y';
  PRINT N'[OK] rd_review(role_id=' + CAST(@role4 AS nvarchar(10)) + N') 的 RD_APPROVAL can_approve → Y,影响 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';
END
ELSE
  PRINT N'[WARN] 未找到 role_code=rd_review 的角色,审批权未改';
GO

-- ⑤ 自检
DECLARE @f int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code = N'RD_APPROVAL' AND col_name IN (N'备用1', N'备用2')
                     AND label IN (N'对接人', N'项目责任人') AND hidden = 1);
DECLARE @col int = (SELECT COUNT(*) FROM sys.columns
                     WHERE name IN (N'备用1', N'备用2') AND object_id = OBJECT_ID('rd_approval'));
DECLARE @tr int = (SELECT COUNT(*) FROM yj_translation
                    WHERE scope = N'field' AND ref_key IN (N'对接人', N'项目责任人'));
DECLARE @ap int = (SELECT COUNT(*) FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id
                    WHERE r.role_code = N'rd_review' AND rp.panel_code = N'RD_APPROVAL' AND rp.can_approve = N'Y');
IF @f = 2 AND @col = 2 AND @tr >= 20 AND @ap >= 1
  PRINT N'[OK] 自检通过:字段 2/2、物理列 2/2、译名 ' + CAST(@tr AS nvarchar(4)) + N'/20、rd_review 审批权 ' + CAST(@ap AS nvarchar(3));
ELSE
  PRINT N'[WARN] 自检异常:字段 ' + CAST(@f AS nvarchar(3)) + N'/2、物理列 ' + CAST(@col AS nvarchar(3))
        + N'/2、译名 ' + CAST(@tr AS nvarchar(4)) + N'/20、rd_review 审批权 ' + CAST(@ap AS nvarchar(3));
GO
