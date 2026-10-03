-- migrate-qc-docs-twolevel.sql — 质量单据(品质管理·质量单据 7 张)改两级审批
--
-- 用户口径(2026-10-04):「所有品质管理下的质量单据都采用这个二级审批的形式」——
-- 即在特采单(QC_TC_IN,见 tools/migrate-qc-tcin-twolevel.sql)之后,把同一套做法铺到
-- 品质管理 > 质量单据 这一组 7 张:
--   QC_BHG 不合格报告(制程) YJ-QR-11 / QC_BHC 不合格品处理单(制程) YJ-QR-59 /
--   QC_BHZ 不合格品处理单(自制物料) YJ-QR-64 / QC_JJF 紧急放行申请单 YJ-QR-92 /
--   QC_SCP 试产材料使用申请单 YJ-QR-118 / QC_LYB 来料异常分析报告 YJ-QR-119 /
--   QC_SCY 生产异常分析报告 YJ-QR-120
--
-- 纸面口径(七张 + 特采单底部落款都是「编制 / 审核 / 批准」三格):
--   编制 = **提交审批的人**;审核 = **一级审批通过的人**(组织架构给该角色勾了该面板
--   「审核反审核」⇒ yj_role_panel.can_approve='Y' 的账号 ∪ 管理员);批准 = **超级管理员**。
--   一级通过不生成采购入库单,超级管理员批准通过才通过;两级必须各点一次。
--   ⚠ 「编制」这一格各表绑的列不同 —— 逐面板登记(与 ButtonService.QC_DOC_PREPARER 同一份口径):
--       QC_BHG=填写人  QC_BHC=责任人  QC_BHZ=责任人  QC_JJF=检测人
--       QC_SCP=责任人  QC_LYB=编制人  QC_SCY=编制人  QC_TC_IN=编制人
--
-- 本脚本只改**元数据**(七张表的 审核人/审核时间/审批人/审批时间 四列早已存在,见 2026-09-28 体检):
--   §1 yj_field 补登记「审批人」「审批时间」(此前只在建表里、没有字段登记 ⇒ 纸面「批准」格拿不到值);
--   §2 「编制」格 + 审核人 + 审批人 三格置 editable=0(只读)—— 前端 DocSheet 按字段元数据渲染成纯文本,
--      后端 save() 同时剥离这些键的入参(真源只有审批流动作一个);
--   §3 关键列中文注明(旧注明是 2026-09-28 体检批量打的「历史遗留英文列…清理候选」,对这些列已经过时);
--   §4 译名:审批人 / 审批时间 由 migrate-qc-tcin-twolevel.sql 统一补齐(标签级共享),本脚本只自检。
--
-- 幂等(IF NOT EXISTS / 无条件 UPDATE 到目标值),两账套均须执行。

SET NOCOUNT ON;
GO

-- ═════════════ 1. yj_field:审批人 / 审批时间 登记(7 张,seq 接在「审核时间」之后) ═════════════
-- 纸面底部落款第三格「批准」绑的就是 审批人(qcSheetCfgs → qcSignStd(X) 的第三项
-- { label:'批准', key:'审批人' });没登记字段 ⇒ 单据查询选不出该列 ⇒ 永远空白。
DECLARE @p sysname, @seq int;
DECLARE curp CURSOR LOCAL FAST_FORWARD FOR
  SELECT v.p FROM (VALUES (N'QC_BHG'),(N'QC_BHC'),(N'QC_BHZ'),
                          (N'QC_JJF'),(N'QC_SCP'),(N'QC_LYB'),(N'QC_SCY')) AS v(p);
OPEN curp; FETCH NEXT FROM curp INTO @p;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @seq = ISNULL((SELECT MAX(seq) FROM yj_field WHERE panel_code = @p AND col_name IN (N'审核人', N'审核时间')), 150);

  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @p AND col_name = N'审批人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                          place, seq, width, editable, required, hidden, visible)
    VALUES (@p, N'审批人', N'审批人', N'文本', NULL, NULL, NULL, NULL, N'header', @seq + 1, 90, 0, 0, 0, 1);

  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @p AND col_name = N'审批时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                          place, seq, width, editable, required, hidden, visible)
    VALUES (@p, N'审批时间', N'审批时间', N'文本', NULL, NULL, NULL, NULL, N'header', @seq + 2, 130, 0, 0, 0, 1);

  -- 审计两格(审核/审批)恒定只读:值只由审批流写
  UPDATE yj_field SET editable = 0, required = 0
  WHERE panel_code = @p AND col_name IN (N'审核人', N'审核时间', N'审批人', N'审批时间');

  FETCH NEXT FROM curp INTO @p;
END
CLOSE curp; DEALLOCATE curp;
GO

