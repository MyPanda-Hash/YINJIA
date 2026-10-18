SELECT id, gldh, [工单行号], gxdm, sl, ISNULL(scx,N'(空)') AS scx, ISNULL(scxmc,N'(空)') AS scxmc, gd_id, ISNULL([批次号],N'') AS batch
FROM dbo.scjl WHERE id IN (1085,1086,1089,1090) ORDER BY id;
