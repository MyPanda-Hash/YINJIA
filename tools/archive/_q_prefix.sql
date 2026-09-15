SELECT lb, MAX(dh) AS maxdh FROM s_allno GROUP BY lb ORDER BY lb;
SELECT panel_code, prefix FROM yj_panel WHERE prefix IS NOT NULL ORDER BY prefix;
SELECT ref_panel, ref_field, display_field, COUNT(*) n FROM yj_field WHERE ref_panel IS NOT NULL GROUP BY ref_panel, ref_field, display_field ORDER BY ref_panel;
