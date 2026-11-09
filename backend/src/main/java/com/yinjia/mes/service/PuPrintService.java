package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 采购订单「报表打印记录」—— 有金额 / 无金额两个报表的打印留痕、重打与作废(2026-11-07)。
 *
 * <h3>为什么有这张表(用户口径)</h3>
 * 用户问「弹窗有对已经打印的做记录吗」后选「像材料码那样」:
 * 每次打印存一份快照(版式 / 勾了哪几行 / 每行本次数量 / 合计 / 打印人 / 时间),
 * 弹窗底部列出来,可重打(原样再出纸、打印次数+1)、可作废(只作废这张纸)。
 *
 * <h3>与材料码({@link PuLabelService})的区别 —— 别混用</h3>
 * <ul>
 *   <li>材料码:一张单 = 一个批次号,<b>打印即预约</b>订单余量,作废要释放预约;</li>
 *   <li>本服务:一次打印 = 一组「哪几行 × 各自数量」的<b>报表快照</b>,
 *       <b>不占用订单量、不产生预约</b>，作废只是软删这张纸的记录;</li>
 *   <li>两者表、接口、单号前缀(MQ / MP)都分开,避免报表打印污染材料码的预约口径。</li>
 * </ul>
 *
 * <h3>口径</h3>
 * <ul>
 *   <li>「确定并打印」先落库再出纸:纸上内容 = 落库快照(见 {@link #print});</li>
 *   <li>改过数量的行,小计 = 单价 × 本次数量(4 位小数);
 *       <b>没改数量的行沿用订单原金额</b>(可能含折扣/整单分摊,不能被打印这一步抹掉);</li>
 *   <li>重打只把 {@code 打印次数 + 1},不新增记录、不改任何数量;</li>
 *   <li>作废 = 软删(asp_cancel='Y'),**没有预约要释放**;</li>
 *   <li><b>不建面板</b>(同材料码):只在采购订单打印弹窗里反查;权限由 PxController 按
 *       内部账号面板权 / 供应商逐单归属把关。</li>
 * </ul>
 */
@Service
public class PuPrintService {

    /** 单号前缀:报表打印记录 → MP-yyyy-MM-nnnn(走 s_allno 号池;FormNoService 已登记本表) */
    private static final String PREFIX = "MP";
    /** 采购订单面板码 / 订单头表 / 订单行表 */
    private static final String PANEL = "PU_ORDER";
    private static final String ORDER_HEAD = "bd_pu_order";
    private static final String ORDER_LINE = "bl_pu_order";
    /** 本服务的打印记录头 / 行 */
    private static final String HEAD = "bd_pu_print";
    private static final String LINE = "bl_pu_print";
    /** 版式取值:与前端「打印版式」两个单选一致(中文数据键,ADR-0001) */
    public static final String FMT_AMOUNT = "有金额";
    public static final String FMT_NO_AMOUNT = "无金额";

    private final JdbcTemplate jdbc;
    private final FormNoService formNoService;
    /**
     * 超送比例 + 计量单位精度(2026-11-09 用户口径:「打印的时候没有和材料码一样考虑到超送问题」)。
     * 采购订单**打印**也要有上限:本次打印数量 ≤ 订单数量 ×(1 + 超送比例),
     * 超送量按该行单位精度向下取整(个/卷=整数、kg/米=3 位),与材料码「剩余可打」同一套取整函数。
     */
    private final BatchService batchService;

    public PuPrintService(JdbcTemplate jdbc, FormNoService formNoService, BatchService batchService) {
        this.jdbc = jdbc;
        this.formNoService = formNoService;
        this.batchService = batchService;
    }

    // ==================== ① 已打印记录(弹窗反查) ====================
    /**
     * 某张采购订单的打印记录(新的在上)。
     *
     * <p>只回**存活**记录(作废的软删行不再出现,与材料码弹窗同口径)。
     * 字段:单据编号 / 打印版式 / 打印人 / 打印时间 / 打印次数 / 行数 / 数量合计 / 金额合计。
     */
    public List<Map<String, Object>> records(String orderNo) {
        String no = str(orderNo);
        if (no.isEmpty()) throw new IllegalArgumentException("缺少采购订单号");
        return jdbc.queryForList(
                "SELECT [单据编号] AS 单据编号, [打印版式] AS 打印版式, ISNULL([打印人],N'') AS 打印人,"
                        + " CONVERT(varchar(19), [打印时间], 120) AS 打印时间, ISNULL([打印次数],0) AS 打印次数,"
                        + " ISNULL([行数],0) AS 行数, ISNULL([数量合计],0) AS 数量合计, [金额合计] AS 金额合计,"
                        + " [对应单号] AS 对应单号"
                        + " FROM " + HEAD
                        + " WHERE [采购订单号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY ISNULL([打印时间], CAST('1900-01-01' AS datetime2)) DESC, id DESC", no);
    }

    // ==================== ①-2 打印额度(超送) ====================

    /**
     * 每行的「剩余可打」—— 2026-11-09 用户口径:
     * 「打印的时候没有和材料码一样考虑到超送问题」→「和材料码一样,这些都要有」(截图:订单数量/已送/已打印/剩余可打)。
     *
     * <p>口径与材料码弹窗**同一套**:
     * <pre>剩余可打 = 订单数量 + floor(订单数量 × 超送比例, 单位精度) − 已送 + 已退回 − 已打印</pre>
     * 其中:
     * <ul>
     *   <li>已送 / 已退回 取 {@link BatchService#sentByLineKey} / {@link BatchService#returnedByOrderLine} —— 与材料码同源;</li>
     *   <li>已打印 = 本订单该行**存活打印记录**(bd_pu_print/bl_pu_print,作废的不算)的打印数量合计 ——
     *       等价于材料码的「已打印预约」:打过的量已经从这张订单里划走了,再打就超了(要原样再出一张用「重打」);</li>
     *   <li><b>按版式隔离(2026-11-09 用户口径「有金额和无金额切换打印同一个不一样,不要有版本限制」)</b>:
     *       「已打印」只统计**同一打印版式**的记录 —— 有金额与无金额是两张不同的纸,
     *       各打各的额度,打无金额不会吃掉有金额的剩余可打(反之亦然);</li>
     *   <li>超送量按该行计量单位向下取整(个/卷=整数、kg/米=3 位),负数归 0。</li>
     * </ul>
     *
     * @param format {@link #FMT_AMOUNT} / {@link #FMT_NO_AMOUNT};null/空 = 不按版式隔离(汇总全部版式)
     * @return { 超送比例: 0.15, 打印版式: ..., lines: [{采购订单行id, 行号, 单位, 小数位数, 订单数量,
     *          已送数量, 已退回数量, 已打印数量, 剩余可打, 可打印上限}] }
     */
    public Map<String, Object> quotas(String orderNo, String format) {
        String no = str(orderNo);
        if (no.isEmpty()) throw new IllegalArgumentException("缺少采购订单号");
        String fmt = normalizeFormat(format);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("超送比例", batchService.overRatio());
        out.put("打印版式", fmt);
        out.put("lines", quotaRows(no, fmt));
        return out;
    }

    /** 兼容旧调用(不按版式隔离) */
    public Map<String, Object> quotas(String orderNo) {
        return quotas(orderNo, null);
    }

    /**
     * 额度行(内部/公开共用):口径见 {@link #quotas(String, String)};print() 校验也用它,保证弹窗与校验同源。
     *
     * @param format 只统计该打印版式的已打印量;null = 全部版式合计
     */
    public List<Map<String, Object>> quotaRows(String orderNo, String format) {
        String no = str(orderNo);
        String fmt = normalizeFormat(format);
        double ratio = batchService.overRatio();
        Map<String, Double> sentByKey = batchService.sentByLineKey("PU_ORDER", no);
        Map<String, Double> returnedByLine = batchService.returnedByOrderLine(no);
        Map<Integer, Double> printedByLine = new HashMap<>();
        List<Object> args = new ArrayList<>();
        args.add(no);
        StringBuilder sql = new StringBuilder(
                "SELECT l.[采购订单行id] AS id, SUM(l.[打印数量]) AS q FROM " + LINE + " l"
                        + " JOIN " + HEAD + " h ON h.[单据编号] = l.[单据编号]"
                        + " WHERE h.[采购订单号] = ? AND ISNULL(l.asp_cancel,'N') <> 'Y'"
                        + "   AND ISNULL(h.asp_cancel,'N') <> 'Y' AND l.[采购订单行id] IS NOT NULL");
        if (fmt != null) {
            sql.append(" AND h.[打印版式] = ?");
            args.add(fmt);
        }
        sql.append(" GROUP BY l.[采购订单行id]");
        for (Map<String, Object> r : jdbc.queryForList(sql.toString(), args.toArray())) {
            printedByLine.put((int) num(r.get("id")), num(r.get("q")));
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT id, [行号] AS 行号, [单位] AS 单位, ISNULL([数量],0) AS 数量"
                        + " FROM " + ORDER_LINE + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id", no)) {
            int lineId = (int) num(r.get("id"));
            int nd = batchService.unitDecimals(str(r.get("单位")));
            double qty = num(r.get("数量"));
            double used = sentByKey.getOrDefault(no + "#" + lineId, 0d);
            double ret = returnedByLine.getOrDefault(str(r.get("行号")), 0d);
            double printed = printedByLine.getOrDefault(lineId, 0d);
            double allowed = BatchService.overAllowance(qty, used, ret, ratio, nd);      // 含超送的头寸
            double remain = UnitPrecision.floorTo(Math.max(0d, allowed - printed), nd);  // 减去已打印的纸
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("采购订单行id", lineId);
            row.put("行号", r.get("行号"));
            row.put("单位", r.get("单位"));
            row.put("小数位数", nd);
            row.put("订单数量", qty);
            row.put("已送数量", UnitPrecision.roundTo(used, nd));
            row.put("已退回数量", UnitPrecision.roundTo(ret, nd));
            row.put("已打印数量", UnitPrecision.roundTo(printed, nd));
            row.put("剩余可打", remain);
            row.put("可打印上限", remain);
            out.add(row);
        }
        return out;
    }

    // ==================== ② 登记一次打印(先落库,再出纸) ====================

    /**
     * 登记一次打印:按「勾选的行 + 本次打印数量」落一份**快照**(1 条头 + N 条行),返回落纸行。
     *
     * <p>服务端**不信前端传的数量/金额**,一律回订单行重算:
     * <ul>
     *   <li>数量 = 前端本次填写值(必须 &gt; 0,否则拒 —— 不想打印的行应该取消勾选);</li>
     *   <li>小计 = 数量改过 ? 单价 × 数量 : 订单行原金额(见类注释);</li>
     *   <li>物料/规格/单位/税率/交期/备注 取订单行当前值做快照(订单以后改了不影响历史纸面)。</li>
     * </ul>
     *
     * @param orderNo 采购订单号
     * @param format  {@link #FMT_AMOUNT} / {@link #FMT_NO_AMOUNT}(其它值按有金额处理)
     * @param rows    [{采购订单行id, 打印数量}]
     * @param user    操作人
     * @return 落纸所需:单据编号 / 打印版式 / 行数 / 数量合计 / 金额合计 / lines(纸面键:数量=本次打印数量、金额=小计)
     */
    @Transactional
    public Map<String, Object> print(String orderNo, String format, List<Map<String, Object>> rows, String user) {
        String no = str(orderNo);
        if (no.isEmpty()) throw new IllegalArgumentException("缺少采购订单号");
        String fmt = FMT_NO_AMOUNT.equals(str(format)) ? FMT_NO_AMOUNT : FMT_AMOUNT;
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("请至少勾选一行明细");
        Map<String, Object> order = firstRow(
                "SELECT [单据编号] AS no, ISNULL([供应商编码],N'') AS supplierCode,"
                        + " CONVERT(varchar(10), [交货日期], 120) AS 交货日期"
                        + " FROM " + ORDER_HEAD + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (order == null) throw new IllegalArgumentException("采购订单不存在:" + no);

        List<Map<String, Object>> orderLines = jdbc.queryForList(
                "SELECT id, [行号] AS 行号, [物料编码] AS 物料编码, [物料名称] AS 物料名称, [规格型号] AS 规格型号,"
                        + " [单位] AS 单位, ISNULL([数量],0) AS 数量, [单价] AS 单价, [金额] AS 金额,"
                        + " ISNULL([税率%],0) AS 税率, ISNULL([备注],N'') AS 备注,"
                        + " CONVERT(varchar(10), [预计到货日期], 120) AS 预计到货日期"
                        + " FROM " + ORDER_LINE + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id", no);
        Map<Integer, Map<String, Object>> byId = new LinkedHashMap<>();
        for (Map<String, Object> l : orderLines) byId.put((int) num(l.get("id")), l);

        Set<Integer> seen = new LinkedHashSet<>();
        List<Map<String, Object>> outLines = new ArrayList<>();
        double qtyTotal = 0d;
        double amtTotal = 0d;
        boolean hasAmt = false;
        // 超送比例(每次打印取一次;与材料码/生单同一系统参数 receive_over_ratio)
        double overRatio = batchService.overRatio();
        // 每行剩余可打(与弹窗同源):订单数量×(1+超送比例)−已送+已退回−已打印
        Map<Integer, Map<String, Object>> quotaById = new HashMap<>();
        for (Map<String, Object> q : quotaRows(no, fmt)) {
            quotaById.put((int) num(q.get("采购订单行id")), q);
        }
        for (Map<String, Object> r : rows) {
            int lineId = (int) num(r.get("采购订单行id"));
            double qty = num(r.get("打印数量"));
            if (lineId <= 0) throw new IllegalArgumentException("打印行缺少采购订单行id");
            if (!seen.add(lineId)) {
                throw new IllegalArgumentException("同一订单行在一次打印里出现了两次:行id " + lineId + "(请合并成一行)");
            }
            Map<String, Object> line = byId.get(lineId);
            if (line == null) throw new IllegalArgumentException("采购订单行不存在或已作废:行id " + lineId);
            if (!(qty > 0)) {
                throw new IllegalArgumentException("第 " + str(line.get("行号")) + " 行的本次打印数量必须大于 0(不打印的行请取消勾选)");
            }
            double orderQty = num(line.get("数量"));
            // 剩余可打(2026-11-09,与材料码同口径):超送量按单位精度向下取整,减去已送/已退回/已打印。
            // 服务端强制,前端弹窗给的 max 只是即时体验(供应商面板同一口径)。
            Map<String, Object> q = quotaById.get(lineId);
            if (q != null) {
                double cap = num(q.get("剩余可打"));
                if (qty > cap + 1e-6) {
                    throw new IllegalArgumentException("第 " + str(line.get("行号")) + " 行:本次打印 " + fmtNum(qty)
                            + " 超出剩余可打 " + fmtNum(cap) + "(订单数量 " + fmtNum(num(q.get("订单数量")))
                            + " ×(1+超送比例 " + Math.round(overRatio * 100) + "%)− 已送 " + fmtNum(num(q.get("已送数量")))
                            + " + 已退回 " + fmtNum(num(q.get("已退回数量"))) + " − 已打印 " + fmtNum(num(q.get("已打印数量")))
                            + ",超送量按计量单位取整)");
                }
            }
            boolean changed = Math.abs(qty - orderQty) > 1e-9;
            Double subtotal = null;
            if (changed) {
                double price = num(line.get("单价"));
                subtotal = round4(price * qty);
            } else if (line.get("金额") != null) {
                subtotal = round4(num(line.get("金额")));
            }
            String due = str(line.get("预计到货日期"));
            if (due.isEmpty()) due = str(order.get("交货日期"));

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("采购订单行id", lineId);
            row.put("行号", line.get("行号"));
            row.put("物料编码", line.get("物料编码"));
            row.put("物料名称", line.get("物料名称"));
            row.put("规格型号", line.get("规格型号"));
            row.put("单位", line.get("单位"));
            row.put("订单数量", round4(orderQty));
            row.put("数量", round4(qty));          // 纸面「数量」列 = 本次打印数量
            row.put("单价", line.get("单价"));
            row.put("金额", subtotal);             // 纸面「小计」列
            row.put("税率%", line.get("税率"));
            row.put("预计到货日期", due);           // 纸面「交期要求」列
            row.put("备注", str(line.get("备注")));
            outLines.add(row);
            qtyTotal += qty;
            if (subtotal != null) { amtTotal += subtotal; hasAmt = true; }
        }

        String docNo = formNoService.next(PREFIX, user);
        double qtySum = round4(qtyTotal);
        Double amtSum = (FMT_AMOUNT.equals(fmt) && hasAmt) ? round4(amtTotal) : null;
        jdbc.update("INSERT INTO " + HEAD + " ([单据编号],[单据日期],[采购订单号],[供应商编码],[打印版式],"
                        + " [打印人],[打印时间],[打印次数],[行数],[数量合计],[金额合计],asp_user1,asp_time1,asp_cancel)"
                        + " VALUES (?,?,?,?,?,?,SYSDATETIME(),1,?,?,?,?,SYSDATETIME(),'N')",
                docNo, LocalDate.now(), no, str(order.get("supplierCode")), fmt, user,
                outLines.size(), qtySum, amtSum, user);
        for (Map<String, Object> l : outLines) {
            jdbc.update("INSERT INTO " + LINE + " ([单据编号],[采购订单行id],[行号],[物料编码],[物料名称],"
                            + " [规格型号],[单位],[订单数量],[打印数量],[单价],[小计],[税率%],[交期要求],[备注],"
                            + " asp_user1,asp_time1,asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,SYSDATETIME(),'N')",
                    docNo, l.get("采购订单行id"), l.get("行号"), l.get("物料编码"), l.get("物料名称"),
                    l.get("规格型号"), l.get("单位"), l.get("订单数量"), l.get("数量"), l.get("单价"),
                    l.get("金额"), l.get("税率%"), l.get("预计到货日期"), l.get("备注"), user);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("单据编号", docNo);
        out.put("采购订单号", no);
        out.put("打印版式", fmt);
        // 相互记录(2026-11-09 用户口径「有各自份额,但是要互相记录对方的对应信息,可以相互对着打印」):
        // 取**另一版式最近一张存活记录**做对照,双向写「对应单号」。
        List<String> twins = jdbc.queryForList(
                "SELECT TOP 1 [单据编号] FROM " + HEAD
                        + " WHERE [采购订单号] = ? AND [打印版式] <> ? AND [单据编号] <> ?"
                        + "   AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY ISNULL([打印时间], CAST('1900-01-01' AS datetime2)) DESC, id DESC",
                String.class, no, fmt, docNo);
        String twin = twins.isEmpty() ? null : twins.get(0);
        if (twin != null && !twin.isBlank()) {
            jdbc.update("UPDATE " + HEAD + " SET [对应单号] = ? WHERE [单据编号] = ?", twin, docNo);
            jdbc.update("UPDATE " + HEAD + " SET [对应单号] = ? WHERE [单据编号] = ?", docNo, twin);
        }
        out.put("对应单号", twin);
        out.put("打印人", user);
        out.put("行数", outLines.size());
        out.put("数量合计", qtySum);
        out.put("金额合计", amtSum);
        out.put("打印次数", 1);
        out.put("lines", outLines);
        return out;
    }

    // ==================== ②-2 对着另一版式打(数量/行取现有记录) ====================

    /**
     * 对着另一版式打印(2026-11-09 用户口径「可以相互对着打印」):
     * 按这张记录的行与数量,用**另一个打印版式**再出一张(有金额 ↔ 无金额),
     * 并把两张纸的「对应单号」互相写上 —— 新纸的额度仍按目标版式自己的剩余可打校验。
     *
     * @param printNo 现有打印记录单号
     * @return 与 {@link #print} 同结构(落纸行 + 对应单号)
     */
    @Transactional
    public Map<String, Object> twinPrint(String printNo, String user) {
        String no = str(printNo);
        if (no.isEmpty()) throw new IllegalArgumentException("缺少打印记录单号");
        Map<String, Object> head = firstRow(
                "SELECT [采购订单号] AS 采购订单号, [打印版式] AS 打印版式"
                        + " FROM " + HEAD + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (head == null) throw new IllegalStateException("打印记录不存在或已作废:" + no);
        String orderNo = str(head.get("采购订单号"));
        String srcFmt = str(head.get("打印版式"));
        String target = FMT_NO_AMOUNT.equals(srcFmt) ? FMT_AMOUNT : FMT_NO_AMOUNT;
        List<Map<String, Object>> lines = linesOf(no);
        if (lines.isEmpty()) throw new IllegalStateException("该打印记录没有存活行,无法对着打印:" + no);
        List<Map<String, Object>> req = new ArrayList<>();
        for (Map<String, Object> l : lines) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("采购订单行id", (int) num(l.get("采购订单行id")));
            r.put("打印数量", num(l.get("数量")));
            req.add(r);
        }
        Map<String, Object> out = print(orderNo, target, req, user);
        String newNo = str(out.get("单据编号"));
        // print() 会按「另一版式最近存活」自动找对照;这里再按来源单**兜底写死**,保证就是这张
        jdbc.update("UPDATE " + HEAD + " SET [对应单号] = ? WHERE [单据编号] = ?", no, newNo);
        jdbc.update("UPDATE " + HEAD + " SET [对应单号] = ? WHERE [单据编号] = ?", newNo, no);
        out.put("对应单号", no);
        return out;
    }

    // ==================== ③ 重打(同一张记录原样再打,只累加次数) ====================

    /**
     * 重打:把**同一张**打印记录原样再出纸(纸卡了/打歪了),只把 打印次数 +1。
     *
     * <p>不新增记录、不改数量/金额 —— 内容一律取落库快照(见 {@link #linesOf});
     * 已作废的记录不能重打。
     */
    @Transactional
    public Map<String, Object> reprint(String printNo, String user) {
        String no = str(printNo);
        if (no.isEmpty()) throw new IllegalArgumentException("缺少打印记录单号");
        Map<String, Object> head = firstRow(
                "SELECT [采购订单号] AS 采购订单号, [打印版式] AS 打印版式, ISNULL([供应商编码],N'') AS 供应商编码"
                        + " FROM " + HEAD + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (head == null) throw new IllegalStateException("打印记录不存在或已作废:" + no);
        List<Map<String, Object>> lines = linesOf(no);
        if (lines.isEmpty()) throw new IllegalStateException("该打印记录没有存活行,无法重打:" + no);
        jdbc.update("UPDATE " + HEAD + " SET [打印人] = ?, [打印时间] = SYSDATETIME(),"
                + " [打印次数] = ISNULL([打印次数],0) + 1, asp_user2 = ?, asp_time2 = SYSDATETIME()"
                + " WHERE [单据编号] = ?", user, user, no);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("单据编号", no);
        out.put("采购订单号", head.get("采购订单号"));
        out.put("打印版式", head.get("打印版式"));
        Map<String, Object> counts = firstRow("SELECT ISNULL([打印次数],0) AS t, ISNULL([数量合计],0) AS q,"
                + " [金额合计] AS a, ISNULL([行数],0) AS n FROM " + HEAD + " WHERE [单据编号] = ?", no);
        out.put("打印次数", counts == null ? 1 : (int) num(counts.get("t")));
        out.put("数量合计", counts == null ? 0d : round4(num(counts.get("q"))));
        out.put("金额合计", counts == null ? null : counts.get("a"));
        out.put("行数", counts == null ? lines.size() : (int) num(counts.get("n")));
        out.put("lines", lines);
        return out;
    }

    /** 某张打印记录的行(纸面键口径:数量=打印数量、金额=小计、预计到货日期=交期要求) */
    private List<Map<String, Object>> linesOf(String printNo) {
        List<Map<String, Object>> raw = jdbc.queryForList(
                "SELECT [采购订单行id] AS 采购订单行id, [行号] AS 行号, [物料编码] AS 物料编码,"
                        + " [物料名称] AS 物料名称, [规格型号] AS 规格型号, [单位] AS 单位,"
                        + " ISNULL([订单数量],0) AS 订单数量, ISNULL([打印数量],0) AS 打印数量,"
                        + " [单价] AS 单价, [小计] AS 小计, ISNULL([税率%],0) AS 税率,"
                        + " ISNULL([交期要求],N'') AS 交期要求, ISNULL([备注],N'') AS 备注"
                        + " FROM " + LINE + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id", printNo);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : raw) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("采购订单行id", r.get("采购订单行id"));
            m.put("行号", r.get("行号"));
            m.put("物料编码", r.get("物料编码"));
            m.put("物料名称", r.get("物料名称"));
            m.put("规格型号", r.get("规格型号"));
            m.put("单位", r.get("单位"));
            m.put("订单数量", round4(num(r.get("订单数量"))));
            m.put("数量", r.get("打印数量"));
            m.put("单价", r.get("单价"));
            m.put("金额", r.get("小计"));
            m.put("税率%", r.get("税率"));
            m.put("预计到货日期", r.get("交期要求"));
            m.put("备注", r.get("备注"));
            out.add(m);
        }
        return out;
    }

    // ==================== ④ 作废(软删,不释放任何预约) ====================

    /**
     * 作废一张打印记录:头 + 行一并软删(asp_cancel='Y')。
     *
     * <p>报表打印**不占用订单量**,所以作废**没有预约要释放**——只是让这张纸不再出现在
     * 「已打印记录」里(与材料码作废的语义不同,别照抄那段释放逻辑)。
     */
    @Transactional
    public Map<String, Object> voidPrint(String printNo, String user) {
        String no = str(printNo);
        if (no.isEmpty()) throw new IllegalArgumentException("缺少打印记录单号");
        Map<String, Object> head = firstRow("SELECT [采购订单号] AS 采购订单号 FROM " + HEAD
                + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (head == null) throw new IllegalStateException("打印记录不存在或已作废:" + no);
        int n = jdbc.update("UPDATE " + LINE + " SET asp_cancel='Y', asp_user2=?, asp_time2=SYSDATETIME()"
                + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", user, no);
        // 作废后把对方的「对应单号」清掉(否则会指向一张已作废的纸;2026-11-09 互相对应机制)
        List<String> twins = jdbc.queryForList(
                "SELECT [对应单号] FROM " + HEAD + " WHERE [单据编号] = ? AND [对应单号] IS NOT NULL", String.class, no);
        if (!twins.isEmpty() && twins.get(0) != null && !twins.get(0).isBlank()) {
            jdbc.update("UPDATE " + HEAD + " SET [对应单号] = NULL WHERE [单据编号] = ? AND [对应单号] = ?",
                    twins.get(0), no);
        }
        jdbc.update("UPDATE " + HEAD + " SET asp_cancel='Y', asp_user2=?, asp_time2=SYSDATETIME() WHERE [单据编号] = ?", user, no);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("单据编号", no);
        out.put("采购订单号", head.get("采购订单号"));
        out.put("作废行数", n);
        return out;
    }

    // ==================== ⑤ 归属反查(重打/作废的权限闸门用) ====================

    /**
     * 按打印记录单号反查它属于哪张采购订单(查不到/已作废 → 空串)。
     * 用途:重打/作废接口收的是 MP-… 单号,供应商会话要据此核对归属。
     */
    public String orderNoOf(String printNo) {
        String no = str(printNo);
        if (no.isEmpty()) return "";
        try {
            String orderNo = jdbc.queryForObject(
                    "SELECT TOP 1 ISNULL([采购订单号],N'') FROM " + HEAD
                            + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", String.class, no);
            return orderNo == null ? "" : orderNo.trim();
        } catch (RuntimeException e) {
            return "";
        }
    }

    // ==================== ⑥ 记录明细(点记录行查看) ====================

    /**
     * 一张打印记录的明细(只读):单头汇总 + 落纸行。
     *
     * <p>用户口径(2026-11-09):「这一行我想要点击可以看到明细」—— 弹窗里点「已打印记录」的任一行,
     * 能看到这次打印**具体打了哪几行、每行多少**(行号/物料/订单数量/本次打印数量/单价/小计/交期/备注)。
     * 只读,不改打印次数(重打是另一颗按钮)。
     */
    public Map<String, Object> detail(String printNo) {
        String no = str(printNo);
        if (no.isEmpty()) throw new IllegalArgumentException("缺少打印记录单号");
        Map<String, Object> head = firstRow(
                "SELECT [采购订单号] AS 采购订单号, [打印版式] AS 打印版式, ISNULL([打印人],N'') AS 打印人,"
                        + " CONVERT(varchar(19), [打印时间], 120) AS 打印时间, ISNULL([打印次数],0) AS 打印次数,"
                        + " ISNULL([行数],0) AS 行数, ISNULL([数量合计],0) AS 数量合计, [金额合计] AS 金额合计,"
                        + " [对应单号] AS 对应单号"
                        + " FROM " + HEAD + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (head == null) throw new IllegalStateException("打印记录不存在或已作废:" + no);
        head.put("单据编号", no);
        head.put("lines", linesOf(no));
        return head;
    }

    // ==================== 小工具 ====================

    private Map<String, Object> firstRow(String sql, Object... args) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private static double num(Object o) {
        if (o instanceof Number n) return n.doubleValue();
        if (o == null || String.valueOf(o).isBlank()) return 0d;
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return 0d; }
    }

    /** 4 位小数收口(与库内 decimal(18,4) 同口径) */
    private static double round4(double v) { return Math.round(v * 10000.0) / 10000.0; }

    /** 打印版式归一:空 → null(不按版式隔离);其它非「无金额」一律按「有金额」 */
    private static String normalizeFormat(String format) {
        String f = str(format);
        if (f.isEmpty()) return null;
        return FMT_NO_AMOUNT.equals(f) ? FMT_NO_AMOUNT : FMT_AMOUNT;
    }

    /** 数量显示:整数不带小数点,小数去掉尾随 0(错误提示里用,别出现 3600.0000) */
    private static String fmtNum(double v) {
        if (Math.abs(v - Math.rint(v)) < 1e-9) return String.valueOf((long) Math.rint(v));
        return new java.math.BigDecimal(String.valueOf(v)).stripTrailingZeros().toPlainString();
    }

    private static String str(Object o) { return o == null ? "" : String.valueOf(o).trim(); }

    /** 本服务引用的面板码(权限闸门复用,PxController 里只写一处) */
    public static String panel() { return PANEL; }
}
