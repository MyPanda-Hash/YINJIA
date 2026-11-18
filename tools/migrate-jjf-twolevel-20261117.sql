/* ============================================================================
 * migrate-jjf-twolevel-20261117.sql —— YJ-QR-92 紧急放行申请单(QC_JJF)版面与审批口径落地
 * ----------------------------------------------------------------------------
 * 用户 2026-11-17 口径(截图 + 绿字批注):
 *   「紧急放行通知这个单据需要完成的内容二级审批,其他内容按照图中填写的进行修改即可」
 *   「不需要指定人只需要实现二级审批即可」
 *
 * 逐条落地(图的批注 → 本脚本/代码):
 *   ① 右上信息表「责任部门: 责任人所属部门」 ⇒ 补物理列 [责任部门] + 登记 yj_field(只读),
 *      由后端 ButtonService.putJjfOwner / prefillJjfOwner / syncJjfDeptToSubmitter 按
 *      建单人·提交人所属部门写入(yj_user.dept_id → yj_dept.dept_name)。只读 ⇒ editable=0。
 *   ② 「物料编码: 点击选择 → 不用点击选择,责任人手动录入」 ⇒ data_type 参照 → 文本,参照源全清。
 *   ③ 「责任人的日期无法填写,新增要求自动生成时间以及填写人员」 ⇒
 *      · 责任人 = 建单/提交人(纯落款,ButtonService.QC_DOC_PREPARER 由「检测人」改为「责任人」,
 *        并登记 PREPARER_CREATOR_PREFILL 在建单时预填),yj_field.editable=0 ⇒ 纸面只读;
 *      · 日期 = 单据日期(建单即当天),yj_field.editable=0 ⇒ 纸面只读(auto_generated)。
 *   ④ 「三、检测结果 → 这一行删除」 ⇒ 删 yj_field 登记(纸面不再渲染);
 *      **物理列 [检测结果] 保留**(历史值不丢,删列属破坏性操作,无必要)。
 *   ⑤ 底部落款「编制 = 责任人」 ⇒ yj_field 责任人保持只读,编制格绑列由代码改(见 ③)。
 *      审核 = 一级审批通过人(冯敏)、批准 = 二级超级管理员(冯总) —— 沿用既有两级审批引擎,
 *      QC_JJF 本就在 ADMIN_L2_PANELS 内(simply verify),本脚本不动。
 *
 * 幂等:重复执行 0 行变更;末尾自检不符即 RAISERROR。两账套都要执行(HSDZ_MES / HSDZ_MES_TEST)。
 * 规范:新增列写 MS_Description 中文注明(AGENTS.md 硬要求)。
 * ========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ── ① 补物理列 [责任部门](责任人所属部门) ───────────────────────────── */
IF COL_LENGTH('qc_jjf', '责任部门') IS NULL
BEGIN
    ALTER TABLE qc_jjf ADD [责任部门] nvarchar(100) NULL;
    PRINT '[jjf] qc_jjf.责任部门 added';
END
ELSE PRINT '[jjf] qc_jjf.责任部门 exists, skip';
GO

IF EXISTS (SELECT 1 FROM sys.extended_properties
           WHERE major_id = OBJECT_ID('qc_jjf')
             AND minor_id = COLUMNPROPERTY(OBJECT_ID('qc_jjf'), '责任部门', 'ColumnId')
             AND name = N'MS_Description')
    EXEC sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', N'qc_jjf', N'COLUMN', N'责任部门';
EXEC sp_addextendedproperty N'MS_Description',
     N'责任部门：= 责任人（建单人/提交审批的人）所属部门，由后端按 yj_user.dept_id → yj_dept.dept_name 自动写入，纸面只读（YJ-QR-92 紧急放行通知单右上信息表）。',
     N'SCHEMA', N'dbo', N'TABLE', N'qc_jjf', N'COLUMN', N'责任部门';
PRINT '[jjf] MS_Description set';
GO

/* ── ② 物料编码:参照 INV → 纯文本手输 ────────────────────────────────── */
UPDATE yj_field
   SET data_type     = N'文本',
       ref_panel     = NULL,
       ref_field     = NULL,
       display_field = NULL
 WHERE panel_code = N'QC_JJF'
   AND label      = N'物料编码'
   AND (data_type <> N'文本' OR ref_panel IS NOT NULL OR ref_field IS NOT NULL);
PRINT N'[jjf] 物料编码 → 文本,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ── ③ 责任人 / 单据日期 置只读(自动生成,纸面不给手填) ────────────────── */
UPDATE yj_field SET editable = 0
 WHERE panel_code = N'QC_JJF' AND label = N'责任人' AND editable = 1;
PRINT N'[jjf] 责任人 → 只读,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
UPDATE yj_field SET editable = 0
 WHERE panel_code = N'QC_JJF' AND label = N'单据日期' AND editable = 1;
PRINT N'[jjf] 单据日期 → 只读,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ── ④ 登记「责任部门」字段(只读,右上信息表用;不进列表查询区) ────────── */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_JJF' AND label = N'责任部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width,
                          editable, required, hidden, visible)
    VALUES (N'QC_JJF', N'责任部门', N'责任部门', N'文本', N'header', 181, 120, 0, 0, 0, 1);
ELSE
    UPDATE yj_field SET col_name = N'责任部门', data_type = N'文本', place = N'header',
                        editable = 0, required = 0, hidden = 0, visible = 1
     WHERE panel_code = N'QC_JJF' AND label = N'责任部门';
PRINT '[jjf] 责任部门 field registered';
GO

/* ── ⑤ 「三、检测结果」整行下线:删 yj_field 登记(物理列保留) ─────────── */
DELETE FROM yj_field WHERE panel_code = N'QC_JJF' AND label = N'检测结果';
PRINT N'[jjf] 检测结果 field 注销,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ── ⑥「检测人」不再充当编制格(编制改绑[责任人]) ───────────────────────
   纸面已不印「检测人」格;登记行置 hidden 只是把列表/表头里的死角关掉,
   **物理列与历史值保留**(老单的检测人事实不丢)。 */
UPDATE yj_field SET hidden = 1
 WHERE panel_code = N'QC_JJF' AND label = N'检测人' AND hidden = 0;
PRINT N'[jjf] 检测人 → hidden,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ── 自检 ────────────────────────────────────────────────────────────── */
IF COL_LENGTH('qc_jjf', '责任部门') IS NULL
    RAISERROR(N'qc_jjf.责任部门 未补上', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_JJF' AND label = N'物料编码'
                AND data_type = N'文本' AND ref_panel IS NULL)
    RAISERROR(N'物料编码 未改成「文本手输」(参照源应全清)', 16, 1);
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_JJF' AND label = N'检测结果')
    RAISERROR(N'检测结果 字段登记未删除', 16, 1);
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_JJF' AND label IN (N'责任人', N'单据日期') AND editable = 1)
    RAISERROR(N'责任人/单据日期 仍可编辑(应自动生成、纸面只读)', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_JJF' AND label = N'责任部门' AND editable = 0)
    RAISERROR(N'责任部门 字段未登记或仍可编辑', 16, 1);
/* 两级审批登记核验:QC_JJF 的「编制」格列由代码维护,这里只确认审批签署列存在 */
IF COL_LENGTH('qc_jjf', '审核人') IS NULL OR COL_LENGTH('qc_jjf', '审批人') IS NULL
    RAISERROR(N'qc_jjf 缺 审核人/审批人 列,两级审批无法落款', 16, 1);
PRINT N'[jjf] 自检通过';
GO
