/* ═══════════════════════════════════════════════════════════════════════════════
   migrate-merged-panels.sql — 成型配方并入成型工艺清单 / 组装BOM表并入组装工艺清单
   (2026-09-11)

   背景与口径(见 CONTEXT.md「产品文件文书面板」):
     成型工艺清单(RD_MOLD_PROC)与组装工艺清单(RD_ASM_PROC)改为**一张单两个页签**:
       页 1 = 工艺清单(原有内容,结构不动)
       页 2 = 配方(RD_MOLD_FORMULA 的内容) / 组装BOM表(RD_ASM_BOM 的内容)
     被并入的 RD_MOLD_FORMULA / RD_ASM_BOM 从菜单下线(yj_panel/yj_field/yj_role_panel 行保留)。

   存储方案(不改已有单据语义、不新建物理表):
     合并后一个面板只有一个头表 + 一个行表(PanelRegistry.PanelDef),所以页 2 的内容必须落在
     主面板自己的头表/行表里:
       · 页 2 的「产品基本信息」= 主面板头表已有列(产品编号/产品名称/炭棒规格1-3/产品管控类型/
         外观要求/生产车间),**同一张纸同一个头**,不复制、不新增列;
       · 页 2 的表格行 = 主面板行表,用「表区」列区分逻辑表(规格书 dataTables 的既有模式:
         filterKey='表区' + filterVal);
       · 只有主面板头表确实没有的列才补:成型侧补 配料要求;组装侧补 产品种类/整体规格外径/
         整体规格长度/成品重量(与 RD_ASM_BOM 头表同列名同口径)。
     行表补列:成型侧 rd_mold_proc_detail 原本只有 id/单据编号/审计列(0 行),补配方表 8 列;
     组装侧 rd_asm_proc_detail 补 表区(工艺清单列 工序/工序控制内容/管控要求/检查比例 原样保留)。

   组装侧关联补齐:RD_ASM_PROC 头表补「产品编号」(参照 RD_PROD_INFO.产品编号 → 产品名称),
     与成型侧同口径 —— DevTaskService.PRODUCT_KEY / 产品开发状态角标 / 产品开发下发都依赖它。

   幂等:补列用 IF COL_LENGTH IS NULL,元数据行用 IF NOT EXISTS,可重复执行。
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
GO

/* ── 1. 列(物理表)───────────────────────────────────────────────────────── */

-- 1.1 成型:头表补 配料要求(原在 rd_mold_formula_head,配方页尾区)
IF COL_LENGTH('rd_mold_proc_head', N'配料要求') IS NULL
    ALTER TABLE rd_mold_proc_head ADD [配料要求] nvarchar(1000) NULL;
