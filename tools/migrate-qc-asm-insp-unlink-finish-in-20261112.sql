/* ============================================================================
 * migrate-qc-asm-insp-unlink-finish-in-20261112.sql
 *   出货检验表观(QC_ASM_INSP,原组装成品检验单)与「产成品入库单」**解除强关联**
 *
 * 【用户口径(2026-11-12)】
 *   「按1的实现作为检验单但是他还是和入库有关但是入库不和这个单据强关联了,把之前的实现安全去除掉。
 *     之后入库数量的进行得调换到其他单据才行」
 *   ⇒ ① 表观单当作**检验单**使用:纸面(图2 版式)上不再要求填「合格数量」这种入库口径的数字;
 *      ② 之前「审核自动生成产成品入库单草稿」的实现**安全去除**(存量已生成的入库单不动、不删);
 *      ③ 将来入库数量改由**其它单据**承接(另开任务,本脚本只做"解绑"所需的元数据)。
 *
 * 【本次只改元数据,零 DDL、零数据删除】
 *   · yj_field[QC_ASM_INSP / 合格数量] 的 required 1 → 0:
 *     纸面(图2 版式)没有这一格 ⇒ 必填会把「保存/提交审批」拦住
 *     (前端 validateInlineDraft 对表头必填字段校验、后端 AsmInspStockQty 在审核时也会抛
 *      「请先填写「合格数量」再审核」)。解绑后这一格不再参与校验,历史值原样保留。
 *   · 其余属性(visible/editable/hidden/place/data_type)一律不动:列表页仍能看到历史合格数量。
 *
 * 【代码侧同批改动(同一 commit)】
 *   ButtonService:删掉 runWoAuditHooks 里的 asmInspToStock(审核→生成产成品入库单草稿) 与
 *   弃审里的 asmInspUnauditCascade(弃审→作废该草稿/挡弃审),连同只被它们使用的
 *   gdIdOfReport/resolveWoRow/finishWarehouse 与 AsmInspStockQty 类一并删除。
 *   已生成的产成品入库单草稿/已审核单据**保持原样**(form_flow_link 里的历史 ACTIVE 记录也保留),不追溯作废。
 *
 * 幂等:两账套可重复执行。
 * ============================================================================ */

/* §1 合格数量:必填 → 非必填(只动 required,其它属性不动) */
IF EXISTS (
    SELECT 1 FROM dbo.yj_field
     WHERE panel_code = N'QC_ASM_INSP' AND label = N'合格数量' AND required = 1
)
BEGIN
    UPDATE dbo.yj_field
       SET required = 0
     WHERE panel_code = N'QC_ASM_INSP' AND label = N'合格数量';
    PRINT N'[OK] 合格数量 必填 → 非必填';
END
ELSE PRINT N'[SKIP] 合格数量 已是非必填(或字段不存在)';
GO

/* §2 自检:该字段仍在、属性未被误改、required 已为 0
   ⚠ bit 列不能直接 MAX(),用 SUM(CASE WHEN ...=1) 计数(2026-11-12 首跑踩到:
     「Operand data type bit is invalid for max operator」) */
DECLARE @cnt int, @req int, @vis int, @hid int, @edit int;
SELECT @cnt = COUNT(*),
       @req = SUM(CASE WHEN required = 1 THEN 1 ELSE 0 END),
       @vis = SUM(CASE WHEN visible = 1 THEN 1 ELSE 0 END),
       @hid = SUM(CASE WHEN hidden = 1 THEN 1 ELSE 0 END),
       @edit = SUM(CASE WHEN editable = 1 THEN 1 ELSE 0 END)
  FROM dbo.yj_field WHERE panel_code = N'QC_ASM_INSP' AND label = N'合格数量';
IF @cnt <> 1
BEGIN
    RAISERROR(N'[FAIL] QC_ASM_INSP.合格数量 字段行数不是 1(实际 %d)', 16, 1, @cnt);
END
IF ISNULL(@req, 9) <> 0
BEGIN
    RAISERROR(N'[FAIL] 合格数量 required 仍为 1(期望 0)', 16, 1);
END
IF ISNULL(@vis, 0) <> 1 OR ISNULL(@hid, 1) <> 0 OR ISNULL(@edit, 0) <> 1
BEGIN
    RAISERROR(N'[FAIL] 合格数量的 visible/hidden/editable 被意外改动(期望 1/0/1)', 16, 1);
END
PRINT N'[OK] 自检通过:合格数量仍在、可见可编、required=0';
GO

/* §3 列注明更新(供人查库时看懂这条规则何时解除) */
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.qc_asm_insp_head') AND name = N'合格数量')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.qc_asm_insp_head')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_head'), N'合格数量', 'ColumnId')
                  AND name = N'MS_Description')
    BEGIN
        EXEC sp_updateextendedproperty N'MS_Description',
            N'合格数量(历史入库口径:2026-10-17 起曾为审核生成产成品入库单的唯一数量来源、必填)。2026-11-12 按用户口径解除与产成品入库的强关联:本字段不再必填、审核不再据此生成入库单;值原样保留供历史追溯。将来入库数量改由其它单据承接。',
            N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_head', N'COLUMN', N'合格数量';
    END
    ELSE
    BEGIN
        EXEC sp_addextendedproperty N'MS_Description',
            N'合格数量(历史入库口径:2026-10-17 起曾为审核生成产成品入库单的唯一数量来源、必填)。2026-11-12 按用户口径解除与产成品入库的强关联:本字段不再必填、审核不再据此生成入库单;值原样保留供历史追溯。将来入库数量改由其它单据承接。',
            N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_head', N'COLUMN', N'合格数量';
    END
    PRINT N'[OK] 列注明已更新';
END
ELSE PRINT N'[SKIP] 无 qc_asm_insp_head.合格数量 列';
GO
