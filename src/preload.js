// preload.js - Предзагрузочный скрипт для безопасного соединения между процессами

const { contextBridge, ipcRenderer } = require('electron');

// Отладочная информация
console.log('Загрузка preload.js...');

// Определяем API, которое будет доступно в рендерере
contextBridge.exposeInMainWorld('browzyanAPI', {
    // API вкладок
    tabs: {
        // Получить все вкладки
        getAllTabs: () => ipcRenderer.invoke('tabs:getAll'),
        
        // Получить активную вкладку
        getActiveTab: () => ipcRenderer.invoke('tabs:getActive'),
        
        // Получить конкретную вкладку по id
        getTab: (tabId) => ipcRenderer.invoke('tabs:get', tabId),
        
        // Создать новую вкладку
        createTab: (url) => {
            console.log('Вызов createTab с URL:', url);
            return ipcRenderer.invoke('tabs:create', url);
        },
        
        // Активировать вкладку
        activateTab: (tabId) => ipcRenderer.invoke('tabs:activate', tabId),
        
        // Закрыть вкладку
        closeTab: (tabId) => ipcRenderer.invoke('tabs:close', tabId),
        
        // Обновить вкладку
        updateTab: (tabId, updateProperties) => ipcRenderer.invoke('tabs:update', tabId, updateProperties),
        
        // События вкладок - важно для коммуникации между main и renderer
        onCreated: (callback) => {
            const handler = (event, tab) => callback(tab);
            ipcRenderer.on('tabs:created', handler);
            return () => ipcRenderer.removeListener('tabs:created', handler);
        },
        onUpdated: (callback) => {
            const handler = (event, tabId, changeInfo) => callback(tabId, changeInfo);
            ipcRenderer.on('tabs:updated', handler);
            return () => ipcRenderer.removeListener('tabs:updated', handler);
        },
        onRemoved: (callback) => {
            const handler = (event, tabId) => callback(tabId);
            ipcRenderer.on('tabs:removed', handler);
            return () => ipcRenderer.removeListener('tabs:removed', handler);
        },
        onActivated: (callback) => {
            const handler = (event, tabId) => callback(tabId);
            ipcRenderer.on('tabs:activated', handler);
            return () => ipcRenderer.removeListener('tabs:activated', handler);
        }
    },
    
    // API навигации
    navigation: {
        // Навигация по URL
        navigateTo: (url) => ipcRenderer.invoke('navigation:navigateTo', url),
        
        // Перейти назад
        goBack: () => ipcRenderer.invoke('navigation:goBack'),
        
        // Перейти вперёд
        goForward: () => ipcRenderer.invoke('navigation:goForward'),
        
        // Перезагрузить страницу
        reload: () => ipcRenderer.invoke('navigation:reload'),
        
        // Остановить загрузку
        stop: () => ipcRenderer.invoke('navigation:stop'),
        
        // События навигации
        onNavigationStateChanged: (callback) => 
            ipcRenderer.on('navigation:stateChanged', (event, tabId, canGoBack, canGoForward) => 
                callback(tabId, canGoBack, canGoForward))
    },
    
    // API истории
    history: {
        // Получить историю
        getHistory: () => ipcRenderer.invoke('history:get'),
        
        // Поиск в истории
        searchHistory: (query) => ipcRenderer.invoke('history:search', query),
        
        // Удалить элемент истории
        deleteHistoryItem: (url) => ipcRenderer.invoke('history:deleteItem', url),
        
        // Очистить историю
        clearHistory: () => ipcRenderer.invoke('history:clear'),
        
        // Очистить историю за определенный период
        clearHistoryPeriod: (period) => ipcRenderer.invoke('history:clearPeriod', period),
        
        // Получить часто посещаемые сайты
        getTopSites: () => ipcRenderer.invoke('history:getTopSites')
    },
    
    // API загрузок
    downloads: {
        // Получить все загрузки
        getAllDownloads: () => ipcRenderer.invoke('downloads:getAll'),
        
        // Получить конкретную загрузку
        getDownload: (downloadId) => ipcRenderer.invoke('downloads:get', downloadId),
        
        // Приостановить загрузку
        pauseDownload: (downloadId) => ipcRenderer.invoke('downloads:pause', downloadId),
        
        // Возобновить загрузку
        resumeDownload: (downloadId) => ipcRenderer.invoke('downloads:resume', downloadId),
        
        // Отменить загрузку
        cancelDownload: (downloadId) => ipcRenderer.invoke('downloads:cancel', downloadId),
        
        // Открыть файл
        openDownload: (downloadId) => ipcRenderer.invoke('downloads:open', downloadId),
        
        // Показать файл в папке
        showDownloadInFolder: (downloadId) => ipcRenderer.invoke('downloads:showInFolder', downloadId),
        
        // События загрузок
        onCreated: (callback) => ipcRenderer.on('downloads:created', (event, downloadItem) => callback(downloadItem)),
        onUpdated: (callback) => ipcRenderer.on('downloads:updated', (event, downloadId, changeInfo) => callback(downloadId, changeInfo))
    },
    
    // API закладок
    bookmarks: {
        // Получить все закладки
        getBookmarks: () => ipcRenderer.invoke('bookmarks:getAll'),
        
        // Добавить закладку
        addBookmark: (bookmark) => ipcRenderer.invoke('bookmarks:add', bookmark),
        
        // Удалить закладку
        removeBookmark: (url) => ipcRenderer.invoke('bookmarks:remove', url),
        
        // Проверить, есть ли закладка
        isBookmarked: (url) => ipcRenderer.invoke('bookmarks:isBookmarked', url),
        
        // Получить закладку по URL
        getBookmark: (url) => ipcRenderer.invoke('bookmarks:get', url)
    },
    
    // API блокировки рекламы
    adblock: {
        // Получить статус блокировки рекламы
        getStatus: () => ipcRenderer.invoke('adblock:getStatus'),
        
        // Включить/выключить блокировку рекламы
        toggleStatus: () => ipcRenderer.invoke('adblock:toggleStatus'),
        
        // Получить статистику заблокированных элементов
        getStats: () => ipcRenderer.invoke('adblock:getStats'),
        
        // Добавить URL в белый список
        addToWhitelist: (url) => ipcRenderer.invoke('adblock:addToWhitelist', url),
        
        // Удалить URL из белого списка
        removeFromWhitelist: (url) => ipcRenderer.invoke('adblock:removeFromWhitelist', url),
        
        // Проверить, находится ли URL в белом списке
        isWhitelisted: (url) => ipcRenderer.invoke('adblock:isWhitelisted', url)
    },
    
    // API режима чтения
    reader: {
        // Включить режим чтения
        enableReaderMode: (tabId) => ipcRenderer.invoke('reader:enable', tabId),
        
        // Выключить режим чтения
        disableReaderMode: (tabId) => ipcRenderer.invoke('reader:disable', tabId),
        
        // Получить настройки режима чтения
        getReaderSettings: () => ipcRenderer.invoke('reader:getSettings'),
        
        // Установить настройки режима чтения
        setReaderSettings: (settings) => ipcRenderer.invoke('reader:setSettings', settings)
    },
    
    // API темы
    theme: {
        // Получить текущую тему
        getTheme: () => ipcRenderer.invoke('theme:get'),
        
        // Установить тему
        setTheme: (theme) => ipcRenderer.invoke('theme:set', theme),
        
        // Получить список доступных тем
        getAvailableThemes: () => ipcRenderer.invoke('theme:getAvailable')
    },
    
    // API перевода
    translate: {
        // Перевести текст
        translateText: (text, targetLang) => ipcRenderer.invoke('translate:text', text, targetLang),
        
        // Перевести страницу
        translatePage: (tabId, targetLang) => ipcRenderer.invoke('translate:page', tabId, targetLang),
        
        // Определить язык текста
        detectLanguage: (text) => ipcRenderer.invoke('translate:detectLanguage', text),
        
        // Получить доступные языки для перевода
        getAvailableLanguages: () => ipcRenderer.invoke('translate:getLanguages')
    },
    
    // API настроек
    settings: {
        // Получить все настройки
        getAll: () => ipcRenderer.invoke('settings:getAll'),
        
        // Получить конкретную настройку
        get: (key) => ipcRenderer.invoke('settings:get', key),
        
        // Установить настройку
        set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
        
        // Сбросить настройки к значениям по умолчанию
        reset: () => ipcRenderer.invoke('settings:reset'),
        
        // События настроек
        onChanged: (callback) => ipcRenderer.on('settings:changed', (event, key, value) => callback(key, value))
    }
});

// Также экспортируем electron API для обратной совместимости
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        on: (channel, callback) => {
            const validChannels = ['tab-created', 'tab-changed', 'download-started', 'download-progress', 
                                   'download-completed', 'download-cancelled', 'download-failed'];
            if (validChannels.includes(channel)) {
                const handler = (event, ...args) => callback(event, ...args);
                ipcRenderer.on(channel, handler);
                return () => ipcRenderer.removeListener(channel, handler);
            }
        },
        send: (channel, ...args) => {
            const validChannels = ['create-tab', 'close-tab', 'switch-tab'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, ...args);
            }
        },
        invoke: (channel, ...args) => {
            const validChannels = ['tabs:create', 'tabs:activate', 'tabs:close'];
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, ...args);
            }
            return Promise.reject(new Error(`Channel ${channel} is not allowed`));
        }
    }
});

// Логирование загрузки preload скрипта
console.log('Preload script загружен');

// Слушатель для логирования ошибок из основного процесса
ipcRenderer.on('log', (event, level, message) => {
    switch (level) {
        case 'info':
            console.info(message);
            break;
        case 'warn':
            console.warn(message);
            break;
        case 'error':
            console.error(message);
            break;
        default:
            console.log(message);
    }
}); 