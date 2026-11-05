package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.FormNoService;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.WoPickDocService;
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
 *  全部领料完成后才可以提交转成材料出库单,并且将已完成的单据,在生产领料的界面放到下面的已完成区
 *  (并且已完成和未完成都可以展开和收缩)。
 *  生产退料与领料一致,只是退料默认数量为0。可以不进行退料操作,退料生成的应该是其他入库单,并且写好备注。」

 * <h3>BOM 来源(2026-10-30 二次确认)</h3>
 * 用户二次确认:「就是组装BOM表(RD_ASM_BOM),我去把数据录进去」。
 * 故取数口径 = 按工单行的**产品编号**取 {@code rd_asm_bom_head} 里最新一张未作废的表头,
 * 再取其 {@code rd_asm_bom_detail} 的 {@code 物料编号 / 物料名 / 物料规格 / 用量}。
 * （注:该表结构与面板都在册且有数据录入界面,只是当前 0 行 —— 用户去录。）
 *
 * <h3>为什么物料来源不能是「成型工艺清单」</h3>
 * {@code rd_mold_proc_detail} 的列是「物料种类/实际添加比例/单支物料含量/设计添加量」——
 * 那是**配比**不是可直接领用的数量,且当前 0 行;换算口径需要额外约定。
 * 组装BOM表直接就是「物料编号 + 用量」,与本页语义一一对应。
 *
 * <h3>本控制器不做的事</h3>
 * <ul>
 *   <li>**不直接写库存**:领料提交走 {@code ButtonService.callButton(MATERIAL_OUT, "审核")},
 *       由 {@link com.yinjia.mes.service.StockLedgerService} 按既有链路过账 —— 与所有别的单据同一条路,
 *       不另写 SQL 记账(2026-10-16 的教训:自己算一遍必然和看板分叉)。</li>
 *   <li>**不做批次追溯口径的改动**:出库批次仍按既有「先进先出拆批」逻辑,可用量仍按
 *       物料+仓库 判断(验收期权宜口径,见 {@code StockLedgerService.LOT_STRICT} 与
 *       「上线前必验-库存批次追溯」文档)。</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/px/mobilePick")
public class MobilePickController {

    private static final Logger log = LoggerFactory.getLogger(MobilePickController.class);

    /** 领料单面板(材料出库单,业务类型「生产领料」) */
    private static final String PANEL_OUT = "MATERIAL_OUT";
    /** 退料单面板(其他入库单,业务类型「生产退料」;用户口径「退料生成的应该是其他入库单」) */
    private static final String PANEL_BACK = "OTHER_IN";
    /** 本页自身的页面级虚拟面板码(权限词:create / pick / submit / print) */
    private static final String PANEL_SELF = PagePanelRegistry.MOBILE_PICK;
    /** 领料业务类型(数据键,不翻译) */
    private static final String BIZ_PICK = "生产领料";
    /** 退料业务类型:金蝶「其他入库单」里这一类的业务类型写「生产退料」(数据键,不翻译) */
    private static final String BIZ_BACK = "生产退料";

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
    /** 单号池:生单时**只取号**(LL-…),不建材料出库单 —— 那张单要等提交才生成 */
    private final FormNoService formNo;

