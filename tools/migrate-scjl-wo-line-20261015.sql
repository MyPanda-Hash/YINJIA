/* ============================================================
   migrate-scjl-wo-line-20261015.sql — 2026-10-15
   工序报工单(scjl)补「工单行号」列 —— 报工单必带工单行号(落库 + 界面显示)

   背景(用户口径 2026-10-10,交接文档 §0):
     「当前先把生产关联的模块,生产工单,快速排产,工序报工单,追溯这些都实现**工单号加工单行号**的形式。」
     工序报工单验收判据之一 = 「报工单**必带**工单行号(落库 + 界面显示)」。

   现状(2026-10-15 实测):
     · 行级键**已存在**但只是间接的:scjl.gd_id = plang_pc.id(排产行)→ plang_pc.plang_id = plang.id;
     · 该 gd_id 只在**审核**时由 WoReportService.complete() 补写 ⇒ **草稿期为空**,
       单据本身不携带行键,列表上也看不到"这张报工单是哪一行的";
     · 面板字段(WO_REPORT / WO_REPORT_LIST)只有「批次号」,没有工单行号。

   本脚本:
     ① 加列 scjl.[工单行号] int NULL(与 plang.pl_xc 同型同义;冗余展示列,权威行键仍是 gd_id);
     ② 写 MS_Description 中文注明;
     ③ yj_field 注册 WO_REPORT + WO_REPORT_LIST 的「工单行号」(seq 36,紧随批次号 35;
        只读 —— 值由系统按 gd_id/批次号解析写入,不由人手填);
     ④ yj_translation en 译名(标签全局共享,已有则不重复插)。

   ⚠ scjl 是冻结登记的遗留表(§5「禁新增、禁扩展」),此处是**用户明确口径下的必要扩展**,
     与 migrate-scjl-report.sql / migrate-scjl-single-table.sql 加「批次号/报工单号/直销数量」同一先例:
     报工单的数据载体自 2026-09-27「scjl 单表化」起就是 scjl,行号必须有地方落。

   存量回填:按 gd_id → plang_pc.plang_id → plang.pl_xc 回填**能确定的**;gd_id 为空的老行
     按(工单号 + 批次号)唯一命中时才回填,命中多行/零行一律留 NULL(不猜)。
   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO
IF OBJECT_ID(N'dbo.scjl', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.scjl', N'工单行号') IS NULL
    ALTER TABLE dbo.scjl ADD [工单行号] int NULL;
GO
IF COL_LENGTH(N'dbo.scjl', N'工单行号') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.scjl')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'工单行号', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description',
             N'工单行号(生产工单行,与 plang.pl_xc 同义;冗余展示列 —— 权威行键仍是 gd_id=plang_pc.id,两者由 plang_pc.plang_id 对应)',
             N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'工单行号';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description',
             N'工单行号(生产工单行,与 plang.pl_xc 同义;冗余展示列 —— 权威行键仍是 gd_id=plang_pc.id,两者由 plang_pc.plang_id 对应)',
             N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'工单行号';
END
GO
-- 存量回填(只回填**能唯一确定**的;不猜):① 经 gd_id 锚定;② gd_id 空时按(工单号+批次号)唯一命中
UPDATE s SET s.[工单行号] = p.pl_xc
FROM dbo.scjl s
JOIN dbo.plang_pc pc ON pc.id = s.gd_id
JOIN dbo.plang p ON p.id = pc.plang_id
WHERE s.[工单行号] IS NULL AND s.gd_id IS NOT NULL AND ISNULL(p.asp_cancel,'N')<>'Y';
GO
-- ② gd_id 为空的老行:按(工单号 + 批次号)找该行,**恰命中 1 行**才回填(0 行/多行一律留 NULL —— 不猜)
WITH cand AS (
    SELECT s.id AS sid, MIN(p.pl_xc) AS xc
    FROM dbo.scjl s
    JOIN dbo.plang p ON p.pl_no = s.gldh AND ISNULL(p.[批次号],N'') = ISNULL(s.[批次号],N'')
         AND ISNULL(p.asp_cancel,'N') <> 'Y'
    WHERE s.[工单行号] IS NULL AND ISNULL(s.gd_id,0) = 0 AND ISNULL(s.[批次号],N'') <> N''
    GROUP BY s.id
    HAVING COUNT(*) = 1
)
UPDATE s SET s.[工单行号] = c.xc
FROM dbo.scjl s JOIN cand c ON c.sid = s.id;
GO
-- 面板字段注册(WO_REPORT + WO_REPORT_LIST;只读:值由系统解析写入)
IF COL_LENGTH(N'dbo.scjl', N'工单行号') IS NOT NULL
   AND EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'WO_REPORT')
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'WO_REPORT' AND label = N'工单行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('WO_REPORT', N'工单行号', N'工单行号', N'整数', NULL, NULL, NULL,
            NULL, 'query,detail', 36, 80, 0, 0, 0, NULL, 1);
GO
IF COL_LENGTH(N'dbo.scjl', N'工单行号') IS NOT NULL
   AND EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'WO_REPORT_LIST')
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'WO_REPORT_LIST' AND label = N'工单行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('WO_REPORT_LIST', N'工单行号', N'工单行号', N'整数', NULL, NULL, NULL,
            NULL, 'query,detail', 36, 80, 0, 0, 0, NULL, 1);
GO
-- en 译名(标签全局共享;已有则不重复插,避免撞 uq_translation)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'工单行号' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'工单行号', 'en', N'WO Line', 'manual');
GO
-- 自检:列 + 注明 + 两面板字段登记 + 译名
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.scjl', N'工单行号') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1
               AND ep.major_id = OBJECT_ID(N'dbo.scjl')
               AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'工单行号', 'ColumnId')
               AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'WO_REPORT' AND label = N'工单行号') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'WO_REPORT_LIST' AND label = N'工单行号') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'工单行号' AND locale = 'en') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'工序报工单「工单行号」自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'scjl.工单行号 就绪(列 + 注明 + 两面板字段登记 + en 译名,幂等;存量只回填能唯一确定的)';
GO
