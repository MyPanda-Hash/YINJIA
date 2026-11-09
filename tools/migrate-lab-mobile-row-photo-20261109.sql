/* ============================================================================
   migrate-lab-mobile-row-photo-20261109.sql
   ── 「手机照片」从**单据头**下移到**明细行**(每一行各自拍照) ───────────────
   ============================================================================
   【用户口径 2026-11-09 第二轮】
     「1.附件,3 个面版都要有,而且加在明细字段内,就是表格里面,每一行都有可能要拍照保存。」
   落点(与本脚本一一对应):
     · 三张**明细表**各加一列 [手机照片] —— 与 PC 纸面表格里的「手机照片」列、手机端每行的拍照入口同源;
     · `yj_field` 里把「手机照片」从 `place='header'` 改成 `place='detail'`(attach 锚点改为按行);
     · 表头那一列/那个字段**撤掉**(上一轮 2026-11-09 首版是整单一张照片,现改按行),避免两处入口;
       头部列若有值,先搬到该单**第一行**再删列(不丢已存的文件名)。
   【附件锚点(服务端 AttachmentService 同步的目标)】
     field_key = '手机照片-<明细行 id>'(例 '手机照片-12');
     同步写回 `rd_*_detail.[手机照片]`,仅改该行(WHERE id=? AND 单据编号=?)。
   【幂等】列/字段/搬数/换锚点全部按「存在才算」写;重复执行不报错、不重复插行。
   两个账套都要执行(先 HSDZ_MES,后 HSDZ_MES_TEST)。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ── ① 三张明细表补列 [手机照片] nvarchar(500) ───────────────────────────── */
IF COL_LENGTH('rd_spike_water_detail', '手机照片') IS NULL
BEGIN
    ALTER TABLE rd_spike_water_detail ADD [手机照片] nvarchar(500) NULL;
    PRINT N'migrate-lab-mobile-row-photo-20261109.sql:已加列 rd_spike_water_detail.手机照片';
END
ELSE PRINT N'列 rd_spike_water_detail.手机照片 已存在';
GO
IF COL_LENGTH('rd_equip_use_detail', '手机照片') IS NULL
BEGIN
    ALTER TABLE rd_equip_use_detail ADD [手机照片] nvarchar(500) NULL;
    PRINT N'migrate-lab-mobile-row-photo-20261109.sql:已加列 rd_equip_use_detail.手机照片';
END
ELSE PRINT N'列 rd_equip_use_detail.手机照片 已存在';
GO
IF COL_LENGTH('rd_instr_use_detail', '手机照片') IS NULL
BEGIN
    ALTER TABLE rd_instr_use_detail ADD [手机照片] nvarchar(500) NULL;
    PRINT N'migrate-lab-mobile-row-photo-20261109.sql:已加列 rd_instr_use_detail.手机照片';
END
ELSE PRINT N'列 rd_instr_use_detail.手机照片 已存在';
GO

/* ── ② 明细列中文注明(幂等) ─────────────────────────────────────────────── */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('rd_spike_water_detail')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_spike_water_detail'), '手机照片', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'手机照片:该**明细行**的现场照片(实验室记录手机登记拍/选),存于 yj_attachment(锚点=面板+单据编号+手机照片-行id),此列同步原文件名串(、分隔)供纸面/打印显示',
        N'SCHEMA', N'dbo', N'TABLE', N'rd_spike_water_detail', N'COLUMN', N'手机照片';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('rd_equip_use_detail')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_equip_use_detail'), '手机照片', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'手机照片:该**明细行**的现场照片(实验室记录手机登记拍/选),存于 yj_attachment(锚点=面板+单据编号+手机照片-行id),此列同步原文件名串(、分隔)供纸面/打印显示',
        N'SCHEMA', N'dbo', N'TABLE', N'rd_equip_use_detail', N'COLUMN', N'手机照片';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('rd_instr_use_detail')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_instr_use_detail'), '手机照片', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'手机照片:该**明细行**的现场照片(实验室记录手机登记拍/选),存于 yj_attachment(锚点=面板+单据编号+手机照片-行id),此列同步原文件名串(、分隔)供纸面/打印显示',
        N'SCHEMA', N'dbo', N'TABLE', N'rd_instr_use_detail', N'COLUMN', N'手机照片';
