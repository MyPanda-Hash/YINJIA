/* ============================================================================
 * migrate-qc-doc-links-20261019.sql —— 品质单据之间的「单号链接」两条
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-19《10.19 问题》):
 *   第 5 条「品质部意见生成特采要带检验数据记录单号的链接,可以跳转。」
 *   第 6 条「检验报告右边带来料检验单单号的链接。」
 *
 * 这两条都要「纸面上有个号、点它跳到那张单」,而现行两张表都没有存这个号的列:
 *   ① 检验报告 `qc_insp_rec`(JYSJ-…)由检验单 `qc_insp`(IJ-…)生单时自动建,
 *      但报告上没有记"我是从哪张检验单来的" ⇒ 补列 **`来料检验单号`**;
 *   ② 特采单 `qc_tc_in`(TCI-…)由暂收退料单审批通过时生成,头上有隐藏的「检验单号」,
 *      但没有"对应的检验报告"这一跳 ⇒ 补列 **`检验数据记录单号`**(真源 = 检验目录行
 *      `qc_catalog_detail.检验数据记录单号`,由 QcCatalogService 在检验单生单时写好)。
 *
 * 本脚本(幂等;两账套均执行):
 *   ① `qc_insp_rec` 加 `来料检验单号` nvarchar(100) NULL + 列中文注明;
 *   ② `qc_tc_in`    加 `检验数据记录单号` nvarchar(100) NULL + 列中文注明;
 *   ③ `yj_field` 各登记一行(**隐藏链路列**:place=header / visible=0 / hidden=1 / editable=0 ——
 *      纸面不显示输入框,但保存链路认 yj_field,不登记就存不进去);
 *   ④ `yj_translation` 补 `来料检验单号` 的 en 译名(检验数据记录单号 已有);
 *   ⑤ **历史数据回填**(只填空值,幂等):
 *      · 报告 ← 检验目录行(检验数据记录单号 → 检验单号);
 *      · 特采单 ← 检验目录行(检验单号 + 产品名称=物料名称 → 检验数据记录单号);
 *   ⑥ 自检:两列存在、两行 yj_field 在、回填后仍有空值的行数只做打印(不报错,
 *      因为手工新建的单据本来就没有来源单)。
 *
 * 配套代码(同提交):
 *   · QcCatalogService.createInspRecord(...) 建报告时写 `来料检验单号`;
 *   · ButtonService.returnAutoSpecialAccept(...) 生特采单时写 `检验数据记录单号`;
 *   · frontend: QcInspRecSheet.vue 标题右侧「来料检验单」链接;
 *              DocSheet + docSheetConfigs.QC_TC_IN 品质部意见行「检验数据记录」链接。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① qc_insp_rec.来料检验单号 ---------- */
IF COL_LENGTH(N'dbo.qc_insp_rec', N'来料检验单号') IS NULL
BEGIN
    ALTER TABLE dbo.qc_insp_rec ADD [来料检验单号] nvarchar(100) NULL;
    PRINT N'[加列] qc_insp_rec.来料检验单号';
END
ELSE PRINT N'[已有] qc_insp_rec.来料检验单号';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.qc_insp_rec')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_insp_rec'), N'来料检验单号', 'ColumnId')
                 AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'来源来料检验单号(qc_insp.单据编号,IJ-…):检验报告由检验单生单时自动建,这里留档以便报告纸面右上角一键跳回检验单(2026-10-19 用户口径第 6 条);手工新建的报告为空',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_rec', N'COLUMN', N'来料检验单号';
GO

/* ---------- ② qc_tc_in.检验数据记录单号 ---------- */
IF COL_LENGTH(N'dbo.qc_tc_in', N'检验数据记录单号') IS NULL
BEGIN
    ALTER TABLE dbo.qc_tc_in ADD [检验数据记录单号] nvarchar(100) NULL;
    PRINT N'[加列] qc_tc_in.检验数据记录单号';
END
ELSE PRINT N'[已有] qc_tc_in.检验数据记录单号';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.qc_tc_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_tc_in'), N'检验数据记录单号', 'ColumnId')
                 AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'对应的检验数据记录(检验报告)单号(qc_insp_rec.单据编号,JYSJ-…):暂收退料单审批通过生成特采单时按 检验单号+物料名称 从检验目录行带出,品质部意见区据此一键跳转(2026-10-19 用户口径第 5 条);无来源或手工特采为空',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_tc_in', N'COLUMN', N'检验数据记录单号';
