<template>
  <div>
    <el-form :model="listQuery" class="searchInfo" :inline="true" ref="listQuery">
      <el-form-item label="生产订单编号" prop="prodOrderNo" style="width: 250px;">
        <el-select placeholder="请选择" v-model="listQuery.prodOrderNo" filterable clearable>
          <el-option
            v-for="item in prodOrderNoOptions"
            :key="item"
            :label="item"
            :value="item">
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="程序号" prop="programNumber" style="width: 224px;">
        <el-select placeholder="请选择" v-model="listQuery.programNumber" filterable clearable>
          <el-option
            v-for="item in programNumberOptions"
            :key="item"
            :label="item"
            :value="item">
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="料号" prop="bomCode" style="width: 170px;">
        <el-select placeholder="请选择" v-model="listQuery.bomCode" filterable clearable>
          <el-option
            v-for="item in bomCodeOptions"
            :key="item"
            :label="item"
            :value="item">
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="品名" prop="productName" style="width: 170px;">
        <el-select placeholder="请选择" v-model="listQuery.productName" filterable clearable>
          <el-option
            v-for="item in productNameOptions"
            :key="item"
            :label="item"
            :value="item">
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="机型" prop="model" style="width: 180px;">
        <el-select placeholder="请选择" v-model="listQuery.model" filterable clearable>
          <el-option
            v-for="item in modelOptions"
            :key="item"
            :label="item"
            :value="item">
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="getTaskList">查询</el-button>
      </el-form-item>
    </el-form>
    <el-table
      :data="tableData"
      style="width: 100%"
      v-loading="listLoading"
      row-key="id"
      stripe
      border
      fit
      highlight-current-row
      :expand-row-keys="expands"
      :height="tableHeight"
      @row-click="expandChange"
      @expand-change="expandChange"
    >
      <el-table-column type="expand">
        <template #default="{ row }">
          <!-- v-if="row.taskProcessStepStatus =='END'" -->
          <div class="gwjBtn">
            <!-- <el-button type="primary" @click="pickEvent(row)">入库</el-button> -->
            <!-- <el-button type="primary" @click="completionShow(row)" v-if="row.isShowCompleteReport"
              >完工报告</el-button
            > -->
            <!-- v-if="row.taskProcessStepStatus =='END'" -->
            <!-- <el-button
              type="primary"
              v-if="row.taskStatus != 1"
              @click="callEvent(row)"
              >呼叫专检</el-button
            > -->
            <!-- <el-button type="primary" @click="productEvent(row)"
              >生产工单</el-button
            > -->
            <el-button
              type="primary"
              v-if="row.taskStatus != 1 && teamName != '切割组'"
              @click="replyDetailShow(row)"
              >退料</el-button
            >
          </div>
        </template>
      </el-table-column>
      <el-table-column
        prop="prodOrderNo"
        label="生产订单编号"
        min-width="90"
      ></el-table-column>
      <!--   width="60" width="80" width="110" width="80"-->
      <!-- <el-table-column prop="processStepName" label="工序"></el-table-column> -->
      <el-table-column prop="programNumber" label="程序号" width="100"></el-table-column>
      <el-table-column prop="bomCode" label="料号"></el-table-column>
      <!-- <el-table-column prop="alias" label="别名"></el-table-column> -->
      <el-table-column prop="productName" label="品名"></el-table-column>
      <el-table-column prop="model" label="机型"></el-table-column>
      <el-table-column prop="deviceId" label="设备/班组"></el-table-column>
      <el-table-column
        prop="planNum"
        label="计划数量"
        width="80"
      ></el-table-column>
      <el-table-column prop="sumSubmittedNum" label="合格数量" width="80"></el-table-column>
      <el-table-column
        prop="numscarpNum"
        label="报废数量"
        width="80"
      ><template #default="{ row }">{{ row?.numscarpNum ?? 0 }}</template></el-table-column>
    </el-table>
    <div class="addBtn" ref="page">
      <el-pagination
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        :current-page="listQuery.pageNum"
        :page-sizes="[10, 20, 30, 40, 50]"
        :page-size="listQuery.pageRow"
        layout="total, sizes, prev, pager, next, jumper"
        :total="totalCount"
      ></el-pagination>
    </div>
    <div class="refreshBtn">
      <el-button
        type="primary"
        @click="getTaskList"
        >刷新</el-button
      >
    </div>
    <!-- 入库信息开始 -->
    <el-dialog
      v-model="procedure.showEdit"
      title="新增入库&保存"
      custom-class="tuiliao"
      top="7vh"
      width="80%"
      :loading="procedure.submitLoading"
      :before-close="materialClose"
      :close-on-click-modal="false"
    >
      <el-form
        ref="getForm"
        :model="procedure.formData"
        :rules="procedure.formRules"
        label-align="right"
        :label-width="procedure.formLabelWidth"
      >
        <el-row :gutter="10">
          <el-col :xs="24" :sm="12" :md="12" :lg="8" :xl="8">
            <el-form-item prop="prodOrderNo" label="生产订单编号">
              <el-input
                v-model="procedure.formData.prodOrderNo"
                placeholder="请输入订单编号"
                readonly
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="12" :lg="8" :xl="8">
            <el-form-item prop="bnoNo" label="销售单号">
              <el-input
                v-model="procedure.formData.bnoNo"
                placeholder="请输入订单编号"
                readonly
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="12" :lg="8" :xl="8">
            <el-form-item prop="processStepName" label="工序名称">
              <el-input
                v-model="procedure.formData.processStepName"
                readonly
              ></el-input>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <el-table
        stripe
        :data="procedure.formData.materialPlanItems"
        border
        fit
        highlight-current-row
        tooltip-effect="dark"
      >
        <el-table-column
          type="index"
          width="50"
          label="序号"
          fixed
        ></el-table-column>
        <el-table-column label="料号" prop="bomName"></el-table-column>
        <el-table-column
          label="计划领取数量"
          prop="useNum"
          width="120"
        ></el-table-column>
        <el-table-column
          label="已领取数量"
          prop="receivedNum"
          width="100"
        ></el-table-column>
        <el-table-column
          label="已退料数量"
          prop="retreatedNum"
          width="100"
        ></el-table-column>
        <!-- defaultPickNum:未领取数量 -->
        <el-table-column label="领取数量" prop="receiveNum" width="200">
          <template #default="scope">
            <el-input-number
              v-model="scope.row.receiveNum"
              :max="scope.row.receiveNum"
              :min="0"
              :precision="2"
              :step="0.1"
              placeholder="请输入领取数量"
            ></el-input-number> </template
        ></el-table-column>
        <el-table-column fixed="right" label="操作" width="100">
          <template #default="scope">
            <el-button type="danger" @click="materialDele(scope.$index)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="materialClose">取 消</el-button>
        <el-button type="primary" @click="addMaterialEvent" :disabled="procedure.submitLoading">确 定</el-button>
      </template>
    </el-dialog>
    <!-- 入库信息结束 -->
    <!-- 退料信息开始 -->
    <reply-detail
      :subItemId="reply.subItemId"
      :dialogShow="reply.detailDialog"
      @replyDetailClose="replyDetailClose"
    ></reply-detail>
    <!-- 退料信息结束 -->
    <!-- 呼叫专检开始 -->
    <el-dialog
      v-if="callData.showEdit"
      v-model="callData.showEdit"
      title="呼叫专检信息"
      custom-class="tuiliao"
      width="600px"
      top="7vh"
      :before-close="callClose"
      :close-on-click-modal="false"
    >
      <el-form
        ref="callForm"
        :model="callData.insertForm"
        :rules="callData.formRules"
        :label-width="callData.formLabelWidth"
        v-if="callData.showEdit"
      >
        <!-- <el-form-item prop="username" label="用户名">
          <el-input
            v-model.trim="callData.insertForm.username"
            style="width: 100%"
            placeholder="请输入用户名"
          ></el-input>
        </el-form-item>
        <el-form-item prop="password" label="密码">
          <el-input
            v-model.trim="callData.insertForm.password"
            style="width: 100%"
            show-password
            placeholder="请输入密码"
          ></el-input>
        </el-form-item> -->
        <el-form-item prop="cargoLocation" label="所在位置">
          <el-select
            v-model="callData.insertForm.cargoLocation"
            filterable
            :allow-create="true"
            :default-first-option="true"
            style="width: 100%"
            placeholder="请选择或输入所在位置"
          >
            <el-option
              v-for="item in callData.locationData"
              :key="item.id"
              :label="item.unitName"
              :value="item.unitName"
            >
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item prop="emergencyDegree" label="紧急程度">
          <el-select
            v-model="callData.insertForm.emergencyDegree"
            filterable
            :allow-create="true"
            :default-first-option="true"
            style="width: 100%"
            placeholder="请选择紧急程度"
          >
            <el-option
              v-for="item in callData.unitData"
              :key="item.id"
              :label="item.unitName"
              :value="item.unitCode"
            >
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item class="redText" label-width="50px">
          <p>质检要求：</p>
          <p
            v-for="item in callData.callTitle"
            :key="item"
            style="padding-left: 24px; margin: 0; white-space: pre-line"
          >
            {{ item.description }}
          </p>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="callClose">取 消</el-button>
          <el-button
            type="primary"
            @click="insertCall"
            :disabled="callData.submitLoading"
            >确 定</el-button
          >
        </span>
      </template>
    </el-dialog>
    <!-- 呼叫专检结束 -->
    <!-- 生产工单开始 -->
    <el-dialog
      v-model="produceData.showEdit"
      title="生产工单信息"
      width="500px"
      top="7vh"
      :before-close="produceClose"
      :close-on-click-modal="false"
    >
      <el-form
        ref="produceDataForm"
        :model="produceData.insertForm"
        :rules="produceData.formRules"
        :label-width="produceData.formLabelWidth"
      >
        <el-form-item prop="batchNum" label="制作数">
          <el-input-number
            :min="1"
            v-model="produceData.insertForm.batchNum"
            style="width: 100%"
            placeholder="请输入制作数"
          ></el-input-number>
        </el-form-item>
        <el-form-item prop="placementArea" label="置场信息">
          <el-input
            v-model.trim="produceData.insertForm.placementArea"
            style="width: 100%"
            placeholder="请输入置场信息"
          ></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="produceClose">取 消</el-button>
          <el-button
            type="primary"
            @click="procoduceCall"
            :disabled="produceData.submitLoading"
            >确 定</el-button
          >
        </span>
      </template>
    </el-dialog>
    <!-- 生产工单详情 -->
    <product-detail
      :subItemId="subItemId"
      :dialogShow="detailDialog"
      @detailClose="detailClose"
    ></product-detail>
    <!-- 生产工单结束 -->
    <!-- 完工报告弹框开始 -->
    <completion-report 
      :detailData="completionReportData"
      :dialogShow="completionReport"
      @completionClose="completionClose"
    ></completion-report>
    <!-- 完工报告弹框结束 -->
  </div>
