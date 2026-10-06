package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 路线驱动的**工序任务**(9.29 生产管理批次 A 项,2026-10-05)。
 *
 * <p>用户选定方案 A:「工单按**工艺路线**生成工序任务,每道工序一份待加工列表、可排序、可派工到线/机台,
 * 报工回写任务」。工序/工艺口径依《新系统产线命名.xlsx》= **成型 / 切炭 / 组装**(装箱归组装)。
 *
 * <p><b>载体复用</b>:工序任务落在既有表 {@code wo_progress}(工单工序进度,实测 0 行;其面板
 * WO_PROGRESS 可直接查看)—— 不另造表。列口径:
 * <ul>
 *   <li>{@code 单据编号}=工单号、{@code 工单行id}=plang.id、{@code 批次号}、{@code 工序}/{@code 工序序};</li>
 *   <li>{@code 计划数量}={@code 完成数量}、{@code 状态}(待加工→在加工→已完工);</li>
 *   <li>{@code 生产车间}=该工序的功能(成型/切炭/组装)、{@code 生产线}=派工到的产线;</li>
 *   <li>{@code 优先级}(普通/急单)、{@code 排序号}(人工排序,空则自动顺序)、{@code 计划完工日期}。</li>
 * </ul>
 *
 * <p><b>路线来源</b>:产品档案 {@code bs_inv.工艺路线}(→{@code bs_route});产品没绑 → 默认路线
 * {@code GY-CB-STD}「炭棒标准路线」(成型→切炭→组装)。工单行多行(多批次/多订单行)各自生成一套任务。
 *
 * <p><b>排序口径</b>(每道工序的待加工列表):急单优先 → 计划完工日期 → 排序号 → 工单号。
 */
@Service
public class ProcessTaskService {

    /** 默认工艺路线(产品未绑定时兜底) */
    public static final String DEFAULT_ROUTE = "GY-CB-STD";
    private static final String LOG_PANEL = "工序任务";

    private final JdbcTemplate jdbc;

    public ProcessTaskService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ────────────────────────── 生成 ──────────────────────────

