import React, { createContext, useContext, useState, useEffect } from 'react'

type Language = 'en' | 'zh'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const translations = {
  en: {
    // 通用
    waiting: 'Waiting...',
    
    // CaseRunner 相关
    start: 'Start',
    stop: 'Stop',
    download: 'Download',
    upload: 'Upload',
    
    // CaseConfig 相关
    singleTest: 'Single Test',
    continuousTest: 'Continuous Test',
    bytePerSecond: 'Byte per second',
    bitPerSecond: 'Bit per second',
    advancedConfig: 'Advanced Config',
    normalConfig: 'Normal Config',
    duration: 'Duration',
    seconds: 's',
    speedRange: 'Speed Range',
    speedRangeHelper: 'Low speed mode will not stress system resources; high speed mode will maximize system resources',
    lowSpeed: 'Low Speed (typically < 2.5G)',
    highSpeed: 'High Speed (typically > 2.5G)',
    threadCount: 'Thread Count',
    threadCountHelper: 'Number of Worker threads. Generally 3 is enough for 10G network testing. In low speed mode, default is 1; in high speed mode, default is CPU cores - 1',
    packCount: 'Pack Count',
    packCountHelper: 'Controls the data size per request',
    parallel: 'Parallel',
    parallelHelper: 'Number of parallel connections. 3 is recommended, set to 1 for single-thread testing',
    
    // RunCaseOnce 相关
    ping: 'Ping',
    pinging: 'Pinging',
    downloading: 'Downloading',
    uploading: 'Uploading',
    restart: 'Restart',
    errorMessage: 'Error, Please check environment',
    
    // Footer 相关
    footer: 'Test results only represent the actual data achievable under current device performance, have no theoretical reference value, and cannot be used as theoretical link data.',
  },
  zh: {
    // 通用
    waiting: '等待中...',
    
    // CaseRunner 相关
    start: '开始',
    stop: '停止',
    download: '下载',
    upload: '上传',
    
    // CaseConfig 相关
    singleTest: '单次测速',
    continuousTest: '持续压测',
    bytePerSecond: '字节每秒',
    bitPerSecond: '比特每秒',
    advancedConfig: '高级配置',
    normalConfig: '普通配置',
    duration: '测速持续时间',
    seconds: '秒',
    speedRange: '测速速度范围',
    speedRangeHelper: '低速模式下不会压榨系统资源；高速模式下会尽力压榨系统资源',
    lowSpeed: '低速 (通常网络小于 2.5G)',
    highSpeed: '高速 (通常网络大于 2.5G)',
    threadCount: '线程数',
    threadCountHelper: '测速 Worker 数量，根据你的机器性能适当选择。一般来说 3 个足够满足万兆网络测速。低速模式下，默认为 1 个，高速模式下，默认为系统逻辑处理器数量 - 1',
    packCount: '数据包大小',
    packCountHelper: '控制单次请求下载或上传的数据大小',
    parallel: '并行数量',
    parallelHelper: '并行数量，推荐 3 个，如果想要测试单线程，可以调整为 1',
    
    // RunCaseOnce 相关
    ping: '延迟',
    pinging: '延迟测试中',
    downloading: '下载测试中',
    uploading: '上传测试中',
    restart: '重新测试',
    errorMessage: '错误，请检查环境',
    
    // Footer 相关
    footer: '测试结果通常只能代表当前设备性能下所能跑到的实际数据，没有任何理论参考价值，不能作为链路理论数据使用。',
  }
}

const detectBrowserLanguage = (): Language => {
  const browserLang = navigator.language.toLowerCase()
  
  if (browserLang.startsWith('zh')) {
    return 'zh'
  }
  return 'zh'
}

const getSavedLanguage = (): Language | null => {
  try {
    const saved = localStorage.getItem('preferred-language')
    if (saved === 'en' || saved === 'zh') {
      return saved
    }
  } catch (e) {
  }
  return null
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = getSavedLanguage()
    if (saved) {
      return saved
    }
    return detectBrowserLanguage()
  })

  useEffect(() => {
    try {
      localStorage.setItem('preferred-language', language)
    } catch (e) {
    }
  }, [language])

  const t = (key: string): string => {
    return translations[language][key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
