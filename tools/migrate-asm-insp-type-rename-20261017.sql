/* migrate-asm-insp-type-rename-20261017.sql(2026-10-17)
 * 组装成品检验单(QC_ASM_INSP):明细行的「表区」正名为「检验类型」,并提到明细**第一列**(可见可填)
 *
 * 【用户口径(2026-10-17)】
 *   「去除当前这个实现方式,直接使用明细行实现进行吧……将当前的表区修改为检验类型更加直观明显,
 *     将检验类型放在明细行第一列,进行区分。」
 *   背景:上一批(2026-10-16)为了「三区固定铺出」把类别做成了**分区块渲染**(A.外观 / B.尺寸 /
 *   C.出货重量 三块表),数据模型仍是「一行 = 一个检验项目 + 一个类别值」;用户拍板**去掉分区呈现**,
 *   直接把类别亮成明细行的一列 —— 于是这一列需要一个说人话的名字:「检验类型」。
 *
 * 【为什么连物理列一起改名(而不是只改 label / alias)】
 *   本库的契约是「数据键 = yj_field.label = 物理列名」(QueryService 按 labelToCol() 双向映射)。
 *   只改 label 会让 label 与 col_name 长期分家;只改 alias(纯显示别名)则**不参与翻译**
 *   (PanelConfigService.buildGridColumns:foreign locale 下 alias 优先于译名 ⇒ 英语界面会露出中文
 *   「检验类型」),违反多语言规范。故按用户拍板走**真改名**:物理列 + yj_field 两处同名,
 *   数据键随之为「检验类型」(中文键,永不变形)。
 *
 * 【数据安全】sp_rename 只换列名,数据随列走(不动任何行值);脚本首尾用临时表比对
 *   「总行数」与「有值行数」,证明没丢一行、没丢一个值。
 *
 * 【谁跟着一起改(改名三处同步)】
 *   ① 物理列 qc_asm_insp_detail.表区 → 检验类型;
 *   ② yj_field 同名行(col_name/label)并置 seq=5(第一列)/可见/可填;
 *   ③ 代码:QcAsmInspReportSupport(报表按类别归组)、QcInspPlanController.fromShipPlan(下发的类别键)、
 *      PanelxList(带入链路按本面板的类别键写值)、ButtonService 生单预铺 —— 同批改,见各文件注释。
 *   探针实测**无视图/存储过程**引用 qc_asm_insp_detail(2026-10-17 取证),故无需改库内对象。
 *
 * 【不动】成型/切炭/制程/首件四张检验单的「表区」原样保留(它们的类别仍是分区/横表的分组键,
 *   界面也没有「检验类型」这一列);QC_INSP/QC_PLAN 的「检验类型」是另一码事(全检/抽检/免检),
 *   同名不同义、各表各用,本脚本不碰。
 *
 * 【幂等】改名/次序/注明全部带存在性守卫,重复执行只做收敛;两账套(先正式后测试)均执行。
 */

SET NOCOUNT ON;

/* ══════════════════ A. 改名前的基线盘点(数据守恒的比对基准) ══════════════════
   ⚠ 列名是**编译期**解析的:改名跑过之后再写 `SELECT ... 表区 ...` 会报「列名无效」,
     故引用旧列的语句必须走 EXEC(动态 SQL)。#临时表在同一会话的动态 SQL 里可见。 */
IF OBJECT_ID('tempdb..#asmtype') IS NOT NULL DROP TABLE #asmtype;
CREATE TABLE #asmtype (rows_before int, area_before int);
/* ⚠ 两个分支都必须走动态 SQL:IF/ELSE 的**两个分支都会编译**,而此刻「检验类型」这一列还不存在
   (还没改名)⇒ 直接写 `SUM(CASE WHEN 检验类型 ...)` 会在编译期报 "Invalid column name"。
   (2026-10-17 实测踩到;同款坑见 migrate-asm-insp-verdict-rename-20261016.sql 头注。) */
DECLARE @base nvarchar(400);
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'表区') IS NOT NULL
  SET @base = N'INSERT INTO #asmtype (rows_before, area_before)
                SELECT COUNT(*), SUM(CASE WHEN 表区 IS NOT NULL THEN 1 ELSE 0 END) FROM dbo.qc_asm_insp_detail;';
ELSE
  SET @base = N'INSERT INTO #asmtype (rows_before, area_before)
                SELECT COUNT(*), SUM(CASE WHEN 检验类型 IS NOT NULL THEN 1 ELSE 0 END) FROM dbo.qc_asm_insp_detail;';
EXEC(@base);
GO

/* ══════════════════ B. 物理列改名:表区 → 检验类型 ══════════════════ */
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'表区') IS NOT NULL
   AND COL_LENGTH(N'dbo.qc_asm_insp_detail', N'检验类型') IS NULL
BEGIN
  EXEC sp_rename N'dbo.qc_asm_insp_detail.表区', N'检验类型', N'COLUMN';
  PRINT N'[OK] qc_asm_insp_detail.表区 → 检验类型';
END
ELSE IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'检验类型') IS NOT NULL
  PRINT N'[SKIP] 物理列已是 检验类型(重跑)';
GO

