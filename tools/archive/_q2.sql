SET NOCOUNT ON;
-- 部门/仓库/计量单位 的 panel 域 en 译名是否存在(yj_translation)
SELECT ref_key, text FROM yj_translation WHERE scope='panel' AND locale='en' AND ref_key IN (N'部门',N'仓库',N'计量单位');