    public MobilePickController(JdbcTemplate jdbc, WoPickDocService docs,
                                ButtonService buttons, PanelPermissionService perm,
                                FormNoService formNo) {
        this.jdbc = jdbc;
        this.docs = docs;
        this.buttons = buttons;
        this.perm = perm;
        this.formNo = formNo;
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
                        + "   ON d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废'"
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
     * 所以这张草稿单挂着不会动库存;不做退料就整单作废、不产生其他入库单。
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

        // 已开过单就不重开 —— 用户第二次扫同一行时应当"进到那张单",而不是再开一对空单
        WoPickDocService.PickDoc exist = docs.findActive(lineWoNo, line);
        if (exist != null) {
            return existingResult(exist);
        }

        // 按产品编号取该产品的组装 BOM 表头 → 其明细行
        String productCode = str(wo.get("物料编码"));
        Map<String, Object> bomHead = latestAsmBom(productCode);
        if (bomHead == null) {
            throw new IllegalStateException("该工单的产品(" + (productCode.isEmpty() ? "未填产品编号" : productCode)
                    + ")在《组装物料清单》里还没有维护用料,无法生成领料单:"
                    + "请先到 数据建模 → 生产 → 组装物料清单 维护该产品的物料清单");
        }
        List<Map<String, Object>> bomLines = bomDetail(str(bomHead.get("单据编号")));
        if (bomLines.isEmpty()) {
            throw new IllegalStateException("《组装物料清单》" + str(bomHead.get("单据编号"))
                    + " 没有明细行(该产品没维护物料),无法生成领料单");
        }
        // 单位缺失时**在生单前**就给出点名提示(而不是让 ButtonService 抛"明细第 N 行计量单位不能为空")
        List<String> noUnit = new ArrayList<>();
        for (Map<String, Object> b : bomLines) {
            if (str(b.get("计量单位")).isEmpty()) noUnit.add(str(b.get("物料编号")));
        }
        if (!noUnit.isEmpty()) {
            throw new IllegalStateException("下列物料在存货档案里没有计量单位,无法生成领料单:"
                    + String.join("、", noUnit)
                    + ";请先到 基础资料 → 存货档案 补上单位(材料出库单的计量单位是必填)");
        }

        String user = currentUserName();
        // 仓库(2026-10-30 修正):工单行不带仓库,但材料出库单**审核过账时必须有仓库**
        // (StockLedgerService 按 (物料,仓库,批号) 写 kucun,仓库为空会抛
        //  「仓库档案不存在:[null],请先在基础档案-仓库中建立」—— 实测生单能成、提交才炸)。
        // ⇒ 生单时按**该物料的库存所在仓库**预填明细行仓库(优先恒亿仓/主料仓,其次库存最大的仓),
        //   现场扫物料时若换了仓库,前端会把实际仓库一起写回。
        String today = java.time.LocalDate.now().toString();
        String prodLine = str(wo.get("生产线"));

        // 工单需求数量 = 该工单行的**排产数量**(plang.pl_sl)。
        // 用户口径(2026-10-30):「对应的 bom 生成的领料单明细,应该是每条明细的
        //   bom 组成个数 × 工单需求数量」,且 BOM 的「用量」是**每 1 个成品的用量**。
        double woQty = num(wo.get("排产数量"));

        // ── 领料单草稿(材料出库单,业务类型「生产领料」)
        List<Map<String, Object>> outItems = new ArrayList<>();
        String wh = "";          // 单头仓库(全部明细同仓时才有意义,见下)
        String whCode = "";
        for (int i = 0; i < bomLines.size(); i++) {
            Map<String, Object> b = bomLines.get(i);
            String code = str(b.get("物料编号"));
            // 每行按**该物料有库存的那个仓**预填(库存最大的仓优先,恒亿仓/主料仓优先于不良品仓)
            String[] lineWh = defaultWarehouseOf(code);
            // 需求用量 = BOM 单件用量 × 工单数量(四位小数,与 decimal(18,4) 同口径)
            double unit = num(b.get("用量"));
            double need = round4(unit * woQty);
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
            // 备注留痕:**单件用量、工单数量、需求合计**都写清楚 —— 现场看到 2000 时能自己算出
            // 「2/支 × 1000 支 = 2000」。bomUsageOf 取的是「需求 N」里的 N(合计),不是单件用量。
            item.put("明细备注", "生产领料·组装工艺清单 " + str(bomHead.get("单据编号"))
                    + "(用量 " + fmtQty(unit) + " × 工单 " + fmtQty(woQty) + " = 需求 " + fmtQty(need) + ")");
            outItems.add(item);
            // 单头仓库:第一行有仓就记第一行的(全部同仓时才是"这单从哪个仓出")
            if (wh.isEmpty() && !lineWh[0].isEmpty()) { wh = lineWh[0]; whCode = lineWh[1]; }
        }
        // 单头仓库:全部明细同仓时才算"这单从哪个仓出"(多仓出库时单头留空,按明细行各自过账)
        // ⚠ 用 final 副本参与 lambda:wh 在循环里被赋值,lambda 不能捕获非 effectively-final 的变量
        final String whFinal = wh;

        // ── 🔴 2026-11-01 两阶段改造:生单**只取号 + 写领料明细**,不建材料出库单
        //
        // 用户口径:「通过『生成工单领料单』生成的应该是**生产领料**里面的明细,
        //   然后通过扫码领料**提交后才生成材料出库单**。审批是仓管登录平台审批的。」
        //
        // 改造前这里调 saveDoc 直接建了一张 bd_material_out 草稿 ⇒ 材料出库单面板里
        // 还没领料就有单,提交还会自动审核扣库存,绕过仓管审批。
        // 现在:号从 LL 号池**先预留**(保证提交时用同一个号),单据本体等提交才落库。
        String outNo = formNo.next(pickNoPrefix(), user);

        // ── 不再预生成退料单(2026-10-30 第三轮用户改口径)
        //
        // 用户口径:「退料直接在生产领料界面。可以点开已完成的生产领料数据再次进行扫码。
        //   这样就可以来退料了。然后退料的单据做一个退料的标志。」
        // ⇒ 退料是**领完之后的后续动作**:生单时只建领料单;
        //   现场真要退料时,点开这张**已完成**的领料单扫码退,退多少生多少
        //   (见 {@link #returnScan} / {@link #submitReturn})。
        //
        // 上一版按首轮口径预建「数量全 0 的退料草稿」已废弃 —— 那是空单:
        //   它躺在其他入库单列表里像待办,没人退料还得专门作废,纯噪声。
        //   历史遗留的空退料单由 migrate-wo-pick-return-20261030.sql 统一作废。

        // ── 台账(唯一约束在这里挡"连扫两下")
        long id;
        try {
            id = docs.insert(lineWoNo, line, productCode, str(wo.get("产品名称")),
                    outNo, null, bomLines.size(), user);
        } catch (RuntimeException e) {
            // 并发:另一个手机刚给同一工单行建了单。把已存在的还给调用方,不要留半截数据
            WoPickDocService.PickDoc raced = docs.findActive(lineWoNo, line);
            if (raced != null) {
                log.warn("手机扫码生单并发撞唯一约束:{}/{};已回落到既有台账 {}", lineWoNo, line, raced.id(), e);
                return existingResult(raced);
            }
            throw e;
        }

        // 领料明细落到 wo_pick_line(材料出库单要等提交才生成,见 submit)
        insertPickLines(id, outItems, woQty, user);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("领料单号", outNo);
        out.put("工单", wo);
        out.put("BOM单据编号", str(bomHead.get("单据编号")));
        out.put("物料项数", bomLines.size());
        out.put("状态", WoPickDocService.STATE_OPEN);
        out.put("重复", false);
        // 生单即自动打印工单二维码一次(用户口径「在生成生产领料单的时候自动打印一次」)。
        // 这里只把"要打什么"回给前端 —— 真正的出纸由前端打印通道或打印站点完成,
        // 服务端不持有打印机(服务端也可能在另一台机器上)。
        out.put("打印", wantPrint
                ? printPayload(lineWoNo, line, str(wo.get("产品名称")), str(wo.get("规格型号")), id)
                : null);
        return out;
    }

