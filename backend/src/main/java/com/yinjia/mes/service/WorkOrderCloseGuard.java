package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * **生产工单「结案」守卫 / 自愈**(2026-10-18)。
 *
 * <h3>为什么需要它(现场原话)</h3>
 * 「我原先将所有工单都取消结案了,但**扫码报工后就出现了都是已结案**。」
 *
 * <p>查证结论:{@code plang.ja} 是**外部程序也能直接写**的列(手机端小程序/参考库直连同一个库)。
 * MES 自己结案只有两条路(页面「结案」按钮、{@code ProcessTaskService.syncCloseState}),
 * **都要求「入库 ≥ 排产 + 组装成品检验已审核」并且都会留痕**;事发当天 {@code yj_usage_log}
 * 里一条「结案」都没有 ⇒ 那批 {@code ja='Y'} 只可能来自库外。
 *
 * <p>MES 的反应有两条路:① 改判据(所有读 {@code ja} 的地方都加条件);② **不信任外部写进来的 ja,
 * 发现不合法就回正** —— 就是本类。2026-10-19 起两条都做了(读侧收口见 {@link PlangClose#anomaly})。
 *
 * <h3>什么算「不合法」(与 MES 自己的结案口径完全一致)</h3>
 * <pre>
 *   合法结案 = 入库数量 ≥ 排产数量(>0)              ← MES 两条结案路径(手工/自动)都要求它
 * </pre>
 * <p>⚠ 2026-10-19 收窄:不再要求"有已审组装成品检验单"。原因 —— ①人工结案{@code
 * WorkOrderListController.close} 本来就只要求入库达标,拿检验单当条件会把**正经的手工结案**判成异常、
 * 开着自愈时还会被自动回正;②旧判据与列表页的判据不等价(实测页面 19 行 / 体检 38 行)。
 * 判据的唯一来源是 {@link PlangClose#anomaly(String)}。
 *
 * <h3>为什么默认「只报不动」(开关)</h3>
 * 回正是**写生产数据**的动作,而且会与外部程序"互搏"(它写 Y、我们改 N)。
 * 所以默认 {@code yinjia.workorder.ja-selfheal-enabled=false}:每分钟巡检、有异常就 WARN 留痕,
 * 但**不写库**;现场确认口径后再打开开关(或点「结案体检」手工回正)。
 *
 * <h3>不动的两类行</h3>
 * <ul>
 *   <li>参考库时代(GD2608 号段)真实结过的历史单 —— 与
 *       {@code migrate-plang-ja-stale-autoclose-20261015.sql} 的处置口径一致,不回正;</li>
 *   <li>已作废/已删除的行。</li>
 * </ul>
 */
@Service
public class WorkOrderCloseGuard {

    private static final Logger log = LoggerFactory.getLogger(WorkOrderCloseGuard.class);

    /** 单次回正上限:宁可多巡几轮,也不要一口气改几百行 */
    private static final int MAX_HEAL_PER_RUN = 200;

    private final JdbcTemplate jdbc;

    public WorkOrderCloseGuard(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * **异常结案**(2026-10-19 收口):{@code ja} 写着结案,但按 {@link PlangClose} 的口径没结案。
     *
     * <p>口径 = 「入库 ≥ 排产(>0)」,GD2608* 历史单豁免 —— **不再要求"有已审组装成品检验单"**。
     * 原因:①人工结案(生产工单页「结案」按钮)本来就不要求检验单,拿它当条件会把正经的手工结案
     * 标成异常,开着自愈时还会被自动回正;②旧写法与列表页的判据不等价(实测页面 19 行 / 体检 38 行),
     * 点「结案回正」会改掉页面没标红的行。
     *
     * <p>判据的唯一来源是 {@link PlangClose#anomaly(String)},列表/体检/回正/自愈四处共用。
     */
    private static final String ANOMALY_WHERE =
            " WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND " + PlangClose.anomaly("p");

    /**
     * 列出异常结案行(只读)。字段与「结案体检」端点一致,给现场核对用。
     *
     * @param limit 最多返回多少行(0/负 = 不限)
     */
    public List<Map<String, Object>> findAnomalies(int limit) {
        String sql = "SELECT TOP " + (limit > 0 ? limit : 5000)
                + " p.id AS 行id, p.pl_no AS 工单号, ISNULL(p.pl_xc,0) AS 工单行号,"
                + " ISNULL(p.[批次号],N'') AS 批次号, ISNULL(p.scx,N'') AS 生产线,"
                + " ISNULL(p.[完工状态],N'') AS 完工状态, ISNULL(p.pl_sl,0) AS 排产数量,"
                + " ISNULL(p.rk_sl,0) AS 入库数量, ISNULL(p.ja,N'') AS ja,"
                + " ISNULL(p.asp_user2,N'') AS 最后修改人,"
                + " CONVERT(varchar(19), p.asp_time2, 120) AS 最后修改时间"
                + " FROM dbo.plang p" + ANOMALY_WHERE
                + " ORDER BY p.pl_no, p.pl_xc";
        return jdbc.queryForList(sql);
    }

    /**
     * 回正:把异常结案的行 {@code ja} 改回 {@code 'N'},写 {@code asp_user2} 留痕。
     *
     * @param user 操作人(定时任务传 {@code system(结案自愈)})
     * @return 实际改了哪些行(工单号#行号),按回执给现场/日志用
     */
    public List<String> heal(String user, int maxRows) {
        int cap = maxRows <= 0 ? MAX_HEAL_PER_RUN : Math.min(maxRows, MAX_HEAL_PER_RUN);
        List<Map<String, Object>> rows = findAnomalies(cap);
        List<String> healed = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Object id = r.get("行id");
            if (!(id instanceof Number n)) continue;
            try {
                int c = jdbc.update("UPDATE dbo.plang SET ja = N'N', asp_user2 = ?, asp_time2 = GETDATE()"
                        + " WHERE id = ? AND ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(ja,'N') IN (N'T',N'Y')",
                        user == null || user.isBlank() ? "system(结案自愈)" : user, n.longValue());
                if (c > 0) {
                    healed.add(r.get("工单号") + "#" + r.get("工单行号"));
                    Map<String, Object> one = new LinkedHashMap<>();
                    one.put("工单号", r.get("工单号"));
                    one.put("工单行号", r.get("工单行号"));
                    one.put("入库数量", r.get("入库数量"));
                    one.put("排产数量", r.get("排产数量"));
                    one.put("原ja", r.get("ja"));
                    log.warn("[结案自愈] 外部写入的已结案被回正:{} (入库 {}/排产 {}) ⇒ ja=N, 留痕 asp_user2={}",
                            one.get("工单号") + "#" + one.get("工单行号"),
                            one.get("入库数量"), one.get("排产数量"), user);
                }
            } catch (Exception e) {
                // 单行失败不影响其它行(可能正被外部程序锁着,下一轮再来)
                log.info("[结案自愈] 回正 {}#{} 失败(下一轮重试):{}",
                        r.get("工单号"), r.get("工单行号"), e.getMessage());
            }
        }
        return healed;
    }
}
