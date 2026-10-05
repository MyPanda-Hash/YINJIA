/* migrate-route-kingdee-fields.sql(2026-10-05):工艺路线按金蝶「工艺路线」单据字段补齐
 *
 * 依据(用户提供的金蝶AI星辰「工艺路线」截图,要求「根据当前图片字段实现即可」):
 *   表头(基本信息):编码 / 名称 / 审核状态 / 工艺路线分组 / 生效日期 / 失效日期 / 工艺类型 /
 *                   备注1 / 备注2 / 备注3 / 生产单据类型 / 是否连续委外
 *   明细(明细信息):工序图片 / 工序编码 / 工序名称 / 工序说明 / 工序控制 / 工序组 / 班组 / 操作工 /
 *                   工序单位 / 计划数量换算率 / 工序序列 / 是否末道工序 / 允许超额 / 是否质检 / 是否首检
 *
 * 底表不变(仍 bs_route,头行同表的单表式 doc;见 migrate-route-head-detail.sql)。对齐口径:
 *   · 能对上的沿用现有列,只改**标签**(物理列不动,零数据搬迁):
 *       加工方式 → 工序控制   (值 自制/委外,与截图一致)
 *       加工顺序 → 工序序列   (ProcessTaskService 按它取工序顺序,读的是物理列,不受标签影响)
 *       换算率   → 计划数量换算率
 *       备注     → 备注1
 *       工艺路线编码 / 工艺路线名称 沿用(截图里的 编码 / 名称)
 *   · 截图有、表里没有的**补列**(19 列);截图没有的旧字段**隐藏显示**(visible=0,数据保留可随时恢复):
 *       停用 / 工资类型 / 计件依据 / 委外供应商 / 按辅单位计价 / 辅单位 / 默认报工数量 / 关键工序 / 标准合格率%
 *   · 生产车间 保留可见并显示在明细末尾(它不是截图列,但工序任务/派工靠它定"工序/工艺"功能)。
 *
 * 幂等可重跑;两账套均执行。
 */

/* ============ A. 补列 ============ */
DECLARE @adds TABLE (col sysname, typ nvarchar(50), cmt nvarchar(300));
INSERT INTO @adds VALUES
 (N'审核状态',     N'nvarchar(20)',  N'审核状态(金蝶工艺路线:未审核/已审核;与本系统单据状态并存)'),
 (N'工艺路线分组', N'nvarchar(50)',  N'工艺路线分组(金蝶「工艺路线分组」)'),
 (N'生效日期',     N'date',          N'生效日期(金蝶「生效日期」)'),
 (N'失效日期',     N'date',          N'失效日期(金蝶「失效日期」)'),
 (N'工艺类型',     N'nvarchar(50)',  N'工艺类型(金蝶「工艺类型」,如 通用工序集)'),
 (N'备注2',        N'nvarchar(200)', N'备注2(金蝶「备注2」)'),
 (N'备注3',        N'nvarchar(200)', N'备注3(金蝶「备注3」)'),
 (N'生产单据类型', N'nvarchar(50)',  N'生产单据类型(金蝶「生产单据类型」)'),
 (N'是否连续委外', N'nvarchar(1)',   N'是否连续委外 Y/N(金蝶「是否连续委外」)'),
 (N'工序图片',     N'nvarchar(300)', N'工序图片(金蝶明细「工序图片」;存文件路径/URL)'),
 (N'工序说明',     N'nvarchar(500)', N'工序说明(金蝶明细「工序说明」)'),
 (N'工序组',       N'nvarchar(50)',  N'工序组(金蝶明细「工序组」)'),
 (N'班组',         N'nvarchar(50)',  N'班组(金蝶明细「班组」;本厂按功能填 成型/切炭/组装)'),
 (N'操作工',       N'nvarchar(50)',  N'操作工(金蝶明细「操作工」)'),
 (N'工序单位',     N'nvarchar(20)',  N'工序单位(金蝶明细「工序单位」)'),
 (N'是否末道工序', N'nvarchar(1)',   N'是否末道工序 Y/N(金蝶明细「是否末道工序」)'),
 (N'允许超额',     N'nvarchar(1)',   N'允许超额 Y/N(金蝶明细「允许超额」)'),
 (N'是否质检',     N'nvarchar(1)',   N'是否质检 Y/N(金蝶明细「是否质检」)'),
 (N'是否首检',     N'nvarchar(1)',   N'是否首检 Y/N(金蝶明细「是否首检」)');
DECLARE @c sysname, @t nvarchar(50), @m nvarchar(300), @sql nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, typ, cmt FROM @adds;
OPEN cur FETCH NEXT FROM cur INTO @c, @t, @m;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH('bs_route', @c) IS NULL
  BEGIN
    SET @sql = N'ALTER TABLE bs_route ADD [' + @c + N'] ' + @t + N' NULL';
    EXEC sp_executesql @sql;
  END
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                 WHERE ep.major_id = OBJECT_ID(N'dbo.bs_route')
                   AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_route'), @c, 'ColumnId')
                   AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @m, N'SCHEMA', N'dbo', N'TABLE', N'bs_route', N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @c, @t, @m;
