package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 库存预警(用户 2026-10-15 第十六轮)。
 *
 * <h3>口径(用户逐条选定)</h3>
 * <ol>
 *   <li><b>拦截条件</b>:出库审批后 <b>该批次余额 &lt; 预警数量</b> ⇒ 审批失败并提示;</li>
 *   <li><b>粒度</b>:(仓库编码, 存货编码, <b>批次号</b>);</li>
 *   <li><b>默认值 0</b>:没设置预警的批次按 0 算 ⇒ 出成负库存也拦。</li>
 * </ol>
 *
 * <h3>存储</h3>
 * 复用既有列 <code>kucun.[预警数量]</code>(2026-09-15 的 <code>migrate-stock-warn.sql</code> 建的,
 * 库存状况表的行内编辑「更新预警数量」也在写它)。**不新开表** —— 该列在 kucun 上,粒度与 kucun 行键一致。
 * <p>⚠ 与库存状况表那套"没设就回退全局阈值 100"的**显示**口径不同:本类作为**审批闸门**时默认值是 <b>0</b>,
 * 否则任何不足 100 的出库都会被拦死(用户明确选了"默认 0")。
 *
 * <p>⚠ 配置与"零余额批次删除"的关系:月结会把余额为 0 的批次从 kucun 删掉(第十三轮口径),
 * 所以 {@code StockMonthCloseService.reconcileKucun} 的零余额清理**跳过预警数量非 0 的行**,
 * 免得把用户设过的预警一起删了。
 */
@Service
public class StockWarnService {

    private final JdbcTemplate jdbc;

    /**
     * 历史回填模式:与 {@code StockLedgerService.HIST_BACKFILL} **同一开关**(JVM 参数
     * {@code -Dmes.hist.backfill=true};默认关闭,日常录单/审核一个字都不变)。
     *
     * <p>为什么需要:本闸门是 2026-10-15 第十六轮新加的,当时漏了这个旁路 ⇒ 用历史回填模式补录
     * 金蝶历史单据时,前三道库存闸门已放开,却卡在这道「出库后余额 &lt; 预警数量」上。
     * 又因为预警数量默认值是 <b>0</b>(见类注释),它等价于「不许负结存」——正是回填要放开的。
     */
    private static final boolean HIST_BACKFILL = "true".equalsIgnoreCase(System.getProperty("mes.hist.backfill"));

    public StockWarnService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 该 (物料,仓库,批号) 的预警数量;未设置 = 0。 */
    public BigDecimal warnOf(String wzdm, String ckdm, String lot) {
        List<BigDecimal> v = jdbc.queryForList(
                "SELECT ISNULL(预警数量, 0) FROM kucun WHERE wzdm = ? AND ckdm = ? AND ISNULL(RTRIM(lot_no), N'') = ?",
                BigDecimal.class, wzdm, ckdm, norm(lot));
        return v.isEmpty() || v.get(0) == null ? BigDecimal.ZERO : v.get(0);
    }

    /**
     * 设置预警数量(库存明细展开区按批次号设置)。kucun 里没有该键时先建一行(数量留 0),
     * 这样"还没入库过的新批次"也能先把预警设上。
     */
    public void set(String wzdm, String ckdm, String lot, BigDecimal qty, String user) {
        String l = norm(lot);
        BigDecimal q = qty == null ? BigDecimal.ZERO : qty;
        int n = jdbc.update("UPDATE kucun SET 预警数量 = ?, asp_user2 = ?, asp_time2 = GETDATE()"
                        + " WHERE wzdm = ? AND ckdm = ? AND ISNULL(RTRIM(lot_no), N'') = ?",
                q, user, wzdm, ckdm, l);
        if (n == 0) {
            jdbc.update("INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, ckl, yl, [预警数量],"
                            + " asp_user1, asp_time1, asp_cancel) VALUES (?,?,?,GETDATE(),0,0,0,?,?,GETDATE(),'N')",
                    wzdm, ckdm, l.isEmpty() ? null : l, q, user);
        }
    }

    /**
     * **统一设置**:把该 (物料,仓库) 下**所有批次**的预警数量一次设成同一个值 ——
     * 含从未设过的批次(<b>不新增行</b>:kucun 里没有该 (物料,仓库) 就返回 0)。
     *
     * <p>用户 2026-10-15 新口径:「库存明细的预警要可以统一设置,再单独设置。」
     * 顺序 = 先本方法(**统一**),再 {@link #set}(**单独**,按批次号覆盖统一值);
     * 两步都是普通 UPDATE,不需要额外状态位。
     *
     * @return 实际更新的 kucun 行数(0 = 该 (物料,仓库) 一行都没有,什么都没改)
     */
    public int setAll(String wzdm, String ckdm, BigDecimal warnQty, String user) {
        BigDecimal q = warnQty == null ? BigDecimal.ZERO : warnQty;
        return jdbc.update("UPDATE kucun SET 预警数量 = ?, asp_user2 = ?, asp_time2 = GETDATE()"
                        + " WHERE wzdm = ? AND ckdm = ?",
                q, user, wzdm, ckdm);
    }

