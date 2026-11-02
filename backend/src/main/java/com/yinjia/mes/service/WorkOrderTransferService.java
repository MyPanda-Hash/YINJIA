package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工单调拨(9.29 生产管理批次 ②,2026-10-05):把工单从一条产线调到目标产线/车间,**留轨迹、可撤回**。
 *
 * <p><b>会议口径</b>:「生产线界面,选中工单 → 调拨到目标产线/车间;待加工列表与报工记录跟随转移,
 * 保留调拨轨迹」。
 *
 * <p><b>落地要点</b>:
 * <ol>
 *   <li><b>车间是产线的属性</b>({@code bs_prod_line.生产车间}),不另建车间主数据:选车间 = 把目标产线
 *       收敛到该车间的线;后端反查校验「目标线 ∈ 目标车间」,不信任前端。</li>
 *   <li><b>轨迹表</b>{@code wo_transfer_log}:每次调拨一行(从/到 生产线·车间 + 数量 + 原因 + 调拨人),
 *       工单追溯时间线可直接看到。</li>
 *   <li><b>可撤回</b>({@code revoke}):把该工单**最后一条生效轨迹**撤销 —— 产线调回 {@code 从生产线},
 *       轨迹行标 {@code asp_cancel='Y'}(留痕不删)。当前产线已被再次调拨时拒绝(防错位回退)。</li>
 *   <li><b>待加工/报工跟随</b>:报工行以工单号为键,调拨后**新**报工自动写新产线(报工时从 plang_pc 取
 *       scx);历史报工行的产线是当时快照,**不回写**(改历史=篡改账)。按产线看历史产量应走
 *       「工单当前产线」口径而非 scjl.scx 快照。</li>
 *   <li>与「撤销排产」的区别:撤销排产把工单退回待排产池(要求无报工/无入库);<b>调拨允许在产工单</b>
 *       (会议要的就是在产转移),只要求未结案。</li>
 * </ol>
 *
 * <p><b>2026-10-29 收口(用户口径:「修改当前工单排产的调拨逻辑,需要实现当前的调拨只能调拨到
 * 当前工序的产线中」)</b>:目标产线不再是"整条产线档案任选",必须配得上该工单行**当前工序** ——
 * <ol>
 *   <li>当前工序 = 看板「当前工序」列同一口径({@link ProcessTaskService#currentProcess}:
 *       台账最后一道已落实 → 回落本行 plang.当前工序);</li>
 *   <li>该工序能去哪些线 = {@link ProcessTaskService#lineScope}(与派工/预排线/转序**同一处**软判据:
 *       成型/切炭/组装/装箱 认得的工序且该车间真有启用线才限定,判不出则不拦);</li>
 *   <li>弹窗下拉由 {@link #targets} 一次算好(前端只展示,不自己拼),但**守卫在服务端**:
 *       前端传什么都要逐行复核,不信任界面;</li>
 *   <li>多行同时勾选时只给**交集**候选 —— 不同工序的工单没有共同合法目标,宁可明说"分行调拨"。</li>
 * </ol>
 */
@Service
public class WorkOrderTransferService {

    private static final String LOG_PANEL = "生产工单";

    private final JdbcTemplate jdbc;
    /** 当前工序 / 工序→产线软判据的唯一出处(调拨守卫与候选线都读它,不另写一套) */
    private final ProcessTaskService processTask;

    public WorkOrderTransferService(JdbcTemplate jdbc, ProcessTaskService processTask) {
        this.jdbc = jdbc;
        this.processTask = processTask;
    }

    /** 车间下拉(启用产线的车间去重;调拨弹窗用) */
    public List<Map<String, Object>> workshops() {
        return jdbc.queryForList(
                "SELECT 生产车间 AS 车间, COUNT(*) AS 产线数 FROM bs_prod_line"
                        + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(停用,0)=0"
                        + "   AND ISNULL(生产车间,N'')<>N'' GROUP BY 生产车间 ORDER BY 生产车间");
    }

    /**
     * 调拨:逐工单改产线(plang + plang_pc)+ 写轨迹 + 留痕;守卫=停用线拒绝 / 已结案拒绝 / 未排产拒绝 /
     * 目标线不属于目标车间拒绝 / 已在该线拒绝。行级失败进 failed,成功各自提交(口径同 ScheduleBoardService)。
     */
    @Transactional
    public Map<String, Object> transfer(List<Map<String, Object>> rows, String toLine, String toShop, String reason, String user) {
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("请先勾选要调拨的工单");
        String line = str(toLine);
        if (line == null) throw new IllegalArgumentException("请选择目标生产线");
        Map<String, Object> target = lineInfo(line);
        if (target == null) throw new IllegalArgumentException("目标生产线「" + line + "」不存在(请先在 基础资料→生产线 建档)");
        if (Num.of(target.get("停用")) == 1)
            throw new IllegalArgumentException("目标生产线「" + line + "」已停用,不可调入(如需启用请在 基础资料→生产线 打开)");
        String shop = str(target.get("生产车间"));
        String reqShop = str(toShop);
        if (reqShop != null && !reqShop.equals(shop))
            throw new IllegalArgumentException("目标生产线「" + line + "」不属于车间「" + reqShop + "」(该线属「"
                    + (shop == null ? "未归类" : shop) + "」)");

        List<String> done = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String no = str(r.get("工单号") != null ? r.get("工单号") : r.get("加工单号"));
            if (no == null) { failed.add("(缺工单号)"); continue; }
            try {
                List<Map<String, Object>> heads = targetRows(no, r);
                if (heads.isEmpty()) throw new IllegalStateException("工单不存在或已作废");
                List<String> moved = new ArrayList<>();
                for (Map<String, Object> h : heads) {
                    // 已结案守卫(2026-10-19 收口):按 PlangClose 判 —— 外部程序把 ja 写成 Y 而入库=0 时,
                    //   旧写法会报「已结案,不能调拨」把调拨整条挡住。
                    if (com.yinjia.mes.service.PlangClose.isClosed(str(h.get("ja")), Num.of(h.get("pl_sl")),
                            Num.of(h.get("rk_sl")), str(h.get("pl_no"))))
                        throw new IllegalStateException("已结案,不能调拨");
                    String from = str(h.get("scx"));
                    if (from == null) throw new IllegalStateException("该工单未排产,无需调拨(请先在快速排产排入产线)");
                    if (from.equals(line)) throw new IllegalStateException("已在该产线(" + line + "),无需调拨");
                    long id = ((Number) h.get("id")).longValue();
                    // 🔴 2026-10-29 用户口径「调拨只能调拨到当前工序的产线中」:
                    //   当前工序 = 看板「当前工序」列同一口径;该道能去的线 = 派工/预排线/转序同一处软判据。
                    //   ⚠ 前端下拉只是便利(见 targets),**守卫必须在服务端** —— 手搓请求/旧页面同样要被拦住。
                    String op = processTask.currentProcess(no, id);
                    Map<String, Object> scope = processTask.lineScope(op, null);
                    Object needShopObj = scope.get("限定车间");
                    if (needShopObj != null) {
                        String needShop = String.valueOf(needShopObj);
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> allowLines = (List<Map<String, Object>>) scope.get("产线");
                        List<String> allowNames = allowLines.stream()
                                .map(x -> String.valueOf(x.get("生产线"))).toList();
                        if (!allowNames.contains(line))
                            throw new IllegalStateException("当前工序「" + op + "」只能调拨到「" + needShop
                                    + "」车间下的产线(" + (allowNames.isEmpty() ? "该车间暂无启用产线"
                                    : String.join("、", allowNames))
                                    + ");目标线「" + line + "」属于「" + (shop == null ? "未归类" : shop) + "」车间");
                    }
                    double qty = Num.of(h.get("pl_sl"));
                    String fromShop = str(shopOf(from));
                    jdbc.update("UPDATE dbo.plang SET scx=?, asp_user2=?, asp_time2=GETDATE() WHERE id=?", line, user, id);
                    jdbc.update("UPDATE dbo.plang_pc SET scx=?, asp_user2=?, asp_time2=GETDATE() WHERE plang_id=?", line, user, id);
                    jdbc.update("INSERT INTO dbo.wo_transfer_log (pl_no, pl_xc, [批次号], plang_id, 数量,"
                                    + " 从生产线, 从车间, 到生产线, 到车间, 原因, asp_cancel, asp_user1, asp_time1)"
                                    + " VALUES (?,?,?,?,?,?,?,?,?,?,N'N',?,GETDATE())",
                            String.valueOf(h.get("pl_no")), h.get("pl_xc"), h.get("批次号"), id, qty,
                            from, fromShop, line, shop, str(reason), user);
                    moved.add(from + "→" + line);
                }
                // 留痕带工单行号(2026-10-15 用户口径「流转时间线…要根据工单行号完成」):
                //   单行调拨写该行行号(h.pl_xc);整单调拨(rows 未给行id、targetRows 返多行)时 null = 工单级
                logUsage(user, "调拨", no, heads.size() == 1 ? intOf(heads.get(0).get("pl_xc")) : null);
                done.add(no + "(" + String.join("、", moved) + ")");
            } catch (IllegalStateException e) {
                failed.add(no + ":" + e.getMessage());
            }
        }
        if (done.isEmpty()) throw new IllegalStateException("无行可调拨:" + String.join("; ", failed));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("调拨张数", done.size());
        out.put("单号清单", done);
        out.put("失败行", failed);
        out.put("目标", line + (shop == null ? "" : "·" + shop));
        return out;
    }

    /**
     * **调拨候选**(2026-10-29 用户口径「调拨只能调拨到当前工序的产线中」):弹窗要显示的
     * 「这些工单行的当前工序是什么、目标车间/产线能选哪些」—— 一次算好给前端,前端不再自己拼。
     *
     * <p>多行同时勾选时取**交集**(每个选中行都允许的线):不同工序的工单没有共同的合法目标,
     * 宁可明说「请分行调拨」,也不给一个点了就被服务端驳回的选项。
     *
     * <p>⚠ 本方法的判定与 {@link #transfer} 的守卫**同一处来源**
     * ({@link ProcessTaskService#currentProcess} + {@link ProcessTaskService#lineScope}):
     * 弹窗看到的可选项 == 点确认后能通过的行,不会出现"选得到却调不动"。
     *
     * @param rows 勾选行(工单号/行id/工单行号/批次号,与 /transfer 同格式)
     * @return {@code {逐行, 工序, 车间, 产线, 可调拨, 提示}}
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> targets(List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("请先勾选要调拨的工单");
        List<Map<String, Object>> perRow = new ArrayList<>();
        List<Map<String, Object>> allow = null;      // 交集;null = 尚未起手
        List<String> ops = new ArrayList<>();
        String commonFrom = null;                    // 所有选中行的共同当前产线(用来剔掉"调回原线")
        boolean sameFrom = true;
        for (Map<String, Object> r : rows) {
            String no = str(r.get("工单号") != null ? r.get("工单号") : r.get("加工单号"));
            if (no == null) continue;
            for (Map<String, Object> h : targetRows(no, r)) {
                long id = ((Number) h.get("id")).longValue();
                String op = processTask.currentProcess(no, id);
                Map<String, Object> scope = processTask.lineScope(op, null);
                Object needShop = scope.get("限定车间");
                List<Map<String, Object>> lines = (List<Map<String, Object>>) scope.get("产线");
                allow = allow == null ? new ArrayList<>(lines) : intersect(allow, lines);
                if (op != null && !ops.contains(op)) ops.add(op);
                String from = str(h.get("scx"));
                if (from == null) sameFrom = false;
                else if (commonFrom == null) commonFrom = from;
                else if (!commonFrom.equals(from)) sameFrom = false;
                Map<String, Object> pr = new LinkedHashMap<>();
                pr.put("工单号", no);
                pr.put("行id", id);
                pr.put("工单行号", h.get("pl_xc"));
                pr.put("当前工序", op == null ? "" : op);
                pr.put("应进车间", needShop == null ? "" : String.valueOf(needShop));
                pr.put("当前产线", from == null ? "" : from);
                pr.put("候选数", lines.size());
                perRow.add(pr);
            }
        }
        if (perRow.isEmpty()) throw new IllegalStateException("没找到可调拨的工单行(工单不存在或已作废)");
        List<Map<String, Object>> lines = allow == null ? new ArrayList<>() : allow;
        // 全部选中行都在同一条线上 ⇒ 候选里剔掉它(调回原线没有意义,transfer 也会拒)
        if (sameFrom && commonFrom != null) {
            String fromLine = commonFrom;
            lines.removeIf(x -> fromLine.equals(str(x.get("生产线"))));
        }
        List<String> lineShops = new ArrayList<>();
        for (Map<String, Object> l : lines) {
            String s = str(l.get("生产车间"));
            if (s != null && !lineShops.contains(s)) lineShops.add(s);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("逐行", perRow);
        out.put("工序", ops);
        out.put("车间", lineShops);
        out.put("产线", lines);
        out.put("可调拨", !lines.isEmpty());
        out.put("提示", !lines.isEmpty() ? ""
                : ops.size() > 1
                    ? "所选工单当前工序不同(" + String.join(" / ", ops) + "),没有共同的合法目标产线;请按工序分行调拨"
                    : "当前工序「" + (ops.isEmpty() ? "判不出" : ops.get(0)) + "」没有可调拨的目标产线"
                        + "(该工序归口车间没有启用线,或只剩当前产线)");
        return out;
    }

    /** 两组产线取交集(按「生产线」名称;保留第一组的顺序与字段) */
    private static List<Map<String, Object>> intersect(List<Map<String, Object>> a, List<Map<String, Object>> b) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> x : a) {
            String name = str(x.get("生产线"));
            for (Map<String, Object> y : b) {
                if (name != null && name.equals(str(y.get("生产线")))) { out.add(x); break; }
            }
        }
        return out;
    }

    /**
     * 撤回调拨:按工单**最后一条生效轨迹**把产线调回 从生产线,轨迹标 asp_cancel='Y'。
     * 守卫:无可撤轨迹 / 已结案 / 当前产线 ≠ 轨迹目标(说明之后又被调拨过) → 拒绝并提示。
     */
    @Transactional
    public Map<String, Object> revoke(List<Map<String, Object>> rows, String user) {
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("请先勾选要撤回调拨的工单");
        List<String> done = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String no = str(r.get("工单号") != null ? r.get("工单号") : r.get("加工单号"));
            if (no == null) { failed.add("(缺工单号)"); continue; }
            try {
                Long rowId = longOf(r.get("行id"));
                Integer xc = intOf(r.get("工单行号"));
                // 定位优先:行id → (工单号+工单行号) → 整单最近一条
                List<Map<String, Object>> logs;
                if (rowId != null) {
                    logs = jdbc.queryForList("SELECT TOP 1 * FROM dbo.wo_transfer_log WHERE plang_id=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC", rowId);
                } else if (xc != null) {
                    logs = jdbc.queryForList("SELECT TOP 1 * FROM dbo.wo_transfer_log WHERE pl_no=? AND pl_xc=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC", no, xc);
                } else {
                    logs = jdbc.queryForList("SELECT TOP 1 * FROM dbo.wo_transfer_log WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC", no);
                }
                if (logs.isEmpty()) throw new IllegalStateException("没有可撤销的调拨记录");
                Map<String, Object> lg = logs.get(0);
                long logId = ((Number) lg.get("id")).longValue();
                Long plangId = longOf(lg.get("plang_id"));
                List<Map<String, Object>> heads;
                if (plangId != null) {
                    heads = jdbc.queryForList("SELECT id, ISNULL(pl_xc,0) AS pl_xc, ISNULL(scx,N'') AS scx, ISNULL(pl_sl,0) AS pl_sl, ISNULL(rk_sl,0) AS rk_sl, ISNULL(pl_no,N'') AS pl_no, ISNULL(ja,'N') AS ja FROM dbo.plang WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", plangId);
                } else if (xc != null) {
                    heads = jdbc.queryForList("SELECT id, ISNULL(pl_xc,0) AS pl_xc, ISNULL(scx,N'') AS scx, ISNULL(pl_sl,0) AS pl_sl, ISNULL(rk_sl,0) AS rk_sl, ISNULL(pl_no,N'') AS pl_no, ISNULL(ja,'N') AS ja FROM dbo.plang WHERE pl_no=? AND ISNULL(pl_xc,0)=? AND ISNULL(asp_cancel,'N')<>'Y'", no, xc);
                } else {
                    heads = jdbc.queryForList("SELECT id, ISNULL(pl_xc,0) AS pl_xc, ISNULL(scx,N'') AS scx, ISNULL(pl_sl,0) AS pl_sl, ISNULL(rk_sl,0) AS rk_sl, ISNULL(pl_no,N'') AS pl_no, ISNULL(ja,'N') AS ja FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'", no);
                }
                if (heads.isEmpty()) throw new IllegalStateException("工单行已不存在或已作废");
                for (Map<String, Object> h : heads) {
                    // 已结案守卫(2026-10-19 收口,同调拨):外部误写 ja=Y 不再挡住撤回。
                    if (com.yinjia.mes.service.PlangClose.isClosed(str(h.get("ja")), Num.of(h.get("pl_sl")),
                            Num.of(h.get("rk_sl")), str(h.get("pl_no"))))
                        throw new IllegalStateException("已结案,不能撤回调拨");
                    String cur = str(h.get("scx"));
                    String to = str(lg.get("到生产线"));
                    if (cur == null || !cur.equals(to))
                        throw new IllegalStateException("工单当前产线「" + (cur == null ? "未排产" : cur)
                                + "」与该调拨目标「" + to + "」不一致(之后又被调拨过?),不能按此撤回");
                    String back = str(lg.get("从生产线"));
                    if (back == null) throw new IllegalStateException("该轨迹没有原产线,无法撤回");
                    long id = ((Number) h.get("id")).longValue();
                    jdbc.update("UPDATE dbo.plang SET scx=?, asp_user2=?, asp_time2=GETDATE() WHERE id=?", back, user, id);
                    jdbc.update("UPDATE dbo.plang_pc SET scx=?, asp_user2=?, asp_time2=GETDATE() WHERE plang_id=?", back, user, id);
                }
                jdbc.update("UPDATE dbo.wo_transfer_log SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE() WHERE id=?", user, logId);
                logUsage(user, "撤回调拨", no, heads.size() == 1 ? intOf(heads.get(0).get("pl_xc")) : null);
                done.add(no + ":" + lg.get("到生产线") + "→" + lg.get("从生产线"));
            } catch (IllegalStateException e) {
                failed.add(no + ":" + e.getMessage());
            }
        }
        if (done.isEmpty()) throw new IllegalStateException("无行可撤回:" + String.join("; ", failed));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("撤回张数", done.size());
        out.put("单号清单", done);
        out.put("失败行", failed);
        return out;
    }

    // ────────────────────────── 内部 ──────────────────────────

    /**
     * 待调拨的 plang 行:定位优先级 = **行id** → **工单号 + 工单行号**(用户口径 2026-10-15
     * 「工单号+工单行号确定当前唯一工单」)→ 批次号 → 该工单全部未作废行(老口径兜底)。
     */
    private List<Map<String, Object>> targetRows(String no, Map<String, Object> r) {
        Long rowId = longOf(r.get("行id"));
        if (rowId != null) {
            return jdbc.queryForList(
                    "SELECT id, pl_no, pl_xc, ISNULL([批次号],N'') AS 批次号, ISNULL(scx,N'') AS scx,"
                            + " ISNULL(pl_sl,0) AS pl_sl, ISNULL(rk_sl,0) AS rk_sl, ISNULL(ja,'N') AS ja FROM dbo.plang"
                            + " WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", rowId);
        }
        // 没给行id:按 (工单号 + 工单行号) 精确到行(行号也没给才退整单/批次)
        Integer xc = intOf(r.get("工单行号"));
        if (xc != null) {
            return jdbc.queryForList(
                    "SELECT id, pl_no, pl_xc, ISNULL([批次号],N'') AS 批次号, ISNULL(scx,N'') AS scx,"
                            + " ISNULL(pl_sl,0) AS pl_sl, ISNULL(rk_sl,0) AS rk_sl, ISNULL(ja,'N') AS ja FROM dbo.plang"
                            + " WHERE pl_no=? AND ISNULL(pl_xc,0)=? AND ISNULL(asp_cancel,'N')<>'Y'", no, xc);
        }
        String batch = str(r.get("批次号"));
        String sql = "SELECT id, pl_no, pl_xc, ISNULL([批次号],N'') AS 批次号, ISNULL(scx,N'') AS scx,"
                + " ISNULL(pl_sl,0) AS pl_sl, ISNULL(rk_sl,0) AS rk_sl, ISNULL(ja,'N') AS ja FROM dbo.plang"
                + " WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'";
        return batch == null ? jdbc.queryForList(sql, no)
                : jdbc.queryForList(sql + " AND ISNULL([批次号],N'')=?", no, batch);
    }

    private static Integer intOf(Object o) {
        if (o == null || String.valueOf(o).isBlank() || "null".equals(String.valueOf(o))) return null;
        if (o instanceof Number n) return n.intValue();
        try { return (int) Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return null; }
    }

    private Map<String, Object> lineInfo(String line) {
        List<Map<String, Object>> l = jdbc.queryForList(
                "SELECT 生产线, ISNULL(生产车间,N'') AS 生产车间, ISNULL(停用,0) AS 停用 FROM bs_prod_line"
                        + " WHERE 生产线=? AND ISNULL(asp_cancel,'N')<>'Y'", line);
        return l.isEmpty() ? null : l.get(0);
    }

    private String shopOf(String line) {
        List<String> s = jdbc.queryForList(
                "SELECT TOP 1 ISNULL(生产车间,N'') FROM bs_prod_line WHERE 生产线=? AND ISNULL(asp_cancel,'N')<>'Y'",
                String.class, line);
        return s.isEmpty() || s.get(0).isBlank() ? null : s.get(0);
    }

    /**
     * 按钮留痕(yj_usage_log;失败不阻断业务)。
     * 2026-10-15:补 [工单行号] —— 用户口径「流转时间线…要根据工单行号完成」;行键落专列不拼进 doc_no。
     */
    private void logUsage(String user, String action, String docNo, Integer xc) {
        try {
            jdbc.update("INSERT INTO yj_usage_log (user_name, real_name, event_type, panel_name, action_name, doc_no,"
                            + " [工单行号], created_at)"
                            + " VALUES (?, ISNULL((SELECT real_name FROM yj_user WHERE username = ?), ?),"
                            + " N'生产', ?, ?, ?, ?, GETDATE())",
                    user, user, user, LOG_PANEL, action, docNo, xc);
        } catch (Exception ignore) { /* 留痕失败不阻断 */ }
    }

    private static Long longOf(Object o) {
        if (o == null || String.valueOf(o).isBlank() || "null".equals(String.valueOf(o))) return null;
        if (o instanceof Number n) return n.longValue();
        try { return Long.valueOf(String.valueOf(o).trim()); } catch (NumberFormatException e) { return null; }
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isBlank() || "null".equals(s) ? null : s;
    }

    private static final class Num {
        static double of(Object o) {
            if (o == null || String.valueOf(o).isBlank()) return 0;
            if (o instanceof Number n) return n.doubleValue();
            try { return Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return 0; }
        }
    }
}