GO

/* ── ③ 先把表头那份照片搬到该单第一行(仅当头部列还在且有值) ──────────────── */
IF COL_LENGTH('rd_spike_water_head', '手机照片') IS NOT NULL
    UPDATE d SET d.[手机照片] = h.[手机照片]
    FROM rd_spike_water_detail d
    JOIN rd_spike_water_head h ON h.单据编号 = d.单据编号
    WHERE h.[手机照片] IS NOT NULL AND LTRIM(RTRIM(h.[手机照片])) <> N''
      AND d.id = (SELECT MIN(d2.id) FROM rd_spike_water_detail d2
                  WHERE d2.单据编号 = d.单据编号 AND ISNULL(d2.asp_cancel, 'N') <> 'Y')
      AND (d.[手机照片] IS NULL OR LTRIM(RTRIM(d.[手机照片])) = N'');
GO
IF COL_LENGTH('rd_equip_use_head', '手机照片') IS NOT NULL
    UPDATE d SET d.[手机照片] = h.[手机照片]
    FROM rd_equip_use_detail d
    JOIN rd_equip_use_head h ON h.单据编号 = d.单据编号
    WHERE h.[手机照片] IS NOT NULL AND LTRIM(RTRIM(h.[手机照片])) <> N''
      AND d.id = (SELECT MIN(d2.id) FROM rd_equip_use_detail d2
                  WHERE d2.单据编号 = d.单据编号 AND ISNULL(d2.asp_cancel, 'N') <> 'Y')
      AND (d.[手机照片] IS NULL OR LTRIM(RTRIM(d.[手机照片])) = N'');
GO
IF COL_LENGTH('rd_instr_use_head', '手机照片') IS NOT NULL
    UPDATE d SET d.[手机照片] = h.[手机照片]
    FROM rd_instr_use_detail d
    JOIN rd_instr_use_head h ON h.单据编号 = d.单据编号
    WHERE h.[手机照片] IS NOT NULL AND LTRIM(RTRIM(h.[手机照片])) <> N''
      AND d.id = (SELECT MIN(d2.id) FROM rd_instr_use_detail d2
                  WHERE d2.单据编号 = d.单据编号 AND ISNULL(d2.asp_cancel, 'N') <> 'Y')
      AND (d.[手机照片] IS NULL OR LTRIM(RTRIM(d.[手机照片])) = N'');
GO

/* ── ④ 附件锚点从「整单」改成「第一行」:field_key '手机照片' → '手机照片-<行id>' ── */
IF COL_LENGTH('rd_spike_water_head', '手机照片') IS NOT NULL
    UPDATE a SET a.field_key = N'手机照片-' + CAST(d.id AS nvarchar(20))
    FROM yj_attachment a
    JOIN rd_spike_water_detail d ON d.单据编号 = a.doc_no
    WHERE a.panel_code = 'RD_SPIKE_WATER' AND a.field_key = N'手机照片'
      AND d.id = (SELECT MIN(d2.id) FROM rd_spike_water_detail d2
                  WHERE d2.单据编号 = a.doc_no AND ISNULL(d2.asp_cancel, 'N') <> 'Y');
GO
IF COL_LENGTH('rd_equip_use_head', '手机照片') IS NOT NULL
    UPDATE a SET a.field_key = N'手机照片-' + CAST(d.id AS nvarchar(20))
    FROM yj_attachment a
    JOIN rd_equip_use_detail d ON d.单据编号 = a.doc_no
    WHERE a.panel_code = 'RD_EQUIP_USE' AND a.field_key = N'手机照片'
      AND d.id = (SELECT MIN(d2.id) FROM rd_equip_use_detail d2
                  WHERE d2.单据编号 = a.doc_no AND ISNULL(d2.asp_cancel, 'N') <> 'Y');
