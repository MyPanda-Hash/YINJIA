package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 品质流程监控(2026-11-12;同日第二轮用户口径见下)。
 *
 * <p><b>一行是什么</b>:一行 = **送料暂收单的一条物料行**(= 一个来料批次),把这条批次在
 * 「送料暂收单 {@code sl_recv} → 来料检验单 {@code qc_insp} →(不合格时)暂收退回单 {@code qc_return}
 * →(让步接收时)特采单 {@code qc_tc_in} → 采购入库单 {@code bd_purchase_in}」上的落点摊平到一行 ——
 * 这是「一条来料批次走到哪一步、卡在谁手上」的最小单元,也是用户点名要的「物料批号 + 物料编码」那一层粒度。
 *
 * <p><b>不合格分支(2026-11-12 第二轮)</b>:检验之后是**两条路**,不是一条直线:
 * <ul>
 *   <li>合格 → 采购入库单;</li>
 *   <li>不合格 → 暂收退回单(退回供应商)→ 若让步接收则再开特采单 → 特采审批通过后 → 采购入库单。</li>
 * </ul>
 * 两个分支单都带自己的状态与跳转(暂收退回单 / 特采单)。
 *
 * <p><b>隐藏(2026-11-12 第二轮用户口径)</b>:「入库单转ERP后就隐藏了……隐藏后的单据是可以重新打开的」。
 * 判定 = **末尾单据已转 ERP**:有采购入库单就看它的 {@code 是否已转ERP};没有入库单(纯退货退回)就看
 * 退货单的 {@code 是否已转ERP}。默认不显示这些行,但**不是删数据** —— 传 {@code 含已隐藏=true} 就能
 * 原样显示回来并照常点节点打开那张单;接口另给 {@code 汇总.已隐藏} 告诉界面藏了多少条。
 *
 * <p><b>状态真源</b>:五张单的「单据状态」**不读单头表的 单据状态 列,也不只看审核人列** ——
 * 系统里单据状态机的唯一真源是 {@code yj_doc_status}(panel_code + doc_no),由
 * {@code ButtonService.docStatusOf} 统一推导(已作废 &gt; 已中止 &gt; 审批中 &gt; 已审核 &gt; 草稿)。
 * 这里按同一优先级在 SQL 里折叠;{@code yj_doc_status} 无行时(旧系统导入/金蝶同步进来的单)先看
 * {@code 审核时间} 再看单头 {@code 单据状态} 列。
 *
 * <p><b>链路怎么连</b>(逐级 OUTER APPLY,取不到就留空,绝不因链断而丢行):
 * <ol>
 *   <li>送料 → 检验:{@code qc_insp.暂收单号 = sl_recv.单据编号} + 检验行 {@code 物料编码} 相同(同批次优先);</li>
 *   <li>检验 → 退货:{@code qc_return.检验单号 = 检验单号};取不到再按「批次号 + 明细物料编码」兜;</li>
 *   <li>检验 → 特采:{@code qc_tc_in.检验单号 = 检验单号};取不到再按「批次号 + 产品名称=物料名称」兜;</li>
 *   <li>检验/送料/退货/特采 → 入库,按可信度三级:
 *       ① 检验行上直接记了入库单号;② 入库单 {@code 来源单号} = 检验单号 / 暂收单号 / 退货单号 / 特采单号;
 *       ③ **批号推定**:入库行 {@code 批次号/批号} = 送料行 {@code 批次号} 且 存货编码相同。
 *       每条命中都带 {@code 入库匹配方式} 一起下发 —— ③ 是推定,界面上要标出来,别当铁证;</li>
 *   <li>是否免检:{@code bs_inv.来料检验 = '是'} 才走来料检验;其余物料送料审核完就直接入库
 *       (故「当前环节」对免检批次**跳过检验**,否则整块看板会把免检批次全标成「卡检验」)。</li>
 * </ol>
 *
 * <p><b>只读</b>:本服务不改任何业务数据;权限闸门在 Controller(页面级虚拟面板 QC_FLOW)。
 * 跳转不在这里做(前端按 docNo 跳,并按目标面板的查看权决定能不能跳)。
 */
