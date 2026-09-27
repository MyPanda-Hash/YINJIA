package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 排产域服务(2026-09-23 纠偏后服务两个页面;2026-09-27 快速排产切 plang 单轨):
 * <ul>
 *   <li>快速排产(ScheduleBoard.vue,原「排产工作台」):{@link #pending}/{@link #stats}/{@link #assign}/{@link #unassign}/{@link #today}
 *       ——**数据源=参考库工单表 plang**(转工单直落 plang,无需审核即入池):待排产池(产线空·未结案)
 *       → 选产线(档案下拉,带当日负荷)→ 单笔/批量排入(写 plang.scx/st_date/cp_date/lb班组)→ 撤销回池;</li>
 *   <li>工单排产看板(WorkOrderBoard.vue):{@link #linesSummary}/{@link #scheduled}/{@link #reassign}
 *       ——暂保留 bd_manu_order 旧口径(legacy 页面,待后续切换);{@link #trace} 追溯同 legacy。</li>
 * </ul>
 *
 * <p>池口径(2026-09-27 plang 版):**未指派产线(scx 空)·未作废·未结案**的工单行(转工单时已过
 * 销售订单严格已审核闸门,故不再要求 yj_doc_status)。回执含该线 当日负荷/日产能/超载提示——
 * **只提示不拦截**(排产人工拍板口径)。换线=撤销+重排。
 */
@Service
public class ScheduleBoardService {

    private final JdbcTemplate jdbc;

    public ScheduleBoardService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 待排产池(plang 单轨):产线空·未作废·未结案 的工单行;转工单时已过严格已审核闸门 */
    public List<Map<String, Object>> pending(String keyword, String customer) {
        String kw = keyword == null ? "" : keyword.trim();
        String like = "%" + kw + "%";
        String cu = customer == null ? "" : customer.trim();
        return jdbc.queryForList(
                "SELECT p.pl_no AS 加工单号, p.id AS 行id, p.pl_xc AS 工单行号, ISNULL(p.[批次号],N'') AS 批次号,"
                        + " CONVERT(varchar(10), p.pl_date, 120) AS 单据日期,"
                        + " ISNULL(p.od_no, N'') AS 客户订单号,"
                        + " ISNULL(dk.mc, p.khdm) AS 客户, ISNULL(pt.[客户价格等级], N'') AS 客户等级,"
                        + " N'' AS 混料批次号, ISNULL(管控.重点管控, N'否') AS 重点管控,"
                        + " p.dm AS 产品编号, ISNULL(p.mc, N'') AS 品名, ISNULL(p.gg, N'') AS 型号,"
                        + " ISNULL(p.jldw, N'') AS 单位,"
                        + " ISNULL(p.xq_sl, 0) AS 需求数量, ISNULL(p.pl_sl, 0) AS 排产数量, 0 AS 每箱数量,"
                        + " CONVERT(varchar(10), p.cp_date, 120) AS 工序交期,"
                        + " CASE WHEN p.cp_date IS NULL THEN NULL"
                        + "      ELSE DATEDIFF(day, CAST(GETDATE() AS date), CAST(p.cp_date AS date)) END AS 交期紧迫度"
                        + " FROM dbo.plang p"
                        + " LEFT JOIN dbo.dm_kh dk ON dk.comm = p.comm AND dk.dm = p.khdm"
                        + " LEFT JOIN bs_partner pt ON pt.[往来单位编码] = p.khdm"
                        + " LEFT JOIN (SELECT iv.存货编码, MAX(CASE WHEN iv.商品标签 LIKE N'%重点%' THEN N'是' ELSE N'否' END) AS 重点管控"
                        + "            FROM bs_inv iv GROUP BY iv.存货编码) 管控 ON 管控.存货编码 = p.dm"
                        + " WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.ja,'N') NOT IN ('T','Y')"
                        + "   AND ISNULL(p.scx, N'') = N''"
                        + "   AND (? = '' OR p.pl_no LIKE ? OR p.od_no LIKE ? OR p.dm LIKE ? OR p.mc LIKE ? OR p.khdm LIKE ? OR ISNULL(dk.mc,'') LIKE ?)"
                        + "   AND (? = '' OR ISNULL(dk.mc, p.khdm) = ?)"
                        + " ORDER BY p.cp_date, p.pl_no, p.pl_xc, p.[批次号]",
                kw, like, like, like, like, like, like, cu, cu);
    }

    /**
     * 统计(plang):待排产笔数 / 今日排产(张数·数量,按排产留痕 asp_time2=今日) / 总未完成量(已排未结案 Σ排产−入库);
     * 产线下拉=档案启用线+当日负荷(plang 在制分摊,替代 bd 版 v_line_load);班组下拉=bs_team。
     */
    public Map<String, Object> stats() {
        List<Map<String, Object>> pool = pending("", "");
        Map<String, Object> today = jdbc.queryForMap(
                "SELECT COUNT(DISTINCT p.pl_no) AS cnt, ISNULL(SUM(p.pl_sl),0) AS qty"
                        + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''"
                        + "   AND CONVERT(varchar(10), p.asp_time2, 120) = CONVERT(varchar(10), GETDATE(), 120)");
        Double undone = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(p.pl_sl,0) - ISNULL(p.rk_sl,0)),0)"
                        + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''"
                        + "   AND ISNULL(p.ja,'N') NOT IN ('T','Y')", Double.class);
        List<Map<String, Object>> lines = lineLoads(null);
        List<String> teams = jdbc.queryForList(
                "SELECT 班组名称 FROM bs_team WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY 班组编码", String.class);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("待排产笔数", pool.size());
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("张数", today.get("cnt"));
        t.put("数量", today.get("qty"));
        out.put("今日排产", t);
        out.put("总未完成量", undone == null ? 0 : Math.round(undone * 10000d) / 10000d);
        out.put("产线", lines);
        out.put("班组", teams);
        return out;
    }

    /**
     * 产线当日负荷(plang 在制分摊,口径对齐原 v_line_load:数量按 [开工日(空=转单日)→交期(夹今天..今天+13)]
     * 均摊到每天,今天在区间内才计入;交期早于今天=全额压今天;未来开工=不计)。
     * only 空=全部启用档案线;非空=只查指定线(排产回执用)。
     */
    private List<Map<String, Object>> lineLoads(List<String> only) {
        StringBuilder f = new StringBuilder(
                " WHERE ISNULL(pl.asp_cancel,'N')<>'Y' AND ISNULL(pl.停用,0)=0");
        List<Object> args = new ArrayList<>();
        if (only != null && !only.isEmpty()) {
            f.append(" AND pl.生产线 IN (").append(String.join(",", only.stream()
                    .map(l -> "N'" + l.replace("'", "''") + "'").toList())).append(")");
        }
        return jdbc.queryForList(
                "SELECT pl.生产线, ISNULL(pl.生产车间,N'') AS 生产车间, ISNULL(pl.日产能,0) AS 日产能,"
                        + " CAST(ISNULL(ld.今日负荷, 0) AS decimal(18,2)) AS 今日负荷,"
                        + " CASE WHEN ISNULL(pl.日产能,0) > 0 AND ISNULL(ld.今日负荷,0) > pl.日产能 THEN N'超载' ELSE N'' END AS 提示"
                        + " FROM bs_prod_line pl"
                        + " LEFT JOIN (SELECT p.scx AS 生产线, SUM(CASE"
                        + "   WHEN CAST(COALESCE(p.st_date, p.pl_date) AS date) > CAST(GETDATE() AS date) THEN 0.0"
                        + "   WHEN p.cp_date IS NULL THEN ISNULL(p.pl_sl,0) * 1.0"
                        + "   ELSE ISNULL(p.pl_sl,0) * 1.0 / (DATEDIFF(day, CAST(GETDATE() AS date),"
                        + "        CASE WHEN CAST(p.cp_date AS date) < CAST(GETDATE() AS date) THEN CAST(GETDATE() AS date)"
                        + "             WHEN CAST(p.cp_date AS date) > DATEADD(day,13,CAST(GETDATE() AS date)) THEN DATEADD(day,13,CAST(GETDATE() AS date))"
                        + "             ELSE CAST(p.cp_date AS date) END) + 1) END) AS 今日负荷"
                        + "   FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''"
                        + "     AND ISNULL(p.ja,'N') NOT IN ('T','Y') AND ISNULL(p.pl_sl,0) > 0 GROUP BY p.scx) ld"
                        + " ON ld.生产线 = pl.生产线" + f + " ORDER BY pl.生产线",
                args.toArray());
    }

    /**
     * 批量排入(plang 单轨):每行 {加工单号, 行id?(plang.id 精确到批次行), 排产数量?(空=沿用), 生产线?} + 公共参数
     * {生产线, 排产班组(≤4字写 lb), 预开工日→st_date, 预完工日→cp_date}。
     * 守卫:产线必填/停用线拒绝/未排产(scx 空)/未结案;排产数量≤需求数量;完工不早于开工。
     * 写 plang.scx/pl_man/lb/st_date/cp_date(/pl_sl,yl),留痕 yj_usage_log。行级独立提交(同 toManu 事务口径)。
     */
    public Map<String, Object> assign(List<Map<String, Object>> rows, String user) {
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("请先勾选要排产的加工单");
        List<String> done = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        List<String> lines = new ArrayList<>();
        java.util.Set<String> disabled = new java.util.HashSet<>(jdbc.queryForList(
                "SELECT [生产线] FROM bs_prod_line WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(停用,0) = 1", String.class));
        for (Map<String, Object> r : rows) {
            String no = str(r.get("加工单号"));
            if (no == null) throw new IllegalArgumentException("排产行缺少 加工单号");
            String line = firstNonBlank(str(r.get("生产线")), str(r.get("顶部生产线")));
            if (line == null) { failed.add(no + ":请先指定生产线"); continue; }
            if (disabled.contains(line)) { failed.add(no + ":生产线「" + line + "」已停用,不可排入(如需启用请在 基础资料→生产线 打开)"); continue; }
            String start = str(r.get("预开工日"));
            String end = str(r.get("预完工日"));
            if (start != null && end != null && end.compareTo(start) < 0) {
                failed.add(no + ":预完工日不能早于预开工日(" + start + " → " + end + ")"); continue;
            }
            Double qtyOverride = num(r.get("排产数量"));
            String team = str(r.get("排产班组"));
            Integer rowId = null;
            Object rid = r.get("行id");
            if (rid instanceof Number nn) rowId = nn.intValue();
            else if (rid != null && !String.valueOf(rid).isBlank()) {
                try { rowId = Integer.valueOf(String.valueOf(rid).trim()); } catch (NumberFormatException ignore) { }
            }
            try {
                Map<String, Object> head;
                try {
                    head = rowId != null
                            ? jdbc.queryForMap("SELECT id, ISNULL(scx,N'') AS scx, ISNULL(ja,'N') AS ja, ISNULL(xq_sl,0) AS xq_sl FROM dbo.plang WHERE id=?", rowId)
                            : jdbc.queryForMap("SELECT TOP 1 id, ISNULL(scx,N'') AS scx, ISNULL(ja,'N') AS ja, ISNULL(xq_sl,0) AS xq_sl FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(scx,N'')=N'' ORDER BY id", no);
                } catch (org.springframework.dao.EmptyResultDataAccessException e) {
                    throw new IllegalStateException("工单不存在:" + no);
                }
                if ("T".equals(String.valueOf(head.get("ja"))) || "Y".equals(String.valueOf(head.get("ja"))))
                    throw new IllegalStateException("已结案,不能排产");
                if (!"".equals(String.valueOf(head.get("scx"))))
                    throw new IllegalStateException("已排产(产线=" + head.get("scx") + "),不能重复排入;换线请先撤销");
                double demand = Num.of(head.get("xq_sl"));
                Double qty = qtyOverride;
                if (qty != null && qty > 0 && qty > demand + 0.0001)
                    throw new IllegalStateException("排产数量 " + qty + " 超过需求数量 " + demand);
                StringBuilder sql = new StringBuilder("UPDATE dbo.plang SET scx=?, pl_man=?,"
                        + " st_date=COALESCE(?, st_date), cp_date=COALESCE(?, cp_date)");
                List<Object> args = new ArrayList<>();
                args.add(line); args.add(user);
                args.add(start == null ? null : java.time.LocalDate.parse(start));
                args.add(end == null ? null : java.time.LocalDate.parse(end));
                if (team != null && !team.isBlank() && team.length() <= 10) { sql.append(", lb=?"); args.add(team); }
                if (qty != null && qty > 0) { sql.append(", pl_sl=?, yl=? - ISNULL(rk_sl,0)"); args.add(qty); args.add(qty); }
                sql.append(", asp_user2=?, asp_time2=GETDATE() WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'");
                args.add(user); args.add(head.get("id"));
                jdbc.update(sql.toString(), args.toArray());
                logUsage(user, "排产", no);
                done.add(no);
                if (!lines.contains(line)) lines.add(line);
            } catch (IllegalStateException e) {
                failed.add(no + ":" + e.getMessage());
            }
        }
        if (done.isEmpty()) throw new IllegalStateException("无行可排产:" + String.join("; ", failed));
        List<Map<String, Object>> receipt = lineLoads(lines);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("排产张数", done.size());
        out.put("单号清单", done);
        out.put("失败行", failed);
        out.put("产线回执", receipt);
        return out;
    }

    /**
     * 撤销排产(回池;换线=撤销+重排):仅已排产(scx 非空)·未作废/结案·**无报工进度且无入库**可撤销;
     * 清 scx/pl_man/lb(开工·完工日保留备查),留痕 yj_usage_log。plang 单轨,按 加工单号(全部未结案行)撤销。
     */
    @Transactional
    public Map<String, Object> unassign(List<Map<String, Object>> rows, String user) {
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("请先勾选要撤销的加工单");
        List<String> done = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String no = str(r.get("加工单号"));
            if (no == null) throw new IllegalArgumentException("撤销行缺少 加工单号");
            try {
                List<Map<String, Object>> heads = jdbc.queryForList(
                        "SELECT id, ISNULL(scx,N'') AS scx, ISNULL(ja,'N') AS ja, ISNULL(rk_sl,0) AS rk_sl,"
                                + " ISNULL((SELECT SUM(ISNULL(w.[完成数量],0)) FROM wo_progress w WHERE w.[单据编号]=p.pl_no"
                                + "   AND ISNULL(w.asp_cancel,'N')<>'Y'),0) AS 已报工"
                                + " FROM dbo.plang p WHERE p.pl_no=? AND ISNULL(p.asp_cancel,'N')<>'Y'", no);
                if (heads.isEmpty()) throw new IllegalStateException("工单不存在:" + no);
                boolean any = false;
                String blockReason = null;
                for (Map<String, Object> h : heads) {
                    if ("T".equals(String.valueOf(h.get("ja"))) || "Y".equals(String.valueOf(h.get("ja")))) {
                        blockReason = "已结案,不能撤销"; break;
                    }
                    if (Num.of(h.get("已报工")) > 0) { blockReason = "已有报工进度,不能撤销排产(追溯链已建立)"; break; }
                    if (Num.of(h.get("rk_sl")) > 0) { blockReason = "已有入库,不能撤销排产"; break; }
                    if (!"".equals(String.valueOf(h.get("scx")))) any = true;
                }
                if (blockReason != null) throw new IllegalStateException(blockReason);
                if (!any) throw new IllegalStateException("该单未排产(已在池中)");
                int n = jdbc.update("UPDATE dbo.plang SET scx=NULL, pl_man=NULL, lb=NULL,"
                                + " asp_user2=?, asp_time2=GETDATE() WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'",
                        user, no);
                if (n == 0) throw new IllegalStateException("撤销未生效");
                logUsage(user, "撤销排产", no);
                done.add(no);
            } catch (IllegalStateException e) {
                failed.add(no + ":" + e.getMessage());
            }
        }
        if (done.isEmpty()) throw new IllegalStateException("无行可撤销:" + String.join("; ", failed));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("撤销张数", done.size());
        out.put("单号清单", done);
        out.put("失败行", failed);
        return out;
    }

    /** 今日已排产(mode=today,按排产留痕 asp_time2)/全部已排产(mode=all)——plang 单轨 */
    public List<Map<String, Object>> today(String mode, String keyword) {
        String kw = keyword == null ? "" : keyword.trim();
        String like = "%" + kw + "%";
        boolean all = "all".equalsIgnoreCase(mode);
        return jdbc.queryForList(
                "SELECT ISNULL(p.scx,N'') AS 生产线, p.pl_no AS 加工单号, ISNULL(p.lb,N'') AS 排产班组,"
                        + " CASE WHEN ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0) THEN N'完工'"
                        + "      WHEN ISNULL(p.rk_sl,0) > 0 THEN N'在产' ELSE N'未完工' END AS 生产状态,"
                        + " ISNULL(p.pl_sl,0) AS 排产数量, 0 AS 每箱数量, 0 AS 箱数,"
                        + " ISNULL(p.xq_sl,0) AS 需求数量, ISNULL(p.rk_sl,0) AS 入库数量,"
                        + " ISNULL(p.pl_sl,0) - ISNULL(p.rk_sl,0) AS 余量,"
                        + " CONVERT(varchar(10), p.st_date, 120) AS 预开工日,"
                        + " CONVERT(varchar(10), p.cp_date, 120) AS 预完工日"
                        + " FROM dbo.plang p"
                        + " WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'') <> N''"
                        + "   AND ISNULL(p.ja,'N') NOT IN ('T','Y')"
                        + (all ? "" : " AND CONVERT(varchar(10), p.asp_time2, 120) = CONVERT(varchar(10), GETDATE(), 120)")
                        + "   AND (? = '' OR p.pl_no LIKE ? OR p.scx LIKE ? OR p.dm LIKE ?)"
                        + " ORDER BY p.scx, p.pl_no, p.pl_xc, p.[批次号]",
                kw, like, like, like);
    }

    /**
     * 左侧骨架(参考工单排产页,2026-09-23 去班别):生产线档案**全部线**(含停用,与基础资料一一对应)
     * 的 未交量汇总。未交量 = 该线已排工单的 Σ(排产−max(入库,已报工))(未结案未作废)——
     * 报工扣减链路(2026-09-23):报工即产出,与入库取大防双扣;已报工=五道工序完成数最大值。
     * 停用线仅可查看(排产/调线守卫在 assign/reassign)。开线管理已按用户拍板去除(2026-09-24,bs_line_open 表下线)。
     */
    public List<Map<String, Object>> linesSummary(String date) {
        String d = (date == null || date.isBlank()) ? java.time.LocalDate.now().toString() : date.trim();
        List<Map<String, Object>> backlog = jdbc.queryForList(
                "SELECT ISNULL(h.[生产线],N'') AS 生产线,"
                        + " SUM(ISNULL(l.[排产数量],0) - CASE WHEN COALESCE(h.[入库数量], ISNULL(l.[入库数量],0)) >= ISNULL(prg.[完成],0)"
                        + " THEN COALESCE(h.[入库数量], ISNULL(l.[入库数量],0)) ELSE ISNULL(prg.[完成],0) END) AS 未交量,"
                        + " COUNT(DISTINCT h.[合同号]) AS 单数"
                        + " FROM bd_manu_order h JOIN bl_manu_order l ON l.[合同号]=h.[合同号] AND ISNULL(l.asp_cancel,'N')<>'Y'"
                        + " LEFT JOIN (SELECT [单据编号], MAX([完成数量]) AS [完成] FROM wo_progress"
                        + "   WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY [单据编号]) prg ON prg.[单据编号]=h.[合同号]"
                        + " LEFT JOIN yj_doc_status s ON s.panel_code='MANU_ORDER' AND s.doc_no=h.[合同号]"
                        + " WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND ISNULL(h.[生产线],N'')<>N'' AND ISNULL(h.[结案],'N')<>'Y'"
                        + "   AND ISNULL(s.canceled,'N')<>'Y' AND ISNULL(s.stopped,'N')<>'Y'"
                        + " GROUP BY h.[生产线]");
        Map<String, Double> bk = new LinkedHashMap<>();
        for (Map<String, Object> b : backlog) {
            bk.put(String.valueOf(b.get("生产线")), Num.of(b.get("未交量")));
        }
        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT [生产线] AS 生产线, ISNULL([生产车间],N'') AS 生产车间,"
                        + " CASE WHEN ISNULL([停用],0) = 1 THEN 1 ELSE 0 END AS 停用"
                        + " FROM bs_prod_line"
                        + " WHERE ISNULL([asp_cancel],'N') <> 'Y' ORDER BY ISNULL([排序],999), [生产线]");
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> line : lines) {
            String ln = String.valueOf(line.get("生产线"));
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("开工日期", d);
            m.put("生产线", ln);
            m.put("生产车间", line.get("生产车间"));
            m.put("停用", Integer.valueOf(1).equals(line.get("停用")));
            double v = bk.getOrDefault(ln, 0d);
            m.put("未交量", Math.round(v * 10000d) / 10000d);
            out.add(m);
        }
        return out;
    }

    /** 选中线 的排产明细(scope=未完工/已完工/全部);排产日期=排产留痕 asp_time2。
     *  列口径对齐旧系统 工单排产明细.列表(ProSchedList,用户 2026-09-23 提供):工单信息+执行回填+结案/打印留痕;
     *  电镀域列(膜厚/环保号/序列号/采购订单号/客户来料单号)未落库,不返回。 */
    public List<Map<String, Object>> scheduled(String line, String scope) {
        String complete;
        if ("已完工".equals(scope)) complete = " AND ISNULL(v.[生产状态],N'') = N'完工'";
        else if ("全部".equals(scope)) complete = "";
        else complete = " AND ISNULL(v.[生产状态],N'') <> N'完工'";
        return jdbc.queryForList(
                "SELECT v.[加工单号], ISNULL(v.[客户],N'') AS 客户,"
                        + " CONVERT(varchar(10), h.asp_time2, 120) AS 排产日期,"
                        + " ISNULL(v.[销售订单号],N'') AS 客户PO, ISNULL(v.[产品编码],N'') AS 物料编码,"
                        + " CONVERT(varchar(10), v.[计划开工日], 120) AS 开工日期,"
                        + " CONVERT(varchar(10), v.[工序交期], 120) AS 计划完工日期,"
                        + " CONVERT(varchar(10), h.[完工日期], 120) AS 实际完工日期,"
                        + " v.[产品名称] AS 产品名称, ISNULL(v.[规格型号],N'') AS 规格型号,"
                        + " ISNULL(v.[生产单位],N'') AS 单位, ISNULL(v.[生产状态],N'') AS 生产状态,"
                        + " ISNULL(v.[排产数量],0) AS 排产数量, ISNULL(v.[需求数量],0) AS 需求数量,"
                        + " ISNULL(v.[入库数量],0) AS 入库数量, ISNULL(v.[余量],0) AS 余量,"
                        + " ISNULL(v.[每箱数量],0) AS 每箱数量,"
                        + " CASE WHEN ISNULL(v.[每箱数量],0)>0 THEN CAST(v.[排产数量]/v.[每箱数量] AS decimal(18,2)) ELSE 0 END AS 箱数,"
                        + " ISNULL(v.[批号],N'') AS 批号, ISNULL(v.[重点管控],N'') AS 重点管控,"
                        + " ISNULL(h.[操作员],N'') AS 操作员, ISNULL(h.[备注],N'') AS 备注,"
                        + " ISNULL(h.[领料单号],N'') AS 领料单号, ISNULL(h.[入库单号],N'') AS 入库单号,"
                        + " ISNULL(h.[结案],N'N') AS 结案, ISNULL(h.[结案人],N'') AS 结案人,"
                        + " CONVERT(varchar(16), h.[结案时间], 120) AS 结案时间,"
                        + " ISNULL(h.[打印人],N'') AS 打印人, CONVERT(varchar(16), h.[打印时间], 120) AS 打印时间,"
                        + " ISNULL(h.[打印次数],0) AS 打印次数,"
                        // 报工扣减链路(2026-09-23):已报工=五道完成数最大;未交量=排产−max(入库,已报工)
                        + " ISNULL(v.[已报工],0) AS 已报工,"
                        + " ISNULL(v.[排产数量],0) - CASE WHEN ISNULL(v.[入库数量],0) >= ISNULL(v.[已报工],0)"
                        + " THEN ISNULL(v.[入库数量],0) ELSE ISNULL(v.[已报工],0) END AS 未交量"
                        + " FROM v_manu_schedule v JOIN bd_manu_order h ON h.[合同号] = v.[加工单号]"
                        + " WHERE ISNULL(v.[生产线],N'') = ? AND ISNULL(v.[单据状态],N'') <> N'已作废'" + complete
                        + " ORDER BY v.[工序交期], v.[加工单号]",
                line == null ? "" : line);
    }

    /**
     * 工单追溯(参考旧系统 品质追溯 ProQuaTrac 口径,2026-09-23):一张工单流转到哪一步。
     * 返回 头信息+状态 / 流转时间线(创建→审核→按钮留痕→结案) / 排产数据(v_manu_schedule) /
     * 完工数据(报工 wo_progress)+入库单据(bd_finish_in.加工单号) / 领料数据(bl_material_out.加工单号);
     * 质检数据段暂缺(生产质检面板未建,接入后补)。
     */
    public Map<String, Object> trace(String no) {
        String doc = no == null ? "" : no.trim();
        Map<String, Object> head = jdbc.queryForMap(
                "SELECT h.[合同号] AS 加工单号, CONVERT(varchar(10), h.[单据日期], 120) AS 工单日期,"
                        + " ISNULL(h.[客户],N'') AS 客户, ISNULL(h.[销售订单号],N'') AS 客户订单号,"
                        + " ISNULL(v.[产品编码],N'') AS 产品编码, ISNULL(v.[产品名称],N'') AS 产品名称,"
                        + " ISNULL(v.[规格型号],N'') AS 规格型号, ISNULL(v.[生产单位],N'') AS 单位,"
                        + " ISNULL(h.[生产线],N'') AS 生产线, ISNULL(h.[操作员],N'') AS 操作员,"
                        + " ISNULL(h.[混料批次号],N'') AS 批号, ISNULL(h.[重点管控],N'否') AS 重点管控,"
                        + " ISNULL(h.[排产数量],0) AS 排产数量, ISNULL(h.[需求数量],0) AS 需求数量,"
                        + " ISNULL(h.[入库数量],0) AS 入库数量, ISNULL(h.[余量],0) AS 余量,"
                        + " CONVERT(varchar(10), h.[预开工日], 120) AS 预开工日,"
                        + " CONVERT(varchar(10), h.[预完工日], 120) AS 预完工日,"
                        + " CONVERT(varchar(10), h.[完工日期], 120) AS 实际完工日期,"
                        + " ISNULL(h.[结案],N'N') AS 结案, ISNULL(h.[结案人],N'') AS 结案人,"
                        + " CONVERT(varchar(16), h.[结案时间], 120) AS 结案时间,"
                        + " ISNULL(h.[领料单号],N'') AS 领料单号, ISNULL(h.[入库单号],N'') AS 入库单号,"
                        + " ISNULL(h.[打印人],N'') AS 打印人, CONVERT(varchar(16), h.[打印时间], 120) AS 打印时间,"
                        + " ISNULL(h.[打印次数],0) AS 打印次数,"
                        + " ISNULL(s.[shr],N'') AS 审核人, CONVERT(varchar(16), s.[shsj], 120) AS 审核时间,"
                        + " CASE WHEN ISNULL(s.[canceled],N'N')='Y' THEN N'已作废'"
                        + "  WHEN ISNULL(s.[stopped],N'N')='Y' THEN N'已中止'"
                        + "  WHEN s.[shr] IS NOT NULL THEN N'已审核' ELSE N'草稿' END AS 单据状态,"
                        + " ISNULL(h.asp_user1,N'') AS 创建人, CONVERT(varchar(16), h.asp_time1, 120) AS 创建时间"
                        + " FROM bd_manu_order h"
                        + " LEFT JOIN yj_doc_status s ON s.panel_code='MANU_ORDER' AND s.doc_no=h.[合同号]"
                        + " LEFT JOIN v_manu_schedule v ON v.[加工单号]=h.[合同号]"
                        + " WHERE h.[合同号]=? AND ISNULL(h.asp_cancel,'N')<>'Y'", doc);
        if (head == null || head.isEmpty()) throw new IllegalArgumentException("生产工单不存在:" + doc);

        // 流转时间线:系统戳(创建/审核/结案) + 按钮留痕(yj_usage_log:保存/审核/排产/撤销排产/批量调线/拆单/结案…)
        List<Map<String, Object>> timeline = new ArrayList<>();
        if (!String.valueOf(head.get("创建人")).isBlank()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("步骤", "创建"); m.put("操作人", head.get("创建人")); m.put("时间", head.get("创建时间"));
            timeline.add(m);
        }
        if (!String.valueOf(head.get("审核人")).isBlank()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("步骤", "审核"); m.put("操作人", head.get("审核人")); m.put("时间", head.get("审核时间"));
            timeline.add(m);
        }
        // 审核与结案已有权威系统戳(上文合成),日志里同名动作跳过防时间线重复;其余按钮留痕(排产/撤销排产/批量调线/拆单…)保留
        // 面板名两代兼容:历史留痕写的是改名前的「生产加工单」(2026-09-24 前),改名后新留痕写「生产工单」
        jdbc.query("SELECT action_name, user_name, CONVERT(varchar(16), created_at, 120) AS at"
                        + " FROM yj_usage_log WHERE panel_name IN (N'生产加工单', N'生产工单') AND doc_no=?"
                        + " AND action_name NOT IN (N'审核', N'结案') ORDER BY created_at",
                rs -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("步骤", rs.getString(1)); m.put("操作人", rs.getString(2)); m.put("时间", rs.getString(3));
                    timeline.add(m);
                }, doc);
        if (!"N".equals(String.valueOf(head.get("结案")))) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("步骤", "结案"); m.put("操作人", head.get("结案人")); m.put("时间", head.get("结案时间"));
            timeline.add(m);
        }

        // 排产数据(v_manu_schedule 头级一行;未排产为空;生产车间列已随去班别下线)
        List<Map<String, Object>> sched = jdbc.queryForList(
                "SELECT 生产线, 排产数量, 需求数量, 入库数量, 余量, 每箱数量, 箱数, 生产状态, 开产量,"
                        + " CONVERT(varchar(10), 计划开工日, 120) AS 计划开工日,"
                        + " CONVERT(varchar(10), 工序交期, 120) AS 工序交期"
                        + " FROM v_manu_schedule WHERE 加工单号=?", doc);

        // 完工数据:报工进度(wo_progress.单据编号=合同号)
        List<Map<String, Object>> done = jdbc.queryForList(
                "SELECT p.[工序], ISNULL(p.[计划数量],0) AS 计划数量, ISNULL(p.[完成数量],0) AS 完成数量,"
                        + " ISNULL(p.asp_user2,N'') AS 报工人, CONVERT(varchar(16), p.asp_time2, 120) AS 报工时间"
                        + " FROM wo_progress p WHERE p.[单据编号]=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + " ORDER BY p.[id]", doc);
        // 入库单据(产成品入库单挂 加工单号)
        List<Map<String, Object>> fins = jdbc.queryForList(
                "SELECT f.[单据编号], CONVERT(varchar(10), f.[单据日期], 120) AS 单据日期,"
                        + " ISNULL(f.[入库类别],N'') AS 入库类别, ISNULL(f.[经手人],N'') AS 经手人, ISNULL(f.[备注],N'') AS 备注"
                        + " FROM bd_finish_in f WHERE f.[加工单号]=? AND ISNULL(f.asp_cancel,'N')<>'Y'"
                        + " ORDER BY f.[单据编号]", doc);
        // 领料数据:材料出库单行(bl_material_out.加工单号)
        List<Map<String, Object>> picks = jdbc.queryForList(
                "SELECT m.[单据编号] AS 领料单号, CONVERT(varchar(10), h.[单据日期], 120) AS 领料日期,"
                        + " ISNULL(m.[材料编码],N'') AS 材料编码, ISNULL(m.[材料名称],N'') AS 材料名称,"
                        + " ISNULL(m.[规格型号],N'') AS 规格型号, ISNULL(m.[计量单位],N'') AS 单位,"
                        + " ISNULL(m.[数量],0) AS 数量, ISNULL(m.[批号],N'') AS 批号"
                        + " FROM bl_material_out m JOIN bd_material_out h ON h.[单据编号]=m.[单据编号]"
                        + " AND ISNULL(h.asp_cancel,'N')<>'Y'"
                        + " WHERE m.[加工单号]=? AND ISNULL(m.asp_cancel,'N')<>'Y'"
                        + " ORDER BY h.[单据编号], m.[id]", doc);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("头", head);
        out.put("时间线", timeline);
        out.put("排产数据", sched);
        out.put("完工数据", done);
        out.put("入库单据", fins);
        out.put("领料数据", picks);
        return out;
    }

    /** 打印生产任务单留痕:打印次数+1、打印人/打印时间(旧系统 ProSchedList 打印人·打印时间列口径) */
    @Transactional
    public Map<String, Object> printStamp(List<Map<String, Object>> rows, String user) {
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("请先勾选要打印的加工单");
        List<String> done = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String no = str(r.get("加工单号"));
            if (no == null) continue;
            jdbc.update("UPDATE bd_manu_order SET [打印次数]=ISNULL([打印次数],0)+1, [打印人]=?, [打印时间]=SYSDATETIME()"
                            + " WHERE [合同号]=? AND ISNULL(asp_cancel,'N')<>'Y'", user, no);
            done.add(no);
        }
        if (done.isEmpty()) throw new IllegalStateException("无可打印的加工单");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("打印张数", done.size());
        out.put("单号清单", done);
        return out;
    }

    /** 批量调线:勾选已排工单 → 调到目标生产线(数量/日期/班组保留;留痕;作废/结案拒绝,停用线拒绝) */
    @Transactional
    public Map<String, Object> reassign(List<Map<String, Object>> rows, String toLine, String user) {
        if (toLine == null || toLine.isBlank()) throw new IllegalArgumentException("请选择目标生产线");
        Integer dis;
        try {
            dis = jdbc.queryForObject(
                    "SELECT CASE WHEN ISNULL(停用,0) = 1 THEN 1 ELSE 0 END FROM bs_prod_line"
                            + " WHERE [生产线] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", Integer.class, toLine);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            dis = null;
        }
        if (dis != null && dis == 1) {
            throw new IllegalArgumentException("目标生产线「" + toLine + "」已停用,不可调入(如需启用请在 基础资料→生产线 打开)");
        }
        List<String> done = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String no = str(r.get("加工单号"));
            if (no == null) continue;
            try {
                Map<String, Object> head = jdbc.queryForMap(
                        "SELECT ISNULL(h.asp_cancel,'N') AS asp_cancel, ISNULL(h.[结案],'N') AS 结案 FROM bd_manu_order h WHERE h.[合同号]=?", no);
                if ("Y".equals(str(head.get("asp_cancel")))) throw new IllegalStateException("已作废");
                if ("Y".equals(str(head.get("结案")))) throw new IllegalStateException("已结案,不能调线");
                jdbc.update("UPDATE bd_manu_order SET [生产线]=?, asp_user2=?, asp_time2=SYSDATETIME()"
                                + " WHERE [合同号]=?", toLine, user, no);
                try {
                    jdbc.update("INSERT INTO yj_usage_log (user_name, event_type, panel_name, action_name, doc_no, created_at)"
                                    + " VALUES (?, N'排产', N'生产工单', N'批量调线', ?, GETDATE())", user, no);
                } catch (Exception ignore) { }
                done.add(no);
            } catch (IllegalStateException e) {
                failed.add(no + ":" + e.getMessage());
            }
        }
        if (done.isEmpty()) throw new IllegalStateException("无行可调线:" + String.join("; ", failed));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("调线张数", done.size());
        out.put("单号清单", done);
        out.put("失败行", failed);
        out.put("目标", toLine);
        return out;
    }

    /** 按钮留痕(yj_usage_log,real_name 非空:取 yj_user 回落登录名;失败不阻断业务) */
    private void logUsage(String user, String action, String docNo) {
        try {
            jdbc.update("INSERT INTO yj_usage_log (user_name, real_name, event_type, panel_name, action_name, doc_no, created_at)"
                            + " VALUES (?, ISNULL((SELECT real_name FROM yj_user WHERE username = ?), ?),"
                            + " N'排产', N'快速排产', ?, ?, GETDATE())",
                    user, user, user, action, docNo);
        } catch (Exception ignore) { }
    }

    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }

    private static Double num(Object o) {
        if (o == null || String.valueOf(o).isBlank()) return null;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return null; }
    }

    private static String firstNonBlank(String... vs) {
        for (String v : vs) if (v != null && !v.isBlank()) return v;
        return null;
    }

    private static final class Num {
        static double of(Object o) {
            Double d = num(o);
            return d == null ? 0 : d;
        }
    }
}