END
CLOSE cur DEALLOCATE cur;
GO

/* ============ B. 标签对齐(截图口径;物理列不动) ============ */
UPDATE yj_field SET label = N'工序控制', place = N'detail' WHERE panel_code = N'ROUTE' AND col_name = N'加工方式';
UPDATE yj_field SET label = N'工序序列', place = N'detail' WHERE panel_code = N'ROUTE' AND col_name = N'加工顺序';
UPDATE yj_field SET label = N'计划数量换算率', place = N'detail' WHERE panel_code = N'ROUTE' AND col_name = N'换算率';
UPDATE yj_field SET label = N'备注1', place = N'header' WHERE panel_code = N'ROUTE' AND col_name = N'备注';
GO

/* ============ C. 字段登记(表头 12 + 明细 15,顺序照截图) ============
   ⚠ 本表第一列是**物理列名**、第二列是**标签**:改了标签的字段(加工方式→工序控制 等)必须写物理列名,
     否则会登记出一个不存在的列(实测报 Invalid column name '备注1')。 */
DECLARE @f TABLE (col sysname, label nvarchar(50), place nvarchar(30), seq int, typ nvarchar(20), width int, req int);
INSERT INTO @f VALUES
 /* 表头(基本信息) */
 (N'工艺路线编码', N'工艺路线编码', N'query,header', 10,  N'文本', 140, 1),
 (N'工艺路线名称', N'工艺路线名称', N'query,header', 20,  N'文本', 180, 1),
 (N'审核状态',     N'审核状态',     N'query,header', 30,  N'文本', 100, 0),
 (N'工艺路线分组', N'工艺路线分组', N'query,header', 40,  N'文本', 120, 0),
 (N'生效日期',     N'生效日期',     N'query,header', 50,  N'日期', 120, 1),
 (N'失效日期',     N'失效日期',     N'query,header', 60,  N'日期', 120, 1),
 (N'工艺类型',     N'工艺类型',     N'header',       70,  N'文本', 120, 0),
 (N'备注',         N'备注1',        N'header',       80,  N'文本', 160, 0),
 (N'备注2',        N'备注2',        N'header',       90,  N'文本', 160, 0),
 (N'备注3',        N'备注3',        N'header',       100, N'文本', 160, 0),
 (N'生产单据类型', N'生产单据类型', N'header',       110, N'文本', 120, 0),
 (N'是否连续委外', N'是否连续委外', N'header',       120, N'是否', 90,  0),
 /* 明细(明细信息) */
 (N'工序图片',     N'工序图片',     N'detail',       200, N'文本', 90,  0),
 (N'工序编码',     N'工序编码',     N'detail',       210, N'文本', 110, 1),
 (N'工序名称',     N'工序名称',     N'detail',       220, N'文本', 120, 0),
 (N'工序说明',     N'工序说明',     N'detail',       230, N'文本', 200, 0),
 (N'加工方式',     N'工序控制',     N'detail',       240, N'文本', 90,  1),
 (N'工序组',       N'工序组',       N'detail',       250, N'文本', 100, 0),
 (N'班组',         N'班组',         N'detail',       260, N'文本', 110, 0),
 (N'操作工',       N'操作工',       N'detail',       270, N'文本', 90,  0),
 (N'工序单位',     N'工序单位',     N'detail',       280, N'文本', 80,  0),
 (N'换算率',       N'计划数量换算率', N'detail',     290, N'数值', 120, 0),
 (N'加工顺序',     N'工序序列',     N'detail',       300, N'数值', 90,  1),
 (N'是否末道工序', N'是否末道工序', N'detail',       310, N'是否', 110, 0),
 (N'允许超额',     N'允许超额',     N'detail',       320, N'是否', 90,  0),
 (N'是否质检',     N'是否质检',     N'detail',       330, N'是否', 90,  0),
 (N'是否首检',     N'是否首检',     N'detail',       340, N'是否', 90,  0),
 (N'生产车间',     N'生产车间',     N'detail',       350, N'文本', 110, 0);
/* 清掉历史误登记(把标签当列名写进去的那 4 行:物理列不存在) */
DELETE FROM yj_field WHERE panel_code = N'ROUTE'
   AND col_name IN (N'工序控制', N'工序序列', N'计划数量换算率', N'备注1')
   AND COL_LENGTH('bs_route', col_name) IS NULL;
