-- migrate-fix-qc-recv-ref-20260924.sql — 送料暂收单供应商参照回正+计量单位列序+存量回填(2026-09-24)
-- 根因:①sl-supplier-ref/supplier-ref-v2 的字段级 UPDATE 写死旧面板编码 SL_RECV,改名 QC_RECV 后重放 0 行命中,
--        参照被后续重放刷回 PARTNER(往来单位)——PARTNER 无 编码↔代码 联动词条,选单只带名称不带代码 → 断流;
--       ②QC_RECV 头「供应商」注册了两行重复;③明细「计量单位」seq=70 排到表格第一列(应随数量 240 之后)。
SET NOCOUNT ON;
-- ① 参照回正:供应商代码/供应商 → GFDA 供应商档案(dm_gf:dm 编码/mc 名称)
UPDATE yj_field SET ref_panel='GFDA', ref_field='dm', display_field='mc'
WHERE panel_code='QC_RECV' AND label=N'供应商代码' AND place LIKE '%header%' AND ISNULL(ref_panel,'')<>'GFDA';
UPDATE yj_field SET ref_panel='GFDA', ref_field='mc', display_field='mc'
WHERE panel_code='QC_RECV' AND label=N'供应商' AND place LIKE '%header%' AND ISNULL(ref_panel,'')<>'GFDA';
UPDATE yj_field SET ref_panel='GFDA', ref_field='mc', display_field='mc'
WHERE panel_code='QC_INSP' AND label=N'供应商' AND place LIKE '%header%' AND ISNULL(ref_panel,'')<>'GFDA';
GO
-- ② 删头「供应商」重复注册(同列同位保一行)
WHILE 1=1 BEGIN
  DECLARE @dup int = (SELECT TOP 1 id FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'供应商' AND place LIKE '%header%'
    AND id NOT IN (SELECT MIN(id) FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'供应商' AND place LIKE '%header%'));
  IF @dup IS NULL BREAK;
  DELETE FROM yj_field WHERE id=@dup;
END
GO
-- ③ 计量单位列序:70 → 245(数量 240 之后,与 QC_INSP 245 对齐)
UPDATE yj_field SET seq=245 WHERE panel_code='QC_RECV' AND col_name=N'计量单位' AND place LIKE '%detail%' AND seq<100;
GO
-- ④ 存量回填:暂收单/检验单 供应商代码 按名称反查供应商档案
UPDATE r SET r.供应商代码 = g.dm FROM sl_recv r JOIN dm_gf g ON g.mc = r.供应商
WHERE ISNULL(r.供应商代码,N'')=N'' AND ISNULL(r.供应商,N'')<>N''
  AND EXISTS (SELECT 1 FROM dm_gf g2 WHERE g2.mc = r.供应商);
UPDATE i SET i.供应商代码 = g.dm FROM qc_insp i JOIN dm_gf g ON g.mc = i.供应商
WHERE ISNULL(i.供应商代码,N'')=N'' AND ISNULL(i.供应商,N'')<>N''
  AND EXISTS (SELECT 1 FROM dm_gf g2 WHERE g2.mc = i.供应商);
GO
-- 自检
SELECT N'参照: '+panel_code+'.'+label+' → '+ISNULL(ref_panel,'-')+'.'+ISNULL(ref_field,'-')
FROM yj_field WHERE panel_code='QC_RECV' AND label IN (N'供应商',N'供应商代码') AND place LIKE '%header%';
SELECT N'回填后: 暂收空码 '+CAST(SUM(CASE WHEN ISNULL(供应商代码,N'')=N'' THEN 1 ELSE 0 END) AS varchar)+'/'+CAST(COUNT(*) AS varchar)
+', 检验空码 '+CAST((SELECT COUNT(*) FROM qc_insp WHERE ISNULL(供应商代码,N'')=N'') AS varchar)+'/'+CAST((SELECT COUNT(*) FROM qc_insp) AS varchar) FROM sl_recv;
SELECT N'计量单位 seq='+CAST(seq AS varchar) FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'计量单位' AND place LIKE '%detail%';
PRINT N'migrate-fix-qc-recv-ref-20260924 完成';
GO
