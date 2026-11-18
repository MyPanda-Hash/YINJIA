/* ============================================================================
 * migrate-qc-insp-rec-resultcols-20261119.sql —— 检验报告「检测结果」改为**可增删列**
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-19):「检验结果改成可以新增列的形式，不要固定5格了。」
 *   2026-11-11 那版是**固定五格**(结果1..结果5,`migrate-qc-insp-rec-result5-20261111.sql`);
 *   现在要能按实际抽样件数**加列/减列**(默认仍是 5 列,向上可加到 MAX_RESULT_COLS=20),
 *   减列时清空被减那一列已填的值。
 *
 * 本脚本(幂等;两账套均执行):
 *   ① `qc_insp_rec_detail` 补 `结果6..结果20` nvarchar(200) NULL + 逐列中文注明
 *      (结果1..结果5 已在上一个迁移里建好,这里只叠加);
 *   ② `qc_insp_rec` 加 `结果列数` int NULL + 中文注明 —— **每张单据自己的列数**
 *      (用户口径是"可以新增列",不是全局改宽:同一张纸 5 件抽样、另一张 10 件抽样是常态);
 *   ③ `yj_field` 登记:
 *      · 结果1..结果20(place=detail,seq 31..50)**全部按可见列登记** ——
 *        理由见下面 [可见性] 注释:隐藏列的"清空"落不了库;
 *      · 单项判定 seq 40 → **60**(给 结果6..20 让位,保持"结果在判定之前"的纸面次序);
 *      · 结果列数(place=header,visible=0/hidden=1,**不出现在任何界面**,
 *        只做计数载体 —— 与研发数据记录表的「样品数」同型:计数存头字段);
 *   ④ 存量单据回填 `结果列数 = 5`(只填空值,幂等);
 *   ⑤ 译名:结果6..结果20 + 结果列数 的 en / ja / ko / zh-TW(显示层;数据键永远中文,ADR-0001);
 *   ⑥ 自检:列在、yj_field 在、单项判定已挪到 60、结果列数已登记,不满足即 RAISERROR。
 *
 * [可见性] 为什么 结果6..结果20 要 visible=1 / hidden=0(不能像历史列那样藏起来):
 *   保存链 `ButtonService.labelsToCols(fields, row, keepClearedAsNull=true)` 对
 *   **hidden 或 visible=0** 的字段只接受"有值就写",空值一律跳过(见该方法的 2026-11-13 红线注释)。
 *   这些列是用户会真的填/真的清空的格子,若登记成隐藏列,
 *   就会出现 2026-11-06 那个已修过的老毛病 ——「把格子删成空,保存后又变回原值」。
 *   代价只是:本面板的明细在任何"按可见列铺列"的消费端都会多出空列,
 *   而 QC_INSP_REC 的纸面走 QcInspRecSheet(按常量渲染),明细表走 QC_INSP_REC_DETAIL
 *   (另一套 yj_field,只有 23 个抬头类字段,不含 结果N),两边都不受影响。
 *
 * 配套代码(同提交):
 *   · frontend/src/core/qc/qcInspRecColumns.js —— QC_INSP_REC_RESULT_KEYS(1..20)/
 *     MAX·DEFAULT·MIN、计数键 QC_INSP_REC_RESULT_COUNT_KEY、列定义/导出;
 *   · frontend/src/core/views/QcInspRecSheet.vue —— 分区条「检测结果列 － n ＋」步进器、
 *     表头 colspan 跟着列数走、宽列横向滚动、减列清空被减列;
 *   · 不带后端改动:取数/落库都走 yj_field,登记即可。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 补 结果6..结果20 ---------- */
DECLARE @i int = 6, @col nvarchar(20), @sql nvarchar(400);
WHILE @i <= 20
BEGIN
    SET @col = N'结果' + CAST(@i AS nvarchar(10));
    IF COL_LENGTH(N'dbo.qc_insp_rec_detail', @col) IS NULL
    BEGIN
        SET @sql = N'ALTER TABLE dbo.qc_insp_rec_detail ADD [' + @col + N'] nvarchar(200) NULL;';
        EXEC sp_executesql @sql;
        PRINT N'[加列] qc_insp_rec_detail.' + @col;
    END
    ELSE PRINT N'[已有] qc_insp_rec_detail.' + @col;
    SET @i += 1;
