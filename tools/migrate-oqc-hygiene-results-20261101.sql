/* migrate-oqc-hygiene-results-20261101.sql(2026-11-01):出厂检验报告 —— 卫生安全 15 项「结果」可填写
 *
 * 用户口径(2026-11-01 08:42,截图红框圈住卫生安全表的「结果」整列):
 *   「这些红框内容要能填写」
 *   ⇒ 卫生安全 15 行(浑浊度/臭和味/肉眼可见物/PH/溶解性总固体/耗氧量/砷/铬/铝/铅/汞/铁/锰/铜/锌)
 *     的「结果」列由静态文字「见型式检验报告」改为**手填**并随报告落库;
 *     纸面(前端 QcOqcSheet.vue)可直接填,打印与「导出报表 → PDF」把填写的值印出来。
 *   (此前设计 Q5/Q8 的口径是「卫生安全页本轮不录数,版面印见型式检验报告」——本轮按用户新口径放开填写。)
 *
 * 实现:15 个可空文本列,列名 = `卫生_<项目名>`(与受控表单项目一一对应)。
 *   · 不做行表:卫生安全是**固定 15 项**的受控表格,行长固定、每项只有一列结果 ⇒ 放头表最直接,
 *     也与「一份报告=一个产品」的单头语义一致(行表是动态检验项目,不是固定表单项)。
 *   · 列值自由文本(如 0.12 / 无 / ND / ≤0.001),空 = 未录(纸面留空,不再印「见型式检验报告」)。
 *
 * 规范:新增列写列级 MS_Description 中文注明(全量部署规范);
 *       yj_field 登记 15 行(hidden=1 ⇒ 不进旧的表头卡片/明细表格,但**必须登记**:
 *         QueryService 取数、ButtonService 保存、报表参数下发都按 yj_field 走);
 *       yj_translation 补 15 条 en 字段译名(AGENTS.md 强制,其余语言由机翻管线按需补齐);
 *       老报告这 15 列为 NULL ⇒ 纸面留空,行为与「未录」一致。
 * 幂等:COL_LENGTH 判列、NOT EXISTS 判 yj_field/yj_translation/注明;可重复执行(两账套:先正式后测试)。
 * ⚠ docs/development/数据库表清单.md 目前**尚未收录** qc_oqc_* 三张表(该文档最后整份重生成于
 *   2026-10-18,之后新增表按仓库惯例手写维护记录、不整份重跑生成器以免覆盖手写 v3.x 记录),故本脚本
 *   不做清单刷新;表/列实况以 sys.columns 为准。
 */

/* ============ A. qc_oqc_head 加 15 个「卫生安全-项目 结果」列 ============ */
DECLARE @hy TABLE (col sysname, note nvarchar(400));
INSERT INTO @hy (col, note) VALUES
 (N'卫生_浑浊度',       N'卫生安全-浑浊度 结果(手填,如 0.12;空=未录)'),
 (N'卫生_臭和味',       N'卫生安全-臭和味 结果(手填,如 无;空=未录)'),
 (N'卫生_肉眼可见物',   N'卫生安全-肉眼可见物 结果(手填,如 无;空=未录)'),
 (N'卫生_PH',           N'卫生安全-PH 改变量 结果(手填,如 1.79;空=未录)'),
 (N'卫生_溶解性总固体', N'卫生安全-溶解性总固体 结果(手填,如 20;空=未录)'),
 (N'卫生_耗氧量',       N'卫生安全-耗氧量(以O2计) 结果(手填,如 0.46;空=未录)'),
 (N'卫生_砷',           N'卫生安全-砷 结果(手填,如 ND;空=未录)'),
 (N'卫生_铬',           N'卫生安全-铬 结果(手填,如 ND;空=未录)'),
 (N'卫生_铝',           N'卫生安全-铝 结果(手填,如 ND;空=未录)'),
 (N'卫生_铅',           N'卫生安全-铅 结果(手填,如 ND;空=未录)'),
 (N'卫生_汞',           N'卫生安全-汞 结果(手填,如 ND;空=未录)'),
 (N'卫生_铁',           N'卫生安全-铁 结果(手填,如 ND;空=未录)'),
 (N'卫生_锰',           N'卫生安全-锰 结果(手填,如 ND;空=未录)'),
 (N'卫生_铜',           N'卫生安全-铜 结果(手填,如 ND;空=未录)'),
 (N'卫生_锌',           N'卫生安全-锌 结果(手填,如 ND;空=未录)');

