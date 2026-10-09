SET NOCOUNT ON; SELECT ref_key, locale, text FROM yj_translation WHERE scope='field' AND ref_key IN (N'仓位', N'仓位编码', N'仓库', N'默认仓位', N'是否默认', N'默认仓库') ORDER BY ref_key, locale;
