-- ════════════════════════════════════════════════════════════════════════════════════════
-- migrate-drop-qc-insp-spec.sql — 清理「检验规范」三页纸张式面板(QC_INSP_SPEC)
--   2026-10-09 用户口径:「不行当前实现不正确,去除当前实现」(范围=只撤这一轮:
--   三页检验规范 + 「选检验项目」从规范取数;「逐工单追溯质检段」「检验项目/检验方案维护弹窗」保留)。
--   与 git 回退配套:分支已 reset 回 aec5306c(migrate-qc-insp-spec.sql 已从清单移除),
--   本脚本负责把**库里**已经落下的对象一并清掉,避免留下不可见的面板/表/字段残留。
-- ════════════════════════════════════════════════════════════════════════════════════════
-- 【删什么】yj_field(本面板) → yj_panel → yj_role_panel(若曾授权) → 面板级译名 → 两张表。
-- 【不删什么】同名字段译名是**跨面板共享**的(如 文件编号/备注/审核人),按 ref_key 一刀切会误伤
--   其它面板 —— 故只删「本面板引入且现在没有任何 yj_field 再用」的那些词条。
-- 【数据守卫】只拦**有内容**的单据:非播种创建、且(有明细行 或 头字段填过内容)的规范单 ⇒ 拒绝删除并列出;
--   **空草稿**(点「新增」产生、一个字没填的)随功能一并清掉 —— 它们是本功能的产物,不是业务数据。
--   确需删除有内容的单据请人工确认后改本脚本。
-- 【幂等】已清则各段为 0 行/跳过,自检仍 PASS。两账套均执行。
-- ════════════════════════════════════════════════════════════════════════════════════════

DECLARE @extra int = 0;
IF OBJECT_ID('dbo.qc_insp_spec_head', 'U') IS NOT NULL
  SELECT @extra = COUNT(*) FROM dbo.qc_insp_spec_head h
   WHERE ISNULL(h.asp_user1, N'') <> N'migration'
     AND ( EXISTS (SELECT 1 FROM dbo.qc_insp_spec_detail d
                    WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N') <> 'Y'
                      AND ISNULL(d.asp_user1,N'') <> N'migration')   -- ⚠ 播种单与空草稿可能**同号**,按行的创建人区分
        OR ISNULL(h.文件编号,N'') <> N'' OR ISNULL(h.文件名称,N'') <> N'' OR ISNULL(h.版本版次,N'') <> N''
        OR ISNULL(h.物料编码,N'') <> N'' OR ISNULL(h.目的,N'') <> N'' OR ISNULL(h.范围,N'') <> N''
        OR ISNULL(h.职责和权限,N'') <> N'' OR ISNULL(h.取样要求,N'') <> N'' OR ISNULL(h.工作程序,N'') <> N'' );

IF @extra > 0
BEGIN
  RAISERROR(N'qc_insp_spec_head 存在「有内容」的检验规范单据 %d 张(非播种、且填过头字段或有明细行),拒绝删除(人工确认后再改本脚本)', 16, 1, @extra);
END
ELSE
BEGIN
  /* ① 元数据:字段 → 角色授权 → 面板 */
  DELETE FROM yj_role_panel WHERE panel_code = N'QC_INSP_SPEC';
  DELETE FROM yj_field      WHERE panel_code = N'QC_INSP_SPEC';
  DELETE FROM yj_panel      WHERE panel_code = N'QC_INSP_SPEC';
  /* ② 面板级译名(检验规范) */
  DELETE FROM yj_translation WHERE scope = 'panel' AND ref_key = N'检验规范';
  /* ③ 字段级译名:只删「本面板引入 + 现在已无任何面板在用」的标签,避免误删共享词条 */
  DELETE t FROM yj_translation t
   WHERE t.scope = 'field' AND t.locale = 'en'
     AND t.ref_key IN (N'修订理由与内容简述', N'称料', N'接受标准', N'适用产品', N'版本版次',
                       N'拟定', N'职责和权限', N'工作程序', N'管控状态')
     AND NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.label = t.ref_key);
  /* ④ 数据表(先明细后头;播种数据随表一并消失) */
  IF OBJECT_ID('dbo.qc_insp_spec_detail', 'U') IS NOT NULL DROP TABLE dbo.qc_insp_spec_detail;
  IF OBJECT_ID('dbo.qc_insp_spec_head',   'U') IS NOT NULL DROP TABLE dbo.qc_insp_spec_head;
END
GO

/* 自检:对象/面板/字段/授权/面板译名都不该再存在 */
IF OBJECT_ID('dbo.qc_insp_spec_head', 'U') IS NOT NULL
   OR OBJECT_ID('dbo.qc_insp_spec_detail', 'U') IS NOT NULL
   OR EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_INSP_SPEC')
   OR EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_SPEC')
   OR EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code = N'QC_INSP_SPEC')
   OR EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'检验规范')
  RAISERROR(N'检验规范清理未完成(仍有表/面板/字段/授权/译名残留)', 16, 1);
ELSE PRINT N'检验规范面板已清理:表 qc_insp_spec_head/_detail、面板 QC_INSP_SPEC、字段/授权/译名均无残留';
