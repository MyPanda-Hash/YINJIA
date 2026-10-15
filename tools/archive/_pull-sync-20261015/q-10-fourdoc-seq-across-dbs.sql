-- q-10-fourdoc-seq-across-dbs.sql — 四单 seq 形态跨库对比(判定 seq 被"×10 重排"发生在什么时期)
SET NOCOUNT ON;
SELECT DB_NAME() AS db, panel_code, COUNT(*) AS 行数,
       SUM(CASE WHEN seq % 10 = 0 THEN 1 ELSE 0 END) AS 十倍数行,
       MIN(seq) AS 最小seq, MAX(seq) AS 最大seq
FROM yj_field WHERE panel_code IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN')
GROUP BY panel_code ORDER BY panel_code;
GO