END
GO

/* ---------- ② 加头字段 结果列数 ---------- */
IF COL_LENGTH(N'dbo.qc_insp_rec', N'结果列数') IS NULL
BEGIN
    ALTER TABLE dbo.qc_insp_rec ADD [结果列数] int NULL;
    PRINT N'[加列] qc_insp_rec.结果列数';
END
ELSE PRINT N'[已有] qc_insp_rec.结果列数';
GO

/* 逐列中文注明(结果6..20) */
DECLARE @i int = 6, @col nvarchar(20), @desc nvarchar(400);
WHILE @i <= 20
BEGIN
    SET @col = N'结果' + CAST(@i AS nvarchar(10));
    SET @desc = N'检测结果第' + CAST(@i AS nvarchar(10))
              + N'格(检验报告「检测结果」可增删列的第 ' + CAST(@i AS nvarchar(10))
              + N' 列,一格一个实测值;2026-11-19 用户口径「检验结果改成可以新增列的形式,不要固定5格了」)。'
              + N'列数由头字段 结果列数 决定(默认 5,上限 20,见 qc_insp_rec.结果列数)。';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.major_id = OBJECT_ID(N'dbo.qc_insp_rec_detail')
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_insp_rec_detail'), @col, 'ColumnId')
                     AND ep.name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @desc,
            N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_rec_detail', N'COLUMN', @col;
    SET @i += 1;
END
GO
DECLARE @descTop nvarchar(600) =
    N'检验报告「检测结果」的列数(默认 5,上限 20)。一张纸抽几件就填几列,纸面「检测结果列 － n ＋」维护;'
  + N'减列时被减列的已填值清空。界面上不显示(visible=0/hidden=1),只做计数载体。';
/* ⚠ EXEC 的参数列表不接受表达式(字符串 + 拼接会报「"+" 附近有语法错误」),
   所以描述文本先拼进变量再传(2026-11-19 本脚本首跑就踩了这条) */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.qc_insp_rec')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_insp_rec'), N'结果列数', 'ColumnId')
                 AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @descTop,
        N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_rec', N'COLUMN', N'结果列数';
GO

/* ---------- ③ yj_field:结果1..结果20 全登记(可见列) ---------- */
DECLARE @i int = 1, @col nvarchar(20), @seq int;
WHILE @i <= 20
BEGIN
    SET @col = N'结果' + CAST(@i AS nvarchar(10));
    SET @seq = 30 + @i;
    IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label = @col AND place = N'detail')
        INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
        VALUES (N'QC_INSP_REC', @col, @col, N'文本', N'detail', @seq, 60, 1, 0, 0, 1);
    ELSE
        UPDATE yj_field SET visible = 1, hidden = 0, editable = 1, seq = @seq
         WHERE panel_code = N'QC_INSP_REC' AND label = @col AND place = N'detail';
    SET @i += 1;
END
PRINT N'[字段] QC_INSP_REC.结果1..结果20 已登记(detail / seq 31..50)';
GO
/* 单项判定 让位到 结果20 之后(paper 次序:结果列 → 单项判定) */
UPDATE yj_field SET seq = 60
 WHERE panel_code = N'QC_INSP_REC' AND label = N'单项判定' AND place = N'detail';
PRINT N'[字段] QC_INSP_REC.单项判定 seq → 60';
GO
/* 结果列数:头字段,界面上不显示(计数载体) */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label = N'结果列数' AND place = N'header')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_INSP_REC', N'结果列数', N'结果列数', N'整数', N'header', 148, 60, 1, 0, 1, 0);
ELSE
    UPDATE yj_field SET visible = 0, hidden = 1, editable = 1
     WHERE panel_code = N'QC_INSP_REC' AND label = N'结果列数' AND place = N'header';
PRINT N'[字段] QC_INSP_REC.结果列数 已登记(header / 隐藏计数载体)';
GO

