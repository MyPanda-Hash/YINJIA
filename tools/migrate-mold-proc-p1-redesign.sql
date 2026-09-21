/* ============================================================================
   migrate-mold-proc-p1-redesign.sql —— 成型工艺清单(页 1)按设计图重排字段与来源(2026-09-21)
   ============================================================================
   口径(用户给的版面照片 + 《炭棒BOM及工艺信息表单需求设计内容》第三页):
     ① 产品基本信息:标签改成 炭棒编号 / 产品名称 / 炭棒规格 / 产品管控类型 / 产品形态 / 生产车间;
     ② 工序:新增「配料要求」行(工序名=配料要求,要求格横跨)、灌料块新增「灌料要求」行;
        三值并排(理论最低/中间/最高灌料重量g)、随后一个空白行、理论水分、实际灌料重量计算公式、灌料要求;
     ③ 检验要求:炭棒尺寸块改成 4 格(炭棒外径mm/炭棒外径公差mm/炭棒内径mm/炭棒内径公差mm,
        原「内孔要求」版面已无);压降块**第三行**新增「压降是否测试」(√/×);
     ④ 工序五个字段的选项来自**可维护标准模板库**(配料要求/烧结炉参数/烧结时间调速器参数/热压要求/冷却参数设置)。

   ⚠ 三条硬口径:
   1. **显示改名一律走 yj_field.alias,数据键(col_name/label)一律不动** —— 参照(产品编号→产品信息表)、
      四文件编辑门禁、配方计算回填全都按数据键走(回填写的是 外径mm/外径公差/内径mm/内径公差 等),
      改 label 会让历史单据丢字段。纸上要显示成别的字,alias 就是干这个的(CONTEXT「每页版式」同款口径)。
   2. **新字段一律 required=0**(历史单据再保存不能被拦)。
   3. 标准库型字段的 dict_sql 是**库编码不是 SQL**(写 SQL 会下拉空白且不报错)——本脚本把原来写死在
      yj_field.dict_sql 里的候选值搬进 yj_std_lib,值不丢;库编码一律 `mold.*` 前缀。

   幂等:列/字段/别名/库条目/译名全部按存在判,可重复执行。两个账套都要跑(先正式后测试,`sqlcmd -I`)。
   ============================================================================ */

SET NOCOUNT ON;
GO

/* ── 1. 新字段的物理列 ── */
IF COL_LENGTH('rd_mold_proc_head', N'灌料要求') IS NULL
BEGIN
    ALTER TABLE rd_mold_proc_head ADD [灌料要求] nvarchar(500) NULL;
    PRINT N'migrate-mold-proc-p1-redesign.sql:加列 rd_mold_proc_head.灌料要求';
END
IF COL_LENGTH('rd_mold_proc_head', N'压降是否测试') IS NULL
BEGIN
    ALTER TABLE rd_mold_proc_head ADD [压降是否测试] nvarchar(10) NULL;
    PRINT N'migrate-mold-proc-p1-redesign.sql:加列 rd_mold_proc_head.压降是否测试';
END
GO

/* 列注释 */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('rd_mold_proc_head') AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_mold_proc_head'), N'灌料要求', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'成型工艺清单页1·灌料块的「灌料要求」(用户输入,模板可由标准库 mold.batching 预置)', N'SCHEMA', N'dbo', N'TABLE', N'rd_mold_proc_head', N'COLUMN', N'灌料要求';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('rd_mold_proc_head') AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_mold_proc_head'), N'压降是否测试', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'成型工艺清单页1·压降块的「压降是否测试」(√/×;设计口径=压降是否抽检,由用户确认)', N'SCHEMA', N'dbo', N'TABLE', N'rd_mold_proc_head', N'COLUMN', N'压降是否测试';
GO

/* ── 2. 新字段登记(place='header';seq 插在邻居之后,列表顺序不乱) ── */
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.dict_sql, NULL, NULL, NULL, v.place, v.seq, v.width, v.editable, v.required, 0, 1
FROM (VALUES
  ('RD_MOLD_PROC', N'灌料要求',     N'灌料要求',     N'文本',   NULL, N'header', 195, 260, 1, 0),
  ('RD_MOLD_PROC', N'压降是否测试', N'压降是否测试', N'下拉框', N'SELECT v FROM (VALUES (N''√''),(N''×'')) AS t(v)', N'header', 485, 110, 1, 0)
) AS v(panel_code, col_name, label, data_type, dict_sql, place, seq, width, editable, required)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);
GO

/* ── 3. 显示别名(数据键不动;只改纸面上显示的字) ── */
UPDATE yj_field SET alias = N'炭棒编号' WHERE panel_code = 'RD_MOLD_PROC' AND col_name = N'产品编号' AND ISNULL(alias, N'') <> N'炭棒编号';
UPDATE yj_field SET alias = N'产品形态' WHERE panel_code = 'RD_MOLD_PROC' AND col_name = N'外观要求' AND ISNULL(alias, N'') <> N'产品形态';
UPDATE yj_field SET alias = N'炭棒外径mm'     WHERE panel_code = 'RD_MOLD_PROC' AND col_name = N'外径mm'   AND ISNULL(alias, N'') <> N'炭棒外径mm';
UPDATE yj_field SET alias = N'炭棒外径公差mm' WHERE panel_code = 'RD_MOLD_PROC' AND col_name = N'外径公差' AND ISNULL(alias, N'') <> N'炭棒外径公差mm';
UPDATE yj_field SET alias = N'炭棒内径mm'     WHERE panel_code = 'RD_MOLD_PROC' AND col_name = N'内径mm'   AND ISNULL(alias, N'') <> N'炭棒内径mm';
UPDATE yj_field SET alias = N'炭棒内径公差mm' WHERE panel_code = 'RD_MOLD_PROC' AND col_name = N'内径公差' AND ISNULL(alias, N'') <> N'炭棒内径公差mm';
UPDATE yj_field SET alias = N'烧结时间/调速器参数' WHERE panel_code = 'RD_MOLD_PROC' AND col_name = N'烧结时间调速器参数' AND ISNULL(alias, N'') <> N'烧结时间/调速器参数';
GO

