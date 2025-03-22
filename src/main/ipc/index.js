const { ipcMain, dialog } = require('electron');
const tabs = require('../services/tabs');
const adblock = require('../services/adblock');
const history = require('../services/history');
const bookmarks = require('../services/bookmarks');
const reader = require('../services/reader');
const translate = require('../services/translate');
const theme = require('../services/theme');
const { get, set } = require('../services/storage');

/**
 * Регистрирует все IPC обработчики
 * @param {Electron.BrowserWindow} mainWindow Главное окно приложения
 */
function registerIpcHandlers(mainWindow) {
  // ========== Вкладки ==========
  
  // Получение всех вкладок
  ipcMain.handle('tabs:getAll', async () => {
    return require('../services/storage').get('tabs') || [];
  });
  
  // Получение активной вкладки
  ipcMain.handle('tabs:getActive', async () => {
    const { appState } = require('../services/storage');
    const activeTabId = appState.activeTabId;
    const tabs = appState.tabs || [];
    return tabs.find(tab => tab.id === activeTabId) || null;
  });
  
  // Получение конкретной вкладки
  ipcMain.handle('tabs:get', async (event, tabId) => {
    return {id: tabId, url: 'about:blank', title: 'Новая вкладка'};
  });
  
  // Создание новой вкладки
  ipcMain.handle('tabs:create', async (event, url) => {
    console.log(`IPC обработчик tabs:create вызван с URL: ${url}`);
    
    try {
      // Получаем следующий ID для вкладки
      const { appState } = require('../services/storage');
      const newTabId = appState.nextTabId; 
      
      // Сохраняем новую вкладку в хранилище перед созданием
      const currentTabs = appState.tabs || [];
      const newTab = { id: newTabId, url: url || 'about:blank', title: 'Новая вкладка' };
      currentTabs.push(newTab);
      require('../services/storage').set('tabs', currentTabs);
      
      console.log(`Создание новой вкладки с ID: ${newTabId}, URL: ${url}`);
      
      // Создаем фактическую вкладку в интерфейсе
      const result = tabs.createTab(newTabId, url || 'about:blank');
      
      // Активируем созданную вкладку
      tabs.activateTab(newTabId);
      
      // Увеличиваем счетчик nextTabId для следующего вызова
      appState.nextTabId = newTabId + 1;
      
      // Отправляем событие о создании вкладки
      event.sender.send('tabs:created', newTab);
      
      return result;
    } catch (error) {
      console.error('Ошибка при создании вкладки через IPC:', error);
      return null;
    }
  });
  
  // Активация вкладки
  ipcMain.handle('tabs:activate', async (event, tabId) => {
    return tabs.activateTab(tabId);
  });
  
  // Закрытие вкладки
  ipcMain.handle('tabs:close', async (event, tabId) => {
    return tabs.closeTab(tabId);
  });
  
  // Обновление вкладки
  ipcMain.handle('tabs:update', async (event, tabId, updateProperties) => {
    return {id: tabId, ...updateProperties};
  });
  
  // ========== Навигация ==========
  
  // Навигация по URL
  ipcMain.handle('navigation:navigateTo', async (event, url) => {
    const activeView = tabs.getActiveView();
    if (activeView && activeView.webContents) {
      activeView.webContents.loadURL(url);
      return true;
    }
    return false;
  });
  
  // Переход назад
  ipcMain.handle('navigation:goBack', async () => {
    const activeView = tabs.getActiveView();
    if (activeView && activeView.webContents && activeView.webContents.canGoBack()) {
      activeView.webContents.goBack();
      return true;
    }
    return false;
  });
  
  // Переход вперед
  ipcMain.handle('navigation:goForward', async () => {
    const activeView = tabs.getActiveView();
    if (activeView && activeView.webContents && activeView.webContents.canGoForward()) {
      activeView.webContents.goForward();
      return true;
    }
    return false;
  });
  
  // Перезагрузка страницы
  ipcMain.handle('navigation:reload', async () => {
    const activeView = tabs.getActiveView();
    if (activeView && activeView.webContents) {
      activeView.webContents.reload();
      return true;
    }
    return false;
  });
  
  // Остановка загрузки
  ipcMain.handle('navigation:stop', async () => {
    const activeView = tabs.getActiveView();
    if (activeView && activeView.webContents) {
      activeView.webContents.stop();
      return true;
    }
    return false;
  });
  
  // ========== История ==========
  
  // Получение истории
  ipcMain.handle('history:get', async () => {
    return history.getHistory();
  });
  
  // Поиск в истории
  ipcMain.handle('history:search', async (event, query) => {
    return history.searchHistory(query);
  });
  
  // Удаление записи из истории
  ipcMain.handle('history:deleteItem', async (event, url) => {
    return history.deleteHistoryItem(url);
  });
  
  // Очистка истории
  ipcMain.handle('history:clear', async () => {
    return history.clearHistory();
  });
  
  // Очистка истории за период
  ipcMain.handle('history:clearPeriod', async (event, period) => {
    return history.clearHistoryPeriod(period);
  });
  
  // Получение топ сайтов
  ipcMain.handle('history:getTopSites', async () => {
    return history.getTopSites();
  });
  
  // ========== Загрузки ==========
  
  // Получение всех загрузок
  ipcMain.handle('downloads:getAll', async () => {
    return [];
  });
  
  // Получение загрузки по ID
  ipcMain.handle('downloads:get', async (event, downloadId) => {
    return null;
  });
  
  // Приостановка загрузки
  ipcMain.handle('downloads:pause', async (event, downloadId) => {
    return false;
  });
  
  // Возобновление загрузки
  ipcMain.handle('downloads:resume', async (event, downloadId) => {
    return false;
  });
  
  // Отмена загрузки
  ipcMain.handle('downloads:cancel', async (event, downloadId) => {
    return false;
  });
  
  // Открытие загрузки
  ipcMain.handle('downloads:open', async (event, downloadId) => {
    return false;
  });
  
  // Показать в папке
  ipcMain.handle('downloads:showInFolder', async (event, downloadId) => {
    return false;
  });
  
  // ========== Закладки ==========
  
  // Получение всех закладок
  ipcMain.handle('bookmarks:getAll', async () => {
    return bookmarks.getBookmarks();
  });
  
  // Добавление закладки
  ipcMain.handle('bookmarks:add', async (event, bookmark) => {
    return bookmarks.addBookmark(bookmark.url, bookmark.title);
  });
  
  // Удаление закладки
  ipcMain.handle('bookmarks:remove', async (event, url) => {
    return bookmarks.removeBookmark(url);
  });
  
  // Проверка закладки
  ipcMain.handle('bookmarks:isBookmarked', async (event, url) => {
    return bookmarks.isBookmarked(url);
  });
  
  // Получение закладки
  ipcMain.handle('bookmarks:get', async (event, url) => {
    return bookmarks.getBookmark(url);
  });
  
  // ========== Блокировка рекламы ==========
  
  // Получение статуса
  ipcMain.handle('adblock:getStatus', async () => {
    return adblock.getStatus();
  });
  
  // Переключение статуса
  ipcMain.handle('adblock:toggleStatus', async () => {
    return adblock.toggleStatus();
  });
  
  // Получение статистики
  ipcMain.handle('adblock:getStats', async () => {
    return adblock.getStats();
  });
  
  // Добавление в белый список
  ipcMain.handle('adblock:addToWhitelist', async (event, url) => {
    return adblock.addToWhitelist(url);
  });
  
  // Удаление из белого списка
  ipcMain.handle('adblock:removeFromWhitelist', async (event, url) => {
    return adblock.removeFromWhitelist(url);
  });
  
  // Проверка, в белом ли списке
  ipcMain.handle('adblock:isWhitelisted', async (event, url) => {
    return adblock.isWhitelisted(url);
  });
  
  // ========== Режим чтения ==========
  
  // Включение режима чтения
  ipcMain.handle('reader:enable', async (event, tabId) => {
    return reader.enableReaderMode(tabId);
  });
  
  // Выключение режима чтения
  ipcMain.handle('reader:disable', async (event, tabId) => {
    return reader.disableReaderMode(tabId);
  });
  
  // Получение настроек режима чтения
  ipcMain.handle('reader:getSettings', async () => {
    return reader.getSettings();
  });
  
  // Установка настроек режима чтения
  ipcMain.handle('reader:setSettings', async (event, settings) => {
    return reader.setSettings(settings);
  });
  
  // ========== Темы ==========
  
  // Получение темы
  ipcMain.handle('theme:get', async () => {
    return theme.getCurrentTheme ? theme.getCurrentTheme() : 'light';
  });
  
  // Установка темы
  ipcMain.handle('theme:set', async (event, themeName) => {
    return theme.setTheme ? theme.setTheme(themeName) : false;
  });
  
  // Получение доступных тем
  ipcMain.handle('theme:getAvailable', async () => {
    return theme.getAvailableThemes ? theme.getAvailableThemes() : ['light', 'dark'];
  });
  
  // ========== Перевод ==========
  
  // Перевод текста
  ipcMain.handle('translate:text', async (event, text, targetLang) => {
    return translate.translateText ? translate.translateText(text, targetLang) : text;
  });
  
  // Перевод страницы
  ipcMain.handle('translate:page', async (event, tabId, targetLang) => {
    return translate.translatePage ? translate.translatePage(tabId, targetLang) : false;
  });
  
  // Определение языка
  ipcMain.handle('translate:detectLanguage', async (event, text) => {
    return translate.detectLanguage ? translate.detectLanguage(text) : 'en';
  });
  
  // Получение языков
  ipcMain.handle('translate:getLanguages', async () => {
    return translate.getSupportedLanguages ? translate.getSupportedLanguages() : [];
  });
  
  // ========== Настройки ==========
  
  // Получение всех настроек
  ipcMain.handle('settings:getAll', async () => {
    return {};
  });
  
  // Получение настройки
  ipcMain.handle('settings:get', async (event, key) => {
    return get(key);
  });
  
  // Установка настройки
  ipcMain.handle('settings:set', async (event, key, value) => {
    return set(key, value);
  });
  
  // Сброс настроек
  ipcMain.handle('settings:reset', async () => {
    return false;
  });
  
  console.log('IPC обработчики успешно зарегистрированы');
}

module.exports = { 
  registerIpcHandlers 
}; 