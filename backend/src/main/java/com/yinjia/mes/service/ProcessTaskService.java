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
    /** 工单级排产(工序—产线预排:首道线要写 plang.scx + plang_pc,复用现有排产口径) */
    private final ScheduleBoardService scheduleBoard;

    public ProcessTaskService(JdbcTemplate jdbc, ScheduleBoardService scheduleBoard) {
        this.jdbc = jdbc;
        this.scheduleBoard = scheduleBoard;
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
        // 行级(2026-10-15):报工行带 gd_id(=plang_pc.id → plang.id)与批次号,用来定位**唯一工单行**
        List<Map<String, Object>> reps = jdbc.queryForList(
                "SELECT ISNULL(gldh,N'') AS 工单号, ISNULL(gxdm,N'') AS 工序, ISNULL(sl,0) AS 报工数量,"
                        + " ISNULL(gd_id,0) AS gd_id, ISNULL([批次号],N'') AS 批次号"
                        + " FROM dbo.scjl WHERE [报工单号]=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + (sign > 0 ? " AND ISNULL(wgzt,'N')='Y'" : ""), repNo);
        for (Map<String, Object> r : reps) {
            String wo = String.valueOf(r.get("工单号")).trim();
            String op = String.valueOf(r.get("工序")).trim();
            double qty = num(r.get("报工数量")) * sign;
            if (wo.isEmpty() || op.isEmpty() || qty == 0) continue;
            // 本行(工单号 + 工单行号 = 唯一工单):经 gd_id → plang_pc.plang_id;老数据按批次兜底
            Long rowId = rowIdOfReport(wo, num(r.get("gd_id")), String.valueOf(r.get("批次号")));
            // 报工审核/弃审 → **回写该行状态**(2026-10-05 用户口径「报工需要能影响当前的工单情况」),幂等重算
            syncWorkOrderState(wo, rowId, user);
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
    public Map<String, Object> detail(String plNo) { return detail(plNo, null); }

    /**
     * 工单详情 —— **行级口径**(2026-10-10 用户口径:「同工单号的不同行除同源销售订单外无任何关联,
     * 追溯的每一段都必须按 (工单号, 工单行号) 唯一确定」)：
     * <p>传 rowId(=plang.id) 时,表头计划数量/批次号/报工量/工序步骤计划量 **全部换成该行**：
     * 计划数量 = 该行 pl_sl(**不再 Σ 全工单** —— 此前 GD-2026-10-0002 把 8 行加起来 16945);
     * 报工完成量锚 `scjl.gd_id → plang_pc.plang_id = 该行 id`(老数据无 gd_id 时按该行批次号兜底,
     * 与 {@link #reportedQty} 同一口径);逐道计划量 = 该行计划 × 该道换算率(与整单口径同一套换算,不另立)。
     * <p>不传 rowId = 整单聚合(**旧行为**,兼容工序任务页/生产排产等既有调用方)。
     */
    public Map<String, Object> detail(String plNo, Long rowId) {
        if (!notBlank(plNo)) throw new IllegalArgumentException("请提供工单号");
        String no = plNo.trim();
        List<Map<String, Object>> heads;
        if (rowId != null) {
            heads = jdbc.queryForList(
                    "SELECT TOP 1 p.pl_no AS 工单号, ISNULL(p.dm,N'') AS 产品编码, ISNULL(p.mc,N'') AS 产品名称,"
                            + " ISNULL(p.gg,N'') AS 规格型号, ISNULL(p.khdm,N'') AS 客户,"
                            + " ISNULL(p.pl_sl,0) AS 计划数量,"
                            + " CONVERT(varchar(10), p.cp_date, 120) AS 交期,"
                            + " 1 AS 工单行数, 0 AS 异常计划量,"
                            + " ISNULL(p.[批次号],N'') AS 批次号, p.pl_xc AS 工单行号,"
                            + " ISNULL(p.[工艺路线],N'') AS 工艺路线, ISNULL(p.[完工状态],N'') AS 完工状态,"
                            + " ISNULL(p.[当前工序],N'') AS 表头当前工序, ISNULL(p.scx,N'') AS 排产产线"
                            + " FROM dbo.plang p WHERE p.id=? AND p.pl_no=? AND ISNULL(p.asp_cancel,'N')<>'Y'", rowId, no);
            if (heads.isEmpty())
                throw new IllegalArgumentException("工单行不存在或已作废(工单号=" + no + ", 行id=" + rowId + ")");
        } else {
            heads = jdbc.queryForList(
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
        }
        // 报工口径:每道工序的完工量(只算已审核报工)。
        // ⚠ 行级(2026-10-10):传 rowId 时锚 scjl.gd_id → plang_pc.plang_id = 该行(老数据无 gd_id 时按该行批次兜底),
        //   否则会把同工单其它行的报工算进来(实测:行6 的界面显示出行7 的 56000)。
        List<Map<String, Object>> reps;
        if (rowId != null) {
            reps = jdbc.queryForList(
                    "SELECT ISNULL(s.gxdm,N'') AS 工序, SUM(ISNULL(s.sl,0)) AS 完工量, COUNT(*) AS 报工单数"
                            + " FROM dbo.scjl s LEFT JOIN dbo.plang_pc pc ON pc.id = s.gd_id"
                            + " WHERE s.gldh=? AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'"
                            + "   AND (pc.plang_id=? OR (s.gd_id IS NULL AND ISNULL(s.[批次号],N'')="
                            + "        ISNULL((SELECT TOP 1 ISNULL(p.[批次号],N'') FROM dbo.plang p WHERE p.id=?), N'')))"
                            + " GROUP BY s.gxdm", no, rowId, rowId);
        } else {
            reps = jdbc.queryForList(
                    "SELECT ISNULL(gxdm,N'') AS 工序, SUM(ISNULL(sl,0)) AS 完工量, COUNT(*) AS 报工单数"
                            + " FROM dbo.scjl WHERE gldh=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(wgzt,'N')='Y'"
                            + " GROUP BY gxdm", no);
        }
        Map<String, Double> qty = new LinkedHashMap<>();
        Map<String, Integer> cnt = new LinkedHashMap<>();
        for (Map<String, Object> r : reps) {
            String op = String.valueOf(r.get("工序")).trim();
            if (op.isEmpty()) continue;
            qty.put(op, num(r.get("完工量")));
            cnt.put(op, (int) num(r.get("报工单数")));
        }
        List<Map<String, Object>> steps = new ArrayList<>();
        // 步骤口径(**2026-10-15 改为「各工序独立」,与快速排产 routeSteps / 报工封顶同口径**):
        //   · 工序计划量(**该道**) = 本行排产数量 × **该工序自己的换算率**;
        //   · ❌ **不逐道累乘** —— 旧实现是 `cumPlan = cumPlan × rate`(2026-10-05 第二版),
        //     后果实测:G Y-CB-STD(成型换算率 7、切炭/组装 1)+ 行3 排产 1200
        //     ⇒ 成型/切炭/组装 三道全显示 8400,而切炭/组装其实各只需 1200(用户报障「这里的数量也对不上」);
        //     快速排产弹窗里同一行显示的是 8400/1200/1200 ⇒ **同一条路线两个页面数不一样**。
        //     用户口径 2026-10-07「各个工序的换算率分开算」已在 routeSteps 落地并注明不累乘,本条补齐。
        //   · 换算率留空 / =1 = 沿用(不乘) —— 只在真的发生倍数变化的工序填率;
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
        // 本行排产数量 = 各工序计划量的**共同基数**(不再累乘)
        double basePlan = num(headObject(heads).get("计划数量"));
        int doneSteps = 0;
        double overQty = 0;
        for (int i = 0; i < lines.size(); i++) {
            String op = String.valueOf(lines.get(i).get("工序名称")).trim();
            double rate = num(lines.get(i).get("换算率"));
            if (rate <= 0) rate = 1;
            double stepPlan = round(basePlan * rate);   // 该道自己的计划量(独立折算,不累乘)
            double q = qty.getOrDefault(op, 0d);
            String st = (stepPlan > 0 && q > stepPlan) ? "超产"
                    : (stepPlan > 0 && q >= stepPlan) ? "已完工"
                    : (q > 0 ? "进行中" : "未开始");
            if ("已完工".equals(st) || "超产".equals(st)) doneSteps++;
            if (q > stepPlan) overQty = round(overQty + (q - stepPlan));
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("序", i + 1);
            s.put("工序", op);
            s.put("换算率", round(rate));
            s.put("完工量", round(q));
            s.put("计划量", stepPlan);                 // 该道**自己**的工序计划量(基数 = 本行排产数量)
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
        // 行级标识(2026-10-10):让界面能明说"看的是哪一行/是不是整单口径",不再让人误读
        out.put("追溯口径", rowId != null ? "按工单行" : "整单");
        if (rowId != null) {
            out.put("工单行号", head.get("工单行号"));
            out.put("批次号", head.get("批次号"));
            out.put("工单行id", rowId);
        }
        return out;
    }

    /** 标准工序顺序(与《新系统产线命名.xlsx》的功能口径一致);工单未绑工艺路线时回退用它 */
    private static final String[] PROCESS_ORDER = {"混料", "成型", "切炭", "组装", "装箱"};

    /**
     * 某道工序的**换算后计划量**(报工封顶用) —— 口径与工单详情的工序步骤、快速排产 routeSteps 一致:
     *   **该道自己的计划量 = 基数 × 该道换算率**,❌ 不逐道累乘(见 detail() 里的口径说明)。
     * 未绑路线 / 路线无明细 → 返回基数(等价于全部率=1)。
     *
     * <p>⚠ 本方法只有 {@code plNo}(没有行键)⇒ 基数是 **Σ整单排产**,属**老数据兜底**:
     * 正常路径已按「工单号+工单行号」取该行排产 × 该行路线换算率(见 WoReportService.complete 的 rowPl/rowRate)。
     * 2026-10-15:顺带把这里的**逐道累乘**改成独立折算 —— 否则同一行不同页面/不同入口报出来的封顶值不一样。
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
        for (Map<String, Object> l : lines) {
            if (!op.trim().equals(String.valueOf(l.get("工序名称")).trim())) continue;
            double rate = num(l.get("换算率"));
            if (rate <= 0) rate = 1;
            return round(base * rate);   // 该道**独立**折算(不累乘)
        }
        return base;
    }

    /** 取表头行(工单级查询结果的第一行);查不到时给空 Map,避免 NPE */
    private static Map<String, Object> headObject(List<Map<String, Object>> heads) {
        return heads == null || heads.isEmpty() ? Map.of() : heads.get(0);
    }

    // ────────────────────── 工序—产线预排(2026-10-07:排产时**人工**一次选好全程线) ──────────────────────

    /**
     * **工序路线排线弹窗的数据**:该工单行要走的每一道工序 + 该道的换算后计划量 + 默认计划完工日期,
     * 外加**已有台账**(改线时回填)。
     *
     * <p>口径(2026-10-07 用户口径:唯一键 = **工单号 + 工单行号**):
     *   先定位到**具体工单行**(入参行id → 台账里的工单行id → 该工单首行),表头/路线/当前线/基数都取这一行;
     *   计划量 = 该行排产数量 × **该工序自己的换算率**(各道分开算,不累乘)。
     */
    public Map<String, Object> routeSteps(String plNo, Long lineId) {
        if (!notBlank(plNo)) throw new IllegalArgumentException("请提供工单号");
        String no = plNo.trim();
        // ① 定位工单行:行id → 台账已登记的工单行id → 该工单首行(唯一键 = 工单号 + 工单行)
        Long rowId = lineId;
        if (rowId == null) {
            List<Long> fromLedger = jdbc.queryForList("SELECT TOP 1 工单行id FROM dbo.wo_process_line"
                    + " WHERE 工单号=? AND ISNULL(asp_cancel,'N')<>'Y' AND 工单行id IS NOT NULL"
                    + " ORDER BY ISNULL(工序序,999), id", Long.class, no);
            if (!fromLedger.isEmpty()) rowId = fromLedger.get(0);
        }
        Map<String, Object> head = rowId != null
                ? (jdbc.queryForList("SELECT id, pl_no, pl_xc, ISNULL([批次号],N'') AS 批次号, ISNULL(dm,N'') AS 产品编码,"
                        + " ISNULL(mc,N'') AS 产品名称, ISNULL(gg,N'') AS 规格型号, ISNULL(jldw,N'') AS 生产单位,"
                        + " ISNULL(pl_sl,0) AS 排产数量, ISNULL(xq_sl,0) AS 需求数量, CONVERT(varchar(10), cp_date, 120) AS 交期,"
                        + " ISNULL([工艺路线],N'') AS 工艺路线, ISNULL(scx,N'') AS 当前线"
                        + " FROM dbo.plang WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", rowId)
                        .stream().findFirst().orElse(Map.of()))
                : Map.of();
        if (head.isEmpty()) {
            head = jdbc.queryForMap("SELECT TOP 1 id, pl_no, pl_xc, ISNULL([批次号],N'') AS 批次号, ISNULL(dm,N'') AS 产品编码,"
                    + " ISNULL(mc,N'') AS 产品名称, ISNULL(gg,N'') AS 规格型号, ISNULL(jldw,N'') AS 生产单位,"
                    + " ISNULL(pl_sl,0) AS 排产数量, ISNULL(xq_sl,0) AS 需求数量, CONVERT(varchar(10), cp_date, 120) AS 交期,"
                    + " ISNULL([工艺路线],N'') AS 工艺路线, ISNULL(scx,N'') AS 当前线"
                    + " FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id", no);
            rowId = ((Number) head.get("id")).longValue();
        }
        String route = String.valueOf(head.get("工艺路线")).trim();
        // 计划数量的基数 = **所排工单行自己的排产数量**
        //   ⚠ 不能用整单合计:一个工单可能多行、且**各行的工艺路线可能不同**(实测 GD-2026-10-0002:
        //     行1/5/6/7 = GY-CB-STD、行2/3/4 = GY-2026-10-0003)⇒ 整单合计会把别的路线的量算进来。
        double baseQty = num(head.get("排产数量"));
        Map<String, Object> headOut = new LinkedHashMap<>(head);
        headOut.put("基数行", rowId);
        headOut.put("基数数量", baseQty);
        headOut.put("整单行数", jdbc.queryForObject("SELECT COUNT(*) FROM dbo.plang"
                + " WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'", Integer.class, no));
        // 路线工序(加工顺序)+ 候选产线(该工序车间的启用线,带 今日负荷/日产能)
        List<Map<String, Object>> steps = new ArrayList<>();
        if (!route.isEmpty()) {
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT ISNULL(工序名称,N'') AS 工序, ISNULL(生产车间,N'') AS 生产车间,"
                            + " ISNULL(换算率,1) AS 换算率, ISNULL(加工顺序,999) AS 工序序, ISNULL(工序编码,N'') AS 工序编码"
                            + " FROM dbo.bs_route WHERE 工艺路线编码=? AND ISNULL(asp_cancel,'N')<>'Y'"
                            + " AND ISNULL(工序名称,N'')<>N'' ORDER BY ISNULL(加工顺序,999), id", route)) {
                double rate = num(r.get("换算率"));
                if (rate <= 0) rate = 1;
                // **各工序独立按自己的换算率折算**(2026-10-07 用户口径「各个工序的换算率分开算」):
                //   计划数量(工序 i) = 本行排产数量 × 该工序换算率;
                //   ❌ 不逐道累乘(否则 成型7×切炭2 会把切炭算成 14 倍,转序门槛也跟着虚高,完成报工也不转序)。
                Map<String, Object> s = new LinkedHashMap<>(r);
                s.put("计划数量", round(baseQty * rate));
                s.put("计划完工日期", head.get("交期"));
                steps.add(s);
            }
        }
        // 已有台账(未作废):改线时回填
        List<Map<String, Object>> planned = jdbc.queryForList(
                "SELECT id, 工序, ISNULL(工序序,0) AS 工序序, ISNULL(计划生产线,N'') AS 计划生产线,"
                        + " ISNULL(实际生产线,N'') AS 实际生产线, ISNULL(计划数量,0) AS 计划数量,"
                        + " CONVERT(varchar(10), 计划完工日期, 120) AS 计划完工日期, ISNULL(状态,N'') AS 状态"
                        + " FROM dbo.wo_process_line WHERE 工单号=? AND (? IS NULL OR 工单行id=?)"
                        + " AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY ISNULL(工序序,999), id", no, lineId, lineId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("表头", headOut);
        out.put("工序步骤", steps);
        out.put("已排台账", planned);
        return out;
    }

    /**
     * **排产 + 预排全程线**(2026-10-07 用户口径):排产时把整条工艺路线的每道工序**人工选好线**一次提交 ——
     *   · 首道线 = 工单级排产线(写 plang.scx + plang_pc 薄记录,复用 {@code ScheduleBoardService.assign});
     *   · 全路线写台账 {@code wo_process_line}:首道置「已落实」,其余「计划」,等前道报工完工后自动转序;
     *   · 幂等:先作废该工单旧台账再重写(改线 = 重新提交)。
     *
     * <p>守卫:每道都必须选线 · 线存在且未停用 · **线的生产车间必须等于该工序的车间**(与选线口径一致)·
     * 工单未结案 · 未排产(scx 空;已排产的换线请先撤销排产)。
     *
     * @param steps [{工序, 生产线, 计划完工日期?(yyyy-MM-dd), 计划数量?(忽略,一律按换算率算)}]
     * @param team  排产班组(可空;写 plang.lb / plang_pc.lb)
     */
    @Transactional
    public Map<String, Object> preplanManual(String plNo, Long lineId, List<Map<String, Object>> steps, String team, String user) {
        if (!notBlank(plNo)) throw new IllegalArgumentException("请提供工单号");
        String no = plNo.trim();
        Map<String, Object> steps0 = routeSteps(no, lineId);
        Map<String, Object> head = steps0.get("表头") instanceof Map<?, ?> m ? castMap(m) : Map.of();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> route = (List<Map<String, Object>>) steps0.get("工序步骤");
        if (route.isEmpty()) throw new IllegalStateException("该工单未绑定工艺路线(或路线无工序明细),不能排线");
        if (steps == null || steps.size() != route.size())
            throw new IllegalArgumentException("必须为路线的每一道工序选好生产线(共 " + route.size() + " 道)");
        // 逐道校验(按工序序对齐)
        List<Map<String, Object>> plan = new ArrayList<>();
        for (int i = 0; i < route.size(); i++) {
            Map<String, Object> rt = route.get(i);
            String op = String.valueOf(rt.get("工序")).trim();
            String shop = String.valueOf(rt.get("生产车间")).trim();
            Map<String, Object> given = null;
            for (Map<String, Object> s : steps) {
                if (op.equals(String.valueOf(s.get("工序")).trim())) { given = s; break; }
            }
            if (given == null) throw new IllegalArgumentException("工序「" + op + "」没有选生产线");
            String line = str(given.get("生产线"));
            if (line == null) throw new IllegalArgumentException("工序「" + op + "」没有选生产线");
            List<Map<String, Object>> ls = jdbc.queryForList(
                    "SELECT ISNULL(生产车间,N'') AS 生产车间, ISNULL(停用,0) AS 停用 FROM dbo.bs_prod_line"
                            + " WHERE 生产线=? AND ISNULL(asp_cancel,'N')<>'Y'", line);
            if (ls.isEmpty()) throw new IllegalArgumentException("生产线「" + line + "」不存在");
            if (num(ls.get(0).get("停用")) == 1) throw new IllegalArgumentException("生产线「" + line + "」已停用");
            String lineShop = String.valueOf(ls.get(0).get("生产车间"));
            if (!shop.isBlank() && !shop.equals(lineShop))
                throw new IllegalArgumentException("生产线「" + line + "」属于「" + lineShop + "」,与工序「" + op + "」(" + shop + ")不一致");
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("工序", op);
            p.put("工序序", rt.get("工序序"));
            p.put("生产线", line);
            p.put("计划数量", rt.get("计划数量"));
            p.put("计划完工日期", str(given.get("计划完工日期")) != null ? str(given.get("计划完工日期")) : rt.get("计划完工日期"));
            plan.add(p);
        }
        // ① 工单级排产:首道线(复用现有排产口径;该行未排产才可排;该行已排产=改线,首道线必须仍是该行当前线)
        //   ⚠ 唯一键 = **工单号 + 工单行号**(2026-10-07 用户口径):排产/改线/转序都只作用这一行,
        //     同一工单其它行不受影响(实测踩过:用 DISTINCT scx 判整单 ⇒ 部分行已排产时误拦)。
        Object rowId = head.get("id");
        String curLine = head.get("当前线") == null ? "" : String.valueOf(head.get("当前线")).trim();
        String firstPlan = String.valueOf(plan.get(0).get("生产线"));
        if (curLine.isEmpty()) {
            Map<String, Object> assignRow = new LinkedHashMap<>();
            assignRow.put("加工单号", no);
            if (rowId != null) assignRow.put("行id", rowId);
            assignRow.put("生产线", firstPlan);
            if (str(team) != null) assignRow.put("排产班组", str(team));
            if (plan.get(0).get("计划完工日期") != null) assignRow.put("预完工日", plan.get(0).get("计划完工日期"));
            Map<String, Object> assigned = scheduleBoard.assign(List.of(assignRow), user);
            List<String> headFailed = castList(assigned.get("失败行"));
            if (!headFailed.isEmpty()) throw new IllegalStateException("工单排产失败:" + String.join("; ", headFailed));
        } else if (!curLine.equals(firstPlan)) {
            throw new IllegalStateException("首道线 = 该工单行当前排产线「" + curLine + "」;换线请先撤销该行排产再重排");
        }
        // ② 写台账(先作废**本工单行**的旧行;唯一键 = 工单号 + 工单行,不动同工单其它行)
        jdbc.update("UPDATE dbo.wo_process_line SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE()"
                + " WHERE 工单号=? AND ISNULL(asp_cancel,'N')<>'Y'"
                + "   AND ((? IS NULL AND 工单行id IS NULL) OR 工单行id=?)",
                user, no, rowId == null ? null : ((Number) rowId).longValue(),
                rowId == null ? null : ((Number) rowId).longValue());
        for (int i = 0; i < plan.size(); i++) {
            Map<String, Object> p = plan.get(i);
            boolean first = i == 0;
            jdbc.update("INSERT INTO dbo.wo_process_line (工单号, 工单行id, 工序, 工序序, 计划生产线, 实际生产线,"
                            + " 计划数量, 计划完工日期, 状态, 落实时间, asp_cancel, asp_user1, asp_time1)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,N'N',?,GETDATE())",
                    no, rowId == null ? null : ((Number) rowId).longValue(), p.get("工序"),
                    p.get("工序序") == null ? null : ((Number) p.get("工序序")).intValue(),
                    p.get("生产线"), first ? p.get("生产线") : null,
                    p.get("计划数量"), p.get("计划完工日期") == null ? null : java.time.LocalDate.parse(String.valueOf(p.get("计划完工日期"))),
                    first ? "已落实" : "计划", first ? new java.util.Date() : null, user);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("工单号", no);
        out.put("排产产线", plan.get(0).get("生产线"));
        out.put("预排道数", plan.size());
        out.put("计划线", plan.stream().map(x -> x.get("工序") + ":" + x.get("生产线")).toList());
        return out;
    }

    /**
     * **转序落实**(报工**审核**后调用;2026-10-07 恢复 2026-10-05 口径):找台账里状态=**计划**的第一道:
     *   · 转序条件 = **前一道已完工**(该道已审核报工量 ≥ 换算后计划量)**且本道尚未开工**(报工量=0);
     *   · 计划线为空 → 只提示"请人工派线",不动作;
     *   · 计划线 = 当前线 → 只提示"沿用当前线";
     *   · 否则写 plang.scx = 计划线 + 台账置「已落实/实际线/落实时间」+ 轨迹 wo_transfer_log(原因「转序自动派线」)。
     *
     * <p>未预排的工单行(台账为空)不做任何自动补线 —— 人工排线口径下由使用者重新排产(回执里给提示)。
     *
     * <p>⚠ 唯一键 = **工单号 + 工单行号**(2026-10-07 用户口径):转序只切**被报工的那一行**的线,
     * 同工单其它行原样不动;报工量也按该行统计(锚 scjl.gd_id → plang_pc.plang_id)。
     */
    @Transactional
    public Map<String, Object> applyNextProcess(String plNo, Long lineId, String user) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("工序", "");
        if (!notBlank(plNo)) return out;
        String no = plNo.trim();
        Long rowId = lineId;
        if (rowId == null) {   // 兜底:只给工单号时取该工单**已排产**的行(旧调用方兼容)
            List<Long> rs = jdbc.queryForList("SELECT TOP 1 id FROM dbo.plang WHERE pl_no=?"
                    + " AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(scx,N'')<>N'' ORDER BY id", Long.class, no);
            if (rs.isEmpty()) { out.put("提示", "该工单没有已排产的行"); return out; }
            rowId = rs.get(0);
        }
        final Long row = rowId;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, 工序, ISNULL(工序序,0) AS 工序序, ISNULL(计划生产线,N'') AS 计划生产线,"
                        + " ISNULL(计划数量,0) AS 计划数量, ISNULL(状态,N'计划') AS 状态"
                        + " FROM dbo.wo_process_line WHERE 工单号=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + "   AND (工单行id=? OR 工单行id IS NULL)"
                        + " ORDER BY ISNULL(工序序,999), id", no, row);
        if (rows.isEmpty()) { out.put("提示", "该工单行没有预排线(请在快速排产里排线)"); return out; }
        Map<String, Object> next = null;
        double prevDone = -1, prevPlan = -1;
        for (Map<String, Object> r : rows) {
            String op = String.valueOf(r.get("工序")).trim();
            double d = reportedQty(no, row, op);
            // 转序条件:本道尚未开工,且(首道 或 前一道已完工)
            if ("计划".equals(String.valueOf(r.get("状态"))) && d <= 0
                    && (prevDone < 0 || (prevPlan > 0 && prevDone + 0.0001 >= prevPlan))) { next = r; break; }
            prevDone = d;
            prevPlan = num(r.get("计划数量"));
        }
        if (next == null) return out;
        String op = String.valueOf(next.get("工序")).trim();
        String plan = String.valueOf(next.get("计划生产线")).trim();
        out.put("工序", op);
        if (plan.isEmpty()) { out.put("提示", "下一道(" + op + ")未预排线,请人工派线"); return out; }
        List<String> cs = jdbc.queryForList("SELECT TOP 1 ISNULL(scx,N'') FROM dbo.plang WHERE id=?", String.class, row);
        String cur = cs.isEmpty() || cs.get(0) == null ? "" : cs.get(0).trim();
        if (plan.equals(cur)) { out.put("提示", "下一道(" + op + ")沿用当前线"); return out; }
        // 只切**这一行**的线(plang + 排产镜像 plang_pc;同工单其它行不动)
        jdbc.update("UPDATE dbo.plang SET scx=?, asp_user2=?, asp_time2=GETDATE() WHERE id=?", plan, user, row);
        jdbc.update("UPDATE dbo.plang_pc SET scx=?, asp_user2=?, asp_time2=GETDATE() WHERE plang_id=?", plan, user, row);
        jdbc.update("UPDATE dbo.wo_process_line SET 实际生产线=?, 状态=N'已落实', 落实时间=GETDATE(),"
                + " asp_user2=?, asp_time2=GETDATE() WHERE id=?", plan, user, next.get("id"));
        // 轨迹(列名对齐 wo_transfer_log):转序=自动派线,可查可撤;plang_id 锚到具体工单行
        try {
            jdbc.update("INSERT INTO dbo.wo_transfer_log (pl_no, plang_id, 从生产线, 从车间, 到生产线, 到车间, 数量, 原因,"
                            + " asp_cancel, asp_user1, asp_time1, asp_time2)"
                            + " VALUES (?,?,?,?,?,?,?,N'转序自动派线',N'N',?,GETDATE(),GETDATE())",
                    no, row, cur, shopOfLine(cur), plan, shopOfLine(plan), num(next.get("计划数量")), user);
        } catch (Exception ignore) { /* 轨迹写入失败不阻断转序 */ }
        out.put("工单行id", row);
        out.put("从生产线", cur);
        out.put("到生产线", plan);
        return out;
    }

    /**
     * 该**工单行**该道工序的已审核报工量(转序判据):
     *   优先按 scjl.gd_id → plang_pc.plang_id 锚到行;老数据没有 gd_id 时退回按(工单号+批次号)匹配该行。
     */
    private double reportedQty(String plNo, Long rowId, String op) {
        Double d = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(s.sl,0)),0) FROM dbo.scjl s"
                        + " LEFT JOIN dbo.plang_pc pc ON pc.id = s.gd_id"
                        + " WHERE s.gldh=? AND s.gxdm=? AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'"
                        + "   AND (pc.plang_id=? OR (s.gd_id IS NULL AND ISNULL(s.[批次号],N'')="
                        + "        ISNULL((SELECT TOP 1 ISNULL(p.[批次号],N'') FROM dbo.plang p WHERE p.id=?), N'')))",
                Double.class, plNo, op, rowId, rowId);
        return d == null ? 0 : d;
    }

    /** 产线所属车间(取不到返回 null) */
    private String shopOfLine(String line) {
        if (!notBlank(line)) return null;
        List<String> s = jdbc.queryForList("SELECT TOP 1 ISNULL(生产车间,N'') FROM dbo.bs_prod_line"
                + " WHERE 生产线=? AND ISNULL(asp_cancel,'N')<>'Y'", String.class, line);
        return s.isEmpty() || s.get(0).isBlank() ? null : s.get(0);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Map<?, ?> m) { return (Map<String, Object>) m; }

    @SuppressWarnings("unchecked")
    private static List<String> castList(Object o) {
        if (!(o instanceof List<?> l)) return List.of();
        List<String> out = new ArrayList<>();
        for (Object x : l) if (x != null) out.add(String.valueOf(x));
        return out;
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isBlank() || "null".equals(s) ? null : s;
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
     *
     * <p>🔴 2026-10-15 改**按行**(用户口径「工单号+工单行号确定当前唯一工单,各个工单的进程、
     * 流程追溯都这样实现,都需要这两个进行确定」):原实现整段按 {@code pl_no} 聚合,后果实测——
     * 给行7 报工 56000 后,该工单**8 行全部**被写成「在制/切炭」(连没报过工的行1~行6、行8 也一样),
     * 且路线取的是**整单首条**非空路线(行2/3/4 的路线与行1/5/6/7/8 不同 ⇒ 状态按错的路线算)。
     * 现:每行按**自己的**路线 + **自己的**已审报工量重算,只写该行。
     *
     * @param plNo  工单号
     * @param rowId 工单行id(plang.id);传 null 时退回整单口径(旧调用方兼容)
     */
    @Transactional
    public void syncWorkOrderState(String plNo, Long rowId, String user) {
        if (!notBlank(plNo)) return;
        String no = plNo.trim();
        // 目标行:给了 rowId 就只算这一行;没给则**逐行**各算各的(不再整单一把刷)
        List<Map<String, Object>> targets;
        if (rowId != null) {
            targets = jdbc.queryForList(
                    "SELECT id, ISNULL(pl_sl,0) AS pl_sl, ISNULL(rk_sl,0) AS rk_sl,"
                            + " ISNULL([批次号],N'') AS 批次号, ISNULL([工艺路线],N'') AS 工艺路线,"
                            + " ISNULL(完工状态,N'') AS 原完工状态, ISNULL(ja,'N') AS 原结案"
                            + " FROM dbo.plang WHERE id=? AND pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'", rowId, no);
        } else {
            targets = jdbc.queryForList(
                    "SELECT id, ISNULL(pl_sl,0) AS pl_sl, ISNULL(rk_sl,0) AS rk_sl,"
                            + " ISNULL([批次号],N'') AS 批次号, ISNULL([工艺路线],N'') AS 工艺路线,"
                            + " ISNULL(完工状态,N'') AS 原完工状态, ISNULL(ja,'N') AS 原结案"
                            + " FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id", no);
        }
        for (Map<String, Object> t : targets) {
            syncOneRowState(((Number) t.get("id")).longValue(), t, no, user);
        }
    }

    /** 单行状态重算(工序进度/完工状态):路线取**本行**的,报工量取**本行**的。结案另见 syncCloseState */
    private void syncOneRowState(long id, Map<String, Object> t, String no, String user) {
        double plan = num(t.get("pl_sl"));
        double inQty = num(t.get("rk_sl"));
        String batch = String.valueOf(t.get("批次号"));
        // 本行路线(空则退回标准五步)
        List<String> ops = new ArrayList<>();
        String route = String.valueOf(t.get("工艺路线")).trim();
        if (!route.isEmpty()) {
            ops.addAll(jdbc.queryForList("SELECT 工序名称 FROM dbo.bs_route WHERE 工艺路线编码=?"
                    + " AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(工序名称,N'')<>N''"
                    + " ORDER BY ISNULL(加工顺序,999)", String.class, route));
        }
        if (ops.isEmpty()) ops.addAll(List.of(PROCESS_ORDER));
        // 本行各工序完工量:锚 scjl.gd_id → plang_pc.plang_id = 本行(老数据空 gd_id 用本行批次兜底)
        Map<String, Double> qty = new LinkedHashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT ISNULL(s.gxdm,N'') AS 工序, SUM(ISNULL(s.sl,0)) AS 完工量 FROM dbo.scjl s"
                        + " WHERE s.gldh=? AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'"
                        + "   AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = ?)"
                        + "        OR (ISNULL(s.gd_id,0) = 0 AND ISNULL(s.[批次号],N'') = ?))"
                        + " GROUP BY s.gxdm", no, id, batch)) {
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
        // 🔴 2026-10-15 用户口径(报障):「全部报工完成后**不应**变为已结案,员工看到的应是**完工**;
        //   只有**最后组装成品检验完成入库后**才显示结案」。
        //   原实现把"报工达标"直接等同于"结案":`ja = prodDone ? "Y" : (从生产完工退回 ? "N" : 保持)` ——
        //   于是报工一做完,工单立刻 ja='Y',生产工单列表第一分支(入库≥排产)又把它显示成「已结案」,
        //   跟"完工"挤在一起分不开,而且成品检验还没做就已经结案了。
        //   现:**报工只负责"完工状态"**,结案改由 {@link #syncCloseState} 按
        //   「组装成品检验单已审核通过 且 入库≥排产」单独判定(在入库/检验的审核与弃审时重算)。
        //   ⇒ 这里**不再动 ja**(保持原值,人工结案/取消结案仍由生产工单页负责)。
        jdbc.update("UPDATE dbo.plang SET 当前工序=?, 当前工序完工量=?, 完工状态=?,"
                        + " 完工时间 = CASE WHEN ? = N'生产完工' THEN ISNULL(完工时间, GETDATE()) ELSE NULL END,"
                        + " asp_user2=?, asp_time2=GETDATE() WHERE id=?",
                cur, round(curQty), state, state, user, id);
    }

    /**
     * 结案重算(**按工单行**:工单号 + 工单行号) —— 用户口径 2026-10-15:
     * 「当最后**组装成品检验完成入库后**才显示结案」。
     *
     * <p>判据(两个都满足才 ja='Y',任一不满足回 'N'):
     * <ol><li>该行的**组装成品检验单已审核通过**(qc_asm_insp_head 存活 + yj_doc_status.shr 非空且未作废/中止);
     *     行级取 工单行号=本行,老检验单没有行号列时退回该行产生的报工单号;</li>
     * <li>**入库数量达标**:rk_sl ≥ pl_sl(排产数量,>0)。</li></ol>
     *
     * <p>⚠ 只在**入库单 / 组装成品检验单**的审核与弃审时调用(见 ManuWritebackService / ButtonService),
     * 不做全库批量重算 —— 这样存量里人工结案的单不会因为本次改动被莫名打开,行为只在该两事件上改变。
     *
     * @return 该行重算后的 ja 值
     */
    @Transactional
    public String syncCloseState(long rowId, String user) {
        List<Map<String, Object>> rs = jdbc.queryForList(
                "SELECT id, pl_no, ISNULL(pl_xc,0) AS xc, ISNULL(pl_sl,0) AS pl_sl, ISNULL(rk_sl,0) AS rk_sl,"
                        + " ISNULL([批次号],N'') AS 批次号 FROM dbo.plang WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'",
                rowId);
        if (rs.isEmpty()) return null;
        Map<String, Object> r = rs.get(0);
        String no = String.valueOf(r.get("pl_no"));
        int xc = ((Number) r.get("xc")).intValue();
        double plan = num(r.get("pl_sl"));
        double inQty = num(r.get("rk_sl"));
        String batch = String.valueOf(r.get("批次号"));
        boolean inOk = plan > 0 && inQty >= plan - 0.0001;
        // 组装成品检验:存活 + 已审核(shr 非空)+ 未作废/中止
        Integer asm = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.qc_asm_insp_head h"
                        + " JOIN dbo.yj_doc_status s ON s.panel_code='QC_ASM_INSP' AND s.doc_no=h.[单据编号]"
                        + " WHERE h.[工单号]=? AND ISNULL(h.asp_cancel,'N')<>'Y'"
                        + "   AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y' AND ISNULL(s.stopped,'N')<>'Y'"
                        // 行级:检验单带本行行号;2026-10-15 前的老单无行号,退回按本行批次
                        // ⚠ 批次兜底**必须要求批次非空** —— 否则两边批次都是空串时 `'' = ''` 恒真,
                        //   会误命中任意一张"无行号且无批次"的旧检验单 ⇒ 把没检验的工单错误结案(2026-10-15 自查发现)
                        + "   AND (ISNULL(h.[工单行号],0) = ?"
                        + "        OR (ISNULL(h.[工单行号],0) = 0 AND ISNULL(h.[批次号],N'') <> N''"
                        + "            AND ISNULL(h.[批次号],N'') = ?))",
                Integer.class, no, xc, batch);
        boolean asmOk = asm != null && asm > 0;
        String ja = (asmOk && inOk) ? "Y" : "N";
        jdbc.update("UPDATE dbo.plang SET ja=?, asp_user2=?, asp_time2=GETDATE() WHERE id=?", ja, user, rowId);
        return ja;
    }

    /**
     * 结案重算(整单入口:该工单**每一个未作废行**各算各的)。供只拿到工单号的调用方使用。
     */
    @Transactional
    public void syncCloseStateByOrder(String plNo, String user) {
        if (!notBlank(plNo)) return;
        for (Long id : jdbc.queryForList(
                "SELECT id FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY pl_xc, id",
                Long.class, plNo.trim())) {
            syncCloseState(id, user);
        }
    }

    /**
     * 报工审核/弃审 → 工单状态重算(整单口径入口;内部已改为逐行各算各的)。
     * 保留此重载供旧调用方使用。
     */
    @Transactional
    public void syncWorkOrderState(String plNo, String user) {
        syncWorkOrderState(plNo, null, user);
    }

    /** 报工行 → 工单行id(plang.id):经 gd_id(=plang_pc.id)锚定;老数据按(工单号+批次号)恰命中 1 行兜底 */
    private Long rowIdOfReport(String wo, double gdId, String batch) {
        if (gdId > 0) {
            List<Long> r = jdbc.queryForList(
                    "SELECT TOP 1 pc.plang_id FROM dbo.plang_pc pc"
                            + " JOIN dbo.plang p ON p.id = pc.plang_id AND ISNULL(p.asp_cancel,'N')<>'Y'"
                            + " WHERE pc.id=?", Long.class, (long) gdId);
            if (!r.isEmpty() && r.get(0) != null) return r.get(0);
        }
        if (batch != null && !batch.isBlank()) {
            List<Long> r = jdbc.queryForList(
                    "SELECT id FROM dbo.plang WHERE pl_no=? AND ISNULL([批次号],N'')=?"
                            + " AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id", Long.class, wo, batch);
            if (r.size() == 1) return r.get(0);
        }
        return null;
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
