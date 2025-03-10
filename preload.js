const { contextBridge, ipcRenderer } = require('electron');

// Настраиваем получение событий из main процесса
const validEvents = ['page-loaded', 'tab-changed', 'tab-created', 'download-created', 'download-updated', 'download-done', 'download-failed'];

// Экспортируем API в окно рендеринга
contextBridge.exposeInMainWorld('electronAPI', {
  // Методы навигации
  navigate: (url) => ipcRenderer.invoke('navigate', url),
  goBack: () => ipcRenderer.invoke('go-back'),
  goForward: () => ipcRenderer.invoke('go-forward'),
  refresh: () => ipcRenderer.invoke('refresh'),
  getUrl: () => ipcRenderer.invoke('get-url'),
  checkNavigation: () => ipcRenderer.invoke('check-navigation'),
  getDefaultSearch: () => ipcRenderer.invoke('get-default-search'),
  
  // Методы для работы с приложением
  toggleDarkMode: () => ipcRenderer.invoke('toggle-dark-mode'),
  toggleFocusMode: () => ipcRenderer.invoke('toggle-focus-mode'),
  toggleSidebar: () => ipcRenderer.invoke('toggle-sidebar'),
  
  // Методы для настройки тем и цветов
  getCustomTheme: () => ipcRenderer.invoke('get-custom-theme'),
  toggleCustomTheme: (enabled) => ipcRenderer.invoke('toggle-custom-theme', enabled),
  updateCustomTheme: (theme) => ipcRenderer.invoke('update-custom-theme', theme),
  resetCustomTheme: () => ipcRenderer.invoke('reset-custom-theme'),
  
  // Методы для работы с закладками
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  addBookmark: (bookmark) => ipcRenderer.invoke('add-bookmark', bookmark),
  removeBookmark: (url) => ipcRenderer.invoke('remove-bookmark', url),
  
  // Методы для работы с вкладками
  openTab: (url) => ipcRenderer.invoke('open-tab', url),
  closeTab: (tabId) => ipcRenderer.invoke('close-tab', tabId),
  switchTab: (tabId) => ipcRenderer.invoke('switch-tab', tabId),
  getTabs: () => ipcRenderer.invoke('get-tabs'),
  reorderTabs: (fromIndex, toIndex) => ipcRenderer.invoke('reorder-tabs', fromIndex, toIndex),
  
  // Методы блокировки рекламы
  toggleAdBlock: () => ipcRenderer.invoke('toggle-ad-block'),
  updateAdBlockRules: () => ipcRenderer.invoke('update-ad-block-rules'),
  
  // Методы для режима чтения
  getPageHtml: () => ipcRenderer.invoke('get-page-html'),
  saveReaderSettings: (settings) => ipcRenderer.invoke('save-reader-settings', settings),
  getReaderSettings: () => ipcRenderer.invoke('get-reader-settings'),
  enterReaderMode: () => ipcRenderer.invoke('enter-reader-mode'),
  exitReaderMode: () => ipcRenderer.invoke('exit-reader-mode'),
  getReaderContent: (contentId) => ipcRenderer.invoke('get-reader-content', contentId),
  
  // Получение состояния приложения
  getAppState: () => ipcRenderer.invoke('get-app-state'),
  
  // Стартовая страница
  getDarkMode: () => ipcRenderer.invoke('get-dark-mode'),
  getTopSites: () => ipcRenderer.invoke('get-top-sites'),
  getRecentHistory: () => ipcRenderer.invoke('get-recent-history'),
  navigateFromStartPage: (query) => ipcRenderer.invoke('navigate-from-start-page', query),
  
  // Переводчик
  translateText: (text, targetLang) => ipcRenderer.invoke('translate-text', text, targetLang),
  getTranslationLanguages: () => ipcRenderer.invoke('get-translation-languages'),
  
  // Управление загрузками
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  pauseDownload: (id) => ipcRenderer.invoke('pause-download', id),
  resumeDownload: (id) => ipcRenderer.invoke('resume-download', id),
  cancelDownload: (id) => ipcRenderer.invoke('cancel-download', id),
  openDownloadFolder: (path) => ipcRenderer.invoke('open-download-folder', path),
  toggleDownloadsPanel: (isVisible) => ipcRenderer.invoke('toggle-downloads-panel', isVisible),
  getDownloadsPanelVisible: () => ipcRenderer.invoke('get-downloads-panel-visible'),
  
  // Подписка на события загрузок
  onDownloadStarted: (callback) => ipcRenderer.on('download-started', callback),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
  onDownloadCompleted: (callback) => ipcRenderer.on('download-completed', callback),
  onDownloadCancelled: (callback) => ipcRenderer.on('download-cancelled', callback),
  onDownloadFailed: (callback) => ipcRenderer.on('download-failed', callback),
  
  // Подписка на события из main процесса
  on: (channel, callback) => {
    if (validEvents.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
  },
  
  // Методы для работы с историей
  searchHistory: (query) => ipcRenderer.invoke('search-history', query),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  clearHistoryPeriod: (period) => ipcRenderer.invoke('clear-history-period', period),
  deleteHistoryItem: (url) => ipcRenderer.invoke('delete-history-item', url),
  openHistoryPage: () => ipcRenderer.invoke('open-history-page'),
}); 