-- ═════════════ 2. 「编制」格只读(各表绑的列不同,逐面板置 editable=0) ═════════════
-- 与 ButtonService.QC_DOC_PREPARER 一一对应;save() 同口径剥离入参 ⇒ 只能由「提交审批」写。
UPDATE yj_field SET editable = 0, required = 0 WHERE panel_code = 'QC_BHG' AND col_name = N'填写人';
UPDATE yj_field SET editable = 0, required = 0 WHERE panel_code = 'QC_BHC' AND col_name = N'责任人';
UPDATE yj_field SET editable = 0, required = 0 WHERE panel_code = 'QC_BHZ' AND col_name = N'责任人';
UPDATE yj_field SET editable = 0, required = 0 WHERE panel_code = 'QC_JJF' AND col_name = N'检测人';
UPDATE yj_field SET editable = 0, required = 0 WHERE panel_code = 'QC_SCP' AND col_name = N'责任人';
UPDATE yj_field SET editable = 0, required = 0 WHERE panel_code = 'QC_LYB' AND col_name = N'编制人';
UPDATE yj_field SET editable = 0, required = 0 WHERE panel_code = 'QC_SCY' AND col_name = N'编制人';
GO

-- ═════════════ 3. 关键列中文注明(旧注明已过时,改为两级审批口径) ═════════════
DECLARE @t sysname, @c sysname, @d nvarchar(400);
DECLARE curt CURSOR LOCAL FAST_FORWARD FOR
  SELECT v.t, v.c, v.d FROM (VALUES
    (N'qc_bhg', N'填写人',  N'填写人(历史名):纸面底部落款①「编制」=提交审批的人(质量单据两级审批,提交时后端自动写,只读不可手改)'),
    (N'qc_bhg', N'审核人',  N'审核人(流程):纸面落款②「审核」=一级审批通过的人(组织架构勾了「不合格报告·审核反审核」的账号∪管理员;驳回/弃审清空)'),
    (N'qc_bhg', N'审核时间', N'审核时间:一级审批通过的时间(与审核人同进同退;驳回/弃审清空)'),
    (N'qc_bhg', N'审批人',  N'审批人:纸面落款③「批准」=超级管理员(yj_user.is_admin=Y;二级审批通过时才落值;驳回/弃审清空)'),
    (N'qc_bhg', N'审批时间', N'审批时间:超级管理员批准的时间')
  ) AS v(t, c, d);
OPEN curt; FETCH NEXT FROM curt INTO @t, @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(@t, @c) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = COLUMNPROPERTY(ep.major_id, @c, 'ColumnId')
                 AND ep.name = 'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
    ELSE
      EXEC sp_addextendedproperty    N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  END
  FETCH NEXT FROM curt INTO @t, @c, @d;
END
CLOSE curt; DEALLOCATE curt;
GO

-- 其余 6 张同一套写法的简表(逐列注明,内容与上面同构)
DECLARE @t2 sysname, @c2 sysname, @d2 nvarchar(400);
DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR
  SELECT v.t, v.c, v.d FROM (VALUES
    (N'qc_bhc', N'责任人',  N'责任人(历史名):纸面底部落款①「编制」=提交审批的人(⚠该列同时是表头「责任人」业务格,两级审批后两处都显示提交人,只读)'),
    (N'qc_bhc', N'审核人',  N'审核人(流程):纸面落款②「审核」=一级审批通过的人(勾了该面板「审核反审核」的角色账号∪管理员;驳回/弃审清空)'),
    (N'qc_bhc', N'审核时间', N'审核时间:一级审批通过的时间(驳回/弃审清空)'),
    (N'qc_bhc', N'审批人',  N'审批人:纸面落款③「批准」=超级管理员(二级审批通过时才落值;驳回/弃审清空)'),
    (N'qc_bhc', N'审批时间', N'审批时间:超级管理员批准的时间'),

    (N'qc_bhz', N'责任人',  N'责任人(历史名):纸面底部落款①「编制」=提交审批的人(⚠该列同时是表头「责任人」业务格,只读)'),
    (N'qc_bhz', N'审核人',  N'审核人(流程):纸面落款②「审核」=一级审批通过的人(驳回/弃审清空)'),
    (N'qc_bhz', N'审核时间', N'审核时间:一级审批通过的时间(驳回/弃审清空)'),
    (N'qc_bhz', N'审批人',  N'审批人:纸面落款③「批准」=超级管理员(驳回/弃审清空)'),
    (N'qc_bhz', N'审批时间', N'审批时间:超级管理员批准的时间'),

    (N'qc_jjf', N'检测人',  N'检测人(历史名):纸面底部落款①「编制」=提交审批的人(只读,提交时自动写)'),
    (N'qc_jjf', N'审核人',  N'审核人(流程):纸面落款②「审核」=一级审批通过的人(驳回/弃审清空)'),
    (N'qc_jjf', N'审核时间', N'审核时间:一级审批通过的时间(驳回/弃审清空)'),
    (N'qc_jjf', N'审批人',  N'审批人:纸面落款③「批准」=超级管理员(驳回/弃审清空)'),
    (N'qc_jjf', N'审批时间', N'审批时间:超级管理员批准的时间'),

    (N'qc_scp', N'责任人',  N'责任人(历史名):纸面底部落款①「编制」=提交审批的人(⚠该列同时是表头「责任人」业务格,只读)'),
    (N'qc_scp', N'审核人',  N'审核人(流程):纸面落款②「审核」=一级审批通过的人(驳回/弃审清空)'),
    (N'qc_scp', N'审核时间', N'审核时间:一级审批通过的时间(驳回/弃审清空)'),
    (N'qc_scp', N'审批人',  N'审批人:纸面落款③「批准」=超级管理员(驳回/弃审清空)'),
    (N'qc_scp', N'审批时间', N'审批时间:超级管理员批准的时间'),

    (N'qc_lyb', N'编制人',  N'编制人:纸面底部落款①「编制」=提交审批的人(只读,提交时自动写;正文「异常描述/处理方式」的签名格同字段同口径)'),
    (N'qc_lyb', N'审核人',  N'审核人(流程):纸面落款②「审核」=一级审批通过的人(驳回/弃审清空)'),
    (N'qc_lyb', N'审核时间', N'审核时间:一级审批通过的时间(驳回/弃审清空)'),
    (N'qc_lyb', N'审批人',  N'审批人:纸面落款③「批准」=超级管理员(驳回/弃审清空)'),
    (N'qc_lyb', N'审批时间', N'审批时间:超级管理员批准的时间'),

    (N'qc_scy', N'编制人',  N'编制人:纸面底部落款①「编制」=提交审批的人(只读,提交时自动写;正文 5 处签名格同字段同口径)'),
    (N'qc_scy', N'审核人',  N'审核人(流程):纸面落款②「审核」=一级审批通过的人(驳回/弃审清空)'),
    (N'qc_scy', N'审核时间', N'审核时间:一级审批通过的时间(驳回/弃审清空)'),
    (N'qc_scy', N'审批人',  N'审批人:纸面落款③「批准」=超级管理员(驳回/弃审清空)'),
    (N'qc_scy', N'审批时间', N'审批时间:超级管理员批准的时间')
  ) AS v(t, c, d);
