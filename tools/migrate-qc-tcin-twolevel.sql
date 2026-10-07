-- migrate-qc-tcin-twolevel.sql — 特采单(QC_TC_IN)改两级审批:编制 / 审核 / 批准 三格自动落值
--
-- 用户口径(2026-10-04):
--   ① 编制 = **提交审批的人**;
--   ② 「审核」= 一级审批通过的人 —— 谁能做一级:组织架构里给该角色勾了「特采单·审核反审核」
--      (yj_role_panel.perms 含 audit ⇒ can_approve='Y')的账号 ∪ 管理员;
--   ③ 「批准」= **超级管理员**(yj_user.is_admin='Y'),一级通过后由他批准才真正通过
--      (采购入库单在**批准通过**那一刻才生成,一级通过时不生成);
--   ④ 三格**全自动、不可手改**(纸面 YJ-QR-60 底部就是「编制 / 审核 / 批准」);
--   ⑤ 与研发管理·产品信息表(RD_PROD_INFO)同样的两级机制:一级通过 → 「待二级审批」→ 二级通过;
--      任一级驳回一律回草稿并通知提交人(二级驳回另通知一级审核人);两级**必须各点一次**。
--
-- 本脚本只改**元数据**(表列早已存在,见 tools/migrate-qc-tc-in.sql 的 qc_tc_in):
--   §1 yj_field 补登记「审批人」「审批时间」(此前只在建表里,没有字段登记 ⇒ 前端拿不到值,
--      纸面「批准」格永远空白);
--   §2 编制人/审核人/审批人 三格置 editable=0(只读)—— 前端 DocSheet 按字段元数据渲染成纯文本,
--      后端 save() 对特采单同时剥离这三个键的入参(真源只有审批流动作一个);
--   §3 关键列中文注明(MS_Description,缺则补);
--   §4 译名补齐(审批人/审批时间 缺 zh-TW;编制人 只有 en)。
--
-- 幂等(IF NOT EXISTS / 无条件 UPDATE 到目标值),两账套均须执行。

SET NOCOUNT ON;
GO

-- ═════════════ 1. yj_field:审批人 / 审批时间 登记 ═════════════
-- 纸面底部落款第三格「批准」绑的就是 审批人(qcSheetCfgs.QC_TC_IN → qcSignStd('编制人')
-- 的第三项 { label:'批准', key:'审批人' });没登记字段 ⇒ 单据查询选不出该列 ⇒ 永远空白。
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_TC_IN' AND col_name = N'审批人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, visible)
VALUES ('QC_TC_IN', N'审批人', N'审批人', N'文本', NULL, NULL, NULL, NULL, N'header', 212, 90, 0, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_TC_IN' AND col_name = N'审批时间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, visible)
VALUES ('QC_TC_IN', N'审批时间', N'审批时间', N'文本', NULL, NULL, NULL, NULL, N'header', 213, 130, 0, 0, 0, 1);
GO

-- ═════════════ 2. 三格只读(全自动落值,不接受手改) ═════════════
UPDATE yj_field SET editable = 0, required = 0
WHERE panel_code = 'QC_TC_IN' AND col_name IN (N'编制人', N'审核人', N'审批人');
GO

-- ═════════════ 3. 关键列中文注明(表已存在,列已有;缺则补,已注则更新) ═════════════
DECLARE @t sysname = N'qc_tc_in';
DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols VALUES
  (N'编制人',   N'编制人:纸面底部落款①=提交审批的人(特采单两级审批,提交时后端自动写,只读不可手改)'),
  (N'审核人',   N'审核人:纸面底部落款②=一级审批通过的人(组织架构勾了「特采单·审核反审核」的账号∪管理员;驳回/弃审时清空)'),
  (N'审核时间', N'审核时间:一级审批通过的时间(与审批人同进同退,驳回/弃审清空)'),
  (N'审批人',   N'审批人:纸面底部落款③「批准」=超级管理员(yj_user.is_admin=Y;二级审批通过时才落值,驳回/弃审清空)'),
  (N'审批时间', N'审批时间:超级管理员批准的时间(二级审批通过时刻;驳回/弃审清空)');

DECLARE @c sysname, @d nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @c, @d;
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
  FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

-- ═════════════ 4. 译名补齐(新字段标签 + 落款标签) ═════════════
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT v.scope, v.ref_key, v.locale, v.text, 'manual'
FROM (VALUES
  -- 新登记字段:审批人 / 审批时间(此前已有 9 语言,差 zh-TW)
  ('field', N'审批人', 'zh-TW', N'審批人'),
  ('field', N'审批时间', 'zh-TW', N'審批時間'),
  -- 编制人(此前只有 en;三格自动落值后是纸面固定落款,10 语言补齐)
  ('field', N'编制人', 'ja', N'作成者'),
  ('field', N'编制人', 'ko', N'작성자'),
  ('field', N'编制人', 'es', N'Elaborado por'),
  ('field', N'编制人', 'fr', N'Établi par'),
  ('field', N'编制人', 'de', N'Erstellt von'),
  ('field', N'编制人', 'ru', N'Составил'),
  ('field', N'编制人', 'vi', N'Người lập'),
  ('field', N'编制人', 'th', N'ผู้จัดทำ'),
  ('field', N'编制人', 'zh-TW', N'編製人')
) AS v(scope, ref_key, locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope = v.scope AND t.ref_key = v.ref_key AND t.locale = v.locale);
GO

-- ═════════════ 自检 ═════════════
DECLARE @f int = (SELECT COUNT(*) FROM yj_field
                  WHERE panel_code = 'QC_TC_IN' AND col_name IN (N'编制人', N'审核人', N'审批人', N'审批时间')
                    AND editable = 0);
DECLARE @ap int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'QC_TC_IN' AND col_name IN (N'审批人', N'审批时间'));
DECLARE @tr int = (SELECT COUNT(*) FROM yj_translation
                   WHERE scope = 'field' AND ref_key IN (N'审批人', N'审批时间', N'编制人'));
IF @f <> 4 RAISERROR(N'QC_TC_IN 编制/审核/审批(人/时间)应全部只读(editable=0),实测只读 %d 个', 16, 1, @f);
IF @ap <> 2 RAISERROR(N'QC_TC_IN 审批人/审批时间字段未登记齐(应 2,实测 %d)', 16, 1, @ap);
IF @tr < 29 RAISERROR(N'审批人/审批时间/编制人 字段译名不足(应 ≥29 条,实测 %d)', 16, 1, @tr);
PRINT N'migrate-qc-tcin-twolevel 完成:特采单两级审批元数据就绪('
      + CAST(@f AS varchar(4)) + N' 个只读签名格 / '
      + CAST(@ap AS varchar(4)) + N' 个新登记字段 / '
      + CAST(@tr AS varchar(4)) + N' 条字段译名)';
GO
