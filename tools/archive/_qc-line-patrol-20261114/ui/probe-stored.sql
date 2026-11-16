/* 巡线检验(QC_LINE_PATROL)落库取证(只读):头表 + 明细逐块,证明界面填的值真进了 qc_line_patrol_head/_detail */
SET NOCOUNT ON;

SELECT 'HEAD' AS obj, 单据编号, 单据日期, 审核人, 单据状态,
       CONVERT(varchar(19), asp_time1, 120) AS 创建时间, asp_user1 AS 创建人
FROM qc_line_patrol_head
ORDER BY id DESC;

SELECT 'DETAIL' AS obj, h.单据编号, d.行号, d.巡线时间, d.车间, d.编号1, d.型号1,
       d.长度标准1, d.长度实测1, d.内径标准1, d.内径实测1, d.重量标准1, d.重量实测1,
       d.编号2, d.型号2, d.长度标准2, d.长度实测2, d.内径标准2, d.内径实测2, d.重量标准2, d.重量实测2,
       d.两液密度, d.表面状态, d.跌落强度, d.抗压强度, d.结果判定, d.巡线人员
FROM qc_line_patrol_detail d
JOIN qc_line_patrol_head h ON h.单据编号 = d.单据编号
ORDER BY h.单据编号 DESC, d.行号;

SELECT 'COUNTS' AS obj, (SELECT COUNT(*) FROM qc_line_patrol_head) AS 头表行数,
       (SELECT COUNT(*) FROM qc_line_patrol_detail) AS 明细行数;
