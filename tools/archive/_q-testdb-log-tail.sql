/* 探针:测试账套上 4 个未登记脚本的效果是否随快照存在(决定 baseline 是否安全) */
SELECT CASE WHEN OBJECT_ID('yj_ext_bind_log') IS NOT NULL THEN N'yj_ext_bind_log 存在' ELSE N'yj_ext_bind_log 不存在!' END AS ext_bind_log,
       CASE WHEN COL_LENGTH('plang_pc','plang_id') IS NOT NULL THEN N'plang_pc.plang_id 存在' ELSE N'plang_pc.plang_id 不存在!' END AS plang_id,
       CASE WHEN COL_LENGTH('bs_inv','备用1') IS NOT NULL THEN N'bs_inv.备用1 存在' ELSE N'bs_inv.备用1 不存在!' END AS spare_col,
       CASE WHEN EXISTS(SELECT 1 FROM sys.extended_properties p
                          JOIN sys.columns c ON c.object_id=p.major_id AND c.column_id=p.minor_id
                         WHERE p.name='MS_Description' AND OBJECT_NAME(p.major_id)='bs_inv')
            THEN N'bs_inv 列注明存在' ELSE N'bs_inv 列注明不存在!' END AS col_comments;
SELECT COUNT(*) AS ledger_ref_ok FROM yj_field
 WHERE panel_code IN ('STOCK_LEDGER','STOCK_BALANCE') AND col_name IN (N'仓库',N'存货')
   AND ref_field IN (N'仓库编码',N'存货编码') AND data_type = N'参照';
