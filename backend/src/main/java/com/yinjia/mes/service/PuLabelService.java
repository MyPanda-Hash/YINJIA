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
 * <h3>口径(用户 2026-10-04 拍板,含当日追加的「一次可多行、但一行一张单」修订)</h3>
 * <ul>
 *   <li>批次号默认 = {@link BatchService#buildBatchNo}(供应商编码, 当天),**可人工改**;</li>
 *   <li>**打印即预约**:未生单的预约量从「剩余可送 / 可送上限」里扣减;</li>
 *   <li><b>一次可以勾多行,但**每行各出一张单**</b>(用户 2026-10-04 两条口径合起来:「打印需要是每次一行,
 *       不能多行否则作废就全部作废了」+「一次是可以打印多行的」)⇒ 弹窗上多选,落库时**一行一张头**,
 *       粒度钉在"单"上(作废按单作);唯一索引 {@code uq_bd_pu_label_order_batch}(订单+批次号)已按同一口径
 *       **废掉**(见 tools/migrate-pu-label-one-line-per-print.sql),否则同号打第二行会被唯一键顶掉;</li>
 *   <li>**重打**走 {@link #reprint}:同一张纸原样再打一遍,只把 打印次数 +1,**不新增任何预约**
 *       (原先靠"复用头"实现的"重打不重复占用",现在由这个显式入口承担);</li>
 *   <li>作废打印记录 = 软删(asp_cancel='Y'),预约**立即释放**;一行一张单 ⇒ 作废只影响那一行;</li>
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
        // 已生单批次明细(补登用):每个「订单行 × 已生单批次号」的已收量
        List<Map<String, Object>> supplements = supplementRows(orderNo, labels);

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
            double reserved = sumPending(mine);                                   // 已打印未生单(不含补登)
            double printed = mine.stream().filter(r -> !isSupplement(r)).mapToDouble(r -> num(r.get("打印数量"))).sum();
            double marked = mine.stream().filter(PuLabelService::isSupplement)
                    .mapToDouble(r -> num(r.get("打印数量"))).sum();              // 已补登打印量
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
            row.put("已打印数量", printed);            // 累计待生单打印(不含补登)
            row.put("已补登数量", round2(marked));      // 已生单补登打印量
            row.put("未生单预约", reserved);
            // 剩余可打 = 该行头寸 − 已被预约占住的部分;负数归 0(已预约满就打不了新的)
            row.put("剩余可打", Math.max(0d, allowed - reserved));
            // 可补登 = 该行**已收(已生单)但还没打码**的量 = 已送 − 已补登(不按批次拆的口径,仅用于概览)
            row.put("可补登数量", round2(Math.max(0d, used - marked)));
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
        out.put("补登行", supplements);             // 下层表「已生单可补打」:按订单行×已生单批次号
        out.put("records", records(labels));      // 已有打印记录(取代查询面板的反查入口)
        return out;
    }

    /** 打印行是否「已生单补登」(Y=给已收的量补打码:不预约、不出隔离行) */
    private static boolean isSupplement(Map<String, Object> labelRow) {
        return "Y".equalsIgnoreCase(str(labelRow.get("补登")));
    }

    /**
     * 下层表「已生单可补打」的数据:每个「订单行 × 已生单批次号」一行。
     *
     * <pre>
     *   已收量(该行该批次)  = Σ form_flow_link.linked_quantity
     *        WHERE source_line_key = "{采购订单号}#{行id}"(**不含隔离行键**) AND batch_no = 该批次号 AND ACTIVE
     *   已补登量            = Σ bl_pu_label.打印数量 WHERE 补登='Y' AND 同一行同一批次号
     *   可补登量            = 已收量 − 已补登量
     * </pre>
     *
     * 为什么按批次拆:补登的码必须印**该批货单据上的那个批次号**(标签与实物/单据同号),
     * 而同一订单行的货可能是分几批收的、批次号各不相同。
     */
    private List<Map<String, Object>> supplementRows(String orderNo, List<Map<String, Object>> labels) {
        Map<String, Map<String, Object>> received = new LinkedHashMap<>();
        try {
            jdbc.query("SELECT source_line_key AS k, ISNULL(batch_no, N'') AS b, SUM(COALESCE(linked_quantity,0)) AS q,"
                            + " MAX(target_form_no) AS t"
                            + " FROM form_flow_link"
                            + " WHERE source_panel_code = ? AND source_form_no = ? AND link_status = 'ACTIVE'"
                            + "   AND source_line_key NOT LIKE N'%@%' AND ISNULL(batch_no, N'') <> N''"
                            + " GROUP BY source_line_key, ISNULL(batch_no, N'')",
                    rs -> {
                        String key = rs.getString("k");
                        String batch = str(rs.getString("b"));
                        int hash = key == null ? -1 : key.lastIndexOf('#');
                        if (hash < 0 || batch.isEmpty()) return;
                        String lineId = key.substring(hash + 1).trim();
                        received.put(lineId + "\u0001" + batch, new LinkedHashMap<>(Map.of(
                                "lineId", lineId, "批次号", batch,
                                "已收数量", rs.getDouble("q"),
                                "去向单据", str(rs.getString("t")))));
                    }, PANEL, orderNo);
        } catch (Exception ignore) { /* 表未建:退化为没有可补登的行 */ }

        // 已补登量:按 (行id, 批次号) 聚合
        Map<String, Double> marked = new LinkedHashMap<>();
        for (Map<String, Object> r : labels) {
            if (!isSupplement(r)) continue;
            String k = intOf(r.get("采购订单行id")) + "\u0001" + str(r.get("批次号"));
            marked.merge(k, num(r.get("打印数量")), Double::sum);
        }

        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> it : jdbc.queryForList(
                "SELECT id, [行号] AS 行号, [物料编码] AS 物料编码, [物料名称] AS 物料名称, [规格型号] AS 规格型号,"
                        + " [单位] AS 计量单位 FROM " + LINE_TABLE
                        + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id", orderNo)) {
            int lineId = (int) num(it.get("id"));
            for (Map<String, Object> rec : received.values()) {
                if (!String.valueOf(lineId).equals(str(rec.get("lineId")))) continue;
                String batch = str(rec.get("批次号"));
                double got = num(rec.get("已收数量"));
                double done = marked.getOrDefault(lineId + "\u0001" + batch, 0d);
                double can = Math.max(0d, got - done);
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("采购订单行id", lineId);
                row.put("行号", it.get("行号"));
                row.put("物料编码", it.get("物料编码"));
                row.put("物料名称", it.get("物料名称"));
                row.put("规格型号", it.get("规格型号"));
                row.put("计量单位", it.get("计量单位"));
                row.put("批次号", batch);
                row.put("去向单据", rec.get("去向单据"));
                row.put("已收数量", round2(got));
                row.put("已补登数量", round2(done));
                row.put("可补登数量", round2(can));      // 本次最多能补登这么多
                out.add(row);
            }
        }
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
                m.put("补登", true);                 // 下面按行累积,全为补登才是补登单
                return m;
            });
            rec.put("行数", (int) rec.get("行数") + 1);
            rec.put("补登", boolOf(rec.get("补登")) && isSupplement(r));
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

    // ==================== ② 登记打印(一次可多行,但**每行各出一张单**) ====================

    /**
     * 登记一次打印:接受**一行或多行**,并**每行新建一张**材料码打印单(头 + 行),
     * 返回本次生成的单号列表与逐行数量(前端据此出纸)。
     *
     * <p><b>为什么"一次可以打多行,却要每行一张单"</b>(用户 2026-10-04 两条口径合起来):
     * 先提「打印需要是每次一行,不能多行否则作废就全部作废了」,再补「一次是可以打印多行的」——
     * 即:**弹窗上可以一次勾多行**(操作便利),但落到库里必须**一行一张单**,
     * 因为作废是按**单据编号**整张作的:{@code voidDoc} 一作废就是一张单里的所有行。
     * 所以粒度钉在"单"上:勾 3 行 ⇒ 3 张单(同一个批次号、3 个单号),作废其中一张只影响它那一行。
     *
     * <p><b>重打</b>请走 {@link #reprint}:同一张单原样再打一遍,只累加 打印次数、不新增预约。
     *
     * <p><b>上限(服务端重算,不信前端)</b>:逐行
     * {@code 打印数量 ≤ 该行头寸 − 其它存活打印行的未生单量}。同一请求里若有重复行,直接拒
     * (否则两段数量会各按"未含对方"的额度算,合起来可能超)。
     *
     * @param rows [{采购订单行id, 打印数量}] —— 一行或多行,但**每行一张单**
     */
    @Transactional
    public Map<String, Object> print(String orderNo, String batchNo, List<Map<String, Object>> rows, String user) {
        if (orderNo == null || orderNo.isBlank()) throw new IllegalArgumentException("缺少采购订单号");
        String no = str(batchNo);
        // 顶部批次号可以为空 —— 只要**每一行都自带批次号**(补登行必须自带:它要跟已生单单据同号)。
        // 逐行的空值在下面的循环里判,避免"只勾补登行"被顶部的空号误伤。
        if (no.length() > BATCH_NO_MAX) throw new IllegalArgumentException("批次号过长(最多 " + BATCH_NO_MAX + " 个字符):" + no);
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("请至少勾选一行并填写本次打印数量");
        java.util.Set<Integer> seen = new java.util.HashSet<>();
        for (Map<String, Object> r : rows) {
            if (!seen.add((int) num(r.get("采购订单行id")))) {
                throw new IllegalArgumentException("同一订单行在一次打印里出现了两次:行id " + (int) num(r.get("采购订单行id"))
                        + "(请合并成一行,或分两次打印)");
            }
        }

        Map<String, Object> head = firstRow("SELECT TOP 1 ISNULL([供应商编码],N'') AS supplierCode FROM " + HEAD_TABLE
                + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", orderNo);
        if (head == null) throw new IllegalArgumentException("采购订单不存在:" + orderNo);

        Map<String, Double> sentByKey = batchService.sentByLineKey(PANEL, orderNo);
        Map<String, Double> returnedByLine = batchService.returnedByOrderLine(orderNo);
        double ratio = batchService.overRatio();
        List<Map<String, Object>> orderLines = jdbc.queryForList(
                "SELECT id, [行号] AS 行号, [物料编码] AS 物料编码, [物料名称] AS 物料名称, [规格型号] AS 规格型号,"
                        + " [单位] AS 计量单位, ISNULL([数量],0) AS 数量"
                        + " FROM " + LINE_TABLE + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id", orderNo);
        List<Map<String, Object>> labels = labelRows(orderNo);
        // 补登行的上限 = 该行该批次的「已收 − 已补登」;先按 (行id,批次号) 备好
        Map<String, Double> supCan = new LinkedHashMap<>();
        Map<String, String> supDoc = new LinkedHashMap<>();
        for (Map<String, Object> s : supplementRows(orderNo, labels)) {
            String k = intOf(s.get("采购订单行id")) + "\u0001" + str(s.get("批次号"));
            supCan.put(k, num(s.get("可补登数量")));
            supDoc.put(k, str(s.get("去向单据")));
        }
        List<Map<String, Object>> outRows = new ArrayList<>();
        List<String> docNos = new ArrayList<>();
        List<String> over = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            int lineId = (int) num(r.get("采购订单行id"));
            double qty = num(r.get("打印数量"));
            boolean supplement = boolOf(r.get("补登"));
            // 补登行必须自带批次号(要跟已生单单据同号);常规行可用顶部输入框的号
            String rowBatch = str(r.get("批次号"));
            if (rowBatch.isEmpty()) rowBatch = no;
            if (rowBatch.length() > BATCH_NO_MAX) {
                throw new IllegalArgumentException("批次号过长(最多 " + BATCH_NO_MAX + " 个字符):" + rowBatch);
            }
            Map<String, Object> line = orderLines.stream().filter(x -> (int) num(x.get("id")) == lineId).findFirst().orElse(null);
            if (line == null) throw new IllegalArgumentException("采购订单行不存在或已作废:行id " + lineId);
            if (rowBatch.isEmpty()) {
                throw new IllegalArgumentException((supplement ? "「已生单补打」行必须带批次号(取该批货单据上的号)"
                        : "批次号不能为空") + ":行 " + str(line.get("行号")));
            }
            if (qty <= 0) continue;
            if (supplement) {
                // ★ 已生单补登:只为**已收(已生单)**的量补打码 —— 不预约、不出隔离行,上限 = 已收 − 已补登
                double capSup = supCan.getOrDefault(lineId + "\u0001" + rowBatch, -1d);
                if (capSup < 0d) {
                    over.add("第 " + str(line.get("行号")) + " 行:批次号 " + rowBatch
                            + " 上没有已生单(已收)的量,不能按「已生单补打」打印");
                    continue;
                }
                if (qty > capSup + 0.000001) {
                    over.add("第 " + str(line.get("行号")) + " 行:批次号 " + rowBatch + " 补打 " + trim(qty)
                            + " 超出可补打量 " + trim(capSup) + "(已收 " + trim(num(supCan.get(lineId + "\u0001" + rowBatch)))
                            + " − 已补登 —— 已经打过码的那部分不再重复补)");
                    continue;
                }
            } else {
                double orderQty = num(line.get("数量"));
                double used = sentByKey.getOrDefault(orderNo + "#" + lineId, 0d);
                double ret = returnedByLine.getOrDefault(str(line.get("行号")), 0d);
                double allowed = batchService.overAllowance(orderQty, used, ret, ratio);
                // 其它存活**待生单**打印行压着的量(补登行不预约,不算;本次请求里前面几行是别的订单行)
                double others = 0d;
                for (Map<String, Object> lb : labels) {
                    if ((int) num(lb.get("采购订单行id")) != lineId || isSupplement(lb)) continue;
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
            }
            // ★ 每行一张单:各自取号、各自建头(作废时才互不牵连)
            String docNo = formNoService.next(PREFIX, user);
            jdbc.update("INSERT INTO bd_pu_label ([单据编号],[单据日期],[采购订单号],[供应商编码],[批次号],"
                            + " [打印人],[打印时间],[打印次数],asp_user1,asp_time1,asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,SYSDATETIME(),1,?,SYSDATETIME(),'N')",
                    docNo, LocalDate.now(), orderNo, str(head.get("supplierCode")), rowBatch, user, user);
            jdbc.update("INSERT INTO bl_pu_label ([单据编号],[采购订单行号],[采购订单行id],[物料编码],[物料名称],"
                            + " [规格型号],[计量单位],[打印数量],[补登],[去向单据],asp_user1,asp_time1,asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,SYSDATETIME(),'N')",
                    docNo, line.get("行号"), lineId, line.get("物料编码"), line.get("物料名称"),
                    line.get("规格型号"), line.get("计量单位"), qty, supplement ? "Y" : "N",
                    supplement ? supDoc.get(lineId + "\u0001" + rowBatch) : null, user);
            docNos.add(docNo);
            Map<String, Object> o = new LinkedHashMap<>();
            o.put("单据编号", docNo);
            o.put("采购订单行id", lineId);
            o.put("行号", line.get("行号"));
            o.put("物料编码", line.get("物料编码"));
            o.put("物料名称", line.get("物料名称"));
            o.put("规格型号", line.get("规格型号"));
            o.put("计量单位", line.get("计量单位"));
            o.put("打印数量", qty);
            o.put("批次号", rowBatch);
            o.put("补登", supplement);
            outRows.add(o);
        }
        if (!over.isEmpty()) {
            // 有超限行 → 整笔回滚(事务),把问题行一次说清,而不是只报第一条
            throw new IllegalStateException(String.join(";", over));
        }
        if (outRows.isEmpty()) throw new IllegalStateException("本次没有可打印的数量(各行打印数量均为 0)");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("单据编号", docNos.get(0));       // 兼容单行调用:就是它
        out.put("单据编号列表", docNos);
        out.put("张数", docNos.size());
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
                        + " ISNULL(l.[补登], N'N') AS 补登, l.[去向单据] AS 去向单据,"
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
            boolean sup = isSupplement(r);
            r.put("打印数量", round2(printed));
            r.put("已生单量", round2(generated));
            // 补登行**恒为 0**:它是给已经收完的货补打的码,从来不等生单(不产生隔离行)
            r.put("未生单量", sup ? 0d : round2(Math.max(0d, printed - generated)));
        }
        return rows;
    }

    // ==================== ⑤ 打印明细生成的单据:批次号锁定的判定 ====================

    /**
     * 该单据的批次号是否**不可修改**(用户口径「只要有关打印明细生成的单据都不可以修改批次号」)。
     *
     * <p>判据 = 这张单的来源链里有没有**隔离行键**(`{订单号}#{行id}@{打印行id}`)的 ACTIVE link:
     * 有 ⇒ 它是由材料码(打印明细)生出来的,标签上已经印着那个批次号,系统只能服从、不许再改。
     *
     * <p>为什么不用"批次号与某条打印记录相同"来判:常规生单的公式号(供应商-日期)与打印号**经常同名**,
     * 那样会把普通单据也误锁。来源行键有没有 `@` 才是**唯一可靠**的出身标记。
     *
     * @return {锁定: boolean, 批次号: 该单的批次号, 依据: 说明文字}
     */
    public Map<String, Object> batchLock(String panelCode, String docNo) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("锁定", false);
        out.put("批次号", "");
        out.put("依据", "");
        if (panelCode == null || panelCode.isBlank() || docNo == null || docNo.isBlank()) return out;
        try {
            Map<String, Object> row = firstRow("SELECT TOP 1 batch_no AS b, source_line_key AS k FROM form_flow_link"
                    + " WHERE target_panel_code = ? AND target_form_no = ? AND link_status = 'ACTIVE'"
                    + "   AND source_line_key LIKE N'%@%'", panelCode, docNo);
            if (row == null) return out;
            out.put("锁定", true);
            out.put("批次号", str(row.get("b")));
            out.put("依据", "本单由材料码打印明细生成(标签上已印此批次号),批次号不可修改");
        } catch (Exception ignore) { /* 表未建/无 link:不锁 */ }
        return out;
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

    private static int intOf(Object o) {
        if (o instanceof Number n) return n.intValue();
        if (o == null || String.valueOf(o).isBlank()) return 0;
        try { return (int) Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return 0; }
    }

    private static boolean boolOf(Object o) {
        if (o instanceof Boolean b) return b;
        String s = str(o);
        return "true".equalsIgnoreCase(s) || "Y".equalsIgnoreCase(s) || "是".equals(s) || "1".equals(s);
    }

    private static double round2(double v) { return Math.round(v * 100.0) / 100.0; }

    /** 数量展示:整数不带小数点(与前端口径一致) */
    private static String trim(double v) {
        return Math.abs(v - Math.rint(v)) < 1e-9 ? String.valueOf((long) Math.rint(v)) : String.valueOf(round2(v));
    }

    private static String str(Object o) { return o == null ? "" : String.valueOf(o).trim(); }
}
