package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * **手机端 / 外部报工吸收**(2026-10-17 用户报障:「手机端报工不生成工序报工单,直接产生数据,
 * 完工量超过当前工序计划量后**不进入下一个生产线**」)。
 *
 * <h3>为什么需要它</h3>
 * 参考库(旧系统)的 PDA/手机扫码报工是**绕过 MES 直接写 {@code scjl}** 的:
 * 它不生成 MES 的工序报工单,因此不会经过 {@code ButtonService.runWoAuditHooks} ——
 * 于是这一串「审核后副作用」从未执行:
 * <ol>
 *   <li>{@code woReport.post}(补排产镜像:{@code gd_id}/产线/班组/批次/客户/产品…);</li>
 *   <li>{@code processTask.onReport}(工序任务回写 + 工单状态推进);</li>
 *   <li>{@code processTask.applyNextProcess}(**转序派线**:前道完工 → 把工单切到下一道的预排线)。</li>
 * </ol>
 * 表现就是:看板能算出完工量({@code scjl} 是活数据、纯查询),但工单**卡在当前线不动**、
 * {@code plang.当前工序/完工状态} 不推进。**与「报工行没有生产线记录」无关** ——
 * 转序读的是 {@code plang_pc.scx}/{@code plang.scx} 与预排台账 {@code wo_process_line.计划生产线},
 * 从不读 {@code scjl.scx};{@code scjl.scx} 为空只会让报工记录少一列、入库/流水取错仓。
 *
 * <h3>它做什么</h3>
 * 扫描 {@code scjl} 里「外部直写」的完工行 → <b>不做审核、不校验封顶</b>(数据已是既成事实,
 * 超产也照收)→ ① 定位工单行(三级锚)② 补镜像(**只补空值**,不覆盖手机端已写内容)→
 * ③ 推进 {@code plang.当前工序/完工状态} → ④ 走与报工审核**完全相同**的转序派线 →
 * ⑤ **按报工量出检验单**(2026-10-18):该工序累计已报工 ≥ 该道计划量即生成对应检验单草稿
 * (成型 → 首件 + 制程;组装 → 组装成品),见 {@link QcInspAutoService}。
 *
 * <h3>幂等</h3>
 * 无需标记表:补镜像只补空值;状态推进是重算;转序按台账状态机(计划→已落实)推进,
 * 同一道不会重复切线。重复扫描同一批行是安全的(所以定时任务可以每分钟跑)。
 *
 * <h3>边界(如实提示,不猜)</h3>
 * <ul>
 *   <li>定位不到唯一工单行 → 跳过并给出原因(不猜行,与 {@code WoReportService} 同口径);</li>
 *   <li>该行没有排产记录({@code plang_pc})→ 跳过并提示先排产;</li>
 *   <li>该行**没有预排台账**({@code wo_process_line} 无「计划」行,例如工单是手机端排的、
 *       MES 侧没排过全程线)→ 状态照推,转序只能返回「请人工派线」,
 *       因为"下一道用哪条线"这个信息只存在于预排台账里(不在 {@code scjl}/{@code plang} 里)。</li>
 * </ul>
 */
@Service
public class ExternalReportAbsorbService {

    private static final Logger log = LoggerFactory.getLogger(ExternalReportAbsorbService.class);

    /** 默认只吸收最近 N 天(不回放历史账,避免动到老数据) */
    public static final int DEFAULT_DAYS = 3;
    private static final int MAX_DAYS = 90;
    /**
     * 单次最多处理多少行(2026-10-18):定时任务每分钟一跑,一次处理几百行会把一个 tick 拉成分钟级,
     * 期间锁一直握着 ⇒ 前端查询跟着等。超出的留到下一分钟(候选行按 id 升序,先来先处理,不会饿死)。
     */
    private static final int MAX_ROWS_PER_TICK = 100;

