package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.FormNoService;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.WoPickBatchService;
import com.yinjia.mes.service.WoPickDocService;
import com.yinjia.mes.service.WorkOrderBomService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 手机扫码 · 生产领料(2026-10-30 重写)。
 *
 * <h3>用户口径(原话)</h3>
 * 「把生产领料和工序报工这两个 app 的面版重新放在一个新的『手机扫码』(和生产计划平级)导航下。
 *  工序报工不变。生产领料重写。
 *  现在是先做一个『生成工单领料/退料单』,先扫工单号,然后根据这个工单的物料,去查询组织工艺清单的
 *  组织bom表。对应生成一条生产领料单和生产退料单的数据。
 *  然后进入『生产领料』的界面,这个界面上面是查询框和查询按钮。下面是列着每个单据的表头数据。
 *  如果点进去对应单据里面可以看到对应的领料单明细。并且中间还可以扫描工单号(直接查看对应的领料单据)。
 *  然后进入到那个单据……可以扫码(扫的是物料码,如果对应的物料码存在,就可以填写领料数量
 *  (数量可以随意填写,只要仓库数量足够,多少都可以),批次处理也保留之前的)和打印
 *  (打印就先只是先打印工单二维码,在生成生产领料单的时候自动打印一次)。
 *  全部领料完成后才可以提交转成生产领料单,并且将已完成的单据,在生产领料的界面放到下面的已完成区
 *  (并且已完成和未完成都可以展开和收缩)。
 *  生产退料与领料一致,只是退料默认数量为0。可以不进行退料操作,退料生成的应该是其他入库单,并且写好备注。」

 * <h3>BOM 来源(2026-10-30 二次确认;2026-11-02 换表;2026-11-18 混料侧换《混料物料清单》)</h3>
 * 用户二次确认:「就是组装BOM表(RD_ASM_BOM),我去把数据录进去」。
 * ⚠ 2026-11-02 起数据源已迁到 {@code bs_asm_bom}(数据建模 → 生产 → 组装物料清单,面板 ASM_BOM,
 * 单表 doc 模式;取数与明细见 {@link com.yinjia.mes.service.WorkOrderBomService})。
 * 2026-11-13 起再上一层:**临时工单用料(wo_bom)优先**,没有才回落 {@code bs_asm_bom} 标准 BOM
 * (用户口径「新增生产工单→临时工单,上方主物料下方所需物料」)。
 * 取数口径 = 按工单行的**产品编号 + 工序=N'组装'**取最新一版 BOM(默认BOM='是' 优先,其次版本号最大),
 * 再取该单 {@code 子件编码 / 子件名称 / 子件规格 / 标准用量}。
 *
 * <p>🔴 2026-11-18 用户口径「生成工单领料的时候,关联物料清单生成混料领料单,从根据物料清单领料改为
 * 根据混料物料清单生成」:同一工单行出的**两张单**取数来源不同 ——
 * <pre>
 *   组装领料单:工单产品的《组装物料清单》(bs_asm_bom,临时工单用料优先)   ← 不变
 *   混料领料单:半成品(编码含 **TB)对应的《混料物料清单》(bs_mix_bom)      ← 本版改
 * </pre>
 * 混料侧取数收口在 {@link com.yinjia.mes.service.MixBomService}(定位键 = 产品编号 + 烧结类型;
 * 「单支含量g」按存货计量单位换算成单件用量),与手机扫码「扫码混料」**同源**,一套配方不再维护两处。
 * 上一版读的「半成品自己的组装物料清单」{@code bomService.standardOf(semiCode)} 已不再用于混料单。
 *
 * <h3>为什么物料来源不能是「成型工艺清单」</h3>
 * {@code rd_mold_proc_detail} 的列是「物料种类/实际添加比例/单支物料含量/设计添加量」——
 * 那是**配比**不是可直接领用的数量。混料领料单**不直读**研发单,读的是归档同步出来的
 * 《混料物料清单》(同一批列 + 单位),换算口径(单支含量g → 存货单位)由 MixBomService 统一解释。
 *
 * <h3>本控制器不做的事</h3>
 * <ul>
 *   <li>**不直接写库存**:领料提交走 {@code ButtonService.callButton(MATERIAL_OUT, "审核")},
 *       由 {@link com.yinjia.mes.service.StockLedgerService} 按既有链路过账 —— 与所有别的单据同一条路,
 *       不另写 SQL 记账(2026-10-16 的教训:自己算一遍必然和看板分叉)。</li>
 *   <li>**不替仓管审批**(2026-11-18 用户口径「所有生成的单都要是草稿状态」):手机端生成的
 *       生产领料单 / 生产退料单一律留**草稿**,审核(过账)在对应面板里由仓管点。</li>
 *   <li>**不做批次追溯口径的改动**:出库批次仍按既有「先进先出拆批」逻辑,可用量仍按
 *       物料+仓库 判断(验收期权宜口径,见 {@code StockLedgerService.LOT_STRICT} 与
 *       「上线前必验-库存批次追溯」文档)。</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/px/mobilePick")
public class MobilePickController {

    private static final Logger log = LoggerFactory.getLogger(MobilePickController.class);

    /** 领料单面板(生产领料单,业务类型「生产领料」) */
    private static final String PANEL_OUT = "MATERIAL_OUT";
    /**
     * 退料单面板(**生产退料单**,业务类型「生产退料」)。
     *
     * <p>2026-11-13 用户口径:「手机扫码的生产退料扫码后退料后填入的单据从其他入库改成生产退料单」
     * —— 此前退料落的是「其他入库单」(OTHER_IN / bd_other_in),理由是当时 MES 没有生产退料单;
     * 现在 MATERIAL_RET 已按金蝶 inv_pick_ret 补齐(表 bd_material_ret/bl_material_ret),
     * 退料就该落自己的单据类型,否则金蝶侧一张「其他入库 QTRK-」、现场明明是「生产退料 SCTL-」,对账口径分裂。
     */
    private static final String PANEL_BACK = "MATERIAL_RET";
    /** 本页自身的页面级虚拟面板码(权限词:create / pick / submit / print) */
    private static final String PANEL_SELF = PagePanelRegistry.MOBILE_PICK;
    /** 领料业务类型(数据键,不翻译) */
    private static final String BIZ_PICK = "生产领料";
    /** 退料业务类型:生产退料单的「业务类型」固定写「生产退料」(数据键,不翻译) */
    private static final String BIZ_BACK = "生产退料";

    // ══════════════ 领料类型(2026-11-18:一个工单行可以有两张领料单)══════════════
    //
    // 用户口径:「现在的生成工单领料需要生成两张领料单(一种就是现在的叫做组装领料,
    //   一种是混料领料(根据半成品的物料清单现在是空的))。并且明细要对这两个做区分。」
    // 三问确认:① 混料「有明细才生成」,半成品清单为空 ⇒ 只出组装单、不产生空单;
    //           ② 生产领料单据页里的退料功能去掉,退料全走新面板;
    //           ③ 明细只做**单据级**区分(不给 wo_pick_line 加行级列)。
    /** 组装领料(= 原来那张单,按工单产品的组装物料清单展开) */
    private static final String KIND_ASSEMBLY = WoPickDocService.KIND_ASSEMBLY;
    /** 混料领料(按半成品对应的《混料物料清单》展开;清单空则不出单) */
    private static final String KIND_MIX = WoPickDocService.KIND_MIX;

    // ══════════════════════ 半成品:只显示、不领料、可跳过 ══════════════════════

    /**
     * 半成品标记(2026-11-16 用户口径:「生产领料单有一行带TB的是半成品,在客户那边半成品是不入库的,
     * 所以只要显示这行数据,但是实际并不领料就可以,不要影响别的物料正常领料,半成品是可跳过的」)。
     *
     * <p>实测半成品编码形如 {@code T410**TB} / {@code A-32-01**TB} / {@code C-87**TB}
     * (bs_inv 里 1146 个,全部带 {@code **TB})。
     *
     * <p>🔴 **只认「**TB」这个双星标记**,不能只认 `TB`:实测 {@code YJ-TB-009}(密封圈)、
     * {@code TB-20120}、{@code D-55-04*TB} 都是**要正常领的料**,按裸 TB 匹配会把它们一起吞掉,
     * 那就是"影响了别的物料正常领料"。
     */
    private static final String SEMI_MARK = "**TB";

    /** 这个物料编码是不是半成品 */
    static boolean isSemiFinished(Object code) {
        if (code == null) return false;
        return String.valueOf(code).toUpperCase(Locale.ROOT).contains(SEMI_MARK);
    }

    /**
     * 「领料标记」→ 领料类型(2026-11-18)。
     *
     * <p>领料单纸面二维码第 4 段带的就是它(用户口径「混料和组装的二维码是一样的,需要在二维码上
     * 多一位作为混料领料还是组装领料的标记」):**A/组装 = 组装领料,M/混料 = 混料领料**。
     * 空值或认不出的值一律返回空串(**不按类型过滤**,与老的三段码行为一致)。
     */
    static String pickKindOf(Object marker) {
        String s = marker == null ? "" : String.valueOf(marker).trim().toUpperCase(Locale.ROOT);
        if (s.isEmpty()) return "";
        if ("A".equals(s) || "组装".equals(s) || "ASSEMBLY".equals(s)) return KIND_ASSEMBLY;
        if ("M".equals(s) || "混料".equals(s) || "MIX".equals(s)) return KIND_MIX;
        return "";
    }

    /** 明细行是不是半成品(以 normalizeLine 打的 {@code 半成品} 标记为准,免得各处重复判编码) */
    private static boolean isSemiLine(Map<String, Object> it) {
        Object v = it == null ? null : it.get("半成品");
        if (v instanceof Boolean b) return b;
        return isSemiFinished(it == null ? null : it.get("编码"));
    }

    /** 本单**需要真领料**的明细(半成品不算) */
    private static int pickableCount(List<Map<String, Object>> items) {
        int n = 0;
        for (Map<String, Object> it : items) if (!isSemiLine(it)) n++;
        return n;
    }

    /**
     * 同上,但入参是**生单时组装的出库行**(键是 {@code 材料编码},还没走 normalizeLine)。
     *
     * <p>两个形状别混:normalizeLine 的产物是 {@code 编码/半成品},insertPickLines 的入参是
     * {@code 材料编码/数量}。用错形状不会报错、只会静默算错(半成品被算进分母)。
     */
    private static int pickableCountOfOutItems(List<Map<String, Object>> items) {
        int n = 0;
        for (Map<String, Object> it : items) if (!isSemiFinished(it.get("材料编码"))) n++;
        return n;
    }

    /** 已领项数(只数需要真领料的行) */
    private static int pickedCount(List<Map<String, Object>> items) {
        int n = 0;
        for (Map<String, Object> it : items) {
            if (isSemiLine(it)) continue;
            if (num(it.get("数量")) > 0) n++;
        }
        return n;
    }

    /**
     * 列表每组最多返回多少条(2026-10-30 由 200 调整)。
     *
     * <p>为什么调大:演示/验收时两组各有二三十条,页面上"已完成 21 条只显示 21 条里的前 20"
     * 这类截断会让用户以为数据丢了(实测踩到)。一次拉 500 条 JSON 也就几十 KB,
     * 比"看不到自己刚造的数据"强。真要分页时再补滚动加载。
     */
    private static final int LIST_LIMIT = 500;

    private final JdbcTemplate jdbc;
    private final WoPickDocService docs;
    private final ButtonService buttons;
    private final PanelPermissionService perm;
    /** 单号池:生单时**只取号**(LL-…),不建生产领料单 —— 那张单要等提交才生成 */
    private final FormNoService formNo;
    /**
     * 工单 BOM 取数(2026-11-13 收口):临时工单用料 wo_bom 优先 → 产品标准组装 BOM 兜底。
     * 此前后端在本类与 WorkReportController 各写一套 SQL,改排序就要改两处(见类注释)。
     */
    private final WorkOrderBomService bomService;
    /**
     * 混料物料清单取数(2026-11-18):混料领料单按半成品的《混料物料清单》展开用料。
     * 与手机扫码「扫码混料」共用同一份取数/单位换算 —— 否则扫码带出的料与领料单明细会两套。
     */
    private final com.yinjia.mes.service.MixBomService mixBomService;
    /**
     * 领料批次分摊台账(2026-11-24):一次扫码可能跨多个 (仓库, 批号),分摊逐笔留痕,
     * 提交时据此把生产领料单的明细**按仓库+批号拆成多行**(用户口径「不同批次号和仓库
     * 是分开记录明细的」)。改造前只把第一条批号写进明细、其余塞备注 ⇒ 别的批次没记账。
     */
    private final WoPickBatchService pickBatches;
    /** 计量单位精度(拆行后按单位取整时用它;与 ButtonService 保存时同一件服务,口径不会两套) */
    private final com.yinjia.mes.service.UnitQtyNormalizer unitQty;

    public MobilePickController(JdbcTemplate jdbc, WoPickDocService docs,
                                ButtonService buttons, PanelPermissionService perm,
                                FormNoService formNo, WorkOrderBomService bomService,
                                com.yinjia.mes.service.MixBomService mixBomService,
                                WoPickBatchService pickBatches,
                                com.yinjia.mes.service.UnitQtyNormalizer unitQty) {
        this.jdbc = jdbc;
        this.docs = docs;
        this.buttons = buttons;
        this.perm = perm;
        this.formNo = formNo;
        this.bomService = bomService;
        this.mixBomService = mixBomService;
        this.pickBatches = pickBatches;
        this.unitQty = unitQty;
    }

    // ══════════════════════════ ⓪ 开单工作台(批量生单) ══════════════════════════

    /**
     * 开单工作台:一次扫多张工单 → 逐个生成一对领料/退料单。
     *
     * <p>用户口径(2026-10-30 第二轮):「还有少了一个『生成工单领料/退料单』这个面版,
     *   这个面版的功能和生成领料是有区别的(不是一个面版)」,确认定位 =
     *   **电脑上的开单工作台(可扫多张工单批量生成、列表看已生成的单)**,且**只管生单**。
     *
     * <h3>为什么是"逐个成功、失败点名"而不是整批回滚</h3>
     * 开单工作台的使用者是计划员:一沓工单码挨个扫过去,中间难免有一张 BOM 没维护、或行号对不上。
     * 若整批事务回滚,前面 20 张已经建好的单会被一起撤销 —— 现场只会说"扫了半天全没了"。
     * ⇒ 逐张独立提交,**失败的写进 {@code 失败} 数组并带原因**,成功的照常返回单号
     * (与 {@code WorkOrderPickingService.toPicking} 同一口径)。
     *
     * @param body {items:[{woNo, line}], 打印?:bool}
     * @return {成功:[{工单号,行号,领料单号,退料单号,id,重复}], 失败:[{工单号,行号,原因}], 成功数, 失败数}
     */
    @PostMapping("/create/batch")
    public ApiResult<Map<String, Object>> createBatch(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.MOBILE_PICK_CREATE);
        perm.requireAnyPerm(PagePanelRegistry.MOBILE_PICK_CREATE, "生成领料/退料单", "create");
        requireLedger();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = body.get("items") instanceof List<?> l
                ? (List<Map<String, Object>>) l : List.of();
        if (items.isEmpty()) throw new IllegalArgumentException("请先扫描或输入工单号");

