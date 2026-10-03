-- migrate-rd-datarec-reviewer-2026-09-30.sql
-- 数据记录表(实验室 8 张)补「审核人」+ 让陈秀丽真能审批 —— 幂等,两个账套都要执行
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════════
   需求原文(《产品开发系统需求汇总.xlsx》sheet「数据记录表」):
     1. 数据记录表:**都需要审核人(秀丽)**
   用户口径(2026-09-30):「真的能审核」—— 不只是纸面印个字,陈秀丽必须**真有审批权**。

   现状(2026-09-30 实测):
     · 8 张表头**没有任何审核人字段**(yj_field 搜 审核/审批/批准/复核/确认人 → 0 行;
       头表物理列二轮反查也只有"编号"类);
     · 全库 yj_role_panel.can_approve='Y' = **0 行** ⇒ 所有面板**只有 admin 能审**,
       陈秀丽(cp)审不了;
     · cp 与 6 个演示账号同在 role_id=2(role_code='user') ⇒ **不能**直接给该角色勾审批权,
       否则演示账号也能审真实单据。

   本脚本做四件事:
     ① 建专用角色「研发审核」(rd_review),**复制普通用户角色的全部面板权限**
        (保证 cp 换角色后能力不缩水:79 行权限逐行复制);
     ② 该角色在 8 张数据记录表上 can_approve='Y';
     ③ 陈秀丽(cp)迁到该角色;
     ④ 8 张表登记「表单审核人」字段 —— 走**备用列池**(docs/design/动态字段扩展-备用列池-V1.0.md,
        2026-09-28 已批准:零 DDL 加字段),占 `备用1`;同批把该列的中文注明改成它的新语义。

   ⚠ 列名为什么叫「表单审核人」而不是「审核人」:ButtonService.save() 会显式
     `body.remove("审核人")`(那是 yj_doc_status.shr 审核留痕的虚拟字段)⇒ 字段名若叫「审核人」,
     值会在保存时被静默丢弃。QC_INSP_REC 当年踩过同一个坑,落库列名同样用「表单审核人」,
     纸面印作「审核人」。本脚本与它同款(见 ButtonService.java 第 229-230 行、该面板迁移注释)。
   ═══════════════════════════════════════════════════════════════════════════ */

-- ① 专用角色
IF NOT EXISTS (SELECT 1 FROM yj_role WHERE role_code = N'rd_review')
BEGIN
  INSERT INTO yj_role (role_code, role_name, remark, is_admin)
  VALUES (N'rd_review', N'研发审核',
          N'数据记录表(实验室 8 张)的审核人角色。2026-09-30 新建:此前全库 can_approve=Y 为 0 行,只有 admin 能审。权限由 role_code=user 整份复制而来,cp(陈秀丽)挂此角色。',
          N'N');
  PRINT N'[OK] 新建角色 研发审核(rd_review)';
END
ELSE PRINT N'[SKIP] 角色 rd_review 已存在';
GO

-- ② 复制普通用户角色的全部面板权限(逐面板:已存在的跳过,保证幂等且不覆盖人工调整)
DECLARE @new int = (SELECT id FROM yj_role WHERE role_code = N'rd_review');
DECLARE @usr int = (SELECT id FROM yj_role WHERE role_code = N'user');
IF @new IS NOT NULL AND @usr IS NOT NULL
BEGIN
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
  SELECT @new, rp.panel_code, rp.can_approve, rp.perms
    FROM yj_role_panel rp
   WHERE rp.role_id = @usr
     AND NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = @new AND x.panel_code = rp.panel_code);
  PRINT N'[OK] 复制普通用户面板权限 → rd_review,新增 ' + CAST(@@ROWCOUNT AS nvarchar(6)) + N' 行';
END
ELSE PRINT N'[WARN] 角色缺失,跳过权限复制';
GO

-- ③ 8 张数据记录表:该角色可审批
UPDATE yj_role_panel
   SET can_approve = 'Y'
 WHERE role_id = (SELECT id FROM yj_role WHERE role_code = N'rd_review')
   AND panel_code IN ('RD_FILTER_EFF', 'RD_ALKALINE', 'RD_MINERAL', 'RD_ANTIBACT',
                      'RD_SCALE', 'RD_RO_PROTECT', 'RD_SOAK', 'RD_DROP_PREC')
   AND ISNULL(can_approve, 'N') <> 'Y';
PRINT N'[OK] 数据记录表 8 张授予 rd_review 审批权,新授 ' + CAST(@@ROWCOUNT AS nvarchar(6)) + N' 张';
GO

