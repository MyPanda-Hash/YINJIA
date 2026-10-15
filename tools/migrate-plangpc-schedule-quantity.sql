/* 修复排入产线后 plang_pc.pl_sl 默认为0。沿用原表,不改结构、不删插排产身份。
   只回填已存在、按 plang_id 精确锚定、主行有效且主行排产量>0的零数量排产记录。
   不按批次猜关联;不覆盖历史非零排产量(测试库存在历史分批行)。
   调线/报工历史 scjl.gd_id、创建人/时间保持不变。两账套执行,可重复运行。 */
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
-- 若本补丁早期执行命中了历史多批行,只撤回本补丁标记的数量回填,绝不动原有非零行。
UPDATE pc SET pc.pl_sl=0 FROM dbo.plang_pc pc
WHERE pc.asp_user2=N'qty-repair' AND ISNULL(pc.asp_cancel,'N')<>'Y'
 AND (SELECT COUNT(*) FROM dbo.plang_pc s WHERE s.plang_id=pc.plang_id AND ISNULL(s.asp_cancel,'N')<>'Y')>1;
DECLARE @expected int=(SELECT COUNT(*) FROM dbo.plang_pc pc JOIN dbo.plang p ON p.id=pc.plang_id
 WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(p.asp_cancel,'N')<>'Y'
 AND ISNULL(pc.scx,N'')<>N'' AND ISNULL(pc.pl_sl,0)=0 AND ISNULL(p.pl_sl,0)>0
 AND (SELECT COUNT(*) FROM dbo.plang_pc s WHERE s.plang_id=p.id AND ISNULL(s.asp_cancel,'N')<>'Y')=1);
UPDATE pc SET pc.pl_sl=p.pl_sl,pc.pl_sl2=p.pl_sl2,pc.xq_sl=p.xq_sl,pc.rk_sl=p.rk_sl,pc.yl=p.yl,
 pc.dm=p.dm,pc.mc=p.mc,pc.gg=p.gg,pc.gg2=p.gg2,pc.jldw=p.jldw,
 pc.dj=p.dj,pc.jine=p.jine,pc.zl=p.zl,pc.rk_no=p.rk_no,pc.ll_no2=p.ll_no2,pc.ja=p.ja,
 pc.asp_user2=N'qty-repair',pc.asp_time2=GETDATE()
FROM dbo.plang_pc pc JOIN dbo.plang p ON p.id=pc.plang_id
WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(p.asp_cancel,'N')<>'Y'
 AND ISNULL(pc.scx,N'')<>N'' AND ISNULL(pc.pl_sl,0)=0 AND ISNULL(p.pl_sl,0)>0
 AND (SELECT COUNT(*) FROM dbo.plang_pc s WHERE s.plang_id=p.id AND ISNULL(s.asp_cancel,'N')<>'Y')=1;
DECLARE @actual int=@@ROWCOUNT;
IF @actual<>@expected THROW 51000,N'排产数量回填行数与预检不符',1;
IF EXISTS(SELECT 1 FROM dbo.plang_pc pc JOIN dbo.plang p ON p.id=pc.plang_id
 WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(p.asp_cancel,'N')<>'Y'
 AND ISNULL(pc.scx,N'')<>N'' AND ISNULL(pc.pl_sl,0)=0 AND ISNULL(p.pl_sl,0)>0
 AND (SELECT COUNT(*) FROM dbo.plang_pc s WHERE s.plang_id=p.id AND ISNULL(s.asp_cancel,'N')<>'Y')=1)
 THROW 51000,N'排产零数量尚未修复',1;
COMMIT;
PRINT N'排产数量回填行数='+CONVERT(nvarchar(20),@actual);
-- 无有效主行/主行数量本身为0的记录只列出,不猜数。
SELECT pc.id,pc.plang_id,pc.pl_no,pc.pl_xc,pc.pl_sl AS 排产记录数量,p.pl_sl AS 工单排产数量
FROM dbo.plang_pc pc LEFT JOIN dbo.plang p ON p.id=pc.plang_id
WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'')<>N'' AND ISNULL(pc.pl_sl,0)<=0;
