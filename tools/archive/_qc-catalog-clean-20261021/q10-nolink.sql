SET NOCOUNT ON;
SELECT id, 单据编号, 物料编码, 物料批次, 来料数量, 来料检验单号, 备注, 检验人, 文件编码, 检验依据, 检验结论, 处理意见
FROM qc_insp_rec
WHERE ISNULL(来料检验单号,'')=''
ORDER BY id;
GO
-- do those match a canceled detail of a live insp doc?
SELECT r.id, r.单据编号, r.物料编码, r.物料批次,
  (SELECT TOP 1 dt.单据编号+'/'+ISNULL(dt.asp_cancel,'N') FROM qc_insp_detail dt
    WHERE dt.物料编码=r.物料编码 AND dt.批次号=r.物料批次 ORDER BY dt.id) match_detail,
  (SELECT TOP 1 r2.单据编号 FROM qc_insp_rec r2 WHERE r2.物料编码=r.物料编码 AND r2.物料批次=r.物料批次 AND r2.id<>r.id AND ISNULL(r2.来料检验单号,'')<>'') other_rec
FROM qc_insp_rec r WHERE ISNULL(r.来料检验单号,'')='' ORDER BY r.id;
