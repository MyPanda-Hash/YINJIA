-- q-01-dict.sql — 字典值翻译口径:看同类下拉值是否已有译名
SET NOCOUNT ON;
SELECT scope, ref_key, locale, text FROM yj_translation WHERE ref_key IN (N'合格', N'不合格', N'让步接收', N'进行中', N'草稿', N'已审核') AND locale = N'en';
SELECT N'-- QC_INSP 总结论字典' AS k, dict_sql FROM yj_field WHERE panel_code = N'QC_INSP' AND col_name = N'总结论';
SELECT N'-- RD_PROGRESS 状态字典' AS k, dict_sql FROM yj_field WHERE panel_code = N'RD_PROGRESS' AND col_name = N'状态' AND place = N'detail';
