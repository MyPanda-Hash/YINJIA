/* migrate-route-fields-ref.sql(2026-10-05):工艺路线明细行的工序字段改为**只能从工序档案选**
 *
 * 用户口径:「当前工艺路线的明细行要求只能选择工序内的数据才可以」。
 *
 * 根因:ROUTE 明细行的 ref_panel/ref_field 本来就指向工序档案(面板 **OP**,底表 bs_op),
 *   但 migrate-route-kingdee-fields.sql 把 data_type 一律写成「文本」⇒ 参照退化成手填。
 *   同项目的对照写法:DISPATCH.工序编码 = data_type「参照」+ ref_panel=OP + ref_field=工序编码 + display_field=工序名称;
 *   REJECT.适用工序 / OP_TIME.gxdm 同款。
 *
 * 处置(只改元数据,不动数据):
 *   · 工序编码 → 参照 OP.工序编码(显示 工序名称):下拉/弹窗只列工序档案里的工序,不能手填;
 *   · 工序名称 → 参照 OP.工序名称(同样只能选档案值);
 *   · 工序控制 → 下拉框(自制/委外),与截图控件形态一致,不再自由文本;
 *   · 班组     → 参照 OP.默认车间(本厂"班组"就是工序的默认车间:成型/切炭/组装)——仅当 OP 面板登记了该字段;
 *   · 操作工   → 参照 EMP.员工名称——仅当 EMP 面板存在(否则保持文本)。
 * 幂等可重跑;两账套均执行。
 */

/* ① 工序编码/名称:只能选工序档案(OP) */
UPDATE yj_field SET data_type = N'参照', ref_panel = N'OP', ref_field = N'工序编码', display_field = N'工序名称',
                    editable = 1, required = 1
 WHERE panel_code = N'ROUTE' AND col_name = N'工序编码';
UPDATE yj_field SET data_type = N'参照', ref_panel = N'OP', ref_field = N'工序名称', display_field = N'工序名称',
                    editable = 1
 WHERE panel_code = N'ROUTE' AND col_name = N'工序名称';
GO

/* ② 工序控制 = 下拉框(自制/委外),不再自由文本 */
UPDATE yj_field SET data_type = N'下拉框',
                    dict_sql = N'SELECT v FROM (VALUES (N''自制''),(N''委外'')) AS t(v)'
 WHERE panel_code = N'ROUTE' AND col_name = N'加工方式';
GO

/* ③ 班组:参照工序档案的「默认车间」(成型/切炭/组装)——OP 面板登记了该字段才改 */
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'OP' AND label = N'默认车间')
  UPDATE yj_field SET data_type = N'参照', ref_panel = N'OP', ref_field = N'默认车间', display_field = N'默认车间'
   WHERE panel_code = N'ROUTE' AND col_name = N'班组';
GO

/* ④ 操作工:参照员工档案(EMP),有该面板才改 */
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'EMP')
  UPDATE yj_field SET data_type = N'参照', ref_panel = N'EMP', ref_field = N'员工名称', display_field = N'员工名称'
   WHERE panel_code = N'ROUTE' AND col_name = N'操作工';
GO

/* ⑥ 多语言(migrate-route-kingdee-fields.sql 新增字段的 en 词条;scope='field',按标签共享) */
DECLARE @tr TABLE (k nvarchar(100), en nvarchar(200));
INSERT INTO @tr VALUES
 (N'审核状态',       N'Audit Status'),
 (N'工艺路线分组',   N'Routing Group'),
 (N'生效日期',       N'Effective Date'),
 (N'失效日期',       N'Expiry Date'),
 (N'工艺类型',       N'Routing Type'),
 (N'备注2',          N'Remark 2'),
 (N'备注3',          N'Remark 3'),
 (N'生产单据类型',   N'Production Doc Type'),
 (N'是否连续委外',   N'Continuous Outsourcing'),
 (N'工序图片',       N'Process Image'),
 (N'工序说明',       N'Process Description'),
 (N'工序组',         N'Process Group'),
 (N'班组',           N'Team'),
 (N'操作工',         N'Operator'),
 (N'工序单位',       N'Process UOM'),
 (N'是否末道工序',   N'Last Process'),
 (N'允许超额',       N'Allow Overproduction'),
 (N'是否质检',       N'Need QC'),
 (N'是否首检',       N'First Article Inspection'),
 (N'工序控制',       N'Process Control'),
 (N'计划数量换算率', N'Plan Qty Conversion'),
 (N'工序序列',       N'Process Sequence');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', t.k, 'en', t.en, 'manual' FROM @tr t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope = 'field' AND x.ref_key = t.k AND x.locale = 'en');
GO

/* ⑤ 自检:工序编码必须是「参照 + OP」;且不得再有把工序当自由文本的登记 */
DECLARE @bad int = 0;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'工序编码'
               AND data_type = N'参照' AND ref_panel = N'OP' AND ref_field = N'工序编码')
  SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'工序名称'
               AND data_type = N'参照' AND ref_panel = N'OP')
  SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'加工方式' AND data_type = N'下拉框')
  SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'工艺路线工序字段改参照自检失败', 16, 1);
ELSE PRINT N'工艺路线明细就绪:工序编码/工序名称只能从工序档案(OP)选;工序控制为下拉(自制/委外)';
GO
