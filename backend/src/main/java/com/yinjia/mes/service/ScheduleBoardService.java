package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * 排产域服务(2026-09-23 纠偏后服务两个页面;2026-09-27 快速排产切 plang 单轨):
 * <ul>
 *   <li>快速排产(ScheduleBoard.vue,原「排产工作台」):{@link #pending}/{@link #stats}/{@link #assign}/{@link #unassign}/{@link #today}
 *       ——**数据源=参考库工单表 plang**(转工单直落 plang,无需审核即入池):待排产池(产线空·未结案)
 *       → 选产线(档案下拉,带当日负荷)→ 单笔/批量排入(写 plang.scx/st_date/cp_date/lb班组)→ 撤销回池;</li>
 *   <li>工单排产看板(WorkOrderBoard.vue):{@link #linesSummary}/{@link #scheduled}/{@link #reassign}
 *       ——plang 单轨(plang_pc×plang);{@link #trace} 追溯同口径。
 *       「转领料」(按默认 BOM×排产数量生成领料单草稿)已随 BOM 下架移除(2026-10-04)。</li>
 * </ul>
 *
 * <p>池口径(2026-09-27 plang 版):**未指派产线(scx 空)·未作废·未结案**的工单行(转工单时已过
 * 销售订单严格已审核闸门,故不再要求 yj_doc_status)。回执含该线 当日负荷/日产能/超载提示——
 * **只提示不拦截**(排产人工拍板口径)。换线=撤销+重排。
 */
@Service
public class ScheduleBoardService {

    private final JdbcTemplate jdbc;

    /**
     * 三类工序检验单:面板 → 头表(工单追溯「质检段」用)。
     * 三组表**同构**(头 27 列 / 行 15 列,建表见 {@code tools/migrate-qc-process-insp.sql}),
     * 故同一段 SQL 换表名即可全查;出单口径见 {@code ButtonService.WO_INSP_PANEL}(成型/切炭/组装
     * 报工审核各自动出单,混料/装箱不出单)。取值全部来自本类常量,无拼接注入面。
     */
    private static final Map<String, String> INSP_HEAD = Map.of(
            "QC_MOLD_INSP", "qc_mold_insp_head",
            "QC_CUT_INSP", "qc_cut_insp_head",
            "QC_ASM_INSP", "qc_asm_insp_head");

    /** 应检工序(2026-10-14):成型/切炭/组装 三道 —— 与 {@code ButtonService.WO_INSP_PANEL} 同源 */
    private static final List<String> INSP_OPS = List.of("成型", "切炭", "组装");

    public ScheduleBoardService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 待排产池(plang 单轨):产线空·未作废·未结案 的工单行;转工单时已过严格已审核闸门 */
    public List<Map<String, Object>> pending(String keyword, String customer) {
        return pending(keyword, customer, null);
    }

    /**
     * 登录账号的生产车间({@code yj_user.生产车间};空 = 不受限,如管理员/计划组)。
     * 9.29 批次③「排产界面按车间过滤」的判据来源 —— 车间是**产线**的属性(bs_prod_line.生产车间),
     * 工单本身没有车间字段(五工序共用工单)。
     */
    public String workshopOf(String user) {
        if (user == null || user.isBlank()) return null;
        List<String> w = jdbc.queryForList(
                "SELECT TOP 1 ISNULL(生产车间,N'') FROM yj_user WHERE username=?", String.class, user.trim());
        return w.isEmpty() || w.get(0).isBlank() ? null : w.get(0).trim();
    }

    /**
     * 待排产池(按车间收敛版):产线空的行**没有车间属性**,故车间账号(workshop 非空)看不到待排产池
     * —— 池只给不受限账号(管理员/计划组);车间账号在本车间产线范围内看/操作已排工单。
     * 这是 2026-10-05 与用户确认的口径(另一条路线「按产品默认生产车间过滤」需先补 338 个商品的主数据)。
     */
    public List<Map<String, Object>> pending(String keyword, String customer, String workshop) {
        if (workshop != null && !workshop.isBlank()) return List.of();
        String kw = keyword == null ? "" : keyword.trim();
        String like = "%" + kw + "%";
        String cu = customer == null ? "" : customer.trim();
        return jdbc.queryForList(
                "SELECT p.pl_no AS 加工单号, p.id AS 行id, p.pl_xc AS 工单行号, ISNULL(p.[批次号],N'') AS 批次号,"
                        + " CONVERT(varchar(10), p.pl_date, 120) AS 单据日期,"
                        + " ISNULL(p.od_no, N'') AS 客户订单号,"
                        + " ISNULL(dk.mc, p.khdm) AS 客户,"
                        + " ISNULL(管控.重点管控, N'否') AS 重点管控,"
                        + " p.dm AS 产品编号, ISNULL(p.mc, N'') AS 品名, ISNULL(p.gg, N'') AS 型号,"
                        + " ISNULL(p.jldw, N'') AS 单位,"
                        + " ISNULL(p.xq_sl, 0) AS 需求数量, ISNULL(p.pl_sl, 0) AS 排产数量,"
                        + " CONVERT(varchar(10), p.cp_date, 120) AS 工序交期,"
                        + " CASE WHEN p.cp_date IS NULL THEN NULL"
                        + "      ELSE DATEDIFF(day, CAST(GETDATE() AS date), CAST(p.cp_date AS date)) END AS 交期紧迫度"
                        + " FROM dbo.plang p"
                        + " LEFT JOIN dbo.dm_kh dk ON dk.dm = p.khdm"
                                                + " LEFT JOIN (SELECT iv.存货编码, MAX(CASE WHEN iv.商品标签 LIKE N'%重点%' THEN N'是' ELSE N'否' END) AS 重点管控"
                        + "            FROM bs_inv iv GROUP BY iv.存货编码) 管控 ON 管控.存货编码 = p.dm"
                        + " WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.ja,'N') NOT IN ('T','Y')"
                        + "   AND ISNULL(p.scx, N'') = N''"
                        + "   AND (? = '' OR p.pl_no LIKE ? OR p.od_no LIKE ? OR p.dm LIKE ? OR p.mc LIKE ? OR p.khdm LIKE ? OR ISNULL(dk.mc,'') LIKE ?)"
                        + "   AND (? = '' OR ISNULL(dk.mc, p.khdm) = ?)"
                        // 2026-10-11 用户拍板:待排产按转单时间倒序——新结转的工单置顶(asp_time1=转单留痕,
                        // 与生产工单列表"转单时间"同源;NULL 旧数据沉底,次级 pl_date DESC 对齐工单列表口径)
                        + " ORDER BY p.asp_time1 DESC, p.pl_date DESC, p.pl_no, p.pl_xc",
                kw, like, like, like, like, like, like, cu, cu);
    }

    /**
     * 统计(plang):待排产笔数 / 今日排产(张数·数量,按排产留痕 asp_time2=今日) / 总未完成量(已排未结案 Σ排产−入库);
     * 产线下拉=档案启用线+当日负荷(plang 在制分摊,替代 bd 版 v_line_load);班组下拉=bs_team。
     * <p>「今日排产张数」按**工单行**计数(2026-10-15):原 {@code COUNT(DISTINCT p.pl_no)} 是整单去重,
     * 同工单当天排 2 行只算 1 张 —— 与「能按行的都按行」口径不符;数量本就是按行 Σ 的,两者现已同粒度。
     */
    public Map<String, Object> stats() {
        return stats(null);
    }

    /**
     * 统计(按车间收敛版):车间账号(workshop 非空)只看本车间产线的 负荷/今日排产/总未完成量,
     * 且看不到待排产池(池内行无产线 ⇒ 无车间判据)。
     */
    public Map<String, Object> stats(String workshop) {
        String ws = (workshop == null || workshop.isBlank()) ? "" : workshop.trim();
        List<Map<String, Object>> pool = pending("", "", ws);
        Map<String, Object> today = jdbc.queryForMap(
                // 张数 = 今日排产**工单行数**(按行计数,2026-10-15;原 DISTINCT pl_no 是整单口径)
                "SELECT COUNT(*) AS cnt, ISNULL(SUM(p.pl_sl),0) AS qty"
                        + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''"
                        + "   AND CONVERT(varchar(10), p.asp_time2, 120) = CONVERT(varchar(10), GETDATE(), 120)"
                        + "   AND (? = N'' OR EXISTS (SELECT 1 FROM bs_prod_line pl WHERE pl.生产线 = p.scx"
                        + "        AND ISNULL(pl.asp_cancel,'N')<>'Y' AND ISNULL(pl.生产车间,N'') = ?))",
                ws, ws);
        Double undone = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(p.pl_sl,0) - ISNULL(p.rk_sl,0)),0)"
                        + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''"
                        + "   AND ISNULL(p.ja,'N') NOT IN ('T','Y')"
                        + "   AND (? = N'' OR EXISTS (SELECT 1 FROM bs_prod_line pl WHERE pl.生产线 = p.scx"
                        + "        AND ISNULL(pl.asp_cancel,'N')<>'Y' AND ISNULL(pl.生产车间,N'') = ?))",
                Double.class, ws, ws);
        List<Map<String, Object>> lines = lineLoads(null, ws);
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
        out.put("车间", ws);                                  // 前端「当前车间」标识
        out.put("待排产池受限", !ws.isEmpty());                // 前端提示:池仅计划组可见
        return out;
    }

    /**
     * 产线当日负荷(plang 在制分摊,口径对齐原 v_line_load:数量按 [开工日(空=转单日)→交期(夹今天..今天+13)]
     * 均摊到每天,今天在区间内才计入;交期早于今天=全额压今天;未来开工=不计)。
     * only 空=全部启用档案线;非空=只查指定线(排产回执用)。
     */
    private List<Map<String, Object>> lineLoads(List<String> only) {
        return lineLoads(only, null);
    }

    /** 产线当日负荷(同上;workshop 非空时只算该车间的线 —— 9.29 批次③ 按车间收敛) */
    private List<Map<String, Object>> lineLoads(List<String> only, String workshop) {
        StringBuilder f = new StringBuilder(
                " WHERE ISNULL(pl.asp_cancel,'N')<>'Y' AND ISNULL(pl.停用,0)=0");
        List<Object> args = new ArrayList<>();
        if (workshop != null && !workshop.isBlank()) {
            f.append(" AND ISNULL(pl.生产车间,N'') = ?");
            args.add(workshop.trim());
        }
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
                            ? jdbc.queryForMap("SELECT id, pl_xc, ISNULL([批次号],N'') AS pc_batch, ISNULL(scx,N'') AS scx, ISNULL(ja,'N') AS ja, ISNULL(xq_sl,0) AS xq_sl FROM dbo.plang WHERE id=?", rowId)
                            : jdbc.queryForMap("SELECT TOP 1 id, pl_xc, ISNULL([批次号],N'') AS pc_batch, ISNULL(scx,N'') AS scx, ISNULL(ja,'N') AS ja, ISNULL(xq_sl,0) AS xq_sl FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(scx,N'')=N'' ORDER BY id", no);
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
                // 余量口径(2026-09-27 用户拍板):余量=需求数量−排产数量(未排产),排产只改 排产数量,
                // 不再与排产数量相等(旧 yl=qty−rk 在 rk=0 时恒等于排产数量,显示混乱)
                if (qty != null && qty > 0) { sql.append(", pl_sl=?, yl=ISNULL(xq_sl,0) - ?"); args.add(qty); args.add(qty); }
                sql.append(", asp_user2=?, asp_time2=GETDATE() WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'");
                args.add(user); args.add(head.get("id"));
                jdbc.update(sql.toString(), args.toArray());
                // 同步落排产表 plang_pc(薄记录)——幂等:先删后插;锚=plang_id(批次号纯日期化后
                // 同天多行同批次号,(pl_no,pl_xc,批次号) 不再唯一,必须按行 id 定位)
                jdbc.update("DELETE FROM dbo.plang_pc WHERE plang_id=?",
                        head.get("id"));
                jdbc.update("INSERT INTO plang_pc (comm, pl_no, pl_xc, pl_date, scx, pl_man, lb, st_date, cp_date, jh_date,"
                                + " od_no, od_xc, ja, asp_cancel, asp_user1, asp_time1, [批次号], plang_id)"
                                + " SELECT p.comm, p.pl_no, p.pl_xc, p.pl_date, ?, ?, ?, ?, ?, NULL,"
                                + " p.od_no, p.od_xc, p.ja, N'N', ?, GETDATE(), p.[批次号], p.id"
                                + " FROM dbo.plang p WHERE p.id=?",
                        line, user, (team != null && !team.isBlank() && team.length() <= 10) ? team : null,
                        start == null ? null : java.time.LocalDate.parse(start),
                        end == null ? null : java.time.LocalDate.parse(end),
                        user, head.get("id"));
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
            // 唯一键 = **工单号 + 工单行号**(2026-10-07 用户口径):带 行id 时只撤销那一行;
            //   不带(旧调用)时退回整单撤销
            Object ridObj = r.get("行id");
            Long rowId = null;
            if (ridObj instanceof Number nn) rowId = nn.longValue();
            else if (ridObj != null && !String.valueOf(ridObj).isBlank()) {
                try { rowId = Long.valueOf(String.valueOf(ridObj).trim()); } catch (NumberFormatException ignore) { }
            }
            final Long row = rowId;
            try {
                // 已报工量(判"能不能撤销"):带 行id 时只算**该行**的报工(锚 scjl.gd_id → plang_pc.plang_id,
                //   老数据没有 gd_id 时按(工单号+批次号)兜底);不带行id(旧调用)时算整单。
                //   ⚠ SQL 写成"两个扁平子查询相加":深层嵌套(? IS NULL OR … IN (SELECT …))实测被 T-SQL 判语法错。
                String reportedExpr = row == null
                        ? "ISNULL((SELECT SUM(ISNULL(s.sl,0)) FROM dbo.scjl s WHERE s.gldh=p.pl_no"
                          + " AND ISNULL(s.asp_cancel,'N')<>'Y'),0)"
                        : "ISNULL((SELECT SUM(ISNULL(s.sl,0)) FROM dbo.scjl s"
                          + "   JOIN dbo.plang_pc pc ON pc.id = s.gd_id"
                          + "   WHERE s.gldh=p.pl_no AND pc.plang_id=? AND ISNULL(s.asp_cancel,'N')<>'Y'),0)"
                          + " + ISNULL((SELECT SUM(ISNULL(s.sl,0)) FROM dbo.scjl s"
                          + "   WHERE s.gldh=p.pl_no AND s.gd_id IS NULL AND ISNULL(s.asp_cancel,'N')<>'Y'"
                          + "     AND ISNULL(s.[批次号],N'')=ISNULL(p.[批次号],N'')),0)";
                String headSql = "SELECT id, ISNULL(scx,N'') AS scx, ISNULL(ja,'N') AS ja, ISNULL(rk_sl,0) AS rk_sl,"
                        + " (" + reportedExpr + ") AS 已报工"
                        + " FROM dbo.plang p WHERE p.pl_no=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + "   AND (? IS NULL OR p.id=?)";
                List<Map<String, Object>> heads = row == null
                        ? jdbc.queryForList(headSql, no, null, null)
                        : jdbc.queryForList(headSql, row, no, row, row);
                if (heads.isEmpty()) throw new IllegalStateException(row == null ? "工单不存在:" + no : "该工单行不存在");
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
                int n = row == null
                        ? jdbc.update("UPDATE dbo.plang SET scx=NULL, pl_man=NULL, lb=NULL,"
                                + " asp_user2=?, asp_time2=GETDATE() WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'",
                        user, no)
                        : jdbc.update("UPDATE dbo.plang SET scx=NULL, pl_man=NULL, lb=NULL,"
                                + " asp_user2=?, asp_time2=GETDATE() WHERE id=?", user, row);
                if (n == 0) throw new IllegalStateException("撤销未生效");
                if (row == null) jdbc.update("DELETE FROM dbo.plang_pc WHERE pl_no=?", no);
                else jdbc.update("DELETE FROM dbo.plang_pc WHERE plang_id=?", row);
                // **同时作废工序—产线预排台账**(2026-10-07 用户口径:撤销排产必须清台账,
                //   否则出现"没排产却有计划线";软删留痕,不物理删除);按行撤销时只清该行台账
                jdbc.update("UPDATE dbo.wo_process_line SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE()"
                        + " WHERE 工单号=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + "   AND (? IS NULL OR 工单行id=? OR 工单行id IS NULL)", user, no, row, row);
                logUsage(user, "撤销排产", row == null ? no : no + "#" + row);
                done.add(row == null ? no : no + " 行" + row);
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

    /** 今日已排产(mode=today,按排产留痕 asp_time1)/全部已排产(mode=all)——plang 单轨;含 工单行号/批次号 */
    public List<Map<String, Object>> today(String mode, String keyword) {
        return today(mode, keyword, null);
    }

    /** 今日/全部已排产(按车间收敛版:workshop 非空时只出本车间产线的行) */
    public List<Map<String, Object>> today(String mode, String keyword, String workshop) {
        String ws = (workshop == null || workshop.isBlank()) ? "" : workshop.trim();
        String kw = keyword == null ? "" : keyword.trim();
        String like = "%" + kw + "%";
        boolean all = "all".equalsIgnoreCase(mode);
        return jdbc.queryForList(
                "SELECT ISNULL(p.scx,N'') AS 生产线, p.pl_no AS 加工单号, p.id AS 行id, p.pl_xc AS 工单行号,"
                        + " ISNULL(p.[批次号],N'') AS 批次号, ISNULL(p.lb,N'') AS 排产班组,"
                        + " CASE WHEN ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0) THEN N'已结案'"
                        + "      WHEN ISNULL(p.[完工状态],N'') IN (N'生产完工', N'已完工') THEN N'完工' WHEN ISNULL(p.rk_sl,0) > 0 THEN N'在产' ELSE N'未完工' END AS 生产状态,"
                        + " ISNULL(p.pl_sl,0) AS 排产数量,"
                        + " ISNULL(p.xq_sl,0) AS 需求数量, ISNULL(p.rk_sl,0) AS 入库数量,"
                        // 余量(2026-09-28 定稿)=订单结转剩余数量(需求−已转出占用,与订单结转页同源)
                        + " ISNULL(p.xq_sl,0) - ISNULL((SELECT SUM(l.linked_quantity) FROM form_flow_link l"
                        + "   WHERE l.source_panel_code = 'SO_ORDER' AND l.source_form_no = p.od_no"
                        + "     AND l.source_line_key = p.od_no + N'#' + CONVERT(nvarchar(20), CONVERT(int, p.od_xc))"
                        + "     AND l.link_status = 'ACTIVE'), 0) AS 余量,"
                        + " CONVERT(varchar(10), p.st_date, 120) AS 预开工日,"
                        + " CONVERT(varchar(10), p.cp_date, 120) AS 预完工日,"
                        // 计划线(各工序)(2026-10-07 预排全程线):排产时人工逐道选定的线
                        + " (SELECT STUFF((SELECT N' → ' + x.工序 + N':' + ISNULL(NULLIF(x.计划生产线,N''),N'待定')"
                        + "   FROM dbo.wo_process_line x WHERE x.工单号=p.pl_no AND ISNULL(x.asp_cancel,'N')<>N'Y'"
                        + "   ORDER BY ISNULL(x.工序序,999) FOR XML PATH('')),1,3,N'')) AS 计划线"
                        + " FROM dbo.plang p"
                        + " WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'') <> N''"
                        + "   AND ISNULL(p.ja,'N') NOT IN ('T','Y')"
                        + (all ? "" : " AND CONVERT(varchar(10), p.asp_time2, 120) = CONVERT(varchar(10), GETDATE(), 120)")
                        + "   AND (? = '' OR p.pl_no LIKE ? OR p.scx LIKE ? OR p.dm LIKE ?)"
                        + "   AND (? = N'' OR EXISTS (SELECT 1 FROM bs_prod_line pl WHERE pl.生产线 = p.scx"
                        + "        AND ISNULL(pl.asp_cancel,'N')<>'Y' AND ISNULL(pl.生产车间,N'') = ?))"
                        + " ORDER BY p.scx, p.pl_no, p.pl_xc, p.[批次号]",
                kw, like, like, like, ws, ws);
    }

    /**
     * 左侧骨架(2026-09-27 切 plang_pc×plang):生产线档案**全部线**(含停用)的 未交量汇总。
     * 未交量 = 该线已排工单的 Σ(排产−max(入库,已报工))(未结案未作废)——排产行=plang_pc(薄记录),
     * 数量/状态=plang 活数据;已报工=wo_progress 按工单号完成数最大值。
     */
    public List<Map<String, Object>> linesSummary(String date) {
        return linesSummary(date, null);
    }

    /** 左侧骨架(同上;workshop 非空时只出本车间的线 —— 9.29 批次③ 按车间收敛) */
    public List<Map<String, Object>> linesSummary(String date, String workshop) {
        String d = (date == null || date.isBlank()) ? java.time.LocalDate.now().toString() : date.trim();
        String ws = (workshop == null || workshop.isBlank()) ? "" : workshop.trim();
        // 未交量 = **成品口径**:排产数量 − 入库数量(不足 0 记 0)。
        //   ⚠ 2026-10-07 修:原来拿"报工合计"(跨工序相加、工序口径)去减排产(成品口径),
        //     首道换算率 >1 时会算出负数(实测 GD-2026-10-0002 成型×7 ⇒ 8000−56000 = -48000)。
        List<Map<String, Object>> backlog = jdbc.queryForList(
                "SELECT ISNULL(pc.scx,N'') AS 生产线,"
                        + " SUM(CASE WHEN ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0) THEN 0"
                        + "          ELSE ISNULL(p.pl_sl,0) - ISNULL(p.rk_sl,0) END) AS 未交量,"
                        + " COUNT(DISTINCT pc.pl_no) AS 单数"
                        + " FROM dbo.plang_pc pc"
                        + " JOIN dbo.plang p ON p.comm = pc.comm AND p.pl_no = pc.pl_no AND p.pl_xc = pc.pl_xc"
                        + "   AND pc.plang_id = p.id AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + " WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'')<>N''"
                        + "   AND ISNULL(p.ja,'N') NOT IN ('T','Y')"
                        + " GROUP BY pc.scx");
        Map<String, Double> bk = new LinkedHashMap<>();
        for (Map<String, Object> b : backlog) {
            bk.put(String.valueOf(b.get("生产线")), Num.of(b.get("未交量")));
        }
        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT [生产线] AS 生产线, ISNULL([生产车间],N'') AS 生产车间,"
                        + " ISNULL([产线分组],N'') AS 产线分组,"   // 第 2 级分类(成型→烧结/X烧结;依《新系统产线命名.xlsx》)
                        + " CASE WHEN ISNULL([停用],0) = 1 THEN 1 ELSE 0 END AS 停用"
                        + " FROM bs_prod_line"
                        + " WHERE ISNULL([asp_cancel],'N') <> 'Y' AND (? = N'' OR ISNULL([生产车间],N'') = ?)"
                        + " ORDER BY ISNULL([排序],999), [生产线]", ws, ws);
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

    /**
     * 选中线 的排产明细(scope=未完工/已完工/全部)——2026-09-27 切 plang_pc×plang:
     * 排产字段(scx/lb/st_date/cp_date/pl_man/排产日期)取 plang_pc 薄记录,
     * 数量/结案/打印等活数据取 plang(与生产工单列表页一致);列口径对齐 WorkOrderBoard 表格。
     */
    public List<Map<String, Object>> scheduled(String line, String scope) {
        return scheduled(line, scope, null);
    }

    /** 选中线 的排产明细(按车间收敛版:workshop 非空时只认本车间的产线,跨车间查询返回空) */
    public List<Map<String, Object>> scheduled(String line, String scope, String workshop) {
        String ws = (workshop == null || workshop.isBlank()) ? "" : workshop.trim();
        String complete;
        if ("已完工".equals(scope)) complete = " AND st.[生产状态] IN (N'完工', N'已结案')";
        else if ("全部".equals(scope)) complete = "";
        else complete = " AND st.[生产状态] <> N'完工' AND st.[生产状态] <> N'已结案'";
        // ── 「当前工序」/「上道工序」表达式(2026-10-07 用户口径)──────────────────────────
        //   当前工序 = 预排台账里最后一道「已落实」(转到切炭线后就显示切炭);缺台账回落**本行** p.当前工序
        // 🔴 2026-10-15 修(用户口径「工单号+工单行号确定当前唯一工单,各个工单的进程、流程追溯都这样实现」):
        //   回落值原取 wpp.当前工序 —— 视图 v_wo_process_progress 是**按单号聚合**的整单派生值
        //   ⇒ 同工单所有行显示同一个工序(与行级口径冲突)。现回落 p.[当前工序](本行状态列)。
        //   ⚠ 不跨 CROSS APPLY 引用别名(T-SQL 实测「Invalid column name」)⇒ 拼成局部变量复用
        final String curOp = "ISNULL(NULLIF((SELECT TOP 1 w.工序 FROM dbo.wo_process_line w"
                + " WHERE w.工单号 = p.pl_no AND ISNULL(w.asp_cancel,'N')<>'Y'"
                + "   AND (w.工单行id = p.id OR w.工单行id IS NULL) AND ISNULL(w.状态,N'')=N'已落实'"
                + " ORDER BY ISNULL(w.工序序,999) DESC, w.id DESC), N''), ISNULL(p.[当前工序],N''))";
        final String prevOp = "(SELECT TOP 1 r4.工序名称 FROM dbo.bs_route r4"
                + " WHERE r4.工艺路线编码 = ISNULL(p.[工艺路线],N'') AND ISNULL(r4.asp_cancel,'N')<>'Y'"
                + "   AND ISNULL(r4.加工顺序,999) < ISNULL(NULLIF((SELECT TOP 1 w4.工序序 FROM dbo.wo_process_line w4"
                + "        WHERE w4.工单号 = p.pl_no AND ISNULL(w4.asp_cancel,'N')<>'Y'"
                + "          AND (w4.工单行id = p.id OR w4.工单行id IS NULL) AND w4.工序 = " + curOp + "), 0),"
                + "      ISNULL((SELECT TOP 1 ISNULL(r5.加工顺序,999) FROM dbo.bs_route r5"
                + "        WHERE r5.工艺路线编码 = ISNULL(p.[工艺路线],N'') AND r5.工序名称 = " + curOp
                + "          AND ISNULL(r5.asp_cancel,'N')<>'Y'), 0))"
                + " ORDER BY ISNULL(r4.加工顺序,999) DESC)";
        // 某道工序的「本行已审报工量」(按行锚定:scjl.gd_id → plang_pc.plang_id,老数据按批次兜底)
        final String qtyOf = "(SELECT SUM(ISNULL(s.sl,0)) FROM dbo.scjl s"
                + " WHERE s.gldh = p.pl_no AND s.gxdm = %s"
                + "   AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'"
                + "   AND (EXISTS (SELECT 1 FROM dbo.plang_pc pcx WHERE pcx.id = s.gd_id AND pcx.plang_id = p.id)"
                + "        OR (s.gd_id IS NULL AND ISNULL(s.[批次号],N'') = ISNULL(p.[批次号],N''))))";
        return jdbc.queryForList(
                // 行id = **工单行身份**(plang.id),行级键的第一段(2026-10-15「能按行的都按行」):
                //   下游(打印留痕/取消结案/调拨/追溯)一律拿它定位,不再只靠(工单号+批次号)反查 ——
                //   同天多笔转单批次号相同,只有 plang.id 才唯一。
                "SELECT p.id AS 行id, pc.pl_no AS 加工单号, pc.pl_xc AS 工单行号, ISNULL(p.comm,N'') AS 公司代码, ISNULL(dk.mc, p.khdm) AS 客户,"
                        // 排产日期=实际排入时间(plang_pc.asp_time1,排入即写);asp_time2 仅调线/改动时才有
                        + " CONVERT(varchar(10), pc.asp_time1, 120) AS 排产日期,"
                        + " ISNULL(p.od_no,N'') AS 客户PO, p.dm AS 物料编码,"
                        + " CONVERT(varchar(10), pc.st_date, 120) AS 开工日期,"
                        + " CONVERT(varchar(10), pc.cp_date, 120) AS 计划完工日期,"
                        + " CONVERT(varchar(10), p.cp_date2, 120) AS 实际完工日期,"
                        + " ISNULL(p.mc,N'') AS 产品名称, ISNULL(p.gg,N'') AS 规格型号,"
                        + " ISNULL(p.jldw,N'') AS 单位,"
                        + " CASE WHEN ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0) THEN N'已结案'"
                        + "      WHEN ISNULL(p.[完工状态],N'') IN (N'生产完工', N'已完工') THEN N'完工' WHEN ISNULL(p.rk_sl,0) > 0 THEN N'在产' ELSE N'未完工' END AS 生产状态,"
                        + " ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.xq_sl,0) AS 需求数量,"
                        + " ISNULL(p.rk_sl,0) AS 入库数量, ISNULL(p.xq_sl,0) - ISNULL((SELECT SUM(l.linked_quantity) FROM form_flow_link l WHERE l.source_panel_code = 'SO_ORDER' AND l.source_form_no = p.od_no AND l.source_line_key = p.od_no + N'#' + CONVERT(nvarchar(20), CONVERT(int, p.od_xc)) AND l.link_status = 'ACTIVE'), 0) AS 余量,"
                        // 批号=转单批次号(与生产工单页「批次号」对应;legacy 旧行无批次号回退产品批号 lot_no)
                        + " ISNULL(NULLIF(pc.[批次号],N''), ISNULL(pc.lot_no,N'')) AS 批号, ISNULL(管控.重点管控, N'否') AS 重点管控,"
                        + " ISNULL(pc.pl_man,N'') AS 操作员, CAST(ISNULL(CAST(p.bz AS nvarchar(500)), N'') AS nvarchar(500)) AS 备注,"
                        + " ISNULL(p.ll_no2,N'') AS 领料单号, ISNULL(p.rk_no,N'') AS 入库单号,"
                        // 计划线(各工序)(2026-10-07 预排全程线):排产时人工逐道选定的线,按工序序箭头串联
                        + " (SELECT STUFF((SELECT N' → ' + x.工序 + N':' + ISNULL(NULLIF(x.计划生产线,N''),N'待定')"
                        + "   FROM dbo.wo_process_line x WHERE x.工单号=p.pl_no AND ISNULL(x.asp_cancel,'N')<>N'Y'"
                        + "   ORDER BY ISNULL(x.工序序,999) FOR XML PATH('')),1,3,N'')) AS 计划线,"
                        + " CASE WHEN p.ja IN (N'T',N'Y') THEN N'Y' ELSE N'N' END AS 结案,"
                        + " N'' AS 结案人, CAST(NULL AS datetime) AS 结案时间,"
                        + " ISNULL(p.[打印人],N'') AS 打印人, CONVERT(varchar(16), p.[打印时间], 120) AS 打印时间,"
                        + " ISNULL(p.asp_print,0) AS 打印次数,"
                        // 口径(2026-10-07 定死,见 docs/plans/2026-10-07-预排全程线与转序-方案评估.md §2.4.2):
                        //   成品口径 = 需求/排产/入库/未交量;工序口径 = 各道计划量/报工/进度。
                        //   明细列:当前工序(本线要做的)/ 当前工序计划量 / 当前工序完工量 / 上道工序 / 上道完工量
                        //           + 上道完工量(折成品) / 未交量(成品口径 = 排产 − 入库)
                        + " " + curOp + " AS 当前工序,"
                        // 当前工序在路线里的顺序(台账工序序优先,取不到用路线加工顺序,都取不到记 0)
                        + " ISNULL(NULLIF((SELECT TOP 1 w3.工序序 FROM dbo.wo_process_line w3"
                        + "    WHERE w3.工单号 = p.pl_no AND ISNULL(w3.asp_cancel,'N')<>'Y'"
                        + "      AND (w3.工单行id = p.id OR w3.工单行id IS NULL) AND w3.工序 = " + curOp + "), 0),"
                        + "   ISNULL((SELECT TOP 1 ISNULL(r3.加工顺序,999) FROM dbo.bs_route r3"
                        + "    WHERE r3.工艺路线编码 = ISNULL(p.[工艺路线],N'') AND r3.工序名称 = " + curOp
                        + "      AND ISNULL(r3.asp_cancel,'N')<>'Y'), 0)) AS 当前工序序,"
                        // 当前工序计划量:台账里该道的计划数量优先(排产时按行算好),否则 行排产 × 该道换算率
                        + " ISNULL(NULLIF((SELECT TOP 1 ISNULL(w2.计划数量,0) FROM dbo.wo_process_line w2"
                        + "    WHERE w2.工单号 = p.pl_no AND ISNULL(w2.asp_cancel,'N')<>'Y'"
                        + "      AND (w2.工单行id = p.id OR w2.工单行id IS NULL) AND w2.工序 = " + curOp + "), 0),"
                        + "   ISNULL((SELECT TOP 1 ISNULL(p.pl_sl,0) * ISNULL(r.换算率,1)"
                        + "    FROM dbo.bs_route r WHERE r.工艺路线编码 = ISNULL(p.[工艺路线],N'')"
                        + "      AND r.工序名称 = " + curOp + " AND ISNULL(r.asp_cancel,'N')<>'Y'), 0)) AS 当前工序计划量,"
                        // 当前工序完工量(本行该道已审报工量)
                        + " ISNULL(" + String.format(qtyOf, curOp) + ", 0) AS 当前工序完工量,"
                        // 上道工序 + 上道完工量(该线要处理的来料量)
                        + " ISNULL(" + prevOp + ", N'') AS 上道工序,"
                        + " ISNULL(" + String.format(qtyOf, prevOp) + ", 0) AS 上道完工量,"
                        // 未交量 = 成品口径:排产 − 入库(不足 0 记 0);**不再**减去工序口径的报工量
                        //   ⚠ 未交量是**本行当前**的状态(还没入库=还没交),与上道做了多少无关(2026-10-07 用户确认)
                        + " CASE WHEN ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0) THEN 0"
                        + "      ELSE ISNULL(p.pl_sl,0) - ISNULL(p.rk_sl,0) END AS 未交量,"
                        + " ISNULL(pc.[批次号],N'') AS 批次号"
                        + " FROM dbo.plang_pc pc"
                        + " JOIN dbo.plang p ON p.comm = pc.comm AND p.pl_no = pc.pl_no AND p.pl_xc = pc.pl_xc"
                        + "   AND pc.plang_id = p.id AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + " LEFT JOIN dbo.dm_kh dk ON dk.dm = p.khdm"
                        + " LEFT JOIN (SELECT iv.存货编码, MAX(CASE WHEN iv.商品标签 LIKE N'%重点%' THEN N'是' ELSE N'否' END) AS 重点管控"
                        + "            FROM bs_inv iv GROUP BY iv.存货编码) 管控 ON 管控.存货编码 = p.dm"
                        // ⚠ 2026-10-15 移除 `LEFT JOIN v_wo_process_progress wpp`(整单聚合视图,与行级口径冲突;
                        //   其唯一用处 wpp.当前工序 已改为回落本行 p.[当前工序],见上方 curOp)
                        + " CROSS APPLY (SELECT CASE WHEN ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0)"
                        + "   THEN N'完工' WHEN ISNULL(p.rk_sl,0) > 0 THEN N'在产' ELSE N'未完工' END AS [生产状态]) st"
                        + " WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'') = ?"
                        + "   AND (? = N'' OR EXISTS (SELECT 1 FROM bs_prod_line pl WHERE pl.生产线 = pc.scx"
                        + "        AND ISNULL(pl.asp_cancel,'N')<>'Y' AND ISNULL(pl.生产车间,N'') = ?))" + complete
                        + " ORDER BY pc.cp_date, pc.pl_no, pc.pl_xc",
                line == null ? "" : line, ws, ws);
    }

    /**
     * 工单追溯(2026-09-27 切 plang/plang_pc,修复 plang 工单追溯报
     * "Incorrect result size: expected 1, actual 0"——旧版查 bd_manu_order 必空):
     * 头=plang(数量/结案/打印活数据) + 首个排产行的产线/日期;时间线=创建+按钮留痕(yj_usage_log)+
     * 结案;排产数据=plang_pc 各排产行;完工=wo_progress(单据编号=工单号);入库/领料按 加工单号 关联
     * (plang 工单的入库/领料回写链未接通前为空)。
     * <p><b>质检段(2026-10-14 补)</b>:三类工序检验单(成型 CX/切炭 QT/组装成品 ZJ,报工审核自动出单)
     * + 工单维度汇总(应检/已检/缺检/结论),让「工单结束」在界面上能直接对上成品检验单;
     * 明细/汇总键见 {@code 质检数据} / {@code 质检汇总}。
     */
    public Map<String, Object> trace(String no) {
        return trace(no, null);
    }

    /**
     * 工单追溯(重载:可带**工单行id**,让「家族/切单血缘」按行精确聚合 —— 同一 pl_no 可有多行)。
     * 家族=根行 + 全部子孙(递归 CTE);不传行id 时取该单号首行。
     */
    public Map<String, Object> trace(String no, Long rowId) {
        String doc = no == null ? "" : no.trim();
        Map<String, Object> head;
        try {
            head = jdbc.queryForMap(
                    "SELECT TOP 1 p.pl_no AS 加工单号, CONVERT(varchar(10), p.pl_date, 120) AS 工单日期,"
                            + " ISNULL(dk.mc, p.khdm) AS 客户, ISNULL(p.od_no,N'') AS 客户订单号,"
                            + " p.dm AS 产品编码, ISNULL(p.mc,N'') AS 产品名称, ISNULL(p.gg,N'') AS 规格型号,"
                            + " ISNULL(p.jldw,N'') AS 单位, ISNULL(p.scx,N'') AS 生产线, ISNULL(p.pl_man,N'') AS 操作员,"
                            + " ISNULL(p.lot_no,N'') AS 批号, ISNULL(管控.重点管控, N'否') AS 重点管控,"
                            + " ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.xq_sl,0) AS 需求数量,"
                            + " ISNULL(p.rk_sl,0) AS 入库数量, ISNULL(p.xq_sl,0) - ISNULL((SELECT SUM(l.linked_quantity) FROM form_flow_link l WHERE l.source_panel_code = 'SO_ORDER' AND l.source_form_no = p.od_no AND l.source_line_key = p.od_no + N'#' + CONVERT(nvarchar(20), CONVERT(int, p.od_xc)) AND l.link_status = 'ACTIVE'), 0) AS 余量,"
                            + " CONVERT(varchar(10), p.st_date, 120) AS 预开工日,"
                            + " CONVERT(varchar(10), p.cp_date, 120) AS 预完工日,"
                            + " CONVERT(varchar(10), p.cp_date2, 120) AS 实际完工日期,"
                            // 计划线(各工序)(2026-10-07 预排全程线):排产时人工逐道选定的线
                            + " (SELECT STUFF((SELECT N' → ' + x.工序 + N':' + ISNULL(NULLIF(x.计划生产线,N''),N'待定')"
                            + "   FROM dbo.wo_process_line x WHERE x.工单号=p.pl_no AND ISNULL(x.asp_cancel,'N')<>N'Y'"
                            + "   ORDER BY ISNULL(x.工序序,999) FOR XML PATH('')),1,3,N'')) AS 计划线,"
                        + " CASE WHEN p.ja IN (N'T',N'Y') THEN N'Y' ELSE N'N' END AS 结案,"
                            + " N'' AS 结案人, CONVERT(varchar(16), NULL, 120) AS 结案时间,"
                            + " ISNULL(p.ll_no2,N'') AS 领料单号, ISNULL(p.rk_no,N'') AS 入库单号,"
                            + " ISNULL(p.[打印人],N'') AS 打印人, CONVERT(varchar(16), p.[打印时间], 120) AS 打印时间,"
                            + " ISNULL(p.asp_print,0) AS 打印次数,"
                            + " CASE WHEN p.ja IN (N'T',N'Y') THEN N'已结案'"
                            + "      WHEN ISNULL(p.scx,N'') <> N'' THEN N'已排产' ELSE N'未排产' END AS 单据状态,"
                            + " ISNULL(p.asp_user1,N'') AS 创建人, CONVERT(varchar(16), p.asp_time1, 120) AS 创建时间"
                            + " FROM dbo.plang p"
                            + " LEFT JOIN dbo.dm_kh dk ON dk.dm = p.khdm"
                            + " LEFT JOIN (SELECT iv.存货编码, MAX(CASE WHEN iv.商品标签 LIKE N'%重点%' THEN N'是' ELSE N'否' END) AS 重点管控"
                            + "            FROM bs_inv iv GROUP BY iv.存货编码) 管控 ON 管控.存货编码 = p.dm"
                            + " WHERE p.pl_no=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                            + " ORDER BY p.pl_xc, p.id", doc);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new IllegalArgumentException("生产工单不存在:" + doc);
        }
        // 多行工单(同一 pl_no 多订单行/多批次)必须走**汇总口径**(2026-10-05 修):原 queryForMap 在
        // 多行时抛 "Incorrect result size: expected 1, actual N"(实测 MO-2026-09-0136 = 7 行 → 追溯 500,
        // 生产工单页「追溯」按钮对多行工单全废)。现:头取首行做产品/客户/日期锚,数量改合计,产线多值时标注。
        Map<String, Object> agg = jdbc.queryForMap(
                "SELECT COUNT(*) AS 行数, ISNULL(SUM(ISNULL(pl_sl,0)),0) AS 排产数量,"
                        + " ISNULL(SUM(ISNULL(xq_sl,0)),0) AS 需求数量, ISNULL(SUM(ISNULL(rk_sl,0)),0) AS 入库数量,"
                        + " COUNT(DISTINCT NULLIF(ISNULL(scx,N''), N'')) AS 产线数,"
                        + " MAX(NULLIF(ISNULL(scx,N''), N'')) AS 任一产线,"
                        + " SUM(CASE WHEN ISNULL(ja,'N') IN (N'T',N'Y') THEN 1 ELSE 0 END) AS 结案行数"
                        + " FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'", doc);
        head.put("行数", agg.get("行数"));
        head.put("排产数量", agg.get("排产数量"));
        head.put("需求数量", agg.get("需求数量"));
        head.put("入库数量", agg.get("入库数量"));
        head.put("余量", Num.of(agg.get("需求数量")) - Num.of(agg.get("排产数量")));
        long lineCnt = (long) Num.of(agg.get("产线数"));
        if ("".equals(String.valueOf(head.get("生产线"))) && lineCnt > 0) {
            head.put("生产线", agg.get("任一产线"));   // 首行未排产但同工单其它行已排产:别显示成"未排产"
        }
        if (lineCnt > 1) {
            head.put("生产线", "多产线(" + lineCnt + ")");
        }
        boolean allClosed = Num.of(agg.get("结案行数")) >= Num.of(agg.get("行数"));
        head.put("单据状态", allClosed ? "已结案"
                : ("".equals(String.valueOf(head.get("生产线"))) ? "未排产" : "已排产"));

        // ══ 当前行(2026-10-15 用户口径「追溯按 工单号 + 工单行号」)══════════════════════════════
        // 【根因】此前各段只按 工单号 过滤,同一工单号的多行(多订单行/多批次)数据**全混在一起**:
        //   实测 GD-2026-10-0002(8 行 / 3 批次 20261006、20261007、20261010)在产的是**行7(20261007)**,
        //   但检验段按工单号取回了 7 张单,其中 6 张属于 20261006 —— 界面上就"显示之前同工单号的数据"。
        //   更深一层:前端 WorkOrderTraceDialog 只发了 {工单号},连 rowId 都没传 ⇒ 后端 trace(no,rowId)
        //   的 rowId 只被"家族 CTE"用到,各段查询从不看它。
        // 【行级键】**scjl.gd_id 指向 plang_pc.id,不是 plang.id**(实测 gd_id=573 = 行7 的排产行);
        //   两者由 plang_pc.plang_id ↔ plang.id 对应。故报工/检验按
        //   「gd_id ∈ 本行的排产行id」**或**「gd_id 空(历史数据) 且 批次号 = 本行批次号」收敛。
        Map<String, Object> curRow = null;
        if (rowId != null) {
            List<Map<String, Object>> rr = jdbc.queryForList(
                    "SELECT TOP 1 p.id AS 行id, p.pl_xc AS 工单行号, ISNULL(p.[批次号],N'') AS 批次号,"
                            + " ISNULL(p.scx,N'') AS 生产线, ISNULL(p.pl_sl,0) AS 排产数量,"
                            + " ISNULL(p.xq_sl,0) AS 需求数量, ISNULL(p.rk_sl,0) AS 入库数量,"
                            + " ISNULL(p.dm,N'') AS 产品编码, ISNULL(p.mc,N'') AS 产品名称,"
                            + " ISNULL(p.gg,N'') AS 规格型号, ISNULL(p.lot_no,N'') AS 批号,"
                            + " CASE WHEN ISNULL(p.ja,'N') IN (N'T',N'Y') THEN N'Y' ELSE N'N' END AS 结案"
                            + " FROM dbo.plang p WHERE p.pl_no=? AND p.id=? AND ISNULL(p.asp_cancel,'N')<>'Y'",
                    doc, rowId);
            if (!rr.isEmpty()) curRow = rr.get(0);
        }
        boolean byRow = curRow != null;
        String rowBatch = byRow ? String.valueOf(curRow.get("批次号")) : "";
        if (byRow) {
            // 头信息整段换成**本行**的(产品/规格/产线/数量/结案状态),再标注行号与批次 —— 别让界面
            // 拿整单聚合数去对一行的产出。
            for (String k : new String[]{"产品编码", "产品名称", "规格型号", "生产线", "批号", "结案"}) {
                head.put(k, curRow.get(k));
            }
            head.put("排产数量", curRow.get("排产数量"));
            head.put("需求数量", curRow.get("需求数量"));
            head.put("入库数量", curRow.get("入库数量"));
            head.put("余量", Num.of(curRow.get("需求数量")) - Num.of(curRow.get("排产数量")));
            head.put("单据状态", "Y".equals(String.valueOf(curRow.get("结案"))) ? "已结案"
                    : ("".equals(String.valueOf(curRow.get("生产线"))) ? "未排产" : "已排产"));
            head.put("工单行号", curRow.get("工单行号"));
            head.put("批次号", rowBatch);
            head.put("追溯口径", "按工单行");
        } else {
            head.put("工单行号", "");
            head.put("批次号", "");
            head.put("追溯口径", "整单");
        }
        // 本行的报工单号集合(检验段按它收敛;该行还没报工 ⇒ 空集 ⇒ 检验段正确返回"无产出")
        List<String> rowReps = List.of();
        if (byRow) {
            rowReps = jdbc.queryForList(
                    "SELECT [报工单号] FROM dbo.scjl WHERE gldh=? AND ISNULL(asp_cancel,'N')<>'Y'"
                            + " AND [报工单号] IS NOT NULL"
                            + " AND (gd_id IN (SELECT id FROM dbo.plang_pc WHERE plang_id=? AND ISNULL(asp_cancel,'N')<>'Y')"
                            + "      OR (ISNULL(gd_id,0)=0 AND ISNULL([批次号],N'')=?))",
                    String.class, doc, rowId, rowBatch);
        }
        // 报工段的行级谓词(gd_id 优先,历史空 gd_id 用批次兜底);不传行id 时为空串=整单口径
        String repRowCond = byRow
                ? " AND (s.gd_id IN (SELECT id FROM dbo.plang_pc WHERE plang_id=? AND ISNULL(asp_cancel,'N')<>'Y')"
                        + " OR (ISNULL(s.gd_id,0)=0 AND ISNULL(s.[批次号],N'')=?))"
                : "";

        // 流转时间线:创建(plang 系统戳) + 按钮留痕(排产/撤销/调线/结案…;面板名含 快速排产/生产工单 两代)
        List<Map<String, Object>> timeline = new ArrayList<>();
        if (!String.valueOf(head.get("创建人")).isBlank()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("步骤", "创建"); m.put("操作人", head.get("创建人")); m.put("时间", head.get("创建时间"));
            timeline.add(m);
        }
        jdbc.query("SELECT action_name, user_name, CONVERT(varchar(16), created_at, 120) AS at"
                        + " FROM yj_usage_log WHERE panel_name IN (N'快速排产', N'生产工单', N'生产加工单') AND doc_no=?"
                        + " AND action_name NOT IN (N'审核', N'结案') ORDER BY created_at",
                rs -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("步骤", rs.getString(1)); m.put("操作人", rs.getString(2)); m.put("时间", rs.getString(3));
                    timeline.add(m);
                }, doc);

        // 排产数据:plang_pc 各排产行(未排产为空)
        List<Map<String, Object>> sched = jdbc.queryForList(
                "SELECT pc.scx AS 生产线, ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.xq_sl,0) AS 需求数量,"
                        + " ISNULL(p.rk_sl,0) AS 入库数量, ISNULL(p.xq_sl,0) - ISNULL((SELECT SUM(l.linked_quantity) FROM form_flow_link l WHERE l.source_panel_code = 'SO_ORDER' AND l.source_form_no = p.od_no AND l.source_line_key = p.od_no + N'#' + CONVERT(nvarchar(20), CONVERT(int, p.od_xc)) AND l.link_status = 'ACTIVE'), 0) AS 余量,"
                        + " CONVERT(varchar(10), pc.st_date, 120) AS 计划开工日,"
                        + " CONVERT(varchar(10), pc.cp_date, 120) AS 工序交期,"
                        + " CASE WHEN ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0) THEN N'已结案'"
                        + "      WHEN ISNULL(p.[完工状态],N'') IN (N'生产完工', N'已完工') THEN N'完工' WHEN ISNULL(p.rk_sl,0) > 0 THEN N'在产' ELSE N'未完工' END AS 生产状态,"
                        + " ISNULL(pc.lb,N'') AS 排产班组, ISNULL(pc.pl_man,N'') AS 操作员,"
                        + " ISNULL(pc.[批次号],N'') AS 批次号"
                        + " FROM dbo.plang_pc pc"
                        + " JOIN dbo.plang p ON p.comm = pc.comm AND p.pl_no = pc.pl_no AND p.pl_xc = pc.pl_xc"
                        + "   AND pc.plang_id = p.id AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + " WHERE pc.pl_no=? AND ISNULL(pc.asp_cancel,'N')<>'Y' ORDER BY pc.pl_xc, pc.[批次号]", doc);

        // 完工数据:报工记录(scjl,参考库口径;按 工序 汇总:完成数量=Σsl,计划数量=排产冗余)
        // 2026-10-15:按行追溯时只统计**本行**的报工(gd_id=本行排产行id;历史空 gd_id 用本行批次兜底)。
        List<Map<String, Object>> done = byRow
                ? jdbc.queryForList(
                        "SELECT ISNULL(s.gxdm, N'') AS 工序, MAX(ISNULL(s.pl_sl,0)) AS 计划数量,"
                                + " SUM(ISNULL(s.sl,0)) AS 完成数量, MAX(s.asp_user1) AS 报工人,"
                                + " CONVERT(varchar(16), MAX(s.asp_time1), 120) AS 报工时间"
                                + " FROM dbo.scjl s WHERE s.gldh=? AND ISNULL(s.asp_cancel,'N')<>'Y'" + repRowCond
                                + " GROUP BY s.gxdm ORDER BY s.gxdm", doc, rowId, rowBatch)
                : jdbc.queryForList(
                        "SELECT ISNULL(s.gxdm, N'') AS 工序, MAX(ISNULL(s.pl_sl,0)) AS 计划数量,"
                                + " SUM(ISNULL(s.sl,0)) AS 完成数量, MAX(s.asp_user1) AS 报工人,"
                                + " CONVERT(varchar(16), MAX(s.asp_time1), 120) AS 报工时间"
                                + " FROM dbo.scjl s WHERE s.gldh=? AND ISNULL(s.asp_cancel,'N')<>'Y'"
                                + " GROUP BY s.gxdm ORDER BY s.gxdm", doc);
        // 入库单据(产成品入库单挂 加工单号)
        // 行级收敛(2026-10-15 步5,结构变更已随 migrate-finish-in-wo-line-20261015.sql 落地):
        //   带 rowId 时按「本行」取 —— 优先 [工单行号]=本行 pl_xc,**老单没有行号**(该列 2026-10-15 才加)
        //   时按 [批次号]=本行批次兜底;两者都空=历史未标注,归入整单口径(不猜、不回填)。
        List<Map<String, Object>> fins = byRow
                ? jdbc.queryForList(
                        "SELECT f.[单据编号], CONVERT(varchar(10), f.[单据日期], 120) AS 单据日期,"
                                + " ISNULL(f.[入库类别],N'') AS 入库类别, ISNULL(f.[经手人],N'') AS 经手人, ISNULL(f.[备注],N'') AS 备注,"
                                + " ISNULL(f.[批次号],N'') AS 批次号, f.[工单行号] AS 工单行号,"
                                + " CASE WHEN f.[工单行号] IS NOT NULL THEN N'按工单行'"
                                + "      WHEN ISNULL(f.[批次号],N'')<>N'' THEN N'按批次' ELSE N'历史未标注' END AS 收敛口径"
                                + " FROM bd_finish_in f WHERE f.[加工单号]=? AND ISNULL(f.asp_cancel,'N')<>'Y'"
                                + "   AND (f.[工单行号]=? OR (f.[工单行号] IS NULL AND ISNULL(f.[批次号],N'')=?"
                                + "        AND ISNULL(f.[批次号],N'')<>N''))"
                                + " ORDER BY f.[单据编号]", doc, curRow.get("工单行号"), rowBatch)
                : jdbc.queryForList(
                        "SELECT f.[单据编号], CONVERT(varchar(10), f.[单据日期], 120) AS 单据日期,"
                                + " ISNULL(f.[入库类别],N'') AS 入库类别, ISNULL(f.[经手人],N'') AS 经手人, ISNULL(f.[备注],N'') AS 备注,"
                                + " ISNULL(f.[批次号],N'') AS 批次号, f.[工单行号] AS 工单行号,"
                                + " CASE WHEN f.[工单行号] IS NOT NULL THEN N'按工单行'"
                                + "      WHEN ISNULL(f.[批次号],N'')<>N'' THEN N'按批次' ELSE N'历史未标注' END AS 收敛口径"
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

        // ══ 质检段(2026-10-14 用户口径「工单结束要能对上成品检验单」)══════════════════════════
        // 三类工序检验单:成型 CX / 切炭 QT / 组装成品 ZJ —— 报工**审核**时按工序自动生成
        // (ButtonService.woInspGenerate;混料/装箱按 9.29 会议口径不出单)。三表同构 ⇒ 换表名同段 SQL 全查。
        //  · 工单号是检验单头上唯一的工单维度键(头表暂无「工单行号」,分批报工会出多张,靠批次号/报工单号区分);
        //  · **单据状态必须走 yj_doc_status 推导**:这三张表的物理「单据状态」列实测全为 NULL(引擎不写),
        //    口径与面板列表 QueryService.docStatus 一致(canceled→stopped→pending→shr→草稿);
        //  · 合格/不合格数量按明细「判定」汇总(组装固定合格/不合格两行;成型/切炭现为通用模板,通常皆为 0);
        //  · 下游单号 = 该检验单审核后自动生成的下游(产成品入库单 FINISH_IN / 不良品处理单 QC_DISPOSAL)。
        List<Map<String, Object>> qc = new ArrayList<>();
        // 行级收敛(2026-10-15 用户口径「按工单号+工单行号」):检验单头上**只有「报工单号」**能反推到行
        // (头表没有工单行号列)⇒ 按"本行产生的报工单号集合"(rowReps,已按 gd_id/批次收敛)过滤。
        // 本行还没报工 ⇒ rowReps 空 ⇒ 不出任何检验单 —— 这是**正确**结果:这行还没有产出。
        String qcRowCond = "";
        List<Object> qcRowArgs = new ArrayList<>();
        if (byRow) {
            if (rowReps.isEmpty()) {
                qcRowCond = " AND 1=0";
            } else {
                StringBuilder ph = new StringBuilder();
                for (int i = 0; i < rowReps.size(); i++) ph.append(i == 0 ? "?" : ",?");
                qcRowCond = " AND h.报工单号 IN (" + ph + ")";
                qcRowArgs.addAll(rowReps);
            }
        }
        for (Map.Entry<String, String> e : INSP_HEAD.entrySet()) {
            String panel = e.getKey();
            String tbl = e.getValue();                       // 本类常量取值,无注入面
            List<Object> qcArgs = new ArrayList<>();
            qcArgs.add(panel); qcArgs.add(panel); qcArgs.add(doc);
            qcArgs.addAll(qcRowArgs);
            qc.addAll(jdbc.queryForList(
                    "SELECT h.单据编号 AS 检验单号, ISNULL(h.工序,N'') AS 工序,"
                            + " CONVERT(varchar(10), h.单据日期, 120) AS 检验日期,"
                            + " CASE WHEN ISNULL(s.canceled,'N')='Y' THEN N'已作废'"
                            + "      WHEN ISNULL(s.stopped,'N')='Y' THEN N'已中止'"
                            + "      WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中'"
                            + "      WHEN s.shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END AS 单据状态,"
                            + " ISNULL(h.总结论,N'') AS 总结论,"
                            + " ISNULL(h.报工数量,0) AS 送检数量, ISNULL(h.检验数量,0) AS 检验数量,"
                            + " ISNULL(d.合格数量,0) AS 合格数量, ISNULL(d.不合格数量,0) AS 不合格数量,"
                            + " ISNULL(h.检验员,N'') AS 检验员, ISNULL(h.批次号,N'') AS 批次号,"
                            + " ISNULL(h.报工单号,N'') AS 报工单号, ISNULL(h.处理方式,N'') AS 处理方式,"
                            + " ISNULL((SELECT TOP 1 l.target_form_no FROM dbo.form_flow_link l"
                            + "          WHERE l.source_panel_code=? AND l.source_form_no=h.单据编号"
                            + "            AND l.link_status='ACTIVE' ORDER BY l.id), N'') AS 下游单号"
                            + " FROM dbo." + tbl + " h"
                            + " LEFT JOIN dbo.yj_doc_status s ON s.panel_code=? AND s.doc_no=h.单据编号"
                            + " LEFT JOIN (SELECT 单据编号,"
                            + "      SUM(CASE WHEN 判定=N'合格' THEN ISNULL(数量,0) ELSE 0 END) AS 合格数量,"
                            + "      SUM(CASE WHEN 判定=N'不合格' THEN ISNULL(数量,0) ELSE 0 END) AS 不合格数量"
                            + "    FROM dbo." + tbl.replace("_head", "_detail")
                            + "   WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 单据编号) d"
                            + "   ON d.单据编号 = h.单据编号"
                            + " WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND h.工单号=?" + qcRowCond,
                    qcArgs.toArray()));
        }
        qc.sort((a, b) -> String.valueOf(a.get("检验单号")).compareTo(String.valueOf(b.get("检验单号"))));
        // 汇总(「对上」用):应检 = 成型/切炭/组装(与出单口径同源);已检 = 存活检验单上出现的工序;
        // 缺检 = 应检 − 已检;结论按"有不合格 > 缺检 > 全合格 > 未判定"优先级给一句话。
        LinkedHashSet<String> doneOps = new LinkedHashSet<>();
        double passQty = 0, ngQty = 0, inspQty = 0;
        int auditedCnt = 0;
        for (Map<String, Object> m : qc) {
            String op = String.valueOf(m.get("工序")).trim();
            if (!op.isEmpty()) doneOps.add(op);
            passQty += Num.of(m.get("合格数量"));
            ngQty += Num.of(m.get("不合格数量"));
            inspQty += Num.of(m.get("检验数量"));
            if ("已审核".equals(String.valueOf(m.get("单据状态")))) auditedCnt++;
        }
        List<String> missOps = new ArrayList<>();
        for (String op : INSP_OPS) if (!doneOps.contains(op)) missOps.add(op);
        Map<String, Object> qcSum = new LinkedHashMap<>();
        qcSum.put("应检工序", INSP_OPS);
        qcSum.put("已检工序", new ArrayList<>(doneOps));
        qcSum.put("缺检工序", missOps);
        qcSum.put("检验单数", qc.size());
        qcSum.put("已审核数", auditedCnt);
        qcSum.put("检验数量合计", Math.round(inspQty * 10000d) / 10000d);
        qcSum.put("合格数量合计", Math.round(passQty * 10000d) / 10000d);
        qcSum.put("不合格数量合计", Math.round(ngQty * 10000d) / 10000d);
        qcSum.put("结论", ngQty > 0 ? "存在不合格"
                : (!missOps.isEmpty() ? "缺检" : (passQty > 0 ? "全部合格" : "未判定")));

        // 父子工单(切单,9.29 批次① 2026-10-05):本单切出的子单 + 本单的来源父单 —— 追溯「同一产品」
        // 行级收敛(2026-10-15 步3):**本行**切出的子单(plang.源工单行id = 本行 id),不是整单切出的全部;
        //   老数据没有 源工单行id 时(只有 源工单号)退回按工单号 —— 不猜行,如实回落到整单口径。
        List<Map<String, Object>> children = byRow
                ? jdbc.queryForList(
                        "SELECT pl_no AS 工单号, pl_xc AS 工单行号, ISNULL([批次号],N'') AS 批次号,"
                                + " ISNULL(pl_sl,0) AS 排产数量, [拆分序号] AS 拆分序号,"
                                + " CASE WHEN ISNULL(ja,'N') IN (N'T',N'Y') THEN N'已结案' ELSE N'在产' END AS 状态"
                                + " FROM dbo.plang WHERE [源工单号]=? AND ISNULL(asp_cancel,'N')<>'Y'"
                                + "   AND ([源工单行id]=? OR [源工单行id] IS NULL)"
                                + " ORDER BY ISNULL([拆分序号],0), pl_no", doc, rowId)
                : jdbc.queryForList(
                        "SELECT pl_no AS 工单号, pl_xc AS 工单行号, ISNULL([批次号],N'') AS 批次号,"
                                + " ISNULL(pl_sl,0) AS 排产数量, [拆分序号] AS 拆分序号,"
                                + " CASE WHEN ISNULL(ja,'N') IN (N'T',N'Y') THEN N'已结案' ELSE N'在产' END AS 状态"
                                + " FROM dbo.plang WHERE [源工单号]=? AND ISNULL(asp_cancel,'N')<>'Y'"
                                + " ORDER BY ISNULL([拆分序号],0), pl_no", doc);
        // 父单:按行追溯时**必须**是本行的源工单行(源工单行id = 本行 id);不带行id 才退回"本单首个父单"
        List<Map<String, Object>> parentsOf = byRow
                ? jdbc.queryForList(
                        "SELECT p.pl_no AS 工单号, p.pl_xc AS 工单行号, ISNULL(p.pl_sl,0) AS 排产数量,"
                                + " p.id AS 工单行id, c.[拆分序号] AS 拆分序号"
                                + " FROM dbo.plang c JOIN dbo.plang p ON p.id = c.[源工单行id] AND ISNULL(p.asp_cancel,'N')<>'Y'"
                                + " WHERE c.pl_no=? AND c.id=? AND ISNULL(c.asp_cancel,'N')<>'Y'", doc, rowId)
                : jdbc.queryForList(
                        "SELECT TOP 1 p.pl_no AS 工单号, p.pl_xc AS 工单行号, ISNULL(p.pl_sl,0) AS 排产数量,"
                                + " p.id AS 工单行id, c.[拆分序号] AS 拆分序号"
                                + " FROM dbo.plang c JOIN dbo.plang p ON p.id = c.[源工单行id] AND ISNULL(p.asp_cancel,'N')<>'Y'"
                                + " WHERE c.pl_no=? AND ISNULL(c.asp_cancel,'N')<>'Y' ORDER BY c.id", doc);
        // 调拨轨迹(9.29 批次②):每次调拨一行,撤销的也留痕(状态列区分)
        // 行级收敛(2026-10-15 步1,零改表):带 rowId 时按 wo_transfer_log.plang_id(行级键,**已有**)过滤;
        //   老记录 plang_id 为空(id=2 那条)只能在**整单口径**显示 —— 不猜、不回填(用户口径)。
        List<Map<String, Object>> transfers = byRow
                ? jdbc.queryForList(
                        "SELECT CONVERT(varchar(16), asp_time1, 120) AS 时间, ISNULL(从生产线,N'') AS 从生产线,"
                                + " ISNULL(从车间,N'') AS 从车间, ISNULL(到生产线,N'') AS 到生产线, ISNULL(到车间,N'') AS 到车间,"
                                + " ISNULL(数量,0) AS 数量, ISNULL(原因,N'') AS 原因, ISNULL(asp_user1,N'') AS 操作人,"
                                + " CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN N'已撤销' ELSE N'生效' END AS 状态,"
                                + " CONVERT(varchar(16), asp_time2, 120) AS 撤销时间, ISNULL(asp_user2,N'') AS 撤销人,"
                                + " ISNULL(plang_id,0) AS 工单行id"
                                + " FROM dbo.wo_transfer_log WHERE pl_no=? AND plang_id=? ORDER BY id", doc, rowId)
                : jdbc.queryForList(
                        "SELECT CONVERT(varchar(16), asp_time1, 120) AS 时间, ISNULL(从生产线,N'') AS 从生产线,"
                                + " ISNULL(从车间,N'') AS 从车间, ISNULL(到生产线,N'') AS 到生产线, ISNULL(到车间,N'') AS 到车间,"
                                + " ISNULL(数量,0) AS 数量, ISNULL(原因,N'') AS 原因, ISNULL(asp_user1,N'') AS 操作人,"
                                + " CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN N'已撤销' ELSE N'生效' END AS 状态,"
                                + " CONVERT(varchar(16), asp_time2, 120) AS 撤销时间, ISNULL(asp_user2,N'') AS 撤销人,"
                                + " ISNULL(plang_id,0) AS 工单行id"
                                + " FROM dbo.wo_transfer_log WHERE pl_no=? ORDER BY id", doc);

        // 家族(切单血缘,9.29 批次① 会议口径:多级切分一律按根单聚合)。
        // ⚠ 聚合单元=**工单行**(plang.id):同一 pl_no 可有多行(多订单行/多批次),按单号聚合会把整单
        //   无关行也算进来(实测 MO-2026-09-0136 有 8 行 → Σ计划 虚高)。故按 行id 走精确血缘:
        //   先沿 源工单行id 上溯到根行,再从根行下溯全部子孙(递归 CTE)。
        // 🔴 2026-10-15 步3 修:**原 CTE 只下溯、根本没上溯** —— 传进来的若是子行/孙行(实测
        //   MO-2026-09-0137-1-1 的 id=102,父=101,祖父=91),家族清单就只剩它自己一行,根工单号
        //   也跟着错成它自己。现按注释里的口径真做两段:up 上溯到根 → fam 从根下溯全部子孙。
        Long famRowId = rowId == null ? null : rowId;
        if (famRowId == null) {
            List<Map<String, Object>> first = jdbc.queryForList(
                    "SELECT TOP 1 id FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id", doc);
            if (!first.isEmpty()) famRowId = ((Number) first.get(0).get("id")).longValue();
        }
        List<Map<String, Object>> family = famRowId == null ? List.of() : jdbc.queryForList(
                "WITH up AS ("
                        + "  SELECT p.id, p.[源工单行id] FROM dbo.plang p WHERE p.id=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + "  UNION ALL"
                        + "  SELECT p.id, p.[源工单行id] FROM dbo.plang p JOIN up u ON p.id = u.[源工单行id]"
                        + "    WHERE ISNULL(p.asp_cancel,'N')<>'Y'),"
                        + " root AS (SELECT TOP 1 id FROM up WHERE [源工单行id] IS NULL ORDER BY id),"
                        + " fam AS ("
                        + "  SELECT p.* FROM dbo.plang p WHERE p.id IN (SELECT id FROM root)"
                        + "  UNION ALL"
                        + "  SELECT p.* FROM dbo.plang p JOIN fam f ON p.[源工单行id] = f.id WHERE ISNULL(p.asp_cancel,'N')<>'Y')"
                        + " SELECT pl_no AS 工单号, pl_xc AS 工单行号, ISNULL([批次号],N'') AS 批次号,"
                        + "   ISNULL([是否切单],N'N') AS 是否切单, [拆分序号] AS 拆分序号,"
                        + "   ISNULL([源工单号],N'') AS 源工单号, ISNULL([根工单号],N'') AS 根工单号,"
                        + "   ISNULL(pl_sl,0) AS 计划数量, ISNULL(rk_sl,0) AS 入库数量, ISNULL(scx,N'') AS 生产线,"
                        + "   CASE WHEN ISNULL(ja,'N') IN (N'T',N'Y') THEN N'已结案' ELSE N'在产' END AS 状态"
                        + " FROM fam ORDER BY ISNULL([是否切单],N'N'), pl_no, pl_xc", famRowId);
        String rootNo = family.isEmpty() ? doc : String.valueOf(
                family.stream().filter(x -> "N".equals(String.valueOf(x.get("是否切单")))).findFirst()
                        .map(x -> x.get("工单号")).orElse(doc));
        Map<String, Object> famSum = new LinkedHashMap<>();
        famSum.put("根工单号", rootNo);
        famSum.put("张数", family.size());
        famSum.put("计划数量合计", Math.round(family.stream().mapToDouble(x -> Num.of(x.get("计划数量"))).sum() * 10000d) / 10000d);
        famSum.put("入库数量合计", Math.round(family.stream().mapToDouble(x -> Num.of(x.get("入库数量"))).sum() * 10000d) / 10000d);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("头", head);
        out.put("时间线", timeline);
        out.put("排产数据", sched);
        out.put("完工数据", done);
        out.put("入库单据", fins);
        out.put("质检数据", qc);
        out.put("质检汇总", qcSum);
        out.put("领料数据", picks);
        out.put("子工单", children);
        out.put("父工单", parentsOf);
        out.put("调拨轨迹", transfers);
        out.put("家族汇总", famSum);
        out.put("家族清单", family);
        // 口径说明(2026-10-15):让前端/用户一眼知道**哪几段是按行、哪几段仍是整单**,避免再次误会。
        out.put("口径说明", byRow
                ? "按工单行(行号 " + head.get("工单行号") + " / 批次 " + rowBatch + "):"
                        + "报工段、检验段、工序进度、入库段、调拨轨迹、父子/家族血缘已收敛到本行"
                        + "(报工按 scjl.gd_id → 本行排产行,历史空 gd_id 用本行批次兜底;"
                        + "检验单头没有工单行号列,按本行产生的报工单号收敛;"
                        + "入库单按 工单行号=本行行号 收敛,2026-10-15 前的老单无行号则按本行批次兜底、两者都空标「历史未标注」)。"
                        + "**领料数据仍是整单口径**:bl_material_out 的 加工单号 实测为空、批号是 ERP 批号口径"
                        + "(≠生产批次号)、源单行号空 ⇒ 无行键、无可靠映射,无法按行收敛。"
                        + "排产数据=该工单全部排产行(便于对照整单);流转时间线天生是工单级(yj_usage_log 只记单号)。"
                : "整单口径(未指定工单行):各段按工单号汇总。");
        // 每段口径(前端按段显示「按工单行」/「整单」小胶囊,2026-10-15 步2)
        Map<String, Object> segScope = new LinkedHashMap<>();
        String rowScope = byRow ? "按工单行" : "整单";
        segScope.put("工序进度", rowScope);
        segScope.put("流转时间线", "整单");
        segScope.put("调拨轨迹", rowScope);
        segScope.put("排产数据", byRow ? "按工单行(本行)" : "整单");
        segScope.put("完工数据", rowScope);
        segScope.put("入库单据", rowScope);
        segScope.put("质检数据", rowScope);
        segScope.put("领料数据", "整单");
        segScope.put("血缘", rowScope);
        segScope.put("家族清单", rowScope);
        out.put("分段口径", segScope);
        return out;
    }

    /**
     * 打印生产任务单留痕(2026-10-15 改按「工单号 + 工单行号」落 plang):
     * <p>⚠ 原实现 UPDATE {@code bd_manu_order}(bd 系工单表)—— 2026-09-27「plang 单轨」后
     * 生产工单已全部走参考库 {@code plang},该表实测只剩 13 行历史 MO 单 ⇒ **打印次数/打印人/打印时间
     * 从来没落到界面上显示的这些工单上**(留痕静默丢失)。现与生产工单列表页同一落点与同一行键
     * (comm + pl_no + pl_xc + 批次号;见 {@code WorkOrderListController.printStamp})。
     */
    @Transactional
    public Map<String, Object> printStamp(List<Map<String, Object>> rows, String user) {
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("请先勾选要打印的加工单");
        List<String> done = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String no = str(r.get("加工单号"));
            if (no == null) no = str(r.get("工单号"));
            if (no == null) continue;
            Object rid = r.get("行id");
            Long rowId = rid instanceof Number n ? n.longValue() : null;
            if (rowId == null && rid != null && !String.valueOf(rid).isBlank()) {
                try { rowId = Long.valueOf(String.valueOf(rid).trim()); } catch (NumberFormatException ignore) { }
            }
            String comm = str(r.get("公司代码"));
            String batch = str(r.get("批次号"));
            Integer xc = null;
            Object x = r.get("工单行号");
            if (x instanceof Number n) xc = n.intValue();
            else if (x != null && !String.valueOf(x).isBlank()) {
                try { xc = Integer.valueOf(String.valueOf(x).trim()); } catch (NumberFormatException ignore) { }
            }
            // 行键优先级:行id(plang.id,唯一) > comm+单号+行号+批次号(列表页同口径)
            int n = rowId != null
                    ? jdbc.update("UPDATE dbo.plang SET asp_print = ISNULL(asp_print,0) + 1,"
                            + " [打印人]=?, [打印时间]=SYSDATETIME()"
                            + " WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", user, rowId)
                    : jdbc.update("UPDATE dbo.plang SET asp_print = ISNULL(asp_print,0) + 1,"
                            + " [打印人]=?, [打印时间]=SYSDATETIME()"
                            + " WHERE pl_no=? AND (? IS NULL OR pl_xc=?)"
                            + " AND ((? = N'' AND [批次号] IS NULL) OR [批次号] = ?)"
                            + " AND (? = N'' OR comm=?) AND ISNULL(asp_cancel,'N')<>'Y'",
                    user, no, xc, xc, batch == null ? "" : batch, batch == null ? "" : batch,
                    comm == null ? "" : comm, comm);
            if (n > 0) done.add(no + (xc == null ? "" : " 行" + xc));
        }
        if (done.isEmpty()) throw new IllegalStateException("无可打印的工单(plang 中未找到)");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("打印张数", done.size());
        out.put("单号清单", done);
        return out;
    }

    /**
     * 批量调线(2026-09-27 切 plang_pc×plang;2026-10-15 改按**工单行**):
     *  勾选已排工单 → 调到目标生产线;同步改 plang_pc.scx(排产表)与 plang.scx(工单主表);
     *  作废/结案拒绝,停用线拒绝;留痕。
     * <p>⚠ 原实现按 {@code pc.pl_no=?} **整单**改线 —— 同工单号多行会被一起搬走(与
     *  「能按行的都按行;同工单号不同行除同源销售订单外无任何关联」的用户口径冲突)。
     *  现:带 {@code 行id} 只动那一行;不带(旧调用)退回整单,保持兼容。
     */
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
            if (no == null) no = str(r.get("工单号"));
            if (no == null) continue;
            Object rid = r.get("行id");
            Long rowId = rid instanceof Number n ? n.longValue() : null;
            if (rowId == null && rid != null && !String.valueOf(rid).isBlank()) {
                try { rowId = Long.valueOf(String.valueOf(rid).trim()); } catch (NumberFormatException ignore) { }
            }
            final Long row = rowId;
            try {
                // 结案守卫也按行:带行id 时只看该行(同工单另一行已结案不该挡住这一行)
                Integer closed = row == null
                        ? jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.plang p WHERE p.pl_no=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                                        + " AND ISNULL(p.ja,'N') IN ('T','Y')", Integer.class, no)
                        : jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.plang p WHERE p.id=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                                        + " AND ISNULL(p.ja,'N') IN ('T','Y')", Integer.class, row);
                if (closed != null && closed > 0) throw new IllegalStateException("已结案,不能调线");
                int n = row == null
                        ? jdbc.update("UPDATE pc SET pc.scx=?, pc.asp_user2=?, pc.asp_time2=GETDATE()"
                                        + " FROM dbo.plang_pc pc WHERE pc.pl_no=? AND ISNULL(pc.asp_cancel,'N')<>'Y'",
                                toLine, user, no)
                        : jdbc.update("UPDATE pc SET pc.scx=?, pc.asp_user2=?, pc.asp_time2=GETDATE()"
                                        + " FROM dbo.plang_pc pc WHERE pc.plang_id=? AND ISNULL(pc.asp_cancel,'N')<>'Y'",
                                toLine, user, row);
                if (n == 0) throw new IllegalStateException("该单未排产(排产表无记录)");
                if (row == null) {
                    jdbc.update("UPDATE dbo.plang SET scx=?, asp_user2=?, asp_time2=GETDATE()"
                                    + " WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(scx,N'')<>N''", toLine, user, no);
                } else {
                    jdbc.update("UPDATE dbo.plang SET scx=?, asp_user2=?, asp_time2=GETDATE()"
                                    + " WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", toLine, user, row);
                }
                // 预排台账同步:把**当前已落实**那道的实际线改成新线(否则台账与实际分叉;计划线不动);
                // 按行调线时只动该行台账(工单行id IS NULL 的老台账属整单,一并跟随,与撤销排产同口径)
                jdbc.update("UPDATE dbo.wo_process_line SET 实际生产线=?, asp_user2=?, asp_time2=GETDATE()"
                        + " WHERE 工单号=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(状态,N'')=N'已落实'"
                        + "   AND (? IS NULL OR 工单行id=? OR 工单行id IS NULL)", toLine, user, no, row, row);
                logUsage(user, "批量调线", row == null ? no : no + "#" + row);
                done.add(row == null ? no : no + " 行" + row);
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
