/* migrate-insp-plan-prodno-ref-20261013.sql —— 给出货检验计划表的「产品编号」查询行补参照源
 *
 * 起因(用户 2026-10-13 报障):「出货检验计划表现在是通过产品功能类别来进行数据自动填写,
 *   应该是改为通过产品编号,和其他的面板一样」—— 实测截图里 产品功能类别 有「点击选择」,
 *   而 产品编号 只是普通输入框,于是"选产品编号→自动带出规格书检验项目"这条链触发不了。
 *
 * 根因(逐层取证,不是猜):
 *   ① yj_field 里 RD_INSP_PLAN.产品编号(place=header) **确实**配了
 *      ref_panel=RD_PROD_INFO / ref_field=产品编号,和 RD_SPEC_DOC/RD_MOLD_PROC/RD_ASM_PROC 一字不差;
 *   ② 但前端 RecordSheetPanels.isRefKey(key) = !!(fieldMap.get(key) && f.refPanel),
 *      而 fieldMap = new Map(props.fields.map(f => [f.dataName || f.code, f])) —— **同名字段后者覆盖前者**;
 *   ③ 接口实测 /px/getPanelConfig?panelCode=RD_INSP_PLAN 的 dataSchema.fields 里「产品编号」有**两条**:
 *        dataSchema.fields[6] → refPanel="RD_PROD_INFO" refField="产品编号"(这条是 header 的,带参照)
 *        另一条(place=query 那条)**ref_panel 为空** ⇒ 在 Map 里**把带参照的那条覆盖成无参照**
 *      ⇒ isRefKey('产品编号') = false ⇒ 渲染成普通输入框 ⇒ 参照链断在起点。
 *   ④ 对照:RD_SPEC_DOC / RD_MOLD_PROC / RD_ASM_PROC 的 query 行**同样配了** ref_panel=RD_PROD_INFO,
 *      所以它们不受影响 —— 这正是用户说的"和其他的面板一样"的确切落点。
 *
 * 处置:把 RD_INSP_PLAN.产品编号 的 **query 行**补齐成与其它三张面板同款
 *   (ref_panel=RD_PROD_INFO / ref_field=产品编号)。**只补参照源,不动 required/visible/seq**;
 *   header 行本就正确,不动。
 *
 * 幂等:重复执行 = 0 行。两账套都跑(先 HSDZ_MES,后 HSDZ_MES_TEST)。
 * 参照源口径见 AGENTS.md「采购链四单…§5」:ref_field 取**目标面板的字段名(label)**,不是物理列名。
 */
SET NOCOUNT ON;

/* ① 改前报数(只应命中 1 行:place=query 那条) */
SELECT N'[改前] 待补行数(应=1)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值
  FROM yj_field
 WHERE panel_code = N'RD_INSP_PLAN' AND label = N'产品编号' AND place = N'query'
   AND (ref_panel IS NULL OR ref_panel = N'');

/* ② 执行 */
UPDATE yj_field SET ref_panel = N'RD_PROD_INFO', ref_field = N'产品编号'
 WHERE panel_code = N'RD_INSP_PLAN' AND label = N'产品编号' AND place = N'query'
   AND (ref_panel IS NULL OR ref_panel = N'');
PRINT N'[调整] 补参照源行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ③ 自证:与其它三张下游面板逐条对齐 */
SELECT N'[自证] RD_INSP_PLAN.产品编号 未配参照的行数(应=0)' AS 项,
       CAST(COUNT(*) AS nvarchar(10)) AS 值
  FROM yj_field WHERE panel_code = N'RD_INSP_PLAN' AND label = N'产品编号'
   AND (ref_panel IS NULL OR ref_panel = N'')
UNION ALL SELECT N'[自证] 四张面板.产品编号 的参照配置(应四行同款)',
       CAST(COUNT(*) AS nvarchar(10)) FROM yj_field
        WHERE panel_code IN (N'RD_INSP_PLAN',N'RD_SPEC_DOC',N'RD_MOLD_PROC',N'RD_ASM_PROC')
          AND label = N'产品编号' AND ref_panel = N'RD_PROD_INFO' AND ref_field = N'产品编号';

PRINT N'=== 四张面板 产品编号 的参照配置对照 ===';
SELECT panel_code, place, ISNULL(ref_panel,N'(空)') AS ref_panel, ISNULL(ref_field,N'(空)') AS ref_field
  FROM yj_field
 WHERE panel_code IN (N'RD_INSP_PLAN',N'RD_SPEC_DOC',N'RD_MOLD_PROC',N'RD_ASM_PROC') AND label = N'产品编号'
 ORDER BY panel_code, place;