-- ④ 陈秀丽(cp)迁到该角色(能力不缩水由 ② 保证)
UPDATE yj_user
   SET role_id = (SELECT id FROM yj_role WHERE role_code = N'rd_review')
 WHERE username = N'cp'
   AND role_id = (SELECT id FROM yj_role WHERE role_code = N'user');
PRINT N'[OK] cp(陈秀丽)角色迁移,影响 ' + CAST(@@ROWCOUNT AS nvarchar(6)) + N' 行';
GO

-- ⑤ 8 张表登记「表单审核人」动态字段(占备用列池的 备用1)+ 同步该列中文注明
DECLARE @panels TABLE (code nvarchar(30));
INSERT INTO @panels (code) VALUES
  ('RD_FILTER_EFF'), ('RD_ALKALINE'), ('RD_MINERAL'), ('RD_ANTIBACT'),
  ('RD_SCALE'), ('RD_RO_PROTECT'), ('RD_SOAK'), ('RD_DROP_PREC');

DECLARE @c nvarchar(30), @tbl nvarchar(80), @note nvarchar(400);
DECLARE @done int = 0;
DECLARE cur CURSOR FOR SELECT code FROM @panels;
OPEN cur;
FETCH NEXT FROM cur INTO @c;
WHILE @@FETCH_STATUS = 0
BEGIN
  -- 字段登记:place=header、hidden=1(只走纸张,不进通用表单/列表 —— 与 QC_INSP_REC 的 表单审核人 同口径)
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @c AND col_name = N'备用1')
  BEGIN
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, visible)
    VALUES (@c, N'备用1', N'表单审核人', N'文本', NULL, NULL, NULL, NULL,
            N'header', 145, 100, 1, 0, 1, 1);
    SET @done = @done + 1;
  END

  -- 列级中文注明:原来写的是"备用列",现在它承载了明确语义,必须说清楚
  SET @tbl = LOWER(@c) + N'_head';
  SET @note = N'表单审核人(原备用列池成员 备用1;2026-09-30 起承载数据记录表审核人签名,纸面印作「审核人」)。'
            + N'⚠ 不要改名回「审核人」:ButtonService.save() 会 body.remove("审核人") 把它丢掉。';
  IF COL_LENGTH(@tbl, N'备用1') IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
                WHERE ep.major_id = OBJECT_ID(@tbl)
                  AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(@tbl), N'备用1', 'ColumnId')
                  AND ep.name = N'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @note, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', N'备用1';
    ELSE
      EXEC sp_addextendedproperty N'MS_Description', @note, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', N'备用1';
  END

  FETCH NEXT FROM cur INTO @c;
END
CLOSE cur;
DEALLOCATE cur;
PRINT N'[OK] 表单审核人 字段登记,新增 ' + CAST(@done AS nvarchar(4)) + N' 张(共 8 张)';
GO

-- ⑥ 自检
DECLARE @fld int = (SELECT COUNT(*) FROM yj_field
                     WHERE col_name = N'备用1' AND label = N'表单审核人'
                       AND panel_code IN ('RD_FILTER_EFF', 'RD_ALKALINE', 'RD_MINERAL', 'RD_ANTIBACT',
                                          'RD_SCALE', 'RD_RO_PROTECT', 'RD_SOAK', 'RD_DROP_PREC'));
DECLARE @app int = (SELECT COUNT(*) FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id
                     WHERE r.role_code = N'rd_review' AND rp.can_approve = 'Y'
                       AND rp.panel_code IN ('RD_FILTER_EFF', 'RD_ALKALINE', 'RD_MINERAL', 'RD_ANTIBACT',
                                             'RD_SCALE', 'RD_RO_PROTECT', 'RD_SOAK', 'RD_DROP_PREC'));
DECLARE @cpRole nvarchar(40) = (SELECT r.role_code FROM yj_user u JOIN yj_role r ON r.id = u.role_id WHERE u.username = N'cp');
DECLARE @permCnt int = (SELECT COUNT(*) FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id WHERE r.role_code = N'rd_review');
IF @fld = 8 AND @app = 8 AND @cpRole = N'rd_review'
  PRINT N'[OK] 自检通过:表单审核人字段 8/8、rd_review 审批权 8/8、cp 已挂 rd_review(权限 ' + CAST(@permCnt AS nvarchar(5)) + N' 行)';
ELSE
  PRINT N'[WARN] 自检异常:字段 ' + CAST(@fld AS nvarchar(3)) + N'/8、审批权 ' + CAST(@app AS nvarchar(3))
      + N'/8、cp 角色 ' + ISNULL(@cpRole, N'(空)');
GO
