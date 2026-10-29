SET NOCOUNT ON;
-- 待结转里"三档全空"的物料:各自有没有历史/dm?同品名(不限定规格)在 plang 里有没有历史?
WITH t(dm,mc,gg) AS (SELECT * FROM (VALUES
 (N'B-46-13',N'折叠复合X烧结炭棒/滤芯',N'48*30*231'),
 (N'T063',N'X烧结炭棒/滤芯',N'48*30*242.5'),
 (N'T309',N'X烧结炭棒',N'32*12*112'),
 (N'C-95-12',N'1018项目/碱性炭棒',N'45*21*256.5'),
 (N'C-78-17',N'除铅烧结炭棒/滤芯Z092',N'35*10*141.8'),
 (N'C-78-15',N'除铅烧结炭棒/滤芯Z082',N'45*21*196.3品名：Z082 /料号：T105'),
 (N'T256',N'除铅烧结炭棒/滤芯Z022',N'32*10*153.1序号:Z022/物料编码:T021'),
 (N'D-01-33',N'碱性炭棒/滤芯',N'40*16*24'),
 (N'T315',N'S阻垢炭棒/滤芯',N'37*12*200'),
 (N'C-78-16',N'除铅烧结炭棒/滤芯Z083',N'45*21*147.3品名：Z083 /料号：T112'),
 (N'C-78-07',N'除铅烧结炭棒/滤芯Z007',N'38*10*152.2，Z007/T007'),
 (N'T258',N'除铅烧结炭棒/滤芯Z004',N'35*10*232.5序号Z004、物料编码T034'),
 (N'T254',N'除铅烧结炭棒/滤芯Z048',N'32*10*115序号:Z048/物料编码:T133'),
 (N'C-78-13',N'除铅烧结炭棒/滤芯Z018',N'57*30*74.8品名：Z018 /料号：T019/'),
 (N'C-108-01',N'A+级烧结炭棒/滤芯(A款)',N'60*30*278'),
 (N'C-90-01',N'A+级烧结炭棒/滤芯',N'34*12*125'),
 (N'T236',N'除重金属炭棒/滤芯',N'57*30*208'),
 (N'B-84-03',N'碱性矿化抑菌炭棒',N'28*12*219±0.5mm'),
 (N'C-23-11',N'PP复合A级炭棒/滤芯',N'63*42*498.5'),
 (N'C-23-10',N'X烧结阻垢炭棒/滤芯',N'63*40*498.5'),
 (N'B-92-18',N'PP复合阻垢炭棒/滤芯',N'34*16*206.5mm'),
 (N'B-92-19',N'PP复合阻垢炭棒/滤芯',N'40*21.5*118.5mm'),
 (N'B-92-20',N'复合湿法碳纤维阻垢滤芯',N'48.5*30*118.5mm'),
 (N'B-92-22',N'酸洗炭棒/滤芯',N'45*22*207'),
 (N'B-92-23',N'锶碱偏硅酸含锂炭棒',N'45*16*75.5±0.5mm')
) v(dm,mc,gg))
SELECT t.dm, t.mc, t.gg,
  (SELECT COUNT(*) FROM plang p WHERE p.dm=t.dm AND ISNULL(p.asp_cancel,'N')<>'Y') AS dm_history,
  (SELECT COUNT(*) FROM plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND p.mc=t.mc AND ISNULL(p.gg,N'')=t.gg) AS spec_history,
  (SELECT COUNT(*) FROM plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND p.mc=t.mc) AS name_history,
  (SELECT TOP 1 p.[工艺路线] FROM plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND p.mc=t.mc AND ISNULL(p.[工艺路线],N'')<>N'' ORDER BY p.pl_date DESC) AS name_last_route,
  (SELECT TOP 1 ISNULL(i.[工艺路线],N'') FROM bs_inv i WHERE i.[存货编码]=t.dm) AS inv_bound
FROM t ORDER BY t.mc, t.gg;