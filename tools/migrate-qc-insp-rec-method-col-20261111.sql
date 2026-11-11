/* ============================================================================
 * migrate-qc-insp-rec-method-col-20261111.sql
 * 检验数据记录表体新增「检验方法」列(检验项/检测标准/检验方法/检测结果/单项判定)
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-11):「检验数据记录的表格要修改(现在的表格只有检验项和检验标准,没有检验方法)
 *   检验项:父目录(是空数据只需要显示标题);检验标准:子目录1的数据;检验方法:子目录2的数据。」
 *
 * 即:一个「父目录 + 两个子目录」的自定义字段,带入报告后**占一行** ——
 *   检验项 = 父目录名,检测标准 = 其中一个子目录的数据,检验方法 = 另一个子目录的数据。
 * 而报告表体原来只有 检验项|检测标准|检测结果|单项判定,没有「检验方法」这一列 ⇒ 本脚本补列。
 *
 * 本脚本(幂等,两账套执行):
 *   ① qc_insp_rec_detail 加 [检验方法] nvarchar(1000) NULL + 列中文注明(列数 36→37);
 *   ② yj_field 登记一行(place=detail,seq=25 —— 夹在 检测标准(20) 与 检测结果(30) 之间);
 *   ③ yj_translation 补「检验方法」的 en(已有则跳过)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---- ① 加列 + 注明 ---- */
IF COL_LENGTH(N'dbo.qc_insp_rec_detail', N'检验方法') IS NULL
BEGIN
    ALTER TABLE dbo.qc_insp_rec_detail ADD [检验方法] nvarchar(1000) NULL;
    PRINT N'[加列] qc_insp_rec_detail.检验方法';
END
ELSE PRINT N'[已有] qc_insp_rec_detail.检验方法';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.qc_insp_rec_detail')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_insp_rec_detail'), N'检验方法', 'ColumnId')
                 AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'检验方法:来料检验要求里「父目录 + 两个子目录」自定义字段带入时,子目录中表示"怎么做"的那一格(另一个进 检测标准);2026-11-11 用户口径新增',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_rec_detail', N'COLUMN', N'检验方法';
GO

/* ---- ② yj_field 登记 ---- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label = N'检验方法' AND place = N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_INSP_REC', N'检验方法', N'检验方法', N'文本', N'detail', 25, 160, 1, 0, 0, 1);
ELSE
    UPDATE yj_field SET visible = 1, hidden = 0, editable = 1, seq = 25
     WHERE panel_code = N'QC_INSP_REC' AND label = N'检验方法' AND place = N'detail';
PRINT N'[字段] QC_INSP_REC.检验方法(detail / seq 25)';
GO

/* ---- ③ 译名 ---- */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检验方法' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'检验方法', N'en', N'Test Method', N'manual');
GO

/* ---- ④ 自检 ---- */
IF COL_LENGTH(N'dbo.qc_insp_rec_detail', N'检验方法') IS NULL
    RAISERROR(N'qc_insp_rec_detail.检验方法 未建成', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label = N'检验方法' AND place = N'detail')
    RAISERROR(N'QC_INSP_REC 的 yj_field 未登记 检验方法', 16, 1);

SELECT N'明细列数' AS 项, COUNT(*) AS 值 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.qc_insp_rec_detail')
UNION ALL SELECT N'表体字段', COUNT(*) FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND place = N'detail';

SELECT label, col_name, seq FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND place = N'detail' ORDER BY seq;
PRINT N'✅ 检验报告表体已补「检验方法」列';
GO
