/* migrate-qc-plan-type-qty-20261016.sql(2026-10-16):检验方案改「按检验类型归属」+ 项目可选「检验数量」。
 *
 * 用户 2026-10-16 口径(逐字):
 *   ①「修改当前检验方案的实现模式,不需要绑定文件编码,而是设定当前检验的类型」
 *   ②「然后下方增加可选的检验数量」
 *   ③「就是让当前的检验[类型]格决定是否能被增加的实现」
 *   ④ 追问后拍板:检验类型 =「外观检测 / 重量检测 这些**项目分类**」,
 *      作用 =「一个方案 = 一类项目:作为项目归属 + 带入横表时的『表区』名」;
 *      检验数量 =「决定制程检验单横表该项目的格数:带入时 5 → 5 格,列头「＋」加不过这个数」。
 *
 * ⇒ 三处结构变更(全部幂等):
 *   A. bs_qc_plan  + `检验类型` nvarchar(100) —— 方案的分类/归属(如 外观检测/重量检测),
 *      **取代 文件编码** 作为「这套标准是干什么用的」的标识(文件编码退场:值保留、字段隐藏,
 *      老数据不丢;新建方案不再要求填受控文件号)。
 *   B. bs_qc_item  + `检验数量` int —— 项目**可选**的检验数量(几个样品/几次);
 *      带入检验单时既是横表该列的**初始格数**,也是列头「＋」的**上限**(空 = 不设上限,照旧可自由加减)。
 *   C. qc_proc_insp_detail + `格数上限` int —— 把上面那个上限落到单据行上
 *      (格数会随「＋/−」变,上限必须独立存,否则刷新后丢);hidden=1/visible=0,照 格数 的口径。
 *      ⚠ 刻意**不叫**「检验数量」:qc_proc_insp_head 上已有一个业务列 `检验数量`
 *      (合格数 = 表头检验数量 − Σ不合格数量 的基数,ButtonService/ScheduleBoardService 在用),
 *      同行表同名两列会让人与代码都读错;「格数上限」才自解释。
 *
 * 登记口径:hidden=1 / visible=0 的字段值照存照取、不进列表页明细列。
 * 规范:列名中文即语义;幂等(COL_LENGTH 判空再 ADD);两账套均执行(HSDZ_MES → HSDZ_MES_TEST)。
 */

/* ============ A0. 同批修正:清掉初版留下的 `检验数量` 行表列 ============
 * 本脚本初版把上限列命名为 `检验数量`(与头表业务列同名),正式名定为 `格数上限`;
 * 初版只在本机两账套跑过、该列全为空,故此处仅在「列存在且全空」时清掉(幂等;有值则不动)。 */
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'检验数量') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.qc_proc_insp_detail WHERE 检验数量 IS NOT NULL)
  ALTER TABLE dbo.qc_proc_insp_detail DROP COLUMN 检验数量;
GO

/* ============ A. 加列 ============ */
IF COL_LENGTH(N'dbo.bs_qc_plan', N'检验类型') IS NULL
  ALTER TABLE dbo.bs_qc_plan ADD 检验类型 nvarchar(100) NULL;
GO
IF COL_LENGTH(N'dbo.bs_qc_item', N'检验数量') IS NULL
  ALTER TABLE dbo.bs_qc_item ADD 检验数量 int NULL;
GO
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'格数上限') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 格数上限 int NULL;
GO

/* ============ B. 列级中文注明 ============ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.bs_qc_plan')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_qc_plan'), N'检验类型', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description',
       N'方案的检验类型(项目分类,如 外观检测/重量检测/尺寸检测);一个方案 = 一类项目,带入检验单横表时作「表区」名。取代原来的文件编码(2026-10-16)',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_qc_plan', N'COLUMN', N'检验类型';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.bs_qc_item')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_qc_item'), N'检验数量', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description',
       N'本检验项目的检验数量(可选;几个样品/几次)= 带入检验单后横表该列的初始格数,也是列头「＋」的上限;空 = 不设上限',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_qc_item', N'COLUMN', N'检验数量';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_detail'), N'格数上限', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description',
       N'本检验项目在本单上允许的格数上限(源自检验方案的「检验数量」;空 = 不设上限)。格数会随列头 ＋/− 变,故上限单独存',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_proc_insp_detail', N'COLUMN', N'格数上限';
GO

/* ============ C. yj_field 登记 ============ */
/* C1. QC_PLAN 新增「检验类型」—— 占原「文件编码」的位次(seq 68),列表页与表单都显示 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PLAN' AND col_name = N'检验类型')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_PLAN', N'检验类型', N'检验类型', N'文本', N'query,detail', 68, 110, 1, 0, 0, 1);
ELSE
  UPDATE yj_field SET label = N'检验类型', data_type = N'文本', place = N'query,detail',
         seq = 68, width = 110, editable = 1, required = 0, hidden = 0, visible = 1
   WHERE panel_code = N'QC_PLAN' AND col_name = N'检验类型';

/* C2. QC_PLAN 的「文件编码」退场:hidden=1/visible=0(值保留,面板与维护弹窗都不再要求填它) */
UPDATE yj_field SET hidden = 1, visible = 0, editable = 0
 WHERE panel_code = N'QC_PLAN' AND col_name = N'文件编码' AND (hidden = 0 OR visible = 1 OR editable = 1);

