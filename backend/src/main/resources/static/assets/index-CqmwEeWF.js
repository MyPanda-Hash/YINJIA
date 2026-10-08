const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/ModuleView-CuHU2ZRq.js","assets/element-plus-W84rT0en.js","assets/vue-vendor-DyX2BAKf.js","assets/element-icons-DOEvq9OG.js","assets/_plugin-vue_export-helper-pcqpp-6-.js","assets/ModuleView-9WusmWUF.css","assets/el-tag-DSC_hZSj.css","assets/el-empty-DTsYGGEs.css","assets/PanelxList-DC_dL1VN.js","assets/el-tooltip-l0sNRNKZ.js","assets/tabs-DN15ZjeN.js","assets/ScanFillDialog-AluwVbET.js","assets/ScanFillDialog-D7mIrJLW.css","assets/el-popper-BPdxonGV.css","assets/el-table-column-CbdPRU0e.css","assets/el-select-fVTNT_wA.css","assets/el-pagination-DktLyhWz.css","assets/el-date-picker-C4yT3QGG.css","assets/el-radio-C0l32pTZ.css","assets/el-radio-button-IMQ3Aj3g.css","assets/el-input-number-CZu_mLr_.css","assets/el-switch-DMizI1kg.css","assets/el-alert-BFlwi0mD.css","assets/sumTotals-C3PClexH.js","assets/print-formats-CjwOqWEr.js","assets/StdLibManager-Dp-r8k7m.js","assets/StdLibManager-DL9TN8Rg.css","assets/RecordSheetPanels-qfyFO_4T.js","assets/RecordSheetPanels-DCGjJ1cr.css","assets/PanelxList-C9Ta9A2b.css","assets/el-popover-DbGmnC-F.css","assets/el-form-item-Dau2HL-v.css","assets/PanelxForm-B3SeYq9D.js","assets/el-dropdown-menu-l0sNRNKZ.js","assets/PanelxForm-CwmrAltt.css","assets/el-dropdown-item-3esVHua7.css","assets/index-eydt5dZb.js","assets/index-BV-I9hKP.css","assets/PortalLayout-DXuyHBkU.js","assets/app-CjWjAKXa.js","assets/PortalLayout-DYIt46QH.css","assets/el-collapse-item-CH0_V-sL.css","assets/index-Cm5Jq_bY.js","assets/index-C1fMcARu.css","assets/ManufactureBoard-BzH1F0RL.js","assets/ManufactureBoard-nNzTcRDQ.css","assets/el-col-DJ80IxjL.css","assets/el-card-CCCYoibH.css","assets/ReworkDesk-DaDuTq86.js","assets/ReworkDesk-DFRsFe7l.css","assets/SolutionCenter-B5fVG9hj.js","assets/SolutionCenter-BjE1pos8.css","assets/OrgAdmin-rjd-MrG6.js","assets/OrgAdmin-C2_yYEYA.css","assets/el-tree-select-Cvum6NqK.css","assets/UsageLog-D4FY2Gqh.js","assets/UsageLog-BrY3oOIa.css","assets/BusinessOverview-Vlky4YwB.js","assets/BusinessOverview-Bqv8TkPb.css","assets/MobileWarehouse-CJ03p8He.js","assets/MobileWarehouse-BH5Etg_Q.css","assets/SerialNumber-DrFkxicF.js","assets/SerialNumber-CfDgmtfu.css","assets/ShareFileCenter-BW9wNgmn.js","assets/ShareFileCenter-BbBM9Y87.css","assets/OrderConvert-DMjviLQz.js","assets/OrderConvert-DKSPZXFi.css","assets/ScheduleBoard-B5Sz9Fz8.js","assets/ScheduleBoard-DZSbwJGv.css","assets/WorkOrderBoard-t7LyIv2Z.js","assets/WorkOrderTraceDialog-Be9njRw6.js","assets/WorkOrderTraceDialog-B1_vBJ6B.css","assets/WorkOrderBoard-BWTKKVpB.css","assets/WorkOrderList-CX3kcbk-.js","assets/WorkOrderList-D1_l-uwz.css","assets/404-CdwJLEIH.js","assets/404-DBmvZ081.css"])))=>i.map(i=>d[i]);
import { au as effectScope, j as watch, y as isRef, p as ref, s as shallowRef, f as computed, d as defineComponent, g as getCurrentInstance, K as h, x as inject, q as onMounted, a5 as onUnmounted, F as onBeforeMount, a0 as createVNode, a4 as Text, J as Fragment, az as defineStore, aj as resolveComponent, o as openBlock, P as createBlock, W as withCtx, A as unref, aA as createRouter, aB as createWebHashHistory, aw as createApp, aC as createPinia } from './vue-vendor-DyX2BAKf.js';
import { e as en_default, E as ElConfigProvider, p as provideGlobalConfig, a as ElLoading } from './element-plus-W84rT0en.js';
import { Q as ElementPlusIconsVue } from './element-icons-DOEvq9OG.js';

true              &&(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
}());

//#region ../../packages/locale/lang/zh-cn.ts
var zh_cn_default = {
	name: "zh-cn",
	el: {
		breadcrumb: { label: "面包屑" },
		colorpicker: {
			confirm: "确定",
			clear: "清空",
			defaultLabel: "颜色选择器",
			description: "当前颜色 {color}，按 Enter 键选择新颜色",
			alphaLabel: "选择透明度的值",
			alphaDescription: "透明度 {alpha}, 当前颜色 {color}",
			hueLabel: "选择色相值",
			hueDescription: "色相 {hue}, 当前颜色 {color}",
			svLabel: "选择饱和度与明度的值",
			svDescription: "饱和度 {saturation}, 明度 {brightness}, 当前颜色 {color}",
			predefineDescription: "选择 {value} 作为颜色"
		},
		datepicker: {
			now: "此刻",
			today: "今天",
			cancel: "取消",
			clear: "清空",
			confirm: "确定",
			dateTablePrompt: "使用方向键与 Enter 键可选择日期",
			monthTablePrompt: "使用方向键与 Enter 键可选择月份",
			yearTablePrompt: "使用方向键与 Enter 键可选择年份",
			selectedDate: "已选日期",
			selectDate: "选择日期",
			selectTime: "选择时间",
			startDate: "开始日期",
			startTime: "开始时间",
			endDate: "结束日期",
			endTime: "结束时间",
			prevYear: "前一年",
			nextYear: "后一年",
			prevMonth: "上个月",
			nextMonth: "下个月",
			year: "年",
			month1: "1 月",
			month2: "2 月",
			month3: "3 月",
			month4: "4 月",
			month5: "5 月",
			month6: "6 月",
			month7: "7 月",
			month8: "8 月",
			month9: "9 月",
			month10: "10 月",
			month11: "11 月",
			month12: "12 月",
			weeks: {
				sun: "日",
				mon: "一",
				tue: "二",
				wed: "三",
				thu: "四",
				fri: "五",
				sat: "六"
			},
			weeksFull: {
				sun: "星期日",
				mon: "星期一",
				tue: "星期二",
				wed: "星期三",
				thu: "星期四",
				fri: "星期五",
				sat: "星期六"
			},
			months: {
				jan: "一月",
				feb: "二月",
				mar: "三月",
				apr: "四月",
				may: "五月",
				jun: "六月",
				jul: "七月",
				aug: "八月",
				sep: "九月",
				oct: "十月",
				nov: "十一月",
				dec: "十二月"
			}
		},
		inputNumber: {
			decrease: "减少数值",
			increase: "增加数值"
		},
		select: {
			loading: "加载中",
			noMatch: "无匹配数据",
			noData: "无数据",
			placeholder: "请选择"
		},
		mention: { loading: "加载中" },
		dropdown: { toggleDropdown: "切换下拉选项" },
		cascader: {
			noMatch: "无匹配数据",
			loading: "加载中",
			placeholder: "请选择",
			noData: "暂无数据"
		},
		pagination: {
			goto: "前往",
			pagesize: "条/页",
			total: "共 {total} 条",
			pageClassifier: "页",
			page: "页",
			prev: "上一页",
			next: "下一页",
			currentPage: "第 {pager} 页",
			prevPages: "向前 {pager} 页",
			nextPages: "向后 {pager} 页",
			deprecationWarning: "你使用了一些已被废弃的用法，请参考 el-pagination 的官方文档"
		},
		dialog: { close: "关闭此对话框" },
		drawer: { close: "关闭此对话框" },
		messagebox: {
			title: "提示",
			confirm: "确定",
			cancel: "取消",
			error: "输入的数据不合法!",
			close: "关闭此对话框"
		},
		upload: {
			deleteTip: "按 Delete 键可删除",
			delete: "删除",
			preview: "查看图片",
			continue: "继续上传"
		},
		slider: {
			defaultLabel: "滑块介于 {min} 至 {max}",
			defaultRangeStartLabel: "选择起始值",
			defaultRangeEndLabel: "选择结束值"
		},
		table: {
			emptyText: "暂无数据",
			confirmFilter: "筛选",
			resetFilter: "重置",
			clearFilter: "全部",
			sumText: "合计",
			selectAllLabel: "选择所有行",
			selectRowLabel: "选择当前行",
			expandRowLabel: "展开当前行",
			collapseRowLabel: "收起当前行",
			sortLabel: "按 {column} 排序",
			filterLabel: "按 {column} 过滤"
		},
		tag: { close: "关闭此标签" },
		tour: {
			next: "下一步",
			previous: "上一步",
			finish: "结束导览",
			close: "关闭此对话框"
		},
		tree: { emptyText: "暂无数据" },
		transfer: {
			noMatch: "无匹配数据",
			noData: "无数据",
			titles: ["列表 1", "列表 2"],
			filterPlaceholder: "请输入搜索内容",
			noCheckedFormat: "共 {total} 项",
			hasCheckedFormat: "已选 {checked}/{total} 项"
		},
		image: { error: "加载失败" },
		pageHeader: { title: "返回" },
		popconfirm: {
			confirmButtonText: "确定",
			cancelButtonText: "取消"
		},
		carousel: {
			leftArrow: "上一张幻灯片",
			rightArrow: "下一张幻灯片",
			indicator: "幻灯片切换至索引 {index}"
		},
		inputOTP: {
			groupLabel: "一次性密码输入框",
			defaultLabel: "请输入第 {index} 位 OTP 字符"
		}
	}
};

//#region ../../packages/locale/lang/zh-tw.ts
var zh_tw_default = {
	name: "zh-tw",
	el: {
		breadcrumb: { label: "面包屑" },
		colorpicker: {
			confirm: "確認",
			clear: "清空",
			defaultLabel: "色彩選擇器",
			description: "目前色彩為 {color}。按一下 Enter 以選擇新色彩。",
			alphaLabel: "選擇透明度的值",
			alphaDescription: "alpha {alpha}, current color is {color}",
			hueLabel: "pick hue value",
			hueDescription: "hue {hue}, current color is {color}",
			svLabel: "pick saturation and brightness value",
			svDescription: "saturation {saturation}, brightness {brightness}, current color is {color}",
			predefineDescription: "select {value} as the color"
		},
		datepicker: {
			now: "現在",
			today: "今天",
			cancel: "取消",
			clear: "清空",
			confirm: "確認",
			dateTablePrompt: "使用方向鍵與 Enter 鍵以選擇日期",
			monthTablePrompt: "使用方向鍵與 Enter 鍵以選擇月份",
			yearTablePrompt: "使用方向鍵與 Enter 鍵以選擇年份",
			selectedDate: "已選日期",
			selectDate: "選擇日期",
			selectTime: "選擇時間",
			startDate: "開始日期",
			startTime: "開始時間",
			endDate: "結束日期",
			endTime: "結束時間",
			prevYear: "前一年",
			nextYear: "後一年",
			prevMonth: "上個月",
			nextMonth: "下個月",
			year: "年",
			month1: "1 月",
			month2: "2 月",
			month3: "3 月",
			month4: "4 月",
			month5: "5 月",
			month6: "6 月",
			month7: "7 月",
			month8: "8 月",
			month9: "9 月",
			month10: "10 月",
			month11: "11 月",
			month12: "12 月",
			weeks: {
				sun: "日",
				mon: "一",
				tue: "二",
				wed: "三",
				thu: "四",
				fri: "五",
				sat: "六"
			},
			weeksFull: {
				sun: "星期日",
				mon: "星期一",
				tue: "星期二",
				wed: "星期三",
				thu: "星期四",
				fri: "星期五",
				sat: "星期六"
			},
			months: {
				jan: "一月",
				feb: "二月",
				mar: "三月",
				apr: "四月",
				may: "五月",
				jun: "六月",
				jul: "七月",
				aug: "八月",
				sep: "九月",
				oct: "十月",
				nov: "十一月",
				dec: "十二月"
			}
		},
		inputNumber: {
			decrease: "減少數值",
			increase: "增加數值"
		},
		select: {
			loading: "載入中",
			noMatch: "無相符資料",
			noData: "無資料",
			placeholder: "請選擇"
		},
		mention: { loading: "載入中" },
		dropdown: { toggleDropdown: "切換下拉選單" },
		cascader: {
			noMatch: "無相符資料",
			loading: "載入中",
			placeholder: "請選擇",
			noData: "無資料"
		},
		pagination: {
			goto: "前往",
			pagesize: "項/頁",
			total: "共 {total} 項",
			pageClassifier: "頁",
			page: "頁",
			prev: "上一頁",
			next: "下一頁",
			currentPage: "第 {pager} 頁",
			prevPages: "向前 {pager} 頁",
			nextPages: "向後 {pager} 頁",
			deprecationWarning: "偵測到已過時的使用方式，請參閱 el-pagination 說明文件以了解更多資訊"
		},
		dialog: { close: "關閉此對話框" },
		drawer: { close: "關閉此對話框" },
		messagebox: {
			title: "提示",
			confirm: "確定",
			cancel: "取消",
			error: "輸入的資料不符合規定!",
			close: "關閉此對話框"
		},
		upload: {
			deleteTip: "按 Delete 鍵以刪除",
			delete: "刪除",
			preview: "查看圖片",
			continue: "繼續上傳"
		},
		slider: {
			defaultLabel: "滑桿介於 {min} 至 {max}",
			defaultRangeStartLabel: "選擇起始值",
			defaultRangeEndLabel: "選擇結束值"
		},
		table: {
			emptyText: "暫無資料",
			confirmFilter: "篩選",
			resetFilter: "重置",
			clearFilter: "全部",
			sumText: "合計",
			selectAllLabel: "Select all rows",
			selectRowLabel: "Select this row",
			expandRowLabel: "Expand this row",
			collapseRowLabel: "Collapse this row",
			sortLabel: "Sort by {column}",
			filterLabel: "Filter by {column}"
		},
		tag: { close: "關閉此標籤" },
		tour: {
			next: "下一步",
			previous: "上一步",
			finish: "結束導覽",
			close: "關閉此對話框"
		},
		tree: { emptyText: "暫無資料" },
		transfer: {
			noMatch: "無相符資料",
			noData: "無資料",
			titles: ["列表 1", "列表 2"],
			filterPlaceholder: "請輸入搜尋內容",
			noCheckedFormat: "共 {total} 項",
			hasCheckedFormat: "已選 {checked}/{total} 項"
		},
		image: { error: "載入失敗" },
		pageHeader: { title: "返回" },
		popconfirm: {
			confirmButtonText: "確認",
			cancelButtonText: "取消"
		},
		carousel: {
			leftArrow: "上一張投影片",
			rightArrow: "下一張投影片",
			indicator: "投影片切換至索引 {index}"
		},
		inputOTP: {
			groupLabel: "一次性密碼輸入框",
			defaultLabel: "請輸入第 {index} 位 OTP 字元"
		}
	}
};

//#region ../../packages/locale/lang/ja.ts
var ja_default = {
	name: "ja",
	el: {
		breadcrumb: { label: "Breadcrumb" },
		colorpicker: {
			confirm: "OK",
			clear: "クリア",
			defaultLabel: "color picker",
			description: "current color is {color}. press enter to select a new color.",
			alphaLabel: "pick alpha value",
			alphaDescription: "alpha {alpha}, current color is {color}",
			hueLabel: "pick hue value",
			hueDescription: "hue {hue}, current color is {color}",
			svLabel: "pick saturation and brightness value",
			svDescription: "saturation {saturation}, brightness {brightness}, current color is {color}",
			predefineDescription: "select {value} as the color"
		},
		datepicker: {
			now: "現在",
			today: "今日",
			cancel: "キャンセル",
			clear: "クリア",
			confirm: "OK",
			dateTablePrompt: "Use the arrow keys and enter to select the day of the month",
			monthTablePrompt: "Use the arrow keys and enter to select the month",
			yearTablePrompt: "Use the arrow keys and enter to select the year",
			selectedDate: "Selected date",
			selectDate: "日付を選択",
			selectTime: "時間を選択",
			startDate: "開始日",
			startTime: "開始時間",
			endDate: "終了日",
			endTime: "終了時間",
			prevYear: "前年",
			nextYear: "翌年",
			prevMonth: "前月",
			nextMonth: "翌月",
			year: "年",
			month1: "1月",
			month2: "2月",
			month3: "3月",
			month4: "4月",
			month5: "5月",
			month6: "6月",
			month7: "7月",
			month8: "8月",
			month9: "9月",
			month10: "10月",
			month11: "11月",
			month12: "12月",
			weeks: {
				sun: "日",
				mon: "月",
				tue: "火",
				wed: "水",
				thu: "木",
				fri: "金",
				sat: "土"
			},
			weeksFull: {
				sun: "Sunday",
				mon: "Monday",
				tue: "Tuesday",
				wed: "Wednesday",
				thu: "Thursday",
				fri: "Friday",
				sat: "Saturday"
			},
			months: {
				jan: "1月",
				feb: "2月",
				mar: "3月",
				apr: "4月",
				may: "5月",
				jun: "6月",
				jul: "7月",
				aug: "8月",
				sep: "9月",
				oct: "10月",
				nov: "11月",
				dec: "12月"
			}
		},
		inputNumber: {
			decrease: "decrease number",
			increase: "increase number"
		},
		select: {
			loading: "ロード中",
			noMatch: "データなし",
			noData: "データなし",
			placeholder: "選択してください"
		},
		mention: { loading: "ロード中" },
		dropdown: { toggleDropdown: "Toggle Dropdown" },
		cascader: {
			noMatch: "データなし",
			loading: "ロード中",
			placeholder: "選択してください",
			noData: "データなし"
		},
		pagination: {
			goto: "",
			pagesize: "件/ページ",
			total: "総計 {total} 件",
			pageClassifier: "ページ目へ",
			page: "Page",
			prev: "Go to previous page",
			next: "Go to next page",
			currentPage: "page {pager}",
			prevPages: "Previous {pager} pages",
			nextPages: "Next {pager} pages",
			deprecationWarning: "Deprecated usages detected, please refer to the el-pagination documentation for more details"
		},
		dialog: { close: "Close this dialog" },
		drawer: { close: "Close this dialog" },
		messagebox: {
			title: "メッセージ",
			confirm: "OK",
			cancel: "キャンセル",
			error: "正しくない入力",
			close: "Close this dialog"
		},
		upload: {
			deleteTip: "Delキーを押して削除する",
			delete: "削除する",
			preview: "プレビュー",
			continue: "続行する"
		},
		slider: {
			defaultLabel: "slider between {min} and {max}",
			defaultRangeStartLabel: "pick start value",
			defaultRangeEndLabel: "pick end value"
		},
		table: {
			emptyText: "データなし",
			confirmFilter: "確認",
			resetFilter: "初期化",
			clearFilter: "すべて",
			sumText: "合計",
			selectAllLabel: "Select all rows",
			selectRowLabel: "Select this row",
			expandRowLabel: "Expand this row",
			collapseRowLabel: "Collapse this row",
			sortLabel: "Sort by {column}",
			filterLabel: "Filter by {column}"
		},
		tag: { close: "Close this tag" },
		tour: {
			next: "次へ",
			previous: "前へ",
			finish: "ツアー終了",
			close: "Close this dialog"
		},
		tree: { emptyText: "データなし" },
		transfer: {
			noMatch: "データなし",
			noData: "データなし",
			titles: ["リスト 1", "リスト 2"],
			filterPlaceholder: "キーワードを入力",
			noCheckedFormat: "総計 {total} 件",
			hasCheckedFormat: "{checked}/{total} を選択した"
		},
		image: { error: "失敗" },
		pageHeader: { title: "戻る" },
		popconfirm: {
			confirmButtonText: "はい",
			cancelButtonText: "いいえ"
		},
		carousel: {
			leftArrow: "Carousel arrow left",
			rightArrow: "Carousel arrow right",
			indicator: "Carousel switch to index {index}"
		},
		inputOTP: {
			groupLabel: "OTP Input",
			defaultLabel: "Please enter OTP character {index}"
		}
	}
};

//#region ../../packages/locale/lang/ko.ts
var ko_default = {
	name: "ko",
	el: {
		breadcrumb: { label: "Breadcrumb" },
		colorpicker: {
			confirm: "확인",
			clear: "초기화",
			defaultLabel: "색상 선택기",
			description: "현재 색상은 {color}입니다. Enter 키를 눌러 새 색상을 선택합니다.",
			alphaLabel: "pick alpha value",
			alphaDescription: "alpha {alpha}, current color is {color}",
			hueLabel: "pick hue value",
			hueDescription: "hue {hue}, current color is {color}",
			svLabel: "pick saturation and brightness value",
			svDescription: "saturation {saturation}, brightness {brightness}, current color is {color}",
			predefineDescription: "select {value} as the color"
		},
		datepicker: {
			now: "지금",
			today: "오늘",
			cancel: "취소",
			clear: "초기화",
			confirm: "확인",
			dateTablePrompt: "화살표 키를 사용하고 Enter를 눌러 날짜를 선택하십시오.",
			monthTablePrompt: "화살표 키를 사용하고 Enter를 눌러 월을 선택합니다.",
			yearTablePrompt: "화살표 키를 사용하고 Enter 키를 눌러 연도를 선택합니다.",
			selectedDate: "Selected date",
			selectDate: "날짜 선택",
			selectTime: "시간 선택",
			startDate: "시작 날짜",
			startTime: "시작 시간",
			endDate: "종료 날짜",
			endTime: "종료 시간",
			prevYear: "지난해",
			nextYear: "다음해",
			prevMonth: "지난달",
			nextMonth: "다음달",
			year: "년",
			month1: "1월",
			month2: "2월",
			month3: "3월",
			month4: "4월",
			month5: "5월",
			month6: "6월",
			month7: "7월",
			month8: "8월",
			month9: "9월",
			month10: "10월",
			month11: "11월",
			month12: "12월",
			weeks: {
				sun: "일",
				mon: "월",
				tue: "화",
				wed: "수",
				thu: "목",
				fri: "금",
				sat: "토"
			},
			weeksFull: {
				sun: "Sunday",
				mon: "Monday",
				tue: "Tuesday",
				wed: "Wednesday",
				thu: "Thursday",
				fri: "Friday",
				sat: "Saturday"
			},
			months: {
				jan: "1월",
				feb: "2월",
				mar: "3월",
				apr: "4월",
				may: "5월",
				jun: "6월",
				jul: "7월",
				aug: "8월",
				sep: "9월",
				oct: "10월",
				nov: "11월",
				dec: "12월"
			}
		},
		inputNumber: {
			decrease: "값 증가",
			increase: "값 감소"
		},
		select: {
			loading: "불러오는 중",
			noMatch: "검색된 데이터 없음",
			noData: "데이터 없음",
			placeholder: "선택"
		},
		mention: { loading: "불러오는 중" },
		dropdown: { toggleDropdown: "드롭다운 전환" },
		cascader: {
			noMatch: "검색된 데이터 없음",
			loading: "불러오는 중",
			placeholder: "선택",
			noData: "데이터 없음"
		},
		pagination: {
			goto: "이동",
			pagesize: "건/페이지",
			total: "총 {total} 건",
			pageClassifier: "페이지로",
			page: "페이지",
			prev: "이전 페이지로 이동",
			next: "다음 페이지로 이동",
			currentPage: "페이지 {pager}",
			prevPages: "이전 {pager} 페이지",
			nextPages: "다음 {pager} 페이지",
			deprecationWarning: "더 이상 사용되지 않는 동작이 감지되었습니다. 자세한 내용은 el-pagination 문서를 참조하세요."
		},
		dialog: { close: "대화 상자 닫기" },
		drawer: { close: "대화 상자 닫기" },
		messagebox: {
			title: "메시지",
			confirm: "확인",
			cancel: "취소",
			error: "올바르지 않은 입력",
			close: "대화 상자 닫기"
		},
		upload: {
			deleteTip: "Delete 키를 눌러 삭제",
			delete: "삭제",
			preview: "미리보기",
			continue: "계속하기"
		},
		slider: {
			defaultLabel: "{min}과 {max} 사이의 슬라이더",
			defaultRangeStartLabel: "시작 값 선택",
			defaultRangeEndLabel: "종료 값 선택"
		},
		table: {
			emptyText: "데이터 없음",
			confirmFilter: "확인",
			resetFilter: "초기화",
			clearFilter: "전체",
			sumText: "합계",
			selectAllLabel: "Select all rows",
			selectRowLabel: "Select this row",
			expandRowLabel: "Expand this row",
			collapseRowLabel: "Collapse this row",
			sortLabel: "Sort by {column}",
			filterLabel: "Filter by {column}"
		},
		tag: { close: "Close this tag" },
		tour: {
			next: "다음",
			previous: "이전",
			finish: "종료",
			close: "Close this dialog"
		},
		tree: { emptyText: "데이터 없음" },
		transfer: {
			noMatch: "검색된 데이터 없음",
			noData: "데이터 없음",
			titles: ["리스트 1", "리스트 2"],
			filterPlaceholder: "검색어를 입력하세요",
			noCheckedFormat: "총 {total} 건",
			hasCheckedFormat: "{checked}/{total} 선택됨"
		},
		image: { error: "불러오기 실패" },
		pageHeader: { title: "뒤로" },
		popconfirm: {
			confirmButtonText: "예",
			cancelButtonText: "아니오"
		},
		carousel: {
			leftArrow: "Carousel arrow left",
			rightArrow: "Carousel arrow right",
			indicator: "Carousel switch to index {index}"
		},
		inputOTP: {
			groupLabel: "OTP Input",
			defaultLabel: "Please enter OTP character {index}"
		}
	}
};

//#region ../../packages/locale/lang/es.ts
var es_default = {
	name: "es",
	el: {
		breadcrumb: { label: "Breadcrumb" },
		colorpicker: {
			confirm: "Confirmar",
			clear: "Despejar",
			defaultLabel: "color picker",
			description: "current color is {color}. press enter to select a new color.",
			alphaLabel: "pick alpha value",
			alphaDescription: "alpha {alpha}, current color is {color}",
			hueLabel: "pick hue value",
			hueDescription: "hue {hue}, current color is {color}",
			svLabel: "pick saturation and brightness value",
			svDescription: "saturation {saturation}, brightness {brightness}, current color is {color}",
			predefineDescription: "select {value} as the color"
		},
		datepicker: {
			now: "Ahora",
			today: "Hoy",
			cancel: "Cancelar",
			clear: "Despejar",
			confirm: "Confirmar",
			dateTablePrompt: "Use the arrow keys and enter to select the day of the month",
			monthTablePrompt: "Use the arrow keys and enter to select the month",
			yearTablePrompt: "Use the arrow keys and enter to select the year",
			selectedDate: "Selected date",
			selectDate: "Seleccionar fecha",
			selectTime: "Seleccionar hora",
			startDate: "Fecha Incial",
			startTime: "Hora Inicial",
			endDate: "Fecha Final",
			endTime: "Hora Final",
			prevYear: "Año Anterior",
			nextYear: "Próximo Año",
			prevMonth: "Mes Anterior",
			nextMonth: "Próximo Mes",
			year: "",
			month1: "enero",
			month2: "febrero",
			month3: "marzo",
			month4: "abril",
			month5: "mayo",
			month6: "junio",
			month7: "julio",
			month8: "agosto",
			month9: "septiembre",
			month10: "octubre",
			month11: "noviembre",
			month12: "diciembre",
			weeks: {
				sun: "dom",
				mon: "lun",
				tue: "mar",
				wed: "mié",
				thu: "jue",
				fri: "vie",
				sat: "sáb"
			},
			weeksFull: {
				sun: "Sunday",
				mon: "Monday",
				tue: "Tuesday",
				wed: "Wednesday",
				thu: "Thursday",
				fri: "Friday",
				sat: "Saturday"
			},
			months: {
				jan: "ene",
				feb: "feb",
				mar: "mar",
				apr: "abr",
				may: "may",
				jun: "jun",
				jul: "jul",
				aug: "ago",
				sep: "sep",
				oct: "oct",
				nov: "nov",
				dec: "dic"
			}
		},
		inputNumber: {
			decrease: "decrease number",
			increase: "increase number"
		},
		select: {
			loading: "Cargando",
			noMatch: "No hay datos que coincidan",
			noData: "Sin datos",
			placeholder: "Seleccionar"
		},
		mention: { loading: "Cargando" },
		dropdown: { toggleDropdown: "Toggle Dropdown" },
		cascader: {
			noMatch: "No hay datos que coincidan",
			loading: "Cargando",
			placeholder: "Seleccionar",
			noData: "Sin datos"
		},
		pagination: {
			goto: "Ir a",
			pagesize: "/página",
			total: "Total {total}",
			pageClassifier: "",
			page: "Page",
			prev: "Go to previous page",
			next: "Go to next page",
			currentPage: "page {pager}",
			prevPages: "Previous {pager} pages",
			nextPages: "Next {pager} pages",
			deprecationWarning: "Deprecated usages detected, please refer to the el-pagination documentation for more details"
		},
		dialog: { close: "Close this dialog" },
		drawer: { close: "Close this dialog" },
		messagebox: {
			title: "Message",
			confirm: "Aceptar",
			cancel: "Cancelar",
			error: "Entrada inválida",
			close: "Close this dialog"
		},
		upload: {
			deleteTip: "Pulse Eliminar para retirar",
			delete: "Eliminar",
			preview: "Vista Previa",
			continue: "Continuar"
		},
		slider: {
			defaultLabel: "slider between {min} and {max}",
			defaultRangeStartLabel: "pick start value",
			defaultRangeEndLabel: "pick end value"
		},
		table: {
			emptyText: "Sin Datos",
			confirmFilter: "Confirmar",
			resetFilter: "Reiniciar",
			clearFilter: "Despejar",
			sumText: "Suma",
			selectAllLabel: "Select all rows",
			selectRowLabel: "Select this row",
			expandRowLabel: "Expand this row",
			collapseRowLabel: "Collapse this row",
			sortLabel: "Sort by {column}",
			filterLabel: "Filter by {column}"
		},
		tag: { close: "Close this tag" },
		tour: {
			next: "Next",
			previous: "Previous",
			finish: "Finish",
			close: "Close this dialog"
		},
		tree: { emptyText: "Sin Datos" },
		transfer: {
			noMatch: "No hay datos que coincidan",
			noData: "Sin datos",
			titles: ["Lista 1", "Lista 2"],
			filterPlaceholder: "Ingresar palabra clave",
			noCheckedFormat: "{total} artículos",
			hasCheckedFormat: "{checked}/{total} revisados"
		},
		image: { error: "HA FALLADO" },
		pageHeader: { title: "Volver" },
		popconfirm: {
			confirmButtonText: "Si",
			cancelButtonText: "No"
		},
		carousel: {
			leftArrow: "Carousel arrow left",
			rightArrow: "Carousel arrow right",
			indicator: "Carousel switch to index {index}"
		},
		inputOTP: {
			groupLabel: "OTP Input",
			defaultLabel: "Please enter OTP character {index}"
		}
	}
};

//#region ../../packages/locale/lang/fr.ts
var fr_default = {
	name: "fr",
	el: {
		breadcrumb: { label: "Fil d'Ariane" },
		colorpicker: {
			confirm: "Confirmer",
			clear: "Effacer",
			defaultLabel: "Sélecteur de couleurs",
			description: "La couleur actuelle est {color}. Appuyer sur Entrée pour sélectionner une nouvelle couleur.",
			alphaLabel: "Choisir la valeur alpha",
			alphaDescription: "alpha {alpha}, couleur actuelle  {color}",
			hueLabel: "Choisir la veleur hue",
			hueDescription: "hue {hue}, couleur actuelle {color}",
			svLabel: "Choisir la valeur de saturation et de luminosité",
			svDescription: "saturation {saturation}, luminosité {brightness}, couleur actuelle {color}",
			predefineDescription: "Choisir {value} comme couleur actuelle"
		},
		datepicker: {
			now: "Maintenant",
			today: "Auj.",
			cancel: "Annuler",
			clear: "Effacer",
			confirm: "Confirmer",
			dateTablePrompt: "Utiliser les touches fléchées et appuyer sur Entrée pour sélectionner le jour du mois",
			monthTablePrompt: "Utiliser les touches fléchées et appuyer sur Entrée pour sélectionner le mois",
			yearTablePrompt: "Utiliser les touches fléchées et appuyer sur Entrée pour sélectionner l'année",
			selectedDate: "Date sélectionnée",
			selectDate: "Choisir date",
			selectTime: "Choisir horaire",
			startDate: "Date début",
			startTime: "Horaire début",
			endDate: "Date fin",
			endTime: "Horaire fin",
			prevYear: "Année précédente",
			nextYear: "Année suivante",
			prevMonth: "Mois précédent",
			nextMonth: "Mois suivant",
			year: "",
			month1: "Janvier",
			month2: "Février",
			month3: "Mars",
			month4: "Avril",
			month5: "Mai",
			month6: "Juin",
			month7: "Juillet",
			month8: "Août",
			month9: "Septembre",
			month10: "Octobre",
			month11: "Novembre",
			month12: "Décembre",
			weeks: {
				sun: "Dim",
				mon: "Lun",
				tue: "Mar",
				wed: "Mer",
				thu: "Jeu",
				fri: "Ven",
				sat: "Sam"
			},
			weeksFull: {
				sun: "Dimanche",
				mon: "Lundi",
				tue: "Mardi",
				wed: "Mercredi",
				thu: "Jeudi",
				fri: "Vendredi",
				sat: "Samedi"
			},
			months: {
				jan: "Jan",
				feb: "Fév",
				mar: "Mar",
				apr: "Avr",
				may: "Mai",
				jun: "Jun",
				jul: "Jul",
				aug: "Aoû",
				sep: "Sep",
				oct: "Oct",
				nov: "Nov",
				dec: "Déc"
			}
		},
		inputNumber: {
			decrease: "Décrémenter",
			increase: "Incrémenter"
		},
		select: {
			loading: "Chargement",
			noMatch: "Aucune correspondance",
			noData: "Aucune donnée",
			placeholder: "Choisir"
		},
		mention: { loading: "Chargement" },
		dropdown: { toggleDropdown: "Basculer la liste déroulante" },
		cascader: {
			noMatch: "Aucune correspondance",
			loading: "Chargement",
			placeholder: "Choisir",
			noData: "Aucune donnée"
		},
		pagination: {
			goto: "Aller à",
			pagesize: "/page",
			total: "Total {total}",
			pageClassifier: "",
			page: "Page",
			prev: "Aller à la page précédente",
			next: "Aller à la page suivante",
			currentPage: "page {pager}",
			prevPages: "{pager} pages précédentes",
			nextPages: "{pager} pages suivantes",
			deprecationWarning: "Utilisations obsolètes détectées, veuillez vous référer à la documentation el-pagination pour plus de détails"
		},
		dialog: { close: "Fermer la boîte de dialogue" },
		drawer: { close: "Fermer la boîte de dialogue" },
		messagebox: {
			title: "Message",
			confirm: "Confirmer",
			cancel: "Annuler",
			error: "Erreur",
			close: "Fermer la boîte de dialogue"
		},
		upload: {
			deleteTip: "Cliquer sur supprimer pour retirer le fichier",
			delete: "Supprimer",
			preview: "Aperçu",
			continue: "Continuer"
		},
		slider: {
			defaultLabel: "curseur entre {min} et {max}",
			defaultRangeStartLabel: "choisir la valeur de départ",
			defaultRangeEndLabel: "sélectionner la valeur finale"
		},
		table: {
			emptyText: "Aucune donnée",
			confirmFilter: "Confirmer",
			resetFilter: "Réinitialiser",
			clearFilter: "Tous",
			sumText: "Somme",
			selectAllLabel: "Select all rows",
			selectRowLabel: "Select this row",
			expandRowLabel: "Expand this row",
			collapseRowLabel: "Collapse this row",
			sortLabel: "Sort by {column}",
			filterLabel: "Filter by {column}"
		},
		tag: { close: "Fermer le tag" },
		tour: {
			next: "Suivant",
			previous: "Précédent",
			finish: "Fin",
			close: "Fermer la boîte de dialogue"
		},
		tree: { emptyText: "Aucune donnée" },
		transfer: {
			noMatch: "Aucune correspondance",
			noData: "Aucune donnée",
			titles: ["Liste 1", "Liste 2"],
			filterPlaceholder: "Entrer un mot clef",
			noCheckedFormat: "{total} elements",
			hasCheckedFormat: "{checked}/{total} coché(s)"
		},
		image: { error: "Echec" },
		pageHeader: { title: "Retour" },
		popconfirm: {
			confirmButtonText: "Oui",
			cancelButtonText: "Non"
		},
		carousel: {
			leftArrow: "Flèche du carrousel vers la gauche",
			rightArrow: "Flèche du carrousel vers la droite",
			indicator: "Passer au carrousel index {index}"
		},
		inputOTP: {
			groupLabel: "OTP Input",
			defaultLabel: "Please enter OTP character {index}"
		}
	}
};

//#region ../../packages/locale/lang/de.ts
var de_default = {
	name: "de",
	el: {
		breadcrumb: { label: "Brotkrümel" },
		colorpicker: {
			confirm: "OK",
			clear: "Leeren",
			defaultLabel: "color picker",
			description: "current color is {color}. press enter to select a new color.",
			alphaLabel: "pick alpha value",
			alphaDescription: "alpha {alpha}, current color is {color}",
			hueLabel: "pick hue value",
			hueDescription: "hue {hue}, current color is {color}",
			svLabel: "pick saturation and brightness value",
			svDescription: "saturation {saturation}, brightness {brightness}, current color is {color}",
			predefineDescription: "select {value} as the color"
		},
		datepicker: {
			now: "Jetzt",
			today: "Heute",
			cancel: "Abbrechen",
			clear: "Leeren",
			confirm: "OK",
			dateTablePrompt: "Use the arrow keys and enter to select the day of the month",
			monthTablePrompt: "Use the arrow keys and enter to select the month",
			yearTablePrompt: "Use the arrow keys and enter to select the year",
			selectedDate: "Selected date",
			selectDate: "Datum wählen",
			selectTime: "Uhrzeit wählen",
			startDate: "Startdatum",
			startTime: "Startzeit",
			endDate: "Enddatum",
			endTime: "Endzeit",
			prevYear: "Letztes Jahr",
			nextYear: "Nächtes Jahr",
			prevMonth: "Letzter Monat",
			nextMonth: "Nächster Monat",
			year: "",
			month1: "Januar",
			month2: "Februar",
			month3: "März",
			month4: "April",
			month5: "Mai",
			month6: "Juni",
			month7: "Juli",
			month8: "August",
			month9: "September",
			month10: "Oktober",
			month11: "November",
			month12: "Dezember",
			weeks: {
				sun: "So",
				mon: "Mo",
				tue: "Di",
				wed: "Mi",
				thu: "Do",
				fri: "Fr",
				sat: "Sa"
			},
			weeksFull: {
				sun: "Sunday",
				mon: "Monday",
				tue: "Tuesday",
				wed: "Wednesday",
				thu: "Thursday",
				fri: "Friday",
				sat: "Saturday"
			},
			months: {
				jan: "Jan",
				feb: "Feb",
				mar: "Mär",
				apr: "Apr",
				may: "Mai",
				jun: "Jun",
				jul: "Jul",
				aug: "Aug",
				sep: "Sep",
				oct: "Okt",
				nov: "Nov",
				dec: "Dez"
			},
			day: "Tag",
			month: "Monat"
		},
		inputNumber: {
			decrease: "decrease number",
			increase: "increase number"
		},
		select: {
			loading: "Lädt.",
			noMatch: "Nichts gefunden.",
			noData: "Keine Daten",
			placeholder: "Daten wählen"
		},
		mention: { loading: "Lädt." },
		dropdown: { toggleDropdown: "Toggle Dropdown" },
		cascader: {
			noMatch: "Nichts gefunden.",
			loading: "Lädt.",
			placeholder: "Daten wählen",
			noData: "Keine Daten"
		},
		pagination: {
			goto: "Gehe zu",
			pagesize: " pro Seite",
			total: "Gesamt {total}",
			pageClassifier: "",
			page: "Seite",
			prev: "Zur vorherigen Seite gehen",
			next: "Zur nächsten Seite gehen",
			currentPage: "Seite {pager}",
			prevPages: "Vorherige {pager} Seiten",
			nextPages: "Nächste {pager} Seiten",
			deprecationWarning: "Deprecated usages detected, please refer to the el-pagination documentation for more details"
		},
		dialog: { close: "Close this dialog" },
		drawer: { close: "Close this dialog" },
		messagebox: {
			title: "Message",
			confirm: "OK",
			cancel: "Abbrechen",
			error: "Fehler",
			close: "Close this dialog"
		},
		upload: {
			deleteTip: "Klicke löschen zum entfernen",
			delete: "Löschen",
			preview: "Vorschau",
			continue: "Fortsetzen"
		},
		slider: {
			defaultLabel: "slider between {min} and {max}",
			defaultRangeStartLabel: "pick start value",
			defaultRangeEndLabel: "pick end value"
		},
		table: {
			emptyText: "Keine Daten",
			confirmFilter: "Anwenden",
			resetFilter: "Zurücksetzen",
			clearFilter: "Alles ",
			sumText: "Summe",
			selectAllLabel: "Select all rows",
			selectRowLabel: "Select this row",
			expandRowLabel: "Expand this row",
			collapseRowLabel: "Collapse this row",
			sortLabel: "Sort by {column}",
			filterLabel: "Filter by {column}"
		},
		tag: { close: "Close this tag" },
		tour: {
			next: "Weiter",
			previous: "Zurück",
			finish: "Fertig",
			close: "Close this dialog"
		},
		tree: { emptyText: "Keine Einträge" },
		transfer: {
			noMatch: "Nichts gefunden.",
			noData: "Keine Einträge",
			titles: ["Liste 1", "Liste 2"],
			filterPlaceholder: "Einträge filtern",
			noCheckedFormat: "{total} Einträge",
			hasCheckedFormat: "{checked}/{total} ausgewählt"
		},
		image: { error: "FEHLGESCHLAGEN" },
		pageHeader: { title: "Zurück" },
		popconfirm: {
			confirmButtonText: "Ja",
			cancelButtonText: "Nein"
		},
		carousel: {
			leftArrow: "Karussell-Pfeil links",
			rightArrow: "Karussell-Pfeil rechts",
			indicator: "Karussell zu Index {index} wechseln"
		},
		inputOTP: {
			groupLabel: "OTP Input",
			defaultLabel: "Please enter OTP character {index}"
		}
	}
};

//#region ../../packages/locale/lang/ru.ts
var ru_default = {
	name: "ru",
	el: {
		breadcrumb: { label: "Хлебные крошки" },
		colorpicker: {
			confirm: "Ок",
			clear: "Очистить",
			defaultLabel: "color picker",
			description: "current color is {color}. press enter to select a new color.",
			alphaLabel: "pick alpha value",
			alphaDescription: "alpha {alpha}, current color is {color}",
			hueLabel: "pick hue value",
			hueDescription: "hue {hue}, current color is {color}",
			svLabel: "pick saturation and brightness value",
			svDescription: "saturation {saturation}, brightness {brightness}, current color is {color}",
			predefineDescription: "select {value} as the color"
		},
		datepicker: {
			now: "Сейчас",
			today: "Сегодня",
			cancel: "Отмена",
			clear: "Очистить",
			confirm: "Ок",
			dateTablePrompt: "Use the arrow keys and enter to select the day of the month",
			monthTablePrompt: "Use the arrow keys and enter to select the month",
			yearTablePrompt: "Use the arrow keys and enter to select the year",
			selectedDate: "Selected date",
			selectDate: "Выбрать дату",
			selectTime: "Выбрать время",
			startDate: "Дата начала",
			startTime: "Время начала",
			endDate: "Дата окончания",
			endTime: "Время окончания",
			prevYear: "Предыдущий год",
			nextYear: "Следующий год",
			prevMonth: "Предыдущий месяц",
			nextMonth: "Следующий месяц",
			year: "",
			month1: "Январь",
			month2: "Февраль",
			month3: "Март",
			month4: "Апрель",
			month5: "Май",
			month6: "Июнь",
			month7: "Июль",
			month8: "Август",
			month9: "Сентябрь",
			month10: "Октябрь",
			month11: "Ноябрь",
			month12: "Декабрь",
			weeks: {
				sun: "Вс",
				mon: "Пн",
				tue: "Вт",
				wed: "Ср",
				thu: "Чт",
				fri: "Пт",
				sat: "Сб"
			},
			weeksFull: {
				sun: "Sunday",
				mon: "Monday",
				tue: "Tuesday",
				wed: "Wednesday",
				thu: "Thursday",
				fri: "Friday",
				sat: "Saturday"
			},
			months: {
				jan: "Янв",
				feb: "Фев",
				mar: "Мар",
				apr: "Апр",
				may: "Май",
				jun: "Июн",
				jul: "Июл",
				aug: "Авг",
				sep: "Сен",
				oct: "Окт",
				nov: "Ноя",
				dec: "Дек"
			}
		},
		inputNumber: {
			decrease: "decrease number",
			increase: "increase number"
		},
		select: {
			loading: "Загрузка",
			noMatch: "Совпадений не найдено",
			noData: "Нет данных",
			placeholder: "Выбрать"
		},
		mention: { loading: "Загрузка" },
		dropdown: { toggleDropdown: "Toggle Dropdown" },
		cascader: {
			noMatch: "Совпадений не найдено",
			loading: "Загрузка",
			placeholder: "Выбрать",
			noData: "Нет данных"
		},
		pagination: {
			goto: "Перейти",
			pagesize: " на странице",
			total: "Всего {total}",
			pageClassifier: "",
			page: "Страница",
			prev: "Перейти на предыдущую страницу",
			next: "Перейти на следующую страницу",
			currentPage: "страница {pager}",
			prevPages: "Предыдущие {pager} страниц",
			nextPages: "Следующие {pager} страниц",
			deprecationWarning: "Deprecated usages detected, please refer to the el-pagination documentation for more details"
		},
		dialog: { close: "Close this dialog" },
		drawer: { close: "Close this dialog" },
		messagebox: {
			title: "Сообщение",
			confirm: "Ок",
			cancel: "Отмена",
			error: "Недопустимый ввод данных",
			close: "Close this dialog"
		},
		upload: {
			deleteTip: "Нажмите [Удалить] для удаления",
			delete: "Удалить",
			preview: "Превью",
			continue: "Продолжить"
		},
		slider: {
			defaultLabel: "slider between {min} and {max}",
			defaultRangeStartLabel: "pick start value",
			defaultRangeEndLabel: "pick end value"
		},
		table: {
			emptyText: "Нет данных",
			confirmFilter: "Ок",
			resetFilter: "Сбросить",
			clearFilter: "Все",
			sumText: "Сумма",
			selectAllLabel: "Select all rows",
			selectRowLabel: "Select this row",
			expandRowLabel: "Expand this row",
			collapseRowLabel: "Collapse this row",
			sortLabel: "Sort by {column}",
			filterLabel: "Filter by {column}"
		},
		tag: { close: "Close this tag" },
		tour: {
			next: "Далее",
			previous: "Назад",
			finish: "Завершить",
			close: "Close this dialog"
		},
		tree: { emptyText: "Нет данных" },
		transfer: {
			noMatch: "Совпадений не найдено",
			noData: "Нет данных",
			titles: ["Список 1", "Список 2"],
			filterPlaceholder: "Введите ключевое слово",
			noCheckedFormat: "{total} пунктов",
			hasCheckedFormat: "{checked}/{total} выбрано"
		},
		image: { error: "ОШИБКА" },
		pageHeader: { title: "Назад" },
		popconfirm: {
			confirmButtonText: "Ок",
			cancelButtonText: "Отмена"
		},
		carousel: {
			leftArrow: "Слайдер стрелка влево",
			rightArrow: "Слайдер стрелка вправо",
			indicator: "Слайдер перейти на страницу под номером {index}"
		},
		inputOTP: {
			groupLabel: "OTP Input",
			defaultLabel: "Please enter OTP character {index}"
		}
	}
};

const scriptRel = 'modulepreload';const assetsURL = function(dep) { return "/"+dep };const seen = {};const __vitePreload = function preload(baseModule, deps, importerUrl) {
  let promise = Promise.resolve();
  if (true               && deps && deps.length > 0) {
    let allSettled2 = function(promises) {
      return Promise.all(
        promises.map(
          (p) => Promise.resolve(p).then(
            (value) => ({ status: "fulfilled", value }),
            (reason) => ({ status: "rejected", reason })
          )
        )
      );
    };
    document.getElementsByTagName("link");
    const cspNonceMeta = document.querySelector(
      "meta[property=csp-nonce]"
    );
    const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
    promise = allSettled2(
      deps.map((dep) => {
        dep = assetsURL(dep);
        if (dep in seen) return;
        seen[dep] = true;
        const isCss = dep.endsWith(".css");
        const cssSelector = isCss ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
          return;
        }
        const link = document.createElement("link");
        link.rel = isCss ? "stylesheet" : scriptRel;
        if (!isCss) {
          link.as = "script";
        }
        link.crossOrigin = "";
        link.href = dep;
        if (cspNonce) {
          link.setAttribute("nonce", cspNonce);
        }
        document.head.appendChild(link);
        if (isCss) {
          return new Promise((res, rej) => {
            link.addEventListener("load", res);
            link.addEventListener(
              "error",
              () => rej(new Error(`Unable to preload CSS for ${dep}`))
            );
          });
        }
      })
    );
  }
  function handlePreloadError(err) {
    const e = new Event("vite:preloadError", {
      cancelable: true
    });
    e.payload = err;
    window.dispatchEvent(e);
    if (!e.defaultPrevented) {
      throw err;
    }
  }
  return promise.then((res) => {
    for (const item of res || []) {
      if (item.status !== "rejected") continue;
      handlePreloadError(item.reason);
    }
    return baseModule().catch(handlePreloadError);
  });
};

/*!
  * shared v9.14.4
  * (c) 2025 kazuya kawaguchi
  * Released under the MIT License.
  */
const inBrowser = typeof window !== "undefined";
const makeSymbol = (name, shareable = false) => !shareable ? Symbol(name) : Symbol.for(name);
const generateFormatCacheKey = (locale, key, source) => friendlyJSONstringify({ l: locale, k: key, s: source });
const friendlyJSONstringify = (json) => JSON.stringify(json).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029").replace(/\u0027/g, "\\u0027");
const isNumber$1 = (val) => typeof val === "number" && isFinite(val);
const isDate$1 = (val) => toTypeString(val) === "[object Date]";
const isRegExp$1 = (val) => toTypeString(val) === "[object RegExp]";
const isEmptyObject$1 = (val) => isPlainObject$1(val) && Object.keys(val).length === 0;
const assign$1 = Object.assign;
const _create = Object.create;
const create$1 = (obj = null) => _create(obj);
let _globalThis;
const getGlobalThis = () => {
  return _globalThis || (_globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : create$1());
};
function escapeHtml(rawText) {
  return rawText.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
const hasOwnProperty$1 = Object.prototype.hasOwnProperty;
function hasOwn(obj, key) {
  return hasOwnProperty$1.call(obj, key);
}
const isArray$1 = Array.isArray;
const isFunction$2 = (val) => typeof val === "function";
const isString$2 = (val) => typeof val === "string";
const isBoolean$1 = (val) => typeof val === "boolean";
const isObject$2 = (val) => val !== null && typeof val === "object";
const isPromise = (val) => {
  return isObject$2(val) && isFunction$2(val.then) && isFunction$2(val.catch);
};
const objectToString = Object.prototype.toString;
const toTypeString = (value) => objectToString.call(value);
const isPlainObject$1 = (val) => {
  if (!isObject$2(val))
    return false;
  const proto = Object.getPrototypeOf(val);
  return proto === null || proto.constructor === Object;
};
const toDisplayString = (val) => {
  return val == null ? "" : isArray$1(val) || isPlainObject$1(val) && val.toString === objectToString ? JSON.stringify(val, null, 2) : String(val);
};
function join$1(items, separator = "") {
  return items.reduce((str, item, index) => index === 0 ? str + item : str + separator + item, "");
}
function incrementer(code) {
  let current = code;
  return () => ++current;
}
function warn(msg, err) {
  if (typeof console !== "undefined") {
    console.warn(`[intlify] ` + msg);
    if (err) {
      console.warn(err.stack);
    }
  }
}
const isNotObjectOrIsArray = (val) => !isObject$2(val) || isArray$1(val);
function deepCopy(src, des) {
  if (isNotObjectOrIsArray(src) || isNotObjectOrIsArray(des)) {
    throw new Error("Invalid value");
  }
  const stack = [{ src, des }];
  while (stack.length) {
    const { src: src2, des: des2 } = stack.pop();
    Object.keys(src2).forEach((key) => {
      if (key === "__proto__") {
        return;
      }
      if (isObject$2(src2[key]) && !isObject$2(des2[key])) {
        des2[key] = Array.isArray(src2[key]) ? [] : create$1();
      }
      if (isNotObjectOrIsArray(des2[key]) || isNotObjectOrIsArray(src2[key])) {
        des2[key] = src2[key];
      } else {
        stack.push({ src: src2[key], des: des2[key] });
      }
    });
  }
}

/*!
  * message-compiler v9.14.4
  * (c) 2025 kazuya kawaguchi
  * Released under the MIT License.
  */
function createPosition(line, column, offset) {
    return { line, column, offset };
}
function createLocation(start, end, source) {
    const loc = { start, end };
    return loc;
}

/**
 * Original Utilities
 * written by kazuya kawaguchi
 */
const RE_ARGS = /\{([0-9a-zA-Z]+)\}/g;
/* eslint-disable */
function format$1(message, ...args) {
    if (args.length === 1 && isObject$1(args[0])) {
        args = args[0];
    }
    if (!args || !args.hasOwnProperty) {
        args = {};
    }
    return message.replace(RE_ARGS, (match, identifier) => {
        return args.hasOwnProperty(identifier) ? args[identifier] : '';
    });
}
const assign = Object.assign;
const isString$1 = (val) => typeof val === 'string';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isObject$1 = (val) => val !== null && typeof val === 'object';
function join(items, separator = '') {
    return items.reduce((str, item, index) => (index === 0 ? str + item : str + separator + item), '');
}

const CompileWarnCodes = {
    USE_MODULO_SYNTAX: 1,
    __EXTEND_POINT__: 2
};
/** @internal */
const warnMessages = {
    [CompileWarnCodes.USE_MODULO_SYNTAX]: `Use modulo before '{{0}}'.`
};
function createCompileWarn(code, loc, ...args) {
    const msg = format$1(warnMessages[code], ...(args || [])) ;
    const message = { message: String(msg), code };
    if (loc) {
        message.location = loc;
    }
    return message;
}

const CompileErrorCodes = {
    // tokenizer error codes
    EXPECTED_TOKEN: 1,
    INVALID_TOKEN_IN_PLACEHOLDER: 2,
    UNTERMINATED_SINGLE_QUOTE_IN_PLACEHOLDER: 3,
    UNKNOWN_ESCAPE_SEQUENCE: 4,
    INVALID_UNICODE_ESCAPE_SEQUENCE: 5,
    UNBALANCED_CLOSING_BRACE: 6,
    UNTERMINATED_CLOSING_BRACE: 7,
    EMPTY_PLACEHOLDER: 8,
    NOT_ALLOW_NEST_PLACEHOLDER: 9,
    INVALID_LINKED_FORMAT: 10,
    // parser error codes
    MUST_HAVE_MESSAGES_IN_PLURAL: 11,
    UNEXPECTED_EMPTY_LINKED_MODIFIER: 12,
    UNEXPECTED_EMPTY_LINKED_KEY: 13,
    UNEXPECTED_LEXICAL_ANALYSIS: 14,
    // generator error codes
    UNHANDLED_CODEGEN_NODE_TYPE: 15,
    // minifier error codes
    UNHANDLED_MINIFIER_NODE_TYPE: 16,
    // Special value for higher-order compilers to pick up the last code
    // to avoid collision of error codes. This should always be kept as the last
    // item.
    __EXTEND_POINT__: 17
};
/** @internal */
const errorMessages = {
    // tokenizer error messages
    [CompileErrorCodes.EXPECTED_TOKEN]: `Expected token: '{0}'`,
    [CompileErrorCodes.INVALID_TOKEN_IN_PLACEHOLDER]: `Invalid token in placeholder: '{0}'`,
    [CompileErrorCodes.UNTERMINATED_SINGLE_QUOTE_IN_PLACEHOLDER]: `Unterminated single quote in placeholder`,
    [CompileErrorCodes.UNKNOWN_ESCAPE_SEQUENCE]: `Unknown escape sequence: \\{0}`,
    [CompileErrorCodes.INVALID_UNICODE_ESCAPE_SEQUENCE]: `Invalid unicode escape sequence: {0}`,
    [CompileErrorCodes.UNBALANCED_CLOSING_BRACE]: `Unbalanced closing brace`,
    [CompileErrorCodes.UNTERMINATED_CLOSING_BRACE]: `Unterminated closing brace`,
    [CompileErrorCodes.EMPTY_PLACEHOLDER]: `Empty placeholder`,
    [CompileErrorCodes.NOT_ALLOW_NEST_PLACEHOLDER]: `Not allowed nest placeholder`,
    [CompileErrorCodes.INVALID_LINKED_FORMAT]: `Invalid linked format`,
    // parser error messages
    [CompileErrorCodes.MUST_HAVE_MESSAGES_IN_PLURAL]: `Plural must have messages`,
    [CompileErrorCodes.UNEXPECTED_EMPTY_LINKED_MODIFIER]: `Unexpected empty linked modifier`,
    [CompileErrorCodes.UNEXPECTED_EMPTY_LINKED_KEY]: `Unexpected empty linked key`,
    [CompileErrorCodes.UNEXPECTED_LEXICAL_ANALYSIS]: `Unexpected lexical analysis in token: '{0}'`,
    // generator error messages
    [CompileErrorCodes.UNHANDLED_CODEGEN_NODE_TYPE]: `unhandled codegen node type: '{0}'`,
    // minimizer error messages
    [CompileErrorCodes.UNHANDLED_MINIFIER_NODE_TYPE]: `unhandled mimifier node type: '{0}'`
};
function createCompileError(code, loc, options = {}) {
    const { domain, messages, args } = options;
    const msg = format$1((messages || errorMessages)[code] || '', ...(args || []))
        ;
    const error = new SyntaxError(String(msg));
    error.code = code;
    if (loc) {
        error.location = loc;
    }
    error.domain = domain;
    return error;
}
/** @internal */
function defaultOnError(error) {
    throw error;
}

const CHAR_SP = ' ';
const CHAR_CR = '\r';
const CHAR_LF = '\n';
const CHAR_LS = String.fromCharCode(0x2028);
const CHAR_PS = String.fromCharCode(0x2029);
function createScanner(str) {
    const _buf = str;
    let _index = 0;
    let _line = 1;
    let _column = 1;
    let _peekOffset = 0;
    const isCRLF = (index) => _buf[index] === CHAR_CR && _buf[index + 1] === CHAR_LF;
    const isLF = (index) => _buf[index] === CHAR_LF;
    const isPS = (index) => _buf[index] === CHAR_PS;
    const isLS = (index) => _buf[index] === CHAR_LS;
    const isLineEnd = (index) => isCRLF(index) || isLF(index) || isPS(index) || isLS(index);
    const index = () => _index;
    const line = () => _line;
    const column = () => _column;
    const peekOffset = () => _peekOffset;
    const charAt = (offset) => isCRLF(offset) || isPS(offset) || isLS(offset) ? CHAR_LF : _buf[offset];
    const currentChar = () => charAt(_index);
    const currentPeek = () => charAt(_index + _peekOffset);
    function next() {
        _peekOffset = 0;
        if (isLineEnd(_index)) {
            _line++;
            _column = 0;
        }
        if (isCRLF(_index)) {
            _index++;
        }
        _index++;
        _column++;
        return _buf[_index];
    }
    function peek() {
        if (isCRLF(_index + _peekOffset)) {
            _peekOffset++;
        }
        _peekOffset++;
        return _buf[_index + _peekOffset];
    }
    function reset() {
        _index = 0;
        _line = 1;
        _column = 1;
        _peekOffset = 0;
    }
    function resetPeek(offset = 0) {
        _peekOffset = offset;
    }
    function skipToPeek() {
        const target = _index + _peekOffset;
        // eslint-disable-next-line no-unmodified-loop-condition
        while (target !== _index) {
            next();
        }
        _peekOffset = 0;
    }
    return {
        index,
        line,
        column,
        peekOffset,
        charAt,
        currentChar,
        currentPeek,
        next,
        peek,
        reset,
        resetPeek,
        skipToPeek
    };
}

const EOF = undefined;
const DOT = '.';
const LITERAL_DELIMITER = "'";
const ERROR_DOMAIN$3 = 'tokenizer';
function createTokenizer(source, options = {}) {
    const location = options.location !== false;
    const _scnr = createScanner(source);
    const currentOffset = () => _scnr.index();
    const currentPosition = () => createPosition(_scnr.line(), _scnr.column(), _scnr.index());
    const _initLoc = currentPosition();
    const _initOffset = currentOffset();
    const _context = {
        currentType: 14 /* TokenTypes.EOF */,
        offset: _initOffset,
        startLoc: _initLoc,
        endLoc: _initLoc,
        lastType: 14 /* TokenTypes.EOF */,
        lastOffset: _initOffset,
        lastStartLoc: _initLoc,
        lastEndLoc: _initLoc,
        braceNest: 0,
        inLinked: false,
        text: ''
    };
    const context = () => _context;
    const { onError } = options;
    function emitError(code, pos, offset, ...args) {
        const ctx = context();
        pos.column += offset;
        pos.offset += offset;
        if (onError) {
            const loc = location ? createLocation(ctx.startLoc, pos) : null;
            const err = createCompileError(code, loc, {
                domain: ERROR_DOMAIN$3,
                args
            });
            onError(err);
        }
    }
    function getToken(context, type, value) {
        context.endLoc = currentPosition();
        context.currentType = type;
        const token = { type };
        if (location) {
            token.loc = createLocation(context.startLoc, context.endLoc);
        }
        if (value != null) {
            token.value = value;
        }
        return token;
    }
    const getEndToken = (context) => getToken(context, 14 /* TokenTypes.EOF */);
    function eat(scnr, ch) {
        if (scnr.currentChar() === ch) {
            scnr.next();
            return ch;
        }
        else {
            emitError(CompileErrorCodes.EXPECTED_TOKEN, currentPosition(), 0, ch);
            return '';
        }
    }
    function peekSpaces(scnr) {
        let buf = '';
        while (scnr.currentPeek() === CHAR_SP || scnr.currentPeek() === CHAR_LF) {
            buf += scnr.currentPeek();
            scnr.peek();
        }
        return buf;
    }
    function skipSpaces(scnr) {
        const buf = peekSpaces(scnr);
        scnr.skipToPeek();
        return buf;
    }
    function isIdentifierStart(ch) {
        if (ch === EOF) {
            return false;
        }
        const cc = ch.charCodeAt(0);
        return ((cc >= 97 && cc <= 122) || // a-z
            (cc >= 65 && cc <= 90) || // A-Z
            cc === 95 // _
        );
    }
    function isNumberStart(ch) {
        if (ch === EOF) {
            return false;
        }
        const cc = ch.charCodeAt(0);
        return cc >= 48 && cc <= 57; // 0-9
    }
    function isNamedIdentifierStart(scnr, context) {
        const { currentType } = context;
        if (currentType !== 2 /* TokenTypes.BraceLeft */) {
            return false;
        }
        peekSpaces(scnr);
        const ret = isIdentifierStart(scnr.currentPeek());
        scnr.resetPeek();
        return ret;
    }
    function isListIdentifierStart(scnr, context) {
        const { currentType } = context;
        if (currentType !== 2 /* TokenTypes.BraceLeft */) {
            return false;
        }
        peekSpaces(scnr);
        const ch = scnr.currentPeek() === '-' ? scnr.peek() : scnr.currentPeek();
        const ret = isNumberStart(ch);
        scnr.resetPeek();
        return ret;
    }
    function isLiteralStart(scnr, context) {
        const { currentType } = context;
        if (currentType !== 2 /* TokenTypes.BraceLeft */) {
            return false;
        }
        peekSpaces(scnr);
        const ret = scnr.currentPeek() === LITERAL_DELIMITER;
        scnr.resetPeek();
        return ret;
    }
    function isLinkedDotStart(scnr, context) {
        const { currentType } = context;
        if (currentType !== 8 /* TokenTypes.LinkedAlias */) {
            return false;
        }
        peekSpaces(scnr);
        const ret = scnr.currentPeek() === "." /* TokenChars.LinkedDot */;
        scnr.resetPeek();
        return ret;
    }
    function isLinkedModifierStart(scnr, context) {
        const { currentType } = context;
        if (currentType !== 9 /* TokenTypes.LinkedDot */) {
            return false;
        }
        peekSpaces(scnr);
        const ret = isIdentifierStart(scnr.currentPeek());
        scnr.resetPeek();
        return ret;
    }
    function isLinkedDelimiterStart(scnr, context) {
        const { currentType } = context;
        if (!(currentType === 8 /* TokenTypes.LinkedAlias */ ||
            currentType === 12 /* TokenTypes.LinkedModifier */)) {
            return false;
        }
        peekSpaces(scnr);
        const ret = scnr.currentPeek() === ":" /* TokenChars.LinkedDelimiter */;
        scnr.resetPeek();
        return ret;
    }
    function isLinkedReferStart(scnr, context) {
        const { currentType } = context;
        if (currentType !== 10 /* TokenTypes.LinkedDelimiter */) {
            return false;
        }
        const fn = () => {
            const ch = scnr.currentPeek();
            if (ch === "{" /* TokenChars.BraceLeft */) {
                return isIdentifierStart(scnr.peek());
            }
            else if (ch === "@" /* TokenChars.LinkedAlias */ ||
                ch === "%" /* TokenChars.Modulo */ ||
                ch === "|" /* TokenChars.Pipe */ ||
                ch === ":" /* TokenChars.LinkedDelimiter */ ||
                ch === "." /* TokenChars.LinkedDot */ ||
                ch === CHAR_SP ||
                !ch) {
                return false;
            }
            else if (ch === CHAR_LF) {
                scnr.peek();
                return fn();
            }
            else {
                // other characters
                return isTextStart(scnr, false);
            }
        };
        const ret = fn();
        scnr.resetPeek();
        return ret;
    }
    function isPluralStart(scnr) {
        peekSpaces(scnr);
        const ret = scnr.currentPeek() === "|" /* TokenChars.Pipe */;
        scnr.resetPeek();
        return ret;
    }
    function detectModuloStart(scnr) {
        const spaces = peekSpaces(scnr);
        const ret = scnr.currentPeek() === "%" /* TokenChars.Modulo */ &&
            scnr.peek() === "{" /* TokenChars.BraceLeft */;
        scnr.resetPeek();
        return {
            isModulo: ret,
            hasSpace: spaces.length > 0
        };
    }
    function isTextStart(scnr, reset = true) {
        const fn = (hasSpace = false, prev = '', detectModulo = false) => {
            const ch = scnr.currentPeek();
            if (ch === "{" /* TokenChars.BraceLeft */) {
                return prev === "%" /* TokenChars.Modulo */ ? false : hasSpace;
            }
            else if (ch === "@" /* TokenChars.LinkedAlias */ || !ch) {
                return prev === "%" /* TokenChars.Modulo */ ? true : hasSpace;
            }
            else if (ch === "%" /* TokenChars.Modulo */) {
                scnr.peek();
                return fn(hasSpace, "%" /* TokenChars.Modulo */, true);
            }
            else if (ch === "|" /* TokenChars.Pipe */) {
                return prev === "%" /* TokenChars.Modulo */ || detectModulo
                    ? true
                    : !(prev === CHAR_SP || prev === CHAR_LF);
            }
            else if (ch === CHAR_SP) {
                scnr.peek();
                return fn(true, CHAR_SP, detectModulo);
            }
            else if (ch === CHAR_LF) {
                scnr.peek();
                return fn(true, CHAR_LF, detectModulo);
            }
            else {
                return true;
            }
        };
        const ret = fn();
        reset && scnr.resetPeek();
        return ret;
    }
    function takeChar(scnr, fn) {
        const ch = scnr.currentChar();
        if (ch === EOF) {
            return EOF;
        }
        if (fn(ch)) {
            scnr.next();
            return ch;
        }
        return null;
    }
    function isIdentifier(ch) {
        const cc = ch.charCodeAt(0);
        return ((cc >= 97 && cc <= 122) || // a-z
            (cc >= 65 && cc <= 90) || // A-Z
            (cc >= 48 && cc <= 57) || // 0-9
            cc === 95 || // _
            cc === 36 // $
        );
    }
    function takeIdentifierChar(scnr) {
        return takeChar(scnr, isIdentifier);
    }
    function isNamedIdentifier(ch) {
        const cc = ch.charCodeAt(0);
        return ((cc >= 97 && cc <= 122) || // a-z
            (cc >= 65 && cc <= 90) || // A-Z
            (cc >= 48 && cc <= 57) || // 0-9
            cc === 95 || // _
            cc === 36 || // $
            cc === 45 // -
        );
    }
    function takeNamedIdentifierChar(scnr) {
        return takeChar(scnr, isNamedIdentifier);
    }
    function isDigit(ch) {
        const cc = ch.charCodeAt(0);
        return cc >= 48 && cc <= 57; // 0-9
    }
    function takeDigit(scnr) {
        return takeChar(scnr, isDigit);
    }
    function isHexDigit(ch) {
        const cc = ch.charCodeAt(0);
        return ((cc >= 48 && cc <= 57) || // 0-9
            (cc >= 65 && cc <= 70) || // A-F
            (cc >= 97 && cc <= 102)); // a-f
    }
    function takeHexDigit(scnr) {
        return takeChar(scnr, isHexDigit);
    }
    function getDigits(scnr) {
        let ch = '';
        let num = '';
        while ((ch = takeDigit(scnr))) {
            num += ch;
        }
        return num;
    }
    function readModulo(scnr) {
        skipSpaces(scnr);
        const ch = scnr.currentChar();
        if (ch !== "%" /* TokenChars.Modulo */) {
            emitError(CompileErrorCodes.EXPECTED_TOKEN, currentPosition(), 0, ch);
        }
        scnr.next();
        return "%" /* TokenChars.Modulo */;
    }
    function readText(scnr) {
        let buf = '';
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const ch = scnr.currentChar();
            if (ch === "{" /* TokenChars.BraceLeft */ ||
                ch === "}" /* TokenChars.BraceRight */ ||
                ch === "@" /* TokenChars.LinkedAlias */ ||
                ch === "|" /* TokenChars.Pipe */ ||
                !ch) {
                break;
            }
            else if (ch === "%" /* TokenChars.Modulo */) {
                if (isTextStart(scnr)) {
                    buf += ch;
                    scnr.next();
                }
                else {
                    break;
                }
            }
            else if (ch === CHAR_SP || ch === CHAR_LF) {
                if (isTextStart(scnr)) {
                    buf += ch;
                    scnr.next();
                }
                else if (isPluralStart(scnr)) {
                    break;
                }
                else {
                    buf += ch;
                    scnr.next();
                }
            }
            else {
                buf += ch;
                scnr.next();
            }
        }
        return buf;
    }
    function readNamedIdentifier(scnr) {
        skipSpaces(scnr);
        let ch = '';
        let name = '';
        while ((ch = takeNamedIdentifierChar(scnr))) {
            name += ch;
        }
        if (scnr.currentChar() === EOF) {
            emitError(CompileErrorCodes.UNTERMINATED_CLOSING_BRACE, currentPosition(), 0);
        }
        return name;
    }
    function readListIdentifier(scnr) {
        skipSpaces(scnr);
        let value = '';
        if (scnr.currentChar() === '-') {
            scnr.next();
            value += `-${getDigits(scnr)}`;
        }
        else {
            value += getDigits(scnr);
        }
        if (scnr.currentChar() === EOF) {
            emitError(CompileErrorCodes.UNTERMINATED_CLOSING_BRACE, currentPosition(), 0);
        }
        return value;
    }
    function isLiteral(ch) {
        return ch !== LITERAL_DELIMITER && ch !== CHAR_LF;
    }
    function readLiteral(scnr) {
        skipSpaces(scnr);
        // eslint-disable-next-line no-useless-escape
        eat(scnr, `\'`);
        let ch = '';
        let literal = '';
        while ((ch = takeChar(scnr, isLiteral))) {
            if (ch === '\\') {
                literal += readEscapeSequence(scnr);
            }
            else {
                literal += ch;
            }
        }
        const current = scnr.currentChar();
        if (current === CHAR_LF || current === EOF) {
            emitError(CompileErrorCodes.UNTERMINATED_SINGLE_QUOTE_IN_PLACEHOLDER, currentPosition(), 0);
            // TODO: Is it correct really?
            if (current === CHAR_LF) {
                scnr.next();
                // eslint-disable-next-line no-useless-escape
                eat(scnr, `\'`);
            }
            return literal;
        }
        // eslint-disable-next-line no-useless-escape
        eat(scnr, `\'`);
        return literal;
    }
    function readEscapeSequence(scnr) {
        const ch = scnr.currentChar();
        switch (ch) {
            case '\\':
            case `\'`: // eslint-disable-line no-useless-escape
                scnr.next();
                return `\\${ch}`;
            case 'u':
                return readUnicodeEscapeSequence(scnr, ch, 4);
            case 'U':
                return readUnicodeEscapeSequence(scnr, ch, 6);
            default:
                emitError(CompileErrorCodes.UNKNOWN_ESCAPE_SEQUENCE, currentPosition(), 0, ch);
                return '';
        }
    }
    function readUnicodeEscapeSequence(scnr, unicode, digits) {
        eat(scnr, unicode);
        let sequence = '';
        for (let i = 0; i < digits; i++) {
            const ch = takeHexDigit(scnr);
            if (!ch) {
                emitError(CompileErrorCodes.INVALID_UNICODE_ESCAPE_SEQUENCE, currentPosition(), 0, `\\${unicode}${sequence}${scnr.currentChar()}`);
                break;
            }
            sequence += ch;
        }
        return `\\${unicode}${sequence}`;
    }
    function isInvalidIdentifier(ch) {
        return (ch !== "{" /* TokenChars.BraceLeft */ &&
            ch !== "}" /* TokenChars.BraceRight */ &&
            ch !== CHAR_SP &&
            ch !== CHAR_LF);
    }
    function readInvalidIdentifier(scnr) {
        skipSpaces(scnr);
        let ch = '';
        let identifiers = '';
        while ((ch = takeChar(scnr, isInvalidIdentifier))) {
            identifiers += ch;
        }
        return identifiers;
    }
    function readLinkedModifier(scnr) {
        let ch = '';
        let name = '';
        while ((ch = takeIdentifierChar(scnr))) {
            name += ch;
        }
        return name;
    }
    function readLinkedRefer(scnr) {
        const fn = (buf) => {
            const ch = scnr.currentChar();
            if (ch === "{" /* TokenChars.BraceLeft */ ||
                ch === "%" /* TokenChars.Modulo */ ||
                ch === "@" /* TokenChars.LinkedAlias */ ||
                ch === "|" /* TokenChars.Pipe */ ||
                ch === "(" /* TokenChars.ParenLeft */ ||
                ch === ")" /* TokenChars.ParenRight */ ||
                !ch) {
                return buf;
            }
            else if (ch === CHAR_SP) {
                return buf;
            }
            else if (ch === CHAR_LF || ch === DOT) {
                buf += ch;
                scnr.next();
                return fn(buf);
            }
            else {
                buf += ch;
                scnr.next();
                return fn(buf);
            }
        };
        return fn('');
    }
    function readPlural(scnr) {
        skipSpaces(scnr);
        const plural = eat(scnr, "|" /* TokenChars.Pipe */);
        skipSpaces(scnr);
        return plural;
    }
    // TODO: We need refactoring of token parsing ...
    function readTokenInPlaceholder(scnr, context) {
        let token = null;
        const ch = scnr.currentChar();
        switch (ch) {
            case "{" /* TokenChars.BraceLeft */:
                if (context.braceNest >= 1) {
                    emitError(CompileErrorCodes.NOT_ALLOW_NEST_PLACEHOLDER, currentPosition(), 0);
                }
                scnr.next();
                token = getToken(context, 2 /* TokenTypes.BraceLeft */, "{" /* TokenChars.BraceLeft */);
                skipSpaces(scnr);
                context.braceNest++;
                return token;
            case "}" /* TokenChars.BraceRight */:
                if (context.braceNest > 0 &&
                    context.currentType === 2 /* TokenTypes.BraceLeft */) {
                    emitError(CompileErrorCodes.EMPTY_PLACEHOLDER, currentPosition(), 0);
                }
                scnr.next();
                token = getToken(context, 3 /* TokenTypes.BraceRight */, "}" /* TokenChars.BraceRight */);
                context.braceNest--;
                context.braceNest > 0 && skipSpaces(scnr);
                if (context.inLinked && context.braceNest === 0) {
                    context.inLinked = false;
                }
                return token;
            case "@" /* TokenChars.LinkedAlias */:
                if (context.braceNest > 0) {
                    emitError(CompileErrorCodes.UNTERMINATED_CLOSING_BRACE, currentPosition(), 0);
                }
                token = readTokenInLinked(scnr, context) || getEndToken(context);
                context.braceNest = 0;
                return token;
            default: {
                let validNamedIdentifier = true;
                let validListIdentifier = true;
                let validLiteral = true;
                if (isPluralStart(scnr)) {
                    if (context.braceNest > 0) {
                        emitError(CompileErrorCodes.UNTERMINATED_CLOSING_BRACE, currentPosition(), 0);
                    }
                    token = getToken(context, 1 /* TokenTypes.Pipe */, readPlural(scnr));
                    // reset
                    context.braceNest = 0;
                    context.inLinked = false;
                    return token;
                }
                if (context.braceNest > 0 &&
                    (context.currentType === 5 /* TokenTypes.Named */ ||
                        context.currentType === 6 /* TokenTypes.List */ ||
                        context.currentType === 7 /* TokenTypes.Literal */)) {
                    emitError(CompileErrorCodes.UNTERMINATED_CLOSING_BRACE, currentPosition(), 0);
                    context.braceNest = 0;
                    return readToken(scnr, context);
                }
                if ((validNamedIdentifier = isNamedIdentifierStart(scnr, context))) {
                    token = getToken(context, 5 /* TokenTypes.Named */, readNamedIdentifier(scnr));
                    skipSpaces(scnr);
                    return token;
                }
                if ((validListIdentifier = isListIdentifierStart(scnr, context))) {
                    token = getToken(context, 6 /* TokenTypes.List */, readListIdentifier(scnr));
                    skipSpaces(scnr);
                    return token;
                }
                if ((validLiteral = isLiteralStart(scnr, context))) {
                    token = getToken(context, 7 /* TokenTypes.Literal */, readLiteral(scnr));
                    skipSpaces(scnr);
                    return token;
                }
                if (!validNamedIdentifier && !validListIdentifier && !validLiteral) {
                    // TODO: we should be re-designed invalid cases, when we will extend message syntax near the future ...
                    token = getToken(context, 13 /* TokenTypes.InvalidPlace */, readInvalidIdentifier(scnr));
                    emitError(CompileErrorCodes.INVALID_TOKEN_IN_PLACEHOLDER, currentPosition(), 0, token.value);
                    skipSpaces(scnr);
                    return token;
                }
                break;
            }
        }
        return token;
    }
    // TODO: We need refactoring of token parsing ...
    function readTokenInLinked(scnr, context) {
        const { currentType } = context;
        let token = null;
        const ch = scnr.currentChar();
        if ((currentType === 8 /* TokenTypes.LinkedAlias */ ||
            currentType === 9 /* TokenTypes.LinkedDot */ ||
            currentType === 12 /* TokenTypes.LinkedModifier */ ||
            currentType === 10 /* TokenTypes.LinkedDelimiter */) &&
            (ch === CHAR_LF || ch === CHAR_SP)) {
            emitError(CompileErrorCodes.INVALID_LINKED_FORMAT, currentPosition(), 0);
        }
        switch (ch) {
            case "@" /* TokenChars.LinkedAlias */:
                scnr.next();
                token = getToken(context, 8 /* TokenTypes.LinkedAlias */, "@" /* TokenChars.LinkedAlias */);
                context.inLinked = true;
                return token;
            case "." /* TokenChars.LinkedDot */:
                skipSpaces(scnr);
                scnr.next();
                return getToken(context, 9 /* TokenTypes.LinkedDot */, "." /* TokenChars.LinkedDot */);
            case ":" /* TokenChars.LinkedDelimiter */:
                skipSpaces(scnr);
                scnr.next();
                return getToken(context, 10 /* TokenTypes.LinkedDelimiter */, ":" /* TokenChars.LinkedDelimiter */);
            default:
                if (isPluralStart(scnr)) {
                    token = getToken(context, 1 /* TokenTypes.Pipe */, readPlural(scnr));
                    // reset
                    context.braceNest = 0;
                    context.inLinked = false;
                    return token;
                }
                if (isLinkedDotStart(scnr, context) ||
                    isLinkedDelimiterStart(scnr, context)) {
                    skipSpaces(scnr);
                    return readTokenInLinked(scnr, context);
                }
                if (isLinkedModifierStart(scnr, context)) {
                    skipSpaces(scnr);
                    return getToken(context, 12 /* TokenTypes.LinkedModifier */, readLinkedModifier(scnr));
                }
                if (isLinkedReferStart(scnr, context)) {
                    skipSpaces(scnr);
                    if (ch === "{" /* TokenChars.BraceLeft */) {
                        // scan the placeholder
                        return readTokenInPlaceholder(scnr, context) || token;
                    }
                    else {
                        return getToken(context, 11 /* TokenTypes.LinkedKey */, readLinkedRefer(scnr));
                    }
                }
                if (currentType === 8 /* TokenTypes.LinkedAlias */) {
                    emitError(CompileErrorCodes.INVALID_LINKED_FORMAT, currentPosition(), 0);
                }
                context.braceNest = 0;
                context.inLinked = false;
                return readToken(scnr, context);
        }
    }
    // TODO: We need refactoring of token parsing ...
    function readToken(scnr, context) {
        let token = { type: 14 /* TokenTypes.EOF */ };
        if (context.braceNest > 0) {
            return readTokenInPlaceholder(scnr, context) || getEndToken(context);
        }
        if (context.inLinked) {
            return readTokenInLinked(scnr, context) || getEndToken(context);
        }
        const ch = scnr.currentChar();
        switch (ch) {
            case "{" /* TokenChars.BraceLeft */:
                return readTokenInPlaceholder(scnr, context) || getEndToken(context);
            case "}" /* TokenChars.BraceRight */:
                emitError(CompileErrorCodes.UNBALANCED_CLOSING_BRACE, currentPosition(), 0);
                scnr.next();
                return getToken(context, 3 /* TokenTypes.BraceRight */, "}" /* TokenChars.BraceRight */);
            case "@" /* TokenChars.LinkedAlias */:
                return readTokenInLinked(scnr, context) || getEndToken(context);
            default: {
                if (isPluralStart(scnr)) {
                    token = getToken(context, 1 /* TokenTypes.Pipe */, readPlural(scnr));
                    // reset
                    context.braceNest = 0;
                    context.inLinked = false;
                    return token;
                }
                const { isModulo, hasSpace } = detectModuloStart(scnr);
                if (isModulo) {
                    return hasSpace
                        ? getToken(context, 0 /* TokenTypes.Text */, readText(scnr))
                        : getToken(context, 4 /* TokenTypes.Modulo */, readModulo(scnr));
                }
                if (isTextStart(scnr)) {
                    return getToken(context, 0 /* TokenTypes.Text */, readText(scnr));
                }
                break;
            }
        }
        return token;
    }
    function nextToken() {
        const { currentType, offset, startLoc, endLoc } = _context;
        _context.lastType = currentType;
        _context.lastOffset = offset;
        _context.lastStartLoc = startLoc;
        _context.lastEndLoc = endLoc;
        _context.offset = currentOffset();
        _context.startLoc = currentPosition();
        if (_scnr.currentChar() === EOF) {
            return getToken(_context, 14 /* TokenTypes.EOF */);
        }
        return readToken(_scnr, _context);
    }
    return {
        nextToken,
        currentOffset,
        currentPosition,
        context
    };
}

const ERROR_DOMAIN$2 = 'parser';
// Backslash backslash, backslash quote, uHHHH, UHHHHHH.
const KNOWN_ESCAPES = /(?:\\\\|\\'|\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{6}))/g;
function fromEscapeSequence(match, codePoint4, codePoint6) {
    switch (match) {
        case `\\\\`:
            return `\\`;
        // eslint-disable-next-line no-useless-escape
        case `\\\'`:
            // eslint-disable-next-line no-useless-escape
            return `\'`;
        default: {
            const codePoint = parseInt(codePoint4 || codePoint6, 16);
            if (codePoint <= 0xd7ff || codePoint >= 0xe000) {
                return String.fromCodePoint(codePoint);
            }
            // invalid ...
            // Replace them with U+FFFD REPLACEMENT CHARACTER.
            return '�';
        }
    }
}
function createParser(options = {}) {
    const location = options.location !== false;
    const { onError, onWarn } = options;
    function emitError(tokenzer, code, start, offset, ...args) {
        const end = tokenzer.currentPosition();
        end.offset += offset;
        end.column += offset;
        if (onError) {
            const loc = location ? createLocation(start, end) : null;
            const err = createCompileError(code, loc, {
                domain: ERROR_DOMAIN$2,
                args
            });
            onError(err);
        }
    }
    function emitWarn(tokenzer, code, start, offset, ...args) {
        const end = tokenzer.currentPosition();
        end.offset += offset;
        end.column += offset;
        if (onWarn) {
            const loc = location ? createLocation(start, end) : null;
            onWarn(createCompileWarn(code, loc, args));
        }
    }
    function startNode(type, offset, loc) {
        const node = { type };
        if (location) {
            node.start = offset;
            node.end = offset;
            node.loc = { start: loc, end: loc };
        }
        return node;
    }
    function endNode(node, offset, pos, type) {
        if (location) {
            node.end = offset;
            if (node.loc) {
                node.loc.end = pos;
            }
        }
    }
    function parseText(tokenizer, value) {
        const context = tokenizer.context();
        const node = startNode(3 /* NodeTypes.Text */, context.offset, context.startLoc);
        node.value = value;
        endNode(node, tokenizer.currentOffset(), tokenizer.currentPosition());
        return node;
    }
    function parseList(tokenizer, index) {
        const context = tokenizer.context();
        const { lastOffset: offset, lastStartLoc: loc } = context; // get brace left loc
        const node = startNode(5 /* NodeTypes.List */, offset, loc);
        node.index = parseInt(index, 10);
        tokenizer.nextToken(); // skip brach right
        endNode(node, tokenizer.currentOffset(), tokenizer.currentPosition());
        return node;
    }
    function parseNamed(tokenizer, key, modulo) {
        const context = tokenizer.context();
        const { lastOffset: offset, lastStartLoc: loc } = context; // get brace left loc
        const node = startNode(4 /* NodeTypes.Named */, offset, loc);
        node.key = key;
        if (modulo === true) {
            node.modulo = true;
        }
        tokenizer.nextToken(); // skip brach right
        endNode(node, tokenizer.currentOffset(), tokenizer.currentPosition());
        return node;
    }
    function parseLiteral(tokenizer, value) {
        const context = tokenizer.context();
        const { lastOffset: offset, lastStartLoc: loc } = context; // get brace left loc
        const node = startNode(9 /* NodeTypes.Literal */, offset, loc);
        node.value = value.replace(KNOWN_ESCAPES, fromEscapeSequence);
        tokenizer.nextToken(); // skip brach right
        endNode(node, tokenizer.currentOffset(), tokenizer.currentPosition());
        return node;
    }
    function parseLinkedModifier(tokenizer) {
        const token = tokenizer.nextToken();
        const context = tokenizer.context();
        const { lastOffset: offset, lastStartLoc: loc } = context; // get linked dot loc
        const node = startNode(8 /* NodeTypes.LinkedModifier */, offset, loc);
        if (token.type !== 12 /* TokenTypes.LinkedModifier */) {
            // empty modifier
            emitError(tokenizer, CompileErrorCodes.UNEXPECTED_EMPTY_LINKED_MODIFIER, context.lastStartLoc, 0);
            node.value = '';
            endNode(node, offset, loc);
            return {
                nextConsumeToken: token,
                node
            };
        }
        // check token
        if (token.value == null) {
            emitError(tokenizer, CompileErrorCodes.UNEXPECTED_LEXICAL_ANALYSIS, context.lastStartLoc, 0, getTokenCaption(token));
        }
        node.value = token.value || '';
        endNode(node, tokenizer.currentOffset(), tokenizer.currentPosition());
        return {
            node
        };
    }
    function parseLinkedKey(tokenizer, value) {
        const context = tokenizer.context();
        const node = startNode(7 /* NodeTypes.LinkedKey */, context.offset, context.startLoc);
        node.value = value;
        endNode(node, tokenizer.currentOffset(), tokenizer.currentPosition());
        return node;
    }
    function parseLinked(tokenizer) {
        const context = tokenizer.context();
        const linkedNode = startNode(6 /* NodeTypes.Linked */, context.offset, context.startLoc);
        let token = tokenizer.nextToken();
        if (token.type === 9 /* TokenTypes.LinkedDot */) {
            const parsed = parseLinkedModifier(tokenizer);
            linkedNode.modifier = parsed.node;
            token = parsed.nextConsumeToken || tokenizer.nextToken();
        }
        // asset check token
        if (token.type !== 10 /* TokenTypes.LinkedDelimiter */) {
            emitError(tokenizer, CompileErrorCodes.UNEXPECTED_LEXICAL_ANALYSIS, context.lastStartLoc, 0, getTokenCaption(token));
        }
        token = tokenizer.nextToken();
        // skip brace left
        if (token.type === 2 /* TokenTypes.BraceLeft */) {
            token = tokenizer.nextToken();
        }
        switch (token.type) {
            case 11 /* TokenTypes.LinkedKey */:
                if (token.value == null) {
                    emitError(tokenizer, CompileErrorCodes.UNEXPECTED_LEXICAL_ANALYSIS, context.lastStartLoc, 0, getTokenCaption(token));
                }
                linkedNode.key = parseLinkedKey(tokenizer, token.value || '');
                break;
            case 5 /* TokenTypes.Named */:
                if (token.value == null) {
                    emitError(tokenizer, CompileErrorCodes.UNEXPECTED_LEXICAL_ANALYSIS, context.lastStartLoc, 0, getTokenCaption(token));
                }
                linkedNode.key = parseNamed(tokenizer, token.value || '');
                break;
            case 6 /* TokenTypes.List */:
                if (token.value == null) {
                    emitError(tokenizer, CompileErrorCodes.UNEXPECTED_LEXICAL_ANALYSIS, context.lastStartLoc, 0, getTokenCaption(token));
                }
                linkedNode.key = parseList(tokenizer, token.value || '');
                break;
            case 7 /* TokenTypes.Literal */:
                if (token.value == null) {
                    emitError(tokenizer, CompileErrorCodes.UNEXPECTED_LEXICAL_ANALYSIS, context.lastStartLoc, 0, getTokenCaption(token));
                }
                linkedNode.key = parseLiteral(tokenizer, token.value || '');
                break;
            default: {
                // empty key
                emitError(tokenizer, CompileErrorCodes.UNEXPECTED_EMPTY_LINKED_KEY, context.lastStartLoc, 0);
                const nextContext = tokenizer.context();
                const emptyLinkedKeyNode = startNode(7 /* NodeTypes.LinkedKey */, nextContext.offset, nextContext.startLoc);
                emptyLinkedKeyNode.value = '';
                endNode(emptyLinkedKeyNode, nextContext.offset, nextContext.startLoc);
                linkedNode.key = emptyLinkedKeyNode;
                endNode(linkedNode, nextContext.offset, nextContext.startLoc);
                return {
                    nextConsumeToken: token,
                    node: linkedNode
                };
            }
        }
        endNode(linkedNode, tokenizer.currentOffset(), tokenizer.currentPosition());
        return {
            node: linkedNode
        };
    }
    function parseMessage(tokenizer) {
        const context = tokenizer.context();
        const startOffset = context.currentType === 1 /* TokenTypes.Pipe */
            ? tokenizer.currentOffset()
            : context.offset;
        const startLoc = context.currentType === 1 /* TokenTypes.Pipe */
            ? context.endLoc
            : context.startLoc;
        const node = startNode(2 /* NodeTypes.Message */, startOffset, startLoc);
        node.items = [];
        let nextToken = null;
        let modulo = null;
        do {
            const token = nextToken || tokenizer.nextToken();
            nextToken = null;
            switch (token.type) {
                case 0 /* TokenTypes.Text */:
                    if (token.value == null) {
                        emitError(tokenizer, CompileErrorCodes.UNEXPECTED_LEXICAL_ANALYSIS, context.lastStartLoc, 0, getTokenCaption(token));
                    }
                    node.items.push(parseText(tokenizer, token.value || ''));
                    break;
                case 6 /* TokenTypes.List */:
                    if (token.value == null) {
                        emitError(tokenizer, CompileErrorCodes.UNEXPECTED_LEXICAL_ANALYSIS, context.lastStartLoc, 0, getTokenCaption(token));
                    }
                    node.items.push(parseList(tokenizer, token.value || ''));
                    break;
                case 4 /* TokenTypes.Modulo */:
                    modulo = true;
                    break;
                case 5 /* TokenTypes.Named */:
                    if (token.value == null) {
                        emitError(tokenizer, CompileErrorCodes.UNEXPECTED_LEXICAL_ANALYSIS, context.lastStartLoc, 0, getTokenCaption(token));
                    }
                    node.items.push(parseNamed(tokenizer, token.value || '', !!modulo));
                    if (modulo) {
                        emitWarn(tokenizer, CompileWarnCodes.USE_MODULO_SYNTAX, context.lastStartLoc, 0, getTokenCaption(token));
                        modulo = null;
                    }
                    break;
                case 7 /* TokenTypes.Literal */:
                    if (token.value == null) {
                        emitError(tokenizer, CompileErrorCodes.UNEXPECTED_LEXICAL_ANALYSIS, context.lastStartLoc, 0, getTokenCaption(token));
                    }
                    node.items.push(parseLiteral(tokenizer, token.value || ''));
                    break;
                case 8 /* TokenTypes.LinkedAlias */: {
                    const parsed = parseLinked(tokenizer);
                    node.items.push(parsed.node);
                    nextToken = parsed.nextConsumeToken || null;
                    break;
                }
            }
        } while (context.currentType !== 14 /* TokenTypes.EOF */ &&
            context.currentType !== 1 /* TokenTypes.Pipe */);
        // adjust message node loc
        const endOffset = context.currentType === 1 /* TokenTypes.Pipe */
            ? context.lastOffset
            : tokenizer.currentOffset();
        const endLoc = context.currentType === 1 /* TokenTypes.Pipe */
            ? context.lastEndLoc
            : tokenizer.currentPosition();
        endNode(node, endOffset, endLoc);
        return node;
    }
    function parsePlural(tokenizer, offset, loc, msgNode) {
        const context = tokenizer.context();
        let hasEmptyMessage = msgNode.items.length === 0;
        const node = startNode(1 /* NodeTypes.Plural */, offset, loc);
        node.cases = [];
        node.cases.push(msgNode);
        do {
            const msg = parseMessage(tokenizer);
            if (!hasEmptyMessage) {
                hasEmptyMessage = msg.items.length === 0;
            }
            node.cases.push(msg);
        } while (context.currentType !== 14 /* TokenTypes.EOF */);
        if (hasEmptyMessage) {
            emitError(tokenizer, CompileErrorCodes.MUST_HAVE_MESSAGES_IN_PLURAL, loc, 0);
        }
        endNode(node, tokenizer.currentOffset(), tokenizer.currentPosition());
        return node;
    }
    function parseResource(tokenizer) {
        const context = tokenizer.context();
        const { offset, startLoc } = context;
        const msgNode = parseMessage(tokenizer);
        if (context.currentType === 14 /* TokenTypes.EOF */) {
            return msgNode;
        }
        else {
            return parsePlural(tokenizer, offset, startLoc, msgNode);
        }
    }
    function parse(source) {
        const tokenizer = createTokenizer(source, assign({}, options));
        const context = tokenizer.context();
        const node = startNode(0 /* NodeTypes.Resource */, context.offset, context.startLoc);
        if (location && node.loc) {
            node.loc.source = source;
        }
        node.body = parseResource(tokenizer);
        if (options.onCacheKey) {
            node.cacheKey = options.onCacheKey(source);
        }
        // assert whether achieved to EOF
        if (context.currentType !== 14 /* TokenTypes.EOF */) {
            emitError(tokenizer, CompileErrorCodes.UNEXPECTED_LEXICAL_ANALYSIS, context.lastStartLoc, 0, source[context.offset] || '');
        }
        endNode(node, tokenizer.currentOffset(), tokenizer.currentPosition());
        return node;
    }
    return { parse };
}
function getTokenCaption(token) {
    if (token.type === 14 /* TokenTypes.EOF */) {
        return 'EOF';
    }
    const name = (token.value || '').replace(/\r?\n/gu, '\\n');
    return name.length > 10 ? name.slice(0, 9) + '…' : name;
}

function createTransformer(ast, options = {} // eslint-disable-line
) {
    const _context = {
        ast,
        helpers: new Set()
    };
    const context = () => _context;
    const helper = (name) => {
        _context.helpers.add(name);
        return name;
    };
    return { context, helper };
}
function traverseNodes(nodes, transformer) {
    for (let i = 0; i < nodes.length; i++) {
        traverseNode(nodes[i], transformer);
    }
}
function traverseNode(node, transformer) {
    // TODO: if we need pre-hook of transform, should be implemented to here
    switch (node.type) {
        case 1 /* NodeTypes.Plural */:
            traverseNodes(node.cases, transformer);
            transformer.helper("plural" /* HelperNameMap.PLURAL */);
            break;
        case 2 /* NodeTypes.Message */:
            traverseNodes(node.items, transformer);
            break;
        case 6 /* NodeTypes.Linked */: {
            const linked = node;
            traverseNode(linked.key, transformer);
            transformer.helper("linked" /* HelperNameMap.LINKED */);
            transformer.helper("type" /* HelperNameMap.TYPE */);
            break;
        }
        case 5 /* NodeTypes.List */:
            transformer.helper("interpolate" /* HelperNameMap.INTERPOLATE */);
            transformer.helper("list" /* HelperNameMap.LIST */);
            break;
        case 4 /* NodeTypes.Named */:
            transformer.helper("interpolate" /* HelperNameMap.INTERPOLATE */);
            transformer.helper("named" /* HelperNameMap.NAMED */);
            break;
    }
    // TODO: if we need post-hook of transform, should be implemented to here
}
// transform AST
function transform(ast, options = {} // eslint-disable-line
) {
    const transformer = createTransformer(ast);
    transformer.helper("normalize" /* HelperNameMap.NORMALIZE */);
    // traverse
    ast.body && traverseNode(ast.body, transformer);
    // set meta information
    const context = transformer.context();
    ast.helpers = Array.from(context.helpers);
}

function optimize(ast) {
    const body = ast.body;
    if (body.type === 2 /* NodeTypes.Message */) {
        optimizeMessageNode(body);
    }
    else {
        body.cases.forEach(c => optimizeMessageNode(c));
    }
    return ast;
}
function optimizeMessageNode(message) {
    if (message.items.length === 1) {
        const item = message.items[0];
        if (item.type === 3 /* NodeTypes.Text */ || item.type === 9 /* NodeTypes.Literal */) {
            message.static = item.value;
            delete item.value; // optimization for size
        }
    }
    else {
        const values = [];
        for (let i = 0; i < message.items.length; i++) {
            const item = message.items[i];
            if (!(item.type === 3 /* NodeTypes.Text */ || item.type === 9 /* NodeTypes.Literal */)) {
                break;
            }
            if (item.value == null) {
                break;
            }
            values.push(item.value);
        }
        if (values.length === message.items.length) {
            message.static = join(values);
            for (let i = 0; i < message.items.length; i++) {
                const item = message.items[i];
                if (item.type === 3 /* NodeTypes.Text */ || item.type === 9 /* NodeTypes.Literal */) {
                    delete item.value; // optimization for size
                }
            }
        }
    }
}

const ERROR_DOMAIN$1 = 'minifier';
/* eslint-disable @typescript-eslint/no-explicit-any */
function minify(node) {
    node.t = node.type;
    switch (node.type) {
        case 0 /* NodeTypes.Resource */: {
            const resource = node;
            minify(resource.body);
            resource.b = resource.body;
            delete resource.body;
            break;
        }
        case 1 /* NodeTypes.Plural */: {
            const plural = node;
            const cases = plural.cases;
            for (let i = 0; i < cases.length; i++) {
                minify(cases[i]);
            }
            plural.c = cases;
            delete plural.cases;
            break;
        }
        case 2 /* NodeTypes.Message */: {
            const message = node;
            const items = message.items;
            for (let i = 0; i < items.length; i++) {
                minify(items[i]);
            }
            message.i = items;
            delete message.items;
            if (message.static) {
                message.s = message.static;
                delete message.static;
            }
            break;
        }
        case 3 /* NodeTypes.Text */:
        case 9 /* NodeTypes.Literal */:
        case 8 /* NodeTypes.LinkedModifier */:
        case 7 /* NodeTypes.LinkedKey */: {
            const valueNode = node;
            if (valueNode.value) {
                valueNode.v = valueNode.value;
                delete valueNode.value;
            }
            break;
        }
        case 6 /* NodeTypes.Linked */: {
            const linked = node;
            minify(linked.key);
            linked.k = linked.key;
            delete linked.key;
            if (linked.modifier) {
                minify(linked.modifier);
                linked.m = linked.modifier;
                delete linked.modifier;
            }
            break;
        }
        case 5 /* NodeTypes.List */: {
            const list = node;
            list.i = list.index;
            delete list.index;
            break;
        }
        case 4 /* NodeTypes.Named */: {
            const named = node;
            named.k = named.key;
            delete named.key;
            break;
        }
        default:
            {
                throw createCompileError(CompileErrorCodes.UNHANDLED_MINIFIER_NODE_TYPE, null, {
                    domain: ERROR_DOMAIN$1,
                    args: [node.type]
                });
            }
    }
    delete node.type;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="source-map-js" />
const ERROR_DOMAIN = 'parser';
function createCodeGenerator(ast, options) {
    const { filename, breakLineCode, needIndent: _needIndent } = options;
    const location = options.location !== false;
    const _context = {
        filename,
        code: '',
        column: 1,
        line: 1,
        offset: 0,
        map: undefined,
        breakLineCode,
        needIndent: _needIndent,
        indentLevel: 0
    };
    if (location && ast.loc) {
        _context.source = ast.loc.source;
    }
    const context = () => _context;
    function push(code, node) {
        _context.code += code;
    }
    function _newline(n, withBreakLine = true) {
        const _breakLineCode = withBreakLine ? breakLineCode : '';
        push(_needIndent ? _breakLineCode + `  `.repeat(n) : _breakLineCode);
    }
    function indent(withNewLine = true) {
        const level = ++_context.indentLevel;
        withNewLine && _newline(level);
    }
    function deindent(withNewLine = true) {
        const level = --_context.indentLevel;
        withNewLine && _newline(level);
    }
    function newline() {
        _newline(_context.indentLevel);
    }
    const helper = (key) => `_${key}`;
    const needIndent = () => _context.needIndent;
    return {
        context,
        push,
        indent,
        deindent,
        newline,
        helper,
        needIndent
    };
}
function generateLinkedNode(generator, node) {
    const { helper } = generator;
    generator.push(`${helper("linked" /* HelperNameMap.LINKED */)}(`);
    generateNode(generator, node.key);
    if (node.modifier) {
        generator.push(`, `);
        generateNode(generator, node.modifier);
        generator.push(`, _type`);
    }
    else {
        generator.push(`, undefined, _type`);
    }
    generator.push(`)`);
}
function generateMessageNode(generator, node) {
    const { helper, needIndent } = generator;
    generator.push(`${helper("normalize" /* HelperNameMap.NORMALIZE */)}([`);
    generator.indent(needIndent());
    const length = node.items.length;
    for (let i = 0; i < length; i++) {
        generateNode(generator, node.items[i]);
        if (i === length - 1) {
            break;
        }
        generator.push(', ');
    }
    generator.deindent(needIndent());
    generator.push('])');
}
function generatePluralNode(generator, node) {
    const { helper, needIndent } = generator;
    if (node.cases.length > 1) {
        generator.push(`${helper("plural" /* HelperNameMap.PLURAL */)}([`);
        generator.indent(needIndent());
        const length = node.cases.length;
        for (let i = 0; i < length; i++) {
            generateNode(generator, node.cases[i]);
            if (i === length - 1) {
                break;
            }
            generator.push(', ');
        }
        generator.deindent(needIndent());
        generator.push(`])`);
    }
}
function generateResource(generator, node) {
    if (node.body) {
        generateNode(generator, node.body);
    }
    else {
        generator.push('null');
    }
}
function generateNode(generator, node) {
    const { helper } = generator;
    switch (node.type) {
        case 0 /* NodeTypes.Resource */:
            generateResource(generator, node);
            break;
        case 1 /* NodeTypes.Plural */:
            generatePluralNode(generator, node);
            break;
        case 2 /* NodeTypes.Message */:
            generateMessageNode(generator, node);
            break;
        case 6 /* NodeTypes.Linked */:
            generateLinkedNode(generator, node);
            break;
        case 8 /* NodeTypes.LinkedModifier */:
            generator.push(JSON.stringify(node.value), node);
            break;
        case 7 /* NodeTypes.LinkedKey */:
            generator.push(JSON.stringify(node.value), node);
            break;
        case 5 /* NodeTypes.List */:
            generator.push(`${helper("interpolate" /* HelperNameMap.INTERPOLATE */)}(${helper("list" /* HelperNameMap.LIST */)}(${node.index}))`, node);
            break;
        case 4 /* NodeTypes.Named */:
            generator.push(`${helper("interpolate" /* HelperNameMap.INTERPOLATE */)}(${helper("named" /* HelperNameMap.NAMED */)}(${JSON.stringify(node.key)}))`, node);
            break;
        case 9 /* NodeTypes.Literal */:
            generator.push(JSON.stringify(node.value), node);
            break;
        case 3 /* NodeTypes.Text */:
            generator.push(JSON.stringify(node.value), node);
            break;
        default:
            {
                throw createCompileError(CompileErrorCodes.UNHANDLED_CODEGEN_NODE_TYPE, null, {
                    domain: ERROR_DOMAIN,
                    args: [node.type]
                });
            }
    }
}
// generate code from AST
const generate = (ast, options = {} // eslint-disable-line
) => {
    const mode = isString$1(options.mode) ? options.mode : 'normal';
    const filename = isString$1(options.filename)
        ? options.filename
        : 'message.intl';
    !!options.sourceMap;
    // prettier-ignore
    const breakLineCode = options.breakLineCode != null
        ? options.breakLineCode
        : mode === 'arrow'
            ? ';'
            : '\n';
    const needIndent = options.needIndent ? options.needIndent : mode !== 'arrow';
    const helpers = ast.helpers || [];
    const generator = createCodeGenerator(ast, {
        filename,
        breakLineCode,
        needIndent
    });
    generator.push(mode === 'normal' ? `function __msg__ (ctx) {` : `(ctx) => {`);
    generator.indent(needIndent);
    if (helpers.length > 0) {
        generator.push(`const { ${join(helpers.map(s => `${s}: _${s}`), ', ')} } = ctx`);
        generator.newline();
    }
    generator.push(`return `);
    generateNode(generator, ast);
    generator.deindent(needIndent);
    generator.push(`}`);
    delete ast.helpers;
    const { code, map } = generator.context();
    return {
        ast,
        code,
        map: map ? map.toJSON() : undefined // eslint-disable-line @typescript-eslint/no-explicit-any
    };
};

function baseCompile$1(source, options = {}) {
    const assignedOptions = assign({}, options);
    const jit = !!assignedOptions.jit;
    const enalbeMinify = !!assignedOptions.minify;
    const enambeOptimize = assignedOptions.optimize == null ? true : assignedOptions.optimize;
    // parse source codes
    const parser = createParser(assignedOptions);
    const ast = parser.parse(source);
    if (!jit) {
        // transform ASTs
        transform(ast, assignedOptions);
        // generate javascript codes
        return generate(ast, assignedOptions);
    }
    else {
        // optimize ASTs
        enambeOptimize && optimize(ast);
        // minimize ASTs
        enalbeMinify && minify(ast);
        // In JIT mode, no ast transform, no code generation.
        return { ast, code: '' };
    }
}

/*!
  * core-base v9.14.4
  * (c) 2025 kazuya kawaguchi
  * Released under the MIT License.
  */
function initFeatureFlags$1() {
  if (typeof __INTLIFY_PROD_DEVTOOLS__ !== "boolean") {
    getGlobalThis().__INTLIFY_PROD_DEVTOOLS__ = false;
  }
  if (typeof __INTLIFY_JIT_COMPILATION__ !== "boolean") {
    getGlobalThis().__INTLIFY_JIT_COMPILATION__ = false;
  }
  if (typeof __INTLIFY_DROP_MESSAGE_COMPILER__ !== "boolean") {
    getGlobalThis().__INTLIFY_DROP_MESSAGE_COMPILER__ = false;
  }
}
function isMessageAST(val) {
  return isObject$2(val) && resolveType(val) === 0 && (hasOwn(val, "b") || hasOwn(val, "body"));
}
const PROPS_BODY = ["b", "body"];
function resolveBody(node) {
  return resolveProps(node, PROPS_BODY);
}
const PROPS_CASES = ["c", "cases"];
function resolveCases(node) {
  return resolveProps(node, PROPS_CASES, []);
}
const PROPS_STATIC = ["s", "static"];
function resolveStatic(node) {
  return resolveProps(node, PROPS_STATIC);
}
const PROPS_ITEMS = ["i", "items"];
function resolveItems(node) {
  return resolveProps(node, PROPS_ITEMS, []);
}
const PROPS_TYPE = ["t", "type"];
function resolveType(node) {
  return resolveProps(node, PROPS_TYPE);
}
const PROPS_VALUE = ["v", "value"];
function resolveValue$1(node, type) {
  const resolved = resolveProps(node, PROPS_VALUE);
  if (resolved != null) {
    return resolved;
  } else {
    throw createUnhandleNodeError(type);
  }
}
const PROPS_MODIFIER = ["m", "modifier"];
function resolveLinkedModifier(node) {
  return resolveProps(node, PROPS_MODIFIER);
}
const PROPS_KEY = ["k", "key"];
function resolveLinkedKey(node) {
  const resolved = resolveProps(node, PROPS_KEY);
  if (resolved) {
    return resolved;
  } else {
    throw createUnhandleNodeError(
      6
      /* NodeTypes.Linked */
    );
  }
}
function resolveProps(node, props, defaultValue) {
  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    if (hasOwn(node, prop) && node[prop] != null) {
      return node[prop];
    }
  }
  return defaultValue;
}
const AST_NODE_PROPS_KEYS = [
  ...PROPS_BODY,
  ...PROPS_CASES,
  ...PROPS_STATIC,
  ...PROPS_ITEMS,
  ...PROPS_KEY,
  ...PROPS_MODIFIER,
  ...PROPS_VALUE,
  ...PROPS_TYPE
];
function createUnhandleNodeError(type) {
  return new Error(`unhandled node type: ${type}`);
}
const pathStateMachine = [];
pathStateMachine[
  0
  /* States.BEFORE_PATH */
] = {
  [
    "w"
    /* PathCharTypes.WORKSPACE */
  ]: [
    0
    /* States.BEFORE_PATH */
  ],
  [
    "i"
    /* PathCharTypes.IDENT */
  ]: [
    3,
    0
    /* Actions.APPEND */
  ],
  [
    "["
    /* PathCharTypes.LEFT_BRACKET */
  ]: [
    4
    /* States.IN_SUB_PATH */
  ],
  [
    "o"
    /* PathCharTypes.END_OF_FAIL */
  ]: [
    7
    /* States.AFTER_PATH */
  ]
};
pathStateMachine[
  1
  /* States.IN_PATH */
] = {
  [
    "w"
    /* PathCharTypes.WORKSPACE */
  ]: [
    1
    /* States.IN_PATH */
  ],
  [
    "."
    /* PathCharTypes.DOT */
  ]: [
    2
    /* States.BEFORE_IDENT */
  ],
  [
    "["
    /* PathCharTypes.LEFT_BRACKET */
  ]: [
    4
    /* States.IN_SUB_PATH */
  ],
  [
    "o"
    /* PathCharTypes.END_OF_FAIL */
  ]: [
    7
    /* States.AFTER_PATH */
  ]
};
pathStateMachine[
  2
  /* States.BEFORE_IDENT */
] = {
  [
    "w"
    /* PathCharTypes.WORKSPACE */
  ]: [
    2
    /* States.BEFORE_IDENT */
  ],
  [
    "i"
    /* PathCharTypes.IDENT */
  ]: [
    3,
    0
    /* Actions.APPEND */
  ],
  [
    "0"
    /* PathCharTypes.ZERO */
  ]: [
    3,
    0
    /* Actions.APPEND */
  ]
};
pathStateMachine[
  3
  /* States.IN_IDENT */
] = {
  [
    "i"
    /* PathCharTypes.IDENT */
  ]: [
    3,
    0
    /* Actions.APPEND */
  ],
  [
    "0"
    /* PathCharTypes.ZERO */
  ]: [
    3,
    0
    /* Actions.APPEND */
  ],
  [
    "w"
    /* PathCharTypes.WORKSPACE */
  ]: [
    1,
    1
    /* Actions.PUSH */
  ],
  [
    "."
    /* PathCharTypes.DOT */
  ]: [
    2,
    1
    /* Actions.PUSH */
  ],
  [
    "["
    /* PathCharTypes.LEFT_BRACKET */
  ]: [
    4,
    1
    /* Actions.PUSH */
  ],
  [
    "o"
    /* PathCharTypes.END_OF_FAIL */
  ]: [
    7,
    1
    /* Actions.PUSH */
  ]
};
pathStateMachine[
  4
  /* States.IN_SUB_PATH */
] = {
  [
    "'"
    /* PathCharTypes.SINGLE_QUOTE */
  ]: [
    5,
    0
    /* Actions.APPEND */
  ],
  [
    '"'
    /* PathCharTypes.DOUBLE_QUOTE */
  ]: [
    6,
    0
    /* Actions.APPEND */
  ],
  [
    "["
    /* PathCharTypes.LEFT_BRACKET */
  ]: [
    4,
    2
    /* Actions.INC_SUB_PATH_DEPTH */
  ],
  [
    "]"
    /* PathCharTypes.RIGHT_BRACKET */
  ]: [
    1,
    3
    /* Actions.PUSH_SUB_PATH */
  ],
  [
    "o"
    /* PathCharTypes.END_OF_FAIL */
  ]: 8,
  [
    "l"
    /* PathCharTypes.ELSE */
  ]: [
    4,
    0
    /* Actions.APPEND */
  ]
};
pathStateMachine[
  5
  /* States.IN_SINGLE_QUOTE */
] = {
  [
    "'"
    /* PathCharTypes.SINGLE_QUOTE */
  ]: [
    4,
    0
    /* Actions.APPEND */
  ],
  [
    "o"
    /* PathCharTypes.END_OF_FAIL */
  ]: 8,
  [
    "l"
    /* PathCharTypes.ELSE */
  ]: [
    5,
    0
    /* Actions.APPEND */
  ]
};
pathStateMachine[
  6
  /* States.IN_DOUBLE_QUOTE */
] = {
  [
    '"'
    /* PathCharTypes.DOUBLE_QUOTE */
  ]: [
    4,
    0
    /* Actions.APPEND */
  ],
  [
    "o"
    /* PathCharTypes.END_OF_FAIL */
  ]: 8,
  [
    "l"
    /* PathCharTypes.ELSE */
  ]: [
    6,
    0
    /* Actions.APPEND */
  ]
};
const literalValueRE = /^\s?(?:true|false|-?[\d.]+|'[^']*'|"[^"]*")\s?$/;
function isLiteral(exp) {
  return literalValueRE.test(exp);
}
function stripQuotes(str) {
  const a = str.charCodeAt(0);
  const b = str.charCodeAt(str.length - 1);
  return a === b && (a === 34 || a === 39) ? str.slice(1, -1) : str;
}
function getPathCharType(ch) {
  if (ch === void 0 || ch === null) {
    return "o";
  }
  const code2 = ch.charCodeAt(0);
  switch (code2) {
    case 91:
    // [
    case 93:
    // ]
    case 46:
    // .
    case 34:
    // "
    case 39:
      return ch;
    case 95:
    // _
    case 36:
    // $
    case 45:
      return "i";
    case 9:
    // Tab (HT)
    case 10:
    // Newline (LF)
    case 13:
    // Return (CR)
    case 160:
    // No-break space (NBSP)
    case 65279:
    // Byte Order Mark (BOM)
    case 8232:
    // Line Separator (LS)
    case 8233:
      return "w";
  }
  return "i";
}
function formatSubPath(path) {
  const trimmed = path.trim();
  if (path.charAt(0) === "0" && isNaN(parseInt(path))) {
    return false;
  }
  return isLiteral(trimmed) ? stripQuotes(trimmed) : "*" + trimmed;
}
function parse(path) {
  const keys = [];
  let index = -1;
  let mode = 0;
  let subPathDepth = 0;
  let c;
  let key;
  let newChar;
  let type;
  let transition;
  let action;
  let typeMap;
  const actions = [];
  actions[
    0
    /* Actions.APPEND */
  ] = () => {
    if (key === void 0) {
      key = newChar;
    } else {
      key += newChar;
    }
  };
  actions[
    1
    /* Actions.PUSH */
  ] = () => {
    if (key !== void 0) {
      keys.push(key);
      key = void 0;
    }
  };
  actions[
    2
    /* Actions.INC_SUB_PATH_DEPTH */
  ] = () => {
    actions[
      0
      /* Actions.APPEND */
    ]();
    subPathDepth++;
  };
  actions[
    3
    /* Actions.PUSH_SUB_PATH */
  ] = () => {
    if (subPathDepth > 0) {
      subPathDepth--;
      mode = 4;
      actions[
        0
        /* Actions.APPEND */
      ]();
    } else {
      subPathDepth = 0;
      if (key === void 0) {
        return false;
      }
      key = formatSubPath(key);
      if (key === false) {
        return false;
      } else {
        actions[
          1
          /* Actions.PUSH */
        ]();
      }
    }
  };
  function maybeUnescapeQuote() {
    const nextChar = path[index + 1];
    if (mode === 5 && nextChar === "'" || mode === 6 && nextChar === '"') {
      index++;
      newChar = "\\" + nextChar;
      actions[
        0
        /* Actions.APPEND */
      ]();
      return true;
    }
  }
  while (mode !== null) {
    index++;
    c = path[index];
    if (c === "\\" && maybeUnescapeQuote()) {
      continue;
    }
    type = getPathCharType(c);
    typeMap = pathStateMachine[mode];
    transition = typeMap[type] || typeMap[
      "l"
      /* PathCharTypes.ELSE */
    ] || 8;
    if (transition === 8) {
      return;
    }
    mode = transition[0];
    if (transition[1] !== void 0) {
      action = actions[transition[1]];
      if (action) {
        newChar = c;
        if (action() === false) {
          return;
        }
      }
    }
    if (mode === 7) {
      return keys;
    }
  }
}
const cache = /* @__PURE__ */ new Map();
function resolveWithKeyValue(obj, path) {
  return isObject$2(obj) ? obj[path] : null;
}
function resolveValue(obj, path) {
  if (!isObject$2(obj)) {
    return null;
  }
  let hit = cache.get(path);
  if (!hit) {
    hit = parse(path);
    if (hit) {
      cache.set(path, hit);
    }
  }
  if (!hit) {
    return null;
  }
  const len = hit.length;
  let last = obj;
  let i = 0;
  while (i < len) {
    const key = hit[i];
    if (AST_NODE_PROPS_KEYS.includes(key) && isMessageAST(last)) {
      return null;
    }
    const val = last[key];
    if (val === void 0) {
      return null;
    }
    if (isFunction$2(last)) {
      return null;
    }
    last = val;
    i++;
  }
  return last;
}
const DEFAULT_MODIFIER = (str) => str;
const DEFAULT_MESSAGE = (ctx) => "";
const DEFAULT_MESSAGE_DATA_TYPE = "text";
const DEFAULT_NORMALIZE = (values) => values.length === 0 ? "" : join$1(values);
const DEFAULT_INTERPOLATE = toDisplayString;
function pluralDefault(choice, choicesLength) {
  choice = Math.abs(choice);
  if (choicesLength === 2) {
    return choice ? choice > 1 ? 1 : 0 : 1;
  }
  return choice ? Math.min(choice, 2) : 0;
}
function getPluralIndex(options) {
  const index = isNumber$1(options.pluralIndex) ? options.pluralIndex : -1;
  return options.named && (isNumber$1(options.named.count) || isNumber$1(options.named.n)) ? isNumber$1(options.named.count) ? options.named.count : isNumber$1(options.named.n) ? options.named.n : index : index;
}
function normalizeNamed(pluralIndex, props) {
  if (!props.count) {
    props.count = pluralIndex;
  }
  if (!props.n) {
    props.n = pluralIndex;
  }
}
function createMessageContext(options = {}) {
  const locale = options.locale;
  const pluralIndex = getPluralIndex(options);
  const pluralRule = isObject$2(options.pluralRules) && isString$2(locale) && isFunction$2(options.pluralRules[locale]) ? options.pluralRules[locale] : pluralDefault;
  const orgPluralRule = isObject$2(options.pluralRules) && isString$2(locale) && isFunction$2(options.pluralRules[locale]) ? pluralDefault : void 0;
  const plural = (messages) => {
    return messages[pluralRule(pluralIndex, messages.length, orgPluralRule)];
  };
  const _list = options.list || [];
  const list = (index) => _list[index];
  const _named = options.named || create$1();
  isNumber$1(options.pluralIndex) && normalizeNamed(pluralIndex, _named);
  const named = (key) => _named[key];
  function message(key) {
    const msg = isFunction$2(options.messages) ? options.messages(key) : isObject$2(options.messages) ? options.messages[key] : false;
    return !msg ? options.parent ? options.parent.message(key) : DEFAULT_MESSAGE : msg;
  }
  const _modifier = (name) => options.modifiers ? options.modifiers[name] : DEFAULT_MODIFIER;
  const normalize = isPlainObject$1(options.processor) && isFunction$2(options.processor.normalize) ? options.processor.normalize : DEFAULT_NORMALIZE;
  const interpolate = isPlainObject$1(options.processor) && isFunction$2(options.processor.interpolate) ? options.processor.interpolate : DEFAULT_INTERPOLATE;
  const type = isPlainObject$1(options.processor) && isString$2(options.processor.type) ? options.processor.type : DEFAULT_MESSAGE_DATA_TYPE;
  const linked = (key, ...args) => {
    const [arg1, arg2] = args;
    let type2 = "text";
    let modifier = "";
    if (args.length === 1) {
      if (isObject$2(arg1)) {
        modifier = arg1.modifier || modifier;
        type2 = arg1.type || type2;
      } else if (isString$2(arg1)) {
        modifier = arg1 || modifier;
      }
    } else if (args.length === 2) {
      if (isString$2(arg1)) {
        modifier = arg1 || modifier;
      }
      if (isString$2(arg2)) {
        type2 = arg2 || type2;
      }
    }
    const ret = message(key)(ctx);
    const msg = (
      // The message in vnode resolved with linked are returned as an array by processor.nomalize
      type2 === "vnode" && isArray$1(ret) && modifier ? ret[0] : ret
    );
    return modifier ? _modifier(modifier)(msg, type2) : msg;
  };
  const ctx = {
    [
      "list"
      /* HelperNameMap.LIST */
    ]: list,
    [
      "named"
      /* HelperNameMap.NAMED */
    ]: named,
    [
      "plural"
      /* HelperNameMap.PLURAL */
    ]: plural,
    [
      "linked"
      /* HelperNameMap.LINKED */
    ]: linked,
    [
      "message"
      /* HelperNameMap.MESSAGE */
    ]: message,
    [
      "type"
      /* HelperNameMap.TYPE */
    ]: type,
    [
      "interpolate"
      /* HelperNameMap.INTERPOLATE */
    ]: interpolate,
    [
      "normalize"
      /* HelperNameMap.NORMALIZE */
    ]: normalize,
    [
      "values"
      /* HelperNameMap.VALUES */
    ]: assign$1(create$1(), _list, _named)
  };
  return ctx;
}
let devtools = null;
function setDevToolsHook(hook) {
  devtools = hook;
}
function initI18nDevTools(i18n, version, meta) {
  devtools && devtools.emit("i18n:init", {
    timestamp: Date.now(),
    i18n,
    version,
    meta
  });
}
const translateDevTools = /* @__PURE__ */ createDevToolsHook(
  "function:translate"
  /* IntlifyDevToolsHooks.FunctionTranslate */
);
function createDevToolsHook(hook) {
  return (payloads) => devtools && devtools.emit(hook, payloads);
}
const code$1$1 = CompileWarnCodes.__EXTEND_POINT__;
const inc$1$1 = incrementer(code$1$1);
const CoreWarnCodes = {
  // 2
  FALLBACK_TO_TRANSLATE: inc$1$1(),
  // 3
  CANNOT_FORMAT_NUMBER: inc$1$1(),
  // 4
  FALLBACK_TO_NUMBER_FORMAT: inc$1$1(),
  // 5
  CANNOT_FORMAT_DATE: inc$1$1(),
  // 6
  FALLBACK_TO_DATE_FORMAT: inc$1$1(),
  // 7
  EXPERIMENTAL_CUSTOM_MESSAGE_COMPILER: inc$1$1(),
  // 8
  __EXTEND_POINT__: inc$1$1()
  // 9
};
const code$2 = CompileErrorCodes.__EXTEND_POINT__;
const inc$2 = incrementer(code$2);
const CoreErrorCodes = {
  INVALID_ARGUMENT: code$2,
  // 17
  INVALID_DATE_ARGUMENT: inc$2(),
  // 18
  INVALID_ISO_DATE_ARGUMENT: inc$2(),
  // 19
  NOT_SUPPORT_NON_STRING_MESSAGE: inc$2(),
  // 20
  NOT_SUPPORT_LOCALE_PROMISE_VALUE: inc$2(),
  // 21
  NOT_SUPPORT_LOCALE_ASYNC_FUNCTION: inc$2(),
  // 22
  NOT_SUPPORT_LOCALE_TYPE: inc$2(),
  // 23
  __EXTEND_POINT__: inc$2()
  // 24
};
function createCoreError(code2) {
  return createCompileError(code2, null, void 0);
}
function getLocale(context, options) {
  return options.locale != null ? resolveLocale(options.locale) : resolveLocale(context.locale);
}
let _resolveLocale;
function resolveLocale(locale) {
  if (isString$2(locale)) {
    return locale;
  } else {
    if (isFunction$2(locale)) {
      if (locale.resolvedOnce && _resolveLocale != null) {
        return _resolveLocale;
      } else if (locale.constructor.name === "Function") {
        const resolve = locale();
        if (isPromise(resolve)) {
          throw createCoreError(CoreErrorCodes.NOT_SUPPORT_LOCALE_PROMISE_VALUE);
        }
        return _resolveLocale = resolve;
      } else {
        throw createCoreError(CoreErrorCodes.NOT_SUPPORT_LOCALE_ASYNC_FUNCTION);
      }
    } else {
      throw createCoreError(CoreErrorCodes.NOT_SUPPORT_LOCALE_TYPE);
    }
  }
}
function fallbackWithSimple(ctx, fallback, start) {
  return [.../* @__PURE__ */ new Set([
    start,
    ...isArray$1(fallback) ? fallback : isObject$2(fallback) ? Object.keys(fallback) : isString$2(fallback) ? [fallback] : [start]
  ])];
}
function fallbackWithLocaleChain(ctx, fallback, start) {
  const startLocale = isString$2(start) ? start : DEFAULT_LOCALE$1;
  const context = ctx;
  if (!context.__localeChainCache) {
    context.__localeChainCache = /* @__PURE__ */ new Map();
  }
  let chain = context.__localeChainCache.get(startLocale);
  if (!chain) {
    chain = [];
    let block = [start];
    while (isArray$1(block)) {
      block = appendBlockToChain(chain, block, fallback);
    }
    const defaults = isArray$1(fallback) || !isPlainObject$1(fallback) ? fallback : fallback["default"] ? fallback["default"] : null;
    block = isString$2(defaults) ? [defaults] : defaults;
    if (isArray$1(block)) {
      appendBlockToChain(chain, block, false);
    }
    context.__localeChainCache.set(startLocale, chain);
  }
  return chain;
}
function appendBlockToChain(chain, block, blocks) {
  let follow = true;
  for (let i = 0; i < block.length && isBoolean$1(follow); i++) {
    const locale = block[i];
    if (isString$2(locale)) {
      follow = appendLocaleToChain(chain, block[i], blocks);
    }
  }
  return follow;
}
function appendLocaleToChain(chain, locale, blocks) {
  let follow;
  const tokens = locale.split("-");
  do {
    const target = tokens.join("-");
    follow = appendItemToChain(chain, target, blocks);
    tokens.splice(-1, 1);
  } while (tokens.length && follow === true);
  return follow;
}
function appendItemToChain(chain, target, blocks) {
  let follow = false;
  if (!chain.includes(target)) {
    follow = true;
    if (target) {
      follow = target[target.length - 1] !== "!";
      const locale = target.replace(/!/g, "");
      chain.push(locale);
      if ((isArray$1(blocks) || isPlainObject$1(blocks)) && blocks[locale]) {
        follow = blocks[locale];
      }
    }
  }
  return follow;
}
const VERSION$3 = "9.14.4";
const NOT_REOSLVED = -1;
const DEFAULT_LOCALE$1 = "en-US";
const MISSING_RESOLVE_VALUE = "";
const capitalize = (str) => `${str.charAt(0).toLocaleUpperCase()}${str.substr(1)}`;
function getDefaultLinkedModifiers() {
  return {
    upper: (val, type) => {
      return type === "text" && isString$2(val) ? val.toUpperCase() : type === "vnode" && isObject$2(val) && "__v_isVNode" in val ? val.children.toUpperCase() : val;
    },
    lower: (val, type) => {
      return type === "text" && isString$2(val) ? val.toLowerCase() : type === "vnode" && isObject$2(val) && "__v_isVNode" in val ? val.children.toLowerCase() : val;
    },
    capitalize: (val, type) => {
      return type === "text" && isString$2(val) ? capitalize(val) : type === "vnode" && isObject$2(val) && "__v_isVNode" in val ? capitalize(val.children) : val;
    }
  };
}
let _compiler;
function registerMessageCompiler(compiler) {
  _compiler = compiler;
}
let _resolver;
function registerMessageResolver(resolver) {
  _resolver = resolver;
}
let _fallbacker;
function registerLocaleFallbacker(fallbacker) {
  _fallbacker = fallbacker;
}
let _additionalMeta = null;
const setAdditionalMeta = /* @__NO_SIDE_EFFECTS__ */ (meta) => {
  _additionalMeta = meta;
};
const getAdditionalMeta = /* @__NO_SIDE_EFFECTS__ */ () => _additionalMeta;
let _fallbackContext = null;
const setFallbackContext = (context) => {
  _fallbackContext = context;
};
const getFallbackContext = () => _fallbackContext;
let _cid = 0;
function createCoreContext(options = {}) {
  const onWarn = isFunction$2(options.onWarn) ? options.onWarn : warn;
  const version = isString$2(options.version) ? options.version : VERSION$3;
  const locale = isString$2(options.locale) || isFunction$2(options.locale) ? options.locale : DEFAULT_LOCALE$1;
  const _locale = isFunction$2(locale) ? DEFAULT_LOCALE$1 : locale;
  const fallbackLocale = isArray$1(options.fallbackLocale) || isPlainObject$1(options.fallbackLocale) || isString$2(options.fallbackLocale) || options.fallbackLocale === false ? options.fallbackLocale : _locale;
  const messages = isPlainObject$1(options.messages) ? options.messages : createResources(_locale);
  const datetimeFormats = isPlainObject$1(options.datetimeFormats) ? options.datetimeFormats : createResources(_locale);
  const numberFormats = isPlainObject$1(options.numberFormats) ? options.numberFormats : createResources(_locale);
  const modifiers = assign$1(create$1(), options.modifiers, getDefaultLinkedModifiers());
  const pluralRules = options.pluralRules || create$1();
  const missing = isFunction$2(options.missing) ? options.missing : null;
  const missingWarn = isBoolean$1(options.missingWarn) || isRegExp$1(options.missingWarn) ? options.missingWarn : true;
  const fallbackWarn = isBoolean$1(options.fallbackWarn) || isRegExp$1(options.fallbackWarn) ? options.fallbackWarn : true;
  const fallbackFormat = !!options.fallbackFormat;
  const unresolving = !!options.unresolving;
  const postTranslation = isFunction$2(options.postTranslation) ? options.postTranslation : null;
  const processor = isPlainObject$1(options.processor) ? options.processor : null;
  const warnHtmlMessage = isBoolean$1(options.warnHtmlMessage) ? options.warnHtmlMessage : true;
  const escapeParameter = !!options.escapeParameter;
  const messageCompiler = isFunction$2(options.messageCompiler) ? options.messageCompiler : _compiler;
  const messageResolver = isFunction$2(options.messageResolver) ? options.messageResolver : _resolver || resolveWithKeyValue;
  const localeFallbacker = isFunction$2(options.localeFallbacker) ? options.localeFallbacker : _fallbacker || fallbackWithSimple;
  const fallbackContext = isObject$2(options.fallbackContext) ? options.fallbackContext : void 0;
  const internalOptions = options;
  const __datetimeFormatters = isObject$2(internalOptions.__datetimeFormatters) ? internalOptions.__datetimeFormatters : /* @__PURE__ */ new Map();
  const __numberFormatters = isObject$2(internalOptions.__numberFormatters) ? internalOptions.__numberFormatters : /* @__PURE__ */ new Map();
  const __meta = isObject$2(internalOptions.__meta) ? internalOptions.__meta : {};
  _cid++;
  const context = {
    version,
    cid: _cid,
    locale,
    fallbackLocale,
    messages,
    modifiers,
    pluralRules,
    missing,
    missingWarn,
    fallbackWarn,
    fallbackFormat,
    unresolving,
    postTranslation,
    processor,
    warnHtmlMessage,
    escapeParameter,
    messageCompiler,
    messageResolver,
    localeFallbacker,
    fallbackContext,
    onWarn,
    __meta
  };
  {
    context.datetimeFormats = datetimeFormats;
    context.numberFormats = numberFormats;
    context.__datetimeFormatters = __datetimeFormatters;
    context.__numberFormatters = __numberFormatters;
  }
  if (__INTLIFY_PROD_DEVTOOLS__) {
    initI18nDevTools(context, version, __meta);
  }
  return context;
}
const createResources = (locale) => ({ [locale]: create$1() });
function handleMissing(context, key, locale, missingWarn, type) {
  const { missing, onWarn } = context;
  if (missing !== null) {
    const ret = missing(context, locale, key, type);
    return isString$2(ret) ? ret : key;
  } else {
    return key;
  }
}
function updateFallbackLocale(ctx, locale, fallback) {
  const context = ctx;
  context.__localeChainCache = /* @__PURE__ */ new Map();
  ctx.localeFallbacker(ctx, fallback, locale);
}
function isAlmostSameLocale(locale, compareLocale) {
  if (locale === compareLocale)
    return false;
  return locale.split("-")[0] === compareLocale.split("-")[0];
}
function isImplicitFallback(targetLocale, locales) {
  const index = locales.indexOf(targetLocale);
  if (index === -1) {
    return false;
  }
  for (let i = index + 1; i < locales.length; i++) {
    if (isAlmostSameLocale(targetLocale, locales[i])) {
      return true;
    }
  }
  return false;
}
function format(ast) {
  const msg = (ctx) => formatParts(ctx, ast);
  return msg;
}
function formatParts(ctx, ast) {
  const body = resolveBody(ast);
  if (body == null) {
    throw createUnhandleNodeError(
      0
      /* NodeTypes.Resource */
    );
  }
  const type = resolveType(body);
  if (type === 1) {
    const plural = body;
    const cases = resolveCases(plural);
    return ctx.plural(cases.reduce((messages, c) => [
      ...messages,
      formatMessageParts(ctx, c)
    ], []));
  } else {
    return formatMessageParts(ctx, body);
  }
}
function formatMessageParts(ctx, node) {
  const static_ = resolveStatic(node);
  if (static_ != null) {
    return ctx.type === "text" ? static_ : ctx.normalize([static_]);
  } else {
    const messages = resolveItems(node).reduce((acm, c) => [...acm, formatMessagePart(ctx, c)], []);
    return ctx.normalize(messages);
  }
}
function formatMessagePart(ctx, node) {
  const type = resolveType(node);
  switch (type) {
    case 3: {
      return resolveValue$1(node, type);
    }
    case 9: {
      return resolveValue$1(node, type);
    }
    case 4: {
      const named = node;
      if (hasOwn(named, "k") && named.k) {
        return ctx.interpolate(ctx.named(named.k));
      }
      if (hasOwn(named, "key") && named.key) {
        return ctx.interpolate(ctx.named(named.key));
      }
      throw createUnhandleNodeError(type);
    }
    case 5: {
      const list = node;
      if (hasOwn(list, "i") && isNumber$1(list.i)) {
        return ctx.interpolate(ctx.list(list.i));
      }
      if (hasOwn(list, "index") && isNumber$1(list.index)) {
        return ctx.interpolate(ctx.list(list.index));
      }
      throw createUnhandleNodeError(type);
    }
    case 6: {
      const linked = node;
      const modifier = resolveLinkedModifier(linked);
      const key = resolveLinkedKey(linked);
      return ctx.linked(formatMessagePart(ctx, key), modifier ? formatMessagePart(ctx, modifier) : void 0, ctx.type);
    }
    case 7: {
      return resolveValue$1(node, type);
    }
    case 8: {
      return resolveValue$1(node, type);
    }
    default:
      throw new Error(`unhandled node on format message part: ${type}`);
  }
}
const defaultOnCacheKey = (message) => message;
let compileCache = create$1();
function baseCompile(message, options = {}) {
  let detectError = false;
  const onError = options.onError || defaultOnError;
  options.onError = (err) => {
    detectError = true;
    onError(err);
  };
  return { ...baseCompile$1(message, options), detectError };
}
const compileToFunction = /* @__NO_SIDE_EFFECTS__ */ (message, context) => {
  if (!isString$2(message)) {
    throw createCoreError(CoreErrorCodes.NOT_SUPPORT_NON_STRING_MESSAGE);
  }
  {
    isBoolean$1(context.warnHtmlMessage) ? context.warnHtmlMessage : true;
    const onCacheKey = context.onCacheKey || defaultOnCacheKey;
    const cacheKey = onCacheKey(message);
    const cached = compileCache[cacheKey];
    if (cached) {
      return cached;
    }
    const { code: code2, detectError } = baseCompile(message, context);
    const msg = new Function(`return ${code2}`)();
    return !detectError ? compileCache[cacheKey] = msg : msg;
  }
};
function compile(message, context) {
  if (__INTLIFY_JIT_COMPILATION__ && !__INTLIFY_DROP_MESSAGE_COMPILER__ && isString$2(message)) {
    isBoolean$1(context.warnHtmlMessage) ? context.warnHtmlMessage : true;
    const onCacheKey = context.onCacheKey || defaultOnCacheKey;
    const cacheKey = onCacheKey(message);
    const cached = compileCache[cacheKey];
    if (cached) {
      return cached;
    }
    const { ast, detectError } = baseCompile(message, {
      ...context,
      location: false,
      jit: true
    });
    const msg = format(ast);
    return !detectError ? compileCache[cacheKey] = msg : msg;
  } else {
    const cacheKey = message.cacheKey;
    if (cacheKey) {
      const cached = compileCache[cacheKey];
      if (cached) {
        return cached;
      }
      return compileCache[cacheKey] = format(message);
    } else {
      return format(message);
    }
  }
}
const NOOP_MESSAGE_FUNCTION = () => "";
const isMessageFunction = (val) => isFunction$2(val);
function translate(context, ...args) {
  const { fallbackFormat, postTranslation, unresolving, messageCompiler, fallbackLocale, messages } = context;
  const [key, options] = parseTranslateArgs(...args);
  const missingWarn = isBoolean$1(options.missingWarn) ? options.missingWarn : context.missingWarn;
  const fallbackWarn = isBoolean$1(options.fallbackWarn) ? options.fallbackWarn : context.fallbackWarn;
  const escapeParameter = isBoolean$1(options.escapeParameter) ? options.escapeParameter : context.escapeParameter;
  const resolvedMessage = !!options.resolvedMessage;
  const defaultMsgOrKey = isString$2(options.default) || isBoolean$1(options.default) ? !isBoolean$1(options.default) ? options.default : !messageCompiler ? () => key : key : fallbackFormat ? !messageCompiler ? () => key : key : "";
  const enableDefaultMsg = fallbackFormat || defaultMsgOrKey !== "";
  const locale = getLocale(context, options);
  escapeParameter && escapeParams(options);
  let [formatScope, targetLocale, message] = !resolvedMessage ? resolveMessageFormat(context, key, locale, fallbackLocale, fallbackWarn, missingWarn) : [
    key,
    locale,
    messages[locale] || create$1()
  ];
  let format2 = formatScope;
  let cacheBaseKey = key;
  if (!resolvedMessage && !(isString$2(format2) || isMessageAST(format2) || isMessageFunction(format2))) {
    if (enableDefaultMsg) {
      format2 = defaultMsgOrKey;
      cacheBaseKey = format2;
    }
  }
  if (!resolvedMessage && (!(isString$2(format2) || isMessageAST(format2) || isMessageFunction(format2)) || !isString$2(targetLocale))) {
    return unresolving ? NOT_REOSLVED : key;
  }
  let occurred = false;
  const onError = () => {
    occurred = true;
  };
  const msg = !isMessageFunction(format2) ? compileMessageFormat(context, key, targetLocale, format2, cacheBaseKey, onError) : format2;
  if (occurred) {
    return format2;
  }
  const ctxOptions = getMessageContextOptions(context, targetLocale, message, options);
  const msgContext = createMessageContext(ctxOptions);
  const messaged = evaluateMessage(context, msg, msgContext);
  const ret = postTranslation ? postTranslation(messaged, key) : messaged;
  if (__INTLIFY_PROD_DEVTOOLS__) {
    const payloads = {
      timestamp: Date.now(),
      key: isString$2(key) ? key : isMessageFunction(format2) ? format2.key : "",
      locale: targetLocale || (isMessageFunction(format2) ? format2.locale : ""),
      format: isString$2(format2) ? format2 : isMessageFunction(format2) ? format2.source : "",
      message: ret
    };
    payloads.meta = assign$1({}, context.__meta, /* @__PURE__ */ getAdditionalMeta() || {});
    translateDevTools(payloads);
  }
  return ret;
}
function escapeParams(options) {
  if (isArray$1(options.list)) {
    options.list = options.list.map((item) => isString$2(item) ? escapeHtml(item) : item);
  } else if (isObject$2(options.named)) {
    Object.keys(options.named).forEach((key) => {
      if (isString$2(options.named[key])) {
        options.named[key] = escapeHtml(options.named[key]);
      }
    });
  }
}
function resolveMessageFormat(context, key, locale, fallbackLocale, fallbackWarn, missingWarn) {
  const { messages, onWarn, messageResolver: resolveValue2, localeFallbacker } = context;
  const locales = localeFallbacker(context, fallbackLocale, locale);
  let message = create$1();
  let targetLocale;
  let format2 = null;
  const type = "translate";
  for (let i = 0; i < locales.length; i++) {
    targetLocale = locales[i];
    message = messages[targetLocale] || create$1();
    if ((format2 = resolveValue2(message, key)) === null) {
      format2 = message[key];
    }
    if (isString$2(format2) || isMessageAST(format2) || isMessageFunction(format2)) {
      break;
    }
    if (!isImplicitFallback(targetLocale, locales)) {
      const missingRet = handleMissing(
        context,
        // eslint-disable-line @typescript-eslint/no-explicit-any
        key,
        targetLocale,
        missingWarn,
        type
      );
      if (missingRet !== key) {
        format2 = missingRet;
      }
    }
  }
  return [format2, targetLocale, message];
}
function compileMessageFormat(context, key, targetLocale, format2, cacheBaseKey, onError) {
  const { messageCompiler, warnHtmlMessage } = context;
  if (isMessageFunction(format2)) {
    const msg2 = format2;
    msg2.locale = msg2.locale || targetLocale;
    msg2.key = msg2.key || key;
    return msg2;
  }
  if (messageCompiler == null) {
    const msg2 = (() => format2);
    msg2.locale = targetLocale;
    msg2.key = key;
    return msg2;
  }
  const msg = messageCompiler(format2, getCompileContext(context, targetLocale, cacheBaseKey, format2, warnHtmlMessage, onError));
  msg.locale = targetLocale;
  msg.key = key;
  msg.source = format2;
  return msg;
}
function evaluateMessage(context, msg, msgCtx) {
  const messaged = msg(msgCtx);
  return messaged;
}
function parseTranslateArgs(...args) {
  const [arg1, arg2, arg3] = args;
  const options = create$1();
  if (!isString$2(arg1) && !isNumber$1(arg1) && !isMessageFunction(arg1) && !isMessageAST(arg1)) {
    throw createCoreError(CoreErrorCodes.INVALID_ARGUMENT);
  }
  const key = isNumber$1(arg1) ? String(arg1) : isMessageFunction(arg1) ? arg1 : arg1;
  if (isNumber$1(arg2)) {
    options.plural = arg2;
  } else if (isString$2(arg2)) {
    options.default = arg2;
  } else if (isPlainObject$1(arg2) && !isEmptyObject$1(arg2)) {
    options.named = arg2;
  } else if (isArray$1(arg2)) {
    options.list = arg2;
  }
  if (isNumber$1(arg3)) {
    options.plural = arg3;
  } else if (isString$2(arg3)) {
    options.default = arg3;
  } else if (isPlainObject$1(arg3)) {
    assign$1(options, arg3);
  }
  return [key, options];
}
function getCompileContext(context, locale, key, source, warnHtmlMessage, onError) {
  return {
    locale,
    key,
    warnHtmlMessage,
    onError: (err) => {
      onError && onError(err);
      {
        throw err;
      }
    },
    onCacheKey: (source2) => generateFormatCacheKey(locale, key, source2)
  };
}
function getMessageContextOptions(context, locale, message, options) {
  const { modifiers, pluralRules, messageResolver: resolveValue2, fallbackLocale, fallbackWarn, missingWarn, fallbackContext } = context;
  const resolveMessage = (key) => {
    let val = resolveValue2(message, key);
    if (val == null && fallbackContext) {
      const [, , message2] = resolveMessageFormat(fallbackContext, key, locale, fallbackLocale, fallbackWarn, missingWarn);
      val = resolveValue2(message2, key);
    }
    if (isString$2(val) || isMessageAST(val)) {
      let occurred = false;
      const onError = () => {
        occurred = true;
      };
      const msg = compileMessageFormat(context, key, locale, val, key, onError);
      return !occurred ? msg : NOOP_MESSAGE_FUNCTION;
    } else if (isMessageFunction(val)) {
      return val;
    } else {
      return NOOP_MESSAGE_FUNCTION;
    }
  };
  const ctxOptions = {
    locale,
    modifiers,
    pluralRules,
    messages: resolveMessage
  };
  if (context.processor) {
    ctxOptions.processor = context.processor;
  }
  if (options.list) {
    ctxOptions.list = options.list;
  }
  if (options.named) {
    ctxOptions.named = options.named;
  }
  if (isNumber$1(options.plural)) {
    ctxOptions.pluralIndex = options.plural;
  }
  return ctxOptions;
}
function datetime(context, ...args) {
  const { datetimeFormats, unresolving, fallbackLocale, onWarn, localeFallbacker } = context;
  const { __datetimeFormatters } = context;
  const [key, value, options, overrides] = parseDateTimeArgs(...args);
  const missingWarn = isBoolean$1(options.missingWarn) ? options.missingWarn : context.missingWarn;
  isBoolean$1(options.fallbackWarn) ? options.fallbackWarn : context.fallbackWarn;
  const part = !!options.part;
  const locale = getLocale(context, options);
  const locales = localeFallbacker(
    context,
    // eslint-disable-line @typescript-eslint/no-explicit-any
    fallbackLocale,
    locale
  );
  if (!isString$2(key) || key === "") {
    return new Intl.DateTimeFormat(locale, overrides).format(value);
  }
  let datetimeFormat = {};
  let targetLocale;
  let format2 = null;
  const type = "datetime format";
  for (let i = 0; i < locales.length; i++) {
    targetLocale = locales[i];
    datetimeFormat = datetimeFormats[targetLocale] || {};
    format2 = datetimeFormat[key];
    if (isPlainObject$1(format2))
      break;
    handleMissing(context, key, targetLocale, missingWarn, type);
  }
  if (!isPlainObject$1(format2) || !isString$2(targetLocale)) {
    return unresolving ? NOT_REOSLVED : key;
  }
  let id = `${targetLocale}__${key}`;
  if (!isEmptyObject$1(overrides)) {
    id = `${id}__${JSON.stringify(overrides)}`;
  }
  let formatter = __datetimeFormatters.get(id);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(targetLocale, assign$1({}, format2, overrides));
    __datetimeFormatters.set(id, formatter);
  }
  return !part ? formatter.format(value) : formatter.formatToParts(value);
}
const DATETIME_FORMAT_OPTIONS_KEYS = [
  "localeMatcher",
  "weekday",
  "era",
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
  "timeZoneName",
  "formatMatcher",
  "hour12",
  "timeZone",
  "dateStyle",
  "timeStyle",
  "calendar",
  "dayPeriod",
  "numberingSystem",
  "hourCycle",
  "fractionalSecondDigits"
];
function parseDateTimeArgs(...args) {
  const [arg1, arg2, arg3, arg4] = args;
  const options = create$1();
  let overrides = create$1();
  let value;
  if (isString$2(arg1)) {
    const matches = arg1.match(/(\d{4}-\d{2}-\d{2})(T|\s)?(.*)/);
    if (!matches) {
      throw createCoreError(CoreErrorCodes.INVALID_ISO_DATE_ARGUMENT);
    }
    const dateTime = matches[3] ? matches[3].trim().startsWith("T") ? `${matches[1].trim()}${matches[3].trim()}` : `${matches[1].trim()}T${matches[3].trim()}` : matches[1].trim();
    value = new Date(dateTime);
    try {
      value.toISOString();
    } catch (e) {
      throw createCoreError(CoreErrorCodes.INVALID_ISO_DATE_ARGUMENT);
    }
  } else if (isDate$1(arg1)) {
    if (isNaN(arg1.getTime())) {
      throw createCoreError(CoreErrorCodes.INVALID_DATE_ARGUMENT);
    }
    value = arg1;
  } else if (isNumber$1(arg1)) {
    value = arg1;
  } else {
    throw createCoreError(CoreErrorCodes.INVALID_ARGUMENT);
  }
  if (isString$2(arg2)) {
    options.key = arg2;
  } else if (isPlainObject$1(arg2)) {
    Object.keys(arg2).forEach((key) => {
      if (DATETIME_FORMAT_OPTIONS_KEYS.includes(key)) {
        overrides[key] = arg2[key];
      } else {
        options[key] = arg2[key];
      }
    });
  }
  if (isString$2(arg3)) {
    options.locale = arg3;
  } else if (isPlainObject$1(arg3)) {
    overrides = arg3;
  }
  if (isPlainObject$1(arg4)) {
    overrides = arg4;
  }
  return [options.key || "", value, options, overrides];
}
function clearDateTimeFormat(ctx, locale, format2) {
  const context = ctx;
  for (const key in format2) {
    const id = `${locale}__${key}`;
    if (!context.__datetimeFormatters.has(id)) {
      continue;
    }
    context.__datetimeFormatters.delete(id);
  }
}
function number(context, ...args) {
  const { numberFormats, unresolving, fallbackLocale, onWarn, localeFallbacker } = context;
  const { __numberFormatters } = context;
  const [key, value, options, overrides] = parseNumberArgs(...args);
  const missingWarn = isBoolean$1(options.missingWarn) ? options.missingWarn : context.missingWarn;
  isBoolean$1(options.fallbackWarn) ? options.fallbackWarn : context.fallbackWarn;
  const part = !!options.part;
  const locale = getLocale(context, options);
  const locales = localeFallbacker(
    context,
    // eslint-disable-line @typescript-eslint/no-explicit-any
    fallbackLocale,
    locale
  );
  if (!isString$2(key) || key === "") {
    return new Intl.NumberFormat(locale, overrides).format(value);
  }
  let numberFormat = {};
  let targetLocale;
  let format2 = null;
  const type = "number format";
  for (let i = 0; i < locales.length; i++) {
    targetLocale = locales[i];
    numberFormat = numberFormats[targetLocale] || {};
    format2 = numberFormat[key];
    if (isPlainObject$1(format2))
      break;
    handleMissing(context, key, targetLocale, missingWarn, type);
  }
  if (!isPlainObject$1(format2) || !isString$2(targetLocale)) {
    return unresolving ? NOT_REOSLVED : key;
  }
  let id = `${targetLocale}__${key}`;
  if (!isEmptyObject$1(overrides)) {
    id = `${id}__${JSON.stringify(overrides)}`;
  }
  let formatter = __numberFormatters.get(id);
  if (!formatter) {
    formatter = new Intl.NumberFormat(targetLocale, assign$1({}, format2, overrides));
    __numberFormatters.set(id, formatter);
  }
  return !part ? formatter.format(value) : formatter.formatToParts(value);
}
const NUMBER_FORMAT_OPTIONS_KEYS = [
  "localeMatcher",
  "style",
  "currency",
  "currencyDisplay",
  "currencySign",
  "useGrouping",
  "minimumIntegerDigits",
  "minimumFractionDigits",
  "maximumFractionDigits",
  "minimumSignificantDigits",
  "maximumSignificantDigits",
  "compactDisplay",
  "notation",
  "signDisplay",
  "unit",
  "unitDisplay",
  "roundingMode",
  "roundingPriority",
  "roundingIncrement",
  "trailingZeroDisplay"
];
function parseNumberArgs(...args) {
  const [arg1, arg2, arg3, arg4] = args;
  const options = create$1();
  let overrides = create$1();
  if (!isNumber$1(arg1)) {
    throw createCoreError(CoreErrorCodes.INVALID_ARGUMENT);
  }
  const value = arg1;
  if (isString$2(arg2)) {
    options.key = arg2;
  } else if (isPlainObject$1(arg2)) {
    Object.keys(arg2).forEach((key) => {
      if (NUMBER_FORMAT_OPTIONS_KEYS.includes(key)) {
        overrides[key] = arg2[key];
      } else {
        options[key] = arg2[key];
      }
    });
  }
  if (isString$2(arg3)) {
    options.locale = arg3;
  } else if (isPlainObject$1(arg3)) {
    overrides = arg3;
  }
  if (isPlainObject$1(arg4)) {
    overrides = arg4;
  }
  return [options.key || "", value, options, overrides];
}
function clearNumberFormat(ctx, locale, format2) {
  const context = ctx;
  for (const key in format2) {
    const id = `${locale}__${key}`;
    if (!context.__numberFormatters.has(id)) {
      continue;
    }
    context.__numberFormatters.delete(id);
  }
}
{
  initFeatureFlags$1();
}

/*!
  * vue-i18n v9.14.4
  * (c) 2025 kazuya kawaguchi
  * Released under the MIT License.
  */
const VERSION$2 = "9.14.4";
function initFeatureFlags() {
  if (typeof __VUE_I18N_FULL_INSTALL__ !== "boolean") {
    getGlobalThis().__VUE_I18N_FULL_INSTALL__ = true;
  }
  if (typeof __VUE_I18N_LEGACY_API__ !== "boolean") {
    getGlobalThis().__VUE_I18N_LEGACY_API__ = true;
  }
  if (typeof __INTLIFY_JIT_COMPILATION__ !== "boolean") {
    getGlobalThis().__INTLIFY_JIT_COMPILATION__ = false;
  }
  if (typeof __INTLIFY_DROP_MESSAGE_COMPILER__ !== "boolean") {
    getGlobalThis().__INTLIFY_DROP_MESSAGE_COMPILER__ = false;
  }
  if (typeof __INTLIFY_PROD_DEVTOOLS__ !== "boolean") {
    getGlobalThis().__INTLIFY_PROD_DEVTOOLS__ = false;
  }
}
const code$1 = CoreWarnCodes.__EXTEND_POINT__;
const inc$1 = incrementer(code$1);
({
  // 9
  NOT_SUPPORTED_PRESERVE: inc$1(),
  // 10
  NOT_SUPPORTED_FORMATTER: inc$1(),
  // 11
  NOT_SUPPORTED_PRESERVE_DIRECTIVE: inc$1(),
  // 12
  NOT_SUPPORTED_GET_CHOICE_INDEX: inc$1(),
  // 13
  COMPONENT_NAME_LEGACY_COMPATIBLE: inc$1(),
  // 14
  NOT_FOUND_PARENT_SCOPE: inc$1(),
  // 15
  IGNORE_OBJ_FLATTEN: inc$1(),
  // 16
  NOTICE_DROP_ALLOW_COMPOSITION: inc$1(),
  // 17
  NOTICE_DROP_TRANSLATE_EXIST_COMPATIBLE_FLAG: inc$1()
  // 18
});
const code = CoreErrorCodes.__EXTEND_POINT__;
const inc = incrementer(code);
const I18nErrorCodes = {
  // composer module errors
  UNEXPECTED_RETURN_TYPE: code,
  // 24
  // legacy module errors
  INVALID_ARGUMENT: inc(),
  // 25
  // i18n module errors
  MUST_BE_CALL_SETUP_TOP: inc(),
  // 26
  NOT_INSTALLED: inc(),
  // 27
  NOT_AVAILABLE_IN_LEGACY_MODE: inc(),
  // 28
  // directive module errors
  REQUIRED_VALUE: inc(),
  // 29
  INVALID_VALUE: inc(),
  // 30
  // vue-devtools errors
  CANNOT_SETUP_VUE_DEVTOOLS_PLUGIN: inc(),
  // 31
  NOT_INSTALLED_WITH_PROVIDE: inc(),
  // 32
  // unexpected error
  UNEXPECTED_ERROR: inc(),
  // 33
  // not compatible legacy vue-i18n constructor
  NOT_COMPATIBLE_LEGACY_VUE_I18N: inc(),
  // 34
  // bridge support vue 2.x only
  BRIDGE_SUPPORT_VUE_2_ONLY: inc(),
  // 35
  // need to define `i18n` option in `allowComposition: true` and `useScope: 'local' at `useI18n``
  MUST_DEFINE_I18N_OPTION_IN_ALLOW_COMPOSITION: inc(),
  // 36
  // Not available Compostion API in Legacy API mode. Please make sure that the legacy API mode is working properly
  NOT_AVAILABLE_COMPOSITION_IN_LEGACY: inc(),
  // 37
  // for enhancement
  __EXTEND_POINT__: inc()
  // 38
};
function createI18nError(code2, ...args) {
  return createCompileError(code2, null, void 0);
}
const TranslateVNodeSymbol = /* @__PURE__ */ makeSymbol("__translateVNode");
const DatetimePartsSymbol = /* @__PURE__ */ makeSymbol("__datetimeParts");
const NumberPartsSymbol = /* @__PURE__ */ makeSymbol("__numberParts");
const SetPluralRulesSymbol = makeSymbol("__setPluralRules");
const InejctWithOptionSymbol = /* @__PURE__ */ makeSymbol("__injectWithOption");
const DisposeSymbol = /* @__PURE__ */ makeSymbol("__dispose");
function handleFlatJson(obj) {
  if (!isObject$2(obj)) {
    return obj;
  }
  if (isMessageAST(obj)) {
    return obj;
  }
  for (const key in obj) {
    if (!hasOwn(obj, key)) {
      continue;
    }
    if (!key.includes(".")) {
      if (isObject$2(obj[key])) {
        handleFlatJson(obj[key]);
      }
    } else {
      const subKeys = key.split(".");
      const lastIndex = subKeys.length - 1;
      let currentObj = obj;
      let hasStringValue = false;
      for (let i = 0; i < lastIndex; i++) {
        if (subKeys[i] === "__proto__") {
          throw new Error(`unsafe key: ${subKeys[i]}`);
        }
        if (!(subKeys[i] in currentObj)) {
          currentObj[subKeys[i]] = create$1();
        }
        if (!isObject$2(currentObj[subKeys[i]])) {
          hasStringValue = true;
          break;
        }
        currentObj = currentObj[subKeys[i]];
      }
      if (!hasStringValue) {
        if (!isMessageAST(currentObj)) {
          currentObj[subKeys[lastIndex]] = obj[key];
          delete obj[key];
        } else {
          if (!AST_NODE_PROPS_KEYS.includes(subKeys[lastIndex])) {
            delete obj[key];
          }
        }
      }
      if (!isMessageAST(currentObj)) {
        const target = currentObj[subKeys[lastIndex]];
        if (isObject$2(target)) {
          handleFlatJson(target);
        }
      }
    }
  }
  return obj;
}
function getLocaleMessages(locale, options) {
  const { messages, __i18n, messageResolver, flatJson } = options;
  const ret = isPlainObject$1(messages) ? messages : isArray$1(__i18n) ? create$1() : { [locale]: create$1() };
  if (isArray$1(__i18n)) {
    __i18n.forEach((custom) => {
      if ("locale" in custom && "resource" in custom) {
        const { locale: locale2, resource } = custom;
        if (locale2) {
          ret[locale2] = ret[locale2] || create$1();
          deepCopy(resource, ret[locale2]);
        } else {
          deepCopy(resource, ret);
        }
      } else {
        isString$2(custom) && deepCopy(JSON.parse(custom), ret);
      }
    });
  }
  if (messageResolver == null && flatJson) {
    for (const key in ret) {
      if (hasOwn(ret, key)) {
        handleFlatJson(ret[key]);
      }
    }
  }
  return ret;
}
function getComponentOptions(instance) {
  return instance.type;
}
function adjustI18nResources(gl, options, componentOptions) {
  let messages = isObject$2(options.messages) ? options.messages : create$1();
  if ("__i18nGlobal" in componentOptions) {
    messages = getLocaleMessages(gl.locale.value, {
      messages,
      __i18n: componentOptions.__i18nGlobal
    });
  }
  const locales = Object.keys(messages);
  if (locales.length) {
    locales.forEach((locale) => {
      gl.mergeLocaleMessage(locale, messages[locale]);
    });
  }
  {
    if (isObject$2(options.datetimeFormats)) {
      const locales2 = Object.keys(options.datetimeFormats);
      if (locales2.length) {
        locales2.forEach((locale) => {
          gl.mergeDateTimeFormat(locale, options.datetimeFormats[locale]);
        });
      }
    }
    if (isObject$2(options.numberFormats)) {
      const locales2 = Object.keys(options.numberFormats);
      if (locales2.length) {
        locales2.forEach((locale) => {
          gl.mergeNumberFormat(locale, options.numberFormats[locale]);
        });
      }
    }
  }
}
function createTextNode(key) {
  return createVNode(Text, null, key, 0);
}
const DEVTOOLS_META = "__INTLIFY_META__";
const NOOP_RETURN_ARRAY = () => [];
const NOOP_RETURN_FALSE = () => false;
let composerID = 0;
function defineCoreMissingHandler(missing) {
  return ((ctx, locale, key, type) => {
    return missing(locale, key, getCurrentInstance() || void 0, type);
  });
}
const getMetaInfo = /* @__NO_SIDE_EFFECTS__ */ () => {
  const instance = getCurrentInstance();
  let meta = null;
  return instance && (meta = getComponentOptions(instance)[DEVTOOLS_META]) ? { [DEVTOOLS_META]: meta } : null;
};
function createComposer(options = {}, VueI18nLegacy) {
  const { __root, __injectWithOption } = options;
  const _isGlobal = __root === void 0;
  const flatJson = options.flatJson;
  const _ref = inBrowser ? ref : shallowRef;
  const translateExistCompatible = !!options.translateExistCompatible;
  let _inheritLocale = isBoolean$1(options.inheritLocale) ? options.inheritLocale : true;
  const _locale = _ref(
    // prettier-ignore
    __root && _inheritLocale ? __root.locale.value : isString$2(options.locale) ? options.locale : DEFAULT_LOCALE$1
  );
  const _fallbackLocale = _ref(
    // prettier-ignore
    __root && _inheritLocale ? __root.fallbackLocale.value : isString$2(options.fallbackLocale) || isArray$1(options.fallbackLocale) || isPlainObject$1(options.fallbackLocale) || options.fallbackLocale === false ? options.fallbackLocale : _locale.value
  );
  const _messages = _ref(getLocaleMessages(_locale.value, options));
  const _datetimeFormats = _ref(isPlainObject$1(options.datetimeFormats) ? options.datetimeFormats : { [_locale.value]: {} });
  const _numberFormats = _ref(isPlainObject$1(options.numberFormats) ? options.numberFormats : { [_locale.value]: {} });
  let _missingWarn = __root ? __root.missingWarn : isBoolean$1(options.missingWarn) || isRegExp$1(options.missingWarn) ? options.missingWarn : true;
  let _fallbackWarn = __root ? __root.fallbackWarn : isBoolean$1(options.fallbackWarn) || isRegExp$1(options.fallbackWarn) ? options.fallbackWarn : true;
  let _fallbackRoot = __root ? __root.fallbackRoot : isBoolean$1(options.fallbackRoot) ? options.fallbackRoot : true;
  let _fallbackFormat = !!options.fallbackFormat;
  let _missing = isFunction$2(options.missing) ? options.missing : null;
  let _runtimeMissing = isFunction$2(options.missing) ? defineCoreMissingHandler(options.missing) : null;
  let _postTranslation = isFunction$2(options.postTranslation) ? options.postTranslation : null;
  let _warnHtmlMessage = __root ? __root.warnHtmlMessage : isBoolean$1(options.warnHtmlMessage) ? options.warnHtmlMessage : true;
  let _escapeParameter = !!options.escapeParameter;
  const _modifiers = __root ? __root.modifiers : isPlainObject$1(options.modifiers) ? options.modifiers : {};
  let _pluralRules = options.pluralRules || __root && __root.pluralRules;
  let _context;
  const getCoreContext = () => {
    _isGlobal && setFallbackContext(null);
    const ctxOptions = {
      version: VERSION$2,
      locale: _locale.value,
      fallbackLocale: _fallbackLocale.value,
      messages: _messages.value,
      modifiers: _modifiers,
      pluralRules: _pluralRules,
      missing: _runtimeMissing === null ? void 0 : _runtimeMissing,
      missingWarn: _missingWarn,
      fallbackWarn: _fallbackWarn,
      fallbackFormat: _fallbackFormat,
      unresolving: true,
      postTranslation: _postTranslation === null ? void 0 : _postTranslation,
      warnHtmlMessage: _warnHtmlMessage,
      escapeParameter: _escapeParameter,
      messageResolver: options.messageResolver,
      messageCompiler: options.messageCompiler,
      __meta: { framework: "vue" }
    };
    {
      ctxOptions.datetimeFormats = _datetimeFormats.value;
      ctxOptions.numberFormats = _numberFormats.value;
      ctxOptions.__datetimeFormatters = isPlainObject$1(_context) ? _context.__datetimeFormatters : void 0;
      ctxOptions.__numberFormatters = isPlainObject$1(_context) ? _context.__numberFormatters : void 0;
    }
    const ctx = createCoreContext(ctxOptions);
    _isGlobal && setFallbackContext(ctx);
    return ctx;
  };
  _context = getCoreContext();
  updateFallbackLocale(_context, _locale.value, _fallbackLocale.value);
  function trackReactivityValues() {
    return [
      _locale.value,
      _fallbackLocale.value,
      _messages.value,
      _datetimeFormats.value,
      _numberFormats.value
    ];
  }
  const locale = computed({
    get: () => _locale.value,
    set: (val) => {
      _locale.value = val;
      _context.locale = _locale.value;
    }
  });
  const fallbackLocale = computed({
    get: () => _fallbackLocale.value,
    set: (val) => {
      _fallbackLocale.value = val;
      _context.fallbackLocale = _fallbackLocale.value;
      updateFallbackLocale(_context, _locale.value, val);
    }
  });
  const messages = computed(() => _messages.value);
  const datetimeFormats = /* @__PURE__ */ computed(() => _datetimeFormats.value);
  const numberFormats = /* @__PURE__ */ computed(() => _numberFormats.value);
  function getPostTranslationHandler() {
    return isFunction$2(_postTranslation) ? _postTranslation : null;
  }
  function setPostTranslationHandler(handler) {
    _postTranslation = handler;
    _context.postTranslation = handler;
  }
  function getMissingHandler() {
    return _missing;
  }
  function setMissingHandler(handler) {
    if (handler !== null) {
      _runtimeMissing = defineCoreMissingHandler(handler);
    }
    _missing = handler;
    _context.missing = _runtimeMissing;
  }
  const wrapWithDeps = (fn, argumentParser, warnType, fallbackSuccess, fallbackFail, successCondition) => {
    trackReactivityValues();
    let ret;
    try {
      if (__INTLIFY_PROD_DEVTOOLS__) {
        setAdditionalMeta(/* @__PURE__ */ getMetaInfo());
      }
      if (!_isGlobal) {
        _context.fallbackContext = __root ? getFallbackContext() : void 0;
      }
      ret = fn(_context);
    } finally {
      if (__INTLIFY_PROD_DEVTOOLS__) ;
      if (!_isGlobal) {
        _context.fallbackContext = void 0;
      }
    }
    if (warnType !== "translate exists" && // for not `te` (e.g `t`)
    isNumber$1(ret) && ret === NOT_REOSLVED || warnType === "translate exists" && !ret) {
      const [key, arg2] = argumentParser();
      return __root && _fallbackRoot ? fallbackSuccess(__root) : fallbackFail(key);
    } else if (successCondition(ret)) {
      return ret;
    } else {
      throw createI18nError(I18nErrorCodes.UNEXPECTED_RETURN_TYPE);
    }
  };
  function t(...args) {
    return wrapWithDeps((context) => Reflect.apply(translate, null, [context, ...args]), () => parseTranslateArgs(...args), "translate", (root) => Reflect.apply(root.t, root, [...args]), (key) => key, (val) => isString$2(val));
  }
  function rt(...args) {
    const [arg1, arg2, arg3] = args;
    if (arg3 && !isObject$2(arg3)) {
      throw createI18nError(I18nErrorCodes.INVALID_ARGUMENT);
    }
    return t(...[arg1, arg2, assign$1({ resolvedMessage: true }, arg3 || {})]);
  }
  function d(...args) {
    return wrapWithDeps((context) => Reflect.apply(datetime, null, [context, ...args]), () => parseDateTimeArgs(...args), "datetime format", (root) => Reflect.apply(root.d, root, [...args]), () => MISSING_RESOLVE_VALUE, (val) => isString$2(val));
  }
  function n(...args) {
    return wrapWithDeps((context) => Reflect.apply(number, null, [context, ...args]), () => parseNumberArgs(...args), "number format", (root) => Reflect.apply(root.n, root, [...args]), () => MISSING_RESOLVE_VALUE, (val) => isString$2(val));
  }
  function normalize(values) {
    return values.map((val) => isString$2(val) || isNumber$1(val) || isBoolean$1(val) ? createTextNode(String(val)) : val);
  }
  const interpolate = (val) => val;
  const processor = {
    normalize,
    interpolate,
    type: "vnode"
  };
  function translateVNode(...args) {
    return wrapWithDeps(
      (context) => {
        let ret;
        const _context2 = context;
        try {
          _context2.processor = processor;
          ret = Reflect.apply(translate, null, [_context2, ...args]);
        } finally {
          _context2.processor = null;
        }
        return ret;
      },
      () => parseTranslateArgs(...args),
      "translate",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (root) => root[TranslateVNodeSymbol](...args),
      (key) => [createTextNode(key)],
      (val) => isArray$1(val)
    );
  }
  function numberParts(...args) {
    return wrapWithDeps(
      (context) => Reflect.apply(number, null, [context, ...args]),
      () => parseNumberArgs(...args),
      "number format",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (root) => root[NumberPartsSymbol](...args),
      NOOP_RETURN_ARRAY,
      (val) => isString$2(val) || isArray$1(val)
    );
  }
  function datetimeParts(...args) {
    return wrapWithDeps(
      (context) => Reflect.apply(datetime, null, [context, ...args]),
      () => parseDateTimeArgs(...args),
      "datetime format",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (root) => root[DatetimePartsSymbol](...args),
      NOOP_RETURN_ARRAY,
      (val) => isString$2(val) || isArray$1(val)
    );
  }
  function setPluralRules(rules) {
    _pluralRules = rules;
    _context.pluralRules = _pluralRules;
  }
  function te(key, locale2) {
    return wrapWithDeps(() => {
      if (!key) {
        return false;
      }
      const targetLocale = isString$2(locale2) ? locale2 : _locale.value;
      const message = getLocaleMessage(targetLocale);
      const resolved = _context.messageResolver(message, key);
      return !translateExistCompatible ? isMessageAST(resolved) || isMessageFunction(resolved) || isString$2(resolved) : resolved != null;
    }, () => [key], "translate exists", (root) => {
      return Reflect.apply(root.te, root, [key, locale2]);
    }, NOOP_RETURN_FALSE, (val) => isBoolean$1(val));
  }
  function resolveMessages(key) {
    let messages2 = null;
    const locales = fallbackWithLocaleChain(_context, _fallbackLocale.value, _locale.value);
    for (let i = 0; i < locales.length; i++) {
      const targetLocaleMessages = _messages.value[locales[i]] || {};
      const messageValue = _context.messageResolver(targetLocaleMessages, key);
      if (messageValue != null) {
        messages2 = messageValue;
        break;
      }
    }
    return messages2;
  }
  function tm(key) {
    const messages2 = resolveMessages(key);
    return messages2 != null ? messages2 : __root ? __root.tm(key) || {} : {};
  }
  function getLocaleMessage(locale2) {
    return _messages.value[locale2] || {};
  }
  function setLocaleMessage(locale2, message) {
    if (flatJson) {
      const _message = { [locale2]: message };
      for (const key in _message) {
        if (hasOwn(_message, key)) {
          handleFlatJson(_message[key]);
        }
      }
      message = _message[locale2];
    }
    _messages.value[locale2] = message;
    _context.messages = _messages.value;
  }
  function mergeLocaleMessage(locale2, message) {
    _messages.value[locale2] = _messages.value[locale2] || {};
    const _message = { [locale2]: message };
    if (flatJson) {
      for (const key in _message) {
        if (hasOwn(_message, key)) {
          handleFlatJson(_message[key]);
        }
      }
    }
    message = _message[locale2];
    deepCopy(message, _messages.value[locale2]);
    _context.messages = _messages.value;
  }
  function getDateTimeFormat(locale2) {
    return _datetimeFormats.value[locale2] || {};
  }
  function setDateTimeFormat(locale2, format2) {
    _datetimeFormats.value[locale2] = format2;
    _context.datetimeFormats = _datetimeFormats.value;
    clearDateTimeFormat(_context, locale2, format2);
  }
  function mergeDateTimeFormat(locale2, format2) {
    _datetimeFormats.value[locale2] = assign$1(_datetimeFormats.value[locale2] || {}, format2);
    _context.datetimeFormats = _datetimeFormats.value;
    clearDateTimeFormat(_context, locale2, format2);
  }
  function getNumberFormat(locale2) {
    return _numberFormats.value[locale2] || {};
  }
  function setNumberFormat(locale2, format2) {
    _numberFormats.value[locale2] = format2;
    _context.numberFormats = _numberFormats.value;
    clearNumberFormat(_context, locale2, format2);
  }
  function mergeNumberFormat(locale2, format2) {
    _numberFormats.value[locale2] = assign$1(_numberFormats.value[locale2] || {}, format2);
    _context.numberFormats = _numberFormats.value;
    clearNumberFormat(_context, locale2, format2);
  }
  composerID++;
  if (__root && inBrowser) {
    watch(__root.locale, (val) => {
      if (_inheritLocale) {
        _locale.value = val;
        _context.locale = val;
        updateFallbackLocale(_context, _locale.value, _fallbackLocale.value);
      }
    });
    watch(__root.fallbackLocale, (val) => {
      if (_inheritLocale) {
        _fallbackLocale.value = val;
        _context.fallbackLocale = val;
        updateFallbackLocale(_context, _locale.value, _fallbackLocale.value);
      }
    });
  }
  const composer = {
    id: composerID,
    locale,
    fallbackLocale,
    get inheritLocale() {
      return _inheritLocale;
    },
    set inheritLocale(val) {
      _inheritLocale = val;
      if (val && __root) {
        _locale.value = __root.locale.value;
        _fallbackLocale.value = __root.fallbackLocale.value;
        updateFallbackLocale(_context, _locale.value, _fallbackLocale.value);
      }
    },
    get availableLocales() {
      return Object.keys(_messages.value).sort();
    },
    messages,
    get modifiers() {
      return _modifiers;
    },
    get pluralRules() {
      return _pluralRules || {};
    },
    get isGlobal() {
      return _isGlobal;
    },
    get missingWarn() {
      return _missingWarn;
    },
    set missingWarn(val) {
      _missingWarn = val;
      _context.missingWarn = _missingWarn;
    },
    get fallbackWarn() {
      return _fallbackWarn;
    },
    set fallbackWarn(val) {
      _fallbackWarn = val;
      _context.fallbackWarn = _fallbackWarn;
    },
    get fallbackRoot() {
      return _fallbackRoot;
    },
    set fallbackRoot(val) {
      _fallbackRoot = val;
    },
    get fallbackFormat() {
      return _fallbackFormat;
    },
    set fallbackFormat(val) {
      _fallbackFormat = val;
      _context.fallbackFormat = _fallbackFormat;
    },
    get warnHtmlMessage() {
      return _warnHtmlMessage;
    },
    set warnHtmlMessage(val) {
      _warnHtmlMessage = val;
      _context.warnHtmlMessage = val;
    },
    get escapeParameter() {
      return _escapeParameter;
    },
    set escapeParameter(val) {
      _escapeParameter = val;
      _context.escapeParameter = val;
    },
    t,
    getLocaleMessage,
    setLocaleMessage,
    mergeLocaleMessage,
    getPostTranslationHandler,
    setPostTranslationHandler,
    getMissingHandler,
    setMissingHandler,
    [SetPluralRulesSymbol]: setPluralRules
  };
  {
    composer.datetimeFormats = datetimeFormats;
    composer.numberFormats = numberFormats;
    composer.rt = rt;
    composer.te = te;
    composer.tm = tm;
    composer.d = d;
    composer.n = n;
    composer.getDateTimeFormat = getDateTimeFormat;
    composer.setDateTimeFormat = setDateTimeFormat;
    composer.mergeDateTimeFormat = mergeDateTimeFormat;
    composer.getNumberFormat = getNumberFormat;
    composer.setNumberFormat = setNumberFormat;
    composer.mergeNumberFormat = mergeNumberFormat;
    composer[InejctWithOptionSymbol] = __injectWithOption;
    composer[TranslateVNodeSymbol] = translateVNode;
    composer[DatetimePartsSymbol] = datetimeParts;
    composer[NumberPartsSymbol] = numberParts;
  }
  return composer;
}
function convertComposerOptions(options) {
  const locale = isString$2(options.locale) ? options.locale : DEFAULT_LOCALE$1;
  const fallbackLocale = isString$2(options.fallbackLocale) || isArray$1(options.fallbackLocale) || isPlainObject$1(options.fallbackLocale) || options.fallbackLocale === false ? options.fallbackLocale : locale;
  const missing = isFunction$2(options.missing) ? options.missing : void 0;
  const missingWarn = isBoolean$1(options.silentTranslationWarn) || isRegExp$1(options.silentTranslationWarn) ? !options.silentTranslationWarn : true;
  const fallbackWarn = isBoolean$1(options.silentFallbackWarn) || isRegExp$1(options.silentFallbackWarn) ? !options.silentFallbackWarn : true;
  const fallbackRoot = isBoolean$1(options.fallbackRoot) ? options.fallbackRoot : true;
  const fallbackFormat = !!options.formatFallbackMessages;
  const modifiers = isPlainObject$1(options.modifiers) ? options.modifiers : {};
  const pluralizationRules = options.pluralizationRules;
  const postTranslation = isFunction$2(options.postTranslation) ? options.postTranslation : void 0;
  const warnHtmlMessage = isString$2(options.warnHtmlInMessage) ? options.warnHtmlInMessage !== "off" : true;
  const escapeParameter = !!options.escapeParameterHtml;
  const inheritLocale = isBoolean$1(options.sync) ? options.sync : true;
  let messages = options.messages;
  if (isPlainObject$1(options.sharedMessages)) {
    const sharedMessages = options.sharedMessages;
    const locales = Object.keys(sharedMessages);
    messages = locales.reduce((messages2, locale2) => {
      const message = messages2[locale2] || (messages2[locale2] = {});
      assign$1(message, sharedMessages[locale2]);
      return messages2;
    }, messages || {});
  }
  const { __i18n, __root, __injectWithOption } = options;
  const datetimeFormats = options.datetimeFormats;
  const numberFormats = options.numberFormats;
  const flatJson = options.flatJson;
  const translateExistCompatible = options.translateExistCompatible;
  return {
    locale,
    fallbackLocale,
    messages,
    flatJson,
    datetimeFormats,
    numberFormats,
    missing,
    missingWarn,
    fallbackWarn,
    fallbackRoot,
    fallbackFormat,
    modifiers,
    pluralRules: pluralizationRules,
    postTranslation,
    warnHtmlMessage,
    escapeParameter,
    messageResolver: options.messageResolver,
    inheritLocale,
    translateExistCompatible,
    __i18n,
    __root,
    __injectWithOption
  };
}
function createVueI18n(options = {}, VueI18nLegacy) {
  {
    const composer = createComposer(convertComposerOptions(options));
    const { __extender } = options;
    const vueI18n = {
      // id
      id: composer.id,
      // locale
      get locale() {
        return composer.locale.value;
      },
      set locale(val) {
        composer.locale.value = val;
      },
      // fallbackLocale
      get fallbackLocale() {
        return composer.fallbackLocale.value;
      },
      set fallbackLocale(val) {
        composer.fallbackLocale.value = val;
      },
      // messages
      get messages() {
        return composer.messages.value;
      },
      // datetimeFormats
      get datetimeFormats() {
        return composer.datetimeFormats.value;
      },
      // numberFormats
      get numberFormats() {
        return composer.numberFormats.value;
      },
      // availableLocales
      get availableLocales() {
        return composer.availableLocales;
      },
      // formatter
      get formatter() {
        return {
          interpolate() {
            return [];
          }
        };
      },
      set formatter(val) {
      },
      // missing
      get missing() {
        return composer.getMissingHandler();
      },
      set missing(handler) {
        composer.setMissingHandler(handler);
      },
      // silentTranslationWarn
      get silentTranslationWarn() {
        return isBoolean$1(composer.missingWarn) ? !composer.missingWarn : composer.missingWarn;
      },
      set silentTranslationWarn(val) {
        composer.missingWarn = isBoolean$1(val) ? !val : val;
      },
      // silentFallbackWarn
      get silentFallbackWarn() {
        return isBoolean$1(composer.fallbackWarn) ? !composer.fallbackWarn : composer.fallbackWarn;
      },
      set silentFallbackWarn(val) {
        composer.fallbackWarn = isBoolean$1(val) ? !val : val;
      },
      // modifiers
      get modifiers() {
        return composer.modifiers;
      },
      // formatFallbackMessages
      get formatFallbackMessages() {
        return composer.fallbackFormat;
      },
      set formatFallbackMessages(val) {
        composer.fallbackFormat = val;
      },
      // postTranslation
      get postTranslation() {
        return composer.getPostTranslationHandler();
      },
      set postTranslation(handler) {
        composer.setPostTranslationHandler(handler);
      },
      // sync
      get sync() {
        return composer.inheritLocale;
      },
      set sync(val) {
        composer.inheritLocale = val;
      },
      // warnInHtmlMessage
      get warnHtmlInMessage() {
        return composer.warnHtmlMessage ? "warn" : "off";
      },
      set warnHtmlInMessage(val) {
        composer.warnHtmlMessage = val !== "off";
      },
      // escapeParameterHtml
      get escapeParameterHtml() {
        return composer.escapeParameter;
      },
      set escapeParameterHtml(val) {
        composer.escapeParameter = val;
      },
      // preserveDirectiveContent
      get preserveDirectiveContent() {
        return true;
      },
      set preserveDirectiveContent(val) {
      },
      // pluralizationRules
      get pluralizationRules() {
        return composer.pluralRules || {};
      },
      // for internal
      __composer: composer,
      // t
      t(...args) {
        const [arg1, arg2, arg3] = args;
        const options2 = {};
        let list = null;
        let named = null;
        if (!isString$2(arg1)) {
          throw createI18nError(I18nErrorCodes.INVALID_ARGUMENT);
        }
        const key = arg1;
        if (isString$2(arg2)) {
          options2.locale = arg2;
        } else if (isArray$1(arg2)) {
          list = arg2;
        } else if (isPlainObject$1(arg2)) {
          named = arg2;
        }
        if (isArray$1(arg3)) {
          list = arg3;
        } else if (isPlainObject$1(arg3)) {
          named = arg3;
        }
        return Reflect.apply(composer.t, composer, [
          key,
          list || named || {},
          options2
        ]);
      },
      rt(...args) {
        return Reflect.apply(composer.rt, composer, [...args]);
      },
      // tc
      tc(...args) {
        const [arg1, arg2, arg3] = args;
        const options2 = { plural: 1 };
        let list = null;
        let named = null;
        if (!isString$2(arg1)) {
          throw createI18nError(I18nErrorCodes.INVALID_ARGUMENT);
        }
        const key = arg1;
        if (isString$2(arg2)) {
          options2.locale = arg2;
        } else if (isNumber$1(arg2)) {
          options2.plural = arg2;
        } else if (isArray$1(arg2)) {
          list = arg2;
        } else if (isPlainObject$1(arg2)) {
          named = arg2;
        }
        if (isString$2(arg3)) {
          options2.locale = arg3;
        } else if (isArray$1(arg3)) {
          list = arg3;
        } else if (isPlainObject$1(arg3)) {
          named = arg3;
        }
        return Reflect.apply(composer.t, composer, [
          key,
          list || named || {},
          options2
        ]);
      },
      // te
      te(key, locale) {
        return composer.te(key, locale);
      },
      // tm
      tm(key) {
        return composer.tm(key);
      },
      // getLocaleMessage
      getLocaleMessage(locale) {
        return composer.getLocaleMessage(locale);
      },
      // setLocaleMessage
      setLocaleMessage(locale, message) {
        composer.setLocaleMessage(locale, message);
      },
      // mergeLocaleMessage
      mergeLocaleMessage(locale, message) {
        composer.mergeLocaleMessage(locale, message);
      },
      // d
      d(...args) {
        return Reflect.apply(composer.d, composer, [...args]);
      },
      // getDateTimeFormat
      getDateTimeFormat(locale) {
        return composer.getDateTimeFormat(locale);
      },
      // setDateTimeFormat
      setDateTimeFormat(locale, format2) {
        composer.setDateTimeFormat(locale, format2);
      },
      // mergeDateTimeFormat
      mergeDateTimeFormat(locale, format2) {
        composer.mergeDateTimeFormat(locale, format2);
      },
      // n
      n(...args) {
        return Reflect.apply(composer.n, composer, [...args]);
      },
      // getNumberFormat
      getNumberFormat(locale) {
        return composer.getNumberFormat(locale);
      },
      // setNumberFormat
      setNumberFormat(locale, format2) {
        composer.setNumberFormat(locale, format2);
      },
      // mergeNumberFormat
      mergeNumberFormat(locale, format2) {
        composer.mergeNumberFormat(locale, format2);
      },
      // getChoiceIndex
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      getChoiceIndex(choice, choicesLength) {
        return -1;
      }
    };
    vueI18n.__extender = __extender;
    return vueI18n;
  }
}
const baseFormatProps = {
  tag: {
    type: [String, Object]
  },
  locale: {
    type: String
  },
  scope: {
    type: String,
    // NOTE: avoid https://github.com/microsoft/rushstack/issues/1050
    validator: (val) => val === "parent" || val === "global",
    default: "parent"
    /* ComponentI18nScope */
  },
  i18n: {
    type: Object
  }
};
function getInterpolateArg({ slots }, keys) {
  if (keys.length === 1 && keys[0] === "default") {
    const ret = slots.default ? slots.default() : [];
    return ret.reduce((slot, current) => {
      return [
        ...slot,
        // prettier-ignore
        ...current.type === Fragment ? current.children : [current]
      ];
    }, []);
  } else {
    return keys.reduce((arg, key) => {
      const slot = slots[key];
      if (slot) {
        arg[key] = slot();
      }
      return arg;
    }, create$1());
  }
}
function getFragmentableTag(tag) {
  return Fragment;
}
const TranslationImpl = /* @__PURE__ */ defineComponent({
  /* eslint-disable */
  name: "i18n-t",
  props: assign$1({
    keypath: {
      type: String,
      required: true
    },
    plural: {
      type: [Number, String],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validator: (val) => isNumber$1(val) || !isNaN(val)
    }
  }, baseFormatProps),
  /* eslint-enable */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setup(props, context) {
    const { slots, attrs } = context;
    const i18n = props.i18n || useI18n({
      useScope: props.scope,
      __useComponent: true
    });
    return () => {
      const keys = Object.keys(slots).filter((key) => key !== "_");
      const options = create$1();
      if (props.locale) {
        options.locale = props.locale;
      }
      if (props.plural !== void 0) {
        options.plural = isString$2(props.plural) ? +props.plural : props.plural;
      }
      const arg = getInterpolateArg(context, keys);
      const children = i18n[TranslateVNodeSymbol](props.keypath, arg, options);
      const assignedAttrs = assign$1(create$1(), attrs);
      const tag = isString$2(props.tag) || isObject$2(props.tag) ? props.tag : getFragmentableTag();
      return h(tag, assignedAttrs, children);
    };
  }
});
const Translation = TranslationImpl;
function isVNode(target) {
  return isArray$1(target) && !isString$2(target[0]);
}
function renderFormatter(props, context, slotKeys, partFormatter) {
  const { slots, attrs } = context;
  return () => {
    const options = { part: true };
    let overrides = create$1();
    if (props.locale) {
      options.locale = props.locale;
    }
    if (isString$2(props.format)) {
      options.key = props.format;
    } else if (isObject$2(props.format)) {
      if (isString$2(props.format.key)) {
        options.key = props.format.key;
      }
      overrides = Object.keys(props.format).reduce((options2, prop) => {
        return slotKeys.includes(prop) ? assign$1(create$1(), options2, { [prop]: props.format[prop] }) : options2;
      }, create$1());
    }
    const parts = partFormatter(...[props.value, options, overrides]);
    let children = [options.key];
    if (isArray$1(parts)) {
      children = parts.map((part, index) => {
        const slot = slots[part.type];
        const node = slot ? slot({ [part.type]: part.value, index, parts }) : [part.value];
        if (isVNode(node)) {
          node[0].key = `${part.type}-${index}`;
        }
        return node;
      });
    } else if (isString$2(parts)) {
      children = [parts];
    }
    const assignedAttrs = assign$1(create$1(), attrs);
    const tag = isString$2(props.tag) || isObject$2(props.tag) ? props.tag : getFragmentableTag();
    return h(tag, assignedAttrs, children);
  };
}
const NumberFormatImpl = /* @__PURE__ */ defineComponent({
  /* eslint-disable */
  name: "i18n-n",
  props: assign$1({
    value: {
      type: Number,
      required: true
    },
    format: {
      type: [String, Object]
    }
  }, baseFormatProps),
  /* eslint-enable */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setup(props, context) {
    const i18n = props.i18n || useI18n({
      useScope: props.scope,
      __useComponent: true
    });
    return renderFormatter(props, context, NUMBER_FORMAT_OPTIONS_KEYS, (...args) => (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      i18n[NumberPartsSymbol](...args)
    ));
  }
});
const NumberFormat = NumberFormatImpl;
const DatetimeFormatImpl = /* @__PURE__ */ defineComponent({
  /* eslint-disable */
  name: "i18n-d",
  props: assign$1({
    value: {
      type: [Number, Date],
      required: true
    },
    format: {
      type: [String, Object]
    }
  }, baseFormatProps),
  /* eslint-enable */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setup(props, context) {
    const i18n = props.i18n || useI18n({
      useScope: props.scope,
      __useComponent: true
    });
    return renderFormatter(props, context, DATETIME_FORMAT_OPTIONS_KEYS, (...args) => (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      i18n[DatetimePartsSymbol](...args)
    ));
  }
});
const DatetimeFormat = DatetimeFormatImpl;
function getComposer$2(i18n, instance) {
  const i18nInternal = i18n;
  if (i18n.mode === "composition") {
    return i18nInternal.__getInstance(instance) || i18n.global;
  } else {
    const vueI18n = i18nInternal.__getInstance(instance);
    return vueI18n != null ? vueI18n.__composer : i18n.global.__composer;
  }
}
function vTDirective(i18n) {
  const _process = (binding) => {
    const { instance, modifiers, value } = binding;
    if (!instance || !instance.$) {
      throw createI18nError(I18nErrorCodes.UNEXPECTED_ERROR);
    }
    const composer = getComposer$2(i18n, instance.$);
    const parsedValue = parseValue(value);
    return [
      Reflect.apply(composer.t, composer, [...makeParams(parsedValue)]),
      composer
    ];
  };
  const register = (el, binding) => {
    const [textContent, composer] = _process(binding);
    if (inBrowser && i18n.global === composer) {
      el.__i18nWatcher = watch(composer.locale, () => {
        binding.instance && binding.instance.$forceUpdate();
      });
    }
    el.__composer = composer;
    el.textContent = textContent;
  };
  const unregister = (el) => {
    if (inBrowser && el.__i18nWatcher) {
      el.__i18nWatcher();
      el.__i18nWatcher = void 0;
      delete el.__i18nWatcher;
    }
    if (el.__composer) {
      el.__composer = void 0;
      delete el.__composer;
    }
  };
  const update = (el, { value }) => {
    if (el.__composer) {
      const composer = el.__composer;
      const parsedValue = parseValue(value);
      el.textContent = Reflect.apply(composer.t, composer, [
        ...makeParams(parsedValue)
      ]);
    }
  };
  const getSSRProps = (binding) => {
    const [textContent] = _process(binding);
    return { textContent };
  };
  return {
    created: register,
    unmounted: unregister,
    beforeUpdate: update,
    getSSRProps
  };
}
function parseValue(value) {
  if (isString$2(value)) {
    return { path: value };
  } else if (isPlainObject$1(value)) {
    if (!("path" in value)) {
      throw createI18nError(I18nErrorCodes.REQUIRED_VALUE, "path");
    }
    return value;
  } else {
    throw createI18nError(I18nErrorCodes.INVALID_VALUE);
  }
}
function makeParams(value) {
  const { path, locale, args, choice, plural } = value;
  const options = {};
  const named = args || {};
  if (isString$2(locale)) {
    options.locale = locale;
  }
  if (isNumber$1(choice)) {
    options.plural = choice;
  }
  if (isNumber$1(plural)) {
    options.plural = plural;
  }
  return [path, named, options];
}
function apply(app, i18n, ...options) {
  const pluginOptions = isPlainObject$1(options[0]) ? options[0] : {};
  const useI18nComponentName = !!pluginOptions.useI18nComponentName;
  const globalInstall = isBoolean$1(pluginOptions.globalInstall) ? pluginOptions.globalInstall : true;
  if (globalInstall) {
    [!useI18nComponentName ? Translation.name : "i18n", "I18nT"].forEach((name) => app.component(name, Translation));
    [NumberFormat.name, "I18nN"].forEach((name) => app.component(name, NumberFormat));
    [DatetimeFormat.name, "I18nD"].forEach((name) => app.component(name, DatetimeFormat));
  }
  {
    app.directive("t", vTDirective(i18n));
  }
}
function defineMixin(vuei18n, composer, i18n) {
  return {
    beforeCreate() {
      const instance = getCurrentInstance();
      if (!instance) {
        throw createI18nError(I18nErrorCodes.UNEXPECTED_ERROR);
      }
      const options = this.$options;
      if (options.i18n) {
        const optionsI18n = options.i18n;
        if (options.__i18n) {
          optionsI18n.__i18n = options.__i18n;
        }
        optionsI18n.__root = composer;
        if (this === this.$root) {
          this.$i18n = mergeToGlobal(vuei18n, optionsI18n);
        } else {
          optionsI18n.__injectWithOption = true;
          optionsI18n.__extender = i18n.__vueI18nExtend;
          this.$i18n = createVueI18n(optionsI18n);
          const _vueI18n = this.$i18n;
          if (_vueI18n.__extender) {
            _vueI18n.__disposer = _vueI18n.__extender(this.$i18n);
          }
        }
      } else if (options.__i18n) {
        if (this === this.$root) {
          this.$i18n = mergeToGlobal(vuei18n, options);
        } else {
          this.$i18n = createVueI18n({
            __i18n: options.__i18n,
            __injectWithOption: true,
            __extender: i18n.__vueI18nExtend,
            __root: composer
          });
          const _vueI18n = this.$i18n;
          if (_vueI18n.__extender) {
            _vueI18n.__disposer = _vueI18n.__extender(this.$i18n);
          }
        }
      } else {
        this.$i18n = vuei18n;
      }
      if (options.__i18nGlobal) {
        adjustI18nResources(composer, options, options);
      }
      this.$t = (...args) => this.$i18n.t(...args);
      this.$rt = (...args) => this.$i18n.rt(...args);
      this.$tc = (...args) => this.$i18n.tc(...args);
      this.$te = (key, locale) => this.$i18n.te(key, locale);
      this.$d = (...args) => this.$i18n.d(...args);
      this.$n = (...args) => this.$i18n.n(...args);
      this.$tm = (key) => this.$i18n.tm(key);
      i18n.__setInstance(instance, this.$i18n);
    },
    mounted() {
    },
    unmounted() {
      const instance = getCurrentInstance();
      if (!instance) {
        throw createI18nError(I18nErrorCodes.UNEXPECTED_ERROR);
      }
      const _vueI18n = this.$i18n;
      delete this.$t;
      delete this.$rt;
      delete this.$tc;
      delete this.$te;
      delete this.$d;
      delete this.$n;
      delete this.$tm;
      if (_vueI18n.__disposer) {
        _vueI18n.__disposer();
        delete _vueI18n.__disposer;
        delete _vueI18n.__extender;
      }
      i18n.__deleteInstance(instance);
      delete this.$i18n;
    }
  };
}
function mergeToGlobal(g, options) {
  g.locale = options.locale || g.locale;
  g.fallbackLocale = options.fallbackLocale || g.fallbackLocale;
  g.missing = options.missing || g.missing;
  g.silentTranslationWarn = options.silentTranslationWarn || g.silentFallbackWarn;
  g.silentFallbackWarn = options.silentFallbackWarn || g.silentFallbackWarn;
  g.formatFallbackMessages = options.formatFallbackMessages || g.formatFallbackMessages;
  g.postTranslation = options.postTranslation || g.postTranslation;
  g.warnHtmlInMessage = options.warnHtmlInMessage || g.warnHtmlInMessage;
  g.escapeParameterHtml = options.escapeParameterHtml || g.escapeParameterHtml;
  g.sync = options.sync || g.sync;
  g.__composer[SetPluralRulesSymbol](options.pluralizationRules || g.pluralizationRules);
  const messages = getLocaleMessages(g.locale, {
    messages: options.messages,
    __i18n: options.__i18n
  });
  Object.keys(messages).forEach((locale) => g.mergeLocaleMessage(locale, messages[locale]));
  if (options.datetimeFormats) {
    Object.keys(options.datetimeFormats).forEach((locale) => g.mergeDateTimeFormat(locale, options.datetimeFormats[locale]));
  }
  if (options.numberFormats) {
    Object.keys(options.numberFormats).forEach((locale) => g.mergeNumberFormat(locale, options.numberFormats[locale]));
  }
  return g;
}
const I18nInjectionKey = /* @__PURE__ */ makeSymbol("global-vue-i18n");
function createI18n(options = {}, VueI18nLegacy) {
  const __legacyMode = __VUE_I18N_LEGACY_API__ && isBoolean$1(options.legacy) ? options.legacy : __VUE_I18N_LEGACY_API__;
  const __globalInjection = isBoolean$1(options.globalInjection) ? options.globalInjection : true;
  const __allowComposition = __VUE_I18N_LEGACY_API__ && __legacyMode ? !!options.allowComposition : true;
  const __instances = /* @__PURE__ */ new Map();
  const [globalScope, __global] = createGlobal(options, __legacyMode);
  const symbol = /* @__PURE__ */ makeSymbol("");
  function __getInstance(component) {
    return __instances.get(component) || null;
  }
  function __setInstance(component, instance) {
    __instances.set(component, instance);
  }
  function __deleteInstance(component) {
    __instances.delete(component);
  }
  {
    const i18n = {
      // mode
      get mode() {
        return __VUE_I18N_LEGACY_API__ && __legacyMode ? "legacy" : "composition";
      },
      // allowComposition
      get allowComposition() {
        return __allowComposition;
      },
      // install plugin
      async install(app, ...options2) {
        app.__VUE_I18N_SYMBOL__ = symbol;
        app.provide(app.__VUE_I18N_SYMBOL__, i18n);
        if (isPlainObject$1(options2[0])) {
          const opts = options2[0];
          i18n.__composerExtend = opts.__composerExtend;
          i18n.__vueI18nExtend = opts.__vueI18nExtend;
        }
        let globalReleaseHandler = null;
        if (!__legacyMode && __globalInjection) {
          globalReleaseHandler = injectGlobalFields(app, i18n.global);
        }
        if (__VUE_I18N_FULL_INSTALL__) {
          apply(app, i18n, ...options2);
        }
        if (__VUE_I18N_LEGACY_API__ && __legacyMode) {
          app.mixin(defineMixin(__global, __global.__composer, i18n));
        }
        const unmountApp = app.unmount;
        app.unmount = () => {
          globalReleaseHandler && globalReleaseHandler();
          i18n.dispose();
          unmountApp();
        };
      },
      // global accessor
      get global() {
        return __global;
      },
      dispose() {
        globalScope.stop();
      },
      // @internal
      __instances,
      // @internal
      __getInstance,
      // @internal
      __setInstance,
      // @internal
      __deleteInstance
    };
    return i18n;
  }
}
function useI18n(options = {}) {
  const instance = getCurrentInstance();
  if (instance == null) {
    throw createI18nError(I18nErrorCodes.MUST_BE_CALL_SETUP_TOP);
  }
  if (!instance.isCE && instance.appContext.app != null && !instance.appContext.app.__VUE_I18N_SYMBOL__) {
    throw createI18nError(I18nErrorCodes.NOT_INSTALLED);
  }
  const i18n = getI18nInstance(instance);
  const gl = getGlobalComposer(i18n);
  const componentOptions = getComponentOptions(instance);
  const scope = getScope(options, componentOptions);
  if (__VUE_I18N_LEGACY_API__) {
    if (i18n.mode === "legacy" && !options.__useComponent) {
      if (!i18n.allowComposition) {
        throw createI18nError(I18nErrorCodes.NOT_AVAILABLE_IN_LEGACY_MODE);
      }
      return useI18nForLegacy(instance, scope, gl, options);
    }
  }
  if (scope === "global") {
    adjustI18nResources(gl, options, componentOptions);
    return gl;
  }
  if (scope === "parent") {
    let composer2 = getComposer(i18n, instance, options.__useComponent);
    if (composer2 == null) {
      composer2 = gl;
    }
    return composer2;
  }
  const i18nInternal = i18n;
  let composer = i18nInternal.__getInstance(instance);
  if (composer == null) {
    const composerOptions = assign$1({}, options);
    if ("__i18n" in componentOptions) {
      composerOptions.__i18n = componentOptions.__i18n;
    }
    if (gl) {
      composerOptions.__root = gl;
    }
    composer = createComposer(composerOptions);
    if (i18nInternal.__composerExtend) {
      composer[DisposeSymbol] = i18nInternal.__composerExtend(composer);
    }
    setupLifeCycle(i18nInternal, instance, composer);
    i18nInternal.__setInstance(instance, composer);
  }
  return composer;
}
function createGlobal(options, legacyMode, VueI18nLegacy) {
  const scope = effectScope();
  {
    const obj = __VUE_I18N_LEGACY_API__ && legacyMode ? scope.run(() => createVueI18n(options)) : scope.run(() => createComposer(options));
    if (obj == null) {
      throw createI18nError(I18nErrorCodes.UNEXPECTED_ERROR);
    }
    return [scope, obj];
  }
}
function getI18nInstance(instance) {
  {
    const i18n = inject(!instance.isCE ? instance.appContext.app.__VUE_I18N_SYMBOL__ : I18nInjectionKey);
    if (!i18n) {
      throw createI18nError(!instance.isCE ? I18nErrorCodes.UNEXPECTED_ERROR : I18nErrorCodes.NOT_INSTALLED_WITH_PROVIDE);
    }
    return i18n;
  }
}
function getScope(options, componentOptions) {
  return isEmptyObject$1(options) ? "__i18n" in componentOptions ? "local" : "global" : !options.useScope ? "local" : options.useScope;
}
function getGlobalComposer(i18n) {
  return i18n.mode === "composition" ? i18n.global : i18n.global.__composer;
}
function getComposer(i18n, target, useComponent = false) {
  let composer = null;
  const root = target.root;
  let current = getParentComponentInstance(target, useComponent);
  while (current != null) {
    const i18nInternal = i18n;
    if (i18n.mode === "composition") {
      composer = i18nInternal.__getInstance(current);
    } else {
      if (__VUE_I18N_LEGACY_API__) {
        const vueI18n = i18nInternal.__getInstance(current);
        if (vueI18n != null) {
          composer = vueI18n.__composer;
          if (useComponent && composer && !composer[InejctWithOptionSymbol]) {
            composer = null;
          }
        }
      }
    }
    if (composer != null) {
      break;
    }
    if (root === current) {
      break;
    }
    current = current.parent;
  }
  return composer;
}
function getParentComponentInstance(target, useComponent = false) {
  if (target == null) {
    return null;
  }
  {
    return !useComponent ? target.parent : target.vnode.ctx || target.parent;
  }
}
function setupLifeCycle(i18n, target, composer) {
  {
    onMounted(() => {
    }, target);
    onUnmounted(() => {
      const _composer = composer;
      i18n.__deleteInstance(target);
      const dispose = _composer[DisposeSymbol];
      if (dispose) {
        dispose();
        delete _composer[DisposeSymbol];
      }
    }, target);
  }
}
function useI18nForLegacy(instance, scope, root, options = {}) {
  const isLocalScope = scope === "local";
  const _composer = shallowRef(null);
  if (isLocalScope && instance.proxy && !(instance.proxy.$options.i18n || instance.proxy.$options.__i18n)) {
    throw createI18nError(I18nErrorCodes.MUST_DEFINE_I18N_OPTION_IN_ALLOW_COMPOSITION);
  }
  const _inheritLocale = isBoolean$1(options.inheritLocale) ? options.inheritLocale : !isString$2(options.locale);
  const _locale = ref(
    // prettier-ignore
    !isLocalScope || _inheritLocale ? root.locale.value : isString$2(options.locale) ? options.locale : DEFAULT_LOCALE$1
  );
  const _fallbackLocale = ref(
    // prettier-ignore
    !isLocalScope || _inheritLocale ? root.fallbackLocale.value : isString$2(options.fallbackLocale) || isArray$1(options.fallbackLocale) || isPlainObject$1(options.fallbackLocale) || options.fallbackLocale === false ? options.fallbackLocale : _locale.value
  );
  const _messages = ref(getLocaleMessages(_locale.value, options));
  const _datetimeFormats = ref(isPlainObject$1(options.datetimeFormats) ? options.datetimeFormats : { [_locale.value]: {} });
  const _numberFormats = ref(isPlainObject$1(options.numberFormats) ? options.numberFormats : { [_locale.value]: {} });
  const _missingWarn = isLocalScope ? root.missingWarn : isBoolean$1(options.missingWarn) || isRegExp$1(options.missingWarn) ? options.missingWarn : true;
  const _fallbackWarn = isLocalScope ? root.fallbackWarn : isBoolean$1(options.fallbackWarn) || isRegExp$1(options.fallbackWarn) ? options.fallbackWarn : true;
  const _fallbackRoot = isLocalScope ? root.fallbackRoot : isBoolean$1(options.fallbackRoot) ? options.fallbackRoot : true;
  const _fallbackFormat = !!options.fallbackFormat;
  const _missing = isFunction$2(options.missing) ? options.missing : null;
  const _postTranslation = isFunction$2(options.postTranslation) ? options.postTranslation : null;
  const _warnHtmlMessage = isLocalScope ? root.warnHtmlMessage : isBoolean$1(options.warnHtmlMessage) ? options.warnHtmlMessage : true;
  const _escapeParameter = !!options.escapeParameter;
  const _modifiers = isLocalScope ? root.modifiers : isPlainObject$1(options.modifiers) ? options.modifiers : {};
  const _pluralRules = options.pluralRules || isLocalScope && root.pluralRules;
  function trackReactivityValues() {
    return [
      _locale.value,
      _fallbackLocale.value,
      _messages.value,
      _datetimeFormats.value,
      _numberFormats.value
    ];
  }
  const locale = computed({
    get: () => {
      return _composer.value ? _composer.value.locale.value : _locale.value;
    },
    set: (val) => {
      if (_composer.value) {
        _composer.value.locale.value = val;
      }
      _locale.value = val;
    }
  });
  const fallbackLocale = computed({
    get: () => {
      return _composer.value ? _composer.value.fallbackLocale.value : _fallbackLocale.value;
    },
    set: (val) => {
      if (_composer.value) {
        _composer.value.fallbackLocale.value = val;
      }
      _fallbackLocale.value = val;
    }
  });
  const messages = computed(() => {
    if (_composer.value) {
      return _composer.value.messages.value;
    } else {
      return _messages.value;
    }
  });
  const datetimeFormats = computed(() => _datetimeFormats.value);
  const numberFormats = computed(() => _numberFormats.value);
  function getPostTranslationHandler() {
    return _composer.value ? _composer.value.getPostTranslationHandler() : _postTranslation;
  }
  function setPostTranslationHandler(handler) {
    if (_composer.value) {
      _composer.value.setPostTranslationHandler(handler);
    }
  }
  function getMissingHandler() {
    return _composer.value ? _composer.value.getMissingHandler() : _missing;
  }
  function setMissingHandler(handler) {
    if (_composer.value) {
      _composer.value.setMissingHandler(handler);
    }
  }
  function warpWithDeps(fn) {
    trackReactivityValues();
    return fn();
  }
  function t(...args) {
    return _composer.value ? warpWithDeps(() => Reflect.apply(_composer.value.t, null, [...args])) : warpWithDeps(() => "");
  }
  function rt(...args) {
    return _composer.value ? Reflect.apply(_composer.value.rt, null, [...args]) : "";
  }
  function d(...args) {
    return _composer.value ? warpWithDeps(() => Reflect.apply(_composer.value.d, null, [...args])) : warpWithDeps(() => "");
  }
  function n(...args) {
    return _composer.value ? warpWithDeps(() => Reflect.apply(_composer.value.n, null, [...args])) : warpWithDeps(() => "");
  }
  function tm(key) {
    return _composer.value ? _composer.value.tm(key) : {};
  }
  function te(key, locale2) {
    return _composer.value ? _composer.value.te(key, locale2) : false;
  }
  function getLocaleMessage(locale2) {
    return _composer.value ? _composer.value.getLocaleMessage(locale2) : {};
  }
  function setLocaleMessage(locale2, message) {
    if (_composer.value) {
      _composer.value.setLocaleMessage(locale2, message);
      _messages.value[locale2] = message;
    }
  }
  function mergeLocaleMessage(locale2, message) {
    if (_composer.value) {
      _composer.value.mergeLocaleMessage(locale2, message);
    }
  }
  function getDateTimeFormat(locale2) {
    return _composer.value ? _composer.value.getDateTimeFormat(locale2) : {};
  }
  function setDateTimeFormat(locale2, format2) {
    if (_composer.value) {
      _composer.value.setDateTimeFormat(locale2, format2);
      _datetimeFormats.value[locale2] = format2;
    }
  }
  function mergeDateTimeFormat(locale2, format2) {
    if (_composer.value) {
      _composer.value.mergeDateTimeFormat(locale2, format2);
    }
  }
  function getNumberFormat(locale2) {
    return _composer.value ? _composer.value.getNumberFormat(locale2) : {};
  }
  function setNumberFormat(locale2, format2) {
    if (_composer.value) {
      _composer.value.setNumberFormat(locale2, format2);
      _numberFormats.value[locale2] = format2;
    }
  }
  function mergeNumberFormat(locale2, format2) {
    if (_composer.value) {
      _composer.value.mergeNumberFormat(locale2, format2);
    }
  }
  const wrapper = {
    get id() {
      return _composer.value ? _composer.value.id : -1;
    },
    locale,
    fallbackLocale,
    messages,
    datetimeFormats,
    numberFormats,
    get inheritLocale() {
      return _composer.value ? _composer.value.inheritLocale : _inheritLocale;
    },
    set inheritLocale(val) {
      if (_composer.value) {
        _composer.value.inheritLocale = val;
      }
    },
    get availableLocales() {
      return _composer.value ? _composer.value.availableLocales : Object.keys(_messages.value);
    },
    get modifiers() {
      return _composer.value ? _composer.value.modifiers : _modifiers;
    },
    get pluralRules() {
      return _composer.value ? _composer.value.pluralRules : _pluralRules;
    },
    get isGlobal() {
      return _composer.value ? _composer.value.isGlobal : false;
    },
    get missingWarn() {
      return _composer.value ? _composer.value.missingWarn : _missingWarn;
    },
    set missingWarn(val) {
      if (_composer.value) {
        _composer.value.missingWarn = val;
      }
    },
    get fallbackWarn() {
      return _composer.value ? _composer.value.fallbackWarn : _fallbackWarn;
    },
    set fallbackWarn(val) {
      if (_composer.value) {
        _composer.value.missingWarn = val;
      }
    },
    get fallbackRoot() {
      return _composer.value ? _composer.value.fallbackRoot : _fallbackRoot;
    },
    set fallbackRoot(val) {
      if (_composer.value) {
        _composer.value.fallbackRoot = val;
      }
    },
    get fallbackFormat() {
      return _composer.value ? _composer.value.fallbackFormat : _fallbackFormat;
    },
    set fallbackFormat(val) {
      if (_composer.value) {
        _composer.value.fallbackFormat = val;
      }
    },
    get warnHtmlMessage() {
      return _composer.value ? _composer.value.warnHtmlMessage : _warnHtmlMessage;
    },
    set warnHtmlMessage(val) {
      if (_composer.value) {
        _composer.value.warnHtmlMessage = val;
      }
    },
    get escapeParameter() {
      return _composer.value ? _composer.value.escapeParameter : _escapeParameter;
    },
    set escapeParameter(val) {
      if (_composer.value) {
        _composer.value.escapeParameter = val;
      }
    },
    t,
    getPostTranslationHandler,
    setPostTranslationHandler,
    getMissingHandler,
    setMissingHandler,
    rt,
    d,
    n,
    tm,
    te,
    getLocaleMessage,
    setLocaleMessage,
    mergeLocaleMessage,
    getDateTimeFormat,
    setDateTimeFormat,
    mergeDateTimeFormat,
    getNumberFormat,
    setNumberFormat,
    mergeNumberFormat
  };
  function sync(composer) {
    composer.locale.value = _locale.value;
    composer.fallbackLocale.value = _fallbackLocale.value;
    Object.keys(_messages.value).forEach((locale2) => {
      composer.mergeLocaleMessage(locale2, _messages.value[locale2]);
    });
    Object.keys(_datetimeFormats.value).forEach((locale2) => {
      composer.mergeDateTimeFormat(locale2, _datetimeFormats.value[locale2]);
    });
    Object.keys(_numberFormats.value).forEach((locale2) => {
      composer.mergeNumberFormat(locale2, _numberFormats.value[locale2]);
    });
    composer.escapeParameter = _escapeParameter;
    composer.fallbackFormat = _fallbackFormat;
    composer.fallbackRoot = _fallbackRoot;
    composer.fallbackWarn = _fallbackWarn;
    composer.missingWarn = _missingWarn;
    composer.warnHtmlMessage = _warnHtmlMessage;
  }
  onBeforeMount(() => {
    if (instance.proxy == null || instance.proxy.$i18n == null) {
      throw createI18nError(I18nErrorCodes.NOT_AVAILABLE_COMPOSITION_IN_LEGACY);
    }
    const composer = _composer.value = instance.proxy.$i18n.__composer;
    if (scope === "global") {
      _locale.value = composer.locale.value;
      _fallbackLocale.value = composer.fallbackLocale.value;
      _messages.value = composer.messages.value;
      _datetimeFormats.value = composer.datetimeFormats.value;
      _numberFormats.value = composer.numberFormats.value;
    } else if (isLocalScope) {
      sync(composer);
    }
  });
  return wrapper;
}
const globalExportProps = [
  "locale",
  "fallbackLocale",
  "availableLocales"
];
const globalExportMethods = ["t", "rt", "d", "n", "tm", "te"];
function injectGlobalFields(app, composer) {
  const i18n = /* @__PURE__ */ Object.create(null);
  globalExportProps.forEach((prop) => {
    const desc = Object.getOwnPropertyDescriptor(composer, prop);
    if (!desc) {
      throw createI18nError(I18nErrorCodes.UNEXPECTED_ERROR);
    }
    const wrap = isRef(desc.value) ? {
      get() {
        return desc.value.value;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set(val) {
        desc.value.value = val;
      }
    } : {
      get() {
        return desc.get && desc.get();
      }
    };
    Object.defineProperty(i18n, prop, wrap);
  });
  app.config.globalProperties.$i18n = i18n;
  globalExportMethods.forEach((method) => {
    const desc = Object.getOwnPropertyDescriptor(composer, method);
    if (!desc || !desc.value) {
      throw createI18nError(I18nErrorCodes.UNEXPECTED_ERROR);
    }
    Object.defineProperty(app.config.globalProperties, `$${method}`, desc);
  });
  const dispose = () => {
    delete app.config.globalProperties.$i18n;
    globalExportMethods.forEach((method) => {
      delete app.config.globalProperties[`$${method}`];
    });
  };
  return dispose;
}
{
  initFeatureFlags();
}
if (__INTLIFY_JIT_COMPILATION__) {
  registerMessageCompiler(compile);
} else {
  registerMessageCompiler(compileToFunction);
}
registerMessageResolver(resolveValue);
registerLocaleFallbacker(fallbackWithLocaleChain);
if (__INTLIFY_PROD_DEVTOOLS__) {
  const target = getGlobalThis();
  target.__INTLIFY__ = true;
  setDevToolsHook(target.__INTLIFY_DEVTOOLS_GLOBAL_HOOK__);
}

/**
 * 简体中文语言包(P1 框架级词条;P2 逐步迁移全部 UI 文案至此)
 * 结构:命名空间.键 = 中文文案
 */
const zhCN = {
  locale: {
    switch: '切换语言',
    hint: '按 Alt+L 快速切换',
    'zh-CN': '简体中文',
    en: 'English',
  },
  common: {
    confirm: '确定',
    cancel: '取消',
    save: '保存',
    close: '关闭',
    search: '搜索',
    refresh: '刷新',
    add: '新增',
    edit: '修改',
    delete: '删除',
    export: '导出',
    import: '导入',
    submit: '提交',
    reset: '重置',
    loading: '加载中…',
    empty: '暂无数据',
    yes: '是',
    no: '否',
    all: '全部',
    success: '操作成功',
    failed: '操作失败',
  },
  topbar: {
    selectFactory: '选择工厂',
    refreshFactories: '刷新企业名字',
    certified: '已认证',
    loginDate: '登录日期',
    serviceEnd: '服务到期',
    searchPlaceholder: '搜索-产品功能',
    noMatch: '无匹配菜单',
  },
  login: {
    title: '登录',
    account: '账号',
    password: '密码',
    loginButton: '登 录',
    logout: '退出登录',
  },
};

/** Supported locales at build time(zh-CN 恒在首位;其余来自后端 yj_locale 注册表动态扩展)。 */
const SUPPORTED = ['zh-CN', 'zh-TW', 'en'];

/** localStorage key for the anonymous/local fallback preference. */
const LOCALE_KEY = 'mes_locale';

/** Default locale when nothing is saved and the browser gives no signal. */
const DEFAULT_LOCALE = 'zh-CN';

/**
 * Resolve the initial locale: saved preference wins, then browser language,
 * then the default. Per-user memory (yj_user.locale) is applied by the locale
 * store after login once the backend endpoint lands (P3).
 */
function detectLocale() {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved
  } catch { /* localStorage unavailable — fall through */ }
  const nav = String(navigator.language || '').toLowerCase();
  if (nav.startsWith('en')) return 'en'
  return DEFAULT_LOCALE
}

/** 有本地静态语言包的 locale(动态 import 的映射表;vite 据此为每个包建独立 chunk)。 */
const PACKS = {
  'zh-TW': () => __vitePreload(() => import('./zh-TW-sZnEg57t.js'),true              ?[]:void 0),
  en: () => __vitePreload(() => import('./en-B-QxFKum.js'),true              ?[]:void 0),
  ja: () => __vitePreload(() => import('./ja-DDVWMk3H.js'),true              ?[]:void 0),
  ko: () => __vitePreload(() => import('./ko-DXr8UEVv.js'),true              ?[]:void 0),
  es: () => __vitePreload(() => import('./es-C1l9cJSQ.js'),true              ?[]:void 0),
  fr: () => __vitePreload(() => import('./fr-Ddz6T-Fn.js'),true              ?[]:void 0),
  de: () => __vitePreload(() => import('./de-D_O3jKoQ.js'),true              ?[]:void 0),
  ru: () => __vitePreload(() => import('./ru-BmuoRj0P.js'),true              ?[]:void 0),
  vi: () => __vitePreload(() => import('./vi-B0ON85MX.js'),true              ?[]:void 0),
  th: () => __vitePreload(() => import('./th-Br6k-g7v.js'),true              ?[]:void 0),
};

/** 已带静态语言包的 locale(切换即生效,不依赖机翻)。 */
['zh-CN', ...Object.keys(PACKS)];

const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { 'zh-CN': zhCN },
});

/* ---- 语言包按需加载 ----
 * 已加载的去重;并发调用共享同一 Promise(先占位后回填,失败时清除以便重试)。
 * zh-CN 恒在(源语言),无包语言(后端 yj_locale 扩展)直接空手而归——词条走
 * tt() 的 miss → ensureDict 机翻管线,与既有机制无缝衔接。
 */
const packLoaded = new Set(['zh-CN']);
const packLoading = new Map();

async function ensureLocalePack(locale) {
  if (!locale || locale === 'zh-CN' || locale === 'zh' || packLoaded.has(locale)) return
  let p = packLoading.get(locale);
  if (!p) {
    const loader = PACKS[locale];
    p = loader
      ? loader().then((mod) => { i18n.global.mergeLocaleMessage(locale, mod.default || {}); })
          .then(() => { packLoaded.add(locale); })
          .catch((e) => { console.warn('[i18n] 语言包加载失败:', locale, e); })
          .finally(() => { packLoading.delete(locale); })
      : Promise.resolve(); // 无本地包的动态语言:交给机翻管线
    packLoading.set(locale, p);
  }
  await p;
}

/**
 * 业务直译 helper(全局语言切换,ADR-0001:仅显示层):
 * 中文界面原样返回;其他语言按中文原文查 biz 词典(静态包或后端动态 merge),
 * 命中返回译文,未命中原样返回。用于菜单标题、按钮名、状态值等"中文即键"的
 * 显示点——仅用于显示,提交给后端的键(buttonName/dataName)保持中文原值。
 *
 * 未命中词条自动记入待取集合(recordMiss),去抖批量经注册的取词器补齐
 * (main.js 注册为 locale store 的 ensureDict:/locale/dict 机翻 + 库表词典),
 * merge 后自增 dictVersion 触发调用处重渲——渲染函数/computed 内的 tt() 天然响应。
 * 对齐 light-mes:切换语言后所有字段/面板/按钮自动机翻,无需预置翻译。
 */
function tt(text) {
  if (typeof text !== 'string' || !text) return text
  const current = i18n.global.locale.value;
  if (!current || current === 'zh-CN' || current === 'zh') return text
  // 组合标题(如"基础资料 / 客户档案")按分隔符逐段翻译后回拼
  if (text.includes(' / ')) return text.split(' / ').map((seg) => tt(seg)).join(' / ')
  void dictVersion.value; // 建立响应式依赖:词条补齐后自动重渲
  const locale = i18n.global.locale.value;
  const dict = i18n.global.getLocaleMessage(locale)?.biz || {};
  const hit = dict[text];
  if (hit) return hit
  recordMiss(locale, text);
  return text
}

/* ---- 缺失词条自动补齐(所有语言通用,移植自 light-mes) ----
 * tt() 渲染时发现缺失 → 记入 pendingByLocale → 去抖 500ms 批量调取词器
 * (ensureDict:/locale/dict 机翻 + 翻译表) → mergeLocaleMessage → dictVersion++ 触发重渲。
 * requested 集合按「locale+键」去重:机翻失败的键本会话不再重试,防请求风暴。
 */
const dictVersion = ref(0);

const PENDING_DELAY = 500;
const pendingByLocale = new Map(); // locale -> Set<key>
const requested = new Set(); // `${locale} ${key}`
let fetcher = null;
let timer = 0;

/** main.js 安装 pinia 后注册:注入 ensureDict,避免 i18n 依赖业务层 */
function registerDictFetcher(fn) {
  fetcher = fn;
}

function recordMiss(locale, key) {
  if (!fetcher || !key || key.length > 200) return
  const rid = locale + '\u0000' + key;
  if (requested.has(rid)) return
  requested.add(rid);
  let set = pendingByLocale.get(locale);
  if (!set) pendingByLocale.set(locale, (set = new Set()));
  set.add(key);
  if (!timer) timer = setTimeout(flushPending, PENDING_DELAY);
}

async function flushPending() {
  timer = 0;
  const locale = i18n.global.locale.value;
  const set = pendingByLocale.get(locale);
  if (!fetcher || !set || !set.size) return
  const keys = [...set];
  set.clear();
  try {
    await fetcher(locale, keys);
  } catch (e) {
    /* 翻译服务不可用:tt() 回退原文 */
  }
  dictVersion.value++;
}

/** Element Plus 组件库文案 locale 映射(缺失语言回退英文)。 */
const EP_LOCALES = { 'zh-CN': zh_cn_default, 'zh-TW': zh_tw_default, en: en_default, ja: ja_default, ko: ko_default, es: es_default, fr: fr_default, de: de_default, ru: ru_default };

/** 静态内置语言(有本地语言包);其余语言由后端 yj_locale 注册表动态提供。 */
const BUILTIN = [
  { locale: 'zh-CN', nameNative: '简体中文' },
  { locale: 'en', nameNative: 'English' },
];

/**
 * Locale store — 语言切换的唯一真源(决策见 CONTEXT.md)。
 * 动态语言:available 列表来自 /api/locale/list(yj_locale 表,加行即扩语言);
 * 非内置语言的 biz 词典由 /api/locale/dict 机翻(阿里云)兜底并 merge 进 i18n。
 */
const useLocaleStore = defineStore('locale', {
  state: () => ({
    locale: (() => {
      try {
        const saved = localStorage.getItem(LOCALE_KEY);
        if (saved) return saved
      } catch { /* ignore */ }
      return 'zh-CN'
    })(),
    available: BUILTIN,
    dictLoaded: {},
  }),
  getters: {
    epLocale: (s) => EP_LOCALES[s.locale] ?? en_default,
    shortLabel: (s) => (s.locale === 'en' ? 'EN' : s.locale === 'zh-CN' ? '中' : (s.locale.split('-')[0] || '').toUpperCase()),
    isChinese: (s) => !s.locale || s.locale === 'zh-CN' || s.locale.startsWith('zh'),
  },
  actions: {
    apply() {
      i18n.global.locale.value = this.locale;
      document.documentElement.setAttribute('lang', this.locale);
      const names = { 'zh-CN': '生产制造执行系统', 'zh-TW': '生產製造執行系統', en: 'Manufacturing Execution System' };
      document.title = 'YINJIA-MES · ' + (names[this.locale] ?? tt0(this.locale, '生产制造执行系统'));
    },
    /** 拉取启用语言列表(切换器数据源;失败回退内置两语)。 */
    async loadAvailable() {
      try {
        const r = await fetch('/api/locale/list');
        const d = await r.json();
        if (Array.isArray(d?.data) && d.data.length) this.available = d.data;
      } catch { /* 保持内置 */ }
    },
    /** 词典保障(light-mes 同款):tt() 渲染 miss 的键经此批量请求后端
     *  (翻译表命中或阿里云机翻)merge 进 i18n——字段/面板/UI 词条全部自动补齐,
     *  无需预置翻译;merged 后 dictVersion 自增触发重渲。 */
    async ensureDict(locale, keys) {
      if (!locale || locale === 'zh-CN' || locale === 'zh') return
      const existing = i18n.global.getLocaleMessage(locale)?.biz || {};
      const missing = [...new Set(keys || [])].filter((k) => (
        typeof k === 'string' && k.trim() && k.length <= 200 && !(k in existing)
      ));
      if (!missing.length) return
      try {
        const r = await fetch('/api/locale/dict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale, keys: missing }),
        });
        const d = await r.json();
        const dict = d?.data?.dict;
        if (dict && Object.keys(dict).length) {
          i18n.global.mergeLocaleMessage(locale, { biz: dict });
        }
      } catch { /* 词典加载失败时 tt() 回退原文 */ }
    },
    async set(locale) {
      if (!locale || locale === this.locale) return
      // 语言包按需加载:先取包再切换,界面无中文闪烁;无本地包的动态语言空手而归,
      // 词条由 tt() 的 miss → ensureDict 机翻管线兜底(与原机制一致)。
      await ensureLocalePack(locale);
      this.locale = locale;
      try { localStorage.setItem(LOCALE_KEY, locale); } catch { /* ignore */ }
      this.apply();
      // 纯 SPA 热切换:不刷新页面、不重置任何页面状态。
      // UI/字段/面板词条:tt() 渲染时 miss 自动收集 → ensureDict 批量机翻 → merge 重渲,
      // 数据、分页、弹窗、滚动、表单输入全部保留。
    },
    /** 循环切换(Alt+L 快捷键入口)。 */
    cycle() {
      const list = this.available.map((a) => a.locale);
      const pool = list.length > 1 ? list : ['zh-CN', 'en'];
      this.set(pool[(pool.indexOf(this.locale) + 1) % pool.length] || 'zh-CN');
    },
  },
});

/** 独立小翻译(document.title 用,不依赖组件上下文)。 */
function tt0(locale, text) {
  if (!locale || locale === 'zh-CN' || locale === 'zh') return text
  const key = 'biz.' + text;
  const tr = i18n.global.t(key);
  return tr === key ? text : tr
}

const _sfc_main = {
  __name: 'App',
  setup(__props) {

const localeStore = useLocaleStore();

/**
 * Element Plus 的**命令式**组件(ElMessageBox / ElMessage / ElNotification)渲染在组件树之外,
 * 拿不到模板里 <el-config-provider> 的 locale —— 它们只认模块级的 globalConfig,
 * 而 main.js 的 app.use(ElementPlus) 没传 options,安装器就没调用 provideGlobalConfig,
 * 于是它们永远停在 Element Plus 的默认语言(中文):英文界面下弹窗按钮仍是「确定 / 取消」。
 *
 * 这里把当前语言同步进**全局**配置(第三参 global=true),命令式组件才能跟着切;
 * 模板内组件继续走 <el-config-provider>(本就正确)。切语言 → watch 重设全局快照。
 * 依据:element-plus/es/components/config-provider/src/hooks/use-global-config.mjs
 * (globalConfig 是模块级 ref;global=true 时才写入,命令式组件回退读它)。
 */
watch(
  () => localeStore.epLocale,
  (locale) => provideGlobalConfig({ locale }, undefined, true),
  { immediate: true },
);

// Alt+L 循环切换语言(决策 2026-08-30:像输入法一样的快捷切换)。
// 输入框聚焦时跳过,避免干扰打字。
const onKeydown = (e) => {
  if (!e.altKey || (e.key !== 'l' && e.key !== 'L')) return
  const active = document.activeElement;
  const tag = active ? active.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable) return
  if ((localeStore.available?.length || 2) < 2) return
  e.preventDefault();
  localeStore.cycle();
};

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

return (_ctx, _cache) => {
  const _component_router_view = resolveComponent("router-view");
  const _component_el_config_provider = ElConfigProvider;

  return (openBlock(), createBlock(_component_el_config_provider, {
    locale: unref(localeStore).epLocale
  }, {
    default: withCtx(() => [
      createVNode(_component_router_view)
    ]),
    _: 1
  }, 8, ["locale"]))
}
}

};

/**
 * Create a bound version of a function with a specified `this` context
 *
 * @param {Function} fn - The function to bind
 * @param {*} thisArg - The value to be passed as the `this` parameter
 * @returns {Function} A new function that will call the original function with the specified `this` context
 */
function bind(fn, thisArg) {
  return function wrap() {
    return fn.apply(thisArg, arguments);
  };
}

// utils is a library of generic helper functions non-specific to axios

const { toString } = Object.prototype;
const { getPrototypeOf } = Object;
const { iterator, toStringTag } = Symbol;

/* Creating a function that will check if an object has a property. */
const hasOwnProperty = (
  ({ hasOwnProperty }) =>
  (obj, prop) =>
    hasOwnProperty.call(obj, prop)
)(Object.prototype);

/**
 * Walk the prototype chain (excluding the shared Object.prototype) looking for
 * an own `prop`. This distinguishes genuine own/inherited members — including
 * class accessors and template prototypes — from members injected via
 * Object.prototype pollution (e.g. `Object.prototype.username = '...'`), which
 * live on Object.prototype itself and are therefore never matched.
 *
 * @param {*} thing The value whose chain to inspect
 * @param {string|symbol} prop The property key to look for
 *
 * @returns {boolean} True when `prop` is owned below Object.prototype
 */
const hasOwnInPrototypeChain = (thing, prop) => {
  let obj = thing;
  const seen = [];

  while (obj != null && obj !== Object.prototype) {
    if (seen.indexOf(obj) !== -1) {
      return false;
    }
    seen.push(obj);

    if (hasOwnProperty(obj, prop)) {
      return true;
    }
    obj = getPrototypeOf(obj);
  }
  return false;
};

/**
 * Read `obj[prop]` only when it is safe from Object.prototype pollution. Own
 * properties and members inherited from a non-Object.prototype source (a class
 * instance or template object) are honored; a value reachable only through a
 * polluted Object.prototype is ignored and `undefined` is returned.
 *
 * @param {*} obj The source object
 * @param {string|symbol} prop The property key to read
 *
 * @returns {*} The resolved value, or undefined when unsafe/absent
 */
const getSafeProp = (obj, prop) =>
  obj != null && hasOwnInPrototypeChain(obj, prop) ? obj[prop] : undefined;

const kindOf = ((cache) => (thing) => {
  const str = toString.call(thing);
  return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
})(Object.create(null));

const kindOfTest = (type) => {
  type = type.toLowerCase();
  return (thing) => kindOf(thing) === type;
};

const typeOfTest = (type) => (thing) => typeof thing === type;

/**
 * Determine if a value is a non-null object
 *
 * @param {Object} val The value to test
 *
 * @returns {boolean} True if value is an Array, otherwise false
 */
const { isArray } = Array;

/**
 * Determine if a value is undefined
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if the value is undefined, otherwise false
 */
const isUndefined = typeOfTest('undefined');

/**
 * Determine if a value is a Buffer
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Buffer, otherwise false
 */
function isBuffer(val) {
  return (
    val !== null &&
    !isUndefined(val) &&
    val.constructor !== null &&
    !isUndefined(val.constructor) &&
    isFunction$1(val.constructor.isBuffer) &&
    val.constructor.isBuffer(val)
  );
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
const isArrayBuffer = kindOfTest('ArrayBuffer');

/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  let result;
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView) {
    result = ArrayBuffer.isView(val);
  } else {
    result = val && val.buffer && isArrayBuffer(val.buffer);
  }
  return result;
}

/**
 * Determine if a value is a String
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a String, otherwise false
 */
const isString = typeOfTest('string');

/**
 * Determine if a value is a Function
 *
 * @param {*} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
const isFunction$1 = typeOfTest('function');

/**
 * Determine if a value is a Number
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Number, otherwise false
 */
const isNumber = typeOfTest('number');

/**
 * Determine if a value is an Object
 *
 * @param {*} thing The value to test
 *
 * @returns {boolean} True if value is an Object, otherwise false
 */
const isObject = (thing) => thing !== null && typeof thing === 'object';

/**
 * Determine if a value is a Boolean
 *
 * @param {*} thing The value to test
 * @returns {boolean} True if value is a Boolean, otherwise false
 */
const isBoolean = (thing) => thing === true || thing === false;

/**
 * Determine if a value is a plain Object
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a plain Object, otherwise false
 */
const isPlainObject = (val) => {
  if (!isObject(val)) {
    return false;
  }

  const prototype = getPrototypeOf(val);
  return (
    (prototype === null ||
      prototype === Object.prototype ||
      getPrototypeOf(prototype) === null) &&
    // Treat any genuine (non-Object.prototype-polluted) Symbol.toStringTag or
    // Symbol.iterator as evidence the value is a tagged/iterable type rather
    // than a plain object, while ignoring keys injected onto Object.prototype.
    !hasOwnInPrototypeChain(val, toStringTag) &&
    !hasOwnInPrototypeChain(val, iterator)
  );
};

/**
 * Determine if a value is an empty object (safely handles Buffers)
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is an empty object, otherwise false
 */
const isEmptyObject = (val) => {
  // Early return for non-objects or Buffers to prevent RangeError
  if (!isObject(val) || isBuffer(val)) {
    return false;
  }

  try {
    return Object.keys(val).length === 0 && Object.getPrototypeOf(val) === Object.prototype;
  } catch (e) {
    // Fallback for any other objects that might cause RangeError with Object.keys()
    return false;
  }
};

/**
 * Determine if a value is a Date
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Date, otherwise false
 */
const isDate = kindOfTest('Date');

/**
 * Determine if a value is a File
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a File, otherwise false
 */
const isFile = kindOfTest('File');

/**
 * Determine if a value is a React Native Blob
 * React Native "blob": an object with a `uri` attribute. Optionally, it can
 * also have a `name` and `type` attribute to specify filename and content type
 *
 * @see https://github.com/facebook/react-native/blob/26684cf3adf4094eb6c405d345a75bf8c7c0bf88/Libraries/Network/FormData.js#L68-L71
 *
 * @param {*} value The value to test
 *
 * @returns {boolean} True if value is a React Native Blob, otherwise false
 */
const isReactNativeBlob = (value) => {
  return !!(value && typeof value.uri !== 'undefined');
};

/**
 * Determine if environment is React Native
 * ReactNative `FormData` has a non-standard `getParts()` method
 *
 * @param {*} formData The formData to test
 *
 * @returns {boolean} True if environment is React Native, otherwise false
 */
const isReactNative = (formData) => formData && typeof formData.getParts !== 'undefined';

/**
 * Determine if a value is a Blob
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Blob, otherwise false
 */
const isBlob = kindOfTest('Blob');

/**
 * Determine if a value is a FileList
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a FileList, otherwise false
 */
const isFileList = kindOfTest('FileList');
const isSet = kindOfTest('Set');

/**
 * Determine if a value is a Stream
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Stream, otherwise false
 */
const isStream = (val) => isObject(val) && isFunction$1(val.pipe);

/**
 * Determine if a value is a FormData
 *
 * @param {*} thing The value to test
 *
 * @returns {boolean} True if value is an FormData, otherwise false
 */
function getGlobal() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof self !== 'undefined') return self;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  return {};
}

const G = getGlobal();
const FormDataCtor = typeof G.FormData !== 'undefined' ? G.FormData : undefined;

const isFormData = (thing) => {
  if (!thing) return false;
  if (FormDataCtor && thing instanceof FormDataCtor) return true;
  // Reject plain objects inheriting directly from Object.prototype so prototype-pollution gadgets can't spoof FormData.
  const proto = getPrototypeOf(thing);
  if (!proto || proto === Object.prototype) return false;
  if (!isFunction$1(thing.append)) return false;
  const kind = kindOf(thing);
  return (
    kind === 'formdata' ||
    // detect form-data instance
    (kind === 'object' && isFunction$1(thing.toString) && thing.toString() === '[object FormData]')
  );
};

/**
 * Determine if a value is a URLSearchParams object
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
const isURLSearchParams = kindOfTest('URLSearchParams');

const [isReadableStream, isRequest, isResponse, isHeaders] = [
  'ReadableStream',
  'Request',
  'Response',
  'Headers',
].map(kindOfTest);

/**
 * Trim excess whitespace off the beginning and end of a string
 *
 * @param {String} str The String to trim
 *
 * @returns {String} The String freed of excess whitespace
 */
const trim = (str) => {
  return str.trim ? str.trim() : str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
};
/**
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array<unknown>} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 *
 * @param {Object} [options]
 * @param {Boolean} [options.allOwnKeys = false]
 * @returns {any}
 */
function forEach(obj, fn, { allOwnKeys = false } = {}) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  let i;
  let l;

  // Force an array if not already something iterable
  if (typeof obj !== 'object') {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Buffer check
    if (isBuffer(obj)) {
      return;
    }

    // Iterate over object keys
    const keys = allOwnKeys ? Object.getOwnPropertyNames(obj) : Object.keys(obj);
    const len = keys.length;
    let key;

    for (i = 0; i < len; i++) {
      key = keys[i];
      fn.call(null, obj[key], key, obj);
    }
  }
}

/**
 * Finds a key in an object, case-insensitive, returning the actual key name.
 * Returns null if the object is a Buffer or if no match is found.
 *
 * @param {Object} obj - The object to search.
 * @param {string} key - The key to find (case-insensitive).
 * @returns {?string} The actual key name if found, otherwise null.
 */
function findKey(obj, key) {
  if (isBuffer(obj)) {
    return null;
  }

  key = key.toLowerCase();
  const keys = Object.keys(obj);
  let i = keys.length;
  let _key;
  while (i-- > 0) {
    _key = keys[i];
    if (key === _key.toLowerCase()) {
      return _key;
    }
  }
  return null;
}

const _global = (() => {
  /*eslint no-undef:0*/
  if (typeof globalThis !== 'undefined') return globalThis;
  return typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : global;
})();

const isContextDefined = (context) => !isUndefined(context) && context !== _global;

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * const result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 *
 * @returns {Object} Result of all merge properties
 */
function merge(...objs) {
  const { caseless, skipUndefined } = (isContextDefined(this) && this) || {};
  const result = {};
  const assignValue = (val, key) => {
    // Skip dangerous property names to prevent prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return;
    }

    // findKey lowercases the key, so caseless lookup only applies to strings —
    // symbol keys are identity-matched.
    const targetKey = (caseless && typeof key === 'string' && findKey(result, key)) || key;
    // Read via own-prop only — a bare `result[targetKey]` walks the prototype
    // chain, so a polluted Object.prototype value could surface here and get
    // copied into the merged result.
    const existing = hasOwnProperty(result, targetKey) ? result[targetKey] : undefined;
    if (isPlainObject(existing) && isPlainObject(val)) {
      result[targetKey] = merge(existing, val);
    } else if (isPlainObject(val)) {
      result[targetKey] = merge({}, val);
    } else if (isArray(val)) {
      result[targetKey] = val.slice();
    } else if (!skipUndefined || !isUndefined(val)) {
      result[targetKey] = val;
    }
  };

  for (let i = 0, l = objs.length; i < l; i++) {
    const source = objs[i];
    if (!source || isBuffer(source)) {
      continue;
    }

    forEach(source, assignValue);

    if (typeof source !== 'object' || isArray(source)) {
      continue;
    }

    const symbols = Object.getOwnPropertySymbols(source);
    for (let j = 0; j < symbols.length; j++) {
      const symbol = symbols[j];
      if (propertyIsEnumerable.call(source, symbol)) {
        assignValue(source[symbol], symbol);
      }
    }
  }
  return result;
}

/**
 * Extends object a by mutably adding to it the properties of object b.
 *
 * @param {Object} a The object to be extended
 * @param {Object} b The object to copy properties from
 * @param {Object} thisArg The object to bind function to
 *
 * @param {Object} [options]
 * @param {Boolean} [options.allOwnKeys]
 * @returns {Object} The resulting value of object a
 */
const extend = (a, b, thisArg, { allOwnKeys } = {}) => {
  forEach(
    b,
    (val, key) => {
      if (thisArg && isFunction$1(val)) {
        Object.defineProperty(a, key, {
          // Null-proto descriptor so a polluted Object.prototype.get cannot
          // hijack defineProperty's accessor-vs-data resolution.
          __proto__: null,
          value: bind(val, thisArg),
          writable: true,
          enumerable: true,
          configurable: true,
        });
      } else {
        Object.defineProperty(a, key, {
          __proto__: null,
          value: val,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    },
    { allOwnKeys }
  );
  return a;
};

/**
 * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
 *
 * @param {string} content with BOM
 *
 * @returns {string} content value without BOM
 */
const stripBOM = (content) => {
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }
  return content;
};

/**
 * Inherit the prototype methods from one constructor into another
 * @param {function} constructor
 * @param {function} superConstructor
 * @param {object} [props]
 * @param {object} [descriptors]
 *
 * @returns {void}
 */
const inherits = (constructor, superConstructor, props, descriptors) => {
  constructor.prototype = Object.create(superConstructor.prototype, descriptors);
  Object.defineProperty(constructor.prototype, 'constructor', {
    __proto__: null,
    value: constructor,
    writable: true,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(constructor, 'super', {
    __proto__: null,
    value: superConstructor.prototype,
  });
  props && Object.assign(constructor.prototype, props);
};

/**
 * Resolve object with deep prototype chain to a flat object
 * @param {Object} sourceObj source object
 * @param {Object} [destObj]
 * @param {Function|Boolean} [filter]
 * @param {Function} [propFilter]
 *
 * @returns {Object}
 */
const toFlatObject = (sourceObj, destObj, filter, propFilter) => {
  let props;
  let i;
  let prop;
  const merged = {};

  destObj = destObj || {};
  // eslint-disable-next-line no-eq-null,eqeqeq
  if (sourceObj == null) return destObj;

  do {
    props = Object.getOwnPropertyNames(sourceObj);
    i = props.length;
    while (i-- > 0) {
      prop = props[i];
      if ((!propFilter || propFilter(prop, sourceObj, destObj)) && !merged[prop]) {
        destObj[prop] = sourceObj[prop];
        merged[prop] = true;
      }
    }
    sourceObj = filter !== false && getPrototypeOf(sourceObj);
  } while (sourceObj && (!filter || filter(sourceObj, destObj)) && sourceObj !== Object.prototype);

  return destObj;
};

/**
 * Determines whether a string ends with the characters of a specified string
 *
 * @param {String} str
 * @param {String} searchString
 * @param {Number} [position= 0]
 *
 * @returns {boolean}
 */
const endsWith = (str, searchString, position) => {
  str = String(str);
  if (position === undefined || position > str.length) {
    position = str.length;
  }
  position -= searchString.length;
  const lastIndex = str.indexOf(searchString, position);
  return lastIndex !== -1 && lastIndex === position;
};

/**
 * Returns new array from array like object or null if failed
 *
 * @param {*} [thing]
 *
 * @returns {?Array}
 */
const toArray = (thing) => {
  if (!thing) return null;
  if (isArray(thing)) return thing;
  let i = thing.length;
  if (!isNumber(i)) return null;
  const arr = new Array(i);
  while (i-- > 0) {
    arr[i] = thing[i];
  }
  return arr;
};

/**
 * Checking if the Uint8Array exists and if it does, it returns a function that checks if the
 * thing passed in is an instance of Uint8Array
 *
 * @param {TypedArray}
 *
 * @returns {Array}
 */
// eslint-disable-next-line func-names
const isTypedArray = ((TypedArray) => {
  // eslint-disable-next-line func-names
  return (thing) => {
    return TypedArray && thing instanceof TypedArray;
  };
})(typeof Uint8Array !== 'undefined' && getPrototypeOf(Uint8Array));

/**
 * For each entry in the object, call the function with the key and value.
 *
 * @param {Object<any, any>} obj - The object to iterate over.
 * @param {Function} fn - The function to call for each entry.
 *
 * @returns {void}
 */
const forEachEntry = (obj, fn) => {
  const generator = obj && obj[iterator];

  const _iterator = generator.call(obj);

  let result;

  while ((result = _iterator.next()) && !result.done) {
    const pair = result.value;
    fn.call(obj, pair[0], pair[1]);
  }
};

/**
 * It takes a regular expression and a string, and returns an array of all the matches
 *
 * @param {string} regExp - The regular expression to match against.
 * @param {string} str - The string to search.
 *
 * @returns {Array<boolean>}
 */
const matchAll = (regExp, str) => {
  let matches;
  const arr = [];

  while ((matches = regExp.exec(str)) !== null) {
    arr.push(matches);
  }

  return arr;
};

/* Checking if the kindOfTest function returns true when passed an HTMLFormElement. */
const isHTMLForm = kindOfTest('HTMLFormElement');

const toCamelCase = (str) => {
  return str.toLowerCase().replace(/[-_\s]([a-z\d])(\w*)/g, function replacer(m, p1, p2) {
    return p1.toUpperCase() + p2;
  });
};

const { propertyIsEnumerable } = Object.prototype;

/**
 * Determine if a value is a RegExp object
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a RegExp object, otherwise false
 */
const isRegExp = kindOfTest('RegExp');

const reduceDescriptors = (obj, reducer) => {
  const descriptors = Object.getOwnPropertyDescriptors(obj);
  const reducedDescriptors = {};

  forEach(descriptors, (descriptor, name) => {
    let ret;
    if ((ret = reducer(descriptor, name, obj)) !== false) {
      reducedDescriptors[name] = ret || descriptor;
    }
  });

  Object.defineProperties(obj, reducedDescriptors);
};

/**
 * Makes all methods read-only
 * @param {Object} obj
 */

const freezeMethods = (obj) => {
  reduceDescriptors(obj, (descriptor, name) => {
    // skip restricted props in strict mode
    if (isFunction$1(obj) && ['arguments', 'caller', 'callee'].includes(name)) {
      return false;
    }

    const value = obj[name];

    if (!isFunction$1(value)) return;

    descriptor.enumerable = false;

    if ('writable' in descriptor) {
      descriptor.writable = false;
      return;
    }

    if (!descriptor.set) {
      descriptor.set = () => {
        throw Error("Can not rewrite read-only method '" + name + "'");
      };
    }
  });
};

/**
 * Converts an array or a delimited string into an object set with values as keys and true as values.
 * Useful for fast membership checks.
 *
 * @param {Array|string} arrayOrString - The array or string to convert.
 * @param {string} delimiter - The delimiter to use if input is a string.
 * @returns {Object} An object with keys from the array or string, values set to true.
 */
const toObjectSet = (arrayOrString, delimiter) => {
  const obj = {};

  const define = (arr) => {
    arr.forEach((value) => {
      obj[value] = true;
    });
  };

  isArray(arrayOrString) ? define(arrayOrString) : define(String(arrayOrString).split(delimiter));

  return obj;
};

const noop = () => {};

const toFiniteNumber = (value, defaultValue) => {
  return value != null && Number.isFinite((value = +value)) ? value : defaultValue;
};

/**
 * If the thing is a FormData object, return true, otherwise return false.
 *
 * @param {unknown} thing - The thing to check.
 *
 * @returns {boolean}
 */
function isSpecCompliantForm(thing) {
  return !!(
    thing &&
    isFunction$1(thing.append) &&
    thing[toStringTag] === 'FormData' &&
    thing[iterator]
  );
}

/**
 * Recursively converts an object to a JSON-compatible object, handling circular references and Buffers.
 *
 * @param {Object} obj - The object to convert.
 * @returns {Object} The JSON-compatible object.
 */
const toJSONObject = (obj) => {
  const visited = new WeakSet();

  const visit = (source) => {
    if (isObject(source)) {
      if (visited.has(source)) {
        return;
      }

      //Buffer check
      if (isBuffer(source)) {
        return source;
      }

      if (!('toJSON' in source)) {
        // add-on descent / delete-on-ascent: preserves path semantics, so DAG nodes serialise at every occurrence (see #7230).
        visited.add(source);

        let target;

        if (isSet(source)) {
          target = [];
          for (const value of source) {
            const reducedValue = visit(value);
            !isUndefined(reducedValue) && target.push(reducedValue);
          }
        } else {
          target = isArray(source) ? [] : {};

          forEach(source, (value, key) => {
            const reducedValue = visit(value);
            !isUndefined(reducedValue) && (target[key] = reducedValue);
          });
        }

        visited.delete(source);

        return target;
      }
    }

    return source;
  };

  return visit(obj);
};

/**
 * Determines if a value is an async function.
 *
 * @param {*} thing - The value to test.
 * @returns {boolean} True if value is an async function, otherwise false.
 */
const isAsyncFn = kindOfTest('AsyncFunction');

/**
 * Determines if a value is thenable (has then and catch methods).
 *
 * @param {*} thing - The value to test.
 * @returns {boolean} True if value is thenable, otherwise false.
 */
const isThenable = (thing) =>
  thing &&
  (isObject(thing) || isFunction$1(thing)) &&
  isFunction$1(thing.then) &&
  isFunction$1(thing.catch);

// original code
// https://github.com/DigitalBrainJS/AxiosPromise/blob/16deab13710ec09779922131f3fa5954320f83ab/lib/utils.js#L11-L34

/**
 * Provides a cross-platform setImmediate implementation.
 * Uses native setImmediate if available, otherwise falls back to postMessage or setTimeout.
 *
 * @param {boolean} setImmediateSupported - Whether setImmediate is supported.
 * @param {boolean} postMessageSupported - Whether postMessage is supported.
 * @returns {Function} A function to schedule a callback asynchronously.
 */
const _setImmediate = ((setImmediateSupported, postMessageSupported) => {
  if (setImmediateSupported) {
    return setImmediate;
  }

  return postMessageSupported
    ? ((token, callbacks) => {
        _global.addEventListener(
          'message',
          ({ source, data }) => {
            if (source === _global && data === token) {
              callbacks.length && callbacks.shift()();
            }
          },
          false
        );

        return (cb) => {
          callbacks.push(cb);
          _global.postMessage(token, '*');
        };
      })(`axios@${Math.random()}`, [])
    : (cb) => setTimeout(cb);
})(typeof setImmediate === 'function', isFunction$1(_global.postMessage));

/**
 * Schedules a microtask or asynchronous callback as soon as possible.
 * Uses queueMicrotask if available, otherwise falls back to process.nextTick or _setImmediate.
 *
 * @type {Function}
 */
const asap =
  typeof queueMicrotask !== 'undefined'
    ? queueMicrotask.bind(_global)
    : (typeof process !== 'undefined' && process.nextTick) || _setImmediate;

// *********************

const isIterable = (thing) => thing != null && isFunction$1(thing[iterator]);

/**
 * Determine if a value is iterable via an iterator that is NOT sourced solely
 * from a polluted Object.prototype. Use this instead of `isIterable` whenever
 * the iterable comes from untrusted input (e.g. user-supplied header sources),
 * so `Object.prototype[Symbol.iterator] = ...` cannot turn an ordinary object
 * into an attacker-controlled entries iterator.
 *
 * @param {*} thing The value to test
 *
 * @returns {boolean} True if value has a non-polluted iterator
 */
const isSafeIterable = (thing) =>
  thing != null && hasOwnInPrototypeChain(thing, iterator) && isIterable(thing);

const utils$1 = {
  isArray,
  isArrayBuffer,
  isBuffer,
  isFormData,
  isArrayBufferView,
  isString,
  isNumber,
  isBoolean,
  isObject,
  isPlainObject,
  isEmptyObject,
  isReadableStream,
  isRequest,
  isResponse,
  isHeaders,
  isUndefined,
  isDate,
  isFile,
  isReactNativeBlob,
  isReactNative,
  isBlob,
  isRegExp,
  isFunction: isFunction$1,
  isStream,
  isURLSearchParams,
  isTypedArray,
  isFileList,
  forEach,
  merge,
  extend,
  trim,
  stripBOM,
  inherits,
  toFlatObject,
  kindOf,
  kindOfTest,
  endsWith,
  toArray,
  forEachEntry,
  matchAll,
  isHTMLForm,
  hasOwnProperty,
  hasOwnProp: hasOwnProperty, // an alias to avoid ESLint no-prototype-builtins detection
  hasOwnInPrototypeChain,
  getSafeProp,
  reduceDescriptors,
  freezeMethods,
  toObjectSet,
  toCamelCase,
  noop,
  toFiniteNumber,
  findKey,
  global: _global,
  isContextDefined,
  isSpecCompliantForm,
  toJSONObject,
  isAsyncFn,
  isThenable,
  setImmediate: _setImmediate,
  asap,
  isIterable,
  isSafeIterable,
};

// RawAxiosHeaders whose duplicates are ignored by node
// c.f. https://nodejs.org/api/http.html#http_message_headers
const ignoreDuplicateOf = utils$1.toObjectSet([
  'age',
  'authorization',
  'content-length',
  'content-type',
  'etag',
  'expires',
  'from',
  'host',
  'if-modified-since',
  'if-unmodified-since',
  'last-modified',
  'location',
  'max-forwards',
  'proxy-authorization',
  'referer',
  'retry-after',
  'user-agent',
]);

/**
 * Parse headers into an object
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} rawHeaders Headers needing to be parsed
 *
 * @returns {Object} Headers parsed into an object
 */
const parseHeaders = (rawHeaders) => {
  const parsed = {};
  let key;
  let val;
  let i;

  rawHeaders &&
    rawHeaders.split('\n').forEach(function parser(line) {
      i = line.indexOf(':');
      key = line.substring(0, i).trim().toLowerCase();
      val = line.substring(i + 1).trim();

      const hasKey = utils$1.hasOwnProp(parsed, key);

      if (!key || (hasKey && utils$1.hasOwnProp(ignoreDuplicateOf, key))) {
        return;
      }

      if (key === 'set-cookie') {
        if (hasKey) {
          parsed[key].push(val);
        } else {
          parsed[key] = [val];
        }
      } else {
        parsed[key] = hasKey ? parsed[key] + ', ' + val : val;
      }
    });

  return parsed;
};

function trimSPorHTAB(str) {
  let start = 0;
  let end = str.length;

  while (start < end) {
    const code = str.charCodeAt(start);

    if (code !== 0x09 && code !== 0x20) {
      break;
    }

    start += 1;
  }

  while (end > start) {
    const code = str.charCodeAt(end - 1);

    if (code !== 0x09 && code !== 0x20) {
      break;
    }

    end -= 1;
  }

  return start === 0 && end === str.length ? str : str.slice(start, end);
}

// The control-code ranges are intentional: header sanitization strips C0/DEL bytes.
// eslint-disable-next-line no-control-regex
const INVALID_UNICODE_HEADER_VALUE_CHARS = new RegExp('[\\u0000-\\u0008\\u000a-\\u001f\\u007f]+', 'g');
// eslint-disable-next-line no-control-regex
const INVALID_BYTE_STRING_HEADER_VALUE_CHARS = new RegExp('[^\\u0009\\u0020-\\u007e\\u0080-\\u00ff]+', 'g');

function sanitizeValue(value, invalidChars) {
  if (utils$1.isArray(value)) {
    return value.map((item) => sanitizeValue(item, invalidChars));
  }

  return trimSPorHTAB(String(value).replace(invalidChars, ''));
}

const sanitizeHeaderValue = (value) =>
  sanitizeValue(value, INVALID_UNICODE_HEADER_VALUE_CHARS);

const sanitizeByteStringHeaderValue = (value) =>
  sanitizeValue(value, INVALID_BYTE_STRING_HEADER_VALUE_CHARS);

function toByteStringHeaderObject(headers) {
  const byteStringHeaders = Object.create(null);

  utils$1.forEach(headers.toJSON(), (value, header) => {
    byteStringHeaders[header] = sanitizeByteStringHeaderValue(value);
  });

  return byteStringHeaders;
}

const $internals = Symbol('internals');

function normalizeHeader(header) {
  return header && String(header).trim().toLowerCase();
}

function normalizeValue(value) {
  if (value === false || value == null) {
    return value;
  }

  return utils$1.isArray(value) ? value.map(normalizeValue) : sanitizeHeaderValue(String(value));
}

function parseTokens(str) {
  const tokens = Object.create(null);
  const tokensRE = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;
  let match;

  while ((match = tokensRE.exec(str))) {
    tokens[match[1]] = match[2];
  }

  return tokens;
}

const parameterNameRE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function trimOWS(value) {
  let start = 0;
  let end = value.length;

  while (start < end) {
    const code = value.charCodeAt(start);

    if (code !== 0x09 && code !== 0x20) {
      break;
    }

    start += 1;
  }

  while (end > start) {
    const code = value.charCodeAt(end - 1);

    if (code !== 0x09 && code !== 0x20) {
      break;
    }

    end -= 1;
  }

  return start === 0 && end === value.length ? value : value.slice(start, end);
}

function decodeQuotedString(value) {
  const last = value.length - 1;

  if (last < 1 || value.charCodeAt(0) !== 0x22 || value.charCodeAt(last) !== 0x22) {
    return value;
  }

  let decoded = '';

  for (let i = 1; i < last; i++) {
    const code = value.charCodeAt(i);

    if (code === 0x22) {
      return value;
    }

    if (code === 0x5c) {
      i += 1;

      if (i >= last) {
        return value;
      }
    }

    decoded += value[i];
  }

  return decoded;
}

function parseParameters(value) {
  const parameters = Object.create(null);
  const str = String(value);
  let start = 0;
  let quoted = false;
  let escaped = false;

  function parseParameter(end) {
    const part = trimOWS(str.slice(start, end));
    const equals = part.indexOf('=');

    if (equals < 1) {
      return;
    }

    const name = trimOWS(part.slice(0, equals));

    if (!parameterNameRE.test(name)) {
      return;
    }

    const normalizedName = name.toLowerCase();

    if (
      normalizedName === '__proto__' ||
      normalizedName === 'constructor' ||
      normalizedName === 'prototype'
    ) {
      return;
    }

    const parameterValue = trimOWS(part.slice(equals + 1));
    parameters[normalizedName] = decodeQuotedString(parameterValue);
  }

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);

    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (code === 0x5c) {
        escaped = true;
      } else if (code === 0x22) {
        quoted = false;
      }
    } else if (code === 0x22) {
      quoted = true;
    } else if (code === 0x2c || code === 0x3b) {
      parseParameter(i);
      start = i + 1;
    }
  }

  parseParameter(str.length);

  return parameters;
}

const isValidHeaderName = (str) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(str.trim());

function matchHeaderValue(context, value, header, filter, isHeaderNameFilter) {
  if (utils$1.isFunction(filter)) {
    return filter.call(this, value, header);
  }

  if (isHeaderNameFilter) {
    value = header;
  }

  if (!utils$1.isString(value)) return;

  if (utils$1.isString(filter)) {
    return value.indexOf(filter) !== -1;
  }

  if (utils$1.isRegExp(filter)) {
    return filter.test(value);
  }
}

function formatHeader(header) {
  return header
    .trim()
    .toLowerCase()
    .replace(/([a-z\d])(\w*)/g, (w, char, str) => {
      return char.toUpperCase() + str;
    });
}

function buildAccessors(obj, header) {
  const accessorName = utils$1.toCamelCase(' ' + header);

  ['get', 'set', 'has'].forEach((methodName) => {
    Object.defineProperty(obj, methodName + accessorName, {
      // Null-proto descriptor so a polluted Object.prototype.get cannot turn
      // this data descriptor into an accessor descriptor on the way in.
      __proto__: null,
      value: function (arg1, arg2, arg3) {
        return this[methodName].call(this, header, arg1, arg2, arg3);
      },
      configurable: true,
    });
  });
}

let AxiosHeaders$1 = class AxiosHeaders {
  constructor(headers) {
    headers && this.set(headers);
  }

  set(header, valueOrRewrite, rewrite) {
    const self = this;

    function setHeader(_value, _header, _rewrite) {
      const lHeader = normalizeHeader(_header);

      if (!lHeader) {
        return;
      }

      const key = utils$1.findKey(self, lHeader);

      if (
        !key ||
        self[key] === undefined ||
        _rewrite === true ||
        (_rewrite === undefined && self[key] !== false)
      ) {
        self[key || _header] = normalizeValue(_value);
      }
    }

    const setHeaders = (headers, _rewrite) =>
      utils$1.forEach(headers, (_value, _header) => setHeader(_value, _header, _rewrite));

    if (utils$1.isPlainObject(header) || header instanceof this.constructor) {
      setHeaders(header, valueOrRewrite);
    } else if (utils$1.isString(header) && (header = header.trim()) && !isValidHeaderName(header)) {
      setHeaders(parseHeaders(header), valueOrRewrite);
    } else if (utils$1.isObject(header) && utils$1.isSafeIterable(header)) {
      let obj = Object.create(null),
        dest,
        key;
      for (const entry of header) {
        if (!utils$1.isArray(entry)) {
          throw new TypeError('Object iterator must return a key-value pair');
        }

        key = entry[0];

        if (utils$1.hasOwnProp(obj, key)) {
          dest = obj[key];
          obj[key] = utils$1.isArray(dest) ? [...dest, entry[1]] : [dest, entry[1]];
        } else {
          obj[key] = entry[1];
        }
      }

      setHeaders(obj, valueOrRewrite);
    } else {
      header != null && setHeader(valueOrRewrite, header, rewrite);
    }

    return this;
  }

  get(header, parser) {
    header = normalizeHeader(header);

    if (header) {
      const key = utils$1.findKey(this, header);

      if (key) {
        const value = this[key];

        if (!parser) {
          return value;
        }

        if (parser === true) {
          return parseTokens(value);
        }

        if (utils$1.isFunction(parser)) {
          return parser.call(this, value, key);
        }

        if (utils$1.isRegExp(parser)) {
          return parser.exec(value);
        }

        throw new TypeError('parser must be boolean|regexp|function');
      }
    }
  }

  has(header, matcher) {
    header = normalizeHeader(header);

    if (header) {
      const key = utils$1.findKey(this, header);

      return !!(
        key &&
        this[key] !== undefined &&
        (!matcher || matchHeaderValue(this, this[key], key, matcher))
      );
    }

    return false;
  }

  delete(header, matcher) {
    const self = this;
    let deleted = false;

    function deleteHeader(_header) {
      _header = normalizeHeader(_header);

      if (_header) {
        const key = utils$1.findKey(self, _header);

        if (key && (!matcher || matchHeaderValue(self, self[key], key, matcher))) {
          delete self[key];

          deleted = true;
        }
      }
    }

    if (utils$1.isArray(header)) {
      header.forEach(deleteHeader);
    } else {
      deleteHeader(header);
    }

    return deleted;
  }

  clear(matcher) {
    const keys = Object.keys(this);
    let i = keys.length;
    let deleted = false;

    while (i--) {
      const key = keys[i];
      if (!matcher || matchHeaderValue(this, this[key], key, matcher, true)) {
        delete this[key];
        deleted = true;
      }
    }

    return deleted;
  }

  normalize(format) {
    const self = this;
    const headers = {};

    utils$1.forEach(this, (value, header) => {
      const key = utils$1.findKey(headers, header);

      if (key) {
        self[key] = normalizeValue(value);
        delete self[header];
        return;
      }

      const normalized = format ? formatHeader(header) : String(header).trim();

      if (normalized !== header) {
        delete self[header];
      }

      self[normalized] = normalizeValue(value);

      headers[normalized] = true;
    });

    return this;
  }

  concat(...targets) {
    return this.constructor.concat(this, ...targets);
  }

  toJSON(asStrings) {
    const obj = Object.create(null);

    utils$1.forEach(this, (value, header) => {
      value != null &&
        value !== false &&
        (obj[header] = asStrings && utils$1.isArray(value) ? value.join(', ') : value);
    });

    return obj;
  }

  [Symbol.iterator]() {
    return Object.entries(this.toJSON())[Symbol.iterator]();
  }

  toString() {
    return Object.entries(this.toJSON())
      .map(([header, value]) => header + ': ' + value)
      .join('\n');
  }

  getSetCookie() {
    const value = this.get('set-cookie');
    return utils$1.isArray(value) ? value : value == null || value === false ? [] : [value];
  }

  get [Symbol.toStringTag]() {
    return 'AxiosHeaders';
  }

  static from(thing) {
    return thing instanceof this ? thing : new this(thing);
  }

  static parseParameters(value) {
    return parseParameters(value);
  }

  static concat(first, ...targets) {
    const computed = new this(first);

    targets.forEach((target) => computed.set(target));

    return computed;
  }

  static accessor(header) {
    const internals =
      (this[$internals] =
      this[$internals] =
        {
          accessors: {},
        });

    const accessors = internals.accessors;
    const prototype = this.prototype;

    function defineAccessor(_header) {
      const lHeader = normalizeHeader(_header);

      if (!accessors[lHeader]) {
        buildAccessors(prototype, _header);
        accessors[lHeader] = true;
      }
    }

    utils$1.isArray(header) ? header.forEach(defineAccessor) : defineAccessor(header);

    return this;
  }
};

AxiosHeaders$1.accessor([
  'Content-Type',
  'Content-Length',
  'Accept',
  'Accept-Encoding',
  'User-Agent',
  'Authorization',
]);

// reserved names hotfix
utils$1.reduceDescriptors(AxiosHeaders$1.prototype, ({ value }, key) => {
  let mapped = key[0].toUpperCase() + key.slice(1); // map `set` => `Set`
  return {
    get: () => value,
    set(headerValue) {
      this[mapped] = headerValue;
    },
  };
});

utils$1.freezeMethods(AxiosHeaders$1);

const REDACTED = '[REDACTED ****]';

function hasOwnOrPrototypeToJSON(source) {
  if (utils$1.hasOwnProp(source, 'toJSON')) {
    return true;
  }

  let prototype = Object.getPrototypeOf(source);

  while (prototype && prototype !== Object.prototype) {
    if (utils$1.hasOwnProp(prototype, 'toJSON')) {
      return true;
    }

    prototype = Object.getPrototypeOf(prototype);
  }

  return false;
}

// Build a plain-object snapshot of `config` and replace the value of any key
// (case-insensitive) listed in `redactKeys` with REDACTED. Walks through arrays
// and AxiosHeaders, and short-circuits on circular references.
function redactConfig(config, redactKeys) {
  const lowerKeys = new Set(redactKeys.map((k) => String(k).toLowerCase()));
  const seen = [];

  const visit = (source) => {
    if (source === null || typeof source !== 'object') return source;
    if (utils$1.isBuffer(source)) return source;
    if (seen.indexOf(source) !== -1) return undefined;

    if (source instanceof AxiosHeaders$1) {
      source = source.toJSON();
    }

    seen.push(source);

    let result;
    if (utils$1.isArray(source)) {
      result = [];
      source.forEach((v, i) => {
        const reducedValue = visit(v);
        if (!utils$1.isUndefined(reducedValue)) {
          result[i] = reducedValue;
        }
      });
    } else {
      if (!utils$1.isPlainObject(source) && hasOwnOrPrototypeToJSON(source)) {
        seen.pop();
        return source;
      }

      result = Object.create(null);
      for (const [key, value] of Object.entries(source)) {
        const reducedValue = lowerKeys.has(key.toLowerCase()) ? REDACTED : visit(value);
        if (!utils$1.isUndefined(reducedValue)) {
          result[key] = reducedValue;
        }
      }
    }

    seen.pop();
    return result;
  };

  return visit(config);
}

function stringifySafely$1(value) {
  try {
    return String(value);
  } catch (err) {
    return '';
  }
}

function aggregateErrorMessage(error) {
  const message = error.errors
    .map((entry) => {
      try {
        return entry && entry.message ? stringifySafely$1(entry.message) : stringifySafely$1(entry);
      } catch (err) {
        return '';
      }
    })
    .filter(Boolean)
    .join('; ');

  return message || error.name || 'AggregateError';
}

let AxiosError$1 = class AxiosError extends Error {
  static from(error, code, config, request, response, customProps) {
    // `AggregateError` (thrown by Node on dual-stack/Happy-Eyeballs connection
    // failures) has an empty `message`; its detail lives in `errors[]`. Without
    // this, the wrapped error surfaces with a blank message (see #6721).
    let message = error.message;
    if (!message && utils$1.isArray(error.errors) && error.errors.length) {
      message = aggregateErrorMessage(error);
    }

    const axiosError = new AxiosError(message, code || error.code, config, request, response);
    // Match native `Error` `cause` semantics: non-enumerable. The wrapped
    // error often carries circular internals (sockets, requests, agents), so
    // an enumerable `cause` makes structured loggers (pino/winston) and any
    // own-property walk throw "Converting circular structure to JSON".
    // Regression from #6982; see #7205. `__proto__: null` mirrors the
    // `message` descriptor below (prototype-pollution-safe descriptor).
    Object.defineProperty(axiosError, 'cause', {
      __proto__: null,
      value: error,
      writable: true,
      enumerable: false,
      configurable: true,
    });
    axiosError.name = error.name;

    // Preserve status from the original error if not already set from response
    if (error.status != null && axiosError.status == null) {
      axiosError.status = error.status;
    }

    customProps && Object.assign(axiosError, customProps);
    return axiosError;
  }

  /**
   * Create an Error with the specified message, config, error code, request and response.
   *
   * @param {string} message The error message.
   * @param {string} [code] The error code (for example, 'ECONNABORTED').
   * @param {Object} [config] The config.
   * @param {Object} [request] The request.
   * @param {Object} [response] The response.
   *
   * @returns {Error} The created error.
   */
  constructor(message, code, config, request, response) {
    super(message);

    // Make message enumerable to maintain backward compatibility
    // The native Error constructor sets message as non-enumerable,
    // but axios < v1.13.3 had it as enumerable
    Object.defineProperty(this, 'message', {
      // Null-proto descriptor so a polluted Object.prototype.get cannot turn
      // this data descriptor into an accessor descriptor on the way in.
      __proto__: null,
      value: message,
      enumerable: true,
      writable: true,
      configurable: true,
    });

    this.name = 'AxiosError';
    this.isAxiosError = true;
    code && (this.code = code);
    config && (this.config = config);
    request && (this.request = request);
    if (response) {
      this.response = response;
      this.status = response.status;
    }
  }

  toJSON() {
    // Opt-in redaction: when the request config carries a `redact` array, the
    // value of any matching key (case-insensitive, at any depth) is replaced
    // with REDACTED in the serialized snapshot. Undefined or empty leaves the
    // existing serialization behavior unchanged.
    const config = this.config;
    const redactKeys = config && utils$1.hasOwnProp(config, 'redact') ? config.redact : undefined;
    const serializedConfig =
      utils$1.isArray(redactKeys) && redactKeys.length > 0
        ? redactConfig(config, redactKeys)
        : utils$1.toJSONObject(config);

    return {
      // Standard
      message: this.message,
      name: this.name,
      // Microsoft
      description: this.description,
      number: this.number,
      // Mozilla
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      // Axios
      config: serializedConfig,
      code: this.code,
      status: this.status,
    };
  }
};

// This can be changed to static properties as soon as the parser options in .eslint.cjs are updated.
AxiosError$1.ERR_BAD_OPTION_VALUE = 'ERR_BAD_OPTION_VALUE';
AxiosError$1.ERR_BAD_OPTION = 'ERR_BAD_OPTION';
AxiosError$1.ECONNABORTED = 'ECONNABORTED';
AxiosError$1.ETIMEDOUT = 'ETIMEDOUT';
AxiosError$1.ECONNREFUSED = 'ECONNREFUSED';
AxiosError$1.ERR_NETWORK = 'ERR_NETWORK';
AxiosError$1.ERR_FR_TOO_MANY_REDIRECTS = 'ERR_FR_TOO_MANY_REDIRECTS';
AxiosError$1.ERR_DEPRECATED = 'ERR_DEPRECATED';
AxiosError$1.ERR_BAD_RESPONSE = 'ERR_BAD_RESPONSE';
AxiosError$1.ERR_BAD_REQUEST = 'ERR_BAD_REQUEST';
AxiosError$1.ERR_CANCELED = 'ERR_CANCELED';
AxiosError$1.ERR_NOT_SUPPORT = 'ERR_NOT_SUPPORT';
AxiosError$1.ERR_INVALID_URL = 'ERR_INVALID_URL';
AxiosError$1.ERR_FORM_DATA_DEPTH_EXCEEDED = 'ERR_FORM_DATA_DEPTH_EXCEEDED';

// eslint-disable-next-line strict
const httpAdapter = null;

// Default nesting limit shared with the inverse transform (formDataToJSON) so
// the FormData <-> JSON round-trip stays symmetric.
const DEFAULT_FORM_DATA_MAX_DEPTH = 100;

/**
 * Determines if the given thing is a array or js object.
 *
 * @param {string} thing - The object or array to be visited.
 *
 * @returns {boolean}
 */
function isVisitable(thing) {
  return utils$1.isPlainObject(thing) || utils$1.isArray(thing);
}

/**
 * It removes the brackets from the end of a string
 *
 * @param {string} key - The key of the parameter.
 *
 * @returns {string} the key without the brackets.
 */
function removeBrackets(key) {
  return utils$1.endsWith(key, '[]') ? key.slice(0, -2) : key;
}

/**
 * It takes a path, a key, and a boolean, and returns a string
 *
 * @param {string} path - The path to the current key.
 * @param {string} key - The key of the current object being iterated over.
 * @param {string} dots - If true, the key will be rendered with dots instead of brackets.
 *
 * @returns {string} The path to the current key.
 */
function renderKey(path, key, dots) {
  if (!path) return key;
  return path
    .concat(key)
    .map(function each(token, i) {
      // eslint-disable-next-line no-param-reassign
      token = removeBrackets(token);
      return !dots && i ? '[' + token + ']' : token;
    })
    .join(dots ? '.' : '');
}

/**
 * If the array is an array and none of its elements are visitable, then it's a flat array.
 *
 * @param {Array<any>} arr - The array to check
 *
 * @returns {boolean}
 */
function isFlatArray(arr) {
  return utils$1.isArray(arr) && !arr.some(isVisitable);
}

const predicates = utils$1.toFlatObject(utils$1, {}, null, function filter(prop) {
  return /^is[A-Z]/.test(prop);
});

/**
 * Convert a data object to FormData
 *
 * @param {Object} obj
 * @param {?Object} [formData]
 * @param {?Object} [options]
 * @param {Function} [options.visitor]
 * @param {Boolean} [options.metaTokens = true]
 * @param {Boolean} [options.dots = false]
 * @param {?Boolean} [options.indexes = false]
 *
 * @returns {Object}
 **/

/**
 * It converts an object into a FormData object
 *
 * @param {Object<any, any>} obj - The object to convert to form data.
 * @param {string} formData - The FormData object to append to.
 * @param {Object<string, any>} options
 *
 * @returns
 */
function toFormData$1(obj, formData, options) {
  if (!utils$1.isObject(obj)) {
    throw new TypeError('target must be an object');
  }

  // eslint-disable-next-line no-param-reassign
  formData = formData || new (FormData)();

  // eslint-disable-next-line no-param-reassign
  options = utils$1.toFlatObject(
    options,
    {
      metaTokens: true,
      dots: false,
      indexes: false,
    },
    false,
    function defined(option, source) {
      // eslint-disable-next-line no-eq-null,eqeqeq
      return !utils$1.isUndefined(source[option]);
    }
  );

  const metaTokens = options.metaTokens;
  // eslint-disable-next-line no-use-before-define
  const visitor = options.visitor || defaultVisitor;
  const dots = options.dots;
  const indexes = options.indexes;
  const _Blob = options.Blob || (typeof Blob !== 'undefined' && Blob);
  const maxDepth = options.maxDepth === undefined ? DEFAULT_FORM_DATA_MAX_DEPTH : options.maxDepth;
  const useBlob = _Blob && utils$1.isSpecCompliantForm(formData);
  const stack = [];

  if (!utils$1.isFunction(visitor)) {
    throw new TypeError('visitor must be a function');
  }

  function convertValue(value) {
    if (value === null) return '';

    if (utils$1.isDate(value)) {
      return value.toISOString();
    }

    if (utils$1.isBoolean(value)) {
      return value.toString();
    }

    if (!useBlob && utils$1.isBlob(value)) {
      throw new AxiosError$1('Blob is not supported. Use a Buffer instead.');
    }

    if (utils$1.isArrayBuffer(value) || utils$1.isTypedArray(value)) {
      if (useBlob && typeof _Blob === 'function') {
        return new _Blob([value]);
      }
      throw new AxiosError$1('Blob is not supported. Use a Buffer instead.', AxiosError$1.ERR_NOT_SUPPORT);
    }

    return value;
  }

  function throwIfMaxDepthExceeded(depth) {
    if (depth > maxDepth) {
      throw new AxiosError$1(
        'Object is too deeply nested (' + depth + ' levels). Max depth: ' + maxDepth,
        AxiosError$1.ERR_FORM_DATA_DEPTH_EXCEEDED
      );
    }
  }

  function stringifyWithDepthLimit(value, depth) {
    if (maxDepth === Infinity) {
      return JSON.stringify(value);
    }

    const ancestors = [];

    return JSON.stringify(value, function limitDepth(_key, currentValue) {
      if (!utils$1.isObject(currentValue)) {
        return currentValue;
      }

      while (ancestors.length && ancestors[ancestors.length - 1] !== this) {
        ancestors.pop();
      }

      ancestors.push(currentValue);
      throwIfMaxDepthExceeded(depth + ancestors.length - 1);

      return currentValue;
    });
  }

  /**
   * Default visitor.
   *
   * @param {*} value
   * @param {String|Number} key
   * @param {Array<String|Number>} path
   * @this {FormData}
   *
   * @returns {boolean} return true to visit the each prop of the value recursively
   */
  function defaultVisitor(value, key, path) {
    let arr = value;

    if (utils$1.isReactNative(formData) && utils$1.isReactNativeBlob(value)) {
      formData.append(renderKey(path, key, dots), convertValue(value));
      return false;
    }

    if (value && !path && typeof value === 'object') {
      if (utils$1.endsWith(key, '{}')) {
        // eslint-disable-next-line no-param-reassign
        key = metaTokens ? key : key.slice(0, -2);
        // eslint-disable-next-line no-param-reassign
        value = stringifyWithDepthLimit(value, 1);
      } else if (
        (utils$1.isArray(value) && isFlatArray(value)) ||
        ((utils$1.isFileList(value) || utils$1.endsWith(key, '[]')) && (arr = utils$1.toArray(value)))
      ) {
        // eslint-disable-next-line no-param-reassign
        key = removeBrackets(key);

        arr.forEach(function each(el, index) {
          !(utils$1.isUndefined(el) || el === null) &&
            formData.append(
              // eslint-disable-next-line no-nested-ternary
              indexes === true
                ? renderKey([key], index, dots)
                : indexes === null
                  ? key
                  : key + '[]',
              convertValue(el)
            );
        });
        return false;
      }
    }

    if (isVisitable(value)) {
      return true;
    }

    formData.append(renderKey(path, key, dots), convertValue(value));

    return false;
  }

  const exposedHelpers = Object.assign(predicates, {
    defaultVisitor,
    convertValue,
    isVisitable,
  });

  function build(value, path, depth = 0) {
    if (utils$1.isUndefined(value)) return;

    throwIfMaxDepthExceeded(depth);

    if (stack.indexOf(value) !== -1) {
      throw new Error('Circular reference detected in ' + path.join('.'));
    }

    stack.push(value);

    utils$1.forEach(value, function each(el, key) {
      const result =
        !(utils$1.isUndefined(el) || el === null) &&
        visitor.call(formData, el, utils$1.isString(key) ? key.trim() : key, path, exposedHelpers);

      if (result === true) {
        build(el, path ? path.concat(key) : [key], depth + 1);
      }
    });

    stack.pop();
  }

  if (!utils$1.isObject(obj)) {
    throw new TypeError('data must be an object');
  }

  build(obj);

  return formData;
}

/**
 * It encodes a string by replacing all characters that are not in the unreserved set with
 * their percent-encoded equivalents
 *
 * @param {string} str - The string to encode.
 *
 * @returns {string} The encoded string.
 */
function encode$1(str) {
  const charMap = {
    '!': '%21',
    "'": '%27',
    '(': '%28',
    ')': '%29',
    '~': '%7E',
    '%20': '+',
  };
  return encodeURIComponent(str).replace(/[!'()~]|%20/g, function replacer(match) {
    return charMap[match];
  });
}

/**
 * It takes a params object and converts it to a FormData object
 *
 * @param {Object<string, any>} params - The parameters to be converted to a FormData object.
 * @param {Object<string, any>} options - The options object passed to the Axios constructor.
 *
 * @returns {void}
 */
function AxiosURLSearchParams(params, options) {
  this._pairs = [];

  params && toFormData$1(params, this, options);
}

const prototype = AxiosURLSearchParams.prototype;

prototype.append = function append(name, value) {
  this._pairs.push([name, value]);
};

prototype.toString = function toString(encoder) {
  const _encode = encoder
    ? (value) => encoder.call(this, value, encode$1)
    : encode$1;

  return this._pairs
    .map(function each(pair) {
      return _encode(pair[0]) + '=' + _encode(pair[1]);
    }, '')
    .join('&');
};

/**
 * It replaces URL-encoded forms of `:`, `$`, `,`, and spaces with
 * their plain counterparts (`:`, `$`, `,`, `+`).
 *
 * @param {string} val The value to be encoded.
 *
 * @returns {string} The encoded value.
 */
function encode(val) {
  return encodeURIComponent(val)
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/%20/g, '+');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @param {?(object|Function)} options
 *
 * @returns {string} The formatted url
 */
function buildURL(url, params, options) {
  if (!params) {
    return url;
  }
  url = url || '';

  const _options = utils$1.isFunction(options)
    ? {
        serialize: options,
      }
    : options;

  // Read serializer options pollution-safely: own properties and methods on a
  // class/template prototype are honored, but values injected onto a polluted
  // Object.prototype are ignored.
  const _encode = utils$1.getSafeProp(_options, 'encode') || encode;
  const serializeFn = utils$1.getSafeProp(_options, 'serialize');

  let serializedParams;

  if (serializeFn) {
    serializedParams = serializeFn(params, _options);
  } else {
    serializedParams = utils$1.isURLSearchParams(params)
      ? params.toString()
      : new AxiosURLSearchParams(params, _options).toString(_encode);
  }

  if (serializedParams) {
    const hashmarkIndex = url.indexOf('#');

    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
}

class InterceptorManager {
  constructor() {
    this.handlers = [];
  }

  /**
   * Add a new interceptor to the stack
   *
   * @param {Function} fulfilled The function to handle `then` for a `Promise`
   * @param {Function} rejected The function to handle `reject` for a `Promise`
   * @param {Object} options The options for the interceptor, synchronous and runWhen
   *
   * @return {Number} An ID used to remove interceptor later
   */
  use(fulfilled, rejected, options) {
    this.handlers.push({
      fulfilled,
      rejected,
      synchronous: options ? options.synchronous : false,
      runWhen: options ? options.runWhen : null,
    });
    return this.handlers.length - 1;
  }

  /**
   * Remove an interceptor from the stack
   *
   * @param {Number} id The ID that was returned by `use`
   *
   * @returns {void}
   */
  eject(id) {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }

  /**
   * Clear all interceptors from the stack
   *
   * @returns {void}
   */
  clear() {
    if (this.handlers) {
      this.handlers = [];
    }
  }

  /**
   * Iterate over all the registered interceptors
   *
   * This method is particularly useful for skipping over any
   * interceptors that may have become `null` calling `eject`.
   *
   * @param {Function} fn The function to call for each interceptor
   *
   * @returns {void}
   */
  forEach(fn) {
    utils$1.forEach(this.handlers, function forEachHandler(h) {
      if (h !== null) {
        fn(h);
      }
    });
  }
}

const transitionalDefaults = {
  silentJSONParsing: true,
  forcedJSONParsing: true,
  clarifyTimeoutError: false,
  legacyInterceptorReqResOrdering: true,
  advertiseZstdAcceptEncoding: false,
  validateStatusUndefinedResolves: true,
};

const URLSearchParams$1 = typeof URLSearchParams !== 'undefined' ? URLSearchParams : AxiosURLSearchParams;

const FormData$1 = typeof FormData !== 'undefined' ? FormData : null;

const Blob$1 = typeof Blob !== 'undefined' ? Blob : null;

const platform$1 = {
  isBrowser: true,
  classes: {
    URLSearchParams: URLSearchParams$1,
    FormData: FormData$1,
    Blob: Blob$1,
  },
  protocols: ['http', 'https', 'file', 'blob', 'url', 'data'],
};

const hasBrowserEnv = typeof window !== 'undefined' && typeof document !== 'undefined';

const _navigator = (typeof navigator === 'object' && navigator) || undefined;

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  navigator.product -> 'ReactNative'
 * nativescript
 *  navigator.product -> 'NativeScript' or 'NS'
 *
 * @returns {boolean}
 */
const hasStandardBrowserEnv =
  hasBrowserEnv &&
  (!_navigator || ['ReactNative', 'NativeScript', 'NS'].indexOf(_navigator.product) < 0);

/**
 * Determine if we're running in a standard browser webWorker environment
 *
 * Although the `isStandardBrowserEnv` method indicates that
 * `allows axios to run in a web worker`, the WebWorker will still be
 * filtered out due to its judgment standard
 * `typeof window !== 'undefined' && typeof document !== 'undefined'`.
 * This leads to a problem when axios post `FormData` in webWorker
 */
const hasStandardBrowserWebWorkerEnv = (() => {
  return (
    typeof WorkerGlobalScope !== 'undefined' &&
    // eslint-disable-next-line no-undef
    self instanceof WorkerGlobalScope &&
    typeof self.importScripts === 'function'
  );
})();

const origin = (hasBrowserEnv && window.location.href) || 'http://localhost';

const utils = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  hasBrowserEnv,
  hasStandardBrowserEnv,
  hasStandardBrowserWebWorkerEnv,
  navigator: _navigator,
  origin
}, Symbol.toStringTag, { value: 'Module' }));

const platform = {
  ...utils,
  ...platform$1,
};

function toURLEncodedForm(data, options) {
  return toFormData$1(data, new platform.classes.URLSearchParams(), {
    visitor: function (value, key, path, helpers) {
      if (platform.isNode && utils$1.isBuffer(value)) {
        this.append(key, value.toString('base64'));
        return false;
      }

      return helpers.defaultVisitor.apply(this, arguments);
    },
    ...options,
  });
}

const MAX_DEPTH = DEFAULT_FORM_DATA_MAX_DEPTH;

function throwIfDepthExceeded(index) {
  if (index > MAX_DEPTH) {
    throw new AxiosError$1(
      'FormData field is too deeply nested (' + index + ' levels). Max depth: ' + MAX_DEPTH,
      AxiosError$1.ERR_FORM_DATA_DEPTH_EXCEEDED
    );
  }
}

/**
 * It takes a string like `foo[x][y][z]` and returns an array like `['foo', 'x', 'y', 'z']
 *
 * @param {string} name - The name of the property to get.
 *
 * @returns An array of strings.
 */
function parsePropPath(name) {
  // foo[x][y][z] -> ['foo', 'x', 'y', 'z']
  // foo.x.y.z    -> ['foo', 'x', 'y', 'z']
  // A path is split on `.` and on `[...]` groups. A segment — whether written
  // in dot notation or captured inside brackets — may contain any character
  // except `.`, `[` and `]`, so a key like `user-name` or `user name` is kept
  // literal instead of being split (#5402). `.`, `[` and `]` keep their existing
  // meaning, e.g. `foo[bar.baz]` -> ['foo', 'bar', 'baz'] and `[]` is an array push.
  // Excluding `[` from the bracket group also makes the match fail fast at the
  // next `[`, so a malformed name cannot rescan to the end of the string from
  // every unmatched `[` — parsing stays linear in the length of the name.
  const path = [];
  const pattern = /[^.[\]]+|\[([^.[\]]*)]/g;
  let match;

  while ((match = pattern.exec(name)) !== null) {
    throwIfDepthExceeded(path.length);
    path.push(match[0] === '[]' ? '' : match[1] || match[0]);
  }

  return path;
}

/**
 * Convert an array to an object.
 *
 * @param {Array<any>} arr - The array to convert to an object.
 *
 * @returns An object with the same keys and values as the array.
 */
function arrayToObject(arr) {
  const obj = {};
  const keys = Object.keys(arr);
  let i;
  const len = keys.length;
  let key;
  for (i = 0; i < len; i++) {
    key = keys[i];
    obj[key] = arr[key];
  }
  return obj;
}

/**
 * It takes a FormData object and returns a JavaScript object
 *
 * @param {string} formData The FormData object to convert to JSON.
 *
 * @returns {Object<string, any> | null} The converted object.
 */
function formDataToJSON(formData) {
  function buildPath(path, value, target, index) {
    throwIfDepthExceeded(index);

    let name = path[index++];

    if (name === '__proto__') return true;

    const isNumericKey = Number.isFinite(+name);
    const isLast = index >= path.length;
    name = !name && utils$1.isArray(target) ? target.length : name;

    if (isLast) {
      if (utils$1.hasOwnProp(target, name)) {
        target[name] = utils$1.isArray(target[name])
          ? target[name].concat(value)
          : [target[name], value];
      } else {
        target[name] = value;
      }

      return !isNumericKey;
    }

    if (!utils$1.hasOwnProp(target, name) || !utils$1.isObject(target[name])) {
      target[name] = [];
    }

    const result = buildPath(path, value, target[name], index);

    if (result && utils$1.isArray(target[name])) {
      target[name] = arrayToObject(target[name]);
    }

    return !isNumericKey;
  }

  if (utils$1.isFormData(formData) && utils$1.isFunction(formData.entries)) {
    const obj = {};

    utils$1.forEachEntry(formData, (name, value) => {
      buildPath(parsePropPath(name), value, obj, 0);
    });

    return obj;
  }

  return null;
}

const own = (obj, key) => (obj != null && utils$1.hasOwnProp(obj, key) ? obj[key] : undefined);

/**
 * It takes a string, tries to parse it, and if it fails, it returns the stringified version
 * of the input
 *
 * @param {any} rawValue - The value to be stringified.
 * @param {Function} parser - A function that parses a string into a JavaScript object.
 * @param {Function} encoder - A function that takes a value and returns a string.
 *
 * @returns {string} A stringified version of the rawValue.
 */
function stringifySafely(rawValue, parser, encoder) {
  if (utils$1.isString(rawValue)) {
    try {
      (parser || JSON.parse)(rawValue);
      return utils$1.trim(rawValue);
    } catch (e) {
      if (e.name !== 'SyntaxError') {
        throw e;
      }
    }
  }

  return (encoder || JSON.stringify)(rawValue);
}

const defaults = {
  transitional: transitionalDefaults,

  adapter: ['xhr', 'http', 'fetch'],

  transformRequest: [
    function transformRequest(data, headers) {
      const contentType = headers.getContentType() || '';
      const hasJSONContentType = contentType.indexOf('application/json') > -1;
      const isObjectPayload = utils$1.isObject(data);

      if (isObjectPayload && utils$1.isHTMLForm(data)) {
        data = new FormData(data);
      }

      const isFormData = utils$1.isFormData(data);

      if (isFormData) {
        return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data;
      }

      if (
        utils$1.isArrayBuffer(data) ||
        utils$1.isBuffer(data) ||
        utils$1.isStream(data) ||
        utils$1.isFile(data) ||
        utils$1.isBlob(data) ||
        utils$1.isReadableStream(data)
      ) {
        return data;
      }
      if (utils$1.isArrayBufferView(data)) {
        return data.buffer;
      }
      if (utils$1.isURLSearchParams(data)) {
        headers.setContentType('application/x-www-form-urlencoded;charset=utf-8', false);
        return data.toString();
      }

      let isFileList;

      if (isObjectPayload) {
        const formSerializer = own(this, 'formSerializer');
        if (contentType.indexOf('application/x-www-form-urlencoded') > -1) {
          return toURLEncodedForm(data, formSerializer).toString();
        }

        if (
          (isFileList = utils$1.isFileList(data)) ||
          contentType.indexOf('multipart/form-data') > -1
        ) {
          const env = own(this, 'env');
          const _FormData = env && env.FormData;

          return toFormData$1(
            isFileList ? { 'files[]': data } : data,
            _FormData && new _FormData(),
            formSerializer
          );
        }
      }

      if (isObjectPayload || hasJSONContentType) {
        headers.setContentType('application/json', false);
        return stringifySafely(data);
      }

      return data;
    },
  ],

  transformResponse: [
    function transformResponse(data) {
      const transitional = own(this, 'transitional') || defaults.transitional;
      const forcedJSONParsing = transitional && transitional.forcedJSONParsing;
      const responseType = own(this, 'responseType');
      const JSONRequested = responseType === 'json';

      if (utils$1.isResponse(data) || utils$1.isReadableStream(data)) {
        return data;
      }

      if (
        data &&
        utils$1.isString(data) &&
        ((forcedJSONParsing && !responseType) || JSONRequested)
      ) {
        const silentJSONParsing = transitional && transitional.silentJSONParsing;
        const strictJSONParsing = !silentJSONParsing && JSONRequested;

        try {
          return JSON.parse(data, own(this, 'parseReviver'));
        } catch (e) {
          if (strictJSONParsing) {
            if (e.name === 'SyntaxError') {
              throw AxiosError$1.from(e, AxiosError$1.ERR_BAD_RESPONSE, this, null, own(this, 'response'));
            }
            throw e;
          }
        }
      }

      return data;
    },
  ],

  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  maxContentLength: -1,
  maxBodyLength: -1,

  env: {
    FormData: platform.classes.FormData,
    Blob: platform.classes.Blob,
  },

  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  },

  headers: {
    common: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': undefined,
    },
  },
};

utils$1.forEach(['delete', 'get', 'head', 'post', 'put', 'patch', 'query'], (method) => {
  defaults.headers[method] = {};
});

/**
 * Transform the data for a request or a response
 *
 * @param {Array|Function} fns A single function or Array of functions
 * @param {?Object} response The response object
 *
 * @returns {*} The resulting transformed data
 */
function transformData(fns, response) {
  const config = this || defaults;
  const context = response || config;
  const headers = AxiosHeaders$1.from(context.headers);
  let data = context.data;

  utils$1.forEach(fns, function transform(fn) {
    data = fn.call(config, data, headers.normalize(), response ? response.status : undefined);
  });

  headers.normalize();

  return data;
}

function isCancel$1(value) {
  return !!(value && value.__CANCEL__);
}

let CanceledError$1 = class CanceledError extends AxiosError$1 {
  /**
   * A `CanceledError` is an object that is thrown when an operation is canceled.
   *
   * @param {string=} message The message.
   * @param {Object=} config The config.
   * @param {Object=} request The request.
   *
   * @returns {CanceledError} The created error.
   */
  constructor(message, config, request) {
    super(message == null ? 'canceled' : message, AxiosError$1.ERR_CANCELED, config, request);
    this.name = 'CanceledError';
    this.__CANCEL__ = true;
  }
};

/**
 * Resolve or reject a Promise based on response status.
 *
 * @param {Function} resolve A function that resolves the promise.
 * @param {Function} reject A function that rejects the promise.
 * @param {object} response The response.
 *
 * @returns {object} The response.
 */
function settle(resolve, reject, response) {
  const validateStatus = response.config.validateStatus;
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(new AxiosError$1(
      'Request failed with status code ' + response.status,
      response.status >= 400 && response.status < 500 ? AxiosError$1.ERR_BAD_REQUEST : AxiosError$1.ERR_BAD_RESPONSE,
      response.config,
      response.request,
      response
    ));
  }
}

function parseProtocol(url) {
  const match = /^([-+\w]{1,25}):(?:\/\/)?/.exec(url);
  return (match && match[1]) || '';
}

/**
 * Calculate data maxRate
 * @param {Number} [samplesCount= 10]
 * @param {Number} [min= 1000]
 * @returns {Function}
 */
function speedometer(samplesCount, min) {
  samplesCount = samplesCount || 10;
  const bytes = new Array(samplesCount);
  const timestamps = new Array(samplesCount);
  let head = 0;
  let tail = 0;
  let firstSampleTS;

  min = min !== undefined ? min : 1000;

  return function push(chunkLength) {
    const now = Date.now();

    const startedAt = timestamps[tail];

    if (!firstSampleTS) {
      firstSampleTS = now;
    }

    bytes[head] = chunkLength;
    timestamps[head] = now;

    let i = tail;
    let bytesCount = 0;

    while (i !== head) {
      bytesCount += bytes[i++];
      i = i % samplesCount;
    }

    head = (head + 1) % samplesCount;

    if (head === tail) {
      tail = (tail + 1) % samplesCount;
    }

    if (now - firstSampleTS < min) {
      return;
    }

    const passed = startedAt && now - startedAt;

    return passed ? Math.round((bytesCount * 1000) / passed) : undefined;
  };
}

/**
 * Throttle decorator
 * @param {Function} fn
 * @param {Number} freq
 * @return {Function}
 */
function throttle(fn, freq) {
  let timestamp = 0;
  let threshold = 1000 / freq;
  let lastArgs;
  let timer;

  const invoke = (args, now = Date.now()) => {
    timestamp = now;
    lastArgs = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    fn(...args);
  };

  const throttled = (...args) => {
    const now = Date.now();
    const passed = now - timestamp;
    if (passed >= threshold) {
      invoke(args, now);
    } else {
      lastArgs = args;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          invoke(lastArgs);
        }, threshold - passed);
      }
    }
  };

  const flush = () => lastArgs && invoke(lastArgs);

  return [throttled, flush];
}

const progressEventReducer = (listener, isDownloadStream, freq = 3) => {
  let bytesNotified = 0;
  const _speedometer = speedometer(50, 250);

  return throttle((e) => {
    if (!e || typeof e.loaded !== 'number') {
      return;
    }
    const rawLoaded = e.loaded;
    const total = e.lengthComputable ? e.total : undefined;
    const loaded = Math.max(0, total != null ? Math.min(rawLoaded, total) : rawLoaded);
    const progressBytes = Math.max(0, loaded - bytesNotified);
    const rate = _speedometer(progressBytes);

    bytesNotified = Math.max(bytesNotified, loaded);

    const data = {
      loaded,
      total,
      progress: total ? loaded / total : undefined,
      bytes: progressBytes,
      rate: rate ? rate : undefined,
      estimated: rate && total ? (total - loaded) / rate : undefined,
      event: e,
      lengthComputable: total != null,
      [isDownloadStream ? 'download' : 'upload']: true,
    };

    listener(data);
  }, freq);
};

const progressEventDecorator = (total, throttled) => {
  const lengthComputable = total != null;

  return [
    (loaded) =>
      throttled[0]({
        lengthComputable,
        total,
        loaded,
      }),
    throttled[1],
  ];
};

const asyncDecorator =
  (fn, scheduler = utils$1.asap) =>
  (...args) =>
    scheduler(() => fn(...args));

const isURLSameOrigin = platform.hasStandardBrowserEnv
  ? ((origin, isMSIE) => (url) => {
      url = new URL(url, platform.origin);

      return (
        origin.protocol === url.protocol &&
        origin.host === url.host &&
        (isMSIE || origin.port === url.port)
      );
    })(
      new URL(platform.origin),
      platform.navigator && /(msie|trident)/i.test(platform.navigator.userAgent)
    )
  : () => true;

const cookies = platform.hasStandardBrowserEnv
  ? // Standard browser envs support document.cookie
    {
      write(name, value, expires, path, domain, secure, sameSite) {
        if (typeof document === 'undefined') return;

        const cookie = [`${name}=${encodeURIComponent(value)}`];

        if (utils$1.isNumber(expires)) {
          cookie.push(`expires=${new Date(expires).toUTCString()}`);
        }
        if (utils$1.isString(path)) {
          cookie.push(`path=${path}`);
        }
        if (utils$1.isString(domain)) {
          cookie.push(`domain=${domain}`);
        }
        if (secure === true) {
          cookie.push('secure');
        }
        if (utils$1.isString(sameSite)) {
          cookie.push(`SameSite=${sameSite}`);
        }

        document.cookie = cookie.join('; ');
      },

      read(name) {
        if (typeof document === 'undefined') return null;
        // Match name=value by splitting on the semicolon separator instead of building a
        // RegExp from `name` — interpolating an unescaped string into a RegExp would let
        // metacharacters (e.g. `.+?` in an attacker-influenced cookie name) cause ReDoS or
        // match the wrong cookie. Browsers may serialize cookie pairs as either ";" or
        // "; ", so ignore optional whitespace before each cookie name.
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i].replace(/^\s+/, '');
          const eq = cookie.indexOf('=');
          if (eq !== -1 && cookie.slice(0, eq) === name) {
            try {
              return decodeURIComponent(cookie.slice(eq + 1));
            } catch (e) {
              return cookie.slice(eq + 1);
            }
          }
        }
        return null;
      },

      remove(name) {
        this.write(name, '', Date.now() - 86400000, '/');
      },
    }
  : // Non-standard browser env (web workers, react-native) lack needed support.
    {
      write() {},
      read() {
        return null;
      },
      remove() {},
    };

/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 *
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  if (typeof url !== 'string') {
    return false;
  }

  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 *
 * @returns {string} The combined URL
 */
function combineURLs(baseURL, relativeURL) {
  if (!relativeURL) {
    return baseURL;
  }

  let end = baseURL.length;

  while (end > 0 && baseURL.charCodeAt(end - 1) === 47) {
    end--;
  }

  return baseURL.slice(0, end) + '/' + relativeURL.replace(/^\/+/, '');
}

const malformedHttpProtocol = /^https?:(?!\/\/)/i;
const httpProtocolControlCharacters = /[\t\n\r]/g;

function stripLeadingC0ControlOrSpace(url) {
  let i = 0;
  while (i < url.length && url.charCodeAt(i) <= 0x20) {
    i++;
  }
  return url.slice(i);
}

function normalizeURLForProtocolCheck(url) {
  return stripLeadingC0ControlOrSpace(url).replace(httpProtocolControlCharacters, '');
}

// Redact the parts of a URL that can carry secrets before it is embedded in an
// error message. AxiosError.toJSON() serializes `message` verbatim and errors
// are commonly logged, while the opt-in `config.redact` model only cleans
// config keys — it cannot reach the message. Redact only the genuinely
// sensitive substrings — userinfo (credentials), query parameter values and
// fragment contents — with the same REDACTED marker the config redaction uses,
// while keeping the scheme, host, path and parameter names so the offending
// request stays accurately identifiable.
function redactFragment(fragment) {
  if (!fragment) {
    return fragment;
  }

  return fragment.replace(/(^|&)([^=&]*=)?[^&]+/g, (match, separator, parameterName = '') => {
    return `${separator}${parameterName}${REDACTED}`;
  });
}

function redactSensitiveURLParts(url) {
  const redactedURL = url.replace(/^(https?:\/{0,2})[^/?#]*@/i, `$1${REDACTED}@`);
  const fragmentIndex = redactedURL.indexOf('#');
  const urlWithoutFragment =
    fragmentIndex === -1 ? redactedURL : redactedURL.slice(0, fragmentIndex);
  const redactedURLWithoutFragment = urlWithoutFragment.replace(
    /([?&][^=&#]*=)[^&#]*/g,
    `$1${REDACTED}`
  );

  if (fragmentIndex === -1) {
    return redactedURLWithoutFragment;
  }

  return `${redactedURLWithoutFragment}#${redactFragment(redactedURL.slice(fragmentIndex + 1))}`;
}

function assertValidHttpProtocolURL(url, config) {
  if (typeof url === 'string') {
    const normalizedURL = normalizeURLForProtocolCheck(url);
    if (malformedHttpProtocol.test(normalizedURL)) {
      throw new AxiosError$1(
        `Invalid URL ${JSON.stringify(redactSensitiveURLParts(normalizedURL))}: missing "//" after protocol`,
        AxiosError$1.ERR_INVALID_URL,
        config
      );
    }
  }
}

/**
 * Creates a new URL by combining the baseURL with the requestedURL,
 * only when the requestedURL is not already an absolute URL.
 * If the requestURL is absolute, this function returns the requestedURL untouched.
 *
 * @param {string} baseURL The base URL
 * @param {string} requestedURL Absolute or relative URL to combine
 *
 * @returns {string} The combined full path
 */
function buildFullPath(baseURL, requestedURL, allowAbsoluteUrls, config) {
  assertValidHttpProtocolURL(requestedURL, config);
  let isRelativeUrl = !isAbsoluteURL(requestedURL);
  if (baseURL && (isRelativeUrl || allowAbsoluteUrls === false)) {
    assertValidHttpProtocolURL(baseURL, config);
    return combineURLs(baseURL, requestedURL);
  }
  return requestedURL;
}

const headersToObject = (thing) => (thing instanceof AxiosHeaders$1 ? { ...thing } : thing);

const ownEnumerableKeys = (thing) => {
  if (Object.getOwnPropertySymbols && Object.getOwnPropertyDescriptor) {
    return Object.keys(thing).concat(
      Object.getOwnPropertySymbols(thing).filter(
        (symbol) => Object.getOwnPropertyDescriptor(thing, symbol).enumerable
      )
    );
  }
  return Object.keys(thing);
};

/**
 * Config-specific merge-function which creates a new config-object
 * by merging two configuration objects together.
 *
 * @param {Object} config1
 * @param {Object} config2
 *
 * @returns {Object} New object resulting from merging config2 to config1
 */
function mergeConfig$1(config1, config2) {
  // eslint-disable-next-line no-param-reassign
  config1 = config1 || {};
  config2 = config2 || {};

  // Use a null-prototype object so that downstream reads such as `config.auth`
  // or `config.baseURL` cannot inherit polluted values from Object.prototype.
  // `hasOwnProperty` is restored as a non-enumerable own slot to preserve
  // ergonomics for user code that relies on it.
  const config = Object.create(null);
  Object.defineProperty(config, 'hasOwnProperty', {
    // Null-proto descriptor so a polluted Object.prototype.get cannot turn
    // this data descriptor into an accessor descriptor on the way in.
    __proto__: null,
    value: Object.prototype.hasOwnProperty,
    enumerable: false,
    writable: true,
    configurable: true,
  });

  function getMergedValue(target, source, prop, caseless) {
    if (utils$1.isPlainObject(target) && utils$1.isPlainObject(source)) {
      return utils$1.merge.call({ caseless }, target, source);
    } else if (utils$1.isPlainObject(source)) {
      return utils$1.merge({}, source);
    } else if (utils$1.isArray(source)) {
      return source.slice();
    }
    return source;
  }

  function mergeDeepProperties(a, b, prop, caseless) {
    if (!utils$1.isUndefined(b)) {
      return getMergedValue(a, b, prop, caseless);
    } else if (!utils$1.isUndefined(a)) {
      return getMergedValue(undefined, a, prop, caseless);
    }
  }

  // eslint-disable-next-line consistent-return
  function valueFromConfig2(a, b) {
    if (!utils$1.isUndefined(b)) {
      return getMergedValue(undefined, b);
    }
  }

  // eslint-disable-next-line consistent-return
  function defaultToConfig2(a, b) {
    if (!utils$1.isUndefined(b)) {
      return getMergedValue(undefined, b);
    } else if (!utils$1.isUndefined(a)) {
      return getMergedValue(undefined, a);
    }
  }

  function getMergedTransitionalOption(prop) {
    const transitional2 = utils$1.hasOwnProp(config2, 'transitional')
      ? config2.transitional
      : undefined;

    if (!utils$1.isUndefined(transitional2)) {
      if (utils$1.isPlainObject(transitional2)) {
        if (utils$1.hasOwnProp(transitional2, prop)) {
          return transitional2[prop];
        }
      } else {
        return undefined;
      }
    }

    const transitional1 = utils$1.hasOwnProp(config1, 'transitional')
      ? config1.transitional
      : undefined;

    if (utils$1.isPlainObject(transitional1) && utils$1.hasOwnProp(transitional1, prop)) {
      return transitional1[prop];
    }

    return undefined;
  }

  // eslint-disable-next-line consistent-return
  function mergeDirectKeys(a, b, prop) {
    if (utils$1.hasOwnProp(config2, prop)) {
      return getMergedValue(a, b);
    } else if (utils$1.hasOwnProp(config1, prop)) {
      return getMergedValue(undefined, a);
    }
  }

  const mergeMap = {
    url: valueFromConfig2,
    method: valueFromConfig2,
    data: valueFromConfig2,
    baseURL: defaultToConfig2,
    transformRequest: defaultToConfig2,
    transformResponse: defaultToConfig2,
    paramsSerializer: defaultToConfig2,
    timeout: defaultToConfig2,
    timeoutMessage: defaultToConfig2,
    withCredentials: defaultToConfig2,
    withXSRFToken: defaultToConfig2,
    adapter: defaultToConfig2,
    responseType: defaultToConfig2,
    xsrfCookieName: defaultToConfig2,
    xsrfHeaderName: defaultToConfig2,
    onUploadProgress: defaultToConfig2,
    onDownloadProgress: defaultToConfig2,
    decompress: defaultToConfig2,
    maxContentLength: defaultToConfig2,
    maxBodyLength: defaultToConfig2,
    beforeRedirect: defaultToConfig2,
    transport: defaultToConfig2,
    httpAgent: defaultToConfig2,
    httpsAgent: defaultToConfig2,
    cancelToken: defaultToConfig2,
    socketPath: defaultToConfig2,
    allowedSocketPaths: defaultToConfig2,
    responseEncoding: defaultToConfig2,
    validateStatus: mergeDirectKeys,
    headers: (a, b, prop) =>
      mergeDeepProperties(headersToObject(a), headersToObject(b), prop, true),
  };

  utils$1.forEach(ownEnumerableKeys({ ...config1, ...config2 }), function computeConfigValue(prop) {
    if (prop === '__proto__' || prop === 'constructor' || prop === 'prototype') return;
    const merge = utils$1.hasOwnProp(mergeMap, prop) ? mergeMap[prop] : mergeDeepProperties;
    const a = utils$1.hasOwnProp(config1, prop) ? config1[prop] : undefined;
    const b = utils$1.hasOwnProp(config2, prop) ? config2[prop] : undefined;
    const configValue = merge(a, b, prop);
    (utils$1.isUndefined(configValue) && merge !== mergeDirectKeys) || (config[prop] = configValue);
  });

  if (
    utils$1.hasOwnProp(config2, 'validateStatus') &&
    utils$1.isUndefined(config2.validateStatus) &&
    getMergedTransitionalOption('validateStatusUndefinedResolves') === false
  ) {
    if (utils$1.hasOwnProp(config1, 'validateStatus')) {
      config.validateStatus = getMergedValue(undefined, config1.validateStatus);
    } else {
      delete config.validateStatus;
    }
  }

  return config;
}

const FORM_DATA_CONTENT_HEADERS = ['content-type', 'content-length'];

/**
 * Apply the headers generated by a FormData implementation to the request headers,
 * honoring the `formDataHeaderPolicy` option: with 'content-only', copy only the
 * content-* headers; otherwise merge all of them.
 *
 * @param {AxiosHeaders} headers - the request headers to mutate
 * @param {Object | null | undefined} formHeaders - headers produced by the FormData implementation
 * @param {String} [policy] - the resolved `formDataHeaderPolicy` config value
 *
 * @returns {void}
 */
function setFormDataHeaders(headers, formHeaders, policy) {
  if (policy !== 'content-only') {
    headers.set(formHeaders);
    return;
  }

  Object.entries(formHeaders || {}).forEach(([key, val]) => {
    if (FORM_DATA_CONTENT_HEADERS.includes(key.toLowerCase())) {
      headers.set(key, val);
    }
  });
}

/**
 * Encode a UTF-8 string to a Latin-1 byte string for use with btoa().
 * This is a modern replacement for the deprecated unescape(encodeURIComponent(str)) pattern.
 *
 * @param {string} str The string to encode
 *
 * @returns {string} UTF-8 bytes as a Latin-1 string
 */
const encodeUTF8$1 = (str) =>
  encodeURIComponent(str).replace(/%([0-9A-F]{2})/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

function resolveConfig(config) {
  const newConfig = mergeConfig$1({}, config);

  // Read only own properties to prevent prototype pollution gadgets
  // (e.g. Object.prototype.baseURL = 'https://evil.com').
  const own = (key) => (utils$1.hasOwnProp(newConfig, key) ? newConfig[key] : undefined);

  const data = own('data');
  let withXSRFToken = own('withXSRFToken');
  const xsrfHeaderName = own('xsrfHeaderName');
  const xsrfCookieName = own('xsrfCookieName');
  let headers = own('headers');
  const auth = own('auth');
  const baseURL = own('baseURL');
  const allowAbsoluteUrls = own('allowAbsoluteUrls');
  const url = own('url');

  newConfig.headers = headers = AxiosHeaders$1.from(headers);

  newConfig.url = buildURL(
    buildFullPath(baseURL, url, allowAbsoluteUrls, newConfig),
    own('params'),
    own('paramsSerializer')
  );

  // HTTP basic authentication
  if (auth) {
    const username = utils$1.getSafeProp(auth, 'username') || '';
    const password = utils$1.getSafeProp(auth, 'password') || '';

    try {
      headers.set(
        'Authorization',
        'Basic ' + btoa(username + ':' + (password ? encodeUTF8$1(password) : ''))
      );
    } catch (e) {
      throw AxiosError$1.from(e, AxiosError$1.ERR_BAD_OPTION_VALUE, config);
    }
  }

  if (utils$1.isFormData(data)) {
    if (
      platform.hasStandardBrowserEnv ||
      platform.hasStandardBrowserWebWorkerEnv ||
      utils$1.isReactNative(data)
    ) {
      headers.setContentType(undefined); // browser/web worker/RN handles it
    } else if (utils$1.isFunction(data.getHeaders)) {
      // Node.js FormData (like form-data package)
      setFormDataHeaders(headers, data.getHeaders(), own('formDataHeaderPolicy'));
    }
  }

  // Add xsrf header
  // This is only done if running in a standard browser environment.
  // Specifically not if we're in a web worker, or react-native.

  if (platform.hasStandardBrowserEnv) {
    if (utils$1.isFunction(withXSRFToken)) {
      withXSRFToken = withXSRFToken(newConfig);
    }

    // Strict boolean check — prevents proto-pollution gadgets (e.g. Object.prototype.withXSRFToken = 1)
    // and misconfigurations (e.g. "false") from short-circuiting the same-origin check and leaking
    // the XSRF token cross-origin.
    const shouldSendXSRF =
      withXSRFToken === true || (withXSRFToken == null && isURLSameOrigin(newConfig.url));

    if (shouldSendXSRF) {
      const xsrfValue = xsrfHeaderName && xsrfCookieName && cookies.read(xsrfCookieName);

      if (xsrfValue) {
        headers.set(xsrfHeaderName, xsrfValue);
      }
    }
  }

  return newConfig;
}

const isXHRAdapterSupported = typeof XMLHttpRequest !== 'undefined';

const xhrAdapter = isXHRAdapterSupported &&
  function (config) {
    return new Promise(function dispatchXhrRequest(resolve, reject) {
      const _config = resolveConfig(config);
      let requestData = _config.data;
      const requestHeaders = AxiosHeaders$1.from(_config.headers).normalize();
      let { responseType, onUploadProgress, onDownloadProgress } = _config;
      let onCanceled;
      let uploadThrottled, downloadThrottled;
      let flushUpload, flushDownload;

      function done() {
        flushUpload && flushUpload(); // flush events
        flushDownload && flushDownload(); // flush events

        _config.cancelToken && _config.cancelToken.unsubscribe(onCanceled);

        _config.signal && _config.signal.removeEventListener('abort', onCanceled);
      }

      let request = new XMLHttpRequest();

      request.open(_config.method.toUpperCase(), _config.url, true);

      // Set the request timeout in MS
      request.timeout = _config.timeout;

      function onloadend() {
        if (!request) {
          return;
        }
        // Prepare the response
        const responseHeaders = AxiosHeaders$1.from(
          'getAllResponseHeaders' in request && request.getAllResponseHeaders()
        );
        const responseData =
          !responseType || responseType === 'text' || responseType === 'json'
            ? request.responseText
            : request.response;
        const response = {
          data: responseData,
          status: request.status,
          statusText: request.statusText,
          headers: responseHeaders,
          config,
          request,
        };

        settle(
          function _resolve(value) {
            resolve(value);
            done();
          },
          function _reject(err) {
            reject(err);
            done();
          },
          response
        );

        // Clean up request
        request = null;
      }

      if ('onloadend' in request) {
        // Use onloadend if available
        request.onloadend = onloadend;
      } else {
        // Listen for ready state to emulate onloadend
        request.onreadystatechange = function handleLoad() {
          if (!request || request.readyState !== 4) {
            return;
          }

          // The request errored out and we didn't get a response, this will be
          // handled by onerror instead
          // With one exception: request that using file: protocol, most browsers
          // will return status as 0 even though it's a successful request
          if (
            request.status === 0 &&
            !(request.responseURL && request.responseURL.startsWith('file:'))
          ) {
            return;
          }
          // readystate handler is calling before onerror or ontimeout handlers,
          // so we should call onloadend on the next 'tick'
          setTimeout(onloadend);
        };
      }

      // Handle browser request cancellation (as opposed to a manual cancellation)
      request.onabort = function handleAbort() {
        if (!request) {
          return;
        }

        reject(new AxiosError$1('Request aborted', AxiosError$1.ECONNABORTED, config, request));
        done();

        // Clean up request
        request = null;
      };

      // Handle low level network errors
      request.onerror = function handleError(event) {
        // Browsers deliver a ProgressEvent in XHR onerror
        // (message may be empty; when present, surface it)
        // See https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/error_event
        const msg = event && event.message ? event.message : 'Network Error';
        const err = new AxiosError$1(msg, AxiosError$1.ERR_NETWORK, config, request);
        // attach the underlying event for consumers who want details
        err.event = event || null;
        reject(err);
        done();
        request = null;
      };

      // Handle timeout
      request.ontimeout = function handleTimeout() {
        let timeoutErrorMessage = _config.timeout
          ? 'timeout of ' + _config.timeout + 'ms exceeded'
          : 'timeout exceeded';
        const transitional = _config.transitional || transitionalDefaults;
        if (_config.timeoutErrorMessage) {
          timeoutErrorMessage = _config.timeoutErrorMessage;
        }
        reject(
          new AxiosError$1(
            timeoutErrorMessage,
            transitional.clarifyTimeoutError ? AxiosError$1.ETIMEDOUT : AxiosError$1.ECONNABORTED,
            config,
            request
          )
        );
        done();

        // Clean up request
        request = null;
      };

      // Remove Content-Type if data is undefined
      requestData === undefined && requestHeaders.setContentType(null);

      // Add headers to the request
      if ('setRequestHeader' in request) {
        utils$1.forEach(toByteStringHeaderObject(requestHeaders), function setRequestHeader(val, key) {
          request.setRequestHeader(key, val);
        });
      }

      // Add withCredentials to request if needed
      if (!utils$1.isUndefined(_config.withCredentials)) {
        request.withCredentials = !!_config.withCredentials;
      }

      // Add responseType to request if needed
      if (responseType && responseType !== 'json') {
        request.responseType = _config.responseType;
      }

      // Handle progress if needed
      if (onDownloadProgress) {
        [downloadThrottled, flushDownload] = progressEventReducer(onDownloadProgress, true);
        request.addEventListener('progress', downloadThrottled);
      }

      // Not all browsers support upload events
      if (onUploadProgress && request.upload) {
        [uploadThrottled, flushUpload] = progressEventReducer(onUploadProgress);

        request.upload.addEventListener('progress', uploadThrottled);

        request.upload.addEventListener('loadend', flushUpload);
      }

      if (_config.cancelToken || _config.signal) {
        // Handle cancellation
        // eslint-disable-next-line func-names
        onCanceled = (cancel) => {
          if (!request) {
            return;
          }
          reject(!cancel || cancel.type ? new CanceledError$1(null, config, request) : cancel);
          request.abort();
          done();
          request = null;
        };

        _config.cancelToken && _config.cancelToken.subscribe(onCanceled);
        if (_config.signal) {
          _config.signal.aborted
            ? onCanceled()
            : _config.signal.addEventListener('abort', onCanceled);
        }
      }

      const protocol = parseProtocol(_config.url);

      if (protocol && !platform.protocols.includes(protocol)) {
        reject(
          new AxiosError$1(
            'Unsupported protocol ' + protocol + ':',
            AxiosError$1.ERR_BAD_REQUEST,
            config
          )
        );
        done();
        return;
      }

      // Send the request
      request.send(requestData || null);
    });
  };

const composeSignals = (signals, timeout) => {
  signals = signals ? signals.filter(Boolean) : [];

  if (!timeout && !signals.length) {
    return;
  }

  const controller = new AbortController();

  let aborted = false;

  const onabort = function (reason) {
    if (!aborted) {
      aborted = true;
      unsubscribe();
      const err = reason instanceof Error ? reason : this.reason;
      controller.abort(
        err instanceof AxiosError$1
          ? err
          : new CanceledError$1(err instanceof Error ? err.message : err)
      );
    }
  };

  let timer =
    timeout &&
    setTimeout(() => {
      timer = null;
      onabort(new AxiosError$1(`timeout of ${timeout}ms exceeded`, AxiosError$1.ETIMEDOUT));
    }, timeout);

  const unsubscribe = () => {
    if (!signals) { return; }
    timer && clearTimeout(timer);
    timer = null;
    signals.forEach((signal) => {
      signal.unsubscribe
        ? signal.unsubscribe(onabort)
        : signal.removeEventListener('abort', onabort);
    });
    signals = null;
  };

  signals.forEach((signal) => {
    if (aborted) {
      return;
    }

    if (signal.aborted) {
      onabort.call(signal);
      return;
    }

    signal.addEventListener('abort', onabort, { once: true });
  });

  const { signal } = controller;

  signal.unsubscribe = () => utils$1.asap(unsubscribe);

  return signal;
};

const streamChunk = function* (chunk, chunkSize) {
  let len = chunk.byteLength;

  if (len < chunkSize) {
    yield chunk;
    return;
  }

  let pos = 0;
  let end;

  while (pos < len) {
    end = pos + chunkSize;
    yield chunk.slice(pos, end);
    pos = end;
  }
};

const readBytes = async function* (iterable, chunkSize) {
  for await (const chunk of readStream(iterable)) {
    yield* streamChunk(chunk, chunkSize);
  }
};

const readStream = async function* (stream) {
  if (stream[Symbol.asyncIterator]) {
    yield* stream;
    return;
  }

  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      yield value;
    }
  } finally {
    await reader.cancel();
  }
};

const trackStream = (stream, chunkSize, onProgress, onFinish) => {
  const iterator = readBytes(stream, chunkSize);

  let bytes = 0;
  let done;
  let _onFinish = (e) => {
    if (!done) {
      done = true;
      onFinish && onFinish(e);
    }
  };

  return new ReadableStream(
    {
      async pull(controller) {
        try {
          const { done, value } = await iterator.next();

          if (done) {
            _onFinish();
            controller.close();
            return;
          }

          let len = value.byteLength;
          if (onProgress) {
            let loadedBytes = (bytes += len);
            onProgress(loadedBytes);
          }
          controller.enqueue(new Uint8Array(value));
        } catch (err) {
          _onFinish(err);
          throw err;
        }
      },
      cancel(reason) {
        _onFinish(reason);
        return iterator.return();
      },
    },
    {
      highWaterMark: 2,
    }
  );
};

/**
 * Estimate data: URL byte lengths *without* allocating large buffers.
 * - Fetch percent-decodes a base64 body before decoding it.
 * - Node's Buffer.from(body, 'base64') sizes its backing allocation from the
 *   raw body, including ignored characters and content after padding.
 * - Non-base64 data is percent-decoded and then encoded as UTF-8.
 */
const isHexDigit = (charCode) =>
  (charCode >= 48 && charCode <= 57) ||
  (charCode >= 65 && charCode <= 70) ||
  (charCode >= 97 && charCode <= 102);

const isPercentEncodedByte = (str, i, len) =>
  i + 2 < len && isHexDigit(str.charCodeAt(i + 1)) && isHexDigit(str.charCodeAt(i + 2));

const hexValue = (charCode) => (charCode <= 57 ? charCode - 48 : (charCode & 0xdf) - 55);

const isBase64Char = (charCode) =>
  (charCode >= 65 && charCode <= 90) || // A-Z
  (charCode >= 97 && charCode <= 122) || // a-z
  (charCode >= 48 && charCode <= 57) || // 0-9
  charCode === 43 || // +
  charCode === 47 || // /
  charCode === 45 || // - (base64url)
  charCode === 95; // _ (base64url)

const isBase64Whitespace = (charCode) =>
  charCode === 9 || charCode === 10 || charCode === 12 || charCode === 13 || charCode === 32;

const base64Bytes = (significant) => {
  const groups = Math.floor(significant / 4);
  const remainder = significant % 4;
  return groups * 3 + (remainder === 2 ? 1 : remainder === 3 ? 2 : 0);
};

// Buffer.byteLength(body, 'base64') uses the raw string length as an allocation
// upper bound even when Buffer.from later ignores characters or stops at '='.
const estimateBase64BufferAllocation = (body) => {
  const len = body.length;
  let padding = 0;

  if (len > 0 && body.charCodeAt(len - 1) === 61 /* '=' */) {
    padding++;

    if (len > 1 && body.charCodeAt(len - 2) === 61 /* '=' */) {
      padding++;
    }
  }

  return Math.floor(((len - padding) * 3) / 4);
};

const estimatePercentDecodedBase64Bytes = (body) => {
  const len = body.length;
  let significant = 0;
  let padding = 0;
  let invalid = false;

  for (let i = 0; i < len; i++) {
    let code = body.charCodeAt(i);

    if (code === 37 /* '%' */ && isPercentEncodedByte(body, i, len)) {
      code = hexValue(body.charCodeAt(i + 1)) * 16 + hexValue(body.charCodeAt(i + 2));
      i += 2;
    }

    if (isBase64Whitespace(code)) {
      continue;
    }

    if (code === 61 /* '=' */) {
      padding++;
      continue;
    }

    if (!isBase64Char(code) || padding > 0) {
      invalid = true;
      continue;
    }

    significant++;
  }

  // Fetch rejects malformed forgiving-base64 input. Returning the raw-size
  // allocation bound keeps that invalid input from becoming a pre-check bypass.
  if (
    invalid ||
    padding > 2 ||
    (padding > 0 && (significant + padding) % 4 !== 0) ||
    significant % 4 === 1
  ) {
    return estimateBase64BufferAllocation(body);
  }

  return base64Bytes(significant);
};

const estimateDataURLBytes = (url, estimateBase64) => {
  if (!url || typeof url !== 'string') return 0;
  if (!url.startsWith('data:')) return 0;

  const comma = url.indexOf(',');
  if (comma < 0) return 0;

  const meta = url.slice(5, comma);
  const body = url.slice(comma + 1);
  const isBase64 = /;base64/i.test(meta);

  if (isBase64) {
    return estimateBase64(body);
  }

  // Compute UTF-8 byte length directly from UTF-16 code units without allocating
  // a byte buffer (TextEncoder.encode would defeat the DoS guard on large bodies).
  // Valid %XX triplets count as one decoded byte; this matches the bytes that
  // decodeURIComponent(body) would produce before Buffer re-encodes the string.
  let bytes = 0;
  for (let i = 0, len = body.length; i < len; i++) {
    const c = body.charCodeAt(i);
    if (c === 37 /* '%' */ && isPercentEncodedByte(body, i, len)) {
      bytes += 1;
      i += 2;
    } else if (c < 0x80) {
      bytes += 1;
    } else if (c < 0x800) {
      bytes += 2;
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < len) {
      const next = body.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
};

/**
 * Estimate the percent-decoded payload size used by Fetch data: URLs.
 *
 * @param {string} url
 * @returns {number}
 */
function estimateDataURLDecodedBytes(url) {
  // Fetch removes URL fragments before processing a data: URL.
  const fragmentIndex = typeof url === 'string' ? url.indexOf('#') : -1;

  return estimateDataURLBytes(
    fragmentIndex === -1 ? url : url.slice(0, fragmentIndex),
    estimatePercentDecodedBase64Bytes
  );
}

const VERSION$1 = "1.19.0";

const DEFAULT_CHUNK_SIZE = 64 * 1024;

const { isFunction } = utils$1;

/**
 * Encode a UTF-8 string to a Latin-1 byte string for use with btoa().
 * This is a modern replacement for the deprecated unescape(encodeURIComponent(str)) pattern.
 *
 * @param {string} str The string to encode
 *
 * @returns {string} UTF-8 bytes as a Latin-1 string
 */
const encodeUTF8 = (str) =>
  encodeURIComponent(str).replace(/%([0-9A-F]{2})/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

// Node's WHATWG URL parser returns `username` and `password` percent-encoded.
// Decode before composing the `auth` option so credentials such as
// `my%40email.com:pass` are sent as `my@email.com:pass`. Falls back to the
// original value for malformed input so a bad encoding never throws.
const decodeURIComponentSafe = (value) => {
  if (!utils$1.isString(value)) {
    return value;
  }

  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
};

const test = (fn, ...args) => {
  try {
    return !!fn(...args);
  } catch (e) {
    return false;
  }
};

const maybeWithAuthCredentials = (url) => {
  const protocolIndex = url.indexOf('://');
  let urlToCheck = url;
  if (protocolIndex !== -1) {
    urlToCheck = urlToCheck.slice(protocolIndex + 3);
  }
  return urlToCheck.includes('@') || urlToCheck.includes(':');
};

const factory = (env) => {
  const globalObject =
    utils$1.global !== undefined && utils$1.global !== null
      ? utils$1.global
      : globalThis;
  const { ReadableStream, TextEncoder } = globalObject;

  env = utils$1.merge.call(
    {
      skipUndefined: true,
    },
    {
      Request: globalObject.Request,
      Response: globalObject.Response,
    },
    env
  );

  const { fetch: envFetch, Request, Response } = env;
  const isFetchSupported = envFetch ? isFunction(envFetch) : typeof fetch === 'function';
  const isRequestSupported = isFunction(Request);
  const isResponseSupported = isFunction(Response);

  if (!isFetchSupported) {
    return false;
  }

  const isReadableStreamSupported = isFetchSupported && isFunction(ReadableStream);

  const encodeText =
    isFetchSupported &&
    (typeof TextEncoder === 'function'
      ? (
          (encoder) => (str) =>
            encoder.encode(str)
        )(new TextEncoder())
      : async (str) => new Uint8Array(await new Request(str).arrayBuffer()));

  const supportsRequestStream =
    isRequestSupported &&
    isReadableStreamSupported &&
    test(() => {
      let duplexAccessed = false;

      const request = new Request(platform.origin, {
        body: new ReadableStream(),
        method: 'POST',
        get duplex() {
          duplexAccessed = true;
          return 'half';
        },
      });

      const hasContentType = request.headers.has('Content-Type');

      if (request.body != null) {
        request.body.cancel();
      }

      return duplexAccessed && !hasContentType;
    });

  const supportsResponseStream =
    isResponseSupported &&
    isReadableStreamSupported &&
    test(() => utils$1.isReadableStream(new Response('').body));

  const resolvers = {
    stream: supportsResponseStream && ((res) => res.body),
  };

  isFetchSupported &&
    (() => {
      ['text', 'arrayBuffer', 'blob', 'formData', 'stream'].forEach((type) => {
        !resolvers[type] &&
          (resolvers[type] = (res, config) => {
            let method = res && res[type];

            if (method) {
              return method.call(res);
            }

            throw new AxiosError$1(
              `Response type '${type}' is not supported`,
              AxiosError$1.ERR_NOT_SUPPORT,
              config
            );
          });
      });
    })();

  const getBodyLength = async (body) => {
    if (body == null) {
      return 0;
    }

    if (utils$1.isBlob(body)) {
      return body.size;
    }

    if (utils$1.isSpecCompliantForm(body)) {
      const _request = new Request(platform.origin, {
        method: 'POST',
        body,
      });
      return (await _request.arrayBuffer()).byteLength;
    }

    if (utils$1.isArrayBufferView(body) || utils$1.isArrayBuffer(body)) {
      return body.byteLength;
    }

    if (utils$1.isURLSearchParams(body)) {
      body = body + '';
    }

    if (utils$1.isString(body)) {
      return (await encodeText(body)).byteLength;
    }
  };

  const resolveBodyLength = async (headers, body) => {
    const length = utils$1.toFiniteNumber(headers.getContentLength());

    return length == null ? getBodyLength(body) : length;
  };

  return async (config) => {
    let {
      url,
      method,
      data,
      signal,
      cancelToken,
      timeout,
      onDownloadProgress,
      onUploadProgress,
      responseType,
      headers,
      withCredentials = 'same-origin',
      fetchOptions,
      maxContentLength,
      maxBodyLength,
    } = resolveConfig(config);

    const hasMaxContentLength = utils$1.isNumber(maxContentLength) && maxContentLength > -1;
    const hasMaxBodyLength = utils$1.isNumber(maxBodyLength) && maxBodyLength > -1;
    const own = (key) => (utils$1.hasOwnProp(config, key) ? config[key] : undefined);

    let _fetch = envFetch || fetch;

    responseType = responseType ? (responseType + '').toLowerCase() : 'text';

    let composedSignal = composeSignals(
      [signal, cancelToken && cancelToken.toAbortSignal()],
      timeout
    );

    let request = null;

    const unsubscribe =
      composedSignal &&
      composedSignal.unsubscribe &&
      (() => {
        composedSignal.unsubscribe();
      });

    let requestContentLength;

    // AxiosError we raise while the request body is being streamed. Captured
    // by identity so the catch block can surface it directly, regardless of
    // how the runtime wraps the resulting fetch rejection (undici exposes it
    // as `err.cause`; some browsers drop the original error entirely).
    let pendingBodyError = null;

    const maxBodyLengthError = () =>
      new AxiosError$1(
        'Request body larger than maxBodyLength limit',
        AxiosError$1.ERR_BAD_REQUEST,
        config,
        request
      );

    try {
      // HTTP basic authentication
      let auth = undefined;
      const configAuth = own('auth');

      if (configAuth) {
        const username = utils$1.getSafeProp(configAuth, 'username') || '';
        const password = utils$1.getSafeProp(configAuth, 'password') || '';
        auth = {
          username,
          password
        };
      }

      if (maybeWithAuthCredentials(url)) {
        const parsedURL = new URL(url, platform.origin);

        if (!auth && (parsedURL.username || parsedURL.password)) {
          const urlUsername = decodeURIComponentSafe(parsedURL.username);
          const urlPassword = decodeURIComponentSafe(parsedURL.password);
          auth = {
            username: urlUsername,
            password: urlPassword
          };
        }

        if (parsedURL.username || parsedURL.password) {
          parsedURL.username = '';
          parsedURL.password = '';
          url = parsedURL.href;
        }
      }

      if (auth) {
        headers.delete('authorization');
        headers.set(
          'Authorization',
          'Basic ' + btoa(encodeUTF8((auth.username || '') + ':' + (auth.password || '')))
        );
      }

      // Enforce maxContentLength for data: URLs up-front so we never materialize
      // an oversized payload. The HTTP adapter applies the same check (see http.js
      // "if (protocol === 'data:')" branch).
      if (hasMaxContentLength && typeof url === 'string' && url.startsWith('data:')) {
        const estimated = estimateDataURLDecodedBytes(url);
        if (estimated > maxContentLength) {
          throw new AxiosError$1(
            'maxContentLength size of ' + maxContentLength + ' exceeded',
            AxiosError$1.ERR_BAD_RESPONSE,
            config,
            request
          );
        }
      }

      // Enforce maxBodyLength against known-size bodies before dispatch using
      // the body's *actual* size — never a caller-declared Content-Length,
      // which could under-report to slip an oversized body past the check.
      // Unknown-size streams return undefined here and are counted per-chunk
      // below as fetch consumes them.
      if (hasMaxBodyLength && method !== 'get' && method !== 'head') {
        const outboundLength = await getBodyLength(data);
        if (typeof outboundLength === 'number' && isFinite(outboundLength)) {
          requestContentLength = outboundLength;
          if (outboundLength > maxBodyLength) {
            throw maxBodyLengthError();
          }
        }
      }

      // A streamed body under maxBodyLength must be counted as fetch consumes
      // it; its size is never trusted from a caller-declared Content-Length.
      const mustEnforceStreamBody =
        hasMaxBodyLength && (utils$1.isReadableStream(data) || utils$1.isStream(data));

      const trackRequestStream = (stream, onProgress, flush) =>
        trackStream(
          stream,
          DEFAULT_CHUNK_SIZE,
          (loadedBytes) => {
            if (hasMaxBodyLength && loadedBytes > maxBodyLength) {
              throw (pendingBodyError = maxBodyLengthError());
            }
            onProgress && onProgress(loadedBytes);
          },
          flush
        );

      if (
        supportsRequestStream &&
        method !== 'get' &&
        method !== 'head' &&
        (onUploadProgress || mustEnforceStreamBody)
      ) {
        requestContentLength =
          requestContentLength == null ? await resolveBodyLength(headers, data) : requestContentLength;

        // A declared length of 0 is only trusted to skip the wrap when we are
        // not enforcing a stream limit (which must not rely on that header).
        if (requestContentLength !== 0 || mustEnforceStreamBody) {
          let _request = new Request(url, {
            method: 'POST',
            body: data,
            duplex: 'half',
          });

          let contentTypeHeader;

          if (utils$1.isFormData(data) && (contentTypeHeader = _request.headers.get('content-type'))) {
            headers.setContentType(contentTypeHeader);
          }

          if (_request.body) {
            const [onProgress, flush] =
              (onUploadProgress &&
                progressEventDecorator(
                  requestContentLength,
                  progressEventReducer(asyncDecorator(onUploadProgress))
                )) ||
              [];

            data = trackRequestStream(_request.body, onProgress, flush);
          }
        }
      } else if (
        mustEnforceStreamBody &&
        !isRequestSupported &&
        isReadableStreamSupported &&
        method !== 'get' &&
        method !== 'head'
      ) {
        data = trackRequestStream(data);
      } else if (
        mustEnforceStreamBody &&
        isRequestSupported &&
        !supportsRequestStream &&
        method !== 'get' &&
        method !== 'head'
      ) {
        throw new AxiosError$1(
          'Stream request bodies are not supported by the current fetch implementation',
          AxiosError$1.ERR_NOT_SUPPORT,
          config,
          request
        );
      }

      if (!utils$1.isString(withCredentials)) {
        withCredentials = withCredentials ? 'include' : 'omit';
      }

      // Cloudflare Workers throws when credentials are defined
      // see https://github.com/cloudflare/workerd/issues/902
      const isCredentialsSupported = isRequestSupported && 'credentials' in Request.prototype;

      // If data is FormData and Content-Type is multipart/form-data without boundary,
      // delete it so fetch can set it correctly with the boundary
      if (utils$1.isFormData(data)) {
        const contentType = headers.getContentType();
        if (
          contentType &&
          /^multipart\/form-data/i.test(contentType) &&
          !/boundary=/i.test(contentType)
        ) {
          headers.delete('content-type');
        }
      }

      // Set User-Agent header if not already set (fetch defaults to 'node' in Node.js)
      headers.set('User-Agent', 'axios/' + VERSION$1, false);

      const resolvedOptions = {
        ...fetchOptions,
        signal: composedSignal,
        method: method.toUpperCase(),
        headers: toByteStringHeaderObject(headers.normalize()),
        body: data,
        duplex: 'half',
        credentials: isCredentialsSupported ? withCredentials : undefined,
      };

      request = isRequestSupported && new Request(url, resolvedOptions);

      let response = await (isRequestSupported
        ? _fetch(request, fetchOptions)
        : _fetch(url, resolvedOptions));

      const responseHeaders = AxiosHeaders$1.from(response.headers);

      // Cheap pre-check: if the server honestly declares a content-length that
      // already exceeds the cap, reject before we start streaming.
      if (hasMaxContentLength) {
        const declaredLength = utils$1.toFiniteNumber(responseHeaders.getContentLength());
        if (declaredLength != null && declaredLength > maxContentLength) {
          throw new AxiosError$1(
            'maxContentLength size of ' + maxContentLength + ' exceeded',
            AxiosError$1.ERR_BAD_RESPONSE,
            config,
            request
          );
        }
      }

      const isStreamResponse =
        supportsResponseStream && (responseType === 'stream' || responseType === 'response');

      if (
        supportsResponseStream &&
        response.body &&
        (onDownloadProgress || hasMaxContentLength || (isStreamResponse && unsubscribe))
      ) {
        const options = {};

        ['status', 'statusText', 'headers'].forEach((prop) => {
          options[prop] = response[prop];
        });

        const responseContentLength = utils$1.toFiniteNumber(responseHeaders.getContentLength());

        const [onProgress, flush] =
          (onDownloadProgress &&
            progressEventDecorator(
              responseContentLength,
              progressEventReducer(asyncDecorator(onDownloadProgress), true)
            )) ||
          [];

        let bytesRead = 0;
        const onChunkProgress = (loadedBytes) => {
          if (hasMaxContentLength) {
            bytesRead = loadedBytes;
            if (bytesRead > maxContentLength) {
              throw new AxiosError$1(
                'maxContentLength size of ' + maxContentLength + ' exceeded',
                AxiosError$1.ERR_BAD_RESPONSE,
                config,
                request
              );
            }
          }
          onProgress && onProgress(loadedBytes);
        };

        response = new Response(
          trackStream(response.body, DEFAULT_CHUNK_SIZE, onChunkProgress, () => {
            flush && flush();
            unsubscribe && unsubscribe();
          }),
          options
        );
      }

      responseType = responseType || 'text';

      let responseData = await resolvers[utils$1.findKey(resolvers, responseType) || 'text'](
        response,
        config
      );

      // Fallback enforcement for environments without ReadableStream support
      // (legacy runtimes). Detect materialized size from typed output; skip
      // streams/Response passthrough since the user will read those themselves.
      if (hasMaxContentLength && !supportsResponseStream && !isStreamResponse) {
        let materializedSize;
        if (responseData != null) {
          if (typeof responseData.byteLength === 'number') {
            materializedSize = responseData.byteLength;
          } else if (typeof responseData.size === 'number') {
            materializedSize = responseData.size;
          } else if (typeof responseData === 'string') {
            materializedSize =
              typeof TextEncoder === 'function'
                ? new TextEncoder().encode(responseData).byteLength
                : responseData.length;
          }
        }
        if (typeof materializedSize === 'number' && materializedSize > maxContentLength) {
          throw new AxiosError$1(
            'maxContentLength size of ' + maxContentLength + ' exceeded',
            AxiosError$1.ERR_BAD_RESPONSE,
            config,
            request
          );
        }
      }

      !isStreamResponse && unsubscribe && unsubscribe();

      return await new Promise((resolve, reject) => {
        settle(resolve, reject, {
          data: responseData,
          headers: AxiosHeaders$1.from(response.headers),
          status: response.status,
          statusText: response.statusText,
          config,
          request,
        });
      });
    } catch (err) {
      unsubscribe && unsubscribe();

      // Safari can surface fetch aborts as a DOMException-like object whose
      // branded getters throw. Prefer our composed signal reason before reading
      // the caught error, preserving timeout vs cancellation semantics.
      if (composedSignal && composedSignal.aborted && composedSignal.reason instanceof AxiosError$1) {
        const canceledError = composedSignal.reason;
        canceledError.config = config;
        request && (canceledError.request = request);
        if (err !== canceledError) {
          // Non-enumerable to match native Error `cause` semantics so loggers
          // don't recurse into circular fetch internals (see #7205).
          Object.defineProperty(canceledError, 'cause', {
            __proto__: null,
            value: err,
            writable: true,
            enumerable: false,
            configurable: true,
          });
        }
        throw canceledError;
      }

      // Surface a maxBodyLength violation we raised while the request body was
      // being streamed. Matching by identity (rather than reading
      // `err.cause.isAxiosError`) keeps the error deterministic across runtimes
      // and avoids both prototype-pollution reads and mis-attributing a foreign
      // AxiosError that merely happened to land in `err.cause`.
      if (pendingBodyError) {
        request && !pendingBodyError.request && (pendingBodyError.request = request);
        throw pendingBodyError;
      }

      // Re-throw AxiosErrors we raised synchronously (data: URL / content-length
      // pre-checks, response size enforcement) without re-wrapping them.
      if (err instanceof AxiosError$1) {
        request && !err.request && (err.request = request);
        throw err;
      }

      if (err && err.name === 'TypeError' && /Load failed|fetch/i.test(err.message)) {
        const networkError = new AxiosError$1(
          'Network Error',
          AxiosError$1.ERR_NETWORK,
          config,
          request,
          err && err.response
        );
        // Non-enumerable to match native Error `cause` semantics so loggers
        // don't recurse into circular fetch internals (see #7205).
        Object.defineProperty(networkError, 'cause', {
          __proto__: null,
          value: err.cause || err,
          writable: true,
          enumerable: false,
          configurable: true,
        });
        throw networkError;
      }

      throw AxiosError$1.from(err, err && err.code, config, request, err && err.response);
    }
  };
};

const seedCache = new Map();

const getFetch = (config) => {
  let env = (config && config.env) || {};
  const { fetch, Request, Response } = env;
  const seeds = [Request, Response, fetch];

  let len = seeds.length,
    i = len,
    seed,
    target,
    map = seedCache;

  while (i--) {
    seed = seeds[i];
    target = map.get(seed);

    target === undefined && map.set(seed, (target = i ? new Map() : factory(env)));

    map = target;
  }

  return target;
};

getFetch();

/**
 * Known adapters mapping.
 * Provides environment-specific adapters for Axios:
 * - `http` for Node.js
 * - `xhr` for browsers
 * - `fetch` for fetch API-based requests
 *
 * @type {Object<string, Function|Object>}
 */
const knownAdapters = {
  http: httpAdapter,
  xhr: xhrAdapter,
  fetch: {
    get: getFetch,
  },
};

// Assign adapter names for easier debugging and identification
utils$1.forEach(knownAdapters, (fn, value) => {
  if (fn) {
    try {
      // Null-proto descriptors so a polluted Object.prototype.get cannot turn
      // these data descriptors into accessor descriptors on the way in.
      Object.defineProperty(fn, 'name', { __proto__: null, value });
    } catch (e) {
      // eslint-disable-next-line no-empty
    }
    Object.defineProperty(fn, 'adapterName', { __proto__: null, value });
  }
});

/**
 * Render a rejection reason string for unknown or unsupported adapters
 *
 * @param {string} reason
 * @returns {string}
 */
const renderReason = (reason) => `- ${reason}`;

/**
 * Check if the adapter is resolved (function, null, or false)
 *
 * @param {Function|null|false} adapter
 * @returns {boolean}
 */
const isResolvedHandle = (adapter) =>
  utils$1.isFunction(adapter) || adapter === null || adapter === false;

/**
 * Get the first suitable adapter from the provided list.
 * Tries each adapter in order until a supported one is found.
 * Throws an AxiosError if no adapter is suitable.
 *
 * @param {Array<string|Function>|string|Function} adapters - Adapter(s) by name or function.
 * @param {Object} config - Axios request configuration
 * @throws {AxiosError} If no suitable adapter is available
 * @returns {Function} The resolved adapter function
 */
function getAdapter$1(adapters, config) {
  adapters = utils$1.isArray(adapters) ? adapters : [adapters];

  const { length } = adapters;
  let nameOrAdapter;
  let adapter;

  const rejectedReasons = {};

  for (let i = 0; i < length; i++) {
    nameOrAdapter = adapters[i];
    let id;

    adapter = nameOrAdapter;

    if (!isResolvedHandle(nameOrAdapter)) {
      adapter = knownAdapters[(id = String(nameOrAdapter)).toLowerCase()];

      if (adapter === undefined) {
        throw new AxiosError$1(`Unknown adapter '${id}'`);
      }
    }

    if (adapter && (utils$1.isFunction(adapter) || (adapter = adapter.get(config)))) {
      break;
    }

    rejectedReasons[id || '#' + i] = adapter;
  }

  if (!adapter) {
    const reasons = Object.entries(rejectedReasons).map(
      ([id, state]) =>
        `adapter ${id} ` +
        (state === false ? 'is not supported by the environment' : 'is not available in the build')
    );

    let s = length
      ? reasons.length > 1
        ? 'since :\n' + reasons.map(renderReason).join('\n')
        : ' ' + renderReason(reasons[0])
      : 'as no adapter specified';

    throw new AxiosError$1(
      `There is no suitable adapter to dispatch the request ` + s,
      AxiosError$1.ERR_NOT_SUPPORT
    );
  }

  return adapter;
}

/**
 * Exports Axios adapters and utility to resolve an adapter
 */
const adapters = {
  /**
   * Resolve an adapter from a list of adapter names or functions.
   * @type {Function}
   */
  getAdapter: getAdapter$1,

  /**
   * Exposes all known adapters
   * @type {Object<string, Function|Object>}
   */
  adapters: knownAdapters,
};

/**
 * Throws a `CanceledError` if cancellation has been requested.
 *
 * @param {Object} config The config that is to be used for the request
 *
 * @returns {void}
 */
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }

  if (config.signal && config.signal.aborted) {
    throw new CanceledError$1(null, config);
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 *
 * @returns {Promise} The Promise to be fulfilled
 */
function dispatchRequest(config) {
  throwIfCancellationRequested(config);

  config.headers = AxiosHeaders$1.from(config.headers);

  // Transform request data
  config.data = transformData.call(config, config.transformRequest);

  if (['post', 'put', 'patch'].indexOf(config.method) !== -1) {
    config.headers.setContentType('application/x-www-form-urlencoded', false);
  }

  const adapter = adapters.getAdapter(config.adapter || defaults.adapter, config);

  return adapter(config).then(
    function onAdapterResolution(response) {
      throwIfCancellationRequested(config);

      // Expose the current response on config so that transformResponse can
      // attach it to any AxiosError it throws (e.g. on JSON parse failure).
      // We clean it up afterwards to avoid polluting the config object.
      config.response = response;
      try {
        response.data = transformData.call(config, config.transformResponse, response);
      } finally {
        delete config.response;
      }

      response.headers = AxiosHeaders$1.from(response.headers);

      return response;
    },
    function onAdapterRejection(reason) {
      if (!isCancel$1(reason)) {
        throwIfCancellationRequested(config);

        // Transform response data
        if (reason && reason.response) {
          config.response = reason.response;
          try {
            reason.response.data = transformData.call(
              config,
              config.transformResponse,
              reason.response
            );
          } finally {
            delete config.response;
          }
          reason.response.headers = AxiosHeaders$1.from(reason.response.headers);
        }
      }

      return Promise.reject(reason);
    }
  );
}

const validators$1 = {};

// eslint-disable-next-line func-names
['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach((type, i) => {
  validators$1[type] = function validator(thing) {
    return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
  };
});

const deprecatedWarnings = {};

/**
 * Transitional option validator
 *
 * @param {function|boolean?} validator - set to false if the transitional option has been removed
 * @param {string?} version - deprecated version / removed since version
 * @param {string?} message - some message with additional info
 *
 * @returns {function}
 */
validators$1.transitional = function transitional(validator, version, message) {
  function formatMessage(opt, desc) {
    return (
      '[Axios v' +
      VERSION$1 +
      "] Transitional option '" +
      opt +
      "'" +
      desc +
      (message ? '. ' + message : '')
    );
  }

  // eslint-disable-next-line func-names
  return (value, opt, opts) => {
    if (validator === false) {
      throw new AxiosError$1(
        formatMessage(opt, ' has been removed' + (version ? ' in ' + version : '')),
        AxiosError$1.ERR_DEPRECATED
      );
    }

    if (version && !deprecatedWarnings[opt]) {
      deprecatedWarnings[opt] = true;
      // eslint-disable-next-line no-console
      console.warn(
        formatMessage(
          opt,
          ' has been deprecated since v' + version + ' and will be removed in the near future'
        )
      );
    }

    return validator ? validator(value, opt, opts) : true;
  };
};

validators$1.spelling = function spelling(correctSpelling) {
  return (value, opt) => {
    // eslint-disable-next-line no-console
    console.warn(`${opt} is likely a misspelling of ${correctSpelling}`);
    return true;
  };
};

/**
 * Assert object's properties type
 *
 * @param {object} options
 * @param {object} schema
 * @param {boolean?} allowUnknown
 *
 * @returns {object}
 */

function assertOptions(options, schema, allowUnknown) {
  if (typeof options !== 'object' || options === null) {
    throw new AxiosError$1('options must be an object', AxiosError$1.ERR_BAD_OPTION_VALUE);
  }
  const keys = Object.keys(options);
  let i = keys.length;
  while (i-- > 0) {
    const opt = keys[i];
    // Use hasOwnProperty so a polluted Object.prototype.<opt> cannot supply
    // a non-function validator and cause a TypeError.
    const validator = Object.prototype.hasOwnProperty.call(schema, opt) ? schema[opt] : undefined;
    if (validator) {
      const value = options[opt];
      const result = value === undefined || validator(value, opt, options);
      if (result !== true) {
        throw new AxiosError$1(
          'option ' + opt + ' must be ' + result,
          AxiosError$1.ERR_BAD_OPTION_VALUE
        );
      }
      continue;
    }
    if (allowUnknown !== true) {
      throw new AxiosError$1('Unknown option ' + opt, AxiosError$1.ERR_BAD_OPTION);
    }
  }
}

const validator = {
  assertOptions,
  validators: validators$1,
};

const validators = validator.validators;

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 *
 * @return {Axios} A new instance of Axios
 */
let Axios$1 = class Axios {
  constructor(instanceConfig) {
    this.defaults = instanceConfig || {};
    this.interceptors = {
      request: new InterceptorManager(),
      response: new InterceptorManager(),
    };
  }

  /**
   * Dispatch a request
   *
   * @param {String|Object} configOrUrl The config specific for this request (merged with this.defaults)
   * @param {?Object} config
   *
   * @returns {Promise} The Promise to be fulfilled
   */
  async request(configOrUrl, config) {
    try {
      return await this._request(configOrUrl, config);
    } catch (err) {
      if (err instanceof Error) {
        let dummy = {};

        Error.captureStackTrace ? Error.captureStackTrace(dummy) : (dummy = new Error());

        // slice off the Error: ... line
        const stack = (() => {
          if (!dummy.stack) {
            return '';
          }

          const firstNewlineIndex = dummy.stack.indexOf('\n');

          return firstNewlineIndex === -1 ? '' : dummy.stack.slice(firstNewlineIndex + 1);
        })();
        try {
          if (!err.stack) {
            err.stack = stack;
            // match without the 2 top stack lines
          } else if (stack) {
            const firstNewlineIndex = stack.indexOf('\n');
            const secondNewlineIndex =
              firstNewlineIndex === -1 ? -1 : stack.indexOf('\n', firstNewlineIndex + 1);
            const stackWithoutTwoTopLines =
              secondNewlineIndex === -1 ? '' : stack.slice(secondNewlineIndex + 1);

            if (!String(err.stack).endsWith(stackWithoutTwoTopLines)) {
              err.stack += '\n' + stack;
            }
          }
        } catch (e) {
          // ignore the case where "stack" is an un-writable property
        }
      }

      throw err;
    }
  }

  _request(configOrUrl, config) {
    /*eslint no-param-reassign:0*/
    // Allow for axios('example/url'[, config]) a la fetch API
    if (typeof configOrUrl === 'string') {
      config = config || {};
      config.url = configOrUrl;
    } else {
      config = configOrUrl || {};
    }

    config = mergeConfig$1(this.defaults, config);

    const { transitional, paramsSerializer, headers } = config;

    if (transitional !== undefined) {
      validator.assertOptions(
        transitional,
        {
          silentJSONParsing: validators.transitional(validators.boolean),
          forcedJSONParsing: validators.transitional(validators.boolean),
          clarifyTimeoutError: validators.transitional(validators.boolean),
          legacyInterceptorReqResOrdering: validators.transitional(validators.boolean),
          advertiseZstdAcceptEncoding: validators.transitional(validators.boolean),
          validateStatusUndefinedResolves: validators.transitional(validators.boolean),
        },
        false
      );
    }

    if (paramsSerializer != null) {
      if (utils$1.isFunction(paramsSerializer)) {
        config.paramsSerializer = {
          serialize: paramsSerializer,
        };
      } else {
        validator.assertOptions(
          paramsSerializer,
          {
            encode: validators.function,
            serialize: validators.function,
          },
          true
        );
      }
    }

    // Set config.allowAbsoluteUrls
    if (config.allowAbsoluteUrls !== undefined) ; else if (this.defaults.allowAbsoluteUrls !== undefined) {
      config.allowAbsoluteUrls = this.defaults.allowAbsoluteUrls;
    } else {
      config.allowAbsoluteUrls = true;
    }

    validator.assertOptions(
      config,
      {
        baseUrl: validators.spelling('baseURL'),
        withXsrfToken: validators.spelling('withXSRFToken'),
      },
      true
    );

    // Set config.method
    config.method = (config.method || this.defaults.method || 'get').toLowerCase();

    // Flatten headers
    let contextHeaders = headers && utils$1.merge(headers.common, headers[config.method]);

    headers &&
      utils$1.forEach(['delete', 'get', 'head', 'post', 'put', 'patch', 'query', 'common'], (method) => {
        delete headers[method];
      });

    config.headers = AxiosHeaders$1.concat(contextHeaders, headers);

    // filter out skipped interceptors
    const requestInterceptorChain = [];
    let synchronousRequestInterceptors = true;
    this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
      if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
        return;
      }

      synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

      const transitional = config.transitional || transitionalDefaults;
      const legacyInterceptorReqResOrdering =
        transitional && transitional.legacyInterceptorReqResOrdering;

      if (legacyInterceptorReqResOrdering) {
        requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
      } else {
        requestInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
      }
    });

    const responseInterceptorChain = [];
    this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
      responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
    });

    let promise;
    let i = 0;
    let len;

    if (!synchronousRequestInterceptors) {
      const chain = [dispatchRequest.bind(this), undefined];
      chain.unshift(...requestInterceptorChain);
      chain.push(...responseInterceptorChain);
      len = chain.length;

      promise = Promise.resolve(config);

      while (i < len) {
        promise = promise.then(chain[i++], chain[i++]);
      }

      return promise;
    }

    len = requestInterceptorChain.length;

    let newConfig = config;

    while (i < len) {
      const onFulfilled = requestInterceptorChain[i++];
      const onRejected = requestInterceptorChain[i++];
      try {
        newConfig = onFulfilled ? onFulfilled(newConfig) : newConfig;
      } catch (error) {
        if (!onRejected) {
          promise = Promise.reject(error);
          break;
        }

        try {
          const rejectedResult = onRejected.call(this, error);

          if (utils$1.isThenable(rejectedResult)) {
            promise = Promise.resolve(rejectedResult).then(() =>
              dispatchRequest.call(this, newConfig)
            );
          }
        } catch (rejectedError) {
          promise = Promise.reject(rejectedError);
        }

        break;
      }
    }

    if (!promise) {
      try {
        promise = dispatchRequest.call(this, newConfig);
      } catch (error) {
        promise = Promise.reject(error);
      }
    }

    i = 0;
    len = responseInterceptorChain.length;

    while (i < len) {
      promise = promise.then(responseInterceptorChain[i++], responseInterceptorChain[i++]);
    }

    return promise;
  }

  getUri(config) {
    config = mergeConfig$1(this.defaults, config);
    const fullPath = buildFullPath(config.baseURL, config.url, config.allowAbsoluteUrls, config);
    return buildURL(fullPath, config.params, config.paramsSerializer);
  }
};

// Provide aliases for supported request methods
utils$1.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios$1.prototype[method] = function (url, config) {
    return this.request(
      mergeConfig$1(config || {}, {
        method,
        url,
        data: config && utils$1.hasOwnProp(config, 'data') ? config.data : undefined,
      })
    );
  };
});

utils$1.forEach(['post', 'put', 'patch', 'query'], function forEachMethodWithData(method) {
  function generateHTTPMethod(isForm) {
    return function httpMethod(url, data, config) {
      return this.request(
        mergeConfig$1(config || {}, {
          method,
          headers: isForm
            ? {
                'Content-Type': 'multipart/form-data',
              }
            : {},
          url,
          data,
        })
      );
    };
  }

  Axios$1.prototype[method] = generateHTTPMethod();

  // QUERY is a safe/idempotent read method; multipart form bodies don't fit
  // its semantics, so no queryForm shorthand is generated.
  if (method !== 'query') {
    Axios$1.prototype[method + 'Form'] = generateHTTPMethod(true);
  }
});

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @param {Function} executor The executor function.
 *
 * @returns {CancelToken}
 */
let CancelToken$1 = class CancelToken {
  constructor(executor) {
    if (typeof executor !== 'function') {
      throw new TypeError('executor must be a function.');
    }

    let resolvePromise;

    this.promise = new Promise(function promiseExecutor(resolve) {
      resolvePromise = resolve;
    });

    const token = this;

    // eslint-disable-next-line func-names
    this.promise.then((cancel) => {
      if (!token._listeners) return;

      let i = token._listeners.length;

      while (i-- > 0) {
        token._listeners[i](cancel);
      }
      token._listeners = null;
    });

    // eslint-disable-next-line func-names
    this.promise.then = (onfulfilled) => {
      let _resolve;
      // eslint-disable-next-line func-names
      const promise = new Promise((resolve) => {
        token.subscribe(resolve);
        _resolve = resolve;
      }).then(onfulfilled);

      promise.cancel = function reject() {
        token.unsubscribe(_resolve);
      };

      return promise;
    };

    executor(function cancel(message, config, request) {
      if (token.reason) {
        // Cancellation has already been requested
        return;
      }

      token.reason = new CanceledError$1(message, config, request);
      resolvePromise(token.reason);
    });
  }

  /**
   * Throws a `CanceledError` if cancellation has been requested.
   */
  throwIfRequested() {
    if (this.reason) {
      throw this.reason;
    }
  }

  /**
   * Subscribe to the cancel signal
   */

  subscribe(listener) {
    if (this.reason) {
      listener(this.reason);
      return;
    }

    if (this._listeners) {
      this._listeners.push(listener);
    } else {
      this._listeners = [listener];
    }
  }

  /**
   * Unsubscribe from the cancel signal
   */

  unsubscribe(listener) {
    if (!this._listeners) {
      return;
    }
    const index = this._listeners.indexOf(listener);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }

  toAbortSignal() {
    const controller = new AbortController();

    const abort = (err) => {
      controller.abort(err);
    };

    this.subscribe(abort);

    controller.signal.unsubscribe = () => this.unsubscribe(abort);

    return controller.signal;
  }

  /**
   * Returns an object that contains a new `CancelToken` and a function that, when called,
   * cancels the `CancelToken`.
   */
  static source() {
    let cancel;
    const token = new CancelToken(function executor(c) {
      cancel = c;
    });
    return {
      token,
      cancel,
    };
  }
};

/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  const args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 *
 * @returns {Function}
 */
function spread$1(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
}

/**
 * Determines whether the payload is an error thrown by Axios
 *
 * @param {*} payload The value to test
 *
 * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
 */
function isAxiosError$1(payload) {
  return utils$1.isObject(payload) && payload.isAxiosError === true;
}

const HttpStatusCode$1 = {
  Continue: 100,
  SwitchingProtocols: 101,
  Processing: 102,
  EarlyHints: 103,
  Ok: 200,
  Created: 201,
  Accepted: 202,
  NonAuthoritativeInformation: 203,
  NoContent: 204,
  ResetContent: 205,
  PartialContent: 206,
  MultiStatus: 207,
  AlreadyReported: 208,
  ImUsed: 226,
  MultipleChoices: 300,
  MovedPermanently: 301,
  Found: 302,
  SeeOther: 303,
  NotModified: 304,
  UseProxy: 305,
  Unused: 306,
  TemporaryRedirect: 307,
  PermanentRedirect: 308,
  BadRequest: 400,
  Unauthorized: 401,
  PaymentRequired: 402,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  NotAcceptable: 406,
  ProxyAuthenticationRequired: 407,
  RequestTimeout: 408,
  Conflict: 409,
  Gone: 410,
  LengthRequired: 411,
  PreconditionFailed: 412,
  PayloadTooLarge: 413,
  UriTooLong: 414,
  UnsupportedMediaType: 415,
  RangeNotSatisfiable: 416,
  ExpectationFailed: 417,
  ImATeapot: 418,
  MisdirectedRequest: 421,
  UnprocessableEntity: 422,
  Locked: 423,
  FailedDependency: 424,
  TooEarly: 425,
  UpgradeRequired: 426,
  PreconditionRequired: 428,
  TooManyRequests: 429,
  RequestHeaderFieldsTooLarge: 431,
  UnavailableForLegalReasons: 451,
  InternalServerError: 500,
  NotImplemented: 501,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
  HttpVersionNotSupported: 505,
  VariantAlsoNegotiates: 506,
  InsufficientStorage: 507,
  LoopDetected: 508,
  NotExtended: 510,
  NetworkAuthenticationRequired: 511,
  WebServerReturnsAnUnknownError: 520,
  WebServerIsDown: 521,
  ConnectionTimedOut: 522,
  OriginIsUnreachable: 523,
  TimeoutOccurred: 524,
  SslHandshakeFailed: 525,
  InvalidSslCertificate: 526,
};

Object.entries(HttpStatusCode$1).forEach(([key, value]) => {
  HttpStatusCode$1[value] = key;
});

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 *
 * @returns {Axios} A new instance of Axios
 */
function createInstance(defaultConfig) {
  const context = new Axios$1(defaultConfig);
  const instance = bind(Axios$1.prototype.request, context);

  // Copy axios.prototype to instance
  utils$1.extend(instance, Axios$1.prototype, context, { allOwnKeys: true });

  // Copy context to instance
  utils$1.extend(instance, context, null, { allOwnKeys: true });

  // Factory for creating new instances
  instance.create = function create(instanceConfig) {
    return createInstance(mergeConfig$1(defaultConfig, instanceConfig));
  };

  return instance;
}

// Create the default instance to be exported
const axios = createInstance(defaults);

// Expose Axios class to allow class inheritance
axios.Axios = Axios$1;

// Expose Cancel & CancelToken
axios.CanceledError = CanceledError$1;
axios.CancelToken = CancelToken$1;
axios.isCancel = isCancel$1;
axios.VERSION = VERSION$1;
axios.toFormData = toFormData$1;

// Expose AxiosError class
axios.AxiosError = AxiosError$1;

// alias for CanceledError for backward compatibility
axios.Cancel = axios.CanceledError;

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};

axios.spread = spread$1;

// Expose isAxiosError
axios.isAxiosError = isAxiosError$1;

// Expose mergeConfig
axios.mergeConfig = mergeConfig$1;

axios.AxiosHeaders = AxiosHeaders$1;

axios.formToJSON = (thing) => formDataToJSON(utils$1.isHTMLForm(thing) ? new FormData(thing) : thing);

axios.getAdapter = adapters.getAdapter;

axios.HttpStatusCode = HttpStatusCode$1;

axios.default = axios;

// This module is intended to unwrap Axios default export as named.
// Keep top-level export same with static properties
// so that it can keep same with es module or cjs
const {
  Axios,
  AxiosError,
  CanceledError,
  isCancel,
  CancelToken,
  VERSION,
  all,
  Cancel,
  isAxiosError,
  spread,
  toFormData,
  AxiosHeaders,
  HttpStatusCode,
  formToJSON,
  getAdapter,
  mergeConfig,
  create,
} = axios;

const request = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('mes_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // 多语言 P3:把当前界面语言传给后端,Spring 解析 Accept-Language 后
  // 面板配置的字段标签/面板名按 locale 从翻译表下发(数据键保持中文,ADR-0001)。
  try {
    const saved = localStorage.getItem('mes_locale');
    if (saved && saved !== 'zh-CN') config.headers['Accept-Language'] = `${saved},${saved.split('-')[0]};q=0.9,zh;q=0.5`;
    else config.headers['Accept-Language'] = 'zh-CN,zh;q=0.9';
  } catch { /* 保持浏览器默认 */ }
  return config
});

request.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const status = err.response?.status;
    // 401/403 都视为认证失效（后端无 token/伪造/过期返回 403）→ 同步 user store 登出并跳登录
    if (status === 401 || status === 403) {
      try {
        const { useUserStore } = await __vitePreload(async () => { const { useUserStore } = await Promise.resolve().then(() => user);return { useUserStore }},true              ?void 0:void 0);
        useUserStore().logout();
      } catch (e) {
        localStorage.removeItem('mes_token');
      }
      if (!location.hash.includes('/login')) location.hash = '#/login';
    }
    return Promise.reject(err)
  }
);

async function apiLogin(payload) {
  const res = await request.post('/auth/login', payload);
  if (res?.code && res.code !== 200) throw new Error(res.message || '登录失败')
  return res?.data ?? res
}

async function apiGetPerms() {
  const res = await request.get('/auth/perms');
  return res?.data ?? res
}

async function apiGetUserInfo() {
  const res = await request.get('/auth/userinfo');
  return res?.data ?? res
}

async function apiGetFactories() {
  const res = await request.get('/base/factory/list');
  return res?.data ?? res
}

async function apiGetBadge() {
  const res = await request.get('/portal/badge');
  return res?.data ?? res
}

async function apiGetNotices(type) {
  const res = await request.get('/portal/notice/list', { params: { type } });
  return res?.data ?? res
}

// ---- 业务事件消息(2026-09-09) ----
async function apiGetMessages({ onlyUnread = false, limit = 100 } = {}) {
  const res = await request.get('/portal/message/list', { params: { onlyUnread, limit } });
  return res?.data ?? res
}

async function apiReadMessage(id) {
  const res = await request.post('/portal/message/read', { id });
  return res?.data ?? res
}

async function apiReadAllMessages() {
  const res = await request.post('/portal/message/readAll', {});
  return res?.data ?? res
}

const api = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  apiGetBadge,
  apiGetFactories,
  apiGetMessages,
  apiGetNotices,
  apiGetPerms,
  apiGetUserInfo,
  apiLogin,
  apiReadAllMessages,
  apiReadMessage
}, Symbol.toStringTag, { value: 'Module' }));

/**
 * 账套(工厂)切换的纯判定 —— ADR-0003:一系统两账套,账套**绑在登录令牌里**,
 * 切换账套 = 按目标工厂重新登录。这里只放"可测的判定",真正的重登与页面刷新
 * 在 FactorySwitchDialog / TopBar 里做。
 *
 * 为什么需要这两个函数(2026-09-22):
 *   顶栏原先的"切换"只改了本地对象与 localStorage(stores/user.js 的 switchFactory),
 *   令牌没换 ⇒ 后端 JwtAuthFilter 仍按旧声明路由到旧库 —— 名字变了、数据没变,
 *   用户看到的"无效、并未进行切换"就是这个。所以前端必须:
 *     ① 判断该不该走重登(needsRelogin);
 *     ② 把"当前账套"的认定权交给会话(userinfo.factory),而不是可陈旧/可手改的缓存,
 *        否则顶栏显示的名字会与真正被查询的库对不上,等于换个方式继续骗人。
 */

/** 目标账套是否需要重新登录(同一个 code 不用白跑一趟;没选到目标时不弹窗) */
function needsRelogin(currentCode, targetCode) {
  const target = String(targetCode ?? '').trim();
  if (!target) return false
  return target !== String(currentCode ?? '').trim()
}

/**
 * 当前账套判定:会话里的工厂码最权威(登录响应/ userinfo 的 factory 字段),
 * 其次本地缓存(mes_factory),最后退回账套清单首项。
 * 认不出的码不原样显示 —— 宁可回退也不让顶栏顶着个不存在的账套名。
 */
function pickCurrentFactory(factories, { sessionCode, cachedCode } = {}) {
  const list = (Array.isArray(factories) ? factories : []).filter((f) => f && f.code);
  if (!list.length) return null
  const candidates = [sessionCode, cachedCode].map((x) => String(x ?? '').trim()).filter(Boolean);
  for (const code of candidates) {
    const hit = list.find((f) => f.code === code);
    if (hit) return hit
  }
  return list[0]
}

const useUserStore = defineStore('user', {
  state: () => {
    let ui = null;
    try { ui = JSON.parse(localStorage.getItem('mes_user') || 'null'); } catch {}
    return {
      token: (() => { const t = localStorage.getItem('mes_token'); return t && t !== 'undefined' ? t : '' })(),
      userInfo: ui,
      factory: (() => { try { return JSON.parse(localStorage.getItem('mes_factory') || 'null') } catch { return null } })(),
      factories: [],
      loginDate: '',
      roleCode: ui?.roleCode || '',
      isAdmin: !!ui?.isAdmin,
      visiblePanels: Array.isArray(ui?.visiblePanels) ? ui.visiblePanels : [],
      approvePanels: Array.isArray(ui?.approvePanels) ? ui.approvePanels : [],
    }
  },
  getters: {
    isLogin: (s) => !!s.token,
    realName: (s) => s.userInfo?.realName || s.userInfo?.userName || '',
    factoryName: (s) => s.factory?.name || '',
    // T+ 顶栏中区：登录日期（登录时记录）
    loginDateText: (s) => s.loginDate || localStorage.getItem('mes_login_date') || '--',
    // T+ 顶栏中区：服务到期时间（后续由 SQL 后端账号信息提供）
    serviceEnd: (s) => s.userInfo?.serviceEnd || '2027-08-13',
    account: (s) => s.userInfo?.userName || '',
  },
  actions: {
    async login(payload) {
      const res = await apiLogin(payload);
      this.token = res.token;
      this.userInfo = res.user;
      this.applyPerms(res.user);
      const today = new Date().toISOString().slice(0, 10);
      this.loginDate = today;
      localStorage.setItem('mes_token', res.token);
      localStorage.setItem('mes_user', JSON.stringify(res.user));
      localStorage.setItem('mes_login_date', today);
      // 账套以**登录响应**为准(后端把令牌声明里的 factory 一并返回):
      // 顶栏/桌面显示的名字必须等于"正在被查询的那个库",不能由可陈旧的缓存说了算。
      // 账套清单可能还没加载(直接调 API 登录的场景),先记 code,名字由 fetchFactories 补齐。
      if (res.user && res.user.factory) {
        const code = res.user.factory;
        const hit = this.factories.find((f) => f && f.code === code);
        this.factory = hit || { code, name: this.factory && this.factory.code === code ? this.factory.name : '' };
        localStorage.setItem('mes_factory', JSON.stringify(this.factory));
      }
      return res
    },
    // 从登录/用户信息中提取角色权限
    applyPerms(u) {
      this.roleCode = u?.roleCode || '';
      this.isAdmin = !!u?.isAdmin;
      this.visiblePanels = Array.isArray(u?.visiblePanels) ? u.visiblePanels : [];
      this.approvePanels = Array.isArray(u?.approvePanels) ? u.approvePanels : [];
    },
    // 刷新权限（角色/面板配置变更后调用）
    async fetchPerms() {
      const { apiGetPerms } = await __vitePreload(async () => { const { apiGetPerms } = await Promise.resolve().then(() => api);return { apiGetPerms }},true              ?void 0:void 0);
      const p = await apiGetPerms();
      if (!p) return
      this.roleCode = p.roleCode || '';
      this.isAdmin = !!p.isAdmin;
      this.visiblePanels = Array.isArray(p.visiblePanels) ? p.visiblePanels : [];
      this.approvePanels = Array.isArray(p.approvePanels) ? p.approvePanels : [];
      if (this.userInfo) {
        this.userInfo = { ...this.userInfo, roleCode: this.roleCode, isAdmin: this.isAdmin, visiblePanels: this.visiblePanels, approvePanels: this.approvePanels };
        localStorage.setItem('mes_user', JSON.stringify(this.userInfo));
      }
    },
    async fetchUserInfo() {
      const info = await apiGetUserInfo();
      this.userInfo = info;
      this.applyPerms(info);
      localStorage.setItem('mes_user', JSON.stringify(info));
    },
    async fetchFactories() {
      const { apiGetFactories } = await __vitePreload(async () => { const { apiGetFactories } = await Promise.resolve().then(() => api);return { apiGetFactories }},true              ?void 0:void 0);
      this.factories = await apiGetFactories();
      // 当前账套 = 会话里那个(令牌声明随登录响应进来),缓存只作兜底 —— 见 core/auth/factory.js
      const latest = pickCurrentFactory(this.factories, {
        sessionCode: this.userInfo && this.userInfo.factory,
        cachedCode: this.factory && this.factory.code,
      });
      if (latest) {
        // Replace the whole cached object so corrected names/addresses take effect
        // after a database repair without requiring users to clear localStorage.
        this.factory = latest;
        localStorage.setItem('mes_factory', JSON.stringify(this.factory));
      }
    },
    /**
     * 切换账套(工厂)。2026-09-22 修正:原先这里只改本地对象 + localStorage,令牌没换,
     * 后端仍按旧令牌声明路由到旧库 —— 名字变了数据没变,用户报的"无效、并未切换"就是这个。
     * 现在按 ADR-0003 走"用目标账套的密码重新登录"(调用方传入 login):
     *   · 验密在**目标账套**上做(AuthController 先路由再查 yj_user);
     *   · 换掉令牌 ⇒ 后续请求由 JwtAuthFilter 按新声明路由到新库;
     *   · 成功后调用方负责刷新页面,让菜单/面板/数据全部按新库重建。
     * 失败原样抛出(密码错/该账套无此账号),由调用方展示,不改动当前会话。
     */
    async switchFactory(target, password) {
      if (!target || !target.code) throw new Error('未选择账套')
      const res = await this.login({
        userName: this.account || (this.userInfo && this.userInfo.userName),
        password,
        factory: target.code,
      });
      return res
    },
    logout() {
      this.token = '';
      this.userInfo = null;
      this.roleCode = '';
      this.isAdmin = false;
      this.visiblePanels = [];
      this.approvePanels = [];
      localStorage.removeItem('mes_token');
      localStorage.removeItem('mes_user');
    },

  },
});

const user = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  useUserStore
}, Symbol.toStringTag, { value: 'Module' }));

// YINJIA-MES 菜单:面板以 HSDZ_MES yj_panel 注册表为准
// 模块:智能供应链 / 生产制造 / 研发管理 / 基础档案
const menuTree = [
  {
    code: 'dashboard',
    title: '我的桌面',
    path: '/dashboard',
    icon: 'HomeFilled',
    panelCode: 'DASHBOARD', // 权限化:组织架构「通用·我的桌面」勾可见才显示(admin 恒可见)
  },
  {
    code: 'rd',
    title: '研发管理',
    icon: 'MagicStick',
    // 二级目录按研发流程分三组(2026-09-10 整理):项目管理 → 测试记录 → 产品文件;
    // 叶子项与分组不再混排,面板/权限/数据键均不变,只调整导航层级。
    children: [
      {
        code: 'rdProject', title: '项目管理', icon: 'DocumentAdd', children: [
          { code: 'rdApproval', title: '立项申请', path: '/panelx/list/RD_APPROVAL', icon: 'DocumentAdd', panelCode: 'RD_APPROVAL', operationName: '新增流程' },
          { code: 'rdPlan', title: '项目实施计划', path: '/panelx/list/RD_PLAN', icon: 'Calendar', panelCode: 'RD_PLAN', operationName: '新增流程' },
          { code: 'rdProgress', title: '项目进度查询', path: '/panelx/list/RD_PROGRESS', icon: 'DataLine', panelCode: 'RD_PROGRESS' },
        ],
      },
      {
        code: 'rdTest', title: '测试记录', icon: 'Notebook', children: [
          {
            code: 'rdData', title: '数据记录表', icon: 'Notebook', children: [
              { code: 'rdFilterEff', title: '功能性滤效', path: '/panelx/list/RD_FILTER_EFF', panelCode: 'RD_FILTER_EFF', icon: 'Histogram' },
              { code: 'rdAlkaline', title: '碱性', path: '/panelx/list/RD_ALKALINE', panelCode: 'RD_ALKALINE', icon: 'Coin' },
              { code: 'rdMineral', title: '矿化', path: '/panelx/list/RD_MINERAL', panelCode: 'RD_MINERAL', icon: 'Odometer' },
              { code: 'rdAntibact', title: '抑菌', path: '/panelx/list/RD_ANTIBACT', panelCode: 'RD_ANTIBACT', icon: 'CircleCheck' },
              { code: 'rdScale', title: '阻垢性能', path: '/panelx/list/RD_SCALE', panelCode: 'RD_SCALE', icon: 'Minus' },
              { code: 'rdRoProtect', title: 'RO保护', path: '/panelx/list/RD_RO_PROTECT', panelCode: 'RD_RO_PROTECT', icon: 'Umbrella' },
              { code: 'rdSoak', title: '浸泡安全', path: '/panelx/list/RD_SOAK', panelCode: 'RD_SOAK', icon: 'Coffee' },
              { code: 'rdDropPrec', title: '压降、精度', path: '/panelx/list/RD_DROP_PREC', panelCode: 'RD_DROP_PREC', icon: 'Bottom' },
            ],
          },
          {
            code: 'rdLab', title: '实验室使用记录表', icon: 'Flask', children: [
              { code: 'rdSpikeWater', title: '加标水配置记录表', path: '/panelx/list/RD_SPIKE_WATER', panelCode: 'RD_SPIKE_WATER', icon: 'Coin' },
              // 2026-09-30:「内部委托测试申请单」升级为**一张单三个页签**的「测试申请单」
              //   (页签 = 内部委托-测试申请单 / 销售端-测试/检测申请表 / 委托测试汇总表,
              //    按《3.实验室使用记录表\测试申请单.xlsx》3 个 sheet 复刻);面板编码 RD_DOM_TEST 不变。
              { code: 'rdDomTest', title: '测试申请单', path: '/panelx/list/RD_DOM_TEST', panelCode: 'RD_DOM_TEST', icon: 'DocumentAdd' },
              { code: 'rdEquipUse', title: '设备使用登记表', path: '/panelx/list/RD_EQUIP_USE', panelCode: 'RD_EQUIP_USE', icon: 'Monitor' },
              { code: 'rdInstrUse', title: '仪器使用记录表', path: '/panelx/list/RD_INSTR_USE', panelCode: 'RD_INSTR_USE', icon: 'Odometer' },
            ],
          },
        ],
      },
      {
        code: 'rdFiles', title: '产品文件', icon: 'FolderOpened', children: [
          { code: 'rdProdInfo', title: '产品信息表', path: '/panelx/list/RD_PROD_INFO', panelCode: 'RD_PROD_INFO', icon: 'Tickets' },
          // 成型工艺清单 = 页1 工艺清单 + 页2 成型配方(2026-09-11 起 RD_MOLD_FORMULA 并入其第 2 页签)
          { code: 'rdMoldProc', title: '成型工艺清单', path: '/panelx/list/RD_MOLD_PROC', panelCode: 'RD_MOLD_PROC', icon: 'SetUp' },
          // 2026-09-11 下线(并入 RD_MOLD_PROC 第 2 页签):yj_panel/yj_field/yj_role_panel 行保留,
          // 面板配置与保存链路都还在,需要恢复入口时放开本行即可。
          // { code: 'rdMoldFormula', title: '成型配方', path: '/panelx/list/RD_MOLD_FORMULA', panelCode: 'RD_MOLD_FORMULA', icon: 'Coin' },
          { code: 'rdSpecDoc', title: '规格书', path: '/panelx/list/RD_SPEC_DOC', panelCode: 'RD_SPEC_DOC', icon: 'Document' },
          // 2026-09-11 下线(并入 RD_ASM_PROC 第 2 页签):同上,行保留、配置保留,放开本行即恢复。
          // { code: 'rdAsmBom', title: '组装BOM表', path: '/panelx/list/RD_ASM_BOM', panelCode: 'RD_ASM_BOM', icon: 'Grid' },
          // 组装工艺清单 = 页1 关键工序控制清单 + 页2 组装BOM表(物料清单 + 修订记录)
          { code: 'rdAsmProc', title: '组装工艺清单', path: '/panelx/list/RD_ASM_PROC', panelCode: 'RD_ASM_PROC', icon: 'Operation' },
          { code: 'rdInspPlan', title: '出货检验计划表', path: '/panelx/list/RD_INSP_PLAN', panelCode: 'RD_INSP_PLAN', icon: 'CircleCheck' },
          // 2026-09-18 新增(研发管理 × 产品开发最新设计):
          //   · 产品文件列表 —— 设计《产品开发系统需求汇总》sheet「文件汇总表」;
          //     **只读派生视图**(产品×4文件 开发状态矩阵),数据源与产品信息表侧栏「产品开发」同一份
          //   · 样品编号表(RD_SAMPLE_NO)于 2026-09-30 **下架**:用户口径「样品编号表删掉」。
          //     面板元数据/字段/权限已清(tools/migrate-drop-sample-no-panel-2026-09-30.sql),
          //     rd_sample_no_head / rd_sample_no_detail 两张数据表**保留**留档;
          //     代码里的样品编号唯一性校验与归档登记同批移除。
          //     要恢复:反向重跑该脚本(元数据)+ 放开本行 + 恢复那两处代码。
          { code: 'rdProdDocList', title: '产品文件列表', path: '/panelx/list/RD_PROD_DOCLIST', panelCode: 'RD_PROD_DOCLIST', icon: 'Grid' },
          // 2026-09-21 新增:产品变更申请单(RD_CHANGE,YJ-QR-130《KPC变更申请通知单》)——
          // 产品变更**走单**的载体:发起人建单 → 各受控文件勾选 → 部门按账号填本部门栏 →(需会签时)会签
          // → 冯总(admin)审批 → 生效即按勾选文件建下一版草稿并通知责任人重走受控审核。
          // 归「产品文件」组:它改的就是这四个受控文件,与产品信息表/四文件同一族。
          { code: 'rdChange', title: '产品变更申请单', path: '/panelx/list/RD_CHANGE', panelCode: 'RD_CHANGE', icon: 'Refresh' },
        ],
      },
      {
        // 共享文件(2026-09-17):全公司共享资料库(标准/测试报告/认证报告),专用视图非面板引擎;
        // 权限走 yj_role_panel(全员默认 view 查阅,上传/改/删=组织架构按角色勾 add/edit/delete)
        code: 'rdShare', title: '共享文件', icon: 'Folder', children: [
          { code: 'rdShareFile', title: '共享文件库', path: '/rd/shareFile', panelCode: 'RD_SHARE_FILE', icon: 'Collection' },
        ],
      },
    ],
  },
  {
    code: 'scm',
    title: '智能供应链',
    icon: 'Connection',
    children: [
      {
        code: 'sales',
        title: '销售管理',
        icon: 'ShoppingCart',
        children: [
          {
            code: 'doc', title: '单据', children: [
              { code: 'soOrder', title: '销售订单', path: '/panelx/list/SO_ORDER', icon: 'Tickets', panelCode: 'SO_ORDER', operationName: '新增流程' },
            ],
          },
          {
            code: 'detail', title: '明细表', children: [
              { code: 'soDetail', title: '销售订单明细表', path: '/panelx/list/SALES_ORDER_DETAIL', panelCode: 'SALES_ORDER_DETAIL', icon: 'List' },
            ],
          },
          {
            code: 'stats', title: '统计表', children: [
              { code: 'soStats', title: '销售订单统计表', path: '/panelx/list/SALES_ORDER_STATS', panelCode: 'SALES_ORDER_STATS', icon: 'Histogram' },
            ],
          },
        ],
      },
      {
        code: 'purchase',
        title: '采购管理',
        icon: 'ShoppingCart',
        children: [
          {
            code: 'doc', title: '单据', children: [
              { code: 'puReq', title: '请购单', path: '/panelx/list/PU_REQ', icon: 'Tickets', panelCode: 'PU_REQ', operationName: '新增流程' },
              { code: 'puOrder', title: '采购订单', path: '/panelx/list/PU_ORDER', icon: 'Tickets', panelCode: 'PU_ORDER', operationName: '新增流程' },
            ],
          },

        ],
      },
      {
        code: 'invAcct',
        title: '库存核算',
        icon: 'Box',
        children: [
          {
            code: 'doc', title: '单据', children: [
              // 送料暂收单:面板编码 QC_RECV(2026-09-20 由 SL_RECV 改名,物理表仍 sl_recv/sl_recv_detail,单据前缀 SL)
              { code: 'slRecv', title: '送料暂收单', path: '/panelx/list/QC_RECV', icon: 'Download', panelCode: 'QC_RECV', operationName: '新增流程' },
              { code: 'qcReturn', title: '暂收退料单', path: '/panelx/list/QC_RETURN', icon: 'RefreshLeft', panelCode: 'QC_RETURN', operationName: '新增流程' },
              { code: 'purchaseIn', title: '采购入库单', path: '/panelx/list/PURCHASE_IN', icon: 'Download', panelCode: 'PURCHASE_IN', operationName: '新增流程' },
              { code: 'finishIn', title: '产成品入库单', path: '/panelx/list/FINISH_IN', icon: 'Download', panelCode: 'FINISH_IN', operationName: '新增流程' },
              { code: 'otherIn', title: '其他入库单', path: '/panelx/list/OTHER_IN', icon: 'Download', panelCode: 'OTHER_IN', operationName: '新增流程' },
              { code: 'outsourceIn', title: '委外入库单', path: '/panelx/list/OUTSOURCE_IN', icon: 'Download', panelCode: 'OUTSOURCE_IN', operationName: '新增流程' },
              { code: 'saleOut', title: '销售出库单', path: '/panelx/list/SALE_OUT', icon: 'Upload', panelCode: 'SALE_OUT', operationName: '新增流程' },
              { code: 'materialOut', title: '材料出库单', path: '/panelx/list/MATERIAL_OUT', icon: 'Upload', panelCode: 'MATERIAL_OUT', operationName: '新增流程' },
              { code: 'otherOut', title: '其他出库单', path: '/panelx/list/OTHER_OUT', icon: 'Upload', panelCode: 'OTHER_OUT', operationName: '新增流程' },
              { code: 'outsourceIssue', title: '委外发料单', path: '/panelx/list/OUTSOURCE_ISSUE', icon: 'Upload', panelCode: 'OUTSOURCE_ISSUE', operationName: '新增流程' },
            ],
          },
        ],
      },
      {
        code: 'invDetail',
        title: '库存明细',
        icon: 'List',
        children: [
          { code: 'purchaseInDetail', title: '采购入库单明细表', path: '/panelx/list/PURCHASE_IN_DETAIL', panelCode: 'PURCHASE_IN_DETAIL', icon: 'List' },
          { code: 'finishInDetail', title: '产成品入库单明细表', path: '/panelx/list/FINISH_IN_DETAIL', panelCode: 'FINISH_IN_DETAIL', icon: 'List' },
          { code: 'otherInDetail', title: '其他入库单明细表', path: '/panelx/list/OTHER_IN_DETAIL', panelCode: 'OTHER_IN_DETAIL', icon: 'List' },
          { code: 'outsourceInDetail', title: '委外入库单明细表', path: '/panelx/list/OUTSOURCE_IN_DETAIL', panelCode: 'OUTSOURCE_IN_DETAIL', icon: 'List' },
          { code: 'saleOutDetail', title: '销售出库单明细表', path: '/panelx/list/SALE_OUT_DETAIL', panelCode: 'SALE_OUT_DETAIL', icon: 'List' },
          { code: 'materialOutDetail', title: '材料出库单明细表', path: '/panelx/list/MATERIAL_OUT_DETAIL', panelCode: 'MATERIAL_OUT_DETAIL', icon: 'List' },
          { code: 'otherOutDetail', title: '其他出库单明细表', path: '/panelx/list/OTHER_OUT_DETAIL', panelCode: 'OTHER_OUT_DETAIL', icon: 'List' },
          { code: 'outsourceIssueDetail', title: '委外发料单明细表', path: '/panelx/list/OUTSOURCE_ISSUE_DETAIL', panelCode: 'OUTSOURCE_ISSUE_DETAIL', icon: 'List' },
        ],
      },
      {
        code: 'invStats',
        title: '库存统计',
        icon: 'Histogram',
        children: [
          { code: 'purchaseInStats', title: '采购入库单统计表', path: '/panelx/list/PURCHASE_IN_STATS', panelCode: 'PURCHASE_IN_STATS', icon: 'Histogram' },
          { code: 'finishInStats', title: '产成品入库单统计表', path: '/panelx/list/FINISH_IN_STATS', panelCode: 'FINISH_IN_STATS', icon: 'Histogram' },
          { code: 'otherInStats', title: '其他入库单统计表', path: '/panelx/list/OTHER_IN_STATS', panelCode: 'OTHER_IN_STATS', icon: 'Histogram' },
          { code: 'outsourceInStats', title: '委外入库单统计表', path: '/panelx/list/OUTSOURCE_IN_STATS', panelCode: 'OUTSOURCE_IN_STATS', icon: 'Histogram' },
          { code: 'saleOutStats', title: '销售出库单统计表', path: '/panelx/list/SALE_OUT_STATS', panelCode: 'SALE_OUT_STATS', icon: 'Histogram' },
          { code: 'materialOutStats', title: '材料出库单统计表', path: '/panelx/list/MATERIAL_OUT_STATS', panelCode: 'MATERIAL_OUT_STATS', icon: 'Histogram' },
          { code: 'otherOutStats', title: '其他出库单统计表', path: '/panelx/list/OTHER_OUT_STATS', panelCode: 'OTHER_OUT_STATS', icon: 'Histogram' },
          { code: 'outsourceIssueStats', title: '委外发料单统计表', path: '/panelx/list/OUTSOURCE_ISSUE_STATS', panelCode: 'OUTSOURCE_ISSUE_STATS', icon: 'Histogram' },
        ],
      },
      {
        // 库存报表(三张核心库存报表集中入口)
        code: 'invReports',
        title: '库存报表',
        icon: 'DataAnalysis',
        children: [
          // 库存状况表:实时聚合 8 类出入库单据行的现存量/结存金额(自库存统计组迁入)
          { code: 'stockBalance', title: '库存状况表', path: '/panelx/list/STOCK_BALANCE', panelCode: 'STOCK_BALANCE', icon: 'DataAnalysis' },
          // 库存台账:8类出入库行级流水+按仓库+存货滚动结存(v_stock_ledger)
          { code: 'stockLedger', title: '库存台账', path: '/panelx/list/STOCK_LEDGER', panelCode: 'STOCK_LEDGER', icon: 'Notebook' },
          // 收发存汇总表:按仓库+存货+期次聚合的期初/本期收入发出/期末(v_stock_summary)
          { code: 'stockSummary', title: '收发存汇总表', path: '/panelx/list/STOCK_SUMMARY', panelCode: 'STOCK_SUMMARY', icon: 'DataAnalysis' },
        ],
      },
    ],
  },
  {
    code: 'mfg',
    title: '生产制造',
    icon: 'Odometer',
    // 2026-10-14 两次归一(用户口径「和其他模块的侧边栏不一样,要求相同实现方式」+「明细表和统计表不做大类区分」):
    // ① 原先这里多包了一层空壳二级目录「生产管理」(它自己不含面板,真正的业务域在它下面),
    //    后果:侧栏点开「生产制造」只列出一个二级项「生产管理」,而 智能供应链/品质管理/基础档案
    //    都是一级 → 业务域(二级) → 分类·面板(三级);前端 LeftNav 还为此写了 `m.code === 'mfg'` 特判去"穿"这层。
    // ② 原「明细表」「统计表」是并列的两个二级大类,同样与别的模块不同 —— 别的模块里明细/统计表都挂在
    //    所属业务对象下(如 智能供应链·销售管理:销售订单 → 销售订单明细表 → 销售订单统计表)。
    // 现终态:二级只剩 6 个业务域(生产计划/生产执行/生产记录/设备维护/样品管理/经典单据),
    // 4 张明细/统计面板按业务对象并入 生产计划 / 经典单据;LeftNav 的 mfg 特判已删除,全部模块走同一条通用分支。
    children: [
      {
        // 生产计划(流程图·生管泳道):销售订单→工单→排产→齐套
        code: 'plan', title: '生产计划', children: [
          // 订单结转·发单工作台(方案 V1.0):待结转行(剩余=需求−已排产−已采购)→转工单/转采购单;
          // 防重复=行级占用链,转满自动消失;不改销售订单状态。置首位:发单是排产的上一步。
          { code: 'orderConvert', title: '订单结转', path: '/prod/plan/orderConvert', icon: 'Switch' },
          // 生产工单(2026-09-24 用户拍板改名:原「生产加工单」MANU_ORDER,面板名/菜单位移自此;
          // 流程位置=订单结转之后、排产之前:生单→编制审核→排产工作台排线)。
          // 原生产记录组的「生产加工单」菜单同步下线,单一入口。
          // 列表样式=工单排产·列表(2026-09-24,参考旧系统 ProSchedulingController 报表式:修改/结案/打印工单/打印工单_多个/打印领料单/批量调线+产线筛选+追溯);单据维护从行点修改进表单
          { code: 'manufactureOrder', title: '生产工单', path: '/prod/plan/workOrderList', icon: 'Document' },
          // 快速排产(原「排产工作台」,2026-09-26 用户拍板改名):待排产池(已审核·未指派产线)→选产线(带负荷)→单笔/批量排入→撤销回池;
          // 排产单一入口(工单「排产」按钮已下线,表单产线/开工·完工日只读)
          { code: 'scheduleBoard', title: '快速排产', path: '/prod/plan/scheduleBoard', icon: 'AlarmClock' },
          // 2026-09-22 单轨改造(参考库式,用户拍板):生产工单/排单计划菜单下线——
          // 工单=生产加工单(MANU_ORDER),看板职责由「生产排产 MANU_SCHEDULE」承接(含五工序完成/未完成数量);
          // 面板与权限行保留可回滚(同 组装BOM表 并页签先例)。恢复:取消下两行注释即可。
          // { code: 'woOrder', title: '生产工单', path: '/panelx/list/WO_ORDER', icon: 'Tickets', panelCode: 'WO_ORDER', operationName: '新增流程' },
          // { code: 'woSchedule', title: '排单计划', path: '/panelx/list/WO_SCHEDULE', panelCode: 'WO_SCHEDULE', icon: 'DataLine' },
          // 2026-09-23 纠偏(用户拍板):「生产排产」平铺看板改为「工单排产」产线骨架视图(参考旧系统工单排产页,
          // 按产线查看正在运行的工单任务);MANU_SCHEDULE 面板/权限行保留可回滚(同 WO_ORDER 先例)。
          // { code: 'manuSchedule', title: '生产排产', path: '/panelx/list/MANU_SCHEDULE', panelCode: 'MANU_SCHEDULE', icon: 'Histogram' },
          { code: 'workOrderBoard', title: '工单排产', path: '/prod/plan/workOrderBoard', icon: 'Histogram' },
          // 工序任务(路线驱动,A 项 2026-10-05)菜单已按用户口径**撤下**(「把工序任务删除掉算了」,
          // 2026-10-05):工单详情只看"走到哪一步"(按报工统计),不再维护工序任务队列。
          // 页面组件/后端接口/表结构按可撤回要求保留但不再挂菜单;要恢复只需把下面一行注释去掉。
          // { code: 'processQueue', title: '工序任务', path: '/prod/plan/processQueue', icon: 'Sort' },
          // 生产线档案在 基础资料→生产(PROD_LINE,2026-09-23 归位);此处负荷看板按 生产线档案日产能 判超载
          { code: 'lineLoad', title: '产线排产负荷', path: '/panelx/list/LINE_LOAD', panelCode: 'LINE_LOAD', icon: 'DataLine' },
          // 2026-10-14 工单齐套表 WO_KIT 菜单下线:唯一数据源 v_wo_kit(基于自建物料的齐套视图)已随
          // MES 自建「物料清单(BOM)」功能整体删除(表 bs_bom / 视图 v_wo_kit / 面板 BOM、WO_KIT 同批下架)。
          // 2026-10-14 用户口径「明细表和统计表不做大类区分,跟其他模块方式一样」:生产工单的两张明细/统计表
          // 归到本业务域(不再单列「明细表」「统计表」二级大类),与 智能供应链·销售管理「销售订单 →
          // 销售订单明细表 → 销售订单统计表」的域内摆法一致。
          { code: 'manuDetail', title: '生产工单明细表', path: '/panelx/list/MANU_ORDER_DETAIL', panelCode: 'MANU_ORDER_DETAIL', icon: 'List' },
          { code: 'manuStats', title: '生产工单统计表', path: '/panelx/list/MANU_ORDER_STATS', panelCode: 'MANU_ORDER_STATS', icon: 'Histogram' },
        ],
      },
      {
        // 生产执行(五道工序:领料/报工)
        code: 'exec', title: '生产执行', children: [
          { code: 'woReport', title: '工序报工单', path: '/panelx/list/WO_REPORT', icon: 'Promotion', panelCode: 'WO_REPORT', operationName: '新增流程' },
          { code: 'woReportList', title: '报工记录', path: '/panelx/list/WO_REPORT_LIST', panelCode: 'WO_REPORT_LIST', icon: 'List' },
          // 生产异常闭环(生产部纪要 三:异常提出→分析→处理→结案;挂工单号/批次号按批追溯)
          { code: 'prodAbn', title: '生产异常处理单', path: '/panelx/list/PROD_ABN', panelCode: 'PROD_ABN', icon: 'WarningFilled' },
        ],
      },
      {
        // 生产记录(29份真实单据·家族面板)
        code: 'records', title: '生产记录', icon: 'Notebook', children: [
          { code: 'dayReport', title: '生产日报表', path: '/panelx/list/DAY_REPORT', panelCode: 'DAY_REPORT', operationName: '新增流程' },
          { code: 'feedConfirm', title: '投料确认单', path: '/panelx/list/FEED_CONFIRM', panelCode: 'FEED_CONFIRM', operationName: '新增流程' },
          { code: 'mixRecord', title: '物料混合记录', path: '/panelx/list/MIX_RECORD', panelCode: 'MIX_RECORD', operationName: '新增流程' },
          { code: 'granRecord', title: '造粒记录', path: '/panelx/list/GRAN_RECORD', panelCode: 'GRAN_RECORD', operationName: '新增流程' },
          { code: 'whRecord', title: '无黑处理登记', path: '/panelx/list/WH_RECORD', panelCode: 'WH_RECORD', operationName: '新增流程' },
          { code: 'packConfirm', title: '封箱确认', path: '/panelx/list/PACK_CONFIRM', panelCode: 'PACK_CONFIRM', operationName: '新增流程' },
        ],
      },
      {
        code: 'device', title: '设备维护', children: [
          { code: 'equipCheck', title: '设备点检记录', path: '/panelx/list/EQUIP_CHECK', panelCode: 'EQUIP_CHECK', operationName: '新增流程' },
          { code: 'maintPlan', title: '保养计划', path: '/panelx/list/MAINT_PLAN', panelCode: 'MAINT_PLAN', operationName: '新增流程' },
        ],
      },
      {
        code: 'sample', title: '样品管理', children: [
          { code: 'sampleReq', title: '样品申请单', path: '/panelx/list/SAMPLE_REQ', panelCode: 'SAMPLE_REQ', operationName: '新增流程' },
        ],
      },
      {
        code: 'legacy', title: '经典单据', children: [
          // 生产工单已归位「生产计划」组(2026-09-24),此处不再重复入口
          { code: 'dispatch', title: '工序派工单', path: '/panelx/list/DISPATCH', icon: 'AlarmClock', panelCode: 'DISPATCH', operationName: '新增流程' },
          { code: 'outsourceOrder', title: '委外加工单', path: '/panelx/list/OUTSOURCE_ORDER', icon: 'Tickets', panelCode: 'OUTSOURCE_ORDER', operationName: '新增流程' },
          // 2026-10-14 同上:派工单的明细/统计表并回本域,取消二级「明细表/统计表」大类
          { code: 'dispatchDetail', title: '工序派工单明细表', path: '/panelx/list/DISPATCH_DETAIL', panelCode: 'DISPATCH_DETAIL', icon: 'List' },
          { code: 'dispatchStats', title: '工序派工单统计表', path: '/panelx/list/DISPATCH_STATS', panelCode: 'DISPATCH_STATS', icon: 'Histogram' },
        ],
      },
    ],
  },
  {
    code: 'qc',
    title: '品质管理',
    icon: 'CircleCheck',
    children: [
      {
        // 来料品质(流程图·采购支线:检验;暂收入库单已下线,暂收角色由「库存核算·送料暂收单」承接)
        // 特采单(2026-09-21):独立面板 QC_TC_IN / 独立表 qc_tc_in / 前缀 TCI,同一张 YJ-QR-60 表单。
        // (2026-09-22:「质量单据·特采申请单」QC_TC 与它同表同版式、重复,已整体下线 → 特采只此一个入口。)
        // 检验目录(2026-09-22):QC_CATALOG 单单据面板(方式对照 RD_PROGRESS),《品质资料 2026.09.19.xlsx》检验目录页签一比一。
        code: 'incoming', title: '来料品质', children: [
          { code: 'qcInsp', title: '来料检验单', path: '/panelx/list/QC_INSP', icon: 'Search', panelCode: 'QC_INSP', operationName: '新增流程' },
          { code: 'qcTcIn', title: '特采单', path: '/panelx/list/QC_TC_IN', icon: 'DocumentAdd', panelCode: 'QC_TC_IN', operationName: '新增流程' },
          { code: 'qcCatalog', title: '检验目录', path: '/panelx/list/QC_CATALOG', icon: 'Notebook', panelCode: 'QC_CATALOG' },
          // 检验数据记录(2026-09-22):纸张式检验报告 YJ-QR-96,版式对照《品质资料 2026.09.19.xlsx》「检验数据记录模版」;
          // 检验目录行上的批次号 📄 可按物料批次查阅本面板的报告。
          { code: 'qcInspRec', title: '检验数据记录', path: '/panelx/list/QC_INSP_REC', icon: 'Document', panelCode: 'QC_INSP_REC', operationName: '新增流程' },
          // 来料检验要求(2026-09-22):《品质资料 2026.09.19.xlsx》折叠棉~PP棉 7 张检验要求表,
          // 档案式整表面板(规格书式页签+Excel 复刻表格,非翻页单据),行按物料类别分流 7 页签
          { code: 'qcInspReq', title: '来料检验要求', path: '/panelx/list/QC_INSP_REQ', icon: 'Grid', panelCode: 'QC_INSP_REQ' },
          // 来料检验要求(系列)(2026-10-04 用户口径):表太多不再挤在一个面板 ⇒ 拆出 10 张**全自定义**表
          // (阻垢系列/BK材料系列/除重金属系列/矿化(碱性)系列/抑菌系列/载银系列/炭粉/胶粉/矿化料/原料来料);
          // 与「来料检验要求」同构:每张表各自加自定义列(每表 20 个扩展位)、可带父字段(分组表头)、
          // 检验数据记录按物料编码一起带入(只带子字段)。页签集由 物料类别 词典决定,加页签只改词典。
          { code: 'qcInspReqSeries', title: '来料检验要求(系列)', path: '/panelx/list/QC_INSP_REQ_SERIES', icon: 'Grid', panelCode: 'QC_INSP_REQ_SERIES' },
        ],
      },
      {
        // 制程品质(流程图·品质泳道:工序质检数据)
        code: 'process', title: '制程品质', children: [
          { code: 'qcOp', title: '工序质检单', path: '/panelx/list/QC_OP', icon: 'CircleCheck', panelCode: 'QC_OP', operationName: '新增流程' },
          { code: 'qcRecord', title: '检验记录单', path: '/panelx/list/QC_RECORD', icon: 'Document', panelCode: 'QC_RECORD', operationName: '新增流程' },
          // 三类工序检验单(9.29 批次④,2026-10-05):报工审核自动出单;成型/切炭先按通用模板,组装成品含合格转库存/不合格待处理
          { code: 'qcMoldInsp', title: '成型检验单', path: '/panelx/list/QC_MOLD_INSP', icon: 'Checked', panelCode: 'QC_MOLD_INSP', operationName: '新增流程' },
          { code: 'qcCutInsp', title: '切炭检验单', path: '/panelx/list/QC_CUT_INSP', icon: 'Checked', panelCode: 'QC_CUT_INSP', operationName: '新增流程' },
          { code: 'qcAsmInsp', title: '组装成品检验单', path: '/panelx/list/QC_ASM_INSP', icon: 'Finished', panelCode: 'QC_ASM_INSP', operationName: '新增流程' },
        ],
      },
      {
        // 不良处理(隔离仓/不良品仓/报废/退货)
        code: 'defect', title: '不良处理', children: [
          { code: 'qcDisposal', title: '不良品处理单', path: '/panelx/list/QC_DISPOSAL', icon: 'Warning', panelCode: 'QC_DISPOSAL', operationName: '新增流程' },
          { code: 'rodReturn', title: '炭棒不良退货登记', path: '/panelx/list/ROD_RETURN', icon: 'RefreshLeft', panelCode: 'ROD_RETURN', operationName: '新增流程' },
        ],
      },
      {
        code: 'trace', title: '品质追溯', children: [
          { code: 'lotTrace', title: '批号追溯', path: '/panelx/list/LOT_TRACE', panelCode: 'LOT_TRACE', icon: 'Search' },
        ],
      },
      {
        // 质量单据(YJ-QR 体系;2026-09-22 起为七表 —— 特采申请单已整体下线)
        // 2026-09-22 下线:特采申请单(QC_TC)—— 与「来料品质·特采单」QC_TC_IN 同表同版式、重复,
        // 按用户口径删的就是这一个。注意:面板与业务表 qc_tc 已整体删除(tools/migrate-qc-tc-drop.sql),
        // 不是仅摘菜单,放开注释也恢复不了;特采单入口在 品质管理 > 来料品质 > 特采单。
        code: 'qcDoc', title: '质量单据', icon: 'DocumentChecked', children: [
          { code: 'qcNcrp', title: '不合格报告(制程)', path: '/panelx/list/QC_BHG', icon: 'CircleClose', panelCode: 'QC_BHG', operationName: '新增流程' },
          { code: 'qcNcdp', title: '不合格品处理单(制程)', path: '/panelx/list/QC_BHC', icon: 'Box', panelCode: 'QC_BHC', operationName: '新增流程' },
          { code: 'qcNcdz', title: '不合格品处理单(自制物料)', path: '/panelx/list/QC_BHZ', icon: 'Files', panelCode: 'QC_BHZ', operationName: '新增流程' },
          { code: 'qcJjf', title: '紧急放行申请单', path: '/panelx/list/QC_JJF', icon: 'AlarmClock', panelCode: 'QC_JJF', operationName: '新增流程' },
          { code: 'qcScp', title: '试产材料使用申请单', path: '/panelx/list/QC_SCP', icon: 'DocumentChecked', panelCode: 'QC_SCP', operationName: '新增流程' },
          { code: 'qcLyb', title: '来料异常分析报告', path: '/panelx/list/QC_LYB', icon: 'DataAnalysis', panelCode: 'QC_LYB', operationName: '新增流程' },
          { code: 'qcScy', title: '生产异常分析报告', path: '/panelx/list/QC_SCY', icon: 'TrendCharts', panelCode: 'QC_SCY', operationName: '新增流程' },
        ],
      },
    ],
  },
  {
    code: 'fin',
    title: '财务管理',
    icon: 'Money',
    children: [],
  },
  {
    code: 'equip',
    title: '设备管理',
    icon: 'Cpu',
    children: [],
  },
  {
    code: 'base',
    title: '基础档案',
    icon: 'Setting',
    children: [
      {
        code: 'bdata',
        title: '基础数据',
        icon: 'Collection',
        children: [
          { code: 'dept', title: '部门', path: '/panelx/list/DEPT', icon: 'OfficeBuilding', panelCode: 'DEPT', operationName: '新增流程' },
          { code: 'employee', title: '职员', path: '/panelx/list/EMP', icon: 'User', panelCode: 'EMP', operationName: '新增流程' },
          { code: 'zdgl', title: '数据字典', path: '/panelx/list/ZDGL', icon: 'Collection', panelCode: 'ZDGL', operationName: '新增流程' },
          { code: 'erpImpLog', title: 'ERP导入日志', path: '/panelx/list/ERPLG', icon: 'Download', panelCode: 'ERPLG' },
          { code: 'warehouse', title: '仓库', path: '/panelx/list/WH', icon: 'House', panelCode: 'WH', operationName: '新增流程' },
          // 库位(2026-09-28):仓库下货位档案,一仓多库位、一库位一仓;支持与商品同款「二维码标签」勾选即打
          { code: 'whloc', title: '库位', path: '/panelx/list/WHLOC', icon: 'LocationInformation', panelCode: 'WHLOC', operationName: '新增流程' },
          { code: 'khda', title: '客户', path: '/panelx/list/KHDA', icon: 'User', panelCode: 'KHDA', operationName: '新增流程' },
          { code: 'gfda', title: '供应商', path: '/panelx/list/GFDA', icon: 'OfficeBuilding', panelCode: 'GFDA', operationName: '新增流程' },
          // 客户/供应商分类不占导航:从 客户/供应商 面板工具栏「分类管理」进入(金蝶同款交互)
          // 2026-09-17 下线:库存状况(STOCK_STATUS,旧kucun台账面板,报表口径由智能供应链·库存报表承接)、
          // 往来单位(PARTNER,客户/供应商已独立档案)——菜单移除,面板配置保留(放开本注释即恢复)
          // { code: 'stockStatus', title: '库存状况', path: '/panelx/list/STOCK_STATUS', icon: 'Histogram', panelCode: 'STOCK_STATUS' },
          // { code: 'partner', title: '往来单位', path: '/panelx/list/PARTNER', icon: 'OfficeBuilding', panelCode: 'PARTNER', operationName: '新增流程' },
          { code: 'region', title: '地区', path: '/panelx/list/REGION', icon: 'Location', panelCode: 'REGION', operationName: '新增流程' },
          { code: 'proj', title: '项目', path: '/panelx/list/PROJ', icon: 'Flag', panelCode: 'PROJ', operationName: '新增流程' },
        ],
      },
      {
        code: 'bmat',
        title: '物料及价格',
        icon: 'Box',
        children: [
          { code: 'uom', title: '计量单位', path: '/panelx/list/UOM', icon: 'ScaleToOriginal', panelCode: 'UOM', operationName: '新增流程' },
          // 商品分类不占导航:从 商品 面板工具栏「分类管理」进入(与 客户/供应商 同款交互)
          { code: 'inventory', title: '商品', path: '/panelx/list/INV', icon: 'Grid', panelCode: 'INV', operationName: '新增流程' },
          // 2026-10-14 物料清单(BOM)菜单下线:MES 自建 BOM 功能整体删除
          // (表 bs_bom / 面板 BOM 及其正反向查询 BOM_FWD、BOM_REV 同批下架)。
          { code: 'invPrice', title: '存货价格本', path: '/panelx/list/INV_PRICE', icon: 'PriceTag', panelCode: 'INV_PRICE', operationName: '新增流程' },
        ],
      },
      {
        code: 'bprod',
        title: '生产',
        icon: 'Cpu',
        children: [
          { code: 'equip', title: '设备', path: '/panelx/list/EQUIP', icon: 'Cpu', panelCode: 'EQUIP', operationName: '新增流程' },
          { code: 'team', title: '班组', path: '/panelx/list/TEAM', icon: 'UserFilled', panelCode: 'TEAM', operationName: '新增流程' },
          { code: 'wc', title: '工作中心', path: '/panelx/list/WC', icon: 'Odometer', panelCode: 'WC', operationName: '新增流程' },
          // 生产线档案(2026-09-23 归位基础资料):排产指派对象,日产能=负荷/超载基准;原「产线产能」(生产计划组)收编下线
          { code: 'prodLine', title: '生产线', path: '/panelx/list/PROD_LINE', icon: 'DCaret', panelCode: 'PROD_LINE', operationName: '新增流程' },
          { code: 'process', title: '工序', path: '/panelx/list/OP', icon: 'SetUp', panelCode: 'OP', operationName: '新增流程' },
          { code: 'routing', title: '工艺路线', path: '/panelx/list/ROUTE', icon: 'Guide', panelCode: 'ROUTE', operationName: '新增流程' },
          // 工序工时:参考库 gxgs——按 客户×物料×工序 维护 换线/标准·最快·最慢·平均时间与加工单价(排产产能/计件依据)
          { code: 'opTime', title: '工序工时', path: '/panelx/list/OP_TIME', icon: 'Timer', panelCode: 'OP_TIME', operationName: '新增流程' },
          { code: 'reject', title: '不合格原因', path: '/panelx/list/REJECT', icon: 'CircleClose', panelCode: 'REJECT', operationName: '新增流程' },
          { code: 'qcItem', title: '检验项目', path: '/panelx/list/QC_ITEM', icon: 'List', panelCode: 'QC_ITEM', operationName: '新增流程' },
          { code: 'qcPlan', title: '检验方案', path: '/panelx/list/QC_PLAN', icon: 'DocumentChecked', panelCode: 'QC_PLAN', operationName: '新增流程' },
        ],
      },
      {
        code: 'bfin',
        title: '财务',
        icon: 'Money',
        children: [
          { code: 'finTax', title: '税别资料', path: '/panelx/list/FIN_TAX', icon: 'Ticket', panelCode: 'FIN_TAX', operationName: '新增流程' },
          { code: 'settle', title: '结算方式', path: '/panelx/list/SETTLE', icon: 'Tickets', panelCode: 'SETTLE', operationName: '新增流程' },
          { code: 'cur', title: '币别', path: '/panelx/list/CUR', icon: 'Money', panelCode: 'CUR', operationName: '新增流程' },
          { code: 'finExp', title: '费用类别', path: '/panelx/list/FIN_EXP', icon: 'Wallet', panelCode: 'FIN_EXP', operationName: '新增流程' },
          { code: 'finAcc', title: '会计科目', path: '/panelx/list/FIN_ACC', icon: 'Notebook', panelCode: 'FIN_ACC', operationName: '新增流程' },
        ],
      },
    ],
  },
];

function walk(node, fn) {
  fn(node);
  if (node.children) node.children.forEach((c) => walk(c, fn));
}

function flatMenus(tree) {
  const out = [];
  walk({ children: tree || menuTree }, (n) => {
    if (n.path) out.push(n);
  });
  return out
}

function findMenuByPath(path) {
  let hit = null;
  walk({ children: menuTree }, (n) => {
    if (n.path === path) hit = n;
  });
  return hit
}

// 角色权限过滤：仅保留 visiblePanels 内的面板叶子；分组节点在子项全不可见时隐藏；admin 返回全量
function filterMenuTree(tree, visiblePanels, isAdmin) {
  if (isAdmin) return tree
  const vis = Array.isArray(visiblePanels) ? visiblePanels : [];
  const filterNode = (nodes) => {
    const out = [];
    for (const n of nodes) {
      if (n.panelCode) {
        if (vis.includes(n.panelCode)) out.push({ ...n });
        continue
      }
      if (n.children && n.children.length) {
        const c = filterNode(n.children);
        if (c.length) out.push({ ...n, children: c });
        continue
      }
      if (n.path) out.push({ ...n });
    }
    return out
  };
  return filterNode(tree)
}

const ModuleView = () => __vitePreload(() => import('./ModuleView-CuHU2ZRq.js'),true              ?__vite__mapDeps([0,1,2,3,4,5,6,7]):void 0);
const PanelxList = () => __vitePreload(() => import('./PanelxList-DC_dL1VN.js'),true              ?__vite__mapDeps([8,1,2,3,9,10,11,4,12,13,14,6,15,16,17,7,18,19,20,21,22,23,24,25,26,27,28,29,30,31]):void 0);
const PanelxForm = () => __vitePreload(() => import('./PanelxForm-B3SeYq9D.js'),true              ?__vite__mapDeps([32,1,2,3,11,9,4,12,13,14,6,15,16,17,7,18,19,20,21,22,33,10,23,25,26,34,35]):void 0);

const routes = [
  { path: '/login', component: () => __vitePreload(() => import('./index-eydt5dZb.js'),true              ?__vite__mapDeps([36,1,2,3,4,37,31,13,6,15]):void 0), meta: { title: '登录' } },
  {
    path: '/',
    component: () => __vitePreload(() => import('./PortalLayout-DXuyHBkU.js'),true              ?__vite__mapDeps([38,2,1,3,9,33,39,10,4,40,31,6,13,30,7,35,21,18,19,22,41]):void 0),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: () => __vitePreload(() => import('./index-Cm5Jq_bY.js'),true              ?__vite__mapDeps([42,1,2,3,9,10,39,4,27,23,25,26,13,6,15,16,14,28,18,17,43]):void 0), meta: { title: '我的桌面' } },
      { path: 'prod/manufacture/order', redirect: '/panelx/list/MANU_ORDER' },
      { path: 'prod/manufacture/orderForm', redirect: '/panelx/form/MANU_ORDER' },
      { path: 'prod/manufacture/board', component: () => __vitePreload(() => import('./ManufactureBoard-BzH1F0RL.js'),true              ?__vite__mapDeps([44,1,2,3,9,4,45,6,13,14,46,47]):void 0), meta: { title: '生产看板', code: 'manufactureBoard' } },
      { path: 'prod/shop/reworkDesk', component: () => __vitePreload(() => import('./ReworkDesk-DaDuTq86.js'),true              ?__vite__mapDeps([48,1,2,3,4,49,6,7,46,47]):void 0), meta: { title: '返修工作台', code: 'reworkDesk' } },
      { path: 'top/solution', component: () => __vitePreload(() => import('./SolutionCenter-B5fVG9hj.js'),true              ?__vite__mapDeps([50,1,2,3,4,51,47,46,6]):void 0), meta: { title: '方案中心', code: 'solutionCenter' } },
      { path: 'sys/org', component: () => __vitePreload(() => import('./OrgAdmin-rjd-MrG6.js'),true              ?__vite__mapDeps([52,1,2,3,9,4,53,21,31,13,6,15,54,41,14]):void 0), meta: { title: '组织架构', requireAdmin: true } },
      { path: 'sys/usage', component: () => __vitePreload(() => import('./UsageLog-D4FY2Gqh.js'),true              ?__vite__mapDeps([55,1,2,3,9,4,56,47,7,41,13,14,6,22,31,17]):void 0), meta: { title: '使用权限查看', requireAdmin: true } },
      { path: 'scm/businessOverview', component: () => __vitePreload(() => import('./BusinessOverview-Vlky4YwB.js'),true              ?__vite__mapDeps([57,1,2,3,10,4,58]):void 0), meta: { title: '业务总览', code: 'businessOverview' } },
      { path: 'scm/mobileWarehouse', component: () => __vitePreload(() => import('./MobileWarehouse-CJ03p8He.js'),true              ?__vite__mapDeps([59,2,10,4,60]):void 0), meta: { title: '移动仓管', code: 'mobileWarehouse' } },
      { path: 'scm/serialNumber', component: () => __vitePreload(() => import('./SerialNumber-DrFkxicF.js'),true              ?__vite__mapDeps([61,2,10,4,62]):void 0), meta: { title: '序列号管理', code: 'serialNumber' } },
      // 共享文件库(研发管理·全公司共享资料):panelCode=RD_SHARE_FILE 带权限,故不进 flatMenus 自动路由,显式注册
      { path: 'rd/shareFile', component: () => __vitePreload(() => import('./ShareFileCenter-BW9wNgmn.js'),true              ?__vite__mapDeps([63,1,2,3,9,4,64,13,17,31,20,6,15,54,16,14]):void 0), meta: { title: '共享文件库', code: 'rdShareFile' } },
      // 订单结转·发单工作台(方案 V1.0):待结转行→转工单/转采购单;panelCode 无,按 SO_ORDER 授权,不进 flatMenus 自动路由
      { path: 'prod/plan/orderConvert', component: () => __vitePreload(() => import('./OrderConvert-DMjviLQz.js'),true              ?__vite__mapDeps([65,1,2,3,9,4,66,13,6,15,16,14,20,31,17]):void 0), meta: { title: '订单结转', code: 'orderConvert' } },
      // 排产工作台(实现总结 V1.0 §5):待排产池→排线→撤销;按 MANU_ORDER 授权,不进 flatMenus 自动路由
      { path: 'prod/plan/scheduleBoard', component: () => __vitePreload(() => import('./ScheduleBoard-B5Sz9Fz8.js'),true              ?__vite__mapDeps([67,1,2,3,9,4,68,21,13,14,6,22,31,15,17]):void 0), meta: { title: '快速排产', code: 'scheduleBoard' } },
      // 工单排产(2026-09-23 纠偏,替代「生产排产」平铺看板):产线×班别骨架+按线查看运行中工单;按 MANU_ORDER 授权,不进 flatMenus 自动路由
      { path: 'prod/plan/workOrderBoard', component: () => __vitePreload(() => import('./WorkOrderBoard-t7LyIv2Z.js'),true              ?__vite__mapDeps([69,1,2,3,9,24,23,70,4,71,13,14,6,72,15,35,18,19,17]):void 0), meta: { title: '工单排产', code: 'workOrderBoard' } },
      // 工单排产·列表(2026-09-24,参考旧系统 ProSchedulingController 报表式列表页)
      { path: 'prod/plan/workOrderList', component: () => __vitePreload(() => import('./WorkOrderList-CX3kcbk-.js'),true              ?__vite__mapDeps([73,1,2,3,9,24,23,70,4,71,13,14,6,67,68,21,22,31,15,17,10,74,20,18,19,35]):void 0), meta: { title: '工单排产·列表', code: 'workOrderList' } },
      { path: 'panelx/list/:panelCode', component: PanelxList, meta: { title: '单据', operationName: '新增流程' } },
      { path: 'panelx/form/:panelCode', component: PanelxForm, meta: { title: '表单' } },
      ...flatMenus()
        .filter((m) => m.path && m.path !== '/dashboard' && m.code !== 'manufactureOrder' && m.code !== 'manufactureBoard' && m.code !== 'reworkDesk' && m.code !== 'solutionCenter' && m.code !== 'orderConvert' && m.code !== 'scheduleBoard' && m.code !== 'workOrderBoard' && m.code !== 'workOrderList' && !m.panelCode)
        .map((m) => ({
          path: m.path.slice(1),
          component: ModuleView,
          meta: { title: m.title, code: m.code },
        })),
    ],
  },
  { path: '/:pathMatch(.*)*', component: () => __vitePreload(() => import('./404-CdwJLEIH.js'),true              ?__vite__mapDeps([75,1,2,3,4,76]):void 0), meta: { title: '404' } },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to) => {
  document.title = `${to.meta.title || ''} · YINJIA-MES`;
  const user = useUserStore();
  if (to.path !== '/login' && !user.isLogin) return '/login'
  if (to.meta.requireAdmin && !user.isAdmin) return '/dashboard'
  if (to.path === '/login' && user.isLogin) return '/dashboard'
  // 我的桌面权限化:无可见权限时落到第一个可见面板(直接敲 /dashboard 也跳走)
  if (to.path === '/dashboard' && user.isLogin && !user.isAdmin
      && !(user.visiblePanels || []).includes('DASHBOARD')) {
    const first = flatMenus().find((m) => m.panelCode && m.path && (user.visiblePanels || []).includes(m.panelCode));
    if (first) return first.path
  }
  return true
});

function unwrap(res) {
  if (!res) return res
  return res.data ?? res
}

function errMsg(e) {
  return e?.response?.data?.message || e?.message || String(e)
}

/**
 * 严格解包:服务端的"body-code"错误(HTTP 200 + code != 200)一律抛出。
 *
 * 为什么需要它(2026-09-22 用户报「无权限面板只显示空表不解释」):
 *   权限拒绝走 AccessDeniedException → GlobalExceptionHandler 归一成 **HTTP 200 + body code 403**
 *   (故意不用 403 状态码 —— 否则前端 axios 拦截器会按"认证失效"把用户登出)。
 *   而 `unwrap` 对这类响应不抛错,返回的是整个 body 对象;列表页 `res.list || []` 拿到空数组,
 *   界面就成了"空表 + 完整工具栏",用户根本看不出是被权限挡住了。
 *
 * 只有"该抛就抛"这一处额外行为,其余语义与 unwrap 完全一致(不改变既有调用方的取值路径)。
 * 抛出的错误带上 code,并伪造 response.data 以便各页统一的 errMsg(e) 取到后端原因。
 */
function unwrapStrict(res) {
  if (res && typeof res === 'object' && res.code != null && res.code !== 200) {
    const e = new Error(res.message || '服务端拒绝了该请求');
    e.code = res.code;
    e.response = { data: res, status: 200 };
    throw e
  }
  return unwrap(res)
}

/**
 * 明细「自动计算」求值器(2026-10-05,采购入库单金额任务)。
 *
 * 后端 `CalcRuleService` 在保存/生单时**用同一份规则**重算派生列(那才是落库真源);
 * 这里负责界面上的即时反馈 —— 改一格立刻看到金额,不用等保存。
 * 两边口径必须逐条一致,**改公式或改守卫时两个文件一起改**:
 *   · 公式语言:字段名即明细行键(永远中文标签,ADR-0001),支持 + - * / ( );
 *   · 缺失入参按 0 参与运算;
 *   · **入参全空则不写入** —— 否则"单价、数量都没填"的行会因为别的格子被改(如备注)
 *     把手工填的金额抹成 0。
 */

/** 数值化(非数字一律 0,与后端 num() 同口径) */
function toNum(value) {
  if (value === undefined || value === null || value === '') return 0
  const n = Number(value);
  return Number.isFinite(n) ? n : 0
}

/** 公式里引用到的字段名(去掉数字字面量) */
function formulaInputs(expr) {
  const tokens = String(expr ?? '').match(/\d+(?:\.\d+)?|[+\-*/()]|[^\s+\-*/()]+/g) || [];
  return [...new Set(tokens.filter((t) => !/^\d+(?:\.\d+)?$/.test(t) && !'+-*/()'.includes(t)))]
}

function isEmptyValue(v) {
  return v === undefined || v === null || String(v).trim() === ''
}

/**
 * 中缀表达式求值(调度场算法;不用 eval/Function,避免动态执行)。
 * @param {string} expr 公式
 * @param {object} vars 变量表(字段名 → 值)
 * @returns {number} 结果;未知变量按 0 计
 */
function evaluateFormula(expr, vars = {}) {
  const tokens = String(expr ?? '').match(/\d+(?:\.\d+)?|[+\-*/()]|[^\s+\-*/()]+/g) || [];
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const out = [];
  const ops = [];
  for (const tk of tokens) {
    if (/^\d+(?:\.\d+)?$/.test(tk)) out.push(parseFloat(tk));
    else if (tk in prec) {
      while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] >= prec[tk]) out.push(ops.pop());
      ops.push(tk);
    } else if (tk === '(') ops.push(tk);
    else if (tk === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop());
      if (ops[ops.length - 1] === '(') ops.pop();
    } else out.push(tk);
  }
  while (ops.length) out.push(ops.pop());

  const stack = [];
  for (const t of out) {
    if (typeof t === 'number') { stack.push(t); continue }
    if (!(t in prec)) { stack.push(toNum(vars[t])); continue }
    const b = stack.pop(); const a = stack.pop();
    if (a === undefined || b === undefined) return 0
    stack.push(t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : b === 0 ? 0 : a / b);
  }
  const value = stack.pop();
  return Number.isFinite(value) ? value : 0
}

/** 财务口径十进制四舍五入 —— 与后端 CalcRuleService.round 逐位一致 */
function roundDecimal(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0
  const factor = 10 ** digits;
  const scaled = number * factor;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  const rounded = scaled >= 0
    ? Math.floor(scaled + 0.5 + tolerance)
    : Math.ceil(scaled - 0.5 - tolerance);
  return rounded / factor
}

/**
 * 就地套用一批规则(规则形态 = 后端 detail.tabs[].calc:{target, formula, round})。
 * @param {Array} rules 规则数组
 * @param {object} row 明细行(键=字段名)
 * @param {object} extraVars 额外变量(如 生产工单的「产品数量」),不写回行
 * @returns {number} 实际写入的规则条数
 */
function applyCalcRules(rules, row, extraVars = {}) {
  if (!Array.isArray(rules) || !rules.length || !row) return 0
  const vars = { ...row, ...extraVars };
  let applied = 0;
  for (const rule of rules) {
    const inputs = formulaInputs(rule.formula);
    if (!inputs.length) continue
    if (inputs.every((name) => isEmptyValue(vars[name]))) continue   // 入参全空 → 不写入
    let value = evaluateFormula(rule.formula, vars);
    if (rule.round != null) value = roundDecimal(value, rule.round);
    row[rule.target] = value;
    vars[rule.target] = value;
    applied++;
  }
  return applied
}

// 数据访问固定为 SQL 后端：/api/px/* -> Spring Boot -> SQL Server HSDZ_MES（YINJIA-MES）。

const APPROVAL_WORKFLOW_ACTIONS = ['提交审批', '审批通过', '审批驳回', '审批情况', '弃审'];
/**
 * 兼容历史面板配置：审批面板只保留一个审批组，主按钮直接提交审批。
 * 后端也会执行同样的归一化，这里兼容数据库中的旧配置。
 */
function normalizeApprovalGroups(rawGroups, forceWorkflow = false) {
  const groups = Array.isArray(rawGroups) ? rawGroups : [];
  const hasWorkflow = forceWorkflow
    || groups.some((group) => (group.actions || group.items || []).includes('提交审批'));
  if (!hasWorkflow) {
    return groups.map((group) => ({
      ...group,
      actions: [...new Set((group.actions || group.items || []).map((action) => (
        action === '驳回审批' ? '审批驳回' : action
      )))],
    }))
  }

  const result = [];
  let approvalGroup = null;
  let insertAt = -1;
  // 审批组归一时保留附加动作(如后端生成的直接「审核」),排在工作流固定动作之后
  const extras = [];
  for (const group of groups) {
    const actions = group.actions || group.items || [];
    const isWorkflowGroup = actions.includes('提交审批')
      || (['审核', '审批', '审批情况', '弃审'].includes(group.name)
        && actions.some((action) => ['审核', ...APPROVAL_WORKFLOW_ACTIONS, '驳回审批'].includes(action)));
    if (isWorkflowGroup) {
      if (insertAt < 0) insertAt = result.length;
      approvalGroup ||= group;
      for (const action of actions) {
        const normalized = action === '驳回审批' ? '审批驳回' : action;
        if (!APPROVAL_WORKFLOW_ACTIONS.includes(normalized) && !extras.includes(normalized)) extras.push(normalized);
      }
      continue
    }
    result.push({
      ...group,
      actions: [...new Set(actions.map((action) => (action === '驳回审批' ? '审批驳回' : action)))],
    });
  }
  result.splice(insertAt < 0 ? result.length : insertAt, 0, {
    ...(approvalGroup || {}),
    name: '审批',
    actions: [...APPROVAL_WORKFLOW_ACTIONS, ...extras],
  });
  return result
}

function normalizeApprovalConfig(config) {
  if (!config?.metadata) return config
  return {
    ...config,
    metadata: {
      ...config.metadata,
      buttonGroups: normalizeApprovalGroups(config.metadata.buttonGroups),
    },
  }
}

function normalizeApprovalPayload(payload) {
  if (!payload) return payload
  return {
    ...payload,
    buttonGroups: normalizeApprovalGroups(payload.buttonGroups),
  }
}

// ==================== 单单据面板（metadata.singleDoc）：参照展平 ====================
// 列表/表单查询返回 1 张单据行（form_no=面板名，明细在 detail.<tabKey>）；
// 参照弹窗需把明细行展平后在前端应用 filter/keyword（单据行顶层无明细字段，后端过滤不到明细）

// ==================== 参照字段：弹窗拉取面板数据（开发约束十一-1） ====================
// 字段约定：{ dataType: '参照', refPanel, refField, displayField, filter, refMap, refMulti, refColumns }
// 交互：点击参照字段 → 弹窗展示 refPanel 面板数据列表 → 勾选行 → 确定导入（值写 refField，refMap 带出其他字段）
// 兼容两种字段形态：原始配置字段（refPanel/refField/...）与 meta 字段的 ref（panel/field/display/...）

function normRef(r) {
  if (!r) return {}
  const src = r.ref && typeof r.ref === 'object' ? r.ref : r;
  return {
    dataType: '参照',
    refPanel: src.panel || src.refPanel,
    refField: src.field || src.refField,
    displayField: src.display || src.displayField,
    filter: src.filter,
    refMap: src.map || src.refMap,
    refMulti: src.multi || src.refMulti,
    refColumns: src.columns || src.refColumns,
  }
}

// ===== 参照面板配置 / 行数 记忆化(2026-09-28 性能修复)=====
// 为什么:参照辅助函数是按**字段**调用的 —— 同一个引用面板会被反复取配置与行数。
//   实测(生产构建)切换 QC_RECV:getPanelConfig 18 次(自身 1 + GFDA 17)、queryFormDataList 35 次,
//   而该面板不同的参照面板只有 1 个 ⇒ 纯浪费,且直接拉长切换耗时(网络相位 ~1s)。
// 失效策略(两级 TTL,不改变"刷新面板即重算"的既有语义):
//   · 参照面板**配置** 5 分钟(结构很少变,缓存的是 Promise 所以并发也只发一次请求);
//   · 参照**行数** 30 秒(数据会变,影响 ≤20 弹窗 / >20 下拉的模式判定);
//   · 需要立即重算时调用 invalidateRefCache()。
const REF_CFG_TTL = 5 * 60 * 1000;
const REF_CNT_TTL = 30 * 1000;
const REF_ROWS_TTL = 30 * 1000;
const refCfgCache = new Map(); // refPanel -> { at, promise }
const refCntCache = new Map();
const refRowsCache = new Map(); // refPanel|filter|keyword|pageSize -> { at, promise }

function memoRef(map, key, ttl, loader) {
  const hit = map.get(key);
  const now = Date.now();
  if (hit && now - hit.at < ttl) return hit.promise
  const promise = loader().catch((e) => {
    map.delete(key); // 失败不缓存,下次重试
    throw e
  });
  map.set(key, { at: now, promise });
  return promise
}

/** 引用面板的配置(按 refPanel 记忆化:同一引用面板在一次切换里只发一次请求) */
function getRefPanelConfig(refPanel) {
  if (!refPanel) return Promise.resolve(null)
  return memoRef(refCfgCache, refPanel, REF_CFG_TTL, () => getPanelConfig(refPanel))
}

/** 清空参照缓存(不传参清全部;面板刷新/字段变更后需要立即重算时调用) */
function invalidateRefCache(refPanel) {
  if (refPanel) {
    refCfgCache.delete(refPanel);
    refCntCache.delete(refPanel);
    for (const k of [...refRowsCache.keys()]) if (k.startsWith(refPanel + '|')) refRowsCache.delete(k);
  } else {
    refCfgCache.clear();
    refCntCache.clear();
    refRowsCache.clear();
  }
}

// 引用面板名称（弹窗标题）：异步取 SQL 后端面板配置
async function refPanelName(field) {
  const r = normRef(field);
  try {
    const cfg = await getRefPanelConfig(r.refPanel);
    return (cfg && cfg.metadata && cfg.metadata.panelName) || r.refPanel
  } catch (e) {
    return r.refPanel
  }
}

// 弹窗表格列：优先字段 refColumns，其次引用面板网格列，最后 refField/displayField
async function refColumns(field) {
  const r = normRef(field);
  if (r.refColumns && r.refColumns.length) return r.refColumns
  let cols = null;
  try {
    const cfg = await getRefPanelConfig(r.refPanel);
    cols = cfg?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns;
  } catch (e) {
    /* SQL 后端无该面板时使用兜底列 */
  }
  if (cols && cols.length) return cols
  return [...new Set([r.refField, r.displayField].filter(Boolean))]
}

// 拉取引用面板数据（SQL 后端）
async function queryRefRows(field, { keyword = '', pageSize = 200 } = {}) {
  const r = normRef(field);
  const filter = r.filter || {};
  const hasAlternativeFilter = Object.values(filter).some(Array.isArray);
  let refConfig = null;
  try {
    refConfig = await getRefPanelConfig(r.refPanel);
  } catch (e) {
    /* 配置不可得时按普通多单据面板查询 */
  }
  const singleDoc = refConfig?.metadata?.singleDoc === true;
  // 单单据面板：condition 不带 filter——单据行顶层无明细字段，后端过滤不到明细；
  // filter/keyword 在展平后的明细行上应用
  const cond = singleDoc || hasAlternativeFilter ? {} : { ...filter };
  // 2026-08-25：参照面板有「审核」流程（单据类面板）时，仅已审核来源单据可选（对齐 T+：已审核才能选择生单）
  if (!cond['单据状态']) {
    try {
      const hasAudit = (refConfig?.metadata?.buttonGroups || []).some((g) =>
        (g.actions || []).some((a) => ['审核', '提交审批'].includes(a)));
      if (hasAudit) cond['单据状态'] = '已审核';
    } catch (e) {
      /* 配置不可得时不强制过滤 */
    }
  }
  // 单单据面板：keyword 也不传后端（单据行无明细字段，后端匹配不到），前端展平后过滤
  // 2026-09-28:按「参照面板 + 条件 + 关键词 + 页大小」记忆化 —— 同一参照面板的多个字段
  //   (如 供应商/供应商代码/供应商名称 同指 GFDA)此前各拉一次明细行,现共用一次结果;
  //   字段之间只是 refField/displayField 映射不同,行数据完全相同。30 秒 TTL。
  const effKeyword = singleDoc ? '' : keyword;
  const rowsKey = `${r.refPanel}|${JSON.stringify(cond)}|${effKeyword}|${pageSize}`;
  const res = await memoRef(refRowsCache, rowsKey, REF_ROWS_TTL, () =>
    queryFormDataList({ panelCode: r.refPanel, condition: cond, keyword: effKeyword, pageNo: 1, pageSize }));
  let list = res.list || [];
  if (singleDoc && list.some((row) => row?.detail)) {
    const tabKey = refConfig?.detail?.tabs?.[0]?.key || 'items';
    list = list.flatMap((doc) => (doc?.detail?.[tabKey] || []).map((row) => (
      r.refPanel === 'INV' ? { 所属类别: doc['类别'] || '', ...row } : row
    )));
    if (keyword) {
      const k = String(keyword).toLowerCase();
      list = list.filter((row) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(k)));
    }
  }
  if (Object.keys(filter).length) {
    list = list.filter((row) => Object.entries(filter).every(([key, expected]) => {
      const candidates = Array.isArray(expected) ? expected : [expected];
      return candidates.some((value) => String(row[key]) === String(value))
    }));
  }
  return list
}

/** 参照面板数据行数(用于动态切换弹窗/下拉模式:≤20 弹窗,>20 下拉)
 *  2026-09-28:按 **refPanel** 记忆化(此前按字段发请求 ⇒ 68 个参照字段同指一面板会发 35 次);
 *  30 秒 TTL,过期即重算,保持"刷新面板后自动切换模式"的既有语义。 */
async function refRowCount(field) {
  const r = normRef(field);
  if (!r.refPanel) return 0
  try {
    return await memoRef(refCntCache, r.refPanel, REF_CNT_TTL, async () => {
      const res = await queryFormDataList({ panelCode: r.refPanel, condition: {}, pageNo: 1, pageSize: 1 });
      return res.totalSize || 0
    })
  } catch (e) {
    return 0
  }
}

/** 参照下拉远程搜索(>20 行时替代弹窗;返回 [{label, value, row}]) */
async function refSelectOptions(field, keyword = '') {
  const r = normRef(field);
  const rows = await queryRefRows(field, { keyword, pageSize: 100 });
  const valueField = r.refField;
  const displayField = r.displayField || r.refField;
  return rows.map((row) => ({
    label: String(row[displayField] ?? ''),
    value: row[valueField] ?? '',
    row,
  }))
}

// SQL 后端返回原始值；这里返回 null 让调用方直接显示该值
function refLabelOf(field, value) {
  if (value === undefined || value === null || value === '') return ''
  return null
}

// 参照字段选项由 SQL 后端 meta 提供，前端不再本地解析
function resolveRefOptions(field) {
  return null
}

// 字段选项统一解析：普通下拉返回原 options
function fieldOptions(field) {
  return field.options || []
}

// ==================== SQL 后端接口 ====================

async function getPanelConfig(panelCode) {
  return normalizeApprovalConfig(unwrap(await request.get('/px/getPanelConfig', { params: { panelCode } })))
}

async function getPermMatrix(panelCode) {
  return unwrap(await request.get('/px/getPermMatrix', { params: { panelCode } }))
}

async function getNewFormPermMatrix({ panelCode, operationName }) {
  return normalizeApprovalPayload(
    unwrap(await request.get('/px/getNewFormPermMatrix', { params: { panelCode, operationName } })),
  )
}

async function getFormDescriptor({ panelCode, code }) {
  // 严格解包:无该面板查看权限时后端返回 HTTP 200 + code 403,必须当错误抛出
  // 才能让表单页出提示,而不是渲染一张空表单(2026-09-22)
  return normalizeApprovalPayload(
    unwrapStrict(await request.get('/px/getFormDescriptor', { params: { panelCode, code } })),
  )
}

async function queryFormDataList(params) {
  // 同上:列表页原先 `res.list || []` 把权限拒绝吃成空表,用户看不到原因
  return unwrapStrict(await request.post('/px/queryFormDataList', params))
}

// ==================== 产品开发下发(2026-09-09) ====================

/** 下游面板元数据(矩阵列头):[{panelCode, panelName}] */
async function rdDevMeta() {
  return unwrap(await request.get('/px/rdDev/meta'))
}

/** 产品信息表侧边栏按钮状态:{ productCode, dispatched, canAssign, l2Approver, assigns } */
async function rdDevButtonState(docNo) {
  return unwrap(await request.get('/px/rdDev/buttonState', { params: { docNo } }))
}

/** 四文件分工状态(分发责任人弹窗回显):{ productCode, dispatched, assigns, assignNames, canAssign } */
async function rdDevAssignState(docNo) {
  return unwrap(await request.get('/px/rdDev/assignState', { params: { docNo } }))
}

/** 启用账号清单(一级通过选二级审核人 / 分发责任人选人):[{username, realName}] */
async function rdDevUsers() {
  return unwrap(await request.get('/px/rdDev/users'))
}

/** 已下发产品的开发矩阵 */
async function rdDevBoard() {
  return unwrap(await request.get('/px/rdDev/board'))
}

/** 参照标注:某面板下这批产品是 未开发 / 已开发 */
async function rdDevAnnotate(panelCode, productCodes) {
  return unwrap(await request.post('/px/rdDev/annotate', { panelCode, productCodes }))
}

/** 规格书两级分发:某产品的分配总览(总负责人弹窗;supervisor/assigns/kinds) */
async function specAssignState(code) {
  return unwrap(await request.get('/px/specAssign', { params: { code } }))
}

/** 规格书两级分发:单张规格书单的分配(编辑闸门;hasAssign=false 不受封锁) */
async function specAssignDoc(no) {
  return unwrap(await request.get('/px/specAssign/doc', { params: { no } }))
}

/** 四个受控文件:我能不能编这张单 { applicable, canEdit, reason, productCode, owner, ownerName }(2026-09-21) */
async function rdDevFileEdit(panelCode, docNo) {
  return unwrap(await request.get('/px/rdDev/fileEdit', { params: { panelCode, docNo } }))
}

/**
 * 按库存状况表口径回填明细现存量：有仓库取仓库库存，无仓库取全部仓库合计。
 * 选择存货后即时调用，避免引用存货档案中的静态值。
 */
async function fillCurrentStock(rows) {
  // YINJIA-MES:HSDZ 字段键(物料代码/物料名称)与 light-mes 键一并识别
  const targets = (Array.isArray(rows) ? rows : [rows]).filter((row) => (
    row && Object.prototype.hasOwnProperty.call(row, '现存量')
      && (row['存货编码'] || row['产品编码'] || row['材料编码'] || row['物料代码']
        || row['存货名称'] || row['产品名称'] || row['材料名称'] || row['物料名称'])
  ));
  if (!targets.length) return 0
  const result = await queryFormDataList({ panelCode: 'STOCK_STATUS', condition: {}, pageNo: 1, pageSize: 500 });
  const stockRows = result.list || [];
  for (const row of targets) {
    const code = String(row['存货编码'] || row['产品编码'] || row['材料编码'] || row['物料代码'] || '').trim();
    const name = String(row['存货名称'] || row['产品名称'] || row['材料名称'] || row['物料名称'] || row['存货'] || '').trim();
    const warehouse = String(row['仓库'] || row['预出仓库'] || row['出库仓库'] || '').trim();
    const quantity = stockRows.reduce((sum, stock) => {
      const stockCode = String(stock['存货编码'] || '').trim();
      const stockName = String(stock['存货'] || '').trim();
      const stockWarehouse = String(stock['仓库'] || '').trim();
      const itemMatches = code ? code === stockCode : name === stockName;
      if (!itemMatches || (warehouse && warehouse !== stockWarehouse)) return sum
      const value = Number(stock['现存量(主)']);
      return sum + (Number.isFinite(value) ? value : 0)
    }, 0);
    row['现存量'] = Math.round(quantity * 100) / 100;
    if (Object.prototype.hasOwnProperty.call(row, '现存量说明')) {
      row['现存量说明'] = warehouse ? `库存状况表（${warehouse}）` : '库存状况表（全部仓库）';
    }
  }
  return targets.length
}

async function callButton({ panelCode, buttonName, formData, buttonParam }) {
  // 按钮名对齐 SQL 后端（中止执行/整单中止→中止、草稿→取消中止、保存类→提交）
  // ⚠ 「保存为草稿」**不在**此列(2026-09-20 修):它必须原样透传给后端,后端 case "保存为草稿"
  //   走 save(markSaved=false) —— 只落库、不归档/不送审、不做必填校验。
  //   此前它和「保存」一起被改写成「提交」⇒ 点「保存为草稿」实际发的是提交请求:
  //   草稿被直接归档/送审,而且缺必填还会被后端挡下(实测:界面点草稿→后端收到 buttonName="提交"→400)。
  const apiName = buttonName === '中止执行' || buttonName === '整单中止' ? '中止'
    : buttonName === '草稿' ? '取消中止'
      : buttonName === '保存' || buttonName === '保存新增' ? '提交'
        : buttonName;
  return unwrap(await request.post('/px/callButton', { panelCode, buttonName: apiName, formData, buttonParam }))
}

async function deleteForms({ panelCode, rowCodes }) {
  return unwrap(await request.post('/px/deleteForms', { panelCode, rowCodes }))
}

/** 表格列自定义:保存排序/栏名/显隐 */
async function saveColumnPrefs({ panelCode, columns }) {
  return unwrap(await request.post('/px/saveColumnPrefs', { panelCode, columns }))
}

/** 表头调整:保存表头字段的排序/栏名/显隐(hidden+visible 同开同关) */
async function saveHeaderPrefs({ panelCode, columns }) {
  return unwrap(await request.post('/px/saveHeaderPrefs', { panelCode, columns }))
}

// ==================== 动态字段(备用列池;规格 docs/design/动态字段扩展-备用列池-V1.0.md) ====================

/** 字段管理总览:现有动态字段 + 备用列池占用/脏行 */
async function extFieldOverview(panelCode) {
  return unwrap(await request.get('/px/extFields', { params: { panel: panelCode } }))
}

/** 绑定新字段到空闲备用列(仅管理员;守卫在后端) */
async function extFieldAdd(payload) {
  return unwrap(await request.post('/px/extField/add', payload))
}

/** 退绑(数据保留,永不 DROP;仅管理员) */
async function extFieldRetire(payload) {
  return unwrap(await request.post('/px/extField/retire', payload))
}

// ==================== 选单流转(对齐 T+ SelectVoucher;占用跟踪 form_flow_link) ====================

/** 选单来源查询:已审核 + 未被占用行(带 _lineKey/剩余数量) */
async function outsourceFlowSources({ sourcePanel, targetPanel, sourceKey, businessType = '', condition = {}, pageNo = 1, pageSize = 20 }) {
  return unwrap(await request.post('/px/voucherFlow/sources', { sourcePanel, targetPanel, sourceKey, businessType, condition, pageNo, pageSize }))
}

/** 采购流选单来源(与选单来源同服务,统一占用语义) */
async function purchaseFlowSources(payload) {
  return outsourceFlowSources(payload)
}

/** 选单生单后写占用(来源行不再出现在选单列表;删除下游草稿自动释放) */
async function linkOutsourceSelection(payload) {
  return unwrap(await request.post('/px/voucherFlow/link', payload))
}

/** 分批送料:行状态(订单量/已送/已退回/剩余/可送上限 + 下一批次号 + 已有批次清单) */
async function batchFlowLines(payload) {
  return unwrap(await request.post('/px/batchFlow/lines', payload))
}

/** 分批送料:按行本次数量生成一张下游草稿(自动取批次号 + 按量占用 + 批次台账) */
async function batchFlowGenerate(payload) {
  return unwrap(await request.post('/px/batchFlow/generate', payload))
}

/** 分批送料:按批次号反查(台账 + 上下游 link) */
async function batchFlowBatch(batchNo) {
  return unwrap(await request.get('/px/batchFlow/batch', { params: { batchNo } }))
}

/* ── 采购订单材料码打印(供应商自行打码,2026-10-04):批次号在**打印时**登记并预约该行数量 ── */

/** 打印弹窗取数:订单行(含可打印量)+ 预填批次号(与生单同公式)+ 本订单已有打印记录 */
async function puLabelDialog(orderNo) {
  return unwrap(await request.get('/px/puLabel/dialog', { params: { orderNo } }))
}

/** 登记打印:**一次可勾多行,服务端每行各出一张打印单**(单号列表见 单据编号列表) */
async function puLabelPrint(payload) {
  return unwrap(await request.post('/px/puLabel/print', payload))
}

/** 重打:同一张打印单原样再打一遍(只累加 打印次数,不新增预约 —— 一次一行后由它承担"重打不重复占量") */
async function puLabelReprint(docNo) {
  return unwrap(await request.post('/px/puLabel/reprint', { docNo }))
}

/** 该单据的批次号是否因"来自材料码打印明细"而**不可修改**(含草稿态;前端据此把单头批次号渲染成只读) */
async function puLabelBatchLock(panelCode, docNo) {
  return unwrap(await request.get('/px/puLabel/batchLock', { params: { panelCode, docNo } }))
}

/** 作废打印记录(软删):预约量立即释放回余量 */
async function puLabelVoid(docNo) {
  return unwrap(await request.post('/px/puLabel/void', { docNo }))
}

/** 保存「收料超送比例」(生单对话框改动即自动保存):落系统参数 receive_over_ratio,传 0~1 小数 */
async function batchFlowSaveOverRatio(overRatio) {
  return unwrap(await request.post('/px/batchFlow/overRatio', { overRatio }))
}


/**
 * Upload a voucher image to the MES backend. The backend owns the cloud OCR
 * credentials and returns schema-whitelisted form data for user confirmation.
 */
async function recognizeFormImage({ panelCode, image }) {
  const body = new FormData();
  body.append('panelCode', panelCode);
  body.append('image', image, image.name || 'voucher.jpg');
  const response = await request.post('/ocr/scan-form', body, { timeout: 60000 });
  if (response?.code && response.code !== 200) {
    throw new Error(response.message || 'OCR 识别失败')
  }
  return unwrap(response)
}

// ==================== 专属视图数据（生产看板 / 返修工作台） ====================
// SQL 数据接口尚未实现，页面显示未接入提示
function getProdBoard() {
  return null
}

function getReworkTasks() {
  return []
}

function reworkAction(row, action) {
  return false
}

// 工具栏快捷键提示（对齐真实 T+ 按钮）
const SHORTCUTS = {
  保存: 'Alt+S',
  保存新增: 'Alt+\\',
  保存打印: 'Alt+G',
  直接打印: 'Alt+P',
  打印: 'Alt+;',
  预览: 'Alt+/',
  打印模板设置: 'Alt+,',
  导出: 'Alt+X',
  放弃: 'Alt+Z',
};

const sqlPanelRuntime = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  SHORTCUTS,
  batchFlowBatch,
  batchFlowGenerate,
  batchFlowLines,
  batchFlowSaveOverRatio,
  callButton,
  deleteForms,
  errMsg,
  extFieldAdd,
  extFieldOverview,
  extFieldRetire,
  fieldOptions,
  fillCurrentStock,
  getFormDescriptor,
  getNewFormPermMatrix,
  getPanelConfig,
  getPermMatrix,
  getProdBoard,
  getRefPanelConfig,
  getReworkTasks,
  invalidateRefCache,
  linkOutsourceSelection,
  normalizeApprovalGroups,
  outsourceFlowSources,
  puLabelBatchLock,
  puLabelDialog,
  puLabelPrint,
  puLabelReprint,
  puLabelVoid,
  purchaseFlowSources,
  queryFormDataList,
  queryRefRows,
  rdDevAnnotate,
  rdDevAssignState,
  rdDevBoard,
  rdDevButtonState,
  rdDevFileEdit,
  rdDevMeta,
  rdDevUsers,
  recognizeFormImage,
  refColumns,
  refLabelOf,
  refPanelName,
  refRowCount,
  refSelectOptions,
  resolveRefOptions,
  reworkAction,
  roundDecimal,
  saveColumnPrefs,
  saveHeaderPrefs,
  specAssignDoc,
  specAssignState,
  unwrap,
  unwrapStrict
}, Symbol.toStringTag, { value: 'Module' }));

const REQUIRED_METHODS = [
  'getPanelConfig',
  'getPermMatrix',
  'getNewFormPermMatrix',
  'getFormDescriptor',
  'queryFormDataList',
  'callButton',
  'deleteForms',
  'recognizeFormImage',
  'queryRefRows',
  'refPanelName',
  'refColumns',
  'refLabelOf',
  'fieldOptions',
  'fillCurrentStock',
  'roundDecimal',
  'errMsg',
];

let activeRuntime = null;

/**
 * Register the application adapter used by the reusable panel views.
 * MES and PLM can provide different adapters while sharing the same renderer.
 */
function installPanelRuntime(runtime) {
  if (!runtime || typeof runtime !== 'object') {
    throw new TypeError('Panel runtime must be an object')
  }
  const missing = REQUIRED_METHODS.filter((name) => typeof runtime[name] !== 'function');
  if (missing.length) {
    throw new TypeError(`Panel runtime is missing: ${missing.join(', ')}`)
  }
  activeRuntime = Object.freeze({ ...runtime });
  return activeRuntime
}

function usePanelRuntime() {
  if (!activeRuntime) {
    throw new Error('Panel runtime has not been installed')
  }
  return activeRuntime
}

const app = createApp(_sfc_main);

installPanelRuntime(sqlPanelRuntime);

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(createPinia());
app.use(router);
app.use(i18n);
app.use(ElLoading);

// 应用启动时把检测到的 locale 应用到 i18n 与 <html lang>;
// 拉取动态语言列表(yj_locale 注册表);外语缺失词典(翻译表/机翻)后台补齐
// (静态包词条挂载即生效,机翻补缺的零星词条下次刷新生效——翻译表已缓存)。
const localeStore = useLocaleStore()
// 语言包按需加载:启动 locale 可能来自 localStorage/浏览器探测(非中文),
// 先取包再挂载,首屏无中文闪烁(zh-CN 恒驻零开销;动态语言无包时空手而归走机翻)。
// 注:async IIFE 而非顶层 await —— vite 默认 target(es2020)不支持 TLA(实测报错)。
;(async () => {
  await ensureLocalePack(i18n.global.locale.value);
  // tt() 渲染 miss 的键 → 批量调词器(翻译表命中或机翻)→ merge → 重渲(light-mes 同款自动机翻)
  registerDictFetcher((locale, keys) => localeStore.ensureDict(locale, keys));
  localeStore.apply();
  localeStore.loadAvailable();
  app.mount('#app');
})();

export { __vitePreload as _, extFieldOverview as a, extFieldAdd as b, useUserStore as c, applyCalcRules as d, extFieldRetire as e, callButton as f, errMsg as g, useLocaleStore as h, apiGetMessages as i, apiGetNotices as j, apiGetBadge as k, apiReadAllMessages as l, apiReadMessage as m, needsRelogin as n, flatMenus as o, filterMenuTree as p, menuTree as q, request as r, findMenuByPath as s, tt as t, usePanelRuntime as u, getProdBoard as v, getReworkTasks as w };