/* ── 4. 五个工序字段改挂标准库(选项从库来 ⇒ 可维护;dict_sql=库编码) ── */
UPDATE yj_field SET data_type = N'标准库', dict_sql = x.lib
FROM yj_field f
JOIN (VALUES
  (N'配料要求',          'mold.batching'),
  (N'烧结炉参数',        'mold.sinter'),
  (N'烧结时间调速器参数', 'mold.sintertime'),
  (N'热压要求',          'mold.hotpress'),
  (N'冷却参数设置',      'mold.cooling')
) AS x(col, lib) ON x.col = f.col_name
WHERE f.panel_code = 'RD_MOLD_PROC' AND f.place = 'header';
GO

/* ── 5. 把原来写死在 dict_sql 里的候选值搬进库(值不丢) ──
   item_code 统一 N'默认'(与 StdLibManager 的新增口径一致:它按 addItem='默认' 落行);
   配料要求/热压要求 两个库**先空着** —— 模板文字属业务内容,由工艺科在「标准库维护」里自己录,
   这里不替业务编造正文(编了就成了受控文书上的假数据)。 */
INSERT INTO yj_std_lib (lib_code, item_code, content, seq, enabled, asp_user1, asp_time1)
SELECT v.lib, N'默认', v.content, v.seq, 1, 'system', SYSDATETIME()
FROM (VALUES
  ('mold.sinter',     N'170度', 10), ('mold.sinter', N'180度', 20), ('mold.sinter', N'185度', 30),
  ('mold.sinter',     N'190度', 40), ('mold.sinter', N'200度', 50),
  ('mold.sintertime', N'40分钟', 10), ('mold.sintertime', N'55分钟', 20), ('mold.sintertime', N'60分钟', 30),
  ('mold.sintertime', N'65分钟', 40), ('mold.sintertime', N'80分钟', 50), ('mold.sintertime', N'125分钟', 60),
  ('mold.cooling',    N'打开全部冷却风扇', 10), ('mold.cooling', N'关闭全部冷却风扇', 20),
  ('mold.cooling',    N'冷却调速设置3.7~4.3，打开全部冷却风扇', 30),
  ('mold.cooling',    N'冷却调速设置12，关闭全部冷却风扇', 40),
  ('mold.cooling',    N'冷却调速设置35-45，打开冷却线入口及出口冷却风扇', 50)
) AS v(lib, content, seq)
WHERE NOT EXISTS (SELECT 1 FROM yj_std_lib s WHERE s.lib_code = v.lib AND s.item_code = N'默认' AND s.content = v.content);
GO

/* ── 6. 译名(新字段 + 别名显示的字;scope='field' 按 label/显示名共享) ── */
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', v.k, 'en', v.en, 'manual'
FROM (VALUES
  (N'灌料要求', 'Filling Requirements'),
  (N'压降是否测试', 'Pressure Drop Tested'),
  (N'炭棒编号', 'Rod No.'),
  (N'产品形态', 'Product Form'),
  (N'炭棒外径mm', 'Rod OD (mm)'),
  (N'炭棒外径公差mm', 'Rod OD Tol. (mm)'),
  (N'炭棒内径mm', 'Rod ID (mm)'),
  (N'炭棒内径公差mm', 'Rod ID Tol. (mm)'),
  (N'烧结时间/调速器参数', 'Sintering Time / Speed Controller')
) AS v(k, en)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope = 'field' AND t.ref_key = v.k AND t.locale = 'en');
GO

/* ── 7. 核验 ── */
SELECT N'rd_mold_proc_head.灌料要求' AS 检查项, CASE WHEN COL_LENGTH('rd_mold_proc_head', N'灌料要求') IS NULL THEN N'MISSING' ELSE N'OK' END AS 结果
UNION ALL SELECT N'rd_mold_proc_head.压降是否测试', CASE WHEN COL_LENGTH('rd_mold_proc_head', N'压降是否测试') IS NULL THEN N'MISSING' ELSE N'OK' END
UNION ALL SELECT N'yj_field 新字段(应 2)', CAST(COUNT(*) AS nvarchar) FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name IN (N'灌料要求', N'压降是否测试') AND place='header'
UNION ALL SELECT N'别名已设(应 8:产品编号有 query/header 两行)', CAST(COUNT(*) AS nvarchar) FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND alias IS NOT NULL
UNION ALL SELECT N'标准库字段(应 5)', CAST(COUNT(*) AS nvarchar) FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND data_type=N'标准库'
UNION ALL SELECT N'库条目 mold.*(应 17:16 条新增 + calcparam 1)', CAST(COUNT(*) AS nvarchar) FROM yj_std_lib WHERE lib_code LIKE 'mold.%';
GO
SELECT lib_code, COUNT(*) AS 条目数 FROM yj_std_lib WHERE lib_code LIKE 'mold.%' GROUP BY lib_code ORDER BY lib_code;
GO
SELECT col_name, label, alias, data_type, ISNULL(dict_sql, N'-') AS dict_sql FROM yj_field
WHERE panel_code='RD_MOLD_PROC' AND place='header' AND (alias IS NOT NULL OR data_type = N'标准库' OR col_name IN (N'灌料要求', N'压降是否测试')) ORDER BY seq;
GO
PRINT N'migrate-mold-proc-p1-redesign.sql 完成:页1 新字段/别名/标准库挂载/库条目';