/* C3. QC_ITEM 新增「检验数量」(排在 取样要求(115) 与 检验方法(125) 之间) */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ITEM' AND col_name = N'检验数量')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_ITEM', N'检验数量', N'检验数量', N'整数', N'query,detail', 118, 90, 1, 0, 0, 1);
ELSE
  UPDATE yj_field SET label = N'检验数量', data_type = N'整数', place = N'query,detail',
         seq = 118, width = 90, editable = 1, required = 0, hidden = 0, visible = 1
   WHERE panel_code = N'QC_ITEM' AND col_name = N'检验数量';

/* C4. QC_PROC_INSP 行表「格数上限」—— 照 格数 口径:hidden=1/visible=0(值照存照取,不进列表列) */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'格数上限')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_PROC_INSP', N'格数上限', N'格数上限', N'整数', N'detail', 87, 60, 1, 0, 1, 0);
GO

/* ============ D. 多语言(新标签至少 en;已有译名不重复插) ============ */
/* D1. 检验类型:QC_INSP 时代已有 10 语言译名,按「同一中文标签全局共享译名」只补缺的 */
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', N'检验类型', v.locale, v.text, N'manual'
  FROM (VALUES
    (N'en', N'Inspection Type'), (N'ja', N'検査タイプ'), (N'ko', N'검사 유형'), (N'de', N'Prüfart'),
    (N'fr', N'Type d''inspection'), (N'es', N'Tipo de inspección'), (N'ru', N'Тип проверки'),
    (N'th', N'ประเภทการตรวจสอบ'), (N'vi', N'Loại kiểm tra'), (N'zh-TW', N'檢驗類型')
  ) AS v(locale, text)
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                    WHERE t.scope = N'field' AND t.ref_key = N'检验类型' AND t.locale = v.locale);

/* D2. 检验数量:此前只有 en,本批补齐其余 9 语言 */
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', N'检验数量', v.locale, v.text, N'manual'
  FROM (VALUES
    (N'en', N'Inspection Qty'), (N'ja', N'検査数量'), (N'ko', N'검사 수량'), (N'de', N'Prüfmenge'),
    (N'fr', N'Quantité d''inspection'), (N'es', N'Cantidad de inspección'), (N'ru', N'Количество проверок'),
    (N'th', N'จำนวนที่ตรวจสอบ'), (N'vi', N'Số lượng kiểm tra'), (N'zh-TW', N'檢驗數量')
  ) AS v(locale, text)
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                    WHERE t.scope = N'field' AND t.ref_key = N'检验数量' AND t.locale = v.locale);
GO

/* D3. 格数上限:内部字段(不在界面出现),只登记 en 兜底译名 */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'格数上限' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'field', N'格数上限', N'en', N'Max Cells', N'manual');
GO

/* ============ E. 存量回填(只认 NULL,幂等) ============ */
/* E1. 项目的检验数量:取样要求里写死了「nPCS」的照抄(1PCS→1 / 5PCS→5);
 *     「全检 / 称取10g」这类没有个数含义的**留空**(空 = 不设上限,照旧自由加减,不猜)。 */
UPDATE dbo.bs_qc_item
   SET 检验数量 = TRY_CAST(REPLACE(UPPER(LTRIM(RTRIM(取样要求))), N'PCS', N'') AS int)
 WHERE 检验数量 IS NULL
   AND ISNULL(asp_cancel, 'N') <> 'Y'
   AND UPPER(LTRIM(RTRIM(ISNULL(取样要求, N'')))) LIKE N'%PCS'
   AND TRY_CAST(REPLACE(UPPER(LTRIM(RTRIM(取样要求))), N'PCS', N'') AS int) BETWEEN 1 AND 100;
/* E2. 单据行(qc_proc_insp_detail)的格数上限**刻意不回填** —— 存量单的列没有「上限」概念,
 *     补 格数上限 = 现有格数 会把老单的列钉死、连正常加格都点不动;空 = 不设上限才是兼容口径。
 * E3. 方案的检验类型**刻意不回填**(空 = 带入时回退按项目自己的「检验内容」分类,老数据行为不变)。 */

/* ============ F. 自检 ============ */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.bs_qc_plan', N'检验类型') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bs_qc_item', N'检验数量') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'格数上限') IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bs_qc_plan')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_qc_plan'), N'检验类型', 'ColumnId')
      AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bs_qc_item')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_qc_item'), N'检验数量', 'ColumnId')
      AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_detail'), N'格数上限', 'ColumnId')
      AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PLAN' AND col_name = N'检验类型') <> 1 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_ITEM' AND col_name = N'检验数量') <> 1 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'格数上限') <> 1 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PLAN' AND col_name = N'文件编码' AND visible = 1) <> 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'检验类型' AND locale = N'en') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'检验数量' AND locale = N'en') = 0 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'检验方案检验类型/检验数量迁移自检失败', 16, 1);
ELSE PRINT N'检验方案「检验类型」+ 项目「检验数量」就绪(3 列 / 中文注明 / yj_field / 10 语言译名)';
GO
