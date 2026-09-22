SET NOCOUNT ON;
-- 侦查:QC_INSP 明细字段 seq 现状 + 特采 译名是否已有
SELECT N'1-QC_INSP 明细字段 seq' AS 段, col_name, label, seq, visible, hidden FROM yj_field
WHERE panel_code = 'QC_INSP' AND place LIKE '%detail%' ORDER BY seq;
SELECT N'2-特采 译名现状' AS 段, scope, ref_key, locale, text FROM yj_translation WHERE ref_key = N'特采';
SELECT N'3-QC_TC_IN 头字段 seq' AS 段, col_name, seq FROM yj_field WHERE panel_code='QC_TC_IN' AND place LIKE '%header%' ORDER BY seq;
SELECT N'4-检验单号/批次号 译名存在性' AS 段,
       (SELECT COUNT(*) FROM yj_translation WHERE scope='field' AND ref_key=N'检验单号' AND locale='en') AS 检验单号_en,
       (SELECT COUNT(*) FROM yj_translation WHERE scope='field' AND ref_key=N'批次号' AND locale='en') AS 批次号_en,
       (SELECT COUNT(*) FROM yj_translation WHERE scope='field' AND ref_key=N'批次键' AND locale='en') AS 批次键_en;
