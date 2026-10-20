SELECT panel_code, label, place, seq FROM yj_field
WHERE panel_code IN ('QC_BHG','QC_BHC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY','QC_TC_IN')
  AND place LIKE '%query%' AND ISNULL(visible,1)=1 AND ISNULL(hidden,0)=0
ORDER BY panel_code, seq, id
