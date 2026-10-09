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
                "SELECT COUNT(DISTINCT p.pl_no) AS cnt, ISNULL(SUM(p.pl_sl),0) AS qty"
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
        //   当前工序 = 预排台账里最后一道「已落实」(转到切炭线后就显示切炭);缺台账回落报工派生值 wpp.当前工序
        //   ⚠ 原来直接用 wpp(最后一道**有报工**的工序)⇒ 到了切炭线还显示成型的量(用户报障)
        //   ⚠ 不跨 CROSS APPLY 引用别名(T-SQL 实测「Invalid column name」)⇒ 拼成局部变量复用
        final String curOp = "ISNULL(NULLIF((SELECT TOP 1 w.工序 FROM dbo.wo_process_line w"
                + " WHERE w.工单号 = p.pl_no AND ISNULL(w.asp_cancel,'N')<>'Y'"
                + "   AND (w.工单行id = p.id OR w.工单行id IS NULL) AND ISNULL(w.状态,N'')=N'已落实'"
                + " ORDER BY ISNULL(w.工序序,999) DESC, w.id DESC), N''), ISNULL(wpp.当前工序,N''))";
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
                "SELECT pc.pl_no AS 加工单号, pc.pl_xc AS 工单行号, ISNULL(p.comm,N'') AS 公司代码, ISNULL(dk.mc, p.khdm) AS 客户,"
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
                        + " LEFT JOIN dbo.v_wo_process_progress wpp ON wpp.单号 = p.pl_no"                        + " CROSS APPLY (SELECT CASE WHEN ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0)"
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
     * (plang 工单的入库/领料回写链未接通前为空)。质量段暂缺。
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
        List<Map<String, Object>> done = jdbc.queryForList(
                "SELECT ISNULL(s.gxdm, N'') AS 工序, MAX(ISNULL(s.pl_sl,0)) AS 计划数量,"
                        + " SUM(ISNULL(s.sl,0)) AS 完成数量, MAX(s.asp_user1) AS 报工人,"
                        + " CONVERT(varchar(16), MAX(s.asp_time1), 120) AS 报工时间"
                        + " FROM dbo.scjl s WHERE s.gldh=? AND ISNULL(s.asp_cancel,'N')<>'Y'"
                        + " GROUP BY s.gxdm ORDER BY s.gxdm", doc);
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

        // 父子工单(切单,9.29 批次① 2026-10-05):本单切出的子单 + 本单的来源父单 —— 追溯「同一产品」
        List<Map<String, Object>> children = jdbc.queryForList(
                "SELECT pl_no AS 工单号, pl_xc AS 工单行号, ISNULL([批次号],N'') AS 批次号,"
                        + " ISNULL(pl_sl,0) AS 排产数量, [拆分序号] AS 拆分序号,"
                        + " CASE WHEN ISNULL(ja,'N') IN (N'T',N'Y') THEN N'已结案' ELSE N'在产' END AS 状态"
                        + " FROM dbo.plang WHERE [源工单号]=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + " ORDER BY ISNULL([拆分序号],0), pl_no", doc);
        List<Map<String, Object>> parentsOf = jdbc.queryForList(
                "SELECT TOP 1 p.pl_no AS 工单号, p.pl_xc AS 工单行号, ISNULL(p.pl_sl,0) AS 排产数量,"
                        + " c.[拆分序号] AS 拆分序号"
                        + " FROM dbo.plang c JOIN dbo.plang p ON p.id = c.[源工单行id] AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + " WHERE c.pl_no=? AND ISNULL(c.asp_cancel,'N')<>'Y' ORDER BY c.id", doc);
        // 调拨轨迹(9.29 批次②):每次调拨一行,撤销的也留痕(状态列区分)
        List<Map<String, Object>> transfers = jdbc.queryForList(
                "SELECT CONVERT(varchar(16), asp_time1, 120) AS 时间, ISNULL(从生产线,N'') AS 从生产线,"
                        + " ISNULL(从车间,N'') AS 从车间, ISNULL(到生产线,N'') AS 到生产线, ISNULL(到车间,N'') AS 到车间,"
                        + " ISNULL(数量,0) AS 数量, ISNULL(原因,N'') AS 原因, ISNULL(asp_user1,N'') AS 操作人,"
                        + " CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN N'已撤销' ELSE N'生效' END AS 状态,"
                        + " CONVERT(varchar(16), asp_time2, 120) AS 撤销时间, ISNULL(asp_user2,N'') AS 撤销人"
                        + " FROM dbo.wo_transfer_log WHERE pl_no=? ORDER BY id", doc);

        // 家族(切单血缘,9.29 批次① 会议口径:多级切分一律按根单聚合)。
        // ⚠ 聚合单元=**工单行**(plang.id):同一 pl_no 可有多行(多订单行/多批次),按单号聚合会把整单
        //   无关行也算进来(实测 MO-2026-09-0136 有 8 行 → Σ计划 虚高)。故按 行id 走精确血缘:
        //   先沿 源工单行id 上溯到根行,再从根行下溯全部子孙(递归 CTE)。
        Long famRowId = rowId == null ? null : rowId;
        if (famRowId == null) {
            List<Map<String, Object>> first = jdbc.queryForList(
                    "SELECT TOP 1 id FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id", doc);
            if (!first.isEmpty()) famRowId = ((Number) first.get(0).get("id")).longValue();
        }
        List<Map<String, Object>> family = famRowId == null ? List.of() : jdbc.queryForList(
                "WITH fam AS ("
                        + "  SELECT p.* FROM dbo.plang p WHERE p.id=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
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
        out.put("领料数据", picks);
        out.put("子工单", children);
        out.put("父工单", parentsOf);
        out.put("调拨轨迹", transfers);
        out.put("家族汇总", famSum);
        out.put("家族清单", family);
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

    /** 批量调线(2026-09-27 切 plang_pc×plang):勾选已排工单 → 调到目标生产线;
     *  同步改 plang_pc.scx(排产表)与 plang.scx(工单主表);作废/结案拒绝,停用线拒绝;留痕。 */
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
                Integer closed = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM dbo.plang p WHERE p.pl_no=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                                + " AND ISNULL(p.ja,'N') IN ('T','Y')", Integer.class, no);
                if (closed != null && closed > 0) throw new IllegalStateException("已结案,不能调线");
                int n = jdbc.update("UPDATE pc SET pc.scx=?, pc.asp_user2=?, pc.asp_time2=GETDATE()"
                                + " FROM dbo.plang_pc pc WHERE pc.pl_no=? AND ISNULL(pc.asp_cancel,'N')<>'Y'",
                        toLine, user, no);
                if (n == 0) throw new IllegalStateException("该单未排产(排产表无记录)");
                jdbc.update("UPDATE dbo.plang SET scx=?, asp_user2=?, asp_time2=GETDATE()"
                                + " WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(scx,N'')<>N''", toLine, user, no);
                // 预排台账同步:把**当前已落实**那道的实际线改成新线(否则台账与实际分叉;计划线不动)
                jdbc.update("UPDATE dbo.wo_process_line SET 实际生产线=?, asp_user2=?, asp_time2=GETDATE()"
                        + " WHERE 工单号=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(状态,N'')=N'已落实'", toLine, user, no);
                logUsage(user, "批量调线", no);
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
