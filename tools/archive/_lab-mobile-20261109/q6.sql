SET NOCOUNT ON;
SELECT COL_LENGTH('rd_spike_water_head','手机照片') a, COL_LENGTH('rd_equip_use_head','手机照片') b, COL_LENGTH('rd_instr_use_head','手机照片') c;
GO
SELECT panel_code, col_name, label, data_type, place, seq, visible, hidden FROM yj_field WHERE col_name = N'手机照片';
GO
SELECT scope, ref_key, locale, text FROM yj_translation WHERE ref_key = N'手机照片';
GO
SELECT script_name, LEFT(content_hash,12) h, executed_at FROM yj_schema_log WHERE script_name = 'migrate-lab-mobile-20261109.sql';
GO
