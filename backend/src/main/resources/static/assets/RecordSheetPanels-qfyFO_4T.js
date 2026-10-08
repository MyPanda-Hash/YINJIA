import { i as ElInput, n as ElSelect, o as ElOption, f as ElDialog, d as ElButton, k as ElMessage, j as ElTable, g as ElTableColumn, s as ElRadio, R as ElScrollbar, D as ElCheckbox, A as ElIcon, l as ElMessageBox, z as ElDatePicker, W as ElTimePicker } from './element-plus-W84rT0en.js';
import { t as tt, r as request } from './index-CqmwEeWF.js';
/* empty css                   */
import './el-tooltip-l0sNRNKZ.js';
/* empty css                         */
/* empty css                */
/* empty css                  */
/* empty css                        */
/* empty css                   */
import { z as reactive, p as ref, o as openBlock, P as createBlock, W as withCtx, a as createBaseVNode, $ as toDisplayString, A as unref, c as createElementBlock, J as Fragment, ae as renderList, a0 as createVNode, Z as createCommentVNode, S as normalizeClass, _ as createTextVNode, f as computed, j as watch, R as normalizeStyle, X as withDirectives, a1 as vShow, ac as withModifiers, u as nextTick } from './vue-vendor-DyX2BAKf.js';
import { M as search_default } from './element-icons-DOEvq9OG.js';
import { s as sumKeepScale } from './sumTotals-C3PClexH.js';
import { S as StdLibManager, F as FileAttachCell, R as RefPickDialog } from './StdLibManager-Dp-r8k7m.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

// 规格书检验标准库(分组)——由 tools/gen/gen-spec-testlib-from-design.cjs 从
// 《规格书细分.xlsx》sheet「检验项目及标准」生成(**勿手改**)。
// 用户口径 2026-09-20:按该 sheet 重建为 18 个检验项目(原有 26 组内容已全部替换)。
// 结构:{name: 组名(检验项目), subs: [{name: 子项名(单子项组为空), req: 检验要求, method: 检验方法, basis: 检验依据}]}
const SPEC_TEST_LIB = [
  {
    "name": "*外观",
    "subs": [
      {
        "name": "",
        "req": "-清洁、无破损无压痕，无裂纹,无倾斜等缺陷\n-切面平整无锯齿纹路，无明显缺角\n-切面无残留炭渣",
        "method": "目视",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "*炭棒尺寸",
    "subs": [
      {
        "name": "",
        "req": "外径：34.5±0.5mm",
        "method": "游标卡尺",
        "basis": "银嘉测试标准"
      },
      {
        "name": "",
        "req": "内径：12.5±0.5mm",
        "method": "游标卡尺",
        "basis": "银嘉测试标准"
      },
      {
        "name": "",
        "req": "长度：99±0.5mm",
        "method": "游标卡尺",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "重量",
    "subs": [
      {
        "name": "炭棒重量",
        "req": "47.5-49.2g",
        "method": "电子秤",
        "basis": "银嘉测试标准"
      },
      {
        "name": "（干重）",
        "req": "47.5-49.2g",
        "method": "电子秤",
        "basis": "银嘉测试标准"
      },
      {
        "name": "*出货重量",
        "req": "＞47g",
        "method": "电子秤",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "强度",
    "subs": [
      {
        "name": "*抗压强度",
        "req": "≥30kgf",
        "method": "将炭棒水平放置在仪器上，调整间距40mm，设置下压速度5mm/min，按测试键，仪器自动下压，断裂后读取压断时最大力压力值",
        "basis": "银嘉测试标准"
      },
      {
        "name": "跌落强度",
        "req": "成型强度：高度50cm，垂直跌落3次，炭棒无断裂",
        "method": "将活性炭棒放置在50cm高处，3次自由跌落到水泥地板上，测试后，活性炭棒不可有破损现象",
        "basis": "银嘉测试标准"
      },
      {
        "name": "（裸棒）",
        "req": "成品强度（一切二）：高度60cm，垂直跌落3次，炭棒无断裂",
        "method": "将活性炭棒放置在50cm高处，3次自由跌落到水泥地板上，测试后，活性炭棒不可有破损现象",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "#*压降",
    "subs": [
      {
        "name": "",
        "req": "≤20kpa",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，测试用水纯水/超纯水，水温控制25±1℃，测试流速0.9L/min，滤前前后接装压力表，压力表距离滤芯接口位置长度50mm，通水10min后记录压差值（滤芯前压-后压）。",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "*黑水及颗粒物测试",
    "subs": [
      {
        "name": "初始黑水测试",
        "req": "初始：第一杯500ml，轻微黑水/白水，浊度≤20NTU",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），按进水方向通水测试用水纯水/超纯水，测试流速0.9±0.1L/min，\n1.用烧杯接第一杯500ml，观察出水及测试浊度值；",
        "basis": "银嘉测试标准"
      },
      {
        "name": "浸泡黑水及颗粒物",
        "req": "浸泡4H：无肉眼可见黑水，浊度≤3NTU，颗粒物≤4颗",
        "method": "2.冲水5min后，浸泡4H，陶瓷杯接出水200ml，观察出水情况及测试浊度值；正常照明下，用肉眼观察杯底部颗粒物，颗粒物≤4颗",
        "basis": "银嘉测试标准"
      },
      {
        "name": "（裸棒）",
        "req": "浸泡4H：无肉眼可见黑水，浊度≤3NTU，颗粒物≤4颗",
        "method": "",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "*一级颗粒物去除率",
    "subs": [
      {
        "name": "",
        "req": "0.5-1μm颗粒物去除率≥95%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，用纯水冲洗30min，流速2.0L/min，炭棒出水颗粒＜500颗/ml，用A2粉配置加标水0.5-1μm颗粒数10000±1000颗/ml，将冲洗干净的炭棒通过加标水，流速0.9±0.1L/min，通标2分钟取样测试，计算颗粒物去除率",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "隔夜浸泡口感/气味",
    "subs": [
      {
        "name": "",
        "req": "浸泡15-24H：出水无异味、口感正常，浊度值≤3NTU",
        "method": "1）将炭棒组装好装入滤瓶（可旋盖大T），测试流速0.9±0.1L/min，测试用水纯水/超纯水，冲水3min后浸泡15-24H，接水量250ml，品尝出水及闻气味，测试浊度值\n品尝人数：至少4人",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "VOC性能测试",
    "subs": [
      {
        "name": "初始VOC去除率",
        "req": "≥95%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，原水平均浓度控制在300μg/L±10%，通入加标水5min后取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除VOC寿命",
        "req": "寿命600L，全程加标",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，原水平均浓度控制在300μg/L±10%，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除VOC寿命",
        "req": "去除率≥95%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，原水平均浓度控制在300μg/L±10%，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "*除铅性能测试（PH8.5&6.5)",
    "subs": [
      {
        "name": "初始铅去除率",
        "req": "≥96.7%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，原水平均浓度控制在150μg/L±10%，通入加标水5min后取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除铅寿命",
        "req": "寿命920L，全程加标",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水（纯水加标），原水平均浓度控制在150μg/L±10%，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除铅寿命",
        "req": "去除率≥96.7%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水（纯水加标），原水平均浓度控制在150μg/L±10%，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "*除汞性能测试（PH8.5&6.5)",
    "subs": [
      {
        "name": "初始汞去除率",
        "req": "≥67%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，原水平均浓度控制在6μg/L±10%，通入加标水5min后取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除汞寿命",
        "req": "寿命920L，全程加标",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水（纯水加标），原水平均浓度控制在6μg/L±10%，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除汞寿命",
        "req": "去除率≥67%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水（纯水加标），原水平均浓度控制在6μg/L±10%，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "*Cyst去除测试",
    "subs": [
      {
        "name": "初始去除率",
        "req": "≥99.95%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，通入加标水5min后取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除Cyst寿命",
        "req": "寿命920L，全程加标",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除Cyst寿命",
        "req": "去除率≥99.95%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "*PFOA&PFOS去除性能测试",
    "subs": [
      {
        "name": "初始去除率",
        "req": "≥98.67%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，通入加标水5min后取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除PFOA&PFOS寿命",
        "req": "寿命920L，全程加标",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除PFOA&PFOS寿命",
        "req": "去除率≥98.67%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "*NSF401（三组）去除性能测试",
    "subs": [
      {
        "name": "初始去除率",
        "req": "85%/86%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水（纯水加标），通入加标水5min后取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "初始去除率",
        "req": "（各项物质均能满足NSF401标准要求去除率）",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水（纯水加标），通入加标水5min后取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除NSF401（三组）寿命",
        "req": "寿命920L，全程加标",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除NSF401（三组）寿命",
        "req": "去除率85%/86%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除NSF401（三组）寿命",
        "req": "（各项物质均能满足NSF401标准要求去除率）",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "*毒杀芬去除性能",
    "subs": [
      {
        "name": "初始去除率",
        "req": "≥80%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，通入加标水5min后取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除毒杀芬寿命",
        "req": "寿命920L，全程加标",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水（纯水加标），在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除毒杀芬寿命",
        "req": "去除率≥80%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水（纯水加标），在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "*MTBE去除性能",
    "subs": [
      {
        "name": "初始去除率",
        "req": "≥67%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，通入加标水5min后取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除MTBE寿命",
        "req": "寿命920L，全程加标",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除MTBE寿命",
        "req": "去除率≥67%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，参考NSF 53标准方法配置加标水，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "*余氯去除性能",
    "subs": [
      {
        "name": "初始去除率",
        "req": "≥98%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，采用次氯酸钠原液（有效氯≥10％）稀释后进行余氯去除率的加标试验，余氯浓度控制在2.0±0.2mg/L，通入加标水5min后取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除余氯寿命",
        "req": "寿命920L，全程加标",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，采用次氯酸钠原液（有效氯≥10％）稀释后进行余氯去除率的加标试验，余氯浓度控制在2.0±0.2mg/L，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      },
      {
        "name": "除余氯寿命",
        "req": "去除率≥50%",
        "method": "将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.9±0.1L/min，采用次氯酸钠原液（有效氯≥10％）稀释后进行余氯去除率的加标试验，余氯浓度控制在2.0±0.2mg/L，在额定净水0%、25%、50%、75%、100%进行取样测试，计算去除率。",
        "basis": "银嘉测试标准"
      }
    ]
  },
  {
    "name": "*卫生安全",
    "subs": [
      {
        "name": "",
        "req": "符合标准",
        "method": "参考《GBT17219生活饮用水输配水设备及防护材料卫生安全评价规范》",
        "basis": "《生活饮用水输配水设备及防护格料卫生安全评价规范》"
      },
      {
        "name": "",
        "req": "（注：PH、浊度只提供参考值）",
        "method": "参考《GBT17219生活饮用水输配水设备及防护材料卫生安全评价规范》",
        "basis": "《生活饮用水输配水设备及防护格料卫生安全评价规范》"
      }
    ]
  }
];

/**
 * 配方表「物料种类」的可选词表。
 *
 * 口径(不改):引擎 recipeSheet.groupOfMaterialType 只认**物料档案口径**的词 ——
 * 档案 bs_inv.所属类别 就四个:炭粉 / 胶粉 / 功能料-粉末 / 功能料-颗粒
 * (折算料位靠 groupOfMaterialType 的「颗粒」「折算物料」命中,四个词里 功能料-颗粒 正好落折算料位);
 *
 * 为什么要有这份常量(2026-09-21 真人流程 e2e 实测):
 *   原来「物料种类」是自由文本格,工艺员顺手填自然词「粉料」「折算料」时**不报错** ——
 *   引擎认不出来就按粉料处理,折算料 2g/支 会被当成 2% 比例 ⇒ 灌料重量/长度/脱模重量整列算错,
 *   只在弹窗②留一行小字告警。改成下拉 + 词表集中一处,结构上堵掉这个错法;
 *   materialKinds.test.js 钉住不变量:下拉里的每个词都必须被引擎认出来。
 *
 * 加新类别时:先确认档案里确实有这个 所属类别(bs_inv.所属类别),再往这里加,
 * 并在 groupOfMaterialType 里补上命中的关键词 —— 否则新选项会静默落错料位。
 */
const MATERIAL_KINDS = ['炭粉', '胶粉', '功能料-粉末', '功能料-颗粒'];

/**
 * recordSheetConfigs.js — 文书面板配置(数据记录表 7 张 + 实验室使用记录表 4 张)
 * 按各 Excel 原表逐表复刻;key = yj_field 的 label(中文数据键),由 RecordSheetPanels.vue 统一渲染。
 * 结构:
 *   headMode —— 'report'(默认:公司名+大标题+右侧信息块的报告头) | 'plain'(标题条+副标题行的登记表版式)
 *   grid —— 整页共用列网格(Excel 原表各列宽度 px):报告头/条件区/数据表全部用这套列宽,竖线全页对齐
 *   pages —— 多页签面板(pages 缺省 = 单页面板)。每页可**各自**声明:
 *              pages[i].grid     本页专用列网格(不写则用面板 grid;两页版式不同时必须各写一套,
 *                                否则其中一页会被另一页的网格挤变形 —— 成型/组装两对面板即如此)
 *              pages[i].headMode 本页专用版式 'report'|'plain'(不写则用面板 headMode)
 *              pages[i].head     本页专用报告头跨度(网格列数不同的页要各自给 title/infoLabel/infoValue)
 *              pages[i].showHead true=本页渲染报告头 / false=本页不渲染;
 *                                **不写**=沿用历史行为「只有第 0 页有报告头」⇒ 多页面板请逐页显式写
 *              pages[i].staticTitle 本页报告头大标题(两页本是两张单据,各有各的标题,不能共用面板 staticTitle)
 *            区块用对象上的 page:i 归属到第 i 个页签(缺省 0;漏写会挤到第 0 页)
 *            ⚠ 每页都必须有自己的 grid(或回落到面板 grid):report 页的 section 宽度取自 effGrid,
 *              取不到就写 width:0px,而 .rs-t 是 table-layout:fixed ⇒ 整块塌掉。
 *   head {title, infoLabel, infoValue} —— report 版式报告头三段列跨度(大标题|信息标签|信息值),合计 = grid 列数
 *   head.noSpan / head.noGapSpan / head.docnoPrefix —— 报告头第 1 行「公司名格 | 编号格」的分列,
 *        按**设计原表的 !merges 显式切分**(不再由列宽向左凑 ≥160px 的动态算法拍位置;
 *        动态算法总列数常常对、切开的位置错,如碱性设计 12/1 而算成 11/2):
 *          noSpan       编号格占末尾几列;0 = 编号与公司名**同一格**(纸面一格含两段文字,编号靠右);
 *          noGapSpan    没并进两格的空列数(两格版式夹在公司名与编号之间;同格版式落在该格右侧);
 *          docnoPrefix  true 才在编号前渲染「编号：」标识 —— 设计原值都是**裸编号**,缺省即 false。
 *        noSpan 不写 = 退回动态算法(未按设计逐张核对的面板行为不变)。
 *        逐张证据(设计原表 _dump-xlsx 解析结果)钉在 recordSheetConfigs.docno.test.js。
 *   info —— report 版式右侧信息块行(缺省=密级/适用范围/测试负责人/报告编号;委托单自定义 文件管理人/密级/文件使用范围)
 *   docNoDefault —— 文档编号缺省(默认 YJ-PD-01;委托单 YJ-RIR001)
 *   titleFromKey/titleSuffix —— 标题由头字段派生(如 申请单类型+'-测试申请单')
 *   plainTitle/plainTitleW —— plain 版式标题条文字与表格总宽(列宽取 cols.w 之和)
 *   subtitle {label,key,type,options} —— plain 版式副标题行(如 测试项目：/设备名称：/仪器名称/型号：)
 *   variantKey/variants —— 动态列变体:按头字段值切换列集(加标水 3 种测试项目/委托单 2 种类型)
 *   sections[{bar, rows[]}] —— row: {label,key,type:'text|area'} 或 {label,cells:[{key,ph,span}](多值格)}
 *   waterColspans(碱性) —— 原水水质条 6 指标格各自跨的网格列数(Excel C:D/E/F:H/I:J/K:L/M:N)
 *   soakColspans(浸泡安全) —— 特例块值区跨度(Excel D/E/F:G)
 *   dataTables[{bar,subHeads[],cols[{key,label,span,group,area,w}],charts,footerNote}] —— 数据记录表(两级表头:同 group 合并)
 *              cols[].key   = **数据键,必须是该字段当前的 yj_field.label**
 *              cols[].label = 显示文案(缺省同 key);与 key 不同即为「显示改名」,不改数据键
 *              dt.noVariant = true ⇒ 本表不渲染表头的变体切换行(工艺形态已在条件区有一格时用;
 *                                    组装工艺清单三张表全标 —— 页 1/2 的「产品基本信息」已有该格,页 0 无格可改)
 *              dt.filterKey/filterVal ⇒ 多张逻辑表共用一张行表时的物理分块(见 CONTEXT「表区是物理列」)
 *              dt.libGroupKey = 明细列名 ⇒ **单表**面板的替代分组通道。设计只有一张表时没有 filterVal
 *                                    可当分组名,勾选标准库落下来的行靠这一格记住自己属于哪个分组
 *                                    (出货检验计划表用:'检验类别' → '必测项'/'型式检验')。
 *                                    仅参与写库,不上纸(该列通常同时 hiddenCol)。
 *   autoFillSpec —— 「自动填充规格书」:选定 fromKey(产品编号)后,按该值拉**规格书**(RD_SPEC_DOC)
 *                   的表头与检验要求明细,回填到本表。结构:
 *              fromKey  触发字段(必须是一个产品编号参照格)
 *              head[]   {to: 本面板表头键, from: 规格书字段名} —— 逐格回填报告头
 *              detail[] {to: 本表明细键,   from: 规格书明细字段名}(规格书「检验要求」表区)
 *              defaults 每次填充后兜底写入的固定值(如不合格应对措施三段式);已有内容的格子不覆盖
 *              取值走后端 GET /px/specByProduct —— **不能**走通用查询链路:
 *              规格书的 编号(=产品键)会被 QueryService.loadDocs 用单据编号覆盖掉(见该处注释)。
 *   conclusion{bar,key} —— 结论区(Excel 无结论区的表不配置)
 *   seedRows(浸泡安全) —— 标准卫生项目 17 行(新增草稿自动预填)
 */
// ⚠ 必须带 .js 扩展名:Node 的 ESM 解析不做扩展名补全(node --test 直接跑源码时
//   无扩展名会 ERR_MODULE_NOT_FOUND);Vite 两种写法都接受,故带扩展名对两端都安全。

// ═══════════ 被并入面板的原始配置(2026-09-11 并入工艺清单面板第 2 页签,菜单已下线)═══════════
// RD_MOLD_FORMULA 仍按页引用到成型工艺面板(sections/dataTables/tailSections 上的 page 标明归属;
// 2026-09-20 修订记录页插到最前后,原两页顺延 ⇒ 它现在是 page:2)。
//
// ⚠ 2026-09-20 起,**组装侧不再是"并入"关系**:组装工艺清单按《组装工艺控制.xlsx》重排为 3 个页签,
//   第 2 个页签(组装BOM表)照设计 sheet 独立复刻,不再复用原来的 RD_ASM_BOM 常量 ——
//   两者的列序本就不同(设计是 物料编号|物料名称|… ,RD_ASM_BOM 常量是 物料名|物料编号|… ),
//   继续复用会按错误列序渲染。该常量已随本次重排删除(需要时见 e20bd9a~1 之前的 git 历史);
//   组装BOM表**面板**(RD_ASM_BOM)菜单早已下线(menus.test.js 钉着),实体表与 yj_field 保留不动。

/** 组装工艺清单 · 页签 2「关键控制清单」= 设计《组装工艺控制.xlsx》sheet「组装工艺控制-关键控制清单」
 *  2026-09-18(Phase 4):改为**标准库驱动**(lib:'asm.proc',一变体一条目,勾选即整表替换),
 *  seedRows 降级为"未跑种子的环境"兜底 —— 沿用检验项目标准库重构的同一降级模式。
 *  2026-09-20:设计改为 3 页签后,本表归属第 3 页(page:2),并补 filterKey/filterVal —
 *    rd_asm_proc_detail 现由三张逻辑表共用(修订记录/物料清单/关键控制清单),
 *    没有表区过滤时 rowsOf() 会把整份明细当本表显示、confirmLib() 会删掉"表区为空"的行。
 *  ⚠ seedRows 是首次复刻时**合并单元格被塌缩**的产物,且多条 管控要求 为空串;
 *    权威内容以 asm.proc 库为准(4 变体 37 道工序、检查比例 0 条为空,
 *    见 tools/gen/gen-asm-proc-lib.cjs 的实测输出)。 */
const RD_ASM_PROC_DT0 = [
      { lib: 'asm.proc',   // 标准库:组装工艺 4 变体(裸棒/机器包布/复合半成品/成品)
        page: 2,
        bar: '关键控制清单',
        filterKey: '表区', filterVal: '关键控制清单',
        // 工艺形态 已在「产品基本信息」区有一格(见 sections),表头不再重复一条变体切换行
        noVariant: true,
        seedRows: [
          { 工序: '无黑处理', 工序控制内容: '无黑时间', 管控要求: '将炭棒单层摆车无黑处理，破损、裂纹等不良挑出无黑处理时间：12-24小时', 检查比例: '随机取2支测试黑水' },
          { 工序: '机器除尘', 工序控制内容: '1.机器毛刷松紧度2.除尘后清洁效果', 管控要求: '', 检查比例: '3%' },
          { 工序: '投首', 工序控制内容: '尺寸：长度、内径、外径外观：表面、脱粉、强度', 管控要求: '尺寸：长度66-67mm,外径：56-57mm,内径：20.3-21.3mm切面平整，无锯齿纹，无明显缺角，无残留渣脱粉检查方法;用搓三次炭棒表面后，无继续有粉脱落为合格强度：用手捏炭棒切口，无捏碎、捏裂及疏松为合格', 检查比例: '尺寸：3%外观：3%' },
          { 工序: '手工包布/套网', 工序控制内容: '网/布尺寸、外观', 管控要求: '', 检查比例: '全检' },
          { 工序: '套网', 工序控制内容: '网尺寸、外观', 管控要求: '', 检查比例: '全检' },
          { 工序: '机器包布', 工序控制内容: '布尺寸、外观', 管控要求: '', 检查比例: '全检' },
          { 工序: '套PP棉', 工序控制内容: 'PP棉尺寸、外观', 管控要求: '', 检查比例: '全检' },
          { 工序: '套折叠棉', 工序控制内容: '折叠棉尺寸、外观', 管控要求: '', 检查比例: '全检' },
          { 工序: '粘端盖', 工序控制内容: '胶位胶量成品长度粘接歪斜', 管控要求: '1.点胶机温度：180±10度2.胶量:2.5±0.5g3.成品长度：252±0.5mm4.检查整个切面须有胶水粘附5.放台面比较，无歪斜（倾斜度不大于0.5mm)', 检查比例: '1.尺寸：1%2.胶位检查：1%3.外观：3%' },
          { 工序: '装垫片', 工序控制内容: '垫片尺寸、外观', 管控要求: '', 检查比例: '全检' },
          { 工序: '气检', 工序控制内容: '气检参数', 管控要求: '', 检查比例: '30%' },
          { 工序: '气检吹灰', 工序控制内容: '1.内孔2.外表面', 管控要求: '用气枪沿着炭棒内壁吹一圈及外表面一次', 检查比例: '100%' },
          { 工序: '加工超滤', 工序控制内容: '超滤棉与端盖装配合理性端盖/超滤质量', 管控要求: '检查端盖无明显刮花，无变形、破损超滤无漏密封圈、超滤丝无断裂在端盖内柱内边涂抹 一圈硅油，然后将超滤垂直放进胶柱内，超滤须装到位，密封圈不可移位在端盖内柱外缘口与滤滤接触处 轻点一圈302胶水固定，待胶水干燥后摆进箱内', 检查比例: '3%' },
          { 工序: '装防尘塞', 工序控制内容: '堵头质量漏装堵头', 管控要求: '检查防尘塞无破损、批锋每支产品装一个堵头不可漏装防尘塞', 检查比例: '全检' },
          { 工序: '检外观', 工序控制内容: '卫生端盖歪斜炭棒表面质量', 管控要求: '产品无胶丝、头发丝等卫生问题平放在台面上，端盖无歪斜不良炭棒无破损、裂纹、明显炭粉掉落', 检查比例: '全检' },
          { 工序: '塑封/检外观', 工序控制内容: '漏部件塑封质量', 管控要求: '检查防尘塞无漏装、破裂塑封无破洞、褶皱', 检查比例: '全检' },
          { 工序: '折盒子', 工序控制内容: '外观尺寸', 管控要求: '检查盒子无脏污、破损，折好摆在箱子内', 检查比例: '全检' },
          { 工序: '装气泡袋/装盒子', 工序控制内容: '气泡袋外观气泡袋尺寸数量', 管控要求: '将外观合格塑封好的产品装进气泡袋内，1个气泡袋装1支产品将装好气泡袋的产品装入盒子内，每个盒子装2支产品', 检查比例: '全检' },
          { 工序: '放说明书、反冲洗垫片', 工序控制内容: '数量：少装、多装漏部件', 管控要求: '检查每个盒子装2支装好气泡袋的产品检查说明书和垫片无破损、无脏污;每盒放1张说明书和1个反冲洗垫片', 检查比例: '全检' },
          { 工序: '扣盒盖/封胶纸', 工序控制内容: '1.配件数量2.封胶方式', 管控要求: '1.检查产品无漏装堵头、说明书、反冲洗垫片，然后将盒盖扣好2.用透明胶纸：十字交叉方式：盒宽面连接盒底封一圈+盒盖窄面封一条', 检查比例: '全检' },
          { 工序: '封箱', 工序控制内容: '1.装箱方式2.数量', 管控要求: '准备好纸箱，折好刀卡，将外观合格的产品端盖朝上竖放在纸箱内，具体方法：每排装6盒，装4排，每盒2支，每箱装48支，封箱方式为“工”字形', 检查比例: '全检' },
        ], cols: [
          { key: '表区', label: '表区', hiddenCol: true, w: 90 },
          { key: '工序', label: '工序', w: 130 },
          { key: '工序控制内容', label: '工序控制内容', w: 320, area: true },
          { key: '管控要求', label: '管控要求', w: 430, area: true },
          { key: '检查比例', label: '检查比例', w: 160 },
        ]},
    ];

/** 组装工艺清单 · 页签 0「修订记录」= 设计《组装工艺控制.xlsx》sheet「修订记录」(B6:G16)
 *  该 sheet 只有一行居中大标题 + 一行表头,没有公司抬头/编号/信息栏 ⇒ 本页 showHead:false,
 *  由 dt.pageTitle 出居中标题(与 RD_SPEC_DOC 的「修订记录」页同一做法)。
 *  列宽按 1040 总宽配平(与另两页的报告头/表格同宽,打印时三页左右缘对齐)。 */
const RD_ASM_PROC_DT_REVISION = {
  page: 0,
  pageTitle: '修订记录',
  filterKey: '表区', filterVal: '修订记录',
  // 本页无「产品基本信息」区,变体切换行在这里既不驱动本页标题(本页出 pageTitle 居中大标题)
  // 也没有可改的工艺形态格 —— 留着只会在表头上多一条无作用的「工艺形态：请选择」。
  noVariant: true,
  design: { titleSize: 21, titleTop: 24, titleGap: 40, headerH: 44, rowH: 43, fontSize: 16 },
  cols: [
    { key: '表区', label: '表区', hiddenCol: true, w: 46 },
    { key: '序号', label: '序号', w: 60, align: 'center' },
    { key: '更改内容', label: '更改内容', w: 300, area: true },
    { key: '更改原因', label: '更改原因', w: 200 },
    { key: '更改时间', label: '更改时间', w: 130 },
    { key: '责任人', label: '责任人', w: 120 },
    { key: '备注', label: '备注', w: 184, area: true },
  ],
};

/** 组装工艺清单 · 页签 1「组装BOM表」= 设计《组装工艺控制.xlsx》sheet「组装工艺控制-BOM表」
 *  ⚠ 列序照设计第 13 行(物料编号 | 物料名称 | 物料规格 | 外观要求 | 用量)——
 *    与组装BOM表面板(RD_ASM_BOM)的列序**不同**,故这里独立声明、不复用它的 dataTables。
 *  ⚠ 「物料名称」是**显示文案**,数据键仍是 yj_field.label `物料名`
 *    (改 label 会同时漂移 RD_ASM_BOM/RD_SPEC_DOC 两处数据键,2026-09-18 已定不改;
 *     这里靠 yj_field.alias 在显示层改名,见 migrate-asm-proc-redesign-2026-09-20.sql §4)。 */
const RD_ASM_PROC_DT_BOM = {
  page: 1,
  bar: 'BOM表',
  filterKey: '表区', filterVal: '物料清单',
  // 本页有「产品基本信息」区且其中已有 工艺形态 一格 ⇒ 表头不再重复一条变体切换行
  // (实测:不写这行时同页会出现两个「工艺形态」下拉,一个在信息区、一个在表格表头上)
  noVariant: true,
  cols: [
    { key: '表区', label: '表区', hiddenCol: true, w: 90 },
    { key: '物料编号', label: '物料编号', w: 130 },
    { key: '物料名', label: '物料名称', w: 140 },
    { key: '物料规格', label: '物料规格', w: 300, area: true },
    { key: '外观要求', label: '外观要求', w: 340 },
    { key: '用量', label: '用量', w: 130 },
  ],
};

/** 三个页签的「产品基本信息」区(设计两张表都有 B9:G9 这一块,格子相同)
 *  按用户口径只保留设计的四格 + 工艺形态(驱动 4 个关键控制清单变体的字段)——
 *  产品名称/产品种类/成品重量/整体规格(外径)/整体规格(长度) 已置 visible=0 退出编辑面板。 */
const RD_ASM_PROC_INFO_SEC = (page) => ({
  page,
  bar: '产品基本信息',
  rows: [
    { pairs: [
      { label: '产品编号', key: '产品编号', type: 'text' },
      { label: '客户项目名称', key: '客户项目名称', type: 'text' },
    ]},
    { pairs: [
      { label: '产品功能类别', key: '产品功能类别', type: 'text' },
      { label: '产品整体尺寸', key: '产品整体尺寸', type: 'text' },
    ]},
    { pairs: [
      { label: '工艺形态', key: '工艺形态', type: 'select' },
    ]},
  ],
});

/** 成型工艺清单 · 页签 0「修订记录」(2026-09-20 新增,与组装工艺清单同款 —— 用户口径「和组装的一样」)
 *  该页不出报告头(设计只有一行居中大标题 + 一行表头),由 dt.pageTitle 出标题,
 *  与 RD_SPEC_DOC / RD_ASM_PROC 的修订记录页同一做法;列宽按 1040 总宽配平(三页左右缘对齐)。
 *  行落主面板行表 rd_mold_proc_detail,靠物理列 [表区]='修订记录' 分块(filterKey 模式),
 *  与「配方表」共用一张行表 —— 见 tools/migrate-mold-proc-revision.sql。
 *  ⚠ 与 RD_ASM_PROC_DT_REVISION 逐字一致是**刻意的**(断言⑦钉住两侧一致);
 *    各写一份而不是共用同一个常量:两侧各有各的面板与行表,改一侧不该悄悄改另一侧
 *    (2026-09-20 组装侧重排就是"共用配置"把列序带坏的)。 */
const RD_MOLD_PROC_DT_REVISION = {
  page: 0,
  pageTitle: '修订记录',
  filterKey: '表区', filterVal: '修订记录',
  // 本页无「产品基本信息」区(没有 工艺形态 格可改),也不靠变体切标题 ⇒ 不渲染表头变体切换行
  noVariant: true,
  design: { titleSize: 21, titleTop: 24, titleGap: 40, headerH: 44, rowH: 43, fontSize: 16 },
  cols: [
    { key: '表区', label: '表区', hiddenCol: true, w: 46 },
    { key: '序号', label: '序号', w: 60, align: 'center' },
    { key: '更改内容', label: '更改内容', w: 300, area: true },
    { key: '更改原因', label: '更改原因', w: 200 },
    { key: '更改时间', label: '更改时间', w: 130 },
    { key: '责任人', label: '责任人', w: 120 },
    { key: '备注', label: '备注', w: 184, area: true },
  ],
};

/** 成型工艺清单(页 1)的原始区块:产品基本信息 / 工序 / 检验要求。
 *  2026-09-21 按设计图(用户给的版面照片)重排,与《炭棒BOM及工艺信息表单需求设计内容》第三/四页一致:
 *   - 产品基本信息:纸面标签改 炭棒编号 / 产品名称 / 炭棒规格 / 产品管控类型 / 产品形态 / 生产车间
 *     (**只是纸面的字**:数据键仍是 产品编号/外观要求 等,改名走 yj_field.alias —— 参照链路、
 *     四文件编辑门禁、配方计算回填都按数据键走,改 label 会让历史单据丢字段);
 *   - 工序:补「配料要求」行(工序名=要求项,要求格横跨整行)+ 灌料块补「灌料要求」行;
 *     三值改并排(理论最低/中间/最高灌料重量g),其后保留一个空白行;
 *   - 检验要求:炭棒尺寸块改 4 格(炭棒外径mm/炭棒外径公差mm/炭棒内径mm/炭棒内径公差mm,原「内孔要求」
 *     新版面无 ⇒ 从配置里撤掉,字段与历史值保留在库里);压降块补第三行「压降是否测试」(√/×);
 *   - 工序五个字段(配料要求/烧结炉参数/烧结时间调速器参数/热压要求/冷却参数设置)挂标准库:
 *     文本框版式的给「⌄标准库」选择(选完还能改),下拉版式的选项即库条目 + 「⧉标准库维护」。 */
const RD_MOLD_PROC_SEC0 = [
      { page: 1, bar: '产品基本信息', rows: [
        { grid: [
          { label: '炭棒编号', span: 2 },
          { label: '产品名称', span: 2 },
          { label: '炭棒规格', span: 3 },
          { label: '产品管控类型', span: 2 },
          { label: '产品形态' },
          { label: '生产车间' },
        ]},
        { grid: [
          { key: '产品编号', span: 2 },
          { key: '产品名称', span: 2 },
          { key: '炭棒规格1' },
          { key: '炭棒规格2' },
          { key: '炭棒规格3' },
          { key: '产品管控类型', type: 'select', span: 2 },
          { key: '外观要求', type: 'select' },
          { key: '生产车间', type: 'select' },
        ]},
      ]},
      { page: 1, bar: '工序', rows: [
        { grid: [
          { label: '工序', cap: true },
          { label: '工序管控要求', cap: true, span: 10 },
        ]},
        // 配料要求:工序名即要求项,要求内容横跨整行(文本框 + ⌄标准库预设模板)
        { grid: [
          { label: '配料要求' },
          { key: '配料要求', span: 10, area: true },
        ]},
        // 灌料:标签行 + 值行 两行式(设计图:三个标签连在一行,数值填在**下方那一行**)
        { grid: [
          { label: '灌料', rowspan: 5 },
          { label: '理论最低灌料重量g', span: 3 },
          { label: '理论灌料中间值g', span: 3 },
          { label: '理论最高灌料重量g', span: 4 },
        ]},
        { grid: [
          { key: '理论最低灌料重量g', span: 3 },
          { key: '理论灌料中间值g', span: 3 },
          { key: '理论最高灌料重量g', span: 4 },
        ]},
        { grid: [
          { label: '理论水分', span: 2 },
          { key: '理论水分', span: 8 },
        ]},
        { grid: [
          { label: '实际灌料重量计算公式', span: 2 },
          // 背景提示词:把设计模板文字显示成灰字(填了就以填的为准)。
          // 与设计源的区别:原表是"默认值"(存进每张单),这里做成 placeholder —— 不强迫每张单都带这段文字,
          // 要真正预填成值的话走 docDefaults/列默认值,那是另一处改动。
          { key: '实际灌料重量计算公式', span: 8, ph: '实际灌料重量中间值=（1-理论水分%）/（1-实际水分%）*理论灌料重量中间值' },
        ]},
        { grid: [
          { label: '灌料要求', span: 2 },
          { key: '灌料要求', span: 8, area: true, ph: '用户输入' },
        ]},
        { grid: [
          { label: '烧结' },
          { label: '烧结炉参数', span: 2 },
          { key: '烧结炉参数', type: 'select', span: 3 },
          { label: '烧结时间/调速器参数', span: 2 },
          { key: '烧结时间调速器参数', type: 'select', span: 3 },
        ]},
        { grid: [
          { label: '热压' },
          { label: '热压要求', span: 2 },
          { key: '热压要求', span: 8, area: true },
        ]},
        { grid: [
          { label: '冷却' },
          { label: '冷却参数设置', span: 2 },
          { key: '冷却参数设置', type: 'select', span: 8 },
        ]},
        { grid: [
          { label: '脱模', rowspan: 4 },
          { label: '长度要求', cap: true, span: 6 },
          { label: '重量要求', cap: true, span: 4 },
        ]},
        { grid: [
          { label: '最短长度mm', span: 2 },
          { key: '最短长度mm', span: 4 },
          { label: '最低重量g', span: 2 },
          { key: '最低重量g', span: 2 },
        ]},
        { grid: [
          { label: '中间值mm', span: 2 },
          { key: '中间值mm', span: 4 },
          { label: '中间值g', span: 2 },
          { key: '中间值g', span: 2 },
        ]},
        { grid: [
          { label: '最长长度mm', span: 2 },
          { key: '最长长度mm', span: 4 },
          { label: '最高重量g', span: 2 },
          { key: '最高重量g', span: 2 },
        ]},
      ]},
      { page: 1, bar: '检验要求', rows: [
        // 炭棒尺寸:标签行 4 格 + 值行 4 格,标签与值同列对齐(新版面无「内孔要求」)
        { grid: [
          { label: '炭棒尺寸', rowspan: 2 },
          { label: '炭棒外径mm', span: 2 },
          { label: '炭棒外径公差mm', span: 3 },
          { label: '炭棒内径mm', span: 2 },
          { label: '炭棒内径公差mm', span: 3 },
        ]},
        { grid: [
          { key: '外径mm', span: 2 },
          { key: '外径公差', span: 3 },
          { key: '内径mm', span: 2 },
          { key: '内径公差', span: 3 },
        ]},
        { grid: [
          { label: '密度管控', rowspan: 2 },
          { label: '管控要求', span: 2 },
          { label: '实际密度管控下限', span: 4 },
          { label: '实际密度管控上限', span: 4 },
        ]},
        { grid: [
          { key: '密度管控要求', span: 2, ph: '密度范围：~' },
          { key: '实际密度管控下限', span: 4 },
          { key: '实际密度管控上限', span: 4 },
        ]},
        { grid: [
          { label: '跌落强度', rowspan: 2 },
          { label: '高度cm', span: 2 },
          { label: '跌落次数', span: 4 },
          { label: '要求', span: 4 },
        ]},
        { grid: [
          { key: '跌落高度cm', span: 2 },
          { key: '跌落次数', span: 4 },
          { key: '跌落要求', span: 4 },
        ]},
        { grid: [
          { label: '抗压强度', rowspan: 2 },
          { label: '测试间距mm', span: 2 },
          { label: '压头下降速度mm/min', span: 4 },
          { label: '强度要求kgf', span: 4 },
        ]},
        { grid: [
          { key: '测试间距mm', span: 2 },
          { key: '压头下降速度', span: 4 },
          { key: '强度要求kgf', span: 4 },
        ]},
        // 压降:块名跨 3 行 —— 第三行是设计图上的「是否测试丨 √ × 丨」(口径:压降是否抽检)
        { grid: [
          { label: '压降', rowspan: 3 },
          { label: '测试管路', span: 2 },
          { label: '测试流速L/min', span: 4 },
          { label: '压降标准kpa', span: 4 },
        ]},
        { grid: [
          { key: '压降测试管路', span: 2 },
          { key: '压降测试流速', span: 4 },
          { key: '压降标准kpa', span: 4 },
        ]},
        { grid: [
          { key: '压降是否测试', type: 'select', span: 10, ph: '是否测试丨 √ × 丨' },
        ]},
      ]},
    ];

// ⚠ 2026-09-20 起本常量归属**页 3(索引 2)**:修订记录页插到最前,原「成型工艺清单/成型配方」两页顺延。
//   除这 6 处 page 号外,常量内容一字未动(它既是页 2 的渲染来源,也是天然的回滚参考)。
const RD_MOLD_FORMULA = {
    sections: [
      { page: 2, bar: '产品基本信息', rows: [
        { grid: [
          { label: '产品编号', span: 2 },
          { label: '产品名称', span: 2 },
          { label: '炭棒规格', span: 3 },
          { label: '产品管控类型' },
          { label: '外观要求', span: 2 },
          { label: '生产车间', span: 3 },
        ]},
        { grid: [
          { key: '产品编号', span: 2 },
          { key: '产品名称', span: 2 },
          { key: '炭棒规格1' },
          { key: '炭棒规格2' },
          { key: '炭棒规格3' },
          { key: '产品管控类型', type: 'select' },
          { key: '外观要求', type: 'select', span: 2 },
          { key: '生产车间', type: 'select', span: 3 },
        ]},
      ]},
    ],
    dataTables: [
      // recipeCalc:表头上出「配方计算」按钮(读本表行 → 算 → 回填页 1 与本表两列);
      // 口径见 CONTEXT.md「配方计算器」/ docs/adr/0004 —— 弹窗输入不落库,只有回填值随单据保存
      { page: 2, bar: '配方表', autoSeqBar: true, totalCols: true, recipeCalc: true, filterKey: '表区', filterVal: '配方表', cols: [
          { key: '序号', label: 'No.' },
          { key: '物料种类', label: '物料种类', span: 2, type: 'select', options: MATERIAL_KINDS },
          { key: '物料编号', label: '物料编号', span: 4 },
          { key: '物料名称', label: '物料名称', span: 3 },
          { key: '实际添加比例', label: '实际添加\n比例%' },
          { key: '单支物料含量', label: '单支\n物料含量g' },
          { key: '设计添加量', label: '设计添加\n量' },
        ]},
    ],
    tailSections: [
      { page: 2, bar: '配料要求', rows: [
        { label: '配料要求', key: '配料要求', type: 'area' },
      ]},
    ],
  };

const recordSheetConfigs = {
  RD_ALKALINE: {
    titlePlaceholder: '伊可普碱性寿命测试',
    grid: [115, 80, 93, 98, 84, 90, 90, 90, 90, 70, 70, 85, 128],
    // 设计「碱性」第 2 行:B2:M2 公司名(12 列)+ N2 编号(1 列,裸值 " YJ-PD-01")
    head: { title: 11, infoLabel: 1, infoValue: 1, noSpan: 1, docnoPrefix: false },
    sections: [
      { bar: '1.基本信息', rows: [
        { label: '测试目的/背景', key: '测试目的/背景', type: 'area' },
        { label: '测试时间', key: '测试时间', type: 'text' },
        { label: '炭棒尺寸', key: '炭棒尺寸', type: 'text' },
        { label: '本次实验目的', key: '本次实验目的', type: 'area' },
      ]},
      { bar: '2.测试条件', rows: [
        { label: '测试仪器', key: '测试仪器', type: 'text' },
        { label: '测试装置及工位', key: '测试装置及工位', type: 'area' },
        { label: '测试方式', key: '测试方式', type: 'area' },
      ], waterStrip: true },
    ],
    waterColspans: [2, 1, 3, 2, 2, 2],
    dataTables: [
      { bar: '3.测试数据', subHeads: [
          { label: '浸泡24H口感测试(浸泡水量15.8ml）', span: 9 },
          { label: '离子分析（mg/L)', span: 4 },
        ], cols: [
          { key: '测试时间', label: '测试时间' },
          { key: '测试流速（L/min）', label: '测试流速\n（L/min）' },
          { key: '杯数(接水量100ml)', label: '杯数(接水量100ml)' },
          { key: '水温（℃）', label: '水温℃' },
          { key: 'RO水PH', label: 'RO水PH' },
          { key: 'RO水TDS', label: 'RO水TDS' },
          { key: '滤芯出水PH', label: '滤芯出水PH' },
          { key: '滤芯出水TDS', label: '滤芯出水TDS' },
          { key: 'PH提升值', label: 'PH提升值' },
          { key: '钠', label: '钠' },
          { key: '镁', label: '镁' },
          { key: '钾', label: '钾' },
          { key: '钙', label: '钙' },
        ]},
    ],
  },

  RD_MINERAL: {
    titlePlaceholder: '伊可普 RO后置矿化滤芯 纯水寿命测试',
    grid: [170, 170, 170, 170, 170],
    // 设计「矿化」第 2 行:B2:E2 公司名(4 列)+ F2 编号(1 列,裸值 "YJ-PD-01")
    head: { title: 3, infoLabel: 1, infoValue: 1, noSpan: 1, docnoPrefix: false },
    sections: [
      { bar: '1.基本信息', rows: [
        { label: '测试目的/背景', key: '测试目的/背景', type: 'area' },
        { label: '产品规格', key: '产品规格', type: 'text' },
        { label: '本次试验目的', key: '本次试验目的', type: 'area' },
      ]},
      { bar: '2.测试条件', rows: [
        { label: '测试仪器', key: '测试仪器', type: 'text' },
        { label: '测试装置', key: '测试装置', type: 'area' },
        { label: '测试标准', key: '测试标准', type: 'text' },
        { label: '测试方法', key: '测试方法', type: 'area' },
      ]},
    ],
    // 矿化:4 个指标块共用一个明细表(指标字段区分),每块右侧复刻 Excel 散点图
    dataTables: [
      { bar: '3.数据记录表', metric: '锶 mg/L', cols: [
          { key: '指标', label: '锶 mg/L', hiddenCol: true },
          { key: '测试日期', label: '测试日期' },
          { key: '累计流量L', label: '累计流量L' },
          { key: 'RO出水', label: 'RO出水', group: '锶 mg/L' },
          { key: '浸泡30min', label: '浸泡30min', group: '锶 mg/L' },
          { key: '浸泡30min煮沸晾凉', label: '浸泡30min煮沸晾凉', group: '锶 mg/L' },
        ], charts: true },
      { bar: '', metric: '偏硅酸 mg/L', cols: [
          { key: '指标', label: '偏硅酸 mg/L', hiddenCol: true },
          { key: '测试日期', label: '测试日期' },
          { key: '累计流量L', label: '累计流量L' },
          { key: 'RO出水', label: 'RO出水', group: '偏硅酸 mg/L' },
          { key: '浸泡30min', label: '浸泡30min', group: '偏硅酸 mg/L' },
          { key: '浸泡30min煮沸晾凉', label: '浸泡30min煮沸晾凉', group: '偏硅酸 mg/L' },
        ], charts: true },
      { bar: '', metric: 'PH', cols: [
          { key: '指标', label: 'PH', hiddenCol: true },
          { key: '测试日期', label: '测试日期' },
          { key: '累计流量L', label: '累计流量L' },
          { key: 'RO出水', label: 'RO出水', group: 'PH' },
          { key: '浸泡30min', label: '浸泡30min', group: 'PH' },
          { key: '浸泡30min煮沸晾凉', label: '浸泡30min煮沸晾凉', group: 'PH' },
        ], charts: true },
      { bar: '', metric: 'TDS', cols: [
          { key: '指标', label: 'TDS', hiddenCol: true },
          { key: '测试日期', label: '测试日期' },
          { key: '累计流量L', label: '累计流量L' },
          { key: 'RO出水', label: 'RO出水', group: 'TDS' },
          { key: '浸泡30min', label: '浸泡30min', group: 'TDS' },
          { key: '浸泡30min煮沸晾凉', label: '浸泡30min煮沸晾凉', group: 'TDS' },
        ], charts: true },
    ],
  },

  RD_ANTIBACT: {
    titlePlaceholder: '集芈（康立根抑菌项目）',
    grid: [117, 117, 117, 117, 117, 117, 93, 102],
    head: { title: 6, infoLabel: 1, infoValue: 1 },
    sections: [
      { bar: '1.基本信息', rows: [
        { label: '测试目的/背景', key: '测试目的/背景', type: 'area' },
        { label: '测试标准', key: '测试标准', type: 'text' },
        { label: '测试时间', key: '测试时间', type: 'text' },
        { label: '本次实验目的', key: '本次实验目的', type: 'area' },
      ]},
      { bar: '2.测试条件', rows: [
        { label: '试验用水', key: '试验用水', type: 'text' },
        { label: '测试装置/设备', key: '测试装置/设备', type: 'text' },
        { label: '冲水方式', key: '冲水方式', type: 'text' },
        { label: '测试方法', key: '测试方法', type: 'area' },
      ]},
    ],
    dataTables: [
      { bar: '3.数据记录表', cols: [
          { key: '测试日期', label: '测试日期' },
          { key: '样品信息', label: '样品信息', span: 3, area: true },
          { key: '累计流量（L）', label: '累计流量\n（L）' },
          { key: '原液浓度（cfu/ml）', label: '原液浓度\n（cfu/ml）' },
          { key: '活性氧化铝（cfu/ml）', label: '活性氧化铝\n（cfu/ml）' },
          { key: '去除率（%）', label: '去除率\n（%）' },
        ]},
    ],
    conclusion: { bar: '4.测试结论', key: '数据结论' },
  },

  RD_SCALE: {
    titlePlaceholder: '阻垢炭棒阻垢率测试',
    grid: [125, 125, 125, 125, 125, 125, 125, 125, 125, 125, 125],
    // 设计「阻垢性能」第 1 行是**一格含两段文字**:A1:J1 = 公司名 + 靠右的编号
    // "惠州市银嘉环保科技有限公司……YJ-PD-01",第 11 列 K1 空 ⇒ noSpan:0(同格)+ 右侧留 1 空列
    head: { title: 6, infoLabel: 1, infoValue: 4, noSpan: 0, noGapSpan: 1, docnoPrefix: false },
    sections: [
      { bar: '1.基本信息', rows: [
        { label: '测试目的/背景', key: '测试目的/背景', type: 'area' },
        { label: '炭棒尺寸', key: '炭棒尺寸', type: 'text' },
        { label: '特殊配方', cells: [
          { key: '特殊配方1', ph: '1#HPφ0.8mm-8g(1:2)', span: 3 },
          { key: '特殊配方2', ph: '2#HPφ0.8mm-8g(1.1:1)', span: 3 },
          { key: '特殊配方3', ph: '3#HPφ1.2mm-12g(1.1:1)', span: 4 },
        ]},
        { label: '本次实验目的', key: '本次实验目的', type: 'area' },
      ]},
      { bar: '2.测试条件', rows: [
        { label: '加标水配置', key: '加标水配置', type: 'area' },
        { label: '测试方法', key: '测试方法', type: 'area' },
      ]},
    ],
    dataTables: [
      { bar: '3.数据记录表', cols: [
          { key: '测试日期', label: '测试日期' },
          { key: '累计流量（L）', label: '累计流量（L）' },
          { key: '水温（℃）', label: '水温（℃）' },
          { key: '加标水硬度H0', label: '加标水硬度\nH0' },
          { key: '加标水烧开后硬度H1', label: '加标水烧开后硬度 H1' },
          { key: '出水硬度（0.8mm-8g(1:2)）', label: '0.8mm-8g(1:2)', group: '过滤后出水烧开后硬度H2' },
          { key: '出水硬度（0.8mm-8g(1.1:1)）', label: '0.8mm-8g(1.1:1)', group: '过滤后出水烧开后硬度H2' },
          { key: '出水硬度（1.2mm-12g(1.1:1)）', label: '1.2mm-12g(1.1:1)', group: '过滤后出水烧开后硬度H2' },
          { key: '阻垢率（0.8mm-8g(1:2)）', label: '0.8mm-8g(1:2)', group: '阻垢率（%）' },
          { key: '阻垢率（0.8mm-8g(1.1:1)）', label: '0.8mm-8g(1.1:1)', group: '阻垢率（%）' },
          { key: '阻垢率（1.2mm-12g(1.1:1)）', label: '1.2mm-12g(1.1:1)', group: '阻垢率（%）' },
        ]},
    ],
  },

  RD_RO_PROTECT: {
    titlePlaceholder: '桌面机RO保护测试',
    grid: [158, 78, 106, 78, 78, 78, 78, 78, 78, 78],
    // 设计「RO保护」第 2 行:B2:I2 公司名(8 列)/ J2 空 / K2 编号(1 列,裸值 "YJ-PD-01")
    head: { title: 6, infoLabel: 2, infoValue: 2, noSpan: 1, noGapSpan: 1, docnoPrefix: false },
    sections: [
      { bar: '1.基本信息', rows: [
        { label: '测试背景/目的', key: '测试背景/目的', type: 'area' },
        { label: '项目名称', key: '项目名称', type: 'text' },
        { label: '本次实验目的', key: '本次实验目的', type: 'area' },
      ]},
      { bar: '2.测试条件', rows: [
        { label: '试验用水', key: '试验用水', type: 'text' },
        { label: '测试装置/设备', key: '测试装置/设备', type: 'area', tall: true },
        { label: '测试方法', key: '测试方法', type: 'area' },
        { label: '冲水方式', key: '冲水方式', type: 'area' },
      ]},
      { bar: '3.测试对象信息', rows: [
        { label: '产品名/规格', key: '产品名/规格', type: 'text' },
        { label: '配方/工艺', key: '配方/工艺', type: 'area' },
      ]},
    ],
    dataTables: [
      { bar: '4.数据记录表', cols: [
          { key: '样品', label: '样品' },
          { key: '测试日期', label: '测试日期' },
          { key: '累计流量（L）', label: '累计流量\n（L）' },
          { key: '膜前压（MPa）', label: '膜前压（MPa）' },
          { key: '纯水流速(mL/min)', label: '纯水流速(mL/min)', group: '流速衰减' },
          { key: '废水流速(L/min)', label: '废水流速(L/min)', group: '流速衰减' },
          { key: '衰减率', label: '衰减率', group: '流速衰减' },
          { key: '原水（tds）', label: '原水\n（tds）', group: '脱盐率' },
          { key: '纯水（tds）', label: '纯水\n(tds)', group: '脱盐率' },
          { key: '脱盐率', label: '脱盐率', group: '脱盐率' },
        ]},
    ],
    conclusion: { bar: '5.测试结论', key: '测试结论' },
  },

  RD_SOAK: {
    titlePlaceholder: '伊可普高品质冰箱炭棒项目浸泡安全测试',
    grid: [177, 164, 204, 206, 200, 209],
    // 设计「浸泡安全」第 2 行 B2:G2 把**整行并成一格**,一格含两段文字
    // (公司名 + 靠右的编号 "……YJ-D-01")⇒ noSpan:0 同格、无空列
    head: { title: 4, infoLabel: 1, infoValue: 1, noSpan: 0, docnoPrefix: false },
    sections: [
      { bar: '1.基本信息', rows: [
        { label: '测试目的/背景', key: '测试目的/背景', type: 'area' },
        { label: '测试标准', key: '测试标准', type: 'area' },
        { label: '测试时间', key: '测试时间', type: 'text' },
        { label: '本次实验目的', key: '本次实验目的', type: 'area' },
      ]},
      { bar: '2.测试条件', rows: [
        { label: '浸泡水配置', key: '浸泡水配置', type: 'area' },
        { label: '测试方法', key: '测试方法', type: 'area', tall: true },
      ], soakBlocks: true },
    ],
    soakColspans: [1, 1, 2],
    dataTables: [
      { bar: '3.数据记录表', cols: [
          { key: '序号', label: '序号' },
          { key: '项目', label: '项目' },
          { key: '卫生要求', label: '卫生要求' },
          { key: '需求2（30*10*113）增加/改变值', label: '需求2（30*10*113）\n增加/改变值' },
          { key: '需求2（35*13*107）增加/改变值', label: '需求2（35*13*107）\n增加/改变值' },
          { key: '需求4（40.5*10*114）增加/改变值', label: '需求4（40.5*10*114）\n增加/改变值' },
        ]},
    ],
    conclusion: { bar: '4.实验结论', key: '实验结论' },
    // GB/T17219 标准 17 项卫生项目(Excel 预填;新增草稿明细为空时自动带出)
    seedRows: [
      { 序号: '1', 项目: '浑浊度', 卫生要求: '增加量≤0.2NTU' },
      { 序号: '2', 项目: '臭和味', 卫生要求: '浸泡后水无异臭、异味' },
      { 序号: '3', 项目: '肉眼可见物', 卫生要求: '浸泡后水不产生任何肉眼可见的碎片杂物等' },
      { 序号: '4', 项目: 'PH', 卫生要求: '改变量≤0.5' },
      { 序号: '5', 项目: '溶解性总固体', 卫生要求: '/' },
      { 序号: '6', 项目: '耗氧量（以O2计）', 卫生要求: '增加量≤1 mg/L' },
      { 序号: '7', 项目: '砷', 卫生要求: '增加量≤0.001 mg/L' },
      { 序号: '8', 项目: '铬', 卫生要求: '增加量≤0.005 mg/L' },
      { 序号: '9', 项目: '铝', 卫生要求: '增加量≤0.02  mg/L' },
      { 序号: '10', 项目: '铅', 卫生要求: '增加量≤0.001 mg/L' },
      { 序号: '11', 项目: '汞', 卫生要求: '增加量≤0.0001  mg/L' },
      { 序号: '12', 项目: '铁', 卫生要求: '增加量≤0.06  mg/L' },
      { 序号: '13', 项目: '锰', 卫生要求: '增加量≤0.02  mg/L' },
      { 序号: '14', 项目: '铜', 卫生要求: '增加量≤0.2  mg/L' },
      { 序号: '15', 项目: '锌', 卫生要求: '增加量≤0.2  mg/L' },
      { 序号: '16', 项目: '镍', 卫生要求: '增加量≤0.002  mg/L' },
      { 序号: '17', 项目: '银', 卫生要求: '增加量≤0.005  mg/L' },
    ],
  },

  RD_DROP_PREC: {
    titlePlaceholder: '伊可普冰箱滤芯（需求3）压降、一级精度测试',
    grid: [157, 280, 120, 100, 106, 106, 116, 116, 127, 116, 165],
    // 设计「压降、精度」第 2 行:B2:J2 公司名(9 列)/ K2 空 / L2 编号(1 列,裸值 " YJ-PD-01")
    head: { title: 9, infoLabel: 1, infoValue: 1, noSpan: 1, noGapSpan: 1, docnoPrefix: false },
    sections: [
      { bar: '1.基本信息', rows: [
        { label: '测试目的/背景', key: '测试目的/背景', type: 'area' },
        { label: '炭棒尺寸', key: '炭棒尺寸', type: 'text' },
        { label: '测试要求', key: '测试要求', type: 'area' },
      ]},
      { bar: '2.测试条件', rows: [
        { label: '测试装置及编号', key: '测试装置及编号', type: 'text' },
        { label: '测试方法', key: '测试方法', type: 'area', tall: true },
        { label: '测试用仪器/检出限', key: '测试用仪器/检出限', type: 'text' },
      ]},
    ],
    dataTables: [
      { bar: '3.数据记录表', cols: [
          { key: '测试时间', label: '测试时间' },
          { key: '配方', label: '配方', area: true },
          { key: '样品编号', label: '样品编号' },
          { key: '密度', label: '密度' },
          { key: '测试水温（℃）', label: '测试水温（℃）' },
          { key: '测试流速（L/min）', label: '测试流速（L/min）' },
          { key: '前压（kpa)', label: '前压（kpa)', group: '冲水10分钟后压降' },
          { key: '后压（kpa)', label: '后压（kpa)', group: '冲水10分钟后压降' },
          { key: '压差（kpa)', label: '压差（kpa)', group: '冲水10分钟后压降' },
          { key: '0.5-1μm颗粒物去除率-2min（%）', label: '0.5-1μm颗粒物去除率-2min（%）' },
          { key: '备注', label: '备注' },
        ]},
    ],
  },

  // ═══════════ 实验室使用记录表 4 面板(《3.实验室使用记录表》) ═══════════

  // 加标水配置记录表:3 种测试项目(除铅/除汞/除VOC)动态切换列集,明细为全字段并集
  RD_SPIKE_WATER: {
    headMode: 'plain',
    plainTitle: '加标水配置记录表',
    variantKey: '测试项目',
    variantOptions: [
      { value: 'NSF 53-除铅（PH8.5）', variant: '除铅' },
      { value: 'NSF 53-除汞（PH8.5）', variant: '除汞' },
      { value: 'NSF 53-除VOC', variant: '除VOC' },
    ],
    subtitle: { label: '测试项目：', key: '测试项目', type: 'select' },
    variants: {
      除铅: { cols: [
          { key: '测试日期', label: '测试日期', w: 90, rowspan: 2 },
          { key: '项目名称', label: '项目名称', w: 110, rowspan: 2 },
          { key: '测试装置', label: '测试装置', w: 100, rowspan: 2 },
          { key: '测试工位', label: '测试工位', w: 90, rowspan: 2 },
          { key: '配水量\\n（L）', label: '配水量\n（L）', w: 80, rowspan: 2 },
          { key: '配置用水', label: '配置用水', w: 90, rowspan: 2 },
          { key: '硫酸镁', label: '硫酸镁', w: 90, group: '试剂用量（g）' },
          { key: '二水氯化钙', label: '二水氯化钙', w: 100, group: '试剂用量（g）' },
          { key: '碳酸氢钠', label: '碳酸氢钠', w: 90, group: '试剂用量（g）' },
          { key: '4%次氯酸钠', label: '4%次氯酸钠', w: 110, group: '试剂用量（g）' },
          { key: '盐酸或氢氧化钠', label: '盐酸或氢氧化钠', w: 120, group: '试剂用量（g）' },
          { key: '可溶性铅', label: '可溶性铅', w: 90, group: '试剂用量（g）' },
          { key: '不可溶性铅', label: '不可溶性铅', w: 100, group: '试剂用量（g）' },
          { key: 'PH\\n8.5±0.25', label: 'PH\n8.5±0.25', w: 90, group: '加标水水质指标' },
          { key: 'TDS（mg/L）200-500mg/L', label: 'TDS\n（mg/L）', w: 90, group: '加标水水质指标' },
          { key: '水温（℃）\\n20±2.5℃', label: '水温（℃）\n20±2.5℃', w: 100, group: '加标水水质指标' },
          { key: '负责人', label: '负责人', w: 70, rowspan: 2 },
      ]},
      除汞: { cols: [
          { key: '测试日期', label: '测试日期', w: 90, rowspan: 2 },
          { key: '项目名称', label: '项目名称', w: 120, rowspan: 2 },
          { key: '测试装置', label: '测试装置', w: 110, rowspan: 2 },
          { key: '测试工位', label: '测试工位', w: 100, rowspan: 2 },
          { key: '配水量\\n（L）', label: '配水量\n（L）', w: 90, rowspan: 2 },
          { key: '配置用水', label: '配置用水', w: 110, rowspan: 2 },
          { key: '碳酸氢钠', label: '碳酸氢钠', w: 100, group: '试剂用量（g）' },
          { key: '二水氯化钙', label: '二水氯化钙', w: 110, group: '试剂用量（g）' },
          { key: '盐酸或氢氧化钠', label: '盐酸或氢氧化钠', w: 130, group: '试剂用量（g）' },
          { key: '汞标准溶液 \\n1000mg/L', label: '汞标准溶液 \n1000mg/L', w: 130, group: '试剂用量（g）' },
          { key: 'PH\\n8.5±0.25', label: 'PH\n8.5±0.25', w: 90, group: '加标水水质指标' },
          { key: 'TDS（mg/L）200-500mg/L', label: 'TDS（mg/L）\n200-500mg/L', w: 120, group: '加标水水质指标' },
          { key: '水温（℃）\\n20±2.5℃', label: '水温（℃）\n20±2.5℃', w: 100, group: '加标水水质指标' },
          { key: '浊度值（NTU）\\n＜1NTU', label: '浊度值（NTU）\n＜1NTU', w: 110, group: '加标水水质指标' },
          { key: '负责人', label: '负责人', w: 80, rowspan: 2 },
      ]},
      除VOC: { cols: [
          { key: '测试日期', label: '测试日期', w: 90, rowspan: 2 },
          { key: '项目名称', label: '项目名称', w: 120, rowspan: 2 },
          { key: '测试装置', label: '测试装置', w: 110, rowspan: 2 },
          { key: '测试工位', label: '测试工位', w: 100, rowspan: 2 },
          { key: '配水量\\n（L）', label: '配水量\n（L）', w: 90, rowspan: 2 },
          { key: '配置用水', label: '配置用水', w: 110, rowspan: 2 },
          { key: '氯化钠（g）', label: '氯化钠（g）', w: 110, group: '试剂用量' },
          { key: '三氯甲烷储备液\\n（1000mg/L）', label: '三氯甲烷储备液\n（1000mg/L）', w: 150, group: '试剂用量' },
          { key: 'PH\\n8.5±0.25', label: 'PH\n7.5±0.5', w: 90, group: '加标水水质指标' },
          { key: 'TDS（mg/L）200-500mg/L', label: 'TDS（mg/L)\n200-500mg/L', w: 120, group: '加标水水质指标' },
          { key: '水温（℃）\\n20±2.5℃', label: '水温（℃）\n20.0±2.5℃', w: 100, group: '加标水水质指标' },
          { key: '浊度值（NTU）\\n＜1NTU', label: '浊度值（NTU）\n＜1NTU', w: 110, group: '加标水水质指标' },
          { key: '负责人', label: '负责人', w: 80, rowspan: 2 },
      ]},
    },
    dataTables: [{}],
  },

  // ═══ 测试申请单 RD_DOM_TEST —— **一张单 三个页签**(2026-09-30 按《3.实验室使用记录表\测试申请单.xlsx》复刻)═══
  //   页 0 内部委托-测试申请单      ← sheet「内部1」(受控表单编号 YJ-RIR001)
  //   页 1 销售端-测试/检测申请表   ← sheet「外部」 (受控表单编号 YJ-XS002)
  //   页 2 委托测试汇总表           ← sheet「汇总表」(只读派生台账:本面板全部单据)
  // 两张申请表共用行表 rd_dom_test_detail,靠物理列 [表区] 分块(内部申请/外部申请)——
  // 与成型工艺清单 RD_MOLD_PROC / 组装工艺清单 RD_ASM_PROC 同一套做法(见 CONTEXT「表区是物理列」)。
  // ⚠ 页 0/页 1 各自的 grid 必须写:两页列数不同(16 列 B..Q / 9 列 B..J),共用一套会把其中一页挤变形。
  // ⚠ 纸面右上角那一格是**受控表单编号**(逐页常量,见 pages[i].docNoStatic),不是单据号:
  //   单据号在后端「新增」时自动发(DT 前缀)并出现在汇总表页与左侧选单栏;文档编号字段已不登记
  //   (登记回去会让每张单都带默认值 YJ-RIR001,第二张单保存即撞 DOC_NO_PANELS 唯一性 —— 见迁移脚本注释)。
  RD_DOM_TEST: {
    headMode: 'report',
    // 申请单类型 = 内部委托 / 销售端:决定该单属于哪一类申请(汇总表页「分类」列由它派生),
    // 也是两页表格上方那一条变体切换行(设计原表没有该行,沿用改造前的呈现,用户在这里改类型)。
    variantKey: '申请单类型',
    info: [
      { label: '文件管理人', key: '文件管理人', type: 'text' },
      { label: '密级', key: '密级', type: 'select' },
      { label: '文件使用范围', key: '文件使用范围', type: 'select' },
    ],
    // 页 0 网格 = 设计 sheet「内部1」B..Q 十六列(列宽取设计!cols,日期/申请人/紧急程度按可用性微调)
    grid: [46, 90, 80, 178, 88, 88, 74, 240, 120, 110, 120, 110, 80, 90, 90, 103],
    // 报告头三段跨度合计 = 16:大标题 B2:L4 = 11 列 | 标签 M | 值 N..Q(文件管理人/密级/文件使用范围 3 行)
    // 第 1 行「公司名 | 编号」按设计 merges 显式切分:B1:E1 = 4 列 / 空 F..M = 8 列 / 编号 N1:Q1 = 4 列
    head: { title: 11, infoLabel: 1, infoValue: 4, noSpan: 4, noGapSpan: 8, docnoPrefix: false },
    pages: [
      {
        title: '内部委托-测试申请单',
        staticTitle: '内部委托-测试申请单',
        docNoStatic: 'YJ-RIR001',
        grid: [46, 90, 80, 178, 88, 88, 74, 240, 120, 110, 120, 110, 80, 90, 90, 103],
        head: { title: 11, infoLabel: 1, infoValue: 4, noSpan: 4, noGapSpan: 8, docnoPrefix: false },
        showHead: true,
      },
      {
        title: '销售端-测试/检测申请表',
        staticTitle: '销售端-测试/检测申请表',
        docNoStatic: 'YJ-XS002',
        grid: [46, 116, 80, 188, 218, 311, 104, 104, 92],
        // 设计 merges:B2:E2 公司名 = 4 列 / 空 F..I = 4 列 / J2 编号 = 1 列;
        // 大标题 B3:H5 = 7 列 + 标签 I + 值 J
        head: { title: 7, infoLabel: 1, infoValue: 1, noSpan: 1, noGapSpan: 4, docnoPrefix: false },
        showHead: true,
      },
      {
        title: '委托测试汇总表',
        showHead: false,
        grid: [80, 200, 130, 140, 110, 140],
        // 只读派生页(不落库):渲染见 RecordSheetPanels 的 ledger 块 —— 取本面板全部单据的表头摘要。
        // cols 的 keys 是**按序回退**的候选键(不同面板的单号/日期键名不一),map 是取值后的显示映射。
        // ⚠ 汇总表「表格编号」= 单据编号(设计对照文档 §2.11 已定口径:该页属面板列表视图既有能力)。
        ledger: {
          title: '委托测试汇总表',
          pageSize: 200,
          cols: [
            { label: '序号', seq: true, w: 80, align: 'center' },
            { label: '表格编号', keys: ['单据编号', '编号', '单号'], w: 200 },
            // 发起人 = 申请单上的人:设计里它是**明细列**(内部页叫 申请人 / 外部页叫 发起人),
            // 单据表头根本没有这一项 ⇒ 必须给 detailKeys 退到明细第一行,否则整列空白(实测踩过)
            { label: '发起人', keys: ['申请人', '发起人'], detailKeys: ['申请人', '发起人'], w: 130 },
            { label: '申请日期', keys: ['单据日期', '日期'], w: 140 },
            { label: '分类', key: '申请单类型', map: { 内部委托: '内部', 销售端: '外部' }, w: 110, hint: '内部/外部' },
            { label: '状态', keys: ['单据状态'], w: 140, align: 'center', hint: '测试中/已完成/已审核' },
          ],
        },
      },
    ],
    // 测试周期说明(设计 B20:Q20 整行合并格)—— 表尾须知,与仪器使用记录表同一呈现
    // ⚠ 两张表都**不写 bar**:设计原表里表格上方没有任何"区块条",直接就是两级表头
    //   (写 bar 会在纸面上多出一条设计里没有的横条)。代价是表头不再挂 ✎字段编辑 按钮 ——
    //   与同族的加标水/设备使用/仪器使用三张实验室表一致(它们也没有 bar),管理员改别名走侧栏「字段管理」。
    dataTables: [
      {
        page: 0,
        filterKey: '表区', filterVal: '内部申请',
        footerNote: '测试周期：\n1.性能寿命测试：\n*正常：实际寿命测试时间加2-3天\n例如寿命2000L，每天500L，4天完成。总周期4+3=7天\n*加急：给样品当日安排，按要求测试周期\n2.浸泡安全测试：\n*正常：3-4天\n*加急：2天\n注：加急样品需请示冯工批准后安排。',
        cols: [
          // ⚠ key 必须写 **yj_field.label**(不是表列名):这 16 列里
          //   背景/目的·方法·标准·目标·样品处理 五个 col_name 与 label 分叉
          //   (label = 测试（检测）背景/目的 / 测试（检测）方法 / …)。
          //   改造前这里写的是 col_name ⇒ 那五列取不到值、保存还被 labelsToCols 静默丢掉
          //   (旧配置挂在 variants 下,而 keys.test.js 只查 dataTables/cover/sections ⇒ 没人拦住;
          //    2026-09-30 改挂 dataTables 后由该测试守住)。
          { key: '序号', label: '序号', rowspan: 2 },
          { key: '日期', label: '日期', rowspan: 2 },
          { key: '申请人', label: '申请人', rowspan: 2 },
          { key: '测试（检测）背景/目的', label: '测试（检测）背景/目的', rowspan: 2, area: true },
          { key: '尺寸', label: '尺寸', group: '测试（检测）样品信息' },
          { key: '配方', label: '配方', group: '测试（检测）样品信息' },
          { key: '密度', label: '密度', group: '测试（检测）样品信息' },
          { key: '测试（检测）方法', label: '测试（检测）方法', rowspan: 2, area: true },
          { key: '测试（检测）标准', label: '测试（检测）标准', rowspan: 2 },
          { key: '测试（检测）目标', label: '测试（检测）目标', rowspan: 2 },
          { key: '组装方式', label: '组装方式', rowspan: 2 },
          { key: '测完后样品样品处理', label: '测完后样品样品处理', rowspan: 2 },
          { key: '紧急程度', label: '紧急程度', rowspan: 2 },
          { key: '期望完成日期', label: '期望完成日期', rowspan: 2 },
          { key: '预计完成日期', label: '预计完成日期', rowspan: 2 },
          { key: '备注', label: '备注', rowspan: 2 },
        ],
      },
      {
        page: 1,
        filterKey: '表区', filterVal: '外部申请',
        cols: [
          { key: '序号', label: '序号' },
          { key: '日期', label: '日期' },
          { key: '发起人', label: '发起人' },
          { key: '测试（检测）内容', label: '测试（检测）内容' },
          { key: '测试（检测）背景', label: '测试（检测）背景' },
          { key: '测试（检测）目标/要求', label: '测试（检测）目标/要求' },
          { key: '是否要求送样/支数', label: '是否要求送样\n/支数' },
          { key: '是否需要提供报告', label: '是否需要提供报告' },
          { key: '备注', label: '备注' },
        ],
      },
    ],
    // 设计 sheet「内部1」第 37 行起的**固定附录**(国标可测项目一览):只读,不落库、不进单据。
    // ⚠ 项目/卫生要求/测试仪器/检出限 四列**按原文渲染不翻译**(GB/T 17219 指标与仪器型名是事实内容,
    //   与 RD_SOAK 明细行同一口径:列标签走 tt(),单元值保持原文);标题与列标签走 tt()。
    tailTables: [
      {
        page: 0,
        bar: '国标浸泡安全指标可测试列表',
        cols: [
          { key: '序号', label: '序号', w: 70, align: 'center' },
          { key: '项目', label: '项目', w: 150 },
          { key: '卫生要求', label: '卫生要求', w: 330 },
          { key: '测试仪器', label: '测试仪器', w: 260 },
          { key: '检出限', label: '检出限', w: 120, align: 'center' },
        ],
        rows: [
          { 序号: '1', 项目: '浑浊度', 卫生要求: '增加量≤0.2度（NTU）', 测试仪器: 'Q2100浊度仪（哈希）', 检出限: '0.02' },
          { 序号: '2', 项目: '臭和味', 卫生要求: '浸泡后水无异臭、异味', 测试仪器: '/', 检出限: '/' },
          { 序号: '3', 项目: '肉眼可见物', 卫生要求: '浸泡后水不产生任何肉眼可见的碎片杂物等', 测试仪器: '/', 检出限: '/' },
          { 序号: '4', 项目: 'PH', 卫生要求: '改变量≤0.5', 测试仪器: 'PH计（梅特勒FE28）', 检出限: '0.1' },
          { 序号: '5', 项目: '溶解性总固体', 卫生要求: '增加量≤10mg/L', 测试仪器: 'TDS（麦隆 PTBT1)', 检出限: '0.1' },
          { 序号: '6', 项目: '耗氧量（以O2计）', 卫生要求: '增加量≤1 mg/L', 测试仪器: '滴定装置', 检出限: '0.25' },
          { 序号: '7', 项目: '砷', 卫生要求: '增加量≤0.001 mg/L', 测试仪器: '7500CsICP-MS（岛津）', 检出限: '0.001ppm' },
          { 序号: '8', 项目: '铬', 卫生要求: '增加量≤0.005 mg/L', 测试仪器: '7500CsICP-MS（岛津）', 检出限: '0.001ppm' },
          { 序号: '9', 项目: '铝', 卫生要求: '增加量≤0.02 mg/L', 测试仪器: '7500CsICP-MS（岛津）', 检出限: '0.001ppm' },
          { 序号: '10', 项目: '铅', 卫生要求: '增加量≤0.001 mg/L', 测试仪器: '7500CsICP-MS（岛津）', 检出限: '0.001ppm' },
          { 序号: '11', 项目: '汞', 卫生要求: '增加量≤0.0001 mg/L', 测试仪器: '7500CsICP-MS（岛津）', 检出限: '0.0001ppm' },
          { 序号: '12', 项目: '铁', 卫生要求: '增加量≤0.06 mg/L', 测试仪器: '7500CsICP-MS（岛津）', 检出限: '0.001ppm' },
          { 序号: '13', 项目: '锰', 卫生要求: '增加量≤0.02 mg/L', 测试仪器: '7500CsICP-MS（岛津）', 检出限: '0.001ppm' },
          { 序号: '14', 项目: '铜', 卫生要求: '增加量≤0.2 mg/L', 测试仪器: '7500CsICP-MS（岛津）', 检出限: '0.001ppm' },
          { 序号: '15', 项目: '锌', 卫生要求: '增加量≤0.2 mg/L', 测试仪器: '7500CsICP-MS（岛津）', 检出限: '0.001ppm' },
          { 序号: '16', 项目: '镍', 卫生要求: '增加量≤0.002 mg/L', 测试仪器: '7500CsICP-MS（岛津）', 检出限: '0.001ppm' },
          { 序号: '17', 项目: '银', 卫生要求: '增加量≤0.005 mg/L', 测试仪器: '7500CsICP-MS（岛津）', 检出限: '0.001ppm' },
        ],
      },
    ],
  },

  // 设备使用登记表:7 台加标测试系统共用一版式,设备名称下拉
  RD_EQUIP_USE: {
    headMode: 'plain',
    plainTitle: '测试设备使用登记表',
    subtitle: { label: '设备名称：', key: '设备名称', type: 'select' },
    dataTables: [
      { cols: [
          { key: '使用日期', label: '使用日期', w: 100 },
          { key: '测试项目', label: '测试项目', w: 150 },
          { key: '测试标准', label: '测试标准', w: 130 },
          { key: '使用工位', label: '使用工位', w: 110 },
          // ⚠ key 必须写 **yj_field.label**(字符级一致),不是 col_name:
          //   该字段的 label 是 `设备状态\n（检查管路、阀门、启动是否正常）`,其中 \n 是**字面两字符**
          //   (库里就是反斜杠+n,不是换行);写成 col_name `设备状态` 会导致 row[key] 取不到值、
          //   保存时被 labelsToCols 丢掉 —— 2026-10-07 用户实测「填了异常情况,保存后变成 "/"」。
          //   label 只用于纸面表头显示(真换行),与数据键各司其职。
          { key: '设备状态\\n（检查管路、阀门、启动是否正常）', label: '设备状态\n（检查管路、阀门、启动是否正常）', w: 220 },
          { key: '使用人', label: '使用人', w: 100 },
          { key: '备注', label: '备注', w: 110 },
        ]},
    ],
  },

  // 仪器使用记录表:仪器名称/型号副标题 + 页脚须知
  RD_INSTR_USE: {
    headMode: 'plain',
    plainTitle: '实验室仪器使用记录表',
    subtitle: { label: '仪器名称/型号：', key: '仪器名称/型号', type: 'select' },   // 标准库(可维护)
    dataTables: [
      { cols: [
          { key: '使用日期', label: '使用日期', w: 110 },
          { key: '起止时间', label: '起止时间', w: 120 },
          // 同 RD_EQUIP_USE.设备状态:key 用 yj_field.label(库里的 `仪器状态\n√/×`、`是否内校\n√/-`,
          // \n 是字面两字符);写 col_name 会让这两格取不到值、保存时被丢掉(label 只管表头显示)。
          { key: '仪器状态\\n√/×', label: '仪器状态\n√/×', w: 90 },
          { key: '是否内校\\n√/-', label: '是否内校\n√/-', w: 90 },
          { key: '项目名称/内容', label: '项目名称/内容', w: 300 },
          { key: '用途', label: '用途', w: 120 },
          { key: '样品数量', label: '样品数量', w: 90 },
          { key: '使用人', label: '使用人', w: 100 },
          { key: '备注', label: '备注', w: 120 },
        ],
        footerNote: '请各位实验人员知悉：\n1.不进行使用登记人员，一经发现实验室负责人将不给与使用该仪器权限。\n2.态度恶劣者，实验室负责人将拒接该人员进入实验室。',
      },
    ],
  },

  // ═══════════ 产品文件 6 面板(《2.产品文件》) ═══════════

  // 成型工艺清单(炭棒工艺管控清单)+ 成型配方(炭棒配方管控清单)+ 修订记录 —— **一张单三个页签**
  //   页 0 = 修订记录(2026-09-20 新增,与组装工艺清单的修订记录页逐字一致)
  //   页 1 = 成型工艺清单(原样:纯表单,工序/检验要求按「标签行+值行」两行式)
  //   页 2 = 成型配方(原 RD_MOLD_FORMULA 的内容:产品基本信息 + 配方表 + 配料要求)
  // 页 1/页 2 两个页签共用同一套 11 列网格(A..K):配方表的 13 格在 11 列网格上分配跨度
  //(No.1 / 物料种类3[=146+64+64] / 物料编号2[=52+52+... ] 见下方配方表 cols 注释),总宽 1040 不变;
  // 页 0 只有一张自持列宽的数据表(合计 1040,与另两页左右缘对齐),不画报告头。
  RD_MOLD_PROC: {
    headMode: 'report',
    staticTitle: '炭棒工艺管控清单',
    info: [
      { label: '表单管理人', key: '表单管理人', type: 'text' },
      { label: '密级', key: '密级', type: 'select' },
      { label: '使用范围', key: '使用范围', type: 'select' },
      { label: '版本号', key: '版本号', type: 'text' },
    ],
    // 列宽再分配(2026-09-09):原 [150,130,80,120,80,80,80,120,80,60,60] 让「外观要求/生产车间」各只有 60px,
    // 下拉选值后被裁切;从富余列(产品编号 280→240、产品名称 200→170、产品管控类型 200→170、炭棒规格列 80→70)匀出,
    // 给这两列各 125px。总宽仍 1040(纸张宽度不变)。
    // 2026-09-20(用户口径):检验要求「炭棒尺寸」的 外径/内径 两块改成**各自对半平分** ——
    // 只在两个块**内部**挪列宽,块总宽 B:C=180 / D:G=310 / H:K=420 与行总宽 1040 全部不变:
    //   · 外径:B=110,C=70 ⇒ B=C=90(外径mm 90 | 外径公差 90)
    //   · 内径:D=100,E/F/G=70 ⇒ D+E=85+70=155,F+G=78+77=155(内径mm 155 | 内径公差 155)
    // 受影响的只有跨这几条内部竖线的格子,且幅度极小(产品名称 170→175、炭棒规格1/2/3 70→70/78/77);
    // B:C/D:G/H:I/J:K 这些**块宽一分未动**,其它行的格子宽度逐像素不变。
    grid: [130, 90, 90, 85, 70, 78, 77, 100, 70, 125, 125],
    head: { title: 7, infoLabel: 2, infoValue: 2 },
    // ── 页签:三页**各用各的原始版式**(合并时曾统一成 11 列并把页 2 跨列重排,已恢复原设计)──
    // showHead:true —— 页 1/页 2 原本都是**独立一张单据**(工艺管控清单 / 配方管控清单),各自有自己的报告头;
    // 并入同一张单后仍照原样各渲染各的报告头。页 0(修订记录)不出报告头:设计与组装那页一样,
    // 只有一行居中大标题 + 一行表头(靠 dt.pageTitle 出标题,靠 showHead:false 关掉报告头)。
    pages: [
      { title: '修订记录', headMode: 'report', showHead: false, grid: [130, 90, 90, 85, 70, 78, 77, 100, 70, 125, 125] },
      { title: '成型工艺清单', grid: [130, 90, 90, 85, 70, 78, 77, 100, 70, 125, 125], showHead: true },
      // 页 3 原始 13 列网格;报告头三段跨度合计 = 13,右缘与 产品基本信息/配方表/配料要求 平齐
      { title: '成型配方', grid: [101, 60, 109, 85, 52, 52, 52, 146, 64, 64, 121, 77, 57], head: { title: 7, infoLabel: 2, infoValue: 4 }, showHead: true, staticTitle: '炭棒配方管控清单' },
    ],
    sections: [...RD_MOLD_PROC_SEC0, ...RD_MOLD_FORMULA.sections],
    // 两张逻辑表共用行表 rd_mold_proc_detail ⇒ 每条都必须带 filterKey:'表区' + filterVal
    //(修订记录 / 配方表),少一条 rowsOf() 就会把整份明细当本表显示。
    dataTables: [RD_MOLD_PROC_DT_REVISION, ...RD_MOLD_FORMULA.dataTables],
    tailSections: [...RD_MOLD_FORMULA.tailSections],
  },
// 产品信息表:14 字段纯表单升级为文书面板(纸张式,与产品文件家族同视觉语言);
  // 网格 4 列(标签130/值260×2),报告头带单据日期信息块;下拉走 yj_field 字典,长文本不写 type 即多行域
  RD_PROD_INFO: {
    headMode: 'report',
    staticTitle: '产品信息表',
    // 报告头右侧信息块:**编辑人在上、单据日期在下**(用户口径:原来上下颠倒了)。
    // 设计纸面 B21:E23 右侧就是「编号：/ 编辑人 / 日期」竖排,编号即报告头右上角那一格。
    info: [
      { label: '编辑人', key: '编辑人', type: 'text' },
      { label: '单据日期', key: '单据日期', type: 'text' },
    ],
    grid: [130, 260, 130, 260],
    head: { title: 2, infoLabel: 1, infoValue: 1 },
    sections: [
      // 一、产品基本信息 = 设计 B25:E27 三行(产品编号|客户项目名称、客户料号|产品管控等级、产品功能类别|产品形态)
      // ⚠ 行宽对齐:双列行的占法是「左标签1 + 左值1 + 右标签1 + 右值1 = 4」——
      //   右值**不能再写 vspan:3**(那会变 6 列超宽,纸面直接串行;本次自检工具抓到的就是这个)。
      //   只有"整行一个值"的行才用 标签1 + vspan3。
      { bar: '一、产品基本信息', rows: [
        { pairs: [
          { label: '产品编号', key: '产品编号', type: 'text' },
          { label: '客户项目名称', key: '客户项目名称', type: 'text' },
        ]},
        { pairs: [
          { label: '客户料号', key: '客户料号', type: 'text' },
          { label: '产品管控等级', key: '产品管控等级', type: 'select' },
        ]},
        { pairs: [
          { label: '产品功能类别', key: '产品功能类别', type: 'select' },
          { label: '产品形态', key: '产品形态', type: 'select' },
        ]},
      ]},
      // 二、规格与尺寸:产品整体尺寸一行 + 炭棒尺寸一行(各整行,值区 vspan 3)
      // 炭棒尺寸按用户口径**默认分三内格**:内径 * 外径 * 长度
      // (顺照设计《产品信息表内容.xlsx》B13 填写说明原文「内径*外径*长度(模具尺寸)」),
      // 三格用 pair.cells 铺开、各带 placeholder 提示词;旧的整串 [炭棒尺寸] 退化为历史列(不进纸面)
      // 注:产品名称/产品类别/产品类型/产品分类/下单数量 保留在元数据但不进纸面(兼容历史单据)
      { bar: '二、规格与尺寸', rows: [
        { pairs: [
          { label: '产品整体尺寸', key: '产品整体尺寸', type: 'text', vspan: 3 },
        ]},
        { pairs: [
          { label: '炭棒尺寸', cells: [
            { key: '炭棒内径', ph: '内径(mm)' },
            { key: '炭棒外径', ph: '外径(mm)' },
            { key: '炭棒长度', ph: '长度(mm)' },
          ], vspan: 3 },
        ]},
      ]},
      // 三、特殊性能描述 = 设计 B31「主要性能描述」;数据键仍是 特殊性能描述(col_name 一律不改)
      { bar: '三、特殊性能描述', rows: [
        { pairs: [
          { label: '主要性能描述', key: '特殊性能描述', vspan: 3 },
        ]},
      ]},
      // 四、文件与签署 = 设计 B33 客户图纸或规格书 / B34-B35 两级审核 / B36 产品负责人 / B37 备注
      { bar: '四、文件与签署', rows: [
        { pairs: [
          // 客户图纸或规格书:附件字段(源 Excel 该格提示即"上传图片")——上传保留原文件名,点击查看,打印/PDF 只见文件名
          { label: '客户图纸或规格书', key: '客户图纸或规格书', type: 'file', vspan: 3 },
        ]},
        // 两级审批人**各占一行**(用户口径:原来挤在同一行);固定值 冯总 / 秀丽 由
        // docDefaults.js 在新建时带出(与 申请立项人/负责人 同机制,仍可人工改)。
        // 原「审核人」列保留为历史列(hidden=1 + visible=1 ⇒ 列表隐藏、表单仍可见,旧值不丢)。
        { pairs: [
          { label: '审核人（一级审批人）', key: '审核人一级', type: 'text', vspan: 3 },
        ]},
        { pairs: [
          { label: '审核人（二级审批人）', key: '审核人二级', type: 'text', vspan: 3 },
        ]},
        { pairs: [
          { label: '产品负责人', key: '责任人', type: 'text', vspan: 3 },
        ]},
        { pairs: [
          { label: '备注', key: '备注', vspan: 3 },
        ]},
      ]},
    ],
  },

// 组装工艺清单 —— **一张单 3 个页签**(2026-09-20 按《组装工艺控制.xlsx》重排)
  // 设计源 3 个 sheet 与 3 个页签一一对应:
  //   页 0 修订记录         ← sheet「修订记录」
  //   页 1 组装BOM表        ← sheet「组装工艺控制-BOM表」
  //   页 2 组装工艺清单     ← sheet「组装工艺控制-组装/包装关键控制清单」
  // 三张表共用 rd_asm_proc_detail,靠 [表区] 物理分列区分 ⇒ 每条 dataTable 都必须带
  // filterKey:'表区' + filterVal(修订记录/物料清单/关键控制清单),少一条就会串表。
  //
  // ⚠ 版式要点(踩过的坑,改 pages 时逐条核对):
  //   · **每页都要写 grid**:effGrid 退不到面板级 grid 时 secW() 会写 width:0px,
  //     而 .rs-t 是 table-layout:fixed ⇒ 整块 section 塌掉。
  //   · **showHead 必须每页显式写**:未声明时的兜底是 `activePage === 0`,
  //     页 0 恰好不需要报告头(设计与修订记录 sheet 一致),但页 1/页 2 必须 showHead:true。
  //   · headMode 每页显式写 report:面板级是 report,页 0 也用 report(靠 showHead:false 关掉
  //     报告头)而不是 plain —— plain 会走 plainTitleOf,那是**面板级、按变体**的标题,
  //     会把「…---裸棒」印到修订记录页上。
  RD_ASM_PROC: {
    headMode: 'report',
    plainTitle: '炭棒滤芯组装/包装段-关键工序控制清单',
    // 报告头(页 1/页 2 共用):公司名 + 编号 + 居中大标题 + 右侧信息栏四格。
    // 信息栏照设计 F5:G8(D5:E5..D8:E8)= 表单管理人/密级/使用范围/版本号,
    // 与成型工艺管控清单(RD_MOLD_PROC)同一套;字段见 migrate-asm-proc-redesign-2026-09-20.sql §3。
    grid: [130, 390, 130, 390],
    head: { title: 2, infoLabel: 1, infoValue: 1 },
    info: [
      { label: '表单管理人', key: '表单管理人', type: 'text' },
      { label: '密级', key: '密级', type: 'text' },
      { label: '使用范围', key: '使用范围', type: 'text' },
      { label: '版本号', key: '版本号', type: 'text' },
    ],
    pages: [
      // 页 0:设计 sheet「修订记录」只有 B6:G6 一行居中大标题 + B7 表头 ⇒ 不出报告头,
      // 由 dt.pageTitle 出标题(RD_SPEC_DOC 的修订记录页即此做法)。
      { title: '修订记录', headMode: 'report', showHead: false, grid: [130, 390, 130, 390] },
      { title: '组装BOM表', headMode: 'report', showHead: true, grid: [130, 390, 130, 390],
        staticTitle: '组装工艺控制-BOM表' },
      { title: '组装工艺清单', headMode: 'report', showHead: true, grid: [130, 390, 130, 390],
        staticTitle: '组装工艺控制-组装/包装关键控制清单' },
    ],
    // 设计两张表的 B9:G9 都是「产品基本信息」,格子相同 ⇒ 同一份声明给两页(各声明 page)。
    sections: [RD_ASM_PROC_INFO_SEC(1), RD_ASM_PROC_INFO_SEC(2)],
    // 4 个关键控制清单变体(设计《关键控制清单--标准库》4 个 sheet)各有各的纸面标题。
    // 变体内容**不在配置里** —— 内容源是 asm.proc 标准库(勾选即整表替换),
    // 这里只为"按头字段切标题"声明骨架;variants 的键必须与 工艺形态 字典 / asm.proc 的 item_code 一致。
    // ⚠ 2026-09-20 起三页都是 report,plainTitle 不再上纸(staticTitle 才是页标题);
    //   保留它是因为 confirmLib() 勾选时仍会把变体名写回 head['工艺形态'],
    //   且 variants/variantKey 的键集是测试断言⑤的三处同源之一(组5 字典 / variants / 库 item_code)。
    variants: {
      裸棒: { plainTitle: '炭棒滤芯组装/包装段-关键工序控制清单---裸棒' },
      机器包布: { plainTitle: '炭棒滤芯组装/包装段-关键工序控制清单---机器包布' },
      复合半成品: { plainTitle: '炭棒滤芯组装/包装段-关键工序控制清单---复合半成品' },
      成品: { plainTitle: '炭棒滤芯组装/包装段-关键工序控制清单---成品' },
    },
    /** 关键控制清单变体 = 产品基本信息区「工艺形态」的值(设计《关键控制清单--标准库》4 个 sheet 名)。
     *  ⚠ 4 个 sheet 是**四个独立变体**,没有"默认那个"之说 ⇒ 新单 工艺形态 为空时
     *    不假装是某一个变体:内容由用户从标准库勾选某个变体带入(勾选时一并写回 工艺形态)。 */
    variantKey: '工艺形态',
    // 列序/表区值见各常量;三页的列宽都配平到 1040(与 grid 总宽一致,打印左右缘对齐)。
    dataTables: [
      RD_ASM_PROC_DT_REVISION,
      RD_ASM_PROC_DT_BOM,
      ...RD_ASM_PROC_DT0,
    ],
  },

  // 规格书:通用模板(所有产品种类共用一套结构,规格书种类仅作单据分类)——
  // 4 页(规格书细分.xlsx):产品信息 / 修订记录 / 检验项目及标准 / 成品及包装运输
  // 检验项目及标准页:从标准库(测试项目汇总 26 类)勾选组装
  RD_SPEC_DOC: {
    headMode: 'report',
    staticTitle: '产品规格书',
    // 封面逐行 = 《规格书细分.xlsx》「封面（产品信息）」sheet 的 B8..B15(8 行)+ B17/B18 签字栏:
    //   产品类别 / 客户名称 / 客户料号 / 客户项目名称 / 应用场景 / 整体规格参数 / 产品主要性能 / 版本
    // ⚠ 原第一行「编  号」(设计 B7)2026-09-30 移到**封面右上角**渲染(设计原文本就是
    //   「公司左上 + 编号右上」,此前只渲染了公司名、编号格整个漏了)。留在这里会与右上角重复。
    //   同时该字段的数据键由「编号」改名为「产品编号」——旧键名被引擎当**单据标识**用
    //   (后端 QueryService.loadDocs 用单据编号覆盖它、ButtonService.save 又把它当单号取走),
    //   封面那格因此一直显示 DEMO-SD-002 这类单据号而不是产品编号(用户 2026-09-30 报障)。
    //   见 tools/migrate-rd-specdoc-prodno-2026-09-30.sql。
    // ⚠ label = **显示文案**(照设计原文),key = **数据键,必须是该字段当前的 yj_field.label**。
    //   两者不同正是这里要分开的原因:数据库列名 客户名 永久不变,但该字段 label 早在
    //   migrate-rd-2026-design.sql 已对齐设计改成「客户名称」⇒ 老配置写 key:'客户名' 取到的是
    //   undefined(**整格空白且保存静默丢值**)。本表修复即为此 —— 见下方 key:'客户名称'。
    /** 封面右上角「编号」格取哪个键:2026-09-30 起 = 产品编号(改名后不再与单据标识撞键) */
    coverDocNoKey: '产品编号',
    cover: {
      fields: [
        { label: '产品类别', key: '产品类别' },
        { label: '客户名称', key: '客户名称' },
        { label: '客户料号', key: '客户料号' },
        { label: '客户项目名称', key: '客户项目名称' },
        { label: '应用场景', key: '应用场景' },
        { label: '整体规格参数', key: '整体规格参数' },
        { label: '产品主要性能', key: '产品主要性能' },
        { label: '版  本', key: '版本' },
      ],
      // 设计 B17/B18:三组「角色/日期」签订栏,姓名与日期**合写一格**(如 陈秀丽/2026/06/24)——
      // 三列均为 nvarchar(200),历史值就是这种合写串,故不拆列(用户 2026-09-18 确认)。
      sign: [
        { label: '制订/日期', key: '制订日期' },
        { label: '审核/日期', key: '审核日期' },
        { label: '批准/日期', key: '批准日期' },
      ],
    },

    pages: [
      { title: '产品信息' },
      { title: '修订记录' },
      { title: '检验项目及标准' },
      { title: '成品及包装运输' },
    ],
    // 网格宽 = 真实 A4 纸宽(210mm @96dpi = 794px):封面/修订记录/检验项目及标准/成品及包装运输
    // 全部按 k=网格宽÷各自设计宽 等比缩放,整份规格书以 A4 原比例呈现(字体不出框)
    // coverTailReserve:与封面**同页**、渲染在封面之下的区块预留高度(封面画布按 A4 高减去这块)。
    // ⚠ 2026-09-30 改为 **0**:第 0 页原先封面之下还挂着 1.适用范围 / 2.整体规格参数 /
    //   3.产品主要性能 三行章节块(实测 96px),用户要求整行删除(见下方 sections 注释)——
    //   下挂内容没有了,整页就该整页给封面,再预扣 120px 只会在页脚留一块说不出用途的空白。
    //   reserve=0 ⇒ 封面画布 = A4 整高 1123px(794×297/210),coverVy = 1123/794 = 1.414
    //   (原 120 时是 1.263):字段表行距随之由 58px 放到 65px,**字号/列宽不受影响**
    //   (横向仍走 coverK = 794/767 = 1.035)。若日后又在封面下加内容,这里必须同步加回。
    //   历史沿革:曾写 220 —— 那是只读值被 `.rsp-pre{min-height:60px}` 撑成 71px/行(3×71=213)
    //   造成的误伤,已用 `.rsp-docval.rsp-pre{min-height:22px}` 拉回编辑态同高(见 _probe-spec-docrow.cjs)。
    coverTailReserve: 0,
    grid: [69, 207, 69, 166, 69, 69, 69, 76],
    head: { title: 5, infoLabel: 1, infoValue: 2 },
    sections: [
      // ⚠ 2026-09-30 **用户要求删除**第 1 页封面之下的三行:
      //     1.适用范围 / 2.整体规格参数 / 3.产品主要性能 ——
      //   「这三行字段都不要,进行删除」(报障原话)。
      //   原委(备查):《规格书细分.xlsx》「页面-产品信息」含两张设计图(封面 495×724 +
      //   本节章节块 509×87),2026-09-11 按设计把这三节从第 3 页归位到第 0 页;现按用户口径整行移除。
      //   处置口径 = **只从纸面移除**,不动数据库:
      //     · rd_spec_doc_head 的 适用范围/整体规格参数/产品主要性能 三列**保留**,
      //       yj_field 里对应字段也保留 —— 历史单据的值不丢(与 RD_PROD_INFO「产品名称」同一口径:
      //       界面上不出现,但旧值仍在库里,导出/参照仍取得到);
      //     · yj_std_lib 的 spec.section 章节库条目保留(它们是**可复用**的文案库,
      //       别的章节/面板还可能勾选,不该跟着这一次纸面调整一起删)。
      //   ⚠ 封面字段表里的「产品主要性能」(cover.fields 第 7 行)**不在删除范围**,
      //     用户删的是"下边的三行",封面那张表照旧。
      //   序号不受影响:第 3 页仍从「4.产品性能检验项目及检验标准」开始,不重排。

      // ── 第 4 页《规格书细分.xlsx》「成品及包装运输」6 节(2026-09-18 照设计补全)──
      // ⚠ **节的编号按设计原文**为 1..6(现实现原为 1 + 5/6/7/8,与设计不符,本轮改为照设计):
      //   1.关键物料列表 / 2.炭棒处理要求 / 3.包装方式 / 4.出货检验报告 / 5.运输要求 / 6.存储环境。
      // ⚠ 顺序:模板渲染次序是 **sections → dataTables**,而设计里 1.关键物料列表在最前
      //   ⇒ 第 1 节必须留在 sections 里(靠 sections 先渲染把「1.」顶到表格之前);
      //   它的表体由 dataTables 那条表渲染,紧随其下 ⇒ 呈现为「标题 → 表头 → 行」。
      //   ⚠ 而**标题只能有一个来源**:曾让第 1 节的 bar 与表的 bar 同时存在 ⇒ 同一标题
      //     渲染两遍(用户报「空余行重复了」)。故那条**表不带 bar**。
      // ⚠ 表格为何能紧跟本标题:靠前端 isAtOrBeforeTableAnchor() 把章节拆成"表前/表后"两段渲染,
      //   本节点**不需要**任何标记。曾在这里加过 tablesSlot,那是"克隆式"实现的遗迹,已废弃删除。
      { page: 3, bar: '1.关键物料列表', doc: true, rows: [] },
      { page: 3, bar: '2.炭棒处理要求', doc: true, rows: [
          { label: '炭棒处理要求', key: '炭棒处理要求', area: true, max: 2000 },
        ]},
      { page: 3, bar: '3.包装方式', doc: true, rows: [
          { label: '包装方式', key: '包装方式', area: true, max: 2000 },
        ]},
      { page: 3, bar: '4.出货检验报告', doc: true, rows: [
          { label: '出货检验报告', key: '出货检验报告', area: true, max: 2000 },
        ]},
      { page: 3, bar: '5.运输要求', doc: true, rows: [
          { label: '运输要求', key: '运输要求', area: true, max: 2000 },
        ]},
      { page: 3, bar: '6.存储环境', doc: true, rows: [
          { label: '存储环境', key: '存储环境', area: true, max: 2000 },
        ]},
    ],
    // 第 4 页的章节已并入上面的 sections(page:3);原 tailDocSections 的 6/7/8 编号与设计不符,已移除
    dataTables: [
      { page: 1, pageTitle: '修订记录', filterKey: '表区', filterVal: '修订记录',
        design: { titleSize: 21, titleTop: 24, titleGap: 61, headerH: 44, rowH: 43, fontSize: 16 },
        cols: [
          { key: '表区', label: '表区', hiddenCol: true, w: 46 },
          { key: '序号', label: '序号', w: 46 },
          { key: '更改内容', label: '更改内容', w: 140 },
          { key: '更改原因', label: '更改原因', w: 108 },
          { key: '更改时间', label: '更改时间', w: 97 },
          { key: '责任人', label: '责任人', w: 72 },
          { key: '备注', label: '备注', w: 161 },
        ]},
      // 检验项目及标准:分组式(序号|检验项目(组+子项目,检验项目表头跨 2 列)|检验要求|检验方法|检验依据)
      // 列宽=设计图 695×1019 画布测量(43/93/73/129/241/83);行高由文本驱动;标准库=测试项目汇总.xlsx 26 组 48 子项
      { page: 2, bar: '4.产品性能检验项目及检验标准', filterKey: '表区', filterVal: '检验要求', lib: true,
        design: { headerH: 32, fontSize: 13, groupCol: true },
        cols: [
          { key: '表区', label: '表区', hiddenCol: true, w: 43 },
          { key: '序号', label: '序号', w: 43, align: 'center' },
          { key: '检验项目', label: '检验项目', w: 93, align: 'center' },
          { key: '检验子项', label: '检验子项', w: 73, align: 'center', groupSub: true },
          { key: '检验要求', label: '检验要求', w: 129, align: 'left', area: true },
          { key: '检验方法', label: '检验方法', w: 241, align: 'left', area: true },
          { key: '检验依据', label: '检验依据', w: 83, align: 'left', area: true },
        ]},
      // 第 4 页 1.关键物料列表:表头照设计 B6 = 序号|物料编码|物料名称|规格参数|数量|备注。
      // ⚠ **不要给这张表加 bar**:它的标题已由上面 page:3 那个 sections 块出(为了排在表格之前),
      //    两者都有 = 同一标题渲染两遍(用户报「空余行重复了」)。
      // ⚠ filterKey/filterVal 保留:规格书全部明细共用一张 rd_spec_doc_detail,靠 [表区]='物料清单'
      //    把物料行与修订记录/检验项目行分开;删掉会把整张明细当物料显示(踩过)。
      // ⚠ 2026-10-14:MES 自建「物料清单(BOM)」功能整体删除(表 bs_bom / 面板 BOM 下架),
      //    原先挂在表上的 materialPick「从物料清单引用」按钮随之去掉;[表区]='物料清单' 只是分区值,保留。
      { page: 3, tablesAfterBar: '1.关键物料列表', filterKey: '表区', filterVal: '物料清单', cols: [
          { key: '表区', label: '表区', hiddenCol: true },
          { key: '序号', label: '序号' },
          { key: '物料编码', label: '物料编码' },
          { key: '物料名称', label: '物料名称', span: 2 },
          { key: '规格参数', label: '规格参数', span: 2, area: true },
          { key: '数量', label: '数量' },
          { key: '备注', label: '备注' },
        ]},
    ],
    // 检验项目标准库(分组):SPEC_TEST_LIB 由 tools/gen/gen-spec-testlib.cjs 从《测试项目汇总.xlsx》生成
    testLib: SPEC_TEST_LIB,
    // 第 4 页各节默认文案(照《规格书细分.xlsx》「成品及包装运输」原文;
    // 新单草稿进入编辑且字段为空时带入,人工可改)
    sectionDefaults: {
      '炭棒处理要求': '炭棒有无黑要求、有颗粒物处理要求；',
      '包装方式': '（1）按照包装规范进行包装作业；\n（2）纸箱外层左上角黏贴白色标签，标签内容包括：采购单号、物料编号、生产批号、包装箱号等信息；',
      '出货检验报告': '出货时附上产品出货检验报告',
      '运输要求': '产品在运输中应避免冲击、挤压、雨淋、受潮及化学品腐蚀。',
      '存储环境': '产品应贮存在通风良好、干燥的室内，不得与酸、碱及有腐蚀性的物品放置一起。',
    },
  },

  // 出货检验项目控制计划(出货检验计划表)—— **一张表 7 列**(2026-09-20 按设计重排)
  // 设计源:《产品开发\2.产品文件\3.检验计划表\出货检验项目控制计划.xlsx》(单 sheet,无页签)
  //   报告头 r2-r4  公司名 + 右上角 编号 YJ-QR-88 + 居中大标题 + 右侧两格信息栏(表单管理人/密级)
  //   表头块 r5-r7  三行三格;使用范围/版本号 在设计里落在 G/H 列,与 产品编号/产品功能类别 同行
  //   表体   r8-r9  7 列:序号 | 检验项目 | 检验要求 | 检验方法 | 不合格应对措施 | 检查频率 | 备注
  //   表尾   r10    跨 7 列的表尾注
  // 结构改动(加 3 个表头列 + 2 处 alias)见 tools/migrate-insp-plan-redesign-2026-09-20.sql。
  //
  // ⚠ 版式三条硬约束(改 grid/sections/cols 时逐条核对,错一条整页错位):
  //   ① grid 7 格 = 设计 B..H 的列宽(px ≈ w*7+5),总宽 1187;
  //   ② head {title:5, infoLabel:1, infoValue:1} 合计 7 = grid 格数 ⇒ 大标题跨 B..F(=870,
  //      与设计 B3:F4 的合并区同宽),信息栏落在 G/H 两列;
  //   ③ sections 每行靠 lspan/vspan 拼满 7 格,表体因列带 w 而 dtOwnsWidth ⇒ dtW = 1187。
  //      三处同宽,整页竖线才对得齐、打印左右缘才齐平。
  //
  // 【为什么没有 filterKey/filterVal】设计只有**一张表**,全部明细行都上纸。
  //   ⚠ 千万别照抄组装工艺面板那边的 filterKey:'表区' —— 本面板连 [表区] 物理列都没有
  //     (yj_field 里那条是 header 遗留),按它过滤只会得到一张空表。
  //   检验类别(必测项/型式检验)改由 libGroupKey 承载,只用于标准库勾选时落分组,不上纸。
  RD_INSP_PLAN: {
    headMode: 'report',
    docNoDefault: 'YJ-QR-88',
    titlePlaceholder: '出货检验项目控制计划',
    // 信息栏 = 设计 G3:H4 两格。设计 G5:H7 的 使用范围/版本号 **不在这里** ——
    // 它们在设计里与 产品编号/产品功能类别 同行,所以归 sections 的表头三行(见下)。
    info: [
      { label: '表单管理人', key: '表单管理人', type: 'text' },
      { label: '密级', key: '密级', type: 'select' },
    ],
    grid: [144, 144, 144, 144, 294, 165, 152],
    head: { title: 5, infoLabel: 1, infoValue: 1 },
    // 表头三行照设计 r5/r6/r7 逐格对位(每行 3 对 = 7 格;产品编号/产品功能类别/编写人 的值格跨 C:D):
    //   r5 [产品编号 | 客户项目名称 | 使用范围]
    //   r6 [产品功能类别 | 产品整体尺寸 | 版本号]
    //   r7 [编写人 | 审核人 | (版本号 的值格 rowspan:2 续占 G:H)]
    // 两处 span 都是照设计来的,不是随手写的:
    //   · 版本号 pair 带 rowspan:2 —— 设计 G6:H7 是**纵向合并**的一格(版本号占两行),
    //     所以 r7 只有 4 格,右端两列由它续占。漏写 rowspan 会让 r7 缺格、缺右边框。
    //   · 值格 vspan:2 —— 设计 C5:D5 / C6:D6 / C7:D7 都是横向两列合并。
    // 其中 客户项目名称 / 产品功能类别 / 产品整体尺寸 三格设计标了「自动填充规格书」,
    // 由选完产品编号后的 autoFillSpec 回填(见本块末尾)。
    sections: [
      { rows: [
        { pairs: [
          { label: '产品编号', key: '产品编号', type: 'text', vspan: 2 },
          { label: '客户项目名称', key: '客户项目名称', type: 'text' },
          { label: '使用范围', key: '使用范围', type: 'text' },
        ]},
        { pairs: [
          { label: '产品功能类别', key: '产品功能类别', type: 'text', vspan: 2 },
          { label: '产品整体尺寸', key: '产品整体尺寸', type: 'text' },
          { label: '版本号', key: '版本号', type: 'text', rowspan: 2 },
        ]},
        { pairs: [
          { label: '编写人', key: '编写人', type: 'text', vspan: 2 },
          { label: '审核人', key: '审核人', type: 'text' },
        ]},
      ]},
    ],
    /**
     * 「自动填充规格书」:设计里 8 个格标了这四个字 ——
     *   表头 客户项目名称 / 产品功能类别 / 产品整体尺寸,表体 序号 / 检验项目 / 检验要求 / 检验方法。
     * 语义是「**按产品编号引用之后,把对应规格书的数据自动填进来**」,落地在
     * onProdRefConfirm() → 后端 GET /api/px/specByProduct?code=。
     *   · fromKey  —— 触发字段(选完它才动手;本面板其它参照字段选完不该重灌整张表体);
     *   · head     —— 表头格 ← 规格书表头列(to=本面板数据键,from=规格书数据键);
     *   · detail   —— 表体列 ← 规格书「检验要求」行(to=本面板数据键,from=规格书数据键);
     *   · defaults —— 规格书里没有的口径列,落行时带出的默认文案(设计 r9 模板行原文,可改)。
     * ⚠ 产品功能类别 取值源是规格书的 产品类别(不是 RD_PROD_INFO.产品功能类别)——
     *   设计那一格标的是「自动填充规格书」,取值源就只有规格书一处。
     */
    autoFillSpec: {
      fromKey: '产品编号',
      head: [
        { to: '客户项目名称', from: '客户项目名称' },
        { to: '产品功能类别', from: '产品类别' },
        { to: '产品整体尺寸', from: '整体规格参数' },
      ],
      detail: [
        { to: '序号', from: '序号' },
        { to: '控制项目', from: '检验项目' },
        { to: '控制标准及要求', from: '检验要求' },
        { to: '控制方法', from: '检验方法' },
      ],
      defaults: {
        // 设计 F9 模板行的三段应对措施(与标准库各条目的 measure 同文)
        不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性',
      },
    },
    dataTables: [
      // ⚠ bar 是**必需**的:设计上没有这一条,但「⧉ 从标准库勾选」按钮只长在 bar 行里
      //   (模板 `v-if="dt.bar && !dt.pageTitle"`)—— 去掉 bar 等于砍掉本面板的标准库入口。
      //   文案取中性的「检验项目」,不假装是设计里的某个分节标题。
      // lib 必须是**数组**:openLib 用 `Array.isArray(dt.lib)` 判是否走扁平 insp.plan 库 ——
      //   写成 true 会被当成 spec.test 分组库,弹窗形态整个不对。
      // 下面这份是「库里一条都没有」(未跑种子)时的内置兜底展示,**不是真源**;
      // 有 yj_std_lib 数据时一律以库为准(真源,可在弹窗里编辑/停用/恢复)。
      { bar: '检验项目', libGroupKey: '检验类别', lib: [
        // 每行都带 检验类别 = 该条目在 yj_std_lib 里的 item_code。单表形态没有 filterVal 可推分组,
        // confirmLib 勾选落明细时靠这一格把 必测项/型式检验 带回明细行(row['检验类别'])。
        // ── 内置兜底 A:必测项 ──
        { 检验类别: '必测项', 控制项目: '*外观', 质量控制内容: '外观', 检测仪器: '目视', 控制标准及要求: '清洁、无破损无压痕，无裂纹,无倾斜等缺陷；切面平整无锯齿纹路，无明显缺角；切面无残留炭渣', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '生产量*1%', 检验内容: '检验炭棒外观是否符合要求', 控制方法: '常规抽检' },
        { 检验类别: '必测项', 控制项目: '*整体尺寸(外包无纺布)', 质量控制内容: '尺寸', 检测仪器: '游标卡尺', 控制标准及要求: '外径：46±0.5mm\n内径：9.5±0.5mm\n长度：23±0.5mm', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '生产量*1%', 检验内容: '检验整体尺寸是否符合要求', 控制方法: '常规抽检' },
        { 检验类别: '必测项', 控制项目: '*出货重量', 质量控制内容: '炭棒重量', 检测仪器: '电子秤', 控制标准及要求: '>22g', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '生产量*1%', 检验内容: '检验炭棒出货重量是否符合要求', 控制方法: '常规抽检' },
        { 检验类别: '必测项', 控制项目: '*抗压强度（裸棒）', 质量控制内容: '强度', 检测仪器: '普研PY-880', 控制标准及要求: '将炭棒水平放置在水平面板上，设置下压速度5mm/min，按测试键，仪器自动下压，断裂后读取压断时最大力压力值。\n控制标准：>50kgf', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '1PCS/一个生产批次', 检验内容: '检验炭棒抗压强度是否符合要求', 控制方法: '常规抽检' },
        { 检验类别: '必测项', 控制项目: '*压降测试', 质量控制内容: '压降', 检测仪器: '数显压力表', 控制标准及要求: '将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，测试流速0.24L/min，滤前前后接装压力表，压力表距离滤芯接口位置长度50mm，通水10min后记录压差值（滤芯前压-后压）。\n控制标准：≤25kpa', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '1PCS/一个生产批次', 检验内容: '检验炭棒压降是否符合要求', 控制方法: '常规抽检' },
        { 检验类别: '必测项', 控制项目: '*黑水及颗粒物测试（无黑后）', 质量控制内容: '黑水测试', 检测仪器: '烧杯，哈希2100q', 控制标准及要求: '将炭棒组装好装入滤瓶（透明大T），按进水方向通水，测试流速0.24±0.05L/min\n1.用烧杯接第一杯水250ml，观察出水及测试浊度值；\n2.冲水5min后，浸泡24H，陶瓷杯接出水100ml，观察出水情况及测试浊度值；\n控制标准：1.初始：轻微黑水，浊度≤20NTU\n2.浸泡24H：无肉眼可见黑水，浊度≤3NTU', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '1PCS/一个生产批次', 检验内容: '检验炭棒黑水测试是否符合要求', 控制方法: '常规抽检' },
        { 检验类别: '必测项', 控制项目: '*黑水及颗粒物测试（无黑后）', 质量控制内容: '浸泡颗粒物', 检测仪器: '烧杯', 控制标准及要求: '将炭棒组装好装入滤瓶（可旋盖大T），按进水方向通水，测试流速0.24±0.05L/min，\n完成黑水测试后，炭棒静置浸泡24H，用陶瓷杯接出水100ml，正常照明下，用肉眼观察杯底部颗粒物，颗粒物≤4颗\n控制标准：浸泡4H颗粒物≤4颗', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '1PCS/一个生产批次', 检验内容: '检验炭棒浸泡颗粒物是否符合要求', 控制方法: '常规抽检' },
        // ── 内置兜底 B:型式检验(分组名与 yj_std_lib 的 item_code 同源) ──
        { 检验类别: '型式检验', 控制项目: '*碱性性能测试', 质量控制内容: '*初始PH增加值测试', 检测仪器: 'PH计', 控制标准及要求: '将炭棒组装好装入伊可普工装，按进水方向通RO纯水（水效水500+RO机），测试流速0.24L/min,冲水5min后，浸泡30min后，测试出水PH，接水量为500ml。\n控制标准：初始PH增加值＞3.0', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '1PCS/一个生产批次', 检验内容: '检验炭棒初始PH增加值测试是否符合要求', 控制方法: '常规抽检' },
        { 检验类别: '型式检验', 控制项目: '*碱性性能测试', 质量控制内容: '*浸泡24H口感测试', 检测仪器: 'PH计、TDS笔', 控制标准及要求: '将炭棒组装好装入伊可普工装，按进水方向通RO纯水（水效水500+RO机），测试流速0.24L/min,冲水5min后，浸泡24H后，接出水（连续接五杯，接水量为100ml）及原水，测试口感、PH、TDS\n控制标准：1.五杯口感均无异常\n2.第一杯TDS增加值小于150\n3.第一杯出水PH增加值＞4.0', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '1PCS/一个生产批次', 检验内容: '检验浸泡24H口感测试是否符合要求', 控制方法: '常规抽检' },
        { 检验类别: '型式检验', 控制项目: '*碱性性能测试', 质量控制内容: '碱性寿命', 检测仪器: 'PH计', 控制标准及要求: '将炭棒组装好装入伊可普工装，全程RO纯水（水效水500+RO机）加标测试控制水温25±3℃、流速0.24L/min，在额定净水0%、25%、50%、75%、100%，浸泡30min后取炭棒滤后水进行测试记录节点流速及炭棒出水PH（寿命1000L，每天冲水约145L，测试周期约为7天）。寿命1000L，PH增加值≥0.5', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '型式检验半年一次', 取样方式: '', 检验内容: '检验炭棒碱性寿命测试是否符合要求', 控制方法: '型式检测报告' },
        { 检验类别: '型式检验', 控制项目: '余氯性能测试', 质量控制内容: '*余氯初始去除率', 检测仪器: '哈希DR3900', 控制标准及要求: '将炭棒组装好装入单筒，滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.24L/min，采用次氯酸钠原液（有效氯≥10％）稀释后进行余氯去除率的加标试验，余氯浓度控制在2.0±0.2mg/L，，通入加标水5min后取样测试，计算去除率。\n控制标准：余氯初始去除率≥99%', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '1PCS/一个生产批次', 检验内容: '检验初始余氯去除率是否符合要求', 控制方法: '常规抽检' },
        { 检验类别: '型式检验', 控制项目: '余氯性能测试', 质量控制内容: '余氯寿命测试', 检测仪器: '哈希DR3900', 控制标准及要求: '将炭棒组装好装入单筒，滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.24L/min，采用次氯酸钠原液（有效氯≥10％）稀释后进行余氯去除率的加标试验，余氯浓度控制在2.0±0.2mg/L，在额定净水0%、25%、50%、75%、100%进行取样测试。全程加标，寿命1000L， 去除率≥90%', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '型式检验半年一次', 取样方式: '', 检验内容: '检验炭棒余氯寿命测试是否符合要求', 控制方法: '型式检测报告' },
        { 检验类别: '型式检验', 控制项目: '卫生浸泡', 质量控制内容: '/', 检测仪器: '/', 控制标准及要求: '符合《生活饮用水输配水设备及防护材料卫生安全评价规范》', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '型式检验半年一次', 取样方式: '', 检验内容: '检验炭棒浸泡安全是否符合要求', 控制方法: '型式检测报告' },
      ], cols: [
        // 7 个展示列 = 设计 r8 的 B..H,列宽照抄设计列宽(grid 的 7 格同值 ⇒ 上下竖线对齐)。
        // label 写**设计原文**,key 写**该字段当前的 yj_field.label**(数据键)—— 与本文件既有口径一致。
        // 四列的设计原名实际由 yj_field.alias 提供(effColLabel 优先取 alias),这里的 label
        // 只是 fieldMap 里查不到时的兜底,顺带让配置读起来就是纸面样子。
        { key: '序号', label: '序 号', w: 144, align: 'center' },
        { key: '控制项目', label: '检验项目', w: 144 },
        { key: '控制标准及要求', label: '检验要求', w: 144, area: true },
        { key: '控制方法', label: '检验方法', w: 144, area: true },
        { key: '不合格应对措施', label: '不合格应对措施', w: 294, area: true },
        { key: '检测频率', label: '检查频率', w: 165 },
        { key: '备注', label: '备注', w: 152 },
        // 6 个不上纸的列:hiddenCol 只管**渲染**(值照常逐格往返 —— 保存链路按 yj_field 走,与 cols 无关)。
        // 上面 5 个非序号列 + 这 6 列正好是标准库 insp.plan 的规范字段(toCanonical/toInspRow 一一对应),
        // 藏的是**列**不是数据;删掉它们等于断掉标准库往返。
        // ⚠ 老配置里那条 { key: '表区' } 是**幽灵列**:rd_insp_plan_detail 根本没有 [表区] 物理列,
        //   本轮一并删掉(这也正是本面板绝不能用 filterKey:'表区' 的原因)。
        { key: '检验类别', label: '检验类别', hiddenCol: true },
        { key: '质量控制内容', label: '质量控制内容', hiddenCol: true },
        { key: '检测仪器', label: '检测仪器、工具', hiddenCol: true },
        { key: '检验', label: '检验', hiddenCol: true },
        { key: '取样方式', label: '取样方式', hiddenCol: true },
        { key: '检验内容', label: '检验内容', hiddenCol: true },
      ],
      // 表尾注(设计 r10 的 B10:H10):totalSpan(dt) = 可见列数 = 7 ⇒ 自动跨满七列
      footerNote: '若规格书有变动提示管控文件需更新' },
    ],
  },

  /**
   * 产品变更申请单(2026-09-21 新增)—— 版式照《副本变更模板(1).xlsx》sheet「KPC变更申请通知单」
   * (YJ-QR-130,走查产物 tools/archive/_walk/src-change-KPC变更申请通知单.txt):
   *   大标题「KPC管控点申请单」/ 一、基础信息 / 二、变更·新增申请事由 / 三、部门评审意见(7 行)
   *   / 三.相关变更 / 四、库存产品处理方式(原料·半成品·成品 各 数量+处理方式)/ 批准。
   * 列网格 = 纸面 B..G 实测列宽(175/324/698/232/332/202,合计 1963),上下竖线自然对齐。
   * 报告头不带信息块(纸面右侧没有密级/适用范围那四格 ⇒ info: [])。
   *
   * 与其它文书面板的三处不同,都是**用户口径**决定的:
   *   ① 部门评审意见的 7 行是**库里预置的行**(建单时后端 ensureChangeDeptRows 铺好),
   *      故该表 fixedRows=true —— 不出 ＋/× 也不出底部"新增数据记录行";
   *      lockKey/lockCols 配合 props.myDeptRows 做**行级只读**:不是本部门的行整行置灰不可编
   *      (服务端 ButtonService.gateChangeDetail 另有强制还原,界面只是先说清楚);
   *   ② 性质 / 变更文件 用 type:'checks' 复选格(存储是顿号分隔文本,不是新字段类型);
   *   ③ 签字/日期 由服务端盖章(填了「变更后内容」才盖),界面上同样只读。
   */
  RD_CHANGE: {
    headMode: 'report',
    // 纸面大标题是**印死的表单名**(YJ-QR-130 的 B2),不是每张单各写各的 ⇒ 用 staticTitle
    // (titlePlaceholder 只在没有 staticTitle 时当输入框灰字占位,不落纸)
    staticTitle: 'KPC管控点申请单',
    titlePlaceholder: 'KPC管控点申请单',
    grid: [175, 324, 698, 232, 332, 202],
    head: { title: 2, infoLabel: 1, infoValue: 1 },
    info: [],   // 纸面报告头只有公司名 + 编号 + 大标题,没有右侧信息块
    sections: [
      { bar: '一、基础信息', rows: [
        { grid: [
          { label: '文件编码' },
          { fixed: 'YJ-QR-130' },
          { label: '申请日期' },
          { key: '申请日期', span: 3 },
        ]},
        { grid: [
          { label: '申请部门' },
          { key: '申请部门', span: 2 },
          { label: '性质' },
          { key: '性质', type: 'checks', single: true, options: ['变更', '新增'], span: 2 },
        ]},
        { grid: [
          { label: '产品编码' },
          { key: '产品编号', span: 2 },
          { label: '申请人' },
          { key: '申请人', span: 2 },
        ]},
        { grid: [
          { label: '产品名称' },
          { key: '产品名称', span: 2 },
          { label: '单据编号' },
          { key: '单据编号', span: 2 },
        ]},
        // 变更类型(2026-09-30 需求 sheet「变更」底部两行:严格变更=按上述六步流程 /
        // 快捷变更=冯总审批):数据键「变更类型」,落库列走备用列池的 备用1
        // (见 tools/migrate-rd-change-kind-2026-09-30.sql);快捷变更在后端
        // **禁止提交会签**(ButtonService.submitSignoff 明确拒绝),直接提交审批即可。
        { grid: [
          { label: '变更类型' },
          { key: '变更类型', type: 'select', span: 2 },
          { label: '需会签' },
          { key: '需会签', type: 'checks', single: true, options: ['是', '否'], span: 2 },
        ]},
        // 会签(用户口径第④条):需会签=是 时「提交会签」把会签人点亮;会签人写账号,多人用逗号/顿号分隔
        { grid: [
          { label: '会签人' },
          { key: '会签人', span: 5, ph: '多人用逗号分隔（账号）' },
        ]},
      ]},
      { bar: '二、变更/新增申请事由', rows: [
        { grid: [
          { label: '变更事由' },
          { key: '变更事由', span: 5, area: true, ph: '本次要改什么、为什么改' },
        ]},
        { grid: [
          { label: '验证数据' },
          { key: '验证数据', span: 5, area: true, ph: '支持本次变更的验证数据/试验结论' },
        ]},
        // 四个受控文件的勾选(用户口径第②条):勾哪些,生效时就按哪些建下一版草稿
        { grid: [
          { label: '变更文件' },
          { key: '变更文件', type: 'checks', span: 5,
            options: ['成型工艺清单', '组装工艺清单', '规格书', '出货检验计划表'] },
        ]},
      ]},
    ],
    dataTables: [
      { page: 0, bar: '三、部门评审意见', fixedRows: true, lockKey: '部门', lockCols: ['变更后内容', '备注'],
        filterKey: '表区', filterVal: '部门评审意见',
        cols: [
          { key: '表区', label: '表区', hiddenCol: true },
          { key: '部门', label: '部门', w: 175 },
          { key: '变更后内容', label: '变更/新增申请内容', w: 1022, area: true },
          { key: '签字', label: '签字', w: 232 },
          { key: '日期', label: '日期', w: 534 },
        ]},
    ],
    tailSections: [
      { page: 0, bar: '三.相关变更', rows: [
        { grid: [
          { label: '相关变更' },
          { key: '相关变更', span: 5, area: true, ph: '与哪些文件/工序/在制品相关联' },
        ]},
      ]},
      { page: 0, bar: '四、库存产品处理方式', rows: [
        { grid: [
          { label: '原料' },
          { label: '数量' },
          { key: '原料数量' },
          { label: '处理方式' },
          { key: '原料处理方式', type: 'select', span: 2 },
        ]},
        { grid: [
          { label: '半成品' },
          { label: '数量' },
          { key: '半成品数量' },
          { label: '处理方式' },
          { key: '半成品处理方式', type: 'select', span: 2 },
        ]},
        { grid: [
          { label: '成品' },
          { label: '数量' },
          { key: '成品数量' },
          { label: '处理方式' },
          { key: '成品处理方式', type: 'select', span: 2 },
        ]},
      ]},
      { page: 0, bar: '五、其它', rows: [
        { grid: [
          { label: '文件管理人' },
          { key: '文件管理人', span: 2 },
          { label: '密级' },
          { key: '密级', type: 'select', span: 2 },
        ]},
        { grid: [
          { label: '文件使用范围' },
          { key: '文件使用范围', type: 'select', span: 2 },
          { label: '备注' },
          { key: '备注', span: 2 },
        ]},
      ]},
      // 批准行:纸面 B24:C24=批准 + D24:G24 签字区(留白手签)
      { page: 0, bar: '批准', rows: [
        { grid: [
          { label: '批准', span: 2 },
          { label: '签字', span: 2 },
          { label: '日期', span: 2 },
        ]},
        { grid: [
          { span: 2 },
          { span: 2 },
          { span: 2 },
        ]},
      ]},
    ],
  },
};

/**
 * 检验项目标准库:两个面板**各用各的库**——规格书(RD_SPEC_DOC)用 `spec.test`,
 * 出货检验计划表(RD_INSP_PLAN)用 `insp.plan`,**不共用、互不可见**
 * (2026-09-11「两面板共用同一批条目」的决定已撤销,本模块不再承担共用库的职责)。
 *
 * 本模块提供的是**两库共用的内容格式**(canonical `v=2`)与两个投影函数——
 * 两库的 JSON 形状本来就不同:
 *   · spec.test:item_code=组名,content={sub,req,method,basis}
 *   · insp.plan:item_code=表区名(必测项/型式检验),content=10 个中文键
 * 解析/保存一律先落到规范结构,再各自投影回自己那一侧的形态:
 *   toSpecSub() → 规格书子项 {name,req,method,basis}(组名由 group 承载)
 *   toInspRow() → 出货计划表行(10 个中文键)
 *
 * 历史旧格式(规格书 {sub,req,method,basis} / 出货计划 10 个中文键)**读取兼容**,
 * 用户「编辑 → 保存修改」时升级为 v2,所以旧数据同样可编辑。
 * **空字段一律留空串,不丢字段**:投影到不承载该字段的一侧是空列,而不是被删掉。
 */

/** 规范结构的当前版本:加字段/改映射时递增,便于迁移脚本判断是否需要转换 */
const CANONICAL_VERSION = 2;

/** 空的规范条目 */
function emptyEntry() {
  return {
    v: CANONICAL_VERSION, group: '', name: '', req: '', method: '', basis: '',
    quality: '', instrument: '', inspect: '', freq: '', content: '', measure: '', sampling: '',
  }
}

function isCanonical(o) {
  return !!o && typeof o === 'object' && !Array.isArray(o) && Number(o.v) === CANONICAL_VERSION
}

/** 旧规格书内容 {sub,req,method,basis} + item(组名) → 规范结构 */
function fromSpecLegacy(c, item) {
  return {
    ...emptyEntry(),
    group: str(item),
    name: str(c.sub),
    req: str(c.req),
    method: str(c.method),
    basis: str(c.basis),
  }
}

/** 旧出货计划内容(10 个中文键) + item(表区名) → 规范结构 */
function fromInspLegacy(c, item) {
  return {
    ...emptyEntry(),
    group: str(item),
    name: str(c['控制项目']),
    req: str(c['控制标准及要求']),
    method: str(c['控制方法']),
    quality: str(c['质量控制内容']),
    instrument: str(c['检测仪器']),
    inspect: str(c['检验']),
    measure: str(c['不合格应对措施']),
    freq: str(c['检测频率']),
    sampling: str(c['取样方式']),
    content: str(c['检验内容']),
  }
}

/**
 * 任意历史内容 → 规范结构(幂等;坏内容退化为空条目并把 group 记为 item,不抛异常)。
 * @param {string|object} content yj_std_lib.content(JSON 字符串或已解析对象)
 * @param {string} item item_code(旧库:规格书=组名,出货计划=表区名)
 */
function toCanonical(content, item) {
  let c = content;
  if (typeof c === 'string') {
    try { c = JSON.parse(c); } catch { c = null; }
  }
  if (isCanonical(c)) return { ...emptyEntry(), ...c }
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { ...emptyEntry(), group: str(item) }
  // 判据:出现出货计划专有中文键 → 按出货计划解析;否则按规格书解析
  const looksInsp = ['控制项目', '控制标准及要求', '控制方法', '质量控制内容'].some((k) => k in c);
  return looksInsp ? fromInspLegacy(c, item) : fromSpecLegacy(c, item)
}

/** 规范结构 → 规格书子项(组名不在这里,由调用方按 group 归组) */
function toSpecSub(e) {
  return { name: str(e && e.name), req: str(e && e.req), method: str(e && e.method), basis: str(e && e.basis) }
}

/** 规范结构 → 出货计划表行(10 个中文键固定齐全,缺的就是空串) */
function toInspRow(e) {
  return {
    控制项目: str(e && e.name),
    质量控制内容: str(e && e.quality),
    检测仪器: str(e && e.instrument),
    控制标准及要求: str(e && e.req),
    检验: str(e && e.inspect),
    不合格应对措施: str(e && e.measure),
    检测频率: str(e && e.freq),
    取样方式: str(e && e.sampling),
    检验内容: str(e && e.content),
    控制方法: str(e && e.method),
  }
}

/** 提交给 /stdlib/add|update 的 content(规范化 JSON 字符串) */
function toContentJson(e) {
  return JSON.stringify({ ...emptyEntry(), ...e })
}

function str(v) {
  return v === undefined || v === null ? '' : String(v).trim()
}

/**
 * 纸张右上角「编号：」格该绑哪个数据键。
 *
 * 面板两种命名口径并存(见 CONTEXT.md「数据键」):
 *   · 文档/规格书类面板(RD_SPEC_DOC、数据记录表系列……)编号字段叫「文档编号」;
 *   · 单据类面板(成型工艺清单 RD_MOLD_PROC、组装工艺 RD_ASM_PROC……)编号字段叫「单据编号」。
 *
 * 渲染器(RecordSheetPanels.vue)原来的可编辑分支写死 `head['文档编号']` ⇒ 单据类面板
 * **编辑期间那格永远空白**(库里/提示里都有号,就是纸上看不见);只读分支因为写了
 * `head['文档编号'] || head['单据编号']` 兜底才正常 —— 所以这个缺陷只在"填单子的时候"出现,
 * 2026-09-21 由真人流程 e2e 探针(_probe-moldproc-e2e.cjs ①-2b/⑨-1b)抓到。
 *
 * @param {Record<string, unknown>|null|undefined} head 单据表头(键为该面板的字段名)
 * @returns {'文档编号'|'单据编号'} 该面板实际使用的编号键
 */
function docNoKeyOf(head) {
  return head && Object.prototype.hasOwnProperty.call(head, '文档编号') ? '文档编号' : '单据编号'
}

/**
 * 「自动填充规格书」的失败口径(出货检验计划表 RD_INSP_PLAN ← 规格书 RD_SPEC_DOC)。
 *
 * 用户口径(2026-09-21):
 *   「出货检验计划表检验方法按规格书自动填充/带入,避免重复选择。
 *     必须得规格书已经填写提交审批完才可以在选择产品编码时自动填充带入。」
 * 即:规格书没走完提交审批(草稿/审批中/…)时,**一个格都不许自动带入** ——
 * 拿未定稿的检验方法去填出货检验计划,等于把没批准的检验口径发到产线。
 *
 * 门禁在后端(权威):/api/px/specByProduct 只挑「已审核/已归档」的规格书,
 * 没挑到就返回 found:false + reason:'not_approved' + 是哪一张、什么状态;
 * 本模块只负责把那个 payload 翻成界面要说的人话口径(纯函数,有单测)。
 *
 * @param {{found?: boolean, reason?: string, 规格书编号?: string, 规格书状态?: string}|null} payload 后端返回值
 * @returns {null | {kind: 'not_approved'|'no_spec', specNo: string, status: string}} null = 拿得到规格书
 */
function specCarryFailure(payload) {
  const p = payload || {};
  if (p.found) return null
  if (p.reason === 'not_approved') {
    return {
      kind: 'not_approved',
      specNo: String(p['规格书编号'] ?? '').trim(),
      status: String(p['规格书状态'] ?? '').trim(),
    }
  }
  return { kind: 'no_spec', specNo: '', status: '' }
}

/**
 * 归一:去掉**所有**空白(含换行)。
 * 口径理由:检验要求/检验方法里的换行与空格是排版差异(「目视检查」写成「目视 检查」、
 * 「≤5 kPa」写成「≤5kPa」),工艺员不认为这是规格书变动;为它弹"规格书已变动"是假告警,
 * 会让提示失去可信度。反过来真改字(≤5→≤6、目视→仪器)仍然会被抓到。
 */
const norm = (v) => String(v ?? '').replace(/\s+/g, '');

/**
 * 出货检验计划表「当前内容」vs「规格书」的差异 —— 「规格书变动就提示」的判据。
 *
 * 用户口径(2026-09-21):「出货检验根据规格书进行录入,检验项根据规格书一致,能自动填入,
 *   规格书变动就提示当前出货检验进行提示。」
 * 实现口径:**只比内容,不比单号** —— 这样"同一张规格书改了内容"和"出了新版本规格书"两种情况
 * 都能提示到(系统里规格书改版本来就是新建一张单据 + 版本号,只比单号会漏)。
 * 对齐键 = 检验项目名(本单字段叫 控制项目,纸面都显示"检验项目");
 * 逐项比 检验要求 与 检验方法(本单 控制标准及要求 / 控制方法)。
 *
 * @param {Array<{检验项目?: string, 检验要求?: string, 检验方法?: string}>|null} specRows 规格书「检验要求」行
 * @param {Array<Record<string, any>>|null} planRows 本单明细行(键用本面板字段名)
 * @returns {{added: string[], removed: string[], changed: Array<{item: string, fields: string[]}>, drifted: boolean}}
 */
function specDrift(specRows, planRows) {
  const empty = { added: [], removed: [], changed: [], drifted: false };
  const specs = (specRows || []).map((r) => ({ item: norm(r?.['检验项目']), req: norm(r?.['检验要求']), method: norm(r?.['检验方法']) })).filter((r) => r.item);
  const plans = (planRows || []).map((r) => ({ item: norm(r?.['控制项目']), req: norm(r?.['控制标准及要求']), method: norm(r?.['控制方法']) })).filter((r) => r.item);
  // 一边空:没有可比的内容(该走"没有可带入的规格书"那条提示,不在这里报"变动")
  if (!specs.length || !plans.length) return empty

  const specByItem = new Map(specs.map((r) => [r.item, r]));
  const planByItem = new Map(plans.map((r) => [r.item, r]));
  const added = specs.filter((r) => !planByItem.has(r.item)).map((r) => r.item);
  const removed = plans.filter((r) => !specByItem.has(r.item)).map((r) => r.item);
  const changed = [];
  for (const s of specs) {
    const p = planByItem.get(s.item);
    if (!p) continue
    const fields = [];
    if (s.req !== p.req) fields.push('检验要求');
    if (s.method !== p.method) fields.push('检验方法');
    if (fields.length) changed.push({ item: s.item, fields });
  }
  return { added, removed, changed, drifted: added.length + removed.length + changed.length > 0 }
}

/**
 * 配方计算引擎常量 —— 逐字对齐《炭棒工艺配方设计器》exe 的 `app.domain.constants`
 * (PyInstaller 归档取出的真源码,ENGINE_VERSION 1.0.0)。
 *
 * ⚠ 改任何常量或公式都必须同时:
 *   ① 升 ENGINE_VERSION;② 重跑 `node --test src/core/mold/recipeEngine.test.js`
 *   (黄金向量由 exe 真引擎产出,见 tools/archive/_gen-recipe-golden.py)。
 */


/** 圆周率取 3.14 —— 不是 Math.PI(用真 π 会与车间沿用了多年的口径差千分之 0.5) */
const PI = 3.14;

/** 体积换算除数:mm³ → cm³ 的 1000 × 圆面积的 4,合起来就是 π×d²/4000 */
const VOLUME_DIVISOR = 4000;

/** 成型长度的固定料头 10mm */
const BLANK_LENGTH_BASE = 10;

/** 每个腔额外加的料头 3mm */
const BLANK_LENGTH_PER_CAVITY = 3;

/** 成型长度公差默认 ±2.5mm */
const DEFAULT_LENGTH_TOL = 2.5;

/** 脱模重量漂移系数默认 1.0(设计源 Excel 用硬编码 99.5%/100.5%,exe 改为可输入) */
const DEFAULT_DEMOLD_LOW_FACTOR = 1.0;
const DEFAULT_DEMOLD_HIGH_FACTOR = 1.0;

/** 料位分组(0 基):粉料 5 位 / 胶粉 2 位 / 折算料 3 位 */
const POWDER_SLOTS = [0, 1, 2, 3, 4];
const GLUE_SLOTS = [5, 6];
const CONVERTED_SLOTS = [7, 8, 9];

/** 折算比的合法区间,越界只告警不拦 */
const CONVERSION_RATIO_MIN = 0.0;
const CONVERSION_RATIO_MAX = 1.0;

/** 结果里的 strategy 固定值(原表口径:补差位兜底) */
const STRATEGY_LEGACY = 'LEGACY';

/** 料位总数 */
const SLOT_COUNT = 10;

/**
 * 配方计算引擎 —— 炭棒配方 12 步计算的**唯一实现**(前端)。
 *
 * 真源 =《炭棒工艺配方设计器》exe 的 `app.domain.engine.compute`(ENGINE_VERSION 1.0.0)。
 * 本文件是把那份 Python 逐条搬过来的:**表达式次序、运算结合性、缺省兜底、告警文案都与它对齐**,
 * 因为验收口径是"与 exe 逐位一致"(浮点同一个 double 才敢用 === 比),不是"看起来对"。
 * 期望值由 `tools/archive/_gen-recipe-golden.py` 从 exe 真引擎产出,固化为 __fixtures__/。
 *
 * 单位口径(容易踩,写在最前面):
 *   - 粉料/胶粉料位传 `design_ratio` = **小数**(0.62 表示 62%),不是百分数;
 *   - 折算料料位传 `amount_g` = **克/支**(引擎自己乘腔数);
 *   - `moisture` = 小数(0.06 表示 6%),null/''/缺键都按"未采集"处理并告警。
 *
 * 与 Python 的两处有意差异(都只影响错误路径,不影响任何正常输入的结果):
 *   ① 配方不是恰好 10 个料位 → 明确报错(Python 会 IndexError);
 *   ② 必填参数缺失/非数字 → 明确报错(Python 会 KeyError/ValueError)。
 *   原因是弹窗里的输入来自单据与手填,"静默算成 NaN"比"报错"危险得多。
 */

/** 必填参数:缺失或非有限数就报错(对齐 Python 的 float(params['x']) 会炸的语义) */
function need(params, key) {
  const raw = params[key];
  if (raw === undefined || raw === null) throw new Error(`配方计算缺少必填参数:${key}`)
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`配方计算参数 ${key} 不是数字:${raw}`)
  return value
}

/** 可选参数:缺键取默认值,但**取到 null 也报错**(对齐 Python 的 float(None) 会炸) */
function optionalNum(params, key, fallback) {
  const raw = params[key] !== undefined ? params[key] : fallback;
  return need({ [key]: raw }, key)
}

/** Python `x or 0` 再 float():None/''/0/False 都归零,其余按数取 */
const pyOrZero = (v) => (v === undefined || v === null || v === '' || v === 0 || v === false ? 0 : Number(v));

/** Python `sum(list)`:从 0 起左到右累加(Python 3.10 是朴素求和,3.12 起改补偿求和,别用新版本生成黄金向量) */
function sumList(list) {
  let total = 0;
  for (const v of list) total += v;
  return total
}

/**
 * 计算配方结果。
 *
 * @param {object} params {od, id, length(炭棒长度mm), cavities(一切几), density_low, density_high,
 *                          conversion_ratio(折算比), length_tol_low/length_tol_high(成型长度公差,
 *                          老键 length_tol 兜底,默认 2.5), demold_low_factor/demold_high_factor(默认 1.0)}
 * @param {Array} recipe 10 个料位:粉料/胶粉位给 design_ratio(小数),折算料位给 amount_g(克/支),
 *                       每位可给 moisture(小数,null/'' 按未采集)
 * @returns {object} 全量中间结果(12 步逐条对应,供弹窗预览与回填)
 */
function compute(params, recipe) {
  if (!Array.isArray(recipe) || recipe.length !== SLOT_COUNT) {
    throw new Error(`配方必须恰好 ${SLOT_COUNT} 个料位,当前 ${Array.isArray(recipe) ? recipe.length : 0} 个`)
  }

  const warnings = [];
  const od = need(params, 'od');
  const id_ = need(params, 'id');
  const length = need(params, 'length');
  const n = Math.trunc(need(params, 'cavities'));
  const densityLow = need(params, 'density_low');
  const densityHigh = need(params, 'density_high');
  const conversionRatio = need(params, 'conversion_ratio');
  // 老键 length_tol 兜底(单据历史 payload 用过单值公差)
  const tolPick = (key) => (params[key] !== undefined ? params[key]
    : (params.length_tol !== undefined ? params.length_tol : DEFAULT_LENGTH_TOL));
  const lengthTolLow = need({ length_tol_low: tolPick('length_tol_low') }, 'length_tol_low');
  const lengthTolHigh = need({ length_tol_high: tolPick('length_tol_high') }, 'length_tol_high');
  const demoldLowFactor = optionalNum(params, 'demold_low_factor', DEFAULT_DEMOLD_LOW_FACTOR);
  const demoldHighFactor = optionalNum(params, 'demold_high_factor', DEFAULT_DEMOLD_HIGH_FACTOR);

  if (densityLow > densityHigh) warnings.push('密度下限大于上限，请检查密度管控范围');
  if (!(CONVERSION_RATIO_MIN <= conversionRatio && conversionRatio <= CONVERSION_RATIO_MAX)) {
    warnings.push('折算比应在 0~1 之间');
  }

  // ── 第 1~3 步:成型长度三值与体积 ──
  const lengthStd = length * n + (BLANK_LENGTH_BASE + n * BLANK_LENGTH_PER_CAVITY);
  const lengthLow = lengthStd - lengthTolLow;
  const lengthHigh = lengthStd + lengthTolHigh;

  const k = (od * od - id_ * id_) / VOLUME_DIVISOR * PI;
  const volLow = k * lengthLow;
  const volStd = k * lengthStd;
  const volHigh = k * lengthHigh;

  // ── 第 4~5 步:干重与折算炭粉量 ──
  const densityMid = (densityLow + densityHigh) / 2;
  const dryUnconverted = volStd * densityMid;

  const convAmounts = CONVERTED_SLOTS.map((i) => pyOrZero(recipe[i].amount_g) * n);
  const gramSum = sumList(convAmounts);
  const convertedCarbon = gramSum * conversionRatio;

  const dryLow = volHigh * densityLow - convertedCarbon + gramSum;
  const dryStd = volStd * densityMid - convertedCarbon + gramSum;
  const dryHigh = volLow * densityHigh - convertedCarbon + gramSum;

  // ── 第 6 步:脱模重量(漂移系数) ──
  const demoldLow = dryLow * demoldLowFactor;
  const demoldHigh = dryHigh * demoldHighFactor;
  const demoldMid = (demoldLow + demoldHigh) / 2;

  // ── 第 7~8 步:设计比例合计与粉料块 ──
  const powderRatios = POWDER_SLOTS.map((i) => pyOrZero(recipe[i].design_ratio));
  const glueRatios = GLUE_SLOTS.map((i) => pyOrZero(recipe[i].design_ratio));
  const powderRatioSum = sumList(powderRatios);
  const glueRatioSum = sumList(glueRatios);
  const totalDesign = powderRatioSum + glueRatioSum;
  if (Math.abs(totalDesign - 1.0) > 1e-6) {
    warnings.push(`1~7 位设计比例合计为 ${totalDesign.toFixed(4)} ≠ 1，请检查配方配平`);
  }

  const powderBlockUnconverted = dryUnconverted * powderRatioSum;
  const powderBlockConverted = powderBlockUnconverted - convertedCarbon;
  const glueAmounts = glueRatios.map((r) => r * dryUnconverted);
  const glueSum = sumList(glueAmounts);
  const total = powderBlockConverted + glueSum + gramSum;

  // ── 第 9~10 步:最终比例(料位1 补差)与单支克重 ──
  const finalRatios = new Array(SLOT_COUNT).fill(0);
  POWDER_SLOTS.slice(1).forEach((i) => { finalRatios[i] = powderRatios[i]; });
  GLUE_SLOTS.forEach((i, idx) => { finalRatios[i] = total ? glueAmounts[idx] / total : 0.0; });
  CONVERTED_SLOTS.forEach((i, idx) => { finalRatios[i] = total ? convAmounts[idx] / total : 0.0; });
  finalRatios[0] = 1.0 - sumList(finalRatios.slice(1));
  if (finalRatios[0] < 0) warnings.push('料位 1 添加比例为负（折算料投加量超过总量），请复核折算料用量');

  const finalAmounts = finalRatios.map((r) => r * total);

  // ── 第 11 步:含水分添加量(只有粉料位按含水率反算) ──
  const wetAmounts = [];
  for (let i = 0; i < SLOT_COUNT; i += 1) {
    const item = recipe[i];
    let moisture = item.moisture === undefined ? null : item.moisture;
    let wet;
    if (POWDER_SLOTS.includes(i)) {
      if (moisture === null || moisture === '') {
        warnings.push(`料位 ${i + 1} 水分未采集，按 0 计，请补充含水率`);
        moisture = 0.0;
      }
      moisture = Number(moisture);
      const dryFactor = 1 - moisture;
      wet = dryFactor !== 0 ? finalAmounts[i] / dryFactor : finalAmounts[i];
    } else {
      wet = finalAmounts[i];
    }
    wetAmounts.push(wet);
  }

  // ── 第 12 步:理论水分(物料平均水分)与混合料水分参考 ──
  const moistValues = POWDER_SLOTS.map((i) => {
    const m = recipe[i].moisture;
    return (m === null || m === undefined || m === '') ? 0.0 : Number(m)
  });

  const numeratorPm = sumList(POWDER_SLOTS.map((i) => powderRatios[i] * moistValues[i]));
  const denominatorPm = totalDesign;
  const powderAvgMoisture = denominatorPm ? numeratorPm / denominatorPm : 0.0;

  const numeratorMm = sumList(POWDER_SLOTS.map((i) => wetAmounts[i] * moistValues[i]));
  const denominatorMm = sumList(POWDER_SLOTS.map((i) => wetAmounts[i]));
  const mixedMoisture = denominatorMm ? numeratorMm / denominatorMm : 0.0;

  /** 灌料湿重 = 干重 /(1 − 物料平均水分) */
  const pour = (dry) => {
    const dryFactor = 1 - powderAvgMoisture;
    return dryFactor ? dry / dryFactor : dry
  };
  const pourLow = pour(dryLow);
  const pourStd = pour(dryStd);
  const pourHigh = pour(dryHigh);
  const actualMoisture = pourStd ? 1 - demoldMid / pourStd : 0.0;

  return {
    strategy: STRATEGY_LEGACY,
    warnings,
    params: {
      od,
      id: id_,
      length,
      cavities: n,
      density_low: densityLow,
      density_high: densityHigh,
      density_mid: densityMid,
      conversion_ratio: conversionRatio,
      length_tol_low: lengthTolLow,
      length_tol_high: lengthTolHigh,
      demold_low_factor: demoldLowFactor,
      demold_high_factor: demoldHighFactor,
    },
    lengths: { low: lengthLow, std: lengthStd, high: lengthHigh },
    k,
    volumes: { low: volLow, std: volStd, high: volHigh },
    dry_unconverted: dryUnconverted,
    conv_amounts: convAmounts,
    gram_sum: gramSum,
    converted_carbon: convertedCarbon,
    dry_weights: { low: dryLow, std: dryStd, high: dryHigh },
    demold: { low: demoldLow, mid: demoldMid, high: demoldHigh },
    powder_ratio_sum: powderRatioSum,
    powder_block_unconverted: powderBlockUnconverted,
    powder_block_converted: powderBlockConverted,
    glue_amounts: glueAmounts,
    glue_sum: glueSum,
    total,
    final_ratios: finalRatios,
    final_amounts: finalAmounts,
    wet_amounts: wetAmounts,
    moisture: { powder_avg: powderAvgMoisture, mixed: mixedMoisture },
    pour_weights: { low: pourLow, std: pourStd, high: pourHigh },
    actual_moisture: actualMoisture,
  }
}

/**
 * 配方表 ⇄ 计算引擎的接线逻辑(纯函数,不碰 Vue)。
 *
 * 三件事:
 *   ① `slotsFromRows`  单据页 2「配方表」的行 → 引擎的 10 个料位
 *   ② `paramsFromHead` 单据头字段 + 参数集 → 引擎入参
 *   ③ `buildPatch`     引擎结果 → 回填补丁(页 1 十一个格 + 配方表两列)
 *
 * 单位与口径(与 recipeEngine 的头注一致,这里再钉一次):
 *   - 粉料/胶粉行的「设计添加量」= **比例**。单据上人可能填小数(0.62)也可能填百分数(62),
 *     故 `parseRatio` 做容错解释并对"按百分数解释"标记出来,弹窗会把它显示给用户看;
 *   - 折算料行的「设计添加量」= **克/支**(引擎自己乘腔数),若直接当比例会算出荒谬的料位1 补差;
 *   - 料位 1 恒为**补差位**(= 1 − Σ料位2~7),与演示程序一致 —— 单据上第 1 行填的值不参与计算,
 *     弹窗把它显示为只读并标注来源。
 *
 * 已知局限(写下来而不是装作没有):
 *   料位分组按「物料种类」判定(与演示程序的料位可选物料一致)。若有人把「功能料-粉末」的物料
 *   当成折算料填在第 8~10 行,它会被分到粉料位、结果就错了。弹窗会显示每个料位的实际分组,
 *   且粉料超过 5 行会告警 —— 但根子上要靠"物料种类填对"或后续加一列显式料位号来根治。
 */

const SLOT_GROUPS = { POWDER: '粉料', GLUE: '胶粉', CONVERTED: '折算料' };

/** 物料种类 → 料位分组(与演示程序 料位↔可选物料 的对应关系一致) */
function groupOfMaterialType(type) {
  const t = String(type ?? '').trim();
  if (!t) return ''
  if (t.includes('胶粉')) return SLOT_GROUPS.GLUE
  if (t.includes('颗粒') || t.includes('折算物料')) return SLOT_GROUPS.CONVERTED
  if (t.includes('炭粉') || t.includes('粉末')) return SLOT_GROUPS.POWDER
  return ''
}

/** 「设计添加量」→ 比例:小数原样,'62'/'62%' 按百分数解释(并标记,弹窗要提示) */
function parseRatio(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null
  const explicitPercent = raw.includes('%');
  const num = Number(raw.replace('%', '').trim());
  if (!Number.isFinite(num)) return null
  if (explicitPercent) return { value: num / 100, percentAssumed: false }
  if (num > 1) return { value: num / 100, percentAssumed: true }
  return { value: num, percentAssumed: false }
}

/** 数值文本(折算料的克/支) */
function parseNumber(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null
  const num = Number(raw.replace('%', '').trim());
  return Number.isFinite(num) ? num : null
}

/**
 * 弹窗那一格「含水率%」→ 引擎要的小数。
 * 弹窗标签与 exe 前端一致用百分数(exe 把物料的 0.06 显示成 6.0),
 * 而引擎的 moisture 是小数 —— 少这一步换算,填 6 会被当成 600%,灌料湿重直接算飞。
 */
function moisturePercent(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null
  const num = Number(raw.replace('%', '').trim());
  return Number.isFinite(num) ? num / 100 : null
}

/** 「密度范围：0.56~0.58」这类文本 → [下限, 上限] */
function parseDensityRange(text) {
  const raw = String(text ?? '');
  const m = raw.match(/(\d+(?:\.\d+)?)\s*[~～\-—至]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null
  const low = Number(m[1]);
  const high = Number(m[2]);
  return Number.isFinite(low) && Number.isFinite(high) ? [low, high] : null
}

/**
 * 配方表的行 → 10 个料位。
 * @returns {{slots: Array, warnings: string[]}} slots 恒为 10 个(不足补空位),每个含
 *   {slot, group, code, name, designRatio, amountG, moisture, rowIndex, derived, issue}
 */
function slotsFromRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const warnings = [];
  const buckets = { [SLOT_GROUPS.POWDER]: [], [SLOT_GROUPS.GLUE]: [], [SLOT_GROUPS.CONVERTED]: [] };
  const capacity = { [SLOT_GROUPS.POWDER]: POWDER_SLOTS.length, [SLOT_GROUPS.GLUE]: GLUE_SLOTS.length, [SLOT_GROUPS.CONVERTED]: CONVERTED_SLOTS.length };

  list.forEach((r, rowIndex) => {
    const kind = r?.['物料种类'];
    const group = groupOfMaterialType(kind);
    const name = r?.['物料名称'] || r?.['物料编号'] || '';
    if (!group) {
      warnings.push(`第 ${rowIndex + 1} 行「${name || '未填物料'}」的物料种类「${kind ?? ''}」认不出来，暂按粉料处理，请核对物料档案的物料种类`);
      buckets[SLOT_GROUPS.POWDER].push({ rowIndex, row: r, issue: 'unknown-type' });
      return
    }
    if (buckets[group].length >= capacity[group]) {
      warnings.push(`${group}料位最多 ${capacity[group]} 个，第 ${rowIndex + 1} 行已忽略（请合并或调整配方行）`);
      return
    }
    buckets[group].push({ rowIndex, row: r });
  });

  const slots = [];
  const push = (group, slotNo, entry) => {
    const r = entry?.row;
    const designText = r?.['设计添加量'];
    const isConverted = group === SLOT_GROUPS.CONVERTED;
    const parsed = parseRatio(designText);
    // ⚠ 只有粉料/胶粉位才谈得上"比例" —— 折算料位的设计值本来就是克/支,>1 是正常的,
    //   对它报"已按百分数解释"是假告警(界面探针实测到过),会把工艺员引去改一个本来就对的格。
    if (!isConverted && parsed?.percentAssumed) {
      warnings.push(`料位 ${slotNo} 的「设计添加量」填的是 ${String(designText).trim()}，已按百分数解释为 ${(parsed.value * 100).toFixed(2)}%`);
    }
    slots.push({
      slot: slotNo,
      group,
      code: r?.['物料编号'] || '',
      name: r?.['物料名称'] || '',
      designRatio: isConverted ? null : (parsed ? parsed.value : (r ? 0 : null)),
      amountG: isConverted ? (parseNumber(designText) ?? 0) : null,
      moisture: null,
      rowIndex: entry ? entry.rowIndex : -1,
      derived: slotNo === 1,
      issue: entry?.issue || '',
    });
  };

  POWDER_SLOTS.forEach((_, i) => push(SLOT_GROUPS.POWDER, i + 1, buckets[SLOT_GROUPS.POWDER][i]));
  GLUE_SLOTS.forEach((_, i) => push(SLOT_GROUPS.GLUE, i + 6, buckets[SLOT_GROUPS.GLUE][i]));
  CONVERTED_SLOTS.forEach((_, i) => push(SLOT_GROUPS.CONVERTED, i + 8, buckets[SLOT_GROUPS.CONVERTED][i]));

  // 料位 1 恒为补差位:1 − Σ(料位2~7)
  const others = slots.filter((s) => s.slot >= 2 && s.slot <= 7).reduce((sum, s) => sum + (s.designRatio || 0), 0);
  slots[0].designRatio = 1 - others;
  if (slots[0].designRatio < 0) {
    warnings.push(`料位 1 的补差比例算出来是负的（${(slots[0].designRatio * 100).toFixed(2)}%），说明料位 2~7 的比例合计已超过 100%，请核对设计添加量`);
  }
  return { slots, warnings }
}

/**
 * 档案面板查询结果 → 行数组。
 * ⚠ 档案面板返回**主从结构**(list[0].detail.items[]),平铺数组也兜住;停用的行剔除 ——
 * 否则工艺员会在弹窗里选到一个已经停用的模具。
 */
function sinterRowsFromQuery(data) {
  const d = (data && data.data !== undefined) ? data.data : data;
  const list = Array.isArray(d) ? d : (d?.list || d?.rows || []);
  const rows = [];
  list.forEach((m) => {
    const items = m?.detail?.items || m?.detail?.children;
    if (Array.isArray(items)) rows.push(...items);
    else if (m && typeof m === 'object') rows.push(m);
  });
  const isOff = (v) => v === true || v === 1 || v === '1' || v === 'Y' || v === '是' || String(v ?? '').trim() === 'True';
  return rows.filter((r) => !isOff(r['停用']))
}

/** 按车间挑行:表里 `1/3` 这种写法表示两个车间共用该型号,所以按 '/' 拆开匹配 */
function sinterRowsForWorkshop(rows, workshop) {
  const w = String(workshop ?? '').trim();
  if (!w) return rows || []
  return (rows || []).filter((r) => String(r?.['车间'] ?? '').split('/').map((s) => s.trim()).includes(w))
}

/** 选中行 → 引擎要的外径/内径(取不到给 null,交给 paramsFromHead 回退单据) */
function sinterParams(row) {
  const toNum = (k) => {
    const v = Number(String(row?.[k] ?? '').trim());
    return Number.isFinite(v) ? v : null
  };
  return { od: toNum('炭棒外径'), id: toNum('炭棒内径') }
}

/** 选中行 → 页 1「检验要求 · 炭棒尺寸」四格(设计口径:炭棒尺寸引用模具尺寸表) */
function sinterPatch(row) {
  const pick = (k) => String(row?.[k] ?? '').trim();
  return { 外径mm: pick('炭棒外径'), 外径公差: pick('炭棒外径公差'), 内径mm: pick('炭棒内径'), 内径公差: pick('炭棒内径公差') }
}

/** 文本 → 数字(空/非数字给 null,别把 null 当 0 比) */
function numOf(v) {
  const s = String(v ?? '').trim();
  if (!s) return null
  const n = Number(s);
  return Number.isFinite(n) ? n : null
}

/**
 * 按外径/内径在烧结尺寸表里找型号(「按产品规格一键带出」用它自动选中型号)。
 * 口径:
 *   · 先只看**正好等于单据车间**的行;没有再用 sinterRowsForWorkshop(把 `1/3` 这类共用行按 / 拆开);
 *   · 该车间里没有这个规格就返回 '' —— **不跨车间乱选**(选错车间等于选错模具);
 *   · 命中多行也返回 ''(宁可让人手选,也不猜)。
 * @returns {string} 型号(带括号说明的原样文本),没匹配到给 ''
 */
function matchSinterModel(rows, workshop, od, id) {
  const w = String(workshop ?? '').trim();
  const list = rows || [];
  const odN = numOf(od);
  const idN = numOf(id);
  if (odN === null || idN === null) return ''
  const exact = w ? list.filter((r) => String(r?.['车间'] ?? '').trim() === w) : [];
  const pool = exact.length ? exact : (w ? sinterRowsForWorkshop(list, w) : list);
  const hit = pool.filter((r) => numOf(r?.['炭棒外径']) === odN && numOf(r?.['炭棒内径']) === idN);
  return hit.length === 1 ? String(hit[0]?.['型号'] ?? '').trim() : ''
}

/**
 * 一张单据表头里的密度范围:上下限优先,只有「密度管控要求」文本时按 parseDensityRange 解析。
 * 解析口径只此一处(带出/带出历史筛选/校验都走它),免得两处规则漂移。
 * @returns {{low: string, high: string}|null} 取不到给 null(不猜)
 */
function densityOf(row) {
  let low = String(row?.['实际密度管控下限'] ?? '').trim();
  let high = String(row?.['实际密度管控上限'] ?? '').trim();
  if (!low || !high) {
    const range = parseDensityRange(row?.['密度管控要求']);
    if (range) { low = String(range[0]); high = String(range[1]); }
  }
  return low && high ? { low, high } : null
}

/**
 * 「按产品规格一键带出」:产品信息行 + 该产品最近一张已保存单据 → 页 1 该补的格。
 *
 * 数据来源(都不编造,取不到就如实报 missing):
 *   · 炭棒规格 1/2/3(外径/内径/长度)← 产品信息表 RD_PROD_INFO 的 炭棒外径/炭棒内径/炭棒长度;
 *   · 密度上下限 ← 该产品最近一张成型工艺清单(densityOf:上下限,或解析「密度管控要求」文本)。
 *
 * 硬口径:**只填空格**。工艺员已经填过的格一律不动,值不同则记进 skipped 交给界面提示
 * (静默覆盖等于偷偷改掉人已确认的工艺参数)。
 *
 * @param {{[k:string]: any}|null} product 产品信息行(可为 null/{}:取不到)
 * @param {{[k:string]: any}|null} history 该产品最近一张单据的表头行(可为 null)
 * @param {{[k:string]: any}|null} head 当前单据表头
 * @returns {{patch: Record<string,string>, skipped: string[], missing: string[]}}
 */
function specCarryFrom(product, history, head) {
  const h = head || {};
  const p = product || {};
  const patch = {};
  const skipped = [];
  const missing = [];
  const put = (key, val) => {
    const v = String(val ?? '').trim();
    if (!v) return
    const old = String(h[key] ?? '').trim();
    if (old) { if (old !== v) skipped.push(key); return }
    patch[key] = v;
  };

  const specs = [['炭棒规格1', p['炭棒外径']], ['炭棒规格2', p['炭棒内径']], ['炭棒规格3', p['炭棒长度']]];
  if (specs.some(([, v]) => String(v ?? '').trim())) specs.forEach(([k, v]) => put(k, v));
  else missing.push('炭棒规格');

  const dens = densityOf(history);
  if (dens) {
    put('实际密度管控下限', dens.low);
    put('实际密度管控上限', dens.high);
  } else missing.push('密度');

  return { patch, skipped, missing }
}

/** 引擎入参:尺寸/密度读单据,工艺参数来自参数集(弹窗传入) */
function paramsFromHead(head, overrides = {}) {
  const h = head || {};
  const pick = (...keys) => {
    for (const k of keys) {
      const v = parseNumber(h[k]);
      if (v !== null) return v
    }
    return null
  };
  // 尺寸优先取弹窗里选中的烧结尺寸行(表 rd_sinter_tolerance),没选才回退单据上的炭棒规格/外径内径
  const overOd = parseNumber(overrides.od);
  const overId = parseNumber(overrides.id);
  const od = overOd !== null ? overOd : pick('炭棒规格1', '外径mm');
  const id = overId !== null ? overId : pick('炭棒规格2', '内径mm');
  const length = pick('炭棒规格3');
  let densityLow = pick('实际密度管控下限');
  let densityHigh = pick('实际密度管控上限');
  if (densityLow === null || densityHigh === null) {
    const range = parseDensityRange(h['密度管控要求']);
    if (range) {
      if (densityLow === null) densityLow = range[0];
      if (densityHigh === null) densityHigh = range[1];
    }
  }

  const missing = [];
  if (od === null) missing.push('外径');
  if (id === null) missing.push('内径');
  if (length === null) missing.push('长度');
  if (densityLow === null) missing.push('密度下限');
  if (densityHigh === null) missing.push('密度上限');

  const params = {
    od,
    id,
    length,
    cavities: Number(overrides.cavities ?? 1),
    density_low: densityLow,
    density_high: densityHigh,
    conversion_ratio: Number(overrides.conversion_ratio ?? 0.5),
    length_tol_low: Number(overrides.length_tol_low ?? DEFAULT_LENGTH_TOL),
    length_tol_high: Number(overrides.length_tol_high ?? DEFAULT_LENGTH_TOL),
    demold_low_factor: Number(overrides.demold_low_factor ?? 1),
    demold_high_factor: Number(overrides.demold_high_factor ?? 1),
  };
  return { params, missing }
}

/** 位数口径(照《炭棒BOM及工艺信息表单需求设计内容》):灌料/脱模/长度 1 位,水分 2 位,比例 2 位带 % */
const fixed = (x, digits) => (Number.isFinite(x) ? x.toFixed(digits) : '');

/**
 * 把物料档案里的含水率(bs_inv.水分含量,小数)并进弹窗输入。
 * 口径:只有粉料位的含水率参与计算(胶粉/折算料不进公式),所以只填粉料位;
 * **用户手改过的格不许被覆盖**(touched 下标),档案没有的物料编号记进 missingCodes 让人手填。
 * @returns {{values: string[], filledSlots: number[], missingCodes: string[]}} values 是百分数字符串(与输入框同单位)
 */
function applyArchiveMoisture(slots, current, touched, archiveByCode) {
  const values = Array.isArray(current) ? current.slice() : [];
  while (values.length < SLOT_COUNT) values.push('');
  const touchedSet = new Set(touched || []);
  const archive = archiveByCode || {};
  const filledSlots = [];
  const missingCodes = [];
  slots.slice(0, SLOT_COUNT).forEach((s, i) => {
    if (s.group !== SLOT_GROUPS.POWDER || !s.code) return
    if (touchedSet.has(i)) return
    const hit = archive[s.code];
    if (hit === undefined || hit === null) { missingCodes.push(s.code); return }
    const pct = Number(hit) * 100;
    if (!Number.isFinite(pct)) { missingCodes.push(s.code); return }
    // 去掉多余的 0:0.06 → '6'、0.055 → '5.5'(与输入框的人读习惯一致)
    values[i] = String(Number(pct.toFixed(2)));
    filledSlots.push(s.slot);
  });
  return { values, filledSlots, missingCodes }
}

/** 引擎结果 → 回填补丁(只含有行或有值的料位;空料位不产生行补丁)
 *  extraHead:额外要写的头字段(如烧结尺寸表带出的外径mm/外径公差/内径mm/内径公差);
 *  **引擎算出来的项优先**,extraHead 只补它没有的键 —— 免得外部传错键把算好的值覆盖掉。 */
function buildPatch(result, slots, extraHead) {
  const p = result.params;
  const head = { ...(extraHead || {}) };
  const engineHead = {
    理论最低灌料重量g: fixed(result.pour_weights.low, 1),    理论灌料中间值g: fixed(result.pour_weights.std, 1),
    理论最高灌料重量g: fixed(result.pour_weights.high, 1),
    理论水分: fixed(result.moisture.powder_avg * 100, 2),
    最短长度mm: fixed(result.lengths.low, 1),
    中间值mm: fixed(result.lengths.std, 1),
    最长长度mm: fixed(result.lengths.high, 1),
    最低重量g: fixed(result.demold.low, 1),
    中间值g: fixed(result.demold.mid, 1),
    最高重量g: fixed(result.demold.high, 1),
    实际密度管控下限: fixed(p.density_low, 2),
    实际密度管控上限: fixed(p.density_high, 2),
  };
  Object.assign(head, engineHead);   // 引擎算出来的项优先
  const rows = [];
  slots.forEach((s, i) => {
    if (s.rowIndex < 0) return
    rows.push({
      rowIndex: s.rowIndex,
      code: s.code,
      实际添加比例: `${fixed(result.final_ratios[i] * 100, 2)}%`,
      单支物料含量: fixed(result.final_amounts[i], 2),
    });
  });
  return { head, rows }
}

/* unplugin-vue-components disabled */

const _hoisted_1$1 = { class: "rcd" };
const _hoisted_2$1 = { class: "rcd-note" };
const _hoisted_3$1 = { class: "rcd-sec-h" };
const _hoisted_4$1 = { class: "rcd-sec-t" };
const _hoisted_5$1 = { class: "rcd-muted" };
const _hoisted_6$1 = { class: "rcd-params" };
const _hoisted_7$1 = { class: "rcd-pf-lb" };
const _hoisted_8$1 = { class: "rcd-sec-h" };
const _hoisted_9$1 = { class: "rcd-sec-t" };
const _hoisted_10$1 = { class: "rcd-muted" };
const _hoisted_11$1 = { class: "rcd-params" };
const _hoisted_12$1 = { class: "rcd-pf" };
const _hoisted_13$1 = { class: "rcd-pf-lb" };
const _hoisted_14$1 = { class: "rcd-pf" };
const _hoisted_15$1 = { class: "rcd-pf-lb" };
const _hoisted_16$1 = { class: "rcd-pf" };
const _hoisted_17$1 = { class: "rcd-pf-lb" };
const _hoisted_18$1 = { class: "rcd-r-v" };
const _hoisted_19$1 = { class: "rcd-sec-h" };
const _hoisted_20$1 = { class: "rcd-sec-t" };
const _hoisted_21$1 = { class: "rcd-muted" };
const _hoisted_22$1 = {
  key: 0,
  class: "rcd-muted"
};
const _hoisted_23$1 = { class: "rcd-tb" };
const _hoisted_24$1 = { style: {"width":"52px"} };
const _hoisted_25$1 = { style: {"width":"74px"} };
const _hoisted_26$1 = { style: {"width":"130px"} };
const _hoisted_27$1 = { style: {"width":"150px"} };
const _hoisted_28$1 = { style: {"width":"110px"} };
const _hoisted_29$1 = { style: {"width":"110px"} };
const _hoisted_30$1 = { style: {"width":"110px"} };
const _hoisted_31$1 = { class: "rcd-c" };
const _hoisted_32$1 = { class: "rcd-c" };
const _hoisted_33$1 = { class: "rcd-c" };
const _hoisted_34$1 = { class: "rcd-c" };
const _hoisted_35$1 = {
  key: 1,
  class: "rcd-muted"
};
const _hoisted_36$1 = ["title"];
const _hoisted_37$1 = { class: "rcd-c" };
const _hoisted_38$1 = { class: "rcd-c" };
const _hoisted_39$1 = { class: "rcd-sec-h" };
const _hoisted_40$1 = { class: "rcd-sec-t" };
const _hoisted_41$1 = {
  key: 0,
  class: "rcd-warn"
};
const _hoisted_42$1 = {
  key: 0,
  class: "rcd-grid"
};
const _hoisted_43$1 = { class: "rcd-r-lb" };
const _hoisted_44$1 = { class: "rcd-r-v" };
const _hoisted_45$1 = {
  key: 1,
  class: "rcd-warns"
};
const _hoisted_46$1 = { class: "rcd-sec-h" };
const _hoisted_47$1 = { class: "rcd-sec-t" };
const _hoisted_48$1 = { class: "rcd-muted" };
const _hoisted_49$1 = {
  key: 2,
  class: "rcd-two"
};
const _hoisted_50$1 = { class: "rcd-tb" };
const _hoisted_51$1 = { style: {"width":"110px"} };
const _hoisted_52$1 = { style: {"width":"110px"} };
const _hoisted_53$1 = { class: "rcd-c rcd-old" };
const _hoisted_54$1 = { class: "rcd-c" };
const _hoisted_55$1 = { key: 0 };
const _hoisted_56$1 = {
  colspan: "3",
  class: "rcd-muted"
};
const _hoisted_57$1 = { class: "rcd-tb" };
const _hoisted_58$1 = { style: {"width":"110px"} };
const _hoisted_59$1 = { style: {"width":"110px"} };
const _hoisted_60$1 = { class: "rcd-c" };
const _hoisted_61$1 = { class: "rcd-c" };
const _hoisted_62$1 = { class: "rcd-old" };
const _hoisted_63$1 = { class: "rcd-c" };
const _hoisted_64$1 = { class: "rcd-old" };
const _hoisted_65$1 = { key: 0 };
const _hoisted_66$1 = {
  colspan: "4",
  class: "rcd-muted"
};
const _hoisted_67$1 = { class: "rcd-note" };
const _hoisted_68$1 = { class: "rcd-foot" };

/**
 * 配方计算弹窗(2026-09-20)。
 *
 * 口径见 CONTEXT.md「配方计算器(Recipe Calculator)」与 docs/adr/0004:
 *   - 公式 = 与《炭棒工艺配方设计器》exe 逐位一致(core/mold/recipeEngine.js),本弹窗不做任何计算;
 *   - 输入(工艺参数/含水率)**不落库、不打印**;只有回填进单据字段的值随单据保存;
 *   - 配方真源 = 当前单据页 2 配方表(本弹窗读它、写回同一行);
 *   - 可调参数(一切几/折算比/公差/漂移)= 系统默认 + 按产品编号覆盖,落标准库 yj_std_lib
 *     (lib=mold.calcparam,条目名=产品编号,条目名"默认"为系统默认),维护界面用现成的 StdLibManager。
 */
const LIB = 'mold.calcparam';
const DEFAULT_ITEM = '默认';

const _sfc_main$1 = {
  __name: 'RecipeCalcDialog',
  props: {
  modelValue: { type: Boolean, default: false },
  head: { type: Object, required: true },
  rows: { type: Array, default: () => [] },
},
  emits: ['update:modelValue', 'applied'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;

const PARAM_FIELDS = [
  { key: 'cavities', label: '一切几', def: 1 },
  { key: 'conversion_ratio', label: '折算比', def: 0.5 },
  { key: 'length_tol_low', label: '成型长度公差下限mm', def: DEFAULT_LENGTH_TOL },
  { key: 'length_tol_high', label: '成型长度公差上限mm', def: DEFAULT_LENGTH_TOL },
  { key: 'demold_low_factor', label: '脱模下限漂移系数', def: 1 },
  { key: 'demold_high_factor', label: '脱模上限漂移系数', def: 1 },
];
const builtinDefaults = () => Object.fromEntries(PARAM_FIELDS.map((f) => [f.key, String(f.def)]));

const form = reactive(builtinDefaults());
const moisture = ref(Array(10).fill(''));
const moistureTouched = ref([]);          // 用户手改过的料位下标(档案不许覆盖)
const archiveFilled = ref([]);            // 本次由档案带出的料位号(界面上标「档案」)
const archiveTip = ref('');
const paramEntryId = ref(null);
const paramScopeTip = ref('');
const paramLibVisible = ref(false);

/* ── 烧结尺寸表(60 行模具↔炭棒内外径公差对照):选了型号 ⇒ 尺寸以表为准 + 回填页 1 检验要求四格 ── */
const sinterRows = ref([]);
const sinterWorkshop = ref('');
const sinterModel = ref('');
const sinterTip = ref('');
const sinterWorkshops = computed(() => [...new Set(sinterRows.value.map((r) => String(r['车间'] ?? '').trim()).filter(Boolean))]);
const sinterRowsInWorkshop = computed(() => sinterRowsForWorkshop(sinterRows.value, sinterWorkshop.value || String(props.head?.['生产车间'] ?? '')));
const sinterRow = computed(() => sinterRowsInWorkshop.value.find((r) => String(r['型号'] ?? '').trim() === sinterModel.value) || null);
const sinterSummary = computed(() => {
  const r = sinterRow.value;
  if (!r) return tt('未选型号 —— 尺寸按单据上的炭棒规格')
  return `${tt('外径')} ${r['炭棒外径']} ${r['炭棒外径公差']} / ${tt('内径')} ${r['炭棒内径']} ${r['炭棒内径公差']}`
});

/** 车间默认取单据上的生产车间;表里 `1/3` 这类写法由 sinterRowsForWorkshop 按 '/' 拆开匹配 */
function onSinterWorkshopChange() { sinterModel.value = ''; }

async function loadSinterRows() {
  sinterTip.value = tt('正在读取烧结尺寸表…');
  try {
    const res = await request.post('/px/queryFormDataList', {
      panelCode: 'RD_SINTER_TOL', condition: {}, pageNo: 1, pageSize: 500,
    });
    sinterRows.value = sinterRowsFromQuery(res);
    sinterTip.value = sinterRows.value.length
      ? `· ${tt('来自烧结尺寸表')} ${sinterRows.value.length} ${tt('个型号')}`
      : `· ${tt('尺寸表没有可用行')}`;
  } catch {
    // 权限/接口异常都按"读不到"处理:退回单据上手填,不阻断计算(探测过的 403 场景)
    sinterRows.value = [];
    sinterTip.value = `· ${tt('读不到烧结尺寸表（可能没有该面板权限），尺寸按单据上手填')}`;
  }
}

/** 维护入口:直接开那个档案面板(它没有侧栏菜单,入口就放在用它的人手边) */
function openSinterTable() {
  const url = `${location.origin}${location.pathname}#/panelx/list/RD_SINTER_TOL`;
  window.open(url, '_blank');
}

/** 参数库维护:改完(编辑/停用/恢复启用)立刻把当前产品的参数重新载入,免得界面还显示旧值 */
function openParamLib() { paramLibVisible.value = true; }
async function onParamLibChanged() {
  paramEntryId.value = null;
  const key = productCode.value || DEFAULT_ITEM;
  try {
    const hit = await fetchParam(key);
    if (hit) applyEntry(hit);
    else if (key !== DEFAULT_ITEM) {
      const sys = await fetchParam(DEFAULT_ITEM);
      if (sys) applyEntry(sys);
      else { paramScopeTip.value = `${scopeTip()}；${tt('标准库里还没有系统默认条目，当前用内置默认值')}`; }
    }
  } catch { /* 读不到就保持当前值,不打断 */ }
}

const productCode = computed(() => String(props.head?.['产品编号'] || '').trim());
const scopeTip = () => (productCode.value ? `${tt('当前产品')}：${productCode.value}` : tt('当前单据没有产品编号，参数只能按系统默认用'));
const onDirtyInput = () => { /* 输入即触发 computed 重算,这里只作为 el-input 的挂钩点 */ };
/** 含水率手感:用户改过的料位记下来,后续档案加载不再覆盖它 */
function onMoistureInput(i) {
  if (!moistureTouched.value.includes(i)) moistureTouched.value = [...moistureTouched.value, i];
}

const overrides = computed(() => {
  const base = Object.fromEntries(
    Object.entries(form).map(([k, v]) => [k, Number(String(v).trim())]).filter(([, v]) => Number.isFinite(v)));
  // 选了烧结尺寸 ⇒ 外径/内径以表为准(engine 入参用 od/id 覆盖,单据上的炭棒规格退居兜底)
  if (sinterRow.value) {
    const sp = sinterParams(sinterRow.value);
    if (sp.od !== null) base.od = sp.od;
    if (sp.id !== null) base.id = sp.id;
  }
  return base
});

const slots = computed(() => slotsFromRows(props.rows).slots
  // 弹窗输入是百分数(exe 前端同款),引擎吃小数 —— 换算在 recipeSheet.moisturePercent 里,有单测
  .map((s, i) => ({ ...s, moisture: moisturePercent(moisture.value[i]) })));

const parsed = computed(() => {
  const { params, missing } = paramsFromHead(props.head, overrides.value);
  if (missing.length) return { missing }
  try {
    return { params, result: compute(params, slots.value.map((s) => ({ design_ratio: s.designRatio, amount_g: s.amountG, moisture: s.moisture }))) }
  } catch (e) {
    return { error: e.message }
  }
});
const result = computed(() => parsed.value.result || null);
const blockReason = computed(() => {
  if (parsed.value.missing?.length) return `${tt('单据上还缺')}：${parsed.value.missing.join('、')}${tt('（请先在页 1 填好，或补齐密度管控范围）')}`
  if (parsed.value.error) return parsed.value.error
  return ''
});
const patch = computed(() => (result.value
  ? buildPatch(result.value, slots.value, sinterRow.value ? sinterPatch(sinterRow.value) : null)
  : null));
const rowWarnings = computed(() => slotsFromRows(props.rows).warnings);
/** 空料位不必报"水分未采集"(那不是问题,是没这个料位) */
const visibleWarnings = computed(() => {
  const emptySlots = slots.value.filter((s) => s.rowIndex < 0).map((s) => s.slot);
  const engineWarnings = (result.value?.warnings || []).filter((w) => !emptySlots.some((n) => w.startsWith(`料位 ${n} `)));
  return [...rowWarnings.value, ...engineWarnings]
});

const fixed = (x, d) => (Number.isFinite(x) ? x.toFixed(d) : '—');
const isPowder = (s) => s.group === '粉料';
const designText = (s) => {
  if (s.rowIndex < 0) return '—'
  if (s.group === '折算料') return `${fixed(s.amountG, 2)} g/支`
  const base = `${fixed((s.designRatio || 0) * 100, 2)}%`;
  return s.derived ? `${tt('补差')} ${base}` : base
};
const cell = (i, kind) => {
  if (!result.value) return '—'
  const v = kind === 'ratio' ? result.value.final_ratios[i] * 100 : result.value.final_amounts[i];
  return kind === 'ratio' ? `${fixed(v, 2)}%` : fixed(v, 2)
};
const resultRows = computed(() => {
  if (!result.value) return []
  const r = result.value;
  return [
    { label: '理论最低灌料重量g', value: fixed(r.pour_weights.low, 1) },
    { label: '理论灌料中间值g', value: fixed(r.pour_weights.std, 1) },
    { label: '理论最高灌料重量g', value: fixed(r.pour_weights.high, 1) },
    { label: '理论水分', value: `${fixed(r.moisture.powder_avg * 100, 2)}%` },
    { label: '最短长度mm', value: fixed(r.lengths.low, 1) },
    { label: '中间值mm', value: fixed(r.lengths.std, 1) },
    { label: '最长长度mm', value: fixed(r.lengths.high, 1) },
    { label: '最低重量g', value: fixed(r.demold.low, 1) },
    { label: '中间值g', value: fixed(r.demold.mid, 1) },
    { label: '最高重量g', value: fixed(r.demold.high, 1) },
    { label: '实际水分', value: `${fixed(r.actual_moisture * 100, 2)}%` },
  ]
});
const headDiff = computed(() => (patch.value ? Object.entries(patch.value.head)
  .map(([key, val]) => ({ key, val, old: String(props.head?.[key] ?? '') }))
  .filter((d) => d.old !== d.val) : []));
const rowDiff = computed(() => (patch.value ? patch.value.rows.map((r) => ({
  ...r,
  oldRatio: String(props.rows?.[r.rowIndex]?.['实际添加比例'] ?? ''),
  oldAmount: String(props.rows?.[r.rowIndex]?.['单支物料含量'] ?? ''),
})) : []));
const footTip = computed(() => {
  if (blockReason.value) return blockReason.value
  const n = headDiff.value.length + rowDiff.value.length;
  return n ? `${tt('将写入')} ${n} ${tt('处')}` : tt('没有需要写入的变化')
});

/** 打开时:载入该产品的参数(没有就用系统默认条目,再没有就用内置默认) */
async function onOpen() {
  moisture.value = Array(10).fill('');
  moistureTouched.value = [];
  archiveFilled.value = [];
  archiveTip.value = '';
  paramEntryId.value = null;
  Object.assign(form, builtinDefaults());
  paramScopeTip.value = scopeTip();
  sinterModel.value = '';
  sinterWorkshop.value = String(props.head?.['生产车间'] ?? '').trim();
  const key = productCode.value || DEFAULT_ITEM;
  try {
    const hit = await fetchParam(key);
    if (hit) applyEntry(hit);
    else if (key !== DEFAULT_ITEM) {
      const sys = await fetchParam(DEFAULT_ITEM);
      if (sys) applyEntry(sys);
    } else paramScopeTip.value = `${scopeTip()}；${tt('标准库里还没有系统默认条目，当前用内置默认值')}`;
  } catch {
    paramScopeTip.value = `${scopeTip()}；${tt('参数库读取失败，已退回内置默认值')}`;
  }
  await loadArchiveMoisture();
  await loadSinterRows();
}

/**
 * 含水率从物料档案带出(商品面板 INV 的「水分含量」,见 tools/migrate-recipe-materials.sql)。
 * 口径:只查粉料位的物料(只有它们参与湿重换算);按物料编号逐个查(等值条件),
 * 结果用 applyArchiveMoisture 合并 —— 用户手改过的格不覆盖。档案读不到就退回手填,不阻断计算。
 */
async function loadArchiveMoisture() {
  const codes = [...new Set(slots.value.filter((s) => isPowder(s) && s.code).map((s) => s.code))];
  if (!codes.length) return
  const archive = {};
  await Promise.all(codes.map(async (code) => {
    try {
      const res = await request.post('/px/queryFormDataList', {
        panelCode: 'INV', condition: { 存货编码: code }, pageNo: 1, pageSize: 1,
      });
      const d = res?.data;
      const list = Array.isArray(d) ? d : (d?.list || d?.rows || []);
      // ⚠ 档案面板返回的是**主从结构**:list[0].detail.items[0] 才是行数据(实测),
      //   直接把 list[0] 当行会拿到 {编号,状态,单据状态,detail} 四个键、含水量永远取不到。
      const row = list.length ? (list[0]?.detail?.items?.[0] || list[0]) : null;
      const v = row ? Number(row['水分含量']) : NaN;
      archive[code] = Number.isFinite(v) && v > 0 ? v : null;
    } catch {
      archive[code] = null;   // 无权限/查不到都按"档案没有"处理,转手填
    }
  }));
  const merged = applyArchiveMoisture(slots.value, moisture.value, moistureTouched.value, archive);
  moisture.value = merged.values;
  archiveFilled.value = merged.filledSlots;
  archiveTip.value = merged.filledSlots.length
    ? `· ${tt('已从档案带出')} ${merged.filledSlots.length} ${tt('个料位的含水率')}`
    : `· ${tt('档案里没有这些物料的含水率，请手填')}`;
}
async function fetchParam(item) {
  const res = await request.get('/stdlib/list', { params: { lib: LIB, item, all: 1 } });
  const list = res?.data || [];
  const enabled = list.find((r) => Number(r.enabled) === 1) || list[0];
  return enabled || null
}
function applyEntry(entry) {
  paramEntryId.value = entry.id;
  try {
    const obj = JSON.parse(entry.content);
    PARAM_FIELDS.forEach((f) => { if (obj[f.key] !== undefined && obj[f.key] !== null) form[f.key] = String(obj[f.key]); });
    paramScopeTip.value = `${scopeTip()}；${tt('已载入')}「${entry.item}」${tt('的参数')}`;
  } catch {
    paramScopeTip.value = `${scopeTip()}；${tt('参数库条目不是合法 JSON，已退回内置默认值')}`;
  }
}
async function loadSystemDefaults() {
  Object.assign(form, builtinDefaults());
  try {
    const sys = await fetchParam(DEFAULT_ITEM);
    if (sys) applyEntry(sys);
    else paramScopeTip.value = `${tt('已载入内置默认值')}；${tt('要永久生效请点「存为该产品参数」')}`;
  } catch {
    paramScopeTip.value = `${tt('已载入内置默认值')}；${tt('要永久生效请点「存为该产品参数」')}`;
  }
}
async function saveParams() {
  const item = productCode.value || DEFAULT_ITEM;
  const content = JSON.stringify(overrides.value);
  try {
    if (paramEntryId.value) await request.post('/stdlib/update', { id: paramEntryId.value, content });
    else await request.post('/stdlib/add', { lib: LIB, item, content });
    const hit = await fetchParam(item);
    if (hit) applyEntry(hit);
    ElMessage.success(tt('已存为该产品参数'));
  } catch {
    ElMessage.error(tt('保存失败'));
  }
}

/* ── 按产品规格一键带出(2026-09-21)────────────────────────────────────────
   做同一产品的第二张单时,炭棒规格/烧结型号/密度范围本来都要重敲;这三样都能从已有数据推出来:
     · 炭棒规格 1/2/3 ← 产品信息表 RD_PROD_INFO(炭棒外径/炭棒内径/炭棒长度);
     · 烧结型号       ← 按外径/内径在烧结尺寸表里匹配(先看单据车间,匹配不到不猜);
     · 密度上下限     ← **该产品最近一张已保存的成型工艺清单**(只有「密度管控要求」文本也能解析)。
   取不到就如实提示,**绝不编造密度**(质量口径的数不能猜);已填的格一律不动(specCarryFrom 有单测)。
   放在 ③ 区头:算不出来时(blockReason)它就在眼前。 */
const carrying = ref(false);
/** 该面板下某条件的最新一张单据号(列表按新→旧;单据类面板列表键是「编号」,档案类是「单据编号」) */
async function listDocNos(panelCode, condition) {
  const res = await request.post('/px/queryFormDataList', { panelCode, condition, pageNo: 1, pageSize: 6 });
  const d = res?.data;
  const list = Array.isArray(d) ? d : (d?.list || d?.rows || []);
  return list.map((r) => String(r?.['编号'] ?? r?.['单据编号'] ?? '').trim()).filter(Boolean)
}
/** 单据表头(字段名口径,与页 1 一致) */
async function fetchHeadRow(panelCode, code) {
  const res = await request.get('/px/getFormDescriptor', { params: { panelCode, code } });
  const d = res?.data;
  return (d && (d.data || d)) || null
}
/**
 * 该产品最近一张**带密度**的成型工艺清单。
 * ⚠ 必须跳过当前这张单:它自己就是该产品最新的一张(还没填密度),不跳就会误判"历史没有密度"。
 * 取不到就给 null —— 界面据此提示"密度请手工填",绝不猜一个密度出来。
 */
async function findDensityHistory(code) {
  const cur = String(props.head?.['单据编号'] ?? props.head?.['编号'] ?? '').trim();
  const nos = (await listDocNos('RD_MOLD_PROC', { 产品编号: code })).filter((no) => no !== cur);
  for (const no of nos.slice(0, 3)) {
    const head = await fetchHeadRow('RD_MOLD_PROC', no);
    if (densityOf(head)) return head
  }
  return null
}
async function carrySpec() {
  if (carrying.value) return
  const code = productCode.value;
  if (!code) { ElMessage.warning(tt('请先在页 1 产品基本信息里选「炭棒编号」')); return }
  carrying.value = true;
  try {
    let product = null;
    let history = null;
    try {
      const pNo = (await listDocNos('RD_PROD_INFO', { 产品编号: code }))[0];
      if (pNo) product = await fetchHeadRow('RD_PROD_INFO', pNo);
    } catch { /* 读不到就当没有,靠 missing 提示 */ }
    try {
      history = await findDensityHistory(code);
    } catch { /* 同上 */ }

    const { patch, skipped, missing } = specCarryFrom(product, history, props.head);
    const keys = Object.keys(patch);
    keys.forEach((k) => { props.head[k] = patch[k]; });

    // 烧结型号:拿带出后的外径/内径(含单据上已有的)去尺寸表匹配,匹配到就选中
    const od = patch['炭棒规格1'] || props.head?.['炭棒规格1'];
    const id = patch['炭棒规格2'] || props.head?.['炭棒规格2'];
    const model = matchSinterModel(sinterRows.value, sinterWorkshop.value || String(props.head?.['生产车间'] ?? ''), od, id);
    if (model) sinterModel.value = model;

    const uniqSkip = [...new Set(skipped)];
    if (keys.length) ElMessage.success(`${tt('已带出')} ${keys.length} ${tt('处')}：${keys.join('、')}`);
    if (uniqSkip.length) ElMessage.info(`${tt('已有值未覆盖')}：${uniqSkip.join('、')}`);
    if (model) ElMessage.success(`${tt('烧结型号已选中')}：${model}`);
    else if (od && id) ElMessage.info(tt('尺寸表里没匹配到型号，请手工选'));
    if (missing.length) {
      const extra = missing.includes('密度') ? tt('（密度范围请手工填，或先给该产品存一张成型工艺清单）') : '';
      ElMessage.warning(`${tt('没有可带出的')}：${missing.join('、')}${extra}`);
    }
  } catch (e) {
    ElMessage.error(tt('带出失败') + '：' + (e?.message || e));
  } finally {
    carrying.value = false;
  }
}

/** 回填:页 1 十一个格 + 配方表对应行的两列(设计文档口径:比例 2 位小数带 %、含量 2 位小数) */
function apply() {
  if (!patch.value) return
  Object.entries(patch.value.head).forEach(([key, val]) => { props.head[key] = val; });
  patch.value.rows.forEach((r) => {
    const row = props.rows[r.rowIndex];
    if (!row) return
    row['实际添加比例'] = r.实际添加比例;
    row['单支物料含量'] = r.单支物料含量;
  });
  emit('applied');
  ElMessage.success(`${tt('已填入单据')}（${headDiff.value.length + rowDiff.value.length} ${tt('处')}）`);
  emit('update:modelValue', false);
}

return (_ctx, _cache) => {
  const _component_el_input = ElInput;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_button = ElButton;
  const _component_el_dialog = ElDialog;

  return (openBlock(), createBlock(_component_el_dialog, {
    "model-value": __props.modelValue,
    title: unref(tt)('配方计算'),
    width: "1120px",
    "append-to-body": "",
    "destroy-on-close": "",
    class: "rcd-dlg",
    "onUpdate:modelValue": _cache[5] || (_cache[5] = (v) => emit('update:modelValue', v)),
    onOpen: onOpen
  }, {
    footer: withCtx(() => [
      createBaseVNode("span", _hoisted_68$1, toDisplayString(footTip.value), 1),
      createVNode(_component_el_button, {
        onClick: _cache[4] || (_cache[4] = $event => (emit('update:modelValue', false)))
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('取消')), 1)
        ]),
        _: 1
      }),
      createVNode(_component_el_button, {
        type: "primary",
        disabled: !patch.value,
        onClick: apply
      }, {
        default: withCtx(() => [
          createTextVNode(toDisplayString(unref(tt)('填入单据')), 1)
        ]),
        _: 1
      }, 8, ["disabled"])
    ]),
    default: withCtx(() => [
      createBaseVNode("div", _hoisted_1$1, [
        createBaseVNode("div", _hoisted_2$1, toDisplayString(unref(tt)('计算口径与《炭棒工艺配方设计器》逐位一致；本弹窗的输入不保存、不打印，只有点「填入单据」写进单据的值才随单据保存。')), 1),
        createBaseVNode("div", _hoisted_3$1, [
          createBaseVNode("span", _hoisted_4$1, "① " + toDisplayString(unref(tt)('工艺参数')), 1),
          createBaseVNode("span", _hoisted_5$1, toDisplayString(paramScopeTip.value), 1),
          createBaseVNode("span", {
            class: "rcd-act",
            onClick: saveParams
          }, toDisplayString(unref(tt)('存为该产品参数')), 1),
          createBaseVNode("span", {
            class: "rcd-act",
            onClick: loadSystemDefaults
          }, toDisplayString(unref(tt)('恢复系统默认')), 1),
          createBaseVNode("span", {
            class: "rcd-act",
            onClick: openParamLib
          }, toDisplayString(unref(tt)('参数库维护')), 1)
        ]),
        createBaseVNode("div", _hoisted_6$1, [
          (openBlock(), createElementBlock(Fragment, null, renderList(PARAM_FIELDS, (f) => {
            return createBaseVNode("label", {
              key: f.key,
              class: "rcd-pf"
            }, [
              createBaseVNode("span", _hoisted_7$1, toDisplayString(unref(tt)(f.label)), 1),
              createVNode(_component_el_input, {
                modelValue: form[f.key],
                "onUpdate:modelValue": $event => ((form[f.key]) = $event),
                size: "small",
                class: "rcd-pf-in",
                onInput: onDirtyInput
              }, null, 8, ["modelValue", "onUpdate:modelValue"])
            ])
          }), 64))
        ]),
        createBaseVNode("div", _hoisted_8$1, [
          createBaseVNode("span", _hoisted_9$1, "①b " + toDisplayString(unref(tt)('烧结尺寸(模具)')), 1),
          createBaseVNode("span", _hoisted_10$1, toDisplayString(sinterTip.value), 1),
          createBaseVNode("span", {
            class: "rcd-act",
            onClick: openSinterTable
          }, toDisplayString(unref(tt)('维护尺寸表')), 1)
        ]),
        createBaseVNode("div", _hoisted_11$1, [
          createBaseVNode("label", _hoisted_12$1, [
            createBaseVNode("span", _hoisted_13$1, toDisplayString(unref(tt)('车间')), 1),
            createVNode(_component_el_select, {
              modelValue: sinterWorkshop.value,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((sinterWorkshop).value = $event)),
              size: "small",
              class: "rcd-pf-in",
              clearable: "",
              onChange: onSinterWorkshopChange
            }, {
              default: withCtx(() => [
                (openBlock(true), createElementBlock(Fragment, null, renderList(sinterWorkshops.value, (w) => {
                  return (openBlock(), createBlock(_component_el_option, {
                    key: w,
                    label: w,
                    value: w
                  }, null, 8, ["label", "value"]))
                }), 128))
              ]),
              _: 1
            }, 8, ["modelValue"])
          ]),
          createBaseVNode("label", _hoisted_14$1, [
            createBaseVNode("span", _hoisted_15$1, toDisplayString(unref(tt)('型号')), 1),
            createVNode(_component_el_select, {
              modelValue: sinterModel.value,
              "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((sinterModel).value = $event)),
              size: "small",
              class: "rcd-pf-in",
              clearable: "",
              filterable: "",
              onChange: onDirtyInput
            }, {
              default: withCtx(() => [
                (openBlock(true), createElementBlock(Fragment, null, renderList(sinterRowsInWorkshop.value, (r) => {
                  return (openBlock(), createBlock(_component_el_option, {
                    key: r['型号'],
                    value: r['型号'],
                    label: `${r['型号']}（${unref(tt)('炭棒')}${r['炭棒外径']}*${r['炭棒内径']}）`
                  }, null, 8, ["value", "label"]))
                }), 128))
              ]),
              _: 1
            }, 8, ["modelValue"])
          ]),
          createBaseVNode("div", _hoisted_16$1, [
            createBaseVNode("span", _hoisted_17$1, toDisplayString(unref(tt)('带出尺寸')), 1),
            createBaseVNode("span", _hoisted_18$1, toDisplayString(sinterSummary.value), 1)
          ])
        ]),
        createBaseVNode("div", _hoisted_19$1, [
          createBaseVNode("span", _hoisted_20$1, "② " + toDisplayString(unref(tt)('料位与含水率')), 1),
          createBaseVNode("span", _hoisted_21$1, toDisplayString(unref(tt)('料位按配方表的物料种类分组(粉料 1~5 / 胶粉 6~7 / 折算料 8~10);料位 1 是补差位。含水率默认从物料档案(商品·水分含量)按物料编号带出,档案没有的请手填 —— 只有粉料位的含水率参与计算。')), 1),
          (archiveTip.value)
            ? (openBlock(), createElementBlock("span", _hoisted_22$1, toDisplayString(archiveTip.value), 1))
            : createCommentVNode("", true)
        ]),
        createBaseVNode("table", _hoisted_23$1, [
          createBaseVNode("thead", null, [
            createBaseVNode("tr", null, [
              createBaseVNode("th", _hoisted_24$1, toDisplayString(unref(tt)('料位')), 1),
              createBaseVNode("th", _hoisted_25$1, toDisplayString(unref(tt)('分组')), 1),
              createBaseVNode("th", _hoisted_26$1, toDisplayString(unref(tt)('物料编号')), 1),
              createBaseVNode("th", null, toDisplayString(unref(tt)('物料名称')), 1),
              createBaseVNode("th", _hoisted_27$1, toDisplayString(unref(tt)('设计值(来自配方表)')), 1),
              createBaseVNode("th", _hoisted_28$1, toDisplayString(unref(tt)('含水率%')), 1),
              createBaseVNode("th", _hoisted_29$1, toDisplayString(unref(tt)('最终比例')), 1),
              createBaseVNode("th", _hoisted_30$1, toDisplayString(unref(tt)('单支克重g')), 1)
            ])
          ]),
          createBaseVNode("tbody", null, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(slots.value, (s, i) => {
              return (openBlock(), createElementBlock("tr", {
                key: i,
                class: normalizeClass({ 'rcd-empty': s.rowIndex < 0 })
              }, [
                createBaseVNode("td", _hoisted_31$1, toDisplayString(s.slot), 1),
                createBaseVNode("td", _hoisted_32$1, toDisplayString(unref(tt)(s.group)), 1),
                createBaseVNode("td", null, toDisplayString(s.code), 1),
                createBaseVNode("td", null, toDisplayString(s.name), 1),
                createBaseVNode("td", _hoisted_33$1, toDisplayString(designText(s)), 1),
                createBaseVNode("td", _hoisted_34$1, [
                  (isPowder(s))
                    ? (openBlock(), createBlock(_component_el_input, {
                        key: 0,
                        modelValue: moisture.value[i],
                        "onUpdate:modelValue": $event => ((moisture.value[i]) = $event),
                        size: "small",
                        class: "rcd-mini",
                        onInput: $event => (onMoistureInput(i))
                      }, null, 8, ["modelValue", "onUpdate:modelValue", "onInput"]))
                    : (openBlock(), createElementBlock("span", _hoisted_35$1, "—")),
                  (archiveFilled.value.includes(s.slot))
                    ? (openBlock(), createElementBlock("span", {
                        key: 2,
                        class: "rcd-src",
                        title: unref(tt)('来自物料档案')
                      }, toDisplayString(unref(tt)('档案')), 9, _hoisted_36$1))
                    : createCommentVNode("", true)
                ]),
                createBaseVNode("td", _hoisted_37$1, toDisplayString(cell(i, 'ratio')), 1),
                createBaseVNode("td", _hoisted_38$1, toDisplayString(cell(i, 'amount')), 1)
              ], 2))
            }), 128))
          ])
        ]),
        createBaseVNode("div", _hoisted_39$1, [
          createBaseVNode("span", _hoisted_40$1, "③ " + toDisplayString(unref(tt)('计算结果')), 1),
          createBaseVNode("span", {
            class: normalizeClass(["rcd-act", { 'rcd-act-off': carrying.value }]),
            onClick: carrySpec
          }, toDisplayString(unref(tt)('按产品规格带出')), 3),
          (blockReason.value)
            ? (openBlock(), createElementBlock("span", _hoisted_41$1, toDisplayString(blockReason.value), 1))
            : createCommentVNode("", true)
        ]),
        (result.value)
          ? (openBlock(), createElementBlock("div", _hoisted_42$1, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(resultRows.value, (r) => {
                return (openBlock(), createElementBlock("div", {
                  key: r.label,
                  class: "rcd-r"
                }, [
                  createBaseVNode("span", _hoisted_43$1, toDisplayString(unref(tt)(r.label)), 1),
                  createBaseVNode("span", _hoisted_44$1, toDisplayString(r.value), 1)
                ]))
              }), 128))
            ]))
          : createCommentVNode("", true),
        (visibleWarnings.value.length)
          ? (openBlock(), createElementBlock("div", _hoisted_45$1, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(visibleWarnings.value, (w, i) => {
                return (openBlock(), createElementBlock("div", {
                  key: i,
                  class: "rcd-warn"
                }, "⚠ " + toDisplayString(w), 1))
              }), 128))
            ]))
          : createCommentVNode("", true),
        createBaseVNode("div", _hoisted_46$1, [
          createBaseVNode("span", _hoisted_47$1, "④ " + toDisplayString(unref(tt)('回填预览')), 1),
          createBaseVNode("span", _hoisted_48$1, toDisplayString(unref(tt)('点「填入单据」后按下面这张表覆盖对应格;未变化的格不列出。')), 1)
        ]),
        (patch.value)
          ? (openBlock(), createElementBlock("div", _hoisted_49$1, [
              createBaseVNode("table", _hoisted_50$1, [
                createBaseVNode("thead", null, [
                  createBaseVNode("tr", null, [
                    createBaseVNode("th", null, toDisplayString(unref(tt)('页 1 字段')), 1),
                    createBaseVNode("th", _hoisted_51$1, toDisplayString(unref(tt)('旧值')), 1),
                    createBaseVNode("th", _hoisted_52$1, toDisplayString(unref(tt)('新值')), 1)
                  ])
                ]),
                createBaseVNode("tbody", null, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(headDiff.value, (d) => {
                    return (openBlock(), createElementBlock("tr", {
                      key: d.key
                    }, [
                      createBaseVNode("td", null, toDisplayString(d.key), 1),
                      createBaseVNode("td", _hoisted_53$1, toDisplayString(d.old || '—'), 1),
                      createBaseVNode("td", _hoisted_54$1, toDisplayString(d.val), 1)
                    ]))
                  }), 128)),
                  (!headDiff.value.length)
                    ? (openBlock(), createElementBlock("tr", _hoisted_55$1, [
                        createBaseVNode("td", _hoisted_56$1, toDisplayString(unref(tt)('页 1 无可回填的格子')), 1)
                      ]))
                    : createCommentVNode("", true)
                ])
              ]),
              createBaseVNode("table", _hoisted_57$1, [
                createBaseVNode("thead", null, [
                  createBaseVNode("tr", null, [
                    _cache[6] || (_cache[6] = createBaseVNode("th", { style: {"width":"52px"} }, "No.", -1)),
                    createBaseVNode("th", null, toDisplayString(unref(tt)('物料')), 1),
                    createBaseVNode("th", _hoisted_58$1, toDisplayString(unref(tt)('实际添加比例')), 1),
                    createBaseVNode("th", _hoisted_59$1, toDisplayString(unref(tt)('单支物料含量')), 1)
                  ])
                ]),
                createBaseVNode("tbody", null, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(rowDiff.value, (d) => {
                    return (openBlock(), createElementBlock("tr", {
                      key: d.rowIndex
                    }, [
                      createBaseVNode("td", _hoisted_60$1, toDisplayString(d.rowIndex + 1), 1),
                      createBaseVNode("td", null, toDisplayString(d.code), 1),
                      createBaseVNode("td", _hoisted_61$1, [
                        createBaseVNode("span", _hoisted_62$1, toDisplayString(d.oldRatio || '—'), 1),
                        createTextVNode(" → " + toDisplayString(d.实际添加比例), 1)
                      ]),
                      createBaseVNode("td", _hoisted_63$1, [
                        createBaseVNode("span", _hoisted_64$1, toDisplayString(d.oldAmount || '—'), 1),
                        createTextVNode(" → " + toDisplayString(d.单支物料含量), 1)
                      ])
                    ]))
                  }), 128)),
                  (!rowDiff.value.length)
                    ? (openBlock(), createElementBlock("tr", _hoisted_65$1, [
                        createBaseVNode("td", _hoisted_66$1, toDisplayString(unref(tt)('配方表没有可回填的行')), 1)
                      ]))
                    : createCommentVNode("", true)
                ])
              ])
            ]))
          : createCommentVNode("", true)
      ]),
      createVNode(_component_el_dialog, {
        modelValue: paramLibVisible.value,
        "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((paramLibVisible).value = $event)),
        title: unref(tt)('参数库维护') + ' · ' + unref(tt)('配方计算参数'),
        width: "820px",
        "append-to-body": ""
      }, {
        footer: withCtx(() => [
          createVNode(_component_el_button, {
            onClick: _cache[2] || (_cache[2] = $event => (paramLibVisible.value = false))
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('关闭')), 1)
            ]),
            _: 1
          })
        ]),
        default: withCtx(() => [
          createBaseVNode("div", _hoisted_67$1, toDisplayString(unref(tt)('条目名 = 产品编号(「默认」那条是系统默认);按产品的条目由本弹窗的「存为该产品参数」生成,所以这里不提供新增输入行。停用只影响以后的计算带出,已录入单据的值不变。')), 1),
          createVNode(StdLibManager, {
            lib: "mold.calcparam",
            "show-item": "",
            "show-add": false,
            onChanged: onParamLibChanged
          })
        ]),
        _: 1
      }, 8, ["modelValue", "title"])
    ]),
    _: 1
  }, 8, ["model-value", "title"]))
}
}

};
const RecipeCalcDialog = /*#__PURE__*/_export_sfc(_sfc_main$1, [['__scopeId',"data-v-8119256f"]]);

/**
 * ledgerCols.js — 只读台账页(pages[i].ledger)的**单元格取值**纯函数。
 *
 * 台账页用例 = 测试申请单(RD_DOM_TEST)第 3 个页签「委托测试汇总表」:把本面板**全部单据**
 * 的表头摘要列成一张纸面表格(设计《测试申请单.xlsx》sheet「汇总表」:序号/表格编号/发起人/
 * 申请日期/分类/状态)。它是**派生视图**,不落库、不占字段。
 *
 * 【为什么单独一个文件】取值规则必须能在 node --test 下直接断言:
 *   · seq:true       行号(台账自己编号,不用单据里的序号)
 *   · keys:[...]     在**单据表头**上按序回退取第一个非空键 —— 面板之间单号/日期的键名并不统一
 *                    (单据编号 / 编号 / 单号;单据日期 / 日期),写死一个键就会整列空白
 *   · detailKeys:[…] 表头上取不到时退到**明细第一行**取:设计的「发起人」= 申请单上的
 *                    申请人/发起人,它在设计里是**明细列**,单据表头根本没有这一项 ——
 *                    只查表头会整列空白(2026-09-30 实机踩到:汇总表 4 行的发起人全空)
 *   · map:{...}      取值后做**显示映射**(申请单类型「内部委托」→ 分类「内部」);
 *                    未登记的取值原样显示 —— 映射表陈旧时宁可显示原值,也不要把值吞掉
 *
 * ⚠ 与 recordSheetConfigs.js 的 pages[i].ledger.cols 是同一份契约,改一处必须改另一处
 *   (recordSheetConfigs.testapply.test.js 钉住两侧一致)。
 */

/** 按序回退取第一个非空值(空白串不算命中) */
function firstNonEmpty(obj, keys) {
  if (!obj || !Array.isArray(keys)) return ''
  for (const k of keys) {
    const x = obj[k];
    if (x !== undefined && x !== null && String(x).trim() !== '') return String(x)
  }
  return ''
}

/**
 * 取台账某一行某一列的显示文本。
 * @param {object} col { seq?:boolean, key?:string, keys?:string[], detailKeys?:string[], map?:Record<string,string> }
 * @param {object} row 单据行(表头字段 + 编号 + 单据状态 + detail.items[])
 * @param {number} idx 行序(0 起;seq 列显示 idx+1)
 * @returns {string} 显示文本(取不到即空串)
 */
function ledgerCell(col, row, idx) {
  if (!col) return ''
  if (col.seq) return String(idx + 1)
  let v = firstNonEmpty(row, col.keys || (col.key ? [col.key] : []));
  if (!v && col.detailKeys) v = firstNonEmpty(row?.detail?.items?.[0], col.detailKeys);
  if (col.map && v && col.map[v] !== undefined) v = col.map[v];
  return v
}

/**
 * sheetDateCells.js — 实验室记录表「日期/时间格」的控件种类与取值归一(纯函数,可在 node --test 下断言)
 *
 * 背景(2026-10-07):
 *   这批纸面记录表(recordSheetConfigs 的 11 张)里,日期/时间格历史上一律是 `el-input` 手填,
 *   值是**从 Excel 抄过来的自由文本**:`2026.09.04`、`2026/9/27 15:54:39`、`09:00-10:00`、
 *   `15.00-16.00`,甚至 `45926`(Excel 日期序列)。而服务器上部分列是 `datetime`
 *   (见 tools/migrate-server-parity-20260928.sql:102),接口下发的是 Jackson 的
 *   `2026-10-06T16:00:00.000+00:00`——这种带时区偏移的串**回传到 datetime 列会报 241**。
 *   ⇒ 控件要显示得出来、回传要规范,靠的就是这里的归一。
 *
 * 两条硬规矩:
 *   ① 归一失败**不丢数据**:认不出来返回空串(控件显示为空),调用方**不回写**,
 *      库里原值照旧(例如 `待定`、`45926` 之外的乱填值)。
 *   ② 只读显示认不出来就**原样显示**,不把 `待定` 显示成空白。
 */

/** 与通用面板 isDateField 同一份中文词表(见 PanelxList.vue:4803),避免两处口径漂移 */
function cellKindOf(dataType) {
  switch (String(dataType ?? '').trim()) {
    case '日期': return 'date'
    case '日期时间': return 'datetime'
    case '时间': return 'time'
    case '时间区间': return 'time-range'
    default: return 'text'
  }
}

/** Excel 1900 日期序列起点(序列 1 = 1900-01-01,含 1900 闰年 bug 的通用修正) */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
/** 认定成序列号的区间:1954-09 ~ 2064-06。范围外当普通数字,不硬掰成日期 */
const SERIAL_MIN = 20000;
const SERIAL_MAX = 60000;

const pad2 = (n) => String(n).padStart(2, '0');

/** 年月日 → 'YYYY-MM-DD';非法(13 月/2 月 30 日/非闰年 2-29)返回空串 */
function isoDate(y, m, d) {
  if (!(y >= 1900 && y <= 2999) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return ''
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return ''
  return `${y}-${pad2(m)}-${pad2(d)}`
}

/** 5 位纯数字按 Excel 序列解(实测:45926 → 2025-09-26) */
function serialToDate(n) {
  const days = Math.floor(n);
  if (days < SERIAL_MIN || days > SERIAL_MAX) return ''
  const dt = new Date(EXCEL_EPOCH_UTC + days * 86400000);
  return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

const DATE_HEAD = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/;
const ISO_TIME = /[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/;
const CLOCK = /^(\d{1,2})[:.](\d{1,2})(?::(\d{1,2}))?$/;
const RANGE_SPLIT = /\s*[-~～—－]\s*/;

const rawText = (v) => (v === null || v === undefined ? '' : String(v).trim());

/** 任意历史写法 → 'YYYY-MM-DD';认不出来返回 '' */
function toDateText(v) {
  if (typeof v === 'number') return serialToDate(v)
  const s = rawText(v);
  if (!s) return ''
  if (/^\d+$/.test(s)) {
    if (s.length === 8) return isoDate(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8)) // 20261007
    if (s.length === 5) return serialToDate(+s)
    return '' // 6 位的 '260927' 这种年份缩写不当日期认
  }
  const m = DATE_HEAD.exec(s);
  if (!m) return ''
  return isoDate(+m[1], +m[2], +m[3])
}

/** 取时间三段(秒可缺):ISO 带 T 的串或裸钟点串,取不到/越界返回 null */
function parseClock(v) {
  const s = rawText(v);
  if (!s) return null
  const m = ISO_TIME.exec(s) || CLOCK.exec(s); // 2026-09-27T08:23:42 / 09:00 / 9:5 / 09:00:00 / 15.00
  if (!m) return null
  const h = +m[1];
  const mi = +m[2];
  const sec = m[3] === undefined ? 0 : +m[3];
  if (!(h >= 0 && h <= 23) || !(mi >= 0 && mi <= 59) || !(sec >= 0 && sec <= 59)) return null
  return { h, mi, sec }
}

/** 时间部分 → 'HH:mm';认不出来返回 ''(纯日期串没有时间部分,返回空) */
function toTimeText(v) {
  const c = parseClock(v);
  return c ? `${pad2(c.h)}:${pad2(c.mi)}` : ''
}

/** 'YYYY-MM-DD HH:mm:ss'(「日期时间」类字段用;只有日期部分时补 00:00:00) */
function toDateTimeText(v) {
  const d = toDateText(v);
  if (!d) return ''
  const c = parseClock(v);
  const t = c ? `${pad2(c.h)}:${pad2(c.mi)}:${pad2(c.sec)}` : '00:00:00';
  return `${d} ${t}`
}

/** 区间文本 → ['HH:mm','HH:mm'] | null(认不出来返回 null,调用方不写回) */
function parseTimeRange(v) {
  const s = rawText(v);
  if (!s) return null
  const parts = s.split(RANGE_SPLIT);
  if (parts.length < 2) return null
  const a = toTimeText(parts[0]);
  const b = toTimeText(parts[parts.length - 1]);
  if (!a || !b) return null
  return [a, b]
}

/** 控件回值(['HH:mm','HH:mm']) → 落库文本 'HH:mm-HH:mm';不完整返回 '' */
function joinTimeRange(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return ''
  const a = toTimeText(arr[0]);
  const b = toTimeText(arr[1]);
  if (!a || !b) return ''
  return `${a}-${b}`
}

/** 只读格显示文本:按种类归一,认不出来原样显示(绝不显示成空白) */
function cellText(kind, v) {
  const raw = rawText(v);
  if (!raw) return ''
  switch (kind) {
    case 'date': {
      const d = toDateText(v);
      return d || raw
    }
    case 'datetime': {
      const d = toDateTimeText(v);
      return d || raw
    }
    case 'time': {
      const t = toTimeText(v);
      return t || raw
    }
    case 'time-range': {
      const r = parseTimeRange(v);
      return r ? joinTimeRange(r) : raw
    }
    default:
      return raw
  }
}

/**
 * 库里值 → 控件绑定值。
 * 归不出来时返回空串 / null(**只影响控件显示**):调用方一律绑定 `:model-value`(不是 v-model),
 * 用户不点选就不回写 ⇒ `待定`、`333` 这类认不出来的历史值不会被清掉。
 */
function controlValue(kind, v) {
  switch (kind) {
    case 'date': return toDateText(v)
    case 'datetime': return toDateTimeText(v)
    case 'time': return toTimeText(v)
    case 'time-range': return parseTimeRange(v)
    default: return v === null || v === undefined ? '' : v
  }
}

/** 控件回值 → 落库文本:日期类直接收串;区间合成 'HH:mm-HH:mm'(不完整视为清空) */
function controlToStored(kind, picked) {
  if (kind === 'time-range') return joinTimeRange(picked)
  return picked === null || picked === undefined ? '' : String(picked)
}

/* unplugin-vue-components disabled */

/* unplugin-vue-components disabled */

const _hoisted_1 = { class: "record-sheet rsp-sheet" };
const _hoisted_2 = {
  key: 0,
  class: "rsp-pages"
};
const _hoisted_3 = ["onClick"];
const _hoisted_4 = { key: 0 };
const _hoisted_5 = ["colspan"];
const _hoisted_6 = { class: "rsp-cover-docno-lb" };
const _hoisted_7 = {
  key: 1,
  class: "rsp-cover-docno-val"
};
const _hoisted_8 = { class: "rsp-cover-blockin" };
const _hoisted_9 = { class: "rsp-cover-fields" };
const _hoisted_10 = { class: "rsp-cover-lb" };
const _hoisted_11 = { class: "rsp-cover-vl" };
const _hoisted_12 = {
  key: 1,
  class: "rsp-cover-val"
};
const _hoisted_13 = {
  key: 1,
  class: "rsp-cover-val"
};
const _hoisted_14 = ["colspan"];
const _hoisted_15 = ["colspan"];
const _hoisted_16 = ["colspan"];
const _hoisted_17 = {
  key: 0,
  class: "rs-company-inline"
};
const _hoisted_18 = {
  key: 1,
  class: "rs-docno-wrap"
};
const _hoisted_19 = {
  key: 0,
  class: "rs-docno-prefix"
};
const _hoisted_20 = { class: "rs-docno-static" };
const _hoisted_21 = ["title"];
const _hoisted_22 = {
  key: 0,
  class: "rs-docno-prefix"
};
const _hoisted_23 = {
  key: 3,
  class: "rs-docno-wrap"
};
const _hoisted_24 = {
  key: 0,
  class: "rs-docno-prefix"
};
const _hoisted_25 = {
  key: 0,
  class: "rs-docno-prefix"
};
const _hoisted_26 = ["colspan"];
const _hoisted_27 = ["colspan", "rowspan"];
const _hoisted_28 = {
  key: 1,
  class: "rs-topic"
};
const _hoisted_29 = ["colspan"];
const _hoisted_30 = ["colspan"];
const _hoisted_31 = ["colspan"];
const _hoisted_32 = ["colspan"];
const _hoisted_33 = { key: 0 };
const _hoisted_34 = ["colspan"];
const _hoisted_35 = { style: {"display":"inline-flex","align-items":"center","gap":"12px","justify-content":"center","width":"100%"} };
const _hoisted_36 = ["colspan"];
const _hoisted_37 = { class: "rsp-docrow" };
const _hoisted_38 = { class: "rsp-doclabel" };
const _hoisted_39 = {
  key: 1,
  class: "rsp-docval rsp-pre"
};
const _hoisted_40 = ["onClick"];
const _hoisted_41 = { key: 0 };
const _hoisted_42 = ["colspan", "rowspan"];
const _hoisted_43 = ["colspan", "rowspan"];
const _hoisted_44 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_45 = ["colspan", "rowspan"];
const _hoisted_46 = ["title", "onClick"];
const _hoisted_47 = { class: "rs-ref-text" };
const _hoisted_48 = ["onClick"];
const _hoisted_49 = {
  key: 5,
  class: "rs-txt"
};
const _hoisted_50 = { key: 1 };
const _hoisted_51 = ["colspan", "rowspan"];
const _hoisted_52 = ["colspan", "rowspan"];
const _hoisted_53 = ["title", "onClick"];
const _hoisted_54 = { class: "rs-ref-text" };
const _hoisted_55 = ["onClick"];
const _hoisted_56 = {
  key: 2,
  class: "rs-checks"
};
const _hoisted_57 = ["onClick"];
const _hoisted_58 = {
  key: 4,
  class: "rs-txt"
};
const _hoisted_59 = { key: 2 };
const _hoisted_60 = ["rowspan"];
const _hoisted_61 = { class: "rs-td rs-label" };
const _hoisted_62 = ["colspan"];
const _hoisted_63 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_64 = { class: "rs-td rs-label" };
const _hoisted_65 = {
  class: "rs-td",
  colspan: "2"
};
const _hoisted_66 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_67 = { key: 3 };
const _hoisted_68 = { class: "rs-td rs-label" };
const _hoisted_69 = ["colspan"];
const _hoisted_70 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_71 = ["colspan"];
const _hoisted_72 = ["title", "onClick"];
const _hoisted_73 = { class: "rs-ref-text" };
const _hoisted_74 = { key: 3 };
const _hoisted_75 = {
  class: "rs-td rs-label rsp-water-label",
  rowspan: "2"
};
const _hoisted_76 = ["colspan"];
const _hoisted_77 = { class: "rs-inner" };
const _hoisted_78 = ["colspan"];
const _hoisted_79 = ["colspan"];
const _hoisted_80 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_81 = {
  class: "rs-td rs-label rsp-water-label",
  rowspan: "2"
};
const _hoisted_82 = { class: "rs-td rs-label" };
const _hoisted_83 = ["colspan"];
const _hoisted_84 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_85 = { class: "rs-td rs-label" };
const _hoisted_86 = ["colspan"];
const _hoisted_87 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_88 = {
  class: "rs-td rs-label rsp-water-label",
  rowspan: "5"
};
const _hoisted_89 = { class: "rs-th" };
const _hoisted_90 = { class: "rs-th" };
const _hoisted_91 = { class: "rs-th" };
const _hoisted_92 = ["colspan"];
const _hoisted_93 = { class: "rs-td rsp-item-name" };
const _hoisted_94 = { class: "rs-td" };
const _hoisted_95 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_96 = { class: "rs-td" };
const _hoisted_97 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_98 = ["colspan"];
const _hoisted_99 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_100 = { class: "rsp-dt-table" };
const _hoisted_101 = {
  key: 2,
  style: {"width":"0"}
};
const _hoisted_102 = { key: 0 };
const _hoisted_103 = ["colspan"];
const _hoisted_104 = {
  key: 0,
  class: "rsp-op-pad"
};
const _hoisted_105 = { key: 1 };
const _hoisted_106 = ["colspan"];
const _hoisted_107 = { class: "rsp-sub-label" };
const _hoisted_108 = {
  key: 3,
  class: "rsp-sub-value"
};
const _hoisted_109 = {
  key: 0,
  class: "rsp-op-pad"
};
const _hoisted_110 = { key: 2 };
const _hoisted_111 = ["colspan"];
const _hoisted_112 = { class: "rsp-sub-label" };
const _hoisted_113 = {
  key: 2,
  class: "rsp-sub-value"
};
const _hoisted_114 = ["colspan"];
const _hoisted_115 = {
  key: 0,
  class: "rsp-op-pad"
};
const _hoisted_116 = ["colspan"];
const _hoisted_117 = {
  key: 0,
  class: "rsp-op-pad"
};
const _hoisted_118 = { key: 4 };
const _hoisted_119 = ["colspan"];
const _hoisted_120 = { style: {"display":"inline-flex","align-items":"center","gap":"12px","justify-content":"center","width":"100%"} };
const _hoisted_121 = ["onClick"];
const _hoisted_122 = ["onClick"];
const _hoisted_123 = ["title"];
const _hoisted_124 = {
  key: 0,
  class: "rsp-op-pad"
};
const _hoisted_125 = { key: 5 };
const _hoisted_126 = ["colspan"];
const _hoisted_127 = {
  key: 0,
  class: "rsp-op-pad"
};
const _hoisted_128 = {
  key: 6,
  class: "rs-grp rsp-design"
};
const _hoisted_129 = {
  key: 0,
  class: "rs-th-op"
};
const _hoisted_130 = ["rowspan", "colspan"];
const _hoisted_131 = ["colspan"];
const _hoisted_132 = ["rowspan"];
const _hoisted_133 = {
  key: 0,
  class: "rs-grp2"
};
const _hoisted_134 = ["colspan"];
const _hoisted_135 = ["rowspan"];
const _hoisted_136 = ["rowspan", "colspan"];
const _hoisted_137 = {
  key: 1,
  class: "rs-txt rsp-cell rsp-pre"
};
const _hoisted_138 = {
  key: 1,
  class: "rs-txt rsp-cell rsp-pre"
};
const _hoisted_139 = {
  key: 1,
  class: "rs-txt rsp-cell rsp-pre"
};
const _hoisted_140 = {
  key: 1,
  class: "rs-td-op"
};
const _hoisted_141 = ["onClick"];
const _hoisted_142 = ["onClick"];
const _hoisted_143 = ["colspan"];
const _hoisted_144 = ["title"];
const _hoisted_145 = {
  key: 0,
  class: "rs-td-op"
};
const _hoisted_146 = ["onClick"];
const _hoisted_147 = ["onClick"];
const _hoisted_148 = { key: 10 };
const _hoisted_149 = ["colspan"];
const _hoisted_150 = {
  key: 0,
  class: "rsp-op-pad"
};
const _hoisted_151 = { key: 11 };
const _hoisted_152 = ["colspan"];
const _hoisted_153 = ["colspan"];
const _hoisted_154 = {
  key: 0,
  class: "rsp-op-pad"
};
const _hoisted_155 = { key: 12 };
const _hoisted_156 = ["colspan"];
const _hoisted_157 = {
  key: 0,
  class: "rsp-op-pad"
};
const _hoisted_158 = ["onClick"];
const _hoisted_159 = {
  key: 0,
  class: "rsp-chart"
};
const _hoisted_160 = ["viewBox"];
const _hoisted_161 = ["x"];
const _hoisted_162 = ["x1", "y1", "x2", "y2"];
const _hoisted_163 = ["x", "y"];
const _hoisted_164 = ["x1", "y1", "x2", "y2"];
const _hoisted_165 = ["x", "y"];
const _hoisted_166 = ["points", "stroke"];
const _hoisted_167 = ["cx", "cy", "fill"];
const _hoisted_168 = ["transform"];
const _hoisted_169 = ["transform"];
const _hoisted_170 = ["fill"];
const _hoisted_171 = {
  x: "19",
  y: "0",
  class: "rsp-legend"
};
const _hoisted_172 = ["x", "y"];
const _hoisted_173 = { key: 0 };
const _hoisted_174 = ["colspan"];
const _hoisted_175 = { style: {"display":"inline-flex","align-items":"center","gap":"12px","justify-content":"center","width":"100%"} };
const _hoisted_176 = ["colspan"];
const _hoisted_177 = { class: "rsp-docrow" };
const _hoisted_178 = { class: "rsp-doclabel" };
const _hoisted_179 = {
  key: 1,
  class: "rsp-docval rsp-pre"
};
const _hoisted_180 = ["onClick"];
const _hoisted_181 = { key: 0 };
const _hoisted_182 = ["colspan", "rowspan"];
const _hoisted_183 = ["colspan", "rowspan"];
const _hoisted_184 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_185 = ["colspan", "rowspan"];
const _hoisted_186 = ["title", "onClick"];
const _hoisted_187 = { class: "rs-ref-text" };
const _hoisted_188 = ["onClick"];
const _hoisted_189 = {
  key: 5,
  class: "rs-txt"
};
const _hoisted_190 = { key: 1 };
const _hoisted_191 = ["colspan", "rowspan"];
const _hoisted_192 = ["colspan", "rowspan"];
const _hoisted_193 = ["title", "onClick"];
const _hoisted_194 = { class: "rs-ref-text" };
const _hoisted_195 = ["onClick"];
const _hoisted_196 = {
  key: 2,
  class: "rs-checks"
};
const _hoisted_197 = ["onClick"];
const _hoisted_198 = {
  key: 4,
  class: "rs-txt"
};
const _hoisted_199 = { key: 2 };
const _hoisted_200 = ["rowspan"];
const _hoisted_201 = { class: "rs-td rs-label" };
const _hoisted_202 = ["colspan"];
const _hoisted_203 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_204 = { class: "rs-td rs-label" };
const _hoisted_205 = {
  class: "rs-td",
  colspan: "2"
};
const _hoisted_206 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_207 = { key: 3 };
const _hoisted_208 = { class: "rs-td rs-label" };
const _hoisted_209 = ["colspan"];
const _hoisted_210 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_211 = ["colspan"];
const _hoisted_212 = ["title", "onClick"];
const _hoisted_213 = { class: "rs-ref-text" };
const _hoisted_214 = { key: 3 };
const _hoisted_215 = {
  class: "rs-td rs-label rsp-water-label",
  rowspan: "2"
};
const _hoisted_216 = ["colspan"];
const _hoisted_217 = { class: "rs-inner" };
const _hoisted_218 = ["colspan"];
const _hoisted_219 = ["colspan"];
const _hoisted_220 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_221 = {
  class: "rs-td rs-label rsp-water-label",
  rowspan: "2"
};
const _hoisted_222 = { class: "rs-td rs-label" };
const _hoisted_223 = ["colspan"];
const _hoisted_224 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_225 = { class: "rs-td rs-label" };
const _hoisted_226 = ["colspan"];
const _hoisted_227 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_228 = {
  class: "rs-td rs-label rsp-water-label",
  rowspan: "5"
};
const _hoisted_229 = { class: "rs-th" };
const _hoisted_230 = { class: "rs-th" };
const _hoisted_231 = { class: "rs-th" };
const _hoisted_232 = ["colspan"];
const _hoisted_233 = { class: "rs-td rsp-item-name" };
const _hoisted_234 = { class: "rs-td" };
const _hoisted_235 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_236 = { class: "rs-td" };
const _hoisted_237 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_238 = ["colspan"];
const _hoisted_239 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_240 = ["colspan"];
const _hoisted_241 = { class: "rsp-docrow" };
const _hoisted_242 = { class: "rsp-doclabel" };
const _hoisted_243 = {
  key: 1,
  class: "rsp-docval rsp-pre"
};
const _hoisted_244 = ["onClick"];
const _hoisted_245 = ["colspan"];
const _hoisted_246 = { class: "rs-td rs-label" };
const _hoisted_247 = ["colspan"];
const _hoisted_248 = {
  key: 2,
  class: "rs-txt"
};
const _hoisted_249 = { key: 0 };
const _hoisted_250 = ["colspan"];
const _hoisted_251 = { class: "rs-txt rsp-cell" };
const _hoisted_252 = { key: 0 };
const _hoisted_253 = ["colspan"];
const _hoisted_254 = {
  key: 1,
  class: "rsp-ledger-hint"
};
const _hoisted_255 = { class: "rs-txt rsp-cell" };
const _hoisted_256 = { key: 2 };
const _hoisted_257 = ["colspan"];
const _hoisted_258 = { key: 3 };
const _hoisted_259 = ["colspan"];
const _hoisted_260 = ["colspan"];
const _hoisted_261 = ["colspan"];
const _hoisted_262 = {
  key: 1,
  class: "rs-txt"
};
const _hoisted_263 = {
  key: 0,
  class: "lib-tip"
};
const _hoisted_264 = { class: "lib-tip" };
const _hoisted_265 = { class: "lib-group-name" };
const _hoisted_266 = { class: "lib-group-subs" };
const _hoisted_267 = { class: "lib-sub-req" };
const _hoisted_268 = ["title", "onClick"];
const _hoisted_269 = ["title", "onClick"];
const _hoisted_270 = ["title", "onClick"];
const _hoisted_271 = { class: "lib-custom" };
const _hoisted_272 = { class: "lib-custom-title" };
const _hoisted_273 = { class: "lib-custom-form" };
const _hoisted_274 = ["title", "onClick"];
const _hoisted_275 = ["title", "onClick"];
const _hoisted_276 = ["title", "onClick"];
const _hoisted_277 = {
  key: 4,
  class: "lib-custom"
};
const _hoisted_278 = { class: "lib-custom-title" };
const _hoisted_279 = { class: "lib-custom-form" };
const _hoisted_280 = { class: "sec-lib-add" };
const _hoisted_281 = { class: "fe-list" };
const _hoisted_282 = ["title"];
const _hoisted_283 = { class: "fe-label" };
const _hoisted_284 = { style: {"margin-top":"8px","color":"#909399","font-size":"12px"} };

const COMPANY_NAME = '惠州市银嘉环保科技有限公司';
/** 报告头第 1 行「公司名格 | 编号格」的分列 —— 优先按**设计原表的 !merges**显式切分:
 *    head.noSpan     编号格占末尾几列(碱性设计 N2=1 列、压降 L2=1 列…);
 *                    **0 = 编号与公司名同一格**(阻垢性能 A1:J1、浸泡安全 B2:G2 —— 一格含两段文字);
 *    head.noGapSpan  设计里没并进公司名/编号任一格的空列数(RO保护 J2、压降 K2 在两格之间;
 *                    阻垢性能 K1 在同格版式的右侧)—— 并进任何一格都会把竖线挪到设计之外的位置;
 *    head.docnoPrefix 编号前是否渲染「编号：」标识 —— 逐张核对过设计的面板(7 张数据记录表)
 *                    设计原值都是**裸编号**,故它们显式写 false;**未写 = 保留原有「编号：」标识**
 *                    (改造前是 23 个面板统一带标识,没核过设计的面板不该被顺手改掉纸面观感)。
 *  不写 head.noSpan = 退回下面的动态算法(未按设计逐张核对的面板维持原样,零影响)。 */
const DOCNO_MIN_W = 160;
const COVER_W = 767;
const COVER_H = 794;
/**
 * 列宽**交给浏览器按内容算**(标签/值都 nowrap + table-layout:auto)。
 *
 * 为什么不再手算像素:第一版按「最长标签字数 × 字号 + 内边距」算标签列,给到 178px,
 * 而「客户项目名称」6 字 @27.3px 理论需 175.8px —— **只有 2px 余量**。
 * 真实字体渲染宽度略大于 1em(宋体常见 ~1.05em),且 `table-layout:fixed` 下单元格
 * **不会因内容变宽**,于是 nowrap 的文字直接溢出压到右侧值格上 = 用户看到的**字段重叠**。
 * ⇒ 正解是让浏览器测量(nowrap 撑开单元格),不再猜像素;
 *   同一份 cover.fields,所有行的标签列自然等宽 ⇒ 值列左边界仍然逐行对齐。
 * 仅保留内边距作为"最小留白"。
 */
/** ── 封面竖向分段(设计像素)──
 *  四段**必须首尾相接、互不重叠**,不能共带:
 *    ① 公司名行   y 25..58   (设计 B5,33px)
 *    ② 大标题行   y 58..106  (设计 B6 带;高 48 由 ①③ 反推 —— 见下)
 *    ③ 字段表     y 106 起   (设计 B7..B15,9 行 × 46 = 到 520)
 *    ④ 签字栏     y 605 起   (设计 B17/B18,2 行 × 33 = 到 671)
 *
 *  ⚠ 2026-09-18 连踩两次,记下来别再犯:
 *    · 第一次:公司名与标题**都放 top:25 / 高 33** ⇒ 同一带。公司名占 x44..313、
 *      居中标题(3 字 × 47.3 = 186px)占 x268..499,**水平重叠 45px** ⇒
 *      标题压住公司名末尾的「司」(用户报「产品规格书压到公司名」)。
 *    · 第二次:把标题下移后**凭感觉**给了 60px 高 ⇒ 标题带 52..112 又同时压住
 *      公司名(底 58)与字段表(顶 106),各溢出 6px。
 *    ⇒ 正解是**把 4 段当分区算,首尾相接**:标题带高 = 106 − 58 = 48,不手填。
 *      断言见 tools/archive/_probe-spec-cover.cjs(四段两两不重叠、且不留空档)。 */
const COVER_COMPANY_TOP = 25;
const COVER_COMPANY_H = 33;
/** 标题带起点 = 公司带终点(相接,不留缝不重叠) */
const COVER_GRID_TOP = 106;
/** 标题带高 = 字段表顶 − 标题带起点(由分区反推,不凭感觉填) */
const COVER_ROWS = 8;
/** 字段表行高(设计 B7..B15 等距 46px) */
const COVER_ROW_H = 46;
/** 签字栏顶(设计 B17);三栏列宽按设计 B17..D17 比例 92.7:97.3:97.3 */
const COVER_SIGN_TOP = 605;
const CW = 380;
const CH = 250;

const _sfc_main = {
  __name: 'RecordSheetPanels',
  props: {
  head: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  panelCode: { type: String, required: true },
  // 行级编辑门禁(产品变更申请单「部门评审意见」):当前账号可填的纸面部门行清单 ——
  // 由面板配置 metadata.changeDepts 下发(服务端按 yj_user.dept_id → yj_change_dept 算),
  // deptLockAll = 管理员豁免(可代填任何部门行)。两者只影响**界面**,服务端另有强制还原。
  myDeptRows: { type: Array, default: () => [] },
  deptLockAll: { type: Boolean, default: false },
},
  emits: ['dirty', 'refresh-config'],
  setup(__props, { expose: __expose, emit: __emit }) {

const props = __props;
const emit = __emit;

const cfg = computed(() => recordSheetConfigs[props.panelCode] || null);
// 纸张右上「编号：」格绑哪个键 —— 文档类面板=文档编号,单据类面板=单据编号(写死文档编号会让
// 单据类面板编辑期间那格永远空白;见 @/core/panel/sheetDocNo 的说明)
const docNoKey = computed(() => docNoKeyOf(props.head));
// 版式:'report' | 'plain'——面板级值是缺省,多页签面板可按页覆盖(见 effPlain)

/** 动态列变体:按头字段值解析(加标水经 variantOptions 映射/委托单直取),缺省第一个变体 */
const activeVariant = computed(() => {
  const vs = cfg.value?.variants;
  if (!vs) return null
  const val = props.head?.[cfg.value.variantKey];
  if (val) {
    if (vs[val]) return { name: val, ...vs[val] }
    const opt = (cfg.value.variantOptions || []).find((o) => o.value === val);
    if (opt && vs[opt.variant]) return { name: opt.variant, ...vs[opt.variant] }
  }
  const first = Object.keys(vs)[0];
  return { name: first, ...vs[first] }
});
const variantOptions = computed(() => {
  if (cfg.value?.variantOptions) return cfg.value.variantOptions.map((o) => ({ value: o.value, label: o.value }))
  return selectOptions(cfg.value?.variantKey)
});
const variantLabel = computed(() => (cfg.value?.variantKey || '') + (cfg.value?.variantKey ? '：' : ''));
/** 该字段是不是标准库字段:是则返回标准库编码(后端 fieldSpec 下发的 stdLib),否则空串 */
function stdLibOf(key) {
  const f = (props.fields || []).find((x) => (x.dataName || x.code) === key);
  return f && f.dataType === '标准库' ? (f.stdLib || '') : ''
}

/** 列的控件种类('date'/'datetime'/'time'/'time-range'/'text'):查该列在 yj_field 里的 data_type
 *  ⇒ 加日期下拉**只改元数据**,不必回这张 1600 行的版式文件逐列写 type */
function cellKind(c) {
  const f = (props.fields || []).find((x) => (x.dataName || x.code) === c?.key);
  return cellKindOf(f?.dataType)
}

/** 日期/时间控件回值 → 写回行(区间合成文本),并置脏交给父级保存 */
function setCellValue(row, c, picked) {
  row[c.key] = controlToStored(cellKind(c), picked);
  emit('dirty');
}

/** 副标题下拉的选项:优先取字段元数据的 options(标准库字段即标准库条目),退回变体选项 */
const subtitleOptions = computed(() => {
  const key = cfg.value?.subtitle?.key;
  if (!key) return []
  const o = selectOptions(key);
  return o.length ? o : variantOptions.value
});

// ---------- 标准库维护(实验室 4 张表的 测试项目/申请单类型/设备名称/仪器名称-型号) ----------
// 列表/新增/编辑/停用/恢复启用都在共用组件 StdLibManager 里(勾选→编辑按钮→行内改),
// 这里只负责决定打开哪个库、以及改完刷新下拉选项。
const stdLibVisible = ref(false);
const stdLibCode = ref('');
const stdLibName = ref('');

function openStdLib(lib) {
  if (!lib) return
  stdLibCode.value = lib;
  stdLibName.value = cfg.value?.subtitle?.label ? String(cfg.value.subtitle.label).replace(/[：:]\s*$/, '') : lib;
  stdLibVisible.value = true;
}

/** 标准库条目变了:刷新字段选项,新增/改名立刻反映到下拉(不影响已录入单据的文本) */
function onStdLibChanged() {
  emit('refresh-config');
}

// ── 多页结构(规格书 / 成型工艺清单+成型配方 / 组装工艺清单+组装BOM表):页签切换,各区块按 page 归属渲染 ──
// activePage 必须先于 effGrid/effPlain 声明:它们按当前页解析 pages[i] 的 grid/headMode(见下)。
const activePage = ref(0);

/** 当前页签的配置块(pages 里的声明;单页面板为空) */
const activePageMeta = computed(() => cfg.value?.pages?.[activePage.value] || null);
/** 生效网格 —— 每页各自一套列宽(2026-09-11):
 *  多页签面板允许按页声明 pages[i].grid,两张单据版式本就不同(成型工艺清单 11 列 A..K /
 *  成型配方 13 列 / 组装BOM表 4 列 130·390·130·390),共用一个网格会把其中一页的列宽挤变形。
 *  退化顺序:本页 pages[i].grid → 变体 grid → 面板 grid。页面未声明 grid 时与改造前逐字等价。 */
const effGrid = computed(() => activePageMeta.value?.grid || activeVariant.value?.grid || cfg.value?.grid || []);
/** 报告头布局:页声明可覆盖(title 跨列数等),与 grid/headMode 同一套按页退化 */
const effHead = computed(() => ({ ...(activeVariant.value?.head || cfg.value?.head || {}), ...(activePageMeta.value?.head || {}) }));
/** 生效版式:'report'(报告头)| 'plain'(标题条登记表)——同样支持按页声明(页各按原貌渲染)。
 *  退化顺序:本页 pages[i].headMode / pages[i].plain → 变体 headMode → 面板 headMode。 */
const effPlain = computed(() => {
  if (activePageMeta.value?.plain) return true
  const m = activePageMeta.value?.headMode || activeVariant.value?.headMode || cfg.value?.headMode;
  return m === 'plain'
});
/** 本页是否渲染报告头。
 *  · 本页声明 showHead:true → 渲染(被并入同一张单、但原本是独立单据的那页);
 *  · 本页声明 showHead:false → 不渲染;
 *  · 未声明 → 退回历史行为「只有第 1 页有报告头」(规格书封面、各单页面板都靠这条保持原样零影响)。
 *  只有「成型配方 / 组装BOM表」两页需要「非首页也有自己的报告头」,按页声明即可,不必猜。 */
const showReportHead = computed(() => {
  const m = activePageMeta.value;
  if (m && m.showHead === true) return true
  if (m && m.showHead === false) return false
  return activePage.value === 0
});
const nCols = computed(() => effGrid.value.length);
/** 网格总宽:所有表格显式用这个宽度,列分界线全页严格一致(数据表编辑态另加 60px 操作列) */
const gridW = computed(() => effGrid.value.reduce((s, w) => s + w, 0));
/** 报告头左侧公司名(7 张数据记录表 + 其它文书面板的纸面首行文字,逐张一致;尾随空格不计) */
const sameCellDocno = computed(() => effHead.value.noSpan === 0);
const noGapSpan = computed(() => Math.max(0, Math.floor(Number(effHead.value.noGapSpan) || 0)));
const gapLeftSpan = computed(() => (sameCellDocno.value ? 0 : noGapSpan.value));
const gapRightSpan = computed(() => (sameCellDocno.value ? noGapSpan.value : 0));
const docnoPrefix = computed(() => effHead.value.docnoPrefix !== false);

/**
 * 本页纸张右上角「编号」格的**受控表单编号常量**(pages[i].docNoStatic)。
 *
 * 【为什么需要它】测试申请单的纸面右上角那一格填的是**表单编号**(内部委托 YJ-RIR001 /
 * 销售端 YJ-XS002,设计原表两侧不同),不是这张单的单据号 —— 单据号由后端「新增」自动发
 * (DT 前缀),在汇总表页与左侧选单栏出现。两种号混在一个格子里会让人以为 YJ-RIR001 可改。
 * 声明了它 ⇒ 该格渲染这段常量文本(编辑态与只读态一致),与头字段解耦。
 * 未声明 pages[i].docNoStatic 的面板逐字不变(仍按 head[docNoKey] || docNoDefault)。
 */
const docNoStatic = computed(() => String(activePageMeta.value?.docNoStatic || ''));

/** 右上角编号格占末尾几列:末尾列宽不足时向左并列凑到 ≥160px——
 *  现有最长编号 YJ-AB-SAMPLE-1 实测 98px,加参照图标/间距约 145px;
 *  只并列不改列宽,全页竖线位置不变(并掉的列整列被编号格覆盖)。
 *  ⚠ 这是**没按设计核过**的面板(未声明 head.noSpan)的兜底:它按列宽湊,凑出来的位置
 *  未必等于纸面(如碱性纸面 12/1,凑出来是 11/2)。纸面切分已核过的面板请写 head.noSpan。 */
const dynamicDocnoSpan = computed(() => {
  const g = effGrid.value || [];
  if (g.length < 2) return 1
  let sum = 0;
  let k = 0;
  for (let i = g.length - 1; i >= 1; i--) {
    sum += g[i];
    k += 1;
    if (sum >= DOCNO_MIN_W) break
  }
  return Math.min(k, g.length - 1)
});
const docnoSpan = computed(() => {
  const n = nCols.value;
  // 同格版式:整格从第 1 列跨到空列之前(阻垢性能 11−1=10、浸泡安全 6−0=6)
  if (sameCellDocno.value) return Math.max(1, n - gapRightSpan.value)
  const explicit = Number(effHead.value.noSpan);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(explicit, n - 1)
  return dynamicDocnoSpan.value
});
/** 公司名格占几列 = 总列数 − 两段留白 − 编号格(同格版式时不出公司名格 ⇒ 0) */
const companySpan = computed(() => Math.max(0, nCols.value - gapLeftSpan.value - docnoSpan.value - gapRightSpan.value));

/* ── 规格书文档式封面(设计画布 767×794,内层坐标=设计像素,由 --cok 等比缩放) ──
   几何改为按《规格书细分.xlsx》「封面（产品信息）」sheet 的**行高/列宽**折算 —— 设计像素 = 磅 × 4/3:
     列  B=71 C=92.7 D=97.3 E=97.3   ⇒ 标签列 71、值区 287.3(设计 C7:D7 合并)
     行  B5=33 B6=60 B7..B15=46 B16=40 B17=33 B18=33
   公司/编号 与标题各有自己的行高(33 / 60),字段 7 行等宽等高(46),版本 1 行,签字 2 行 —— 
   与设计逐行对应。⚠ 旧版取自设计图 PNG 的 708×1173 画布:那版封面把标签做成**流式**
   「标签：值」两端撑开(flex),标签宽度随文字长短变 ⇒ **冒号与值列参差不齐**,
   与设计的「标签列定宽 + 值列定宽」表格不是一回事(用户 2026-09-18 明确要求按本设计重排)。 */
const COVER_TITLE_TOP = COVER_COMPANY_TOP + COVER_COMPANY_H;
/** 字段表顶(设计 B7 起点),也是标题带终点 */
const COVER_TITLE_H = COVER_GRID_TOP - COVER_TITLE_TOP;
/** 封面字段表**行数**(签字栏间距按它算)。2026-09-30 由 9 改 **8**:
 *  原第一行「编  号」(设计 B7)已移到封面右上角的编号格(设计原文本就是「公司左上 + 编号右上」),
 *  字段表剩 B8..B15 = 产品类别/客户名称/客户料号/客户项目名称/应用场景/整体规格参数/产品主要性能/版本。
 *  ⚠ 改这个数就够,不用动 COVER_GRID_TOP/COVER_SIGN_TOP —— 字段表仍从设计 B7 的 y 起排,
 *    少的那一行空间由签字栏 margin-top 自动吸收(见模板里那句 marginTop 注释)。 */
const coverK = computed(() => gridW.value / COVER_W);
/** 封面高度 = 真实 A4(210×297mm):设计画布 1173/708≈1.657 比 A4(1.414)长,按画布高等比
 *  会在打印时溢出到第二页;纵向位置/行高用独立缩放 coverVy 压入 A4 高度,横向(字号/列宽)仍用 coverK
 *  −cfg.coverTailReserve:与封面**同页**、渲染在封面之下那块的预留高度。
 *   2026-09-30 规格书第 0 页的下挂三行章节块已按用户要求删除 ⇒ 该值改为 0,整页给封面;
 *   若日后又在封面下加内容,必须把预留加回来(否则那块会被挤到第二页)。 */
const coverPageH = computed(() => Math.round(gridW.value * (297 / 210)) - (cfg.value?.coverTailReserve || 0));
const coverVy = computed(() => coverPageH.value / COVER_H);
/** 封面右上角「编号」格绑哪个数据键(面板声明 cfg.coverDocNoKey;未声明的封面面板不渲染该格)。
 *  ⚠ 必须是**字段名**(如「产品编号」),不能是引擎的**单据标识键**「编号」——
 *    后者会被 QueryService.loadDocs 的单据号覆盖(见 recordSheetConfigs.js 的封面注释)。 */
const coverDocNoKey = computed(() => String(cfg.value?.coverDocNoKey || ''));
/** 字段行顶部(设计 px):等宽等高,由行号推出(不再手写坐标表 —— 加行不用改这里) */
function coverLineTop(i) {
  return ((COVER_GRID_TOP + i * COVER_ROW_H) * coverVy.value).toFixed(1) + 'px'
}
/** 签字栏三栏:与字段表**同宽同居中**(两表共用 CSS 的居中规则 + var(--coverw) 宽度),
 *  故左/右边界天然对齐。三栏之间按设计 B17..D17 的比例 92.7:97.3:97.3 分配(百分比)。 */
const COVER_SIGN_COLS = [92.7, 97.3, 97.3];
const coverSignW = COVER_SIGN_COLS.map((w, _i, arr) => {
  const sum = arr.reduce((a, b) => a + b, 0);
  return ((w / sum) * 100).toFixed(2) + '%'
});

/** 报告头右侧信息块(数据记录表=密级/适用范围/测试负责人/报告编号/**审核人**;
 *  委托单=文件管理人/密级/文件使用范围)。
 *  ⚠ 2026-09-30 加「审核人」:需求《产品开发系统需求汇总.xlsx》sheet「数据记录表」第 1 条
 *    ——「都需要审核人(秀丽)」。纸面印「审核人」,**数据键是「表单审核人」**:
 *    字段名若叫「审核人」会被 ButtonService.save() 的 `body.remove("审核人")` 静默丢弃
 *    (那是 yj_doc_status.shr 的虚拟字段),QC_INSP_REC 当年踩过同一个坑,故两处同款命名。
 *    落库列走**备用列池**的 备用1(零 DDL),见 tools/migrate-rd-datarec-reviewer-2026-09-30.sql。 */
const DEFAULT_INFO = [
  { label: '密级', key: '密级', type: 'select' },
  { label: '适用范围', key: '适用范围', type: 'select' },
  { label: '测试负责人', key: '测试负责人', type: 'text' },
  { label: '报告编号', key: '报告编号', type: 'text' },
  { label: '审核人', key: '表单审核人', type: 'text' },
];
const effInfo = computed(() => {
  // 多页签面板可按页声明 pages[i].info:被并入的页各有各的信息块(含**空数组=无信息块**,
  // 如组装BOM表原版 info:[])——页声明优先,未声明才退面板级,再退默认四件套。
  // 修复:BOM 页未声明时误回退默认信息块,大标题被挤进第一列(130px)错位。
  const m = activePageMeta.value;
  if (m && m.info !== undefined) return m.info
  const info = cfg.value?.info;
  if (info === undefined) return DEFAULT_INFO
  return info
});
const infoSpan = computed(() => effInfo.value.length);

/** 报告头大标题:静态/前缀+头字段派生(规格书=产品规格书·名称,委托单=类型+'-测试申请单'),否则为 测试主题 输入。
 *  多页签面板可按页声明 pages[i].staticTitle —— 被并入同一张单的两页本是**两张单据**,
 *  各有各的标题(如 炭棒工艺管控清单 / 炭棒配方管控清单),不能共用一个 staticTitle。 */
const effStaticTitle = computed(() => activePageMeta.value?.staticTitle || cfg.value?.staticTitle || null);
const derivedTitle = computed(() => {
  if (effStaticTitle.value) return effStaticTitle.value
  if (cfg.value?.titleFromKey) {
    const v = props.head?.[cfg.value.titleFromKey] || cfg.value.titlePlaceholder || '';
    if (v || !cfg.value.titlePlaceholder) return (cfg.value.titlePrefix || '') + v + (cfg.value.titleSuffix || '')
  }
  return null
});

// ── 多页结构(规格书 / 成型工艺清单+成型配方 / 组装工艺清单+组装BOM表):页签切换,各区块按 page 归属渲染 ──
// (activePage 本体在文件上方声明,effGrid/effPlain 依赖它)
const pageList = computed(() => cfg.value?.pages || []);
function pageOf(block) {
  return block.page ?? 0
}
/**
 * 「字段编辑」按钮挂在哪张数据表上。
 * 原写法写死 `di === 0`,但第 0 张表未必有 bar 行 —— 用 pageTitle 出居中大标题的表
 * (规格书修订记录页、组装工艺清单的修订记录页)整行 `<tr v-if="dt.bar && !dt.pageTitle">` 都不渲染,
 * 按钮就跟着一起消失,整张单再也进不去字段编辑。改成挂在**第一张真的会画 bar 行的表**上。
 */
const fieldEditAt = computed(() => {
  const dts = cfg.value?.dataTables || [];
  const i = dts.findIndex((d) => d.bar && !d.pageTitle);
  return i < 0 ? 0 : i
});

/**
 * 本节是否属于「数据表锚点之前(含锚点)」那一段 —— 用于把章节拆成表前/表后两段渲染。
 *
 * 为什么需要:模板里数据表是**另起一段**渲染在 sections 之后的,单靠顺序挪不动它,
 * 而设计第 4 页要求物料表夹在「1.关键物料列表」与「2.炭棒处理要求」之间。
 * 于是把章节拆两段:循环 A(true)+ 数据表 + 循环 B(false),表自然落在锚点节之后。
 * 锚点 = 某张表的 tablesAfterBar 等于某节的 bar(同页)。
 * 无任何锚点的面板 ⇒ 恒 true ⇒ 循环 B 为空、表仍排在所有章节之后 = 原行为不变。
 */
function isAtOrBeforeTableAnchor(sec) {
  const c = cfg.value || {};
  const anchored = (c.dataTables || []).filter((d) => d.tablesAfterBar);
  if (!anchored.length) return true
  const samePage = (c.sections || []).filter((s) => pageOf(s) === pageOf(sec));
  let lastAnchor = -1;
  samePage.forEach((s, i) => {
    if (anchored.some((d) => d.tablesAfterBar === s.bar && pageOf(d) === pageOf(s))) lastAnchor = i;
  });
  if (lastAnchor < 0) return true
  return samePage.indexOf(sec) <= lastAnchor
}

watch(() => props.panelCode, () => { activePage.value = 0; });

// ── 表尾静态表(cfg.tailTables)与只读台账页(pages[i].ledger) ──
/** 本页要渲染的静态附表(设计纸面上的固定附录;不落库、不进单据) */
const tailTablesOfPage = computed(() => (cfg.value?.tailTables || []).filter((t) => pageOf(t) === activePage.value));
/** 静态附表自己的宽度 = 各列宽之和(设计里它比整页窄,故不铺满网格,由 .rs-tail-table 居中) */
function tailTableW(t) {
  return (t.cols || []).reduce((s, c) => s + (c.w || 120), 0)
}

/** 当前页的台账配置(pages[i].ledger);无则整块不渲染 */
const ledgerCfg = computed(() => activePageMeta.value?.ledger || null);
const ledgerW = computed(() => (ledgerCfg.value?.cols || []).reduce((s, c) => s + (c.w || 120), 0));
const ledgerRows = ref([]);
const ledgerLoading = ref(false);

/**
 * 台账取数:走面板自身列表接口(与左侧「单据选择」栏 / 列表页同一份真源),
 * 一次取 pageSize 条表头摘要(默认 200;后端本接口不限 pageSize,见 PxController.queryFormDataList)。
 * ⚠ request 的响应拦截器已解一层 ⇒ res 是 ApiResult,数据在 res.data。
 */
async function loadLedger() {
  const lg = ledgerCfg.value;
  if (!lg) return
  ledgerLoading.value = true;
  try {
    const res = await request.post('/px/queryFormDataList', {
      panelCode: props.panelCode,
      condition: {},
      pageNo: 1,
      pageSize: lg.pageSize || 200,
    });
    const data = res?.data || res || {};
    ledgerRows.value = Array.isArray(data.list) ? data.list : [];
  } catch {
    ledgerRows.value = []; // 取数失败只留空表(台账是只读附属视图,不该挡住单据本身)
  } finally {
    ledgerLoading.value = false;
  }
}

/**
 * 台账某一格的显示值 —— 规则见 core/panel/ledgerCols.js(纯函数,单测直接钉住:
 * seq 行号 / keys 按序回退 / map 显示映射 / 取不到即空串)。
 */
const ledgerCell$1 = ledgerCell;

// 台账只在「切到台账页 / 换面板 / 换单(载入或保存后单据号变化)」时重取 —— 不跟随每一下击键
watch(
  [activePage, () => props.panelCode, () => props.head?.['单据编号'], () => props.head?.['编号']],
  () => {
    if (ledgerCfg.value) loadLedger();
    else ledgerRows.value = [];
  },
);

// ── 复选格(变更申请单):顿号分隔文本 ⇄ 勾选态 ──
/**
 * 文本 → 勾选项数组(顿号/逗号/分号/空格都当分隔符;空值=没勾)。
 * 与后端 ButtonService/changeHead 的判定同一口径(后端用的是 contains,故顺序无关)。
 */
function checkList(v) {
  return String(v ?? '').split(/[、,，;；\s]+/).map((s) => s.trim()).filter(Boolean)
}

/** 勾选态 → 文本(顿号分隔;不勾就写空串 —— 注意本引擎"空串=不改动",要清空得靠后端还原口径) */
function toggleCheck(key, opt, single) {
  const cur = checkList(props.head?.[key]);
  let next;
  if (single) next = cur.includes(opt) ? [] : [opt];
  else next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
  props.head[key] = next.join('、');
  emit('dirty');
}

// ── 行级编辑门禁(变更申请单「部门评审意见」)──
/**
 * 某张明细表的某一行该不该锁:dt.lockKey 声明"按哪一列判部门"(如 '部门')时,
 * 只有 props.myDeptRows(服务端按账号部门算出来的可填部门行)里的行才可编;
 * 管理员(deptLockAll)豁免;声明了 dt.lockCols 时只有这些列可编(表区/部门/签字/日期 一律不可编)。
 * ⚠ 只影响界面:服务端 ButtonService.gateChangeDetail 另有强制还原,双保险。
 */
function rowLocked(dt, row) {
  if (!dt || !dt.lockKey) return false
  if (props.deptLockAll) return false
  return !props.myDeptRows.includes(String(row?.[dt.lockKey] ?? '').trim())
}

/** 单元格可否编辑:表可编 + 行不属于锁 + (声明了 lockCols 时)列在放行清单里 */
function cellEditable(dt, row, c) {
  if (!props.editable) return false
  if (rowLocked(dt, row)) return false
  if (dt.lockCols && !dt.lockCols.includes(c.key)) return false
  return true
}

/** 该格是否"因为不是本部门"被锁(给个灰底 + tooltip,免得用户以为坏了) */
function isLockedCell(dt, row, c) {
  return props.editable && rowLocked(dt, row) && !(dt.lockCols && !dt.lockCols.includes(c.key))
}

// ── 校验定位(供 PanelxList 保存校验调用):翻到字段所在页 + 滚动 + 闪烁 ──
/** 找到 label 所在页签(封面字段=0;sections/tailSections 按 page 归属;找不到返回 null) */
function pageOfLabel(label) {
  const c = cfg.value || {};
  if ((c.cover?.fields || []).some((f) => f.label === label)) return 0
  for (const sec of [...(c.sections || []), ...(c.tailSections || [])]) {
    const hit = (sec.rows || []).some((row) =>
      (row.pairs || []).some((p) => p.label === label)
      || row.label === label
      || (row.grid || []).some((g) => g.label === label));
    if (hit) return pageOf(sec)
  }
  // 数据表列头/格式区条(多页签面板的页 2 表格列,如成型配方「实际添加比例」)
  for (const dt of c.dataTables || []) {
    const hit = (dt.cols || []).some((col) => col.label === label)
      || (dt.subHeads || []).some((sh) => sh.label === label)
      || dt.bar === label;
    if (hit) return pageOf(dt)
  }
  return null
}
/** 翻页 + 定位闪烁该字段(琥珀高亮约 3 秒);返回是否定位成功 */
function focusField(label) {
  if (!label) return false
  const target = pageOfLabel(label);
  if (target === null) return false
  if (pageList.value.length) activePage.value = target;
  nextTick(() => {
    const root = document.querySelector('.record-sheet');
    if (!root) return
    // v-show 隐藏的其它页签也会命中查询,故只在**可见**元素里找(否则会闪到看不见的格子上)
    const visible = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
    const els = [...root.querySelectorAll('td.rs-label, td.rsp-cover-lb, .rsp-cover-lb, td.rs-td, th')].filter(visible);
    const el = els.find((e) => (e.textContent || '').trim() === label)
      || [...root.querySelectorAll('td.rs-label, td.rsp-cover-lb, .rsp-cover-lb')].filter(visible)
        .find((e) => (e.textContent || '').includes(label));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('field-blink');
      setTimeout(() => el.classList.remove('field-blink'), 3200);
    }
  });
  return true
}
__expose({ focusField });
/** plain 版式标题条文字:多页签面板配数组(按 activePage 取,缺省回退第 0 个),单页面板配字符串。
 *  变体可各自声明 plainTitle(组装工艺清单 4 个变体:裸棒/机器包布/复合半成品/成品 各有各的设计标题),
 *  优先级:变体 > 面板(数组/pages 归一后仍是面板级)。 */
const plainTitleOf = computed(() => {
  const v = activeVariant.value?.plainTitle;
  if (v) return v
  const t = cfg.value?.plainTitle;
  if (Array.isArray(t)) return t[activePage.value] ?? t[0] ?? ''
  return t || ''
});
function plainW(dt) {
  // 本页声明了自己的网格时以网格总宽为准(组装BOM表页:物料清单/修订记录按 130·390·130·390 铺满纸张);
  // 未声明网格的 plain 面板(实验室各表、组装工艺清单页)仍按列宽之和,与改造前一致。
  if (activePageMeta.value?.grid) return gridW.value
  return colsOf(dt).reduce((s, c) => s + (c.w || 100), 0)
}
function colsOf(dt) {
  return activeVariant.value?.cols || dt.cols || []
}

// ── 标准库勾选(规格书检验要求 26 组分组标准库 / 出货检验计划 必测项+型式项) ──
const libVisible = ref(false);
const libChecked = ref([]);
const libRows = ref([]);
async function openLib(dt) {
  libTargetDt.value = dt;
  const lib = dt.lib;
  const flat = Array.isArray(lib);
  // ── 第三态:组装工艺 4 变体库(lib='asm.proc')──────────────────────────────
  // 一变体一条目(item_code=变体名),content={v:1,rows:[{工序,工序控制内容,管控要求,检查比例}]}。
  // 与另两态的区别:**勾选即"整表替换"**(选中一个变体,把该表区的行换成它的 rows),
  // 而不是"逐条追加到已有行"。种子见 tools/gen/gen-asm-proc-lib.cjs。
  if (lib === 'asm.proc') {
    const res = await request.get('/stdlib/list', { params: { lib: 'asm.proc', all: 1 } }).catch(() => null);
    const rows = (res?.data || []).map((r) => {
      let parsed = null;
      try { parsed = JSON.parse(r.content); } catch { parsed = null; }
      const list = Array.isArray(parsed?.rows) ? parsed.rows : [];
      return { item: r.item, name: r.item, rows: list, n: list.length, seq: r.seq, dbId: r.id, off: Number(r.enabled) === 0 }
    });
    // ⚠ StdLibController.list 的 SQL 是 `ORDER BY item_code, seq, id` ⇒ 单条 item_code 时退回**字母序**,
    //   设计 sheet 的业务序(裸棒→机器包布→复合半成品→成品)会丢。按 seq 在前端重排(seq 已随响应下发)。
    rows.sort((a, b) => (Number(a.seq ?? 9999) - Number(b.seq ?? 9999)) || String(a.item).localeCompare(String(b.item)));
    // 兜底:库里一条都没有(未跑种子的环境)⇒ 用内置常量(无 dbId ⇒ 不可维护,跑种子后即全量可维护)
    libRows.value = rows.length
      ? rows.filter((r) => r.rows.length)
      : [{ item: '(内置)', name: '(内置)', rows: JSON.parse(JSON.stringify(dt.seedRows || [])), n: (dt.seedRows || []).length, dbId: null, off: false }];
    libChecked.value = [];
    resetLibEdit();
    libVisible.value = true;
    return
  }
  if (flat || cfg.value?.testLib) {
    // 检验项目标准库 = yj_std_lib **唯一真源**(内置 26 组/48 子项+必测/型式种子见
    // tools/gen/gen-testlib-seed.cjs;**两个面板各用各的库,互不相通**:规格书(分组形态)读写
    // spec.test,出货检验计划表(扁平形态)读写 insp.plan 且只取本表区(item_code)的条目)。
    // all=1 连停用条目一起取回:停用条目灰显划线、不可勾选、可「恢复启用」——
    // 与 StdLibManager 同款维护能力(编辑/停用/恢复启用),改库不污染已录入单据。
    const res = await request.get('/stdlib/list', {
      // insp.plan **整库取回**(不传 item):单表形态下必测项/型式检验同表,两边都能挑;
      //   分组名由条目正文的 group 承载,落明细时写回 libGroupKey 那一列(见 flatGroupOf/confirmLib)。
      //   旧版这里传 dt.filterVal 按表区过滤 —— 现行设计没有表区,传空串会退化成"整库"但也可能被
      //   将来加回的过滤语义误伤,索性不传。
      // spec.test 同样整库取回,组名由正文 group 承载。
      params: flat ? { lib: 'insp.plan', all: 1 } : { lib: 'spec.test', all: 1 },
    }).catch(() => null);
    const rows = res?.data || [];
    if (rows.length) {
      if (flat) {
        // 出货检验计划表(扁平):规范结构 → 固定的 10 个中文键,一一对列名。
        // 分组名(必测项/型式检验)**不在**这 10 个键里(它是 item_code,不是明细字段),
        // 由 __entry.group 承载 ⇒ 勾选落明细时靠 flatGroupOf() 取回,写进 libGroupKey 那列。
        // __entry 挂原规范结构:平表表单只有 7 个字段,编辑保存时以 __entry 打底,
        // 否则条目里不合格应对措施/取样方式等本表单没有的列会被空串覆盖(丢数据);
        // confirmLib 落明细前会重新投影成 10 键,__entry 不会进单据。
        libRows.value = rows.map((r) => {
          const e = toCanonical(r.content, r.item);
          return { ...toInspRow(e), __entry: e, dbId: r.id, off: Number(r.enabled) === 0 }
        });
      } else {
        // 规格书(分组):组名取自规范结构的 group(旧 item_code 兜底);组序沿用内置常量的
        // 既有顺序(Excel 业务序),库里的新组缀后;停用条目同入组(off:checkbox 禁用+划线+可恢复)。
        const order = (cfg.value.testLib || []).map((g) => g.name);
        const groups = [];
        const grpOf = (name) => {
          let g = groups.find((x) => x.name === name);
          if (!g) { g = { name, subs: [] }; groups.push(g); }
          return g
        };
        for (const r of rows) {
          const e = toCanonical(r.content, r.item);
          grpOf(e.group || r.item).subs.push({ ...toSpecSub(e), __entry: e, dbId: r.id, off: Number(r.enabled) === 0 });
        }
        groups.sort((a, b) => {
          const ia = order.indexOf(a.name); const ib = order.indexOf(b.name);
          return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib)
        });
        libRows.value = groups;
      }
    } else {
      // 兜底:库里一条都没有(未跑种子的环境)才用内置常量展示(无 dbId → 不可编辑/停用,跑种子后即全量可维护)
      libRows.value = flat ? [...lib] : JSON.parse(JSON.stringify(cfg.value.testLib));
    }
  } else {
    libRows.value = [];
  }
  libChecked.value = [];
  resetLibEdit();
  libVisible.value = true;
}
/** 分组标准库勾选(键=组下标:子项下标);扁平表格走 el-table selection-change */
function toggleLib(key, on) {
  const i = libChecked.value.indexOf(key);
  if (on && i < 0) libChecked.value = [...libChecked.value, key];
  else if (!on && i >= 0) libChecked.value = libChecked.value.filter((k) => k !== key);
}
/** 标准库弹窗标题:三种库各自说明用途(原来固定写「检验项目标准库」,对组装工艺变体库是误导) */
const libDialogTitle = computed(() => {
  const lib = libTargetDt.value?.lib;
  if (lib === 'asm.proc') return '关键控制清单标准库'
  if (Array.isArray(lib)) return '检验项目标准库'
  return '检验项目标准库'
});
const libTargetDt = ref(null);
// ── 勾选 → 编辑 → 表单带入 → 保存修改(POST /stdlib/update) ──
// 两种形态各有一套表单,分别记一个"正在编辑的条目 id":非 null 即处于「保存修改」态。
// 条目全部来自 yj_std_lib(内置已种子入库)→ 有 dbId 一律可编辑;
// 仅"未跑种子环境的内置常量兜底"行没有 dbId,不可维护。
const libCEditId = ref(null); // 分组形态(规格书):子项表单
const libCEditEntry = ref(null); // 正在编辑条目的规范结构(保存时打底,含表单没有的字段)
const libCGroup = ref('');
const libCSub = ref('');
const libCReq = ref('');
const libCMethod = ref('');
const libCBasis = ref('');
const libFEditId = ref(null); // 扁平形态(出货检验计划):平表表单
const libFEditEntry = ref(null);
// 扁平形态的分组名 = 本条目在 yj_std_lib 里的 item_code(必测项/型式检验)。
// 【为什么要单独一格】设计重排后本表是**一张表**(没有 filterKey/filterVal),
//   分组名没了现成的来源:条目列表要按它过滤、新增条目要按它落 item_code
//   (StdLibController.add 对空 item 直接 400)。条目行自己带着这个值(见 libGroupKey),
//   表单一格跟着走,编辑时从条目回填、新增时手选/手输。
const libFGroup = ref('');
/** 扁平库的分组名(item_code):表单值优先,其次回落到表区(仍用 filterVal 的旧面板) */
function flatItem() {
  return (libFGroup.value || libTargetDt.value?.filterVal || '').trim()
}
/** 「补充自定义检验项」表单里分组格的初始值:libGroupKey 的选项取第一个,取不到退回表区 */
function flatDefaultGroup() {
  const key = libTargetDt.value?.libGroupKey;
  if (key) {
    const o = selectOptions(key)[0];
    if (o) return o.value
  }
  return libTargetDt.value?.filterVal || ''
}
/** 扁平库某条目的分组名(必测项/型式检验):条目正文的 group 优先(库条目挂在 __entry 上),
 *  退回行上的 libGroupKey 列(未跑种子时的内置兜底常量就是这么写的)。 */
function flatGroupOf(row) {
  return String(row?.__entry?.group || row?.[libTargetDt.value?.libGroupKey] || row?.group || '').trim()
}
const libFControl = ref('');
const libFQuality = ref('');
const libFInstrument = ref('');
const libFStandard = ref('');
const libFFrequency = ref('');
const libFContent = ref('');
const libFMethod = ref('');
/** 恰好勾选 1 条、且该条目是库里的条目(dbId;种子入库后含原内置 26 组/48 子项)才可编辑 */
function oneEditableChecked() {
  if (libChecked.value.length !== 1) return null
  const it = libChecked.value[0];
  // 变体库:弹窗里的编辑器只有"分组/扁平"两种形态,都不认 rows 结构 ⇒ 不给编辑(见 isAsmProcLib)
  if (isAsmProcLib.value) return null
  if (isGroupedLib.value) {
    const key = String(it);
    if (!/^\d+:\d+$/.test(key)) return null
    const s = libRows.value[Number(key.split(':')[0])]?.subs?.[Number(key.split(':')[1])];
    return s && s.dbId ? s : null
  }
  return it && it.dbId ? it : null
}
const canEditLibEntry = computed(() => !!oneEditableChecked());
function editLibEntry() {
  const e = oneEditableChecked();
  if (!e) {
    ElMessage.warning(tt('请先勾选一条要编辑的条目'));
    return
  }
  // 打底用的规范结构:取行上挂的原规范结构(__entry),没有再从投影值反推(老数据兜底)。
  // 注意不能写 toCanonical(JSON.stringify(row),''):它只挑规范键,custom/dbId/__entry 会被丢掉,
  // 于是「表单没显示的字段」就没人保了。
  const snap = { ...toCanonical(JSON.stringify(e), ''), ...(e.__entry || {}) };
  const c = toCanonical(snap, '');
  if (isGroupedLib.value) {
    libCGroup.value = c.group || libTargetDt.value?.filterVal || '';
    libCSub.value = c.name;
    libCReq.value = c.req;
    libCMethod.value = c.method;
    libCBasis.value = c.basis;
    libCEditId.value = e.dbId;
    libCEditEntry.value = snap;
  } else {
    libFControl.value = c.name;
    libFQuality.value = c.quality;
    libFInstrument.value = c.instrument;
    libFStandard.value = c.req;
    libFFrequency.value = c.freq;
    libFContent.value = c.content;
    libFMethod.value = c.method;
    // 分组名回填:条目正文的 group(规范结构),退回表区 —— 保存时 item_code 就用它,
    // 不给则条目会被 /stdlib/update 之外的路径改名(新增才是改名点,这里是保原值)
    libFGroup.value = c.group || libTargetDt.value?.filterVal || '';
    libFEditId.value = e.dbId;
    libFEditEntry.value = snap;
  }
  ElMessage.info(tt('已带入表单，改完点「保存修改」'));
}
function resetLibEdit() {
  libCEditId.value = null;
  libFEditId.value = null;
  libCEditEntry.value = null;
  libFEditEntry.value = null;
  libCGroup.value = '';
  libCSub.value = '';
  libCReq.value = '';
  libCMethod.value = '';
  libCBasis.value = '';
  libFControl.value = '';
  libFQuality.value = '';
  libFInstrument.value = '';
  libFStandard.value = '';
  libFFrequency.value = '';
  libFContent.value = '';
  libFMethod.value = '';
  libFGroup.value = flatDefaultGroup();
}
function cancelEditTestLib() {
  resetLibEdit();
  ElMessage.info(tt('已取消编辑'));
}
function cancelEditFlatLib() {
  resetLibEdit();
  ElMessage.info(tt('已取消编辑'));
}
// 自定义检验项补充(存 yj_std_lib,长期可用);编辑态下改为保存修改
async function addCustomTestLib() {
  const group = libCGroup.value.trim();
  if (!group || !libCReq.value.trim()) {
    ElMessage.warning(tt('请填写检验项目与检验要求'));
    return
  }
  // 编辑时以条目原规范结构打底(子项表单没有的字段原样保留),新增时空字段留空
  const content = toContentJson({
    ...(libCEditId.value ? (libCEditEntry.value || emptyEntry()) : emptyEntry()),
    group,
    name: libCSub.value.trim(),
    req: libCReq.value.trim(),
    method: libCMethod.value.trim(),
    basis: libCBasis.value.trim(),
  });
  try {
    if (libCEditId.value) {
      await request.post('/stdlib/update', { id: libCEditId.value, content });
      ElMessage.success(tt('已保存修改'));
    } else {
      await request.post('/stdlib/add', { lib: 'spec.test', item: group, content });
      ElMessage.success(tt('已存入标准库'));
    }
    resetLibEdit();
    await openLib(libTargetDt.value);
  } catch (e) {
    ElMessage.error(tt('保存失败'));
  }
}
/** 停用条目(✕,软删可恢复):与 StdLibManager 同款;只影响以后的勾选候选,已录入单据不变 */
async function stopLibRow(dbId) {
  if (!dbId) return
  try {
    await request.post('/stdlib/remove', { id: dbId });
    ElMessage.success(tt('已停用该条目'));
    await openLib(libTargetDt.value);
  } catch (e) {
    ElMessage.error(tt('操作失败'));
  }
}
/** 恢复启用停用条目(↩) */
async function enableLibRow(dbId) {
  if (!dbId) return
  try {
    await request.post('/stdlib/enable', { id: dbId });
    ElMessage.success(tt('已恢复启用'));
    await openLib(libTargetDt.value);
  } catch (e) {
    ElMessage.error(tt('操作失败'));
  }
}
/** 彻底删除条目(🗑 物理删,与「停用」相对):确认后不可恢复;已录入单据存的是内容文本,不受影响 */
async function destroyLibRow(dbId) {
  if (!dbId) return
  try {
    await ElMessageBox.confirm(tt('彻底删除该条目？不可恢复，已录入单据不受影响。'), tt('彻底删除'),
      { type: 'warning', confirmButtonText: tt('确定'), cancelButtonText: tt('取消') });
  } catch { return /* 取消 */ }
  try {
    await request.post('/stdlib/destroy', { id: dbId });
    ElMessage.success(tt('已彻底删除'));
    await openLib(libTargetDt.value);
  } catch (e) {
    ElMessage.error(tt('删除失败'));
  }
}

// ── 出货检验计划:自定义补充(扁平结构) ──
const isGroupedLib = computed(() => libRows.value.length > 0 && Array.isArray(libRows.value[0]?.subs));
const hasDbFlat = computed(() => libRows.value.some((r) => r.dbId));
/**
 * 组装工艺 4 变体库(第三态)。
 *
 * ⚠ 这一态**既不是**分组库(spec.test,行上有 subs)**也不是**扁平库(insp.plan)——
 *   它的条目正文是 `{v:1,rows:[{工序,工序控制内容,管控要求,检查比例}]}`。
 *   两处必须按它排除,否则会套用扁平库那套 7 个字段(控制项目/质量控制内容/…):
 *     ① 弹窗里会多出一整块「补充自定义检验项」表单 —— 字段名与本库毫不相干,
 *        点「存入标准库」还会把条目写进 **insp.plan**;
 *     ② 「编辑」会把该行喂给扁平编辑器(扁平键在变体条目上全取不到 ⇒ 显示空表单),
 *        再点「保存修改」就 POST /stdlib/update **用扁平 content 覆盖掉变体的 rows** ——
 *        整套工序没了。所以下面 oneEditableChecked() 对该库直接返回 null(编辑按钮置灰),
 *        条目的增删改走「标准库维护」(StdLibManager,它把正文当字符串原样往返)。
 */
const isAsmProcLib = computed(() => libTargetDt.value?.lib === 'asm.proc');
/** 平表表单 → 规范结构:编辑时以条目原规范结构打底(保住列上没显示的字段),新增时空字段留空 */
function flatContent() {
  return toContentJson({
    ...(libFEditId.value ? (libFEditEntry.value || emptyEntry()) : emptyEntry()),
    // 组名 = 该条目在库里的 item_code(必测项/型式检验);检验固定 IQC
    group: flatItem(),
    name: libFControl.value.trim(),
    quality: libFQuality.value.trim(),
    instrument: libFInstrument.value.trim(),
    req: libFStandard.value.trim(),
    inspect: 'IQC',
    freq: libFFrequency.value.trim(),
    content: libFContent.value.trim(),
    method: libFMethod.value.trim(),
  })
}
async function addCustomFlatLib() {
  const control = libFControl.value.trim();
  if (!control || !libFStandard.value.trim()) {
    ElMessage.warning(tt('请填写控制项目与控制标准'));
    return
  }
  // item 为空后端直接 400(StdLibController.add 校验 lib/item/content 三者非空)——
  // 旧版靠 filterVal 兜着,本面板没有表区了 ⇒ 分组格必须选/填一个
  const item = flatItem();
  if (!item) {
    ElMessage.warning(tt('请先选择分组'));
    return
  }
  // 与规格书同一套规范结构,但**各存各的库**:出货检验计划表写 insp.plan(item=分组名)
  const content = flatContent();
  try {
    if (libFEditId.value) {
      await request.post('/stdlib/update', { id: libFEditId.value, content });
      ElMessage.success(tt('已保存修改'));
    } else {
      await request.post('/stdlib/add', { lib: 'insp.plan', item, content });
      ElMessage.success(tt('已存入标准库'));
    }
    resetLibEdit();
    await openLib(libTargetDt.value);
  } catch (e) {
    ElMessage.error(tt('保存失败'));
  }
}
function confirmLib() {
  const dt = libTargetDt.value;
  if (!dt) return
  const arr = touch();
  // ── 组装工艺 4 变体:勾选一个变体 ⇒ 把本表区的行**整表替换**成该变体的 rows ──
  // 语义与另两态不同(那两态是"逐条追加"):变体是一整套工序,混着用没有意义。
  if (dt.lib === 'asm.proc') {
    const picked = libChecked.value[0];
    if (picked && picked.rows && picked.rows.length) {
      const key = dt.filterKey || '表区';
      const val = dt.filterVal;
      // 只替换本表区的行(同面板多表区共表时不能动别的表区)
      for (let i = arr.length - 1; i >= 0; i--) {
        if (String(arr[i][key] || '') === String(val || '')) arr.splice(i, 1);
      }
      for (const r of picked.rows) arr.push({ ...r, [key]: val });
      // 同时把变体名写进头皮字段(产品形态),使 variantKey/variants 也跟着切
      if (cfg.value?.variantKey && cfg.value.variants?.[picked.item]) {
        props.head[cfg.value.variantKey] = picked.item;
      }
    }
    libChecked.value = [];
    libVisible.value = false;
    emit('dirty');
    return
  }
  const grouped = libRows.value.length && Array.isArray(libRows.value[0].subs);
  if (grouped) {
    for (const key of libChecked.value) {
      const [gi, si] = key.split(':').map(Number);
      const g = libRows.value[gi];
      const s = g && g.subs[si];
      if (!g || !s) continue
      arr.push({
        '表区': dt.filterVal,
        '检验项目': s.name ? g.name + '·' + s.name : g.name,
        '检验要求': s.req || '',
        '检验方法': s.method || '',
        '检验依据': s.basis || '',
      });
    }
  } else {
    for (const row of libChecked.value) {
      // 只把行投影成规范的 10 个中文键落进明细——否则 custom/dbId 会跟着 spread 存进单据
      // (保存链路只剥 id/__id/__no,认不出这两个键,会当成业务字段留在库里)
      const proj = toInspRow(toCanonical(row, ''));
      const out = dt.filterKey ? { [dt.filterKey]: dt.filterVal, ...proj } : { ...proj };
      // 分组名(必测项/型式检验)随勾选带回明细:toInspRow 的 10 个键里没有它 ⇒ 不会被 proj 盖掉;
      // 但配置若把 libGroupKey 指到一个 proj **已有**的键上,就是配置错了 —— 那种情况下宁可保留
      // proj 的值(条目正文的真实内容)也不让分组名去覆盖,故先判 undefined 再写。
      const grp = flatGroupOf(row);
      if (dt.libGroupKey && grp && out[dt.libGroupKey] === undefined) out[dt.libGroupKey] = grp;
      arr.push(out);
    }
  }
  libChecked.value = [];
  libVisible.value = false;
  emit('dirty');
}

/** 数据表列宽是否自持(列带 w 时数据表用自己的 colgroup,与全页网格解耦——出货检验计划/规格书) */
function dtOwnsWidth(dt) {
  return visCols(dt).some((c) => c.w)
}

/**
 * 变体切换行(申请单类型)占前几列。
 * 原来写死 2 列:在 16 列网格里「申请单类型：内部委托 ▼」被挤成两行(页面 0 实测),
 * 而宽网格前几列本就窄。给到 6 列(不超过总列数-1,右侧留一格静默填充)。
 * ⚠ 目前只有 测试申请单(RD_DOM_TEST)走 report + variantKey 这条路;
 *   plain 版式的面板走 subtitle(不受影响)。
 */
function variantSpan(dt) {
  return Math.max(2, Math.min(6, totalSpan(dt) - 1))
}function dtW(dt) {
  return visCols(dt).reduce((s, c) => s + (c.w || 100), 0)
}

// ── 像素级还原(dt.design):配置为设计图像素单位,按 k = 网格宽 / 可见列设计宽 等比缩放 ──
function designK(dt) {
  if (!dt.design) return 1
  const w = visCols(dt).reduce((s, c) => s + (c.w || 100), 0);
  return w ? gridW.value / w : 1
}
function dpx(dt, v) {
  return Math.round(v * designK(dt))
}
function designTitleStyle(dt) {
  if (!dt.design) return null
  const d = dt.design;
  return {
    fontSize: dpx(dt, d.titleSize || 21) + 'px',
    letterSpacing: '0',
    padding: `${dpx(dt, d.titleTop || 14)}px 0 ${dpx(dt, d.titleGap || 16)}px`,
  }
}
function designThStyle(dt) {
  if (!dt.design) return null
  const d = dt.design;
  return { height: dpx(dt, d.headerH || 22) + 'px', fontSize: dpx(dt, d.fontSize || 11) + 'px', background: '#fff', color: '#333' }
}
function designTdStyle(dt, alignKey) {
  if (!dt.design) return null
  const d = dt.design;
  const alignMap = { seq: 'center', item: 'center', sub: 'center', req: 'left', method: 'left', basis: 'left' };
  const style = { fontSize: dpx(dt, d.fontSize || 11) + 'px', textAlign: alignMap[alignKey] || 'center' };
  if (d.rowH) style.height = dpx(dt, d.rowH) + 'px';
  return style
}
function designInputStyle(dt) {
  if (!dt.design) return null
  return { fontSize: dpx(dt, dt.design.fontSize || 11) + 'px', textAlign: 'center' }
}

// ── 分组式设计表(检验项目及标准):行按「组·子项」前缀分组,组跨行、序号按组编号 ──
function designGroupRows(dt) {
  const out = [];
  let g = null;
  for (const row of rowsOf(dt)) {
    const label = row['检验项目'] || '';
    const dot = label.indexOf('·');
    const gLabel = dot >= 0 ? label.slice(0, dot) : label;
    const sub = dot >= 0 ? label.slice(dot + 1) : '';
    if (!g || g.label !== gLabel) {
      g = { label: gLabel, count: 0, seq: out.filter((x) => x.groupFirst).length + 1 };
    }
    g.count++;
    out.push({ key: 'gr' + out.length, row, group: g, groupFirst: g.count === 1, sub, standalone: dot < 0, seq: g.seq });
  }
  return out
}

// ── 条件区列格式:sec.cols 自定义(工序/检验格数据),缺省沿用面板网格 ──
function secCols(sec) {
  return sec.cols || effGrid.value
}
function secW(sec) {
  return secCols(sec).reduce((s, w) => s + w, 0)
}

// ── 工序阶段行:行左端 stage 单元格纵向合并(Excel A 列 灌料/烧结/脱模…) ──
function stageSpan(sec, ri) {
  let n = 1;
  for (let i = ri + 1; i < sec.rows.length && !sec.rows[i].stage; i++) n++;
  return n
}

// ── 合计行(成型配方):对指定列求数值和 ──
// 位数跟本列明细走(2026-10-03 口径,见 @core/panel/sumTotals):原先固定收敛到 4 位,
// 明细若写 5~6 位(库内确有 scale=6 的列)合计仍会少位。
function totalOf(dt, key) {
  const sum = sumKeepScale(rowsOf(dt).map((r) => r[key]));
  return sum ? String(sum) : ''
}

const fieldMap = computed(() => new Map(props.fields.map((f) => [f.dataName || f.code, f])));
function selectOptions(key) {
  const f = fieldMap.value.get(key);
  const opts = f?.options || [];
  return opts.map((o) => (typeof o === 'object' ? { value: o.value ?? o.label, label: o.label ?? o.value } : { value: o, label: o }))
}

// ── 参照字段(产品编号等 -> 产品信息表):点击单元格弹参照,确认后按 refMap 带回(产品名称等) ──
function isRefKey(key) {
  if (!key) return false
  const f = fieldMap.value.get(key);
  return !!(f && f.refPanel)
}
const prodRefVisible = ref(false);
const prodRefKey = ref('');
const prodRefField = computed(() => fieldMap.value.get(prodRefKey.value) || null);

// ── 产品开发状态角标(2026-09-09):本面板的产品键已下发时,在单元格标注 未开发 / 已开发 ──
const DEV_PANEL_CODES = ['RD_MOLD_PROC', 'RD_ASM_PROC', 'RD_SPEC_DOC', 'RD_INSP_PLAN'];
const devStatus = ref('');
const devKey = computed(() => {
  for (const k of ['产品编号', '编号']) {
    if (fieldMap.value.has(k) && isRefKey(k)) return k
  }
  return ''
});
watch(
  () => [props.panelCode, devKey.value ? props.head[devKey.value] : ''],
  async () => {
    const code = devKey.value ? props.head[devKey.value] : '';
    if (!code || !DEV_PANEL_CODES.includes(props.panelCode)) {
      devStatus.value = '';
      return
    }
    try {
      const res = await request.post('/px/rdDev/annotate', { panelCode: props.panelCode, productCodes: [code] });
      const map = res?.data?.data || res?.data || {};
      devStatus.value = map[code] || '';
    } catch (e) {
      devStatus.value = '';
    }
  },
  { immediate: true }
);
function openProdRef(key) {
  if (!props.editable || !isRefKey(key)) return
  prodRefKey.value = key;
  prodRefVisible.value = true;
}
function onProdRefConfirm(rows) {
  const f = prodRefField.value;
  const source = rows?.[0];
  if (!f || !source) return
  const refField = f.refField || f.dataName;
  props.head[prodRefKey.value] = source[refField] ?? '';
  for (const m of f.refMap || []) {
    if (m && source[m.from] !== undefined) props.head[m.to || m.from] = source[m.from];
  }
  // 炭棒尺寸整串 → 成型面板 炭棒规格1/2/3 三窄格拆分回填(外：/内：/长： 前缀区分数值;源 Excel 即外径/内径/长度三个窄数字格)
  const sizeStr = String(source['炭棒尺寸'] ?? '');
  if (sizeStr && fieldMap.value.has('炭棒规格1')) {
    const dim = (kw, prefix) => {
      const v = (sizeStr.match(new RegExp(kw + '\\s*([0-9.]+)\\s*mm')) || [])[1];
      return v ? `${prefix}${v}` : ''
    };
    props.head['炭棒规格1'] = dim('外径', '外：');
    props.head['炭棒规格2'] = dim('内径', '内：');
    props.head['炭棒规格3'] = dim('长度', '长：');
  }
  prodRefVisible.value = false;
  emit('dirty');
  // 「自动填充规格书」:面板块若配了 autoFillSpec 且本次选中的就是它的 fromKey(产品编号),
  // 紧接着按该编号拉规格书内容回填 —— 用户点「确定」后不用再点第二下按钮。
  const afs = cfg.value?.autoFillSpec;
  if (afs && prodRefKey.value === afs.fromKey) autoFillFromSpec(props.head[afs.fromKey], afs);
}

/** 该面板承载 autoFillSpec.detail 落点的明细表:按第一个 to 键在哪张表的列里找,找不到用第一张 */
function autoFillTargetDt(afs) {
  const want = (afs.detail || []).map((m) => m.to);
  const tables = cfg.value?.dataTables || [];
  return tables.find((dt) => (dt.cols || []).some((c) => want.includes(c.key))) || tables[0] || null
}

/**
 * 自动填充规格书 —— 「自动填充规格书」就是这条路径:
 *   选定产品编号 → 取该产品对应**规格书**(RD_SPEC_DOC)的表头 + 「检验要求」表区明细 → 回填。
 *
 * 【为什么走后端 /px/specByProduct 而不是通用查询】规格书的 编号(=产品键)在通用链路里被
 *   QueryService.loadDocs 用单据编号覆盖掉了(详见该处注释),getFormDescriptor /
 *   queryFormDataList 都取不到真值。该端点另开一条直读 head/detail 的路。
 *
 * 【填充口径】
 *   表头:按 head[] 逐格写(客户项目名称/产品功能类别/产品整体尺寸 ← 规格书等价列);
 *   明细:整表替换 —— 本表的检验项就是规格书的检验项,逐条追加会越填越长;
 *   兜底:defaults 里的固定值(如不合格应对措施三段式)**只填空格**,不覆盖已录内容。
 *   命中多张规格书时(matched>1)只取最新一张,末尾提示按哪一张填的,不让用户猜。
 */
async function autoFillFromSpec(code, afs) {
  const key = afs?.fromKey;
  const val = String(code ?? '').trim();
  if (!key || !val || !props.editable) return
  const dt = autoFillTargetDt(afs);
  let payload = null;
  try {
    const res = await request.get('/px/specByProduct', { params: { code: val } });
    // request.js 的响应拦截器已 (res) => res.data ⇒ 这里拿到的是 ApiResult {code,message,data}
    payload = res?.data ?? res ?? null;
  } catch (e) {
    ElMessage.warning(tt('取规格书失败，请手工填写'));
    return
  }
  if (!payload || !payload.found) {
    // 门禁口径见 core/insp/specCarry.js:规格书必须填写并提交审批完,否则一个格都不带入
    const fail = specCarryFailure(payload);
    if (fail && fail.kind === 'not_approved') {
      ElMessage.warning(tt('该产品的规格书 {no} 还没填写提交审批完（当前：{st}），暂不能自动带入 —— 请先在规格书里填好并走完提交审批')
        .replace('{no}', fail.specNo || '')
        .replace('{st}', fail.status || tt('未知')));
      return
    }
    ElMessage.info(tt('该产品编号还没有对应的规格书，请先分发规格书后再来引用'));
    return
  }
  const rows = Array.isArray(payload.items) ? payload.items : [];
  const filled = rows.map((r) => {
    const row = {};
    for (const m of afs.detail || []) row[m.to] = r[m.from] === undefined || r[m.from] === null ? '' : String(r[m.from]);
    if (dt?.filterKey) row[dt.filterKey] = dt.filterVal;
    return row
  });

  const cur = dt ? rowsOf(dt) : [];
  if (cur.length) {
    try {
      await ElMessageBox.confirm(
        tt('本表已有 {n} 行，改用规格书 {no} 的 {m} 行内容替换？').replace('{n}', String(cur.length)).replace('{no}', payload.单据编号 || '').replace('{m}', String(filled.length)),
        tt('自动填充规格书'),
        { type: 'warning', confirmButtonText: tt('替换'), cancelButtonText: tt('取消') },
      );
    } catch (e) {
      return // 用户选了「取消」:保留原行
    }
  }

  // 表头逐格回填(空值不回填,免得把已录内容清成空白)
  for (const m of afs.head || []) {
    const v = payload[m.from];
    if (v !== undefined && v !== null && String(v).trim() !== '') props.head[m.to] = String(v);
  }
  if (dt && filled.length) {
    // 兜底固定值(设计 F9 模板行的三段应对措施)逐行填空格 —— 是**明细**字段,不动表头
    for (const row of filled) {
      for (const [k, v] of Object.entries(afs.defaults || {})) {
        if (!String(row[k] ?? '').trim()) row[k] = v;
      }
    }
    const arr = touch();
    if (dt.filterKey) {
      // 多表区共用一张行表:只换本表区的行,别的表区原样留着
      const kept = arr.filter((r) => String(r[dt.filterKey] || '') !== String(dt.filterVal || ''));
      arr.splice(0, arr.length, ...kept, ...filled);
    } else {
      arr.splice(0, arr.length, ...filled);
    }
  }
  prodRefVisible.value = false;
  emit('dirty');
  const more = Number(payload.matched) > 1 ? tt('（该产品有多张规格书，按最新的填）') : '';
  ElMessage.success(tt('已按规格书 {no} 自动填充').replace('{no}', payload.单据编号 || '') + more);
  // 刚按规格书填过 ⇒ 与规格书一致,把"变动"提示清掉
  specDriftState.value = null;
}

/* ── 规格书变动提示(2026-09-21 用户口径:「规格书变动就提示当前出货检验」)──────────────
   单子填完之后规格书又变了(同张改了内容 / 出了新版本),打开这张出货检验计划表时要看得见
   "与规格书不一致",并能一键按规格书更新。判据 = core/insp/specCarry.specDrift(只比内容不比单号)。 */
const specDriftState = ref(null);   // { specNo, added[], removed[], changed[], drifted }
let specDriftCheckedKey = '';       // 同一次载入只查一次(表头每次编辑都会触发 watch,不能每次都打接口)
let specDriftCheckedHead = null;    // 记表头对象:对象换了=重新载入了(重开同一张单也要重查,不能只看单据号)

/** 按当前明细 + 规格书算差异(取规格书走与自动填充同一个受门禁保护的口径) */
async function checkSpecDrift() {
  const afs = cfg.value?.autoFillSpec;
  if (!afs || !props.editable) return
  const dt = autoFillTargetDt(afs);
  const code = String(props.head?.[afs.fromKey] ?? '').trim();
  if (!dt || !code) { specDriftState.value = null; return }
  try {
    const res = await request.get('/px/specByProduct', { params: { code } });
    const payload = res?.data ?? res ?? null;
    if (!payload || !payload.found) { specDriftState.value = null; return }
    const specRows = (Array.isArray(payload.items) ? payload.items : []).map((r) => ({
      检验项目: r['检验项目'], 检验要求: r['检验要求'], 检验方法: r['检验方法'],
    }));
    const drift = specDrift(specRows, rowsOf(dt));
    specDriftState.value = drift.drifted
      ? { ...drift, specNo: payload.单据编号 || '', specVersion: payload['版本'] || props.head?.['版本号'] || '' }
      : null;
  } catch {
    specDriftState.value = null;   // 读不到就不提示(不打扰),但绝不假装"一致"
  }
}

/** 变动提示文案(挂在表头条上,与「从标准库勾选」同一排动作) */
const specDriftText = computed(() => {
  const d = specDriftState.value;
  if (!d) return ''
  const parts = [];
  if (d.added.length) parts.push(tt('规格书新增') + ' ' + d.added.join('、'));
  if (d.removed.length) parts.push(tt('规格书已删') + ' ' + d.removed.join('、'));
  if (d.changed.length) parts.push(tt('规格书已改') + ' ' + d.changed.map((c) => `${c.item}(${c.fields.join('/')})`).join('、'));
  return tt('规格书已变动') + '：' + parts.join('；') + tt(' —— 点这里按规格书更新')
});

// ── 字段编辑(数据记录表):列名可改,应对复杂测试环境 ──
/** 动态列头标签:优先取后端 yj_field 的 alias/displayName,缺省回退配置硬编码 label */
function effColLabel(key, fallback) {
  const f = fieldMap.value.get(key);
  return f?.displayName || f?.alias || fallback || key
}

const fieldEditVisible = ref(false);
const fieldEditRows = ref([]);
function openFieldEdit() {
  const rows = [];
  const seen = new Set();
  const push = (key, label) => {
    if (!key || seen.has(key)) return
    seen.add(key);
    const f = fieldMap.value.get(key);
    rows.push({
      key,
      colName: f?.name || f?.code || key,
      label,
      alias: f?.displayName || '',
      originalAlias: f?.displayName || '',
      visible: f ? !f.hidden : true,
    });
  };
  // 数据表列
  for (const dt of cfg.value?.dataTables || []) {
    for (const c of dt.cols || []) {
      if (c.hiddenCol) continue
      push(c.key, c.label);
    }
  }
  // section 网格字段(成型工艺清单等:标签行/值行的 key 与 label)
  for (const sec of [...(cfg.value?.sections || []), ...(cfg.value?.tailSections || [])]) {
    for (const row of sec.rows || []) {
      if (row.grid) {
        for (const c of row.grid) {
          if (c.label) push(c.label, c.label);
          if (c.key && c.key !== c.label) push(c.key, c.key);
        }
      } else if (row.label && row.key) {
        push(row.key, row.label);
      } else if (row.label) {
        push(row.label, row.label);
      }
      if (row.label2) push(row.label2, row.label2);
    }
  }
  fieldEditRows.value = rows;
  fieldEditVisible.value = true;
}
async function saveFieldEdit() {
  // 只发送有变更的行(避免空 alias 批量覆盖已有别名 + seq 重排副作用)
  const changed = fieldEditRows.value.filter((r) => r.alias !== (r.originalAlias || ''));
  if (!changed.length) {
    fieldEditVisible.value = false;
    return
  }
  try {
    const res = await request.post('/px/saveColumnPrefs', {
      panelCode: props.panelCode,
      columns: changed.map((r) => ({
        label: r.colName,
        alias: r.alias || '',
        visible: !!r.visible,
      })),
    });
    if (res && res.code && res.code !== 200) {
      ElMessage.error(res.message || tt('保存失败'));
      return
    }
    ElMessage.success(tt('字段编辑已保存'));
    fieldEditVisible.value = false;
    emit('refresh-config');
  } catch (e) {
    ElMessage.error(tt('保存失败'));
  }
}

// 碱性原水水质条:6 指标名与字段键(前3个 √/× 下拉,后3个文本)
const waterNames = ['自来水', '超纯水', 'RO纯水（水效水+RO机）', 'PH', 'TDS', '水温'];
const waterKeys = ['原水自来水', '原水超纯水', '原水RO纯水', '原水PH', '原水TDS', '水温'];

// 浸泡安全:浸泡液用量块 + 仪器/检出限 4 行(PH/TDS/浊度/重金属)
const soakSizeKeys = ['炭棒尺寸（1）', '炭棒尺寸（2）', '炭棒尺寸（3）'];
const soakVolKeys = ['浸泡液用量（1）ml', '浸泡液用量（2）ml', '浸泡液用量（3）ml'];
const soakInstrumentRows = [
  { name: 'PH', keys: ['仪器名称（PH）', '品牌型号（PH）', '检出限（PH）'] },
  { name: 'TDS', keys: ['仪器名称（TDS）', '品牌型号（TDS）', '检出限（TDS）'] },
  { name: '浊度', keys: ['仪器名称（浊度）', '品牌型号（浊度）', '检出限（浊度）'] },
  { name: '重金属', keys: ['仪器名称（重金属）', '品牌型号（重金属）', '检出限（重金属）'] },
];

const items = computed(() => {
  const d = props.head?.detail;
  return d && Array.isArray(d.items) ? d.items : []
});
function touch() {
  const d = props.head.detail || (props.head.detail = {});
  if (!Array.isArray(d.items)) d.items = [];
  return d.items
}

// ── 数据记录表渲染 ──
function visCols(dt) {
  return colsOf(dt).filter((c) => !c.hiddenCol)
}
function groupCols(dt) {
  return visCols(dt).filter((c) => c.group)
}
function hasGroup(dt) {
  return groupCols(dt).length > 0
}
/** 可见列的总跨度(网格列数口径) */
function totalSpan(dt) {
  return visCols(dt).reduce((s, c) => s + (c.span || 1), 0)
}
/** 一级表头:非 group 列(rowspan=2 仅当有两级表头);group 列合并为一条(colspan=成员跨度之和) */
function headerRow1(dt) {
  const out = [];
  for (const c of visCols(dt)) {
    if (!c.group) {
      out.push({ kind: 'plain', label: c.label, key: c.key, span: c.span || 1, rowspan: hasGroup(dt) ? 2 : 1 });
    } else if (!out.length || out[out.length - 1].kind !== 'group' || out[out.length - 1].label !== c.group) {
      out.push({ kind: 'group', label: c.group, span: c.span || 1 });
    } else {
      out[out.length - 1].span += c.span || 1;
    }
  }
  return out
}
/** 子头行(碱性:口感测试/离子分析):按网格列跨度铺 colspan */
function spreadSubHeads(dt) {
  const total = totalSpan(dt);
  const out = [];
  let used = 0;
  for (const sh of dt.subHeads || []) {
    const span = Math.min(sh.span, total - used);
    if (span > 0) out.push({ label: sh.label, span });
    used += span;
  }
  return out
}
/** 行集:矿化按 指标 / 规格书按 表区 分块(filterKey+filterVal);其余全量 */
function rowsOf(dt) {
  if (dt.filterKey) return items.value.filter((r) => (r[dt.filterKey] || '') === dt.filterVal)
  if (!dt.metric) return items.value
  return items.value.filter((r) => (r['指标'] || '') === dt.metric)
}
function addRow(dt) {
  const row = dt.filterKey ? { [dt.filterKey]: dt.filterVal } : {};
  if (dt.metric) row['指标'] = dt.metric;
  // 序号自动编:dataTables 里声明 autoSeqBar 的表(成型配方表)按**本表区**已有行数续编。
  // 原来只认面板级 cfg.autoSeq 且用全表 touch().length 计数——多表区共用一张明细表时
  // 会串号(配方行数被工序/BOM 行数带偏),故改为按表区过滤后计数。
  if (dt.autoSeqBar || cfg.value?.autoSeq) row['序号'] = String(rowsOf(dt).length + 1);
  touch().push(row);
  emit('dirty');
}
function removeRow(row) {
  const arr = touch();
  const i = arr.indexOf(row);
  if (i >= 0) arr.splice(i, 1);
  emit('dirty');
}

// 明细预置(seedRows):进入草稿编辑且明细为空时自动带出标准行(浸泡安全 17 项卫生项目/组装工艺 20 道工序)
// 监听含 head 对象本身:cur 整体替换(单据加载)时也会触发,避免预填丢失
watch(() => [props.editable, props.head], ([v]) => {
  if (!v || !cfg.value?.seedRows) return
  if (!props.head || !props.head['单据编号']) return
  const arr = touch();
  if (arr.length) return
  for (const row of cfg.value.seedRows) {
    arr.push({ ...row });
  }
});

// 章节默认值(规格书 7.运输要求/8.存储环境 通用文案):进入草稿编辑且字段为空时预填
watch(() => [props.editable, props.head], ([v]) => {
  if (!v || !cfg.value?.sectionDefaults) return
  if (!props.head || !props.head['单据编号']) return
  for (const [k, val] of Object.entries(cfg.value.sectionDefaults)) {
    if (props.head[k] === undefined || props.head[k] === null || String(props.head[k]).trim() === '') {
      props.head[k] = val;
    }
  }
});

/**
 * 规格书变动检查:可编辑单据载入后查一次。
 * ⚠ 去重按「表头对象 + 单据编号|产品编号」:表头每次编辑都会触发这个 watch,不按对象去重就会
 *   每敲一个字打一次接口;而**重开同一张单**时表头是新的对象 ⇒ 必须重查(否则改版提示永远不刷新)。
 */
watch(
  () => [props.editable, props.head, cfg.value?.autoFillSpec ? props.head?.[cfg.value.autoFillSpec.fromKey] : ''],
  async ([v, head, code]) => {
    if (!v || !cfg.value?.autoFillSpec || !head || !head['单据编号'] || !code) { specDriftState.value = null; return }
    const key = `${head['单据编号']}|${code}`;
    if (key === specDriftCheckedKey && head === specDriftCheckedHead) return
    specDriftCheckedKey = key;
    specDriftCheckedHead = head;
    await checkSpecDrift();
  },
  { immediate: true },
);

// ---------- 配方计算(成型工艺清单:读页 2 配方表 → 算 → 回填页 1 与配方表) ----------
// 口径见 CONTEXT.md「配方计算器」与 docs/adr/0004:公式固定(与设计器 exe 逐位一致)、
// 弹窗输入不落库不打印,只有回填进单据字段的值随单据保存。逻辑全在 core/mold/,这里只负责把行喂给它。
const recipeCalcVisible = ref(false);
const recipeCalcRows = ref([]);
function openRecipeCalc(dt) {
  recipeCalcRows.value = rowsOf(dt);
  recipeCalcVisible.value = true;
}

// ── 章节标准库(yj_std_lib,lib=spec.section):1-3/6-8 章节内容可勾选示例、可自行补充 ──
// 列表维护(增/编/停用/恢复)交给 StdLibManager;本处保留「多行新增」框与「勾选→填入」到当前章节字段
const secLibVisible = ref(false);
const secLibRef = ref(null);
const secLibLabel = ref('');
const secLibKey = ref('');
const secLibDraft = ref('');
// 章节/模板标准库弹窗的库与条目:由 openSectionLib 按字段声明决定(见该函数注释)
const secLibLib = ref('spec.section');
const secLibItem = ref('');
async function openSectionLib(row) {
  secLibKey.value = row.key;
  // grid 单元格没有 label(那是标签格才有),退回 key,免得弹窗标题空着
  secLibLabel.value = row.label || row.key || '';
  // 库与条目按**字段自己声明的标准库**走(成型工艺的 配料要求/热压要求);
  // 没声明库的老调用方(规格书章节)保持原样:spec.section + 条目名=章节名。
  const lib = stdLibOf(row.key);
  secLibLib.value = lib || 'spec.section';
  secLibItem.value = lib ? '默认' : (row.label || row.key || '');
  secLibDraft.value = props.head?.[row.key] || '';
  secLibVisible.value = true;
}
function applySectionLib(content) {
  if (!props.head) return
  props.head[secLibKey.value] = content;
  emit('dirty');
  secLibVisible.value = false;
}
async function addSectionLib() {
  const text = (secLibDraft.value || '').trim();
  if (!text) return
  try {
    await request.post('/stdlib/add', { lib: 'spec.section', item: secLibLabel.value, content: text });
    ElMessage.success(tt('已存入标准库'));
    secLibDraft.value = '';
    await secLibRef.value?.load();
  } catch (e) {
    ElMessage.error(tt('保存失败'));
  }
}

// ── 矿化散点图(Excel 原表 4 张 XY 散点图:3 系列 × 累计流量) ──
const SERIES = [
  { name: 'RO出水', color: '#4472c4', key: 'RO出水' },
  { name: '浸泡30min', color: '#ed7d31', key: '浸泡30min' },
  { name: '浸泡30min煮沸晾凉', color: '#70ad47', key: '浸泡30min煮沸晾凉' },
];
function chartOf(dt) {
  const ml = 52, mr = 14, mt = 26, mb = 46;
  const rows = rowsOf(dt);
  const pts = [];
  for (const s of SERIES) {
    const ps = rows
      .map((r) => ({ x: parseFloat(r['累计流量L']), y: parseFloat(r[s.key]) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    pts.push(ps);
  }
  const all = pts.flat();
  const hasData = all.length > 0;
  let minX = 0, maxX = 10, minY = 0, maxY = 10;
  if (hasData) {
    minX = Math.min(...all.map((p) => p.x));
    maxX = Math.max(...all.map((p) => p.x));
    minY = Math.min(...all.map((p) => p.y));
    maxY = Math.max(...all.map((p) => p.y));
    if (minX === maxX) maxX = minX + 1;
    if (minY === maxY) maxY = minY + 1;
  }
  const px = (x) => ml + ((x - minX) / (maxX - minX)) * (CW - ml - mr);
  const py = (y) => CH - mb - ((y - minY) / (maxY - minY)) * (CH - mt - mb);
  const fmt = (n) => (Math.abs(n) >= 1000 ? Math.round(n).toString() : String(Math.round(n * 100) / 100));
  const gridH = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
    y: CH - mb - r * (CH - mt - mb),
    label: fmt(minY + r * (maxY - minY)),
  }));
  const gridV = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
    x: ml + r * (CW - ml - mr),
    label: fmt(minX + r * (maxX - minX)),
  }));
  return {
    ml, mr, mt, mb, hasData,
    gridH, gridV,
    series: SERIES.map((s, i) => ({ name: s.name, color: s.color, pts: pts[i].map((p) => [px(p.x), py(p.y)]) })),
  }
}

return (_ctx, _cache) => {
  const _component_el_input = ElInput;
  const _component_el_icon = ElIcon;
  const _component_el_option = ElOption;
  const _component_el_select = ElSelect;
  const _component_el_checkbox = ElCheckbox;
  const _component_el_date_picker = ElDatePicker;
  const _component_el_time_picker = ElTimePicker;
  const _component_el_radio = ElRadio;
  const _component_el_table_column = ElTableColumn;
  const _component_el_table = ElTable;
  const _component_el_scrollbar = ElScrollbar;
  const _component_el_button = ElButton;
  const _component_el_dialog = ElDialog;

  return (openBlock(), createElementBlock("div", _hoisted_1, [
    (pageList.value.length)
      ? (openBlock(), createElementBlock("div", _hoisted_2, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(pageList.value, (pg, pi) => {
            return (openBlock(), createElementBlock("div", {
              key: 'pg' + pi,
              class: normalizeClass(["rsp-page-tab", { active: activePage.value === pi }]),
              onClick: $event => (activePage.value = pi)
            }, toDisplayString(unref(tt)(pg.title)), 11, _hoisted_3))
          }), 128))
        ]))
      : createCommentVNode("", true),
    (!effPlain.value && showReportHead.value)
      ? (openBlock(), createElementBlock("table", {
          key: 1,
          class: "rs-t rs-head-t",
          style: normalizeStyle({ width: gridW.value + 'px' })
        }, [
          createBaseVNode("colgroup", null, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(effGrid.value, (w, i) => {
              return (openBlock(), createElementBlock("col", {
                key: 'hc' + i,
                style: normalizeStyle({ width: w + 'px' })
              }, null, 4))
            }), 128))
          ]),
          createBaseVNode("tbody", null, [
            (cfg.value.cover)
              ? (openBlock(), createElementBlock("tr", _hoisted_4, [
                  createBaseVNode("td", {
                    colspan: nCols.value,
                    class: "rsp-cover-td"
                  }, [
                    createBaseVNode("div", {
                      class: "rsp-cover-page",
                      style: normalizeStyle({ height: coverPageH.value + 'px', '--cok': coverK.value, '--cvy': coverVy.value })
                    }, [
                      createBaseVNode("div", {
                        class: "rsp-cover-company",
                        style: normalizeStyle({ top: (COVER_COMPANY_TOP * coverVy.value) + 'px', height: (COVER_COMPANY_H * coverVy.value) + 'px' })
                      }, "惠州市银嘉环保科技有限公司", 4),
                      (coverDocNoKey.value)
                        ? (openBlock(), createElementBlock("div", {
                            key: 0,
                            class: "rsp-cover-docno",
                            style: normalizeStyle({ top: (COVER_COMPANY_TOP * coverVy.value) + 'px', height: (COVER_COMPANY_H * coverVy.value) + 'px' })
                          }, [
                            createBaseVNode("span", _hoisted_6, toDisplayString(unref(tt)('编号：')), 1),
                            (__props.editable)
                              ? (openBlock(), createBlock(_component_el_input, {
                                  key: 0,
                                  modelValue: __props.head[coverDocNoKey.value],
                                  "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((__props.head[coverDocNoKey.value]) = $event)),
                                  size: "small",
                                  class: "rsp-cover-docno-in",
                                  maxlength: 60,
                                  onInput: _cache[1] || (_cache[1] = $event => (emit('dirty')))
                                }, null, 8, ["modelValue"]))
                              : (openBlock(), createElementBlock("span", _hoisted_7, toDisplayString(__props.head[coverDocNoKey.value] || ''), 1))
                          ], 4))
                        : createCommentVNode("", true),
                      createBaseVNode("div", {
                        class: "rsp-cover-title",
                        style: normalizeStyle({ top: (COVER_TITLE_TOP * coverVy.value) + 'px', height: (COVER_TITLE_H * coverVy.value) + 'px' })
                      }, toDisplayString(unref(tt)(cfg.value.staticTitle || '产品规格书')), 5),
                      createBaseVNode("div", {
                        class: "rsp-cover-block",
                        style: normalizeStyle({ top: coverLineTop(0) })
                      }, [
                        createBaseVNode("div", _hoisted_8, [
                          createBaseVNode("table", _hoisted_9, [
                            createBaseVNode("tbody", null, [
                              (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.cover.fields, (fd, fi) => {
                                return (openBlock(), createElementBlock("tr", {
                                  key: 'cf' + fi
                                }, [
                                  createBaseVNode("td", _hoisted_10, toDisplayString(unref(tt)(fd.label)), 1),
                                  createBaseVNode("td", _hoisted_11, [
                                    (__props.editable)
                                      ? (openBlock(), createBlock(_component_el_input, {
                                          key: 0,
                                          modelValue: __props.head[fd.key],
                                          "onUpdate:modelValue": $event => ((__props.head[fd.key]) = $event),
                                          size: "small",
                                          class: "rsp-cover-input",
                                          maxlength: fd.max || 200,
                                          onInput: _cache[2] || (_cache[2] = $event => (emit('dirty')))
                                        }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                                      : (openBlock(), createElementBlock("span", _hoisted_12, toDisplayString(__props.head[fd.key] || ''), 1))
                                  ])
                                ]))
                              }), 128))
                            ])
                          ]),
                          createBaseVNode("table", {
                            class: "rsp-sign-t",
                            style: normalizeStyle({ marginTop: ((COVER_SIGN_TOP - COVER_GRID_TOP - COVER_ROWS * COVER_ROW_H) * coverVy.value) + 'px' })
                          }, [
                            createBaseVNode("colgroup", null, [
                              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(coverSignW), (w, i) => {
                                return (openBlock(), createElementBlock("col", {
                                  key: 'cw' + i,
                                  style: normalizeStyle({ width: w })
                                }, null, 4))
                              }), 128))
                            ]),
                            createBaseVNode("tbody", null, [
                              createBaseVNode("tr", null, [
                                (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.cover.sign, (sg, si) => {
                                  return (openBlock(), createElementBlock("th", {
                                    key: 'sh' + si,
                                    class: "rsp-sign-th"
                                  }, toDisplayString(unref(tt)(sg.label)), 1))
                                }), 128))
                              ]),
                              createBaseVNode("tr", null, [
                                (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.cover.sign, (sg, si) => {
                                  return (openBlock(), createElementBlock("td", {
                                    key: 'sd' + si,
                                    class: "rsp-sign-td"
                                  }, [
                                    (__props.editable)
                                      ? (openBlock(), createBlock(_component_el_input, {
                                          key: 0,
                                          modelValue: __props.head[sg.key],
                                          "onUpdate:modelValue": $event => ((__props.head[sg.key]) = $event),
                                          size: "small",
                                          class: "rsp-sign-input",
                                          maxlength: "100",
                                          onInput: _cache[3] || (_cache[3] = $event => (emit('dirty')))
                                        }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                                      : (openBlock(), createElementBlock("span", _hoisted_13, toDisplayString(__props.head[sg.key] || ''), 1))
                                  ]))
                                }), 128))
                              ])
                            ])
                          ], 4)
                        ])
                      ], 4)
                    ], 4)
                  ], 8, _hoisted_5)
                ]))
              : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                  createBaseVNode("tr", null, [
                    (companySpan.value > 0)
                      ? (openBlock(), createElementBlock("td", {
                          key: 0,
                          class: "rs-td rs-company-cell",
                          colspan: companySpan.value
                        }, toDisplayString(COMPANY_NAME), 8, _hoisted_14))
                      : createCommentVNode("", true),
                    (gapLeftSpan.value > 0)
                      ? (openBlock(), createElementBlock("td", {
                          key: 1,
                          class: "rs-td",
                          colspan: gapLeftSpan.value
                        }, null, 8, _hoisted_15))
                      : createCommentVNode("", true),
                    (docnoSpan.value > 0)
                      ? (openBlock(), createElementBlock("td", {
                          key: 2,
                          class: "rs-td rs-docno",
                          colspan: docnoSpan.value
                        }, [
                          createBaseVNode("div", {
                            class: normalizeClass(["rs-docno-in", { 'rs-onecell': sameCellDocno.value }])
                          }, [
                            (sameCellDocno.value)
                              ? (openBlock(), createElementBlock("span", _hoisted_17, toDisplayString(COMPANY_NAME)))
                              : createCommentVNode("", true),
                            (docNoStatic.value)
                              ? (openBlock(), createElementBlock("div", _hoisted_18, [
                                  (docnoPrefix.value)
                                    ? (openBlock(), createElementBlock("span", _hoisted_19, toDisplayString(unref(tt)('编号：')), 1))
                                    : createCommentVNode("", true),
                                  createBaseVNode("span", _hoisted_20, toDisplayString(docNoStatic.value), 1)
                                ]))
                              : (__props.editable && isRefKey('文档编号'))
                                ? (openBlock(), createElementBlock("div", {
                                    key: 2,
                                    class: "rs-ref-ctl",
                                    title: unref(tt)('点击选择'),
                                    onClick: _cache[4] || (_cache[4] = $event => (openProdRef('文档编号')))
                                  }, [
                                    (docnoPrefix.value)
                                      ? (openBlock(), createElementBlock("span", _hoisted_22, toDisplayString(unref(tt)('编号：')), 1))
                                      : createCommentVNode("", true),
                                    createBaseVNode("span", {
                                      class: normalizeClass(["rs-ref-text", { 'rs-docno-empty': !__props.head['文档编号'] }])
                                    }, toDisplayString(__props.head['文档编号'] || unref(tt)('点击选择')), 3),
                                    createVNode(_component_el_icon, { class: "rs-ref-ico" }, {
                                      default: withCtx(() => [
                                        createVNode(unref(search_default))
                                      ]),
                                      _: 1
                                    })
                                  ], 8, _hoisted_21))
                                : (__props.editable && docNoKey.value === '文档编号')
                                  ? (openBlock(), createElementBlock("div", _hoisted_23, [
                                      (docnoPrefix.value)
                                        ? (openBlock(), createElementBlock("span", _hoisted_24, toDisplayString(unref(tt)('编号：')), 1))
                                        : createCommentVNode("", true),
                                      createVNode(_component_el_input, {
                                        modelValue: __props.head[docNoKey.value],
                                        "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((__props.head[docNoKey.value]) = $event)),
                                        size: "small",
                                        maxlength: "30",
                                        class: "rs-docno-input",
                                        placeholder: unref(tt)(docnoPrefix.value ? '编号：' : docNoKey.value),
                                        onInput: _cache[6] || (_cache[6] = $event => (emit('dirty')))
                                      }, null, 8, ["modelValue", "placeholder"])
                                    ]))
                                  : (openBlock(), createElementBlock(Fragment, { key: 4 }, [
                                      (docnoPrefix.value)
                                        ? (openBlock(), createElementBlock("span", _hoisted_25, toDisplayString(unref(tt)('编号：')), 1))
                                        : createCommentVNode("", true),
                                      createTextVNode(toDisplayString(__props.head[docNoKey.value] || cfg.value.docNoDefault || 'YJ-PD-01'), 1)
                                    ], 64))
                          ], 2)
                        ], 8, _hoisted_16))
                      : createCommentVNode("", true),
                    (gapRightSpan.value > 0)
                      ? (openBlock(), createElementBlock("td", {
                          key: 3,
                          class: "rs-td",
                          colspan: gapRightSpan.value
                        }, null, 8, _hoisted_26))
                      : createCommentVNode("", true)
                  ]),
                  createBaseVNode("tr", null, [
                    createBaseVNode("td", {
                      class: "rs-td rs-topic-cell",
                      colspan: infoSpan.value ? effHead.value.title : nCols.value,
                      rowspan: infoSpan.value || 1
                    }, [
                      (__props.editable && !derivedTitle.value)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: __props.head['测试主题'],
                            "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((__props.head['测试主题']) = $event)),
                            size: "small",
                            class: "rs-topic-input",
                            placeholder: unref(tt)(cfg.value.titlePlaceholder),
                            onInput: _cache[8] || (_cache[8] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "placeholder"]))
                        : (openBlock(), createElementBlock("span", _hoisted_28, toDisplayString(effStaticTitle.value ? unref(tt)(effStaticTitle.value) : (derivedTitle.value || __props.head['测试主题'] || unref(tt)(cfg.value.titlePlaceholder))), 1))
                    ], 8, _hoisted_27),
                    (infoSpan.value)
                      ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                          createBaseVNode("td", {
                            class: "rs-td rs-info-label",
                            colspan: effHead.value.infoLabel
                          }, toDisplayString(unref(tt)(effInfo.value[0].label)), 9, _hoisted_29),
                          createBaseVNode("td", {
                            class: "rs-td rs-info-value",
                            colspan: effHead.value.infoValue
                          }, [
                            (__props.editable && effInfo.value[0].type === 'select')
                              ? (openBlock(), createBlock(_component_el_select, {
                                  key: 0,
                                  modelValue: __props.head[effInfo.value[0].key],
                                  "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => ((__props.head[effInfo.value[0].key]) = $event)),
                                  size: "small",
                                  clearable: false,
                                  onChange: _cache[10] || (_cache[10] = $event => (emit('dirty')))
                                }, {
                                  default: withCtx(() => [
                                    (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions(effInfo.value[0].key), (o) => {
                                      return (openBlock(), createBlock(_component_el_option, {
                                        key: o.value,
                                        label: o.label,
                                        value: o.value
                                      }, null, 8, ["label", "value"]))
                                    }), 128))
                                  ]),
                                  _: 1
                                }, 8, ["modelValue"]))
                              : (__props.editable)
                                ? (openBlock(), createBlock(_component_el_input, {
                                    key: 1,
                                    modelValue: __props.head[effInfo.value[0].key],
                                    "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((__props.head[effInfo.value[0].key]) = $event)),
                                    size: "small",
                                    maxlength: "80",
                                    class: "rs-c-in",
                                    onInput: _cache[12] || (_cache[12] = $event => (emit('dirty')))
                                  }, null, 8, ["modelValue"]))
                                : (openBlock(), createElementBlock(Fragment, { key: 2 }, [
                                    createTextVNode(toDisplayString(__props.head[effInfo.value[0].key] || ''), 1)
                                  ], 64))
                          ], 8, _hoisted_30)
                        ], 64))
                      : createCommentVNode("", true)
                  ]),
                  (infoSpan.value > 1)
                    ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(infoSpan.value - 1, (ii) => {
                        return (openBlock(), createElementBlock("tr", {
                          key: 'hi' + ii
                        }, [
                          createBaseVNode("td", {
                            class: "rs-td rs-info-label",
                            colspan: effHead.value.infoLabel
                          }, toDisplayString(unref(tt)(effInfo.value[ii].label)), 9, _hoisted_31),
                          createBaseVNode("td", {
                            class: "rs-td rs-info-value",
                            colspan: effHead.value.infoValue
                          }, [
                            (__props.editable && effInfo.value[ii].type === 'select')
                              ? (openBlock(), createBlock(_component_el_select, {
                                  key: 0,
                                  modelValue: __props.head[effInfo.value[ii].key],
                                  "onUpdate:modelValue": $event => ((__props.head[effInfo.value[ii].key]) = $event),
                                  size: "small",
                                  clearable: false,
                                  onChange: _cache[13] || (_cache[13] = $event => (emit('dirty')))
                                }, {
                                  default: withCtx(() => [
                                    (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions(effInfo.value[ii].key), (o) => {
                                      return (openBlock(), createBlock(_component_el_option, {
                                        key: o.value,
                                        label: o.label,
                                        value: o.value
                                      }, null, 8, ["label", "value"]))
                                    }), 128))
                                  ]),
                                  _: 2
                                }, 1032, ["modelValue", "onUpdate:modelValue"]))
                              : (__props.editable)
                                ? (openBlock(), createBlock(_component_el_input, {
                                    key: 1,
                                    modelValue: __props.head[effInfo.value[ii].key],
                                    "onUpdate:modelValue": $event => ((__props.head[effInfo.value[ii].key]) = $event),
                                    size: "small",
                                    maxlength: "80",
                                    class: "rs-c-in",
                                    onInput: _cache[14] || (_cache[14] = $event => (emit('dirty')))
                                  }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                                : (openBlock(), createElementBlock(Fragment, { key: 2 }, [
                                    createTextVNode(toDisplayString(__props.head[effInfo.value[ii].key] || ''), 1)
                                  ], 64))
                          ], 8, _hoisted_32)
                        ]))
                      }), 128))
                    : createCommentVNode("", true)
                ], 64))
          ])
        ], 4))
      : createCommentVNode("", true),
    (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.sections, (sec, si) => {
      return withDirectives((openBlock(), createElementBlock("table", {
        key: 'sec' + si,
        class: "rs-t",
        style: normalizeStyle({ width: secW(sec) + 'px' })
      }, [
        createBaseVNode("colgroup", null, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(secCols(sec), (w, i) => {
            return (openBlock(), createElementBlock("col", {
              key: 'sc' + i,
              style: normalizeStyle({ width: w + 'px' })
            }, null, 4))
          }), 128))
        ]),
        createBaseVNode("tbody", null, [
          (sec.bar)
            ? (openBlock(), createElementBlock("tr", _hoisted_33, [
                createBaseVNode("td", {
                  colspan: secCols(sec).length,
                  class: "rs-sectionbar"
                }, [
                  createBaseVNode("span", _hoisted_35, [
                    createBaseVNode("span", null, toDisplayString(unref(tt)(sec.bar)), 1),
                    (si === (cfg.value.sections || []).length - 1 && !(cfg.value.dataTables || []).length)
                      ? (openBlock(), createElementBlock("span", {
                          key: 0,
                          class: "rs-field-edit-btn",
                          onClick: withModifiers(openFieldEdit, ["stop"])
                        }, "✎ " + toDisplayString(unref(tt)('字段编辑')), 1))
                      : createCommentVNode("", true)
                  ])
                ], 8, _hoisted_34)
              ]))
            : createCommentVNode("", true),
          (sec.doc)
            ? (openBlock(true), createElementBlock(Fragment, { key: 1 }, renderList(sec.rows, (row, ri) => {
                return (openBlock(), createElementBlock("tr", {
                  key: 'dl' + ri
                }, [
                  createBaseVNode("td", {
                    colspan: secCols(sec).length,
                    class: "rsp-doccell"
                  }, [
                    createBaseVNode("div", _hoisted_37, [
                      createBaseVNode("span", _hoisted_38, toDisplayString(unref(tt)(row.label)) + "：", 1),
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: __props.head[row.key],
                            "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                            type: "textarea",
                            autosize: { minRows: row.area ? 2 : 1, maxRows: 8 },
                            size: "small",
                            class: "rsp-docinput",
                            maxlength: row.max || 2000,
                            onInput: _cache[15] || (_cache[15] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue", "autosize", "maxlength"]))
                        : (openBlock(), createElementBlock("span", _hoisted_39, toDisplayString(__props.head[row.key] || ''), 1)),
                      (__props.editable)
                        ? (openBlock(), createElementBlock("span", {
                            key: 2,
                            class: "rsp-lib-pick",
                            onClick: withModifiers($event => (openSectionLib(row)), ["stop"])
                          }, "⌄ " + toDisplayString(unref(tt)('标准库')), 9, _hoisted_40))
                        : createCommentVNode("", true)
                    ])
                  ], 8, _hoisted_36)
                ]))
              }), 128))
            : createCommentVNode("", true),
          (!sec.doc)
            ? (openBlock(true), createElementBlock(Fragment, { key: 2 }, renderList(sec.rows, (row, ri) => {
                return (openBlock(), createElementBlock(Fragment, {
                  key: 'pr' + ri
                }, [
                  (row.pairs)
                    ? (openBlock(), createElementBlock("tr", _hoisted_41, [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(row.pairs, (pair, pi) => {
                          return (openBlock(), createElementBlock(Fragment, {
                            key: 'p' + pi
                          }, [
                            createBaseVNode("td", {
                              class: "rs-td rs-label",
                              colspan: pair.lspan || 1,
                              rowspan: pair.rowspan || 1
                            }, toDisplayString(unref(tt)(pair.label)), 9, _hoisted_42),
                            (pair.cells)
                              ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(pair.cells, (c, ci) => {
                                  return (openBlock(), createElementBlock("td", {
                                    key: 'pc' + ci,
                                    class: "rs-td",
                                    colspan: ci === pair.cells.length - 1 ? (pair.vspan || 1) : 1,
                                    rowspan: pair.rowspan || 1
                                  }, [
                                    (__props.editable)
                                      ? (openBlock(), createBlock(_component_el_input, {
                                          key: 0,
                                          modelValue: __props.head[c.key],
                                          "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                          size: "small",
                                          maxlength: "120",
                                          class: "rs-t-in",
                                          placeholder: c.ph ? unref(tt)(c.ph) : '',
                                          onInput: _cache[16] || (_cache[16] = $event => (emit('dirty')))
                                        }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]))
                                      : (openBlock(), createElementBlock("span", _hoisted_44, toDisplayString(__props.head[c.key] || ''), 1))
                                  ], 8, _hoisted_43))
                                }), 128))
                              : (openBlock(), createElementBlock("td", {
                                  key: 1,
                                  class: "rs-td",
                                  colspan: pair.vspan || 1,
                                  rowspan: pair.rowspan || 1
                                }, [
                                  (__props.editable && isRefKey(pair.key))
                                    ? (openBlock(), createElementBlock("div", {
                                        key: 0,
                                        class: "rs-ref-ctl",
                                        title: unref(tt)('点击选择'),
                                        onClick: $event => (openProdRef(pair.key))
                                      }, [
                                        createBaseVNode("span", _hoisted_47, toDisplayString(__props.head[pair.key] || unref(tt)('点击选择')), 1),
                                        (devStatus.value && devKey.value === pair.key)
                                          ? (openBlock(), createElementBlock("span", {
                                              key: 0,
                                              class: normalizeClass(["rs-dev-badge", devStatus.value === '已开发' ? 'done' : 'none'])
                                            }, toDisplayString(unref(tt)(devStatus.value)), 3))
                                          : createCommentVNode("", true),
                                        createVNode(_component_el_icon, { class: "rs-ref-ico" }, {
                                          default: withCtx(() => [
                                            createVNode(unref(search_default))
                                          ]),
                                          _: 1
                                        })
                                      ], 8, _hoisted_46))
                                    : (__props.editable && pair.type === 'select')
                                      ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                          createVNode(_component_el_select, {
                                            modelValue: __props.head[pair.key],
                                            "onUpdate:modelValue": $event => ((__props.head[pair.key]) = $event),
                                            size: "small",
                                            clearable: false,
                                            filterable: !!stdLibOf(pair.key),
                                            "allow-create": !!stdLibOf(pair.key),
                                            "default-first-option": "",
                                            onChange: _cache[17] || (_cache[17] = $event => (emit('dirty')))
                                          }, {
                                            default: withCtx(() => [
                                              (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions(pair.key), (o) => {
                                                return (openBlock(), createBlock(_component_el_option, {
                                                  key: o.value,
                                                  label: o.label,
                                                  value: o.value
                                                }, null, 8, ["label", "value"]))
                                              }), 128))
                                            ]),
                                            _: 2
                                          }, 1032, ["modelValue", "onUpdate:modelValue", "filterable", "allow-create"]),
                                          (stdLibOf(pair.key))
                                            ? (openBlock(), createElementBlock("span", {
                                                key: 0,
                                                class: "rs-lib-btn no-print",
                                                onClick: withModifiers($event => (openStdLib(stdLibOf(pair.key))), ["stop"])
                                              }, "⧉ " + toDisplayString(unref(tt)('标准库维护')), 9, _hoisted_48))
                                            : createCommentVNode("", true)
                                        ], 64))
                                      : (__props.editable && pair.type === 'file')
                                        ? (openBlock(), createBlock(FileAttachCell, {
                                            key: 2,
                                            "panel-code": __props.panelCode,
                                            "doc-no": __props.head['单据编号'] || '',
                                            "field-key": pair.key,
                                            "model-value": __props.head[pair.key] || '',
                                            "onUpdate:modelValue": (v) => { __props.head[pair.key] = v; }
                                          }, null, 8, ["panel-code", "doc-no", "field-key", "model-value", "onUpdate:modelValue"]))
                                        : (__props.editable && pair.type === 'text')
                                          ? (openBlock(), createBlock(_component_el_input, {
                                              key: 3,
                                              modelValue: __props.head[pair.key],
                                              "onUpdate:modelValue": $event => ((__props.head[pair.key]) = $event),
                                              size: "small",
                                              maxlength: pair.max || 300,
                                              class: "rs-t-in",
                                              placeholder: pair.ph ? unref(tt)(pair.ph) : '',
                                              onInput: _cache[18] || (_cache[18] = $event => (emit('dirty')))
                                            }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength", "placeholder"]))
                                          : (__props.editable)
                                            ? (openBlock(), createBlock(_component_el_input, {
                                                key: 4,
                                                modelValue: __props.head[pair.key],
                                                "onUpdate:modelValue": $event => ((__props.head[pair.key]) = $event),
                                                type: "textarea",
                                                autosize: { minRows: 1, maxRows: 8 },
                                                size: "small",
                                                maxlength: pair.max || 2000,
                                                class: "rs-t-in",
                                                onInput: _cache[19] || (_cache[19] = $event => (emit('dirty')))
                                              }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                                            : (openBlock(), createElementBlock("span", _hoisted_49, toDisplayString(__props.head[pair.key] || ''), 1))
                                ], 8, _hoisted_45))
                          ], 64))
                        }), 128))
                      ]))
                    : (row.grid)
                      ? (openBlock(), createElementBlock("tr", _hoisted_50, [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(row.grid, (c, ci) => {
                            return (openBlock(), createElementBlock(Fragment, {
                              key: 'g' + ci
                            }, [
                              (c.label)
                                ? (openBlock(), createElementBlock("td", {
                                    key: 0,
                                    class: "rs-td rs-label",
                                    colspan: c.span || 1,
                                    rowspan: c.rowspan || 1,
                                    style: normalizeStyle(c.cap ? 'background:#9c9c9c;color:#fff;font-weight:600;font-size:12.5px' : '')
                                  }, toDisplayString(unref(tt)(effColLabel(c.label, c.label))), 13, _hoisted_51))
                                : (openBlock(), createElementBlock("td", {
                                    key: 1,
                                    class: "rs-td",
                                    colspan: c.span || 1,
                                    rowspan: c.rowspan || 1
                                  }, [
                                    (__props.editable && isRefKey(c.key))
                                      ? (openBlock(), createElementBlock("div", {
                                          key: 0,
                                          class: "rs-ref-ctl",
                                          title: unref(tt)('点击选择'),
                                          onClick: $event => (openProdRef(c.key))
                                        }, [
                                          createBaseVNode("span", _hoisted_54, toDisplayString(__props.head[c.key] || unref(tt)('点击选择')), 1),
                                          (devStatus.value && devKey.value === c.key)
                                            ? (openBlock(), createElementBlock("span", {
                                                key: 0,
                                                class: normalizeClass(["rs-dev-badge", devStatus.value === '已开发' ? 'done' : 'none'])
                                              }, toDisplayString(unref(tt)(devStatus.value)), 3))
                                            : createCommentVNode("", true),
                                          createVNode(_component_el_icon, { class: "rs-ref-ico" }, {
                                            default: withCtx(() => [
                                              createVNode(unref(search_default))
                                            ]),
                                            _: 1
                                          })
                                        ], 8, _hoisted_53))
                                      : (__props.editable && c.type === 'select')
                                        ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                            createVNode(_component_el_select, {
                                              modelValue: __props.head[c.key],
                                              "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                              size: "small",
                                              clearable: false,
                                              placeholder: c.ph ? unref(tt)(c.ph) : '',
                                              filterable: !!stdLibOf(c.key),
                                              "allow-create": !!stdLibOf(c.key),
                                              "default-first-option": "",
                                              onChange: _cache[20] || (_cache[20] = $event => (emit('dirty')))
                                            }, {
                                              default: withCtx(() => [
                                                (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions(c.key), (o) => {
                                                  return (openBlock(), createBlock(_component_el_option, {
                                                    key: o.value,
                                                    label: o.label,
                                                    value: o.value
                                                  }, null, 8, ["label", "value"]))
                                                }), 128))
                                              ]),
                                              _: 2
                                            }, 1032, ["modelValue", "onUpdate:modelValue", "placeholder", "filterable", "allow-create"]),
                                            (stdLibOf(c.key))
                                              ? (openBlock(), createElementBlock("span", {
                                                  key: 0,
                                                  class: "rs-lib-btn no-print",
                                                  onClick: withModifiers($event => (openStdLib(stdLibOf(c.key))), ["stop"])
                                                }, "⧉ " + toDisplayString(unref(tt)('标准库维护')), 9, _hoisted_55))
                                              : createCommentVNode("", true)
                                          ], 64))
                                        : (__props.editable && c.type === 'checks')
                                          ? (openBlock(), createElementBlock("span", _hoisted_56, [
                                              (openBlock(true), createElementBlock(Fragment, null, renderList((c.options || []), (o) => {
                                                return (openBlock(), createBlock(_component_el_checkbox, {
                                                  key: o,
                                                  "model-value": checkList(__props.head[c.key]).includes(o),
                                                  onChange: $event => (toggleCheck(c.key, o, !!c.single))
                                                }, {
                                                  default: withCtx(() => [
                                                    createTextVNode(toDisplayString(unref(tt)(o)), 1)
                                                  ]),
                                                  _: 2
                                                }, 1032, ["model-value", "onChange"]))
                                              }), 128))
                                            ]))
                                          : (__props.editable && c.key)
                                            ? (openBlock(), createElementBlock(Fragment, { key: 3 }, [
                                                (c.area)
                                                  ? (openBlock(), createBlock(_component_el_input, {
                                                      key: 0,
                                                      modelValue: __props.head[c.key],
                                                      "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                                      type: "textarea",
                                                      autosize: { minRows: 1, maxRows: 6 },
                                                      size: "small",
                                                      maxlength: c.max || 2000,
                                                      placeholder: c.ph ? unref(tt)(c.ph) : '',
                                                      class: "rs-t-in",
                                                      onInput: _cache[21] || (_cache[21] = $event => (emit('dirty')))
                                                    }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength", "placeholder"]))
                                                  : (openBlock(), createBlock(_component_el_input, {
                                                      key: 1,
                                                      modelValue: __props.head[c.key],
                                                      "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                                      size: "small",
                                                      maxlength: c.max || 2000,
                                                      placeholder: c.ph ? unref(tt)(c.ph) : '',
                                                      class: "rs-t-in",
                                                      onInput: _cache[22] || (_cache[22] = $event => (emit('dirty')))
                                                    }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength", "placeholder"])),
                                                (stdLibOf(c.key))
                                                  ? (openBlock(), createElementBlock("span", {
                                                      key: 2,
                                                      class: "rsp-lib-pick",
                                                      onClick: withModifiers($event => (openSectionLib(c)), ["stop"])
                                                    }, "⌄ " + toDisplayString(unref(tt)('标准库')), 9, _hoisted_57))
                                                  : createCommentVNode("", true)
                                              ], 64))
                                            : (openBlock(), createElementBlock("span", _hoisted_58, toDisplayString(__props.head[c.key] || c.fixed || ''), 1))
                                  ], 8, _hoisted_52))
                            ], 64))
                          }), 128))
                        ]))
                      : (sec.stage)
                        ? (openBlock(), createElementBlock("tr", _hoisted_59, [
                            (row.stage)
                              ? (openBlock(), createElementBlock("td", {
                                  key: 0,
                                  class: "rs-td rs-label rsp-stage",
                                  rowspan: stageSpan(sec, ri),
                                  colspan: 2
                                }, toDisplayString(unref(tt)(row.stage)), 9, _hoisted_60))
                              : createCommentVNode("", true),
                            createBaseVNode("td", _hoisted_61, toDisplayString(unref(tt)(row.label)), 1),
                            createBaseVNode("td", {
                              class: "rs-td",
                              colspan: row.label2 ? 2 : 5
                            }, [
                              (__props.editable)
                                ? (openBlock(), createBlock(_component_el_input, {
                                    key: 0,
                                    modelValue: __props.head[row.key],
                                    "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                                    size: "small",
                                    maxlength: row.max || 500,
                                    class: "rs-t-in",
                                    onInput: _cache[23] || (_cache[23] = $event => (emit('dirty')))
                                  }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                                : (openBlock(), createElementBlock("span", _hoisted_63, toDisplayString(__props.head[row.key] || ''), 1))
                            ], 8, _hoisted_62),
                            (row.label2)
                              ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                  createBaseVNode("td", _hoisted_64, toDisplayString(unref(tt)(row.label2)), 1),
                                  createBaseVNode("td", _hoisted_65, [
                                    (__props.editable)
                                      ? (openBlock(), createBlock(_component_el_input, {
                                          key: 0,
                                          modelValue: __props.head[row.key2],
                                          "onUpdate:modelValue": $event => ((__props.head[row.key2]) = $event),
                                          size: "small",
                                          maxlength: row.max2 || 500,
                                          class: "rs-t-in",
                                          onInput: _cache[24] || (_cache[24] = $event => (emit('dirty')))
                                        }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                                      : (openBlock(), createElementBlock("span", _hoisted_66, toDisplayString(__props.head[row.key2] || ''), 1))
                                  ])
                                ], 64))
                              : createCommentVNode("", true)
                          ]))
                        : (openBlock(), createElementBlock("tr", _hoisted_67, [
                            createBaseVNode("td", _hoisted_68, toDisplayString(unref(tt)(row.label)), 1),
                            (row.cells)
                              ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(row.cells, (c) => {
                                  return (openBlock(), createElementBlock("td", {
                                    key: c.key,
                                    class: "rs-td",
                                    colspan: c.span || 1
                                  }, [
                                    (__props.editable)
                                      ? (openBlock(), createBlock(_component_el_input, {
                                          key: 0,
                                          modelValue: __props.head[c.key],
                                          "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                          size: "small",
                                          maxlength: "100",
                                          class: "rs-t-in",
                                          placeholder: c.ph || '',
                                          onInput: _cache[25] || (_cache[25] = $event => (emit('dirty')))
                                        }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]))
                                      : (openBlock(), createElementBlock("span", _hoisted_70, toDisplayString(__props.head[c.key] || ''), 1))
                                  ], 8, _hoisted_69))
                                }), 128))
                              : (openBlock(), createElementBlock("td", {
                                  key: 1,
                                  class: "rs-td",
                                  colspan: nCols.value > 1 ? nCols.value - 1 : 1
                                }, [
                                  (__props.editable && isRefKey(row.key))
                                    ? (openBlock(), createElementBlock("div", {
                                        key: 0,
                                        class: "rs-ref-ctl",
                                        title: unref(tt)('点击选择'),
                                        onClick: $event => (openProdRef(row.key))
                                      }, [
                                        createBaseVNode("span", _hoisted_73, toDisplayString(__props.head[row.key] || unref(tt)('点击选择')), 1),
                                        (devStatus.value && devKey.value === row.key)
                                          ? (openBlock(), createElementBlock("span", {
                                              key: 0,
                                              class: normalizeClass(["rs-dev-badge", devStatus.value === '已开发' ? 'done' : 'none'])
                                            }, toDisplayString(unref(tt)(devStatus.value)), 3))
                                          : createCommentVNode("", true),
                                        createVNode(_component_el_icon, { class: "rs-ref-ico" }, {
                                          default: withCtx(() => [
                                            createVNode(unref(search_default))
                                          ]),
                                          _: 1
                                        })
                                      ], 8, _hoisted_72))
                                    : (__props.editable && row.type === 'text')
                                      ? (openBlock(), createBlock(_component_el_input, {
                                          key: 1,
                                          modelValue: __props.head[row.key],
                                          "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                                          size: "small",
                                          maxlength: row.max || 300,
                                          class: "rs-t-in",
                                          onInput: _cache[26] || (_cache[26] = $event => (emit('dirty')))
                                        }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                                      : (__props.editable)
                                        ? (openBlock(), createBlock(_component_el_input, {
                                            key: 2,
                                            modelValue: __props.head[row.key],
                                            "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                                            type: "textarea",
                                            autosize: { minRows: row.tall ? 3 : 1, maxRows: 12 },
                                            size: "small",
                                            maxlength: row.max || 2000,
                                            class: "rs-t-in",
                                            onInput: _cache[27] || (_cache[27] = $event => (emit('dirty')))
                                          }, null, 8, ["modelValue", "onUpdate:modelValue", "autosize", "maxlength"]))
                                        : (openBlock(), createElementBlock("span", {
                                            key: 3,
                                            class: normalizeClass(["rs-txt", { 'rsp-pre': row.tall }])
                                          }, toDisplayString(__props.head[row.key] || ''), 3))
                                ], 8, _hoisted_71))
                          ]))
                ], 64))
              }), 128))
            : createCommentVNode("", true),
          (sec.waterStrip)
            ? (openBlock(), createElementBlock("tr", _hoisted_74, [
                createBaseVNode("td", _hoisted_75, toDisplayString(unref(tt)('原水水质条件')), 1),
                createBaseVNode("td", {
                  class: "rs-td rsp-water-zone",
                  colspan: nCols.value - 1
                }, [
                  createBaseVNode("table", _hoisted_77, [
                    createBaseVNode("colgroup", null, [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.grid.slice(1), (w, i) => {
                        return (openBlock(), createElementBlock("col", {
                          key: 'wc' + i,
                          style: normalizeStyle({ width: w + 'px' })
                        }, null, 4))
                      }), 128))
                    ]),
                    createBaseVNode("tbody", null, [
                      createBaseVNode("tr", null, [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.waterColspans, (cs, i) => {
                          return (openBlock(), createElementBlock("td", {
                            key: 'wn' + i,
                            colspan: cs,
                            class: "rs-ind-name"
                          }, toDisplayString(unref(tt)(waterNames[i])), 9, _hoisted_78))
                        }), 128))
                      ]),
                      createBaseVNode("tr", null, [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.waterColspans, (cs, i) => {
                          return (openBlock(), createElementBlock("td", {
                            key: 'wv' + i,
                            colspan: cs,
                            class: "rs-water-val"
                          }, [
                            (i < 3)
                              ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                  (__props.editable)
                                    ? (openBlock(), createBlock(_component_el_select, {
                                        key: 0,
                                        modelValue: __props.head[waterKeys[i]],
                                        "onUpdate:modelValue": $event => ((__props.head[waterKeys[i]]) = $event),
                                        size: "small",
                                        clearable: false,
                                        onChange: _cache[28] || (_cache[28] = $event => (emit('dirty')))
                                      }, {
                                        default: withCtx(() => [
                                          (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions(waterKeys[i]), (o) => {
                                            return (openBlock(), createBlock(_component_el_option, {
                                              key: o.value,
                                              label: o.label,
                                              value: o.value
                                            }, null, 8, ["label", "value"]))
                                          }), 128))
                                        ]),
                                        _: 2
                                      }, 1032, ["modelValue", "onUpdate:modelValue"]))
                                    : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                        createTextVNode(toDisplayString(__props.head[waterKeys[i]] || ''), 1)
                                      ], 64))
                                ], 64))
                              : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                  (__props.editable)
                                    ? (openBlock(), createBlock(_component_el_input, {
                                        key: 0,
                                        modelValue: __props.head[waterKeys[i]],
                                        "onUpdate:modelValue": $event => ((__props.head[waterKeys[i]]) = $event),
                                        size: "small",
                                        class: "rs-c-in",
                                        onInput: _cache[29] || (_cache[29] = $event => (emit('dirty')))
                                      }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                                    : (openBlock(), createElementBlock("span", _hoisted_80, toDisplayString(__props.head[waterKeys[i]] || ''), 1))
                                ], 64))
                          ], 8, _hoisted_79))
                        }), 128))
                      ])
                    ])
                  ])
                ], 8, _hoisted_76)
              ]))
            : createCommentVNode("", true),
          (sec.soakBlocks)
            ? (openBlock(), createElementBlock(Fragment, { key: 4 }, [
                createBaseVNode("tr", null, [
                  createBaseVNode("td", _hoisted_81, toDisplayString(unref(tt)('浸泡液用量')), 1),
                  createBaseVNode("td", _hoisted_82, toDisplayString(unref(tt)('炭棒尺寸')), 1),
                  (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.soakColspans, (cs, i) => {
                    return (openBlock(), createElementBlock("td", {
                      key: 'sv' + i,
                      class: "rs-td",
                      colspan: cs
                    }, [
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: __props.head[soakSizeKeys[i]],
                            "onUpdate:modelValue": $event => ((__props.head[soakSizeKeys[i]]) = $event),
                            size: "small",
                            maxlength: "60",
                            class: "rs-t-in",
                            onInput: _cache[30] || (_cache[30] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_84, toDisplayString(__props.head[soakSizeKeys[i]] || ''), 1))
                    ], 8, _hoisted_83))
                  }), 128))
                ]),
                createBaseVNode("tr", null, [
                  createBaseVNode("td", _hoisted_85, toDisplayString(unref(tt)('浸泡液用量（ml）')), 1),
                  (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.soakColspans, (cs, i) => {
                    return (openBlock(), createElementBlock("td", {
                      key: 'sv2' + i,
                      class: "rs-td",
                      colspan: cs
                    }, [
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: __props.head[soakVolKeys[i]],
                            "onUpdate:modelValue": $event => ((__props.head[soakVolKeys[i]]) = $event),
                            size: "small",
                            maxlength: "60",
                            class: "rs-t-in",
                            onInput: _cache[31] || (_cache[31] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_87, toDisplayString(__props.head[soakVolKeys[i]] || ''), 1))
                    ], 8, _hoisted_86))
                  }), 128))
                ]),
                createBaseVNode("tr", null, [
                  createBaseVNode("td", _hoisted_88, toDisplayString(unref(tt)('测试用仪器/检出限')), 1),
                  createBaseVNode("td", _hoisted_89, toDisplayString(unref(tt)('测试项目')), 1),
                  createBaseVNode("td", _hoisted_90, toDisplayString(unref(tt)('仪器名称')), 1),
                  createBaseVNode("td", _hoisted_91, toDisplayString(unref(tt)('品牌型号')), 1),
                  createBaseVNode("td", {
                    class: "rs-th",
                    colspan: cfg.value.soakColspans[2]
                  }, toDisplayString(unref(tt)('检出限')), 9, _hoisted_92)
                ]),
                (openBlock(), createElementBlock(Fragment, null, renderList(soakInstrumentRows, (it) => {
                  return createBaseVNode("tr", {
                    key: it.name
                  }, [
                    createBaseVNode("td", _hoisted_93, toDisplayString(unref(tt)(it.name)), 1),
                    createBaseVNode("td", _hoisted_94, [
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: __props.head[it.keys[0]],
                            "onUpdate:modelValue": $event => ((__props.head[it.keys[0]]) = $event),
                            size: "small",
                            maxlength: "120",
                            class: "rs-t-in",
                            onInput: _cache[32] || (_cache[32] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_95, toDisplayString(__props.head[it.keys[0]] || ''), 1))
                    ]),
                    createBaseVNode("td", _hoisted_96, [
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: __props.head[it.keys[1]],
                            "onUpdate:modelValue": $event => ((__props.head[it.keys[1]]) = $event),
                            size: "small",
                            maxlength: "120",
                            class: "rs-t-in",
                            onInput: _cache[33] || (_cache[33] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_97, toDisplayString(__props.head[it.keys[1]] || ''), 1))
                    ]),
                    createBaseVNode("td", {
                      class: "rs-td",
                      colspan: cfg.value.soakColspans[2]
                    }, [
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: __props.head[it.keys[2]],
                            "onUpdate:modelValue": $event => ((__props.head[it.keys[2]]) = $event),
                            size: "small",
                            maxlength: "120",
                            class: "rs-t-in",
                            onInput: _cache[34] || (_cache[34] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_99, toDisplayString(__props.head[it.keys[2]] || ''), 1))
                    ], 8, _hoisted_98)
                  ])
                }), 64))
              ], 64))
            : createCommentVNode("", true)
        ])
      ], 4)), [
        [vShow, isAtOrBeforeTableAnchor(sec) && pageOf(sec) === activePage.value]
      ])
    }), 128)),
    (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.dataTables, (dt, di) => {
      return withDirectives((openBlock(), createElementBlock("div", {
        key: 'dt' + di,
        class: normalizeClass(["rsp-dt-wrap", { 'with-chart': dt.charts }])
      }, [
        createBaseVNode("div", _hoisted_100, [
          createBaseVNode("table", {
            class: normalizeClass(["rs-t rs-dt", { 'rsp-design-t': dt.design }]),
            style: normalizeStyle({ width: (dtOwnsWidth(dt) ? (dt.design ? dtW(dt) * designK(dt) : dtW(dt)) : effPlain.value ? plainW(dt) : gridW.value) + 'px' })
          }, [
            createBaseVNode("colgroup", null, [
              (effPlain.value || dtOwnsWidth(dt))
                ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(visCols(dt), (c, i) => {
                    return (openBlock(), createElementBlock("col", {
                      key: 'dc' + i,
                      style: normalizeStyle({ width: ((c.w || 100) * (dt.design ? designK(dt) : 1)).toFixed(1) + 'px' })
                    }, null, 4))
                  }), 128))
                : (openBlock(true), createElementBlock(Fragment, { key: 1 }, renderList(effGrid.value, (w, i) => {
                    return (openBlock(), createElementBlock("col", {
                      key: 'dc' + i,
                      style: normalizeStyle({ width: w + 'px' })
                    }, null, 4))
                  }), 128)),
              (__props.editable)
                ? (openBlock(), createElementBlock("col", _hoisted_101))
                : createCommentVNode("", true)
            ]),
            createBaseVNode("tbody", null, [
              (effPlain.value)
                ? (openBlock(), createElementBlock("tr", _hoisted_102, [
                    createBaseVNode("td", {
                      colspan: totalSpan(dt),
                      class: "rsp-plain-title"
                    }, toDisplayString(unref(tt)(plainTitleOf.value)), 9, _hoisted_103),
                    (__props.editable)
                      ? (openBlock(), createElementBlock("td", _hoisted_104))
                      : createCommentVNode("", true)
                  ]))
                : createCommentVNode("", true),
              (effPlain.value && cfg.value.subtitle)
                ? (openBlock(), createElementBlock("tr", _hoisted_105, [
                    createBaseVNode("td", {
                      colspan: totalSpan(dt),
                      class: normalizeClass(["rsp-subtitle-row", { right: cfg.value.subtitle.align === 'right' }])
                    }, [
                      createBaseVNode("span", _hoisted_107, toDisplayString(unref(tt)(cfg.value.subtitle.label)), 1),
                      (__props.editable && cfg.value.subtitle.type === 'select')
                        ? (openBlock(), createBlock(_component_el_select, {
                            key: 0,
                            modelValue: __props.head[cfg.value.subtitle.key],
                            "onUpdate:modelValue": _cache[35] || (_cache[35] = $event => ((__props.head[cfg.value.subtitle.key]) = $event)),
                            size: "small",
                            class: "rsp-sub-ctl",
                            clearable: false,
                            filterable: "",
                            "allow-create": "",
                            "default-first-option": "",
                            onChange: _cache[36] || (_cache[36] = $event => (emit('dirty')))
                          }, {
                            default: withCtx(() => [
                              (openBlock(true), createElementBlock(Fragment, null, renderList(subtitleOptions.value, (o) => {
                                return (openBlock(), createBlock(_component_el_option, {
                                  key: o.value,
                                  label: o.label,
                                  value: o.value
                                }, null, 8, ["label", "value"]))
                              }), 128))
                            ]),
                            _: 1
                          }, 8, ["modelValue"]))
                        : createCommentVNode("", true),
                      (__props.editable && cfg.value.subtitle.type === 'select' && stdLibOf(cfg.value.subtitle.key))
                        ? (openBlock(), createElementBlock("span", {
                            key: 1,
                            class: "rs-lib-btn no-print",
                            onClick: _cache[37] || (_cache[37] = withModifiers($event => (openStdLib(stdLibOf(cfg.value.subtitle.key))), ["stop"]))
                          }, "⧉ " + toDisplayString(unref(tt)('标准库维护')), 1))
                        : (__props.editable)
                          ? (openBlock(), createBlock(_component_el_input, {
                              key: 2,
                              modelValue: __props.head[cfg.value.subtitle.key],
                              "onUpdate:modelValue": _cache[38] || (_cache[38] = $event => ((__props.head[cfg.value.subtitle.key]) = $event)),
                              size: "small",
                              maxlength: "100",
                              class: "rsp-sub-ctl",
                              onInput: _cache[39] || (_cache[39] = $event => (emit('dirty')))
                            }, null, 8, ["modelValue"]))
                          : (openBlock(), createElementBlock("span", _hoisted_108, toDisplayString(__props.head[cfg.value.subtitle.key] || ''), 1))
                    ], 10, _hoisted_106),
                    (__props.editable)
                      ? (openBlock(), createElementBlock("td", _hoisted_109))
                      : createCommentVNode("", true)
                  ]))
                : createCommentVNode("", true),
              (!effPlain.value && cfg.value.variantKey && !dt.noVariant)
                ? (openBlock(), createElementBlock("tr", _hoisted_110, [
                    createBaseVNode("td", {
                      colspan: variantSpan(dt),
                      class: "rsp-subtitle-row rsp-left"
                    }, [
                      createBaseVNode("span", _hoisted_112, toDisplayString(unref(tt)(variantLabel.value)), 1),
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_select, {
                            key: 0,
                            modelValue: __props.head[cfg.value.variantKey],
                            "onUpdate:modelValue": _cache[40] || (_cache[40] = $event => ((__props.head[cfg.value.variantKey]) = $event)),
                            size: "small",
                            class: "rsp-sub-ctl",
                            clearable: false,
                            filterable: "",
                            "allow-create": "",
                            "default-first-option": "",
                            onChange: _cache[41] || (_cache[41] = $event => (emit('dirty')))
                          }, {
                            default: withCtx(() => [
                              (openBlock(true), createElementBlock(Fragment, null, renderList(variantOptions.value, (o) => {
                                return (openBlock(), createBlock(_component_el_option, {
                                  key: o.value,
                                  label: o.label,
                                  value: o.value
                                }, null, 8, ["label", "value"]))
                              }), 128))
                            ]),
                            _: 1
                          }, 8, ["modelValue"]))
                        : createCommentVNode("", true),
                      (__props.editable && stdLibOf(cfg.value.variantKey))
                        ? (openBlock(), createElementBlock("span", {
                            key: 1,
                            class: "rs-lib-btn no-print",
                            onClick: _cache[42] || (_cache[42] = withModifiers($event => (openStdLib(stdLibOf(cfg.value.variantKey))), ["stop"]))
                          }, "⧉ " + toDisplayString(unref(tt)('标准库维护')), 1))
                        : (openBlock(), createElementBlock("span", _hoisted_113, toDisplayString(__props.head[cfg.value.variantKey] || ''), 1))
                    ], 8, _hoisted_111),
                    createBaseVNode("td", {
                      colspan: Math.max(1, totalSpan(dt) - variantSpan(dt)),
                      class: "rsp-subtitle-row rsp-quiet"
                    }, null, 8, _hoisted_114),
                    (__props.editable)
                      ? (openBlock(), createElementBlock("td", _hoisted_115))
                      : createCommentVNode("", true)
                  ]))
                : createCommentVNode("", true),
              (dt.pageTitle)
                ? (openBlock(), createElementBlock("tr", {
                    key: 3,
                    class: normalizeClass({ 'rsp-design': dt.design })
                  }, [
                    createBaseVNode("td", {
                      colspan: totalSpan(dt),
                      class: "rsp-page-title",
                      style: normalizeStyle(designTitleStyle(dt))
                    }, toDisplayString(unref(tt)(dt.pageTitle)), 13, _hoisted_116),
                    (__props.editable)
                      ? (openBlock(), createElementBlock("td", _hoisted_117))
                      : createCommentVNode("", true)
                  ], 2))
                : createCommentVNode("", true),
              (dt.bar && !dt.pageTitle)
                ? (openBlock(), createElementBlock("tr", _hoisted_118, [
                    createBaseVNode("td", {
                      colspan: totalSpan(dt),
                      class: "rs-sectionbar"
                    }, [
                      createBaseVNode("span", _hoisted_120, [
                        createBaseVNode("span", null, toDisplayString(unref(tt)(dt.bar)), 1),
                        (dt.lib && __props.editable)
                          ? (openBlock(), createElementBlock("span", {
                              key: 0,
                              class: "rs-lib-btn",
                              onClick: withModifiers($event => (openLib(dt)), ["stop"])
                            }, "⧉ " + toDisplayString(unref(tt)('从标准库勾选')), 9, _hoisted_121))
                          : createCommentVNode("", true),
                        (dt.recipeCalc && __props.editable)
                          ? (openBlock(), createElementBlock("span", {
                              key: 1,
                              class: "rs-lib-btn",
                              style: {"color":"#409eff","border-color":"#a0cfff"},
                              onClick: withModifiers($event => (openRecipeCalc(dt)), ["stop"])
                            }, "🧮 " + toDisplayString(unref(tt)('配方计算')), 9, _hoisted_122))
                          : createCommentVNode("", true),
                        (specDriftState.value && __props.editable && cfg.value.autoFillSpec && autoFillTargetDt(cfg.value.autoFillSpec) === dt)
                          ? (openBlock(), createElementBlock("span", {
                              key: 2,
                              class: "rs-lib-btn rs-drift-btn",
                              title: specDriftText.value,
                              onClick: _cache[43] || (_cache[43] = withModifiers($event => (autoFillFromSpec(props.head[cfg.value.autoFillSpec.fromKey], cfg.value.autoFillSpec)), ["stop"]))
                            }, "⚠ " + toDisplayString(specDriftText.value), 9, _hoisted_123))
                          : createCommentVNode("", true),
                        (di === fieldEditAt.value)
                          ? (openBlock(), createElementBlock("span", {
                              key: 3,
                              class: "rs-field-edit-btn",
                              onClick: withModifiers(openFieldEdit, ["stop"])
                            }, "✎ " + toDisplayString(unref(tt)('字段编辑')), 1))
                          : createCommentVNode("", true)
                      ])
                    ], 8, _hoisted_119),
                    (__props.editable)
                      ? (openBlock(), createElementBlock("td", _hoisted_124))
                      : createCommentVNode("", true)
                  ]))
                : createCommentVNode("", true),
              (dt.subHeads)
                ? (openBlock(), createElementBlock("tr", _hoisted_125, [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(spreadSubHeads(dt), (sh, shi) => {
                      return (openBlock(), createElementBlock("td", {
                        key: 'sh' + shi,
                        colspan: sh.span,
                        class: "rs-subhead"
                      }, toDisplayString(unref(tt)(sh.label)), 9, _hoisted_126))
                    }), 128)),
                    (__props.editable)
                      ? (openBlock(), createElementBlock("td", _hoisted_127))
                      : createCommentVNode("", true)
                  ]))
                : createCommentVNode("", true),
              (dt.design?.groupCol)
                ? (openBlock(), createElementBlock("tr", _hoisted_128, [
                    createBaseVNode("th", {
                      class: "rs-th",
                      style: normalizeStyle(designThStyle(dt))
                    }, toDisplayString(unref(tt)('序号')), 5),
                    createBaseVNode("th", {
                      class: "rs-th",
                      style: normalizeStyle(designThStyle(dt)),
                      colspan: "2"
                    }, toDisplayString(unref(tt)('检验项目')), 5),
                    createBaseVNode("th", {
                      class: "rs-th",
                      style: normalizeStyle(designThStyle(dt))
                    }, toDisplayString(unref(tt)('检验要求')), 5),
                    createBaseVNode("th", {
                      class: "rs-th",
                      style: normalizeStyle(designThStyle(dt))
                    }, toDisplayString(unref(tt)('检验方法')), 5),
                    createBaseVNode("th", {
                      class: "rs-th",
                      style: normalizeStyle(designThStyle(dt))
                    }, toDisplayString(unref(tt)('检验依据')), 5),
                    (__props.editable)
                      ? (openBlock(), createElementBlock("th", _hoisted_129))
                      : createCommentVNode("", true)
                  ]))
                : (openBlock(), createElementBlock(Fragment, { key: 7 }, [
                    createBaseVNode("tr", {
                      class: normalizeClass(["rs-grp", { 'rsp-design': dt.design }])
                    }, [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(headerRow1(dt), (g, gi) => {
                        return (openBlock(), createElementBlock(Fragment, {
                          key: 'h1' + gi
                        }, [
                          (g.kind === 'plain')
                            ? (openBlock(), createElementBlock("th", {
                                key: 0,
                                class: "rs-th",
                                style: normalizeStyle(designThStyle(dt)),
                                rowspan: g.rowspan,
                                colspan: g.span > 1 ? g.span : undefined
                              }, toDisplayString(unref(tt)(effColLabel(g.key || g.label, g.label))), 13, _hoisted_130))
                            : (g.kind === 'group')
                              ? (openBlock(), createElementBlock("th", {
                                  key: 1,
                                  class: "rs-th",
                                  style: normalizeStyle(designThStyle(dt)),
                                  colspan: g.span
                                }, toDisplayString(unref(tt)(g.label)), 13, _hoisted_131))
                              : createCommentVNode("", true)
                        ], 64))
                      }), 128)),
                      (__props.editable)
                        ? (openBlock(), createElementBlock("th", {
                            key: 0,
                            class: "rs-th-op",
                            rowspan: hasGroup(dt) ? 2 : 1
                          }, null, 8, _hoisted_132))
                        : createCommentVNode("", true)
                    ], 2),
                    (hasGroup(dt))
                      ? (openBlock(), createElementBlock("tr", _hoisted_133, [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(groupCols(dt), (c) => {
                            return (openBlock(), createElementBlock("th", {
                              key: 'h2' + c.key,
                              class: "rs-th",
                              colspan: (c.span || 1) > 1 ? c.span : undefined
                            }, toDisplayString(unref(tt)(effColLabel(c.key, c.label))), 9, _hoisted_134))
                          }), 128))
                        ]))
                      : createCommentVNode("", true)
                  ], 64)),
              (dt.design?.groupCol)
                ? (openBlock(true), createElementBlock(Fragment, { key: 8 }, renderList(designGroupRows(dt), (r) => {
                    return (openBlock(), createElementBlock("tr", {
                      key: r.key,
                      class: "rsp-design"
                    }, [
                      createBaseVNode("td", {
                        class: "rs-td",
                        style: normalizeStyle(designTdStyle(dt, 'seq')),
                        rowspan: r.groupFirst ? r.group.count : undefined
                      }, toDisplayString(r.groupFirst ? r.seq : ''), 13, _hoisted_135),
                      createBaseVNode("td", {
                        class: "rs-td",
                        style: normalizeStyle(designTdStyle(dt, 'item')),
                        rowspan: r.groupFirst ? r.group.count : undefined,
                        colspan: r.standalone ? 2 : 1
                      }, toDisplayString(r.groupFirst ? unref(tt)(r.group.label) : ''), 13, _hoisted_136),
                      (!r.standalone)
                        ? (openBlock(), createElementBlock("td", {
                            key: 0,
                            class: "rs-td",
                            style: normalizeStyle(designTdStyle(dt, 'item'))
                          }, toDisplayString(unref(tt)(r.sub || '')), 5))
                        : createCommentVNode("", true),
                      createBaseVNode("td", {
                        class: "rs-td",
                        style: normalizeStyle(designTdStyle(dt, 'req'))
                      }, [
                        (__props.editable)
                          ? (openBlock(), createBlock(_component_el_input, {
                              key: 0,
                              modelValue: r.row['检验要求'],
                              "onUpdate:modelValue": $event => ((r.row['检验要求']) = $event),
                              type: "textarea",
                              autosize: { minRows: 1, maxRows: 12 },
                              size: "small",
                              class: "rs-t-in rsp-area-left",
                              onInput: _cache[44] || (_cache[44] = $event => (emit('dirty')))
                            }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                          : (openBlock(), createElementBlock("span", _hoisted_137, toDisplayString(r.row['检验要求'] || ' / '), 1))
                      ], 4),
                      createBaseVNode("td", {
                        class: "rs-td",
                        style: normalizeStyle(designTdStyle(dt, 'method'))
                      }, [
                        (__props.editable)
                          ? (openBlock(), createBlock(_component_el_input, {
                              key: 0,
                              modelValue: r.row['检验方法'],
                              "onUpdate:modelValue": $event => ((r.row['检验方法']) = $event),
                              type: "textarea",
                              autosize: { minRows: 1, maxRows: 12 },
                              size: "small",
                              class: "rs-t-in rsp-area-left",
                              onInput: _cache[45] || (_cache[45] = $event => (emit('dirty')))
                            }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                          : (openBlock(), createElementBlock("span", _hoisted_138, toDisplayString(r.row['检验方法'] || ' / '), 1))
                      ], 4),
                      createBaseVNode("td", {
                        class: "rs-td",
                        style: normalizeStyle(designTdStyle(dt, 'basis'))
                      }, [
                        (__props.editable)
                          ? (openBlock(), createBlock(_component_el_input, {
                              key: 0,
                              modelValue: r.row['检验依据'],
                              "onUpdate:modelValue": $event => ((r.row['检验依据']) = $event),
                              type: "textarea",
                              autosize: { minRows: 1, maxRows: 12 },
                              size: "small",
                              class: "rs-t-in rsp-area-left",
                              onInput: _cache[46] || (_cache[46] = $event => (emit('dirty')))
                            }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                          : (openBlock(), createElementBlock("span", _hoisted_139, toDisplayString(r.row['检验依据'] || ' / '), 1))
                      ], 4),
                      (__props.editable)
                        ? (openBlock(), createElementBlock("td", _hoisted_140, [
                            createBaseVNode("span", {
                              class: "rs-op-add",
                              onClick: $event => (addRow(dt))
                            }, "＋", 8, _hoisted_141),
                            createBaseVNode("span", {
                              class: "rs-op-del",
                              onClick: $event => (removeRow(r.row))
                            }, "×", 8, _hoisted_142)
                          ]))
                        : createCommentVNode("", true)
                    ]))
                  }), 128))
                : (openBlock(true), createElementBlock(Fragment, { key: 9 }, renderList(rowsOf(dt), (row, i) => {
                    return (openBlock(), createElementBlock("tr", {
                      key: row.id ?? ('new' + di + '-' + i),
                      class: normalizeClass({ 'rsp-design': dt.design })
                    }, [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(visCols(dt), (c) => {
                        return (openBlock(), createElementBlock("td", {
                          key: c.key,
                          class: normalizeClass(["rs-td", { 'rsp-locked': isLockedCell(dt, row, c) }]),
                          style: normalizeStyle(designTdStyle(dt)),
                          colspan: (c.span || 1) > 1 ? c.span : undefined
                        }, [
                          (cellEditable(dt, row, c) && c.area)
                            ? (openBlock(), createBlock(_component_el_input, {
                                key: 0,
                                modelValue: row[c.key],
                                "onUpdate:modelValue": $event => ((row[c.key]) = $event),
                                type: "textarea",
                                autosize: { minRows: 2, maxRows: 10 },
                                size: "small",
                                class: "rs-t-in",
                                style: normalizeStyle(designInputStyle(dt)),
                                onInput: _cache[47] || (_cache[47] = $event => (emit('dirty')))
                              }, null, 8, ["modelValue", "onUpdate:modelValue", "style"]))
                            : (cellEditable(dt, row, c) && c.type === 'select')
                              ? (openBlock(), createBlock(_component_el_select, {
                                  key: 1,
                                  modelValue: row[c.key],
                                  "onUpdate:modelValue": $event => ((row[c.key]) = $event),
                                  size: "small",
                                  filterable: "",
                                  "allow-create": "",
                                  "default-first-option": "",
                                  class: "rs-c-in",
                                  style: normalizeStyle(designInputStyle(dt)),
                                  onChange: _cache[48] || (_cache[48] = $event => (emit('dirty')))
                                }, {
                                  default: withCtx(() => [
                                    (openBlock(true), createElementBlock(Fragment, null, renderList((c.options || []), (o) => {
                                      return (openBlock(), createBlock(_component_el_option, {
                                        key: o,
                                        label: unref(tt)(o),
                                        value: o
                                      }, null, 8, ["label", "value"]))
                                    }), 128))
                                  ]),
                                  _: 2
                                }, 1032, ["modelValue", "onUpdate:modelValue", "style"]))
                              : (cellEditable(dt, row, c) && cellKind(c) === 'date')
                                ? (openBlock(), createBlock(_component_el_date_picker, {
                                    key: 2,
                                    "model-value": unref(controlValue)('date', row[c.key]),
                                    type: "date",
                                    "value-format": "YYYY-MM-DD",
                                    size: "small",
                                    class: "rs-c-in rs-date-in",
                                    style: normalizeStyle(designInputStyle(dt)),
                                    placeholder: unref(tt)('选择日期'),
                                    "onUpdate:modelValue": (v) => setCellValue(row, c, v)
                                  }, null, 8, ["model-value", "style", "placeholder", "onUpdate:modelValue"]))
                                : (cellEditable(dt, row, c) && cellKind(c) === 'datetime')
                                  ? (openBlock(), createBlock(_component_el_date_picker, {
                                      key: 3,
                                      "model-value": unref(controlValue)('datetime', row[c.key]),
                                      type: "datetime",
                                      "value-format": "YYYY-MM-DD HH:mm:ss",
                                      size: "small",
                                      class: "rs-c-in rs-date-in",
                                      style: normalizeStyle(designInputStyle(dt)),
                                      "onUpdate:modelValue": (v) => setCellValue(row, c, v)
                                    }, null, 8, ["model-value", "style", "onUpdate:modelValue"]))
                                  : (cellEditable(dt, row, c) && cellKind(c) === 'time')
                                    ? (openBlock(), createBlock(_component_el_time_picker, {
                                        key: 4,
                                        "model-value": unref(controlValue)('time', row[c.key]),
                                        "value-format": "HH:mm",
                                        format: "HH:mm",
                                        size: "small",
                                        class: "rs-c-in rs-date-in",
                                        style: normalizeStyle(designInputStyle(dt)),
                                        "onUpdate:modelValue": (v) => setCellValue(row, c, v)
                                      }, null, 8, ["model-value", "style", "onUpdate:modelValue"]))
                                    : (cellEditable(dt, row, c) && cellKind(c) === 'time-range')
                                      ? (openBlock(), createBlock(_component_el_time_picker, {
                                          key: 5,
                                          "model-value": unref(controlValue)('time-range', row[c.key]),
                                          "is-range": "",
                                          "range-separator": "-",
                                          "value-format": "HH:mm",
                                          format: "HH:mm",
                                          size: "small",
                                          class: "rs-c-in rs-range-in",
                                          style: normalizeStyle(designInputStyle(dt)),
                                          "onUpdate:modelValue": (v) => setCellValue(row, c, v)
                                        }, null, 8, ["model-value", "style", "onUpdate:modelValue"]))
                                      : (cellEditable(dt, row, c))
                                        ? (openBlock(), createBlock(_component_el_input, {
                                            key: 6,
                                            modelValue: row[c.key],
                                            "onUpdate:modelValue": $event => ((row[c.key]) = $event),
                                            size: "small",
                                            class: "rs-c-in",
                                            style: normalizeStyle(designInputStyle(dt)),
                                            onInput: _cache[49] || (_cache[49] = $event => (emit('dirty')))
                                          }, null, 8, ["modelValue", "onUpdate:modelValue", "style"]))
                                        : (openBlock(), createElementBlock("span", {
                                            key: 7,
                                            class: "rs-txt rsp-cell",
                                            title: isLockedCell(dt, row, c) ? unref(tt)('非本部门栏目（只读）') : ''
                                          }, toDisplayString(unref(cellText)(cellKind(c), row[c.key]) || ' / '), 9, _hoisted_144))
                        ], 14, _hoisted_143))
                      }), 128)),
                      (__props.editable && !dt.fixedRows)
                        ? (openBlock(), createElementBlock("td", _hoisted_145, [
                            createBaseVNode("span", {
                              class: "rs-op-add",
                              onClick: $event => (addRow(dt))
                            }, "＋", 8, _hoisted_146),
                            createBaseVNode("span", {
                              class: "rs-op-del",
                              onClick: $event => (removeRow(row))
                            }, "×", 8, _hoisted_147)
                          ]))
                        : createCommentVNode("", true)
                    ], 2))
                  }), 128)),
              (!rowsOf(dt).length)
                ? (openBlock(), createElementBlock("tr", _hoisted_148, [
                    createBaseVNode("td", {
                      colspan: totalSpan(dt),
                      class: "rs-empty"
                    }, "—", 8, _hoisted_149),
                    (__props.editable && !dt.fixedRows)
                      ? (openBlock(), createElementBlock("td", _hoisted_150))
                      : createCommentVNode("", true)
                  ]))
                : createCommentVNode("", true),
              (dt.totalCols && rowsOf(dt).length)
                ? (openBlock(), createElementBlock("tr", _hoisted_151, [
                    createBaseVNode("td", {
                      class: "rs-td rsp-total",
                      colspan: visCols(dt)[0]?.span || 1
                    }, toDisplayString(unref(tt)('合计')), 9, _hoisted_152),
                    (openBlock(true), createElementBlock(Fragment, null, renderList(visCols(dt).slice(1), (c, ci) => {
                      return (openBlock(), createElementBlock("td", {
                        key: 'tt' + ci,
                        class: "rs-td rsp-total",
                        colspan: (c.span || 1) > 1 ? c.span : undefined
                      }, toDisplayString(totalOf(dt, c.key) || ''), 9, _hoisted_153))
                    }), 128)),
                    (__props.editable)
                      ? (openBlock(), createElementBlock("td", _hoisted_154))
                      : createCommentVNode("", true)
                  ]))
                : createCommentVNode("", true),
              (dt.footerNote)
                ? (openBlock(), createElementBlock("tr", _hoisted_155, [
                    createBaseVNode("td", {
                      colspan: totalSpan(dt),
                      class: "rsp-footnote"
                    }, toDisplayString(unref(tt)(dt.footerNote)), 9, _hoisted_156),
                    (__props.editable)
                      ? (openBlock(), createElementBlock("td", _hoisted_157))
                      : createCommentVNode("", true)
                  ]))
                : createCommentVNode("", true)
            ])
          ], 6),
          (__props.editable && !dt.fixedRows)
            ? (openBlock(), createElementBlock("div", {
                key: 0,
                class: "rs-add",
                style: normalizeStyle({ width: (effPlain.value ? plainW(dt) : (dtOwnsWidth(dt) ? (dt.design ? dtW(dt) * designK(dt) : dtW(dt)) : gridW.value)) + 'px' }),
                onClick: $event => (addRow(dt))
              }, "＋ " + toDisplayString(unref(tt)('新增数据记录行')), 13, _hoisted_158))
            : createCommentVNode("", true)
        ]),
        (dt.charts)
          ? (openBlock(), createElementBlock("div", _hoisted_159, [
              (openBlock(), createElementBlock("svg", {
                viewBox: `0 0 ${CW} ${CH}`,
                class: "rsp-chart-svg",
                preserveAspectRatio: "xMidYMid meet"
              }, [
                createBaseVNode("text", {
                  x: CW / 2,
                  y: "16",
                  "text-anchor": "middle",
                  class: "rsp-chart-title"
                }, toDisplayString(unref(tt)(dt.metric)) + "-" + toDisplayString(unref(tt)('累计流量曲线')), 9, _hoisted_161),
                (openBlock(true), createElementBlock(Fragment, null, renderList(chartOf(dt).gridH, (gl, gi) => {
                  return (openBlock(), createElementBlock("g", {
                    key: 'gh' + gi
                  }, [
                    createBaseVNode("line", {
                      x1: chartOf(dt).ml,
                      y1: gl.y,
                      x2: CW - chartOf(dt).mr,
                      y2: gl.y,
                      class: "rsp-gridline"
                    }, null, 8, _hoisted_162),
                    createBaseVNode("text", {
                      x: chartOf(dt).ml - 6,
                      y: gl.y + 4,
                      "text-anchor": "end",
                      class: "rsp-tick"
                    }, toDisplayString(gl.label), 9, _hoisted_163)
                  ]))
                }), 128)),
                (openBlock(true), createElementBlock(Fragment, null, renderList(chartOf(dt).gridV, (gv, gi) => {
                  return (openBlock(), createElementBlock("g", {
                    key: 'gv' + gi
                  }, [
                    createBaseVNode("line", {
                      x1: gv.x,
                      y1: chartOf(dt).mt,
                      x2: gv.x,
                      y2: CH - chartOf(dt).mb,
                      class: "rsp-gridline"
                    }, null, 8, _hoisted_164),
                    createBaseVNode("text", {
                      x: gv.x,
                      y: CH - chartOf(dt).mb + 16,
                      "text-anchor": "middle",
                      class: "rsp-tick"
                    }, toDisplayString(gv.label), 9, _hoisted_165)
                  ]))
                }), 128)),
                (openBlock(true), createElementBlock(Fragment, null, renderList(chartOf(dt).series, (s, si) => {
                  return (openBlock(), createElementBlock("polyline", {
                    key: 's' + si,
                    points: s.pts.map((p) => p.join(',')).join(' '),
                    fill: "none",
                    stroke: s.color,
                    "stroke-width": "1.6"
                  }, null, 8, _hoisted_166))
                }), 128)),
                (openBlock(true), createElementBlock(Fragment, null, renderList(chartOf(dt).series, (s, si) => {
                  return (openBlock(), createElementBlock("g", {
                    key: 'm' + si
                  }, [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(s.pts, (p, pi) => {
                      return (openBlock(), createElementBlock("circle", {
                        key: pi,
                        cx: p[0],
                        cy: p[1],
                        r: "2.6",
                        fill: s.color
                      }, null, 8, _hoisted_167))
                    }), 128))
                  ]))
                }), 128)),
                createBaseVNode("g", {
                  transform: `translate(${chartOf(dt).ml}, ${CH - 12})`
                }, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(chartOf(dt).series, (s, si) => {
                    return (openBlock(), createElementBlock("g", {
                      key: 'lg' + si,
                      transform: `translate(${si * 118}, 0)`
                    }, [
                      createBaseVNode("rect", {
                        width: "14",
                        height: "3",
                        y: "-4",
                        fill: s.color
                      }, null, 8, _hoisted_170),
                      createBaseVNode("text", _hoisted_171, toDisplayString(unref(tt)(s.name)), 1)
                    ], 8, _hoisted_169))
                  }), 128))
                ], 8, _hoisted_168),
                (!chartOf(dt).hasData)
                  ? (openBlock(), createElementBlock("text", {
                      key: 0,
                      x: CW / 2,
                      y: CH / 2,
                      "text-anchor": "middle",
                      class: "rsp-nodata"
                    }, toDisplayString(unref(tt)('暂无数据')), 9, _hoisted_172))
                  : createCommentVNode("", true)
              ], 8, _hoisted_160))
            ]))
          : createCommentVNode("", true)
      ], 2)), [
        [vShow, pageOf(dt) === activePage.value]
      ])
    }), 128)),
    (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.sections, (sec, si) => {
      return withDirectives((openBlock(), createElementBlock("table", {
        key: 'secB' + si,
        class: "rs-t",
        style: normalizeStyle({ width: secW(sec) + 'px' })
      }, [
        createBaseVNode("colgroup", null, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(secCols(sec), (w, i) => {
            return (openBlock(), createElementBlock("col", {
              key: 'sc' + i,
              style: normalizeStyle({ width: w + 'px' })
            }, null, 4))
          }), 128))
        ]),
        createBaseVNode("tbody", null, [
          (sec.bar)
            ? (openBlock(), createElementBlock("tr", _hoisted_173, [
                createBaseVNode("td", {
                  colspan: secCols(sec).length,
                  class: "rs-sectionbar"
                }, [
                  createBaseVNode("span", _hoisted_175, [
                    createBaseVNode("span", null, toDisplayString(unref(tt)(sec.bar)), 1),
                    (si === (cfg.value.sections || []).length - 1 && !(cfg.value.dataTables || []).length)
                      ? (openBlock(), createElementBlock("span", {
                          key: 0,
                          class: "rs-field-edit-btn",
                          onClick: withModifiers(openFieldEdit, ["stop"])
                        }, "✎ " + toDisplayString(unref(tt)('字段编辑')), 1))
                      : createCommentVNode("", true)
                  ])
                ], 8, _hoisted_174)
              ]))
            : createCommentVNode("", true),
          (sec.doc)
            ? (openBlock(true), createElementBlock(Fragment, { key: 1 }, renderList(sec.rows, (row, ri) => {
                return (openBlock(), createElementBlock("tr", {
                  key: 'dl' + ri
                }, [
                  createBaseVNode("td", {
                    colspan: secCols(sec).length,
                    class: "rsp-doccell"
                  }, [
                    createBaseVNode("div", _hoisted_177, [
                      createBaseVNode("span", _hoisted_178, toDisplayString(unref(tt)(row.label)) + "：", 1),
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: __props.head[row.key],
                            "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                            type: "textarea",
                            autosize: { minRows: row.area ? 2 : 1, maxRows: 8 },
                            size: "small",
                            class: "rsp-docinput",
                            maxlength: row.max || 2000,
                            onInput: _cache[50] || (_cache[50] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue", "autosize", "maxlength"]))
                        : (openBlock(), createElementBlock("span", _hoisted_179, toDisplayString(__props.head[row.key] || ''), 1)),
                      (__props.editable)
                        ? (openBlock(), createElementBlock("span", {
                            key: 2,
                            class: "rsp-lib-pick",
                            onClick: withModifiers($event => (openSectionLib(row)), ["stop"])
                          }, "⌄ " + toDisplayString(unref(tt)('标准库')), 9, _hoisted_180))
                        : createCommentVNode("", true)
                    ])
                  ], 8, _hoisted_176)
                ]))
              }), 128))
            : createCommentVNode("", true),
          (!sec.doc)
            ? (openBlock(true), createElementBlock(Fragment, { key: 2 }, renderList(sec.rows, (row, ri) => {
                return (openBlock(), createElementBlock(Fragment, {
                  key: 'pr' + ri
                }, [
                  (row.pairs)
                    ? (openBlock(), createElementBlock("tr", _hoisted_181, [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(row.pairs, (pair, pi) => {
                          return (openBlock(), createElementBlock(Fragment, {
                            key: 'p' + pi
                          }, [
                            createBaseVNode("td", {
                              class: "rs-td rs-label",
                              colspan: pair.lspan || 1,
                              rowspan: pair.rowspan || 1
                            }, toDisplayString(unref(tt)(pair.label)), 9, _hoisted_182),
                            (pair.cells)
                              ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(pair.cells, (c, ci) => {
                                  return (openBlock(), createElementBlock("td", {
                                    key: 'pc' + ci,
                                    class: "rs-td",
                                    colspan: ci === pair.cells.length - 1 ? (pair.vspan || 1) : 1,
                                    rowspan: pair.rowspan || 1
                                  }, [
                                    (__props.editable)
                                      ? (openBlock(), createBlock(_component_el_input, {
                                          key: 0,
                                          modelValue: __props.head[c.key],
                                          "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                          size: "small",
                                          maxlength: "120",
                                          class: "rs-t-in",
                                          placeholder: c.ph ? unref(tt)(c.ph) : '',
                                          onInput: _cache[51] || (_cache[51] = $event => (emit('dirty')))
                                        }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]))
                                      : (openBlock(), createElementBlock("span", _hoisted_184, toDisplayString(__props.head[c.key] || ''), 1))
                                  ], 8, _hoisted_183))
                                }), 128))
                              : (openBlock(), createElementBlock("td", {
                                  key: 1,
                                  class: "rs-td",
                                  colspan: pair.vspan || 1,
                                  rowspan: pair.rowspan || 1
                                }, [
                                  (__props.editable && isRefKey(pair.key))
                                    ? (openBlock(), createElementBlock("div", {
                                        key: 0,
                                        class: "rs-ref-ctl",
                                        title: unref(tt)('点击选择'),
                                        onClick: $event => (openProdRef(pair.key))
                                      }, [
                                        createBaseVNode("span", _hoisted_187, toDisplayString(__props.head[pair.key] || unref(tt)('点击选择')), 1),
                                        (devStatus.value && devKey.value === pair.key)
                                          ? (openBlock(), createElementBlock("span", {
                                              key: 0,
                                              class: normalizeClass(["rs-dev-badge", devStatus.value === '已开发' ? 'done' : 'none'])
                                            }, toDisplayString(unref(tt)(devStatus.value)), 3))
                                          : createCommentVNode("", true),
                                        createVNode(_component_el_icon, { class: "rs-ref-ico" }, {
                                          default: withCtx(() => [
                                            createVNode(unref(search_default))
                                          ]),
                                          _: 1
                                        })
                                      ], 8, _hoisted_186))
                                    : (__props.editable && pair.type === 'select')
                                      ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                          createVNode(_component_el_select, {
                                            modelValue: __props.head[pair.key],
                                            "onUpdate:modelValue": $event => ((__props.head[pair.key]) = $event),
                                            size: "small",
                                            clearable: false,
                                            filterable: !!stdLibOf(pair.key),
                                            "allow-create": !!stdLibOf(pair.key),
                                            "default-first-option": "",
                                            onChange: _cache[52] || (_cache[52] = $event => (emit('dirty')))
                                          }, {
                                            default: withCtx(() => [
                                              (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions(pair.key), (o) => {
                                                return (openBlock(), createBlock(_component_el_option, {
                                                  key: o.value,
                                                  label: o.label,
                                                  value: o.value
                                                }, null, 8, ["label", "value"]))
                                              }), 128))
                                            ]),
                                            _: 2
                                          }, 1032, ["modelValue", "onUpdate:modelValue", "filterable", "allow-create"]),
                                          (stdLibOf(pair.key))
                                            ? (openBlock(), createElementBlock("span", {
                                                key: 0,
                                                class: "rs-lib-btn no-print",
                                                onClick: withModifiers($event => (openStdLib(stdLibOf(pair.key))), ["stop"])
                                              }, "⧉ " + toDisplayString(unref(tt)('标准库维护')), 9, _hoisted_188))
                                            : createCommentVNode("", true)
                                        ], 64))
                                      : (__props.editable && pair.type === 'file')
                                        ? (openBlock(), createBlock(FileAttachCell, {
                                            key: 2,
                                            "panel-code": __props.panelCode,
                                            "doc-no": __props.head['单据编号'] || '',
                                            "field-key": pair.key,
                                            "model-value": __props.head[pair.key] || '',
                                            "onUpdate:modelValue": (v) => { __props.head[pair.key] = v; }
                                          }, null, 8, ["panel-code", "doc-no", "field-key", "model-value", "onUpdate:modelValue"]))
                                        : (__props.editable && pair.type === 'text')
                                          ? (openBlock(), createBlock(_component_el_input, {
                                              key: 3,
                                              modelValue: __props.head[pair.key],
                                              "onUpdate:modelValue": $event => ((__props.head[pair.key]) = $event),
                                              size: "small",
                                              maxlength: pair.max || 300,
                                              class: "rs-t-in",
                                              placeholder: pair.ph ? unref(tt)(pair.ph) : '',
                                              onInput: _cache[53] || (_cache[53] = $event => (emit('dirty')))
                                            }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength", "placeholder"]))
                                          : (__props.editable)
                                            ? (openBlock(), createBlock(_component_el_input, {
                                                key: 4,
                                                modelValue: __props.head[pair.key],
                                                "onUpdate:modelValue": $event => ((__props.head[pair.key]) = $event),
                                                type: "textarea",
                                                autosize: { minRows: 1, maxRows: 8 },
                                                size: "small",
                                                maxlength: pair.max || 2000,
                                                class: "rs-t-in",
                                                onInput: _cache[54] || (_cache[54] = $event => (emit('dirty')))
                                              }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                                            : (openBlock(), createElementBlock("span", _hoisted_189, toDisplayString(__props.head[pair.key] || ''), 1))
                                ], 8, _hoisted_185))
                          ], 64))
                        }), 128))
                      ]))
                    : (row.grid)
                      ? (openBlock(), createElementBlock("tr", _hoisted_190, [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(row.grid, (c, ci) => {
                            return (openBlock(), createElementBlock(Fragment, {
                              key: 'g' + ci
                            }, [
                              (c.label)
                                ? (openBlock(), createElementBlock("td", {
                                    key: 0,
                                    class: "rs-td rs-label",
                                    colspan: c.span || 1,
                                    rowspan: c.rowspan || 1,
                                    style: normalizeStyle(c.cap ? 'background:#9c9c9c;color:#fff;font-weight:600;font-size:12.5px' : '')
                                  }, toDisplayString(unref(tt)(effColLabel(c.label, c.label))), 13, _hoisted_191))
                                : (openBlock(), createElementBlock("td", {
                                    key: 1,
                                    class: "rs-td",
                                    colspan: c.span || 1,
                                    rowspan: c.rowspan || 1
                                  }, [
                                    (__props.editable && isRefKey(c.key))
                                      ? (openBlock(), createElementBlock("div", {
                                          key: 0,
                                          class: "rs-ref-ctl",
                                          title: unref(tt)('点击选择'),
                                          onClick: $event => (openProdRef(c.key))
                                        }, [
                                          createBaseVNode("span", _hoisted_194, toDisplayString(__props.head[c.key] || unref(tt)('点击选择')), 1),
                                          (devStatus.value && devKey.value === c.key)
                                            ? (openBlock(), createElementBlock("span", {
                                                key: 0,
                                                class: normalizeClass(["rs-dev-badge", devStatus.value === '已开发' ? 'done' : 'none'])
                                              }, toDisplayString(unref(tt)(devStatus.value)), 3))
                                            : createCommentVNode("", true),
                                          createVNode(_component_el_icon, { class: "rs-ref-ico" }, {
                                            default: withCtx(() => [
                                              createVNode(unref(search_default))
                                            ]),
                                            _: 1
                                          })
                                        ], 8, _hoisted_193))
                                      : (__props.editable && c.type === 'select')
                                        ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                            createVNode(_component_el_select, {
                                              modelValue: __props.head[c.key],
                                              "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                              size: "small",
                                              clearable: false,
                                              placeholder: c.ph ? unref(tt)(c.ph) : '',
                                              filterable: !!stdLibOf(c.key),
                                              "allow-create": !!stdLibOf(c.key),
                                              "default-first-option": "",
                                              onChange: _cache[55] || (_cache[55] = $event => (emit('dirty')))
                                            }, {
                                              default: withCtx(() => [
                                                (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions(c.key), (o) => {
                                                  return (openBlock(), createBlock(_component_el_option, {
                                                    key: o.value,
                                                    label: o.label,
                                                    value: o.value
                                                  }, null, 8, ["label", "value"]))
                                                }), 128))
                                              ]),
                                              _: 2
                                            }, 1032, ["modelValue", "onUpdate:modelValue", "placeholder", "filterable", "allow-create"]),
                                            (stdLibOf(c.key))
                                              ? (openBlock(), createElementBlock("span", {
                                                  key: 0,
                                                  class: "rs-lib-btn no-print",
                                                  onClick: withModifiers($event => (openStdLib(stdLibOf(c.key))), ["stop"])
                                                }, "⧉ " + toDisplayString(unref(tt)('标准库维护')), 9, _hoisted_195))
                                              : createCommentVNode("", true)
                                          ], 64))
                                        : (__props.editable && c.type === 'checks')
                                          ? (openBlock(), createElementBlock("span", _hoisted_196, [
                                              (openBlock(true), createElementBlock(Fragment, null, renderList((c.options || []), (o) => {
                                                return (openBlock(), createBlock(_component_el_checkbox, {
                                                  key: o,
                                                  "model-value": checkList(__props.head[c.key]).includes(o),
                                                  onChange: $event => (toggleCheck(c.key, o, !!c.single))
                                                }, {
                                                  default: withCtx(() => [
                                                    createTextVNode(toDisplayString(unref(tt)(o)), 1)
                                                  ]),
                                                  _: 2
                                                }, 1032, ["model-value", "onChange"]))
                                              }), 128))
                                            ]))
                                          : (__props.editable && c.key)
                                            ? (openBlock(), createElementBlock(Fragment, { key: 3 }, [
                                                (c.area)
                                                  ? (openBlock(), createBlock(_component_el_input, {
                                                      key: 0,
                                                      modelValue: __props.head[c.key],
                                                      "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                                      type: "textarea",
                                                      autosize: { minRows: 1, maxRows: 6 },
                                                      size: "small",
                                                      maxlength: c.max || 2000,
                                                      placeholder: c.ph ? unref(tt)(c.ph) : '',
                                                      class: "rs-t-in",
                                                      onInput: _cache[56] || (_cache[56] = $event => (emit('dirty')))
                                                    }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength", "placeholder"]))
                                                  : (openBlock(), createBlock(_component_el_input, {
                                                      key: 1,
                                                      modelValue: __props.head[c.key],
                                                      "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                                      size: "small",
                                                      maxlength: c.max || 2000,
                                                      placeholder: c.ph ? unref(tt)(c.ph) : '',
                                                      class: "rs-t-in",
                                                      onInput: _cache[57] || (_cache[57] = $event => (emit('dirty')))
                                                    }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength", "placeholder"])),
                                                (stdLibOf(c.key))
                                                  ? (openBlock(), createElementBlock("span", {
                                                      key: 2,
                                                      class: "rsp-lib-pick",
                                                      onClick: withModifiers($event => (openSectionLib(c)), ["stop"])
                                                    }, "⌄ " + toDisplayString(unref(tt)('标准库')), 9, _hoisted_197))
                                                  : createCommentVNode("", true)
                                              ], 64))
                                            : (openBlock(), createElementBlock("span", _hoisted_198, toDisplayString(__props.head[c.key] || c.fixed || ''), 1))
                                  ], 8, _hoisted_192))
                            ], 64))
                          }), 128))
                        ]))
                      : (sec.stage)
                        ? (openBlock(), createElementBlock("tr", _hoisted_199, [
                            (row.stage)
                              ? (openBlock(), createElementBlock("td", {
                                  key: 0,
                                  class: "rs-td rs-label rsp-stage",
                                  rowspan: stageSpan(sec, ri),
                                  colspan: 2
                                }, toDisplayString(unref(tt)(row.stage)), 9, _hoisted_200))
                              : createCommentVNode("", true),
                            createBaseVNode("td", _hoisted_201, toDisplayString(unref(tt)(row.label)), 1),
                            createBaseVNode("td", {
                              class: "rs-td",
                              colspan: row.label2 ? 2 : 5
                            }, [
                              (__props.editable)
                                ? (openBlock(), createBlock(_component_el_input, {
                                    key: 0,
                                    modelValue: __props.head[row.key],
                                    "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                                    size: "small",
                                    maxlength: row.max || 500,
                                    class: "rs-t-in",
                                    onInput: _cache[58] || (_cache[58] = $event => (emit('dirty')))
                                  }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                                : (openBlock(), createElementBlock("span", _hoisted_203, toDisplayString(__props.head[row.key] || ''), 1))
                            ], 8, _hoisted_202),
                            (row.label2)
                              ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                  createBaseVNode("td", _hoisted_204, toDisplayString(unref(tt)(row.label2)), 1),
                                  createBaseVNode("td", _hoisted_205, [
                                    (__props.editable)
                                      ? (openBlock(), createBlock(_component_el_input, {
                                          key: 0,
                                          modelValue: __props.head[row.key2],
                                          "onUpdate:modelValue": $event => ((__props.head[row.key2]) = $event),
                                          size: "small",
                                          maxlength: row.max2 || 500,
                                          class: "rs-t-in",
                                          onInput: _cache[59] || (_cache[59] = $event => (emit('dirty')))
                                        }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                                      : (openBlock(), createElementBlock("span", _hoisted_206, toDisplayString(__props.head[row.key2] || ''), 1))
                                  ])
                                ], 64))
                              : createCommentVNode("", true)
                          ]))
                        : (openBlock(), createElementBlock("tr", _hoisted_207, [
                            createBaseVNode("td", _hoisted_208, toDisplayString(unref(tt)(row.label)), 1),
                            (row.cells)
                              ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(row.cells, (c) => {
                                  return (openBlock(), createElementBlock("td", {
                                    key: c.key,
                                    class: "rs-td",
                                    colspan: c.span || 1
                                  }, [
                                    (__props.editable)
                                      ? (openBlock(), createBlock(_component_el_input, {
                                          key: 0,
                                          modelValue: __props.head[c.key],
                                          "onUpdate:modelValue": $event => ((__props.head[c.key]) = $event),
                                          size: "small",
                                          maxlength: "100",
                                          class: "rs-t-in",
                                          placeholder: c.ph || '',
                                          onInput: _cache[60] || (_cache[60] = $event => (emit('dirty')))
                                        }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"]))
                                      : (openBlock(), createElementBlock("span", _hoisted_210, toDisplayString(__props.head[c.key] || ''), 1))
                                  ], 8, _hoisted_209))
                                }), 128))
                              : (openBlock(), createElementBlock("td", {
                                  key: 1,
                                  class: "rs-td",
                                  colspan: nCols.value > 1 ? nCols.value - 1 : 1
                                }, [
                                  (__props.editable && isRefKey(row.key))
                                    ? (openBlock(), createElementBlock("div", {
                                        key: 0,
                                        class: "rs-ref-ctl",
                                        title: unref(tt)('点击选择'),
                                        onClick: $event => (openProdRef(row.key))
                                      }, [
                                        createBaseVNode("span", _hoisted_213, toDisplayString(__props.head[row.key] || unref(tt)('点击选择')), 1),
                                        (devStatus.value && devKey.value === row.key)
                                          ? (openBlock(), createElementBlock("span", {
                                              key: 0,
                                              class: normalizeClass(["rs-dev-badge", devStatus.value === '已开发' ? 'done' : 'none'])
                                            }, toDisplayString(unref(tt)(devStatus.value)), 3))
                                          : createCommentVNode("", true),
                                        createVNode(_component_el_icon, { class: "rs-ref-ico" }, {
                                          default: withCtx(() => [
                                            createVNode(unref(search_default))
                                          ]),
                                          _: 1
                                        })
                                      ], 8, _hoisted_212))
                                    : (__props.editable && row.type === 'text')
                                      ? (openBlock(), createBlock(_component_el_input, {
                                          key: 1,
                                          modelValue: __props.head[row.key],
                                          "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                                          size: "small",
                                          maxlength: row.max || 300,
                                          class: "rs-t-in",
                                          onInput: _cache[61] || (_cache[61] = $event => (emit('dirty')))
                                        }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                                      : (__props.editable)
                                        ? (openBlock(), createBlock(_component_el_input, {
                                            key: 2,
                                            modelValue: __props.head[row.key],
                                            "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                                            type: "textarea",
                                            autosize: { minRows: row.tall ? 3 : 1, maxRows: 12 },
                                            size: "small",
                                            maxlength: row.max || 2000,
                                            class: "rs-t-in",
                                            onInput: _cache[62] || (_cache[62] = $event => (emit('dirty')))
                                          }, null, 8, ["modelValue", "onUpdate:modelValue", "autosize", "maxlength"]))
                                        : (openBlock(), createElementBlock("span", {
                                            key: 3,
                                            class: normalizeClass(["rs-txt", { 'rsp-pre': row.tall }])
                                          }, toDisplayString(__props.head[row.key] || ''), 3))
                                ], 8, _hoisted_211))
                          ]))
                ], 64))
              }), 128))
            : createCommentVNode("", true),
          (sec.waterStrip)
            ? (openBlock(), createElementBlock("tr", _hoisted_214, [
                createBaseVNode("td", _hoisted_215, toDisplayString(unref(tt)('原水水质条件')), 1),
                createBaseVNode("td", {
                  class: "rs-td rsp-water-zone",
                  colspan: nCols.value - 1
                }, [
                  createBaseVNode("table", _hoisted_217, [
                    createBaseVNode("colgroup", null, [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.grid.slice(1), (w, i) => {
                        return (openBlock(), createElementBlock("col", {
                          key: 'wc' + i,
                          style: normalizeStyle({ width: w + 'px' })
                        }, null, 4))
                      }), 128))
                    ]),
                    createBaseVNode("tbody", null, [
                      createBaseVNode("tr", null, [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.waterColspans, (cs, i) => {
                          return (openBlock(), createElementBlock("td", {
                            key: 'wn' + i,
                            colspan: cs,
                            class: "rs-ind-name"
                          }, toDisplayString(unref(tt)(waterNames[i])), 9, _hoisted_218))
                        }), 128))
                      ]),
                      createBaseVNode("tr", null, [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.waterColspans, (cs, i) => {
                          return (openBlock(), createElementBlock("td", {
                            key: 'wv' + i,
                            colspan: cs,
                            class: "rs-water-val"
                          }, [
                            (i < 3)
                              ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                                  (__props.editable)
                                    ? (openBlock(), createBlock(_component_el_select, {
                                        key: 0,
                                        modelValue: __props.head[waterKeys[i]],
                                        "onUpdate:modelValue": $event => ((__props.head[waterKeys[i]]) = $event),
                                        size: "small",
                                        clearable: false,
                                        onChange: _cache[63] || (_cache[63] = $event => (emit('dirty')))
                                      }, {
                                        default: withCtx(() => [
                                          (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions(waterKeys[i]), (o) => {
                                            return (openBlock(), createBlock(_component_el_option, {
                                              key: o.value,
                                              label: o.label,
                                              value: o.value
                                            }, null, 8, ["label", "value"]))
                                          }), 128))
                                        ]),
                                        _: 2
                                      }, 1032, ["modelValue", "onUpdate:modelValue"]))
                                    : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                        createTextVNode(toDisplayString(__props.head[waterKeys[i]] || ''), 1)
                                      ], 64))
                                ], 64))
                              : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                                  (__props.editable)
                                    ? (openBlock(), createBlock(_component_el_input, {
                                        key: 0,
                                        modelValue: __props.head[waterKeys[i]],
                                        "onUpdate:modelValue": $event => ((__props.head[waterKeys[i]]) = $event),
                                        size: "small",
                                        class: "rs-c-in",
                                        onInput: _cache[64] || (_cache[64] = $event => (emit('dirty')))
                                      }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                                    : (openBlock(), createElementBlock("span", _hoisted_220, toDisplayString(__props.head[waterKeys[i]] || ''), 1))
                                ], 64))
                          ], 8, _hoisted_219))
                        }), 128))
                      ])
                    ])
                  ])
                ], 8, _hoisted_216)
              ]))
            : createCommentVNode("", true),
          (sec.soakBlocks)
            ? (openBlock(), createElementBlock(Fragment, { key: 4 }, [
                createBaseVNode("tr", null, [
                  createBaseVNode("td", _hoisted_221, toDisplayString(unref(tt)('浸泡液用量')), 1),
                  createBaseVNode("td", _hoisted_222, toDisplayString(unref(tt)('炭棒尺寸')), 1),
                  (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.soakColspans, (cs, i) => {
                    return (openBlock(), createElementBlock("td", {
                      key: 'sv' + i,
                      class: "rs-td",
                      colspan: cs
                    }, [
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: __props.head[soakSizeKeys[i]],
                            "onUpdate:modelValue": $event => ((__props.head[soakSizeKeys[i]]) = $event),
                            size: "small",
                            maxlength: "60",
                            class: "rs-t-in",
                            onInput: _cache[65] || (_cache[65] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_224, toDisplayString(__props.head[soakSizeKeys[i]] || ''), 1))
                    ], 8, _hoisted_223))
                  }), 128))
                ]),
                createBaseVNode("tr", null, [
                  createBaseVNode("td", _hoisted_225, toDisplayString(unref(tt)('浸泡液用量（ml）')), 1),
                  (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.soakColspans, (cs, i) => {
                    return (openBlock(), createElementBlock("td", {
                      key: 'sv2' + i,
                      class: "rs-td",
                      colspan: cs
                    }, [
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: __props.head[soakVolKeys[i]],
                            "onUpdate:modelValue": $event => ((__props.head[soakVolKeys[i]]) = $event),
                            size: "small",
                            maxlength: "60",
                            class: "rs-t-in",
                            onInput: _cache[66] || (_cache[66] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_227, toDisplayString(__props.head[soakVolKeys[i]] || ''), 1))
                    ], 8, _hoisted_226))
                  }), 128))
                ]),
                createBaseVNode("tr", null, [
                  createBaseVNode("td", _hoisted_228, toDisplayString(unref(tt)('测试用仪器/检出限')), 1),
                  createBaseVNode("td", _hoisted_229, toDisplayString(unref(tt)('测试项目')), 1),
                  createBaseVNode("td", _hoisted_230, toDisplayString(unref(tt)('仪器名称')), 1),
                  createBaseVNode("td", _hoisted_231, toDisplayString(unref(tt)('品牌型号')), 1),
                  createBaseVNode("td", {
                    class: "rs-th",
                    colspan: cfg.value.soakColspans[2]
                  }, toDisplayString(unref(tt)('检出限')), 9, _hoisted_232)
                ]),
                (openBlock(), createElementBlock(Fragment, null, renderList(soakInstrumentRows, (it) => {
                  return createBaseVNode("tr", {
                    key: it.name
                  }, [
                    createBaseVNode("td", _hoisted_233, toDisplayString(unref(tt)(it.name)), 1),
                    createBaseVNode("td", _hoisted_234, [
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: __props.head[it.keys[0]],
                            "onUpdate:modelValue": $event => ((__props.head[it.keys[0]]) = $event),
                            size: "small",
                            maxlength: "120",
                            class: "rs-t-in",
                            onInput: _cache[67] || (_cache[67] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_235, toDisplayString(__props.head[it.keys[0]] || ''), 1))
                    ]),
                    createBaseVNode("td", _hoisted_236, [
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: __props.head[it.keys[1]],
                            "onUpdate:modelValue": $event => ((__props.head[it.keys[1]]) = $event),
                            size: "small",
                            maxlength: "120",
                            class: "rs-t-in",
                            onInput: _cache[68] || (_cache[68] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_237, toDisplayString(__props.head[it.keys[1]] || ''), 1))
                    ]),
                    createBaseVNode("td", {
                      class: "rs-td",
                      colspan: cfg.value.soakColspans[2]
                    }, [
                      (__props.editable)
                        ? (openBlock(), createBlock(_component_el_input, {
                            key: 0,
                            modelValue: __props.head[it.keys[2]],
                            "onUpdate:modelValue": $event => ((__props.head[it.keys[2]]) = $event),
                            size: "small",
                            maxlength: "120",
                            class: "rs-t-in",
                            onInput: _cache[69] || (_cache[69] = $event => (emit('dirty')))
                          }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                        : (openBlock(), createElementBlock("span", _hoisted_239, toDisplayString(__props.head[it.keys[2]] || ''), 1))
                    ], 8, _hoisted_238)
                  ])
                }), 64))
              ], 64))
            : createCommentVNode("", true)
        ])
      ], 4)), [
        [vShow, !isAtOrBeforeTableAnchor(sec) && pageOf(sec) === activePage.value]
      ])
    }), 128)),
    (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.tailDocSections || [], (sec, si) => {
      return withDirectives((openBlock(), createElementBlock("table", {
        key: 'tds' + si,
        class: "rs-t",
        style: normalizeStyle({ width: gridW.value + 'px' })
      }, [
        createBaseVNode("colgroup", null, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(secCols(sec), (w, i) => {
            return (openBlock(), createElementBlock("col", {
              key: 'tdc' + i,
              style: normalizeStyle({ width: w + 'px' })
            }, null, 4))
          }), 128))
        ]),
        createBaseVNode("tbody", null, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(sec.rows, (row, ri) => {
            return (openBlock(), createElementBlock("tr", {
              key: 'tdr' + ri
            }, [
              createBaseVNode("td", {
                colspan: secCols(sec).length,
                class: "rsp-doccell"
              }, [
                createBaseVNode("div", _hoisted_241, [
                  createBaseVNode("span", _hoisted_242, toDisplayString(unref(tt)(row.label)) + "：", 1),
                  (__props.editable)
                    ? (openBlock(), createBlock(_component_el_input, {
                        key: 0,
                        modelValue: __props.head[row.key],
                        "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                        type: "textarea",
                        autosize: { minRows: row.area ? 2 : 1, maxRows: 8 },
                        size: "small",
                        class: "rsp-docinput",
                        maxlength: row.max || 2000,
                        onInput: _cache[70] || (_cache[70] = $event => (emit('dirty')))
                      }, null, 8, ["modelValue", "onUpdate:modelValue", "autosize", "maxlength"]))
                    : (openBlock(), createElementBlock("span", _hoisted_243, toDisplayString(__props.head[row.key] || ''), 1)),
                  (__props.editable)
                    ? (openBlock(), createElementBlock("span", {
                        key: 2,
                        class: "rsp-lib-pick",
                        onClick: withModifiers($event => (openSectionLib(row)), ["stop"])
                      }, "⌄ " + toDisplayString(unref(tt)('标准库')), 9, _hoisted_244))
                    : createCommentVNode("", true)
                ])
              ], 8, _hoisted_240)
            ]))
          }), 128))
        ])
      ], 4)), [
        [vShow, pageOf(sec) === activePage.value]
      ])
    }), 128)),
    (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.tailSections || [], (sec, si) => {
      return withDirectives((openBlock(), createElementBlock("table", {
        key: 'ts' + si,
        class: "rs-t",
        style: normalizeStyle({ width: gridW.value + 'px' })
      }, [
        createBaseVNode("colgroup", null, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(effGrid.value, (w, i) => {
            return (openBlock(), createElementBlock("col", {
              key: 'tc' + i,
              style: normalizeStyle({ width: w + 'px' })
            }, null, 4))
          }), 128))
        ]),
        createBaseVNode("tbody", null, [
          createBaseVNode("tr", null, [
            createBaseVNode("td", {
              colspan: nCols.value,
              class: "rs-sectionbar"
            }, toDisplayString(unref(tt)(sec.bar)), 9, _hoisted_245)
          ]),
          (openBlock(true), createElementBlock(Fragment, null, renderList(sec.rows, (row, ri) => {
            return (openBlock(), createElementBlock("tr", {
              key: 'tr' + ri
            }, [
              createBaseVNode("td", _hoisted_246, toDisplayString(unref(tt)(row.label)), 1),
              createBaseVNode("td", {
                class: "rs-td",
                colspan: nCols.value - 1
              }, [
                (__props.editable && row.type === 'text')
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: __props.head[row.key],
                      "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                      size: "small",
                      maxlength: row.max || 300,
                      class: "rs-t-in",
                      onInput: _cache[71] || (_cache[71] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                  : (__props.editable)
                    ? (openBlock(), createBlock(_component_el_input, {
                        key: 1,
                        modelValue: __props.head[row.key],
                        "onUpdate:modelValue": $event => ((__props.head[row.key]) = $event),
                        type: "textarea",
                        autosize: { minRows: 1, maxRows: 8 },
                        size: "small",
                        maxlength: row.max || 2000,
                        class: "rs-t-in",
                        onInput: _cache[72] || (_cache[72] = $event => (emit('dirty')))
                      }, null, 8, ["modelValue", "onUpdate:modelValue", "maxlength"]))
                    : (openBlock(), createElementBlock("span", _hoisted_248, toDisplayString(__props.head[row.key] || ''), 1))
              ], 8, _hoisted_247)
            ]))
          }), 128))
        ])
      ], 4)), [
        [vShow, pageOf(sec) === activePage.value]
      ])
    }), 128)),
    (openBlock(true), createElementBlock(Fragment, null, renderList(tailTablesOfPage.value, (tt2, ti) => {
      return (openBlock(), createElementBlock("table", {
        key: 'tt' + ti,
        class: "rs-t rs-tail-table",
        style: normalizeStyle({ width: tailTableW(tt2) + 'px' })
      }, [
        createBaseVNode("colgroup", null, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(tt2.cols, (c, i) => {
            return (openBlock(), createElementBlock("col", {
              key: 'tc2' + i,
              style: normalizeStyle({ width: (c.w || 120) + 'px' })
            }, null, 4))
          }), 128))
        ]),
        createBaseVNode("tbody", null, [
          (tt2.bar)
            ? (openBlock(), createElementBlock("tr", _hoisted_249, [
                createBaseVNode("td", {
                  colspan: tt2.cols.length,
                  class: "rs-sectionbar"
                }, toDisplayString(unref(tt)(tt2.bar)), 9, _hoisted_250)
              ]))
            : createCommentVNode("", true),
          createBaseVNode("tr", null, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(tt2.cols, (c) => {
              return (openBlock(), createElementBlock("th", {
                key: 'th2' + c.key,
                class: "rs-th"
              }, toDisplayString(unref(tt)(c.label)), 1))
            }), 128))
          ]),
          (openBlock(true), createElementBlock(Fragment, null, renderList(tt2.rows, (row, ri) => {
            return (openBlock(), createElementBlock("tr", {
              key: 'tr2' + ri
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(tt2.cols, (c) => {
                return (openBlock(), createElementBlock("td", {
                  key: 'td2' + c.key,
                  class: normalizeClass(["rs-td", { 'rsp-center': c.align === 'center' }])
                }, [
                  createBaseVNode("span", _hoisted_251, toDisplayString(row[c.key] || ''), 1)
                ], 2))
              }), 128))
            ]))
          }), 128))
        ])
      ], 4))
    }), 128)),
    (ledgerCfg.value)
      ? (openBlock(), createElementBlock("div", {
          key: 2,
          class: "rsp-ledger",
          style: normalizeStyle({ width: ledgerW.value + 'px' })
        }, [
          createBaseVNode("table", {
            class: "rs-t rs-ledger-t",
            style: normalizeStyle({ width: ledgerW.value + 'px' })
          }, [
            createBaseVNode("colgroup", null, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(ledgerCfg.value.cols, (c, i) => {
                return (openBlock(), createElementBlock("col", {
                  key: 'lc' + i,
                  style: normalizeStyle({ width: (c.w || 120) + 'px' })
                }, null, 4))
              }), 128))
            ]),
            createBaseVNode("tbody", null, [
              (ledgerCfg.value.title)
                ? (openBlock(), createElementBlock("tr", _hoisted_252, [
                    createBaseVNode("td", {
                      colspan: ledgerCfg.value.cols.length,
                      class: "rsp-page-title"
                    }, toDisplayString(unref(tt)(ledgerCfg.value.title)), 9, _hoisted_253)
                  ]))
                : createCommentVNode("", true),
              createBaseVNode("tr", null, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(ledgerCfg.value.cols, (c) => {
                  return (openBlock(), createElementBlock("th", {
                    key: 'lh' + c.label,
                    class: "rs-th"
                  }, toDisplayString(unref(tt)(c.label)), 1))
                }), 128))
              ]),
              (ledgerCfg.value.cols.some((c) => c.hint))
                ? (openBlock(), createElementBlock("tr", _hoisted_254, [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(ledgerCfg.value.cols, (c) => {
                      return (openBlock(), createElementBlock("td", {
                        key: 'lhh' + c.label,
                        class: "rs-td"
                      }, toDisplayString(c.hint ? unref(tt)(c.hint) : ''), 1))
                    }), 128))
                  ]))
                : createCommentVNode("", true),
              (openBlock(true), createElementBlock(Fragment, null, renderList(ledgerRows.value, (row, ri) => {
                return (openBlock(), createElementBlock("tr", {
                  key: 'lr' + ri
                }, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(ledgerCfg.value.cols, (c) => {
                    return (openBlock(), createElementBlock("td", {
                      key: 'lc' + c.label,
                      class: normalizeClass(["rs-td", { 'rsp-center': c.align === 'center' }])
                    }, [
                      createBaseVNode("span", _hoisted_255, toDisplayString(unref(ledgerCell$1)(c, row, ri)), 1)
                    ], 2))
                  }), 128))
                ]))
              }), 128)),
              (ledgerLoading.value)
                ? (openBlock(), createElementBlock("tr", _hoisted_256, [
                    createBaseVNode("td", {
                      colspan: ledgerCfg.value.cols.length,
                      class: "rs-empty"
                    }, toDisplayString(unref(tt)('加载中…')), 9, _hoisted_257)
                  ]))
                : (!ledgerRows.value.length)
                  ? (openBlock(), createElementBlock("tr", _hoisted_258, [
                      createBaseVNode("td", {
                        colspan: ledgerCfg.value.cols.length,
                        class: "rs-empty"
                      }, toDisplayString(unref(tt)('暂无申请单')), 9, _hoisted_259)
                    ]))
                  : createCommentVNode("", true)
            ])
          ], 4)
        ], 4))
      : createCommentVNode("", true),
    (cfg.value.conclusion)
      ? (openBlock(), createElementBlock("table", {
          key: 3,
          class: "rs-t",
          style: normalizeStyle({ width: gridW.value + 'px' })
        }, [
          createBaseVNode("colgroup", null, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(cfg.value.grid, (w, i) => {
              return (openBlock(), createElementBlock("col", {
                key: 'cc' + i,
                style: normalizeStyle({ width: w + 'px' })
              }, null, 4))
            }), 128))
          ]),
          createBaseVNode("tbody", null, [
            createBaseVNode("tr", null, [
              createBaseVNode("td", {
                colspan: nCols.value,
                class: "rs-sectionbar"
              }, toDisplayString(unref(tt)(cfg.value.conclusion.bar)), 9, _hoisted_260)
            ]),
            createBaseVNode("tr", null, [
              createBaseVNode("td", {
                class: "rs-td rs-conclusion",
                colspan: nCols.value
              }, [
                (__props.editable)
                  ? (openBlock(), createBlock(_component_el_input, {
                      key: 0,
                      modelValue: __props.head[cfg.value.conclusion.key],
                      "onUpdate:modelValue": _cache[73] || (_cache[73] = $event => ((__props.head[cfg.value.conclusion.key]) = $event)),
                      type: "textarea",
                      autosize: { minRows: 2, maxRows: 12 },
                      size: "small",
                      class: "rs-t-in",
                      onInput: _cache[74] || (_cache[74] = $event => (emit('dirty')))
                    }, null, 8, ["modelValue"]))
                  : (openBlock(), createElementBlock("span", _hoisted_262, toDisplayString(__props.head[cfg.value.conclusion.key] || ''), 1))
              ], 8, _hoisted_261)
            ])
          ])
        ], 4))
      : createCommentVNode("", true),
    createVNode(_component_el_dialog, {
      modelValue: libVisible.value,
      "onUpdate:modelValue": _cache[91] || (_cache[91] = $event => ((libVisible).value = $event)),
      title: unref(tt)(libDialogTitle.value),
      width: "880px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          disabled: !canEditLibEntry.value,
          onClick: editLibEntry
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('编辑')), 1)
          ]),
          _: 1
        }, 8, ["disabled"]),
        createVNode(_component_el_button, {
          onClick: _cache[90] || (_cache[90] = $event => (libVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          onClick: confirmLib
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(isAsmProcLib.value ? unref(tt)('替换本表内容') : unref(tt)('追加选中项')) + "(" + toDisplayString(libChecked.value.length) + ")", 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        (!isAsmProcLib.value)
          ? (openBlock(), createElementBlock("div", _hoisted_263, toDisplayString(unref(tt)('库条目均可维护：勾选一条可「编辑」，✕ 停用、↩ 恢复启用；改库只影响以后的勾选，已录入单据不变。')), 1))
          : createCommentVNode("", true),
        (libTargetDt.value && libTargetDt.value.lib === 'asm.proc')
          ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
              createBaseVNode("div", _hoisted_264, toDisplayString(unref(tt)('选一个变体：该变体的一整套工序会替换本表当前内容（不是追加）。可在此「停用」整条；要改工序内容请到「标准库维护」。')), 1),
              createVNode(_component_el_table, {
                data: libRows.value,
                size: "small",
                border: "",
                "max-height": "480",
                "highlight-current-row": "",
                "row-class-name": ({ row }) => (row.off ? 'lib-row-off' : ''),
                onCurrentChange: _cache[75] || (_cache[75] = (row) => (libChecked.value = row && !row.off ? [row] : []))
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_table_column, { width: "42" }, {
                    default: withCtx(({ row }) => [
                      createVNode(_component_el_radio, {
                        "model-value": libChecked.value[0] && libChecked.value[0].item,
                        value: row.item,
                        disabled: row.off,
                        onChange: () => (libChecked.value = row.off ? [] : [row])
                      }, {
                        default: withCtx(() => [...(_cache[102] || (_cache[102] = [
                          createBaseVNode("span", null, null, -1)
                        ]))]),
                        _: 1
                      }, 8, ["model-value", "value", "disabled", "onChange"])
                    ]),
                    _: 1
                  }),
                  createVNode(_component_el_table_column, {
                    prop: "item",
                    label: unref(tt)('变体'),
                    width: "160"
                  }, {
                    default: withCtx(({ row }) => [
                      createTextVNode(toDisplayString(row.name + (row.off ? '（' + unref(tt)('已停用') + '）' : '')), 1)
                    ]),
                    _: 1
                  }, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('工序数'),
                    width: "90",
                    align: "right"
                  }, {
                    default: withCtx(({ row }) => [
                      createTextVNode(toDisplayString(row.n), 1)
                    ]),
                    _: 1
                  }, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    label: unref(tt)('工序一览'),
                    "min-width": "360"
                  }, {
                    default: withCtx(({ row }) => [
                      createTextVNode(toDisplayString((row.rows || []).map((r) => r['工序']).join(' / ')), 1)
                    ]),
                    _: 1
                  }, 8, ["label"])
                ]),
                _: 1
              }, 8, ["data", "row-class-name"])
            ], 64))
          : (libRows.value.length && Array.isArray(libRows.value[0].subs))
            ? (openBlock(), createElementBlock(Fragment, { key: 2 }, [
                createVNode(_component_el_scrollbar, { "max-height": "520" }, {
                  default: withCtx(() => [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(libRows.value, (g, gi) => {
                      return (openBlock(), createElementBlock("div", {
                        key: 'lg' + gi,
                        class: "lib-group"
                      }, [
                        createBaseVNode("div", _hoisted_265, toDisplayString(unref(tt)(g.name)), 1),
                        createBaseVNode("div", _hoisted_266, [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(g.subs, (s, si) => {
                            return (openBlock(), createElementBlock("div", {
                              key: 'ls' + gi + '-' + si,
                              class: normalizeClass(["lib-sub-item", { 'lib-sub-item-off': s.off }])
                            }, [
                              createVNode(_component_el_checkbox, {
                                "model-value": libChecked.value.includes(gi + ':' + si),
                                disabled: s.off,
                                onChange: (v) => toggleLib(gi + ':' + si, !!v)
                              }, {
                                default: withCtx(() => [
                                  createBaseVNode("span", {
                                    class: normalizeClass(["lib-sub-name", { 'lib-sub-name-off': s.off }])
                                  }, toDisplayString((s.name ? unref(tt)(s.name) : unref(tt)('（项目）')) + (s.off ? '（' + unref(tt)('已停用') + '）' : '')), 3),
                                  createBaseVNode("span", _hoisted_267, toDisplayString(String(s.req || '').split('\n')[0].slice(0, 26)), 1)
                                ]),
                                _: 2
                              }, 1032, ["model-value", "disabled", "onChange"]),
                              (s.dbId && !s.off)
                                ? (openBlock(), createElementBlock("span", {
                                    key: 0,
                                    class: "lib-sub-del",
                                    title: unref(tt)('停用'),
                                    onClick: withModifiers($event => (stopLibRow(s.dbId)), ["stop"])
                                  }, "✕", 8, _hoisted_268))
                                : createCommentVNode("", true),
                              (s.off)
                                ? (openBlock(), createElementBlock("span", {
                                    key: 1,
                                    class: "lib-sub-undo",
                                    title: unref(tt)('恢复启用'),
                                    onClick: withModifiers($event => (enableLibRow(s.dbId)), ["stop"])
                                  }, "↩", 8, _hoisted_269))
                                : createCommentVNode("", true),
                              (s.dbId)
                                ? (openBlock(), createElementBlock("span", {
                                    key: 2,
                                    class: "lib-sub-destroy",
                                    title: unref(tt)('彻底删除'),
                                    onClick: withModifiers($event => (destroyLibRow(s.dbId)), ["stop"])
                                  }, "🗑", 8, _hoisted_270))
                                : createCommentVNode("", true)
                            ], 2))
                          }), 128))
                        ])
                      ]))
                    }), 128))
                  ]),
                  _: 1
                }),
                createBaseVNode("div", _hoisted_271, [
                  createBaseVNode("div", _hoisted_272, toDisplayString(unref(tt)('补充自定义检验项')) + "(" + toDisplayString(unref(tt)('存入后长期可用')) + ")", 1),
                  createBaseVNode("div", _hoisted_273, [
                    createVNode(_component_el_input, {
                      modelValue: libCGroup.value,
                      "onUpdate:modelValue": _cache[76] || (_cache[76] = $event => ((libCGroup).value = $event)),
                      size: "small",
                      readonly: !!libCEditId.value,
                      title: libCEditId.value ? unref(tt)('组名是条目的归属(item_code)，编辑接口不改它；要换组请新建条目') : '',
                      placeholder: unref(tt)('检验项目(组名)')
                    }, null, 8, ["modelValue", "readonly", "title", "placeholder"]),
                    createVNode(_component_el_input, {
                      modelValue: libCSub.value,
                      "onUpdate:modelValue": _cache[77] || (_cache[77] = $event => ((libCSub).value = $event)),
                      size: "small",
                      placeholder: unref(tt)('子项目(可空)')
                    }, null, 8, ["modelValue", "placeholder"]),
                    createVNode(_component_el_input, {
                      modelValue: libCReq.value,
                      "onUpdate:modelValue": _cache[78] || (_cache[78] = $event => ((libCReq).value = $event)),
                      size: "small",
                      type: "textarea",
                      autosize: { minRows: 2, maxRows: 10 },
                      class: "lib-wide",
                      placeholder: unref(tt)('检验要求')
                    }, null, 8, ["modelValue", "placeholder"]),
                    createVNode(_component_el_input, {
                      modelValue: libCMethod.value,
                      "onUpdate:modelValue": _cache[79] || (_cache[79] = $event => ((libCMethod).value = $event)),
                      size: "small",
                      type: "textarea",
                      autosize: { minRows: 1, maxRows: 6 },
                      class: "lib-wide",
                      placeholder: unref(tt)('检验方法')
                    }, null, 8, ["modelValue", "placeholder"]),
                    createVNode(_component_el_input, {
                      modelValue: libCBasis.value,
                      "onUpdate:modelValue": _cache[80] || (_cache[80] = $event => ((libCBasis).value = $event)),
                      size: "small",
                      type: "textarea",
                      autosize: { minRows: 1, maxRows: 6 },
                      class: "lib-wide",
                      placeholder: unref(tt)('检验依据')
                    }, null, 8, ["modelValue", "placeholder"]),
                    createVNode(_component_el_button, {
                      size: "small",
                      type: "primary",
                      onClick: addCustomTestLib
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(libCEditId.value ? unref(tt)('保存修改') : unref(tt)('存入标准库')), 1)
                      ]),
                      _: 1
                    }),
                    (libCEditId.value)
                      ? (openBlock(), createBlock(_component_el_button, {
                          key: 0,
                          size: "small",
                          onClick: cancelEditTestLib
                        }, {
                          default: withCtx(() => [
                            createTextVNode(toDisplayString(unref(tt)('取消编辑')), 1)
                          ]),
                          _: 1
                        }))
                      : createCommentVNode("", true)
                  ])
                ])
              ], 64))
            : (openBlock(), createBlock(_component_el_table, {
                key: 3,
                data: libRows.value,
                size: "small",
                border: "",
                "max-height": "480",
                "row-class-name": ({ row }) => (row.off ? 'lib-row-off' : ''),
                onSelectionChange: _cache[81] || (_cache[81] = (sel) => (libChecked.value = sel.filter((r) => !r.off)))
              }, {
                default: withCtx(() => [
                  createVNode(_component_el_table_column, {
                    type: "selection",
                    width: "42",
                    selectable: (row) => !row.off
                  }, null, 8, ["selectable"]),
                  (libTargetDt.value?.libGroupKey)
                    ? (openBlock(), createBlock(_component_el_table_column, {
                        key: 0,
                        label: unref(tt)('分组'),
                        width: "90",
                        align: "center"
                      }, {
                        default: withCtx(({ row }) => [
                          createTextVNode(toDisplayString(unref(tt)(flatGroupOf(row))), 1)
                        ]),
                        _: 1
                      }, 8, ["label"]))
                    : createCommentVNode("", true),
                  createVNode(_component_el_table_column, {
                    prop: "控制项目",
                    label: unref(tt)('控制项目'),
                    "min-width": "110"
                  }, {
                    default: withCtx(({ row }) => [
                      createTextVNode(toDisplayString(row['控制项目'] + (row.off ? '（' + unref(tt)('已停用') + '）' : '')), 1)
                    ]),
                    _: 1
                  }, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "质量控制内容",
                    label: unref(tt)('质量控制内容'),
                    "min-width": "110"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "检测仪器",
                    label: unref(tt)('检测仪器、工具'),
                    "min-width": "100"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "控制标准及要求",
                    label: unref(tt)('控制标准及要求'),
                    "min-width": "220"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "检验",
                    label: unref(tt)('检验'),
                    width: "60"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "检测频率",
                    label: unref(tt)('检测频率'),
                    "min-width": "90"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "检验内容",
                    label: unref(tt)('检验内容'),
                    "min-width": "140"
                  }, null, 8, ["label"]),
                  createVNode(_component_el_table_column, {
                    prop: "控制方法",
                    label: unref(tt)('控制方法'),
                    "min-width": "90"
                  }, null, 8, ["label"]),
                  (hasDbFlat.value)
                    ? (openBlock(), createBlock(_component_el_table_column, {
                        key: 1,
                        label: unref(tt)('操作'),
                        width: "80",
                        align: "center"
                      }, {
                        default: withCtx(({ row }) => [
                          (row.dbId && !row.off)
                            ? (openBlock(), createElementBlock("span", {
                                key: 0,
                                class: "lib-sub-del",
                                title: unref(tt)('停用'),
                                onClick: withModifiers($event => (stopLibRow(row.dbId)), ["stop"])
                              }, "✕", 8, _hoisted_274))
                            : (row.off)
                              ? (openBlock(), createElementBlock("span", {
                                  key: 1,
                                  class: "lib-sub-undo",
                                  title: unref(tt)('恢复启用'),
                                  onClick: withModifiers($event => (enableLibRow(row.dbId)), ["stop"])
                                }, "↩", 8, _hoisted_275))
                              : createCommentVNode("", true),
                          (row.dbId)
                            ? (openBlock(), createElementBlock("span", {
                                key: 2,
                                class: "lib-sub-destroy",
                                title: unref(tt)('彻底删除'),
                                onClick: withModifiers($event => (destroyLibRow(row.dbId)), ["stop"])
                              }, "🗑", 8, _hoisted_276))
                            : createCommentVNode("", true)
                        ]),
                        _: 1
                      }, 8, ["label"]))
                    : createCommentVNode("", true)
                ]),
                _: 1
              }, 8, ["data", "row-class-name"])),
        (!isGroupedLib.value && !isAsmProcLib.value)
          ? (openBlock(), createElementBlock("div", _hoisted_277, [
              createBaseVNode("div", _hoisted_278, toDisplayString(unref(tt)('补充自定义检验项')) + "(" + toDisplayString(unref(tt)('存入后长期可用')) + ")", 1),
              createBaseVNode("div", _hoisted_279, [
                (libTargetDt.value?.libGroupKey)
                  ? (openBlock(), createBlock(_component_el_select, {
                      key: 0,
                      modelValue: libFGroup.value,
                      "onUpdate:modelValue": _cache[82] || (_cache[82] = $event => ((libFGroup).value = $event)),
                      size: "small",
                      filterable: "",
                      "allow-create": "",
                      "default-first-option": "",
                      placeholder: unref(tt)('分组'),
                      style: {"width":"120px"}
                    }, {
                      default: withCtx(() => [
                        (openBlock(true), createElementBlock(Fragment, null, renderList(selectOptions(libTargetDt.value.libGroupKey), (o) => {
                          return (openBlock(), createBlock(_component_el_option, {
                            key: o.value,
                            label: unref(tt)(o.label),
                            value: o.value
                          }, null, 8, ["label", "value"]))
                        }), 128))
                      ]),
                      _: 1
                    }, 8, ["modelValue", "placeholder"]))
                  : createCommentVNode("", true),
                createVNode(_component_el_input, {
                  modelValue: libFControl.value,
                  "onUpdate:modelValue": _cache[83] || (_cache[83] = $event => ((libFControl).value = $event)),
                  size: "small",
                  placeholder: unref(tt)('控制项目')
                }, null, 8, ["modelValue", "placeholder"]),
                createVNode(_component_el_input, {
                  modelValue: libFQuality.value,
                  "onUpdate:modelValue": _cache[84] || (_cache[84] = $event => ((libFQuality).value = $event)),
                  size: "small",
                  placeholder: unref(tt)('质量控制内容')
                }, null, 8, ["modelValue", "placeholder"]),
                createVNode(_component_el_input, {
                  modelValue: libFInstrument.value,
                  "onUpdate:modelValue": _cache[85] || (_cache[85] = $event => ((libFInstrument).value = $event)),
                  size: "small",
                  placeholder: unref(tt)('检测仪器、工具')
                }, null, 8, ["modelValue", "placeholder"]),
                createVNode(_component_el_input, {
                  modelValue: libFStandard.value,
                  "onUpdate:modelValue": _cache[86] || (_cache[86] = $event => ((libFStandard).value = $event)),
                  size: "small",
                  type: "textarea",
                  autosize: { minRows: 2, maxRows: 10 },
                  class: "lib-wide",
                  placeholder: unref(tt)('控制标准及要求')
                }, null, 8, ["modelValue", "placeholder"]),
                createVNode(_component_el_input, {
                  modelValue: libFFrequency.value,
                  "onUpdate:modelValue": _cache[87] || (_cache[87] = $event => ((libFFrequency).value = $event)),
                  size: "small",
                  placeholder: unref(tt)('检测频率')
                }, null, 8, ["modelValue", "placeholder"]),
                createVNode(_component_el_input, {
                  modelValue: libFContent.value,
                  "onUpdate:modelValue": _cache[88] || (_cache[88] = $event => ((libFContent).value = $event)),
                  size: "small",
                  type: "textarea",
                  autosize: { minRows: 1, maxRows: 6 },
                  class: "lib-wide",
                  placeholder: unref(tt)('检验内容')
                }, null, 8, ["modelValue", "placeholder"]),
                createVNode(_component_el_input, {
                  modelValue: libFMethod.value,
                  "onUpdate:modelValue": _cache[89] || (_cache[89] = $event => ((libFMethod).value = $event)),
                  size: "small",
                  type: "textarea",
                  autosize: { minRows: 1, maxRows: 6 },
                  class: "lib-wide",
                  placeholder: unref(tt)('控制方法')
                }, null, 8, ["modelValue", "placeholder"]),
                createVNode(_component_el_button, {
                  size: "small",
                  type: "primary",
                  onClick: addCustomFlatLib
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(libFEditId.value ? unref(tt)('保存修改') : unref(tt)('存入标准库')), 1)
                  ]),
                  _: 1
                }),
                (libFEditId.value)
                  ? (openBlock(), createBlock(_component_el_button, {
                      key: 1,
                      size: "small",
                      onClick: cancelEditFlatLib
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(unref(tt)('取消编辑')), 1)
                      ]),
                      _: 1
                    }))
                  : createCommentVNode("", true)
              ])
            ]))
          : createCommentVNode("", true)
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: secLibVisible.value,
      "onUpdate:modelValue": _cache[94] || (_cache[94] = $event => ((secLibVisible).value = $event)),
      title: unref(tt)('章节标准库') + ' · ' + unref(tt)(secLibLabel.value),
      width: "760px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[93] || (_cache[93] = $event => (secLibVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('关闭')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createVNode(StdLibManager, {
          ref_key: "secLibRef",
          ref: secLibRef,
          lib: secLibLib.value,
          item: secLibItem.value,
          "add-item": secLibItem.value,
          pickable: "",
          "show-add": false,
          onPick: applySectionLib
        }, null, 8, ["lib", "item", "add-item"]),
        createBaseVNode("div", _hoisted_280, [
          createVNode(_component_el_input, {
            modelValue: secLibDraft.value,
            "onUpdate:modelValue": _cache[92] || (_cache[92] = $event => ((secLibDraft).value = $event)),
            type: "textarea",
            rows: 3,
            placeholder: unref(tt)('新条目(默认带入当前值，编辑后存入)')
          }, null, 8, ["modelValue", "placeholder"]),
          createVNode(_component_el_button, {
            type: "primary",
            onClick: addSectionLib
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(tt)('存入标准库')), 1)
            ]),
            _: 1
          })
        ])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: fieldEditVisible.value,
      "onUpdate:modelValue": _cache[96] || (_cache[96] = $event => ((fieldEditVisible).value = $event)),
      title: unref(tt)('字段编辑'),
      width: "620px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[95] || (_cache[95] = $event => (fieldEditVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('取消')), 1)
          ]),
          _: 1
        }),
        createVNode(_component_el_button, {
          type: "primary",
          onClick: saveFieldEdit
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('保存')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createBaseVNode("div", _hoisted_281, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(fieldEditRows.value, (row, idx) => {
            return (openBlock(), createElementBlock("div", {
              key: idx,
              class: "fe-row"
            }, [
              createBaseVNode("span", {
                class: "fe-key",
                title: row.key
              }, toDisplayString(row.key), 9, _hoisted_282),
              createBaseVNode("span", _hoisted_283, toDisplayString(row.label), 1),
              createVNode(_component_el_input, {
                "model-value": row.alias,
                "onUpdate:modelValue": (v) => { row.alias = v; },
                size: "small",
                placeholder: row.label,
                clearable: "",
                class: "fe-alias"
              }, null, 8, ["model-value", "onUpdate:modelValue", "placeholder"]),
              createVNode(_component_el_checkbox, {
                "model-value": row.visible,
                "onUpdate:modelValue": (v) => { row.visible = v; },
                class: "fe-vis"
              }, null, 8, ["model-value", "onUpdate:modelValue"])
            ]))
          }), 128))
        ]),
        createBaseVNode("div", _hoisted_284, toDisplayString(unref(tt)('留空=沿用原名;修改全局生效(所有用户共享)')), 1)
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(_component_el_dialog, {
      modelValue: stdLibVisible.value,
      "onUpdate:modelValue": _cache[98] || (_cache[98] = $event => ((stdLibVisible).value = $event)),
      title: unref(tt)('标准库维护') + ' · ' + unref(tt)(stdLibName.value),
      width: "680px",
      "append-to-body": ""
    }, {
      footer: withCtx(() => [
        createVNode(_component_el_button, {
          onClick: _cache[97] || (_cache[97] = $event => (stdLibVisible.value = false))
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(unref(tt)('关闭')), 1)
          ]),
          _: 1
        })
      ]),
      default: withCtx(() => [
        createVNode(StdLibManager, {
          lib: stdLibCode.value,
          onChanged: onStdLibChanged
        }, null, 8, ["lib"])
      ]),
      _: 1
    }, 8, ["modelValue", "title"]),
    createVNode(RecipeCalcDialog, {
      modelValue: recipeCalcVisible.value,
      "onUpdate:modelValue": _cache[99] || (_cache[99] = $event => ((recipeCalcVisible).value = $event)),
      head: __props.head,
      rows: recipeCalcRows.value,
      onApplied: _cache[100] || (_cache[100] = $event => (emit('dirty')))
    }, null, 8, ["modelValue", "head", "rows"]),
    createVNode(RefPickDialog, {
      modelValue: prodRefVisible.value,
      "onUpdate:modelValue": _cache[101] || (_cache[101] = $event => ((prodRefVisible).value = $event)),
      field: prodRefField.value,
      mode: "header",
      "owner-panel": __props.panelCode,
      onConfirm: onProdRefConfirm
    }, null, 8, ["modelValue", "field", "owner-panel"])
  ]))
}
}

};
const RecordSheetPanels = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-f9e4615a"]]);

export { RecordSheetPanels as R, recordSheetConfigs as r };