        boolean wantPrint = !Boolean.FALSE.equals(body.get("打印"));
        List<Map<String, Object>> ok = new ArrayList<>();
        List<Map<String, Object>> fail = new ArrayList<>();
        for (Map<String, Object> it : items) {
            String woNo = str(it.get("woNo"));
            int line = toInt(it.get("line"));
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("工单号", woNo);
            row.put("工单行号", line);
            try {
                Map<String, Object> r = generateOne(woNo, line, wantPrint);
                row.putAll(r);
                ok.add(row);
            } catch (RuntimeException e) {
                row.put("原因", e.getMessage() == null ? "生单失败" : e.getMessage());
                fail.add(row);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("成功", ok);
        out.put("失败", fail);
        out.put("成功数", ok.size());
        out.put("失败数", fail.size());
        return ApiResult.ok(out);
    }

    /**
     * 开单工作台:已生成的单(按工单号/单号模糊查,含已完成)。
     *
     * <p>用户口径「列表看已生成的单」—— 开单的人要知道刚才扫的那些开了没有、开了哪几张单。
     * 数据源与生产领料**同一张台账**({@code wo_pick_doc}),只是入口不同;口径:
     * 未完成在前、已完成在后,各自按时间。
     */
    @GetMapping("/create/list")
    public ApiResult<Map<String, Object>> createList(@RequestParam(required = false) String keyword) {
        perm.requirePanelView(PagePanelRegistry.MOBILE_PICK_CREATE);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("open", docs.list(WoPickDocService.STATE_OPEN, keyword, LIST_LIMIT));
        out.put("done", docs.list(WoPickDocService.STATE_DONE, keyword, LIST_LIMIT));
        out.put("openTotal", docs.countByState(WoPickDocService.STATE_OPEN));
        out.put("doneTotal", docs.countByState(WoPickDocService.STATE_DONE));
        return ApiResult.ok(out);
    }

    /**
     * 开单工作台:**工单视角**的开单状态列表(2026-10-30 第三轮)。
     *
     * <p>用户口径:「生成工单领料/退料单和生产领料功能都重叠了,给我区分开来」+
     *   确认「彻底切干净:生单只看工单、领料只看单据」。
     *
     * <p>⇒ 本接口**一行是一条工单行**,回答"这张工单开了没有";
     *   「生产领料」那边一行是**单据**,回答"这张单领到哪了"。两个面板各看各的,不重复。
     *
     * <p>返回每行:工单号/行号/产品/排产数量/已开单(true/false)/领料单号/状态/进度,
     * 以及 {@code 异常} —— 未排产或已结案的工单开不了单,直接在列表上标出来,
     * 省得用户扫了才发现(与 {@code generateOne} 的拦截口径一致)。
     */
    @GetMapping("/create/woStatus")
    public ApiResult<Map<String, Object>> createWoStatus(@RequestParam(required = false) String keyword) {
        perm.requirePanelView(PagePanelRegistry.MOBILE_PICK_CREATE);

        String kw = keyword == null ? "" : keyword.trim();
        StringBuilder sql = new StringBuilder(
                "SELECT TOP (500) p.pl_no AS 工单号, p.pl_xc AS 工单行号,"
                        + " ISNULL(p.dm,N'') AS 产品编号, ISNULL(p.mc,N'') AS 产品名称,"
                        // 🔴 2026-11-04 用户口径:「外面的信息不够,没有物料编码单位名称规格型号」——
                        //   列表原来只有 产品编号/产品名称/排产数量,规格型号与计量单位根本没查。
                        //   这两个在 plang 上不存在,要回到物料档案 bs_inv(存货编码) 取。
                        + " ISNULL(i.规格型号,N'') AS 产品规格, ISNULL(i.计量单位,N'') AS 产品单位,"
                        + " ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.scx,N'') AS 生产线,"
                        + " ISNULL(p.完工状态,N'') AS 完工状态,"
                        + " d.id AS 台账id, ISNULL(d.领料单号,N'') AS 领料单号, ISNULL(d.状态,N'') AS 状态,"
                        + " ISNULL(d.已领项数,0) AS 已领项数, ISNULL(d.物料项数,0) AS 物料项数"
                        + " FROM dbo.plang p"
                        // LEFT JOIN:物料档案可能没建档,这时显示空而不是把工单丢掉
                        + " LEFT JOIN dbo.bs_inv i ON i.存货编码 = p.dm"
                        + " LEFT JOIN dbo.wo_pick_doc d"
                        // 2026-11-18:一个工单行现在可能有组装 + 混料两张单,
                        // 这里按**组装**那张 JOIN 以保持"一行一条工单行"(混料单在 /create/list 里看)
                        + "   ON d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废'"
                        + "  AND ISNULL(d.领料类型,N'组装') = N'组装'"
                        + " WHERE ISNULL(p.asp_cancel,'N') <> 'Y'");
        List<Object> args = new ArrayList<>();
        if (!kw.isEmpty()) {
            sql.append(" AND (p.pl_no LIKE ? OR ISNULL(p.dm,N'') LIKE ? OR ISNULL(p.mc,N'') LIKE ?)");
            String like = "%" + kw + "%";
            args.add(like); args.add(like); args.add(like);
        }
        // 🔴 2026-11-01 排序口径:「已经开单和未开单的工单都要按生成单据的最新时间排序」。
        //
        // 仍保留「未开单在前」(开单工作台就是要先看到待开的),但**组内一律最新在上**:
        //   · 已开单 —— 按它那张领料单的创建时间倒序(这就是"生成单据的时间");
        //   · 未开单 —— 还没有单据,按**工单号倒序**(单号里带年月+流水,倒序即最新在前)。
        //
        // ⚠ 未开单这里**不能**用 p.id 排序:同一工单的多行可能分几次插入
        //   (订单结转会把多行并进一张工单),按行 id 排会出现
        //   「0018 → 0007#5 → 0017」这种跳号的怪顺序(实测踩到)。
        sql.append(" ORDER BY CASE WHEN d.id IS NULL THEN 0 ELSE 1 END,"
                + " CASE WHEN d.id IS NOT NULL THEN d.创建时间 END DESC,"
                + " p.pl_no DESC, p.pl_xc DESC");

        List<Map<String, Object>> raw = jdbc.queryForList(sql.toString(), args.toArray());
        List<Map<String, Object>> out = new ArrayList<>(raw.size());
        for (Map<String, Object> r : raw) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("工单号", r.get("工单号"));
            m.put("工单行号", r.get("工单行号"));
            m.put("产品编号", r.get("产品编号"));
            m.put("产品名称", r.get("产品名称"));
            // 规格型号 / 计量单位(2026-11-04):取自物料档案,供列表直接显示,免得点开明细才知道
            m.put("产品规格", r.get("产品规格"));
            m.put("产品单位", r.get("产品单位"));
            m.put("排产数量", r.get("排产数量"));
            m.put("生产线", r.get("生产线"));
            m.put("已开单", r.get("台账id") != null);
            m.put("台账id", r.get("台账id"));
            m.put("领料单号", r.get("领料单号"));
            m.put("状态", r.get("状态"));
            m.put("已领项数", r.get("已领项数"));
            m.put("物料项数", r.get("物料项数"));
            // 开不了单的原因(与 generateOne 的拦截同一口径,列表上先标出来)
            Object pq = r.get("排产数量");
            if (num(pq) <= 0) m.put("异常", "未排产");
            else if ("Y".equalsIgnoreCase(str(r.get("完工状态")))) m.put("异常", "已结案");
            else m.put("异常", "");
            out.add(m);
        }
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("list", out);
        res.put("total", out.size());
        return ApiResult.ok(res);
    }

    // ══════════════════════════ ① 生成工单领料/退料单 ══════════════════════════

    /**
     * 扫工单 → 按组装BOM表展开用料 → 生成**一对**领料/退料单草稿。
     *
     * <p>用户口径:「先扫工单号,然后根据这个工单的物料,去查询组织工艺清单的组织bom表。
     * 对应生成一条生产领料单和生产退料单的数据」+ 二次确认「我的工单二维码带有行号的,只生成那一行的就行」。
     *
     * <p>退料单数量**全部为 0**(用户口径「退料默认数量为0。可以不进行退料操作」)——
     * 0 数量行不参与库存记账({@code StockLedgerService.apply} 对 qty=0 直接 continue),
     * 所以这张草稿单挂着不会动库存;不做退料就整单作废、不产生退料单。
     *
     * @param body {woNo:工单号, line:工单行号(0=取该工单第一行)}
     * @return {id:台账主键, 领料单号, 退料单号, 工单:{...}, 领料明细:[...], 退料明细:[...], 打印:{...}}
     */
    @PostMapping("/generate")
    public ApiResult<Map<String, Object>> generate(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "生成领料/退料单", "create");
        requireLedger();

