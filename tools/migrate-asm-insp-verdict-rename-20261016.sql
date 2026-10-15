/* migrate-asm-insp-verdict-rename-20261016.sql(2026-10-16)
 * 成品检验单:①「判定」正名「结果判断」(两者本就是同一个字段)②明细次序按用户口径再排
 *
 * 【用户口径(2026-10-16,截图底部黄框 = 实测数值 + 测量值1..5)】
 *   「当前排序处理将这些挪到产线处理结果处,当前判定字段其实就是结果判断字段,将当前的判定字段名称修改,
 *     两个带有结果的字段挪到最后面的位置」
 *   ⇒ (a) 实测数值 + 测量值1..5 挪到原「产线常规功能性结果」所在的位置(检验方法之后);
 *      (b) 「判定」就是「结果判断」⇒ 把 判定 **改名** 成 结果判断(撤掉上一批多加的重复列);
 *      (c) 两个名字里带"结果"的字段(产线常规功能性结果 / 结果判断)排到最后。
 *
 * 【为什么这么做(而不是留两列)】
 *   上一批 `migrate-asm-insp-func-test-20261016.sql` 按截图补了「结果判断」列,但**本单原本就有「判定」**
 *   且语义完全相同(都是该行的 合格/不合格;数量判定行也在用它)。同一张单上留两个同义列 = 品质填哪个都能过、
 *   报表/取数要写两遍 ⇒ 按用户口径收敛成**一列**,名字用计划表/截图里的「结果判断」。
 *   物理列改名走 sp_rename(数据随列走,不动任何行值);**改名三处同步**只落两处(物理列 + yj_field)——
 *   探针实测**无视图**引用 qc_asm_insp_detail。
 *
 * 【数据安全】上一批加的「结果判断」列若已有值(测试账套有 3 行,出自我自己的一次性探针单),
 *   先 `判定 = 结果判断 WHERE 判定 IS NULL` **并回** 判定,再删该列;末尾用临时表比对
 *   行数与有值行数,**证明没丢一行、没丢一个值**。
 * 【不动】成型/切炭/制程检验单(它们的「判定」保留原名);制程检验单的「结果判断」原样不动。
 * 【幂等】合并/删除/改名/注明/次序全部带存在性守卫;两账套(先正式后测试)均执行。
 */

/* ══════════════════ A. 改名前的盘点 + 值合并(防丢数据) ══════════════════
   ⚠ 必须是「首次执行才盘点旧列」:上一批的改名一旦跑过,判定 列就没了,再 SELECT 它会报列名无效。 */
IF OBJECT_ID('tempdb..#vd') IS NOT NULL DROP TABLE #vd;
/* ⚠ 两个坑都在这一批:
   ① 同一批次里写两处 `SELECT ... INTO #vd`(哪怕 IF/ELSE 各一处)编译期就报 "already an object named '#vd'"
      —— T-SQL 两个分支都会编译 ⇒ 先显式 CREATE TABLE 再 INSERT;
   ② **列名是编译期解析的**:改名跑过之后,`判定` 这个列已不存在,IF 分支里再写 `SUM(CASE WHEN 判定 ...)`
      照样编译报 "Invalid column name" ⇒ 引用旧列的语句必须走 EXEC(动态 SQL)。
   (#临时表在同一会话的动态 SQL 里可见,故 EXEC 里能往 #vd 插。) */
CREATE TABLE #vd (rows_before int, verdict_before int);
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'判定') IS NOT NULL
BEGIN
  /* 首次:记下改名前的行数 + 「判定」有值行数 */
  EXEC(N'INSERT INTO #vd (rows_before, verdict_before)
         SELECT COUNT(*), SUM(CASE WHEN 判定 IS NOT NULL THEN 1 ELSE 0 END) FROM dbo.qc_asm_insp_detail;');
  /* 再把上一批多加的 结果判断 列里没搬走的值并回(只补 判定 为空的,不覆盖已有值) */
  IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'结果判断') IS NOT NULL
    EXEC(N'UPDATE dbo.qc_asm_insp_detail SET 判定 = 结果判断 WHERE 判定 IS NULL AND 结果判断 IS NOT NULL;');
