/* migrate-route-head-detail.sql(2026-10-05):工艺路线面板 ROUTE 改「表头 + 工序明细」单据形态
 *
 * 用户口径:「将当前的工艺路线修改为表头加明细表的格式,但是当前使用的表仍然为当前的工艺路线的表,
 *   当前工艺路线为各个的一条单据,无法实现一个工艺路线编码对应多个工序的实现」。
 *
 * 现状(实测):面板 ROUTE「工艺路线」= **archive 档案式**(line_table=bs_route、head_table=NULL、code_col=NULL、
 *   17 个字段全在 detail 位)⇒ 界面是"整表一张网格、一行一条记录",无法把「一个工艺路线编码 = 一道工序」
 *   变成「一张单据 = 表头(路线) + 多行(工序)」。
 *
 * 处置:**不换底表**(仍是 bs_route),把面板改成 doc 单据形态并让**头行同表**:
 *   · mode='doc';head_table = line_table = N'bs_route';
 *   · code_col = group_col = N'工艺路线编码'(单据号=路线编码本身,不自动取号;pk_col=id);
 *   · 字段位重排:表头 = 工艺路线编码 / 工艺路线名称 / 停用 / 状态 / 备注(query,header / header);
 *               明细 = 加工顺序 / 工序编码 / 工序名称 / 加工方式 / 生产车间 / 工资类型 / 计件依据 /
 *                      委外供应商 / 按辅单位计价 / 辅单位 / 换算率 / 默认报工数量 / 关键工序 / 标准合格率%。
 *   · 「头行同表」在本项目已有先例(RD_SHARE_FILE:head_table=line_table=yj_share_file),引擎侧
 *     ButtonService 对 lineTable==headTable 有显式短路,支持该形态。
 *
 * 效果:一条 工艺路线编码 = 一张单据:表头填路线名/停用,明细逐行填工序(加工顺序 1..N),多工序一次保存。
 * 数据零变化(只改元数据位序);工序任务(ProcessTaskService 按 工艺路线编码+加工顺序 取数)不受影响。
 * 幂等可重跑;两账套均执行。
 */

/* ① 面板改 doc + **单表式**(head_table=NULL,头字段并入每行)+ 编码/分组列 = 工艺路线编码
 *    ⚠ 不用 head_table=line_table:那条路走"头行式"分支(引擎对 lineTable==headTable 有显式降级/短路),
 *      头字段不会并入行;单表式 doc 才是"一个编码 = 多行"的正解(先例:工序报工单 WO_REPORT ——
 *      mode=doc、head_table=NULL、line_table=scjl、code_col=报工单号,一次保存写多行且头字段并入每行)。 */
UPDATE yj_panel
   SET mode = N'doc',
       head_table = NULL,
       line_table = N'bs_route',
       group_col = N'工艺路线编码',
       pk_col = N'id',
       code_col = N'工艺路线编码',
       prefix = N'GY',
       detail_key = N'items'
 WHERE panel_code = N'ROUTE';
GO

/* ② 表头字段:路线自身信息 */
UPDATE yj_field SET place = N'query,header' WHERE panel_code = N'ROUTE' AND col_name = N'工艺路线编码';
UPDATE yj_field SET place = N'query,header' WHERE panel_code = N'ROUTE' AND col_name = N'工艺路线名称';
UPDATE yj_field SET place = N'header'       WHERE panel_code = N'ROUTE' AND col_name = N'停用';
/* ③ 明细字段:工序行(逐行一道工序) */
UPDATE yj_field SET place = N'detail' WHERE panel_code = N'ROUTE' AND col_name IN (
  N'加工顺序', N'工序编码', N'工序名称', N'加工方式', N'生产车间', N'工资类型', N'计件依据',
  N'委外供应商', N'按辅单位计价', N'辅单位', N'换算率', N'默认报工数量', N'关键工序', N'标准合格率%');
GO

/* ④ 补登记 状态/备注 为表头字段(bs_route 有这两列,原面板未登记) */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'状态')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'ROUTE', N'状态', N'状态', N'文本', N'query,header', 35, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'备注')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'ROUTE', N'备注', N'备注', N'文本', N'header', 190, 220, 1, 0, 0, 1);
GO

/* ⑤ 自检:面板必须是 doc + 单表式(line_table=bs_route、head_table 为空)+ 编码/分组列正确 */
DECLARE @bad int = 0;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'ROUTE' AND mode = N'doc'
               AND head_table IS NULL AND line_table = N'bs_route'
               AND code_col = N'工艺路线编码' AND group_col = N'工艺路线编码')
  SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'工艺路线编码' AND place LIKE N'%detail%')
  SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'ROUTE' AND place LIKE N'%detail%') < 14
  SET @bad = @bad + 1;
IF @bad > 0
  RAISERROR(N'工艺路线改「表头+明细」自检失败', 16, 1);
ELSE PRINT N'工艺路线面板就绪:ROUTE 已改为 doc(表头+工序明细,头行同表 bs_route,编码=工艺路线编码)';
GO
