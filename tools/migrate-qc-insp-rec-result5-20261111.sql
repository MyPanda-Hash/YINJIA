/* ============================================================================
 * migrate-qc-insp-rec-result5-20261111.sql —— 检验报告「检测结果」改**固定五格**
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-11):「检验数据记录的检验结果改为固定五格。」
 *   截图红框框的是检验报告(YJ-QR-96)表体「检验结果」区里**检测结果**那列;
 *   原来每行只有一个文本域(自由一段话),现在要**固定 5 个格子**,一格一个实测值
 *   (抽 5 件/测 5 次),版式与「每行 5 个测量值」的工序检验单同族。
 *
 * 本脚本(幂等;两账套均执行):
 *   ① `qc_insp_rec_detail` 加 5 列 `结果1..结果5` nvarchar(200) NULL + 逐列中文注明;
 *   ② `yj_field` 登记 5 行(place=detail / seq 31..35 —— 紧跟 检测结果(30) 之后、
 *      单项判定(40) 之前;visible=1 / hidden=0 / editable=1)。
 *      **必须登记**:保存链 ButtonService.labelsToCols 按 yj_field 的 label→col 落库,
 *      物理列有而 yj_field 没有 = 前端填了也**静默丢失**(改前踩过:文档编号 那次)。
 *   ③ 旧列 `检测结果` 转为**历史列**:yj_field 行保留(历史数据仍按标签读得到),
 *      但 visible=0 / hidden=1 / editable=0 —— 纸面与列表都不再出这一列,
 *      免得新单上永远空着、和右边五格重复。
 *   ④ 历史回填(只填空值,幂等):`结果1` ← `检测结果`,保证老单的结果文字在五格里
 *      第一格还看得见(检测结果的物理列**不删**,原件留档)。
 *   ⑤ 译名:结果1..结果5 的 en / ja / ko / zh-TW(显示层用;数据键永远中文,ADR-0001)。
 *   ⑥ 自检:5 列在、5 行 yj_field 在、检测结果已转历史列,不满足即 RAISERROR。
 *
 * 配套代码(同提交):
 *   · frontend/src/core/qc/qcInspRecColumns.js —— QC_INSP_REC_RESULT_KEYS / 列定义/导出;
 *   · frontend/src/core/views/QcInspRecSheet.vue —— 表体「检测结果」拆成 5 个格子
 *     (两行表头:检测结果 跨 5 列,第二行 1..5),只读态同样 5 格。
 *   · 不带后端改动:取数/落库都走 yj_field,登记即可。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 加 5 列 ---------- */
DECLARE @i int = 1, @col nvarchar(20), @sql nvarchar(400);
WHILE @i <= 5
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

/* ---------- ② 逐列中文注明 ---------- */
DECLARE @i int = 1, @col nvarchar(20), @desc nvarchar(400);
WHILE @i <= 5
BEGIN
    SET @col = N'结果' + CAST(@i AS nvarchar(10));
    SET @desc = N'检测结果第' + CAST(@i AS nvarchar(10))
              + N'格(检验报告「检测结果」固定五格之一,一格一个实测值;2026-11-11 用户口径「检验结果改为固定五格」)。'
              + N'旧单的整段结果由本迁移落到 结果1;检测结果 列保留为历史、不再显示。';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.major_id = OBJECT_ID(N'dbo.qc_insp_rec_detail')
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_insp_rec_detail'), @col, 'ColumnId')
                     AND ep.name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @desc,
            N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_rec_detail', N'COLUMN', @col;
    SET @i += 1;
END
GO

/* ---------- ③ yj_field 登记 5 行 + 检测结果 转历史列 ---------- */
DECLARE @i int = 1, @col nvarchar(20), @seq int = 30;
WHILE @i <= 5
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
PRINT N'[字段] QC_INSP_REC.结果1..结果5 已登记(detail / seq 31..35)';
GO
/* 检测结果(旧列)→ 历史列:仍可按标签读到历史值,但纸面/列表不再展示 */
UPDATE yj_field SET visible = 0, hidden = 1, editable = 0
 WHERE panel_code = N'QC_INSP_REC' AND label = N'检测结果' AND place = N'detail';
PRINT N'[字段] QC_INSP_REC.检测结果 已转历史列(visible=0 / hidden=1)';
GO

/* ---------- ④ 译名(显示层;数据键永远中文) ---------- */
DECLARE @i int = 1, @col nvarchar(20), @es nvarchar(20), @ja nvarchar(20), @ko nvarchar(20), @tw nvarchar(20);
WHILE @i <= 5
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

/* ---------- ⑤ 历史回填:结果1 ← 检测结果(只填空值,幂等) ---------- */
UPDATE d
   SET d.[结果1] = d.[检测结果]
  FROM dbo.qc_insp_rec_detail d
 WHERE ISNULL(d.[检测结果], N'') <> N''
   AND ISNULL(d.[结果1], N'') = N'';
PRINT N'[回填] 结果1 ← 检测结果: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ---------- ⑥ 自检 ---------- */
IF COL_LENGTH(N'dbo.qc_insp_rec_detail', N'结果1') IS NULL
 OR COL_LENGTH(N'dbo.qc_insp_rec_detail', N'结果5') IS NULL
    RAISERROR(N'qc_insp_rec_detail.结果1..结果5 未建齐', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label IN (N'结果1',N'结果2',N'结果3',N'结果4',N'结果5') AND place = N'detail') <> 5
    RAISERROR(N'QC_INSP_REC 的 yj_field 未登记齐 结果1..结果5(detail)', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label = N'检测结果' AND place = N'detail' AND visible = 0)
    RAISERROR(N'QC_INSP_REC.检测结果 未转成历史列(visible 应为 0)', 16, 1);

SELECT N'明细总行数' AS 项, COUNT(*) AS 值 FROM dbo.qc_insp_rec_detail WHERE ISNULL(asp_cancel, 'N') <> 'Y'
UNION ALL SELECT N'五格已有值(任一格非空)', COUNT(*) FROM dbo.qc_insp_rec_detail
           WHERE ISNULL(asp_cancel, 'N') <> 'Y'
             AND (ISNULL([结果1], N'') <> N'' OR ISNULL([结果5], N'') <> N'')
UNION ALL SELECT N'旧列仍有值(历史留档)', COUNT(*) FROM dbo.qc_insp_rec_detail
           WHERE ISNULL(asp_cancel, 'N') <> 'Y' AND ISNULL([检测结果], N'') <> N'';
PRINT N'✅ 检验报告「检测结果」五格列已就绪(结果1..结果5)';
GO