DECLARE @col sysname, @lb nvarchar(50), @pl nvarchar(30), @sq int, @ty nvarchar(20), @wd int, @rq int;
DECLARE curf CURSOR LOCAL FAST_FORWARD FOR SELECT col, label, place, seq, typ, width, req FROM @f;
OPEN curf FETCH NEXT FROM curf INTO @col, @lb, @pl, @sq, @ty, @wd, @rq;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = @col)
    UPDATE yj_field SET label = @lb, place = @pl, seq = @sq, data_type = @ty, width = @wd,
                        required = @rq, visible = 1, hidden = 0
     WHERE panel_code = N'ROUTE' AND col_name = @col;
  ELSE
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'ROUTE', @col, @lb, @ty, @pl, @sq, @wd, 1, @rq, 0, 1);
  FETCH NEXT FROM curf INTO @col, @lb, @pl, @sq, @ty, @wd, @rq;
END
CLOSE curf DEALLOCATE curf;
GO

/* ============ D. 截图没有的旧字段:退出表单/明细位(place 改 query;数据保留,随时可恢复) ============
   ⚠ 实测 `visible=0` **不是**表单/明细列的过滤口径(明细列取自 place 含 detail 的字段),
     要让它们不出现在界面必须把 place 里的 detail 去掉。 */
UPDATE yj_field SET place = N'query', visible = 0
 WHERE panel_code = N'ROUTE'
   AND col_name IN (N'停用', N'工资类型', N'计件依据', N'委外供应商', N'按辅单位计价',
                    N'辅单位', N'默认报工数量', N'关键工序', N'标准合格率%');
GO

/* ============ E. 默认路线按图补示例值(仅补空值,幂等) ============ */
UPDATE bs_route SET 审核状态 = N'已审核' WHERE 审核状态 IS NULL;
UPDATE bs_route SET 生效日期 = CAST(GETDATE() AS date) WHERE 生效日期 IS NULL;
UPDATE bs_route SET 失效日期 = '2099-01-01' WHERE 失效日期 IS NULL;
UPDATE bs_route SET 工艺类型 = N'通用工序集' WHERE ISNULL(工艺类型, N'') = N'';
UPDATE bs_route SET 是否连续委外 = N'N' WHERE ISNULL(是否连续委外, N'') = N'';
UPDATE bs_route SET 班组 = 生产车间 WHERE ISNULL(班组, N'') = N'' AND ISNULL(生产车间, N'') <> N'';
/* 工序控制 = 加工方式(标签↔列);换算率 = 计划数量换算率(标签↔列)—— 写**物理列名** */
UPDATE bs_route SET 换算率 = 1 WHERE 换算率 IS NULL;
UPDATE bs_route SET 允许超额 = N'Y' WHERE ISNULL(允许超额, N'') = N'';
UPDATE bs_route SET 是否质检 = N'N' WHERE ISNULL(是否质检, N'') = N'';
UPDATE bs_route SET 是否首检 = N'N' WHERE ISNULL(是否首检, N'') = N'';
/* 末道工序 = 各路线里 加工顺序 最大的那一行 */
UPDATE r SET r.是否末道工序 = N'Y'
  FROM bs_route r
  JOIN (SELECT 工艺路线编码, MAX(加工顺序) AS 末序 FROM bs_route WHERE ISNULL(asp_cancel,'N') <> 'Y'
         GROUP BY 工艺路线编码) m
    ON m.工艺路线编码 = r.工艺路线编码 AND m.末序 = r.加工顺序
 WHERE ISNULL(r.是否末道工序, N'') = N'';
UPDATE bs_route SET 是否末道工序 = N'N' WHERE ISNULL(是否末道工序, N'') = N'';
GO

/* ============ E. 自检 ============ */
DECLARE @bad int = 0, @n int;
SELECT @n = COUNT(*) FROM yj_field WHERE panel_code = N'ROUTE' AND place LIKE '%header%';
IF @n < 12 SET @bad = @bad + 1;                       -- 表头 12 个
SELECT @n = COUNT(*) FROM yj_field WHERE panel_code = N'ROUTE' AND place = N'detail' AND visible = 1;
IF @n < 15 SET @bad = @bad + 1;                       -- 明细 15 列(+生产车间)
IF COL_LENGTH('bs_route', N'是否末道工序') IS NULL OR COL_LENGTH('bs_route', N'生效日期') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'加工顺序' AND label = N'工序序列') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name IN (N'停用', N'工资类型') AND place LIKE N'%detail%') SET @bad = @bad + 1;
/* 所有 ROUTE 字段必须指向 bs_route 上真实存在的列(踩过:把标签当列名登记 → Invalid column name) */
IF EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = N'ROUTE' AND COL_LENGTH('bs_route', f.col_name) IS NULL) SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'工艺路线金蝶字段补齐自检失败', 16, 1);
ELSE PRINT N'工艺路线字段就绪:表头 12(编码/名称/审核状态/分组/生效·失效/工艺类型/备注1-3/生产单据类型/是否连续委外)+ 明细 15(工序图片…是否首检)';
GO
