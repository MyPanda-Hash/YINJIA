-- migrate-qcrecv-unit-field.sql — 送料暂收单补回「计量单位」明细字段(2026-09-24)
-- 事故:QC_RECV 的 计量单位 yj_field 行在 2026-09-23 首轮合并收敛期间丢失(13:23 快照已无,
-- 只剩 计量单位2),物理列与存量数据完好。字段注册缺失导致两跳流转全断:
--   订单.单位 →(同义词)→ 暂收.计量单位(新暂收 SL-0189/0190 单位空);
--   暂收.计量单位 →(同名)→ 检验.计量单位 → 入库.计量单位(IJ-0152/0153、PI-0146/0147 空)。
-- 处置:①注册 detail 位 计量单位(seq 245 紧随 数量240);
--      ②存量回填:同表同物料取非空值(单位是物料固有属性),覆盖三表空值行。
-- 幂等:NOT EXISTS + 只填空。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'计量单位' AND place LIKE '%detail%')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
VALUES ('QC_RECV', N'计量单位', N'计量单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 245, 90, 1, 0, 0, 1);
PRINT N'[qcrecv-unit] 字段注册: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
WITH m AS (SELECT 物料编码, MAX(计量单位) AS u FROM sl_recv_detail WHERE ISNULL(计量单位,N'')<>N'' GROUP BY 物料编码)
UPDATE l SET l.计量单位 = m.u FROM sl_recv_detail l JOIN m ON m.物料编码 = l.物料编码
 WHERE ISNULL(l.计量单位,N'')=N'' AND m.u IS NOT NULL;
PRINT N'[qcrecv-unit] 暂收回填: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
WITH m AS (SELECT 物料编码, MAX(计量单位) AS u FROM qc_insp_detail WHERE ISNULL(计量单位,N'')<>N'' GROUP BY 物料编码)
UPDATE l SET l.计量单位 = m.u FROM qc_insp_detail l JOIN m ON m.物料编码 = l.物料编码
 WHERE ISNULL(l.计量单位,N'')=N'' AND m.u IS NOT NULL;
PRINT N'[qcrecv-unit] 检验回填: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
WITH m AS (SELECT 存货编码, MAX(计量单位) AS u FROM bl_purchase_in WHERE ISNULL(计量单位,N'')<>N'' GROUP BY 存货编码)
UPDATE l SET l.计量单位 = m.u FROM bl_purchase_in l JOIN m ON m.存货编码 = l.存货编码
 WHERE ISNULL(l.计量单位,N'')=N'' AND m.u IS NOT NULL;
PRINT N'[qcrecv-unit] 入库回填: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
DECLARE @f int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'计量单位' AND place LIKE '%detail%' AND ISNULL(hidden,0)=0);
DECLARE @s int = (SELECT COUNT(*) FROM sl_recv_detail WHERE ISNULL(计量单位,N'')=N'');
DECLARE @i int = (SELECT COUNT(*) FROM qc_insp_detail WHERE ISNULL(计量单位,N'')=N'');
DECLARE @p int = (SELECT COUNT(*) FROM bl_purchase_in WHERE ISNULL(计量单位,N'')=N'');
IF @f <> 1 RAISERROR(N'[qcrecv-unit] 自检失败:字段行异常', 16, 1);
ELSE PRINT N'[qcrecv-unit] 自检通过:字段就位;剩余空单位 暂收/检验/入库 = ' + CAST(@s AS nvarchar(10)) + N'/' + CAST(@i AS nvarchar(10)) + N'/' + CAST(@p AS nvarchar(10)) + N' 行(无同物料非空值可推,需档案补)';
GO
