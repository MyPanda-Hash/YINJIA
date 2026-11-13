/*
 * migrate-prodinfo-approver-cells-20261111.sql
 *
 * 目的：产品信息表（RD_PROD_INFO）「五、文件与签署」三格改为**只读**，并把一级审核人默认值定成陈秀丽。
 *
 * 用户口径（2026-11-11）：
 *   「产品信息表的一级审核人名字改为：陈秀丽，这个是固定的
 *    二级审核人是分配的产品责任人（规格书的责任人）是谁就回填显示谁的名字
 *     这三个都是只读的，但是都要有对应的数据回填进去，二级签核就是对应的规格书的责任人
 *     也就是产品负责人来签核」
 *   追问后确认：
 *     ① 一级审核人 = 纸面只读恒显示陈秀丽，**一级审批权限不变**（仍按角色「审批」权判定）；
 *     ② 二级审核人 = **一级审批选了二级签核人之后才回填**，选之前为空；后续改人也跟着改；
 *     ③ 产品负责人同上（选中谁回填谁）。
 *
 * 三格的 数据键 → 物理列（实测 yj_field）：
 *     审核人（一级审批人） → 审核人一级
 *     审核人（二级审批人） → 审核人二级     ← ButtonService.writeBackL2Approver 写的就是这一列
 *     产品负责人           → 责任人         ← 分发责任人/RD_DEV_TASK 的"总负责人"都读这一格
 *
 * ⚠ 为什么必须改 yj_field.editable 而不只是改前端配置:
 *   editable=1 时后端保存链会**接收**前端传来的这三位（labelsToCols 照收），
 *   只把纸面置灰（ro:true）挡不住"绕过界面直接调保存"的改法。两处一起改才是真只读。
 *   ⚠ 但**回填链路不能断**:writeBackL2Approver / 分发责任人 都是**服务端直接 UPDATE**，
 *     不走前端保存校验 ⇒ editable=0 不影响它们（实测：它们各自 raw SQL 写列）。
 *
 * 幂等：UPDATE 带 WHERE，重复执行无副作用。
 * 执行：两个账套都要跑（HSDZ_MES / HSDZ_MES_TEST）。
 */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ── ① 三格置只读（editable=0），hidden 保持 0（要看得见）─────────── */
UPDATE yj_field
SET editable = 0,
    hidden = 0,
    visible = 1
WHERE panel_code = N'RD_PROD_INFO'
  AND label IN (N'审核人（一级审批人）', N'审核人（二级审批人）', N'产品负责人');
PRINT '[prodinfo-sign] editable=0 rows = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ── ② 一级审核人的默认值改成陈秀丽 ────────────────────────────────
   默认值本身在前端 panel/docDefaults.js（新建时带出），这里只把**已存在但为空**的行补上，
   避免历史单据纸面上是一格空白。⚠ 不覆盖已有非空值（冯总等历史署名保留，不篡改既成事实）。 */
UPDATE rd_prod_info_head
SET 审核人一级 = N'陈秀丽'
WHERE (审核人一级 IS NULL OR LTRIM(RTRIM(审核人一级)) = N'')
  AND ISNULL(asp_cancel, 'N') <> 'Y';
PRINT '[prodinfo-sign] 审核人一级 backfilled = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ── ②b 后端那份默认值也要改（yj_panel.config.headDefaults）────────────
   实测发现的**第二个默认值来源**（只改前端 docDefaults.js 不够）：
     yj_panel.config = {"headDefaults":{"审核人（一级审批人）":"冯总","审核人（二级审批人）":"陈秀丽"}}
   这份 JSON 由后端 buildMeta 下发，PanelxList 在**草稿态**用 applyDocDefaults 补齐空格的值
   ⇒ 库里 审核人二级 是 NULL 时，界面上照样显示「陈秀丽」，与「选二级签核人之前都是空的」相悖。
   处置：
     · 一级 → 陈秀丽（与 docDefaults.js / 迁移 ② 保持一致）；
     · 二级 → **删除该键**（JSON_MODIFY 置 NULL 即在 lax 模式下删属性）⇒ 选择前保持空。
   ⚠ 用 JSON_MODIFY 而不是整段覆盖 config：config 里还有别的东西（将来加键也不该被这个迁移冲掉）。 */
UPDATE yj_panel
SET config = JSON_MODIFY(config, '$.headDefaults."审核人（一级审批人）"', N'陈秀丽')
WHERE panel_code = N'RD_PROD_INFO'
  AND config IS NOT NULL
  AND JSON_QUERY(config, '$.headDefaults') IS NOT NULL;
PRINT '[prodinfo-sign] headDefaults 一级 -> 陈秀丽';

UPDATE yj_panel
SET config = JSON_MODIFY(config, '$.headDefaults."审核人（二级审批人）"', NULL)
WHERE panel_code = N'RD_PROD_INFO'
  AND config IS NOT NULL
  AND JSON_QUERY(config, '$.headDefaults') IS NOT NULL;
PRINT '[prodinfo-sign] headDefaults 二级键已移除（改为一级选人后回填）';

/* ── ③ 自检 ─────────────────────────────────────────────────────── */
DECLARE @stillEditable INT = (
    SELECT COUNT(*) FROM yj_field
    WHERE panel_code = N'RD_PROD_INFO'
      AND label IN (N'审核人（一级审批人）', N'审核人（二级审批人）', N'产品负责人')
      AND ISNULL(editable, 1) <> 0
);
IF @stillEditable > 0
BEGIN
    RAISERROR(N'[prodinfo-sign] 自检失败：仍有 %d 格是 editable≠0（用户要求三格只读）', 16, 1, @stillEditable);
    RETURN;
END
DECLARE @missing INT = (
    SELECT COUNT(*) FROM (VALUES (N'审核人（一级审批人）'), (N'审核人（二级审批人）'), (N'产品负责人')) AS v(l)
    WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_PROD_INFO' AND label = v.l)
);
IF @missing > 0
BEGIN
    RAISERROR(N'[prodinfo-sign] 自检失败：有 %d 格在 yj_field 里不存在（本迁移不建字段，需先有面板定义）', 16, 1, @missing);
    RETURN;
END
DECLARE @hdLeak INT = (
    SELECT COUNT(*) FROM yj_panel
    WHERE panel_code = N'RD_PROD_INFO'
      AND config IS NOT NULL
      AND JSON_QUERY(config, '$.headDefaults') IS NOT NULL
      AND JSON_VALUE(config, '$.headDefaults."审核人（二级审批人）"') IS NOT NULL
);
IF @hdLeak > 0
BEGIN
    RAISERROR(N'[prodinfo-sign] 自检失败：headDefaults 里仍有 审核人（二级审批人）（界面会把空格填成该值，与"选择前为空"冲突）', 16, 1);
    RETURN;
END
PRINT '[prodinfo-sign] 自检通过：三格均已只读、一级空值已补陈秀丽、headDefaults 二级键已清。';