    /**
     * 领料单号前缀(取 MATERIAL_OUT 面板配置,如 LL)。
     *
     * <p>为什么查面板而不写死:前缀是 `yj_panel.prefix` 的配置项,改配置时单号要跟着变;
     * 写死 "LL" 会在客户改前缀后产生两套号。查不到就退回 LL(与默认配置一致)。
     */
    private String pickNoPrefix() {
        try {
            List<String> p = jdbc.queryForList(
                    "SELECT ISNULL(prefix,N'') FROM dbo.yj_panel WHERE panel_code = ?",
                    String.class, PANEL_OUT);
            if (!p.isEmpty() && !p.get(0).isBlank()) return p.get(0).trim();
        } catch (RuntimeException ignore) {
            // 查不到不影响主流程
        }
        return "LL";
    }

    /**
     * 把生单算出来的用料写进**领料明细**(wo_pick_line)。
     *
     * <p>每行:需求数量 = BOM单件用量 × 工单数量(用于扫码预填);
     * 实领数量 = 0(等现场扫码)。提交时据此生成材料出库单。
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
     */
    @GetMapping("/locate")
    public ApiResult<Map<String, Object>> locate(@RequestParam String woNo,
                                                 @RequestParam(required = false) Integer line) {
        perm.requirePanelView(PANEL_SELF);
        String no = str(woNo);
        if (no.isEmpty()) throw new IllegalArgumentException("请先扫描或输入工单号");

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
                out.put("found", true);
                out.put("id", ids.get(0));
                out.put("by", "领料单号");
                return ApiResult.ok(out);
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

        WoPickDocService.PickDoc hit = null;
        if (line != null && line > 0) {
            hit = docs.findActive(no, line);
        } else {
            // 没带行号 ⇒ 按工单号找**全部**有效单;只有唯一的才直接打开,多条让用户选
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT id FROM dbo.wo_pick_doc WHERE 工单号 = ? AND 状态 <> ? ORDER BY 工单行号",
                    no, WoPickDocService.STATE_VOID)) {
                if (hit == null) hit = docs.byId(((Number) r.get("id")).longValue());
                else { hit = null; break; }   // 多条 ⇒ 视为"未定位"
            }
            if (hit == null) {
                List<Map<String, Object>> many = jdbc.queryForList(
                        "SELECT id, 工单行号, 状态 FROM dbo.wo_pick_doc WHERE 工单号 = ? AND 状态 <> ? ORDER BY 工单行号",
                        no, WoPickDocService.STATE_VOID);
                out.put("found", false);
                out.put("candidates", many);
                out.put("hint", many.isEmpty() ? "no-doc" : "multi-line");
                return ApiResult.ok(out);
            }
        }
        if (hit == null) {
            out.put("found", false);
            out.put("candidates", List.of());
            out.put("hint", "no-doc");
            return ApiResult.ok(out);
        }
        out.put("found", true);
        out.put("id", hit.id());
        out.put("by", "工单号");
        return ApiResult.ok(out);
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
        out.put("状态", d.state());
        // 材料出库单是否已被仓管审批(2026-11-01:提交只建单不过账,审批才扣库存)。
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

        // 领料明细:每行补上**已退数量**(2026-10-30 第三轮),前端据此算"还能退多少"、
        // 并在已完成单上直接显示可退量。已退数量唯一真源 = wo_pick_return。
        List<Map<String, Object>> pickLines = linesOf(d.outNo(), "pick");
        for (Map<String, Object> it : pickLines) {
            it.put("已退数量", returnedQtyOf(d.outNo(), str(it.get("编码"))));
        }
        out.put("领料明细", pickLines);
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
            // 2026-10-30:已完成 = 已审核过账,之后只能退料(生成其他入库单),**不能再改领料数量**。
            // 之前这里只笼统报"已经提交,不能再改数量";现在把"该走哪条路"直接告诉调用方 ——
            // 用户报障「已完成的进去扫码应该是其他入库才对」,根因之一就是界面在完成态仍走领料分支。
            throw new IllegalStateException("这张单已经完成并过账,不能再改领料数量:"
                    + "如需退货请走「开始退料」(生成其他入库单)");
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
        // 已完成 = 已审核过账,之后只能退料(生成其他入库单),不能再改领料数量。
        // ⚠ 与 scanMaterial 里同一道闸门:两处都在,漏一处就能绕过(2026-10-30 改了一处后
        //   实测仍报旧文案才发现 —— 后端两个入口必须同口径)。
        if (WoPickDocService.STATE_DONE.equals(d.state())) {
            throw new IllegalStateException("这张单已经完成并过账,不能再改领料数量:"
                    + "如需退货请走「开始退料」(生成其他入库单)");
        }
        if (code.isEmpty()) throw new IllegalArgumentException("物料编码不能为空");
        if (qty < 0) throw new IllegalArgumentException("数量不能为负数");

        String no = "back".equals(side) ? d.backNo() : d.outNo();
        String panel = "back".equals(side) ? PANEL_BACK : PANEL_OUT;
        List<Map<String, Object>> items = linesOf(no, side);
        Map<String, Object> hit = null;
        for (Map<String, Object> it : items) if (code.equals(str(it.get("编码")))) { hit = it; break; }
        if (hit == null) throw new IllegalStateException("物料 " + code + " 不在本单的明细里");

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

        int done = 0;
        for (Map<String, Object> it : linesOf(d.outNo(), "pick")) if (num(it.get("数量")) > 0) done++;
        docs.updateProgress(id, done, items.size(), currentUserName());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("领料明细", linesOf(d.outNo(), "pick"));
        out.put("退料明细", linesOf(d.backNo(), "back"));
        int totalItems = linesOf(d.outNo(), "pick").size();
        int doneNow = 0;
        for (Map<String, Object> it : linesOf(d.outNo(), "pick")) if (num(it.get("数量")) > 0) doneNow++;
        out.put("物料项数", totalItems);
        out.put("已领项数", doneNow);
        // 「全部领料完成后才可以提交」的判据就这一个 —— 由服务端算,前端只管显示
        out.put("可以提交", totalItems > 0 && doneNow >= totalItems);
        return ApiResult.ok(out);
    }

    /**
     * 提交:全部领完 → 审核领料单 → 转成材料出库单(过账)。
     *
     * <p>用户口径:「全部领料完成后才可以提交转成材料出库单」。
     * 这是本页**唯一动库存**的动作 —— 走 {@code callButton(MATERIAL_OUT, "审核")},
     * 与在材料出库单面板里手点「审核」是完全同一条路(过账/流水/工单回写全部照旧)。
     */
    @PostMapping("/submit")
    public ApiResult<Map<String, Object>> submit(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "提交转材料出库单", "submit");
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
            if (num(it.get("数量")) <= 0) missing.add(str(it.get("编码")));
        }
        if (!missing.isEmpty()) {
            throw new IllegalStateException("还有 " + missing.size() + " 项物料没填领料数量,不能提交:"
                    + String.join("、", missing.subList(0, Math.min(8, missing.size())))
                    + (missing.size() > 8 ? " 等" : ""));
        }

        String user = currentUserName();

        // ── 🔴 2026-11-01 两阶段改造:提交时才**生成**材料出库单,而且**不审核**
        //
        // 用户口径:「通过扫码领料**提交后才生成材料出库单**。审批是仓管登录平台审批的。」
        //
        // 改造前这里直接 callButton(MATERIAL_OUT, "审核") —— 既建单又过账,
        // 库存立刻被扣、仓管的审批完全被绕过。
        // 现在:用生单时预留的号建一张**待审批**的材料出库单(数量=实领),状态停在草稿;
        // 仓管在「材料出库单」面板点「审核」才走 StockLedgerService 扣库存。
        createMaterialOutFromPick(d, items, user);

        // 退料不在这里做(2026-10-30 第三轮用户改口径):
        //   用户口径「可以点开已完成的生产领料数据再次进行扫码。这样就可以来退料了」——
        //   退料是**提交之后**的独立动作,走 {@link #returnScan} / {@link #submitReturn},
        //   不再有"生单时预建一张空退料单、提交时作废它"这一套。
        docs.markDone(id, user);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("已提交", true);
        out.put("领料单号", d.outNo());
        out.put("状态", WoPickDocService.STATE_DONE);
        out.put("说明", "已生成材料出库单 " + d.outNo() + ",等仓管在「材料出库单」里审批;"
                + "审批通过才扣库存。如需退料,点开这张单再次扫码即可(剩余可退 "
                + fmtQty(pickedQtyOf(d.outNo())) + ")");
        return ApiResult.ok(out);
    }

    /**
     * 用领料明细生成**待审批**的材料出库单(不审核、不过账)。
     *
     * <p>用户口径:「扫描领料提交后才生成材料出库单。审批是仓管登录平台审批的。」
     *
     * <p>为什么走 ButtonService 的「保存」而不是直接 INSERT:`bd_material_out`/`bl_material_out`
     * 是金蝶同步口径的表,字段多、有必填校验(计量单位、仓库档案…),直接插会漏项。
     * 保存出来的就是一张**草稿**,审核留给仓管 —— 这正是要的语义。
     *
     * <p>数量取**实领数量**(不是需求):需求只是预填参考,实领才是这次真出库的量。
     */
    private void createMaterialOutFromPick(WoPickDocService.PickDoc d,
                                           List<Map<String, Object>> items, String user) {
        String today = java.time.LocalDate.now().toString();
        List<Map<String, Object>> outItems = new ArrayList<>();
        String wh = "", whCode = "";
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> it = items.get(i);
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("行号", String.valueOf(i + 1));
            line.put("材料编码", str(it.get("编码")));
            line.put("材料名称", str(it.get("名称")));
            line.put("规格型号", str(it.get("规格")));
            line.put("计量单位", str(it.get("单位")));
            line.put("数量", num(it.get("数量")));
            line.put("仓库", str(it.get("仓库")));
            if (!str(it.get("仓库编码")).isEmpty()) line.put("仓库编码", str(it.get("仓库编码")));
            String lot = str(it.get("批号"));
            if (!lot.isEmpty()) line.put("批号", lot);
            line.put("明细备注", str(it.get("明细备注")));
            outItems.add(line);
            if (wh.isEmpty()) { wh = str(it.get("仓库")); whCode = str(it.get("仓库编码")); }
        }
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
        if (allSameWh) { form.put("仓库", wh); if (!whCode.isEmpty()) form.put("仓库编码", whCode); }
        form.put("备注", "手机扫码领料提交生成:工单 " + d.woNo() + " 第 " + d.woLine()
                + " 行;数量为现场扫码确认的实领量,待仓管审批");
        form.put("detail", Map.of("items", outItems));

        buttons.callButton(PANEL_OUT, "保存", form, null);
    }

    // ══════════════════════════ ④ 退料(已完成单上按需退) ══════════════════════════

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
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "扫码核销", "pick");
        requireLedger();
        long id = toLong(body.get("id"));
        String code = str(body.get("code"));
        if (code.isEmpty()) throw new IllegalArgumentException("请先扫描或输入物料编码");

        WoPickDocService.PickDoc d = requireReturnable(id);
        Map<String, Object> line = pickLineOf(d.outNo(), code);
        if (line == null) {
            throw new IllegalStateException("物料 " + code + " 不在这张领料单里:请核对是否扫错了料");
        }
        double picked = num(line.get("数量"));
        double returned = returnedQtyOf(d.outNo(), code);
        double canReturn = round4(Math.max(0, picked - returned));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编码", code);
        out.put("名称", str(line.get("名称")));
        out.put("规格", str(line.get("规格")));
        out.put("单位", str(line.get("单位")));
        out.put("仓库", str(line.get("仓库")));
        out.put("仓库编码", str(line.get("仓库编码")));
        out.put("批号", str(line.get("批号")));
        out.put("已领数量", picked);
        out.put("已退数量", returned);
        // 累计可退 —— 前端输入框的 max,后端提交时再校验一次
        out.put("可退数量", canReturn);
        out.put("可退", canReturn > 0);
        return ApiResult.ok(out);
    }

    /**
     * 提交退料:为本次退料生成一张**其他入库单**(业务类型「生产退料」+ 退料标志)并审核入账。
     *
     * <p>用户口径:「退料生成的应该是其他入库单,并且写好备注」+「退多少生多少」。
     * 一张退料单可以一次退多个料(前端把本次要退的几项一起提交),
     * 明细逐行落 {@code bl_other_in},台账逐行落 {@code wo_pick_return}。
     *
     * @param body {id:台账主键, items:[{code, qty}]}
     * @return {退料单号, 明细:[{code,qty}], 合计数量}
     */
    @PostMapping("/submitReturn")
    public ApiResult<Map<String, Object>> submitReturn(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL_SELF);
        perm.requireAnyPerm(PANEL_SELF, "扫码核销", "pick");
        requireLedger();
        long id = toLong(body.get("id"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = body.get("items") instanceof List<?> l
                ? (List<Map<String, Object>>) l : List.of();
        if (items.isEmpty()) throw new IllegalArgumentException("请先扫码并填写退料数量");

        WoPickDocService.PickDoc d = requireReturnable(id);
        String user = currentUserName();

        // ① 逐项校验 + 组装明细
        List<Map<String, Object>> lines = new ArrayList<>();
        double total = 0;
        for (Map<String, Object> it : items) {
            String code = str(it.get("code"));
            double qty = round4(num(it.get("qty")));
            if (code.isEmpty() || qty <= 0) continue;
            Map<String, Object> line = pickLineOf(d.outNo(), code);
            if (line == null) throw new IllegalStateException("物料 " + code + " 不在这张领料单里");
            double picked = num(line.get("数量"));
            double returned = returnedQtyOf(d.outNo(), code);
            double canReturn = round4(Math.max(0, picked - returned));
            if (qty > canReturn) {
                throw new IllegalStateException("物料 " + code + " 可退只剩 " + fmtQty(canReturn)
                        + "(已领 " + fmtQty(picked) + " − 已退 " + fmtQty(returned) + "),本次要退 " + fmtQty(qty));
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("编码", code);
            row.put("名称", str(line.get("名称")));
            row.put("规格", str(line.get("规格")));
            row.put("单位", str(line.get("单位")));
            row.put("仓库", str(line.get("仓库")));
            row.put("仓库编码", str(line.get("仓库编码")));
            row.put("批号", str(line.get("批号")));
            row.put("数量", qty);
            lines.add(row);
            total = round4(total + qty);
        }
        if (lines.isEmpty()) throw new IllegalArgumentException("退料数量必须大于 0");

        // ② 建其他入库单(业务类型「生产退料」+ 退料标志)
        String today = java.time.LocalDate.now().toString();
        List<Map<String, Object>> backItems = new ArrayList<>();
        for (int i = 0; i < lines.size(); i++) {
            Map<String, Object> l = lines.get(i);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("序号", String.valueOf(i + 1));
            item.put("存货编码", str(l.get("编码")));
            item.put("存货名称", str(l.get("名称")));
            item.put("规格型号", str(l.get("规格")));
            item.put("计量单位", str(l.get("单位")));
            if (!str(l.get("仓库")).isEmpty()) item.put("仓库", str(l.get("仓库")));
            if (!str(l.get("仓库编码")).isEmpty()) item.put("仓库编码", str(l.get("仓库编码")));
            if (!str(l.get("批号")).isEmpty()) item.put("批号", str(l.get("批号")));
            item.put("数量", num(l.get("数量")));
            item.put("明细备注", "生产退料:退自领料单 " + d.outNo() + "(工单 " + d.woNo() + " 第 " + d.woLine() + " 行)");
            backItems.add(item);
        }
        Map<String, Object> backForm = new LinkedHashMap<>();
        backForm.put("单据日期", today);
        backForm.put("单据编号", "");
        backForm.put("业务类型", BIZ_BACK);
        // 退料标志(迁移加的列):系统按它识别"这是一张退料单",不随业务类型下拉被人工改掉
        backForm.put("退料标志", BIZ_BACK);
        backForm.put("经手人", user);
        // 备注按用户口径「写好备注」
        backForm.put("备注", "【生产退料】退自领料单 " + d.outNo()
                + ";工单 " + d.woNo() + " 第 " + d.woLine() + " 行;产品 " + nz(d.productName())
                + ";本次退料 " + lines.size() + " 项,合计 " + fmtQty(total));
        backForm.put("detail", Map.of("items", backItems));

        String backNo = saveDoc(PANEL_BACK, backForm);

        // ③ 审核 → StockLedgerService 按其他入库(+)过账,库存加回来
        buttons.callButton(PANEL_BACK, "审核", docNoForm(backNo), null);

        // ④ 退料台账:一行 = 一次退料(这是"已退数量"的唯一真源)
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

        // ⑥ 回执:剩余可退
        List<Map<String, Object>> remain = new ArrayList<>();
        for (Map<String, Object> l : lines) {
            String code = str(l.get("编码"));
            Map<String, Object> line = pickLineOf(d.outNo(), code);
            double picked = line == null ? 0 : num(line.get("数量"));
            double returned = returnedQtyOf(d.outNo(), code);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("编码", code);
            m.put("已领数量", picked);
            m.put("已退数量", returned);
            m.put("可退数量", round4(Math.max(0, picked - returned)));
            remain.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("退料单号", backNo);
        out.put("明细", lines);
        out.put("合计数量", total);
        out.put("剩余", remain);
        out.put("说明", "已生成退料单 " + backNo + " 并审核入账(其他入库单,带退料标志)");
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
        // 🔴 2026-11-01:材料出库单**还没被仓管审批**时不能退料。
        //   退料要冲减库存;而库存是审核那一刻才扣的 —— 未审核就退,等于凭空把料退进仓库。
        //   这是服务端硬闸门,不靠界面挡。
        if (!isMaterialOutAudited(d.outNo())) {
            throw new IllegalStateException("材料出库单 " + d.outNo()
                    + " 还没审批,不能退料:请先让仓管在「材料出库单」里审核通过(审核才扣库存)");
        }
        return d;
    }

    /**
     * 材料出库单是否已被审核(仓管审批过)。
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
     * <p>唯一真源 = {@code wo_pick_return}(作废的退料不计)。**不查 bl_other_in** ——
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
     * 把实领数量写进**领料明细**(wo_pick_line),并顺带记批号/批次串。
     *
     * <p>只用于**未完成**的领料单 —— 这时还没有材料出库单,明细的唯一载体就是这张表。
     * 提交时 {@link #submit} 会据此生成正式的材料出库单。
     *
     * @param outNo      领料单号(wo_pick_doc.领料单号)
     * @param line       行号
     * @param qty        实领数量
     * @param note       批次串(可能为空)
     * @param batchesRaw 批次列表(取第一条批号写进「批号」列)
     * @param code       物料编码(兜底定位:行号对不上时按物料找)
     */
    @SuppressWarnings("unchecked")
    private void writeQtyToPickLine(String outNo, String line, double qty,
                                    String note, Object batchesRaw, String code) {
        // 先定位这一行(行号优先;老数据行号可能不规范,退回按物料编码)
        List<Map<String, Object>> hit = jdbc.queryForList(
                "SELECT TOP 1 x.id, ISNULL(x.明细备注,N'') AS 备注"
                        + " FROM dbo.wo_pick_line x JOIN dbo.wo_pick_doc d ON d.id = x.单头id"
                        + " WHERE d.领料单号 = ? AND ISNULL(x.asp_cancel,'N') <> 'Y'"
                        + "   AND (x.行号 = ? OR x.物料编码 = ?)"
                        + " ORDER BY CASE WHEN x.行号 = ? THEN 0 ELSE 1 END, x.id",
                outNo, line, code, line);
        if (hit.isEmpty()) return;
        long lineId = ((Number) hit.get(0).get("id")).longValue();
        String oldNote = str(hit.get(0).get("备注"));
        String merged = mergeNote(oldNote, note);

        // 批号:拆批后本行只记第一条(多批次已在明细备注里)
        String lot = "";
        if (batchesRaw instanceof List<?> list) {
            for (Object o : list) {
                if (!(o instanceof Map)) continue;
                String l = str(((Map<String, Object>) o).get("批号"));
                if (!l.isEmpty()) { lot = l; break; }
            }
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

    /** 已经开过单时的返回(重复扫同一工单行走这里,不再新建) */
    private Map<String, Object> existingResult(WoPickDocService.PickDoc d) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", d.id());
        out.put("领料单号", d.outNo());
        out.put("退料单号", d.backNo());
        out.put("状态", d.state());
        out.put("物料项数", d.itemCount());
        out.put("重复", true);      // 前端据此提示"该工单行已经开过单,已帮你打开"
        out.put("打印", null);      // 重复时不重复打印
        return out;
    }

    /**
     * 解析工单行。
     *
     * <p>行号优先(用户口径「我的工单二维码带有行号的,只生成那一行的就行」);
     * 没带行号时取该工单的第一行(与工序报工 context 接口同一退化口径)。
     */
    private Map<String, Object> resolveWoLine(String woNo, int line) {
        String sql = "SELECT TOP 1 p.pl_no AS 工单号, p.pl_xc AS 工单行号, ISNULL(p.dm,N'') AS 物料编码,"
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
        wo.put("仓库", "");   // plang 无仓库列:仓库由材料出库单明细的行仓库决定
        return wo;
    }

    /**
     * 取该产品**最新一张**《组装工艺清单》的表头(用于领料展开与追溯留痕)。
     * <p>🔴 2026-11-02 用户口径:「生成生产领料单的 bom,关联改为用数据建模的生产里面的组装物料清单」。
     * <ul>
     *   <li>数据源从 {@code rd_asm_proc_head/_detail}(研发管理 → 组装工艺清单 → 页签1「组装BOM表」)
     *       **迁到** {@code bs_asm_bom}(数据建模 → 生产 → 组装物料清单,面板 ASM_BOM,单表 doc 模式)。</li>
     *   <li>为什么换:两处各维护一份组装用料,现场在「组装物料清单」里改完,
     *       领料单还按「组装工艺清单」那一份走 ⇒ 领的料与工艺不一致;</li>
     *   <li>取数口径:同一产品可能有多版 BOM(单据编号形如 {@code T387_V0001}),
     *       **优先 默认BOM='是'**,否则取单据编号最大的一张(版本号含在编号里);</li>
     *   <li>只认 {@code 工序='组装'}:这张单表还承载成型/切炭等工序的用料,不过滤会串料。</li>
     * </ul>
     */
    private Map<String, Object> latestAsmBom(String productCode) {
        if (productCode == null || productCode.isBlank()) return null;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 单据编号, 产品编码 AS 产品编号, 产品名称,"
                        + " ISNULL(版本号,N'') AS 版本号, ISNULL(默认BOM,N'') AS 默认BOM"
                        + " FROM dbo.bs_asm_bom"
                        + " WHERE 产品编码 = ? AND 工序 = N'组装' AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + "   AND ISNULL(状态,N'') <> N'作废'"
                        + " ORDER BY CASE WHEN ISNULL(默认BOM,N'') = N'是' THEN 0 ELSE 1 END, 单据编号 DESC",
                productCode.trim());
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * 组装物料清单(ASM_BOM)里这张 BOM 的明细行(物料编号/物料名/物料规格/用量)。
     *
     * <p>🔴 数据源 = {@code bs_asm_bom}(2026-11-02 起;此前是 {@code rd_asm_proc_detail} 的
     * {@code 表区='物料清单'} 行)。这张表本来就是「一行一个子件」的单表结构,不需要表区过滤。
     *
     * <p>⚠ 用量取 {@code 标准用量}(导入时已按 用量分子/用量分母 折算成 4 位小数),
     * 不用分子分母再算一遍 —— 两边口径必须一致,否则领料数量与清单对不上。
     *
     * <p>⚠ 计量单位:清单里这一列允许为空(导入时先空、由存货档案回填) ⇒
     * 空时退回 {@code bs_inv.计量单位};两边都空时上层会点名报错(材料出库单该列必填)。
     */
    private List<Map<String, Object>> bomDetail(String bomNo) {
        List<Map<String, Object>> raw = jdbc.queryForList(
                "SELECT ISNULL(d.子件编码,N'') AS 物料编号, ISNULL(d.子件名称,N'') AS 物料名,"
                        + " ISNULL(d.子件规格,N'') AS 物料规格, ISNULL(d.标准用量,0) AS 用量,"
                        + " ISNULL(NULLIF(ISNULL(d.计量单位,N''),N''), ISNULL(i.计量单位,N'')) AS 计量单位,"
                        + " ISNULL(i.规格型号,N'') AS 档案规格"
                        + " FROM dbo.bs_asm_bom d"
                        + " LEFT JOIN dbo.bs_inv i ON i.存货编码 = d.子件编码 AND ISNULL(i.asp_cancel,'N') <> 'Y'"
                        + " WHERE d.单据编号 = ? AND ISNULL(d.asp_cancel,'N') <> 'Y'"
                        + " ORDER BY d.行序, d.id", bomNo);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : raw) {
            if (str(r.get("物料编号")).isEmpty()) continue;   // 没有物料编号的行不参与领料
            Map<String, Object> m = new LinkedHashMap<>(r);
            // BOM 上的规格优先(那是这一版工艺的写法),没有就用存货档案的规格
            String spec = str(r.get("物料规格"));
            if (spec.isEmpty()) m.put("物料规格", str(r.get("档案规格")));
            m.put("计量单位", str(r.get("计量单位")));
            out.add(m);
        }
        return out;
    }

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
     * @param side pick=领料 / back=退料(bl_other_in)
     *
     * <p>🔴 2026-11-01 改造:领料明细**按单据状态分两个数据源** ——
     * <ul>
     *   <li><b>未完成</b>(生单后、提交前):明细在 {@code wo_pick_line},
     *       此时**还没有材料出库单**(用户口径「提交后才生成材料出库单」);</li>
     *   <li><b>已完成</b>(提交后):明细就是 {@code bl_material_out}(材料出库单已生成),
     *       退料/查看都读它,历史数据也照旧。</li>
     * </ul>
     * 这样上层所有调用(扫码、写数量、提交、打印)都不用改,只换数据源。
     */
    private List<Map<String, Object>> linesOf(String no, String side) {
        if (no == null || no.isBlank()) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        if ("back".equals(side)) {
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT id, 序号, ISNULL(存货编码,N'') AS 编码, ISNULL(存货名称,N'') AS 名称,"
                            + " ISNULL(规格型号,N'') AS 规格, ISNULL(计量单位,N'') AS 单位,"
                            + " ISNULL(仓库,N'') AS 仓库, ISNULL(仓库编码,N'') AS 仓库编码,"
                            + " ISNULL(数量,0) AS 数量, ISNULL(批号,N'') AS 批号, ISNULL(明细备注,N'') AS 明细备注"
                            + " FROM dbo.bl_other_in WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                            + " ORDER BY 序号, id", no)) {
                out.add(normalizeLine(r, "序号", "存货编码"));
            }
        } else if (isDraftPick(no)) {
            // 未完成:读领料明细表(此时还没有材料出库单)
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
        } else {
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT id, 行号, ISNULL(材料编码,N'') AS 编码, ISNULL(材料名称,N'') AS 名称,"
                            + " ISNULL(规格型号,N'') AS 规格, ISNULL(计量单位,N'') AS 单位,"
                            + " ISNULL(仓库,N'') AS 仓库, ISNULL(仓库编码,N'') AS 仓库编码,"
                            + " ISNULL(数量,0) AS 数量, ISNULL(批号,N'') AS 批号, ISNULL(明细备注,N'') AS 明细备注"
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
     * <p>它是选择明细数据源的开关:未完成 ⇒ wo_pick_line(尚无材料出库单);
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
        // BOM 需求用量 —— 前端扫物料码时用它做**默认领用数量**。
        //
        // 🔴 2026-11-01:未完成的单已经改读 wo_pick_line,那里有独立的「需求数量」列,
        //   直接用它(比从备注解析可靠);已完成的历史单没有这一列,退回解析备注。
        Object needCol = r.get("需求数量");
        m.put("BOM用量", needCol != null ? num(needCol) : bomUsageOf(str(r.get("明细备注"))));
        m.put("codeCol", codeCol);
        return m;
    }

    /**
     * 从明细备注里取 BOM 需求用量。
     *
     * <p>为什么从备注解析而不是加列:领料单明细表 {@code bl_material_out} 是金蝶同步口径的表,
     * 加自有列会与 ERP 字段对账打架;而"需求多少"是**生单那一刻的快照**,写进备注正好留痕
     * (明细备注本来就允许自由文本,且现场在材料出库单里也看得到)。
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
     *   <li>扣减:同物料、同仓库、**状态为草稿**(即还没审核)的材料出库单明细数量合计;
     *       ⚠ 要排除**本单自己** —— 否则自己已填的数量会把自己挤掉,越领越少;</li>
     *   <li>不退到负数:最多减到 0(已填满的单会让可用量显示 0,不会显示负数)。</li>
     * </ul>
     *
     * <p>批次行仍按 (物料,仓库,批号) 给,{@code 现存量} 字段放的是**可用量**;
     * 批号级的占用量按"同批号优先抵扣,不够再顺延"分摊,保证各行可用量加起来等于总量。
     *
     * @param code    物料编码
     * @param wh      仓库(空 = 不限)
     * @param selfNo  本单编号(排除本单自己的占用量;null/空 = 不排除)
     */
    private List<Map<String, Object>> stockRows(String code, String wh, String selfNo) {
        String sql = "SELECT 存货编码, 存货名称, 规格型号, 计量单位, 仓库, 仓库编码, 批号, 现存量"
                + " FROM dbo.v_stock_pick WHERE 存货编码 = ?"
                + (wh == null || wh.isBlank() ? "" : " AND (仓库 = ? OR 仓库编码 = ?)")
                + " AND 现存量 > 0 ORDER BY 批号";
        List<Map<String, Object>> rows = (wh == null || wh.isBlank())
                ? jdbc.queryForList(sql, code)
                : jdbc.queryForList(sql, code, wh, wh);

        // 其他未审核草稿已占用的量(按 批号 分组;没有批号的行合并到空批号)
        Map<String, Double> occupied = new LinkedHashMap<>();
        try {
            String osql = "SELECT ISNULL(l.批号,N'') AS lot, SUM(ISNULL(l.数量,0)) AS qty"
                    + " FROM dbo.bl_material_out l"
                    + " JOIN dbo.bd_material_out h ON h.单据编号 = l.单据编号"
                    + " WHERE l.材料编码 = ? AND ISNULL(l.asp_cancel,'N') <> 'Y'"
                    + "   AND ISNULL(l.数量,0) > 0"
                    + "   AND ISNULL(h.单据编号, N'') <> ?"
                    // 未审核 = 还没在 yj_doc_status 里写审核人(shr)。已审核的已经在 kucun 里扣过了,不能再扣一次。
                    + "   AND NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status s"
                    + "                    WHERE s.panel_code = N'MATERIAL_OUT' AND s.doc_no = h.单据编号"
                    + "                      AND ISNULL(s.shr, N'') <> N'')"
                    + " GROUP BY ISNULL(l.批号,N'')";
            for (Map<String, Object> r : jdbc.queryForList(osql, code, selfNo == null ? "" : selfNo)) {
                occupied.put(str(r.get("lot")), num(r.get("qty")));
            }
        } catch (RuntimeException e) {
            // 占用查询失败不阻断:退化为实时结存(宁可显示宽一点,也不要让扫码直接报错)
            log.debug("可用量占用查询失败,退化为实时结存:{}", e.getMessage());
        }

        // 逐行抵扣:先扣同批号的占用,再按顺序扣空批号/其它批号的剩余占用
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String lot = str(r.get("批号"));
            double avail = num(r.get("现存量"));
            double occ = occupied.getOrDefault(lot, 0d);
            if (occ > 0) {
                double take = Math.min(occ, avail);
                avail = round4(avail - take);
                occupied.put(lot, round4(occ - take));
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
        //   (此时还没有材料出库单,不能写 bl_material_out —— 那张单要等提交才生成)。
        if (!"back".equals(side) && isDraftPick(no)) {
            writeQtyToPickLine(no, line, qty, note, batchesRaw, code);
            return;
        }

        String table = "back".equals(side) ? "bl_other_in" : "bl_material_out";
        String lineCol = "back".equals(side) ? "序号" : "行号";
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
        Map<String, Object> m = new LinkedHashMap<>();
        // 与 print-formats.woQrText 同口径:公司代码@工单号@(1000+行号);公司代码全库为 '0'
        m.put("二维码内容", "0@" + woNo + "@" + (1000 + Math.max(1, line)));
        m.put("工单号", woNo);
        m.put("工单行号", line);
        m.put("产品名称", productName);
        m.put("规格型号", spec);
        m.put("标题", "生产领料单");
        // 纸面抬头的「No」= 领料单号、「日期」= 单据日期
        Map<String, String> head = new LinkedHashMap<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        if (docId != null) {
            WoPickDocService.PickDoc d = docs.byId(docId);
            if (d != null) {
                m.put("领料单号", d.outNo());
                m.put("状态", d.state());
                m.put("打印日期", java.time.LocalDate.now().toString());
                // 明细与页面同源(未完成读 wo_pick_line,已完成读材料出库单)
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
     * <p>为什么必须预填:材料出库单审核过账走 {@code StockLedgerService.apply},它按
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
     */
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
