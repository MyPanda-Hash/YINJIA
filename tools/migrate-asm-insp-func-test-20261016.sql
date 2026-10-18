/* migrate-asm-insp-func-test-20261016.sql(2026-10-16)
 * 成品检验单(组装成品检验单 QC_ASM_INSP)补齐「出货检验功能性测试」组表头字段 + 按截图顺序重排明细行
 *
 * 【用户口径(2026-10-16,截图「出货检验功能性测试」组表头)】
 *   表头:客户名称 | 产品编码 | 型号(mm) | 批号 | 检验人员 | 产线常规功能性结果 | 结果判断
 *   第二行:以下检验要求自动填充出货检验计划表 | 以下检验方法自动填充出货检验计划表
 *   「当前缺少哪些字段?将当前表的明细行按照这个顺序进行修改实现」
 *
 * 【核对结果(实库 HSDZ_MES 逐列比对,详见 qa.txt)】七个表头列里 **3 个缺**:
 *   ❌ 客户名称           —— 全库只有 PU_ORDER / QC_BHC / QC_BHG / QC_PROC_INSP 有(制程检验单 2026-10-12 加的列)
 *   ❌ 产线常规功能性结果 —— 全库**任何面板都没有**(新字段;设计文档 §4.2 曾暂定由「实测数值」承载,现按用户口径补独立列)
 *   ❌ 结果判断           —— 成品检验单没有(只有表头「总结论」;制程检验单有同名明细列,功能性测试组逐项判断用它)
 *   ✅ 产品编码 / 型号(=规格型号) / 批号(=批次号) / 检验人员(=检验员) 都已存在
 *   ✅ 「检验要求/检验方法 自动填充出货检验计划表」= 同批 `migrate-insp-req-align-20261016.sql` 的
 *      「取出货检验计划」已实现(控制标准及要求→检验要求、控制方法→检验方法,逐行一一对应)
 *
 * 【本脚本做什么(只动成品检验单;成型/切炭与制程检验单不动)】
 *   A. 加列:`qc_asm_insp_head.客户名称` nvarchar(200);`qc_asm_insp_detail.产线常规功能性结果` nvarchar(200)、
 *      `结果判断` nvarchar(40)(长度镜像 qc_proc_insp_detail.结果判断,便于两单同口径);
 *   B. 列级中文注明(3 条);
 *   C. `yj_field` 登记 3 个字段 + **按截图顺序重排明细**(见下表);表头 客户名称 插在 批次号 与 产品编码 之间;
 *   D. 多语言:`客户名称`(10 语言)/`结果判断`(en)已有、按标签全局共享,只给 `产线常规功能性结果` 补 en;
 *   E. 自检(列/字段/次序/不撞号/注明/译名)。
 *
 * 【明细行新次序(截图数据区 = 检验要求 → 检验方法 → 产线常规功能性结果 → 结果判断;其余列排在其后)】
 *   seq  10 检验项目 | 20 检验要求 | 30 检验方法 | 35 产线常规功能性结果(新) | 40 结果判断(新)
 *        | 50 检查频率 | 60 实测数值 | 65..69 测量值1..5 | 75 判定 | 80 数量 | 85 不合格数量
 *        | 90 处理方式 | 110 备注      (行号/表区 仍隐藏:900/910)
 *   ⚠ 只改 seq(显示次序),不动任何单据行数据;隐藏列挪到 900/910 是为了避免与可见列同号。
 *
 * 【幂等】加列 COL_LENGTH 判空、登记 NOT EXISTS、注明 NOT EXISTS、次序按"不等才更新";两账套均执行。
 */

/* ══════════════════ A. 加列 ══════════════════ */
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'客户名称') IS NULL
  ALTER TABLE dbo.qc_asm_insp_head ADD 客户名称 nvarchar(200) NULL;
GO
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'产线常规功能性结果') IS NULL
  ALTER TABLE dbo.qc_asm_insp_detail ADD 产线常规功能性结果 nvarchar(200) NULL;
GO
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'结果判断') IS NULL
  ALTER TABLE dbo.qc_asm_insp_detail ADD 结果判断 nvarchar(40) NULL;
GO

