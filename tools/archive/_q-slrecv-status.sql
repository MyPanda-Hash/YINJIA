SET NOCOUNT ON;
PRINT '== 当前 sl_recv 状态样例 ==';
SELECT TOP 3 单据编号, 单据状态, 审核人, 审核时间 FROM sl_recv ORDER BY id DESC;
PRINT '== 当前 QC_RECV 唯一状态行 ==';
SELECT panel_code, doc_no, shr, saved FROM yj_doc_status WHERE panel_code='QC_RECV';
PRINT '== 快照 sl_recv 有无审核痕迹列 ==';
SELECT TOP 3 单据编号, 单据状态, 审核人 FROM HSDZ_MES_RESTORE.dbo.sl_recv ORDER BY id DESC;
PRINT '== 快照 yj_doc_status 全体 panel 分布(前12) ==';
SELECT TOP 12 panel_code, COUNT(*) n FROM HSDZ_MES_RESTORE.dbo.yj_doc_status GROUP BY panel_code ORDER BY n DESC;
PRINT '== 供应商字段全景(快照 vs 当前) ==';
SELECT r.panel_code, r.col_name, r.hidden AS 快照h,
       (SELECT t.hidden FROM yj_field t WHERE t.panel_code=r.panel_code AND t.col_name=r.col_name AND t.place=r.place) AS 当前h
  FROM HSDZ_MES_RESTORE.dbo.yj_field r
 WHERE r.col_name IN (N'供应商代码', N'供应商编码') AND r.panel_code IN ('QC_INSP','QC_RECV','PU_ORDER','PURCHASE_IN')
 ORDER BY r.panel_code, r.col_name;
GO