GO

/* ---------- ③ yj_field 登记(隐藏链路列) ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label = N'来料检验单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_INSP_REC', N'来料检验单号', N'来料检验单号', N'文本', N'header', 145, 130, 0, 0, 1, 0);
PRINT N'[字段] QC_INSP_REC.来料检验单号';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_TC_IN' AND label = N'检验数据记录单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_TC_IN', N'检验数据记录单号', N'检验数据记录单号', N'文本', N'header', 904, 130, 0, 0, 1, 0);
PRINT N'[字段] QC_TC_IN.检验数据记录单号';
GO

/* ---------- ④ 译名(来料检验单号;检验数据记录单号 en 已有则跳过) ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'来料检验单号' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'field', N'来料检验单号', N'en', N'Incoming Inspection No.', N'manual');
GO

/* ---------- ⑤ 历史回填(只填空值,幂等) ---------- */
/* 报告 ← 检验目录行:检验数据记录单号 → 检验单号(同一单号可能多行,取最近一条非空) */
UPDATE r
   SET r.[来料检验单号] = d.检验单号
  FROM dbo.qc_insp_rec r
  CROSS APPLY (SELECT TOP 1 c.检验单号
                 FROM dbo.qc_catalog_detail c
                WHERE c.检验数据记录单号 = r.[单据编号]
                  AND ISNULL(c.asp_cancel, 'N') <> 'Y'
                  AND ISNULL(c.检验单号, N'') <> N''
                ORDER BY c.id DESC) d
 WHERE ISNULL(r.[来料检验单号], N'') = N'';
PRINT N'[回填] 报告 ← 检验目录行: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
/* 特采单 ← 检验目录行:检验单号 + 产品名称(物料名称) → 检验数据记录单号 */
UPDATE t
   SET t.[检验数据记录单号] = d.检验数据记录单号
  FROM dbo.qc_tc_in t
  CROSS APPLY (SELECT TOP 1 c.检验数据记录单号
                 FROM dbo.qc_catalog_detail c
                WHERE c.检验单号 = t.[检验单号]
                  AND ISNULL(c.asp_cancel, 'N') <> 'Y'
                  AND ISNULL(c.检验数据记录单号, N'') <> N''
                  AND (ISNULL(t.[产品名称], N'') = N'' OR c.物料名称 = t.[产品名称])
                ORDER BY CASE WHEN c.物料名称 = t.[产品名称] THEN 0 ELSE 1 END, c.id DESC) d
 WHERE ISNULL(t.[检验数据记录单号], N'') = N''
   AND ISNULL(t.[检验单号], N'') <> N'';
PRINT N'[回填] 特采单 ← 检验目录行: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ---------- ⑥ 自检 + 现状输出 ---------- */
IF COL_LENGTH(N'dbo.qc_insp_rec', N'来料检验单号') IS NULL
    RAISERROR(N'qc_insp_rec.来料检验单号 未建', 16, 1);
IF COL_LENGTH(N'dbo.qc_tc_in', N'检验数据记录单号') IS NULL
    RAISERROR(N'qc_tc_in.检验数据记录单号 未建', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND label = N'来料检验单号')
    RAISERROR(N'QC_INSP_REC 的 yj_field 未登记 来料检验单号', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_TC_IN' AND label = N'检验数据记录单号')
    RAISERROR(N'QC_TC_IN 的 yj_field 未登记 检验数据记录单号', 16, 1);

SELECT N'报告总数' AS 项, COUNT(*) AS 值, NULL AS 有来料检验单号 FROM dbo.qc_insp_rec
UNION ALL SELECT N'特采单总数', COUNT(*), NULL FROM dbo.qc_tc_in
UNION ALL SELECT N'报告·已带检验单号', NULL, SUM(CASE WHEN ISNULL([来料检验单号],N'')<>N'' THEN 1 ELSE 0 END) FROM dbo.qc_insp_rec
UNION ALL SELECT N'特采·已带检验报告号', NULL, SUM(CASE WHEN ISNULL([检验数据记录单号],N'')<>N'' THEN 1 ELSE 0 END) FROM dbo.qc_tc_in;
PRINT N'✅ 品质单据单号链接列已就绪(报告↔检验单 / 特采单↔检验报告)';
GO
