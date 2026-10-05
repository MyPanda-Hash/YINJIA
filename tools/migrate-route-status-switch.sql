/* migrate-route-status-switch.sql(2026-10-05):回退「状态按钮化」,按用户修正口径落地
 *
 * 用户修正口径:说的"按钮"是**是否连续委外那种开关**;状态字段要保留,审核状态放到**明细**里。
 *   ① 状态 = 保留字段,控件形态 = 开关(data_type=是否,同 是否连续委外),值口径 Y=启用 / N=停用;
 *   ② 审核状态 = 保留并登记为**明细**(表格列)。
 *
 * 本脚本是 migrate-route-status-as-button.sql 的**前向回退**(该脚本把 状态 移出表单、删了 审核状态 字段与列);
 * 不用 git revert 的原因:tools/db-migrations.txt 里还有另一条任务未提交的登记改动,revert 会牵动它。
 * 幂等可重跑;两账套均执行。
 */

/* ① 状态:回表单位 + 改「是否」开关 */
UPDATE yj_field SET place = N'query,header', data_type = N'是否', required = 0, visible = 1, hidden = 0
 WHERE panel_code = N'ROUTE' AND col_name = N'状态';
UPDATE bs_route SET 状态 = CASE WHEN ISNULL(状态, N'') IN (N'', N'启用', N'Y', N'是', N'1') THEN N'Y' ELSE N'N' END;
GO

/* ② 审核状态:列加回来 + 登记为明细字段 */
IF COL_LENGTH('bs_route', N'审核状态') IS NULL ALTER TABLE bs_route ADD [审核状态] nvarchar(20) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.bs_route')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_route'), N'审核状态', 'ColumnId')
                 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'审核状态:未审核/已审核(金蝶工艺路线口径;引擎单据状态由状态机派生,本列为其业务快照)',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_route', N'COLUMN', N'审核状态';
GO
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'审核状态')
  UPDATE yj_field SET label = N'审核状态', place = N'query,detail', data_type = N'文本', seq = 360,
                      width = 100, editable = 1, required = 0, visible = 1, hidden = 0
   WHERE panel_code = N'ROUTE' AND col_name = N'审核状态';
ELSE
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'ROUTE', N'审核状态', N'审核状态', N'文本', N'query,detail', 360, 100, 1, 0, 0, 1);
GO

/* ③ 值回填(仅空值) */
UPDATE bs_route SET 审核状态 = N'已审核' WHERE ISNULL(审核状态, N'') = N'';
GO

/* ④ en 译名(多语言规范) */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'审核状态' AND locale = 'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核状态', 'en', N'Audit Status', 'manual');
GO

/* ⑤ 自检 */
DECLARE @bad int = 0;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'状态'
               AND data_type = N'是否' AND place LIKE N'%header%') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'审核状态'
               AND place LIKE N'%detail%') SET @bad = @bad + 1;
IF COL_LENGTH('bs_route', N'审核状态') IS NULL SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM bs_route WHERE ISNULL(状态, N'') NOT IN (N'Y', N'N')) SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'工艺路线状态开关化自检失败', 16, 1);
ELSE PRINT N'工艺路线就绪:状态=是否开关(同 是否连续委外);审核状态=明细列';
GO