@Service
public class QcFlowService {

    /** 看板默认/最大行数:一屏滚动查看,首页加载不拉全库(暂收单行 500 上下) */
    private static final int DEFAULT_LIMIT = 300;
    private static final int MAX_LIMIT = 800;
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final JdbcTemplate jdbc;

    public QcFlowService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 看板数据(只读,现算)。
     *
     * @param body 可选条件:{@code 状态}(全部/未完成/已完成/待检验/待退货/待特采/待入库/异常,默认未完成)、
     *             {@code keyword}(单号/物料/批号/供应商片段)、{@code 日期起}/{@code 日期止}(送料日期)、
     *             {@code 仅需检验}、{@code 含已隐藏}(默认 false:不返回已转 ERP 的行)、
     *             {@code limit}(1~800,默认 300)
     * @return {@code {数据时间, 汇总, 行:[{…}]}}
     */
    public Map<String, Object> board(Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        String state = nz(str(b.get("状态")));
        if (state.isEmpty()) state = "未完成";
        String keyword = str(b.get("keyword"));
        String from = str(b.get("日期起"));
        String to = str(b.get("日期止"));
        boolean withHidden = boolOf(b.get("含已隐藏"));
        int limit = intOf(b.get("limit"), DEFAULT_LIMIT);
        limit = Math.max(1, Math.min(limit, MAX_LIMIT));

        List<Object> args = new ArrayList<>();
        StringBuilder w = new StringBuilder(" WHERE 1=1");
        if (keyword != null) {
            String like = "%" + keyword + "%";
            w.append(" AND (送料暂收单号 LIKE ? OR 供应商 LIKE ? OR 采购订单号 LIKE ?")
                    .append(" OR 物料编码 LIKE ? OR 物料名称 LIKE ? OR 物料批号 LIKE ?")
                    .append(" OR ISNULL(检验单号,N'') LIKE ? OR ISNULL(入库单号,N'') LIKE ?")
                    .append(" OR ISNULL(退货单号,N'') LIKE ? OR ISNULL(特采单号,N'') LIKE ?)");
            for (int i = 0; i < 10; i++) args.add(like);
        }
        if (from != null) {
            w.append(" AND 送料日期 >= ?");
            args.add(from);
        }
        if (to != null) {
            w.append(" AND 送料日期 <= ?");
            args.add(to);
        }
        if ("未完成".equals(state)) {
            // 未完成 = 真正还在走的(送料/检验/退货/特采/入库);已作废/已中止/全不合格的另行归「异常」,
            //   否则默认视图会被一堆废单占满(测试库 1059 张状态行里 427 张已作废)。
            w.append(" AND 当前环节 IN (N'送料', N'检验', N'退货', N'特采', N'入库') AND 异常 = 0");
        } else if ("已完成".equals(state)) {
            w.append(" AND 当前环节 = N'完成'");
        } else if ("待检验".equals(state)) {
            w.append(" AND 当前环节 = N'检验'");
        } else if ("待退货".equals(state)) {
            w.append(" AND 当前环节 = N'退货'");
        } else if ("待特采".equals(state)) {
            w.append(" AND 当前环节 = N'特采'");
        } else if ("待入库".equals(state)) {
            w.append(" AND 当前环节 = N'入库'");
        } else if ("异常".equals(state)) {
            w.append(" AND 异常 = 1");
        }
        // 只看需检验的批次:品质日常真正要盯的就是这些(免检批次审核完直接入库,不归品质管)
        if (boolOf(b.get("仅需检验"))) {
            w.append(" AND 需检验 = 1");
        }

        String inner = innerSelect();
        String sql = "SELECT TOP " + limit + " * FROM (" + inner + ") t" + w
                + (withHidden ? "" : " AND 已隐藏 = 0")
                + " ORDER BY 送料日期 DESC, 送料暂收单号, 行id";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args.toArray());
        for (Map<String, Object> r : rows) {
            r.put("停留天数", stuckDays(str(r.get("当前环节")), str(r.get("送料日期")),
                    str(r.get("检验日期")), str(r.get("退货日期")), str(r.get("特采日期")), str(r.get("入库日期"))));
        }

