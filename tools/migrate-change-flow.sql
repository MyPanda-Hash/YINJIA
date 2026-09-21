/* ═══════════════════════════════════════════════════════════════════════════════
   migrate-change-flow.sql — 产品变更申请单(RD_CHANGE)会签 / 审批 / 生效钩子数据层(2026-09-21)

   用户口径(第④⑤条):范围较大时由相关人员**会签**;填完提交冯总(admin)审核,
   **审核通过后变更生效** —— 按勾选的受控文件自动建**下一版草稿**(带来源单号)+ 通知责任人
   重走受控审核。状态链:草稿 →(填写中)→ 会签中(可选)→ 审批中(admin)→ 已生效。

   §1 yj_doc_status 补 [effective](已生效标记;与 canceled/stopped/pending 同一张状态表):
      审批通过即生效的面板(RD_CHANGE)落 'Y',状态推导显示「已生效」而不是「已审核」。
   §2 四个受控文件的头表补 [变更来源单号]:下一版草稿记下"我因哪张变更单而生"(审计线索)。
      · 成型工艺清单 rd_mold_proc_head / 组装工艺清单 rd_asm_proc_head
      · 规格书 rd_spec_doc_head / 出货检验计划表 rd_insp_plan_head
   §3 §2 四个面板登记字段:place='query'(列表可见) + hidden=1(**不上纸张**,避免动四张既有
      受控文件的版面)+ editable=0(系统标记,人改不了)+ 译名。
   §4 会签不改表:会签人存 rd_change_head.会签人(账号,逗号/顿号分隔),每签一行留痕落在既有
      yj_form_approval(action='SIGNOFF', result=PENDING/APPROVED/REJECTED/CANCELED, operator=会签人);
      「会签中」由"存在 PENDING 签名"推导 —— 与项目实施计划终止流(yj_plan_term)同一套做法。

   幂等:列 IF COL_LENGTH IS NULL;元数据行 NOT EXISTS;译名 NOT EXISTS。
   ═══════════════════════════════════════════════════════════════════════════════ */
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 1. yj_doc_status.effective
-- ═══════════════════════════════════════════════════════════════════
IF COL_LENGTH('yj_doc_status', 'effective') IS NULL
BEGIN
  ALTER TABLE yj_doc_status ADD effective char(1) NULL;
  PRINT N'yj_doc_status 补列 effective';
END
ELSE PRINT N'yj_doc_status.effective 已存在,跳过';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('yj_doc_status')
               AND minor_id=COLUMNPROPERTY(OBJECT_ID('yj_doc_status'),'effective','ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'已生效标记(Y=审批通过即生效的面板已生效,如产品变更申请单;状态推导显示「已生效」)',
       N'SCHEMA',N'dbo',N'TABLE',N'yj_doc_status',N'COLUMN',N'effective';
GO

-- ═══════════════════════════════════════════════════════════════════
-- 2. 四个受控文件头表补 [变更来源单号]
-- ═══════════════════════════════════════════════════════════════════
IF COL_LENGTH('rd_mold_proc_head', N'变更来源单号') IS NULL ALTER TABLE rd_mold_proc_head ADD [变更来源单号] nvarchar(120) NULL;
GO
IF COL_LENGTH('rd_asm_proc_head', N'变更来源单号') IS NULL ALTER TABLE rd_asm_proc_head ADD [变更来源单号] nvarchar(120) NULL;
GO
IF COL_LENGTH('rd_spec_doc_head', N'变更来源单号') IS NULL ALTER TABLE rd_spec_doc_head ADD [变更来源单号] nvarchar(120) NULL;
GO
IF COL_LENGTH('rd_insp_plan_head', N'变更来源单号') IS NULL ALTER TABLE rd_insp_plan_head ADD [变更来源单号] nvarchar(120) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('rd_mold_proc_head')
               AND minor_id=COLUMNPROPERTY(OBJECT_ID('rd_mold_proc_head'),N'变更来源单号','ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'本版由哪张产品变更申请单(RD_CHANGE)生效生成的下一版草稿(系统写入,人工不可改)',
       N'SCHEMA',N'dbo',N'TABLE',N'rd_mold_proc_head',N'COLUMN',N'变更来源单号';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('rd_asm_proc_head')
               AND minor_id=COLUMNPROPERTY(OBJECT_ID('rd_asm_proc_head'),N'变更来源单号','ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'本版由哪张产品变更申请单(RD_CHANGE)生效生成的下一版草稿(系统写入,人工不可改)',
       N'SCHEMA',N'dbo',N'TABLE',N'rd_asm_proc_head',N'COLUMN',N'变更来源单号';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('rd_spec_doc_head')
               AND minor_id=COLUMNPROPERTY(OBJECT_ID('rd_spec_doc_head'),N'变更来源单号','ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'本版由哪张产品变更申请单(RD_CHANGE)生效生成的下一版草稿(系统写入,人工不可改)',
       N'SCHEMA',N'dbo',N'TABLE',N'rd_spec_doc_head',N'COLUMN',N'变更来源单号';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('rd_insp_plan_head')
               AND minor_id=COLUMNPROPERTY(OBJECT_ID('rd_insp_plan_head'),N'变更来源单号','ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'本版由哪张产品变更申请单(RD_CHANGE)生效生成的下一版草稿(系统写入,人工不可改)',
       N'SCHEMA',N'dbo',N'TABLE',N'rd_insp_plan_head',N'COLUMN',N'变更来源单号';
GO

-- ═══════════════════════════════════════════════════════════════════
-- 3. 四个面板登记 [变更来源单号] 字段(列表可见、不上纸张、不可编辑)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, N'变更来源单号', N'变更来源单号', N'文本', N'query', 999, 130, 0, 0, 1, 1
FROM (VALUES (N'RD_MOLD_PROC'), (N'RD_ASM_PROC'), (N'RD_SPEC_DOC'), (N'RD_INSP_PLAN')) AS v(panel_code)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = v.panel_code AND f.label = N'变更来源单号');
GO
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', N'变更来源单号', v.locale, v.text, N'manual'
FROM (VALUES ('en', N'Change Source No.'), ('zh-TW', N'變更來源單號'),
             ('ja', N'変更元伝票番号'), ('ko', N'변경 출처 번호')) AS v(locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope = N'field' AND t.ref_key = N'变更来源单号' AND t.locale = v.locale);
GO

-- ═══════════════════════════════════════════════════════════════════
-- 4. 校验输出
-- ═══════════════════════════════════════════════════════════════════
SELECT N'yj_doc_status.effective' AS 检查项, CAST(COUNT(*) AS nvarchar) AS 值 FROM sys.columns
 WHERE object_id = OBJECT_ID('yj_doc_status') AND name = 'effective'
UNION ALL SELECT N'四表 变更来源单号 列数(应 4)', CAST(COUNT(*) AS nvarchar) FROM sys.columns
 WHERE name = N'变更来源单号' AND object_id IN (OBJECT_ID('rd_mold_proc_head'), OBJECT_ID('rd_asm_proc_head'),
       OBJECT_ID('rd_spec_doc_head'), OBJECT_ID('rd_insp_plan_head'))
UNION ALL SELECT N'字段登记行数(应 4)', CAST(COUNT(*) AS nvarchar) FROM yj_field WHERE label = N'变更来源单号'
UNION ALL SELECT N'译名行数(应 4)', CAST(COUNT(*) AS nvarchar) FROM yj_translation
 WHERE scope = N'field' AND ref_key = N'变更来源单号';
GO