</template>

<script>
import {
  queryCompleteTaskList, //分页查询任务
  addMaterialPlan, //添加入库操作
  addQiTaskOtherSpecCheck, //呼叫专检
  queryMaterialPlanItemPickingByPlanTask, //通过id查详情
  queryItemByCode, //查询位置信息
  printProductionWorkOrder, //生产工单打印
  querySpecialExaminationByBomCode, //通过料号查询专检信息
  getQueryList, //查询条件
} from "@/api/manage/task";
import { mapGetters } from "vuex";
import { ElMessageBox } from "element-plus";
import productDetail from "@/views/home/components/productDetail.vue";
import replyDetail from "@/views/home/components/replyDetail.vue";
import completionReport from "@/views/home/components/completionReportFinish.vue";
export default {
  computed: {
    ...mapGetters(["processInfo", "userInfo", "teamName", "productName"]),
  },
  components: {
    productDetail,
    replyDetail,
    completionReport
  },
  data() {
    var validatorPhone = function (rule, value, callback) {
      let regPone = null;
      let mobile = /^((13|14|15|17|18)[0-9]{1}\d{8})$/; // 最新16手机正则
      if (value !== null && value.charAt(0) !== "0") {
        regPone = mobile;
      }
      if (regPone === null) {
        return callback(new Error("请输入手机号"));
      } else if (!regPone.test(value)) {
        return callback(new Error("请输入正确的手机号格式"));
      } else {
        callback();
      }
    };
    return {
      queryTitle: "",
      totalCount: 0, //分页组件--数据总条数
      tableData: [],
      expands: [], // 要展开的行，数值的元素是row的key值
      listQuery: {
        pageNum: 1, //页码
        pageRow: 10, //每页条数
        processStepId: 0, //工序ID
        productDeptId: -1, //部门ID
        prodOrderNo: "", //生产订单编号
        bomCode: "", //料号
        productName: "", //品名
        model: "", //机型
        taskStatus: null, //任务状态
        deviceId: "", //设备/班组
      },
      listLoading: false, //加载提示
      screenHeight: document.body.clientHeight, // 这里是给到了一个默认值 （这个很重要）
      tableHeight: "0px",
      // 退料绑定的数据---开始
      reply: {
        subItemId: 0, //查看详情id
        detailDialog: false, //查看详情显示隐藏
      },
      // 退料绑定的数据---结束
      // 入库绑定的数据---开始
      procedure: {
        submitLoading: false,
        showEdit: false,
        formLabelWidth: "120px",
        queryData: {
          planDate: "",
          prodOrderNo: "",
          processStepId: "",
        },
        formData: {
          prodOrderNo: "",
          bnoNo: "",
          processStepName: "",
          maintainPlanId: "",
          materialPlanItems: [],
          processStepId: "",
        },
        formRules: {},
      },
      // 入库绑定的数据---结束
      // 呼叫专检绑定的数据---开始
      callData: {
        callTitle: [],
        submitLoading: false,
        showEdit: false,
        locationData: [],
        unitData: [],
        formLabelWidth: "120px",
        userInfo: {},
        insertForm: {
          password: "",
          username: "",
          batchNumber: "",
          callerPhone: "",
          callerId: "",
          cargoLocation: "",
          remark: "",
          id: "",
          type: 2,
          materialName: "",
          materialCode: "",
        },
        formRules: {
          cargoLocation: [
            { required: true, message: "请输入位置", trigger: "blur" },
          ],
          // username: [
          //   { required: true, message: "请输入用户名", trigger: "blur" },
          // ],
          // password: [
          //   { required: true, message: "请输入密码", trigger: "blur" },
          // ],
          emergencyDegree: [
            { required: true, message: "请选择紧急程度", trigger: "blur" },
          ],
          callerPhone: [
            {
              required: true,
              validator: validatorPhone,
              trigger: ["blur", "change"],
            },
          ],
        },
      },
      // 呼叫专检绑定的数据---结束
      // 生产工单绑定的数据---开始
      subItemId: 0, //查看详情id
      detailDialog: false, //查看详情显示隐藏
      product: {
        submitLoading: false,
        showEdit: false,
        formLabelWidth: "100px",
        queryData: {
          planDate: "",
          prodOrderNo: "",
          processStepId: "",
        },
        formData: {
          prodOrderNo: "",
          bnoNo: "",
          processStepName: "",
          maintainPlanId: "",
          materialPlanItems: [],
          processStepId: "",
        },
        formRules: {
          processStepId: [
            { required: true, message: "请选择工序", trigger: "blur" },
          ],
          planStatus: [
            { required: true, message: "请选择下发状态", trigger: "blur" },
          ],
          cashingDate: [
            { required: true, message: "请选择预计领取时间", trigger: "blur" },
          ],
        },
      },
      // 生产工单绑定的数据---结束
      //生产工单打印数据  --开始
      produceData: {
        shengId: 0,
        userData: [],
        submitLoading: false,
        showEdit: false,
        locationData: [],
        formLabelWidth: "120px",
        userInfo: {},
        insertForm: {
          batchNum: 1,
          bnoNo: 0,
          placementArea: "",
          processStepId: 0,
          prodOrderNo: 0,
          workerName: "",
          workerId: 0,
          taskId: 0,
        },
        formRules: {
          batchNum: [
            { required: true, message: "请输入制作数", trigger: "blur" },
          ],
          placementArea: [
            { required: true, message: "请输入置场信息", trigger: "blur" },
          ],
        },
      },
      //完工报告绑定的数据
      completionReport: false, //查看详情显示隐藏
      tableHeightAdd: 0,
      bnoNoOptions:[],
      prodOrderNoOptions:[],
      programNumberOptions:[],
      bomCodeOptions:[],
      productNameOptions:[],
      modelOptions:[],
    };
  },
  mounted() {
    this.listQuery.productName = this.productName;
    this.listQuery.processStepId = this.processInfo.id;
    this.listQuery.deviceId = this.teamName;
    this.getTaskList();
    this.queryUnit("commonLocation");
    this.queryUnit("emergencyDegree");
    this.queryUnit("number");
    this.getQueryList();
  },
  methods: {
    async getQueryList(){
      this.bnoNoOptions = await getQueryList('bno_no', this.listQuery.processStepId, this.listQuery.deviceId, this.listQuery.productName, 2);
      this.prodOrderNoOptions = await getQueryList('prod_order_no', this.listQuery.processStepId, this.listQuery.deviceId, this.listQuery.productName, 2);
      this.programNumberOptions = await getQueryList('program_number', this.listQuery.processStepId, this.listQuery.deviceId, this.listQuery.productName, 2);
      this.bomCodeOptions = await getQueryList('bom_code', this.listQuery.processStepId, this.listQuery.deviceId, this.listQuery.productName, 2);
      this.productNameOptions = await getQueryList('product_name', this.listQuery.processStepId, this.listQuery.deviceId, this.listQuery.productName, 2);
      this.modelOptions = await getQueryList('model', this.listQuery.processStepId, this.listQuery.deviceId, this.listQuery.productName, 2);
    },
    handleSizeChange(val) {
      //改变每页数量
      this.listQuery.pageRow = val;
      this.handleFilter(1);
    },
    handleCurrentChange(val) {
      //改变页码
      this.handleFilter(val);
    },
    handleFilter(val) {
      //查询事件
      this.listQuery.pageNum = val;
      this.getTaskList();
    },
    // 切换时显示不同的按钮
    expandChange(row) {
      this.expands = [row.id];
    },
    //查询列表
    getTaskList() {
      this.listLoading = true;
      queryCompleteTaskList(this.listQuery)
        .then((response) => {
          if (response.code === 0) {
            this.listLoading = false;
            this.tableData = response.data.list;
            this.totalCount = response.data.total;
            this.expands = [this.tableData[0] ? this.tableData[0].id : 0];
            if(window.innerWidth < 900){
              this.tableHeightAdd = 50;
            } else {
              this.tableHeightAdd = 0;
            }
            this.tableHeight =
              window.innerHeight -
              ((this.$refs.listQuery
                ? this.$refs.listQuery.$el.offsetHeight
                : 0) + this.tableHeightAdd +
                (this.$refs.page ? this.$refs.page.offsetHeight : 0) +
                120) +
              "px";
          } else {
            this.$utils.alertMessage(response.message, "error");
          }
        })
        .catch((error) => {
          this.$utils.alertMessage("操作失败", "error");
          this.listLoading = false;
        });
    },
    // 查询所有库位
    queryStorage() {
      queryStorageAll().then((res) => {
        if (res.code === 0) {
          this.storageData = res.data;
        }
      });
    },
    //
    // 入库操作--------------------------开始
    //
    // 点击入库按钮
    pickEvent(row) {
      this.procedure.showEdit = true;
      Object.keys(this.procedure.queryData).forEach((key) => {
        this.procedure.queryData[key] = row[key];
      });
      queryMaterialPlanItemPickingByPlanTask(this.procedure.queryData).then(
        (res) => {
          if (res.code === 0) {
            this.procedure.submitLoading = false;
            this.procedure.formData = res.data;
            this.procedure.formData.materialPlanItems.map((item, index) => {
              item.receiveNum = item.defaultPickNum;
            });
            this.procedure.formData.maintainPlanId = res.data.id;
          } else {
            this.$utils.alertMessage(res.message, "error");
          }
        }
      );
    },
    // 入库删除子项
    materialDele(i) {
      this.procedure.formData.materialPlanItems.splice(i, 1);
    },
    // 添加入库
    addMaterialEvent() {
      var bool = false;
      var num = 0;
      if (this.procedure.formData.materialPlanItems.length > 0) {
        for (
          var i = 0;
          i < this.procedure.formData.materialPlanItems.length;
          i++
        ) {
          let data = this.procedure.formData.materialPlanItems[i];
          Object.keys(data).forEach((key) => {
            if (key == "receiveNum") {
              data[key] == 0 ? (bool = true) : null;
              num += data[key];
            }
          });
        }
        if (bool) {
          ElMessageBox.alert("数量不能为空", "提示");
          return;
        }
        if (num == 0) {
          ElMessageBox.alert("总数不能为0", "提示");
          return;
        }
      } else {
        ElMessageBox.alert("请填写详情信息", "提示");
        return;
      }
      this.$refs["getForm"].validate((valid) => {
        if (valid) {
          this.procedure.submitLoading = true;
          // 新增
          addMaterialPlan(this.procedure.formData)
            .then((res) => {
              if (res.code === 0) {
                this.materialClose();
                this.$utils.alertMessage("新增成功", "success");
              } else {
                this.$utils.alertMessage(res.message, "error");
              }
              this.procedure.submitLoading = false;
            })
            .catch(() => {
              this.$utils.alertMessage("操作失败", "error");
              this.procedure.submitLoading = false;
            });
        }
      });
    },
    // 取消入库操作
    materialClose() {
      this.$nextTick(() => {
        this.$refs.getForm.resetFields();
        this.procedure = this.$options.data().procedure;
        this.procedure.submitLoading = false;
        this.procedure.showEdit = false;
      });
    },
    //
    // 入库操作--------------------------结束
    //
    //
    // 退料操作--------------------------开始
    //
    //退料详情显示
    replyDetailShow(row) {
      this.reply.subItemId = row.id;
      this.reply.detailDialog = true;
    },
    // 退料详情取消
    replyDetailClose() {
      this.$nextTick(() => {
        this.reply.detailDialog = false;
        this.reply.subItemId = 0;
      });
    },
    //
    // 退料操作--------------------------结束
    //
    //
    //
    // 呼叫专检--------------------------开始
    //
    // 获取单位
    queryUnit(code) {
      queryItemByCode(code).then((res) => {
        if (code == "commonLocation") {
          this.callData.locationData = res;
        } else if (code == "数量") {
          this.overData.numberData = res;
        } else {
          this.callData.unitData = res;
        }
      });
    },
    //质检要求格式
    preText(pretext) {
      return pretext
        .replace(/\r\n/g, "<br/>")
        .replace(/\n/g, "<br/>")
        .replace(/\s/g, "&nbsp;");
    },
    // 点击呼叫专检按钮
    callEvent(row) {
      this.callData.insertForm.id = row.id;
      this.callData.insertForm.callerId = this.userInfo.id;
      this.callData.showEdit = true;
      this.queryUnit("commonLocation");
      this.queryUnit("emergencyDegree");
      querySpecialExaminationByBomCode(row.bomCode).then((res) => {
        if (res.code == 0) {
          this.callData.callTitle = res.data;
        } else {
          this.$utils.alertMessage(res.message, "error");
        }
      });
    },
    // 添加呼叫专检
    insertCall() {
      this.$refs["callForm"].validate((valid) => {
        if (valid) {
          this.callData.submitLoading = true;
          addQiTaskOtherSpecCheck(this.callData.insertForm)
            .then((res) => {
              if (res.code == 0) {
                this.$utils.alertMessage("呼叫成功", "success");
                this.callClose();
              } else {
                this.$utils.alertMessage(res.message, "error");
              }
              this.callData.submitLoading = false;
            })
            .catch((err) => {
              this.$utils.alertMessage("呼叫失败", "error");
              this.callData.submitLoading = false;
            });
        }
      });
    },
    // 呼叫专检取消
    callClose() {
      this.$nextTick(() => {
        this.$refs.callForm.resetFields(); // this.$refs.form.resetFields();
        this.callData = this.$options.data().callData;
        this.callData.showEdit = false;
        this.callData.submitLoading = false;
      });
    },
    //
    // 呼叫专检--------------------------结束
    //
    //
    // 生产工单--------------------------开始
    //
    productEvent(row) {
      this.produceData.showEdit = true;
      this.produceData.insertForm.taskId = row.id;
    },
    //添加生产工单
    procoduceCall() {
      this.$refs["produceDataForm"].validate((valid) => {
        if (valid) {
          this.produceData.submitLoading = true;
          printProductionWorkOrder(this.produceData.insertForm)
            .then((res) => {
              if (res.code == 0) {
                this.$utils.alertMessage("生产成功", "success");
                this.detailShow(res.data.id);
                this.produceClose();
              } else {
                this.$utils.alertMessage(res.message, "error");
              }
              this.produceData.submitLoading = false;
            })
            .catch((err) => {
              this.$utils.alertMessage("生产失败", "error");
              this.produceData.submitLoading = false;
            });
        }
      });
    },
    // 添加生产工单取消
    produceClose() {
      this.$nextTick(() => {
        this.$refs.produceDataForm.resetFields();
        this.produceData.showEdit = false;
        this.produceData.submitLoading = false;
      });
    },

    // 生产工单取消
    productClose() {
      this.$nextTick(() => {
        this.$refs.productForm.resetFields();
        this.product.showEdit = false;
        this.product = this.$options.data().product;
      });
    },
    //生产工单详情显示
    detailShow(id) {
      this.subItemId = id;
      this.detailDialog = true;
    },
    // 生产工单详情取消
    detailClose() {
      this.$nextTick(() => {
        this.detailDialog = false;
        this.subItemId = 0;
      });
    },
    //
    // 生产工单--------------------------结束
    //
    //
    // 完工报告--------------------------开始
    //
    // 完工报告按钮
    completionShow(row) {
      this.completionReportData = row;
      this.completionReport = true;
    },
    // 完工报告取消
    completionClose() {
      this.completionReport = false;
      this.completionReportData = this.$options.data().completionReportData;
    },
    //
    // 完工报告--------------------------结束
    //
  },
};
</script>
<style scoped>
@import url("@/styles/dialog.css");
</style>
<style lang="scss" scoped>
.el-pagination .el-pagination__total {
  color: white;
}
.el-pagination__jump {
  color: white;
}
.el-input-number,
.el-select {
  width: 100% !important;
}
.el-input-number,
.el-select {
  width: 100% !important;
}
.search-item {
  float: left;
}
.button-item {
  float: right;
}
@media screen and (max-width: 950px) {
  .button-item {
    float: left;
  }
}
.table {
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;
  border: 1px solid #000;
}
.table tr,
.table th,
.table td {
  border: 1px solid #000;
  font-size: 14px;
  height: 22px;
  width: 1%;
}
.refreshBtn {
  position: fixed;
  top: 60px;
  right: 30px;
  z-index: 1111;
}
.el-table .el-form-item {
  margin-bottom: 0;
}
.gwjBtn {
  display: flex;
  // justify-content: center;
  > button {
    flex: 1;
    max-width: 120px;
    margin: 0 10px;
    height: 40px;
    font-size: 20px;
  }
}
:deep(.redText .el-form-item__label) {
  color: red;
}
div.redText p {
  color: red;
  height: 24px;
  font-size: 12px;
  line-height: 24px;
}
</style>