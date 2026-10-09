-- q-10-no-req-code.sql — 探针:找一个**在商品档案里、但来料检验要求里没有**的编码(旧探针第⑥步要用)
SELECT TOP 8 i.存货编码, i.存货名称
FROM bs_inv i
WHERE ISNULL(i.停用, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM qc_insp_req r WHERE r.物料编号 = i.存货编码)
  AND ISNULL(i.存货编码, N'') <> N''
ORDER BY i.存货编码;
