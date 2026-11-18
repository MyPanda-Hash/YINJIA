SET NOCOUNT ON;
SELECT f.seq, f.label, f.col_name, f.place, f.visible, f.hidden, f.data_type
  FROM yj_field f WHERE f.panel_code = N'SALE_IN'
   AND (CHARINDEX('header', f.place) > 0 OR CHARINDEX('query', f.place) > 0)
 ORDER BY f.seq, f.id;