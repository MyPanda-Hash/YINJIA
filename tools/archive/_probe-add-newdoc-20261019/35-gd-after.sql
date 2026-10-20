SET NOCOUNT ON;
SELECT MAX(dh) max_pool_gd, COUNT(*) n FROM s_allno WHERE lb='GD';
SELECT MAX(pl_no) max_plang FROM plang WHERE pl_no LIKE 'GD-%';
SELECT COUNT(*) missing FROM plang p WHERE RTRIM(p.pl_no) LIKE 'GD-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]' AND NOT EXISTS (SELECT 1 FROM s_allno s WHERE s.dh=p.pl_no);
