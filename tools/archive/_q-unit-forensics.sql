SET NOCOUNT ON;
PRINT '== ① 快照里 QC_RECV 有没有 计量单位 字段行 ==';
SELECT panel_code, col_name, place, hidden, visible FROM HSDZ_MES_RESTORE.dbo.yj_field
 WHERE panel_code IN ('QC_RECV','SL_RECV') AND col_name LIKE N'%单位%';
PRINT '== ② 最新 6 行暂收明细的单位 ==';
SELECT TOP 6 单据编号, 物料编码, 计量单位, 数量 FROM sl_recv_detail ORDER BY id DESC;
PRINT '== ③ 退回/检验的仓库列 ==';
SELECT CASE WHEN COL_LENGTH('dbo.qc_return_detail',N'仓库') IS NULL THEN '缺列' ELSE '有列' END AS 退货仓库列,
       CASE WHEN COL_LENGTH('dbo.qc_insp_detail',N'仓库代码') IS NULL THEN '缺列' ELSE '有列' END AS 检验仓库代码列;
GO