    /**
     * 统一预警(全量):把所有库存行的预警数量设成同一个值;ckdm 非空时只作用于该仓库。
     *
     * <p>与 {@link #setAll}(单个 物料+仓库 的全部批次)的区别 = <b>作用域</b>:
     * 本方法面向「按钮栏·统一预警弹窗」(用户 2026-10-15 当日改口径:
     * 「统一预警是对所有数据的,要放在按钮栏那里,点击给弹窗」),<b>不按物料过滤</b> ——
     * 左栏勾了仓库就只刷该仓库,没勾就是整张 kucun。
     *
     * <p>作废行({@code asp_cancel = 'Y'})不动(与读口径一致)。
     *
     * @param ckdm    仓库编码;空/null = 全部仓库
     * @param warnQty 目标预警数量(应已由调用方校验非负);null 视作 0
     * @param user    操作人(写 kucun.asp_user2)
     * @return 实际更新的 kucun 行数
     */
    public int setAllData(String ckdm, BigDecimal warnQty, String user) {
        BigDecimal q = warnQty == null ? BigDecimal.ZERO : warnQty;
        String c = ckdm == null ? "" : ckdm.trim();
        String base = "UPDATE kucun SET 预警数量 = ?, asp_user2 = ?, asp_time2 = GETDATE()"
                + " WHERE ISNULL(asp_cancel, 'N') <> 'Y'";
        if (c.isEmpty()) {
            return jdbc.update(base, q, user);
        }
        return jdbc.update(base + " AND ckdm = ?", q, user, c);
    }

    /** 该 (物料,仓库) 下每个批次的预警数量(展开明细用):{批号 → 预警数量}。 */
    public Map<String, BigDecimal> warnMap(String wzdm, String ckdm) {
        Map<String, BigDecimal> out = new LinkedHashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT ISNULL(RTRIM(lot_no), N'') AS l, ISNULL(预警数量, 0) AS q FROM kucun WHERE wzdm = ? AND ckdm = ?",
                wzdm, ckdm)) {
            out.put(str(r.get("l")), dec(r.get("q")));
        }
        return out;
    }

    /**
     * **出库审批闸门**:出库后该批次余额 &lt; 预警数量 ⇒ 抛异常(事务回滚、审批失败并提示)。
     *
     * @param acc 同一单据内的累计器(键 = 物料|仓库|批号):一张出库单可能多行打同一个批次,
     *            必须**累计**后再比,否则每行都按"当前余额 − 本行数量"算会漏判。
     */
    public void checkOutbound(String no, String wzdm, String ckdm, String lot, BigDecimal qty,
                              Map<String, BigDecimal> acc) {
        if (wzdm == null || wzdm.isBlank() || ckdm == null || ckdm.isBlank()) return;   // 没解析出仓库 = 不过账的行(见 apply 跳过分支)
        BigDecimal q = qty == null ? BigDecimal.ZERO : qty;
        if (q.signum() == 0) return;
        String l = norm(lot);
        BigDecimal done = acc.merge(wzdm + "\u0001" + ckdm + "\u0001" + l, q, BigDecimal::add);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT ISNULL(yl, 0) AS yl, ISNULL(预警数量, 0) AS warn FROM kucun"
                        + " WHERE wzdm = ? AND ckdm = ? AND ISNULL(RTRIM(lot_no), N'') = ?", wzdm, ckdm, l);
        BigDecimal bal = rows.isEmpty() ? BigDecimal.ZERO : dec(rows.get(0).get("yl"));
        BigDecimal warn = rows.isEmpty() ? BigDecimal.ZERO : dec(rows.get(0).get("warn"));
        BigDecimal after = bal.subtract(done);
        if (!HIST_BACKFILL && after.compareTo(warn) < 0) {
            throw new IllegalStateException("单据 " + no + " 出库审批失败:存货 " + wzdm + " / 仓库 " + ckdm
                    + " / 批次号 " + (l.isEmpty() ? "(无批次号)" : l)
                    + " 出库后余额 " + plain(after) + " 低于预警数量 " + plain(warn)
                    + "(当前余额 " + plain(bal) + ",本单该批次已出 " + plain(done) + ")");
        }
    }

    private static String norm(String lot) {
        return lot == null ? "" : lot.trim();
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static BigDecimal dec(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal b) return b;
        return new BigDecimal(String.valueOf(o));
    }

    private static String plain(BigDecimal v) {
        return v.stripTrailingZeros().toPlainString();
    }
}
