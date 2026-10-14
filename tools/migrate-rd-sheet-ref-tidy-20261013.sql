/* migrate-rd-sheet-ref-tidy-20261013.sql —— 参照源收尾两处(用户 2026-10-13 裁定)
 *
 * 【本脚本做两件事,都是 yj_field 元数据调整,零 DDL】
 *
 * ① 去掉 RD_INSP_PLAN(出货检验计划表)「产品功能类别」的参照
 *    用户口径:「产品功能类别还是有选择的按钮,重复了,只需要产品编号把这个的数据也带进来就行了,
 *    就不需要这个按钮的点击选择了,把这个改为普通的文本格式,保留产品编号的点击选择」。
 *    背景:该格设计上就是标了「自动填充规格书」的格(references recordSheetConfigs.js 的
 *    autoFillSpec.head: { to:'产品功能类别', from:'产品类别' }),它的值应当由**选完产品编号后
 *    从规格书带进来**,而不是让用户自己去选 —— 它和产品编号同时挂参照控件属于重复入口,
 *    而且用户从它那条路选并不会触发 autoFillSpec(fromKey 是产品编号)。
 *    处置:ref_panel / ref_field 置 NULL ⇒ 退化成普通文本框(仍可编辑/仍能被回填)。
 *
 * ② 补 RD_MOLD_PROC(成型工艺清单)「产品编号」查询行的参照源
 *    与上一条同类:同一批面板里 RD_SPEC_DOC 的 query 行配了参照、RD_MOLD_PROC 的没配,
 *    口径不一致(前端 isRefKey 只认 fieldMap 里的 refPanel,同名两条会互相覆盖,详见
 *    migrate-insp-plan-prodno-ref-20261013.sql 的取证链)。用户要求「把还没做的也一起做了」。
 *    处置:补成与其余三张面板同款 ref_panel=RD_PROD_INFO / ref_field=产品编号。
 *    ⚠ RD_ASM_PROC(组装工艺清单)没有 query 行,无需处理(实测确认)。
 *
 * 幂等:重复执行 = 0 行。两账套都跑(先 HSDZ_MES,后 HSDZ_MES_TEST)。
 * 参照源口径见 AGENTS.md「采购链四单…§5」:ref_field 取**目标面板的字段名(label)**。
 */
SET NOCOUNT ON;

/* ① 改前报数 */
SELECT N'[①前] RD_INSP_PLAN.产品功能类别 带参照的行(应=1)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值
  FROM yj_field WHERE panel_code = N'RD_INSP_PLAN' AND label = N'产品功能类别' AND ref_panel IS NOT NULL
UNION ALL SELECT N'[②前] RD_MOLD_PROC.产品编号 query 行缺参照数(应=1)',
       CAST(COUNT(*) AS nvarchar(10)) FROM yj_field
        WHERE panel_code = N'RD_MOLD_PROC' AND label = N'产品编号' AND place = N'query'
          AND (ref_panel IS NULL OR ref_panel = N'');

/* ② 执行 */
UPDATE yj_field SET ref_panel = NULL, ref_field = NULL
 WHERE panel_code = N'RD_INSP_PLAN' AND label = N'产品功能类别' AND ref_panel IS NOT NULL;
PRINT N'[①] 去掉产品功能类别参照的行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

UPDATE yj_field SET ref_panel = N'RD_PROD_INFO', ref_field = N'产品编号'
 WHERE panel_code = N'RD_MOLD_PROC' AND label = N'产品编号' AND place = N'query'
   AND (ref_panel IS NULL OR ref_panel = N'');
PRINT N'[②] 补成型工艺清单 query 参照的行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ③ 自证 */
SELECT N'[①后] 产品功能类别 仍带参照的行(应=0)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值
  FROM yj_field WHERE panel_code = N'RD_INSP_PLAN' AND label = N'产品功能类别' AND ref_panel IS NOT NULL
UNION ALL SELECT N'[①后] 产品编号 仍带参照的行(应=1,保留点击选择)',
       CAST(COUNT(*) AS nvarchar(10)) FROM yj_field
        WHERE panel_code = N'RD_INSP_PLAN' AND label = N'产品编号' AND ref_panel = N'RD_PROD_INFO'
UNION ALL SELECT N'[②后] 四张面板 产品编号 带参照的行数',
       CAST(COUNT(*) AS nvarchar(10)) FROM yj_field
        WHERE panel_code IN (N'RD_INSP_PLAN',N'RD_SPEC_DOC',N'RD_MOLD_PROC',N'RD_ASM_PROC')
          AND label = N'产品编号' AND ref_panel = N'RD_PROD_INFO';

PRINT N'=== 出货检验计划表 表头参照现状 ===';
SELECT seq, label, ISNULL(ref_panel,N'(无)') AS ref_panel
  FROM yj_field WHERE panel_code = N'RD_INSP_PLAN' AND place = N'header' ORDER BY seq;
