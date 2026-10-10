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
 */
@Service
public class WorkOrderTransferService {

    private static final String PANEL = "MANU_ORDER";
    private static final String LOG_PANEL = "生产工单";

    private final JdbcTemplate jdbc;

    public WorkOrderTransferService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
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
                    if ("T".equals(String.valueOf(h.get("ja"))) || "Y".equals(String.valueOf(h.get("ja"))))
                        throw new IllegalStateException("已结案,不能调拨");
                    String from = str(h.get("scx"));
                    if (from == null) throw new IllegalStateException("该工单未排产,无需调拨(请先在快速排产排入产线)");
                    if (from.equals(line)) throw new IllegalStateException("已在该产线(" + line + "),无需调拨");
                    long id = ((Number) h.get("id")).longValue();
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
                    heads = jdbc.queryForList("SELECT id, ISNULL(pl_xc,0) AS pl_xc, ISNULL(scx,N'') AS scx, ISNULL(ja,'N') AS ja FROM dbo.plang WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", plangId);
                } else if (xc != null) {
                    heads = jdbc.queryForList("SELECT id, ISNULL(pl_xc,0) AS pl_xc, ISNULL(scx,N'') AS scx, ISNULL(ja,'N') AS ja FROM dbo.plang WHERE pl_no=? AND ISNULL(pl_xc,0)=? AND ISNULL(asp_cancel,'N')<>'Y'", no, xc);
                } else {
                    heads = jdbc.queryForList("SELECT id, ISNULL(pl_xc,0) AS pl_xc, ISNULL(scx,N'') AS scx, ISNULL(ja,'N') AS ja FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'", no);
                }
                if (heads.isEmpty()) throw new IllegalStateException("工单行已不存在或已作废");
                for (Map<String, Object> h : heads) {
                    if ("T".equals(String.valueOf(h.get("ja"))) || "Y".equals(String.valueOf(h.get("ja"))))
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
                            + " ISNULL(pl_sl,0) AS pl_sl, ISNULL(ja,'N') AS ja FROM dbo.plang"
                            + " WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", rowId);
        }
        // 没给行id:按 (工单号 + 工单行号) 精确到行(行号也没给才退整单/批次)
        Integer xc = intOf(r.get("工单行号"));
        if (xc != null) {
            return jdbc.queryForList(
                    "SELECT id, pl_no, pl_xc, ISNULL([批次号],N'') AS 批次号, ISNULL(scx,N'') AS scx,"
                            + " ISNULL(pl_sl,0) AS pl_sl, ISNULL(ja,'N') AS ja FROM dbo.plang"
                            + " WHERE pl_no=? AND ISNULL(pl_xc,0)=? AND ISNULL(asp_cancel,'N')<>'Y'", no, xc);
        }
        String batch = str(r.get("批次号"));
        String sql = "SELECT id, pl_no, pl_xc, ISNULL([批次号],N'') AS 批次号, ISNULL(scx,N'') AS scx,"
                + " ISNULL(pl_sl,0) AS pl_sl, ISNULL(ja,'N') AS ja FROM dbo.plang"
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
