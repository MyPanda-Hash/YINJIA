package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工单切单(9.29 生产管理批次 ①,2026-10-05):在产工单按数量切出子工单,父单同步核减,父子可追溯、**可撤回**。
 *
 * <p><b>会议口径</b>:「选中在产工单 → 切单 → 输入切出数量 → 生成子工单(复制原单产品/工艺/交期),
 * 原单数量同步核减;子工单可再打印、进入正常报工流转」。
 *
 * <p><b>四个关键设计</b>(都是为了让验收「两单可分别报工、可打印、可追溯到同一产品」成立):
 * <ol>
 *   <li><b>子单取新工单号</b>:报工的工序封顶按 {@code SUM(pl_sl) WHERE pl_no} 计算
 *       ({@link WoReportService#complete}),同工单号做不到「两单分别报工」;新号同时让结案/打印/
 *       入库/追溯天然分离。</li>
 *   <li><b>父子关联</b>=plang 三列(源工单号 / 源工单行id / 拆分序号,见
 *       {@code tools/migrate-plang-split-cols.sql});{@code 源工单行id} 精确指向父行 plang.id
 *       —— 同一 pl_no 可有多行(多批次/多订单行),光靠单号还原不回父行。</li>
 *   <li><b>占用链守恒</b>:SO_ORDER→PLANG 的 {@code form_flow_link} 按行拆账(父行 linked_quantity
 *       减切出量、子行新增同量),来源订单行的「剩余可转」总量不变 —— 所以订单结转页不会因为切单
 *       凭空多出/少掉可转量。找不到父行占用(历史数据)时跳过,不阻断切单。</li>
 *   <li><b>可切上限</b>=排产数量 − max(已入库数量, 各工序已完工报工量的最大值):已入库/已完工的部分
 *       不能切走(切走会让父单封顶低于已记产量,后续报工被封、账实不符)。</li>
 * </ol>
 *
 * <p><b>撤回(unsplit)</b>:子单无任何下游(无报工行 / 无入库 / 无领料 / 未结案 / 未被再切分)时,
 * 软删子单 + 父单数量还原 + 占用链回冲 + 双向留痕;有下游则拒绝并指出是哪张单据挡住的。
 */
@Service
public class WorkOrderSplitService {

    /** 生产工单面板编码(权限与留痕用) */
    private static final String PANEL = "MANU_ORDER";
    private static final String LOG_PANEL = "生产工单";

    private final JdbcTemplate jdbc;
    private final FormNoService formNo;

    public WorkOrderSplitService(JdbcTemplate jdbc, FormNoService formNo) {
        this.jdbc = jdbc;
        this.formNo = formNo;
    }

    // ────────────────────────── 预览(前端弹窗:可切上限) ──────────────────────────

    /** 父行 + 已完工/已入库 + 可切上限;前端切单弹窗据此限制输入范围。 */
    public Map<String, Object> preview(Map<String, Object> req) {
        Map<String, Object> p = loadParent(req);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("行id", p.get("id"));
        out.put("工单号", p.get("pl_no"));
        out.put("工单行号", p.get("pl_xc"));
        out.put("批次号", p.get("批次号"));
        out.put("产品编码", p.get("dm"));
        out.put("产品名称", p.get("mc"));
        out.put("规格型号", p.get("gg"));
        out.put("生产线", p.get("scx"));
        out.put("排产数量", round(num(p.get("pl_sl"))));
        out.put("需求数量", round(num(p.get("xq_sl"))));
        out.put("入库数量", round(num(p.get("rk_sl"))));
        out.put("已完工报工", round(maxCompleted(String.valueOf(p.get("pl_no")))));
        out.put("已切出数量", round(sumChildren(((Number) p.get("id")).longValue())));
        out.put("可切上限", round(cutLimit(p)));
        // 血缘与家族(会议口径:多级切分一律按根单聚合 —— 计划员看整体进度用)
        String root = familyRoot(p);
        out.put("是否切单", "Y".equals(String.valueOf(p.get("是否切单"))) ? "Y" : "N");
        out.put("根工单号", root);
        out.put("家族汇总", familySummary(root));
        out.put("父单交期", p.get("交期"));
        return out;
    }

    // ────────────────────────── 切单 ──────────────────────────

    /** 切单:父单核减 + 子单新建(+ 可选继承排产)+ 占用链拆账 + 留痕。 */
    @Transactional
    public Map<String, Object> split(Map<String, Object> req, String user) {
        Map<String, Object> p = loadParent(req);
        long parentId = ((Number) p.get("id")).longValue();
        String parentNo = String.valueOf(p.get("pl_no"));
        int parentXc = ((Number) p.get("pl_xc")).intValue();
        String batch = str(p.get("批次号"));

        if ("T".equals(String.valueOf(p.get("ja"))) || "Y".equals(String.valueOf(p.get("ja"))))
            throw new IllegalStateException("工单 " + parentNo + " 已结案,不能切单;如需调整请先取消结案");

        double qty = num(req.get("切出数量"));
        if (qty <= 0.0001) throw new IllegalStateException("切出数量必须大于 0");
        double limit = cutLimit(p);
        if (limit <= 0.0001)
            throw new IllegalStateException("工单 " + parentNo + " 没有可切出的数量(排产 " + round(num(p.get("pl_sl")))
                    + " − 已入库 " + round(num(p.get("rk_sl"))) + " / 已完工报工 "
                    + round(maxCompleted(parentNo)) + ")");
        if (qty > limit + 0.0001)
            throw new IllegalStateException("切出数量 " + round(qty) + " 超过可切上限 " + round(limit)
                    + "(排产 " + round(num(p.get("pl_sl"))) + " − 已入库 " + round(num(p.get("rk_sl")))
                    + " / 已完工报工 " + round(maxCompleted(parentNo)) + ")");
        qty = round(qty);

        // 继承排产:勾选则子单直接落在父单同一条产线/班组/交期(会议「复制原单产品、工艺、交期」)
        boolean inherit = !"false".equalsIgnoreCase(String.valueOf(req.getOrDefault("继承排产", Boolean.TRUE)));
        String scx = inherit ? str(p.get("scx")) : null;
        String plMan = inherit ? str(p.get("pl_man")) : null;
        String lb = inherit ? str(p.get("lb")) : null;

        int seq = nextSplitSeq(parentId, parentNo);
        // 子单号规则(会议口径「现场一眼看出同源」)= 原工单号-序号;不再占用 MO 号池
        String childNo = parentNo + "-" + seq;
        // 血缘根:父单本身是子单则继承其根,否则父单自己就是根(多级切分按根聚合)
        String root = familyRoot(p);
        // 子单交期/备注(会议:可修改子单交期 + 备注 急单/分波)
        String dueDate = str(req.get("子单交期"));
        String remark = str(req.get("备注"));

        // ① 父单核减(**需求数量也要减**,2026-10-05 用户口径「切单之后需求数量应该会改变才对」;
        //   此前只减了排产数量 ⇒ 生产工单列表的「需求数量」不变、子单又各带一份 → 家族需求被重复计。
        //   余量口径保持 需求−排产 不变:yl = (旧需求−切出) − 新排产)
        double newParentSl = round(num(p.get("pl_sl")) - qty);
        jdbc.update("UPDATE dbo.plang SET pl_sl=?, xq_sl=ISNULL(xq_sl,0)-?,"
                        + " yl=ISNULL(xq_sl,0)-?-?, asp_user2=?, asp_time2=GETDATE() WHERE id=?",
                newParentSl, qty, qty, newParentSl, user, parentId);

        // ② 子单新建:复制产品/规格/单位/价格/交期/批次/来源订单;领料·入库单号不带(那是父单回执)
        int ins = jdbc.update(
                "INSERT INTO dbo.plang (comm, pl_no, pl_xc, pl_date, scx, pl_man, khdm, dm, mc, gg, gg2, jldw,"
                        + " pl_sl, xq_sl, rk_sl, yl, dj, jine, cp_date, st_date, cp_date2, bz, ja,"
                        + " od_no, od_xc, lot_no, color, siz, lb, mjlx, ll_no, wb_no, ypl_sl, ll_no2, remark,"
                        + " llxz, cgrkdh, lldh, djlx, zl, [批次号], [源工单号], [源工单行id], [拆分序号],"
                        + " [根工单号], [是否切单], [工艺路线],"
                        + " asp_cancel, asp_user1, asp_time1)"
                        + " SELECT comm, ?, 1, GETDATE(), ?, ?, khdm, dm, mc, gg, gg2, jldw,"
                        + "   ?, ?, 0, 0, dj, jine,"
                        + "   COALESCE(?, cp_date), st_date, cp_date2,"          // 交期可改,默认继承父单
                        + "   COALESCE(?, bz), N'N',"                           // 备注可填(急单/分波),默认继承
                        + "   od_no, od_xc, lot_no, color, siz, ?, mjlx, NULL, NULL, ypl_sl, NULL, remark,"
                        + "   llxz, cgrkdh, lldh, djlx, zl, [批次号], ?, ?, ?,"
                        + "   ?, N'Y',"
                        + "   N'N', ?, GETDATE(), [工艺路线]"
                        + " FROM dbo.plang WHERE id=?",
                childNo, scx, plMan, qty, qty,
                dueDate == null ? null : java.time.LocalDate.parse(dueDate), remark,
                lb, parentNo, parentId, seq, root, user, parentId);
        if (ins == 0) throw new IllegalStateException("子工单创建失败(父行已不存在)");
        Long childId = jdbc.queryForObject(
                "SELECT TOP 1 id FROM dbo.plang WHERE pl_no=? AND [源工单行id]=? ORDER BY id DESC", Long.class,
                childNo, parentId);

        // ③ 继承排产:子单同步落 plang_pc(锚=plang_id;排产表按行 id 定位,批次号不唯一)
        boolean scheduled = false;
        if (inherit && scx != null && !scx.isBlank() && childId != null) {
            jdbc.update("INSERT INTO plang_pc (comm, pl_no, pl_xc, pl_date, scx, pl_man, lb, st_date, cp_date, jh_date,"
                            + " od_no, od_xc, ja, asp_cancel, asp_user1, asp_time1, [批次号], plang_id)"
                            + " SELECT comm, pl_no, pl_xc, pl_date, scx, pl_man, lb, st_date, cp_date, NULL,"
                            + " od_no, od_xc, ja, N'N', ?, GETDATE(), [批次号], id"
                            + " FROM dbo.plang WHERE id=?",
                    user, childId);
            scheduled = true;
        }

        // ④ 占用链拆账(SO 行 → 父/子两张工单,合计不变)
        boolean linkAdjusted = splitLink(parentNo, parentXc, batch, childNo, childId, qty);

        // ⑤ 留痕(两侧各一条,工单追溯时间线直接可见)+ 切单操作日志(谁/何时/从哪单切出多少/生成哪张子单)
        logUsage(user, "切单", childNo);
        logUsage(user, "切出子工单", parentNo);
        logSplit("切单", parentNo, parentId, childNo, root, seq, qty, newParentSl, dueDate, remark, user);
        logUsage(user, "打印子工单", childNo);   // 会议口径:切完即打子工单码(扫码领料/报工绑到子单)

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("父工单号", parentNo);
        out.put("子工单号", childNo);
        out.put("子工单行id", childId);
        out.put("根工单号", root);
        out.put("切单序号", seq);
        out.put("切出数量", trim(qty));
        out.put("父单剩余数量", trim(newParentSl));
        out.put("子单交期", dueDate == null ? p.get("交期") : dueDate);
        out.put("继承排产", scheduled);
        out.put("占用链已拆账", linkAdjusted);
        out.put("打印提示", "子工单 " + childNo + " 已生成:请在生产工单页勾选该单打印子工单码(扫码领料/报工将绑定到子单)");
        out.put("家族汇总", familySummary(root));
        return out;
    }

    // ────────────────────────── 撤回切单 ──────────────────────────

    /** 撤回切单:子单无下游则软删 + 父单还原 + 占用链回冲;有下游拒绝并指出挡路单据。 */
    @Transactional
    public Map<String, Object> unsplit(Map<String, Object> req, String user) {
        Map<String, Object> c = loadChild(req);
        long childId = ((Number) c.get("id")).longValue();
        String childNo = String.valueOf(c.get("pl_no"));
        double childSl = num(c.get("pl_sl"));

        if ("T".equals(String.valueOf(c.get("ja"))) || "Y".equals(String.valueOf(c.get("ja"))))
            throw new IllegalStateException("子工单 " + childNo + " 已结案,不能撤回;请先取消结案");

        // 下游守卫:报工 / 入库 / 领料 / 再切分(任一存在即拒绝,并给出挡路单据号)
        List<Map<String, Object>> reports = jdbc.queryForList(
                "SELECT TOP 3 [报工单号] FROM dbo.scjl WHERE gldh=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id", childNo);
        if (!reports.isEmpty())
            throw new IllegalStateException("子工单 " + childNo + " 已有报工("
                    + reports.stream().map(r -> String.valueOf(r.get("报工单号"))).reduce((a, b) -> a + "、" + b).orElse("")
                    + "),不能撤回;请先弃审/删除该报工单");
        List<String> fins = jdbc.queryForList(
                "SELECT TOP 3 [单据编号] FROM dbo.bd_finish_in WHERE [加工单号]=? AND ISNULL(asp_cancel,'N')<>'Y'", String.class, childNo);
        if (!fins.isEmpty() || num(c.get("rk_sl")) > 0.0001)
            throw new IllegalStateException("子工单 " + childNo + " 已有完工入库"
                    + (fins.isEmpty() ? "" : "(" + String.join("、", fins) + ")") + ",不能撤回;请先作废该入库单");
        List<String> picks = jdbc.queryForList(
                "SELECT TOP 3 h.[单据编号] FROM dbo.bl_material_out m JOIN dbo.bd_material_out h ON h.[单据编号]=m.[单据编号]"
                        + " WHERE m.[加工单号]=? AND ISNULL(m.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'",
                String.class, childNo);
        if (!picks.isEmpty())
            throw new IllegalStateException("子工单 " + childNo + " 已发生领料(" + String.join("、", picks)
                    + "),不能撤回;请先作废该领料单");
        Integer grand = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.plang WHERE [源工单号]=? AND ISNULL(asp_cancel,'N')<>'Y'", Integer.class, childNo);
        if (grand != null && grand > 0)
            throw new IllegalStateException("子工单 " + childNo + " 之下还有 " + grand + " 张子工单,不能撤回;请先撤回下级");

        // 父行:以 源工单行id 精确还原(同一 pl_no 可有多行)
        Long parentId = c.get("源工单行id") == null ? null : ((Number) c.get("源工单行id")).longValue();
        if (parentId == null)
            throw new IllegalStateException("子工单 " + childNo + " 缺少源工单行id(历史数据),无法自动还原;请手工调整父单数量");
        List<Map<String, Object>> parents = jdbc.queryForList(
                "SELECT id, pl_no, pl_xc, ISNULL(pl_sl,0) AS pl_sl, ISNULL(xq_sl,0) AS xq_sl, ISNULL([批次号],N'') AS 批次号,"
                        + " ISNULL(ja,'N') AS ja FROM dbo.plang WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", parentId);
        if (parents.isEmpty())
            throw new IllegalStateException("源工单行(行id=" + parentId + ")已不存在或已作废,不能撤回切单");
        Map<String, Object> parent = parents.get(0);
        String parentNo = String.valueOf(parent.get("pl_no"));
        int parentXc = ((Number) parent.get("pl_xc")).intValue();

        // 回冲:删子单排产薄记录 → 软删子单 → 父单数量还原 → 占用链回冲
        jdbc.update("DELETE FROM dbo.plang_pc WHERE plang_id=?", childId);
        jdbc.update("UPDATE dbo.plang SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE() WHERE id=?", user, childId);
        double newParentSl = round(num(parent.get("pl_sl")) + childSl);
        // 撤回时**需求数量一并还原**(与切单核减对称,2026-10-05):新需求=旧需求+子单需求;余量仍=需求−排产
        double childXq = round(num(c.get("xq_sl")));
        jdbc.update("UPDATE dbo.plang SET pl_sl=?, xq_sl=ISNULL(xq_sl,0)+?,"
                        + " yl=ISNULL(xq_sl,0)+?-?, asp_user2=?, asp_time2=GETDATE() WHERE id=?",
                newParentSl, childXq, childXq, newParentSl, user, parentId);
        boolean linkRestored = mergeLink(parentNo, parentXc, str(parent.get("批次号")), childNo, childSl);

        logUsage(user, "撤回切单", childNo);
        logUsage(user, "撤回子工单", parentNo);
        // 日志:对应「切单」行标已撤回(留痕不删) + 记一行撤回操作
        try {
            jdbc.update("UPDATE dbo.wo_split_log SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE()"
                    + " WHERE 操作类型=N'切单' AND 子工单号=? AND ISNULL(asp_cancel,'N')<>'Y'", user, childNo);
        } catch (Exception ignore) { /* 日志失败不阻断 */ }
        logSplit("撤回切单", parentNo, parentId, childNo, familyRoot(parent), c.get("拆分序号") == null ? null : ((Number) c.get("拆分序号")).intValue(),
                childSl, newParentSl, null, "撤回子单,数量还原到原单", user);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("子工单号", childNo);
        out.put("父工单号", parentNo);
        out.put("还原数量", trim(childSl));
        out.put("父单排产数量", trim(newParentSl));
        out.put("占用链已回冲", linkRestored);
        return out;
    }

    // ────────────────────────── 内部 ──────────────────────────

    /** 父行:优先按 plang.id(前端列表下发的 行id);否则按 工单号+行号+批次号 定位。 */
    private Map<String, Object> loadParent(Map<String, Object> req) {
        Object rid = req.get("行id");
        try {
            if (rid != null && !String.valueOf(rid).isBlank() && !"null".equals(String.valueOf(rid)))
                return jdbc.queryForMap(
                        "SELECT id, comm, pl_no, pl_xc, ISNULL(scx,N'') AS scx, ISNULL(pl_man,N'') AS pl_man,"
                                + " ISNULL(lb,N'') AS lb, ISNULL([批次号],N'') AS 批次号, ISNULL(dm,N'') AS dm,"
                                + " ISNULL(mc,N'') AS mc, ISNULL(gg,N'') AS gg, ISNULL(pl_sl,0) AS pl_sl,"
                                + " ISNULL(xq_sl,0) AS xq_sl, ISNULL(rk_sl,0) AS rk_sl, ISNULL(ja,'N') AS ja,"
                                + " ISNULL([源工单号],N'') AS 源工单号, ISNULL([根工单号],N'') AS 根工单号,"
                                + " ISNULL([是否切单],N'N') AS 是否切单,"
                                + " CAST(CONVERT(varchar(10), cp_date, 120) AS nvarchar(20)) AS 交期,"
                                + " CAST(ISNULL(CAST(bz AS nvarchar(500)),N'') AS nvarchar(500)) AS 父备注"
                                + " FROM dbo.plang WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'",
                        Long.parseLong(String.valueOf(rid).trim()));
            String no = str(req.get("工单号"));
            if (no == null) throw new IllegalArgumentException("切单缺少 工单号/行id");
            String batch = str(req.get("批次号"));
            Object xc = req.get("工单行号");
            return jdbc.queryForMap(
                    "SELECT TOP 1 id, comm, pl_no, pl_xc, ISNULL(scx,N'') AS scx, ISNULL(pl_man,N'') AS pl_man,"
                            + " ISNULL(lb,N'') AS lb, ISNULL([批次号],N'') AS 批次号, ISNULL(dm,N'') AS dm,"
                            + " ISNULL(mc,N'') AS mc, ISNULL(gg,N'') AS gg, ISNULL(pl_sl,0) AS pl_sl,"
                            + " ISNULL(xq_sl,0) AS xq_sl, ISNULL(rk_sl,0) AS rk_sl, ISNULL(ja,'N') AS ja,"
                            + " ISNULL([源工单号],N'') AS 源工单号, ISNULL([根工单号],N'') AS 根工单号,"
                            + " ISNULL([是否切单],N'N') AS 是否切单,"
                            + " CAST(CONVERT(varchar(10), cp_date, 120) AS nvarchar(20)) AS 交期,"
                            + " CAST(ISNULL(CAST(bz AS nvarchar(500)),N'') AS nvarchar(500)) AS 父备注"
                            + " FROM dbo.plang WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'"
                            + "   AND (? IS NULL OR pl_xc=?) AND (? = N'' OR ISNULL([批次号],N'')=?)"
                            + " ORDER BY id",
                    no, xcOf(xc), xcOf(xc), batch == null ? "" : batch, batch == null ? "" : batch);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new IllegalStateException("工单行不存在或已作废,不能切单");
        }
    }

    /** 子行:按 行id 优先,否则按 子工单号(必须带源工单号=是切出来的)。 */
    private Map<String, Object> loadChild(Map<String, Object> req) {
        Object rid = req.get("行id");
        try {
            if (rid != null && !String.valueOf(rid).isBlank() && !"null".equals(String.valueOf(rid)))
                return jdbc.queryForMap(
                        "SELECT id, pl_no, pl_xc, ISNULL(pl_sl,0) AS pl_sl, ISNULL(xq_sl,0) AS xq_sl, ISNULL(rk_sl,0) AS rk_sl, ISNULL(ja,'N') AS ja,"
                                + " [源工单号], [源工单行id], [拆分序号] FROM dbo.plang"
                                + " WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'",
                        Long.parseLong(String.valueOf(rid).trim()));
            String no = str(req.get("工单号"));
            if (no == null) throw new IllegalArgumentException("撤回切单缺少 工单号/行id");
            Map<String, Object> row = jdbc.queryForMap(
                    "SELECT TOP 1 id, pl_no, pl_xc, ISNULL(pl_sl,0) AS pl_sl, ISNULL(xq_sl,0) AS xq_sl, ISNULL(rk_sl,0) AS rk_sl, ISNULL(ja,'N') AS ja,"
                            + " [源工单号], [源工单行id], [拆分序号] FROM dbo.plang"
                            + " WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id",
                    no);
            return row;
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new IllegalStateException("工单不存在或已作废");
        }
    }

    /** 可切上限 = 排产数量 − max(已入库, 各工序已完工报工量最大值)。 */
    private double cutLimit(Map<String, Object> p) {
        double plSl = num(p.get("pl_sl"));
        double bound = Math.max(num(p.get("rk_sl")), maxCompleted(String.valueOf(p.get("pl_no"))));
        return round(plSl - bound);
    }

    /** 该工单各工序已完工报工量的最大值(报工封顶按「工序 × 工单」比对,故取最大工序量当约束)。 */
    private double maxCompleted(String plNo) {
        Double v = jdbc.queryForObject(
                "SELECT ISNULL(MAX(s),0) FROM (SELECT SUM(ISNULL(sl,0)) AS s FROM dbo.scjl"
                        + "  WHERE gldh=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(wgzt,'N')='Y'"
                        + "  GROUP BY gxdm) t", Double.class, plNo);
        return v == null ? 0 : v;
    }

    /** 已切出数量(该父行名下未作废子单的排产数量之和;撤回后自然回落)。 */
    private double sumChildren(long parentId) {
        Double v = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(pl_sl,0)),0) FROM dbo.plang WHERE [源工单行id]=? AND ISNULL(asp_cancel,'N')<>'Y'",
                Double.class, parentId);
        return v == null ? 0 : v;
    }

    /** 下一个拆分序号(同父行**含已撤回行**取最大 +1:撤回后再切不复用旧号,子单号不重号) */
    private int nextSplitSeq(long parentId, String parentNo) {
        Integer max = jdbc.queryForObject(
                "SELECT ISNULL(MAX(ISNULL([拆分序号],0)),0) FROM dbo.plang WHERE [源工单行id]=?",
                Integer.class, parentId);
        return (max == null ? 0 : max) + 1;
    }

    /** 血缘根:父单本身是子单则继承其根;否则父单自己就是根(顶级原单聚合时用自身单号兜底) */
    private String familyRoot(Map<String, Object> p) {
        String root = str(p.get("根工单号"));
        return root != null ? root : String.valueOf(p.get("pl_no"));
    }

    /**
     * 家族汇总(按**根**聚合,会议口径:多级切分一律按根单):张数 + Σ计划数量 + Σ入库数量 + Σ已完工报工。
     * 计划员看整体进度 / 订单跟踪表数量闭合用(原单 + 全部子孙之和)。
     */
    public Map<String, Object> familySummary(String root) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (root == null || root.isBlank()) return out;
        Map<String, Object> agg = jdbc.queryForMap(
                "SELECT COUNT(*) AS 张数, ISNULL(SUM(ISNULL(pl_sl,0)),0) AS 计划数量,"
                        + " ISNULL(SUM(ISNULL(rk_sl,0)),0) AS 入库数量 FROM dbo.plang"
                        + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND (pl_no=? OR ISNULL([根工单号],N'')=?)", root, root);
        out.put("根工单号", root);
        out.put("张数", agg.get("张数"));
        out.put("计划数量", round(num(agg.get("计划数量"))));
        out.put("入库数量", round(num(agg.get("入库数量"))));
        Double done = jdbc.queryForObject(
                "SELECT ISNULL(SUM(s),0) FROM (SELECT gldh, MAX(s) AS s FROM"
                        + " (SELECT gldh, SUM(ISNULL(sl,0)) AS s FROM dbo.scjl"
                        + "   WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(wgzt,'N')='Y' AND gldh IN"
                        + "     (SELECT pl_no FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'"
                        + "       AND (pl_no=? OR ISNULL([根工单号],N'')=?))"
                        + "   GROUP BY gldh, gxdm) t GROUP BY gldh) u", Double.class, root, root);
        out.put("已完工报工", done == null ? 0 : round(done));
        return out;
    }

    /** 切单操作日志(谁/何时/从哪单切出多少/生成哪张子单/是否撤回);失败不阻断业务 */
    private void logSplit(String op, String parentNo, long parentId, String childNo, String root, Integer seq,
                          double qty, double parentLeft, String due, String remark, String user) {
        try {
            jdbc.update("INSERT INTO dbo.wo_split_log (操作类型, 父工单号, 父工单行id, 子工单号, 根工单号, 切单序号,"
                            + " 切出数量, 父单剩余量, 子单交期, 原因备注, asp_cancel, asp_user1, asp_time1)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,N'N',?,GETDATE())",
                    op, parentNo, parentId, childNo, root, seq, qty, parentLeft,
                    due == null ? null : java.time.LocalDate.parse(due), remark, user);
        } catch (Exception ignore) { /* 日志失败不阻断业务 */ }
    }

    /**
     * 占用链拆账:父行占用减切出量 + 子行新增同量(SO 行剩余可转总量不变)。
     * 找不到父行占用(历史数据/非订单结转来源)时返回 false,不阻断切单。
     */
    private boolean splitLink(String parentNo, int parentXc, String batch, String childNo, Long childId, double qty) {
        try {
            String parentKey = parentNo + "#" + parentXc + "#" + (batch == null ? "" : batch);
            List<Map<String, Object>> links = jdbc.queryForList(
                    "SELECT TOP 1 source_panel_code, source_form_no, source_detail_key, source_line_key,"
                            + " inventory_code, ISNULL(linked_quantity,0) AS linked_quantity"
                            + " FROM form_flow_link WHERE target_panel_code='PLANG' AND target_line_key=?"
                            + " AND link_status='ACTIVE'", parentKey);
            if (links.isEmpty()) return false;
            Map<String, Object> l = links.get(0);
            double cur = num(l.get("linked_quantity"));
            if (cur + 0.0001 < qty) return false;   // 占用不足(=号段错配),不冒险改账
            jdbc.update("UPDATE form_flow_link SET linked_quantity = linked_quantity - ?"
                    + " WHERE target_panel_code='PLANG' AND target_line_key=? AND link_status='ACTIVE'", qty, parentKey);
            jdbc.update("INSERT INTO form_flow_link (source_panel_code, source_form_no, source_detail_key, source_line_key,"
                            + " target_panel_code, target_form_no, target_detail_key, target_line_key,"
                            + " inventory_code, source_quantity, linked_quantity, link_status, create_by)"
                            + " VALUES (?,?,?,?,'PLANG',?,NULL,?,?,?,?,'ACTIVE',?)",
                    l.get("source_panel_code"), l.get("source_form_no"), l.get("source_detail_key"), l.get("source_line_key"),
                    childNo, childNo + "#1#" + (batch == null ? "" : batch), l.get("inventory_code"), qty, qty,
                    currentOrSystem());
            return true;
        } catch (Exception ignore) {
            return false;   // 链路表缺失等场景不阻断切单(数量守恒不依赖它)
        }
    }

    /** 占用链回冲:子行占用置 RELEASED + 父行占用加回还原量。 */
    private boolean mergeLink(String parentNo, int parentXc, String batch, String childNo, double qty) {
        try {
            int released = jdbc.update("UPDATE form_flow_link SET link_status='RELEASED', release_time=SYSDATETIME()"
                    + " WHERE target_panel_code='PLANG' AND target_form_no=? AND link_status='ACTIVE'", childNo);
            String parentKey = parentNo + "#" + parentXc + "#" + (batch == null ? "" : batch);
            int back = jdbc.update("UPDATE form_flow_link SET linked_quantity = linked_quantity + ?"
                    + " WHERE target_panel_code='PLANG' AND target_line_key=? AND link_status='ACTIVE'", qty, parentKey);
            return released > 0 || back > 0;
        } catch (Exception ignore) {
            return false;
        }
    }

    /**
     * 按钮留痕(yj_usage_log;列固定为 user_name/real_name/event_type/panel_name/action_name/doc_no/created_at
     * —— 无备注列,故方向与数量由「两侧各一条 + 追溯里的父子工单块」表达)。失败不阻断业务。
     */
    private void logUsage(String user, String action, String docNo) {
        try {
            jdbc.update("INSERT INTO yj_usage_log (user_name, real_name, event_type, panel_name, action_name, doc_no, created_at)"
                            + " VALUES (?, ISNULL((SELECT real_name FROM yj_user WHERE username = ?), ?),"
                            + " N'生产', ?, ?, ?, GETDATE())",
                    user, user, user, LOG_PANEL, action, docNo);
        } catch (Exception ignore) { /* 留痕失败不阻断业务 */ }
    }

    private String currentOrSystem() {
        try {
            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            return auth == null || auth.getName() == null || auth.getName().isBlank() ? "system" : auth.getName();
        } catch (Exception e) {
            return "system";
        }
    }

    private static Integer xcOf(Object v) {
        if (v == null || String.valueOf(v).isBlank() || "null".equals(String.valueOf(v))) return null;
        if (v instanceof Number n) return n.intValue();
        try { return Integer.valueOf(String.valueOf(v).trim()); } catch (NumberFormatException e) { return null; }
    }

    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }

    private static double num(Object o) {
        if (o == null || String.valueOf(o).isBlank()) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return 0; }
    }

    private static double round(double v) { return Math.round(v * 10000.0) / 10000.0; }

    /** 数量显示:去掉无意义的小数尾巴(前端只读回执用) */
    private static Object trim(double v) {
        double r = round(v);
        return r == Math.floor(r) ? (Object) (long) r : (Object) r;
    }
}