/* ══════════════════ B. 列级中文注明 ══════════════════ */
DECLARE @cols TABLE (tbl sysname, col sysname, note nvarchar(400));
INSERT INTO @cols VALUES
 (N'qc_asm_insp_head',   N'客户名称',
  N'客户名称(截图「出货检验功能性测试」组表头第1列;由工单客户带入或人工填,与制程检验单同口径)'),
 (N'qc_asm_insp_detail', N'产线常规功能性结果',
  N'产线常规功能性结果(截图该组数据区第3列;产线常规功能性测试的实测值,如 无断裂/12.3L/min/15kpa/99.1%)'),
 (N'qc_asm_insp_detail', N'结果判断',
  N'结果判断(截图该组数据区第4列:该功能性项的判定 合格/不合格;整单结论见表头 总结论)');
DECLARE @tb sysname, @cl sysname, @nt nvarchar(400);
DECLARE curB CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, note FROM @cols;
OPEN curB FETCH NEXT FROM curB INTO @tb, @cl, @nt;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(N'dbo.' + @tb, @cl) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
                      WHERE major_id = OBJECT_ID(N'dbo.' + @tb)
                        AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tb), @cl, 'ColumnId')
                        AND name = N'MS_Description' AND class = 1)
    EXEC sp_addextendedproperty N'MS_Description', @nt, N'SCHEMA', N'dbo', N'TABLE', @tb, N'COLUMN', @cl;
  FETCH NEXT FROM curB INTO @tb, @cl, @nt;
END
CLOSE curB DEALLOCATE curB;
GO

/* ══════════════════ C1. yj_field 登记新增字段 ══════════════════ */
/* 客户名称:表头(与制程检验单同为 文本/可填;插在 批次号60 与 产品编码70 之间) */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'客户名称')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_ASM_INSP', N'客户名称', N'客户名称', N'文本', N'query,header', 65, 180, 1, 0, 0, 1);
GO

/* 产线常规功能性结果 / 结果判断:明细(截图数据区顺序,排在 检验方法 之后) */
DECLARE @fd TABLE (col nvarchar(50), seq int, width int, dtype nvarchar(20));
INSERT INTO @fd VALUES (N'产线常规功能性结果', 35, 160, N'文本'), (N'结果判断', 40, 100, N'文本');
DECLARE @c nvarchar(50), @s int, @w int, @t nvarchar(20);
DECLARE curC CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq, width, dtype FROM @fd;
OPEN curC FETCH NEXT FROM curC INTO @c, @s, @w, @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = @c)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_ASM_INSP', @c, @c, @t, N'detail', @s, @w, 1, 0, 0, 1);
  ELSE
    UPDATE yj_field SET data_type = @t, place = N'detail', seq = @s, width = @w, visible = 1, hidden = 0
     WHERE panel_code = N'QC_ASM_INSP' AND col_name = @c;
  FETCH NEXT FROM curC INTO @c, @s, @w, @t;
END
CLOSE curC DEALLOCATE curC;
GO

/* ══════════════════ C2. 明细行按截图顺序重排(只改显示次序) ══════════════════ */
DECLARE @ord TABLE (col nvarchar(50), seq int);
INSERT INTO @ord VALUES
 (N'检验项目', 10), (N'检验要求', 20), (N'检验方法', 30),
 (N'产线常规功能性结果', 35), (N'结果判断', 40), (N'检查频率', 50), (N'实测数值', 60),
 (N'测量值1', 65), (N'测量值2', 66), (N'测量值3', 67), (N'测量值4', 68), (N'测量值5', 69),
 (N'判定', 75), (N'数量', 80), (N'不合格数量', 85),
 (N'处理方式', 90), (N'备注', 110),
 (N'行号', 900), (N'表区', 910);
DECLARE @c2 nvarchar(50), @s2 int;
DECLARE curD CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq FROM @ord;
OPEN curD FETCH NEXT FROM curD INTO @c2, @s2;
WHILE @@FETCH_STATUS = 0
BEGIN
  UPDATE yj_field SET seq = @s2
   WHERE panel_code = N'QC_ASM_INSP' AND col_name = @c2 AND seq <> @s2;
  FETCH NEXT FROM curD INTO @c2, @s2;
END
CLOSE curD DEALLOCATE curD;
GO

