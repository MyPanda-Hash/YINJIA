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
  'extFieldOverview',
  'extFieldAdd',
  'extFieldRetire',
  'printPuOrder',
  'printPuOrderNoAmount',
  'printQcReturn',
  'printProductCards',
  'printLocationCards',
  'printProductionTask',
  'woQrText',
]

/**
 * shell-level dependencies (accounts/tabs/locale), injected separately from panelRuntime:
 * panelRuntime is meant to stay a **data adapter**; pinia stores are application shell state,
 * and merging them in would force every adapter (including tests) to install UI state for no reason.
 */
let appContext = null

/** Register the shell context; core views read it through useAppContext(). */
export function installAppContext(context) {
  if (!context || typeof context !== 'object') {
    throw new TypeError('App context must be an object')
  }
  appContext = Object.freeze({ ...context })
  return appContext
}

export function useAppContext() {
  if (!appContext) {
    throw new Error('App context has not been installed')
  }
  return appContext
}

let activeRuntime = null

/**
 * Register the application adapter used by the reusable panel views.
 * MES and PLM can provide different adapters while sharing the same renderer.
 */
export function installPanelRuntime(runtime) {
  if (!runtime || typeof runtime !== 'object') {
    throw new TypeError('Panel runtime must be an object')
  }
  const missing = REQUIRED_METHODS.filter((name) => typeof runtime[name] !== 'function')
  if (missing.length) {
    throw new TypeError(`Panel runtime is missing: ${missing.join(', ')}`)
  }
  activeRuntime = Object.freeze({ ...runtime })
  return activeRuntime
}

export function usePanelRuntime() {
  if (!activeRuntime) {
    throw new Error('Panel runtime has not been installed')
  }
  return activeRuntime
}

export const PANEL_RUNTIME_METHODS = Object.freeze([...REQUIRED_METHODS])