GO
IF COL_LENGTH('rd_instr_use_head', '手机照片') IS NOT NULL
    UPDATE a SET a.field_key = N'手机照片-' + CAST(d.id AS nvarchar(20))
    FROM yj_attachment a
    JOIN rd_instr_use_detail d ON d.单据编号 = a.doc_no
    WHERE a.panel_code = 'RD_INSTR_USE' AND a.field_key = N'手机照片'
      AND d.id = (SELECT MIN(d2.id) FROM rd_instr_use_detail d2
                  WHERE d2.单据编号 = a.doc_no AND ISNULL(d2.asp_cancel, 'N') <> 'Y');
GO

/* ── ⑤ 撤掉表头列(功能已下移到行;先搬数后删列,见 ③④) ─────────────────── */
IF COL_LENGTH('rd_spike_water_head', '手机照片') IS NOT NULL
BEGIN
    ALTER TABLE rd_spike_water_head DROP COLUMN [手机照片];
    PRINT N'已删除表头列 rd_spike_water_head.手机照片(照片改按行存放)';
END
GO
IF COL_LENGTH('rd_equip_use_head', '手机照片') IS NOT NULL
BEGIN
    ALTER TABLE rd_equip_use_head DROP COLUMN [手机照片];
    PRINT N'已删除表头列 rd_equip_use_head.手机照片(照片改按行存放)';
END
GO
IF COL_LENGTH('rd_instr_use_head', '手机照片') IS NOT NULL
BEGIN
    ALTER TABLE rd_instr_use_head DROP COLUMN [手机照片];
    PRINT N'已删除表头列 rd_instr_use_head.手机照片(照片改按行存放)';
END
GO

/* ── ⑥ yj_field:删表头那条、补明细那条(place='detail') ──────────────────── */
DELETE FROM yj_field
 WHERE panel_code IN ('RD_SPIKE_WATER', 'RD_EQUIP_USE', 'RD_INSTR_USE')
   AND col_name = N'手机照片' AND place = N'header';
GO

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SPIKE_WATER' AND col_name = N'手机照片' AND place = N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_SPIKE_WATER', N'手机照片', N'手机照片', N'附件', NULL, NULL, NULL,
            NULL, N'detail', 220, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_EQUIP_USE' AND col_name = N'手机照片' AND place = N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_EQUIP_USE', N'手机照片', N'手机照片', N'附件', NULL, NULL, NULL,
            NULL, N'detail', 80, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_INSTR_USE' AND col_name = N'手机照片' AND place = N'detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_INSTR_USE', N'手机照片', N'手机照片', N'附件', NULL, NULL, NULL,
            NULL, N'detail', 100, 110, 1, 0, 0, 1);
GO

/* ── ⑦ 校验 ─────────────────────────────────────────────────────────────── */
DECLARE @miss INT = 0;
IF COL_LENGTH('rd_spike_water_detail', '手机照片') IS NULL SET @miss += 1;
IF COL_LENGTH('rd_equip_use_detail', '手机照片') IS NULL SET @miss += 1;
IF COL_LENGTH('rd_instr_use_detail', '手机照片') IS NULL SET @miss += 1;
IF COL_LENGTH('rd_spike_water_head', '手机照片') IS NOT NULL SET @miss += 10;
IF COL_LENGTH('rd_equip_use_head', '手机照片') IS NOT NULL SET @miss += 10;
IF COL_LENGTH('rd_instr_use_head', '手机照片') IS NOT NULL SET @miss += 10;
IF (SELECT COUNT(*) FROM yj_field WHERE col_name = N'手机照片' AND place = N'detail'
      AND panel_code IN ('RD_SPIKE_WATER', 'RD_EQUIP_USE', 'RD_INSTR_USE')) <> 3 SET @miss += 100;
IF EXISTS (SELECT 1 FROM yj_field WHERE col_name = N'手机照片' AND place = N'header'
             AND panel_code IN ('RD_SPIKE_WATER', 'RD_EQUIP_USE', 'RD_INSTR_USE')) SET @miss += 1000;
IF @miss = 0
    PRINT N'[PASS] migrate-lab-mobile-row-photo-20261109:明细列×3 + yj_field(detail)×3,表头列与表头字段已撤';
ELSE
    RAISERROR(N'[FAIL] migrate-lab-mobile-row-photo-20261109:自检 miss=%d (1..3=缺明细列, +10=表头列未删, +100=字段数不对, +1000=表头字段残留)', 16, 1, @miss);
GO