OPEN cur2; FETCH NEXT FROM cur2 INTO @t2, @c2, @d2;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(@t2, @c2) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(@t2) AND ep.minor_id = COLUMNPROPERTY(ep.major_id, @c2, 'ColumnId')
                 AND ep.name = 'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @d2, N'SCHEMA', N'dbo', N'TABLE', @t2, N'COLUMN', @c2;
    ELSE
      EXEC sp_addextendedproperty    N'MS_Description', @d2, N'SCHEMA', N'dbo', N'TABLE', @t2, N'COLUMN', @c2;
  END
  FETCH NEXT FROM cur2 INTO @t2, @c2, @d2;
END
CLOSE cur2; DEALLOCATE cur2;
GO

-- ═════════════ 4. 自检 ═════════════
DECLARE @f int = (SELECT COUNT(*) FROM yj_field
                  WHERE panel_code IN ('QC_BHG','QC_BHC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY')
                    AND col_name IN (N'审核人', N'审核时间', N'审批人', N'审批时间') AND editable = 0);
DECLARE @ap int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code IN ('QC_BHG','QC_BHC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY')
                     AND col_name IN (N'审批人', N'审批时间'));
DECLARE @prep int = (SELECT COUNT(*) FROM yj_field f
                     WHERE f.editable = 0 AND (
                       (f.panel_code = 'QC_BHG' AND f.col_name = N'填写人') OR
                       (f.panel_code IN ('QC_BHC','QC_BHZ','QC_SCP') AND f.col_name = N'责任人') OR
                       (f.panel_code = 'QC_JJF' AND f.col_name = N'检测人') OR
                       (f.panel_code IN ('QC_LYB','QC_SCY') AND f.col_name = N'编制人')));
DECLARE @tr int = (SELECT COUNT(*) FROM yj_translation
                   WHERE scope = 'field' AND ref_key IN (N'审批人', N'审批时间'));
IF @f <> 28 RAISERROR(N'7 张质量单据的 审核人/审核时间/审批人/审批时间 应全部只读(4×7=28),实测 %d', 16, 1, @f);
IF @ap <> 14 RAISERROR(N'7 张质量单据的 审批人/审批时间 字段未登记齐(应 14,实测 %d)', 16, 1, @ap);
IF @prep <> 7 RAISERROR(N'7 张质量单据的「编制」格应全部只读(应 7,实测 %d)', 16, 1, @prep);
IF @tr < 20 RAISERROR(N'审批人/审批时间 字段译名不足(应 ≥20 条,实测 %d)', 16, 1, @tr);
PRINT N'migrate-qc-docs-twolevel 完成:7 张质量单据两级审批元数据就绪('
      + CAST(@f AS varchar(4)) + N' 个只读审计格 / '
      + CAST(@ap AS varchar(4)) + N' 个新登记字段 / '
      + CAST(@prep AS varchar(4)) + N' 个只读编制格)';
GO
