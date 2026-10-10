SET NOCOUNT ON;
DECLARE @pi nvarchar(60)=N'PI-2026-10-0086', @tc nvarchar(60)=N'TCI-2026-10-0057';
DECLARE @bid int = (SELECT TOP 1 batch_id FROM form_flow_link WHERE target_form_no = @pi);
DECLARE @bn nvarchar(60) = (SELECT TOP 1 batch_no FROM form_flow_link WHERE batch_id = @bid AND ISNULL(batch_no,'') <> '');

PRINT N'链路批次键 batch_id = ' + CONVERT(nvarchar(20), @bid) + N';链路批次号 batch_no = ' + ISNULL(@bn, N'(无)');
PRINT N'';
PRINT N'══ 按 batch_id 反查(BatchService 广搜口径)══';
SELECT N'命中链路行数' AS 指标, CONVERT(nvarchar(10), COUNT(*)) AS 值 FROM form_flow_link WHERE batch_id = @bid AND link_status = 'ACTIVE'
UNION ALL SELECT N'其中含特采入库跳', CONVERT(nvarchar(10), COUNT(*)) FROM form_flow_link
   WHERE batch_id = @bid AND link_status = 'ACTIVE' AND target_form_no = @pi;

PRINT N'══ 按 batch_no 反查(BatchService.docsOfBatch 口径,form_flow_link.batch_no)══';
SELECT N'命中链路行数' AS 指标, CONVERT(nvarchar(10), COUNT(*)) AS 值 FROM form_flow_link WHERE batch_no = @bn
UNION ALL SELECT N'其中含特采入库跳', CONVERT(nvarchar(10), COUNT(*)) FROM form_flow_link
   WHERE batch_no = @bn AND target_form_no = @pi;

PRINT N'══ 结论:末跳(特采单→采购入库单)行上 batch_no 是否为 NULL ══';
SELECT source_panel_code AS 源面板, target_form_no AS 目标单,
       CASE WHEN ISNULL(batch_no, N'') = N'' THEN N'❌ NULL(按批次号反查会漏这一跳)' ELSE N'✅ 有值' END AS 判定
  FROM form_flow_link WHERE target_form_no IN (@pi, N'PI-2026-10-0050') ORDER BY id;
