SET NOCOUNT ON;
SELECT DB_NAME() db,
 (SELECT COUNT(*) FROM yj_field WHERE col_name=N'手机照片' AND place=N'detail') detail_fields,
 (SELECT COUNT(*) FROM yj_field WHERE col_name=N'手机照片' AND place=N'header') header_fields,
 COL_LENGTH('rd_equip_use_head','手机照片') head_col, COL_LENGTH('rd_equip_use_detail','手机照片') detail_col;
GO
SELECT id, panel_code, doc_no, field_key, file_name FROM yj_attachment WHERE field_key LIKE N'手机照片%';
GO
SELECT id, 单据编号, 测试项目, 手机照片 FROM rd_equip_use_detail ORDER BY id;
GO
