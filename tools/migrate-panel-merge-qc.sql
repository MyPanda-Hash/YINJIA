-- migrate-panel-merge-qc.sql — 面板归并:删空壳面板 QC_RECV + SL_RECV 改用 QC 命名(2026-09-20)
-- 用户口径:「删除空的面板,把 SL 面板改名 QC 面板的命名」;改名范围**只到面板编码**
--   物理表仍 sl_recv/sl_recv_detail、单据前缀仍 SL、存量单号 SL-2026-09-0001 一律不动。
-- 背景:库里两个面板同名「送料暂收单」——
--   · SL_RECV(sl_recv/sl_recv_detail,前缀 SL,18 头/34 行,采购链实际在用)
--   · QC_RECV(qc_recv/qc_recv_detail,前缀 ZS,0 行,历史草稿版残留;字段还是
--     采购数量/暂收数量/仓库/到货日期/经手人 那一套,与现网口径早已脱节)
-- 处理:① 删 QC_RECV 面板行 + 其 44 条 yj_field;② SL_RECV → QC_RECV(面板编码)。
-- 不删表:qc_recv/qc_recv_detail 两张 0 行空表**保留**——v_lot_trace(批号追溯面板)的「暂收」段
--   仍引用它们(列 暂收数量/仓库/经手人 口径),删表会打断该视图。空表与视图改写另案处理。
-- 幂等:QC_RECV 空壳在才删;SL_RECV 在且 QC_RECV 已空出才改名;可重复执行。
-- 运行(UTF-8 无 BOM):
--   docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U yinjia -P '***' -d HSDZ_MES -C -f 65001 -i /tmp/migrate-panel-merge-qc.sql"
SET NOCOUNT ON;
-- sqlcmd -i 默认 QUOTED_IDENTIFIER OFF,而 yj_panel/yj_doc_batch 上有筛选索引与计算列依赖,
-- 不显式打开会在 UPDATE 处报 1934;ANSI_NULLS 同口径。每个批次都要设(无需 GO 分隔但习惯带上)。
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- ══════════ 1. 删空壳面板 QC_RECV(面板行 + 字段元数据;不带数据保护) ══════════
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_RECV' AND head_table = 'qc_recv')
BEGIN
    IF (OBJECT_ID('qc_recv') IS NOT NULL AND EXISTS (SELECT 1 FROM qc_recv))
       OR (OBJECT_ID('qc_recv_detail') IS NOT NULL AND EXISTS (SELECT 1 FROM qc_recv_detail))
        RAISERROR (N'[panel-merge] qc_recv/qc_recv_detail 竟有数据,拒绝删除面板 QC_RECV(需人工确认)', 16, 1);
    ELSE
    BEGIN
        DELETE FROM yj_field WHERE panel_code = 'QC_RECV';
        DELETE FROM yj_panel WHERE panel_code = 'QC_RECV';
        PRINT N'[panel-merge] 已删除空壳面板 QC_RECV(面板行 + yj_field 字段行)';
    END
END
ELSE
    PRINT N'[panel-merge] 空壳面板 QC_RECV 不存在,跳过(幂等)';
GO

-- ══════════ 2. SL_RECV → QC_RECV 面板编码改名 ══════════
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- 全库「值含 SL_RECV」的列已实测枚举(2026-09-20),只有以下 9 处;改完由 §3 断言兜底。
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'SL_RECV')
   AND NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_RECV')
BEGIN
    UPDATE yj_panel        SET panel_code        = 'QC_RECV' WHERE panel_code        = 'SL_RECV';
    UPDATE yj_field        SET panel_code        = 'QC_RECV' WHERE panel_code        = 'SL_RECV';
    UPDATE yj_field        SET ref_panel         = 'QC_RECV' WHERE ref_panel         = 'SL_RECV';
    UPDATE form_flow_link  SET source_panel_code = 'QC_RECV' WHERE source_panel_code = 'SL_RECV';
    UPDATE form_flow_link  SET target_panel_code = 'QC_RECV' WHERE target_panel_code = 'SL_RECV';
    UPDATE yj_doc_status   SET panel_code        = 'QC_RECV' WHERE panel_code        = 'SL_RECV';
    UPDATE yj_form_approval SET panel_code       = 'QC_RECV' WHERE panel_code        = 'SL_RECV';
    UPDATE yj_doc_batch    SET source_panel_code = 'QC_RECV' WHERE source_panel_code = 'SL_RECV';
    UPDATE yj_doc_batch    SET target_panel_code = 'QC_RECV' WHERE target_panel_code = 'SL_RECV';
    PRINT N'[panel-merge] SL_RECV → QC_RECV 改名完成(面板编码;表名/单据前缀不变)';
END
ELSE IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_RECV')
        AND NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'SL_RECV')
    PRINT N'[panel-merge] 已改名过,跳过(幂等)';
ELSE
    RAISERROR (N'[panel-merge] 异常状态:SL_RECV 与 QC_RECV 面板均在(或均不在),未改名', 16, 1);
GO

-- ══════════ 3. 自检:全库不得再有 SL_RECV 残留;面板须指向 sl_recv ══════════
DECLARE @left int =
      (SELECT COUNT(*) FROM yj_panel        WHERE panel_code        = 'SL_RECV')
    + (SELECT COUNT(*) FROM yj_field        WHERE panel_code        = 'SL_RECV' OR ref_panel = 'SL_RECV')
    + (SELECT COUNT(*) FROM form_flow_link  WHERE source_panel_code = 'SL_RECV' OR target_panel_code = 'SL_RECV')
    + (SELECT COUNT(*) FROM yj_doc_status   WHERE panel_code        = 'SL_RECV')
    + (SELECT COUNT(*) FROM yj_form_approval WHERE panel_code       = 'SL_RECV')
    + (SELECT COUNT(*) FROM yj_doc_batch    WHERE source_panel_code = 'SL_RECV' OR target_panel_code = 'SL_RECV');

IF @left > 0
    RAISERROR (N'[panel-merge] 自检失败:仍有 %d 处 SL_RECV 残留', 16, 1, @left);
ELSE
    PRINT N'[panel-merge] 自检通过:全库无 SL_RECV 残留';

SELECT panel_code, panel_name, head_table, line_table, prefix, module_group
FROM yj_panel WHERE panel_code = 'QC_RECV';   -- 期望:送料暂收单 / sl_recv / sl_recv_detail / SL
GO
