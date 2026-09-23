SET NOCOUNT ON;
-- d-09a 检验项目标准库 lib_code 分布(CONTEXT 声称 spec.test 48 + insp.plan 13 已入库)
SELECT lib_code AS 库编码, COUNT(*) AS 条目数, SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) AS 启用数 FROM yj_std_lib GROUP BY lib_code ORDER BY lib_code;
GO
SELECT lib_code, item_code, content FROM yj_std_lib WHERE lib_code IN ('spec.test','insp.plan');
GO
-- d-09b 库存三报表 仓库/存货 的 data_type(参照链是否接通)
SELECT panel_code, col_name, data_type, ref_panel, ref_field, display_field, place
FROM yj_field WHERE col_name IN (N'仓库',N'存货') AND panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY')
ORDER BY panel_code, col_name;
GO
-- d-09c 工序类型字典(bs_dict OP_TYPE)与 4 类口径对照
SELECT COL_LENGTH('bs_dict',N'字典类别') AS 有字典类别;
GO
SELECT * FROM bs_dict WHERE 字典类别='OP_TYPE';
GO
SELECT 工序编码, 工序名称, 工序类型, 关键工序 FROM bs_op ORDER BY 工序编码;
GO
-- d-09d 采购单二维码相关:PU_ORDER 面板字段里有二维码/条码吗
SELECT panel_code, col_name, label, data_type FROM yj_field
WHERE panel_code IN ('PU_ORDER','PURCHASE_IN','QC_RECV') AND (label LIKE N'%码%')
ORDER BY panel_code, seq;
GO
-- d-09e 客供料:是否有客供/来料性质字段与取值
SELECT panel_code, col_name, label, data_type, dict_sql FROM yj_field WHERE label LIKE N'%客供%' OR label LIKE N'%来料性质%';
GO
SELECT COUNT(*) AS OTHER_IN头行数 FROM bd_other_in;
SELECT COUNT(*) AS OTHER_OUT头行数 FROM bd_other_out;
GO
