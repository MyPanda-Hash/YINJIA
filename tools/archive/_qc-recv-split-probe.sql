-- 临时探针:暂收单(QC_RECV)按商品档案「来料检验」分流生单 —— 现场核对
SET NOCOUNT ON;
GO
SELECT N'① sl_recv_detail 列' AS 区块, c.name AS 列名, t.name AS 类型, c.max_length AS 长度
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.sl_recv_detail')
  AND (c.name LIKE N'%物料%' OR c.name LIKE N'%存货%' OR c.name LIKE N'%编码%' OR c.name LIKE N'%规格%' OR c.name LIKE N'%数量%')
ORDER BY c.column_id;
GO
SELECT N'② yj_field QC_RECV' AS 区块, col_name, label, place, seq, ref_panel, ref_field, display_field
FROM yj_field WHERE panel_code = 'QC_RECV'
  AND (col_name LIKE N'%物料%' OR col_name LIKE N'%存货%' OR col_name LIKE N'%编码%' OR col_name LIKE N'%来料检验%')
ORDER BY place, seq;
GO
SELECT c.name AS bs_inv列, t.name AS 类型
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.bs_inv')
  AND (c.name LIKE N'%编码%' OR c.name LIKE N'%检验%' OR c.name LIKE N'%名称%')
ORDER BY c.column_id;
GO
SELECT N'③ bs_inv 来料检验分布' AS 区块, ISNULL(来料检验, N'<NULL>') AS 来料检验, COUNT(*) AS 行数
FROM bs_inv GROUP BY 来料检验 ORDER BY 行数 DESC;
GO
SELECT N'④ 暂收明细↔商品档案(物料编码=存货编码)' AS 区块, COUNT(*) AS 暂收明细行,
       SUM(CASE WHEN i.存货编码 IS NULL THEN 1 ELSE 0 END) AS 商品档案无对应,
       SUM(CASE WHEN i.来料检验 = N'是' THEN 1 ELSE 0 END) AS 来料检验是,
       SUM(CASE WHEN i.存货编码 IS NOT NULL AND ISNULL(i.来料检验, N'否') <> N'是' THEN 1 ELSE 0 END) AS 来料检验非是
FROM sl_recv_detail d LEFT JOIN bs_inv i ON i.存货编码 = d.物料编码;
GO
SELECT TOP 8 N'⑤ 暂收单样本' AS 区块, r.单据编号, r.批次号, COUNT(d.id) AS 行数,
       SUM(CASE WHEN i.来料检验 = N'是' THEN 1 ELSE 0 END) AS 检验行,
       SUM(CASE WHEN ISNULL(i.来料检验, N'否') <> N'是' THEN 1 ELSE 0 END) AS 免检行
FROM sl_recv r JOIN sl_recv_detail d ON d.单据编号 = r.单据编号
LEFT JOIN bs_inv i ON i.存货编码 = d.物料编码
GROUP BY r.单据编号, r.批次号, r.id ORDER BY r.id DESC;
GO
SELECT N'⑥ 暂收单 link' AS 区块, source_panel_code, target_panel_code, link_status, COUNT(*) AS 行数
FROM form_flow_link WHERE source_panel_code = 'QC_RECV'
GROUP BY source_panel_code, target_panel_code, link_status;
GO
