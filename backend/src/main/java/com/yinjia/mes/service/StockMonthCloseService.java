package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 库存**月结**(2026-10-15 用户口径落地)。
 *
 * <h3>业务口径(逐条对应用户要求)</h3>
 * <ol>
 *   <li><b>每月 1 号自动月结上个月</b> —— {@link StockMonthCloseScheduler}(cron {@code 0 20 0 1 * ?});
 *       手工入口 = 库存明细面板三按钮「上月月结 / 取消上月月结 / 重新月结」。</li>
 *   <li><b>按 (物料编码, 仓库编码, 批号) 汇总上月的入库数量(含上月结转来的量)</b> —— 结转行落在**次月 1 号**,
 *       故「本期间入库合计」天然含上月结转来的量。</li>
 *   <li><b>用上月所有入库数据循环运算、逐笔统计出库汇总</b> —— {@link #allocateFifo}:
 *       每笔出库按入库日期先进先出摊到具体批次,得出每批的**分摊出库量**与**最晚出库日期**;
 *       **缺批号的出库行回写**摊到的批号(跨批分摊的行不回写,数量留在结果里)。</li>
 *   <li><b>写进 inh 生成结转单据</b> —— {@code src=0} + {@code 单据类型='月结结转'} + {@code 单据编号=JZ-YYYYMM}
 *       + {@code 单据日期=次月1号},数量 = 期末结存;出库汇总同款写进月结行表。</li>
 *   <li><b>入/出库三步</b>:① 统计本期间出入库合计 ② kucun 有则改无则增 ③ 改库存余量 ——
 *       {@link #reconcileKucun} 按流水**幂等重算**(不是累加;累加会与审核钩子双计)。</li>
 * </ol>
 *
 * <h3>两条不可动摇的边界</h3>
 * <ul>
 *   <li><b>结转行不是库存增加</b>:它是期间期初的记账标记。{@code v_stock_movement} 已按
 *       {@code 单据类型<>'月结结转'} 排除它(见 {@code migrate-stock-month-close.sql} 头注 B),
 *       否则三张报表与成本引擎(对全部历史求和)会逐月翻倍。</li>
 *   <li><b>kucun 是幂等重算</b>:审核/弃审钩子已实时维护 kucun,月结只做「按流水重算到期末」的对账式回写
 *       (rkl/ckl = 截至期末累计,yl = 累计入 − 累计出)。因此重复月结不会改花库存;
 *       取消月结只删结转行 + 标记状态,**不回滚 kucun**(回滚反而会把它改错)。</li>
 * </ul>
 *
 * <h3>计算顺序(有依赖,别调换)</h3>
 * <pre>
 *   ① 汇总 期初/本期入/本期出          ② FIFO 分摊(会把缺批号出库行的批号回写 outh)
 *   ③ 用分摊结果覆盖「每键出库量」       ④ 写结转行(inh)  ⑤ kucun 幂等重算  ⑥ 月结头/行表
 * </pre>
 * ② 必须在 ⑤ 之前:回写批号改变了流水侧的键归集,⑤ 要按回写后的结果重算才对得上 ⑥ 的行快照。
 */
@Service
public class StockMonthCloseService {

    private static final Logger log = LoggerFactory.getLogger(StockMonthCloseService.class);

    /** 结转单据的固定标识:视图排除、取消月结都按这两个字符串识别 */
    public static final String CARRY_TYPE = "月结结转";
    public static final String CARRY_NO_PREFIX = "JZ-";

    private static final DateTimeFormatter PERIOD_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    private final JdbcTemplate jdbc;
    private final StockWarnService warn;

    public StockMonthCloseService(JdbcTemplate jdbc, StockWarnService warn) {
        this.jdbc = jdbc;
        this.warn = warn;   // 展开明细要带每个批次的预警数量(用户第十六轮)
    }

    // ==================== 期间工具 ====================

    /** 上月期间(自动月结与「上月月结」按钮的默认目标) */
    public static String prevPeriod(LocalDate today) {
        return YearMonth.from(today).minusMonths(1).format(PERIOD_FMT);
    }

    /** 校验并规范 'YYYY-MM' */
    public static String normPeriod(String period) {
        if (period == null || period.isBlank()) throw new IllegalArgumentException("缺少期间(格式 YYYY-MM)");
        try {
            return YearMonth.parse(period.trim(), PERIOD_FMT).format(PERIOD_FMT);
        } catch (Exception e) {
            throw new IllegalArgumentException("期间格式不对(应 YYYY-MM):" + period);
        }
    }

    static LocalDate periodStart(String period) { return YearMonth.parse(period, PERIOD_FMT).atDay(1); }

    /** 期间结束的次日(= 次月 1 号;结转行就落这一天) */
    static LocalDate periodEndExclusive(String period) { return YearMonth.parse(period, PERIOD_FMT).plusMonths(1).atDay(1); }

    static String carryNo(String period) { return CARRY_NO_PREFIX + period.replace("-", ""); }

    // ==================== 状态 ====================

    /**
     * 前端/面板用:上月期间与状态、最近月结记录、**顶部常驻提示**、更早未月结期间。
     *
     * <p>提示口径(用户 2026-10-15):「取消月结后,上面要一直有一串还没上月月结的提示」——
     * 只要**上月**不是「已月结」,{@code 提示} 就是一句能直接显示的话(取消月结后自然又出现);
     * 已月结时为 null(前端据此隐藏提示条)。更早的未月结期间单独列出(不补做,仅告知)。
     */
    public Map<String, Object> status() {
        String prev = prevPeriod(LocalDate.now());
        String prevState = periodState(prev);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("当前期间", LocalDate.now().format(PERIOD_FMT));
        out.put("上月期间", prev);
        out.put("建议期间", prev);              // 兼容旧字段名
        out.put("上月状态", prevState);
        out.put("建议期间状态", prevState);      // 兼容旧字段名
        out.put("提示", "已月结".equals(prevState) ? null
                : prev + " 还没月结,请先执行「上月月结」" + ("已取消".equals(prevState) ? "(该期间月结已被取消)" : "") + "。");
        out.put("最近月结", jdbc.queryForList(
                "SELECT TOP 12 期间, 状态, 结转单据编号, CONVERT(nvarchar(10), 结转日期, 120) AS 结转日期, 行数,"
                        + " 入库合计, 出库合计, 结存合计, 月结人,"
                        + " CONVERT(nvarchar(19), 月结时间, 120) AS 月结时间, 取消人,"
                        + " CONVERT(nvarchar(19), 取消时间, 120) AS 取消时间"
                        + " FROM bd_stock_close WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY 期间 DESC"));
        // 更早的未月结期间(排除上月本身):只告知,不提供补做
        out.put("更早未月结", jdbc.queryForList(
                "SELECT t.p AS 期间, t.行数 FROM ("
                        + "  SELECT LEFT(CONVERT(nvarchar(7), 单据日期, 120), 7) AS p, COUNT(*) AS 行数 FROM inh"
                        + "   WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,'') <> N'" + CARRY_TYPE + "'"
                        + "     AND 单据日期 >= '2000-01-01' GROUP BY LEFT(CONVERT(nvarchar(7), 单据日期, 120), 7)"
                        + " ) t WHERE t.p < ? AND NOT EXISTS (SELECT 1 FROM bd_stock_close c WHERE c.期间 = t.p"
                        + "   AND c.状态 = N'已月结' AND ISNULL(c.asp_cancel,'N') <> 'Y') ORDER BY t.p", prev));
        return out;
    }

    /** 期间状态:未月结 / 已月结 / 已取消 */
    public String periodState(String period) {
        String p = normPeriod(period);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 状态 FROM bd_stock_close WHERE 期间 = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id DESC", p);
        return rows.isEmpty() ? "未月结" : String.valueOf(rows.get(0).get("状态"));
    }

    // ==================== 月结 / 取消 / 重新月结 ====================

    /** 上月月结(月结指定期间)。该期间已月结时抛错;且**只允许结上个月这个完整月**(用户 2026-10-15 口径)。 */
    @Transactional
    public Map<String, Object> close(String period, String user) {
        String p = normPeriod(period);
        // 用户口径:「月结只能对上个月完整月才能月结」——不给本月(未完月)结,也不允许回头补做更早的期间
        // (历史未月结期间由面板顶部提示常驻,不做补做,避免"补做历史月"把相邻月份的结转对不上)。
        String allowed = prevPeriod(LocalDate.now());
        if (!p.equals(allowed)) {
            throw new IllegalStateException("只能对上个月(" + allowed + ")做月结;提交的是 " + p
                    + (p.compareTo(allowed) > 0 ? "(本月还没走完)" : "(历史期间不补做)"));
        }
        String state = periodState(p);
        if ("已月结".equals(state)) {
            throw new IllegalStateException("期间 " + p + " 已月结;要重做请用「重新月结」(会先取消再月结)");
        }
        LocalDate start = periodStart(p), endEx = periodEndExclusive(p);
        String no = carryNo(p), carryDate = endEx.toString();

        // ① 汇总:期初(期间开始前累计) / 本期入 / 本期出 —— 全部排除月结结转行(它是期初标记,不是新入库)
        Map<Key, Agg> aggs = new LinkedHashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT ISNULL(RTRIM(物料编码),N'') AS w, ISNULL(RTRIM(仓库编码),N'') AS c, ISNULL(RTRIM(批号),N'') AS l,"
                        + " CAST(SUM(数量) AS decimal(18,4)) AS q, MAX(物料名称) AS n1, MAX(规格型号) AS n2,"
                        + " MAX(计量单位) AS n3, MAX(仓库名称) AS n4"
                        + " FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,'') <> N'" + CARRY_TYPE + "'"
                        + " AND 单据日期 >= ? AND 单据日期 < ?"
                        + " GROUP BY ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N'')",
                start, endEx)) {
            Agg a = aggs.computeIfAbsent(Key.of(r), k -> new Agg());
            a.in = dec(r.get("q"));
            a.fillMeta(r);
        }
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT ISNULL(RTRIM(物料编码),N'') AS w, ISNULL(RTRIM(仓库编码),N'') AS c, ISNULL(RTRIM(批号),N'') AS l,"
                        + " CAST(SUM(数量) AS decimal(18,4)) AS q, MAX(物料名称) AS n1, MAX(规格型号) AS n2,"
                        + " MAX(计量单位) AS n3, MAX(仓库名称) AS n4"
                        + " FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 >= ? AND 单据日期 < ?"
                        + " GROUP BY ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N'')",
                start, endEx)) {
            Agg a = aggs.computeIfAbsent(Key.of(r), k -> new Agg());
            a.out = dec(r.get("q"));
            a.fillMeta(r);
        }
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT 物料编码 AS w, 仓库编码 AS c, 批号 AS l, CAST(SUM(数量) AS decimal(18,4)) AS q FROM ("
                        + "  SELECT 物料编码, 仓库编码, 批号, 数量 FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y'"
                        + "    AND ISNULL(单据类型,'') <> N'" + CARRY_TYPE + "' AND 单据日期 < ?"
                        + "  UNION ALL"
                        + "  SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 < ?"
                        + " ) t GROUP BY 物料编码, 仓库编码, 批号", start, start)) {
            aggs.computeIfAbsent(Key.of(r), k -> new Agg()).opening = dec(r.get("q"));
        }
        // 单价:取该键在期间内(或之前最近)的入库单价 —— 与 kucun.price 同源口径
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT w, c, l, px FROM (SELECT ISNULL(RTRIM(物料编码),N'') AS w, ISNULL(RTRIM(仓库编码),N'') AS c,"
                        + " ISNULL(RTRIM(批号),N'') AS l, 单价 AS px, ROW_NUMBER() OVER (PARTITION BY ISNULL(RTRIM(物料编码),N''),"
                        + " ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N'') ORDER BY 单据日期 DESC, id DESC) AS rn"
                        + " FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,'') <> N'" + CARRY_TYPE + "'"
                        + " AND 单价 IS NOT NULL AND 单据日期 < ?) x WHERE rn = 1", endEx)) {
            Agg a = aggs.get(Key.of(r));
            if (a != null) a.price = (BigDecimal) r.get("px");
        }

        // ② FIFO 循环运算(顺带回写缺批号出库行的批号)
        Fifo fifo = allocateFifo(start, endEx);

        // ③ 每键出库量以**分摊结果**为准(缺批号行被归位到真实批次上)
        BigDecimal sumIn = BigDecimal.ZERO, sumOut = BigDecimal.ZERO, sumEnd = BigDecimal.ZERO;
        List<Map<String, Object>> lines = new ArrayList<>();
        int lineNo = 0;
        for (Map.Entry<Key, Agg> e : aggs.entrySet()) {
            Key k = e.getKey();
            Agg a = e.getValue();
            BigDecimal out = fifo.allocOf(k);
            if (out == null) out = k.lot.isEmpty() ? BigDecimal.ZERO : a.out;
            a.out = out;
            BigDecimal end = a.opening.add(a.in).subtract(out);
            a.end = end;
            sumIn = sumIn.add(a.in);
            sumOut = sumOut.add(out);
            sumEnd = sumEnd.add(end);
            Map<String, Object> ln = line(k, a, fifo.lastOutOf(k));
            ln.put("行号", ++lineNo);
            lines.add(ln);
        }

        // ③.5 **并发闸门**(2026-10-15 用户发现「同一批次号出现两次月结」的根因):
        //   两次月结并发时会**各自通过**「未月结」状态检查,交错执行(后一次的 DELETE 夹在前一次的 INSERT 中间)
        //   ⇒ 尾巴上那一批结转行会被写两遍(实测 126 组重复,两行同一毫秒、id 相邻)。
        //   用 SQL Server 应用锁把「同一期间的月结/取消」串行化:拿不到锁直接失败,绝不写出脏数据。
        //   锁随事务释放(关闭月结是 @Transactional),不需要手工解锁。
        Integer got = jdbc.queryForObject(
                "DECLARE @r int; EXEC @r = sp_getapplock @Resource = ?, @LockMode = 'Exclusive',"
                        + " @LockOwner = 'Transaction', @LockTimeout = 0; SELECT @r",
                Integer.class, "monthclose:" + p);
        if (got == null || got < 0) {
            throw new IllegalStateException("期间 " + p + " 的月结正在执行中(另一个月结/取消还没结束),请稍后再试");
        }
        // ④ 写结转单(inh):**按 (物料编码, 仓库编码, 批号) 一行、批号照实写**;并且**只保留本月这一套结转**。
        //    用户 2026-10-15 第十三轮口径:
        //      · 「月结也要分不同批次号的月结,而且月结要带有批次号」⇒ 行按批次号拆,批号照实写(无批号的键留空);
        //      · 「每次月结要把上月月结数量带入进去,只显示前一个月的月结…只需要留有 9 月的月结,之前的 8 月月结不需要了」
        //        ⇒ ① 本月结转数量 = 该批次**至今累计期末**,而上月结转数量本身就是上月期末余额
        //             (期初 = 单据日期 < 本月 1 号的流水净额)⇒「把上月月结数量带入进去」天然成立;
        //          ② **删掉其它期间的结转行**(JZ-其它) ⇒ 台账只挂本月一套结转标记。
        //             安全:结转行被 v_stock_movement、kucun 重算、FIFO 队列**全部排除**(见各处 `<> CARRY_TYPE`),
        //             删旧标记不动任何数字。
        //      · 「该批次号的数据月结后数量为 0,就是删除这个批次号」⇒ 期末结存为 0 的批次**不写结转行**
        //        (kucun 侧同口径删除见 reconcileKucun 的零余额清理)。
        int deletedOther = jdbc.update("DELETE FROM inh WHERE 单据类型 = ? AND 单据编号 <> ?", CARRY_TYPE, no);
        int deleted = jdbc.update("DELETE FROM inh WHERE 单据类型 = ? AND 单据编号 = ?", CARRY_TYPE, no);
        int carryRows = 0;
        for (Map.Entry<Key, Agg> e : aggs.entrySet()) {
            Key k = e.getKey();
            Agg a = e.getValue();
            if (a.end.signum() == 0) continue;   // 数量为 0 ⇒ 不写结转行(= 这个批次号不留痕)
            jdbc.update("INSERT INTO inh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号,"
                            + " 计量单位, 仓库编码, 仓库名称, 批号, 数量, 单价, 金额, 经手人, asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (0, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), 'N')",
                    no, CARRY_TYPE, java.sql.Date.valueOf(carryDate), k.wz, a.name, a.spec, a.uom, k.ck, a.whName,
                    k.lot.isEmpty() ? null : k.lot, a.end, a.price,
                    a.price == null ? null : a.price.multiply(a.end), "月结:" + user, "monthclose:" + user);
            carryRows++;
        }
        log.info("[月结] {} 结转行 {} 条(已清其它期间结转行 {} 条)", p, carryRows, deletedOther);

        // ⑤ kucun:有则改、无则增(幂等重算到期末)
        int[] kc = reconcileKucun(endEx, user);

        // ⑥ 月结头/行表
        Long headId = upsertHead(p, no, carryDate, lines.size(), sumIn, sumOut, sumEnd, user);
        jdbc.update("DELETE FROM bl_stock_close WHERE 期间 = ?", p);
        for (Map<String, Object> ln : lines) {
            jdbc.update("INSERT INTO bl_stock_close (头id, 行号, 期间, 物料编码, 物料名称, 规格型号, 计量单位, 仓库编码,"
                            + " 仓库名称, 批号, 期初数量, 入库数量, 出库数量, 结存数量, 单价, 最晚出库日期,"
                            + " asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,GETDATE(),'N')",
                    headId, ln.get("行号"), p, ln.get("物料编码"), ln.get("物料名称"), ln.get("规格型号"), ln.get("计量单位"),
                    ln.get("仓库编码"), ln.get("仓库名称"), ln.get("批号"), ln.get("期初数量"), ln.get("入库数量"),
                    ln.get("出库数量"), ln.get("结存数量"), ln.get("单价"), ln.get("最晚出库日期"), "monthclose:" + user);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("期间", p);
        out.put("状态", "已月结");
        out.put("结转单据编号", no);
        out.put("结转日期", carryDate);
        out.put("键数", lines.size());
        out.put("结转行数", carryRows);
        out.put("覆盖旧结转行", deleted);
        out.put("入库合计", sumIn);
        out.put("出库合计", sumOut);
        out.put("结存合计", sumEnd);
        out.put("kucun新增", kc[0]);
        out.put("kucun更新", kc[1]);
        out.put("kucun清理孤儿行", kc[2]);
        out.put("kucun删除零余额行", kc[3]);
        out.put("缺批号出库行", fifo.blankRows);
        out.put("缺批号回写行", fifo.writtenBack);
        out.put("跨批未回写行", fifo.crossLot);
        out.put("超发行数", fifo.overIssued);
        log.info("[月结] {} 完成:键 {} · 结转行 {} · 入 {} · 出 {} · 结存 {} · kucun 新增{}/更新{}/孤儿清零{}",
                p, lines.size(), carryRows, sumIn, sumOut, sumEnd, kc[0], kc[1], kc[2]);
        return out;
    }

    /**
     * 取消月结:删该期间的结转行 + 标记已取消。期间缺省 = **最近一次已月结的期间**
     * (正常就是上月;这样「取消月结」按钮不需要任何参数,也不会误点到别的期间)。
     * kucun 是幂等重算的结果,不回滚(回滚反而会改错)。
     */
    @Transactional
    public Map<String, Object> cancel(String period, String user) {
        String p = (period == null || period.isBlank()) ? latestClosedPeriod() : normPeriod(period);
        if (p == null) throw new IllegalStateException("没有任何已月结的期间,无需取消");
        String state = periodState(p);
        if (!"已月结".equals(state)) throw new IllegalStateException("期间 " + p + " 不是已月结状态(" + state + "),无需取消");
        int del = jdbc.update("DELETE FROM inh WHERE 单据类型 = ? AND 单据编号 = ?", CARRY_TYPE, carryNo(p));
        jdbc.update("UPDATE bd_stock_close SET 状态 = N'已取消', 取消人 = ?, 取消时间 = GETDATE(),"
                + " asp_user2 = ?, asp_time2 = GETDATE() WHERE 期间 = ?", user, user, p);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("期间", p);
        out.put("状态", "已取消");
        out.put("删除结转行", del);
        out.put("kucun", "未改动(月结写的是幂等重算结果 = 真实余额;取消只撤结转标记)");
        log.info("[月结] {} 已取消:删除结转行 {}", p, del);
        return out;
    }

    /** 最近一次「已月结」的期间(取消月结的缺省目标);没有则 null */
    public String latestClosedPeriod() {
        List<String> rows = jdbc.queryForList(
                "SELECT TOP 1 期间 FROM bd_stock_close WHERE 状态 = N'已月结' AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY 期间 DESC", String.class);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** 重新月结 = 先取消(若已月结)再月结,保证结转行只有一份、kucun 按最新流水重算。 */
    @Transactional
    public Map<String, Object> reclose(String period, String user) {
        String p = normPeriod(period);
        Map<String, Object> out = new LinkedHashMap<>();
        if ("已月结".equals(periodState(p))) out.put("取消", cancel(p, user));
        out.put("月结", close(p, user));
        return out;
    }

    // ==================== FIFO 循环运算 ====================

    /**
     * 用本期间**所有入库**做循环运算,逐笔分摊出库(用户口径③)。产出:
     * <ul>
     *   <li>{@code allocOf(key)} —— 该键**分摊后**的出库量(缺批号行被归位到真实批次;无法分摊的余量留在原键上);</li>
     *   <li>{@code lastOutOf(key)} —— 该键最后一次被发出的日期(「最晚出库日期」);</li>
     *   <li>统计:缺批号行数 / 回写行数 / 跨批未回写行数 / 超发行数。</li>
     * </ul>
     * 队列来源 = 期间开始前的结存(按期初日合成一行,保证排在期间入库之前)+ 本期间入库行,均按 (日期, id) 升序。
     */
    private Fifo allocateFifo(LocalDate start, LocalDate endEx) {
        List<Map<String, Object>> queueRows = new ArrayList<>(jdbc.queryForList(
                "SELECT ISNULL(RTRIM(物料编码),N'') AS w, ISNULL(RTRIM(仓库编码),N'') AS c, ISNULL(RTRIM(批号),N'') AS l,"
                        + " 单据日期 AS d, 数量 AS q, id FROM inh"
                        + " WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,'') <> N'" + CARRY_TYPE + "'"
                        + " AND 单据日期 >= ? AND 单据日期 < ? ORDER BY 单据日期, id", start, endEx));
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT 物料编码 AS w, 仓库编码 AS c, 批号 AS l, CAST(SUM(数量) AS decimal(18,4)) AS q FROM ("
                        + "  SELECT 物料编码, 仓库编码, 批号, 数量 FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y'"
                        + "    AND ISNULL(单据类型,'') <> N'" + CARRY_TYPE + "' AND 单据日期 < ?"
                        + "  UNION ALL"
                        + "  SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 < ?"
                        + " ) t GROUP BY 物料编码, 仓库编码, 批号 HAVING SUM(数量) > 0", start, start)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("w", r.get("w")); m.put("c", r.get("c")); m.put("l", r.get("l"));
            m.put("d", java.sql.Date.valueOf(start.minusDays(1))); m.put("q", r.get("q")); m.put("id", 0L);
            queueRows.add(m);
        }

        Map<String, Deque<Lot>> queues = new LinkedHashMap<>();
        for (Map<String, Object> r : queueRows) {
            queues.computeIfAbsent(Key.group(r.get("w"), r.get("c")), k -> new ArrayDeque<>())
                    .addLast(new Lot(str(r.get("l")), dec(r.get("q"))));
        }
        Map<String, BigDecimal> alloc = new LinkedHashMap<>();   // Key.uid -> 分摊出库量
        Map<String, String> lastOut = new LinkedHashMap<>();     // Key.uid -> 最晚出库日期
        int blankRows = 0, writtenBack = 0, crossLot = 0, overIssued = 0;

        for (Map<String, Object> o : jdbc.queryForList(
                "SELECT id, ISNULL(RTRIM(物料编码),N'') AS w, ISNULL(RTRIM(仓库编码),N'') AS c, ISNULL(RTRIM(批号),N'') AS l,"
                        + " 单据日期 AS d, 数量 AS q FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y'"
                        + " AND 单据日期 >= ? AND 单据日期 < ? ORDER BY 单据日期, id", start, endEx)) {
            BigDecimal need = dec(o.get("q"));
            if (need.signum() == 0) continue;
            String g = Key.group(o.get("w"), o.get("c"));
            String lot = str(o.get("l"));
            Deque<Lot> q = queues.get(g);
            BigDecimal remain = need;
            Map<String, BigDecimal> takeByLot = new LinkedHashMap<>();   // 本行在各批次上取走的量
            if (q != null) {
                for (Lot b : q) {
                    if (remain.signum() <= 0) break;
                    if (!lot.isEmpty() && !b.lot.equals(lot)) continue;   // 带批号:只吃自己那一批
                    BigDecimal take = b.remain.min(remain);
                    if (take.signum() <= 0) continue;
                    b.remain = b.remain.subtract(take);
                    remain = remain.subtract(take);
                    takeByLot.merge(b.lot, take, BigDecimal::add);
                }
            }
            if (lot.isEmpty()) {
                blankRows++;
                Set<String> lots = new LinkedHashSet<>(takeByLot.keySet());
                if (lots.size() == 1 && remain.signum() == 0) {
                    String write = lots.iterator().next();
                    if (!write.isEmpty()) {
                        jdbc.update("UPDATE outh SET 批号 = ?, asp_user2 = N'monthclose', asp_time2 = GETDATE() WHERE id = ?",
                                write, o.get("id"));
                        writtenBack++;
                    }
                } else if (lots.size() > 1) {
                    crossLot++;
                }
            }
            if (remain.signum() > 0) overIssued++;
            // 归集:分摊到各批次的量 + (分摊不掉/带批号取不足的)余量留在原键上
            // ⚠ 出库行的 单据日期 可能是 NULL(实测有这种历史行):String.valueOf(null) 会得到字符串
            //   "null",再喂给 Date.valueOf 就是 `IllegalArgumentException: null`(消息为空,全局处理器
            //   只剩一个 code,排查时看不到线索)—— 2026-10-15 直调入口抓到的就是这个,必须判空。
            Object dv = o.get("d");
            String d = dv == null ? null : String.valueOf(dv);
            for (Map.Entry<String, BigDecimal> t : takeByLot.entrySet()) {
                String uid = g + "\u0001" + t.getKey();
                alloc.merge(uid, t.getValue(), BigDecimal::add);
                if (d != null) {
                    String prev = lastOut.get(uid);
                    if (prev == null || d.compareTo(prev) > 0) lastOut.put(uid, d);
                }
            }
            if (remain.signum() > 0) alloc.merge(g + "\u0001" + lot, remain, BigDecimal::add);
        }
        return new Fifo(alloc, lastOut, blankRows, writtenBack, crossLot, overIssued);
    }

    /** FIFO 结果:{键 uid → 分摊出库量}、{键 uid → 最晚出库日期} + 统计 */
    private record Fifo(Map<String, BigDecimal> alloc, Map<String, String> lastOut,
                        int blankRows, int writtenBack, int crossLot, int overIssued) {
        BigDecimal allocOf(Key k) { return alloc.get(k.uid()); }
        String lastOutOf(Key k) { return lastOut.get(k.uid()); }
    }

    /** 可变的批次余量(循环运算用) */
    private static final class Lot {
        final String lot;
        BigDecimal remain;
        Lot(String lot, BigDecimal remain) {
            this.lot = lot == null ? "" : lot;
            this.remain = remain == null ? BigDecimal.ZERO : remain;
        }
    }

    // ==================== kucun 幂等重算 ====================

    /**
     * 按流水把 kucun 重算到期末(用户三步里的 ②③):有则 UPDATE、无则 INSERT。
     * rkl/ckl = 截至期末的累计入/出(与审核钩子同口径),yl = 累计入 − 累计出(= 期末结存)。
     * 只处理流水里出现过的键(不做全表刷),**外加**一步孤儿行清零(见方法内注释)。
     * 必须在 FIFO 回写之后调用(见类注释的计算顺序)。
     *
     * @return {@code [新增行数, 更新行数, 孤儿清零行数, 零余额删除行数]}
     */
    private int[] reconcileKucun(LocalDate endEx, String user) {
        // ⚠ 性能(2026-10-15 用户报「取消后再月结超时」):第一版是**逐个键** UPDATE/INSERT ——
        //   正式库 2823 个键 = 2823 次 round trip,实测 6~7 s(测试库)且正式库更慢 ⇒ 撞前端 axios 15 s 线。
        //   改成**集合式两条语句**(聚合用派生表内联,不落临时表:临时表会随连接回池留下,下次同名建表直接报错):
        //   ① 一条 UPDATE…FROM(聚合派生表 JOIN kucun)覆盖已存在的键;② 一条 INSERT…SELECT 补缺失的键。
        String agg = "SELECT ISNULL(RTRIM(物料编码),N'') AS w, ISNULL(RTRIM(仓库编码),N'') AS c,"
                + " ISNULL(RTRIM(批号),N'') AS l, CAST(SUM(q) AS decimal(18,4)) AS yl,"
                + " CAST(SUM(CASE WHEN q > 0 THEN q ELSE 0 END) AS decimal(18,4)) AS cum_in,"
                + " CAST(SUM(CASE WHEN q < 0 THEN -q ELSE 0 END) AS decimal(18,4)) AS cum_out FROM ("
                + "  SELECT 物料编码, 仓库编码, 批号, 数量 AS q FROM inh"
                + "   WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,'') <> N'" + CARRY_TYPE + "' AND 单据日期 < ?"
                + "  UNION ALL"
                + "  SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh"
                + "   WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 < ?"
                + " ) t GROUP BY ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N'')";
        int upd = jdbc.update(
                "UPDATE k SET rkl = a.cum_in, ckl = a.cum_out, yl = a.yl, update_date = GETDATE(),"
                        + " asp_user2 = ?, asp_time2 = GETDATE() FROM kucun k JOIN (" + agg + ") a"
                        + " ON a.w = k.wzdm AND a.c = ISNULL(RTRIM(k.ckdm), N'') AND a.l = ISNULL(RTRIM(k.lot_no), N'')"
                        + " WHERE a.w <> N'' AND a.c <> N''",
                "monthclose:" + user, endEx, endEx);
        int ins = jdbc.update(
                "INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, ckl, yl, asp_user1, asp_time1, asp_cancel)"
                        + " SELECT a.w, a.c, NULLIF(a.l, N''), GETDATE(), a.cum_in, a.cum_out, a.yl, ?, GETDATE(), 'N'"
                        + " FROM (" + agg + ") a WHERE a.w <> N'' AND a.c <> N'' AND a.yl <> 0"   // 零余额键不重建(用户:数量为 0 就删除这个批次号)
                        + "   AND NOT EXISTS (SELECT 1 FROM kucun k WHERE k.wzdm = a.w AND ISNULL(RTRIM(k.ckdm), N'') = a.c"
                        + "        AND ISNULL(RTRIM(k.lot_no), N'') = a.l)",
                "monthclose:" + user, endEx, endEx);
        // 零余额键清理(用户 2026-10-15 第十三轮:「该批次号的数据月结后数量为 0,就是删除这个批次号」)——
        //   某 (物料,仓库,批号) 截至期末的累计余额为 0 ⇒ 从 kucun **删除该行**(批次号不再出现在库存明细里)。
        //   与上面两条配套:INSERT 只补非零键,所以删除是稳定的(不会下个月结又冒出来)。
        //   ⚠ 代价:该批次的「累计入库量/累计出库量」历史也随之从明细里消失(报表读的就是 kucun);
        //     若 (仓库,存货) 下**所有**批次都为 0,这一行整行消失 —— 这是"库存明细只列有余额的行"的口径。
        Integer zeroCnt = jdbc.queryForObject(
                "SELECT COUNT(*) FROM kucun k JOIN (" + agg + ") a"
                        + " ON a.w = k.wzdm AND a.c = ISNULL(RTRIM(k.ckdm), N'') AND a.l = ISNULL(RTRIM(k.lot_no), N'')"
                        + " WHERE a.yl = 0 AND a.w <> N'' AND a.c <> N''"
                        // ⚠ 设过预警数量的行**不删**:预警是主数据,不能随批次清零被删(第十六轮)
                        + "   AND ISNULL(k.预警数量, 0) = 0", Integer.class, endEx, endEx);
        int zeroPurged = zeroCnt == null ? 0 : zeroCnt;        // 孤儿行清理(2026-10-15 补):**走审核钩子写入的 kucun 行必然有配套流水**
        //   (StockLedgerService.apply 在同一事务里既改 kucun 又写 inh/outh)⇒ 一个 `asp_user1 LIKE 'stock:%'`
        //   的键如果在流水里**一条都没有**,只可能是「流水被改了批号(换键)」留下的残影:
        //   重算只做 upsert、不清旧键 ⇒ 同一批货会在新旧两个键上各算一次(实测正式库 260 行 / +135 万)。
        //   这里把这类行**清零**(不删除,留痕:asp_user2 记为 who/when 清过),q/c 来源(不良品处理不走流水,
        //   见坑 4)与期初导入行**不动**。
        int purged = jdbc.update(
                "UPDATE kucun SET rkl = 0, ckl = 0, yl = 0, update_date = GETDATE(), asp_user2 = ?, asp_time2 = GETDATE()"
                        + " WHERE ISNULL(asp_user1, N'') LIKE 'stock:%'"
                        + "   AND NOT EXISTS (SELECT 1 FROM inh x WHERE ISNULL(RTRIM(x.物料编码),N'') = kucun.wzdm"
                        + "        AND ISNULL(RTRIM(x.仓库编码),N'') = kucun.ckdm"
                        + "        AND ISNULL(RTRIM(x.批号),N'') = ISNULL(RTRIM(kucun.lot_no),N'')"
                        + "        AND ISNULL(x.asp_cancel,'N') <> 'Y' AND ISNULL(x.单据类型,'') <> N'" + CARRY_TYPE + "' AND x.单据日期 < ?)"
                        + "   AND NOT EXISTS (SELECT 1 FROM outh y WHERE ISNULL(RTRIM(y.物料编码),N'') = kucun.wzdm"
                        + "        AND ISNULL(RTRIM(y.仓库编码),N'') = kucun.ckdm"
                        + "        AND ISNULL(RTRIM(y.批号),N'') = ISNULL(RTRIM(kucun.lot_no),N'')"
                        + "        AND ISNULL(y.asp_cancel,'N') <> 'Y' AND y.单据日期 < ?)",
                "orphan-purge:" + user, endEx, endEx);
        return new int[]{ins, upd, purged, zeroPurged};
    }

    // ==================== 展开明细(报表用) ====================

    /**
     * 展开一个 (物料,仓库) 的明细 = **这一行余额的来源**(2026-10-15 第二轮~第八轮口径)。
     *
     * <h4>列表构成(一张表,靠「单据类型」区分,数量带方向:入库正 / 出库负)</h4>
     * <ul>
     *   <li>上月**已月结** ⇒ 只有那张**月结结转单**(显示成 <code>2026-09月结</code>,单据编号 <code>JZ-202609</code>,
     *       数量 = 该月期末结存 ⇒ 也就是当月的期初)。用户第八轮截图口径:
     *       「**只要上一个月的结转,就是 9 月的**」—— 当月那一堆原始单据**不再铺出来**(见方法尾注释);</li>
     *   <li>上月**未月结 / 已取消** ⇒ 把**该月的原始单据**陈列出来
     *       (第三轮:「上月月结被取消后要把那个月的单据陈列出来」)。</li>
     * </ul>
     * 每行带 `月份`(yyyy-MM)列,便于对照结转行落在哪个月。
     *
     * <h4>月结快照</h4>
     * 取的是**上月**那次月结在 `bl_stock_close` 里的行(期初/入/出/结存/最晚出库日期),跨批汇总;
     * 上月未月结则为 null。⚠ 早先版本按「当前月」查快照 —— 月结是结**上月**的,所以永远查不到,
     * 这条是 2026-10-15 第三轮一并修正的。
     */
    public Map<String, Object> detail(String period, String wzdm, String ckdm, String lot) {
        String cur = normPeriod(period == null || period.isBlank() ? LocalDate.now().format(PERIOD_FMT) : period);
        String prev = YearMonth.parse(cur, PERIOD_FMT).minusMonths(1).format(PERIOD_FMT);
        String w = nz(wzdm), c = nz(ckdm), l = nz(lot);
        // 第四轮口径:报表一行 = 一个 (仓库编码, 存货编码)(批号已合并) ⇒ 展开时**不再按批号过滤**,
        // 该物料该仓的**所有批次**单据一起陈列(单据明细里带 `批号` 列,想看哪一批一眼可见)。
        // 仍然保留按批号查的能力(传了具体批号就按批号过滤),给以后"按批展开"留口子。
        String lotArg = ("*".equals(l) || l.isEmpty()) ? null : l;
        LocalDate prevStart = periodStart(prev), prevEndEx = periodEndExclusive(prev);
        LocalDate curStart = periodStart(cur), curEndEx = periodEndExclusive(cur);
        String prevState = periodState(prev);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("期间", cur);
        out.put("上月期间", prev);
        out.put("上月状态", prevState);
        // 月结快照:月结是按 (物料,仓库,批号) 存的 ⇒ 展开已合并批号的行时**跨批汇总**
        List<Map<String, Object>> snap = jdbc.queryForList(
                "SELECT CAST(SUM(期初数量) AS decimal(18,4)) AS 期初数量, CAST(SUM(入库数量) AS decimal(18,4)) AS 入库数量,"
                        + " CAST(SUM(出库数量) AS decimal(18,4)) AS 出库数量, CAST(SUM(结存数量) AS decimal(18,4)) AS 结存数量,"
                        + " CONVERT(nvarchar(10), MAX(最晚出库日期), 120) AS 最晚出库日期"
                        + " FROM bl_stock_close WHERE 期间 = ? AND 物料编码 = ? AND 仓库编码 = ?"
                        + (lotArg == null ? "" : " AND ISNULL(RTRIM(批号),N'') = ?")
                        + " AND ISNULL(asp_cancel,'N') <> 'Y'",
                lotArg == null ? new Object[]{prev, w, c} : new Object[]{prev, w, c, lotArg});
        // 月结汇总只在**月结生效中**才展示:已取消时该次汇总已被撤销,界面改为陈列该月原始单据
        // (用户 2026-10-15 第三轮口径),不然"已取消"和一组汇总数字并排会让人以为月结还在。
        // 「期初数量」的口径说明(用户第十二轮点名):它 = **上上个月(如 8 月)的月末结转**,
// 也就是被结那个月(如 9 月)的期初。前端把它显示在数字后面,免得看的人以为它是本月数。
        out.put("期初月份", YearMonth.parse(prev, PERIOD_FMT).minusMonths(1).format(PERIOD_FMT));
        out.put("月结快照", "已月结".equals(prevState) && !snap.isEmpty() ? snap.get(0) : null);

        List<Map<String, Object>> rows = new ArrayList<>();
        // 上月部分的行(2026-10-20 用户问「为什么有些行有单据、有些行没有」)—— 两种来源都取,再按
        //   「单据编号 + 批号」去重,免得同一张结转单被陈列两遍:
        //   ① 上月**已月结** ⇒ 用那张月结结转单代表上月(它是结转行,落在当月 1 号);
        //   ② 不管月结与否,都补上**上月原始单据**(入库正、出库负)——
        //      只取①会漏掉两种键:【本月才有**新批号**】的(上月没这个批号,自然没有它的结转行);
        //      **上月期末结存 = 0** 的(月结按口径"为 0 不写结转行",这批货月末发完、本月又补货出库)。
        //      只取②也不对:已月结时原始单据已被结转行取代,再铺一遍等于让上月动了两回。
        //      故:已月结 → ①+②;未月结/已取消 → 只有②(第三轮口径:取消后要看到原始单据)。
        Set<String> seen = new HashSet<>();
        if ("已月结".equals(prevState)) {
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT CONVERT(nvarchar(7), 单据日期, 120) AS 月份, CONVERT(nvarchar(10), 单据日期, 120) AS 单据日期,"
                            + "  CONVERT(nvarchar(7), DATEADD(month, -1, 单据日期), 120) + N'月结' AS 单据类型,"
                            + "  ISNULL(单据编号, N'') AS 单据编号, ISNULL(批号, N'') AS 批号, 数量,"
                            + "  ISNULL(往来单位, N'') AS 往来单位, ISNULL(经手人, N'') AS 经手人"
                            + " FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据类型 = ? AND 单据编号 = ?"
                            + "  AND ISNULL(RTRIM(物料编码),N'') = ? AND ISNULL(RTRIM(仓库编码),N'') = ?"
                            + (lotArg == null ? "" : "  AND ISNULL(RTRIM(批号),N'') = ?"),
                    lotArg == null ? new Object[]{CARRY_TYPE, carryNo(prev), w, c}
                                   : new Object[]{CARRY_TYPE, carryNo(prev), w, c, lotArg})) {
                rows.add(r);
                seen.add(r.get("单据编号") + "\u0001" + r.get("批号"));
            }
        }
        for (Map<String, Object> r : flowRows(prevStart, prevEndEx, w, c, lotArg)) {
            if (seen.add(r.get("单据编号") + "\u0001" + r.get("批号"))) rows.add(r);
        }
        // **当月单据要展开**(用户 2026-10-15 第十二轮:「当月单据要有…10 月的数据要展开」)——
        //   展开 = 上月的结转行(余额来源;它的"期初数量"= 上上个月如 8 月的月末结转)
        //        + 当月的出入库单据(本月动了什么),一张表按日期排。
        //   结转行本身不进累计口径(v_stock_movement 已排除),所以这里只是"看单据",不参与任何合计。
        //   ⚠ 第八轮曾只留结转行(用户当时截图口径),第十二轮按用户要求把当月单据加回 —— 别再删了。
        rows.addAll(flowRows(curStart, curEndEx, w, c, lotArg));
        // 排序(用户 2026-10-15 第十三轮):「每个分类根据批次号再做一次展开,如同一批次号,
        //   第一个是月结,后面是当月的单据」⇒ **按批次号分组**,组内**月结行排第一**,其余按日期、单号。
        rows.sort(Comparator
                .comparing((Map<String, Object> r) -> String.valueOf(r.get("批号")))
                .thenComparing(r -> String.valueOf(r.get("单据类型")).contains("月结") ? 0 : 1)
                .thenComparing(r -> String.valueOf(r.get("单据日期")))
                .thenComparing(r -> String.valueOf(r.get("单据编号"))));
        out.put("预警", warn.warnMap(w, c));   // {批号 → 预警数量}(展开区按批次号设置/显示用)
        out.put("单据明细", rows);
        return out;
    }

    /**
     * 一段期间内的原始单据(入库为正、出库为负),不含月结结转行 —— 展开明细的公共片段。
     *
     * @param lot 批号;**null = 不限批号**(报表按 (仓库,存货) 归类后的展开口径,所有批次一起陈列);
     *            传具体值 = 只取该批。SQL 片段按需拼接,参数顺序随之变化(入库段 + 出库段各一套)。
     * @param endEx 右开边界(「单据日期 &lt; endEx」),调用方传**下月 1 号**,月末最后一天的流水因此包含在内。
     */
    private List<Map<String, Object>> flowRows(LocalDate start, LocalDate endEx, String w, String c, String lot) {
        String lotFilter = lot == null ? "" : "  AND ISNULL(RTRIM(批号),N'') = ?";
        List<Object> args = new ArrayList<>(List.of(start, endEx, w, c));
        if (lot != null) args.add(lot);
        args.add(start);
        args.add(endEx);
        args.add(w);
        args.add(c);
        if (lot != null) args.add(lot);
        return jdbc.queryForList(
                "SELECT CONVERT(nvarchar(7), 单据日期, 120) AS 月份, CONVERT(nvarchar(10), 单据日期, 120) AS 单据日期,"
                        + "  ISNULL(单据类型, N'') AS 单据类型, ISNULL(单据编号, N'') AS 单据编号,"
                        + "  ISNULL(批号, N'') AS 批号, 数量 AS 数量,"
                        + "  ISNULL(往来单位, N'') AS 往来单位, ISNULL(经手人, N'') AS 经手人"
                        + " FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,'') <> N'" + CARRY_TYPE + "'"
                        + "  AND 单据日期 >= ? AND 单据日期 < ? AND ISNULL(RTRIM(物料编码),N'') = ?"
                        + "  AND ISNULL(RTRIM(仓库编码),N'') = ?" + lotFilter
                        + " UNION ALL "
                        + "SELECT CONVERT(nvarchar(7), 单据日期, 120), CONVERT(nvarchar(10), 单据日期, 120),"
                        + "  ISNULL(单据类型, N''), ISNULL(单据编号, N''), ISNULL(批号, N''), -数量,"
                        + "  ISNULL(往来单位, N''), ISNULL(经手人, N'')"
                        + " FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 >= ? AND 单据日期 < ?"
                        + "  AND ISNULL(RTRIM(物料编码),N'') = ? AND ISNULL(RTRIM(仓库编码),N'') = ?" + lotFilter,
                args.toArray());
    }

    // ==================== 内部工具 ====================

    private Long upsertHead(String period, String no, String carryDate, int lineCount,
                            BigDecimal sumIn, BigDecimal sumOut, BigDecimal sumEnd, String user) {
        List<Long> ids = jdbc.queryForList("SELECT id FROM bd_stock_close WHERE 期间 = ?", Long.class, period);
        if (ids.isEmpty()) {
            jdbc.update("INSERT INTO bd_stock_close (期间, 状态, 结转单据编号, 结转日期, 行数, 入库合计, 出库合计, 结存合计,"
                            + " 月结人, 月结时间, asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (?, N'已月结', ?, ?, ?, ?, ?, ?, ?, GETDATE(), ?, GETDATE(), 'N')",
                    period, no, java.sql.Date.valueOf(carryDate), lineCount, sumIn, sumOut, sumEnd, user, "monthclose:" + user);
            return jdbc.queryForObject("SELECT id FROM bd_stock_close WHERE 期间 = ?", Long.class, period);
        }
        Long id = ids.get(0);
        jdbc.update("UPDATE bd_stock_close SET 状态 = N'已月结', 结转单据编号 = ?, 结转日期 = ?, 行数 = ?, 入库合计 = ?,"
                        + " 出库合计 = ?, 结存合计 = ?, 月结人 = ?, 月结时间 = GETDATE(), 取消人 = NULL, 取消时间 = NULL,"
                        + " asp_user2 = ?, asp_time2 = GETDATE(), asp_cancel = 'N' WHERE id = ?",
                no, java.sql.Date.valueOf(carryDate), lineCount, sumIn, sumOut, sumEnd, user, "monthclose:" + user, id);
        return id;
    }

    private Map<String, Object> line(Key k, Agg a, String lastOut) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("物料编码", k.wz); m.put("物料名称", a.name); m.put("规格型号", a.spec); m.put("计量单位", a.uom);
        m.put("仓库编码", k.ck); m.put("仓库名称", a.whName); m.put("批号", k.lot.isEmpty() ? null : k.lot);
        m.put("期初数量", a.opening); m.put("入库数量", a.in); m.put("出库数量", a.out);
        m.put("结存数量", a.end); m.put("单价", a.price);
        m.put("最晚出库日期", toDate(lastOut));
        return m;
    }

    /**
     * 文本 → java.sql.Date(只取前 10 位)。
     *
     * <p>为什么不能直接 {@code Date.valueOf(s)}:{@code inh/outh.单据日期} 是 **datetime**(不是 date),
     * JDBC 取回来 {@code String.valueOf} 得到 {@code "2026-09-30 10:20:30.0"} —— 直接喂给
     * {@code Date.valueOf} 抛 {@code IllegalArgumentException: null}(消息为空,全局异常处理器只剩一个
     * code,2026-10-15 连踩两次才定位到)。同时防住 NULL 被拼成字面量 {@code "null"}。
     */
    private static java.sql.Date toDate(String s) {
        if (s == null) return null;
        String t = s.trim();
        if (t.length() < 10 || "null".equalsIgnoreCase(t)) return null;
        try {
            return java.sql.Date.valueOf(t.substring(0, 10));
        } catch (RuntimeException e) {
            log.warn("[月结] 无法识别的最晚出库日期文本:'{}'(已忽略该值)", s);
            return null;
        }
    }

    private static BigDecimal dec(Object v) {
        if (v == null) return BigDecimal.ZERO;
        if (v instanceof BigDecimal b) return b;
        return new BigDecimal(String.valueOf(v));
    }

    private static String str(Object v) { return v == null ? "" : String.valueOf(v).trim(); }

    private static String nz(String v) { return v == null ? "" : v.trim(); }

    /** 三键(物料,仓库,批号);批号空串表示「无批号」 */
    record Key(String wz, String ck, String lot) {
        static Key of(Map<String, Object> r) { return new Key(str(r.get("w")), str(r.get("c")), str(r.get("l"))); }
        static String group(Object w, Object c) { return str(w) + "\u0001" + str(c); }
        String uid() { return wz + "\u0001" + ck + "\u0001" + lot; }
    }

    /** 一个键的累计量 */
    private static final class Agg {
        BigDecimal opening = BigDecimal.ZERO, in = BigDecimal.ZERO, out = BigDecimal.ZERO, end = BigDecimal.ZERO;
        BigDecimal price;
        String name, spec, uom, whName;
        void fillMeta(Map<String, Object> r) {
            if (name == null) name = str(r.get("n1"));
            if (spec == null) spec = str(r.get("n2"));
            if (uom == null) uom = str(r.get("n3"));
            if (whName == null) whName = str(r.get("n4"));
        }
    }
}