    private final JdbcTemplate jdbc;
    private final ProcessTaskService processTask;
    /** 检验单数据驱动出单(成型/组装累计报工达计划量即出草稿;2026-10-18) */
    private final ButtonService buttonService;
    /** 逐行事务(REQUIRES_NEW):一行一个事务,避免长事务跨行持锁,见 {@link #absorb(Integer, String, boolean)} */
    private final org.springframework.transaction.support.TransactionTemplate rowTx;

    /**
     * 已成功吸收过的 {@code scjl.id}(**进程内**记忆)。
     *
     * <p>为什么需要:定时任务每分钟跑一次,而候选行按"最近 N 天"筛 —— 一天下来的手机端报工全在窗口里,
     * 每分钟把它们重算一遍纯属浪费(状态推进/转序虽幂等,但成百上千行的重算是白烧库)。
     * 新报工是**新行**(新 id),所以记过的行不需要再看。
     * <p>跳过/失败的**不记**:等人工在快速排产排线、或补齐工单行号后,下个周期自然能吸收成功。
     * <p>进程重启后记忆清空 ⇒ 全窗口重算一次(幂等,可接受);手工端点({@code force=true})总是重算。
     */
    private final java.util.Set<Long> absorbedIds =
            java.util.Collections.newSetFromMap(new java.util.LinkedHashMap<Long, Boolean>() {
                @Override
                protected boolean removeEldestEntry(Map.Entry<Long, Boolean> eldest) {
                    return size() > 20000;
                }
            });

