-- migrate-rd-file-controlled-2026-09-30.sql
-- 四个受控文件各加「是否受控」「受控日期」,归档时自动写入 —— 幂等,两个账套都要执行
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════════
   需求原文(《产品开发系统需求汇总.xlsx》sheet「文件汇总表」的「产品文件流程」):
     5.1 规格书(项目负责人):保存/提交 → 提交后审批 → **审批后自动受控**
   用户口径(2026-09-30):受控**按文件**(问的是"受控按文件还是按产品",答「按文件」)。

   现状(动手前实测):四个文件面板**没有任何受控字段**(全库 yj_field 里
   col_name/label 含「受控」的 = 0 行),也没写受控的代码;产品文件列表里那两列
   「是否受控/受控日期」是 `PxController.prodDocList` **产品级派生**的
   (4 格全「开发完毕」⇒ 是,受控日期取各面板 MAX(archived_at))——
   即"整产品受控",不是需求说的"**这个文件**审批完就受控"。

   本脚本给四个文件面板各登记两个字段,**走备用列池**(零 DDL,依
   docs/design/动态字段扩展-备用列池-V1.0.md):
     `备用1` → 是否受控(是/否)   `备用2` → 受控日期(yyyy-MM-dd HH:mm:ss)
   hidden=1:只走纸张/由程序读写,不进通用表单与列表(与 QC_INSP_REC 的表单审核人同口径)。
   写入点是 ButtonService.markArchived(保存即归档 / 审批通过 三处共用),
   产品文件列表的受控两列随后改为**读这两列**(见同批后端改动)。
   ⚠ 四张表各用各自的 备用1/备用2 —— 备用列池是**每表**一套,互不影响。
   ═══════════════════════════════════════════════════════════════════════════ */

-- ① 字段登记(四张表各两条)
DECLARE @panels TABLE (code nvarchar(30), tbl nvarchar(80), title nvarchar(40));
INSERT INTO @panels (code, tbl, title) VALUES
  ('RD_SPEC_DOC',  'rd_spec_doc_head',  N'规格书'),
  ('RD_MOLD_PROC', 'rd_mold_proc_head', N'成型工艺清单'),
  ('RD_ASM_PROC',  'rd_asm_proc_head',  N'组装工艺清单'),
  ('RD_INSP_PLAN', 'rd_insp_plan_head', N'出货检验计划表');

DECLARE @c nvarchar(30), @t nvarchar(80), @ti nvarchar(40), @done int = 0;
DECLARE cur CURSOR FOR SELECT code, tbl, title FROM @panels;
OPEN cur; FETCH NEXT FROM cur INTO @c, @t, @ti;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @c AND col_name = N'备用1')
  BEGIN
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, visible)
    VALUES (@c, N'备用1', N'是否受控', N'文本', NULL, NULL, NULL, NULL, N'header', 200, 80, 0, 0, 1, 1),
           (@c, N'备用2', N'受控日期', N'文本', NULL, NULL, NULL, NULL, N'header', 205, 120, 0, 0, 1, 1);
    SET @done = @done + 1;
  END
  FETCH NEXT FROM cur INTO @c, @t, @ti;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[OK] 受控字段登记:新增 ' + CAST(@done AS nvarchar(3)) + N' 张(共 4 张,每张 是否受控/受控日期 两列)';
GO

-- ② 列级中文注明(备用列原来写的是"备用列池成员",现在承载明确语义)
DECLARE @p2 TABLE (tbl nvarchar(80));
INSERT INTO @p2 (tbl) VALUES ('rd_spec_doc_head'), ('rd_mold_proc_head'), ('rd_asm_proc_head'), ('rd_insp_plan_head');
DECLARE @t2 nvarchar(80), @note1 nvarchar(400), @note2 nvarchar(400);
DECLARE cur2 CURSOR FOR SELECT tbl FROM @p2;
OPEN cur2; FETCH NEXT FROM cur2 INTO @t2;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @note1 = N'是否受控(原备用列池成员 备用1;2026-09-30 起承载本文件受控标记:审批归档时由 ButtonService.markArchived 写「是」。需求:四个受控文件各自受控,见 migrate-rd-file-controlled-2026-09-30.sql)';
  SET @note2 = N'受控日期(原备用列池成员 备用2;2026-09-30 起承载本文件的受控时点,归档时与 备用1 同批写入,格式 yyyy-MM-dd HH:mm:ss)';
  IF COL_LENGTH(@t2, N'备用1') IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(@t2)
                AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(@t2), N'备用1', 'ColumnId') AND ep.name = N'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @note1, N'SCHEMA', N'dbo', N'TABLE', @t2, N'COLUMN', N'备用1';
    ELSE
      EXEC sp_addextendedproperty N'MS_Description', @note1, N'SCHEMA', N'dbo', N'TABLE', @t2, N'COLUMN', N'备用1';
  END
  IF COL_LENGTH(@t2, N'备用2') IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(@t2)
                AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(@t2), N'备用2', 'ColumnId') AND ep.name = N'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @note2, N'SCHEMA', N'dbo', N'TABLE', @t2, N'COLUMN', N'备用2';
    ELSE
      EXEC sp_addextendedproperty N'MS_Description', @note2, N'SCHEMA', N'dbo', N'TABLE', @t2, N'COLUMN', N'备用2';
  END
  FETCH NEXT FROM cur2 INTO @t2;
END
CLOSE cur2; DEALLOCATE cur2;
PRINT N'[OK] 四张表的 备用1/备用2 中文注明已更新';
GO

-- ③ 自检
DECLARE @f int = (SELECT COUNT(*) FROM yj_field WHERE col_name IN (N'备用1', N'备用2')
                   AND panel_code IN ('RD_SPEC_DOC', 'RD_MOLD_PROC', 'RD_ASM_PROC', 'RD_INSP_PLAN'));
DECLARE @col int = (SELECT COUNT(*) FROM sys.columns
                     WHERE name IN (N'备用1', N'备用2')
                       AND object_id IN (OBJECT_ID('rd_spec_doc_head'), OBJECT_ID('rd_mold_proc_head'),
                                         OBJECT_ID('rd_asm_proc_head'), OBJECT_ID('rd_insp_plan_head')));
IF @f = 8 AND @col = 8
  PRINT N'[OK] 自检通过:字段 8/8、物理列 8/8';
ELSE
  PRINT N'[WARN] 自检异常:字段 ' + CAST(@f AS nvarchar(3)) + N'/8、物理列 ' + CAST(@col AS nvarchar(3)) + N'/8';
GO
