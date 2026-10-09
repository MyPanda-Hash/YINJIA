/* ============================================================
   migrate-material-out-wo-line-field.sql — 2026-10-09
   材料出库单(领料单)表头「工单行号」字段注册 + 译名

   背景(用户报障 2026-10-09):
     「转领料单」原先按**工单号**去重/合并 ⇒ 同一张工单的多行只能转出一张领料单;
     用户口径:生产工单的唯一性 = **工单号 + 工单行号**,两者合起来才唯一。

   处置(配套代码同批,见 commit):
     · WorkOrderPickingService 改为**按工单行**转单:每行一张材料出库单草稿,
       单据头写 加工单号 = 工单号 + **工单行号 = plang.pl_xc**;
     · ManuWritebackService.refreshPickList 改为**按行**回填 plang.ll_no2。

   ⚠ 物理列 bd_material_out.工单行号(int)早已存在(migrate-server-parity2-20260928.sql,
     「领料出库关联生产工单行,与 plang.pl_xc 同义」),但**从未在 yj_field 注册** ——
     面板引擎按 yj_field 的 label→col 过滤写库(ButtonService.labelsToCols),
     不注册 ⇒ 后端写进 formData 的「工单行号」会被**静默丢弃**(同 MANU_ORDER.单据日期 的旧坑)。
     故本脚本只补元数据,不改表结构。

   内容:
     ① 防御性补列(新库重建场景;已存在即跳过);
     ② yj_field 注册 MATERIAL_OUT 表头「工单行号」(seq 22 紧随 加工单号 seq 20;
        data_type=整数 / 只读 / 可见 —— 值由系统写入,供仓库核对是哪一行);
     ③ yj_translation en 译名(field/工单行号 = WO Line,与前端 en.js 的「工单行号」同词)。

   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO
IF OBJECT_ID(N'dbo.bd_material_out', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.bd_material_out', N'工单行号') IS NULL
    ALTER TABLE dbo.bd_material_out ADD [工单行号] int NULL;
GO
IF COL_LENGTH(N'dbo.bd_material_out', N'工单行号') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.bd_material_out')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_out'), N'工单行号', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description',
             N'工单行号(领料出库关联生产工单行,与 plang.pl_xc 同义;转领料单按行写入,工单行号+加工单号 = 领料单的来源行键)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'工单行号';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description',
             N'工单行号(领料出库关联生产工单行,与 plang.pl_xc 同义;转领料单按行写入,工单行号+加工单号 = 领料单的来源行键)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_material_out', N'COLUMN', N'工单行号';
END
GO
-- 面板字段注册(表头,seq 22 紧随 加工单号 seq 20;只读:值由系统按 plang.pl_xc 写入)
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'MATERIAL_OUT')
   AND COL_LENGTH(N'dbo.bd_material_out', N'工单行号') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MATERIAL_OUT' AND label = N'工单行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('MATERIAL_OUT', N'工单行号', N'工单行号', N'整数', NULL, NULL, NULL,
            NULL, 'header', 22, 80, 0, 0, 0, NULL, 1);
GO
-- en 译名(field/工单行号;与前端 en.js 的 'WO Line' 同词)。其余语言由机翻兜底。
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'工单行号' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'工单行号', 'en', N'WO Line', 'manual');
GO
-- 自检:列 + 字段登记 + 译名 三件齐备
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.bd_material_out', N'工单行号') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MATERIAL_OUT' AND label = N'工单行号') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'工单行号' AND locale = 'en') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'材料出库单「工单行号」字段注册自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'MATERIAL_OUT.工单行号 就绪(列 + 字段登记 header/seq22 + en 译名,幂等)';
GO
