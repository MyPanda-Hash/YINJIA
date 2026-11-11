package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * **工序在制看板（按产线看「下一道在等我多少」）** —— 2026-11-11 用户口径。
 *
 * <h3>为什么要有它</h3>
 * 用户口径(原话)：「要完成的实现就是当前的工单排产可以在完成一部分当前报工实现后，
 * 能在当前的下一道工序产线中查看到这个工单排产，并且这里能处理当前的可排产量和不可排产量。」
 *
 * <p>按量流转(见 {@link ProcessFlow})之后，前道报了一部分，后道的台账就已经是「已落实」、
 * 可加工量也已经算出来了；但**排产看板是按工单行归线**的（`plang_pc.scx` 单值），
 * 一张工单同一时刻只挂在一条线上 ⇒ 后道产线在自己的看板上看不到它。
 * 实测(正式库)：`GD-2026-11-0012` 成型只报 500 时，装箱(实际线 装箱2(新厂)、可加工 1000)
 * 在「装箱2(新厂)」的排产明细里 **0 行**；而按本方法展开，各条线共能看到 56 条在制工序行。
 *
 * <p>所以本类把视角从「工单行」换成「**工单行 × 在制工序**」：
 * 一行 = 一张工单行的**某一道已落实工序**，归到该道自己的**实际生产线**(没有则计划生产线)。
 *
 * <h3>两个数量（用户明确要求「可排产量 / 不可排产量」）</h3>
 * <pre>
 *   该道计划量   = 订单数量 × 该道换算率(台账计划数量优先)   …… 这道总共要做多少
 *   已完工       = 该道已审报工量(工序口径)
 *   可加工量     = 上一道已审折成品 × 该道换算率             …… 前道已经流下来多少
 *   可排产量     = 可加工量 − 已完工                          …… **这条线现在能做的量**
 *   不可排产量   = 该道计划量 − 可加工量                      …… 前道还没流下来的量(做了也没料)
 *   (可排 + 不可排 = 计划量 − 已完工)
 * </pre>
 *
 * <p>只读：不写任何业务数据。数量口径全部来自 {@link ProcessFlow}（唯一口径），本类不重算公式。
 */
@Service
public class WoWipBoardService {

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(WoWipBoardService.class);

    private final JdbcTemplate jdbc;

