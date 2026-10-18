<!-- 弹框添加、升级、BOM绑定工艺路线 -->
<script lang="ts">
import { ref, reactive, watch, nextTick } from "vue";
import {
  addWorkmanship,
  updateWorkmanship,
  queryProcessRoute,
  getWorkmanshipAllByBomcode
} from "/@/api/basic/workmanship";
import { queryTeamAll } from "/@/api/basic/team";
import { ElForm } from "element-plus";
import { alertMessage, successMessage, errorMessage } from "/@/utils/message";
import { getProcessAll } from "/@/api/basic/workprocedure";
import { getQualityAll } from "/@/api/quality/qualitytemplate";
import chooseMaterial from "/@/views/basic/material/chooseMaterial.vue";
export default {
  name: "addProcessRoute",
  props: {
    dialogShow: {
      type: Boolean,
      default: false
    },
    detailId: {
      type: Number,
      default: 0
    },
    detailCode: {
      type: String,
      default: ""
    }
  },
  components: { chooseMaterial },
  setup(props, ctx) {
    // 选择订单弹窗绑定数据
    const workmanship = reactive({
      dialogShow: false, //操作显示隐藏
      submitLoading: false,
      processData: [] as any[],
      teamData: [] as any[],
      qualityData: [] as any[],
      detailId: 0,
      detailCode: "", //物料
      tableHeight: 0,
      formData: {
        id: -1,
        code: "",
        name: "",
        mdesc: "",
        figureNumber: "",
        modelNumber: "",
        processRouteItemList: [] as any[]
      },
      formRules: {
        code: [{ required: true, message: "请选择料号", trigger: "blur" }]
      }
    });

    watch(props, n => {
      workmanship.dialogShow = n.dialogShow;
      workmanship.detailId = n.detailId;
      workmanship.detailCode = n.detailCode;
      if (workmanship.dialogShow) {
        getProcess();
        getQuality();
        getTeam();
        // 工艺路线新增+升级
        workmanship.detailId && queryProcessById();
        // 物料绑定工艺路线
        workmanship.detailCode && queryProcessByCode();
        nextTick(() => {
          workmanship.tableHeight =
            document.getElementById("insertForm").clientHeight + 40;
        });
      }
    });
    // 通过ID查询详情
    const queryProcessById = () => {
      queryProcessRoute(workmanship.detailId)
        .then((res: any) => {
          if (res.code == 0) {
            workmanship.formData = res.data;
          }
        })
        .catch(() => {
          errorMessage("查询失败");
        });
    };
    // 通过Code查询详情
    const queryProcessByCode = () => {
      getWorkmanshipAllByBomcode(workmanship.detailCode)
        .then((res: any) => {
          if (res.code == 0) {
            workmanship.formData = res.data;
          }
        })
        .catch(() => {
          errorMessage("查询失败");
        });
    };
    const checkRoleNameUnique = () => {
      var selectData = [];
      Object.keys(workmanship.formData.processRouteItemList).forEach(key => {
        if (workmanship.formData.processRouteItemList[key].processId) {
          selectData.push(
            workmanship.formData.processRouteItemList[key].processId
          );
        }
      });
      if (new Set(selectData).size !== selectData.length) {
        alertMessage("当前工艺路线有重复的工序，请核对信息", "提示");
        return false;
      }
      return true;
    };
    const insertForm = ref<InstanceType<typeof ElForm>>();
    // 表单提交
    const submitEvent = () => {
      insertForm.value.validate(valid => {
        if (valid) {
          var bool = false;
          var bool1 = false;
          if (workmanship.formData.processRouteItemList.length > 0) {
            for (
              var i = 0;
              i < workmanship.formData.processRouteItemList.length;
              i++
            ) {
              let data = workmanship.formData.processRouteItemList[i];
              Object.keys(data).forEach(key => {
                if (
                  key == "processId" ||
                  key == "stepNo" ||
                  key == "teamName" ||
                  key == "isOutSource"
                ) {
                  data[key] === "" ? (bool = true) : null;
                }
                if (key == "stepNo") {
                  data[key] % 10 == 0 ? null : (bool1 = true);
                }
              });
            }
            if (bool) {
              alertMessage("请将数据填写完整", "提示");
              return;
            }
            if (bool1) {
              alertMessage("步骤号应大于0且为10的倍数", "提示");
              return;
            }
          } else {
            alertMessage("请填写详情信息", "提示");
            return;
          }
          if (!checkRoleNameUnique()) {
            return;
          }
          workmanship.submitLoading = true;
          if (workmanship.detailCode || workmanship.detailId) {
            // 修改
            updateWorkmanship(workmanship.formData)
              .then((res: any) => {
                if (res.code === 0) {
                  ctx.emit("searchEvent");
                  handleClose();
                  successMessage("保存成功");
                  workmanship.dialogShow = false;
                } else {
                  errorMessage(res.message);
                  workmanship.submitLoading = false;
                }
              })
              .catch(() => {
                errorMessage("操作失败");
                workmanship.submitLoading = false;
              });
          } else {
            // 新增
            addWorkmanship(workmanship.formData)
              .then((res: any) => {
                if (res.code === 0) {
                  ctx.emit("searchEvent");
                  successMessage("新增成功");
                  handleClose();
                  workmanship.dialogShow = false;
                } else {
                  errorMessage(res.message);
                }
                workmanship.submitLoading = false;
              })
              .catch(() => {
                errorMessage("操作失败");
                workmanship.submitLoading = false;
              });
          }
        }
      });
    };
    // 关闭弹窗事件
    const handleClose = () => {
      workmanship.formData = {
        id: -1,
        code: "",
        name: "",
        mdesc: "",
        figureNumber: "",
        modelNumber: "",
        processRouteItemList: [] as any[]
      };
      nextTick(() => {
        insertForm.value.resetFields();
        workmanship.submitLoading = false;
        workmanship.dialogShow = false;
      });
      ctx.emit("processDialogClose");
    };
    // 新增工序
    const addProcess = () => {
      var data = workmanship.formData.processRouteItemList;
      data.push({
        id: 0,
        isOutSource: 0,
        processId: "",
        qualityId: "",
        stepNo: (data[data.length - 1] ? data[data.length - 1].stepNo : 0) + 10,
        processTakeTime: 0,
        teamCode: "",
        teamName: ""
      });
    };
    // 删除工序
    const dele = i => {
      workmanship.formData.processRouteItemList.splice(i, 1);
    };
    const chooseOrderShow = () => {
      workmanship.formData = {
        id: -1,
        code: "",
        name: "",
        mdesc: "",
        figureNumber: "",
        modelNumber: "",
        processRouteItemList: [] as any[]
      };
      workmanship.dialogShow = true;
    };

    // 选择物料
    const chooseMaterialDialog = ref(false);
    const chooseMaterialShow = () => {
      chooseMaterialDialog.value = true;
    };
    const chooseMaterialClose = () => {
      chooseMaterialDialog.value = false;
    };
    // 弹窗选择物料之后改变时的事件
    const chooseTrue = (treeId, name, data) => {
      if (name) {
        workmanship.formData.name = data.name;
        workmanship.formData.code = data.code;
        workmanship.formData.figureNumber = data.figureNumber;
        workmanship.formData.modelNumber = data.modelNumber;
      } else {
        workmanship.formData.name = "";
        workmanship.formData.code = "";
        workmanship.formData.figureNumber = "";
        workmanship.formData.modelNumber = "";
      }
    };
    // 获取所有班组
    const getTeam = () => {
      queryTeamAll().then((res: any) => {
        if (res.code === 0) {
          workmanship.teamData = res.data;
        }
      });
    };
    // 获取班组之后修改code
    const getTeamCode = (name, i) => {
      var data = workmanship.formData.processRouteItemList[i];
      data.teamCode = "";
      if (name) {
        var arr = workmanship.teamData.filter(item => item.name == name)[0];
        data.teamCode = arr.code;
      }
    };
    // 获取所有工序
    const getProcess = () => {
      getProcessAll().then((res: any) => {
        if (res.code === 0) {
          workmanship.processData = res.data;
        }
      });
    };
    // 获取质检模板=检验规范
    const getQuality = () => {
      getQualityAll().then((res: any) => {
        if (res.code === 0) {
          workmanship.qualityData = res.data;
        }
      });
    };
    return {
      workmanship,
      chooseOrderShow,
      queryProcessById,
      getTeamCode,
      insertForm,
      submitEvent,
      handleClose,
      addProcess,
      dele,
      chooseMaterialDialog,
      chooseMaterialShow,
      chooseMaterialClose,
      chooseTrue
    };
  }
};
</script>
<template>
  <div>
    <!-- 表单弹框 -->
    <el-dialog
      v-model="workmanship.dialogShow"
      :title="
        workmanship.detailCode || workmanship.detailId
          ? '编辑&保存'
          : '新增&保存'
      "
      width="80%"
      top="7vh"
      :close-on-click-modal="false"
      :before-close="handleClose"
    >
      <el-form
        ref="insertForm"
        id="insertForm"
        :model="workmanship.formData"
        :rules="workmanship.formRules"
        label-width="60px"
      >
        <el-divider content-position="left">基本信息</el-divider>
        <el-row :gutter="10">
          <el-col :xs="24" :sm="12" :md="12" :lg="6" :xl="6">
            <el-form-item prop="code" label="料号">
              <el-input
                v-if="
                  workmanship.detailId === 0 && workmanship.detailCode === ''
                "
                readonly
                v-model="workmanship.formData.code"
                size="small"
                placeholder="点击选择物料"
                @click="chooseMaterialShow"
              ></el-input>
              <el-input
                v-else
                readonly
                v-model="workmanship.formData.code"
                size="small"
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="12" :lg="6" :xl="6">
            <el-form-item prop="name" label="品名">
              <el-input
                readonly
                size="small"
                style="width: 100%"
                v-model="workmanship.formData.name"
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="12" :lg="6" :xl="6">
            <el-form-item prop="figureNumber" label="别名">
              <el-input
                readonly
                size="small"
                style="width: 100%"
                v-model="workmanship.formData.figureNumber"
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="12" :lg="6" :xl="6">
            <el-form-item prop="modelNumber" label="机型">
              <el-input
                readonly
                size="small"
                style="width: 100%"
                v-model="workmanship.formData.modelNumber"
              ></el-input>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item prop="mdesc" label="描述" :span="24">
          <el-input
            type="textarea"
            v-model="workmanship.formData.mdesc"
            placeholder="请输入描述"
          ></el-input>
        </el-form-item>
        <el-divider content-position="left">详情</el-divider>
        <el-form-item :span="24" label=" ">
          <template #default>
            <el-button type="primary" size="small" @click="addProcess"
              >新增工序</el-button
            >
          </template>
        </el-form-item>
      </el-form>
      <el-table
        stripe
        style="width: 100%"
        :data="workmanship.formData.processRouteItemList"
        :height="workmanship.tableHeight"
        border
        fit
        size="mini"
        highlight-current-row
        tooltip-effect="dark"
      >
        <el-table-column
          type="index"
          width="50"
          label="序号"
          fixed
        ></el-table-column>
        <!-- <el-table-column label="工序名称">
          <template #default="scope">
            <span>工序</span>{{ scope.$index + 1 }}
          </template>
        </el-table-column> -->
        <el-table-column label="工序" min-width="150">
          <template #default="{ row }">
            <el-select
              v-model="row.processId"
              filterable
              placeholder="请选择工序"
              size="small"
              style="width: 100%"
            >
              <el-option
                v-for="item in workmanship.processData"
                :key="item.id"
                :label="item.code + '-' + item.name"
                :value="item.id"
              >
              </el-option>
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="责任部门" min-width="150">
          <template #default="scope">
            <el-select
              v-model="scope.row.teamName"
              filterable
              placeholder="请选择"
              size="small"
              @change="getTeamCode(scope.row.teamName, scope.$index)"
              style="width: 100%"
            >
              <el-option
                v-for="item in workmanship.teamData"
                :key="item.id"
                :label="item.name"
                :value="item.name"
              >
              </el-option>
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="步骤号" prop="stepNo" min-width="100">
          <template #default="{ row }">
            <el-input-number
              size="small"
              style="width: 100%"
              v-model="row.stepNo"
              :min="1"
              :controls="false"
              placeholder="请输入步骤号"
            ></el-input-number>
          </template>
        </el-table-column>
        <el-table-column label="检验规范" prop="qualityId" min-width="100">
          <template #default="{ row }"
            ><el-select
              v-model="row.qualityId"
              filterable
              placeholder="请选择检验规范"
              size="small"
              style="width: 100%"
            >
              <el-option
                v-for="item in workmanship.qualityData"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              >
              </el-option>
            </el-select>
          </template>
        </el-table-column>
        <el-table-column
          label="工序用时(分钟)"
          prop="processTakeTime"
          min-width="150"
        >
          <template #default="{ row }">
            <el-input
              size="small"
              style="width: 100%"
              v-model="row.processTakeTime"
              placeholder="请输入工序用时(分钟)"
            ></el-input>
          </template>
        </el-table-column>
        <el-table-column
          label="新产品周期(天)"
          prop="periodNew"
          min-width="150"
        >
          <template #default="{ row }">
            <el-input
              size="small"
              style="width: 100%"
              v-model="row.periodNew"
            ></el-input>
          </template>
        </el-table-column>
        <el-table-column
          label="常规周期(天)"
          prop="periodConventional"
          min-width="150"
        >
          <template #default="{ row }">
            <el-input
              size="small"
              style="width: 100%"
              v-model="row.periodConventional"
            ></el-input>
          </template>
        </el-table-column>
        <el-table-column
          label="紧急周期(天)"
          prop="periodUrgency"
          min-width="150"
        >
          <template #default="{ row }">
            <el-input
              size="small"
              style="width: 100%"
              v-model="row.periodUrgency"
            ></el-input>
          </template>
        </el-table-column>
        <el-table-column
          label="特急周期(天)"
          prop="periodVeryUrgency"
          min-width="150"
        >
          <template #default="{ row }">
            <el-input
              size="small"
              style="width: 100%"
              v-model="row.periodVeryUrgency"
            ></el-input>
          </template>
        </el-table-column>
        <!-- <el-table-column label="是否外协"
                         prop="isOutSource">
          <template #default="{ row }">
            <el-radio-group v-model="row.isOutSource">
              <el-radio :label="1">是</el-radio>
              <el-radio :label="0">否</el-radio>
            </el-radio-group>
          </template>
        </el-table-column> -->
        <el-table-column fixed="right" label="操作" width="100">
          <template #default="scope">
            <el-button type="danger" @click="dele(scope.$index)" size="mini"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button size="small" @click="handleClose">取 消</el-button>
        <el-button
          size="small"
          type="primary"
          :disabled="workmanship.submitLoading"
          @click="submitEvent"
          >确 定</el-button
        >
      </template>
    </el-dialog>
    <!-- 弹框选择物料 -->
    <choose-material
      :dialogShow="chooseMaterialDialog"
      @chooseMaterialClose="chooseMaterialClose"
      @searchEvent="chooseTrue"
    ></choose-material>
  </div>
</template>
<style scoped>
@import url("/@/style/dialog.css");
</style>
<style>
.mytable-style .vxe-body--column.col-blue {
  background-color: #60b8ff;
  color: #fff;
}
.mytable-style .vxe-body--column.col-orange {
  background-color: #f56c6c;
  color: #fff;
}
</style>
<style lang="scss" scoped>
.vxe-input + .vxe-button,
.vxe-input + .vxe-button--dropdown,
.vxe-button + .vxe-button,
.vxe-button + .vxe-button--dropdown {
  margin-left: 0;
}

.vxe-toolbar.size--medium {
  padding: 10px;
}

.vxe-table--render-default.size--medium {
  margin-top: 12px;
}

.vxe-button.size--medium.type--button {
  margin-left: 1em;
  height: 32px;
}

.text-model {
  &:hover {
    cursor: pointer;
  }
}
.el-date-editor.el-input__inner,
.el-form-item :deep(.el-date-editor.el-input),
.el-select,
.el-input-number {
  width: 100% !important;
}
</style>
