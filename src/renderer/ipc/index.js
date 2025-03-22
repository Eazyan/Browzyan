const { ipcRenderer, contextBridge } = require('electron');

// Объект для API вкладок
const tabsAPI = {
  // Создание новой вкладки
  create: (url) => ipcRenderer.invoke('tabs:create', url),
  
  // Закрытие вкладки
  close: (tabId) => ipcRenderer.invoke('tabs:close', tabId),
  
  // Навигация по URL
  navigate: (url) => ipcRenderer.invoke('tabs:navigate', url),
  
  // Переключение на вкладку
  switch: (tabId) => ipcRenderer.invoke('tabs:switch', tabId),
  
  // Обновление вкладки
  reload: (tabId) => ipcRenderer.invoke('tabs:reload', tabId),
  
  // Получение всех вкладок
  getAll: () => ipcRenderer.invoke('tabs:get-all')
};

// Объект для API блокировки рекламы
const adblockAPI = {
  // Проверка, блокируется ли URL
  shouldBlock: (url) => ipcRenderer.invoke('adblock:should-block', url),
  
  // Обновление фильтров
  updateFilters: () => ipcRenderer.invoke('adblock:update-filters'),
  
  // Получение статистики блокировки
  getStats: () => ipcRenderer.invoke('adblock:get-stats')
};

// Объект для API истории
const historyAPI = {
  // Добавление записи в историю
  add: (url, title) => ipcRenderer.invoke('history:add', url, title),
  
  // Поиск в истории
  search: (query) => ipcRenderer.invoke('history:search', query),
  
  // Удаление записи из истории
  delete: (url) => ipcRenderer.invoke('history:delete', url),
  
  // Очистка истории
  clear: () => ipcRenderer.invoke('history:clear'),
  
  // Получение часто посещаемых сайтов
  getTopSites: () => ipcRenderer.invoke('history:get-top-sites')
};

// Объект для API закладок
const bookmarksAPI = {
  // Получение всех закладок
  getAll: () => ipcRenderer.invoke('bookmarks:get-all'),
  
  // Добавление закладки
  add: (url, title, favicon) => ipcRenderer.invoke('bookmarks:add', url, title, favicon),
  
  // Удаление закладки
  remove: (url) => ipcRenderer.invoke('bookmarks:remove', url),
  
  // Проверка, добавлен ли URL в закладки
  check: (url) => ipcRenderer.invoke('bookmarks:check', url)
};

// Объект для API режима чтения
const readerAPI = {
  // Получение настроек режима чтения
  getSettings: () => ipcRenderer.invoke('reader:get-settings'),
  
  // Сохранение настроек режима чтения
  saveSettings: (settings) => ipcRenderer.invoke('reader:save-settings', settings),
  
  // Получение содержимого для режима чтения
  getContent: (contentId) => ipcRenderer.invoke('reader:get-content', contentId)
};

// Объект для API перевода
const translateAPI = {
  // Перевод текста
  text: (text, fromLang, toLang) => ipcRenderer.invoke('translate:text', text, fromLang, toLang),
  
  // Получение списка поддерживаемых языков
  getLanguages: () => ipcRenderer.invoke('translate:get-languages'),
  
  // Очистка кэша переводов
  clearCache: () => ipcRenderer.invoke('translate:clear-cache')
};

// Объект для API тем
const themeAPI = {
  // Получение текущей темы
  getCurrent: () => ipcRenderer.invoke('theme:get-current'),
  
  // Установка темы
  set: (themeName) => ipcRenderer.invoke('theme:set', themeName),
  
  // Переключение темного режима
  toggleDark: () => ipcRenderer.invoke('theme:toggle-dark'),
  
  // Получение доступных тем
  getAvailable: () => ipcRenderer.invoke('theme:get-available')
};

// Объект для API хранилища
const storageAPI = {
  // Получение значения
  get: (key) => ipcRenderer.invoke('storage:get', key),
  
  // Установка значения
  set: (key, value) => ipcRenderer.invoke('storage:set', key, value)
};

// Объект для API диалогов
const dialogAPI = {
  // Показать диалог открытия файла
  openFile: (options) => ipcRenderer.invoke('dialog:open-file', options),
  
  // Показать диалог сохранения файла
  saveFile: (options) => ipcRenderer.invoke('dialog:save-file', options),
  
  // Показать диалог с сообщением
  message: (options) => ipcRenderer.invoke('dialog:message', options)
};

// Объект для событий IPC
const ipcEvents = {
  // Подписка на событие
  on: (channel, listener) => {
    // Валидация названия канала
    if (typeof channel !== 'string' || !channel.startsWith('app:')) {
      throw new Error('Недопустимое название канала');
    }
    
    const subscription = (event, ...args) => listener(...args);
    ipcRenderer.on(channel, subscription);
    
    // Возвращаем функцию для отписки
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  
  // Отправка события
  send: (channel, ...args) => {
    // Валидация названия канала
    if (typeof channel !== 'string' || !channel.startsWith('app:')) {
      throw new Error('Недопустимое название канала');
    }
    
    ipcRenderer.send(channel, ...args);
  }
};

// Экспорт API через contextBridge
try {
  // API для приложения
  contextBridge.exposeInMainWorld('api', {
    tabs: tabsAPI,
    adblock: adblockAPI,
    history: historyAPI,
    bookmarks: bookmarksAPI,
    reader: readerAPI,
    translate: translateAPI,
    theme: themeAPI,
    storage: storageAPI,
    dialog: dialogAPI,
    ipc: ipcEvents
  });
  
  console.log('API успешно экспортировано в рендерер');
} catch (error) {
  console.error('Ошибка при экспорте API:', error);
}

// Экспорт для использования в preload скрипте
module.exports = {
  tabsAPI,
  adblockAPI,
  historyAPI,
  bookmarksAPI,
  readerAPI,
  translateAPI,
  themeAPI,
  storageAPI,
  dialogAPI,
  ipcEvents
}; 