        String woNo = str(body.get("woNo"));
        int wantLine = toInt(body.get("line"));
        if (woNo.isEmpty()) throw new IllegalArgumentException("请先扫描或输入工单号");
        return ApiResult.ok(generateOne(woNo, wantLine, true));
    }

    /**
     * 生单核心(两个面板共用):一个工单行 ⇒ 一对领料/退料单 + 台账行。
     *
     * <p>由单张接口 {@code /generate} 与开单工作台 {@code /create/batch} 共用 ——
     * 用户口径是"两个面板职能不同",但**生单口径必须完全一致**,所以这里只实现一次。
     *
     * @param woNo      工单号
     * @param wantLine  工单行号(0 = 取该工单第一行)
     * @param wantPrint 是否返回打印载荷(开单工作台可关掉自动打印)
     * @return 生单结果(与 {@code /generate} 的 data 同结构)
     */
    private Map<String, Object> generateOne(String woNo, int wantLine, boolean wantPrint) {
        Map<String, Object> wo = resolveWoLine(woNo, wantLine);
        String lineWoNo = str(wo.get("工单号"));
        int line = toInt(wo.get("工单行号"));

        // 前置校验(2026-10-30 补):**未排产 / 已结案的工单不该能开领料单**。
        //
        // 为什么在开单这一步就拦:领料的前提是"这行要生产",没排产的工单行没有排产数量,
        // 领了料也没地方用;已结案的行再领料等于给一张已完成的单补料。
        // 上一版只靠"扫到就开单",于是有人扫了这类单照样开出一张空领料单 ——
        // 白占台账唯一约束(GD-DEMO-09/10 实测),还得手工作废。
        // 连带口径:2026-10-20 生产领料的旧版也是这个规矩(未排产直接拒)。
        Object planQty = wo.get("排产数量");
        double planned = planQty == null ? 0 : num(planQty);
        if (planned <= 0) {
            throw new IllegalStateException("工单 " + lineWoNo + " 第 " + line + " 行未排产(排产数量为 0),不能开领料单:"
                    + "请先到「生产计划 → 快速排产」把该工单行排入产线");
        }
        if ("Y".equalsIgnoreCase(str(wo.get("完工状态")))) {
            throw new IllegalStateException("工单 " + lineWoNo + " 第 " + line + " 行已结案,不能再开领料单");
        }

        // 已开过**组装**单就不重开 —— 用户第二次扫同一行时应当"进到那张单",而不是再开一对空单
        WoPickDocService.PickDoc exist = docs.findActive(lineWoNo, line, KIND_ASSEMBLY);
        if (exist != null) {
            return existingResult(exist, lineWoNo, line, wo, wantPrint);
        }

        // BOM 取数(2026-11-13 收口到 WorkOrderBomService):
        //   **临时工单用料(wo_bom)优先** → 产品标准组装物料清单(bs_asm_bom)兜底。
        //   用户提问「只填主物料、没写子物料会不会查不到 BOM」:常规工单本来就不在工单上填子件,
        //   它是**按产品编码**去查标准 BOM 的 ⇒ 只要产品维护过《组装物料清单》就查得到;
        //   临时工单（产品没标准 BOM / 用料与标准不同）才在工单上填子件，这里优先用它。
        String productCode = str(wo.get("物料编码"));
        WorkOrderBomService.Bom bom = bomService.ofRow(wo.get("行id"), productCode);
        if (bom.isEmpty()) {
            throw new IllegalStateException("该工单行没有任何可用物料清单,无法生成领料单:工单 " + lineWoNo + " 第 " + line + " 行"
                    + (productCode.isEmpty() ? "(未填产品编号)" : "(产品 " + productCode + ")")
                    + " 既没有临时工单用料(wo_bom),产品在《组装物料清单》里也没有维护标准 BOM。"
                    + "请先到 数据建模 → 生产 → 组装物料清单 维护该产品,或用「生产工单 → 新增 → 临时工单」录入所需物料");
        }
        // 映射成本类下游沿用的领料行形态(物料编号/物料名/物料规格/用量/计量单位)
        List<Map<String, Object>> bomLines = toPickLines(bom.lines());
        if (bomLines.isEmpty()) {
            throw new IllegalStateException("「" + ("临时工单".equals(bom.source()) ? "临时工单用料" : "组装物料清单 " + bom.docNo())
                    + "」没有可用的明细行(物料编码为空),无法生成领料单");
        }
        // BOM 抬头文案:临时工单没有独立单号,备注里写「临时工单用料」;标准 BOM 沿用原「组装工艺清单 <单号>」
        final String bomLabel = "临时工单".equals(bom.source()) ? "临时工单用料" : "组装工艺清单 " + bom.docNo();
        // 单位缺失时**在生单前**就给出点名提示(而不是让 ButtonService 抛"明细第 N 行计量单位不能为空")
        List<String> noUnit = new ArrayList<>();
        for (Map<String, Object> b : bomLines) {
            if (str(b.get("计量单位")).isEmpty()) noUnit.add(str(b.get("物料编号")));
        }
        if (!noUnit.isEmpty()) {
            throw new IllegalStateException("下列物料在存货档案里没有计量单位,无法生成领料单:"
                    + String.join("、", noUnit)
                    + ";请先到 基础资料 → 存货档案 补上单位(生产领料单的计量单位是必填)");
        }

        String user = currentUserName();
        // 工单需求数量 = 该工单行的**排产数量**(plang.pl_sl)。
        // 用户口径(2026-10-30):「对应的 bom 生成的领料单明细,应该是每条明细的
        //   bom 组成个数 × 工单需求数量」,且 BOM 的「用量」是**每 1 个成品的用量**。
        double woQty = num(wo.get("排产数量"));

        // ① 组装领料单(原来那张,行为不变;失败照旧抛错)
        //   BOM 来源文案/单号由这里算好传进去(远端把 BOM 收口成 WorkOrderBomService.Bom 之后,
        //   方法里已经没有 bomHead 了):临时工单没有独立单号,备注写「临时工单用料」。
        String asmBomNo = "临时工单".equals(bom.source()) ? "" : bom.docNo();
        Map<String, Object> asm = createPickDoc(wo, productCode, str(wo.get("产品名称")),
                "生产领料·" + bomLabel, asmBomNo, bomLines, KIND_ASSEMBLY, woQty, wantPrint, user);

        List<Map<String, Object>> made = new ArrayList<>();
        made.add(asm);
        Map<String, Object> mix = null;

        // ② 混料领料单(2026-11-18 用户口径,同日二次改口径)——
        //   「一种是混料领料(根据半成品的物料清单)」+ 三问确认「**有明细才生成**,
        //    半成品清单为空就不产生空单」;
        //   🔴 2026-11-18:「生成工单领料的时候…从根据物料清单领料改为根据混料物料清单生成」
        //   ⇒ 半成品 = 组装清单里编码含 **TB 的那一行(与"只显示不领料"同一判定);
        //     它自己的清单 = 《混料物料清单》(bs_mix_bom,面板 MIX_BOM)里 产品编号 = 半成品编码
        //     (归一后)的那一张 —— 与手机扫码「扫码混料」同源,不再读半成品的组装物料清单。
        try {
            for (Map<String, Object> b : bomLines) {
                String semiCode = str(b.get("物料编号"));
                if (!isSemiFinished(semiCode)) continue;
                // 半成品自己的混料配方:MixBomService 负责候选归一(**TB / -tb)与清单定位
                com.yinjia.mes.service.MixBomService.Doc mixBom = mixBomService.of(semiCode);
                if (mixBom.isEmpty()) {                               // 半成品没维护混料清单 ⇒ 不出单
                    log.info("工单 {} 第 {} 行的半成品 {} 在《混料物料清单》里没有明细,不生成混料领料单",
                            lineWoNo, line, semiCode);
                    continue;
                }
                List<Map<String, Object>> mixLines = mixToPickLines(mixBom.lines());
                if (mixLines.isEmpty()) continue;                     // 清单行都没有物料编号 ⇒ 不出空单
                // 需求基数 = 工单数量 × 该半成品在组装清单里的单件用量(多数是 1:1,但不假定)
                double base = round4(woQty * num(b.get("用量")));
                String mixNo = mixBom.docNo();
                mix = createPickDoc(wo, semiCode, str(b.get("物料名")),
                        "生产领料·混料物料清单 " + mixNo, mixNo, mixLines, KIND_MIX, base, wantPrint, user);
                made.add(mix);
                break;   // 一个工单行目前只有一个半成品;多的话唯一约束会撞,取第一个即可
            }
        } catch (RuntimeException e) {
            // 混料单失败**不回滚组装单**:组装那张已经建好、号也占了,
            // 整体报错只会让现场以为"什么都没生成"。原因带回前端提示,组装单照常可用。
            log.warn("混料领料单生成失败(组装单已生成):{}/{} - {}", lineWoNo, line, e.getMessage(), e);
        }

        Map<String, Object> out = new LinkedHashMap<>(asm);
        out.put("工单", wo);
        // 新结构:一个工单行可能生成两张单,前端按这个数组逐个列出
        out.put("单据", made);
        if (mix != null) out.put("混料单", mix);
        return out;
    }

    /**
     * 把 {@link com.yinjia.mes.service.MixBomService} 的**混料物料清单行**映射成领料行形态。
     *
     * <p>2026-11-18 拆出来:混料单的 BOM 已从「半成品的组装物料清单」换成《混料物料清单》,
     * 行的键不同({@code 物料编号/物料名称/单位/标准用量} 而不是 {@code 子件编码/子件名称/计量单位}),
     * 不能复用 {@link #toPickLines}。{@code 标准用量} 已是「单支含量g → 存货单位」换算后的单件用量
     * ({@link com.yinjia.mes.service.MixBomService}),这里只做改名,**不再乘/除任何单位**。
     */
    private static List<Map<String, Object>> mixToPickLines(List<Map<String, Object>> mixLines) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (mixLines == null) return out;
        for (Map<String, Object> b : mixLines) {
            String code = str(b.get("物料编号"));
            if (code.isEmpty()) continue;      // 没有物料编号的行不参与领料
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("物料编号", code);
            m.put("物料名", str(b.get("物料名称")));
            m.put("物料规格", str(b.get("规格型号")));
            m.put("用量", num(b.get("标准用量")));
            m.put("计量单位", str(b.get("单位")));
            out.add(m);
        }
        return out;
    }

    /**
     * 把 WorkOrderBomService 的 BOM 子件行映射成领料行形态(物料编号/物料名/物料规格/用量/计量单位)。
     *
     * <p>2026-11-16 抽出来时组装单与混料单是同一套映射;**2026-11-18 混料单改用《混料物料清单》**
     * ({@link com.yinjia.mes.service.MixBomService})后行结构不同,混料侧已另拆
     * {@link #mixToPickLines} —— 别再把两者混用(组装行的 {@code 子件编码} 与混料行的
     * {@code 物料编号} 键名不同,用错只会静默丢行)。
     * 没有物料编号的行直接丢掉 —— 没编码的行不可能领料。
     */
    private static List<Map<String, Object>> toPickLines(List<Map<String, Object>> bomLines) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (bomLines == null) return out;
        for (Map<String, Object> b : bomLines) {
            String code = str(b.get("子件编码"));
            if (code.isEmpty()) continue;      // 没有物料编号的行不参与领料
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("物料编号", code);
            m.put("物料名", str(b.get("子件名称")));
            m.put("物料规格", str(b.get("子件规格")));
            m.put("用量", num(b.get("标准用量")));
            m.put("计量单位", str(b.get("计量单位")));
            out.add(m);
        }
        return out;
    }

    /**
     * 生成**一张**领料单(组装 / 混料共用)。
     *
     * <p>2026-11-18 从 {@link #generateOne} 抽出来:同一套「按 BOM 展开明细 → 预留单号 →
     * 写台账 → 写 wo_pick_line → 返回结果」,组装与混料只差**数据源**(哪张 BOM)、
     * **类型**和**需求基数**。两处复制会让"改一处漏一处"(半成品跳过、只读字段、打印载荷…)重现。
     *
     * @param wo          工单行(抬头用)
     * @param productCode 这张单的"产品":组装单=工单产品;混料单=半成品编码(便于在单据上看清混的是哪支半成品)
     * @param productName 同上(名称)
     * @param bomLabel    该单依据的 BOM 来源文案(写进明细备注,两张单来源不同要分得清)
     * @param bomNo       该 BOM 的单据编号(临时工单没有独立单号 ⇒ 传空串)
     * @param bomLines    该 BOM 的明细行
     * @param kind        {@link #KIND_ASSEMBLY} / {@link #KIND_MIX}
     * @param qtyBase     需求量基数(组装 = 工单排产数量;混料 = 工单数量 × 半成品单件用量)
     * @return 与旧 {@code generateOne} 同结构的单张结果
     */
    private Map<String, Object> createPickDoc(Map<String, Object> wo, String productCode, String productName,
                                              String bomLabel, String bomNo, List<Map<String, Object>> bomLines,
                                              String kind, double qtyBase, boolean wantPrint, String user) {
        String lineWoNo = str(wo.get("工单号"));
        int line = toInt(wo.get("工单行号"));

        // 仓库(2026-10-30 修正):工单行不带仓库,但生产领料单**审核过账时必须有仓库**
        // (StockLedgerService 按 (物料,仓库,批号) 写 kucun,仓库为空会抛
        //  「仓库档案不存在:[null],请先在基础档案-仓库中建立」—— 实测生单能成、提交才炸)。
        // ⇒ 生单时按**该物料的库存所在仓库**预填明细行仓库(优先恒亿仓/主料仓,其次库存最大的仓),
        //   现场扫物料时若换了仓库,前端会把实际仓库一起写回。
        List<Map<String, Object>> outItems = new ArrayList<>();
        String wh = "";          // 单头仓库(全部明细同仓时才有意义,见下)
        String whCode = "";
        for (int i = 0; i < bomLines.size(); i++) {
            Map<String, Object> b = bomLines.get(i);
            String code = str(b.get("物料编号"));
            // 每行按**该物料有库存的那个仓**预填(库存最大的仓优先,恒亿仓/主料仓优先于不良品仓)
            String[] lineWh = defaultWarehouseOf(code);
            // 需求用量 = BOM 单件用量 × 基数(四位小数,与 decimal(18,4) 同口径)
            double unit = num(b.get("用量"));
            double need = round4(unit * qtyBase);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("行号", String.valueOf(i + 1));
            item.put("材料编码", code);
            item.put("材料名称", str(b.get("物料名")));
            item.put("规格型号", str(b.get("物料规格")));
            item.put("计量单位", str(b.get("计量单位")));
            // 数量 = **0**(还没领),不是需求用量。
            //
            // 🔴 2026-11-01 修正:上一版这里填的是 need(BOM 需求合计),
            //    结果生单**一落地**就显示「已领 3/3」、明细全绿 —— 用户报障
            //    「刚生成的领料单,就已经显示领料了」。
            //    根因是把「应领多少」与「实领多少」混成了一列:
            //      · 需求(应领)= BOM单件用量 × 工单数量 —— 写进明细备注留痕,扫码时用来预填数量框;
            //      · 数量(实领)= 现场扫码确认后才产生 —— 只有它该驱动"领料进度"。
            //    混用的实害:没扫码就满足"每行都有数量",提交闸门等同失效,还会凭空扣库存。
            item.put("数量", 0);
            // 需求数量(应领)单独带着,写进 wo_pick_line.需求数量 ——
            // 它只用于"扫码时预填数量框",不参与进度、不参与过账。
            item.put("需求数量", need);
            item.put("仓库", lineWh[0]);
            if (!lineWh[1].isEmpty()) item.put("仓库编码", lineWh[1]);
            // 备注留痕:**单件用量、需求基数、需求合计**都写清楚 —— 现场看到 2000 时能自己算出
            // 「2/支 × 1000 支 = 2000」。bomUsageOf 取的是「需求 N」里的 N(合计),不是单件用量。
            // 2026-11-16 合并:来源名由调用方算好传进来(组装 = 「生产领料·组装工艺清单 <单号>」/
            //   临时工单 = 「生产领料·临时工单用料」;混料 = 「生产领料·混料物料清单 <单号>」)——
            //   远端把 BOM 来源收口成 WorkOrderBomService.Bom 之后,方法里已经拿不到 bomHead 了。
            item.put("明细备注", bomLabel
                    + "(用量 " + fmtQty(unit) + " × 基数 " + fmtQty(qtyBase) + " = 需求 " + fmtQty(need) + ")");
            outItems.add(item);
            // 单头仓库:第一行有仓就记第一行的(全部同仓时才是"这单从哪个仓出")
            if (wh.isEmpty() && !lineWh[0].isEmpty()) { wh = lineWh[0]; whCode = lineWh[1]; }
        }

        // ── 🔴 2026-11-01 两阶段改造:生单**只取号 + 写领料明细**,不建生产领料单
        //
        // 用户口径:「通过『生成工单领料单』生成的应该是**生产领料**里面的明细,
        //   然后通过扫码领料**提交后才生成生产领料单**。审批是仓管登录平台审批的。」
        //
        // 改造前这里调 saveDoc 直接建了一张 bd_material_out 草稿 ⇒ 生产领料单面板里
        // 还没领料就有单,提交还会自动审核扣库存,绕过仓管审批。
        // 现在:号从 LL 号池**先预留**(保证提交时用同一个号),单据本体等提交才落库。
        String outNo = formNo.next(pickNoPrefix(), user);

        // ── 不再预生成退料单(2026-10-30 第三轮用户改口径)
        //
        // 用户口径:「退料直接在生产领料界面。可以点开已完成的生产领料数据再次进行扫码。
        //   这样就可以来退料了。然后退料的单据做一个退料的标志。」
        // ⇒ 退料是**领完之后的后续动作**:生单时只建领料单;
        //   现场真要退料时,走独立的「生产退料」面板(2026-11-18 起独立成面板),
        //   退多少生多少(见 {@link #returnScan} / {@link #submitReturn})。
        //
        // 上一版按首轮口径预建「数量全 0 的退料草稿」已废弃 —— 那是空单:
        //   它躺在退料单列表里像待办,没人退料还得专门作废,纯噪声。
        //   历史遗留的空退料单由 migrate-wo-pick-return-20261030.sql 统一作废。

        // ── 台账(唯一约束在这里挡"连扫两下";索引含领料类型 ⇒ 组装/混料各占一行)
        // 物料项数只数**需要真领料**的行:半成品只显示不领,若把它算进分母,
        // 进度会永远差一项、提交闸门就过不去(2026-11-16 用户口径「半成品是可跳过的」)。
        int pickable = pickableCountOfOutItems(outItems);
        long id;
        try {
            id = docs.insert(lineWoNo, line, productCode, productName,
                    outNo, null, pickable, user, kind);
        } catch (RuntimeException e) {
            // 并发:另一个手机刚给同一工单行 + 同一类型建了单。把已存在的还给调用方,不要留半截数据
            WoPickDocService.PickDoc raced = docs.findActive(lineWoNo, line, kind);
            if (raced != null) {
                log.warn("手机扫码生单并发撞唯一约束:{}/{} [{}];已回落到既有台账 {}",
                        lineWoNo, line, kind, raced.id(), e);
                return existingResult(raced, lineWoNo, line, wo, wantPrint);
            }
            throw e;
        }

        // 领料明细落到 wo_pick_line(生产领料单要等提交才生成,见 submit)
        insertPickLines(id, outItems, qtyBase, user);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("领料单号", outNo);
        out.put("领料类型", kind);
        out.put("工单", wo);
        out.put("BOM单据编号", bomNo);
        out.put("物料项数", pickable);
        out.put("状态", WoPickDocService.STATE_OPEN);
        out.put("重复", false);
        // 生单即自动打印工单二维码一次(用户口径「在生成生产领料单的时候自动打印一次」)。
        // 这里只把"要打什么"回给前端 —— 真正的出纸由前端打印通道或打印站点完成,
        // 服务端不持有打印机(服务端也可能在另一台机器上)。
        out.put("打印", wantPrint
                ? printPayload(lineWoNo, line, productName, str(wo.get("规格型号")), id)
                : null);
        return out;
    }

    /**
     * 单号前缀(取面板配置 {@code yj_panel.prefix},查不到用兜底值)。
     *
     * <p>为什么查面板而不写死:前缀是 `yj_panel.prefix` 的配置项,改配置时单号要跟着变;
     * 写死 "LL" 会在客户改前缀后产生两套号。查不到就退回兜底(与默认配置一致)。
     *
     * <p>2026-11-24:退料单也要**先生成单号**(用户口径「生产退料要补单号」),
     * 于是把原来只服务领料的 pickNoPrefix 泛化成按面板取前缀。
     */
    private String panelPrefix(String panelCode, String fallback) {
        try {
            List<String> p = jdbc.queryForList(
                    "SELECT ISNULL(prefix,N'') FROM dbo.yj_panel WHERE panel_code = ?",
                    String.class, panelCode);
            if (!p.isEmpty() && !p.get(0).isBlank()) return p.get(0).trim();
        } catch (RuntimeException ignore) {
            // 查不到不影响主流程
        }
        return fallback;
    }

    /** 领料单号前缀(取 MATERIAL_OUT 面板配置,如 LL) */
    private String pickNoPrefix() {
        return panelPrefix(PANEL_OUT, "LL");
    }

    /**
     * 当前登录账号**所属部门** → 领料/退料部门(2026-11-24 用户口径:
     * 「扫码填表关联领料部门,领料部门根据账号所属部门来填入」)。
     *
     * <p>取值链:{@code yj_user.dept_id → bs_dept.id} ⇒ 返回 {@code {编码, id, 名称}}。
     * 账号没配部门 / 部门被删 / 表读不到 ⇒ 三项全空串,**不猜、不拦**(部门不是必填,
     * 但这张单会缺"谁领的料"这一格,现场看得到、能自己补)。
     *
     * <p>⚠ 部门编码是金蝶侧的键({@code BM000xx}),写进面板的「领料部门」字段
     * (物理列仍是 部门编码,参照 DEPT);转ERP 时 {@code KingdeePushService} 直接读这一列。
     */
    private Dept deptOf(String user) {
        if (user == null || user.isBlank()) return Dept.EMPTY;
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT TOP 1 ISNULL(d.部门编码,N'') AS 编码, d.id AS id, ISNULL(d.部门名称,N'') AS 名称"
                            + " FROM dbo.yj_user u JOIN dbo.bs_dept d ON d.id = u.dept_id"
                            + " WHERE u.username = ? AND ISNULL(u.asp_cancel,'N') <> 'Y'"
                            + "   AND ISNULL(d.asp_cancel,'N') <> 'Y'", user);
            if (rows.isEmpty()) return Dept.EMPTY;
            Map<String, Object> r = rows.get(0);
            return new Dept(str(r.get("编码")), toLong(r.get("id")), str(r.get("名称")));
        } catch (RuntimeException e) {
            log.debug("取账号所属部门失败(部门不是必填,按空处理):{}", e.getMessage());
            return Dept.EMPTY;
        }
    }

    /** 账号所属部门(编码 / id / 名称);没有部门的账号三项为空串 */
    private record Dept(String code, long id, String name) {
        static final Dept EMPTY = new Dept("", 0L, "");
        boolean present() { return code != null && !code.isBlank(); }
    }

    /**
     * 把生单算出来的用料写进**领料明细**(wo_pick_line)。
     *
     * <p>每行:需求数量 = BOM单件用量 × 工单数量(用于扫码预填);
     * 实领数量 = 0(等现场扫码)。提交时据此生成生产领料单。
     *
     * @param docId     wo_pick_doc.id
     * @param outItems  生单时组装好的行(键与 bl_material_out 同口径)
     * @param woQty     工单排产数量
     * @param user      操作人
     */
    private void insertPickLines(long docId, List<Map<String, Object>> outItems, double woQty, String user) {
        for (Map<String, Object> it : outItems) {
            // 需求数量优先用生单时算好的(存在 "需求数量" 键),否则按备注解析兜底
            double need = it.get("需求数量") != null
                    ? num(it.get("需求数量"))
                    : bomUsageOf(str(it.get("明细备注")));
            jdbc.update("INSERT INTO dbo.wo_pick_line"
                            + " (单头id, 行号, 物料编码, 物料名称, 规格型号, 计量单位,"
                            + "  需求数量, 实领数量, 仓库, 仓库编码, 批号, 明细备注,"
                            + "  asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,SYSDATETIME(),'N')",
                    docId, str(it.get("行号")), str(it.get("材料编码")), str(it.get("材料名称")),
                    str(it.get("规格型号")), str(it.get("计量单位")),
                    need, 0d, str(it.get("仓库")), str(it.get("仓库编码")), "",
                    str(it.get("明细备注")), user);
        }
    }

    // ══════════════════════════ ② 列表(未完成 / 已完成) ══════════════════════════

    /**
     * 生产领料列表。
     *
     * <p>用户口径:「这个界面上面是查询框和查询按钮。下面是列着每个单据的表头数据……
     * 并且将已完成的单据,在生产领料的界面放到下面的已完成区(并且已完成和未完成都可以展开和收缩)」。
     * ⇒ 一次返回两组(open / done),前端各自可折叠;keyword 同时按工单号/单号/产品名过滤。
     *
     * @param keyword 查询框内容(空 = 全部)
     */
    @GetMapping("/list")
    public ApiResult<Map<String, Object>> list(@RequestParam(required = false) String keyword) {
        perm.requirePanelView(PANEL_SELF);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("open", docs.list(WoPickDocService.STATE_OPEN, keyword, LIST_LIMIT));
        out.put("done", docs.list(WoPickDocService.STATE_DONE, keyword, LIST_LIMIT));
        out.put("openTotal", docs.countByState(WoPickDocService.STATE_OPEN));
        out.put("doneTotal", docs.countByState(WoPickDocService.STATE_DONE));
        return ApiResult.ok(out);
    }

    /**
     * 中间那个扫码框:扫工单号 → **直接定位到对应的领料单据**。
     *
     * <p>用户口径:「中间还可以扫描工单号(直接查看对应的领料单据)」。
     * 与生成接口的区别:这里**不生成**任何东西,只找已开的单把它打开。
     * 找不到时返回 {@code found:false} 而不是报错 —— 现场扫错了码不该弹红框,
     * 前端会提示"该工单行还没开过领料单,可以点『生成』"。
     *
     * <p>🔴 2026-11-18(用户报障「生产领料扫混料和扫组装的二维码,都是跳到组装的单据界面」):
     * 领料单纸面二维码第 4 段带了领料标记(`A`=组装 / `M`=混料),这里新增可选参数 {@code kind}
     * —— 传了就**只在那一种单里定位**,扫混料标签就打开混料单、扫组装标签就打开组装单;
     * 不传时行为与以前一致(命中整组,前端按第一张=组装打开)。
     *
     * @param woNo 工单号(或领料单号 LL-…)
     * @param line 工单行号(可空)
     * @param kind 领料标记:组装/混料 或 A/M(可空 = 不按类型过滤);认不出的值按"不过滤"处理
     */
    @GetMapping("/locate")
    public ApiResult<Map<String, Object>> locate(@RequestParam String woNo,
                                                 @RequestParam(required = false) Integer line,
                                                 @RequestParam(required = false) String kind) {
        perm.requirePanelView(PANEL_SELF);
        String no = str(woNo);
        if (no.isEmpty()) throw new IllegalArgumentException("请先扫描或输入工单号");
        String wantKind = pickKindOf(kind);

        Map<String, Object> out = new LinkedHashMap<>();

        // 🔴 2026-11-01 用户口径:「已经完成领料的单扫码扫不到,这个需要为查询已完成单据用的」。
        //
        // 两件事一起补:
        //   ① 输入/扫到的若是**领料单号**(LL-…),直接按它打开 —— 现场拿着那张单据来查最直接,
        //      而且已完成/未完成都能打开(found 判据只看"有没有这条台账",不看状态);
        //   ② 无法命中时**回一句更准确的 reason**,让前端能说清是"工单没开过单"还是"单据已作废",
        //      不再一律"扫不到"。
        // ⚠ 这里**不过滤状态**:已完成单据必须能扫到、能打开(退料也在已完成单上做)。
        if (looksLikeOutNo(no)) {
            List<Long> ids = jdbc.queryForList(
                    "SELECT id FROM dbo.wo_pick_doc WHERE 领料单号 = ? AND 状态 <> ? ORDER BY id DESC",
                    Long.class, no, WoPickDocService.STATE_VOID);
            if (!ids.isEmpty()) {
                WoPickDocService.PickDoc hit = docs.byId(ids.get(0));
                return ApiResult.ok(locateResult(hit == null ? List.of() : List.of(hit), "领料单号"));
            }
            // 单据号在台账里完全没有(或已作废)—— 明确告诉前端
            long anyDoc = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM dbo.wo_pick_doc WHERE 领料单号 = ?",
                    Long.class, no);
            out.put("found", false);
            out.put("candidates", List.of());
            out.put("hint", anyDoc > 0 ? "voided" : "no-doc");
            return ApiResult.ok(out);
        }

        // ── 按工单号(可带行号)定位
        //
        // 2026-11-18:一个工单行现在可能有**两张**单(组装 / 混料)⇒ 命中的整组一起返回,
        // 前端把两张都列出来让人选(用户口径「都能列出、都能点进去」)。
        // 但**跨多行**时仍按老口径返回 candidates 让人指定行号 —— 那是另一个歧义维度。
        List<WoPickDocService.PickDoc> hits = new ArrayList<>();
        if (line != null && line > 0) {
            hits = docs.listActive(no, line);
        } else {
            List<Long> ids = jdbc.queryForList(
                    "SELECT id FROM dbo.wo_pick_doc WHERE 工单号 = ? AND 状态 <> ? ORDER BY 工单行号, id",
                    Long.class, no, WoPickDocService.STATE_VOID);
            for (Long id : ids) {
                WoPickDocService.PickDoc d = docs.byId(id);
                if (d != null) hits.add(d);
            }
        }
        if (hits.isEmpty()) {
            out.put("found", false);
            out.put("candidates", List.of());
            out.put("hint", "no-doc");
            return ApiResult.ok(out);
        }
        // 2026-11-18:带了领料标记(扫的是纸面二维码)⇒ 只留那一种单
        //   —— 扫混料标签就打开混料单,别再默认跳到组装那张。
        if (!wantKind.isEmpty()) {
            hits.removeIf(d -> !wantKind.equals(d.pickKind()));
            out.put("按类型", wantKind);
            if (hits.isEmpty()) {
                out.put("found", false);
                out.put("candidates", List.of());
                out.put("hint", "no-doc-kind");
                return ApiResult.ok(out);
            }
        }
        // 跨多行 ⇒ 让用户挑行(沿用旧口径)
        long distinctLines = hits.stream().map(WoPickDocService.PickDoc::woLine).distinct().count();
        if (distinctLines > 1) {
            List<Map<String, Object>> many = new ArrayList<>();
            for (WoPickDocService.PickDoc d : hits) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", d.id());
                m.put("工单行号", d.woLine());
                m.put("领料类型", d.pickKind());
                m.put("领料单号", d.outNo());
                m.put("状态", d.state());
                many.add(m);
            }
            out.put("found", false);
            out.put("candidates", many);
            out.put("hint", "multi-line");
            return ApiResult.ok(out);
        }
        return ApiResult.ok(locateResult(hits, "工单号"));
    }

    /**
     * 定位结果:命中的那一组单(组装 / 混料可能两张)。
     *
     * <p>{@code id} 仍给第一张(组装在前)以兼容旧前端;新前端看 {@code 单据} 数组逐个打开。
     */
    private Map<String, Object> locateResult(List<WoPickDocService.PickDoc> list, String by) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("found", true);
        out.put("by", by);
        if (list == null || list.isEmpty()) {
            out.put("found", false);
            out.put("hint", "no-doc");
            return out;
        }
        out.put("id", list.get(0).id());
        List<Map<String, Object>> arr = new ArrayList<>();
        for (WoPickDocService.PickDoc d : list) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", d.id());
            m.put("领料单号", d.outNo());
            m.put("领料类型", d.pickKind());
            m.put("工单号", d.woNo());
            m.put("工单行号", d.woLine());
            m.put("产品名称", d.productName());
            m.put("状态", d.state());
            m.put("物料项数", d.itemCount());
            m.put("已领项数", d.doneCount());
            arr.add(m);
        }
        out.put("单据", arr);
        out.put("领料类型", list.get(0).pickKind());
        if (arr.size() > 1) out.put("hint", "multi-kind");
        return out;
    }

    /**
     * 这一串像不像**领料单号**(而不是工单号)。
     *
     * <p>判据取前缀字母段:`LL-2026-11-0008` → 前缀 `LL`;`GD-2026-11-0018` → `GD`。
     * 两者的**中段年月与尾号长得一模一样**,只能靠前缀区分,所以按"不是 GD 开头"判定,
     * 而不是写死 LL(MATERIAL_OUT 的号池前缀可由 `yj_panel.prefix` 配置,改了就认不出)。
     */
    private static boolean looksLikeOutNo(String s) {
        if (s == null) return false;
        String t = s.trim().toUpperCase();
        int dash = t.indexOf('-');
        if (dash <= 0) return false;
        String prefix = t.substring(0, dash);
        if (!prefix.matches("[A-Z]{1,4}")) return false;
        // 工单号前缀固定是 GD(plang.pl_no);其余「字母-年-月-流水」形态都按单据号试
        return !"GD".equals(prefix);
    }

    // ══════════════════════════ ③ 单据详情 ══════════════════════════

    /**
     * 单据详情:一对单据(领料 + 退料)的头与明细,以及每项物料的库存可用量。
     *
     * <p>用户口径:「点进去对应单据里面可以看到对应的领料单明细」。
     * 返回结构刻意把**领料/退料两组明细并列**(前端做成两个页签,退料默认数量 0)。
     *
     * @param id 台账主键(列表页点进来带的)
     */
    @GetMapping("/doc")
    public ApiResult<Map<String, Object>> doc(@RequestParam long id) {
        perm.requirePanelView(PANEL_SELF);
        requireLedger();
        WoPickDocService.PickDoc d = docs.byId(id);
        if (d == null) throw new IllegalArgumentException("没有找到这张单据(可能已作废)");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", d.id());
        out.put("工单号", d.woNo());
        out.put("工单行号", d.woLine());
        out.put("产品编号", d.productCode());
        out.put("产品名称", d.productName());
        out.put("领料单号", d.outNo());
        out.put("退料单号", d.backNo());
        // 2026-11-18:组装领料 / 混料领料 —— 单据页标题与列表标签都按它显示
        out.put("领料类型", d.pickKind());
        out.put("状态", d.state());
        // 生产领料单是否已被仓管审批(2026-11-01:提交只建单不过账,审批才扣库存)。
        // 前端据此把「开始退料」换成「待仓管审批」,别让人点了才被服务端拒。
        out.put("出库已审批", isMaterialOutAudited(d.outNo()));
        out.put("物料项数", d.itemCount());
        out.put("已领项数", d.doneCount());
        out.put("打印次数", d.printCount());
        out.put("创建人", d.creator());
        out.put("创建时间", d.createAt() == null ? "" : d.createAt().toLocalDateTime().toString().replace('T', ' '));
        out.put("提交人", d.submitter());
        out.put("提交时间", d.submitAt() == null ? "" : d.submitAt().toLocalDateTime().toString().replace('T', ' '));
        out.put("打印", printPayload(d.woNo(), d.woLine(), d.productName(), "", d.id()));

        // 工单行信息(抬头区显示产品/产线/排产数量)
        List<Map<String, Object>> woRows = jdbc.queryForList(
                "SELECT TOP 1 ISNULL(p.mc,N'') AS 产品名称, ISNULL(p.gg,N'') AS 规格型号,"
                        + " ISNULL(p.jldw,N'') AS 计量单位, ISNULL(p.scx,N'') AS 生产线,"
                        + " ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.lot_no,N'') AS 批号"
                        + " FROM dbo.plang p WHERE p.pl_no = ? AND p.pl_xc = ? AND ISNULL(p.asp_cancel,'N') <> 'Y'",
                d.woNo(), d.woLine());
        out.put("工单", woRows.isEmpty() ? Map.of() : woRows.get(0));

        // 领料明细:每行补上**已退数量 / 可退数量**(2026-10-30 第三轮;2026-11-24 起按行核销)。
        // 已退数量唯一真源 = wo_pick_return。⚠ 2026-11-24 拆行后**同一物料可能有多行**
        // (不同 仓库/批号),已退量必须按 (物料,仓库,批号) 核 —— 只按物料算会把 A 批的退料
        // 抵到 B 批上,现场看到"这批没退过却显示已退完"。
        List<Map<String, Object>> pickLines = linesOf(d.outNo(), "pick");
        boolean draft = isDraftPick(d.outNo());
        for (Map<String, Object> it : pickLines) {
            String code = str(it.get("编码"));
            double ret = draft
                    ? returnedQtyOf(d.outNo(), code)
                    : returnedQtyOfLine(d.outNo(), code, str(it.get("仓库")), str(it.get("批号")));
            it.put("已退数量", ret);
            it.put("可退数量", round4(Math.max(0, num(it.get("数量")) - ret)));
        }
        out.put("领料明细", pickLines);
        // 领料部门(2026-11-24 用户口径「扫码填表关联领料部门,领料部门根据账号所属部门来填入」)。
        // 已完成单读它自己那张生产领料单头的部门(别人可能代填过);未完成单按当前账号所属部门显示。
        Dept cur = deptOf(currentUserName());
        String deptCode = cur.code(), deptName = cur.name();
        if (!draft && d.outNo() != null && !d.outNo().isBlank()) {
            List<Map<String, Object>> head = jdbc.queryForList(
                    "SELECT TOP 1 ISNULL(部门编码,N'') AS 编码 FROM dbo.bd_material_out WHERE 单据编号 = ?",
                    d.outNo());
            if (!head.isEmpty()) {
                String c = str(head.get(0).get("编码"));
                if (!c.isEmpty()) { deptCode = c; deptName = deptNameOf(c); }
            }
        }
        out.put("领料部门", deptCode);
        out.put("领料部门名称", deptName.isEmpty() ? deptCode : deptName);
        // 退料明细不再有"预生成待填"的退料单(改为按需生成),这里保留空数组做结构兼容
        out.put("退料明细", List.of());
        // 已退合计 —— 列表/单据上显示"含退料 N"
        double returnedTotal = 0;
        for (Map<String, Object> it : pickLines) returnedTotal += num(it.get("已退数量"));
        out.put("已退合计", round4(returnedTotal));
        out.put("含退料", returnedTotal > 0);
        return ApiResult.ok(out);
    }

    /**
     * 扫物料码:确认**这个物料码存在**,并返回它的库存可用量、批次明细与"允许填多少"。
     *
     * <p>用户口径:「扫的是物料码,如果对应的物料码存在,就可以填写领料数量
     * (数量可以随意填写,只要仓库数量足够,多少都可以),批次处理也保留之前的」。
     *
     * <p>返回里带 {@code 允许上限} = 该物料**跨批次合计**的库存总量(用户 2026-10-30 口径:
     * 「该物料库存总量(跨批次合计),超出自动拆到下一批」),前端输入框按它夹住,
     * 批次由前端沿用既有 {@code autoAllocateFifo} 自动拆到下一批。
     *
     * @param body {id:台账主键, code:物料编码, batch:码里带的批次(可空), side:pick|back}
     */
    @PostMapping("/scanMaterial")
    public ApiResult<Map<String, Object>> scanMaterial(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "扫码核销", "pick");
        requireLedger();
        long id = toLong(body.get("id"));
        String code = str(body.get("code"));
        String side = "back".equals(str(body.get("side"))) ? "back" : "pick";
        if (id <= 0) throw new IllegalArgumentException("单据标识缺失,请重新打开单据");
        if (code.isEmpty()) throw new IllegalArgumentException("请先扫描或输入物料编码");

        WoPickDocService.PickDoc d = docs.byId(id);
        if (d == null) throw new IllegalArgumentException("没有找到这张单据(可能已作废)");
        if (WoPickDocService.STATE_DONE.equals(d.state())) {
            // 2026-10-30:已完成 = 已审核过账,之后只能退料(生成生产退料单),**不能再改领料数量**。
            // 之前这里只笼统报"已经提交,不能再改数量";现在把"该走哪条路"直接告诉调用方 ——
            // 用户报障「已完成的进去扫码应该是其他入库才对」,根因之一就是界面在完成态仍走领料分支。
            throw new IllegalStateException("这张单已经完成并过账,不能再改领料数量:"
                    + "如需退货请走「开始退料」(生成生产退料单)");
        }

        // ① 这个物料码必须在**本单的明细里**(领料/退料各自的明细) —— 「对应的物料码存在」的第一个含义
        String no = "back".equals(side) ? d.backNo() : d.outNo();
        List<Map<String, Object>> items = linesOf(no, side);
        Map<String, Object> hit = null;
        for (Map<String, Object> it : items) {
            if (code.equals(str(it.get("编码")))) { hit = it; break; }
        }
        if (hit == null) {
            throw new IllegalStateException("物料 " + code + " 不在本单的"
                    + ("back".equals(side) ? "退料" : "领料") + "明细里:请核对是否扫错了料(本单只含组装BOM表里的用料)");
        }
        // 半成品:只显示、不领料、可跳过(2026-11-16 用户口径)
        if (!"back".equals(side) && isSemiLine(hit)) {
            throw new IllegalStateException("物料 " + code + " 是半成品(编码含 **TB),本厂不入库、不需要领料:"
                    + "这一行只作展示,直接跳过即可");
        }

        // ② 库存可用量(按 物料+仓库 汇总;批次明细另给,前端沿用先进先出拆批)
        String wh = str(hit.get("仓库"));
        List<Map<String, Object>> stock = stockRows(code, wh, d.outNo());
        double total = 0;
        for (Map<String, Object> r : stock) total += num(r.get("现存量"));
        total = round4(total);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编码", code);
        out.put("名称", str(hit.get("名称")));
        out.put("规格", str(hit.get("规格")));
        out.put("单位", str(hit.get("单位")));
        out.put("行号", hit.get("行号"));
        out.put("仓库", wh);
        out.put("BOM用量", bomUsageOf(str(hit.get("明细备注"))));
        out.put("当前数量", num(hit.get("数量")));
        // 允许上限:领料看库房有多少;退料看这单领了多少(退料不能退得比领的多)
        double cap = "back".equals(side) ? num(hit.get("数量")) : total;
        out.put("可用总量", total);
        out.put("允许上限", round4(Math.max(0, cap)));
        out.put("批次", stock);
        out.put("扫到批次", str(body.get("batch")));
        return ApiResult.ok(out);
    }

    /**
     * 扫物料后保存这一行的数量(可多次调用:扫一次填一次)。
     *
     * <p>用户口径:「数量可以随意填写,只要仓库数量足够,多少都可以」——
     * 故这里**只拦库存不足**(领料)与**退料超领**(退料),不拦"超过 BOM 用量"。
     *
     * @param body {id, side:pick|back, code, qty, batches:[{批号,仓库,仓库编码,数量}]}
     */
    @PostMapping("/setQty")
    public ApiResult<Map<String, Object>> setQty(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "扫码核销", "pick");
        requireLedger();
        long id = toLong(body.get("id"));
        String side = "back".equals(str(body.get("side"))) ? "back" : "pick";
        String code = str(body.get("code"));
        double qty = round4(num(body.get("qty")));
        WoPickDocService.PickDoc d = docs.byId(id);
        if (d == null) throw new IllegalArgumentException("没有找到这张单据(可能已作废)");
        // 已完成 = 已审核过账,之后只能退料(生成生产退料单),不能再改领料数量。
        // ⚠ 与 scanMaterial 里同一道闸门:两处都在,漏一处就能绕过(2026-10-30 改了一处后
        //   实测仍报旧文案才发现 —— 后端两个入口必须同口径)。
        if (WoPickDocService.STATE_DONE.equals(d.state())) {
            throw new IllegalStateException("这张单已经完成并过账,不能再改领料数量:"
                    + "如需退货请走「开始退料」(生成生产退料单)");
        }
        if (code.isEmpty()) throw new IllegalArgumentException("物料编码不能为空");
        if (qty < 0) throw new IllegalArgumentException("数量不能为负数");

        String no = "back".equals(side) ? d.backNo() : d.outNo();
        String panel = "back".equals(side) ? PANEL_BACK : PANEL_OUT;
        List<Map<String, Object>> items = linesOf(no, side);
        Map<String, Object> hit = null;
        for (Map<String, Object> it : items) if (code.equals(str(it.get("编码")))) { hit = it; break; }
        if (hit == null) throw new IllegalStateException("物料 " + code + " 不在本单的明细里");
        // 半成品不许填数量(2026-11-16):它不入库,填了会凭空扣库存;只显示、可跳过
        if (!"back".equals(side) && isSemiLine(hit) && qty > 0) {
            throw new IllegalStateException("物料 " + code + " 是半成品(编码含 **TB),不需要领料:数量请留 0 直接跳到下一项");
        }

        // 库存守卫(领料):超出跨批次合计就拦 —— 用户口径「只要仓库数量足够,多少都可以」
        if (!"back".equals(side) && qty > 0) {
            double avail = 0;
            for (Map<String, Object> r : stockRows(code, str(hit.get("仓库")), d.outNo())) avail += num(r.get("现存量"));
            if (round4(qty) > round4(avail)) {
                throw new IllegalStateException("库存不足:物料 " + code + " 当前可用 " + round4(avail)
                        + ",本次要填 " + qty + ";请减少数量或先补货");
            }
        }
        // 退料守卫:不能退得比领的多
        if ("back".equals(side) && qty > 0) {
            List<Map<String, Object>> pickItems = linesOf(d.outNo(), "pick");
            double picked = 0;
            for (Map<String, Object> it : pickItems) if (code.equals(str(it.get("编码")))) picked = num(it.get("数量"));
            if (qty > picked) {
                throw new IllegalStateException("退料数量不能超过已领数量(该物料已领 " + round4(picked) + ")");
            }
        }

        // 直接改明细行的数量(草稿单可改)。批次留痕由 batches 写进明细备注。
        writeQty(panel, no, str(hit.get("行号")), str(hit.get("原始行号")), qty, body, side, code);

        // 进度的分母/分子都**不算半成品**(2026-11-16:半成品只显示不领,算进去就永远差一项)
        List<Map<String, Object>> pickNow = linesOf(d.outNo(), "pick");
        int totalItems = pickableCount(pickNow);
        int doneNow = pickedCount(pickNow);
        docs.updateProgress(id, doneNow, totalItems, currentUserName());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("领料明细", pickNow);
        out.put("退料明细", linesOf(d.backNo(), "back"));
        out.put("物料项数", totalItems);
        out.put("已领项数", doneNow);
        // 「全部领料完成后才可以提交」的判据就这一个 —— 由服务端算,前端只管显示
        out.put("可以提交", totalItems > 0 && doneNow >= totalItems);
        return ApiResult.ok(out);
    }

    /**
     * 提交:全部领完 → 审核领料单 → 转成生产领料单(过账)。
     *
     * <p>用户口径:「全部领料完成后才可以提交转成生产领料单」。
     * 这是本页**唯一动库存**的动作 —— 走 {@code callButton(MATERIAL_OUT, "审核")},
     * 与在生产领料单面板里手点「审核」是完全同一条路(过账/流水/工单回写全部照旧)。
     */
    @PostMapping("/submit")
    public ApiResult<Map<String, Object>> submit(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "提交转生产领料单", "submit");
        requireLedger();
        long id = toLong(body.get("id"));
        WoPickDocService.PickDoc d = docs.byId(id);
        if (d == null) throw new IllegalArgumentException("没有找到这张单据(可能已作废)");
        if (WoPickDocService.STATE_DONE.equals(d.state())) {
            Map<String, Object> again = new LinkedHashMap<>();
            again.put("已提交", true);
            again.put("领料单号", d.outNo());
            again.put("状态", d.state());
            return ApiResult.ok(again);
        }

        List<Map<String, Object>> items = linesOf(d.outNo(), "pick");
        if (items.isEmpty()) throw new IllegalStateException("这张领料单没有明细行,无法提交(请作废后重新生成)");
        List<String> missing = new ArrayList<>();
        for (Map<String, Object> it : items) {
            // 半成品不参与"是否领完"的判定:它只显示、不领料、可跳过(2026-11-16 用户口径)
            if (isSemiLine(it)) continue;
            if (num(it.get("数量")) <= 0) missing.add(str(it.get("编码")));
        }
        if (!missing.isEmpty()) {
            throw new IllegalStateException("还有 " + missing.size() + " 项物料没填领料数量,不能提交:"
                    + String.join("、", missing.subList(0, Math.min(8, missing.size())))
                    + (missing.size() > 8 ? " 等" : ""));
        }

        String user = currentUserName();

        // ── 🔴 2026-11-01 两阶段改造:提交时才**生成**生产领料单,而且**不审核**
        //
        // 用户口径:「通过扫码领料**提交后才生成生产领料单**。审批是仓管登录平台审批的。」
        //
        // 改造前这里直接 callButton(MATERIAL_OUT, "审核") —— 既建单又过账,
        // 库存立刻被扣、仓管的审批完全被绕过。
        // 现在:用生单时预留的号建一张**待审批**的生产领料单(数量=实领),状态停在草稿;
        // 仓管在「生产领料单」面板点「审核」才走 StockLedgerService 扣库存。
        // ── 生单:半成品不进生产领料单(不入库 ⇒ 不能有出库流水)
        int madeLines = createMaterialOutFromPick(d, items, user);

        // 退料不在这里做(2026-10-30 第三轮用户改口径):
        //   用户口径「可以点开已完成的生产领料数据再次进行扫码。这样就可以来退料了」——
        //   退料是**提交之后**的独立动作,走 {@link #returnScan} / {@link #submitReturn},
        //   不再有"生单时预建一张空退料单、提交时作废它"这一套。
        docs.markDone(id, user);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("已提交", true);
        out.put("领料单号", d.outNo());
        out.put("状态", WoPickDocService.STATE_DONE);
        out.put("出库行数", madeLines);
        out.put("说明", madeLines == 0
                ? "本单明细全是半成品(编码含 **TB),按口径不入库、不生成生产领料单;领料单已结束"
                : "已生成生产领料单 " + d.outNo() + ",等仓管在「生产领料单」里审批;"
                        + "审批通过才扣库存。如需退料,点开这张单再次扫码即可(剩余可退 "
                        + fmtQty(pickedQtyOf(d.outNo())) + ")");
        return ApiResult.ok(out);
    }

    /**
     * 用领料明细生成**待审批**的生产领料单(不审核、不过账)。
     *
     * <p>用户口径:「扫描领料提交后才生成生产领料单。审批是仓管登录平台审批的。」
     *
     * <p>为什么走 ButtonService 的「保存」而不是直接 INSERT:`bd_material_out`/`bl_material_out`
     * 是金蝶同步口径的表,字段多、有必填校验(计量单位、仓库档案…),直接插会漏项。
     * 保存出来的就是一张**草稿**,审核留给仓管 —— 这正是要的语义。
     *
     * <p>数量取**实领数量**(不是需求):需求只是预填参考,实领才是这次真出库的量。
     *
     * <p>🔴 半成品的行**不进生产领料单**(2026-11-16 用户口径:「半成品是不入库的,只要显示这行数据,
     * 但是实际并不领料」)—— 它不出现在出库明细里就等于不过账,库存不动;
     * 全部都是半成品时**连单都不建**(建一张 0 行的出库单只会污染生产领料单列表)。
     *
     * @return 真正写进出库单的明细行数(0 = 没建单)
     */
    private int createMaterialOutFromPick(WoPickDocService.PickDoc d,
                                          List<Map<String, Object>> items, String user) {
        String today = java.time.LocalDate.now().toString();
        List<Map<String, Object>> outItems = new ArrayList<>();
        // 分摊:领料明细 id → 本次跨的 (仓库, 批号, 数量)。没有分摊的老单退回"一行一物料"。
        Map<Long, List<WoPickBatchService.Alloc>> allocs = pickBatches.ofDoc(d.id());
        String wh = "", whCode = "";
        for (Map<String, Object> it : items) {
            // 半成品跳过:只显示不领料,不影响别的物料正常出库
            if (isSemiLine(it)) continue;
            // 🔴 2026-11-24 用户口径「出库单要做到不同批次号和仓库是分开记录明细的」:
            //   同一物料跨 N 个 (仓库,批号) ⇒ 这个物料在出库单上就出 **N 行**,每行一个批次/仓库。
            //   改造前这里恒出一行(批次取第一条)⇒ 审核只扣了第一笔,其它批次的账没记上。
            List<WoPickBatchService.Alloc> list = allocs.get(toLong(it.get("明细id")));
            List<Map<String, Object>> parts = new ArrayList<>();
            if (list != null && !list.isEmpty()) {
                for (WoPickBatchService.Alloc a : list) {
                    if (a.qty() <= 0) continue;
                    parts.add(partOf(it, a.warehouse(), a.warehouseCode(), a.lot(), a.qty()));
                }
            }
            if (parts.isEmpty()) {
                // 没有分摊(迁移前生成的老单/没扫到批次)⇒ 按本行自己的仓库与批号出一行
                parts.add(partOf(it, str(it.get("仓库")), str(it.get("仓库编码")), str(it.get("批号")),
                        num(it.get("数量"))));
            }
            // 拆行后按单位精度补零头(见 keepQtyOnSplit):明细合计必须等于该物料实领数量
            keepQtyOnSplit(parts);
            for (Map<String, Object> p : parts) {
                p.put("行号", String.valueOf(outItems.size() + 1));
                outItems.add(p);
                if (wh.isEmpty()) { wh = str(p.get("仓库")); whCode = str(p.get("仓库编码")); }
            }
        }
        if (outItems.isEmpty()) return 0;
        final String whFinal = wh;
        boolean allSameWh = !whFinal.isEmpty()
                && outItems.stream().allMatch(x -> whFinal.equals(str(x.get("仓库"))));

        Map<String, Object> form = new LinkedHashMap<>();
        form.put("单据日期", today);
        // 🔑 用生单时**预留**的号,不重新取号 —— 手机上看到的领料单号与生成的出库单号一致,
        //   现场对单才不用两套号对着看。
        // ⚠ 键名必须是「**编号**」:ButtonService.save 里 `body.remove("编号")` 取单号,
        //   写成「单据编号」会被当成普通字段,它便从号池另取一个号
        //   (实测踩到:领料单 LL-2026-11-0004 提交后生成了 LL-2026-11-0005,两个号对不上)。
        form.put("编号", d.outNo());
        form.put("业务类型", BIZ_PICK);
        form.put("加工单号", d.woNo());
        form.put("工单行号", d.woLine());
        form.put("领用人", user);
        // 领料部门 = **当前登录账号所属部门**(2026-11-24 用户口径
        //   「扫码填表关联领料部门,领料部门根据账号所属部门来填入」)。
        //   ⚠ 写的是面板标签「领料部门」(物理列仍是 部门编码,参照 DEPT)——
        //   转ERP 时 KingdeePushService 直接读这一列当金蝶的部门编码(BM000xx)。
        Dept pickDept = deptOf(user);
        if (pickDept.present()) {
            form.put("领料部门", pickDept.code());
            form.put("部门id", String.valueOf(pickDept.id()));
        }
        if (allSameWh) { form.put("仓库", wh); if (!whCode.isEmpty()) form.put("仓库编码", whCode); }
        form.put("备注", "手机扫码领料提交生成:工单 " + d.woNo() + " 第 " + d.woLine()
                + " 行;明细按 仓库+批号 分行(" + outItems.size() + " 行);数量为现场扫码确认的实领量,待仓管审批");
        form.put("detail", Map.of("items", outItems));

        buttons.callButton(PANEL_OUT, "保存", form, null);
        return outItems.size();
    }

    /**
     * 出库单的一行明细(一个 仓库+批号)。
     *
     * <p>数量 = 该分摊的数量(**不是**领料行的合计):拆行后每行只记自己那一批/那个仓,
     * 这样审核过账时 {@code StockLedgerService} 按行逐笔扣 {@code kucun(物料,仓库,批号)},
     * 有几批扣几批。改造前一行记全量,其它批次永远扣不到。
     */
    private static Map<String, Object> partOf(Map<String, Object> it, String warehouse, String warehouseCode,
                                              String lot, double qty) {
        Map<String, Object> line = new LinkedHashMap<>();
        line.put("材料编码", str(it.get("编码")));
        line.put("材料名称", str(it.get("名称")));
        line.put("规格型号", str(it.get("规格")));
        line.put("计量单位", str(it.get("单位")));
        line.put("数量", round4(qty));
        line.put("仓库", warehouse);
        if (!warehouseCode.isEmpty()) line.put("仓库编码", warehouseCode);
        // ⚠ 键名必须是**面板标签**「批次号」(物理列才是 批号):ButtonService 按 label 取列,
        //   写 "批号" 会被当成未知键**静默丢弃** —— 实测生成的明细行 批号 全为 NULL,
        //   而这一行正是"哪一批出的货"的唯一凭据。
        if (!lot.isEmpty()) line.put("批次号", lot);
        line.put("明细备注", str(it.get("明细备注")));
        return line;
    }

    /**
     * 拆行后按**计量单位精度**保证数量不丢(2026-11-24)。
     *
     * <p>{@link UnitQtyNormalizer} 会把「*数量*」按单位小数位**向下取整**(个/张/支=0 位,kg=3 位)。
     * 一次领料拆成多行后,每行各自取整会**分别丢零头**:总量 6.8 拆成 3.9 + 2.9,
     * 取整成 3 + 2 = 5,凭空少 1.8;而改前一行记 6.8 只取整一次。
     * 这里把各自取整后的**差额补回第一行**,保证「明细合计 = 该物料实领数量(按单位取整)」。
     *
     * @param parts 同一物料的各行(就地改数量)
     */
    private void keepQtyOnSplit(List<Map<String, Object>> parts) {
        if (parts == null || parts.size() < 2) return;
        int nd = unitQty.decimalsOf(parts.get(0));
        double total = 0;
        for (Map<String, Object> p : parts) total += num(p.get("数量"));
        double want = com.yinjia.mes.service.UnitPrecision.floorTo(round4(total), nd);
        double have = 0;
        for (Map<String, Object> p : parts) {
            double f = com.yinjia.mes.service.UnitPrecision.floorTo(num(p.get("数量")), nd);
            p.put("数量", round4(f));
            have += f;
        }
        double diff = round4(want - have);
        if (Math.abs(diff) <= 0.0001) return;
        Map<String, Object> first = parts.get(0);
        double v = round4(num(first.get("数量")) + diff);
        if (v > 0) {
            first.put("数量", v);
            log.debug("拆行取整差额 {} 补回第一行,合计={}", diff, round4(have + diff));
        }
    }

    // ══════════════════════════ ④ 退料(已完成单上按需退) ══════════════════════════

    /**
     * **生产退料面板**:可退的领料单列表(2026-11-18 独立成面板)。
     *
     * <h3>用户口径(原话)</h3>
     * 「我还想生产退料独立出来,就是已经领料且审核的领料单据,来扫码退料。
     *  其实就是独立出来一个面版,让生产领料不用负责那么多功能,操作也方便。」
     *
     * <h3>筛什么</h3>
     * <ol>
     *   <li>台账状态 = <b>已完成</b>(没提交的领料单还没有生产领料单,无可退之物);</li>
     *   <li>它的<b>生产领料单已被仓管审核</b>({@link #isMaterialOutAudited}) ——
     *       库存是审核那一刻才扣的,没审核就退 = 凭空把料加进仓库
     *       (这条闸门 {@code requireReturnable} 里也有一份,两处同口径);</li>
     *   <li>关键字按 工单号/领料单号/产品/退料单号 模糊匹配(与列表页同一口径)。</li>
     * </ol>
     *
     * <h3>带什么回去</h3>
     * 除了台账那几列,补 {@code 已领数量 / 已退数量 / 可退数量}(按 WO_PICK_RETURN 台账累计,
     * 与 {@code returnScan} 的"累计可退"同一真源),前端直接显示、不用自己算。
     *
     * @param keyword 查询框内容(空 = 全部)
     */
    @GetMapping("/returnables")
    public ApiResult<Map<String, Object>> returnables(@RequestParam(required = false) String keyword) {
        // 新面板有独立面板码 MOBILE_RETURN;老用户仍在「生产领料」里 -> 两个码任一可见即放行
        perm.requirePanelViewAny(PagePanelRegistry.MOBILE_RETURN, PANEL_SELF);
        requireLedger();

        List<Map<String, Object>> raw = docs.list(WoPickDocService.STATE_DONE, keyword, LIST_LIMIT);
        List<Map<String, Object>> out = new ArrayList<>();
        double sumCan = 0;
        for (Map<String, Object> r : raw) {
            String outNo = str(r.get("领料单号"));
            if (outNo.isEmpty()) continue;
            // 生产领料单没被审核 ⇒ 库存还没扣 ⇒ 退料会凭空加库存,直接不列
            if (!isMaterialOutAudited(outNo)) continue;
            double picked = 0;
            int canItems = 0;
            // 2026-11-24:领料单明细已按 仓库+批号 拆行 ⇒ 可退量按**行**核(物料+仓库+批号),
            // 不能再按物料汇总:一个物料两批各 5 件,退第 1 批 5 件不该把第 2 批也算成已退。
            for (Map<String, Object> it : linesOf(outNo, "pick")) {
                double q = num(it.get("数量"));
                if (q <= 0) continue;
                picked += q;
                double back = returnedQtyOfLine(outNo, str(it.get("编码")), str(it.get("仓库")), str(it.get("批号")));
                if (round4(q - back) > 0) canItems++;
            }
            double returned = returnedTotalOf(outNo);
            double can = round4(Math.max(0, picked - returned));
            Map<String, Object> m = new LinkedHashMap<>(r);
            m.put("已领数量", round4(picked));
            m.put("已退数量", returned);
            m.put("可退数量", can);
            m.put("可退项数", canItems);
            m.put("出库已审批", true);
            // 最近一次退料单号(台账里是逗号分隔的一串)—— 退料面板列表直接显示,
            // 用户口径 2026-11-24「生产退料要补单号」(原来只能看到领料单号)。
            m.put("最近退料单号", lastOf(str(r.get("退料单号"))));
            out.add(m);
            sumCan += can;
        }
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("list", out);
        res.put("total", out.size());
        res.put("可退合计数", round4(sumCan));
        return ApiResult.ok(res);
    }

    /**
     * 该领料单上**所有物料**已退数量合计(退料面板列表用)。
     *
     * <p>与 {@link #returnedQtyOf} 同一真源({@code wo_pick_return},作废不计),只是一个按物料、
     * 一个按整单汇总 —— 列表上要显示"这单退了多少",逐个物料去加没意义。
     */
    private double returnedTotalOf(String outNo) {
        if (outNo == null || outNo.isBlank()) return 0;
        try {
            Double n = jdbc.queryForObject(
                    "SELECT ISNULL(SUM(退料数量),0) FROM dbo.wo_pick_return"
                            + " WHERE 领料单号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                    Double.class, outNo);
            return round4(n == null ? 0 : n);
        } catch (RuntimeException e) {
            log.debug("退料台账不可用(迁移未执行?)已退合计按 0 计:{}", e.getMessage());
            return 0;
        }
    }

    /**
     * 扫物料码 → 返回"这个料还能退多少"(累计可退 = 已领 − 已退)。
     *
     * <p>用户口径(2026-10-30 第三轮):「退料直接在生产领料界面。可以点开已完成的生产领料数据
     * 再次进行扫码。这样就可以来退料了。」+ 确认「累计可退 = 已领数量 − 已退数量(可分多次退)」。
     *
     * <p>**只有已完成(已过账)的领料单能退** —— 没领的料退什么?这也是服务端的硬闸门,
     * 不靠界面挡(界面挡不住直接调接口)。
     *
     * @param body {id:台账主键, code:物料编码}
     */
    @PostMapping("/returnScan")
    public ApiResult<Map<String, Object>> returnScan(@RequestBody Map<String, Object> body) {
        // 2026-11-18:退料独立成面板(MOBILE_RETURN)后,只授了新面板、没授「生产领料」的角色
        //   也必须能用这两个端点 ⇒ 两个面板码任一可见即放行(动作词仍是 pick)。
        perm.requirePanelViewAny(PagePanelRegistry.MOBILE_RETURN, PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "扫码核销", "pick");
        requireLedger();
        long id = toLong(body.get("id"));
        String code = str(body.get("code"));
        if (code.isEmpty()) throw new IllegalArgumentException("请先扫描或输入物料编码");

        WoPickDocService.PickDoc d = requireReturnable(id);
        List<Map<String, Object>> outLines = outLinesOfCode(d.outNo(), code);
        if (outLines.isEmpty()) {
            throw new IllegalStateException("物料 " + code + " 不在这张领料单里:请核对是否扫错了料");
        }
        // 2026-11-24:同一物料在出库单上可能有多行(不同 仓库/批号)⇒ 逐行核可退量,
        // 并把「这批还能退多少」一并回给前端(现场按批退,不能把 A 批的退料记到 B 批上)。
        double picked = 0, returned = 0, canReturn = 0;
        List<Map<String, Object>> batchView = new ArrayList<>();
        for (Map<String, Object> line : outLines) {
            double q = num(line.get("数量"));
            double r = returnedQtyOfLine(d.outNo(), code, str(line.get("仓库")), str(line.get("批号")));
            double c = round4(Math.max(0, q - r));
            picked += q;
            returned += r;
            canReturn += c;
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("仓库", str(line.get("仓库")));
            b.put("仓库编码", str(line.get("仓库编码")));
            b.put("批号", str(line.get("批号")));
            b.put("已领数量", round4(q));
            b.put("已退数量", round4(r));
            b.put("可退数量", c);
            batchView.add(b);
        }
        picked = round4(picked);
        returned = round4(returned);
        canReturn = round4(canReturn);
        Map<String, Object> first = outLines.get(0);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编码", code);
        out.put("名称", str(first.get("名称")));
        out.put("规格", str(first.get("规格")));
        out.put("单位", str(first.get("单位")));
        out.put("仓库", str(first.get("仓库")));
        out.put("仓库编码", str(first.get("仓库编码")));
        out.put("批号", str(first.get("批号")));
        out.put("已领数量", picked);
        out.put("已退数量", returned);
        // 累计可退 —— 前端输入框的 max,后端提交时再校验一次
        out.put("可退数量", canReturn);
        out.put("可退", canReturn > 0);
        // 批次明细:仓库 / 批号 / 已领 / 已退 / 可退(前端列出来,提交时按这个顺序自动分配)
        out.put("批次明细", batchView);
        return ApiResult.ok(out);
    }

    /**
     * 该物料在这张**已完成**领料单上的出库明细行(每行 = 一个 仓库+批号)。
     *
     * <p>2026-11-24 拆行后,同一物料可能有多行;退料必须逐行核销,不能按物料汇总。
     */
    private List<Map<String, Object>> outLinesOfCode(String outNo, String code) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> it : linesOf(outNo, "pick")) {
            if (code.equals(str(it.get("编码")))) out.add(it);
        }
        return out;
    }

    /**
     * 提交退料:为本次退料生成一张**生产退料单**(业务类型「生产退料」),**状态保持草稿**。
     *
     * <p>🔴 2026-11-18 用户口径:「生产退料单怎么自动审批了,所有生成的单都要是草稿状态」——
     * 生成后**不再**自动审核,库存等仓管在「生产退料单」面板点「审核」时才入账
     * (与生产领料单"提交只建单、仓管审核才过账"完全同一口径)。
     *
     * <p>用户口径:「退多少生多少」(2026-10-30)+
     * 「手机扫码的生产退料扫码后退料后填入的单据从其他入库改成生产退料单」(2026-11-13)。
     * 一张退料单可以一次退多个料(前端把本次要退的几项一起提交),
     * 明细逐行落 {@code bl_material_ret},台账逐行落 {@code wo_pick_return}。
     *
     * <p>与领料单的对应关系(2026-11-13 追加用户口径「生产退料要有工单号和工单行号」):
     * 单头写 **工单号(物理列 加工单号)+ 工单行号**,并把来源领料单号写进备注,
     * 这样在金蝶侧(生产退料单 inv_pick_ret)与 MES 侧都能按工单追溯。
     *
     * @param body {id:台账主键, items:[{code, qty}]}
     * @return {退料单号, 明细:[{code,qty}], 合计数量}
     */
    @PostMapping("/submitReturn")
    public ApiResult<Map<String, Object>> submitReturn(@RequestBody Map<String, Object> body) {
        perm.requirePanelViewAny(PagePanelRegistry.MOBILE_RETURN, PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "扫码核销", "pick");
        requireLedger();
        long id = toLong(body.get("id"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = body.get("items") instanceof List<?> l
                ? (List<Map<String, Object>>) l : List.of();
        if (items.isEmpty()) throw new IllegalArgumentException("请先扫码并填写退料数量");

        WoPickDocService.PickDoc d = requireReturnable(id);
        String user = currentUserName();

        // ① 逐项校验 + **按出库行(仓库+批号)分摊**(2026-11-24)
        //
        // 用户口径:「出库单和入库单要做到不同批次号和仓库是分开记录明细的」——
        // 退料单是入库方向的那张单,同样必须逐批逐仓出行。
        // 现场一次退 5 件,这 5 件可能就是 A 批 3 件 + B 批 2 件:分摊按出库行的**可退余量**
        // 依次取(扫到的码带批号时,那一批排最前),每一笔落一行明细、一笔退料台账。
        List<Map<String, Object>> lines = new ArrayList<>();
        double total = 0;
        for (Map<String, Object> it : items) {
            String code = str(it.get("code"));
            double qty = round4(num(it.get("qty")));
            if (code.isEmpty() || qty <= 0) continue;
            List<Map<String, Object>> outLines = outLinesOfCode(d.outNo(), code);
            if (outLines.isEmpty()) throw new IllegalStateException("物料 " + code + " 不在这张领料单里");

            // 每行还能退多少
            Map<Map<String, Object>, Double> canOf = new LinkedHashMap<>();
            double canAll = 0;
            for (Map<String, Object> line : outLines) {
                double q = num(line.get("数量"));
                double r = returnedQtyOfLine(d.outNo(), code, str(line.get("仓库")), str(line.get("批号")));
                double c = round4(Math.max(0, q - r));
                canOf.put(line, c);
                canAll = round4(canAll + c);
            }
            if (qty > canAll + 0.0001) {
                throw new IllegalStateException("物料 " + code + " 可退只剩 " + fmtQty(canAll)
                        + "(已领 " + fmtQty(sumOf(outLines, "数量")) + " − 已退 "
                        + fmtQty(round4(sumOf(outLines, "数量") - canAll)) + "),本次要退 " + fmtQty(qty));
            }

            // 分配顺序:扫到的码带批号/仓库 ⇒ 那一批排最前;其余按出库行序(先进先出)
            String preferLot = str(it.get("批号"));
            String preferWh = str(it.get("仓库"));
            List<Map<String, Object>> order = new ArrayList<>(outLines);
            if (!preferLot.isEmpty() || !preferWh.isEmpty()) {
                order.sort((a, b) -> {
                    int ra = rankOf(a, preferLot, preferWh), rb = rankOf(b, preferLot, preferWh);
                    return Integer.compare(ra, rb);
                });
            }
            double left = qty;
            for (Map<String, Object> line : order) {
                if (left <= 0.00005) break;
                double c = canOf.getOrDefault(line, 0d);
                if (c <= 0.00005) continue;
                double take = round4(Math.min(c, left));
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("编码", code);
                row.put("名称", str(line.get("名称")));
                row.put("规格", str(line.get("规格")));
                row.put("单位", str(line.get("单位")));
                row.put("仓库", str(line.get("仓库")));
                row.put("仓库编码", str(line.get("仓库编码")));
                row.put("批号", str(line.get("批号")));
                row.put("数量", take);
                // 2026-11-13:退料单要带**领料行的出库单价**(金蝶 inv_pick_ret 行有 price/cost)。
                //   ⚠ 必须从出库行 line 取 —— ② 段读 l.get("单价") 才不会是 0。
                row.put("单价", num(line.get("单价")));
                lines.add(row);
                total = round4(total + take);
                left = round4(left - take);
            }
            if (left > 0.00005) {
                throw new IllegalStateException("物料 " + code + " 还有 " + fmtQty(left)
                        + " 没分摊到批号上(可能被别人同时退了),请刷新后重试");
            }
        }
        if (lines.isEmpty()) throw new IllegalArgumentException("退料数量必须大于 0");

        // ② 建**生产退料单**(MATERIAL_RET;字段按金蝶 inv_pick_ret 口径:材料编码/材料名称/数量/单价/仓库)
        String today = java.time.LocalDate.now().toString();
        List<Map<String, Object>> backItems = new ArrayList<>();
        for (int i = 0; i < lines.size(); i++) {
            Map<String, Object> l = lines.get(i);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("行号", String.valueOf(i + 1));
            item.put("材料编码", str(l.get("编码")));
            item.put("材料名称", str(l.get("名称")));
            item.put("规格型号", str(l.get("规格")));
            item.put("计量单位", str(l.get("单位")));
            if (!str(l.get("仓库")).isEmpty()) item.put("仓库", str(l.get("仓库")));
            if (!str(l.get("仓库编码")).isEmpty()) item.put("仓库编码", str(l.get("仓库编码")));
            // ⚠ 「批次号」是面板标签(物理列 批号):写 "批号" 会被 ButtonService 当未知键丢弃,
            //   生产退料单的明细批号就永远是 NULL(那正是"入库单看不出退的是哪一批"的根因)。
            if (!str(l.get("批号")).isEmpty()) item.put("批次号", str(l.get("批号")));
            item.put("数量", num(l.get("数量")));
            // 单价/金额:退料按**领料时的出库单价**退回(领料行里带,拿不到就留空 →
            //   StockLedgerService 按 金额=单价×数量 记 0,与旧「其他入库」口径一致,不臆造成本)
            double price = num(l.get("单价"));
            if (price > 0) {
                item.put("单价", price);
                item.put("金额", round4(price * num(l.get("数量"))));
            }
            item.put("明细备注", "生产退料:退自领料单 " + d.outNo() + "(工单 " + d.woNo() + " 第 " + d.woLine() + " 行)");
            backItems.add(item);
        }
        Map<String, Object> backForm = new LinkedHashMap<>();
        backForm.put("单据日期", today);
        // 🔴 2026-11-24 用户口径:「生产退料要补单号,生产退料没有单号,生产领料才有。」
        //   改造前这里传的是 `单据编号 = ""` —— 那是**面板字段**,不是 saveDoc 认的单据标识:
        //   运气好按钮服务自己补号,运气不好(字段名对不上/被清空)落库就是空号,
        //   打印纸面的「No」也是空的。现在与生产领料单**同一口径**:先生成号再建单,
        //   单号当场回给手机端(抬头「退料单号」+ 提交即打印都用它)。
        String backNo = formNo.next(panelPrefix(PANEL_BACK, "TL"), user);
        backForm.put("编号", backNo);
        backForm.put("业务类型", BIZ_BACK);
        // 🔴 2026-11-13 用户口径「生产退料要有工单号和工单行号」:
        //   ⚠ 面板显示名是「工单号」(物理列仍是 加工单号),而 ButtonService.save 是**按面板标签**取值的
        //   ⇒ 这里必须写 "工单号";写 "加工单号" 会被静默丢弃(实测存进去是 NULL)。
        backForm.put("工单号", d.woNo());
        backForm.put("工单行号", d.woLine());
        backForm.put("领用人", user);
        backForm.put("经手人编码", user);
        // 退料部门 = **当前账号所属部门**(2026-11-24 用户口径「扫码填表关联领料部门,
        //   领料部门根据账号所属部门来填入」)。标签是「退料部门」,物理列仍是 部门编码(参照 DEPT)。
        Dept backDept = deptOf(user);
        if (backDept.present()) {
            backForm.put("退料部门", backDept.code());
            backForm.put("部门id", String.valueOf(backDept.id()));
        }
        // 备注按用户口径「写好备注」
        backForm.put("备注", "【生产退料】退自领料单 " + d.outNo()
                + ";工单 " + d.woNo() + " 第 " + d.woLine() + " 行;产品 " + nz(d.productName())
                + ";本次退料 " + lines.size() + " 行,合计 " + fmtQty(total));
        backForm.put("detail", Map.of("items", backItems));

        String savedNo = saveDoc(PANEL_BACK, backForm);
        // 兜底:按钮服务若因任何原因没沿用预取号,以它实际落库的号为准(两组号不会同时存在)
        if (savedNo != null && !savedNo.isBlank()) backNo = savedNo;

        // ③ 🔴 2026-11-18 用户口径「生产退料单怎么自动审批了,所有生成的单都要是草稿状态」:
        //   这里原来紧跟一句 `callButton(PANEL_BACK, "审核", …)` —— 手机一提交就**替仓管审了**,
        //   库存当场加回来,面板里根本看不到待审的退料单(与「生产领料单提交时不审核、
        //   等仓管点审核才过账」的既定口径也不一致)。
        //   现在只生成**草稿**,审核是仓管在「生产退料单」面板点「审核」时的事,
        //   过账(`StockLedgerService.postIn(MATERIAL_RET,…)`)仍在那一步发生。
        //   ⇒ 不要在这里恢复智能审核:草稿被作废时 {@code ButtonService.voidDoc} 会把下面
        //     第 ④ 步写的退料台账一并放回可退量。

        // ④ 退料台账:一行 = 一次退料(这是"已退数量"的唯一真源)
        //   ⚠ 写在这里(而不是审核时):手机端"可退量 = 已领 − 已退"必须**提交即扣**,
        //     否则两个操作员能先后把同一批料各退一遍。仓管作废这张草稿时台账会被放回。
        for (Map<String, Object> l : lines) {
            jdbc.update("INSERT INTO dbo.wo_pick_return"
                            + " (领料单号, 工单号, 工单行号, 物料编码, 物料名称, 计量单位, 仓库, 批号,"
                            + "  退料数量, 退料单号, 退料人, 退料时间, 备注,"
                            + "  asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,SYSDATETIME(),?,?,SYSDATETIME(),?,SYSDATETIME(),'N')",
                    d.outNo(), d.woNo(), d.woLine(), str(l.get("编码")), str(l.get("名称")),
                    str(l.get("单位")), str(l.get("仓库")), str(l.get("批号")),
                    num(l.get("数量")), backNo, user,
                    "退自领料单 " + d.outNo(), user, user);
        }

        // ⑤ 单据上挂个退料单号,让人从这张领料单能看到"退过料了"
        //    (台账 wo_pick_doc 的退料单号:多次退料就追加,用逗号分隔)
        docs.appendReturnNo(id, backNo, user);

        // ⑥ 回执:剩余可退(按物料汇总,逐行的明细在「批次明细」里)
        Map<String, Map<String, Object>> remainByCode = new LinkedHashMap<>();
        for (Map<String, Object> line : linesOf(d.outNo(), "pick")) {
            String code = str(line.get("编码"));
            if (remainByCode.containsKey(code)) continue;
            double picked = 0, returned = 0;
            for (Map<String, Object> x : outLinesOfCode(d.outNo(), code)) {
                picked += num(x.get("数量"));
                returned += returnedQtyOfLine(d.outNo(), code, str(x.get("仓库")), str(x.get("批号")));
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("编码", code);
            m.put("已领数量", round4(picked));
            m.put("已退数量", round4(returned));
            m.put("可退数量", round4(Math.max(0, picked - returned)));
            remainByCode.put(code, m);
        }
        List<Map<String, Object>> remain = new ArrayList<>();
        for (Map<String, Object> l : lines) {
            Map<String, Object> m = remainByCode.get(str(l.get("编码")));
            if (m != null && remain.stream().noneMatch(r -> str(r.get("编码")).equals(str(m.get("编码"))))) {
                remain.add(m);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("退料单号", backNo);
        out.put("明细", lines);
        out.put("合计数量", total);
        out.put("剩余", remain);
        out.put("单据状态", "草稿");
        out.put("说明", "已生成生产退料单 " + backNo + "(草稿,待仓管在「生产退料单」里审核后入库)");
        return ApiResult.ok(out);
    }

    /**
     * 这张单能不能退料:必须**已完成**(领料已审核过账)。
     *
     * <p>为什么是硬闸门而不是界面判断:没领过的料退什么?直接在接口上拦,
     * 拿令牌构造请求也进不来。
     */
    private WoPickDocService.PickDoc requireReturnable(long id) {
        WoPickDocService.PickDoc d = docs.byId(id);
        if (d == null) throw new IllegalArgumentException("没有找到这张单据(可能已作废)");
        if (!WoPickDocService.STATE_DONE.equals(d.state())) {
            throw new IllegalStateException("这张领料单还没提交完成,不能退料:"
                    + "请先把料领完并提交(提交后才能对已领的料退料)");
        }
        if (d.outNo() == null || d.outNo().isBlank()) {
            throw new IllegalStateException("这张单没有领料单号,不能退料");
        }
        // 🔴 2026-11-01:生产领料单**还没被仓管审批**时不能退料。
        //   退料要冲减库存;而库存是审核那一刻才扣的 —— 未审核就退,等于凭空把料退进仓库。
        //   这是服务端硬闸门,不靠界面挡。
        if (!isMaterialOutAudited(d.outNo())) {
            throw new IllegalStateException("生产领料单 " + d.outNo()
                    + " 还没审批,不能退料:请先让仓管在「生产领料单」里审核通过(审核才扣库存)");
        }
        return d;
    }

    /**
     * 生产领料单是否已被审核(仓管审批过)。
     *
     * <p>判据取 {@code yj_doc_status.shr}(审核人)非空 —— 那是全系统审核的唯一留痕口径;
     * 不能只看单据存不存在:提交后单子就存在了,但还没审批。
     */
    private boolean isMaterialOutAudited(String outNo) {
        if (outNo == null || outNo.isBlank()) return false;
        try {
            List<String> shr = jdbc.queryForList(
                    "SELECT ISNULL(shr,N'') FROM dbo.yj_doc_status WHERE panel_code = ? AND doc_no = ?",
                    String.class, PANEL_OUT, outNo);
            return !shr.isEmpty() && !shr.get(0).isBlank();
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** 领料单里找某一物料的明细行 */
    private Map<String, Object> pickLineOf(String outNo, String code) {
        Map<String, Object> hit = null;
        for (Map<String, Object> it : linesOf(outNo, "pick")) {
            if (code.equals(str(it.get("编码")))) { hit = it; break; }
        }
        return hit;
    }

    /** 领料单已领数量合计(给提交回执显示"剩余可退") */
    private double pickedQtyOf(String outNo) {
        double t = 0;
        for (Map<String, Object> it : linesOf(outNo, "pick")) t += num(it.get("数量"));
        return round4(t);
    }

    /**
     * 该领料单上某物料**已退多少**(累计)。
     *
     * <p>唯一真源 = {@code wo_pick_return}(作废的退料不计)。**不查退料单明细** ——
     * 那是物料的账面流水,按 (领料单, 物料) 去数它既慢又容易被手改的单据带偏。
     *
     * <p>表没建(迁移没跑)时返回 0:退料功能不可用比整个页面 500 好,
     * 真去提交会被上面 canReturn 挡回"可退只剩 0"。
     */
    private double returnedQtyOf(String outNo, String code) {
        if (outNo == null || outNo.isBlank()) return 0;
        try {
            Double n = jdbc.queryForObject(
                    "SELECT ISNULL(SUM(退料数量),0) FROM dbo.wo_pick_return"
                            + " WHERE 领料单号 = ? AND 物料编码 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                    Double.class, outNo, code);
            return round4(n == null ? 0 : n);
        } catch (RuntimeException e) {
            log.debug("退料台账不可用(迁移未执行?)已退数量按 0 计:{}", e.getMessage());
            return 0;
        }
    }

    /**
     * 某物料在**某仓库某批次上**已退多少(累计;2026-11-24 拆行后按行核销)。
     *
     * <p>唯一真源 = {@code wo_pick_return}(作废的退料不计)。仓库/批号按**名称**匹配 ——
     * 出库行与退料台账写的是同一个仓库名({@code 仓库}),批号可以是空串(无批次物料)。
     */
    private double returnedQtyOfLine(String outNo, String code, String wh, String lot) {
        if (outNo == null || outNo.isBlank()) return 0;
        try {
            Double n = jdbc.queryForObject(
                    "SELECT ISNULL(SUM(退料数量),0) FROM dbo.wo_pick_return"
                            + " WHERE 领料单号 = ? AND 物料编码 = ?"
                            + "   AND ISNULL(仓库,N'') = ? AND ISNULL(批号,N'') = ?"
                            + "   AND ISNULL(asp_cancel,'N') <> 'Y'",
                    Double.class, outNo, code, wh == null ? "" : wh, lot == null ? "" : lot);
            return round4(n == null ? 0 : n);
        } catch (RuntimeException e) {
            log.debug("退料台账不可用(迁移未执行?)已退数量按 0 计:{}", e.getMessage());
            return 0;
        }
    }

    /** 部门编码 → 部门名称(单据详情显示"领料部门"用;查不到就回空串) */
    private String deptNameOf(String code) {
        if (code == null || code.isBlank()) return "";
        try {
            List<String> n = jdbc.queryForList(
                    "SELECT TOP 1 ISNULL(部门名称,N'') FROM dbo.bs_dept WHERE 部门编码 = ?", String.class, code);
            return n.isEmpty() ? "" : n.get(0);
        } catch (RuntimeException e) {
            return "";
        }
    }

    /** 逗号分隔的一串单号里的**最后一个**(退料单号多次退料时追加,取最近那张) */
    private static String lastOf(String csv) {
        if (csv == null || csv.isBlank()) return "";
        String last = "";
        for (String p : csv.split("[,，]")) if (!p.isBlank()) last = p.trim();
        return last;
    }

    /** 分配优先级:码里带了批号/仓库 ⇒ 匹配的排最前(0),其余原序(1) */
    private static int rankOf(Map<String, Object> line, String preferLot, String preferWh) {
        boolean lotOk = preferLot.isEmpty() || preferLot.equals(str(line.get("批号")));
        boolean whOk = preferWh.isEmpty() || preferWh.equals(str(line.get("仓库")));
        return lotOk && whOk ? 0 : 1;
    }

    /** 一组明细里某键的合计(只用于提示文案) */
    private static double sumOf(List<Map<String, Object>> list, String key) {
        double t = 0;
        for (Map<String, Object> r : list) t += num(r.get(key));
        return round4(t);
    }
    /**
     * 把「批次串」并进原有的明细备注,而不是覆盖它。
     *
     * <p>原备注里可能带着生单时写的 **BOM 需求**(「…(需求 3)」),那是 {@link #bomUsageOf} 的取数依据 ——
     * 一旦被批次串冲掉,前端默认领用数量就会退化成库存上限(2026-10-30 实测:需求 3 → 默认 12000)。
     *
     * <p>幂等:原备注里已经有同一条批次串(或前缀相同)时**替换而不是追加**,
     * 否则反复写入会越堆越长(用户改几次数量就变成长串)。
     *
     * @param old  原备注
     * @param note 本次的批次串(如「领料批次:无批次=3」)
     * @return 合并后的备注:「原备注;批次串」
     */
    /**
     * 把实领数量写进**领料明细**(wo_pick_line),并把本次的 **仓库+批号 分摊**
     * 逐笔落进批次台账 {@code wo_pick_batch}(2026-11-24)。
     *
     * <p>只用于**未完成**的领料单 —— 这时还没有生产领料单,明细的唯一载体就是这张表。
     * 提交时 {@link #submit} 会据此生成正式的生产领料单,并**按分摊拆成多行明细**。
     *
     * <p>🔴 2026-11-24 用户口径:「出库单和入库单要做到不同批次号和仓库是分开记录明细的」
     * ⇒ 以前这里只把**第一条批号**写进「批号」列、其余批次串成一串塞进「明细备注」,
     * 于是审核过账时只有第一个批次的账被扣、其它批次/仓库的货纹丝不动(现场表现:
     * "料领了但库存没扣"或"另一个仓的货被算少了")。现在分摊逐笔存表,提交时逐笔行。
     *
     * @param outNo      领料单号(wo_pick_doc.领料单号)
     * @param line       行号
     * @param qty        实领数量(分摊合计必须等于它)
     * @param note       批次串(写进明细备注留痕,人看的)
     * @param allocs     本次分摊 [{仓库,仓库编码,批号,数量}];空 = 按本行仓库一整笔
     * @param code       物料编码(兜底定位:行号对不上时按物料找)
     */
    private void writeQtyToPickLine(String outNo, String line, double qty, String note,
                                    List<Map<String, Object>> allocs, String code) {
        // 先定位这一行(行号优先;老数据行号可能不规范,退回按物料编码)
        List<Map<String, Object>> hit = jdbc.queryForList(
                "SELECT TOP 1 x.id, ISNULL(x.单头id,0) AS 单头id, ISNULL(x.明细备注,N'') AS 备注,"
                        + " ISNULL(x.仓库,N'') AS 仓库, ISNULL(x.仓库编码,N'') AS 仓库编码"
                        + " FROM dbo.wo_pick_line x JOIN dbo.wo_pick_doc d ON d.id = x.单头id"
                        + " WHERE d.领料单号 = ? AND ISNULL(x.asp_cancel,'N') <> 'Y'"
                        + "   AND (x.行号 = ? OR x.物料编码 = ?)"
                        + " ORDER BY CASE WHEN x.行号 = ? THEN 0 ELSE 1 END, x.id",
                outNo, line, code, line);
        if (hit.isEmpty()) return;
        Map<String, Object> row = hit.get(0);
        long lineId = toLong(row.get("id"));
        long docId = toLong(row.get("单头id"));
        String oldNote = str(row.get("备注"));
        String merged = mergeNote(oldNote, note);

        // 批号列:拆批后本行只记第一条(完整分摊在 wo_pick_batch;单据明细提交时才逐批拆行)
        String lot = "";
        for (Map<String, Object> a : allocs) {
            String l = str(a.get("批号"));
            if (!l.isEmpty()) { lot = l; break; }
        }
        if (lot.isEmpty()) {
            jdbc.update("UPDATE dbo.wo_pick_line SET 实领数量 = ?, 明细备注 = ?,"
                    + " asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE id = ?",
                    qty, merged, currentUserName(), lineId);
        } else {
            jdbc.update("UPDATE dbo.wo_pick_line SET 实领数量 = ?, 明细备注 = ?, 批号 = ?,"
                    + " asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE id = ?",
                    qty, merged, lot, currentUserName(), lineId);
        }

        // 分摊:没有批次信息(老前端/没扫到批号)时按"本行仓库 + 无批号"记一整笔,
        // 这样提交时至少有一条明细、数量对得上(与改造前行为一致)。
        List<Map<String, Object>> effective = allocs.isEmpty()
                ? List.of(allocOf(str(row.get("仓库")), str(row.get("仓库编码")), "", qty))
                : allocs;
        pickBatches.replace(lineId, docId, code, effective, currentUserName());
    }

    /** 分摊项(与前端 batches 同键名) */
    private static Map<String, Object> allocOf(String wh, String whCode, String lot, double qty) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("仓库", wh);
        m.put("仓库编码", whCode);
        m.put("批号", lot);
        m.put("数量", qty);
        return m;
    }

    /**
     * 前端传来的 {@code batches} → 分摊列表(过滤数量 ≤0、去重同 仓库+批号 相加)。
     *
     * <p>⚠ 合计**必须等于**本次写入的数量:不等就是前端拆批算错了,宁可让现场重扫一遍,
     * 也不能把"领 10 件只记了 6 件的批次"这种账写进库(那种账事后谁也说不清)。
     */
    private List<Map<String, Object>> parseAllocs(Object batchesRaw, double qty, String code) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (!(batchesRaw instanceof List<?> list) || list.isEmpty()) return out;
        Map<String, Map<String, Object>> byKey = new LinkedHashMap<>();
        for (Object o : list) {
            if (!(o instanceof Map)) continue;
            @SuppressWarnings("unchecked")
            Map<String, Object> b = (Map<String, Object>) o;
            double q = num(b.get("数量"));
            if (q <= 0) continue;
            String wh = str(b.get("仓库"));
            String whCode = str(b.get("仓库编码"));
            String lot = str(b.get("批号"));
            String key = wh + "\u0001" + lot;
            Map<String, Object> exist = byKey.get(key);
            if (exist == null) {
                byKey.put(key, allocOf(wh, whCode, lot, q));
            } else {
                exist.put("数量", round4(num(exist.get("数量")) + q));
            }
        }
        out.addAll(byKey.values());
        double sum = 0;
        for (Map<String, Object> a : out) sum += num(a.get("数量"));
        if (!out.isEmpty() && Math.abs(round4(sum) - round4(qty)) > 0.0001) {
            throw new IllegalStateException("物料 " + code + " 的批次分摊合计 " + fmtQty(sum)
                    + " 与本次领料数量 " + fmtQty(qty) + " 不一致:请重新扫码(批次可能已被别人占用),再填数量");
        }
        return out;
    }

    private static String mergeNote(String old, String note) {
        String base = old == null ? "" : old.trim();
        if (note == null || note.isBlank()) return base;
        // 去掉旧备注里已有的同前缀批次段(领料批次: / 退料批次:)
        String prefix = note.startsWith("退料批次:") ? "退料批次:" : "领料批次:";
        StringBuilder keep = new StringBuilder();
        for (String seg : base.split("[;；]")) {
            String s = seg.trim();
            if (s.isEmpty()) continue;
            if (s.startsWith(prefix)) continue;     // 旧的批次段丢掉,用这次的
            if (keep.length() > 0) keep.append("; ");
            keep.append(s);
        }
        keep.append(keep.length() > 0 ? "; " : "").append(note);
        String out = keep.toString();
        // 明细备注列宽有限(nvarchar 长度视表而定),超长截前段保住需求那一截
        return out.length() > 400 ? out.substring(0, 400) : out;
    }

    /** 打/重打工单二维码:只记打印次数,内容由前端按 woQrText 同口径渲染 */
    @PostMapping("/reprint")
    public ApiResult<Map<String, Object>> reprint(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "打印", "print");
        requireLedger();
        long id = toLong(body.get("id"));
        WoPickDocService.PickDoc d = docs.byId(id);
        if (d == null) throw new IllegalArgumentException("没有找到这张单据(可能已作废)");
        docs.bumpPrint(id, currentUserName());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("打印", printPayload(d.woNo(), d.woLine(), d.productName(), "", d.id()));
        return ApiResult.ok(out);
    }

    /** 工单二维码内容(与 print-formats.woQrText 同一口径:公司代码@工单号@1000+行号) */
    @PostMapping("/printAck")
    public ApiResult<Void> printAck(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        requireLedger();
        long id = toLong(body.get("id"));
        if (id > 0) docs.bumpPrint(id, currentUserName());
        return ApiResult.ok(null);
    }

    // ══════════════════════════ 内部取数/写数 ══════════════════════════

    /** 台账表没跑迁移时给出可读提示(不要抛成 500) */
    private void requireLedger() {
        if (!docs.tableReady()) {
            throw new IllegalStateException("配对台账表 wo_pick_doc 还没建:请先执行迁移 "
                    + "tools/migrate-wo-pick-doc-20261030.sql(两个账套都要跑)");
        }
    }

    /**
     * 已经开过单时的返回(重复扫同一工单行走这里,**不再新建**,但照样给打印载荷)。
     *
     * <p>🔴 2026-11-06 用户口径:「现在扫码后已存在的领料单,是不在打印的。但是现在是需要给他打印,
     * 只是不生成领料单」⇒ 以前这里 {@code 打印 = null},重复扫码什么都不打;
     * 现在把**那张已存在单据**的打印载荷原样返回(明细取 wo_pick_line / 生产领料单,
     * 与新建时同一个 {@code printPayload}),前端就能"只打印、不生单"。
     */
    private Map<String, Object> existingResult(WoPickDocService.PickDoc d, String woNo, int line,
                                               Map<String, Object> wo, boolean wantPrint) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", d.id());
        out.put("领料单号", d.outNo());
        out.put("退料单号", d.backNo());
        out.put("领料类型", d.pickKind());
        out.put("状态", d.state());
        out.put("物料项数", d.itemCount());
        out.put("重复", true);      // 前端据此提示"该工单行已经开过单,已帮你打开(并重打这张单)"
        out.put("打印", wantPrint && wo != null
                ? printPayload(woNo, line, str(wo.get("产品名称")), str(wo.get("规格型号")), d.id())
                : null);
        // 2026-11-18:同一工单行可能有**两张**单(组装 + 混料) —— 一并带回去,
        // 前端据此把两张都列出来、都能点进去(用户口径)。
        // 🔴 2026-11-18(第二轮用户报障「生成工单领料扫码时,只有组装领料自动打印,混料领料没打印出来」):
        //   这里以前只给**顶层**一个打印载荷(那是组装那张),{@code 单据} 数组里的每张单**没有**载荷
        //   ⇒ 重复扫码(已开过单)走这条路径时,前端拿不到混料那张的纸面,重打只能打组装。
        //   现在逐张给:每张单一个 {@code printPayload}(标题/领料类型/明细都按**自己**那张单取)。
        String pName = wo == null ? "" : str(wo.get("产品名称"));
        String pSpec = wo == null ? "" : str(wo.get("规格型号"));
        List<Map<String, Object>> made = new ArrayList<>();
        for (WoPickDocService.PickDoc x : docs.listActive(woNo, line)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", x.id());
            m.put("领料单号", x.outNo());
            m.put("领料类型", x.pickKind());
            m.put("状态", x.state());
            m.put("物料项数", x.itemCount());
            m.put("已领项数", x.doneCount());
            m.put("重复", true);
            m.put("打印", wantPrint && wo != null ? printPayload(woNo, line, pName, pSpec, x.id()) : null);
            made.add(m);
        }
        out.put("单据", made);
        return out;
    }

    /**
     * 解析工单行。
     *
     * <p>行号优先(用户口径「我的工单二维码带有行号的,只生成那一行的就行」);
     * 没带行号时取该工单的第一行(与工序报工 context 接口同一退化口径)。
     */
    private Map<String, Object> resolveWoLine(String woNo, int line) {
        String sql = "SELECT TOP 1 p.pl_no AS 工单号, p.pl_xc AS 工单行号, p.id AS 行id, ISNULL(p.dm,N'') AS 物料编码,"
                + " ISNULL(p.mc,N'') AS 产品名称, ISNULL(p.gg,N'') AS 规格型号, ISNULL(p.jldw,N'') AS 计量单位,"
                + " ISNULL(p.scx,N'') AS 生产线, ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.lot_no,N'') AS 批号,"
                + " ISNULL(p.完工状态,N'') AS 完工状态"
                + " FROM dbo.plang p WHERE p.pl_no = ? AND ISNULL(p.asp_cancel,'N') <> 'Y'"
                + (line > 0 ? " AND p.pl_xc = ?" : "") + " ORDER BY p.pl_xc";
        List<Map<String, Object>> rows = line > 0
                ? jdbc.queryForList(sql, woNo, line)
                : jdbc.queryForList(sql, woNo);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException(line > 0
                    ? "工单 " + woNo + " 没有第 " + line + " 行(或该行已作废),请核对工单二维码"
                    : "没有找到工单 " + woNo + "(已作废的单查不到)");
        }
        Map<String, Object> wo = new LinkedHashMap<>(rows.get(0));
        wo.put("仓库", "");   // plang 无仓库列:仓库由生产领料单明细的行仓库决定
        return wo;
    }

    // ⚠ 2026-11-13:原 private latestAsmBom(...) / bomDetail(...) 已删除 —— BOM 取数收口到
    //   {@link WorkOrderBomService}(临时工单用料 wo_bom 优先 → 标准组装 BOM 兜底),避免本类与
    //   WorkReportController 各写一套排序/单位兜底(2026-11-04 出过两端取到不同 BOM 版本的事故)。
    //   历史注释与口径留档见 {@link WorkOrderBomService#standardOf(String)}。

    /**
     * 保存一张草稿单,返回单号(空单号由 FormNoService 生成)。
     *
     * <p>⚠ 单号键名是 {@code 编号}:{@code ButtonService.save} 走的是
     * {@code result(no, status)} → {@code {编号, 单据状态}}(实测字段,不是「单据编号」)。
     * 三个键都兜一下,免得以后有人改了 result() 这里静默取不到单号。
     */
    @SuppressWarnings("unchecked")
    private String saveDoc(String panelCode, Map<String, Object> form) {
        Map<String, Object> res = buttons.callButton(panelCode, "保存", form, null);
        Object no = null;
        if (res != null) {
            no = res.get("编号");
            if (no == null) no = res.get("单据编号");
            if (no == null) no = res.get("docNo");
        }
        String s = no == null ? "" : String.valueOf(no).trim();
        if (s.isEmpty()) {
            throw new IllegalStateException(panelCode + " 保存成功但没有返回单号,无法建立配对台账 "
                    + "(ButtonService.save 的返回应含「编号」键)");
        }
        return s;
    }

    /**
     * 读单据明细行(领料/退料统一形态)。
     *
     * @param no 单据编号
     * @param side pick=领料 / back=退料(bl_material_ret,2026-11-13 起)
     *
     * <p>🔴 2026-11-01 改造:领料明细**按单据状态分两个数据源** ——
     * <ul>
     *   <li><b>未完成</b>(生单后、提交前):明细在 {@code wo_pick_line},
     *       此时**还没有生产领料单**(用户口径「提交后才生成生产领料单」);</li>
     *   <li><b>已完成</b>(提交后):明细就是 {@code bl_material_out}(生产领料单已生成),
     *       退料/查看都读它,历史数据也照旧。</li>
     * </ul>
     * 这样上层所有调用(扫码、写数量、提交、打印)都不用改,只换数据源。
     */
    private List<Map<String, Object>> linesOf(String no, String side) {
        if (no == null || no.isBlank()) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        if ("back".equals(side)) {
            // 2026-11-13:退料单改为「生产退料单」MATERIAL_RET ⇒ 明细读 bl_material_ret(列名与生产领料单同族)
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT id, 行号 AS 行号, ISNULL(材料编码,N'') AS 编码, ISNULL(材料名称,N'') AS 名称,"
                            + " ISNULL(规格型号,N'') AS 规格, ISNULL(计量单位,N'') AS 单位,"
                            + " ISNULL(仓库,N'') AS 仓库, ISNULL(仓库编码,N'') AS 仓库编码,"
                            + " ISNULL(数量,0) AS 数量, ISNULL(批号,N'') AS 批号, ISNULL(明细备注,N'') AS 明细备注"
                            + " FROM dbo.bl_material_ret WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                            + " ORDER BY TRY_CAST(行号 AS int), id", no)) {
                out.add(normalizeLine(r, "行号", "材料编码"));
            }
        } else if (isDraftPick(no)) {
            // 未完成:读领料明细表(此时还没有生产领料单)
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT x.id, x.行号, ISNULL(x.物料编码,N'') AS 编码, ISNULL(x.物料名称,N'') AS 名称,"
                            + " ISNULL(x.规格型号,N'') AS 规格, ISNULL(x.计量单位,N'') AS 单位,"
                            + " ISNULL(x.仓库,N'') AS 仓库, ISNULL(x.仓库编码,N'') AS 仓库编码,"
                            + " ISNULL(x.实领数量,0) AS 数量, ISNULL(x.批号,N'') AS 批号,"
                            + " ISNULL(x.明细备注,N'') AS 明细备注, ISNULL(x.需求数量,0) AS 需求数量"
                            + " FROM dbo.wo_pick_line x"
                            + " JOIN dbo.wo_pick_doc d ON d.id = x.单头id"
                            + " WHERE d.领料单号 = ? AND ISNULL(x.asp_cancel,'N') <> 'Y'"
                            + " ORDER BY TRY_CAST(x.行号 AS int), x.id", no)) {
                out.add(normalizeLine(r, "行号", "物料编码"));
            }
            // 2026-11-24:每行挂上「批次明细」(本次领料跨了哪些 仓库+批号、各多少)。
            // 界面上照着它显示,提交时后端按同一份分摊拆生产领料单的明细行 —— 两处同源。
            Map<String, List<WoPickBatchService.Alloc>> allocs = pickBatches.byOutNo(no);
            for (Map<String, Object> it : out) {
                List<WoPickBatchService.Alloc> list = allocs.get(str(it.get("编码")));
                List<Map<String, Object>> view = new ArrayList<>();
                if (list != null) for (WoPickBatchService.Alloc a : list) view.add(WoPickBatchService.toView(a));
                it.put("批次明细", view);
            }
        } else {
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT id, 行号, ISNULL(材料编码,N'') AS 编码, ISNULL(材料名称,N'') AS 名称,"
                            + " ISNULL(规格型号,N'') AS 规格, ISNULL(计量单位,N'') AS 单位,"
                            + " ISNULL(仓库,N'') AS 仓库, ISNULL(仓库编码,N'') AS 仓库编码,"
                            + " ISNULL(数量,0) AS 数量, ISNULL(批号,N'') AS 批号, ISNULL(明细备注,N'') AS 明细备注,"
                            + " ISNULL(单价,0) AS 单价"
                            + " FROM dbo.bl_material_out WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                            + " ORDER BY TRY_CAST(行号 AS int), id", no)) {
                out.add(normalizeLine(r, "行号", "材料编码"));
            }
        }
        return out;
    }

    /**
     * 这张领料单是否还处于「未完成」(生单后、提交前)。
     *
     * <p>它是选择明细数据源的开关:未完成 ⇒ wo_pick_line(尚无生产领料单);
     * 其余(已完成/已作废)⇒ 走 bl_material_out 的历史口径。
     */
    private boolean isDraftPick(String outNo) {
        if (outNo == null || outNo.isBlank()) return false;
        List<String> st = jdbc.queryForList(
                "SELECT ISNULL(状态,N'') FROM dbo.wo_pick_doc WHERE 领料单号 = ?", String.class, outNo);
        return !st.isEmpty() && WoPickDocService.STATE_OPEN.equals(st.get(0));
    }

    private Map<String, Object> normalizeLine(Map<String, Object> r, String lineCol, String codeCol) {
        Map<String, Object> m = new LinkedHashMap<>();
        Object rawLine = r.get(lineCol);
        m.put("行号", rawLine == null ? "" : String.valueOf(rawLine));
        m.put("原始行号", rawLine == null ? "" : String.valueOf(rawLine));
        m.put("编码", r.get("编码"));
        m.put("名称", r.get("名称"));
        m.put("规格", r.get("规格"));
        m.put("单位", r.get("单位"));
        m.put("仓库", r.get("仓库"));
        m.put("仓库编码", r.get("仓库编码"));
        m.put("数量", r.get("数量"));
        m.put("批号", r.get("批号"));
        m.put("明细备注", r.get("明细备注"));
        // 2026-11-13:退料单要按领料行的**出库单价**记金额(金蝶 inv_pick_ret 行有 price/cost),
        //   领料行没这一列时返回 null ⇒ 退料金额留 0(不臆造成本)。
        m.put("单价", r.get("单价"));
        // BOM 需求用量 —— 前端扫物料码时用它做**默认领用数量**。
        //
        // 🔴 2026-11-01:未完成的单已经改读 wo_pick_line,那里有独立的「需求数量」列,
        //   直接用它(比从备注解析可靠);已完成的历史单没有这一列,退回解析备注。
        Object needCol = r.get("需求数量");
        m.put("BOM用量", needCol != null ? num(needCol) : bomUsageOf(str(r.get("明细备注"))));
        // 半成品标记(2026-11-16):前端据此把这一行显示成「半成品·免领」、不参与进度、不可填数量
        m.put("半成品", isSemiFinished(m.get("编码")));
        // 2026-11-24:明细行主键(未完成的单 = wo_pick_line.id)。提交生成生产领料单时
        //   按它取 wo_pick_batch 的批次分摊 —— 同一物料多行时只按物料编码会张冠李戴。
        m.put("明细id", r.get("id"));
        m.put("codeCol", codeCol);
        return m;
    }

    /**
     * 从明细备注里取 BOM 需求用量。
     *
     * <p>为什么从备注解析而不是加列:领料单明细表 {@code bl_material_out} 是金蝶同步口径的表,
     * 加自有列会与 ERP 字段对账打架;而"需求多少"是**生单那一刻的快照**,写进备注正好留痕
     * (明细备注本来就允许自由文本,且现场在生产领料单里也看得到)。
     *
     * @return 需求用量;备注里没有或解析不出 → 0
     */
    private static double bomUsageOf(String note) {
        if (note == null || note.isBlank()) return 0;
        // 🔴 2026-10-30 修:正则**不能要求「需求」前面是左括号**。
        //   备注格式已经变成「…(用量 1 × 工单 300 = 需求 300)」—— 括号在最前面,
        //   「需求」前面是「= 」;旧正则 `\(需求\s*N\s*\)` 因此全部匹配失败,
        //   前端拿到 BOM用量=0 就退回库存上限(实测需求 3 变成 12000、默认领满)。
        //   改为只认「需求 <数字>)」，「需求」前不限字符,兼容新旧两种写法。
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("需求\\s*([0-9]+(?:\\.[0-9]+)?)\\s*\\)").matcher(note);
        if (!m.find()) return 0;
        try {
            return round4(Double.parseDouble(m.group(1)));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /**
     * 该物料的**可用量**批次行(2026-10-30 口径改造)。
     *
     * <h3>为什么不再是"实时结存"</h3>
     * 用户口径(本轮):「判断库存的计算是不是其他入库和材料出库审核后才可以计算的」——
     * 对,{@code kucun} 只在**审核过账**时变动(StockLedgerService),草稿不动库存。
     * 但那样一来,两张未审核的草稿可以各自领到同一个数字,审核时才突然发现不够。
     * ⇒ 显示给现场的是**可用量** = 实时结存 − **其他未审核草稿**已占用的量。
     *
     * <h3>口径</h3>
     * <ul>
     *   <li>基数:{@code v_stock_pick}(= kucun 三键结存,已过账的真账);</li>
     *   <li>扣减:同物料、同仓库、**状态为草稿**(即还没审核)的生产领料单明细数量合计;
     *       ⚠ 要排除**本单自己** —— 否则自己已填的数量会把自己挤掉,越领越少;</li>
     *   <li>不退到负数:最多减到 0(已填满的单会让可用量显示 0,不会显示负数)。</li>
     * </ul>
     *
     * <p>批次行仍按 (物料,仓库,批号) 给,{@code 现存量} 字段放的是**可用量**;
     * 批号级的占用量按"同批号优先抵扣,不够再顺延"分摊,保证各行可用量加起来等于总量。
     *
     * <p>🔴 2026-11-24 用户口径「这个手机端会涉及到多个批次号和仓库出库的问题,重点修复」:
     * 改造前这里按**领料行预填的那个仓**过滤(`AND 仓库 = ?`)⇒ 物料在别的仓有货也看不到,
     * 现场只能从这一个仓领,多仓出库等于不存在。现在**一律返回全部仓的批次行**,
     * 只把"本行仓库"排在前面(FIFO 仍按批号日期)——前端据此可以跨仓拆批。
     *
     * @param code    物料编码
     * @param wh      优先仓库(只影响排序,不再过滤;空 = 不排前)
     * @param selfNo  本单编号(排除本单自己的占用量;null/空 = 不排除)
     */
    private List<Map<String, Object>> stockRows(String code, String wh, String selfNo) {
        String sql = "SELECT 存货编码, 存货名称, 规格型号, 计量单位, 仓库, 仓库编码, 批号, 现存量"
                + " FROM dbo.v_stock_pick WHERE 存货编码 = ? AND 现存量 > 0"
                + (wh == null || wh.isBlank() ? "" : " ORDER BY CASE WHEN 仓库 = ? OR 仓库编码 = ? THEN 0 ELSE 1 END, 批号")
                + (wh == null || wh.isBlank() ? " ORDER BY 批号" : "");
        List<Map<String, Object>> rows = (wh == null || wh.isBlank())
                ? jdbc.queryForList(sql, code)
                : jdbc.queryForList(sql, code, wh, wh);

        // 其他未审核草稿已占用的量(按 **仓库+批号** 分组:2026-11-24 起多仓出库,
        // 同一批号可能同时躺在两个仓里,按批号合并会把 A 仓的占用扣到 B 仓上)
        Map<String, Double> occupied = new LinkedHashMap<>();
        try {
            String osql = "SELECT ISNULL(l.仓库,N'') AS wh, ISNULL(l.批号,N'') AS lot, SUM(ISNULL(l.数量,0)) AS qty"
                    + " FROM dbo.bl_material_out l"
                    + " JOIN dbo.bd_material_out h ON h.单据编号 = l.单据编号"
                    + " WHERE l.材料编码 = ? AND ISNULL(l.asp_cancel,'N') <> 'Y'"
                    + "   AND ISNULL(l.数量,0) > 0"
                    + "   AND ISNULL(h.单据编号, N'') <> ?"
                    // 未审核 = 还没在 yj_doc_status 里写审核人(shr)。已审核的已经在 kucun 里扣过了,不能再扣一次。
                    + "   AND NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status s"
                    + "                    WHERE s.panel_code = N'MATERIAL_OUT' AND s.doc_no = h.单据编号"
                    + "                      AND ISNULL(s.shr, N'') <> N'')"
                    + " GROUP BY ISNULL(l.仓库,N''), ISNULL(l.批号,N'')";
            for (Map<String, Object> r : jdbc.queryForList(osql, code, selfNo == null ? "" : selfNo)) {
                occupied.put(str(r.get("wh")) + "\u0001" + str(r.get("lot")), num(r.get("qty")));
            }
        } catch (RuntimeException e) {
            // 占用查询失败不阻断:退化为实时结存(宁可显示宽一点,也不要让扫码直接报错)
            log.debug("可用量占用查询失败,退化为实时结存:{}", e.getMessage());
        }

        // 逐行抵扣:先扣同 (仓库,批号) 的占用,再按顺序扣空批号/其它批号的剩余占用
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String lot = str(r.get("批号"));
            String whKey = str(r.get("仓库"));
            String key = whKey + "\u0001" + lot;
            double avail = num(r.get("现存量"));
            double occ = occupied.getOrDefault(key, 0d);
            if (occ > 0) {
                double take = Math.min(occ, avail);
                avail = round4(avail - take);
                occupied.put(key, round4(occ - take));
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("批号", r.get("批号"));
            m.put("仓库", r.get("仓库"));
            m.put("仓库编码", r.get("仓库编码"));
            m.put("现存量", round4(Math.max(0, avail)));
            out.add(m);
        }
        return out;
    }

    /**
     * 把某一行明细的数量写回去(草稿单可改)。
     *
     * <p>批次留痕写进明细备注(用户口径「批次处理也保留之前的」:沿用先进先出拆批,
     * 具体扣了哪些批次写在备注里,过账时按 (物料,仓库,批号) 核销)。
     */
    @SuppressWarnings("unchecked")
    private void writeQty(String panel, String no, String line, String rawLine,
                          double qty, Map<String, Object> body, String side, String code) {
        String note = "";
        Object batchesRaw = body.get("batches");
        if (batchesRaw instanceof List<?> list && !list.isEmpty()) {
            List<String> parts = new ArrayList<>();
            for (Object o : list) {
                if (!(o instanceof Map)) continue;
                Map<String, Object> b = (Map<String, Object>) o;
                double q = num(b.get("数量"));
                if (q <= 0) continue;
                parts.add((str(b.get("批号")).isEmpty() ? "无批次" : str(b.get("批号"))) + "=" + q);
            }
            if (!parts.isEmpty()) note = ("back".equals(side) ? "退料批次:" : "领料批次:") + String.join(", ", parts);
        }

        // 🔴 2026-11-01:未完成的领料单,数量写进 **wo_pick_line.实领数量**
        //   (此时还没有生产领料单,不能写 bl_material_out —— 那张单要等提交才生成)。
        // 2026-11-24:本次的 仓库+批号 分摊一并逐笔落 wo_pick_batch,提交时按它拆明细行。
        if (!"back".equals(side) && isDraftPick(no)) {
            writeQtyToPickLine(no, line, qty, note, parseAllocs(batchesRaw, qty, code), code);
            return;
        }

        // 2026-11-13:退料单已是「生产退料单」(bl_material_ret),行号列同领料单叫「行号」
        String table = "back".equals(side) ? "bl_material_ret" : "bl_material_out";
        String lineCol = "行号";
        if (note.isEmpty()) {
            jdbc.update("UPDATE dbo." + table + " SET 数量 = ? WHERE 单据编号 = ? AND " + lineCol + " = ?",
                    qty, no, line);
        } else {
            // 🔴 2026-10-30 修:**必须在原备注后面追加,不能整块覆盖**。
            //   生单时把「BOM 需求」写进了明细备注(如「生产领料·组装工艺清单 AP-STG-03(需求 3)」),
            //   而这里原来 `SET 明细备注 = ?` 直接盖成「领料批次:…」⇒ **需求被冲掉**,
            //   之后 bomUsageOf 解析不到,前端默认数量退化成库存上限
            //   (实测:需求 3 的 OPP袋,扫码后数量框默认 12000)。改为读原备注再拼接。
            List<String> curNotes = jdbc.queryForList(
                    "SELECT ISNULL(明细备注,N'') FROM dbo." + table + " WHERE 单据编号 = ? AND " + lineCol + " = ?",
                    String.class, no, line);
            String old = curNotes.isEmpty() ? "" : curNotes.get(0);
            jdbc.update("UPDATE dbo." + table + " SET 数量 = ?, 明细备注 = ? WHERE 单据编号 = ? AND " + lineCol + " = ?",
                    qty, mergeNote(old, note), no, line);
        }
        // 批号列:拆批后本行只记第一条批号(多批次在明细备注里),保持"单据上能看见批号"
        if (batchesRaw instanceof List<?> list && !list.isEmpty()) {
            for (Object o : list) {
                if (!(o instanceof Map)) continue;
                String lot = str(((Map<String, Object>) o).get("批号"));
                if (!lot.isEmpty()) {
                    jdbc.update("UPDATE dbo." + table + " SET 批号 = ? WHERE 单据编号 = ? AND " + lineCol + " = ?",
                            lot, no, line);
                    break;
                }
            }
        }
    }

    /** 打印载荷:工单二维码内容 + 抬头信息(前端按这个渲染标签/走打印站点) */
    /**
     * 打印载荷(纸面「领料单」用的全量数据)。
     *
     * <p>🔴 2026-11-02 用户口径:「改成图片的样式,二维码放在红框内;打印大小中一刀,A4 一半,横打」——
     * 给的样张是一张**纸质领料单**:左上角红框放码、标题「领 料 单」+ No 单号、
     * 七列表格(订单号/材料名称/规格/单位/请领数量/实发数量/备注)、底部四栏签名。
     * 所以载荷除了抬头与二维码,**必须带明细行** —— 否则打出来只是一张空表头的纸。
     *
     * @param docId 台账主键;非空时按它取明细(请领=BOM需求,实发=已领)。生单/重打都传,
     *              只有在还没有台账的极少数路径下才为空(那时明细为空,纸面就是空白表)
     */
    private Map<String, Object> printPayload(String woNo, int line, String productName, String spec, Long docId) {
        WoPickDocService.PickDoc d = docId == null ? null : docs.byId(docId);
        // 领料类型:拿不到台账时按组装算(极少数"还没有台账"的路径)
        String kind = d == null || d.pickKind() == null || d.pickKind().isBlank() ? KIND_ASSEMBLY : d.pickKind();
        boolean mix = KIND_MIX.equals(kind);

        Map<String, Object> m = new LinkedHashMap<>();
        // 公司代码@工单号@(1000+行号)**@领料标记**(2026-11-18 用户口径:
        //   「混料和组装的二维码是一样的,需要在二维码上多一位作为混料领料还是组装领料的标记」)
        //   ⇒ 第 4 段 **A = 组装领料 / M = 混料领料**。前 3 段口径不变(工单码解析照旧能用):
        //   scanCode.splitScan 只取工单号+行号,parseWorkOrderQr 只读前 3 段,多一段不影响。
        m.put("二维码内容", "0@" + woNo + "@" + (1000 + Math.max(1, line)) + "@" + (mix ? "M" : "A"));
        m.put("领料标记", mix ? "M" : "A");
        m.put("工单号", woNo);
        m.put("工单行号", line);
        m.put("产品名称", productName);
        m.put("规格型号", spec);
        // 纸面标题:两种都是「生产领料单」,后面括号注明这张是组装还是混料(2026-11-18 用户口径)
        m.put("标题", "生产领料单（" + (mix ? "混料" : "组装") + "）");
        // 纸面抬头的「No」= 领料单号、「日期」= 单据日期
        Map<String, String> head = new LinkedHashMap<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        if (d != null) {
            m.put("领料单号", d.outNo());
            m.put("状态", d.state());
            m.put("领料类型", kind);
            m.put("打印日期", java.time.LocalDate.now().toString());
            // 明细与页面同源(未完成读 wo_pick_line,已完成读生产领料单)
            for (Map<String, Object> it : linesOf(d.outNo(), "pick")) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("材料名称", str(it.get("名称")));
                row.put("规格", str(it.get("规格")));
                row.put("单位", str(it.get("单位")));
                row.put("请领数量", num(it.get("BOM用量")));
                row.put("实发数量", num(it.get("数量")));
                row.put("备注", str(it.get("批号")));
                rows.add(row);
            }
        }
        m.put("明细", rows);
        return m;
    }

    private Map<String, Object> printPayload(String woNo, int line, String productName, String spec) {
        return printPayload(woNo, line, productName, spec, null);
    }

    /**
     * 该物料的默认出库仓库 = **有库存、且库存最多的那个仓**。
     *
     * <p>为什么必须预填:生产领料单审核过账走 {@code StockLedgerService.apply},它按
     * (物料, 仓库, 批号) 写 {@code kucun};仓库为空会抛
     * 「仓库档案不存在:[null],请先在基础档案-仓库中建立」—— 生单能成、**提交才炸**,
     * 现场看到的症状是"料都领完了却提交不了"(2026-10-30 实测踩到)。
     *
     * <p>排序口径:
     * <ol>
     *   <li>只取 {@code 现存量 > 0} 的仓(没货的仓不该被预填);</li>
     *   <li>**不良品仓排最后**(编码/名称含「不良」「废」)——不良品不是可领用料;</li>
     *   <li>其余按库存量倒序,库存最多的优先(现场最常见的主料仓)。</li>
     * </ol>
     *
     * @return {仓库名, 仓库编码};该物料完全没有库存时返回 {"", ""}(不猜仓,让现场自己选)
     */
    private String[] defaultWarehouseOf(String invCode) {
        if (invCode == null || invCode.isBlank()) return new String[]{"", ""};
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT ISNULL(仓库,N'') AS 仓库, ISNULL(仓库编码,N'') AS 仓库编码, ISNULL(现存量,0) AS 现存量"
                        + " FROM dbo.v_stock_pick WHERE 存货编码 = ? AND 现存量 > 0", invCode.trim());
        String bestName = "", bestCode = "";
        double bestQty = -1;
        int bestRank = Integer.MAX_VALUE;
        for (Map<String, Object> r : rows) {
            String name = str(r.get("仓库"));
            if (name.isEmpty()) continue;
            int rank = (name.contains("不良") || name.contains("废")) ? 1 : 0;
            double qty = num(r.get("现存量"));
            // 先比"是不是不良品仓",再比库存量
            if (rank < bestRank || (rank == bestRank && qty > bestQty)) {
                bestRank = rank;
                bestQty = qty;
                bestName = name;
                bestCode = str(r.get("仓库编码"));
            }
        }
        return new String[]{bestName, bestCode};
    }

    // ── 小工具 ──

    /** 空值转占位串(拼备注时用,避免出现 "产品 null") */
    private static String nz(String s) {
        return s == null || s.isBlank() ? "—" : s.trim();
    }

    /** 数量展示:整数不带小数点,小数最多 4 位(与 decimal(18,4) 同口径) */
    private static String fmtQty(double v) {
        double r = round4(v);
        return r == Math.rint(r) ? String.valueOf((long) r) : String.valueOf(r);
    }

    /**
     * callButton 的单据载荷:单号键必须是「编号」。
     *
     * <p>{@code ButtonService.requireNo} 只读 {@code formData.get("编号")},而保存返回的也是
     * {@code {编号, 单据状态}} —— 两处键名一致。写「单据编号」会报"缺少表单编号"(实测)。
     *
     * <p>⚠ 当前**没有调用点**:2026-11-18 起手机端提交退料不再自动审核(生成的单保持草稿,
     * 由仓管在面板上审)。保留它是因为将来若要恢复"提交即审核",单号必须按这个键传。
     */
    @SuppressWarnings("unused")
    private static Map<String, Object> docNoForm(String no) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("编号", no);
        return f;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static int toInt(Object o) {
        if (o == null) return 0;
        try { return (int) Double.parseDouble(String.valueOf(o).trim()); } catch (RuntimeException e) { return 0; }
    }

    private static long toLong(Object o) {
        if (o == null) return 0;
        try { return (long) Double.parseDouble(String.valueOf(o).trim()); } catch (RuntimeException e) { return 0; }
    }

    private static double num(Object o) {
        if (o == null) return 0;
        try { return round4(Double.parseDouble(String.valueOf(o).trim())); } catch (RuntimeException e) { return 0; }
    }

    private static double round4(double v) {
        return Math.round(v * 10000d) / 10000d;
    }

    private String currentUserName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null && !auth.getName().isBlank() ? auth.getName() : "system";
    }
}