GO
-- 1.2 成型:行表补配方表列(rd_mold_proc_detail 原为空表,只有 id/单据编号/审计列)
IF COL_LENGTH('rd_mold_proc_detail', N'表区')         IS NULL ALTER TABLE rd_mold_proc_detail ADD [表区] nvarchar(20) NULL;
IF COL_LENGTH('rd_mold_proc_detail', N'序号')         IS NULL ALTER TABLE rd_mold_proc_detail ADD [序号] nvarchar(20) NULL;
IF COL_LENGTH('rd_mold_proc_detail', N'物料种类')     IS NULL ALTER TABLE rd_mold_proc_detail ADD [物料种类] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_detail', N'物料编号')     IS NULL ALTER TABLE rd_mold_proc_detail ADD [物料编号] nvarchar(60) NULL;
IF COL_LENGTH('rd_mold_proc_detail', N'物料名称')     IS NULL ALTER TABLE rd_mold_proc_detail ADD [物料名称] nvarchar(100) NULL;
IF COL_LENGTH('rd_mold_proc_detail', N'实际添加比例') IS NULL ALTER TABLE rd_mold_proc_detail ADD [实际添加比例] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_detail', N'单支物料含量') IS NULL ALTER TABLE rd_mold_proc_detail ADD [单支物料含量] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_detail', N'设计添加量')   IS NULL ALTER TABLE rd_mold_proc_detail ADD [设计添加量] nvarchar(50) NULL;
GO
-- 1.3 组装:头表补产品基本信息列(与 rd_asm_bom_head 同列名/同口径)+ 关联补齐的 产品编号
IF COL_LENGTH('rd_asm_proc_head', N'产品编号')     IS NULL ALTER TABLE rd_asm_proc_head ADD [产品编号] nvarchar(60) NULL;
IF COL_LENGTH('rd_asm_proc_head', N'产品名称')     IS NULL ALTER TABLE rd_asm_proc_head ADD [产品名称] nvarchar(200) NULL;
IF COL_LENGTH('rd_asm_proc_head', N'产品种类')     IS NULL ALTER TABLE rd_asm_proc_head ADD [产品种类] nvarchar(100) NULL;
IF COL_LENGTH('rd_asm_proc_head', N'整体规格外径') IS NULL ALTER TABLE rd_asm_proc_head ADD [整体规格外径] nvarchar(100) NULL;
IF COL_LENGTH('rd_asm_proc_head', N'整体规格长度') IS NULL ALTER TABLE rd_asm_proc_head ADD [整体规格长度] nvarchar(100) NULL;
IF COL_LENGTH('rd_asm_proc_head', N'成品重量')     IS NULL ALTER TABLE rd_asm_proc_head ADD [成品重量] nvarchar(50) NULL;
-- 表区(两侧都补头表列):BOM/配方的多张逻辑表共用一张行表,靠这一列分块。
-- 两侧的 yj_field 里都登记了 place='header' 的「表区」(见 2.1/2.3),QueryService.selectCols 会生成
-- t.[表区](列表/明细查询都走它),头表缺这一列就整面板查询 500(实测:列名 '表区' 无效)。
IF COL_LENGTH('rd_asm_proc_head',  N'表区')        IS NULL ALTER TABLE rd_asm_proc_head  ADD [表区] nvarchar(20) NULL;
IF COL_LENGTH('rd_mold_proc_head', N'表区')        IS NULL ALTER TABLE rd_mold_proc_head ADD [表区] nvarchar(20) NULL;
GO
-- 1.4 组装:行表补 BOM 两表所需列(物料清单 = 物料名/物料编号/物料规格/外观要求/用量;修订记录 = 序号/更改内容/更改原因/更改时间/责任人/备注)
IF COL_LENGTH('rd_asm_proc_detail', N'表区')     IS NULL ALTER TABLE rd_asm_proc_detail ADD [表区] nvarchar(20) NULL;
IF COL_LENGTH('rd_asm_proc_detail', N'序号')     IS NULL ALTER TABLE rd_asm_proc_detail ADD [序号] nvarchar(20) NULL;
IF COL_LENGTH('rd_asm_proc_detail', N'物料名')   IS NULL ALTER TABLE rd_asm_proc_detail ADD [物料名] nvarchar(100) NULL;
IF COL_LENGTH('rd_asm_proc_detail', N'物料编号') IS NULL ALTER TABLE rd_asm_proc_detail ADD [物料编号] nvarchar(60) NULL;
IF COL_LENGTH('rd_asm_proc_detail', N'物料规格') IS NULL ALTER TABLE rd_asm_proc_detail ADD [物料规格] nvarchar(500) NULL;
IF COL_LENGTH('rd_asm_proc_detail', N'外观要求') IS NULL ALTER TABLE rd_asm_proc_detail ADD [外观要求] nvarchar(500) NULL;
IF COL_LENGTH('rd_asm_proc_detail', N'用量')     IS NULL ALTER TABLE rd_asm_proc_detail ADD [用量] nvarchar(30) NULL;
IF COL_LENGTH('rd_asm_proc_detail', N'更改内容') IS NULL ALTER TABLE rd_asm_proc_detail ADD [更改内容] nvarchar(500) NULL;
IF COL_LENGTH('rd_asm_proc_detail', N'更改原因') IS NULL ALTER TABLE rd_asm_proc_detail ADD [更改原因] nvarchar(200) NULL;
IF COL_LENGTH('rd_asm_proc_detail', N'更改时间') IS NULL ALTER TABLE rd_asm_proc_detail ADD [更改时间] nvarchar(50) NULL;
IF COL_LENGTH('rd_asm_proc_detail', N'责任人')   IS NULL ALTER TABLE rd_asm_proc_detail ADD [责任人] nvarchar(50) NULL;
IF COL_LENGTH('rd_asm_proc_detail', N'备注')     IS NULL ALTER TABLE rd_asm_proc_detail ADD [备注] nvarchar(200) NULL;
GO

/* ── 2. 元数据 yj_field(中文数据键;place=header/detail 决定保存链是否认这个键)──────
   注意:labelsToCols() 只写 yj_field 声明过的键,所以「页签能编辑又能落库」的前提是这里都登记。 */