/* ---------- ④ 存量回填:结果列数 = 5(只填空值) ---------- */
UPDATE dbo.qc_insp_rec SET [结果列数] = 5 WHERE [结果列数] IS NULL;
PRINT N'[回填] 结果列数 = 5: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ---------- ⑤ 译名(显示层;数据键永远中文) ---------- */
DECLARE @i int = 6, @col nvarchar(20), @es nvarchar(20), @ja nvarchar(20), @ko nvarchar(20), @tw nvarchar(20);
WHILE @i <= 20
BEGIN
    SET @col = N'结果' + CAST(@i AS nvarchar(10));
    SET @es = N'Result ' + CAST(@i AS nvarchar(10));
    SET @ja = N'結果' + CAST(@i AS nvarchar(10));
    SET @ko = N'결과' + CAST(@i AS nvarchar(10));
    SET @tw = N'結果' + CAST(@i AS nvarchar(10));
    IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = @col AND locale = N'en')
        INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @col, N'en', @es, N'manual');
    IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = @col AND locale = N'ja')
        INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @col, N'ja', @ja, N'manual');
    IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = @col AND locale = N'ko')
        INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @col, N'ko', @ko, N'manual');
    IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = @col AND locale = N'zh-TW')
        INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @col, N'zh-TW', @tw, N'manual');
    SET @i += 1;
END
GO
DECLARE @k nvarchar(40) = N'结果列数', @en nvarchar(60) = N'Result Columns',
        @ja nvarchar(60) = N'結果の列数', @ko nvarchar(60) = N'결과 열 수', @tw nvarchar(60) = N'結果欄數';
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = @k AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @k, N'en', @en, N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = @k AND locale = N'ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @k, N'ja', @ja, N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = @k AND locale = N'ko')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @k, N'ko', @ko, N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = @k AND locale = N'zh-TW')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @k, N'zh-TW', @tw, N'manual');
GO

/* ---------- ⑥ 自检 ---------- */
DECLARE @i int = 1, @col nvarchar(20);
WHILE @i <= 20
BEGIN
    SET @col = N'结果' + CAST(@i AS nvarchar(10));
    IF COL_LENGTH(N'dbo.qc_insp_rec_detail', @col) IS NULL
        RAISERROR(N'qc_insp_rec_detail 缺列(结果1..结果20 未建齐):%s', 16, 1, @col);
    SET @i += 1;
END
IF COL_LENGTH(N'dbo.qc_insp_rec', N'结果列数') IS NULL
    RAISERROR(N'qc_insp_rec.结果列数 未建', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND place = N'detail'
       AND label IN (N'结果1',N'结果2',N'结果3',N'结果4',N'结果5',N'结果6',N'结果7',N'结果8',N'结果9',N'结果10',
                     N'结果11',N'结果12',N'结果13',N'结果14',N'结果15',N'结果16',N'结果17',N'结果18',N'结果19',N'结果20')) <> 20
    RAISERROR(N'QC_INSP_REC 的 yj_field 未登记齐 结果1..结果20(detail)', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label = N'结果列数' AND place = N'header')
    RAISERROR(N'QC_INSP_REC.结果列数 未登记到 yj_field', 16, 1);
IF (SELECT seq FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label = N'单项判定' AND place = N'detail') < 50
    RAISERROR(N'QC_INSP_REC.单项判定 的 seq 未挪到 结果20 之后', 16, 1);
IF EXISTS (SELECT 1 FROM dbo.qc_insp_rec WHERE [结果列数] IS NULL)
    RAISERROR(N'qc_insp_rec.结果列数 仍有空值', 16, 1);

SELECT N'明细行数' AS 项, COUNT(*) AS 值 FROM dbo.qc_insp_rec_detail WHERE ISNULL(asp_cancel, 'N') <> 'Y'
UNION ALL SELECT N'报告单数 / 结果列数=5 的单数', COUNT(*) FROM dbo.qc_insp_rec WHERE [结果列数] = 5
UNION ALL SELECT N'结果1..20 已登记字段数', COUNT(*) FROM yj_field
           WHERE panel_code = N'QC_INSP_REC' AND place = N'detail' AND label LIKE N'结果%';
PRINT N'✅ 检验报告「检测结果」已改为可增删列(结果1..结果20 + 头字段 结果列数,默认 5)';
GO
