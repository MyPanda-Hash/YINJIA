SET NOCOUNT ON;
-- d-06 表的创建时间(判断「建了又删」的历史轨迹)
SELECT name AS 表名, create_date AS 创建时间, modify_date AS 修改时间
FROM sys.tables
WHERE name IN (N'qc_recv',N'qc_recv_detail',N'sl_recv',N'sl_recv_detail',N'qc_insp',N'qc_insp_detail',
               N'qc_return',N'qc_return_detail',N'qc_tc',N'qc_tc_detail',N'qc_jjf',N'yj_doc_batch',
               N'yj_app_setting',N'yj_plan_term',N'qr_batch_registry',N'bs_inv',N'bd_other_in',N'bd_other_out',
               N'yj_lot_seq',N'erp_imp_log',N'erp_imp_row')
ORDER BY create_date;
GO
-- d-06b 批次号列的落点与类型
SELECT t.name AS 表名, c.name AS 列名, ty.name AS 类型, c.max_length AS 长度
FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.name = N'批次号' ORDER BY t.name;
GO
-- d-06c 当前是否还有「是否来料检验」「来料检验」列(C7/P-L 检验标志反复)
SELECT COL_LENGTH('bs_inv',N'是否来料检验') AS bs_inv_是否来料检验,
       COL_LENGTH('bs_inv',N'来料检验') AS bs_inv_来料检验,
       COL_LENGTH('bs_inv',N'检验方式') AS bs_inv_检验方式,
       COL_LENGTH('bs_inv',N'是否检验') AS bs_inv_是否检验,
       COL_LENGTH('bs_inv',N'数据来源') AS bs_inv_数据来源,
       COL_LENGTH('bs_inv',N'默认仓位') AS bs_inv_默认仓位,
       COL_LENGTH('bs_inv',N'预设库位') AS bs_inv_预设库位;
GO
-- d-06d 检验标志类字段在 INV 面板的注册现状
SELECT panel_code, col_name, label, data_type, place, editable, hidden, visible, dict_sql
FROM yj_field WHERE panel_code='INV'
  AND (col_name LIKE N'%检验%' OR col_name LIKE N'%来料%' OR col_name LIKE N'%仓位%' OR col_name LIKE N'%库位%')
ORDER BY seq;
GO
-- d-06e 批次台账与系统参数(C6/C10 批次实测数据)
SELECT TOP 20 * FROM yj_doc_batch ORDER BY id DESC;
GO
SELECT * FROM yj_app_setting;
GO
SELECT COUNT(*) AS 批次台账行数 FROM yj_doc_batch;
GO
SELECT status AS 状态, COUNT(*) AS 行数 FROM yj_doc_batch GROUP BY status;
GO
SELECT COUNT(*) AS link带批次号行数 FROM form_flow_link WHERE batch_no IS NOT NULL;
GO