END
ELSE
BEGIN
  /* 重跑(已改过名):以现状为基线,末尾自检照样成立 */
  INSERT INTO #vd (rows_before, verdict_before)
  SELECT COUNT(*), SUM(CASE WHEN 结果判断 IS NOT NULL THEN 1 ELSE 0 END) FROM dbo.qc_asm_insp_detail;
END
GO

/* ══════════════════ B. 撤掉重复列(b 与 c 没有同名字段才能改名,故先删再改) ══════════════════ */
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'结果判断') IS NOT NULL
   AND COL_LENGTH(N'dbo.qc_asm_insp_detail', N'判定') IS NOT NULL
BEGIN
  DELETE FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'结果判断';
  ALTER TABLE dbo.qc_asm_insp_detail DROP COLUMN 结果判断;   /* 列级注明随列一起消失 */
  PRINT N'[OK] 撤掉上一批多加的重复列 qc_asm_insp_detail.结果判断(值已并回 判定)';
END
ELSE PRINT N'[SKIP] 无重复的 结果判断 列(已收敛或本就没有)';
GO

/* ══════════════════ C. 物理列改名:判定 → 结果判断 ══════════════════ */
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'结果判断') IS NULL
   AND COL_LENGTH(N'dbo.qc_asm_insp_detail', N'判定') IS NOT NULL
BEGIN
  EXEC sp_rename N'dbo.qc_asm_insp_detail.判定', N'结果判断', N'COLUMN';
  PRINT N'[OK] qc_asm_insp_detail.判定 → 结果判断';
END
ELSE PRINT N'[SKIP] 判定 改名(已是 结果判断 或无 判定 列)';
GO

/* yj_field 同步改名:col_name 与 label 一起(前端数据键=label,物理列=col_name,必须同名)。
   data_type 由 多行文本 收敛为 文本 —— 与制程检验单同名字段(结果判断)一致(值就是 合格/不合格)。 */
UPDATE yj_field SET col_name = N'结果判断', label = N'结果判断', data_type = N'文本'
 WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'判定';
PRINT N'[OK] yj_field 改名行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ══════════════════ D. 列级注明(改名列写清新语义;产线常规功能性结果 保留原注明) ══════════════════
   ⚠ sp_addextendedproperty/sp_updateextendedproperty 的参数**必须是字面量或变量,不能写表达式**
   (写成 N'甲'+N'乙' 会报 `Incorrect syntax near '+'`)—— 故先把长注释拼进变量再 EXEC。 */
DECLARE @cmt nvarchar(400) = N'结果判断(该行判定:合格/不合格。原名「判定」,2026-10-16 按截图/出货检验计划表用词正名;'
  + N'功能性测试组即「该功能性项的结果判断」,数量判定行也用它;整单结论仍见表头 总结论)';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.qc_asm_insp_detail')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_detail'), N'结果判断', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_detail', N'COLUMN', N'结果判断';
ELSE
  EXEC sp_updateextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_detail', N'COLUMN', N'结果判断';
GO

/* ══════════════════ E. 明细次序(用户口径:实测值上移、两个"结果"字段殿后) ══════════════════
   检验项目10 | 检验要求20 | 检验方法30 | 实测数值40 | 测量值1..5 45..49 | 检查频率55
   | 数量60 | 不合格数量65 | 处理方式90 | 备注110 | 产线常规功能性结果200 | 结果判断210
   (行号/表区 仍隐藏:900/910) */
DECLARE @ord TABLE (col nvarchar(50), seq int);
INSERT INTO @ord VALUES
 (N'检验项目', 10), (N'检验要求', 20), (N'检验方法', 30),
 (N'实测数值', 40), (N'测量值1', 45), (N'测量值2', 46), (N'测量值3', 47), (N'测量值4', 48), (N'测量值5', 49),
 (N'检查频率', 55), (N'数量', 60), (N'不合格数量', 65),
 (N'处理方式', 90), (N'备注', 110),
 (N'产线常规功能性结果', 200), (N'结果判断', 210),
 (N'行号', 900), (N'表区', 910);
DECLARE @c nvarchar(50), @s int;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq FROM @ord;
OPEN cur FETCH NEXT FROM cur INTO @c, @s;
WHILE @@FETCH_STATUS = 0
BEGIN
  UPDATE yj_field SET seq = @s WHERE panel_code = N'QC_ASM_INSP' AND col_name = @c AND seq <> @s;
  FETCH NEXT FROM cur INTO @c, @s;