    public ExternalReportAbsorbService(JdbcTemplate jdbc, ProcessTaskService processTask,
                                       ButtonService buttonService,
                                       org.springframework.transaction.PlatformTransactionManager txManager) {
        this.jdbc = jdbc;
        this.processTask = processTask;
        this.buttonService = buttonService;
        this.rowTx = new org.springframework.transaction.support.TransactionTemplate(txManager);
        this.rowTx.setPropagationBehavior(
                org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.rowTx.setTimeout(30);   // 单行 30s 上限:再慢也不许把 tick 拖死
    }

    /**
     * 候选行 = 外部直写的**已完工**报工行。
     *
     * <p>判据(缺一不可):
     * <ul>
     *   <li>{@code wgzt='Y'}(已完工;草稿不吸收)、未作废、未删;</li>
     *   <li>{@code gldh} 非空、{@code sc_date} 在最近 N 天内(默认 3 天,不回放历史);</li>
     *   <li>**MES 侧没有已审核的这张报工单** —— 报工单号为空(手机端常态),
     *       或该单号在 {@code yj_doc_status} 里查不到 {@code shr}(没走过 MES 审核)。</li>
     * </ul>
     * 已走过 MES 审核的行不在候选里(那批的钩子本来就跑过了)。
     */
    private static final String CANDIDATE_SQL =
            "SELECT s.id AS scjl_id, ISNULL(s.gldh,N'') AS 工单号, ISNULL(s.gxdm,N'') AS 工序,"
                    + " ISNULL(s.sl,0) AS 数量, ISNULL(s.[批次号],N'') AS 批次号,"
                    + " ISNULL(s.[工单行号],0) AS 行号, ISNULL(s.gd_id,0) AS gd_id,"
                    + " ISNULL(s.[报工单号],N'') AS 报工单号"
                    + " FROM dbo.scjl s"
                    + " WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.delmark,0)=0"
                    + "   AND ISNULL(s.wgzt,'N')='Y' AND ISNULL(s.gldh,N'')<>N''"
                    + "   AND (s.sc_date IS NULL OR s.sc_date >= DATEADD(day, ? * -1, CAST(GETDATE() AS date)))"
                    + "   AND (ISNULL(s.[报工单号],N'')=N''"
                    + "        OR NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status ds WHERE ds.panel_code=N'WO_REPORT'"
                    + "                       AND ds.doc_no=s.[报工单号] AND ds.shr IS NOT NULL))"
                    + " ORDER BY s.id";

    /** 扫描并吸收(定时任务与手动端点共用);返回汇总 + 逐行明细 */
    public Map<String, Object> absorb(Integer days, String user) {
        return absorb(days, user, false);
    }

    /**
     * @param force true = 忽略"已吸收"记忆、全部重算(手工端点用:人是显式来补跑的);
     *              false = 跳过本进程已成功吸收过的行(定时任务用)
     *
     * <p>🔴 **2026-10-18 改成「逐行独立事务」**(原:整个 {@code absorb} 一个 {@code @Transactional})。
     * 原因(用户报障「手机端报工后前端卡住,只能重新进入系统」):
     * 手机端小程序/参考库是**直连同一个库**写 {@code plang/scjl} 的,吸收过程要读写同一批行;
     * 原来一个事务跨「候选行」全程持有行锁 ——
     * ① 只要有一行被外部程序锁住(对方事务没提交),整个任务连同上一次的事务一起**无限等锁**
     *    (驱动默认 lockTimeout=-1),挂着的锁又把 MES 的列表查询一起钉死;
     * ② 一行出错会把整批回滚,下一分钟从头再来,永远卡同一行。
     * 现在:每行一个 REQUIRES_NEW 事务;锁等待超时(连接串 lockTimeout=8000)只跳过该行、下轮重试;
     * 单行失败不影响其它行;单次最多处理 {@link #MAX_ROWS_PER_TICK} 行,避免一个 tick 干太久。
     */
    public Map<String, Object> absorb(Integer days, String user, boolean force) {
        int d = days == null || days <= 0 ? DEFAULT_DAYS : Math.min(days, MAX_DAYS);
        String u = user == null || user.isBlank() ? "system(手机端报工吸收)" : user;
        List<Map<String, Object>> rows = jdbc.queryForList(CANDIDATE_SQL, d);
        List<Map<String, Object>> detail = new ArrayList<>();
        int done = 0, skipped = 0, failed = 0, cached = 0, truncated = 0, locked = 0;
        for (Map<String, Object> r : rows) {
            long scjlId = ((Number) r.get("scjl_id")).longValue();
            if (!force && absorbedIds.contains(scjlId)) { cached++; continue; }
            if (done + failed + locked >= MAX_ROWS_PER_TICK) { truncated++; continue; }
            Map<String, Object> one;
            try {
                // 每行独立事务:成功/失败都不牵连其它行,也不长时间占锁
                one = rowTx.execute(status -> absorbOne(r, u));
                if (one == null) one = new LinkedHashMap<>();
            } catch (org.springframework.dao.PessimisticLockingFailureException le) {
                // 锁等待超时(CannotAcquireLockException 是它的子类,SQL Server 1222)
                one = new LinkedHashMap<>();
                one.put("scjl_id", r.get("scjl_id"));
                one.put("工单号", r.get("工单号"));
                one.put("工序", r.get("工序"));
                one.put("已吸收", false);
                one.put("原因", "该行正被其它程序锁定（等锁超时，下轮自动重试）");
                locked++;
                log.info("[手机端报工吸收] scjl.id={} 工单={} 等锁超时,本次跳过 ({}):{}",
                        r.get("scjl_id"), r.get("工单号"), r.get("工序"), le.getMessage());
            } catch (Exception e) {
                one = new LinkedHashMap<>();
                one.put("scjl_id", r.get("scjl_id"));
                one.put("工单号", r.get("工单号"));
                one.put("工序", r.get("工序"));
                one.put("已吸收", false);
                one.put("原因", "吸收失败:" + e.getMessage());
                log.warn("[手机端报工吸收] scjl.id={} 工单={} 吸收失败:{}", r.get("scjl_id"), r.get("工单号"), e.getMessage());
            }
            detail.add(one);
            if (Boolean.TRUE.equals(one.get("已吸收"))) {
                done++;
                absorbedIds.add(scjlId);
                // 检验单(2026-10-18 用户口径「只要报工数量达到要求就进入下一步」):
                //   在本行吸收事务**提交之后**再出单 —— 判据/单头组装在 QcInspAutoService,
                //   同一条数据既喂转序也喂检验单。失败只记回执,不推翻已提交的吸收。
                try {
                    one.put("检验单", buttonService.generateInspFromReportRow(scjlId, u));
                } catch (Exception e) {
                    one.put("检验单", "生成失败:" + e.getMessage());
                    log.warn("[手机端报工吸收] scjl.id={} 检验单生成失败(吸收已保留):{}",
                            scjlId, e.getMessage());
                }
            } else if (String.valueOf(one.get("原因")).startsWith("吸收失败")) failed++;
            else if (!String.valueOf(one.get("原因")).startsWith("该行正被其它程序锁定")) skipped++;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("扫描天数", d);
        out.put("候选行", rows.size());
        out.put("已吸收", done);
        out.put("已吸收(跳过重算)", cached);
        out.put("跳过", skipped);
        out.put("等锁跳过", locked);
        out.put("失败", failed);
        out.put("本次上限外未处理", truncated);
        out.put("明细", detail);
        if (locked > 0) {
            log.warn("[手机端报工吸收] 本轮有 {} 行因等锁超时跳过(外部程序占着数据行);"
                    + "若持续出现,说明手机端/参考库那边有长事务未提交", locked);
        }
        return out;
    }

    /** 吸收单行(候选行 → 锚行 → 补镜像 → 推进状态 → 转序) */
    private Map<String, Object> absorbOne(Map<String, Object> r, String user) {
        long scjlId = ((Number) r.get("scjl_id")).longValue();
        String wo = String.valueOf(r.get("工单号")).trim();
        String batch = r.get("批次号") == null ? "" : String.valueOf(r.get("批次号")).trim();
        int xc = ((Number) r.get("行号")).intValue();
        long gdId = ((Number) r.get("gd_id")).longValue();

        Map<String, Object> one = new LinkedHashMap<>();
        one.put("scjl_id", scjlId);
        one.put("工单号", wo);
        one.put("工序", r.get("工序"));
        one.put("数量", r.get("数量"));

        Long rowId = resolveRow(wo, batch, xc, gdId);
        one.put("工单行id", rowId);
        if (rowId == null) {
            one.put("已吸收", false);
            one.put("原因", "定位不到唯一工单行(缺 gd_id/工单行号,批次也不唯一)—— 需人工在报工记录里补齐工单行号");
            return one;
        }
        Map<String, Object> t = mirrorSource(rowId);
        if (t == null) {
            one.put("已吸收", false);
            one.put("原因", "该工单行没有排产记录(plang_pc 缺行),无法补产线/批次 —— 请先排产");
            return one;
        }
        // 已结案的工单行不推进(与「报工审核」同口径:结案单不能再报工/转序)。
        // ⚠ 2026-10-18:判据改走 {@link PlangClose} —— ja 是外部程序也能直写的列,
        //   被外部乱写成 Y(入库却是 0)的行不该因此"吸收不动"(那会让现场觉得扫码没反应)。
        String ja = t.get("ja") == null ? "N" : String.valueOf(t.get("ja")).trim();
        double plSl = t.get("pl_sl") == null ? 0 : ((Number) t.get("pl_sl")).doubleValue();
        double rkSl = t.get("rk_sl") == null ? 0 : ((Number) t.get("rk_sl")).doubleValue();
        String woNo = t.get("pl_no") == null ? "" : String.valueOf(t.get("pl_no"));
        boolean closed = ("T".equals(ja) || "Y".equals(ja))
                && ((plSl > 0 && rkSl >= plSl) || woNo.startsWith("GD2608"));
        if (closed) {
            one.put("已吸收", false);
            one.put("原因", "该工单行已结案,不吸收(历史账不动)");
            return one;
        }
        mirrorFillEmpty(scjlId, t, wo, user);
        // 产线值体检(2026-10-18):手机端会把**非产线值**写进 scjl.scx —— 实测正式库
        //   GD-2026-10-0220 的两行手机报工 scx='0'(像是把公司代码写进来了),而补镜像只补空值,
        //   错值会一直留着 ⇒ 入库判仓/产线报表按它取就取错。这里只在「现值不是有效产线」时纠正。
        String lineFix = repairInvalidLine(scjlId, t);
        if (lineFix != null) one.put("产线纠正", lineFix);
        // 补「工单行产线」:手机端(参考库)排产只把线写进 plang_pc,**plang.scx 常常是空的** ——
        //   而转序/调拨看的是 plang.scx(当前线):空值会导致转序轨迹的「从生产线」为空、
        //   看板「按线筛选」与工单列表产线两处口径不一致。这里按排产行的线补齐(**只补空值**,
        //   绝不覆盖现役产线)。实测(测试库 GD-TEST-ABSORB-01):补前 plang.scx 空、plang_pc.scx=1号机。
        String pcLine = t.get("pc_scx") == null ? "" : String.valueOf(t.get("pc_scx")).trim();
        if (!pcLine.isEmpty()) {
            int n = jdbc.update("UPDATE dbo.plang SET scx=?, asp_user2=?, asp_time2=GETDATE()"
                    + " WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(scx,N'')=N''", pcLine, user, rowId);
            if (n > 0) one.put("补齐工单行产线", pcLine);
        }
        one.put("生产线", pcLine);
        // ① 推进工单行状态(当前工序/当前工序完工量/完工状态/完工时间)
        processTask.syncWorkOrderState(wo, rowId, user);
        // ② 转序派线(与报工审核同一条路:台账「计划」道 → 计划生产线)
        Map<String, Object> next = processTask.applyNextProcess(wo, rowId, user);
        one.put("转序", next == null || next.isEmpty() ? "无" : next);
        one.put("已吸收", true);
        log.info("[手机端报工吸收] scjl.id={} 工单={} 行id={} 工序={} → 已推进{}", scjlId, wo, rowId, r.get("工序"), next);
        return one;
    }

    /**
     * **产线值体检/纠正**(2026-10-18)。
     *
     * <p>为什么需要:手机端(小程序/参考库)在报工行上写的 {@code scx} 不一定是我们产线档案里的值 ——
     * 实测正式库 GD-2026-10-0220 的两行手机报工写的是 {@code scx='0'}(看着像把公司代码写进了产线列)。
     * 吸收的补镜像**只补空值**,所以这种错值会一路留着,而入库判仓/产线报表正是按 {@code scx} 取数。
     *
     * <p>口径(保守,只纠**明显无效**的值):
     * <ol>
     *   <li>空值 → 交给 {@link #mirrorFillEmpty} 补,这里不动;</li>
     *   <li>值在 {@code bs_prod_line.生产线} 里(未作废)→ 合法,不动;</li>
     *   <li>不在档案里 + 排产行有合法产线 → 改成排产线(并同步 {@code scxmc}),记入回执;</li>
     *   <li>不在档案里 + 排产行也没有合法产线 → **不猜**,原样留着(只会在回执里看到"产线非法")。</li>
     * </ol>
     * @return 纠正后的产线值;不需要纠正时返回 null
     */
    private String repairInvalidLine(long scjlId, Map<String, Object> t) {
        List<String> cur = jdbc.queryForList("SELECT TOP 1 ISNULL(scx,N'') FROM dbo.scjl WHERE id=?", String.class, scjlId);
        String now = cur.isEmpty() || cur.get(0) == null ? "" : cur.get(0).trim();
        if (now.isEmpty()) return null;
        if (lineExists(now)) return null;
        String pcLine = t.get("pc_scx") == null ? "" : String.valueOf(t.get("pc_scx")).trim();
        if (pcLine.isEmpty() || !lineExists(pcLine)) {
            log.info("[手机端报工吸收] scjl.id={} 产线值「{}」不在产线档案里,且排产行无合法产线 ⇒ 不猜,原样保留", scjlId, now);
            return null;
        }
        jdbc.update("UPDATE dbo.scjl SET scx=?, scxmc=?, asp_time2=GETDATE() WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'",
                pcLine, pcLine, scjlId);
        log.info("[手机端报工吸收] scjl.id={} 产线值「{}」不是有效产线 ⇒ 按排产线改为「{}」", scjlId, now, pcLine);
        return pcLine;
    }

    /** 产线档案里是否有这条线(未作废且未停用仍算有效,停用线不纠成它) */
    private boolean lineExists(String line) {
        if (line == null || line.isBlank()) return false;
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.bs_prod_line WHERE 生产线=? AND ISNULL(asp_cancel,'N')<>'Y'",
                Integer.class, line.trim());
        return n != null && n > 0;
    }

    /**
     * 工单行定位(三级,与 {@code WoReportService.complete()} / {@code reportRows} 同口径,取不到**不猜**):
     * ① {@code gd_id}(=plang_pc.id)→ plang_pc.plang_id;
     * ② 工单号 + 工单行号(恰命中 1 行才认);
     * ③ 工单号 + 批次号(恰命中 1 行才认)。
     */
    private Long resolveRow(String wo, String batch, int xc, long gdId) {
        if (gdId > 0) {
            List<Long> r1 = jdbc.queryForList(
                    "SELECT TOP 1 pc.plang_id FROM dbo.plang_pc pc"
                            + " JOIN dbo.plang p ON p.id = pc.plang_id AND ISNULL(p.asp_cancel,'N')<>'Y'"
                            + " WHERE pc.id=?", Long.class, gdId);
            if (!r1.isEmpty() && r1.get(0) != null) return r1.get(0);
        }
        if (xc > 0) {
            List<Long> r2 = jdbc.queryForList(
                    "SELECT id FROM dbo.plang WHERE pl_no=? AND ISNULL(pl_xc,0)=?"
                            + " AND ISNULL(asp_cancel,'N')<>'Y'"
                            + " AND (? = N'' OR ISNULL([批次号],N'') = ?) ORDER BY id",
                    Long.class, wo, xc, batch, batch);
            if (r2.size() == 1) return r2.get(0);
        }
        if (!batch.isEmpty()) {
            List<Long> r3 = jdbc.queryForList(
                    "SELECT id FROM dbo.plang WHERE pl_no=? AND ISNULL([批次号],N'')=?"
                            + " AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id",
                    Long.class, wo, batch);
            if (r3.size() == 1) return r3.get(0);
        }
        return null;
    }

    /** 镜像来源(该工单行的排产行 plang_pc × 工单行 plang;有产线的排产行优先) */
    private Map<String, Object> mirrorSource(Long rowId) {
        List<Map<String, Object>> rs = jdbc.queryForList(
                "SELECT TOP 1 pc.id AS pc_id, ISNULL(pc.[批次号],N'') AS pc_batch, ISNULL(pc.scx,N'') AS pc_scx,"
                        + " ISNULL(pc.lb,N'') AS pc_lb, ISNULL(p.comm,N'') AS comm, ISNULL(p.dm,N'') AS dm,"
                        + " ISNULL(p.mc,N'') AS mc, ISNULL(p.gg,N'') AS gg, ISNULL(p.jldw,N'') AS jldw,"
                        + " ISNULL(p.khdm,N'') AS khdm, ISNULL(p.lot_no,N'') AS lot_no, ISNULL(p.pl_sl,0) AS pl_sl,"
                        + " ISNULL(p.rk_sl,0) AS rk_sl, ISNULL(p.pl_no,N'') AS pl_no,"
                        + " ISNULL(p.od_no,N'') AS od_no, p.od_xc, ISNULL(p.zl,0) AS zl, ISNULL(p.llxz,N'') AS llxz,"
                        + " ISNULL(p.djlx,N'') AS djlx, p.pl_xc AS pl_xc, ISNULL(p.ja,N'N') AS ja"
                        + " FROM dbo.plang_pc pc JOIN dbo.plang p ON pc.plang_id = p.id AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + " WHERE pc.plang_id=? AND ISNULL(pc.asp_cancel,'N')<>'Y'"
                        + " ORDER BY CASE WHEN ISNULL(pc.scx,N'')<>N'' THEN 0 ELSE 1 END, pc.id", rowId);
        return rs.isEmpty() ? null : rs.get(0);
    }

    /**
     * 补镜像(**只补空值**)。
     *
     * <p>与 {@code WoReportService.complete()} 的审核镜像**同一张列映射**,差别只有两点,都是刻意的:
     * <ul>
     *   <li>只补空列 ⇒ 不覆盖手机端已写的内容(手机端可能已写工单号/批次/数量);</li>
     *   <li>不写 {@code wgzt/wgsj}(手机端已经是完工态)、不写 {@code jc_no}
     *       —— 参考库的 {@code jc_no}=进厂编号(如 {@code Admin-261016}),
     *       与 MES 审核生成的「产线--yyMMdd-8位」产成品流水**不是同一个东西**,不能覆盖。</li>
     * </ul>
     */
    private void mirrorFillEmpty(long scjlId, Map<String, Object> t, String wo, String user) {
        jdbc.update("UPDATE dbo.scjl SET"
                        + " comm=ISNULL(NULLIF(comm,N''),?),"
                        + " gd_id=CASE WHEN ISNULL(gd_id,0)=0 THEN ? ELSE gd_id END,"
                        + " tm=ISNULL(NULLIF(tm,N''),?),"
                        + " scx=ISNULL(NULLIF(scx,N''),?),"
                        + " scxmc=ISNULL(NULLIF(scxmc,N''),?),"
                        + " jbbh=ISNULL(NULLIF(jbbh,N''),?),"
                        + " wzdm=ISNULL(NULLIF(wzdm,N''),?),"
                        + " mc=ISNULL(NULLIF(mc,N''),?),"
                        + " gg=ISNULL(NULLIF(gg,N''),?),"
                        + " jldw=ISNULL(NULLIF(jldw,N''),?),"
                        + " khdm=ISNULL(NULLIF(khdm,N''),?),"
                        + " lot_no=ISNULL(NULLIF(lot_no,N''),?),"
                        + " pl_sl=CASE WHEN ISNULL(pl_sl,0)=0 THEN ? ELSE pl_sl END,"
                        + " od_no=ISNULL(NULLIF(od_no,N''),?),"
                        + " od_xc=ISNULL(od_xc,?),"
                        + " zl=CASE WHEN ISNULL(zl,0)=0 THEN ? ELSE zl END,"
                        + " llxz=ISNULL(NULLIF(llxz,N''),?),"
                        + " djlx=ISNULL(NULLIF(djlx,N''),?),"
                        + " [批次号]=ISNULL(NULLIF([批次号],N''),?),"
                        + " [工单行号]=CASE WHEN ISNULL([工单行号],0)=0 THEN ? ELSE [工单行号] END,"
                        + " ywman=COALESCE(NULLIF(ywman,N''),?),"
                        + " asp_user2=?, asp_time2=GETDATE()"
                        + " WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'",
                t.get("comm"), t.get("pc_id"), wo, t.get("pc_scx"), t.get("pc_scx"), t.get("pc_lb"),
                t.get("dm"), t.get("mc"), t.get("gg"), t.get("jldw"), t.get("khdm"), t.get("lot_no"),
                t.get("pl_sl"), t.get("od_no"), t.get("od_xc"), t.get("zl"), t.get("llxz"), t.get("djlx"),
                t.get("pc_batch"), t.get("pl_xc"), user, user, scjlId);
    }
}