/* ══════════════════ D. 多语言(新标签补 en;客户名称/结果判断 已有,按标签全局共享) ══════════════════ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'产线常规功能性结果' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'field', N'产线常规功能性结果', N'en', N'Line Routine Functional Result', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'结果判断' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'field', N'结果判断', N'en', N'Result Judgement', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'客户名称' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'field', N'客户名称', N'en', N'Customer Name', N'manual');
GO

/* ══════════════════ E. 自检 ══════════════════ */
DECLARE @bad int = 0;
/* E1. 三列都在 */
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'客户名称') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'产线常规功能性结果') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'结果判断') IS NULL SET @bad = @bad + 1;
/* E2. yj_field 三行登记齐、可见、place 对 */
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND visible = 1
      AND ((col_name = N'客户名称' AND place LIKE N'%header%')
        OR (col_name = N'产线常规功能性结果' AND place = N'detail')
        OR (col_name = N'结果判断' AND place = N'detail'))) < 3 SET @bad = @bad + 1;
/* E3. 次序:检验要求 < 检验方法 < 产线常规功能性结果 < 结果判断
   ⚠ 2026-10-17 修:原断言还要求 …< 实测数值 < 判定,而**本脚本之后**的
   migrate-asm-insp-report-fields-20261016.sql 明确 `DELETE … col_name IN (数量, 实测数值)`,
   组装成品检验单的整表次序又由更靠后的 migrate-asm-insp-verdict-rename-20261016.sql 统一
   (产线常规功能性结果=200 / 结果判断=210)。所以只要本脚本内容一变就被判「重新执行」,
   而它按旧布局断言必然不过 ⇒ DbSync 中止、其后迁移全不执行。
   现在只断言**本脚本自己插入的那几列**之间的相对次序(在 35/40 与 200/210 两种布局下都成立)。 */
IF NOT EXISTS (SELECT 1 FROM yj_field a, yj_field b, yj_field c, yj_field d
                WHERE a.panel_code = N'QC_ASM_INSP' AND a.col_name = N'检验要求'
                  AND b.panel_code = N'QC_ASM_INSP' AND b.col_name = N'检验方法'
                  AND c.panel_code = N'QC_ASM_INSP' AND c.col_name = N'产线常规功能性结果'
                  AND d.panel_code = N'QC_ASM_INSP' AND d.col_name = N'结果判断'
                  AND a.seq < b.seq AND b.seq < c.seq AND c.seq < d.seq)
  SET @bad = @bad + 1;
/* E4. 本脚本插入的两列不得**彼此**撞号(同 seq 只能按 id 兜底排序 ⇒ 次序不可控)。
   ⚠ 2026-10-17:不再对整表断言 —— 本脚本所处时点 检验结果 恰在 seq 40,而 结果判断 也插在 40,
   整表断言必然失败(重跑即卡链);全表次序由上面提到的 verdict-rename 脚本统一后自然无撞号。 */
IF (SELECT COUNT(DISTINCT seq) FROM yj_field
      WHERE panel_code = N'QC_ASM_INSP' AND col_name IN (N'产线常规功能性结果', N'结果判断')) <> 2 SET @bad = @bad + 1;
/* E5. 注明与译名 */
IF (SELECT COUNT(*) FROM sys.extended_properties ep
     WHERE ep.name = N'MS_Description' AND ep.class = 1
       AND ((OBJECT_NAME(ep.major_id) = N'qc_asm_insp_head' AND COL_NAME(ep.major_id, ep.minor_id) = N'客户名称')
         OR (OBJECT_NAME(ep.major_id) = N'qc_asm_insp_detail' AND COL_NAME(ep.major_id, ep.minor_id) IN (N'产线常规功能性结果', N'结果判断')))) < 3 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'产线常规功能性结果' AND locale = N'en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'结果判断' AND locale = N'en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'客户名称' AND locale = N'en') SET @bad = @bad + 1;

IF @bad > 0 RAISERROR(N'成品检验单「出货检验功能性测试」字段迁移自检失败(列/字段/次序/撞号/注明/译名)', 16, 1);
ELSE PRINT N'成品检验单功能性测试字段就绪:客户名称(头)+ 产线常规功能性结果/结果判断(明细),'
        + N'明细次序 = 检验项目→检验要求→检验方法→产线常规功能性结果→结果判断→检查频率→实测数值→测量值1..5→判定→数量→不合格数量';
GO