-- 2.1 成型侧新增头字段
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'配料要求')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_MOLD_PROC', N'配料要求', N'配料要求', N'文本', N'header', 500, 100, 1, 0, 0, 1);
-- 表区:逻辑分区列(**必须登记成 yj_field**,不是可选项)。
--   踩坑记录:第一版只靠前端 recordSheetConfigs 的 filterKey 在内存里打 表区,没登记字段 ——
--   于是保存链 labelsToCols 把它当"未声明的键"丢掉(它只写 yj_field 声明过的列),
--   落库行没有 表区 → 下次打开按 filterKey 过滤时该行整片消失(实测:配方行存进去了但页签上看不见)。
--   登记成 place='header' 后 QueryService.selectCols 会生成 t.[表区],所以**物理列也必须存在**
--   (见 1.5 ALTER TABLE;否则整面板列表查询 500,报"列名 '表区' 无效")。
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'表区')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_MOLD_PROC', N'表区', N'表区', N'文本', N'header', 520, 90, 1, 0, 1, 1);

-- 2.2 成型侧新增明细字段(配方表)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'序号' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_MOLD_PROC', N'序号', N'序号', N'文本', N'detail', 10, 60, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'物料种类' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_MOLD_PROC', N'物料种类', N'物料种类', N'文本', N'detail', 20, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'物料编号' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_MOLD_PROC', N'物料编号', N'物料编号', N'文本', N'detail', 30, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'物料名称' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_MOLD_PROC', N'物料名称', N'物料名称', N'文本', N'detail', 40, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'实际添加比例' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_MOLD_PROC', N'实际添加比例', N'实际添加比例', N'文本', N'detail', 50, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'单支物料含量' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_MOLD_PROC', N'单支物料含量', N'单支物料含量', N'文本', N'detail', 60, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'设计添加量' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_MOLD_PROC', N'设计添加量', N'设计添加量', N'文本', N'detail', 70, 90, 1, 0, 0, 1);

-- 2.3 组装侧新增头字段(产品基本信息 + 关联补齐的产品编号)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'产品编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'产品编号', N'产品编号', N'参照', NULL, N'RD_PROD_INFO', N'产品编号', N'产品名称', N'header', 30, 130, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'产品名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'产品名称', N'产品名称', N'文本', N'header', 40, 200, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'产品种类')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'产品种类', N'产品种类', N'文本', N'header', 50, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'整体规格外径')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'整体规格外径', N'整体规格（外径）', N'文本', N'header', 60, 150, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'整体规格长度')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'整体规格长度', N'整体规格（长度）', N'文本', N'header', 70, 150, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'成品重量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'成品重量', N'成品重量', N'文本', N'header', 80, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'表区')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'表区', N'表区', N'文本', N'header', 90, 90, 1, 0, 1, 1);

-- 2.4 组装侧新增明细字段(物料清单 + 修订记录)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'序号' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'序号', N'序号', N'文本', N'detail', 5, 60, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'物料名' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'物料名', N'物料名', N'文本', N'detail', 50, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'物料编号' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'物料编号', N'物料编号', N'文本', N'detail', 60, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'物料规格' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'物料规格', N'物料规格', N'文本', N'detail', 70, 260, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'外观要求' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'外观要求', N'外观要求', N'文本', N'detail', 80, 260, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'用量' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'用量', N'用量', N'文本', N'detail', 90, 80, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'更改内容' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'更改内容', N'更改内容', N'文本', N'detail', 100, 200, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'更改原因' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'更改原因', N'更改原因', N'文本', N'detail', 110, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'更改时间' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'更改时间', N'更改时间', N'文本', N'detail', 120, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'责任人' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'责任人', N'责任人', N'文本', N'detail', 130, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_PROC' AND col_name=N'备注' AND place=N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_ASM_PROC', N'备注', N'备注', N'文本', N'detail', 140, 200, 1, 0, 0, 1);
GO

/* ── 3. 组装工艺清单新增字段改挂参照(产品开发下发 / 产品开发状态角标靠它) ───────── */
UPDATE yj_field SET ref_panel=N'RD_PROD_INFO', ref_field=N'产品编号', display_field=N'产品名称', data_type=N'参照'
WHERE panel_code='RD_ASM_PROC' AND col_name=N'产品编号';
GO

/* ── 4. 译名(新增字段/面板名;AGENTS.md 多语言强制规范)────────────────────────
   同一中文标签全局共享译名,已有译名的(产品名称/产品种类/物料编号/… )不重复插入。 */
