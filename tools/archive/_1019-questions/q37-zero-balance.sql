/* 月结完整性审计(结论见答复):
 * ① 月结行表 bl_stock_close(2026-09)= 2137 个键 —— 月结按钮确实把**全部**键都月结了;
 * ② 其中 1697 个键 结存 ≠ 0 ⇒ 全部写了结转行(缺 0 个,逐字对得上);
 * ③ 其中 440 个键 结存 = 0 ⇒ 按 2026-10-15 口径「数量为 0 就是删除这个批次号」不写结转行,
 *    而这 440 个键 9 月**都真有流水**(进来又全部领/调走,期初+入-出=0)。
 * ⇒ 「部分有结转行、部分没有」= 月末有没有余额的差别,不是漏月结。
 */
SELECT
  (SELECT COUNT(*) FROM bl_stock_close WHERE 期间='2026-09' AND ISNULL(asp_cancel,'N')<>'Y')                        AS 月结键数,
  (SELECT COUNT(*) FROM bl_stock_close WHERE 期间='2026-09' AND ISNULL(asp_cancel,'N')<>'Y' AND 结存数量<>0)          AS 有余额键数,
  (SELECT COUNT(*) FROM inh WHERE 单据类型=N'月结结转' AND ISNULL(asp_cancel,'N')<>'Y')                                AS 结转行数,
  (SELECT COUNT(*) FROM bl_stock_close WHERE 期间='2026-09' AND ISNULL(asp_cancel,'N')<>'Y' AND 结存数量=0)            AS 零余额键数
GO
/* 零余额键的展开:若照旧陈列 9 月原始单据,它们单独相加根本不等于结存(因为漏掉期初)
 * 例:YJ-SX-003-1/2 无批号 期初 11200 + 入 14000 - 出 25200 = 0;只看 9 月单据则是 -11200 —— 又一个错数 */
SELECT TOP 5 物料编码, 仓库编码, ISNULL(批号,N'(空)') AS 批号, 期初数量, 入库数量, 出库数量, 结存数量,
       (入库数量 - 出库数量) AS 只看9月单据的净额
FROM bl_stock_close
WHERE 期间='2026-09' AND ISNULL(asp_cancel,'N')<>'Y' AND 结存数量=0 AND 期初数量<>0
ORDER BY 期初数量 DESC
