SET NOCOUNT ON;
/* 链参考库:登记跳过纯种子数据脚本(死列插入,与字段态无关)——哈希写当前文件真实值由外部计算 */
DELETE FROM yj_schema_log WHERE script_name = '_doc_part3_data.sql';
SELECT script_name, LEFT(content_hash, 8) FROM yj_schema_log WHERE script_name LIKE '_doc_part%';
GO