    /**
     * 按工艺路线给某工单生成工序任务(转工单/切单/调拨后调用)。幂等:同(工单行, 工序)已有任务则跳过。
     *
     * @return 新生成的任务行数
     */
    @Transactional
    public int generateForWorkOrder(String plNo, String user) {
        if (plNo == null || plNo.isBlank()) return 0;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, pl_no, pl_xc, ISNULL([批次号],N'') AS 批次号, ISNULL(dm,N'') AS 产品编码,"
                        + " ISNULL(mc,N'') AS 产品名称, ISNULL(gg,N'') AS 规格型号, ISNULL(pl_sl,0) AS 计划数量,"
                        + " CONVERT(varchar(10), cp_date, 120) AS 计划完工日期"
                        + " FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id", plNo);
        int created = 0;
        for (Map<String, Object> r : rows) {
            String route = routeOf(String.valueOf(r.get("产品编码")));
            List<Map<String, Object>> ops = jdbc.queryForList(
                    "SELECT 加工顺序, ISNULL(工序名称,N'') AS 工序, ISNULL(生产车间,N'') AS 生产车间"
                            + " FROM dbo.bs_route WHERE 工艺路线编码=? AND ISNULL(asp_cancel,'N')<>'Y'"
                            + " ORDER BY 加工顺序", route);
            for (Map<String, Object> op : ops) {
                Integer dup = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM dbo.wo_progress WHERE 单据编号=? AND 工单行id=? AND 工序=?"
                                + " AND ISNULL(asp_cancel,'N')<>'Y'",
                        Integer.class, plNo, r.get("id"), op.get("工序"));
                if (dup != null && dup > 0) continue;
                created += jdbc.update(
                        "INSERT INTO dbo.wo_progress (单据编号, 工序, 计划数量, 完成数量, 备注,"
                                + " 工单行id, [批次号], 工序序, 生产车间, 状态, 优先级, 计划完工日期,"
                                + " 产品编码, 产品名称, 规格型号, asp_cancel, asp_user1, asp_time1)"
                                + " VALUES (?,?,?,0,?,?,?,?,?,N'待加工',N'普通',?,?,?,?,N'N',?,GETDATE())",
                        plNo, op.get("工序"), r.get("计划数量"), "路线 " + route,
                        r.get("id"), r.get("批次号"), op.get("加工顺序"), op.get("生产车间"),
                        blankToNull(r.get("计划完工日期")), r.get("产品编码"), r.get("产品名称"), r.get("规格型号"),
                        user);
            }
        }
        return created;
    }

    /** 产品档案绑定的工艺路线;没绑/查不到 → 默认路线 */
    private String routeOf(String dm) {
        if (dm == null || dm.isBlank()) return DEFAULT_ROUTE;
        List<String> r = jdbc.queryForList(
                "SELECT TOP 1 ISNULL([工艺路线],N'') FROM dbo.bs_inv WHERE 存货编码=? AND ISNULL(asp_cancel,'N')<>'Y'",
                String.class, dm);
        return r.isEmpty() || r.get(0).isBlank() ? DEFAULT_ROUTE : r.get(0).trim();
    }

    // ────────────────────────── 队列 / 派工 ──────────────────────────

    /**
     * 工序任务队列(一道工序一份列表):筛选 工序 / 生产车间 / 生产线 / 状态 / 关键字;
     * 排序 = 急单优先 → 计划完工日期 → 排序号 → 工单号(现场排队口径)。
     */
    public List<Map<String, Object>> queue(String op, String shop, String line, String status, String keyword) {
        List<Object> args = new ArrayList<>();
        StringBuilder w = new StringBuilder(" WHERE ISNULL(p.asp_cancel,'N')<>'Y'");
        if (notBlank(op)) { w.append(" AND p.工序 = ?"); args.add(op.trim()); }
        if (notBlank(shop)) { w.append(" AND ISNULL(p.生产车间,N'') = ?"); args.add(shop.trim()); }
        if (notBlank(line)) { w.append(" AND ISNULL(p.生产线,N'') = ?"); args.add(line.trim()); }
        if (notBlank(status)) { w.append(" AND ISNULL(p.状态,N'') = ?"); args.add(status.trim()); }
        if (notBlank(keyword)) {
            String like = "%" + keyword.trim() + "%";
            w.append(" AND (p.单据编号 LIKE ? OR p.产品编码 LIKE ? OR p.产品名称 LIKE ? OR ISNULL(g.khdm,'') LIKE ?)");
            for (int i = 0; i < 4; i++) args.add(like);
        }
        return jdbc.queryForList(
                "SELECT p.id AS 任务id, p.单据编号 AS 工单号, g.pl_xc AS 工单行号, ISNULL(p.[批次号],N'') AS 批次号,"
                        + " p.工序, ISNULL(p.工序序,0) AS 工序序, ISNULL(p.生产车间,N'') AS 生产车间,"
                        + " ISNULL(p.生产线,N'') AS 生产线, ISNULL(p.状态,N'') AS 状态, ISNULL(p.优先级,N'普通') AS 优先级,"
                        + " ISNULL(p.排序号,0) AS 排序号, ISNULL(p.计划数量,0) AS 计划数量,"
                        + " ISNULL(p.完成数量,0) AS 完成数量,"
                        + " ISNULL(p.计划数量,0) - ISNULL(p.完成数量,0) AS 未完成量,"
                        + " CONVERT(varchar(10), p.计划完工日期, 120) AS 计划完工日期,"
                        + " ISNULL(p.产品编码,N'') AS 产品编码, ISNULL(p.产品名称,N'') AS 产品名称,"
                        + " ISNULL(p.规格型号,N'') AS 规格型号, ISNULL(g.khdm,N'') AS 客户代码,"
                        + " CONVERT(varchar(10), g.cp_date, 120) AS 工单交期"
                        + " FROM dbo.wo_progress p LEFT JOIN dbo.plang g ON g.id = p.工单行id"
                        + w
                        + " ORDER BY CASE WHEN ISNULL(p.优先级,N'普通') = N'急单' THEN 0 ELSE 1 END,"
                        + " ISNULL(p.计划完工日期,'2100-01-01'), ISNULL(p.排序号,0), p.单据编号, ISNULL(p.工序序,0)",
                args.toArray());
    }

    /** 队列筛选选项(工序 / 状态 / 生产车间 / 产线),供前端下拉 */
    public Map<String, Object> meta() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("工序", jdbc.queryForList("SELECT DISTINCT 工序 FROM dbo.wo_progress"
                + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(工序,N'')<>N'' ORDER BY 工序", String.class));
        out.put("状态", List.of("待加工", "在加工", "已完工"));
        out.put("生产车间", jdbc.queryForList("SELECT DISTINCT ISNULL(生产车间,N'') AS v FROM dbo.wo_progress"
                + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(生产车间,N'')<>N'' ORDER BY v", String.class));
        out.put("产线", jdbc.queryForList("SELECT 生产线 FROM dbo.bs_prod_line"
                + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(停用,0)=0 ORDER BY ISNULL(排序,999), 生产线", String.class));
        out.put("路线", jdbc.queryForList("SELECT DISTINCT 工艺路线编码 AS v FROM dbo.bs_route"
                + " WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY v", String.class));
        return out;
    }

    /** 派工:任务 → 生产线(状态 待加工→在加工)+ 留痕;可批量 */
    @Transactional
    public Map<String, Object> assign(List<Object> ids, String line, String user) {
        if (ids == null || ids.isEmpty()) throw new IllegalArgumentException("请先勾选要派工的工序任务");
        if (!notBlank(line)) throw new IllegalArgumentException("请选择生产线");
        Integer dis = jdbc.queryForObject("SELECT CASE WHEN ISNULL(停用,0)=1 THEN 1 ELSE 0 END FROM dbo.bs_prod_line"
                + " WHERE 生产线=? AND ISNULL(asp_cancel,'N')<>'Y'", Integer.class, line.trim());
        if (dis != null && dis == 1) throw new IllegalArgumentException("生产线「" + line + "」已停用,不可派工");
        // 工序↔产线挂钩的**服务端硬约束**(2026-10-05):产线的「生产车间」= 工序/工艺(成型/切炭/组装),
        // 必须与任务的工序一致 —— 前端下拉只是便利,接口层不能靠它兜底
        String lineShop = jdbc.queryForObject("SELECT ISNULL(生产车间,N'') FROM dbo.bs_prod_line"
                + " WHERE 生产线=? AND ISNULL(asp_cancel,'N')<>'Y'", String.class, line.trim());
        List<String> done = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        for (Object idObj : ids) {
            long id = ((Number) idObj).longValue();
            try {
                List<Map<String, Object>> rows = jdbc.queryForList(
                        "SELECT 单据编号, 工序, ISNULL(生产车间,N'') AS 生产车间, ISNULL(状态,N'') AS 状态"
                                + " FROM dbo.wo_progress WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", id);
                if (rows.isEmpty()) throw new IllegalStateException("任务不存在或已作废");
                String st = String.valueOf(rows.get(0).get("状态"));
                if ("已完工".equals(st)) throw new IllegalStateException("已完工,无需派工");
                String taskShop = String.valueOf(rows.get(0).get("生产车间"));
                if (!taskShop.isBlank() && !taskShop.equals(lineShop == null ? "" : lineShop)) {
                    throw new IllegalStateException("生产线「" + line.trim() + "」属于「" + lineShop + "」,"
                            + "与任务的工序「" + taskShop + "」不一致");
                }
                jdbc.update("UPDATE dbo.wo_progress SET 生产线=?, 状态=N'在加工', asp_user2=?, asp_time2=GETDATE() WHERE id=?",
                        line.trim(), user, id);
                done.add(String.valueOf(rows.get(0).get("单据编号")) + "/" + rows.get(0).get("工序"));
            } catch (IllegalStateException e) {
                failed.add(id + ":" + e.getMessage());
            }
        }
        if (done.isEmpty()) throw new IllegalStateException("无任务可派工:" + String.join("; ", failed));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("派工行数", done.size());
        out.put("任务清单", done);
        out.put("失败行", failed);
        out.put("生产线", line.trim());
        return out;
    }

    /** 设置优先级(急单/普通)+ 排序号 */
    @Transactional
    public Map<String, Object> prioritize(List<Object> ids, String priority, Integer sortNo, String user) {
        if (ids == null || ids.isEmpty()) throw new IllegalArgumentException("请先勾选工序任务");
        String p = notBlank(priority) ? priority.trim() : null;
        int n = 0;
        for (Object idObj : ids) {
            long id = ((Number) idObj).longValue();
            if (p != null && sortNo != null) {
                n += jdbc.update("UPDATE dbo.wo_progress SET 优先级=?, 排序号=?, asp_user2=?, asp_time2=GETDATE() WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", p, sortNo, user, id);
            } else if (p != null) {
                n += jdbc.update("UPDATE dbo.wo_progress SET 优先级=?, asp_user2=?, asp_time2=GETDATE() WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", p, user, id);
            } else if (sortNo != null) {
                n += jdbc.update("UPDATE dbo.wo_progress SET 排序号=?, asp_user2=?, asp_time2=GETDATE() WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", sortNo, user, id);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("更新行数", n);
        return out;
    }

    // ────────────────────────── 报工回写 ──────────────────────────

    /**
     * 报工审核 → 对应工序任务的完成数量累计 + 状态推进(完成量 ≥ 计划量 → 已完工)。
     * 同一(工单号, 工序)可能有多条任务(多行/多批次):按 工序序 → id 顺序**逐条填满**(先进先出口径)。
     */
    @Transactional
    public void onReport(String panelCode, String repNo, String user) {
        applyReport(panelCode, repNo, user, 1);
    }

    /** 报工弃审 → 完成数量对称回退(状态回 在加工/待加工) */
    @Transactional
    public void onUnreport(String panelCode, String repNo, String user) {
        applyReport(panelCode, repNo, user, -1);
    }

    private void applyReport(String panelCode, String repNo, String user, int sign) {
        if (!"WO_REPORT".equals(panelCode)) return;
        List<Map<String, Object>> reps = jdbc.queryForList(
                "SELECT ISNULL(gldh,N'') AS 工单号, ISNULL(gxdm,N'') AS 工序, ISNULL(sl,0) AS 报工数量"
                        + " FROM dbo.scjl WHERE [报工单号]=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + (sign > 0 ? " AND ISNULL(wgzt,'N')='Y'" : ""), repNo);
        for (Map<String, Object> r : reps) {
            String wo = String.valueOf(r.get("工单号")).trim();
            String op = String.valueOf(r.get("工序")).trim();
            double qty = num(r.get("报工数量")) * sign;
            if (wo.isEmpty() || op.isEmpty() || qty == 0) continue;
            // 报工审核/弃审 → **回写工单状态**(2026-10-05 用户口径「报工需要能影响当前的工单情况」),幂等重算
            syncWorkOrderState(wo, user);
            List<Map<String, Object>> tasks = jdbc.queryForList(
                    "SELECT id, ISNULL(计划数量,0) AS 计划数量, ISNULL(完成数量,0) AS 完成数量, ISNULL(状态,N'') AS 状态"
                            + " FROM dbo.wo_progress WHERE 单据编号=? AND 工序=? AND ISNULL(asp_cancel,'N')<>'Y'"
                            + " ORDER BY ISNULL(工序序,0), id", wo, op);
            double left = qty;
            for (Map<String, Object> t : tasks) {
                if (left == 0) break;
                long id = ((Number) t.get("id")).longValue();
                double plan = num(t.get("计划数量"));
                double cur = num(t.get("完成数量"));
                double add = sign > 0 ? Math.min(left, Math.max(plan - cur, 0)) : Math.max(left, -cur);
                if (add == 0) continue;
                double now = round(cur + add);
                String st = now >= plan - 0.0001 ? "已完工" : (now <= 0 ? "待加工" : "在加工");
                jdbc.update("UPDATE dbo.wo_progress SET 完成数量=?, 状态=?, asp_user2=?, asp_time2=GETDATE() WHERE id=?",
                        now, st, user, id);
                left = round(left - add);
            }
        }
    }

    /** 手工重算某工单的任务完成量(按已审核报工重算;数据修复/对账用) */
    @Transactional
    public Map<String, Object> rebuild(String plNo, String user) {
        List<String> ops = jdbc.queryForList(
                "SELECT DISTINCT 工序 FROM dbo.wo_progress WHERE 单据编号=? AND ISNULL(asp_cancel,'N')<>'Y'",
                String.class, plNo);
        int n = 0;
        for (String op : ops) {
            Double done = jdbc.queryForObject(
                    "SELECT ISNULL(SUM(ISNULL(sl,0)),0) FROM dbo.scjl WHERE gldh=? AND gxdm=?"
                            + " AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(wgzt,'N')='Y'", Double.class, plNo, op);
            double d = done == null ? 0 : done;
            n += jdbc.update("UPDATE dbo.wo_progress SET 完成数量=?, 状态=CASE WHEN ? >= 计划数量 THEN N'已完工'"
                            + " WHEN ? > 0 THEN N'在加工' ELSE N'待加工' END, asp_user2=?, asp_time2=GETDATE()"
                            + " WHERE 单据编号=? AND 工序=? AND ISNULL(asp_cancel,'N')<>'Y'",
                    d, d, d, user, plNo, op);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("重算工序数", ops.size());
        out.put("更新行数", n);
        return out;
    }

    /** 工单总览:按 工序/工艺(成型/切炭/组装) 汇总(只读视图 v_wo_process_board) */
    public List<Map<String, Object>> board() {
        return jdbc.queryForList("SELECT 工序, 任务数, 待加工数, 在加工数, 已加工数, 计划量, 完成量, 未完成量,"
                + " 急单数, 涉及产线, ISNULL(最早计划完工,N'') AS 最早计划完工"
                + " FROM dbo.v_wo_process_board ORDER BY 工序");
    }

    /**
     * 可选工艺路线列表(**含工序序列**,供弹窗选择;2026-10-05 用户口径:路线多时下拉不现实 → 改弹窗)。
     */
    public List<Map<String, Object>> routes() {
        return jdbc.queryForList(
                "SELECT r.工艺路线编码 AS 编码, MAX(ISNULL(r.工艺路线名称, N'')) AS 名称, COUNT(*) AS 工序数,"
                        + " STUFF((SELECT N'→' + x.工序名称 FROM dbo.bs_route x WHERE x.工艺路线编码 = r.工艺路线编码"
                        + "         AND ISNULL(x.asp_cancel,'N')<>'Y' AND ISNULL(x.工序名称,N'')<>N''"
                        + "         ORDER BY ISNULL(x.加工顺序,999) FOR XML PATH('')),1,1,N'') AS 工序序列"
                        + " FROM dbo.bs_route r WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.工序名称,N'')<>N''"
                        + " GROUP BY r.工艺路线编码 ORDER BY r.工艺路线编码");
    }

    /**
     * **下一道工序 + 候选产线**(2026-10-05,方案第 2 步的统一口径):
     * 读视图 {@code v_wo_next_process}(= 该工单路线里第一个尚无已审核报工的工序),再取该工序功能下的启用产线。
     * 排产/调拨/工单详情共用这一处,避免再次出现"产线口径各写一套"。
     */
    public List<Map<String, Object>> nextProcess(List<String> plNos) {
        if (plNos == null || plNos.isEmpty()) return List.of();
        List<String> nos = plNos.stream().filter(x -> x != null && !x.isBlank()).map(String::trim).distinct().limit(200).toList();
        if (nos.isEmpty()) return List.of();
        String in = String.join(",", java.util.Collections.nCopies(nos.size(), "?"));
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT 单号, 工艺路线, ISNULL(下一道工序,N'') AS 下一道工序, ISNULL(生产车间,N'') AS 生产车间"
                        + " FROM dbo.v_wo_next_process WHERE 单号 IN (" + in + ")", nos.toArray());
        for (Map<String, Object> r : rows) {
            String shop = String.valueOf(r.get("生产车间"));
            String rt = String.valueOf(r.get("工艺路线"));
            r.put("候选产线", shop.isBlank() ? List.of() : jdbc.queryForList(
                    "SELECT 生产线 FROM dbo.bs_prod_line WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(停用,0)=0"
                            + " AND ISNULL(生产车间,N'')=? ORDER BY ISNULL(排序,999), 生产线", String.class, shop));
            // 该路线的完整工序序列(按加工顺序):前端「工序/工艺」下拉直接按它出选项与顺序
            r.put("路线工序", rt.isBlank() || "null".equals(rt) ? List.of() : jdbc.queryForList(
                    "SELECT 工序名称 FROM dbo.bs_route WHERE 工艺路线编码=? AND ISNULL(asp_cancel,'N')<>'Y'"
                            + " AND ISNULL(工序名称,N'')<>N'' ORDER BY ISNULL(加工顺序,999)", String.class, rt));
        }
        return rows;
    }

    /**
     * 工单详情(2026-10-05 **第三版**,用户口径修正):点开一张单**只看它走到哪一步**。
     *   · 表头 = 工单级(计划数量 = Σ 计划量 pl_sl;用户确认口径);
     *   · **工序步骤** = 按**报工**(scjl 已审核)统计标准五道工序(混料/成型/切炭/组装/装箱)的完工量,
     *     标出当前走到哪一步 —— 不再依赖工序任务(用户口径「把工序任务删除掉」);
     *   · 产出 = 最后一道有完工量的工序的完工量;进度 = 产出 / 计划数量。
     * 只读,不改任何数据。
     */
    public Map<String, Object> detail(String plNo) {
        if (!notBlank(plNo)) throw new IllegalArgumentException("请提供工单号");
        String no = plNo.trim();
        List<Map<String, Object>> heads = jdbc.queryForList(
                "SELECT TOP 1 p.pl_no AS 工单号, ISNULL(p.dm,N'') AS 产品编码, ISNULL(p.mc,N'') AS 产品名称,"
                        + " ISNULL(p.gg,N'') AS 规格型号, ISNULL(p.khdm,N'') AS 客户,"
                        + " (SELECT ISNULL(SUM(g.pl_sl),0) FROM dbo.plang g WHERE g.pl_no=p.pl_no AND ISNULL(g.asp_cancel,'N')<>'Y') AS 计划数量,"
                        + " (SELECT CONVERT(varchar(10), MAX(g.cp_date), 120) FROM dbo.plang g WHERE g.pl_no=p.pl_no AND ISNULL(g.asp_cancel,'N')<>'Y') AS 交期,"
                        + " (SELECT COUNT(*) FROM dbo.plang g WHERE g.pl_no=p.pl_no AND ISNULL(g.asp_cancel,'N')<>'Y') AS 工单行数,"
                        + " (SELECT ISNULL(SUM(g.pl_sl),0) FROM dbo.plang g WHERE g.pl_no=p.pl_no AND ISNULL(g.asp_cancel,'N')<>'Y' AND ISNULL(g.pl_sl,0)>100000) AS 异常计划量,"
                        + " (SELECT TOP 1 ISNULL(g.[批次号],N'') FROM dbo.plang g WHERE g.pl_no=p.pl_no AND ISNULL(g.asp_cancel,'N')<>'Y' ORDER BY g.id) AS 批次号,"
                        + " ISNULL(p.[工艺路线],N'') AS 工艺路线, ISNULL(p.[完工状态],N'') AS 完工状态, ISNULL(p.[当前工序],N'') AS 表头当前工序,"
                        + " ISNULL(p.scx,N'') AS 排产产线"
                        + " FROM dbo.plang p WHERE p.pl_no=? AND ISNULL(p.asp_cancel,'N')<>'Y' ORDER BY p.id", no);
        // 报工口径:每道工序的完工量(只算已审核报工)
        List<Map<String, Object>> reps = jdbc.queryForList(
                "SELECT ISNULL(gxdm,N'') AS 工序, SUM(ISNULL(sl,0)) AS 完工量, COUNT(*) AS 报工单数"
                        + " FROM dbo.scjl WHERE gldh=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(wgzt,'N')='Y'"
                        + " GROUP BY gxdm", no);
        Map<String, Double> qty = new LinkedHashMap<>();
        Map<String, Integer> cnt = new LinkedHashMap<>();
        for (Map<String, Object> r : reps) {
            String op = String.valueOf(r.get("工序")).trim();
            if (op.isEmpty()) continue;
            qty.put(op, num(r.get("完工量")));
            cnt.put(op, (int) num(r.get("报工单数")));
        }
        List<Map<String, Object>> steps = new ArrayList<>();
        // 步骤口径(2026-10-05 第二版,用户口径「根据换算率换算即可;不做成品收口」):
        //   · 按该工单**工艺路线**逐道算**工序计划量**:首道 = 工单量 × 首道换算率;其后 = 上一道量 × 本道换算率;
        //     换算率留空 / =1 = **沿用**(不乘) —— 只在真的发生倍数变化的工序填率(如 碳棒 1 切 3 → 填 3);
        //   · 未绑路线 / 路线无明细 → 回退标准五步(全部率=1);
        //   · **不做成品收口**:成品量 = 路线**最后一道**的实际完工量(报工多生产就是多,允许超产);
        //   · 状态四态:已完工(=) / 超产(>) / 进行中(0<完工<计划) / 未开始(0)。
        String route = String.valueOf(headObject(heads).getOrDefault("工艺路线", ""));
        List<Map<String, Object>> lines = new ArrayList<>();
        if (route != null && !route.isBlank() && !"null".equals(route)) {
            lines.addAll(jdbc.queryForList("SELECT 工序名称, ISNULL(换算率,1) AS 换算率 FROM dbo.bs_route"
                    + " WHERE 工艺路线编码=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(工序名称,N'')<>N''"
                    + " ORDER BY ISNULL(加工顺序,999)", route.trim()));
        }
        if (lines.isEmpty()) {
            for (String op : PROCESS_ORDER) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("工序名称", op);
                m.put("换算率", 1);
                lines.add(m);
            }
        }
        String cur = "";
        for (Map<String, Object> l : lines) {
            String op = String.valueOf(l.get("工序名称")).trim();
            if (qty.getOrDefault(op, 0d) > 0) cur = op;
        }
        double cumPlan = num(headObject(heads).get("计划数量"));
        int doneSteps = 0;
        double overQty = 0;
        for (int i = 0; i < lines.size(); i++) {
            String op = String.valueOf(lines.get(i).get("工序名称")).trim();
            double rate = num(lines.get(i).get("换算率"));
            if (rate <= 0) rate = 1;
            cumPlan = round(cumPlan * rate);          // 填了才乘;留空/1 = 沿用
            double q = qty.getOrDefault(op, 0d);
            String st = (cumPlan > 0 && q > cumPlan) ? "超产"
                    : (cumPlan > 0 && q >= cumPlan) ? "已完工"
                    : (q > 0 ? "进行中" : "未开始");
            if ("已完工".equals(st) || "超产".equals(st)) doneSteps++;
            if (q > cumPlan) overQty = round(overQty + (q - cumPlan));
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("序", i + 1);
            s.put("工序", op);
            s.put("换算率", round(rate));
            s.put("完工量", round(q));
            s.put("计划量", cumPlan);                  // 该道**换算后**的工序计划量
            s.put("报工单数", cnt.getOrDefault(op, 0));
            s.put("当前", op.equals(cur));
            s.put("状态", st);
            steps.add(s);
        }
        double outQty = 0;
        for (int i = lines.size() - 1; i >= 0; i--) {
            double q = qty.getOrDefault(String.valueOf(lines.get(i).get("工序名称")).trim(), 0d);
            if (q > 0) { outQty = q; break; }
        }
        Map<String, Object> head = new LinkedHashMap<>();
        if (!heads.isEmpty()) head.putAll(heads.get(0));
        double planQty = num(head.get("计划数量"));
        head.put("当前工序", cur);
        head.put("产出", round(outQty));
        head.put("进度", planQty <= 0 ? 0 : Math.round(outQty / planQty * 10000d) / 100d);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("表头", head);
        out.put("工序步骤", steps);
        out.put("当前工序", cur);
        out.put("当前工序序", indexOfProcess(cur));
        out.put("已完成步骤数", doneSteps);
        out.put("计划合计", round(planQty));
        out.put("产出", round(outQty));
        out.put("未完成合计", round(Math.max(planQty - outQty, 0)));
        return out;
    }

    /** 标准工序顺序(与《新系统产线命名.xlsx》的功能口径一致);工单未绑工艺路线时回退用它 */
    private static final String[] PROCESS_ORDER = {"混料", "成型", "切炭", "组装", "装箱"};

    /**
     * 某道工序的**换算后计划量**(报工封顶用,与工单详情的工序步骤同一口径 —— 一处实现,避免两套):
     *   首道 = Σ排产 × 首道换算率;其后 = 上一道量 × 本道换算率;换算率留空/=1 = 沿用。
     * 未绑路线 / 路线无明细 → 返回 Σ排产(等价于全部率=1)。
     */
    public double processPlanQty(String plNo, String op) {
        if (!notBlank(plNo) || !notBlank(op)) return 0;
        Double total = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(pl_sl,0)),0) FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'",
                Double.class, plNo.trim());
        double base = total == null ? 0 : total;
        List<String> route = jdbc.queryForList(
                "SELECT TOP 1 ISNULL([工艺路线],N'') FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id",
                String.class, plNo.trim());
        String r = route.isEmpty() ? "" : route.get(0).trim();
        if (r.isEmpty()) return base;
        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT 工序名称, ISNULL(换算率,1) AS 换算率 FROM dbo.bs_route WHERE 工艺路线编码=?"
                        + " AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(工序名称,N'')<>N'' ORDER BY ISNULL(加工顺序,999)", r);
        if (lines.isEmpty()) return base;
        double cum = base;
        for (Map<String, Object> l : lines) {
            double rate = num(l.get("换算率"));
            if (rate <= 0) rate = 1;
            cum = round(cum * rate);
            if (op.trim().equals(String.valueOf(l.get("工序名称")).trim())) return cum;
        }
        return base;
    }

    /** 取表头行(工单级查询结果的第一行);查不到时给空 Map,避免 NPE */
    private static Map<String, Object> headObject(List<Map<String, Object>> heads) {
        return heads == null || heads.isEmpty() ? Map.of() : heads.get(0);
    }

    private static int indexOfProcess(String op) {
        for (int i = 0; i < PROCESS_ORDER.length; i++) if (PROCESS_ORDER[i].equals(op)) return i + 1;
        return 0;
    }

    /**
     * **撤回派工**(用户口径「要求实现可撤回」):任务退回「待加工」并清空生产线。
     * 已完工的任务不可撤回(需先弃审对应报工);可批量。
     */
    @Transactional
    public Map<String, Object> unassign(List<Object> ids, String user) {
        if (ids == null || ids.isEmpty()) throw new IllegalArgumentException("请先勾选要撤回派工的工序任务");
        List<String> done = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        for (Object idObj : ids) {
            long id = ((Number) idObj).longValue();
            try {
                List<Map<String, Object>> rows = jdbc.queryForList(
                        "SELECT 单据编号, 工序, ISNULL(状态,N'') AS 状态, ISNULL(生产线,N'') AS 生产线"
                                + " FROM dbo.wo_progress WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", id);
                if (rows.isEmpty()) throw new IllegalStateException("任务不存在或已作废");
                Map<String, Object> r0 = rows.get(0);
                if ("已完工".equals(String.valueOf(r0.get("状态")))) {
                    throw new IllegalStateException("已完工,撤回需先弃审对应报工");
                }
                if (String.valueOf(r0.get("生产线")).isBlank()) {
                    throw new IllegalStateException("尚未派工,无需撤回");
                }
                jdbc.update("UPDATE dbo.wo_progress SET 生产线=NULL, 状态=N'待加工', asp_user2=?, asp_time2=GETDATE()"
                        + " WHERE id=?", user, id);
                done.add(String.valueOf(r0.get("单据编号")) + "/" + r0.get("工序"));
            } catch (IllegalStateException e) {
                failed.add(id + ":" + e.getMessage());
            }
        }
        if (done.isEmpty()) throw new IllegalStateException("无任务可撤回:" + String.join("; ", failed));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("撤回行数", done.size());
        out.put("任务清单", done);
        out.put("失败行", failed);
        return out;
    }

    /**
     * 报工审核/弃审 → **回写工单状态**(2026-10-05 用户口径「报工需要能影响当前的工单情况」)。
     * 按该工单**工艺路线** + 已审核报工重算,落 plang 四列:
     * 当前工序 / 当前工序完工量 / 完工状态(未开工·在制·**生产完工**) / 完工时间。
     * 生产完工口径:路线**末道**工序完工量 ≥ Σ计划量(pl_sl);弃审后重算会自动退回并清完工时间。
     */
    @Transactional
    public void syncWorkOrderState(String plNo, String user) {
        if (!notBlank(plNo)) return;
        String no = plNo.trim();
        Map<String, Object> h = jdbc.queryForMap(
                "SELECT ISNULL(SUM(pl_sl),0) AS 计划量, ISNULL(SUM(rk_sl),0) AS 入库量,"
                        + " MAX(ISNULL(完工状态,N'')) AS 原完工状态, MAX(ISNULL(ja,'N')) AS 原结案"
                        + " FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'", no);
        double plan = num(h.get("计划量"));
        double inQty = num(h.get("入库量"));
        String prev = String.valueOf(h.get("原完工状态"));
        String jaPrev = String.valueOf(h.get("原结案"));
        List<String> ops = new ArrayList<>();
        List<String> rt = jdbc.queryForList("SELECT TOP 1 ISNULL([工艺路线],N'') FROM dbo.plang WHERE pl_no=?"
                + " AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([工艺路线],N'')<>N''", String.class, no);
        if (!rt.isEmpty()) {
            ops.addAll(jdbc.queryForList("SELECT 工序名称 FROM dbo.bs_route WHERE 工艺路线编码=?"
                    + " AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(工序名称,N'')<>N''"
                    + " ORDER BY ISNULL(加工顺序,999)", String.class, rt.get(0)));
        }
        if (ops.isEmpty()) ops.addAll(List.of(PROCESS_ORDER));
        // 各工序完工量:每道工序的报工**只影响它自己那一道**(不合成为整单数量)
        Map<String, Double> qty = new LinkedHashMap<>();
        for (Map<String, Object> r : jdbc.queryForList("SELECT ISNULL(gxdm,N'') AS 工序, SUM(ISNULL(sl,0)) AS 完工量"
                + " FROM dbo.scjl WHERE gldh=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(wgzt,'N')='Y'"
                + " GROUP BY gxdm", no)) {
            String op = String.valueOf(r.get("工序")).trim();
            if (!op.isEmpty()) qty.put(op, num(r.get("完工量")));
        }
        // 当前工序 = 路线上**第一道未做满计划量**的工序(全做满则停在末道);未开工 = 路线首道
        String cur = ops.get(0);
        boolean allDone = plan > 0;
        for (String op : ops) {
            if (qty.getOrDefault(op, 0d) < plan - 0.0001) { cur = op; allDone = false; break; }
        }
        if (allDone) cur = ops.get(ops.size() - 1);
        double curQty = qty.getOrDefault(cur, 0d);
        boolean started = qty.values().stream().anyMatch(v -> v > 0);
        // 生产完工判定(用户口径):**全部生产工序报工达标**  或  **入库数量达标**
        boolean prodDone = plan > 0 && (allDone || inQty >= plan - 0.0001);
        String state = prodDone ? "生产完工" : (started ? "在制" : "未开工");
        // **自动结案**:转入生产完工 → ja='Y';从生产完工退回(弃审) → 自动反结案(仅当仍处于结案态)
        String ja = prodDone ? "Y"
                : ("生产完工".equals(prev) && "Y".equals(jaPrev) ? "N" : jaPrev);
        jdbc.update("UPDATE dbo.plang SET 当前工序=?, 当前工序完工量=?, 完工状态=?,"
                        + " 完工时间 = CASE WHEN ? = N'生产完工' THEN ISNULL(完工时间, GETDATE()) ELSE NULL END,"
                        + " ja = ?, asp_user2=?, asp_time2=GETDATE() WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'",
                cur, round(curQty), state, state, ja, user, no);
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }
    private static Object blankToNull(Object o) { return (o == null || String.valueOf(o).isBlank()) ? null : o; }
    private static double num(Object o) {
        if (o == null || String.valueOf(o).isBlank()) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o)); } catch (NumberFormatException e) { return 0; }
    }
    private static double round(double v) { return Math.round(v * 10000.0) / 10000.0; }
}