-- 译名行直接用 (标签, 语言, 译名) 三列 VALUES 列出(同一条 SELECT 里别名不可被 VALUES 引用,故不拆表变量)
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', v.label, v.locale, v.text, 'manual'
FROM (VALUES
 (N'配料要求','en',N'Batching Requirements'),       (N'配料要求','ja',N'配合要件'),
 (N'表区','en',N'Section'),                          (N'表区','ja',N'テーブルエリア'),
 (N'序号','en',N'No.'),                              (N'序号','ja',N'番号'),
 (N'物料种类','en',N'Material Category'),            (N'物料种类','ja',N'材料種類'),
 (N'物料编号','en',N'Material Code'),                (N'物料编号','ja',N'材料番号'),
 (N'物料名称','en',N'Material Name'),                (N'物料名称','ja',N'材料名'),
 (N'实际添加比例','en',N'Actual Ratio %'),           (N'实际添加比例','ja',N'実際添加比率%'),
 (N'单支物料含量','en',N'Content per Unit g'),       (N'单支物料含量','ja',N'1本当たり含有量g'),
 (N'设计添加量','en',N'Design Dosage'),              (N'设计添加量','ja',N'設計添加量'),
 (N'产品编号','en',N'Product Code'),                 (N'产品编号','ja',N'製品番号'),
 (N'产品名称','en',N'Product Name'),                 (N'产品名称','ja',N'製品名'),
 (N'产品种类','en',N'Product Kind'),                 (N'产品种类','ja',N'製品の種類'),
 (N'整体规格（外径）','en',N'Overall Spec (OD)'),    (N'整体规格（外径）','ja',N'全体仕様 (外径)'),
 (N'整体规格（长度）','en',N'Overall Spec (Length)'),(N'整体规格（长度）','ja',N'全体仕様 (長さ)'),
 (N'成品重量','en',N'Finished Weight'),              (N'成品重量','ja',N'完成品重量'),
 (N'物料名','en',N'Material Name'),                  (N'物料名','ja',N'材料名'),
 (N'物料规格','en',N'Material Spec'),                (N'物料规格','ja',N'材料仕様'),
 (N'外观要求','en',N'Appearance Requirement'),       (N'外观要求','ja',N'外観要求'),
 (N'用量','en',N'Quantity'),                         (N'用量','ja',N'使用量'),
 (N'更改内容','en',N'Change Content'),               (N'更改内容','ja',N'内容の変更'),
 (N'更改原因','en',N'Change Reason'),                (N'更改原因','ja',N'変更理由'),
 (N'更改时间','en',N'Change Time'),                  (N'更改时间','ja',N'時間の変更'),
 (N'责任人','en',N'Owner'),                          (N'责任人','ja',N'責任者'),
 (N'备注','en',N'Remark'),                           (N'备注','ja',N'備考')
) AS v(label, locale, text)
WHERE NOT EXISTS (
    SELECT 1 FROM yj_translation x WHERE x.scope='field' AND x.ref_key=v.label AND x.locale=v.locale);
GO

/* ── 5. 校验输出 ────────────────────────────────────────────────────────────── */
SELECT N'rd_mold_proc_head.配料要求' AS 检查项, CASE WHEN COL_LENGTH('rd_mold_proc_head', N'配料要求') IS NULL THEN N'MISSING' ELSE N'OK' END AS 结果
UNION ALL SELECT N'rd_mold_proc_detail.设计添加量', CASE WHEN COL_LENGTH('rd_mold_proc_detail', N'设计添加量') IS NULL THEN N'MISSING' ELSE N'OK' END
UNION ALL SELECT N'rd_asm_proc_head.产品编号',   CASE WHEN COL_LENGTH('rd_asm_proc_head', N'产品编号') IS NULL THEN N'MISSING' ELSE N'OK' END
UNION ALL SELECT N'rd_asm_proc_detail.物料规格', CASE WHEN COL_LENGTH('rd_asm_proc_detail', N'物料规格') IS NULL THEN N'MISSING' ELSE N'OK' END
UNION ALL SELECT N'yj_field RD_MOLD_PROC',       CAST(COUNT(*) AS nvarchar) FROM yj_field WHERE panel_code='RD_MOLD_PROC'
UNION ALL SELECT N'yj_field RD_ASM_PROC',        CAST(COUNT(*) AS nvarchar) FROM yj_field WHERE panel_code='RD_ASM_PROC';
GO
