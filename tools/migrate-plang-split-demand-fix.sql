/* migrate-plang-split-demand-fix.sql(2026-10-05):切单需求核减补正(存量)
 *
 * 用户口径:「切单之后需求数量应该会改变才对,虽然追溯中的数量变了但是在当前生产工单页面没有改变」。
 * 根因:split 只减了 排产数量 pl_sl,父单 需求数量 xq_sl 未减;子单又各带一份需求 ⇒ 生产工单列表的
 *   「需求数量」看着没变、且家族需求被重复计(实测 MO-2026-10-0006:需求 960 / 排产 560,子单 400 → 1360)。
 * 本脚本补正**已存在的**切单父子对:父单需求 -= 子单需求,余量按 需求−排产 重算。
 *   判据(只对"尚未核减"的对生效,可重复执行):父单需求 ≥ 子单需求 + 父单排产。
 *   撤回方式(单条):UPDATE plang SET xq_sl = xq_sl + <子单需求> WHERE id=<父行id>  —— 或直接撤单后重切。
 * 幂等;两账套均执行。
 */
UPDATE p SET p.xq_sl = ISNULL(p.xq_sl,0) - ISNULL(c.xq_sl,0),
             p.yl = (ISNULL(p.xq_sl,0) - ISNULL(c.xq_sl,0)) - ISNULL(p.pl_sl,0),
             p.asp_user2 = N'切单需求核减补正', p.asp_time2 = GETDATE()
  FROM plang p
  JOIN plang c ON c.源工单行id = p.id AND ISNULL(c.asp_cancel,'N') <> 'Y'
 WHERE ISNULL(c.xq_sl,0) > 0
   AND ISNULL(p.xq_sl,0) >= ISNULL(c.xq_sl,0) + ISNULL(p.pl_sl,0)
   AND ISNULL(p.asp_user2,N'') NOT LIKE N'切单需求核减%';
GO
SELECT N'仍有需求重复计的切单对' AS 项, COUNT(*) AS n
  FROM plang p JOIN plang c ON c.源工单行id = p.id AND ISNULL(c.asp_cancel,'N')<>'Y'
 WHERE ISNULL(c.xq_sl,0) > 0 AND ISNULL(p.xq_sl,0) >= ISNULL(c.xq_sl,0) + ISNULL(p.pl_sl,0);
GO