END
CLOSE cur DEALLOCATE cur;
GO

/* ══════════════════ F. 自检 ══════════════════ */
DECLARE @bad int = 0, @r int, @v int;
/* F1. 列:结果判断 在、判定 不在 */
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'结果判断') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'判定') IS NOT NULL SET @bad = @bad + 1;
/* F2. 数据守恒:总行数不变;有值行数 ≥ 改名前的有值行数(合并只会补不会丢) */
SELECT @r = rows_before, @v = verdict_before FROM #vd;
IF (SELECT COUNT(*) FROM dbo.qc_asm_insp_detail) <> @r SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM dbo.qc_asm_insp_detail WHERE 结果判断 IS NOT NULL) < @v SET @bad = @bad + 1;
/* F3. yj_field:结果判断 一行(detail/可见/文本)、无 判定 行 */
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'结果判断'
      AND place = N'detail' AND visible = 1 AND hidden = 0) <> 1 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'判定') SET @bad = @bad + 1;
/* F4. 次序:按规范序列断言相邻两段 seq 递增,**只对当前仍存在的字段**断言
   ⚠ 2026-10-17 修:原断言写死要求 实测数值/数量 参与,而链上更靠后的
   migrate-asm-insp-report-fields-20261016.sql(清单 L3514 > 本脚本 L3411)明确
   `DELETE FROM yj_field WHERE panel_code='QC_ASM_INSP' AND col_name IN (数量, 实测数值)`。
   本脚本内容一变就会被 DbSync 判「重新执行」,写死 ⇒ 必然 FAIL ⇒ 中止 ⇒ 其后迁移全不执行。 */
DECLARE @ord TABLE (k int, col sysname);
INSERT INTO @ord VALUES (1, N'检验项目'), (2, N'检验要求'), (3, N'检验方法'), (4, N'实测数值'),
                        (5, N'测量值1'), (6, N'测量值5'), (7, N'检查频率'), (8, N'数量'),
                        (9, N'处理方式'), (10, N'备注'), (11, N'产线常规功能性结果'), (12, N'结果判断');
DELETE o FROM @ord o
 WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = N'QC_ASM_INSP' AND f.col_name = o.col);
IF EXISTS (SELECT 1
             FROM @ord x
             JOIN @ord y ON y.k > x.k
                       AND NOT EXISTS (SELECT 1 FROM @ord m WHERE m.k > x.k AND m.k < y.k)
             JOIN yj_field fx ON fx.panel_code = N'QC_ASM_INSP' AND fx.col_name = x.col
             JOIN yj_field fy ON fy.panel_code = N'QC_ASM_INSP' AND fy.col_name = y.col
            WHERE fx.seq >= fy.seq) SET @bad = @bad + 1;
/* F5. 明细可见列不撞号 */
IF EXISTS (SELECT 1 FROM yj_field x JOIN yj_field y
             ON y.panel_code = x.panel_code AND y.seq = x.seq AND y.id <> x.id
            WHERE x.panel_code = N'QC_ASM_INSP' AND x.visible = 1 AND x.place LIKE N'%detail%'
              AND y.visible = 1 AND y.place LIKE N'%detail%') SET @bad = @bad + 1;
/* F6. 注明 + 译名 */
IF (SELECT COUNT(*) FROM sys.extended_properties ep
     WHERE ep.major_id = OBJECT_ID(N'dbo.qc_asm_insp_detail')
       AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_detail'), N'结果判断', 'ColumnId')
       AND ep.name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'结果判断' AND locale = N'en') SET @bad = @bad + 1;

IF @bad > 0 RAISERROR(N'成品检验单「判定→结果判断」改名/重排自检失败(列/数据守恒/字段/次序/撞号/注明/译名)', 16, 1);
ELSE PRINT N'成品检验单明细就绪:判定→结果判断(物理列+yj_field),次序 = 检验项目→检验要求→检验方法→实测数值→测量值1..5→检查频率→数量→不合格数量→处理方式→备注→产线常规功能性结果→结果判断';
GO
