SET NOCOUNT ON;
SELECT col_name, label, place, hidden FROM yj_field WHERE panel_code='INV' AND col_name IN (N'来料检验',N'商品类型',N'检验方式',N'是否来料检验');
SELECT 存货编码, LEFT(存货名称,10) AS nm, 所属类别, 来料检验, 商品类型 FROM bs_inv WHERE 存货编码='CL004';
SELECT COUNT(*) AS n, ISNULL(来料检验,'(空)') AS v FROM bs_inv GROUP BY 来料检验;