DECLARE @hc sysname, @hn nvarchar(400);
DECLARE curh CURSOR LOCAL FAST_FORWARD FOR SELECT col, note FROM @hy;
OPEN curh FETCH NEXT FROM curh INTO @hc, @hn;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(N'dbo.qc_oqc_head', @hc) IS NULL
  BEGIN
    EXEC(N'ALTER TABLE dbo.qc_oqc_head ADD [' + @hc + N'] nvarchar(50) NULL');
    PRINT N'[OK] qc_oqc_head +列 ' + @hc;
  END
  ELSE PRINT N'[SKIP] qc_oqc_head 列已存在 ' + @hc;

  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                 WHERE major_id = OBJECT_ID(N'dbo.qc_oqc_head')
                   AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_oqc_head'), @hc, 'ColumnId')
                   AND name = N'MS_Description' AND class = 1)
    EXEC sp_addextendedproperty N'MS_Description', @hn, N'SCHEMA', N'dbo', N'TABLE', N'qc_oqc_head', N'COLUMN', @hc;

  FETCH NEXT FROM curh INTO @hc, @hn;
END
CLOSE curh DEALLOCATE curh;
GO

/* ============ B. yj_field 登记(15 个隐藏头字段)+ en 译名 ============ */
DECLARE @hf TABLE (col nvarchar(50), seq int, en nvarchar(100));
INSERT INTO @hf (col, seq, en) VALUES
 (N'卫生_浑浊度',       170, N'Hygiene: Turbidity'),
 (N'卫生_臭和味',       171, N'Hygiene: Odor and Taste'),
 (N'卫生_肉眼可见物',   172, N'Hygiene: Visible Matter'),
 (N'卫生_PH',           173, N'Hygiene: pH'),
 (N'卫生_溶解性总固体', 174, N'Hygiene: Total Dissolved Solids'),
 (N'卫生_耗氧量',       175, N'Hygiene: Oxygen Consumption'),
 (N'卫生_砷',           176, N'Hygiene: Arsenic'),
 (N'卫生_铬',           177, N'Hygiene: Chromium'),
 (N'卫生_铝',           178, N'Hygiene: Aluminum'),
 (N'卫生_铅',           179, N'Hygiene: Lead'),
 (N'卫生_汞',           180, N'Hygiene: Mercury'),
 (N'卫生_铁',           181, N'Hygiene: Iron'),
 (N'卫生_锰',           182, N'Hygiene: Manganese'),
 (N'卫生_铜',           183, N'Hygiene: Copper'),
 (N'卫生_锌',           184, N'Hygiene: Zinc');

DECLARE @fc nvarchar(50), @fs int, @fe nvarchar(100);
DECLARE curf CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq, en FROM @hf;
OPEN curf FETCH NEXT FROM curf INTO @fc, @fs, @fe;
WHILE @@FETCH_STATUS = 0
BEGIN
  /* hidden=1 / visible=0:不进旧表头卡片与明细表格(本面板已改纸张式,列只作取数+保存+报表参数用) */
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_OQC_REPORT' AND col_name = @fc)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_OQC_REPORT', @fc, @fc, N'文本', N'header', @fs, 90, 1, 0, 1, 0);

  IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = @fc AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @fc, N'en', @fe, N'manual');

  FETCH NEXT FROM curf INTO @fc, @fs, @fe;
END
CLOSE curf DEALLOCATE curf;
GO

/* ============ C. 自检 ============ */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_浑浊度') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_臭和味') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_肉眼可见物') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_PH') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_溶解性总固体') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_耗氧量') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_砷') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_铬') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_铝') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_铅') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_汞') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_铁') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_锰') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_铜') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'卫生_锌') IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_OQC_REPORT' AND col_name LIKE N'卫生[_]%') < 15 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key LIKE N'卫生[_]%' AND locale = N'en') < 15 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties
    WHERE major_id = OBJECT_ID(N'dbo.qc_oqc_head') AND name = N'MS_Description'
      AND minor_id IN (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.qc_oqc_head') AND name LIKE N'卫生[_]%')) < 15 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'出厂检验报告卫生安全结果列迁移自检失败(缺列/缺 yj_field/缺译名/缺注明)', 16, 1);
ELSE PRINT N'出厂检验报告卫生安全 15 项结果列就绪(qc_oqc_head / yj_field / yj_translation)';
GO
