package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 采购订单「材料码打印」—— 供应商自行打码场景的**批次号登记与预约**(2026-10-04,
 * 方案见 docs/plans/2026-10-04-采购订单材料码批次号方案.md)。
 *
 * <h3>为什么有这张表</h3>
 * 批次号原本只在**生单那一刻**产生(见 {@link BatchService#buildBatchNo}),而供应商自己贴码时,
 * 标签上必须印批次号 —— 打印发生在生单之前,于是"打印时还没有号"。本服务把批次号**前移**到打印时:
 * 打印记录即该采购订单上批次号的**权威登记处**,生单只是**消费**它,不再按公式重算
 * (标签已贴在实物上,系统只能服从)。
 *
 * <h3>口径(用户 2026-10-04 拍板,含当日追加的「一次一行」修订)</h3>
 * <ul>
 *   <li>批次号默认 = {@link BatchService#buildBatchNo}(供应商编码, 当天),**可人工改**;</li>
 *   <li>**打印即预约**:未生单的预约量从「剩余可送 / 可送上限」里扣减;</li>
 *   <li><b>一次打印 = 一行 = 一张打印单</b>(用户 2026-10-04 追加口径:「打印需要是每次一行,
 *       不能多行否则作废就全部作废了」)⇒ 每次 {@link #print} 都**新建**一张头,
 *       绝不再把多行并进同一张单;因此唯一索引 {@code uq_bd_pu_label_order_batch}
 *       (订单+批次号)已按同一口径**废掉**(见 tools/migrate-pu-label-one-line-per-print.sql);</li>
 *   <li>**重打**走 {@link #reprint}:同一张纸原样再打一遍,只把 打印次数 +1,**不新增任何预约**
 *       (原先靠"复用头"实现的"重打不重复占用",现在由这个显式入口承担);</li>
 *   <li>作废打印记录 = 软删(asp_cancel='Y'),预约**立即释放**;一次一行 ⇒ 作废只影响那一行;</li>
 *   <li>**不建面板**(用户明确不要):不插 yj_panel/yj_field、不进菜单、不配权限。</li>
 * </ul>
 *
 * <h3>「已生单量」不落表,由 form_flow_link 派生(核心设计)</h3>
 * <pre>
 *   已生单量(订单行 × 批次号) = Σ form_flow_link.linked_quantity
 *        WHERE source_line_key = "{采购订单号}#{行id}" AND batch_no = 该批次号 AND link_status='ACTIVE'
 *   未生单预约量 = bl_pu_label.打印数量 − 已生单量
 * </pre>
 * 好处:下游单作废/删除时 {@link VoucherFlowService#release} 把 link 置 RELEASED ⇒ 预约**自动回落**,
 * 零额外回滚代码,且与「余量」口径同一真源(不会出现"预约说已生单、link 说没生"的两套账)。
 * 前置条件(2026-10-04 已具备):生单时把批次号写进 link,见
 * {@code PushGenerateHandler.generateBatch} 里那句 {@code UPDATE form_flow_link SET batch_no=...}。
 */
@Service
public class PuLabelService {

    /** 单号前缀:材料码 → MQ-yyyy-MM-nnnn(走 s_allno 号池,零面板成本) */
    private static final String PREFIX = "MQ";
    /** 批次号列宽对齐(与 sl_recv/bd_purchase_in 的 nvarchar(100) 同口径;超长先拦,免得落库被静默截断) */
    private static final int BATCH_NO_MAX = 100;
    /** 采购订单面板码 / 单头表 / 行表(本服务只服务这一条链) */
    private static final String PANEL = "PU_ORDER";
    private static final String HEAD_TABLE = "bd_pu_order";
    private static final String LINE_TABLE = "bl_pu_order";

    private final JdbcTemplate jdbc;
    private final FormNoService formNoService;
    private final BatchService batchService;

    public PuLabelService(JdbcTemplate jdbc, FormNoService formNoService, BatchService batchService) {
        this.jdbc = jdbc;
        this.formNoService = formNoService;
        this.batchService = batchService;
    }

    // ==================== ① 打印弹窗取数 ====================

    /**
     * 打印弹窗的一次性取数:订单行 + 每行的可打印量 + 预填批次号 + **本订单已有的打印记录**。
     * 「已有打印记录」就是方案里取代"查询面板"的反查入口(用户明确不要新加面板)——
     * 打开弹窗即能看到这批标签打过几次、还压着多少余量,并就地作废。
     */
    public Map<String, Object> dialog(String orderNo) {
        if (orderNo == null || orderNo.isBlank()) throw new IllegalArgumentException("缺少采购订单号");
        Map<String, Object> head = firstRow("SELECT TOP 1 [单据编号] AS no, ISNULL([供应商编码],N'') AS supplierCode,"
                + " ISNULL([供应商],N'') AS supplier, CONVERT(varchar(10),[单据日期],120) AS docDate"
                + " FROM " + HEAD_TABLE + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", orderNo);
        if (head == null) throw new IllegalArgumentException("采购订单不存在:" + orderNo);
        String supplierCode = str(head.get("supplierCode"));

        double ratio = batchService.overRatio();
        Map<String, Double> sentByKey = batchService.sentByLineKey(PANEL, orderNo);
        Map<String, Double> returnedByLine = batchService.returnedByOrderLine(orderNo);
        List<Map<String, Object>> labels = labelRows(orderNo);
        Map<Integer, List<Map<String, Object>>> byLine = groupByLine(labels);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> it : jdbc.queryForList(
                "SELECT id, [行号] AS 行号, [物料编码] AS 物料编码, [物料名称] AS 物料名称, [规格型号] AS 规格型号,"
                        + " [单位] AS 计量单位, ISNULL([数量],0) AS 数量"
                        + " FROM " + LINE_TABLE + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id", orderNo)) {
            int lineId = (int) num(it.get("id"));
            double qty = num(it.get("数量"));
            double used = sentByKey.getOrDefault(orderNo + "#" + lineId, 0d);
            double ret = returnedByLine.getOrDefault(str(it.get("行号")), 0d);
            List<Map<String, Object>> mine = byLine.getOrDefault(lineId, List.of());
            double reserved = sumPending(mine);                                   // 已打印未生单
            double printed = mine.stream().mapToDouble(r -> num(r.get("打印数量"))).sum();
            double allowed = batchService.overAllowance(qty, used, ret, ratio);   // 该行还能收多少(含超送)
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", lineId);
            row.put("行号", it.get("行号"));
            row.put("物料编码", it.get("物料编码"));
            row.put("物料名称", it.get("物料名称"));
            row.put("规格型号", it.get("规格型号"));
            row.put("计量单位", it.get("计量单位"));
            row.put("数量", qty);
            row.put("已送数量", used);
            row.put("已退回数量", ret);
            row.put("已打印数量", printed);            // 累计打印(含已生单的)
            row.put("未生单预约", reserved);
            // 剩余可打 = 该行头寸 − 已被预约占住的部分;负数归 0(已预约满就打不了新的)
            row.put("剩余可打", Math.max(0d, allowed - reserved));
            rows.add(row);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("采购订单号", orderNo);
        out.put("供应商编码", supplierCode);
        out.put("供应商", head.get("supplier"));
        out.put("单据日期", head.get("docDate"));
        out.put("overRatio", ratio);
        // 预填批次号:与生单同一公式(供应商编码去 YJ- 前缀 + - + 当天),可人工改
        out.put("prefBatchNo", BatchService.buildBatchNo(supplierCode, LocalDate.now()));
        out.put("lines", rows);
        out.put("records", records(labels));      // 已有打印记录(取代查询面板的反查入口)
        return out;
    }

    /** 已有打印记录(按头聚合;未生单合计 = 还压着多少余量;带 lines 供「重打」原样再打) */
    private List<Map<String, Object>> records(List<Map<String, Object>> labels) {
        Map<String, Map<String, Object>> byDoc = new LinkedHashMap<>();
        for (Map<String, Object> r : labels) {
            String docNo = str(r.get("单据编号"));
            Map<String, Object> rec = byDoc.computeIfAbsent(docNo, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("单据编号", docNo);
                m.put("批次号", r.get("批次号"));
                m.put("打印人", r.get("打印人"));
                m.put("打印时间", r.get("打印时间"));
                m.put("打印次数", r.get("打印次数"));
                m.put("行数", 0);
                m.put("打印量合计", 0d);
                m.put("已生单合计", 0d);
                m.put("未生单合计", 0d);
                m.put("lines", new ArrayList<Map<String, Object>>());
                return m;
            });
            rec.put("行数", (int) rec.get("行数") + 1);
            rec.put("打印量合计", round2(num(rec.get("打印量合计")) + num(r.get("打印数量"))));
            rec.put("已生单合计", round2(num(rec.get("已生单合计")) + num(r.get("已生单量"))));
            rec.put("未生单合计", round2(num(rec.get("未生单合计")) + num(r.get("未生单量"))));
            // 「重打」要用:该单每行的物料与数量(一次一行 ⇒ 实际只有一行,历史单可能多行,故按列表给)
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> lines = (List<Map<String, Object>>) rec.get("lines");
            Map<String, Object> lb = new LinkedHashMap<>();
            lb.put("行号", r.get("采购订单行号"));
            lb.put("物料编码", r.get("物料编码"));
            lb.put("物料名称", r.get("物料名称"));
            lb.put("规格型号", r.get("规格型号"));
            lb.put("计量单位", r.get("计量单位"));
            lb.put("打印数量", r.get("打印数量"));
            lines.add(lb);
        }
        return new ArrayList<>(byDoc.values());
    }

    // ==================== ② 登记打印(一次一行 = 一张单) ====================

    /**
     * 登记一次打印:**只接受一行**,并**新建**一张材料码打印单(头 + 行),返回打印单号与数量(前端据此出纸)。
     *
     * <p><b>为什么一次只允许一行</b>(用户 2026-10-04 追加口径「打印需要是每次一行,不能多行否则作废就全部作废了」):
     * 作废是按**单据编号**整张作的 —— 多行挤在一张单里,作废其中一行就必然连累其余行。
     * 因此这里把粒度钉死成"一次一行一张单":{@code rows.size() != 1} 直接拒绝,
     * 并且**不再复用同(订单,批次号)的头**(那条唯一索引已随本口径废弃)。
     *
     * <p><b>重打</b>请走 {@link #reprint}:同一张单原样再打一遍,只累加 打印次数、不新增预约。
     *
     * <p><b>上限(服务端重算,不信前端)</b>:
     * {@code 打印数量 ≤ 该行头寸 − 其它存活打印行的未生单量}(本单是新建的,没有"自己已占"的量要加回)。
     *
     * @param rows [{采购订单行id, 打印数量}] —— **长度必须为 1**
     */
    @Transactional
    public Map<String, Object> print(String orderNo, String batchNo, List<Map<String, Object>> rows, String user) {
        if (orderNo == null || orderNo.isBlank()) throw new IllegalArgumentException("缺少采购订单号");
        String no = str(batchNo);
        if (no.isEmpty()) throw new IllegalArgumentException("批次号不能为空");
        if (no.length() > BATCH_NO_MAX) throw new IllegalArgumentException("批次号过长(最多 " + BATCH_NO_MAX + " 个字符):" + no);
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("请勾选一行并填写本次打印数量");
        if (rows.size() != 1) {
            throw new IllegalArgumentException("一次只能打印一行(" + rows.size() + " 行会并进同一张打印单,作废时会一起作废):"
                    + "请分次打印");
        }

        Map<String, Object> head = firstRow("SELECT TOP 1 ISNULL([供应商编码],N'') AS supplierCode FROM " + HEAD_TABLE
                + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", orderNo);
        if (head == null) throw new IllegalArgumentException("采购订单不存在:" + orderNo);

        // 一次一行一张单:每次打印都新建头(不再按 订单+批次号 复用;重打走 reprint)
        String docNo = formNoService.next(PREFIX, user);
        jdbc.update("INSERT INTO bd_pu_label ([单据编号],[单据日期],[采购订单号],[供应商编码],[批次号],"
                        + " [打印人],[打印时间],[打印次数],asp_user1,asp_time1,asp_cancel)"
                        + " VALUES (?,?,?,?,?,?,SYSDATETIME(),1,?,SYSDATETIME(),'N')",
                docNo, LocalDate.now(), orderNo, str(head.get("supplierCode")), no, user, user);

        // 上限校验;先把该单的订单行快照读出来,避免每行一次查询
        Map<String, Double> sentByKey = batchService.sentByLineKey(PANEL, orderNo);
        Map<String, Double> returnedByLine = batchService.returnedByOrderLine(orderNo);
        double ratio = batchService.overRatio();
        List<Map<String, Object>> orderLines = jdbc.queryForList(
                "SELECT id, [行号] AS 行号, [物料编码] AS 物料编码, [物料名称] AS 物料名称, [规格型号] AS 规格型号,"
                        + " [单位] AS 计量单位, ISNULL([数量],0) AS 数量"
                        + " FROM " + LINE_TABLE + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id", orderNo);
        List<Map<String, Object>> labels = labelRows(orderNo);
        List<Map<String, Object>> outRows = new ArrayList<>();
        List<String> over = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            int lineId = (int) num(r.get("采购订单行id"));
            double qty = num(r.get("打印数量"));
            Map<String, Object> line = orderLines.stream().filter(x -> (int) num(x.get("id")) == lineId).findFirst().orElse(null);
            if (line == null) throw new IllegalArgumentException("采购订单行不存在或已作废:行id " + lineId);
            if (qty <= 0) continue;
            double orderQty = num(line.get("数量"));
            double used = sentByKey.getOrDefault(orderNo + "#" + lineId, 0d);
            double ret = returnedByLine.getOrDefault(str(line.get("行号")), 0d);
            double allowed = batchService.overAllowance(orderQty, used, ret, ratio);
            // 其它存活打印行压着的量(本单是新建的,不含自己)
            double others = 0d;
            for (Map<String, Object> lb : labels) {
                if ((int) num(lb.get("采购订单行id")) != lineId) continue;
                others += num(lb.get("未生单量"));
            }
            double cap = allowed - others;
            if (qty > cap + 0.000001) {
                over.add("第 " + str(line.get("行号")) + " 行:本次打印 " + trim(qty) + " 超出可打印量 " + trim(cap)
                        + "(订单数量 " + trim(orderQty) + " ×(1+超送比例 " + Math.round(ratio * 100) + "%)− 已送 "
                        + trim(used) + " + 已退回 " + trim(ret) + " − 其它打印记录已预约 "
                        + trim(others) + ")");
                continue;
            }
            jdbc.update("INSERT INTO bl_pu_label ([单据编号],[采购订单行号],[采购订单行id],[物料编码],[物料名称],"
                            + " [规格型号],[计量单位],[打印数量],asp_user1,asp_time1,asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,SYSDATETIME(),'N')",
                    docNo, line.get("行号"), lineId, line.get("物料编码"), line.get("物料名称"),
                    line.get("规格型号"), line.get("计量单位"), qty, user);
            Map<String, Object> o = new LinkedHashMap<>();
            o.put("采购订单行id", lineId);
            o.put("行号", line.get("行号"));
            o.put("物料编码", line.get("物料编码"));
            o.put("物料名称", line.get("物料名称"));
            o.put("规格型号", line.get("规格型号"));
            o.put("计量单位", line.get("计量单位"));
            o.put("打印数量", qty);
            outRows.add(o);
        }
        if (!over.isEmpty()) {
            // 有超限行 → 整笔回滚(事务),把问题行一次说清,而不是只报第一条
            throw new IllegalStateException(String.join(";", over));
        }
        if (outRows.isEmpty()) throw new IllegalStateException("本次没有可打印的数量(打印数量为 0)");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("单据编号", docNo);
        out.put("批次号", no);
        out.put("采购订单号", orderNo);
        out.put("供应商编码", str(head.get("supplierCode")));
        out.put("打印次数", 1);
        out.put("lines", outRows);
        return out;
    }

    /**
     * 重打:把**同一张**材料码打印单原样再打一遍(纸卡了/打歪了),只把 打印次数 +1。
     *
     * <p>**不新增任何预约** —— 这正是原先"复用同一张头"承担的语义(重打不重复占量),
     * 改成"一次一行一张单"之后必须由本入口承担,否则重打会被当成新打印而重复扣量。
     * 返回该单的行(物料/规格/数量),前端据此重新出纸。已作废的单不能重打。
     */
    @Transactional
    public Map<String, Object> reprint(String docNo, String user) {
        String no = str(docNo);
        if (no.isEmpty()) throw new IllegalArgumentException("缺少打印单号");
        Map<String, Object> head = firstRow("SELECT TOP 1 [采购订单号] AS orderNo, [批次号] AS batchNo,"
                + " [供应商编码] AS supplierCode FROM bd_pu_label WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (head == null) throw new IllegalStateException("打印记录不存在或已作废:" + no);
        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT [采购订单行号] AS 行号, [物料编码] AS 物料编码, [物料名称] AS 物料名称,"
                        + " [规格型号] AS 规格型号, [计量单位] AS 计量单位, ISNULL([打印数量],0) AS 打印数量"
                        + " FROM bl_pu_label WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id", no);
        if (lines.isEmpty()) throw new IllegalStateException("该打印单没有存活行,无法重打:" + no);
        jdbc.update("UPDATE bd_pu_label SET [打印人] = ?, [打印时间] = SYSDATETIME(),"
                + " [打印次数] = ISNULL([打印次数],0) + 1, asp_user2 = ?, asp_time2 = SYSDATETIME()"
                + " WHERE [单据编号] = ?", user, user, no);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("单据编号", no);
        out.put("批次号", head.get("batchNo"));
        out.put("采购订单号", head.get("orderNo"));
        out.put("供应商编码", str(head.get("supplierCode")));
        out.put("打印次数", (int) num(firstRow("SELECT ISNULL([打印次数],0) AS t FROM bd_pu_label WHERE [单据编号]=?", no).get("t")));
        out.put("lines", lines);
        return out;
    }

    // ==================== ③ 作废(软删,预约自动释放) ====================

    /**
     * 作废一张材料码打印单:头 + 行一并软删(asp_cancel='Y')。
     * 预约量因此立刻从余量里**释放**(预约是"存活打印行"派生出来的,软删即消失)——
     * 这是方案里"打印即占用"必须配的释放出口:打错了、货不来了都能回到可送状态。
     */
    @Transactional
    public Map<String, Object> voidDoc(String docNo, String user) {
        String no = str(docNo);
        if (no.isEmpty()) throw new IllegalArgumentException("缺少打印单号");
        Map<String, Object> row = firstRow("SELECT TOP 1 [采购订单号] AS orderNo, [批次号] AS batchNo FROM bd_pu_label"
                + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (row == null) throw new IllegalStateException("打印记录不存在或已作废:" + no);
        int n = jdbc.update("UPDATE bl_pu_label SET asp_cancel='Y', asp_user2=?, asp_time2=SYSDATETIME()"
                + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", user, no);
        jdbc.update("UPDATE bd_pu_label SET asp_cancel='Y', asp_user2=?, asp_time2=SYSDATETIME() WHERE [单据编号] = ?", user, no);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("单据编号", no);
        out.put("采购订单号", row.get("orderNo"));
        out.put("批次号", row.get("batchNo"));
        out.put("作废行数", n);
        return out;
    }

    // ==================== ④ 预约 / 已生单量(供 batchLines 与生单校验) ====================

    /**
     * 该订单**全部存活打印行**,每行带派生出来的 已生单量 / 未生单量。
     * 字段:单据编号 / 批次号 / 采购订单行id / 采购订单行号 / 物料编码 / 物料名称 / 规格型号 / 计量单位 /
     * 打印数量 / 已生单量 / 未生单量 / 打印时间 / 打印次数。
     *
     * <p>⚠ **已生单量按「隔离行的专属 lineKey」派生**({@code {采购订单号}#{行id}@{本行id}}):
     * 生单时那一行走的是自己的键(见 PushGenerateHandler.isolatedLineKey 的注释 —— 否则用同一个
     * 批次号混单时会把"原行送的"也算进"已打印行送的")。所以这里必须用同一个键去数 link,
     * 两处口径必须一致,改一处就得改另一处。
     */
    public List<Map<String, Object>> labelRows(String orderNo) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT l.id AS 行id, l.[采购订单行id] AS 采购订单行id, l.[采购订单行号] AS 采购订单行号,"
                        + " l.[物料编码] AS 物料编码, l.[物料名称] AS 物料名称, l.[规格型号] AS 规格型号,"
                        + " l.[计量单位] AS 计量单位, ISNULL(l.[打印数量],0) AS 打印数量,"
                        + " h.[单据编号] AS 单据编号, h.[批次号] AS 批次号,"
                        + " h.[打印人] AS 打印人, CONVERT(varchar(19), h.[打印时间], 120) AS 打印时间,"
                        + " ISNULL(h.[打印次数],0) AS 打印次数,"
                        // 已生单量:**派生**,不落表 —— 下游单作废/删除时 link 置 RELEASED,这里自动回落
                        + " ISNULL((SELECT SUM(COALESCE(f.linked_quantity,0)) FROM form_flow_link f"
                        + "         WHERE f.source_panel_code = 'PU_ORDER'"
                        + "           AND f.source_line_key = h.[采购订单号] + N'#' + CAST(l.[采购订单行id] AS nvarchar(20))"
                        + "                                 + N'@' + CAST(l.id AS nvarchar(20))"
                        + "           AND f.link_status = 'ACTIVE'), 0) AS 已生单量"
                        + " FROM bl_pu_label l JOIN bd_pu_label h ON h.[单据编号] = l.[单据编号]"
                        + " WHERE h.[采购订单号] = ? AND ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(l.asp_cancel,'N') <> 'Y'"
                        + " ORDER BY h.[批次号], l.[采购订单行号], l.id", orderNo);
        for (Map<String, Object> r : rows) {
            double printed = num(r.get("打印数量"));
            double generated = num(r.get("已生单量"));
            r.put("打印数量", round2(printed));
            r.put("已生单量", round2(generated));
            r.put("未生单量", round2(Math.max(0d, printed - generated)));
        }
        return rows;
    }

    // ==================== 小工具 ====================

    private static Map<Integer, List<Map<String, Object>>> groupByLine(List<Map<String, Object>> rows) {
        Map<Integer, List<Map<String, Object>>> out = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) out.computeIfAbsent((int) num(r.get("采购订单行id")), k -> new ArrayList<>()).add(r);
        return out;
    }

    /** 若干打印行的未生单量合计(打印弹窗按行展示"还压着多少"用) */
    private static double sumPending(List<Map<String, Object>> rows) {
        double v = 0d;
        for (Map<String, Object> r : rows) v += num(r.get("未生单量"));
        return round2(v);
    }

    private Map<String, Object> firstRow(String sql, Object... args) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private static double num(Object o) {
        if (o instanceof Number n) return n.doubleValue();
        if (o == null || String.valueOf(o).isBlank()) return 0d;
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return 0d; }
    }

    private static double round2(double v) { return Math.round(v * 100.0) / 100.0; }

    /** 数量展示:整数不带小数点(与前端口径一致) */
    private static String trim(double v) {
        return Math.abs(v - Math.rint(v)) < 1e-9 ? String.valueOf((long) Math.rint(v)) : String.valueOf(round2(v));
    }

    private static String str(Object o) { return o == null ? "" : String.valueOf(o).trim(); }
}
