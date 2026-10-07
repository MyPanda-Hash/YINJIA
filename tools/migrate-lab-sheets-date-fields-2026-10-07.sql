/* ═══════════════════════════════════════════════════════════════════════════════
   migrate-lab-sheets-date-fields-2026-10-07.sql — 实验室记录表日期/时间格改为「选取填写」
   ───────────────────────────────────────────────────────────────────────────────
   起因(用户报错,2026-10-07):
     RD_INSTR_USE 保存报 `S0001/241 从字符串转换日期和/或时间时,转换失败`。
     根因是**元数据与物理列类型不一致**:面板把这几个字段登记成「文本」(界面给手填输入框),
     而服务器上 rd_instr_use_detail.使用日期 等列是 `datetime`(服务器直改存量,见
     migrate-server-parity-20260928.sql:102)。接口把 datetime 列按 Jackson 下发成
     '2026-10-06T16:00:00.000+00:00'(带时区偏移),界面原样回传 ⇒ datetime 列拒收该串
     (本地实测:datetime2/date 收,datetime 报 241)。

   本脚本做的事(只改 yj_field.data_type,无 DDL):
     ① 真正的日期格 → 「日期」:前端 RecordSheetPanels 按 data_type 渲染日期下拉(不用手填),
        后端 ButtonService.normalizeByType 也会把 ISO 归一成 yyyy-MM-dd —— 两头同时收口,
        服务器 datetime 列不再收到带偏移的串(241 根治)。
     ② 仪器使用记录表「起止时间」→「时间区间」:一格区间控件,落库仍是 'HH:mm-HH:mm' 文本
        (纸面版式、旧值格式都不变)。
     ③ 四个「测试时间」格(碱性表头/数据行、抗菌表头、浸泡表头、压降精度数据行)**不动**:
        实测值 '2025.9.19-9.20'、'2026.3.1-3.2'、'45926' 语义是日期段/Excel 序列混杂,
        2026-10-07 用户口径 = 保持文本手填。

   幂等:按 (panel_code, place, col_name) 精确 UPDATE,已改过的重跑 = 0 行。
   两账套执行(先 HSDZ_MES,后 HSDZ_MES_TEST)。
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
GO

DECLARE @n int;

UPDATE yj_field SET data_type = N'日期'
WHERE data_type <> N'日期' AND (
      (panel_code = 'RD_INSTR_USE'   AND place = 'detail' AND col_name = N'使用日期')
   OR (panel_code = 'RD_EQUIP_USE'   AND place = 'detail' AND col_name = N'使用日期')
   OR (panel_code = 'RD_DOM_TEST'    AND place = 'detail' AND col_name IN (N'日期', N'期望完成日期', N'预计完成日期'))
   OR (panel_code = 'RD_SPIKE_WATER' AND place = 'detail' AND col_name = N'测试日期')
   OR (panel_code = 'RD_MINERAL'     AND place = 'detail' AND col_name = N'测试日期')
   OR (panel_code = 'RD_ANTIBACT'    AND place = 'detail' AND col_name = N'测试日期')
   OR (panel_code = 'RD_SCALE'       AND place = 'detail' AND col_name = N'测试日期')
   OR (panel_code = 'RD_RO_PROTECT'  AND place = 'detail' AND col_name = N'测试日期')
);
SET @n = @@ROWCOUNT;
PRINT N'改成「日期」的字段行数: ' + CONVERT(nvarchar(10), @n);
GO

DECLARE @m int;
UPDATE yj_field SET data_type = N'时间区间'
WHERE data_type <> N'时间区间'
  AND panel_code = 'RD_INSTR_USE' AND place = 'detail' AND col_name = N'起止时间';
SET @m = @@ROWCOUNT;
PRINT N'改成「时间区间」的字段行数: ' + CONVERT(nvarchar(10), @m);
GO

-- 自检:这两类字段的最终状态(应为 日期 8 条 / 时间区间 1 条)
SELECT panel_code, place, col_name, label, data_type
FROM yj_field
WHERE (place = 'detail' AND col_name IN
        (N'使用日期', N'起止时间', N'日期', N'期望完成日期', N'预计完成日期', N'测试日期', N'测试时间'))
  AND panel_code IN ('RD_INSTR_USE','RD_EQUIP_USE','RD_DOM_TEST','RD_SPIKE_WATER','RD_MINERAL',
                     'RD_ANTIBACT','RD_SCALE','RD_RO_PROTECT','RD_ALKALINE','RD_SOAK','RD_DROP_PREC')
ORDER BY panel_code, seq;
GO