    public WoWipBoardService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 某条产线上**在制**的工序行（行 = 工单行 × 该道已落实工序）。
     *
     * @param line 生产线(必填;空则返回空)
     * @param shop 车间(登录账号的车间;空=不限。仅用于标记跨车间的存量台账)
     */
    public List<Map<String, Object>> byLine(String line, String shop) {
        List<Map<String, Object>> out = new ArrayList<>();
        String l = line == null ? "" : line.trim();
        if (l.isEmpty()) return out;
        String s = shop == null ? "" : shop.trim();
        // 行来源:预排台账里「已落实」的道;归线 = 实际生产线 优先、计划生产线 兜底
        List<Map<String, Object>> ledgers = jdbc.queryForList(
                "SELECT w.id AS 台账id, w.工单号, w.工单行id, ISNULL(w.工序,N'') AS 工序,"
                        + " ISNULL(w.工序序,0) AS 工序序, ISNULL(w.计划数量,0) AS 计划数量,"
                        + " ISNULL(w.状态,N'') AS 状态, ISNULL(w.计划生产线,N'') AS 计划生产线,"
                        + " ISNULL(w.实际生产线,N'') AS 实际生产线,"
                        + " ISNULL(p.pl_xc,0) AS 工单行号, ISNULL(p.dm,N'') AS 产品编码,"
                        + " ISNULL(p.mc,N'') AS 产品名称, ISNULL(p.gg,N'') AS 规格型号, ISNULL(p.jldw,N'') AS 单位,"
                        + " ISNULL(p.xq_sl,0) AS 订单数量, ISNULL(p.pl_sl,0) AS 排产数量,"
                        + " ISNULL(p.[工艺路线],N'') AS 工艺路线, ISNULL(p.[当前工序],N'') AS 工单当前工序,"
                        + " ISNULL(p.[完工状态],N'') AS 完工状态, ISNULL(p.scx,N'') AS 工单当前线,"
                        + " CONVERT(varchar(16), (SELECT MAX(s.wgsj) FROM dbo.scjl s"
                        + "    WHERE s.gldh = w.工单号 AND ISNULL(s.gxdm,N'') = ISNULL(w.工序,N'')"
                        + "      AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'"
                        + "      AND EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = p.id)), 120) AS 最后报工时间"
                        + " FROM dbo.wo_process_line w"
                        + " JOIN dbo.plang p ON p.id = w.工单行id AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + " WHERE ISNULL(w.asp_cancel,'N')<>'Y' AND ISNULL(w.状态,N'')=N'已落实'"
                        + "   AND COALESCE(NULLIF(w.实际生产线,N''), NULLIF(w.计划生产线,N'')) = ?"
                        + " ORDER BY w.工单号, p.pl_xc, ISNULL(w.工序序,999)", l);
        if (ledgers.isEmpty()) return out;

        // 按工单行缓存 ProcessFlow 派生(同一行多道在制时只算一次)
        Map<Long, List<ProcessFlow.Step>> flowCache = new LinkedHashMap<>();
        for (Map<String, Object> r : ledgers) {
            long rowId = ((Number) r.get("工单行id")).longValue();
            String plNo = str(r.get("工单号"));
            double plSl = num(r.get("排产数量"));
            String op = str(r.get("工序"));
            List<ProcessFlow.Step> steps = flowCache.computeIfAbsent(rowId, id -> {
                try {
                    return ProcessFlow.steps(jdbc, plNo, id, plSl, str(r.get("工艺路线")));
                } catch (Exception e) {
                    log.warn("[工序在制] 工单 {} 行 {} 按量派生失败: {}", plNo, id, e.getMessage());
                    return List.of();
                }
            });
            ProcessFlow.Step step = ProcessFlow.stepOf(steps, op);
            int idx = ProcessFlow.indexOf(steps, op);
            ProcessFlow.Step prev = idx > 0 ? steps.get(idx - 1) : null;

            double planQty = num(r.get("计划数量"));
            double done = step == null ? 0 : step.done();
            double avail = step == null ? 0 : step.avail();
            if (planQty <= 0 && step != null) planQty = step.planQty();
            double canDo = round4(Math.max(avail - done, 0));          // 可排产量
            double cannot = round4(Math.max(planQty - avail, 0));      // 不可排产量

            Map<String, Object> m = new LinkedHashMap<>(r);
            m.put("该道计划量", round4(planQty));
            m.put("该道已完工", round4(done));
            m.put("可加工量", round4(avail));
            m.put("可排产量", canDo);
            m.put("不可排产量", cannot);
            m.put("在制量", step == null ? 0 : round4(step.wip()));
            m.put("换算率", step == null ? 1 : round4(step.rate()));
            m.put("上道工序", prev == null ? "" : prev.op());
            m.put("上道已完工折成品", prev == null ? 0 : round4(prev.doneBase()));
            // 产线归属(实际优先)+ 跨车间标记:存量台账可能排了跨车间的线
            m.put("归属产线", nz(r.get("实际生产线")).isEmpty() ? nz(r.get("计划生产线")) : nz(r.get("实际生产线")));
            m.put("跨车间", !s.isEmpty() && !s.equals(shopOfLine(nz(r.get("计划生产线"))))
                    && !s.equals(shopOfLine(nz(r.get("实际生产线")))));
            out.add(m);
        }
        return out;
    }

    /** 产线所属车间(取不到返回 "") */
    private String shopOfLine(String line) {
        if (line == null || line.isBlank()) return "";
        List<String> r = jdbc.queryForList(
                "SELECT TOP 1 ISNULL(生产车间,N'') FROM dbo.bs_prod_line"
                        + " WHERE 生产线=? AND ISNULL(asp_cancel,'N')<>'Y'", String.class, line.trim());
        return r.isEmpty() || r.get(0) == null ? "" : r.get(0).trim();
    }

    private static double round4(double v) {
        return Math.round(v * 10000d) / 10000d;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static String nz(Object o) {
        String v = str(o);
        return "null".equals(v) ? "" : v;
    }

    private static double num(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(o).trim());
        } catch (Exception e) {
            return 0;
        }
    }
}