        // 被隐藏了多少条(同一批筛选条件下、已转ERP 的那些):界面用它在开关上显示「显示已隐藏 N 条」
        Map<String, Object> summary = summary(rows);
        Number hidden = jdbc.queryForObject("SELECT COUNT(*) FROM (" + inner + ") t" + w + " AND 已隐藏 = 1",
                Number.class, args.toArray());
        summary.put("已隐藏", hidden == null ? 0 : hidden.intValue());
        summary.put("含已隐藏", withHidden);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("数据时间", LocalDateTime.now().format(TS));
        out.put("汇总", summary);
        out.put("行", rows);
        return out;
    }

    /**
     * 单据状态取值(三段兜底,顺序不能反):
     * <ol>
     *   <li>{@code yj_doc_status} 有行 → 按 5 档折叠(**唯一真源**,优先级与 ButtonService.docStatusOf 一致);</li>
     *   <li>没行(旧系统导入/金蝶同步进来的单) → 先看**审核时间**有没有值,再看单头「单据状态」列。
     *       ⚠ 顺序不能反:正式库 320 张暂收单的单头「单据状态」全停在「草稿」,其中 290 张审核时间有值 ——
     *       先读那一列会把已经审核过的批次全显示成草稿;</li>
     *   <li>都没有 → 草稿。</li>
     * </ol>
     *
     * @param d           yj_doc_status 的 APPLY 别名(没命中时它的 4 个列全为 NULL —— 用它判"没行")
     * @param headStatus  单头「单据状态」表达式(如 {@code h.单据状态})
     * @param headAudit   单头「审核时间」表达式(如 {@code h.审核时间})
     */
    private static String statusOf(String d, String headStatus, String headAudit) {
        String noRow = d + ".shr IS NULL AND " + d + ".canceled IS NULL AND "
                + d + ".stopped IS NULL AND " + d + ".pending IS NULL";
        return "CASE WHEN " + noRow + " THEN COALESCE("
                + "CASE WHEN " + headAudit + " IS NOT NULL THEN N'已审核' ELSE NULLIF(" + headStatus + ", N'') END,"
                + " N'草稿')"
                + " WHEN ISNULL(" + d + ".canceled,'N')='Y' THEN N'已作废'"
                + " WHEN ISNULL(" + d + ".stopped,'N')='Y' THEN N'已中止'"
                + " WHEN ISNULL(" + d + ".pending,'N')='Y' THEN N'审批中'"
                + " WHEN ISNULL(" + d + ".shr,N'')<>N'' THEN N'已审核'"
                + " ELSE N'草稿' END";
    }

    /**
     * 行取数(不含筛选/排序):送料行 × 检验行 × 退货行 × 特采单 × 入库行 × 五张单的状态 × 商品档案检验口径。
     *
     * <p>分两层写:`core` 把各单和状态取齐,外层再据此判「当前环节」。
     * 为什么不在一层写 —— SQL Server **不允许在同一个 SELECT 里引用刚起的别名**(`需检验`)。
     *
     * <p>⚠ 所有 OUTER APPLY 一律 {@code TOP 1 + ORDER BY},同一批次重复命中时取最靠前的一条,
     * 保证**一行就是一行**(不做笛卡尔膨胀)。APPLY 的先后顺序有依赖:
     * 退货/特采要先于入库(入库的②级关联要用它们的单号)。
     */
    private static String innerSelect() {
        String recvStatus = statusOf("d1", "h.单据状态", "h.审核时间");
        // 该环节还没有单据时状态给 NULL(而不是「草稿」):前端据此显示「未生成」/「免检」,
        //   接口也不至于让「没有检验单」的批次看起来像"有一张草稿检验单"。
        String inspStatus = "CASE WHEN ins.检验单号 IS NULL THEN NULL ELSE "
                + statusOf("d2", "ins.检验头状态", "ins.检验审核时间") + " END";
        String retStatus = "CASE WHEN ret.退货单号 IS NULL THEN NULL ELSE "
                + statusOf("d4", "ret.退货头状态", "ret.退货审核时间") + " END";
        String tcStatus = "CASE WHEN tc.特采单号 IS NULL THEN NULL ELSE "
                + statusOf("d5", "tc.特采头状态", "tc.特采审核时间") + " END";
        String pinStatus = "CASE WHEN put.入库单号 IS NULL THEN NULL ELSE "
                + statusOf("d3", "put.入库头状态", "put.入库审核时间") + " END";
        String core = """
                SELECT
                    d.id AS 行id,
                    h.单据编号 AS 送料暂收单号,
                    CONVERT(nvarchar(10), h.单据日期, 120) AS 送料日期,
                    %s AS 送料状态,
                    ISNULL(h.供应商, N'') AS 供应商,
                    ISNULL(h.采购订单号, N'') AS 采购订单号,
                    ISNULL(d.采购订单行号, N'') AS 采购订单行号,
                    ISNULL(h.来料性质, N'') AS 来料性质,
                    ISNULL(h.仓库, N'') AS 仓库,
                    ISNULL(d.物料编码, N'') AS 物料编码,
                    ISNULL(d.物料名称, N'') AS 物料名称,
                    ISNULL(d.规格型号, N'') AS 规格型号,
                    ISNULL(d.批次号, N'') AS 物料批号,
                    ISNULL(d.计量单位, N'') AS 计量单位,
                    ISNULL(d.数量, 0) AS 来料数量,
                    ISNULL(d.退料数量, 0) AS 退料数量,
                    COALESCE(NULLIF(cat.检测物料类别, N''), NULLIF(inv.所属类别, N''), N'') AS 检测物料类别,
                    /* ── 检验 ── */
                    ins.检验单号 AS 检验单号,
                    CONVERT(nvarchar(10), ins.检验日期, 120) AS 检验日期,
                    ISNULL(ins.检验员, N'') AS 检验员,
                    ins.送检数量 AS 送检数量,
                    ins.合格数量 AS 合格数量,
                    ins.不合格数量 AS 不合格数量,
                    /* 检验结论:合格 / 不合格 / 部分不合格(同批既有合格又有不合格时不能一口咬定"不合格",
                       否则品质会去追一批其实大部分合格的料);三者都为空 = 还没填结果 */
                    CASE WHEN ins.检验单号 IS NULL THEN NULL
                         WHEN ISNULL(ins.合格数量, 0) > 0 AND ISNULL(ins.不合格数量, 0) > 0 THEN N'部分不合格'
                         WHEN ISNULL(ins.不合格数量, 0) > 0 THEN N'不合格'
                         WHEN ISNULL(ins.合格数量, 0) > 0 THEN N'合格'
                         ELSE NULL END AS 检验结论,
                    %s AS 检验状态,
                    /* ── 不合格分支一:暂收退回单 ── */
                    ret.退货单号 AS 退货单号,
                    CONVERT(nvarchar(10), ret.退货日期, 120) AS 退货日期,
                    ISNULL(ret.退货类型, N'') AS 退货类型,
                    ret.退货数量 AS 退货数量,
                    %s AS 退货状态,
                    ISNULL(ret.退货已转ERP, N'') AS 退货已转ERP,
                    ISNULL(ret.退货ERP单号, N'') AS 退货ERP单号,
                    /* ── 不合格分支二:特采单(让步接收) ── */
                    tc.特采单号 AS 特采单号,
                    CONVERT(nvarchar(10), tc.特采日期, 120) AS 特采日期,
                    tc.不合格品数量 AS 特采数量,
                    ISNULL(tc.最终处理结果, N'') AS 特采结果,
                    %s AS 特采状态,
                    /* ── 入库 ── */
                    put.入库单号 AS 入库单号,
                    CONVERT(nvarchar(10), put.入库日期, 120) AS 入库日期,
                    put.实收数量 AS 实收数量,
                    ISNULL(put.匹配方式, N'') AS 入库匹配方式,
                    ISNULL(put.是否已转ERP, N'') AS 入库已转ERP,
                    ISNULL(put.ERP单号, N'') AS 入库ERP单号,
                    %s AS 入库状态,
                    CASE WHEN ins.检验单号 IS NOT NULL THEN 1
                         WHEN ISNULL(NULLIF(inv.来料检验, N''), NULLIF(put.是否来料检验, N'')) = N'是' THEN 1
                         ELSE 0 END AS 需检验,
                    /* 异常:只看送料/检验/入库三张主链单的作废·中止 + 检验全不合格。
                       退回/特采**不计入**异常 —— 它们与批次的关联在数据稀疏时是按「批次号+物料」兜底匹配的,
                       一张作废退回单会同时挂到同批次的多个送料行上,计进来会把异常数虚高(实测 11→35);
                       它们自己的状态在分支节点上照常显示(红色=已作废),不会被藏掉。 */
                    CASE WHEN ISNULL(d1.canceled,'N')='Y' OR ISNULL(d2.canceled,'N')='Y' OR ISNULL(d3.canceled,'N')='Y'
                               OR ISNULL(d1.stopped,'N')='Y' OR ISNULL(d2.stopped,'N')='Y' OR ISNULL(d3.stopped,'N')='Y'
                               OR (ISNULL(ins.不合格数量, 0) > 0 AND ISNULL(ins.合格数量, 0) = 0)
                         THEN 1 ELSE 0 END AS 异常,
                    /* 隐藏:末尾单据已转 ERP。有入库单看入库单(退回后又被特采放行时,入库单才是终点);
                       没有入库单(纯退回供应商)才看退货单 —— 两者都只是"隐藏显示",数据仍在。 */
                    CASE WHEN put.入库单号 IS NOT NULL AND put.是否已转ERP = N'是' THEN 1
                         WHEN put.入库单号 IS NULL AND ret.退货已转ERP = N'是' THEN 1
                         ELSE 0 END AS 已隐藏
                  FROM dbo.sl_recv_detail d
                  JOIN dbo.sl_recv h
                    ON h.单据编号 = d.单据编号 AND ISNULL(h.asp_cancel,'N') <> 'Y'
                  /* 来料检验单:同一暂收单 + 同一物料;同批次优先,再取最新一张 */
                  OUTER APPLY (SELECT TOP 1 i.单据编号 AS 检验单号, i.检验日期, i.检验员,
                                      i.单据状态 AS 检验头状态, i.审核时间 AS 检验审核时间,
                                      x.送检数量, x.合格数量, x.不合格数量, x.入库单号 AS 检验入库单号
                                 FROM dbo.qc_insp i
                                 JOIN dbo.qc_insp_detail x
                                   ON x.单据编号 = i.单据编号 AND ISNULL(x.asp_cancel,'N') <> 'Y'
                                WHERE ISNULL(i.asp_cancel,'N') <> 'Y'
                                  AND i.暂收单号 = h.单据编号
                                  AND x.物料编码 = d.物料编码
                                ORDER BY CASE WHEN ISNULL(x.批次号, N'') = ISNULL(d.批次号, N'') THEN 0 ELSE 1 END,
                                         i.id DESC) ins
                  /* 暂收退回单(不合格退回):先按检验单号,再按「批次号 + 明细物料编码」兜底 */
                  OUTER APPLY (SELECT TOP 1 r.单据编号 AS 退货单号, r.单据日期 AS 退货日期, r.退货类型,
                                      r.单据状态 AS 退货头状态, r.审核时间 AS 退货审核时间,
                                      r.是否已转ERP AS 退货已转ERP, r.ERP单号 AS 退货ERP单号,
                                      (SELECT SUM(ISNULL(rx.退货数量, 0))
                                         FROM dbo.qc_return_detail rx
                                        WHERE rx.单据编号 = r.单据编号
                                          AND ISNULL(rx.asp_cancel,'N') <> 'Y'
                                          AND (rx.物料编码 = d.物料编码 OR ISNULL(rx.物料编码, N'') = N'')) AS 退货数量
                                 FROM dbo.qc_return r
                                WHERE ISNULL(r.asp_cancel,'N') <> 'Y'
                                  AND ((ins.检验单号 IS NOT NULL AND r.检验单号 = ins.检验单号)
                                       OR (ISNULL(d.批次号, N'') <> N'' AND r.批次号 = d.批次号
                                           AND EXISTS (SELECT 1 FROM dbo.qc_return_detail rx
                                                        WHERE rx.单据编号 = r.单据编号
                                                          AND ISNULL(rx.asp_cancel,'N') <> 'Y'
                                                          AND rx.物料编码 = d.物料编码)))
                                ORDER BY CASE WHEN ins.检验单号 IS NOT NULL AND r.检验单号 = ins.检验单号 THEN 0 ELSE 1 END,
                                         r.id DESC) ret
                  /* 特采单(让步接收):先按检验单号,再按「批次号 + 产品名称=物料名称」兜底 */
                  OUTER APPLY (SELECT TOP 1 t.单据编号 AS 特采单号, t.单据日期 AS 特采日期,
                                      t.不合格品数量, t.最终处理结果,
                                      t.单据状态 AS 特采头状态, t.审核时间 AS 特采审核时间
                                 FROM dbo.qc_tc_in t
                                WHERE ISNULL(t.asp_cancel,'N') <> 'Y'
                                  AND ((ins.检验单号 IS NOT NULL AND t.检验单号 = ins.检验单号)
                                       OR (ISNULL(d.批次号, N'') <> N'' AND t.批次号 = d.批次号
                                           AND t.产品名称 = d.物料名称))
                                ORDER BY CASE WHEN ins.检验单号 IS NOT NULL AND t.检验单号 = ins.检验单号 THEN 0 ELSE 1 END,
                                         t.id DESC) tc
                  /* 采购入库单:① 检验行记的入库单号 → ② 入库单来源单号(检验/暂收/退货/特采)
                     → ③ 批号推定(标出来给用户判断) */
                  OUTER APPLY (SELECT TOP 1 q.入库单号, q.入库日期, q.实收数量, q.匹配方式, q.是否来料检验,
                                      q.入库头状态, q.入库审核时间, q.是否已转ERP, q.ERP单号
                                 FROM (
                                   SELECT b.单据编号 AS 入库单号, b.单据日期 AS 入库日期, l.实收数量,
                                          N'检验单行' AS 匹配方式, l.是否来料检验,
                                          b.单据状态 AS 入库头状态, b.审核时间 AS 入库审核时间,
                                          b.是否已转ERP, b.ERP单号, 1 AS 优先级, l.id AS 排序
                                     FROM dbo.bl_purchase_in l
                                     JOIN dbo.bd_purchase_in b
                                       ON b.单据编号 = l.单据编号 AND ISNULL(b.asp_cancel,'N') <> 'Y'
                                    WHERE ISNULL(l.asp_cancel,'N') <> 'Y'
                                      AND l.存货编码 = d.物料编码
                                      AND b.单据编号 = ins.检验入库单号
                                   UNION ALL
                                   SELECT b.单据编号, b.单据日期, l.实收数量, N'来源单号', l.是否来料检验,
                                          b.单据状态, b.审核时间, b.是否已转ERP, b.ERP单号, 2, l.id
                                     FROM dbo.bl_purchase_in l
                                     JOIN dbo.bd_purchase_in b
                                       ON b.单据编号 = l.单据编号 AND ISNULL(b.asp_cancel,'N') <> 'Y'
                                    WHERE ISNULL(l.asp_cancel,'N') <> 'Y'
                                      AND l.存货编码 = d.物料编码
                                      AND b.来源单号 IN (ins.检验单号, h.单据编号, ret.退货单号, tc.特采单号)
                                   UNION ALL
                                   SELECT b.单据编号, b.单据日期, l.实收数量, N'批号推定', l.是否来料检验,
                                          b.单据状态, b.审核时间, b.是否已转ERP, b.ERP单号, 3, l.id
                                     FROM dbo.bl_purchase_in l
                                     JOIN dbo.bd_purchase_in b
                                       ON b.单据编号 = l.单据编号 AND ISNULL(b.asp_cancel,'N') <> 'Y'
                                    WHERE ISNULL(l.asp_cancel,'N') <> 'Y'
                                      AND l.存货编码 = d.物料编码
                                      AND ISNULL(d.批次号, N'') <> N''
                                      AND (l.批次号 = d.批次号 OR l.批号 = d.批次号)
                                 ) q
                                ORDER BY q.优先级, q.排序 DESC) put
                  /* 检验目录行(参考检验目录):检测物料类别 */
                  OUTER APPLY (SELECT TOP 1 z.检测物料类别
                                 FROM dbo.qc_catalog_detail z
                                WHERE ISNULL(z.asp_cancel,'N') <> 'Y'
                                  AND z.检验单号 = ins.检验单号
                                  AND z.物料编码 = d.物料编码
                                ORDER BY CASE WHEN ISNULL(z.批次号, N'') = ISNULL(d.批次号, N'') THEN 0 ELSE 1 END,
                                         z.id DESC) cat
                  /* 商品档案:所属类别 / 来料检验(是否免检的真源) */
                  OUTER APPLY (SELECT TOP 1 v.所属类别, v.来料检验
                                 FROM dbo.bs_inv v WHERE v.存货编码 = d.物料编码 ORDER BY v.id) inv
                  OUTER APPLY (SELECT TOP 1 s.canceled, s.stopped, s.pending, s.shr
                                 FROM dbo.yj_doc_status s
                                WHERE s.panel_code = N'QC_RECV' AND s.doc_no = h.单据编号) d1
                  OUTER APPLY (SELECT TOP 1 s.canceled, s.stopped, s.pending, s.shr
                                 FROM dbo.yj_doc_status s
                                WHERE s.panel_code = N'QC_INSP' AND s.doc_no = ins.检验单号) d2
                  OUTER APPLY (SELECT TOP 1 s.canceled, s.stopped, s.pending, s.shr
                                 FROM dbo.yj_doc_status s
                                WHERE s.panel_code = N'PURCHASE_IN' AND s.doc_no = put.入库单号) d3
                  OUTER APPLY (SELECT TOP 1 s.canceled, s.stopped, s.pending, s.shr
                                 FROM dbo.yj_doc_status s
                                WHERE s.panel_code = N'QC_RETURN' AND s.doc_no = ret.退货单号) d4
                  OUTER APPLY (SELECT TOP 1 s.canceled, s.stopped, s.pending, s.shr
                                 FROM dbo.yj_doc_status s
                                WHERE s.panel_code = N'QC_TC_IN' AND s.doc_no = tc.特采单号) d5
                 WHERE ISNULL(d.asp_cancel,'N') <> 'Y'
                """.formatted(recvStatus, inspStatus, retStatus, tcStatus, pinStatus);
        // 当前环节:送料未审 → 检验 → (不合格)退货 → (让步)特采 → 入库 → 完成。
        // 异常(作废/中止)单独出标记,不参与环节判定(异常单也要看得见卡在哪一步)。
        String stage = """
                CASE
                  WHEN c.送料状态 <> N'已审核' THEN N'送料'
                  WHEN c.需检验 = 1 AND (c.检验单号 IS NULL OR c.检验状态 <> N'已审核') THEN N'检验'
                  WHEN c.特采单号 IS NOT NULL AND c.特采状态 IN (N'草稿', N'审批中') THEN N'特采'
                  WHEN c.特采单号 IS NULL AND c.退货单号 IS NOT NULL
                       AND c.退货状态 IN (N'草稿', N'审批中') THEN N'退货'
                  WHEN c.特采单号 IS NULL AND c.退货单号 IS NULL AND c.入库单号 IS NULL
                       AND c.检验结论 = N'不合格' THEN N'退货'
                  WHEN c.入库单号 IS NOT NULL AND c.入库状态 <> N'已审核' THEN N'入库'
                  WHEN c.入库单号 IS NULL AND c.特采单号 IS NULL AND c.退货单号 IS NOT NULL
                       AND c.退货状态 = N'已审核' THEN N'完成'
                  WHEN c.入库单号 IS NULL THEN N'入库'
                  ELSE N'完成' END AS 当前环节
                """;
        return "SELECT c.*, " + stage.strip() + " FROM (" + core + ") c";
    }

    /** 汇总口径:只统计本次返回的行(与界面所见一致,不做"全库口径"的另一套数) */
    private static Map<String, Object> summary(List<Map<String, Object>> rows) {
        int undone = 0;
        int done = 0;
        int waitInsp = 0;
        int waitRet = 0;
        int waitTc = 0;
        int waitIn = 0;
        int abnormal = 0;
        int noInspect = 0;
        for (Map<String, Object> r : rows) {
            String stage = nz(str(r.get("当前环节")));
            boolean bad = num(r.get("异常")) != 0;
            if ("完成".equals(stage)) done++;
            else if (!bad) undone++;
            if ("检验".equals(stage)) waitInsp++;
            if ("退货".equals(stage)) waitRet++;
            if ("特采".equals(stage)) waitTc++;
            if ("入库".equals(stage)) waitIn++;
            if (bad) abnormal++;
            if (num(r.get("需检验")) == 0) noInspect++;
        }
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("行数", rows.size());
        s.put("未完成", undone);
        s.put("已完成", done);
        s.put("待检验", waitInsp);
        s.put("待退货", waitRet);
        s.put("待特采", waitTc);
        s.put("待入库", waitIn);
        s.put("异常", abnormal);
        s.put("免检", noInspect);
        return s;
    }

    /**
     * 停留天数:停在哪个环节就从**那个环节单据的日期**算到今天(送料未审 → 送料日期;待检/检验中 → 检验日期,
     * 没有检验单就退回送料日期;待退货 → 退货日期;待特采 → 特采日期;待入库 → 入库日期);
     * 缺单据时逐级退回上一张单的日期,已完成给 0。
     *
     * <p>为什么要"退回":缺单据的批次没有那个日期,不能因此显示「-」—— 它恰恰是最该被催的那些行。
     */
    private static int stuckDays(String stage, String recvDate, String inspDate,
                                 String retDate, String tcDate, String inDate) {
        String base;
        if ("送料".equals(stage)) {
            base = recvDate;
        } else if ("检验".equals(stage)) {
            base = firstNonEmpty(inspDate, recvDate);
        } else if ("退货".equals(stage)) {
            base = firstNonEmpty(retDate, inspDate, recvDate);
        } else if ("特采".equals(stage)) {
            base = firstNonEmpty(tcDate, retDate, inspDate, recvDate);
        } else if ("入库".equals(stage)) {
            base = firstNonEmpty(inDate, tcDate, retDate, inspDate, recvDate);
        } else {
            base = firstNonEmpty(inDate, tcDate, retDate, inspDate, recvDate);
        }
        LocalDate d = parseDate(base);
        if (d == null) return 0;
        long days = ChronoUnit.DAYS.between(d, LocalDate.now());
        return days < 0 ? 0 : (int) days;
    }

    private static String firstNonEmpty(String... vals) {
        for (String v : vals) {
            if (v != null && !v.trim().isEmpty()) return v;
        }
        return null;
    }

    private static LocalDate parseDate(String s) {
        if (s == null || s.length() < 10) return null;
        try {
            return LocalDate.parse(s.substring(0, 10));
        } catch (RuntimeException e) {
            return null;
        }
    }

    /* ---- 小工具(与 WorkOrderProgressService 同口径,避免各处各写一套) ---- */

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isEmpty() || "null".equals(s) ? null : s;
    }

    private static boolean boolOf(Object o) {
        if (o == null) return false;
        if (o instanceof Boolean bo) return bo;
        String s = String.valueOf(o).trim();
        return "true".equalsIgnoreCase(s) || "1".equals(s) || "是".equals(s);
    }

    private static double num(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static int intOf(Object o, int dft) {
        if (o == null) return dft;
        if (o instanceof Number n) return n.intValue();
        try {
            return (int) Double.parseDouble(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return dft;
        }
    }
}
