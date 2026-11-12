SELECT TOP 3 panel_code,label,col_name,data_type,ref_panel,ref_field,display_field,place,seq,required,hidden,visible FROM yj_field WHERE data_type=N'参照' AND ref_panel=N'QC_PROC_INSP';
SELECT TOP 3 panel_code,label,col_name,data_type,ref_panel,ref_field,display_field,place,seq FROM yj_field WHERE panel_code=N'FINISH_IN' AND data_type=N'参照';
