package com.yinjia.mes.service;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工序流程追踪卡(2026-10-29,用户口述《新建 DOCX 文档 (2).docx》「生产相关」;方案基线
 * `docs/design/工序流程追踪卡-V1.0.md`)。
 *
 * <p><b>业务口径</b>:一张卡 = 一个**工单行**(= 一个小批次),行级身份永远是 {@code plang.id}
 * (同一工单号可有多行/多批次,不按工单号整单取数);小批次号 = {@code <工单号>-<工单行号>},
 * 卡号 = {@code LZK-<小批次号>};工序行**快照**自现役工序台账 {@code wo_process_line}
 * (见 {@link ProcessTaskService#ensureLedgerForWorkOrder}),卡不重算路线、不写台账。
 * **完成情况只读现算,不落库**(口径同 {@code WorkReportController.row}) —— 卡要永远对得上报工台账,
 * 落了冗余完成量必然"两账不合一"(设计 §1.4)。
 *
 * <p><b>批次口径(2026-10-29 按真实数据核实;原设计写的 plang.lot_no 并没有批次值)</b>:
 * {@code plang.lot_no} 全库 NULL(那是产品批号),真正的生产批次在 {@code plang.[批次号]}
 * (以及 plang_pc / scjl 的 [批次号]),由 {@link ProcessTaskService#syncWorkOrderState} 在该行
 * **首次「生产完工」**时写入完工当天 yyyyMMdd ⇒ 在制阶段多数行**还没有**批次号,故
 * 解析批次号 = 生产批次优先、**工单日期**兜底(卡头 {@code 批次来源} 记录实测值还是推定值)。
 * 照片不新建表:{@code yj_attachment}(doc_no=卡号,field_key='工序照片-<工序序>'/'卡照片'),
 * 上传删除下载走既有 {@code /api/attachment/*}。
 */
@Service
public class ProcCardService {

    /** 页面级虚拟面板编码(动作词 view/query/entry/confirm 见 {@link PagePanelRegistry}) */
    private static final String PANEL = PagePanelRegistry.PROC_FLOW_CARD;
    private static final String CARD_PREFIX = "LZK-";            // 卡号 = LZK-<小批次号>
    private static final String PHOTO_OP_PREFIX = "工序照片-";   // 逐道工序的照片字段键前缀
    private static final String PHOTO_CARD_FIELD = "卡照片";     // 卡级照片(兼容)
    private static final String STATUS_ENTRY = "录入中";
    private static final String STATUS_DONE = "已完成";
    private static final String SOURCE_BATCH = "生产批次";
    private static final String SOURCE_DATE = "工单日期";

    /**
     * 工单行「解析批次号」—— **全服务唯一口径**,必须与 {@code plang p} 一起用(别名固定 p / bx);
     * 优先级:本行 [批次号] → 本行任一排产行 plang_pc.[批次号] → 本行任一报工 scjl.[批次号]。
     * 表名/列名全部写死,不含任何请求参数(禁止拼外部值)。
     */
    private static final String ROW_BATCH_APPLY = " CROSS APPLY (SELECT COALESCE("
            + " NULLIF(LTRIM(RTRIM(p.[批次号])), N''),"
            + " (SELECT TOP 1 NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') FROM dbo.plang_pc pc"
            + "   WHERE pc.plang_id = p.id AND ISNULL(pc.asp_cancel,'N') <> 'Y'"
            + "     AND NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') IS NOT NULL ORDER BY pc.id DESC),"
            + " (SELECT TOP 1 NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') FROM dbo.scjl s2"
            + "   JOIN dbo.plang_pc pc2 ON pc2.id = s2.gd_id"
            + "   WHERE pc2.plang_id = p.id AND ISNULL(s2.asp_cancel,'N') <> 'Y'"
            + "     AND NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') IS NOT NULL ORDER BY s2.id DESC))"
            + " AS 生产批次) bx";
    /** 解析后的批次号(生产批次优先;没有则 = 工单日期 yyyyMMdd,即推定值) */
    private static final String ROW_BATCH = "COALESCE(bx.生产批次, CONVERT(varchar(8), p.pl_date, 112))";
    /**
     * 报工锚点用的「本行批次」= {@code plang.[批次号]} **原值**(在制期为空) —— 不能拿推定出来的工单日期,
     * 否则该行首次生产完工后,之前存下的草稿报工(gd_id=0、批次号为空)会从「待审核」里消失。
     */
    private static final String ROW_BATCH_ANCHOR = "ISNULL(p.[批次号],N'')";
    /** 批次来源:生产批次 / 工单日期(推定) */
    private static final String ROW_BATCH_SOURCE =
            "CASE WHEN bx.生产批次 IS NOT NULL THEN N'" + SOURCE_BATCH + "' ELSE N'" + SOURCE_DATE + "' END";

    /** 卡头统一列集合:时间列一律转 yyyy-MM-dd HH:mm:ss 文本(与其它面板时间列同口径,免时区分叉) */
    private static final String HEAD_SELECT = "SELECT c.id AS 卡id, c.卡号, c.大批次号, c.小批次号,"
            + " ISNULL(c.批次来源,N'') AS 批次来源, c.工单号, c.工单行号, c.工单行id,"
            + " ISNULL(c.产品编码,N'') AS 产品编码, ISNULL(c.产品名称,N'') AS 产品名称,"
            + " ISNULL(c.规格型号,N'') AS 规格型号, CONVERT(float, ISNULL(c.计划数量,0)) AS 计划数量,"
            + " ISNULL(c.生产线,N'') AS 生产线, ISNULL(c.工艺路线,N'') AS 工艺路线,"
            + " ISNULL(c.卡状态,N'" + STATUS_ENTRY + "') AS 卡状态, ISNULL(c.确认人,N'') AS 确认人,"
            + " CONVERT(varchar(19), c.确认时间, 120) AS 确认时间, ISNULL(c.备注,N'') AS 备注,"
            + " ISNULL(c.asp_user1,N'') AS 创建人, CONVERT(varchar(19), c.asp_time1, 120) AS 创建时间,"
            + " CONVERT(varchar(19), c.asp_time2, 120) AS 更新时间, ISNULL(p.[批次号],N'') AS 报工批次"
            + " FROM dbo.wo_proc_card_head c LEFT JOIN dbo.plang p ON p.id = c.工单行id";

    private final JdbcTemplate jdbc;
    /** 工序台账(wo_process_line)补齐:卡不自己生成工序,只对齐现役台账 */
    private final ProcessTaskService processTask;
    /** 工单追溯(卡 → 工序 → 报工 → 工单):直接复用排产看板的 trace,不另写一套 */
    private final ScheduleBoardService scheduleBoard;

    public ProcCardService(JdbcTemplate jdbc, ProcessTaskService processTask, ScheduleBoardService scheduleBoard) {
        this.jdbc = jdbc;
        this.processTask = processTask;
        this.scheduleBoard = scheduleBoard;
    }

    /** 下拉选项:工序(工序档案启用项)+ 卡状态;前端不再硬编工序名 */
    public Map<String, Object> meta() {
        List<String> ops = jdbc.queryForList("SELECT 工序名称 FROM dbo.bs_op WHERE ISNULL(asp_cancel,'N')<>'Y'"
                + " AND ISNULL(是否停用,0)=0 AND ISNULL(工序名称,N'')<>N'' ORDER BY id", String.class);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("工序", ops);
        out.put("卡状态", List.of(STATUS_ENTRY, STATUS_DONE));
        return out;
    }

    /** 大批次列表(录入页签下拉)。**按工单行聚合,不按已建卡** —— 拍照在在制阶段发生,那时多数行还没批次也还没建卡,
     * 按卡聚合会让"先选行再建卡"无批可选;日期区间按**工单日期**过滤(批次号可能是带后缀的历史值,比区间不可靠)。 */
    public List<Map<String, Object>> batches(String keyword, String from, String to) {
        List<Object> args = new ArrayList<>();
        StringBuilder w = new StringBuilder(" WHERE ISNULL(p.asp_cancel,'N')<>'Y'");
        w.append(" AND ISNULL(").append(ROW_BATCH).append(",N'')<>N''");
        Date d1 = dayOf(from);
        if (d1 != null) { w.append(" AND p.pl_date >= ?"); args.add(d1); }
        Date d2 = dayOf(to);
        if (d2 != null) { w.append(" AND p.pl_date < ?"); args.add(new Date(d2.getTime() + 86_400_000L)); }
        StringBuilder h = new StringBuilder();
        String kw = blankToNull(keyword);
        if (kw != null) { h.append(" WHERE t.批次号 LIKE ?"); args.add(like(kw)); }
        return jdbc.queryForList("SELECT t.批次号, t.批次来源, t.行数, t.卡数, t.产品数, t.计划数量 FROM ("
                + " SELECT " + ROW_BATCH + " AS 批次号, " + ROW_BATCH_SOURCE + " AS 批次来源,"
                + "   COUNT(*) AS 行数, COUNT(DISTINCT cx.id) AS 卡数,"
                + "   COUNT(DISTINCT NULLIF(ISNULL(p.dm,N''),N'')) AS 产品数,"
                + "   ISNULL(SUM(ISNULL(p.pl_sl,0)),0) AS 计划数量"
                + " FROM dbo.plang p" + ROW_BATCH_APPLY
                // 卡数按「工单行id」关联:卡头的大批次号会随生产批次出现而自动同步,拿它反查会在同步前后漏数
                + " LEFT JOIN dbo.wo_proc_card_head cx ON cx.工单行id = p.id AND ISNULL(cx.asp_cancel,'N')<>'Y'"
                + w + " GROUP BY " + ROW_BATCH + ", " + ROW_BATCH_SOURCE
                + ") t" + h + " ORDER BY t.批次号 DESC", args.toArray());
    }

    /** 某大批次下的工单行(小批次候选):**从 plang 取全部行**(不只看已建卡的,让用户先选行后建卡),已建卡的行带回卡号/卡状态。 */
    public List<Map<String, Object>> lines(String batch, String keyword) {
        String b = blankToNull(batch);
        if (b == null) throw new IllegalArgumentException("请选择大批次号");
        String kw = blankToNull(keyword);
        List<Object> args = new ArrayList<>();
        args.add(b);
        StringBuilder w = new StringBuilder();
        if (kw != null) {
            w.append(" AND (p.pl_no LIKE ? OR ISNULL(p.dm,N'') LIKE ? OR ISNULL(p.mc,N'') LIKE ?"
                    + " OR ISNULL(p.gg,N'') LIKE ?)");
            for (int i = 0; i < 4; i++) args.add(like(kw));
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.id AS 工单行id, p.pl_no AS 工单号, p.pl_xc AS 工单行号,"
                        + " ISNULL(p.dm,N'') AS 产品编码, ISNULL(p.mc,N'') AS 产品名称,"
                        + " ISNULL(p.gg,N'') AS 规格型号, CONVERT(float, ISNULL(p.pl_sl,0)) AS 计划数量,"
                        + " ISNULL(p.scx,N'') AS 生产线, ISNULL(p.[当前工序],N'') AS 当前工序,"
                        + " ISNULL(p.[完工状态],N'') AS 完工状态,"
                        + " ISNULL(c.卡号,N'') AS 卡号, ISNULL(c.卡状态,N'') AS 卡状态"
                        + " FROM dbo.plang p" + ROW_BATCH_APPLY
                        + " LEFT JOIN dbo.wo_proc_card_head c ON c.工单行id = p.id AND ISNULL(c.asp_cancel,'N')<>'Y'"
                        + " WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND " + ROW_BATCH + " = ?" + w
                        + " ORDER BY p.pl_no, ISNULL(p.pl_xc,0), p.id", args.toArray());
        Map<String, Integer> photos = photoTotals(rows.stream().map(r -> str(r.get("卡号")))
                .filter(s -> !s.isEmpty()).distinct().toList());
        for (Map<String, Object> r : rows) r.put("照片数", photos.getOrDefault(str(r.get("卡号")), 0));
        return rows;
    }

    /** 为某工单行建卡(**幂等**:该行已有有效卡则直接返回既有卡)。
     * 顺序:查工单行快照 + 解析批次号 → 算卡号 → 补工序台账(现役唯一入口)→ 台账快照进卡明细。 */
    @Transactional
    public Map<String, Object> create(Long rowId, String remark, String user) {
        if (rowId == null) throw new IllegalArgumentException("请提供工单行id");
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT 卡号 FROM dbo.wo_proc_card_head WHERE 工单行id=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + " ORDER BY id DESC", rowId);
        if (!existing.isEmpty()) return buildDetail(cardByNo(str(existing.get(0).get("卡号"))));
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.id, p.pl_no, p.pl_xc, ISNULL(p.dm,N'') AS 产品编码, ISNULL(p.mc,N'') AS 产品名称,"
                        + " ISNULL(p.gg,N'') AS 规格型号, CONVERT(float, ISNULL(p.pl_sl,0)) AS 计划数量,"
                        + " ISNULL(p.scx,N'') AS 生产线, ISNULL(p.[工艺路线],N'') AS 工艺路线,"
                        + " " + ROW_BATCH + " AS 大批次号, " + ROW_BATCH_SOURCE + " AS 批次来源"
                        + " FROM dbo.plang p" + ROW_BATCH_APPLY
                        + " WHERE p.id=? AND ISNULL(p.asp_cancel,'N')<>'Y'", rowId);
        if (rows.isEmpty()) throw new IllegalArgumentException("工单行不存在(已作废的单查不到)");
        Map<String, Object> row = rows.get(0);
        String plNo = str(row.get("pl_no"));
        Object xc = row.get("pl_xc");
        // 小批次号 = 工单号-工单行号;行号空/0 时用行id(行id 才是真正的行身份)
        String 小批次号 = plNo + "-" + (xc instanceof Number n && n.intValue() > 0 ? String.valueOf(n.intValue()) : String.valueOf(rowId));
        String 大批次号 = str(row.get("大批次号"));
        if (大批次号.isEmpty()) throw new IllegalArgumentException("该工单行既没有生产批次也没有工单日期,无法建卡");
        String 批次来源 = str(row.get("批次来源"));
        String 产品编码 = str(row.get("产品编码"));
        String 工艺路线 = resolveRoute(str(row.get("工艺路线")), 产品编码);
        String 卡号 = CARD_PREFIX + 小批次号;
        // 卡号撞车两种来源(卡号是身份 ⇒ 只能复用,不能另起):
        //  · 同一行的旧卡被软删过 ⇒ 复活它(唯一索引否则让用户永远建不出卡);
        //  · 历史数据同工单号下行号重复(实测 GD-2026-10-0023 有两条 #1)⇒ 加行id 区分。
        List<Map<String, Object>> dup = cardsByNo(卡号);
        if (!dup.isEmpty() && numLong(dup.get(0).get("工单行id")) != rowId) {
            小批次号 = 小批次号 + "-" + rowId;
            卡号 = CARD_PREFIX + 小批次号;
            dup = cardsByNo(卡号);
        }
        if (!dup.isEmpty() && !"Y".equals(str(dup.get(0).get("asp_cancel"))) && numLong(dup.get(0).get("工单行id")) != rowId) {
            throw new IllegalArgumentException("卡号已被占用:" + 卡号);
        }
        Long cardId;
        if (!dup.isEmpty() && "Y".equals(str(dup.get(0).get("asp_cancel")))) {
            cardId = numLong(dup.get(0).get("卡id"));
            jdbc.update("UPDATE dbo.wo_proc_card_head SET 大批次号=?, 小批次号=?, 批次来源=?, 工单号=?, 工单行号=?,"
                            + " 工单行id=?, 产品编码=?, 产品名称=?, 规格型号=?, 计划数量=?, 生产线=?, 工艺路线=?,"
                            + " 卡状态=N'" + STATUS_ENTRY + "', 确认人=NULL, 确认时间=NULL, 备注=?,"
                            + " asp_cancel=N'N', asp_user2=?, asp_time2=SYSDATETIME() WHERE id=?",
                    大批次号, 小批次号, 批次来源, plNo, row.get("pl_xc"), rowId, 产品编码,
                    str(row.get("产品名称")), str(row.get("规格型号")), row.get("计划数量"), str(row.get("生产线")),
                    工艺路线, blankToNull(remark), user, cardId);
            jdbc.update("UPDATE dbo.wo_proc_card_detail SET asp_cancel=N'Y', asp_user2=?, asp_time2=SYSDATETIME()"
                    + " WHERE 卡id=? AND ISNULL(asp_cancel,'N')<>'Y'", user, cardId);
        } else {
            try {
                jdbc.update("INSERT INTO dbo.wo_proc_card_head (卡号, 大批次号, 小批次号, 批次来源, 工单号, 工单行号,"
                                + " 工单行id, 产品编码, 产品名称, 规格型号, 计划数量, 生产线, 工艺路线, 卡状态, 备注,"
                                + " asp_user1, asp_time1, asp_cancel)"
                                + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,N'" + STATUS_ENTRY + "',?,?,SYSDATETIME(),N'N')",
                        卡号, 大批次号, 小批次号, 批次来源, plNo, row.get("pl_xc"), rowId, 产品编码,
                        str(row.get("产品名称")), str(row.get("规格型号")), row.get("计划数量"), str(row.get("生产线")),
                        工艺路线, blankToNull(remark), user);
                cardId = jdbc.queryForObject("SELECT id FROM dbo.wo_proc_card_head WHERE 卡号=?", Long.class, 卡号);
            } catch (DuplicateKeyException e) {
                // 并发建卡:另一请求刚提交(卡号 或 (大批次号,工单行id) 唯一键冲突)⇒ 直接按幂等返既有卡;
                // 不能再往下插工序行(对方已插好,再插必撞 (卡id, 工序序) 唯一索引)
                List<Map<String, Object>> again = jdbc.queryForList(
                        "SELECT 卡号 FROM dbo.wo_proc_card_head WHERE 工单行id=? AND ISNULL(asp_cancel,'N')<>'Y'"
                                + " ORDER BY id DESC", rowId);
                return buildDetail(cardByNo(again.isEmpty() ? 卡号 : str(again.get(0).get("卡号"))));
            }
        }
        ensureLedger(plNo, 工艺路线, user);
        List<Map<String, Object>> ledger = jdbc.queryForList(
                "SELECT ISNULL(工序,N'') AS 工序, ISNULL(工序序,0) AS 工序序,"
                        + " CONVERT(float, ISNULL(计划数量,0)) AS 计划数量,"
                        + " ISNULL(计划生产线,N'') AS 计划生产线, ISNULL(实际生产线,N'') AS 实际生产线"
                        + " FROM dbo.wo_process_line WHERE 工单行id=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + " ORDER BY ISNULL(工序序,999), id", rowId);
        if (ledger.isEmpty()) {
            throw new IllegalArgumentException("该工单行没有工序台账(工艺路线在 bs_route 里没有工序)"
                    + ",请先在生产工单页确认该行的工艺路线");
        }
        Map<String, String> opCodes = opCodes();
        for (Map<String, Object> l : ledger) {
            String op = str(l.get("工序"));
            jdbc.update("INSERT INTO dbo.wo_proc_card_detail (卡id, 卡号, 工序序, 工序, 工序编码, 生产车间,"
                            + " 计划数量, 计划生产线, 实际生产线, asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,SYSDATETIME(),N'N')",
                    cardId, 卡号, l.get("工序序"), op, blankToNull(opCodes.get(op)),
                    // 归口车间与排产/工序任务同一口径(装箱归组装,见 ProcessShop)
                    blankToNull(ProcessShop.resolve(op, "")),
                    l.get("计划数量"), blankToNull(l.get("计划生产线")), blankToNull(l.get("实际生产线")), user);
        }
        return buildDetail(cardByNo(卡号));
    }

    /** 补工序台账。**路线参数只在「本工单号仅剩这一行缺台账」时才传** —— {@link ProcessTaskService#ensureLedgerForWorkOrder}
     * 是**整单**处理,传了路线会覆盖它给同一工单号其它行的路线(多行工单各行路线可能不同);传 null 则按每行自己的路线解析。 */
    private void ensureLedger(String plNo, String route, String user) {
        Integer pending = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.plang p WHERE p.pl_no=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + " AND NOT EXISTS (SELECT 1 FROM dbo.wo_process_line l WHERE l.工单行id=p.id"
                        + " AND ISNULL(l.asp_cancel,'N')<>'Y')", Integer.class, plNo);
        processTask.ensureLedgerForWorkOrder(plNo, pending != null && pending <= 1 ? blankToNull(route) : null, user);
    }

    /** 工艺路线兜底:工单行上的 → 产品档案 → 默认路线(同 ProcessTaskService.routeOfRow 口径) */
    private String resolveRoute(String routeFromRow, String dm) {
        String r = blankToNull(routeFromRow);
        if (r != null) return r;
        if (blankToNull(dm) != null) {
            List<String> byInv = jdbc.queryForList("SELECT TOP 1 ISNULL([工艺路线],N'') FROM dbo.bs_inv"
                    + " WHERE 存货编码=? AND ISNULL(asp_cancel,'N')<>'Y'", String.class, dm);
            if (!byInv.isEmpty() && !byInv.get(0).isBlank()) return byInv.get(0).trim();
        }
        return ProcessTaskService.DEFAULT_ROUTE;
    }

    /** 工序名称 → 工序编码(工序档案);查不到 = 空 */
    private Map<String, String> opCodes() {
        Map<String, String> m = new HashMap<>();
        for (Map<String, Object> r : jdbc.queryForList("SELECT 工序名称, ISNULL(工序编码,N'') AS 工序编码"
                + " FROM dbo.bs_op WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(工序名称,N'')<>N''")) {
            m.putIfAbsent(str(r.get("工序名称")), str(r.get("工序编码")));
        }
        return m;
    }

    /** 卡详情:{头, 工序行, 报工记录, 照片}。卡号优先;只给工单行id 时按行找卡。 */
    public Map<String, Object> detail(String cardNo, Long rowId) {
        Map<String, Object> head;
        if (blankToNull(cardNo) != null) {
            head = cardByNo(cardNo.trim());
        } else if (rowId != null) {
            List<Map<String, Object>> rs = jdbc.queryForList(HEAD_SELECT
                    + " WHERE c.工单行id=? AND ISNULL(c.asp_cancel,'N')<>'Y' ORDER BY c.id DESC", rowId);
            if (rs.isEmpty()) throw new IllegalArgumentException("该工单行还没有创建流程卡");
            head = rs.get(0);
        } else {
            throw new IllegalArgumentException("请提供卡号或工单行id");
        }
        return buildDetail(head);
    }

    /** 保存卡(备注 / 卡状态)。remark/status 为 null = 不改;"已完成" 前置=全部工序已完工且每道至少 1 张照片
     * (服务端强校验);置回"录入中" = 清确认留痕(设计要求:有 confirm 权即可,不锁到确认人本人)。 */
    @Transactional
    public Map<String, Object> save(String cardNo, String remark, String status, String user) {
        Map<String, Object> head = cardByNo(cardNo);
        long cardId = numLong(head.get("卡id"));
        String want = blankToNull(status);
        if (want != null && !STATUS_ENTRY.equals(want) && !STATUS_DONE.equals(want)) {
            throw new IllegalArgumentException("卡状态只能是「录入中」或「已完成」");
        }
        if (STATUS_DONE.equals(want)) {
            validateConfirm(cardNo);
            jdbc.update("UPDATE dbo.wo_proc_card_head SET 卡状态=N'" + STATUS_DONE
                    + "', 确认人=?, 确认时间=SYSDATETIME(), asp_user2=?, asp_time2=SYSDATETIME() WHERE id=?",
                    user, user, cardId);
        } else if (STATUS_ENTRY.equals(want)) {
            jdbc.update("UPDATE dbo.wo_proc_card_head SET 卡状态=N'" + STATUS_ENTRY
                    + "', 确认人=NULL, 确认时间=NULL, asp_user2=?, asp_time2=SYSDATETIME() WHERE id=?", user, cardId);
        }
        if (remark != null) {
            jdbc.update("UPDATE dbo.wo_proc_card_head SET 备注=?, asp_user2=?, asp_time2=SYSDATETIME() WHERE id=?",
                    blankToNull(remark), user, cardId);
        }
        return buildDetail(cardByNo(cardNo));
    }

    /** 「确认完成」前置:全部工序已完工 + 每道至少 1 张照片(设计 §1.5;前端只提示,这里硬拦) */
    private void validateConfirm(String cardNo) {
        List<Map<String, Object>> ops = opsOfCard(cardByNo(cardNo));
        if (ops.isEmpty()) throw new IllegalArgumentException("该卡没有工序行,不能确认完成");
        List<String> notDone = new ArrayList<>();
        List<String> noPhoto = new ArrayList<>();
        for (Map<String, Object> op : ops) {
            String name = str(op.get("工序"));
            if (!"已完工".equals(str(op.get("状态")))) notDone.add(name);
            if (numLong(op.get("照片数")) <= 0) noPhoto.add(name);
        }
        if (!notDone.isEmpty()) {
            throw new IllegalArgumentException("还有工序未完工(" + String.join("、", notDone) + "),不能确认完成");
        }
        if (!noPhoto.isEmpty()) {
            throw new IllegalArgumentException("工序还没有照片(" + String.join("、", noPhoto) + "),每道至少 1 张才能确认完成");
        }
    }

    /** 卡片列表(按产品物料查)。「工序进度」= 每道「已报工/计划数量」,已完工后加 ✓,全角分号连接(前端原样显示)。 */
    public Map<String, Object> list(String dm, String mc, String gg, String wo, String batch, String state,
                                    String from, String to, Integer pageNo, Integer pageSize) {
        List<Object> args = new ArrayList<>();
        StringBuilder w = new StringBuilder(" WHERE ISNULL(c.asp_cancel,'N')<>'Y'");
        appendLike(w, args, "ISNULL(c.产品编码,N'')", dm);
        appendLike(w, args, "ISNULL(c.产品名称,N'')", mc);
        appendLike(w, args, "ISNULL(c.规格型号,N'')", gg);
        appendLike(w, args, "c.工单号", wo);
        appendLike(w, args, "ISNULL(c.大批次号,N'')", batch);
        String st = blankToNull(state);
        if (st != null) { w.append(" AND ISNULL(c.卡状态,N'')=?"); args.add(st); }
        Date d1 = dayOf(from);
        if (d1 != null) { w.append(" AND c.asp_time1 >= ?"); args.add(d1); }
        Date d2 = dayOf(to);
        if (d2 != null) { w.append(" AND c.asp_time1 < ?"); args.add(new Date(d2.getTime() + 86_400_000L)); }
        Integer total = jdbc.queryForObject("SELECT COUNT(*) FROM dbo.wo_proc_card_head c" + w,
                Integer.class, args.toArray());
        int size = pageSize == null || pageSize <= 0 ? 50 : Math.min(pageSize, 200);
        int no = pageNo == null || pageNo <= 0 ? 1 : pageNo;
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add((no - 1) * size);
        pageArgs.add(size);
        List<Map<String, Object>> heads = jdbc.queryForList(
                HEAD_SELECT + w + " ORDER BY c.id DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY", pageArgs.toArray());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("总行数", total == null ? 0 : total);
        out.put("行", listRows(heads));
        return out;
    }

    /** 批次追溯:该批次下全部卡 + 汇总(卡数/产品数/计划量/各工序完成量)。 */
    public Map<String, Object> batchTrace(String batch) {
        String b = blankToNull(batch);
        if (b == null) throw new IllegalArgumentException("请提供批次号");
        List<Map<String, Object>> heads = jdbc.queryForList(HEAD_SELECT
                + " WHERE ISNULL(c.asp_cancel,'N')<>'Y' AND ISNULL(c.大批次号,N'')=? ORDER BY c.id DESC", b);
        for (Map<String, Object> h : heads) syncBatch(h);
        OpsView view = opsByCard(heads);
        List<Map<String, Object>> rows = rowsOf(heads, view);

        double planSum = 0;
        Map<String, Object> product = new HashMap<>();
        Map<String, double[]> opAgg = new LinkedHashMap<>();     // 工序 → [计划量, 已报工, 卡片数]
        Map<String, Integer> opSeq = new HashMap<>();
        for (Map<String, Object> r : rows) {
            planSum += num(r.get("计划数量"));
            String dm = str(r.get("产品编码"));
            if (!dm.isEmpty()) product.put(dm, Boolean.TRUE);
        }
        // 工序汇总 = 卡明细快照的计划量 + 现算已报工(每张卡同一工序只算一次)
        for (Map<String, Object> h : heads) {
            for (Map<String, Object> op : view.ops().getOrDefault(numLong(h.get("卡id")), List.of())) {
                String name = str(op.get("工序"));
                double[] st = opAgg.computeIfAbsent(name, k -> new double[3]);
                st[0] += num(op.get("计划数量"));
                st[1] += num(op.get("已报工"));
                st[2] += 1;
                opSeq.putIfAbsent(name, (int) numLong(op.get("工序序")));
            }
        }
        List<Map<String, Object>> opRows = new ArrayList<>();
        opAgg.entrySet().stream()
                .sorted((a, b2) -> Integer.compare(opSeq.getOrDefault(a.getKey(), 999), opSeq.getOrDefault(b2.getKey(), 999)))
                .forEach(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("工序", e.getKey());
                    m.put("计划量", e.getValue()[0]);
                    m.put("已报工", e.getValue()[1]);
                    m.put("卡片数", (long) e.getValue()[2]);
                    opRows.add(m);
                });
        Map<String, Object> sum = new LinkedHashMap<>();
        sum.put("卡数", heads.size());
        sum.put("产品数", product.size());
        sum.put("计划数量", planSum);
        sum.put("工序汇总", opRows);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("批次号", b);
        out.put("汇总", sum);
        out.put("卡片", rows);
        return out;
    }

    /** 单卡追溯:卡头 + 工序进度 + 报工记录 + 照片 + **工单追溯**(直接复用 {@link ScheduleBoardService#trace(String, Long)},
     * 按 工单号+工单行id 收敛);该段失败不拖垮整张卡(降级为一句错误,卡本身照常显示)。 */
    public Map<String, Object> trace(String cardNo) {
        Map<String, Object> d = buildDetail(cardByNo(cardNo));
        @SuppressWarnings("unchecked")
        Map<String, Object> head = (Map<String, Object>) d.get("头");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("卡", head);
        out.put("工序进度", d.get("工序行"));
        out.put("报工记录", d.get("报工记录"));
        out.put("照片", d.get("照片"));
        try {
            out.put("工单追溯", scheduleBoard.trace(str(head.get("工单号")), numLong(head.get("工单行id"))));
        } catch (RuntimeException e) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("错误", "工单追溯取数失败:" + e.getMessage());
            out.put("工单追溯", err);
        }
        return out;
    }

    private Map<String, Object> cardByNo(String cardNo) {
        List<Map<String, Object>> rs = jdbc.queryForList(
                HEAD_SELECT + " WHERE c.卡号=? AND ISNULL(c.asp_cancel,'N')<>'Y'", cardNo);
        if (rs.isEmpty()) throw new IllegalArgumentException("流程卡不存在或已作废:" + cardNo);
        return rs.get(0);
    }

    /** 按卡号取**全部**行(含软删),建卡时判「旧卡复活 / 卡号被占用」用 */
    private List<Map<String, Object>> cardsByNo(String cardNo) {
        return jdbc.queryForList("SELECT id AS 卡id, 工单行id, ISNULL(asp_cancel,N'N') AS asp_cancel"
                + " FROM dbo.wo_proc_card_head WHERE 卡号=?", cardNo);
    }

    /** 读卡时**自动同步大批次号**:卡在在制阶段建、当时批次是推定的「工单日期」,该行首次生产完工后真实批次出现
     * ⇒ 改成真实批次、来源转「生产批次」。卡号/小批次号**不动**(身份=工单行;改号会让照片附件的 doc_no 全对不上)。 */
    private Map<String, Object> syncBatch(Map<String, Object> head) {
        if (!SOURCE_DATE.equals(str(head.get("批次来源")))) return head;
        List<Map<String, Object>> rs = jdbc.queryForList("SELECT " + ROW_BATCH + " AS 批次号, "
                + ROW_BATCH_SOURCE + " AS 批次来源 FROM dbo.plang p" + ROW_BATCH_APPLY + " WHERE p.id=?",
                head.get("工单行id"));
        if (rs.isEmpty()) return head;
        String batch = str(rs.get(0).get("批次号"));
        if (!SOURCE_BATCH.equals(str(rs.get(0).get("批次来源"))) || batch.isEmpty()
                || batch.equals(str(head.get("大批次号")))) return head;
        jdbc.update("UPDATE dbo.wo_proc_card_head SET 大批次号=?, 批次来源=N'" + SOURCE_BATCH
                + "', asp_user2=N'system', asp_time2=SYSDATETIME() WHERE id=?", batch, head.get("卡id"));
        head.put("大批次号", batch);
        head.put("批次来源", SOURCE_BATCH);
        return head;
    }

    /** 卡详情组装(头 + 工序行 + 报工记录 + 照片) */
    private Map<String, Object> buildDetail(Map<String, Object> head) {
        syncBatch(head);
        List<Map<String, Object>> ops = opsOfCard(head);
        int photoTotal = 0;
        boolean canConfirm = !ops.isEmpty();
        for (Map<String, Object> op : ops) {
            photoTotal += (int) numLong(op.get("照片数"));
            if (!Boolean.TRUE.equals(op.get("可确认"))) canConfirm = false;
        }
        // 头视图:按设计 §3.5 的键序输出(不把内部列 卡id/创建时间 漏进契约)
        Map<String, Object> view = new LinkedHashMap<>();
        for (String k : new String[]{"卡号", "大批次号", "小批次号", "批次来源", "工单号", "工单行号", "工单行id",
                "产品编码", "产品名称", "规格型号", "计划数量", "生产线", "工艺路线", "卡状态", "确认人"}) {
            view.put(k, head.get(k));
        }
        view.put("确认时间", head.get("确认时间") == null ? "" : head.get("确认时间"));
        view.put("备注", head.get("备注"));
        view.put("照片数", photoTotal);
        view.put("可确认完成", canConfirm);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("头", view);
        out.put("工序行", ops);
        out.put("报工记录", reportRecords(str(head.get("工单号")), numLong(head.get("工单行id")),
                str(head.get("报工批次"))));
        out.put("照片", photosOfCard(str(head.get("卡号"))));
        return out;
    }

    /** 列表 / 批次追溯的卡片行(含「工序进度」文案与完成工序数) */
    private List<Map<String, Object>> listRows(List<Map<String, Object>> heads) {
        for (Map<String, Object> h : heads) syncBatch(h);
        return rowsOf(heads, opsByCard(heads));
    }

    private List<Map<String, Object>> rowsOf(List<Map<String, Object>> heads, OpsView view) {
        List<Map<String, Object>> out = new ArrayList<>(heads.size());
        for (Map<String, Object> h : heads) {
            List<Map<String, Object>> ops = view.ops().getOrDefault(numLong(h.get("卡id")), List.of());
            int doneOps = 0;
            StringBuilder progress = new StringBuilder();
            for (Map<String, Object> op : ops) {
                boolean done = "已完工".equals(str(op.get("状态")));
                if (done) doneOps++;
                if (progress.length() > 0) progress.append("；");
                progress.append(str(op.get("工序"))).append(' ')
                        .append(qty(op.get("已报工"))).append('/').append(qty(op.get("计划数量")));
                if (done) progress.append(" ✓");
            }
            // 行视图:按设计 §3.7 的键序(列表与批次追溯共用的卡片行结构)
            Map<String, Object> r = new LinkedHashMap<>();
            for (String k : new String[]{"卡号", "大批次号", "小批次号", "批次来源", "工单号", "工单行号",
                    "产品编码", "产品名称", "规格型号", "计划数量", "生产线", "卡状态"}) {
                r.put(k, h.get(k));
            }
            r.put("工序进度", progress.toString());
            r.put("完成工序数", doneOps);
            r.put("工序数", ops.size());
            r.put("照片数", view.photoTotals().getOrDefault(str(h.get("卡号")), 0));
            r.put("创建人", h.get("创建人"));
            r.put("更新时间", h.get("更新时间"));
            out.add(r);
        }
        return out;
    }

    /** 批量取数结果:卡id → 工序行;卡号 → 照片总数 */
    private record OpsView(Map<Long, List<Map<String, Object>>> ops, Map<String, Integer> photoTotals) { }

    /** 单卡工序行(详情用):批量组装之上补「报工人」(最近一笔报工的 ywman) */
    private List<Map<String, Object>> opsOfCard(Map<String, Object> head) {
        List<Map<String, Object>> ops = opsByCard(List.of(head)).ops()
                .getOrDefault(numLong(head.get("卡id")), List.of());
        Map<String, String> latest = latestReporters(numLong(head.get("工单行id")));
        for (Map<String, Object> op : ops) op.put("报工人", latest.getOrDefault(str(op.get("工序")), ""));
        return ops;
    }

    /** 批量组装工序行:卡明细快照 + 现算报工量 + 照片数。报工口径与 {@code WorkReportController.row} **逐条一致**:
     * 行锚 {@code scjl.gd_id → plang_pc.plang_id}(gd_id 是 plang_pc.id,**不是** plang.id);草稿期 {@code gd_id=0}
     * (审核时才写锚)按 {@code [批次号]} 兜底;已报工={@code wgzt='Y'},待审核=其余,作废行排除。
     * 只把「逐卡逐工序两次查询」改成一次集合查询(列表要一次算 50 张卡)。 */
    private OpsView opsByCard(List<Map<String, Object>> heads) {
        if (heads.isEmpty()) return new OpsView(Map.of(), Map.of());
        List<Object> cardIds = new ArrayList<>();
        List<Long> rowIds = new ArrayList<>();
        List<String> cardNos = new ArrayList<>();
        Map<Long, Long> rowOfCard = new HashMap<>();
        Map<Long, String> noOfCard = new HashMap<>();
        for (Map<String, Object> h : heads) {
            long cardId = numLong(h.get("卡id"));
            cardIds.add(cardId);
            rowIds.add(numLong(h.get("工单行id")));
            rowOfCard.put(cardId, numLong(h.get("工单行id")));
            noOfCard.put(cardId, str(h.get("卡号")));
            if (!str(h.get("卡号")).isEmpty()) cardNos.add(str(h.get("卡号")));
        }
        Map<Long, Map<String, Map<String, Object>>> aggs = opAggs(rowIds);
        Map<String, Map<String, Integer>> photoFields = photoFieldCounts(cardNos);
        Map<Long, List<Map<String, Object>>> byCard = new HashMap<>();
        for (Map<String, Object> d : jdbc.queryForList(
                "SELECT d.卡id, ISNULL(d.工序序,0) AS 工序序, ISNULL(d.工序,N'') AS 工序,"
                        + " ISNULL(d.工序编码,N'') AS 工序编码, ISNULL(d.生产车间,N'') AS 生产车间,"
                        + " CONVERT(float, ISNULL(d.计划数量,0)) AS 计划数量, d.id AS 明细id"
                        + " FROM dbo.wo_proc_card_detail d WHERE d.卡id IN (" + placeholders(cardIds.size()) + ")"
                        + " AND ISNULL(d.asp_cancel,'N')<>'Y' ORDER BY d.卡id, ISNULL(d.工序序,999), d.id",
                cardIds.toArray())) {
            long cardId = numLong(d.get("卡id"));
            String op = str(d.get("工序"));
            Map<String, Object> agg = aggs.getOrDefault(rowOfCard.getOrDefault(cardId, 0L), Map.of())
                    .getOrDefault(op, Map.of());
            double done = num(agg.get("已报工"));
            double plan = num(d.get("计划数量"));
            String state = opState(done, plan);
            // 照片按「工序照片-<工序序>」归组;键被写成「工序照片-<工序名>」时也认一次(不丢照片)
            Map<String, Integer> fields = photoFields.getOrDefault(noOfCard.getOrDefault(cardId, ""), Map.of());
            long seq = numLong(d.get("工序序"));
            int photos = fields.getOrDefault(PHOTO_OP_PREFIX + seq, 0)
                    + fields.getOrDefault(PHOTO_OP_PREFIX + op, 0);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", numLong(d.get("明细id")));
            m.put("工序序", seq);
            m.put("工序", op);
            m.put("工序编码", d.get("工序编码"));
            m.put("生产车间", d.get("生产车间"));
            m.put("计划数量", d.get("计划数量"));
            m.put("已报工", done);
            m.put("待审核", num(agg.get("待审核")));
            m.put("状态", state);
            m.put("完成时间", agg.get("完成时间") == null ? "" : agg.get("完成时间"));
            m.put("报工人", "");
            m.put("报工单数", numLong(agg.getOrDefault("报工单数", 0)));
            m.put("照片数", photos);
            m.put("可确认", "已完工".equals(state) && photos > 0);
            byCard.computeIfAbsent(cardId, k -> new ArrayList<>()).add(m);
        }
        Map<String, Integer> totals = new HashMap<>();
        photoFields.forEach((no, fields) -> totals.put(no, fields.values().stream().mapToInt(Integer::intValue).sum()));
        return new OpsView(byCard, totals);
    }

    /** 工序状态:已报工 ≥ 计划数量 → 已完工;> 0 → 进行中;否则未开始(计划量为 0 时按报工量判) */
    private static String opState(double done, double plan) {
        if (plan > 0 && done + 1e-6 >= plan) return "已完工";
        return done > 0 ? "进行中" : "未开始";
    }

    /** 行级报工聚合:工单行id → 工序 → {已报工, 待审核, 完成时间, 报工单数} */
    private Map<Long, Map<String, Map<String, Object>>> opAggs(List<Long> rowIds) {
        if (rowIds.isEmpty()) return Map.of();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT a.工单行id AS 行id, s.gxdm AS 工序,"
                        + " SUM(CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN ISNULL(s.sl,0) ELSE 0 END) AS 已报工,"
                        + " SUM(CASE WHEN ISNULL(s.wgzt,'N')<>'Y' THEN ISNULL(s.sl,0) ELSE 0 END) AS 待审核,"
                        + " CONVERT(varchar(19), MAX(CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN s.wgsj END),120) AS 完成时间,"
                        + " COUNT(*) AS 报工单数"
                        + " FROM (SELECT p.id AS 工单行id, p.pl_no, " + ROW_BATCH + " AS 批次号, "
                        + ROW_BATCH_ANCHOR + " AS 报工批次"
                        + "       FROM dbo.plang p" + ROW_BATCH_APPLY
                        + "       WHERE p.id IN (" + placeholders(rowIds.size()) + ")) a"
                        + " JOIN dbo.scjl s ON s.gldh=a.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y'"
                        + "   AND (EXISTS (SELECT 1 FROM dbo.plang_pc pca WHERE pca.id=s.gd_id AND pca.plang_id=a.工单行id)"
                        // 草稿期 gd_id=0(审核时才写锚):按本行批次兜底;"批次号为空"的行也认(开工早于批次生成)
                        + "        OR (ISNULL(s.gd_id,0)=0 AND (ISNULL(s.[批次号],N'')=ISNULL(a.报工批次,N'')"
                        + "                                       OR ISNULL(s.[批次号],N'')=N'')))"
                        + " GROUP BY a.工单行id, s.gxdm", rowIds.toArray());
        Map<Long, Map<String, Map<String, Object>>> out = new HashMap<>();
        for (Map<String, Object> r : rows) {
            out.computeIfAbsent(numLong(r.get("行id")), k -> new HashMap<>()).put(str(r.get("工序")), r);
        }
        return out;
    }

    /** 工单行 + 工序 → 最近一笔报工的报工人(设计要求「操作人 = 最近一笔报工的 ywman」) */
    private Map<String, String> latestReporters(long rowId) {
        Map<String, String> out = new HashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT s.gxdm AS 工序, ISNULL(s.ywman,N'') AS 报工人"
                        + " FROM (SELECT p.id AS 工单行id, p.pl_no, " + ROW_BATCH + " AS 批次号, "
                        + ROW_BATCH_ANCHOR + " AS 报工批次"
                        + "       FROM dbo.plang p" + ROW_BATCH_APPLY + " WHERE p.id=?) a"
                        + " JOIN dbo.scjl s ON s.gldh=a.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y'"
                        + "   AND (EXISTS (SELECT 1 FROM dbo.plang_pc pca WHERE pca.id=s.gd_id AND pca.plang_id=a.工单行id)"
                        + "        OR (ISNULL(s.gd_id,0)=0 AND (ISNULL(s.[批次号],N'')=ISNULL(a.报工批次,N'')"
                        + "                                       OR ISNULL(s.[批次号],N'')=N'')))"
                        + " ORDER BY s.id DESC", rowId)) {
            out.putIfAbsent(str(r.get("工序")), str(r.get("报工人")));
        }
        return out;
    }

    /** 该工单行的报工记录(倒序,卡是记录表,不按日期截断)。锚点与 {@link #opAggs} 完全同一口径。 */
    private List<Map<String, Object>> reportRecords(String wo, long rowId, String batch) {
        return jdbc.queryForList(
                "SELECT TOP 200 ISNULL(s.[报工单号],N'') AS 报工单号, ISNULL(s.gxdm,N'') AS 工序,"
                        + " CONVERT(float, ISNULL(s.sl,0)) AS 报工数量, ISNULL(s.ywman,N'') AS 报工人,"
                        + " ISNULL(s.wgzt,N'N') AS 完工状态, CONVERT(varchar(19), s.sc_date, 120) AS 单据日期"
                        + " FROM dbo.scjl s WHERE s.gldh=? AND ISNULL(s.asp_cancel,'N')<>'Y'"
                        + "   AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id=s.gd_id AND pc.plang_id=?)"
                        + "        OR (ISNULL(s.gd_id,0)=0 AND (ISNULL(s.[批次号],N'')=ISNULL(?,N'')"
                        + "                                       OR ISNULL(s.[批次号],N'')=N'')))"
                        + " ORDER BY s.id DESC", wo, rowId, batch);
    }

    /** 单卡照片:按 field_key 归组 → { "<工序序>": [照片…], "卡": [卡级照片…] } */
    private Map<String, List<Map<String, Object>>> photosOfCard(String cardNo) {
        Map<String, List<Map<String, Object>>> out = new LinkedHashMap<>();
        if (cardNo.isEmpty()) return out;
        for (Map<String, Object> a : jdbc.queryForList(
                "SELECT field_key AS 字段键, id, file_name AS fileName, file_size AS fileSize,"
                        + " asp_user1 AS uploader, CONVERT(varchar(19), asp_time1, 120) AS uploadTime"
                        + " FROM dbo.yj_attachment WHERE panel_code=? AND doc_no=? ORDER BY id", PANEL, cardNo)) {
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("id", a.get("id")); p.put("fileName", a.get("fileName"));
            p.put("fileSize", a.get("fileSize")); p.put("uploadTime", a.get("uploadTime"));
            p.put("uploader", a.get("uploader"));
            out.computeIfAbsent(photoGroupKey(str(a.get("字段键"))), k -> new ArrayList<>()).add(p);
        }
        return out;
    }

    /** field_key → 照片组键:工序照片-<工序序> ⇒ 工序序;卡照片 ⇒ "卡";其它 ⇒ "其他"(不丢照片) */
    private static String photoGroupKey(String fieldKey) {
        String k = fieldKey == null ? "" : fieldKey.trim();
        if (k.startsWith(PHOTO_OP_PREFIX)) {
            String seq = k.substring(PHOTO_OP_PREFIX.length()).trim();
            if (!seq.isEmpty()) return seq;
        }
        return PHOTO_CARD_FIELD.equals(k) ? "卡" : "其他";
    }

    /** 卡号 → field_key → 照片数(批量,列表用) */
    private Map<String, Map<String, Integer>> photoFieldCounts(List<String> cardNos) {
        Map<String, Map<String, Integer>> out = new HashMap<>();
        if (cardNos.isEmpty()) return out;
        List<Object> args = new ArrayList<>();
        args.add(PANEL);
        args.addAll(cardNos);
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT doc_no AS 卡号, ISNULL(field_key,N'') AS 字段键, COUNT(*) AS 张数"
                        + " FROM dbo.yj_attachment WHERE panel_code=? AND doc_no IN ("
                        + placeholders(cardNos.size()) + ") GROUP BY doc_no, field_key", args.toArray())) {
            out.computeIfAbsent(str(r.get("卡号")), k -> new HashMap<>())
                    .merge(str(r.get("字段键")), (int) numLong(r.get("张数")), Integer::sum);
        }
        return out;
    }

    /** 卡号 → 照片总数 */
    private Map<String, Integer> photoTotals(List<String> cardNos) {
        Map<String, Integer> out = new HashMap<>();
        photoFieldCounts(cardNos).forEach((no, fields) ->
                out.put(no, fields.values().stream().mapToInt(Integer::intValue).sum()));
        return out;
    }

    /** IN 占位符(表名/列名全部写死,只有值走参数,杜绝动态列名注入) */
    private static String placeholders(int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) sb.append(i == 0 ? "?" : ",?");
        return sb.toString();
    }

    private static void appendLike(StringBuilder w, List<Object> args, String column, String value) {
        String v = blankToNull(value);
        if (v == null) return;
        w.append(" AND ").append(column).append(" LIKE ?");
        args.add(like(v));
    }

    private static String like(String v) {
        return "%" + v.trim() + "%";
    }

    /** 日期入参:兼容 "yyyy-MM-dd" / 带时间的前 10 位;非法值 = 不加该过滤条件 */
    private static Date dayOf(String s) {
        String t = s == null ? "" : s.trim();
        if (t.length() < 10) return null;
        try { return Date.valueOf(t.substring(0, 10)); } catch (RuntimeException e) { return null; }
    }

    /** 数量文本:整数不带小数点(工序进度文案要给人看,3078.0000 太丑) */
    private static String qty(Object v) {
        double d = num(v);
        if (Math.abs(d - Math.rint(d)) < 1e-9) return String.valueOf((long) Math.rint(d));
        return new java.math.BigDecimal(String.valueOf(d)).stripTrailingZeros().toPlainString();
    }

    private static double num(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(str(v)); } catch (RuntimeException e) { return 0; }
    }

    private static long numLong(Object v) {
        if (v instanceof Number n) return n.longValue();
        try { return Long.parseLong(str(v)); } catch (RuntimeException e) { return 0; }
    }

    private static String str(Object v) {
        if (v == null) return "";
        String s = String.valueOf(v).trim();
        return "null".equalsIgnoreCase(s) ? "" : s;
    }

    private static String blankToNull(Object v) {
        String s = str(v);
        return s.isEmpty() ? null : s;
    }
}
