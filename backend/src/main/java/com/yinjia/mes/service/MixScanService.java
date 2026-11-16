package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 手机扫码 · **扫码混料**的取数与落库服务(2026-11-18,取代已下架的「工单扫码领料」)。
 *
 * <h3>用户口径(原话)</h3>
 * 「把 wms 管理-条码管理里面的扫码领料和扫码领料记录和工单扫码领料删除。然后在手机扫码里面加一个
 *  扫码混料的面版。逻辑:扫工单码,带出一级BOM(就是物料清单,之前生产领料的是组装物料清单),
 *  逐项扫物料码,自动获取电子秤的数量(我们系统已经有了(之前的工单扫码领料读的就是这个的数据)),
 *  提交保存一笔,全部扫完,整单保存。保存后自动打印,并且保留单据,重新扫码后进入可以补打印。」
 *
 * <h3>作业链路</h3>
 * <ol>
 *   <li><b>扫工单码</b> → {@link #workOrderLines} 取工单行({@code plang})、「{@link #bomOf}」取该产品的
 *       **一级BOM = 物料清单**(面板 {@code WLBOM},底表 {@code mate})按排产数量展开应投料量;</li>
 *   <li><b>逐项扫物料码</b> → 前端读电子秤({@code /api/dc/monitor})拿实际重量 →
 *       {@link #saveScan} **提交保存一笔**(落 {@code wo_mixing_list},标记 {@code N} = 保存前);</li>
 *   <li><b>全部扫完 → 整单保存</b> → {@link #saveDoc} 取混料单号({@code PL+yyMMdd+4位})、
 *       把本单各行标记置 {@code Y}(保存后);保存后前端自动打印;</li>
 *   <li><b>补打印</b> → 重新扫同一张工单码,{@link #docsOf} 列出该工单已保存的混料单,
 *       {@link #docRows} 取明细、{@link #markPrinted} 累加打印次数({@code asp_print})。</li>
 * </ol>
 *
 * <h3>为什么落 {@code wo_mixing_list}(混料记录)而不是新开单据表</h3>
 * 那张表就是「混料时通过电子称自动获取的实际用量」的载体(服务器原话的表注释),
 * 现役只读面板「生产过程 → 混料记录」({@code WO_MIXING_LIST})直连它 ——
 * 扫完保存的记录现场立刻能在电脑端查到,不必再造一份数据、也不必补第二套面板/权限/译名。
 * 字段口径与老系统那 8 行完全同构:{@code 单据编号(PL…)/工单号/工单行号/序号/物料编号/物料名称/
 * 计划用量/实际用量/标记(N 保存前 / Y 保存后)/asp_print(打印次数)}。
 *
 * <h3>与「生产领料」的取料差别(刻意不一致)</h3>
 * 生产领料读《组装物料清单》({@code bs_asm_bom},组装件:炭棒/垫片…);
 * 混料投的是**炭粉/活性炭**这类原料,走的是《物料清单》({@code mate})——
 * 这是用户 2026-11-18 明确点出的口径,别"顺手统一"成组装BOM。
 *
 * <p>只读取数之外的写操作都限定在本服务内做参数校验与行级过滤(不接通用面板引擎:
 * {@code wo_mixing_list} 是报表型 flat 表,没有 yj_panel 的单据头/审批链)。
 */
@Service
public class MixScanService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(MixScanService.class);

    /** 混料单号前缀(与老系统 {@code PL2610210002} 同段位:PL + yyMMdd + 4 位流水) */
    private static final String DOC_PREFIX = "PL";
    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("yyMMdd");
    /** 逐笔保存 = 保存前;整单保存后置 Y(表注释口径:保存前=N,保存后=Y) */
    private static final String MARK_DRAFT = "N";
    private static final String MARK_SAVED = "Y";

    private final JdbcTemplate jdbc;

    public MixScanService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ═══════════════════════ 取数:工单行 + 物料清单 ═══════════════════════

    /**
     * 按工单号(+可选行号)取工单行。
     *
     * @param orderNo 工单号({@code plang.pl_no})
     * @param lineNo  工单行号({@code plang.pl_xc});&lt;=0 = 整单全部行
     * @return 每行含 行id/工单号/工单行号/产品编码/产品名称/生产线/排产数量/批号
     */
    public List<Map<String, Object>> workOrderLines(String orderNo, int lineNo) {
        String no = trim(orderNo);
        if (no.isEmpty()) throw new IllegalArgumentException("请提供工单号");
        StringBuilder sql = new StringBuilder(
                "SELECT id, pl_no, pl_xc, dm, mc, scx, pl_sl, lot_no, od_no, pl_date"
                        + " FROM dbo.plang WHERE pl_no = ? AND ISNULL(asp_cancel,'N') <> 'Y'");
        List<Object> args = new ArrayList<>();
        args.add(no);
        if (lineNo > 0) {
            sql.append(" AND pl_xc = ?");
            args.add(lineNo);
        }
        sql.append(" ORDER BY pl_xc");
        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("行id", longOf(r.get("id")));
            v.put("工单号", trim(r.get("pl_no")));
            v.put("工单行号", intOf(r.get("pl_xc")));
            v.put("产品编码", trim(r.get("dm")));
            v.put("产品名称", trim(r.get("mc")));
            v.put("生产线", trim(r.get("scx")));
            v.put("排产数量", dbl(r.get("pl_sl")));
            v.put("批号", trim(r.get("lot_no")));
            v.put("销售订单号", trim(r.get("od_no")));
            out.add(v);
        }
        return out;
    }

    /**
     * 按产品编码取**一级BOM = 物料清单**(面板 {@code WLBOM} 的底表 {@code mate}).
     *
     * <p>表结构要点(mate 是经典遗留表,列名是拼音缩写):
     * {@code m_no}=产品编码 / {@code wzdm2}=子件代码 / {@code wzmc2}=子件名称 /
     * {@code gg2}=规格 / {@code jldw2}=子件单位 / {@code bzl}=标准用量 / {@code sl2}=损耗量。
     *
     * <p>没有维护 BOM 时**返回空列表**而不是抛错:页面据此提示
     * 「该产品在「物料清单」里还没有维护用料」—— 2026-11-18 实测正式库 {@code mate} 仍是 0 行,
     * 静默显示空清单会让人以为是系统坏了。
     *
     * @param productCode 产品编码({@code mate.m_no})
     */
    public List<Map<String, Object>> bomOf(String productCode) {
        String code = trim(productCode);
        if (code.isEmpty()) return List.of();
        // 同一产品可能有多张单(历史重复录入):按 m_date 倒序取,子件按行序 xc 排
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT m_no, m_date, xc, wzdm2, wzmc2, gg2, jldw2, bzl, sl2, bz"
                        + " FROM dbo.mate WHERE m_no = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY m_date DESC, xc, id", code);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String item = trim(r.get("wzdm2"));
            if (item.isEmpty()) continue;
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("子件代码", item);
            v.put("子件名称", trim(r.get("wzmc2")));
            v.put("规格型号", trim(r.get("gg2")));
            v.put("子件单位", trim(r.get("jldw2")));
            v.put("标准用量", dbl(r.get("bzl")));
            v.put("损耗量", dbl(r.get("sl2")));
            v.put("备注", trim(r.get("bz")));
            out.add(v);
        }
        return out;
    }

    // ═══════════════════════ 逐笔保存(标记 N) ═══════════════════════

    /**
     * 提交保存**一笔**:把一次扫码(物料 + 电子秤实际用量)写进混料记录。
     *
     * <p>同一「工单行 + 物料」在未保存前重复扫时**累加到同一行**(实际用量相加),
     * 不再像老系统那样每次扫码都插一行 —— 服务器那 8 行里就有 6 行完全重复的同一物料,
     * 现场看不出到底投了几次,打印出来也没法用。
     *
     * @param body {工单号, 工单行id?, 工单行号?, 产品编码?, 产品名称?, 物料编号, 物料名称?,
     *             物料批次?, 计划用量?, 实际用量, 单位?, 秤值?, 秤设备?, 秤时间?}
     * @param user 登录账号(记 asp_user1)
     * @return {行id, 序号, 单据编号(仍为空直到整单保存), 累计实际用量, 累计笔数}
     */
    @Transactional
    public Map<String, Object> saveScan(Map<String, Object> body, String user) {
        String woNo = trim(body.get("工单号"));
        if (woNo.isEmpty()) throw new IllegalArgumentException("请先扫工单码");
        int woLine = intOf(body.get("工单行号"));
        String materialCode = trim(body.get("物料编号"));
        if (materialCode.isEmpty()) throw new IllegalArgumentException("请先扫物料码");
        BigDecimal qty = round4(body.get("实际用量"));
        if (qty.signum() <= 0) throw new IllegalArgumentException("实际用量要大于 0(电子秤没取到读数时请手输)");

        Map<String, Object> exists = first(jdbc.queryForList(
                "SELECT TOP 1 id, 实际用量 FROM dbo.wo_mixing_list"
                        + " WHERE 工单号 = ? AND 工单行号 = ? AND 物料编号 = ? AND 标记 = ?"
                        + "   AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id DESC",
                woNo, woLine, materialCode, MARK_DRAFT));

        if (exists != null) {
            long id = longOf(exists.get("id"));
            BigDecimal sum = round4(exists.get("实际用量")).add(qty);
            // 物料批次随最新一次扫码走(同一料换了批次,纸面印最后一次扫到的那个)
            String batch = trim(body.get("物料批次"));
            if (batch.isEmpty()) {
                jdbc.update("UPDATE dbo.wo_mixing_list SET 实际用量 = ?, asp_user2 = ?, asp_time2 = GETDATE()"
                        + " WHERE id = ?", sum, user, id);
            } else {
                jdbc.update("UPDATE dbo.wo_mixing_list SET 实际用量 = ?, 物料批次 = ?, asp_user2 = ?,"
                        + " asp_time2 = GETDATE() WHERE id = ?", sum, batch, user, id);
            }
            return rowResult(id, woNo, woLine, materialCode, sum, user);
        }

        int seq = 1 + nullToInt(jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.wo_mixing_list WHERE 工单号 = ? AND 工单行号 = ? AND 标记 = ?"
                        + " AND ISNULL(asp_cancel,'N') <> 'Y'", Integer.class, woNo, woLine, MARK_DRAFT));

        jdbc.update("INSERT INTO dbo.wo_mixing_list ("
                        + "工单号, 工单行id, 工单行号, 序号, 物料编号, 物料名称, 计划用量, 实际用量, 物料批次, 标记,"
                        + "asp_user1, asp_time1, asp_cancel) VALUES (?,?,?,?,?,?,?,?,?,?,?,GETDATE(),'N')",
                woNo, longOrNull(body.get("工单行id")), woLine, String.format("%d", seq),
                materialCode, trim(body.get("物料名称")),
                round4(body.get("计划用量")), qty, trim(body.get("物料批次")), MARK_DRAFT, user);
        Long id = jdbc.queryForObject("SELECT MAX(id) FROM dbo.wo_mixing_list WHERE 工单号 = ? AND 工单行号 = ?"
                + " AND 物料编号 = ? AND 标记 = ?", Long.class, woNo, woLine, materialCode, MARK_DRAFT);
        return rowResult(id == null ? 0 : id, woNo, woLine, materialCode, qty, user);
    }

    private Map<String, Object> rowResult(long id, String woNo, int woLine, String code, BigDecimal qty, String user) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("行id", id);
        out.put("工单号", woNo);
        out.put("工单行号", woLine);
        out.put("物料编号", code);
        out.put("实际用量", qty.doubleValue());
        out.put("操作人", user == null ? "" : user);
        // 还没整单保存 ⇒ 没有单号,前端据此提示「本单还没保存」
        String docNo = first(jdbc.queryForList(
                "SELECT TOP 1 单据编号 FROM dbo.wo_mixing_list WHERE id = ?", String.class, id));
        out.put("单据编号", docNo == null ? "" : docNo);
        return out;
    }

    /**
     * 撤回一笔(扫错料 / 秤取错时的兜底):只允许删**未保存**(标记 N)的行。
     *
     * @param id   混料记录行 id
     * @param user 操作人(只删自己的行;管理员另行处理,不在这里开口子)
     * @return 删除行数(0 = 行不存在/已保存/不是自己的)
     */
    public int undoScan(long id, String user) {
        if (id <= 0) return 0;
        return jdbc.update("DELETE FROM dbo.wo_mixing_list WHERE id = ? AND 标记 = ?"
                + " AND ISNULL(asp_cancel,'N') <> 'Y' AND (asp_user1 = ? OR ? IS NULL OR ? = '')",
                id, MARK_DRAFT, trim(user), trim(user), trim(user));
    }

    // ═══════════════════════ 整单保存(标记 Y + 单号) ═══════════════════════

    /**
     * **整单保存**:给本工单行的未保存行取一个混料单号,并把标记置 {@code Y}(保存后)。
     *
     * <p>用户口径「全部扫完,整单保存」。这里不校验"是否每一行都扫了" ——
     * 缺料是车间常态(某料没到位),业务上要允许先保存已投的料;
     * 页面负责在界面上把"还有 N 项未扫"显眼地提示出来。
     *
     * <p>单号口径与老系统一致:{@code PL + yyMMdd + 4 位流水},按当天已有单号取 max+1
     * (号池 {@code s_allno} 里没有 PL 段,故以业务表为准;本方法 synchronized,
     * 单实例内不会两个页签同时算出同一个号)。
     *
     * @param body {工单号, 工单行号}
     * @param user 操作人
     * @return {单据编号, 行数, 实际用量合计, 明细}
     */
    @Transactional
    public synchronized Map<String, Object> saveDoc(Map<String, Object> body, String user) {
        String woNo = trim(body.get("工单号"));
        if (woNo.isEmpty()) throw new IllegalArgumentException("请先扫工单码");
        int woLine = intOf(body.get("工单行号"));

        List<Map<String, Object>> draft = jdbc.queryForList(
                "SELECT id, 物料编号, 物料名称, 计划用量, 实际用量 FROM dbo.wo_mixing_list"
                        + " WHERE 工单号 = ? AND 工单行号 = ? AND 标记 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY id", woNo, woLine, MARK_DRAFT);
        if (draft.isEmpty()) {
            throw new IllegalStateException("这张工单行还没有已扫的料,不能整单保存");
        }

        String docNo = nextDocNo();
        jdbc.update("UPDATE dbo.wo_mixing_list SET 单据编号 = ?, 标记 = ?, asp_user2 = ?, asp_time2 = GETDATE()"
                        + " WHERE 工单号 = ? AND 工单行号 = ? AND 标记 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                docNo, MARK_SAVED, user, woNo, woLine, MARK_DRAFT);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("单据编号", docNo);
        out.put("工单号", woNo);
        out.put("工单行号", woLine);
        out.put("行数", draft.size());
        out.put("明细", docRows(docNo).get("明细"));
        return out;
    }

    /**
     * 取一个混料单号:{@code PL + yyMMdd + 4 位流水}。
     *
     * <p>基准 = {@code wo_mixing_list} 里同日前缀的最大流水(老系统那批 {@code PL2610210002}
     * 就是这么排的)+ 1;{@code s_allno} 号池里没有 PL 段,不去动它(动它要与 FormNoService 的
     * 格式假设对齐,得不偿失)。
     */
    private String nextDocNo() {
        String day = LocalDate.now().format(DAY_FMT);
        String prefix = DOC_PREFIX + day;
        Integer max = jdbc.queryForObject(
                "SELECT MAX(TRY_CAST(RIGHT(RTRIM(单据编号), 4) AS int)) FROM dbo.wo_mixing_list"
                        + " WHERE RTRIM(单据编号) LIKE ?", Integer.class, prefix + "[0-9][0-9][0-9][0-9]");
        int seq = (max == null ? 0 : max) + 1;
        return prefix + String.format("%04d", seq);
    }

    // ═══════════════════════ 单据查询 / 补打印 ═══════════════════════

    /**
     * 重新扫码后进入可**补打印**的前提:列出该工单(可限定行)已保存的混料单。
     *
     * @param orderNo 工单号
     * @param lineNo  工单行号(&lt;=0 = 该工单全部行)
     * @return [{单据编号, 保存时间, 行数, 实际用量合计, 打印次数, 操作人}]
     */
    public List<Map<String, Object>> docsOf(String orderNo, int lineNo) {
        String woNo = trim(orderNo);
        if (woNo.isEmpty()) return List.of();
        StringBuilder sql = new StringBuilder(
                "SELECT 单据编号, MIN(asp_time1) AS 保存时间, COUNT(*) AS 行数,"
                        + " SUM(ISNULL(实际用量,0)) AS 实际用量合计, MAX(ISNULL(asp_print,0)) AS 打印次数,"
                        + " MAX(asp_user1) AS 操作人, MIN(工单行号) AS 工单行号"
                        + " FROM dbo.wo_mixing_list"
                        + " WHERE 工单号 = ? AND 标记 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + "   AND 单据编号 IS NOT NULL AND LTRIM(RTRIM(单据编号)) <> ''");
        List<Object> args = new ArrayList<>();
        args.add(woNo);
        args.add(MARK_SAVED);
        if (lineNo > 0) {
            sql.append(" AND 工单行号 = ?");
            args.add(lineNo);
        }
        sql.append(" GROUP BY 单据编号 ORDER BY MIN(asp_time1) DESC, 单据编号 DESC");
        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("单据编号", trim(r.get("单据编号")));
            v.put("保存时间", trim(r.get("保存时间")));
            v.put("行数", intOf(r.get("行数")));
            v.put("实际用量合计", dbl(r.get("实际用量合计")));
            v.put("打印次数", intOf(r.get("打印次数")));
            v.put("操作人", trim(r.get("操作人")));
            v.put("工单行号", intOf(r.get("工单行号")));
            out.add(v);
        }
        return out;
    }

    /**
     * 本工单行**还没整单保存**的已扫料(重进页面恢复用 —— 手机熄屏/App 被杀不该把扫了一半的活丢掉)。
     *
     * @param orderNo 工单号
     * @param lineNo  工单行号
     * @return [{行id, 物料编号, 物料名称, 计划用量, 实际用量, 序号}]
     */
    public List<Map<String, Object>> draftRows(String orderNo, int lineNo) {
        String woNo = trim(orderNo);
        if (woNo.isEmpty()) return List.of();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, 序号, 物料编号, 物料名称, 计划用量, 实际用量 FROM dbo.wo_mixing_list"
                        + " WHERE 工单号 = ? AND 工单行号 = ? AND 标记 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY id", woNo, lineNo, MARK_DRAFT);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("行id", longOf(r.get("id")));
            v.put("序号", trim(r.get("序号")));
            v.put("物料编号", trim(r.get("物料编号")));
            v.put("物料名称", trim(r.get("物料名称")));
            v.put("计划用量", dbl(r.get("计划用量")));
            v.put("实际用量", dbl(r.get("实际用量")));
            out.add(v);
        }
        return out;
    }

    /**
     * 按混料单号取一张单(**《成型配料记录》纸面** + 明细页共用)。
     *
     * <p>2026-11-18 用户给了纸样:「这是混料打印的格式,按横板的 A4 打印」——
     * 纸面是《成型配料记录》(文件编码 YJ-QR-147),横板 A4:
     * <pre>
     *   序号 | 车间 | 产品编号 | 配方版本号 | 物料编号 | 物料名 | 添加比例 | 应投重量 |
     *   实投重量 | 物料批次 | 开始时间 | 结束时间 | 转速 | 配料批次号 | 物料水分 | 配料人 | 确认人
     * </pre>
     * 左四列与右七列在纸上是**纵向合并**的一格(整张单一行头 + N 行物料)。
     *
     * <p>各列取值:
     * <ul>
     *   <li>车间/产品编号 ← {@code plang.scx / plang.dm}(工单行);</li>
     *   <li>配方版本号 ← {@code wo_mixing_list.配方版本}(本版不挂配方,留空);</li>
     *   <li>添加比例 ← 该行 计划用量 / 本单 计划用量合计(与配方配料比同口径);</li>
     *   <li>应投重量 ← 计划用量;实投重量 ← 实际用量(电子秤);</li>
     *   <li>物料批次 ← 扫码时从物料码 {@code 存货编码|批号} 带下来的批号;</li>
     *   <li>配料批次号 ← 混料单号;配料人 ← 创建人;开始/结束时间 ← 首笔与保存时间;</li>
     *   <li>转速 / 物料水分 / 确认人:本系统没有对应数据源,留空由现场手填。</li>
     * </ul>
     *
     * @param docNo 混料单号(PL…)
     */
    public Map<String, Object> docRows(String docNo) {
        String no = trim(docNo);
        if (no.isEmpty()) throw new IllegalArgumentException("请提供混料单号");
        List<Map<String, Object>> heads = jdbc.queryForList(
                "SELECT TOP 1 工单号, 工单行号, asp_user1, asp_time1, ISNULL(asp_print,0) AS 打印次数,"
                        + " 配方版本, ISNULL(物料批次,'') AS 物料批次"
                        + " FROM dbo.wo_mixing_list WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY id", no);
        if (heads.isEmpty()) throw new IllegalArgumentException("没有找到混料单 " + no);
        Map<String, Object> h = heads.get(0);
        String woNo = trim(h.get("工单号"));
        int woLine = intOf(h.get("工单行号"));

        // 工单行:车间(生产线)/产品编号/产品名称;工单行不存在(历史数据)就留空,不让整张纸打不出来
        Map<String, Object> wo = null;
        if (!woNo.isEmpty()) {
            List<Map<String, Object>> woRows = jdbc.queryForList(
                    "SELECT TOP 1 scx, dm, mc FROM dbo.plang WHERE pl_no = ? AND pl_xc = ?"
                            + " AND ISNULL(asp_cancel,'N') <> 'Y'", woNo, woLine);
            if (woRows.isEmpty()) {
                woRows = jdbc.queryForList(
                        "SELECT TOP 1 scx, dm, mc FROM dbo.plang WHERE pl_no = ?"
                                + " AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY pl_xc", woNo);
            }
            if (!woRows.isEmpty()) wo = woRows.get(0);
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT 序号, 物料编号, 物料名称, 计划用量, 实际用量, ISNULL(物料批次,'') AS 物料批次"
                        + " FROM dbo.wo_mixing_list WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY TRY_CAST(序号 AS int), id", no);

        // 添加比例的分母 = 本单应投合计(与配方「配料比」同口径;合计为 0 时整列留空)
        double planSum = 0;
        double realSum = 0;
        for (Map<String, Object> r : rows) {
            planSum += dbl(r.get("计划用量"));
            realSum += dbl(r.get("实际用量"));
        }

        List<Map<String, Object>> lines = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            double plan = dbl(r.get("计划用量"));
            double real = dbl(r.get("实际用量"));
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("物料编号", trim(r.get("物料编号")));
            v.put("物料名", trim(r.get("物料名称")).isEmpty() ? trim(r.get("物料编号")) : trim(r.get("物料名称")));
            // 纸面「添加比例」按百分比印(18.67%);分母 0 ⇒ 空串,不印 "0.00%"
            v.put("添加比例", planSum > 0 ? pct(plan / planSum) : "");
            v.put("应投重量", num(plan));
            v.put("实投重量", num(real));
            v.put("物料批次", trim(r.get("物料批次")));
            // 兼容旧调用方(明细页/老的 7 列版式)的键:同一份数据换个名字
            v.put("材料名称", v.get("物料名"));
            v.put("请领数量", plan);
            v.put("实发数量", real);
            v.put("备注", trim(r.get("物料批次")));
            v.put("序号", trim(r.get("序号")));
            lines.add(v);
        }

        List<Map<String, Object>> times = jdbc.queryForList(
                "SELECT MIN(asp_time1) AS 开始时间, MAX(ISNULL(asp_time2, asp_time1)) AS 结束时间"
                        + " FROM dbo.wo_mixing_list WHERE 单据编号 = ?", no);
        String startAt = times.isEmpty() ? "" : trim(times.get(0).get("开始时间"));
        String endAt = times.isEmpty() ? "" : trim(times.get(0).get("结束时间"));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("面板", PagePanelRegistry.MIX_SCAN);
        out.put("单据编号", no);
        // ↓ 纸面《成型配料记录》抬头
        out.put("标题", "成型配料记录");
        out.put("文件编码", "YJ-QR-147");
        out.put("工单号", woNo);
        out.put("工单行号", woLine);
        out.put("车间", wo == null ? "" : trim(wo.get("scx")));
        out.put("产品编号", wo == null ? "" : trim(wo.get("dm")));
        out.put("产品名称", wo == null ? "" : trim(wo.get("mc")));
        out.put("配方版本号", trim(h.get("配方版本")));
        out.put("开始时间", startAt);
        out.put("结束时间", endAt);
        out.put("转速", "");
        out.put("配料批次号", no);
        out.put("物料水分", "");
        out.put("配料人", trim(h.get("asp_user1")));
        out.put("确认人", "");
        // ↓ 明细页/兼容用的抬头
        out.put("单据日期", startAt);
        out.put("部门", trim(h.get("asp_user1")));
        out.put("创建人", trim(h.get("asp_user1")));
        out.put("打印次数", intOf(h.get("打印次数")));
        out.put("计划用量合计", num(planSum));
        out.put("实际用量合计", num(realSum));
        out.put("明细", lines);
        return out;
    }

    /** 百分比文案:0.1867 → "18.67%"(两位小数,与纸样一致) */
    private static String pct(double v) {
        return BigDecimal.valueOf(v * 100).setScale(2, RoundingMode.HALF_UP).toPlainString() + "%";
    }

    /** 重量文案:去掉无意义的尾随 0(86.172 / 21.04 / 100) */
    private static String num(double v) {
        return BigDecimal.valueOf(v).setScale(4, RoundingMode.HALF_UP)
                .stripTrailingZeros().toPlainString();
    }

    /**
     * 记一次打印(补打印也算):{@code asp_print + 1}。
     *
     * <p>打印失败不该回滚业务(前端打印是次要动作),故调用方吞异常;这里只负责计数。
     *
     * @param docNo 混料单号
     * @return 更新后的打印次数(0 = 单号不存在)
     */
    public int markPrinted(String docNo) {
        String no = trim(docNo);
        if (no.isEmpty()) return 0;
        try {
            jdbc.update("UPDATE dbo.wo_mixing_list SET asp_print = ISNULL(asp_print,0) + 1 WHERE 单据编号 = ?", no);
            Integer n = jdbc.queryForObject(
                    "SELECT MAX(ISNULL(asp_print,0)) FROM dbo.wo_mixing_list WHERE 单据编号 = ?", Integer.class, no);
            return n == null ? 0 : n;
        } catch (Exception e) {
            log.warn("混料单打印次数累加失败(不影响出纸):{}", e.getMessage());
            return 0;
        }
    }

    // ═══════════════════════ 小工具 ═══════════════════════

    private static <T> T first(List<T> list) {
        return list == null || list.isEmpty() ? null : list.get(0);
    }

    private static String trim(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static int intOf(Object o) {
        if (o instanceof Number n) return n.intValue();
        try {
            return (int) Double.parseDouble(trim(o));
        } catch (RuntimeException e) {
            return 0;
        }
    }

    private static long longOf(Object o) {
        if (o instanceof Number n) return n.longValue();
        try {
            return (long) Double.parseDouble(trim(o));
        } catch (RuntimeException e) {
            return 0;
        }
    }

    private static Long longOrNull(Object o) {
        long v = longOf(o);
        return v > 0 ? v : null;
    }

    private static double dbl(Object o) {
        if (o instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(trim(o));
        } catch (RuntimeException e) {
            return 0;
        }
    }

    private static int nullToInt(Integer v) {
        return v == null ? 0 : v;
    }

    /** 数量统一按 4 位小数落地(与 decimal(18,8) 存储、界面显示一致,消掉浮点尾差) */
    private static BigDecimal round4(Object o) {
        return BigDecimal.valueOf(dbl(o)).setScale(4, RoundingMode.HALF_UP);
    }
}