/* ══════════════════ C. yj_field 正名 + 提到明细第一列 + 可见可填 ══════════════════
   ① 正名:col_name 与 label 一起改(前端数据键 = label,物理列 = col_name,必须同名);
   ② seq = 5:明细可见列最小 seq 是 检验项目 10 ⇒ 它是**第一列**(用户口径「放在明细行第一列」);
   ③ visible=1/hidden=0:从隐藏列变成给人看、给人填的列;
   ④ editable=1:手工新增的行也能自己标类别(带去入的行由计划/标准写值);
   ⑤ alias=NULL:不留旧显示别名(旧行本来也没设)。 */
UPDATE yj_field
   SET col_name = N'检验类型', label = N'检验类型',
       seq = 5, visible = 1, hidden = 0, editable = 1, alias = NULL
 WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'表区';
PRINT N'[OK] yj_field 正名(表区→检验类型)行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* 重跑:只把次序与可见性收敛到位(幂等,不覆盖 data_type 等人工调整) */
UPDATE yj_field
   SET seq = 5, visible = 1, hidden = 0, editable = 1, alias = NULL
 WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'检验类型'
   AND (seq <> 5 OR visible = 0 OR hidden = 1 OR editable = 0 OR alias IS NOT NULL);
PRINT N'[OK] yj_field 收敛(置首/可见/可填)行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ══════════════════ D. 列级中文注明(改名后写清新语义) ══════════════════
   ⚠ sp_addextendedproperty/sp_updateextendedproperty 的参数**必须是字面量或变量**(不能写表达式),
     故先把长注释拼进变量再 EXEC。 */
DECLARE @cmt nvarchar(400) = N'检验类型(明细行所属的检验类别:外观 / 尺寸 / 出货重量 …,来源=出货检验计划表 '
  + N'RD_INSP_PLAN.检验内容;原名「表区」,2026-10-17 按用户口径正名并提到明细第一列。它同时是打印分组键:'
  + N'组装成品检验记录表(qc_asm_insp)按它把检验项目归到 外观/尺寸/重量 各段)';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.qc_asm_insp_detail')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_detail'), N'检验类型', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_detail', N'COLUMN', N'检验类型';
ELSE
  EXEC sp_updateextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_detail', N'COLUMN', N'检验类型';
PRINT N'[OK] qc_asm_insp_detail.检验类型 列级注明已写入';
GO

/* ══════════════════ E. 自检 ══════════════════ */
DECLARE @bad int = 0, @r int, @a int;
/* E1. 物理列:检验类型 在、表区 不在 */
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'检验类型') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'表区') IS NOT NULL SET @bad = @bad + 1;
/* E2. 数据守恒:总行数不变、有值行数不减少 */
SELECT @r = rows_before, @a = area_before FROM #asmtype;
IF (SELECT COUNT(*) FROM dbo.qc_asm_insp_detail) <> @r SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM dbo.qc_asm_insp_detail WHERE 检验类型 IS NOT NULL) < @a SET @bad = @bad + 1;
/* E3. yj_field:恰有一行 检验类型(detail/可见/可填),且不再有 表区 行 */
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'检验类型'
      AND label = N'检验类型' AND place = N'detail' AND visible = 1 AND hidden = 0 AND editable = 1) <> 1 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND (col_name = N'表区' OR label = N'表区')) SET @bad = @bad + 1;
/* E4. 它是明细第一列:没有别的可见明细列 seq 更靠前或并列 */
IF EXISTS (SELECT 1 FROM yj_field f
            WHERE f.panel_code = N'QC_ASM_INSP' AND f.visible = 1 AND f.hidden = 0 AND f.place LIKE N'%detail%'
              AND f.col_name <> N'检验类型'
              AND f.seq <= (SELECT TOP 1 seq FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'检验类型'))
  SET @bad = @bad + 1;
/* E5. 明细可见列不撞号 */
IF EXISTS (SELECT 1 FROM yj_field x JOIN yj_field y
             ON y.panel_code = x.panel_code AND y.seq = x.seq AND y.id <> x.id
            WHERE x.panel_code = N'QC_ASM_INSP' AND x.visible = 1 AND x.place LIKE N'%detail%'
              AND y.visible = 1 AND y.place LIKE N'%detail%') SET @bad = @bad + 1;
/* E6. 其它面板的 表区 必须原样(本次只动成品检验单) */
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code <> N'QC_ASM_INSP' AND col_name = N'表区') < 1 SET @bad = @bad + 1;
/* E7. 注明 + 译名(译名按标签全局共享,QC_INSP 早已落库 ⇒ 只校验存在) */
IF (SELECT COUNT(*) FROM sys.extended_properties ep
     WHERE ep.major_id = OBJECT_ID(N'dbo.qc_asm_insp_detail')
       AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_detail'), N'检验类型', 'ColumnId')
       AND ep.name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检验类型' AND locale = N'en') SET @bad = @bad + 1;

IF @bad > 0 RAISERROR(N'成品检验单「表区→检验类型」正名自检失败(物理列/数据守恒/字段/首列/撞号/注明/译名)', 16, 1);
ELSE PRINT N'成品检验单明细就绪:表区 → 检验类型(物理列 + yj_field 同名),已置于明细第一列(seq 5、可见可填);'
         + N'其它四张检验单的「表区」原样未动';
GO
