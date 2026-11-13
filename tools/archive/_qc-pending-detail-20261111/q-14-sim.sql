SET NOCOUNT ON;
PRINT N'=== 模拟 QueryService.queryFlat 生成的取数 SQL(测试库) ===';
SELECT t.id AS __id, t.[单据日期], t.[检验数据记录单号], t.[来料检验单号], t.[来料检验单行号],
       t.[检验状态], t.[采购订单号], t.[送料暂收单号], t.[采购入库单号], t.[目录单号], t.[目录行id]
FROM v_qc_insp_rec_detail t
WHERE ISNULL(t.asp_cancel,'N')<>'Y'
ORDER BY t.[单据日期] DESC, t.id DESC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY;

PRINT N'=== 计数(带日期排序列前提) ===';
SELECT COUNT(*) AS n FROM v_qc_insp_rec_detail t WHERE ISNULL(t.asp_cancel,'N')<>'Y';

PRINT N'=== asp_cancel 分布 ===';
SELECT ISNULL(asp_cancel,'(null)') AS c, COUNT(*) n FROM v_qc_insp_rec_detail GROUP BY asp_cancel;
