const { app, BrowserWindow, BrowserView, ipcMain, Menu, MenuItem, dialog, nativeTheme, session } = require('electron');
const path = require('path');
const url = require('url');
const Store = require('electron-store');
const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('cross-fetch');

// Название приложения
const APP_NAME = 'Browzyan';
// Поисковая система и домашняя страница по умолчанию
const DEFAULT_SEARCH_URL = 'https://ya.ru';
const DEFAULT_SEARCH_QUERY_URL = 'https://yandex.ru/search/?text=';

// Инициализация хранилища
const store = new Store({
  defaults: {
    darkMode: nativeTheme.shouldUseDarkColors,
    focusMode: false,
    bookmarks: [],
    sidebarVisible: false,
    lastVisitedUrl: DEFAULT_SEARCH_URL,
    tabs: [
      { id: 1, url: DEFAULT_SEARCH_URL, title: 'Яндекс' }
    ],
    activeTabId: 1,
    adBlockEnabled: false,
    customTheme: {
      enabled: false,
      primaryColor: '#0060df',
      backgroundColor: '#f0f0f4',
      textColor: '#15141a',
      headerColor: '#f9f9fb'
    },
    // Добавляем историю просмотра
    history: [],
    // Топ сайтов (кэшированные данные для быстрого доступа)
    topSites: []
  }
});

// Глобальная переменная для окна, чтобы избежать сборки мусора
let mainWindow;
let browserViews = {}; // Хранение всех BrowserView для вкладок
let nextTabId = 2; // Начальный ID для новых вкладок
let blocker = null; // Блокировщик рекламы

// Состояние приложения
let appState = {
  darkMode: store.get('darkMode'),
  focusMode: store.get('focusMode'),
  bookmarks: store.get('bookmarks'),
  sidebarVisible: store.get('sidebarVisible'),
  lastVisitedUrl: store.get('lastVisitedUrl'),
  tabs: store.get('tabs'),
  activeTabId: store.get('activeTabId'),
  adBlockEnabled: store.get('adBlockEnabled'),
  downloadsPanelVisible: false,
  downloads: [],
  customTheme: store.get('customTheme'),
  // Добавляем историю просмотра
  history: store.get('history'),
  // Топ сайтов
  topSites: store.get('topSites')
};

// Хранилище для временного содержимого HTML
const readerContentStore = new Map();

// Хранилище для оригинальных URL страниц, когда мы переходим в режим чтения
const originalUrls = new Map();

// Хранилище для загрузок
const downloads = new Map();
let downloadCounter = 1;

// Функция для получения активной вкладки
function getActiveView() {
  return browserViews[appState.activeTabId];
}

// Инициализация блокировщика рекламы
async function initAdBlocker() {
  if (appState.adBlockEnabled) {
    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    blocker.enableBlockingInSession(session.defaultSession);
    console.log('Блокировщик рекламы включен');
  }
}

// Создание главного окна
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: appState.darkMode ? '#212121' : '#fff',
    title: APP_NAME,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Загрузка интерфейса
  mainWindow.loadFile('index.html');

  // Создаем вкладки из сохраненных данных
  appState.tabs.forEach(tab => {
    createTab(tab.id, tab.url);
  });

  // Активируем активную вкладку
  if (browserViews[appState.activeTabId]) {
    activateTab(appState.activeTabId);
  } else if (appState.tabs.length > 0) {
    // Если активной вкладки нет, активируем первую
    activateTab(appState.tabs[0].id);
  } else {
    // Если нет сохраненных вкладок, создаем новую
    const newTabId = createTab(nextTabId++, DEFAULT_SEARCH_URL);
    activateTab(newTabId);
  }

  // Обработка изменения размера окна
  mainWindow.on('resize', () => {
    updateBrowserViewBounds(appState.activeTabId);
  });

  // Открыть DevTools при разработке
  // mainWindow.webContents.openDevTools();

  // Событие закрытия окна
  mainWindow.on('closed', function () {
    mainWindow = null;
    browserViews = {};
  });
}

// Константы для режима чтения и стартовой страницы
const READER_HTML_PATH = path.join(__dirname, 'reader.html');
const STARTPAGE_HTML_PATH = path.join(__dirname, 'startpage.html');

// Функция для создания контекстного меню для перевода
function createTranslationMenu(win) {
  const menu = new Menu();
  
  menu.append(new MenuItem({
    label: 'Перевести на русский',
    click: () => {
      win.webContents.executeJavaScript(`
        const selectedText = window.getSelection().toString();
        window.electronAPI.translateText(selectedText, 'ru').then(result => {
          if (result.success) {
            alert("Перевод: " + result.translation);
          } else {
            alert("Ошибка перевода: " + result.error);
          }
        });
      `);
    }
  }));
  
  menu.append(new MenuItem({
    label: 'Перевести на английский',
    click: () => {
      win.webContents.executeJavaScript(`
        const selectedText = window.getSelection().toString();
        window.electronAPI.translateText(selectedText, 'en').then(result => {
          if (result.success) {
            alert("Translation: " + result.translation);
          } else {
            alert("Translation error: " + result.error);
          }
        });
      `);
    }
  }));
  
  return menu;
}

// Создание новой вкладки
function createTab(tabId, tabUrl) {
  // Создаем BrowserView для вкладки
  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Если блокировка рекламы включена, применяем её к этой вкладке
  if (appState.adBlockEnabled && blocker) {
    blocker.enableBlockingInSession(view.webContents.session);
  }

  // Добавляем в хранилище
  browserViews[tabId] = view;

  // Добавляем BrowserView в окно (но не делаем его видимым)
  mainWindow.addBrowserView(view);

  // Обработчик для открытия ссылок в новой вкладке вместо нового окна
  view.webContents.setWindowOpenHandler(({ url }) => {
    // Создаем новую вкладку с полученным URL
    const newTabId = nextTabId++;
    const newTab = { id: newTabId, url: url, title: 'Загрузка...' };
    
    // Добавляем новую вкладку в список
    appState.tabs.push(newTab);
    store.set('tabs', appState.tabs);
    
    // Отправляем сообщение о создании вкладки в рендерер
    mainWindow.webContents.send('tab-created', newTab);
    
    // Создаем новую вкладку
    createTab(newTabId, url);
    
    // Активируем новую вкладку
    activateTab(newTabId);
    
    // Предотвращаем открытие нового окна
    return { action: 'deny' };
  });

  // Обработчики событий для BrowserView
  view.webContents.on('did-finish-load', () => {
    const currentUrl = view.webContents.getURL();
    const title = view.webContents.getTitle();
    
    // Обновляем заголовок вкладки
    const tabIndex = appState.tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex !== -1) {
      appState.tabs[tabIndex].title = title;
      appState.tabs[tabIndex].url = currentUrl;
      store.set('tabs', appState.tabs);
      mainWindow.webContents.send('tabs-updated', appState.tabs);
    }

    // Если это активная вкладка, сохраняем URL как последний посещенный
    if (appState.activeTabId === tabId) {
      appState.lastVisitedUrl = currentUrl;
      store.set('lastVisitedUrl', currentUrl);
      
      // Обновляем заголовок окна
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setTitle(`${title} - ${APP_NAME}`);
        
        // Отправляем сообщение в renderer процесс об окончании загрузки
        mainWindow.webContents.send('page-loaded', currentUrl);
      }
    }
    
    // Сохраняем в историю (кроме специальных страниц)
    addToHistory(currentUrl, title);
  });

  // Обработка ошибок загрузки страницы
  view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) {
      // Загружаем страницу с сообщением об ошибке
      console.log(`Ошибка загрузки страницы: ${errorDescription} (${errorCode})`);
      
      // Тут можно добавить загрузку страницы с ошибкой
      // view.webContents.loadFile('error.html');
    }
  });

  // Добавляем контекстное меню для перевода при выделении текста
  view.webContents.on('context-menu', (event, params) => {
    const { selectionText } = params;
    
    if (selectionText) {
      // Создаем и показываем меню для перевода
      const translationMenu = createTranslationMenu(mainWindow);
      translationMenu.popup({ window: mainWindow });
    }
  });

  // Настройка загрузок и обработка событий загрузки
  view.webContents.session.on('will-download', (event, item, webContents) => {
    // Получаем информацию о загрузке
    const fileName = item.getFilename();
    const fileSize = item.getTotalBytes();
    const url = item.getURL();
    const savePath = item.getSavePath();
    const id = downloadCounter++;
    
    // Сохраняем информацию о загрузке
    downloads.set(id, {
      id,
      fileName,
      fileSize,
      receivedBytes: 0,
      url,
      savePath,
      status: 'progressing',
      startTime: Date.now(),
      item
    });
    
    // Отправляем событие о начале загрузки
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-started', {
        id,
        fileName,
        fileSize,
        url,
        savePath
      });
    }
    
    // Обработка обновления прогресса загрузки
    item.on('updated', (event, state) => {
      if (state === 'progressing') {
        const download = downloads.get(id);
        if (download) {
          const receivedBytes = item.getReceivedBytes();
          
          // Обновляем информацию о загрузке
          download.receivedBytes = receivedBytes;
          download.status = state;
          
          // Отправляем событие о прогрессе загрузки
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download-progress', {
              id,
              receivedBytes,
              fileSize,
              percent: (receivedBytes / fileSize) * 100,
              speed: calculateSpeed(download)
            });
          }
        }
      } else if (state === 'interrupted') {
        const download = downloads.get(id);
        if (download) {
          download.status = 'interrupted';
          
          // Отправляем событие о прерывании загрузки
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download-failed', {
              id,
              error: 'Загрузка прервана'
            });
          }
        }
      }
    });
    
    // Обработка завершения загрузки
    item.once('done', (event, state) => {
      const download = downloads.get(id);
      if (download) {
        download.status = state;
        download.endTime = Date.now();
        
        if (state === 'completed') {
          // Отправляем событие о завершении загрузки
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download-completed', {
              id,
              fileName,
              savePath
            });
          }
        } else if (state === 'cancelled') {
          // Отправляем событие об отмене загрузки
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download-cancelled', {
              id
            });
          }
        } else {
          // Отправляем событие об ошибке загрузки
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download-failed', {
              id,
              error: 'Загрузка не удалась'
            });
          }
        }
      }
    });
  });

  // Загружаем URL, если передан, иначе открываем стартовую страницу
  if (tabUrl) {
    view.webContents.loadURL(tabUrl);
  } else {
    view.webContents.loadFile(STARTPAGE_HTML_PATH);
  }

  return tabId;
}

// Активация вкладки
function activateTab(tabId) {
  // Проверка параметров
  if (!tabId || !browserViews[tabId] || !mainWindow || mainWindow.isDestroyed()) {
    console.error('Ошибка активации вкладки:', { tabId, browserViewExists: !!browserViews[tabId], mainWindowExists: !!mainWindow });
    return tabId;
  }

  try {
    // Проверяем, не активна ли уже эта вкладка
    if (appState.activeTabId === tabId) {
      console.log(`Вкладка ${tabId} уже активна`);
      // Обновляем размеры, на случай изменения размера окна
      updateBrowserViewBounds(tabId);
      return tabId;
    }
    
    // Получаем текущую активную вкладку и сохраняем ее состояние
    const previousTabId = appState.activeTabId;
    
    // Устанавливаем BrowserView для окна с защитой от ошибок
    try {
      mainWindow.setBrowserView(browserViews[tabId]);
    } catch (err) {
      console.error('Ошибка при установке BrowserView:', err);
      // Пробуем восстановить предыдущую вкладку
      if (previousTabId && browserViews[previousTabId]) {
        mainWindow.setBrowserView(browserViews[previousTabId]);
      }
      return previousTabId;
    }
    
    // Обновляем активную вкладку
    appState.activeTabId = tabId;
    store.set('activeTabId', tabId);
    
    // Обновляем заголовок окна
    const tabIndex = appState.tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex !== -1 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(`${appState.tabs[tabIndex].title} - ${APP_NAME}`);
    }
    
    // Обновляем размеры и позицию BrowserView
    updateBrowserViewBounds(tabId);
    
    // Отправляем сообщение о смене вкладки
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tab-changed', tabId);
    }
    
    console.log(`Активирована вкладка ${tabId}`);
    return tabId;
  } catch (error) {
    console.error('Непредвиденная ошибка при активации вкладки:', error);
    return appState.activeTabId;
  }
}

// Закрытие вкладки
function closeTab(tabId) {
  // Проверка параметров
  if (!tabId || !browserViews[tabId]) {
    console.error('Ошибка закрытия вкладки: вкладка не найдена', tabId);
    return appState.tabs;
  }
  
  try {
    // Если это активная вкладка, сначала активируем другую
    const isActiveTab = appState.activeTabId === tabId;
    
    // Найдем индекс в массиве вкладок
    const tabIndex = appState.tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) {
      console.error('Ошибка закрытия вкладки: вкладка не найдена в списке', tabId);
      return appState.tabs;
    }
    
    // Находим новую вкладку для активации, если закрываем активную
    let newActiveTabId = appState.activeTabId;
    if (isActiveTab) {
      // Пытаемся активировать предыдущую вкладку в списке
      if (tabIndex > 0) {
        newActiveTabId = appState.tabs[tabIndex - 1].id;
      } 
      // Если нет предыдущей, то пытаемся активировать следующую
      else if (tabIndex < appState.tabs.length - 1) {
        newActiveTabId = appState.tabs[tabIndex + 1].id;
      } 
      // Если нет других вкладок, будет null
      else {
        newActiveTabId = null;
      }
      
      // Если будет новая активная вкладка, активируем ее
      if (newActiveTabId !== null && browserViews[newActiveTabId]) {
        try {
          mainWindow.setBrowserView(browserViews[newActiveTabId]);
        } catch (error) {
          console.error('Ошибка при смене активной вкладки:', error);
        }
      }
    }
    
    // Удаляем BrowserView
    try {
      const view = browserViews[tabId];
      delete browserViews[tabId];
      
      // Безопасное уничтожение webContents
      if (view && view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.destroy();
      }
    } catch (error) {
      console.error('Ошибка при удалении BrowserView:', error);
    }
    
    // Удаляем из списка вкладок
    appState.tabs = appState.tabs.filter(tab => tab.id !== tabId);
    store.set('tabs', appState.tabs);
    
    // Обрабатываем случай, когда были закрыты все вкладки
    if (appState.tabs.length === 0) {
      // Если нет вкладок, создаем новую
      const newTabId = createTab(nextTabId++, DEFAULT_SEARCH_URL);
      appState.tabs.push({ id: newTabId, url: DEFAULT_SEARCH_URL, title: 'Новая вкладка' });
      store.set('tabs', appState.tabs);
      
      // Активируем новую вкладку
      activateTab(newTabId);
    } 
    // Если мы закрыли активную вкладку, активируем выбранную новую
    else if (isActiveTab && newActiveTabId !== null) {
      activateTab(newActiveTabId);
    }
    
    console.log(`Закрыта вкладка ${tabId}, осталось ${appState.tabs.length} вкладок`);
    return appState.tabs;
  } catch (error) {
    console.error('Непредвиденная ошибка при закрытии вкладки:', error);
    return appState.tabs;
  }
}

// Обновление границ browserView в зависимости от видимости боковой панели и других элементов
function updateBrowserViewBounds(tabId) {
  if (!mainWindow || !browserViews[tabId]) return;
  
  const bounds = mainWindow.getContentBounds();
  const topOffset = 86; // Высота верхней панели (вкладки + панель навигации)
  let leftOffset = appState.sidebarVisible ? 250 : 0; // Ширина боковой панели
  
  // Учитываем видимость панели загрузок
  let rightOffset = appState.downloadsPanelVisible ? Math.min(bounds.width * 0.25, 400) : 0;
  
  browserViews[tabId].setBounds({ 
    x: leftOffset, 
    y: topOffset, 
    width: bounds.width - leftOffset - rightOffset, 
    height: bounds.height - topOffset 
  });
}

// Запуск приложения
app.whenReady().then(async () => {
  // Установка имени приложения
  app.setName(APP_NAME);
  
  await initAdBlocker();
  createWindow();
});

// Обработка IPC событий для навигации
ipcMain.handle('navigate', async (event, url) => {
  const activeView = browserViews[appState.activeTabId];
  if (!activeView) return { success: false, error: 'Нет активной вкладки' };
  
  try {
    await activeView.webContents.loadURL(url);
    
    // После успешной загрузки добавляем в историю
    const finalUrl = activeView.webContents.getURL();
    const title = activeView.webContents.getTitle();
    addToHistory(finalUrl, title);
    
    return { success: true, url: finalUrl };
  } catch (error) {
    console.error('Ошибка навигации:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('go-back', async () => {
  const activeView = browserViews[appState.activeTabId];
  if (!activeView) return false;
  
  if (activeView.webContents.canGoBack()) {
    activeView.webContents.goBack();
    return true;
  }
  return false;
});

ipcMain.handle('go-forward', async () => {
  const activeView = browserViews[appState.activeTabId];
  if (!activeView) return false;
  
  if (activeView.webContents.canGoForward()) {
    activeView.webContents.goForward();
    return true;
  }
  return false;
});

ipcMain.handle('refresh', async () => {
  const activeView = browserViews[appState.activeTabId];
  if (activeView) {
    activeView.webContents.reload();
  }
});

ipcMain.handle('get-url', async () => {
  const activeView = browserViews[appState.activeTabId];
  if (!activeView) return '';
  
  return activeView.webContents.getURL();
});

ipcMain.handle('check-navigation', async () => {
  const activeView = browserViews[appState.activeTabId];
  if (!activeView) return { canGoBack: false, canGoForward: false, currentUrl: '' };
  
  return {
    canGoBack: activeView.webContents.canGoBack(),
    canGoForward: activeView.webContents.canGoForward(),
    currentUrl: activeView.webContents.getURL()
  };
});

// Передача пользовательских настроек в renderer процесс
ipcMain.handle('get-default-search', () => {
  return { url: DEFAULT_SEARCH_URL, queryUrl: DEFAULT_SEARCH_QUERY_URL };
});

// Обработчики вкладок
ipcMain.handle('open-tab', async (event, url) => {
  try {
    const tabId = nextTabId++;
    
    console.log(`Открываем новую вкладку ${tabId} с URL: ${url || DEFAULT_SEARCH_URL}`);
    
    // Создаем BrowserView для вкладки
    createTab(tabId, url || DEFAULT_SEARCH_URL);
    
    // Добавляем в список вкладок
    appState.tabs.push({ id: tabId, url: url || DEFAULT_SEARCH_URL, title: 'Новая вкладка' });
    store.set('tabs', appState.tabs);
    
    // Активируем новую вкладку
    activateTab(tabId);
    
    return { id: tabId, tabs: appState.tabs };
  } catch (error) {
    console.error('Ошибка при открытии вкладки:', error);
    return { error: 'Failed to open tab', tabs: appState.tabs };
  }
});

ipcMain.handle('close-tab', async (event, tabId) => {
  try {
    if (!tabId || typeof tabId !== 'number') {
      console.error('Некорректный tabId в close-tab:', tabId);
      return { error: 'Invalid tabId', activeTabId: appState.activeTabId, tabs: appState.tabs };
    }
    
    console.log(`Закрываем вкладку ${tabId}`);
    
    // Закрываем вкладку
    const tabs = closeTab(tabId);
    
    return { activeTabId: appState.activeTabId, tabs };
  } catch (error) {
    console.error('Ошибка при закрытии вкладки:', error);
    return { error: 'Failed to close tab', activeTabId: appState.activeTabId, tabs: appState.tabs };
  }
});

ipcMain.handle('switch-tab', async (event, tabId) => {
  try {
    if (!tabId || typeof tabId !== 'number') {
      console.error('Некорректный tabId в switch-tab:', tabId);
      return { error: 'Invalid tabId', activeTabId: appState.activeTabId, tabs: appState.tabs };
    }
    
    console.log(`Переключаемся на вкладку ${tabId}`);
    
    // Проверяем существование вкладки
    if (!browserViews[tabId]) {
      console.error(`Вкладка ${tabId} не существует`);
      return { error: 'Tab not found', activeTabId: appState.activeTabId, tabs: appState.tabs };
    }
    
    // Активируем вкладку
    activateTab(tabId);
    
    return { activeTabId: appState.activeTabId, tabs: appState.tabs };
  } catch (error) {
    console.error('Ошибка при переключении вкладки:', error);
    return { error: 'Failed to switch tab', activeTabId: appState.activeTabId, tabs: appState.tabs };
  }
});

ipcMain.handle('get-tabs', async () => {
  try {
    return { activeTabId: appState.activeTabId, tabs: appState.tabs };
  } catch (error) {
    console.error('Ошибка при получении списка вкладок:', error);
    return { error: 'Failed to get tabs', activeTabId: appState.activeTabId, tabs: [] };
  }
});

ipcMain.handle('reorder-tabs', async (event, fromIndex, toIndex) => {
  try {
    if (typeof fromIndex !== 'number' || typeof toIndex !== 'number') {
      console.error('Некорректные параметры в reorder-tabs:', { fromIndex, toIndex });
      return { error: 'Invalid parameters', tabs: appState.tabs };
    }
    
    // Проверяем, что индексы в допустимом диапазоне
    if (fromIndex < 0 || fromIndex >= appState.tabs.length || toIndex < 0 || toIndex >= appState.tabs.length) {
      console.error('Индексы вне допустимого диапазона:', { fromIndex, toIndex, tabsLength: appState.tabs.length });
      return { error: 'Index out of range', tabs: appState.tabs };
    }
    
    console.log(`Перемещаем вкладку с позиции ${fromIndex} на позицию ${toIndex}`);
    
    // Переупорядочиваем вкладки в состоянии
    const tab = appState.tabs.splice(fromIndex, 1)[0];
    appState.tabs.splice(toIndex, 0, tab);
    
    // Сохраняем изменения
    store.set('tabs', appState.tabs);
    
    return { tabs: appState.tabs };
  } catch (error) {
    console.error('Ошибка при изменении порядка вкладок:', error);
    return { error: 'Failed to reorder tabs', tabs: appState.tabs };
  }
});

// Методы блокировки рекламы
ipcMain.handle('toggle-ad-block', async () => {
  appState.adBlockEnabled = !appState.adBlockEnabled;
  store.set('adBlockEnabled', appState.adBlockEnabled);
  
  if (appState.adBlockEnabled) {
    // Включаем блокировку рекламы
    if (!blocker) {
      blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    }
    
    // Применяем ко всем активным вкладкам
    Object.values(browserViews).forEach(view => {
      blocker.enableBlockingInSession(view.webContents.session);
    });
    
    console.log('Блокировка рекламы включена');
  } else {
    // Отключаем блокировку рекламы
    if (blocker) {
      Object.values(browserViews).forEach(view => {
        blocker.disableBlockingInSession(view.webContents.session);
      });
      console.log('Блокировка рекламы отключена');
    }
  }
  
  return appState.adBlockEnabled;
});

ipcMain.handle('update-ad-block-rules', async () => {
  if (appState.adBlockEnabled && blocker) {
    await blocker.enableBlockingInSession(session.defaultSession);
    Object.values(browserViews).forEach(view => {
      blocker.enableBlockingInSession(view.webContents.session);
    });
    return true;
  }
  return false;
});

// Обработчики для настроек и закладок
ipcMain.handle('toggle-dark-mode', () => {
  appState.darkMode = !appState.darkMode;
  nativeTheme.themeSource = appState.darkMode ? 'dark' : 'light';
  store.set('darkMode', appState.darkMode);
  return appState.darkMode;
});

ipcMain.handle('toggle-focus-mode', () => {
  appState.focusMode = !appState.focusMode;
  store.set('focusMode', appState.focusMode);
  Object.keys(browserViews).forEach(tabId => {
    updateBrowserViewBounds(parseInt(tabId));
  });
  return appState.focusMode;
});

ipcMain.handle('toggle-sidebar', () => {
  appState.sidebarVisible = !appState.sidebarVisible;
  store.set('sidebarVisible', appState.sidebarVisible);
  Object.keys(browserViews).forEach(tabId => {
    updateBrowserViewBounds(parseInt(tabId));
  });
  return appState.sidebarVisible;
});

ipcMain.handle('get-bookmarks', () => {
  return appState.bookmarks;
});

ipcMain.handle('add-bookmark', async (event, bookmark) => {
  appState.bookmarks.push(bookmark);
  store.set('bookmarks', appState.bookmarks);
  return appState.bookmarks;
});

ipcMain.handle('remove-bookmark', async (event, url) => {
  appState.bookmarks = appState.bookmarks.filter(bookmark => bookmark.url !== url);
  store.set('bookmarks', appState.bookmarks);
  return appState.bookmarks;
});

ipcMain.handle('get-app-state', () => {
  return appState;
});

// Новый обработчик для получения HTML содержимого текущей страницы
ipcMain.handle('get-page-html', async () => {
  const activeView = browserViews[appState.activeTabId];
  if (!activeView) return { success: false, error: 'Нет активной вкладки' };
  
  try {
    const html = await activeView.webContents.executeJavaScript(`
      document.documentElement.outerHTML
    `);
    
    // Получаем URL и title страницы
    const url = activeView.webContents.getURL();
    const title = activeView.webContents.getTitle();
    
    return { 
      success: true, 
      html, 
      url,
      title
    };
  } catch (error) {
    console.error('Ошибка при получении HTML страницы:', error);
    return { success: false, error: error.message };
  }
});

// Добавляем обработчик для сохранения настроек режима чтения
ipcMain.handle('save-reader-settings', async (event, settings) => {
  try {
    store.set('readerSettings', settings);
    return { success: true };
  } catch (error) {
    console.error('Ошибка при сохранении настроек режима чтения:', error);
    return { success: false, error: error.message };
  }
});

// Добавляем обработчик для получения настроек режима чтения
ipcMain.handle('get-reader-settings', async () => {
  try {
    const defaultSettings = {
      fontSize: 18,
      lineHeight: 1.5,
      lineWidth: 70,
      theme: 'light'
    };
    
    const settings = store.get('readerSettings', defaultSettings);
    return { success: true, settings };
  } catch (error) {
    console.error('Ошибка при получении настроек режима чтения:', error);
    return { success: false, error: error.message };
  }
});

// Обработчик для получения HTML-содержимого по ID
ipcMain.handle('get-reader-content', async (event, contentId) => {
  console.log('Запрос содержимого по ID:', contentId);
  if (readerContentStore.has(contentId)) {
    console.log('Содержимое найдено');
    const html = readerContentStore.get(contentId);
    console.log('Размер содержимого:', html.length);
    
    // После получения содержимого можно удалить его из хранилища
    readerContentStore.delete(contentId);
    console.log('Содержимое удалено из хранилища');
    
    return html;
  }
  console.log('Содержимое не найдено');
  return null;
});

// Обработчик входа в режим чтения
ipcMain.handle('enter-reader-mode', async (event) => {
  try {
    console.log('Вход в режим чтения...');
    const activeView = getActiveView();
    if (!activeView) {
      console.log('Нет активной вкладки');
      return { success: false, error: 'Нет активной вкладки' };
    }

    // Получаем URL и title страницы
    const url = activeView.webContents.getURL();
    const title = activeView.webContents.getTitle();
    console.log('Заголовок:', title);
    console.log('URL:', url);
    
    // Сохраняем оригинальный URL для возврата
    originalUrls.set(appState.activeTabId, url);
    console.log('Сохранен оригинальный URL:', url);

    // Получаем HTML содержимое страницы
    console.log('Получение HTML содержимого...');
    const html = await activeView.webContents.executeJavaScript(`
      document.documentElement.outerHTML;
    `);
    console.log('HTML получен, размер:', html.length);
    
    // Получаем настройки режима чтения
    const defaultSettings = {
      fontSize: 18,
      lineHeight: 1.5,
      lineWidth: 70,
      theme: 'light'
    };
    
    const settings = store.get('readerSettings', defaultSettings);
    
    // Генерируем уникальный ID для хранения содержимого
    const contentId = Date.now().toString();
    console.log('ID контента:', contentId);
    
    // Сохраняем HTML во временное хранилище
    readerContentStore.set(contentId, html);
    console.log('HTML сохранен во временное хранилище');
    
    // Создаем данные для передачи в режим чтения (без HTML)
    const readerData = {
      title,
      contentId,
      domain: new URL(url).hostname,
      url,
      settings
    };
    
    // Преобразуем данные в строку, подходящую для URL hash
    const encodedData = encodeURIComponent(JSON.stringify(readerData));
    console.log('Размер закодированных данных:', encodedData.length);
    
    // Загружаем reader.html и передаем метаданные через hash
    console.log('Загрузка reader.html...');
    await activeView.webContents.loadFile(READER_HTML_PATH, {
      hash: encodedData
    });
    console.log('reader.html загружен');
    
    return { success: true };
  } catch (error) {
    console.error('Ошибка при входе в режим чтения:', error);
    return { success: false, error: error.message };
  }
});

// Обработчик выхода из режима чтения
ipcMain.handle('exit-reader-mode', async (event) => {
  try {
    console.log('Запрос выхода из режима чтения');
    
    // Используем активную вкладку
    const tabId = appState.activeTabId;
    console.log('Активная вкладка ID:', tabId);
    
    if (!tabId || !browserViews[tabId]) {
      console.log('Вкладка не найдена');
      return { success: false, error: 'Вкладка не найдена' };
    }
    
    // Используем сохраненный оригинальный URL, если он есть
    let originalUrl;
    
    if (originalUrls.has(tabId)) {
      originalUrl = originalUrls.get(tabId);
      console.log('Найден сохраненный оригинальный URL:', originalUrl);
      // Удаляем запись после использования
      originalUrls.delete(tabId);
    } else {
      // Используем URL из данных вкладки (как запасной вариант)
      const tabIndex = appState.tabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) {
        console.log('Данные вкладки не найдены');
        return { success: false, error: 'Данные вкладки не найдены' };
      }
      originalUrl = appState.tabs[tabIndex].url;
      console.log('Используется URL из данных вкладки:', originalUrl);
    }
    
    // Проверяем, не является ли URL страницей режима чтения
    if (originalUrl.startsWith('file://') && originalUrl.includes('reader.html')) {
      console.log('URL является страницей режима чтения, используем стандартное действие назад');
      await browserViews[tabId].webContents.goBack();
    } else {
      // Загружаем оригинальный URL
      console.log('Загрузка оригинального URL:', originalUrl);
      await browserViews[tabId].webContents.loadURL(originalUrl);
    }
    
    console.log('Выход из режима чтения успешен');
    return { success: true };
  } catch (error) {
    console.error('Ошибка при выходе из режима чтения:', error);
    return { success: false, error: error.message };
  }
});

// Новые обработчики IPC для стартовой страницы
ipcMain.handle('get-dark-mode', () => {
  return appState.darkMode;
});

// Получение часто посещаемых сайтов
ipcMain.handle('get-top-sites', () => {
  return appState.topSites;
});

// Получение недавней истории
ipcMain.handle('get-recent-history', () => {
  // Возвращаем последние 50 записей истории
  return appState.history.slice(0, 50);
});

// Поиск в истории
ipcMain.handle('search-history', (event, query) => {
  if (!query || query.trim() === '') {
    return [];
  }
  
  const searchLower = query.toLowerCase();
  return appState.history
    .filter(item => {
      return item.title.toLowerCase().includes(searchLower) || 
             item.url.toLowerCase().includes(searchLower);
    })
    .slice(0, 100); // Ограничиваем результаты
});

// Очистка всей истории
ipcMain.handle('clear-history', () => {
  appState.history = [];
  store.set('history', []);
  
  // Сбрасываем также топ сайтов
  appState.topSites = [];
  store.set('topSites', []);
  
  return true;
});

// Удаление одной записи из истории
ipcMain.handle('delete-history-item', (event, url) => {
  const initialLength = appState.history.length;
  appState.history = appState.history.filter(item => item.url !== url);
  
  // Если были удалены записи, обновляем хранилище и топ сайтов
  if (initialLength !== appState.history.length) {
    store.set('history', appState.history);
    updateTopSites();
    return true;
  }
  
  return false;
});

// Очистка истории за период
ipcMain.handle('clear-history-period', (event, period) => {
  const now = Date.now();
  let timeThreshold = now;
  
  // Определяем порог времени в зависимости от периода
  switch (period) {
    case 'hour':
      timeThreshold = now - 60 * 60 * 1000; // 1 час
      break;
    case 'day':
      timeThreshold = now - 24 * 60 * 60 * 1000; // 1 день
      break;
    case 'week':
      timeThreshold = now - 7 * 24 * 60 * 60 * 1000; // 1 неделя
      break;
    case 'month':
      timeThreshold = now - 30 * 24 * 60 * 60 * 1000; // 30 дней
      break;
    default:
      return false;
  }
  
  // Фильтруем историю, оставляя только записи старше порога
  const initialLength = appState.history.length;
  appState.history = appState.history.filter(item => item.timestamp < timeThreshold);
  
  // Если были удалены записи, обновляем хранилище и топ сайтов
  if (initialLength !== appState.history.length) {
    store.set('history', appState.history);
    updateTopSites();
    return true;
  }
  
  return false;
});

// Обработка навигации со стартовой страницы
ipcMain.handle('navigate-from-start-page', async (event, query) => {
  // Проверяем, является ли запрос URL-адресом
  let url = query.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Если нет http/https, предполагаем, что это поисковый запрос
    if (/^[\w-]+\.\w+/.test(url)) {
      // Если похоже на домен (например, example.com), добавляем https://
      url = 'https://' + url;
    } else {
      // Иначе выполняем поиск в Яндексе
      url = DEFAULT_SEARCH_QUERY_URL + encodeURIComponent(query);
    }
  }

  // Получаем активную вкладку
  const activeView = getActiveView();
  if (!activeView) {
    return { success: false, error: 'Нет активной вкладки' };
  }

  try {
    // Загружаем URL
    await activeView.webContents.loadURL(url);
    return { success: true };
  } catch (error) {
    console.error('Ошибка навигации со стартовой страницы:', error);
    return { success: false, error: error.message };
  }
});

// Открытие страницы истории
ipcMain.handle('open-history-page', async () => {
  const activeView = browserViews[appState.activeTabId];
  if (!activeView) return { success: false, error: 'Нет активной вкладки' };
  
  const historyPagePath = path.join(__dirname, 'history.html');
  try {
    const historyUrl = url.format({
      pathname: historyPagePath,
      protocol: 'file:',
      slashes: true
    });
    await activeView.webContents.loadURL(historyUrl);
    return { success: true };
  } catch (error) {
    console.error('Ошибка при открытии страницы истории:', error);
    return { success: false, error: error.message };
  }
});

// Добавляем обработчики для переводчика
ipcMain.handle('translate-text', async (event, text, targetLang) => {
  try {
    console.log(`Запрос перевода текста: "${text}" на язык: ${targetLang}`);
    
    // В реальном приложении здесь должен быть запрос к API переводчика
    // Для демонстрации возвращаем тестовый ответ
    
    let translation = '';
    
    // Имитация перевода для демонстрации
    if (targetLang === 'ru') {
      if (text.toLowerCase().includes('hello')) {
        translation = 'Привет';
      } else if (text.toLowerCase().includes('world')) {
        translation = 'Мир';
      } else {
        translation = `[Перевод на русский]: ${text}`;
      }
    } else if (targetLang === 'en') {
      if (text.toLowerCase().includes('привет')) {
        translation = 'Hello';
      } else if (text.toLowerCase().includes('мир')) {
        translation = 'World';
      } else {
        translation = `[Translation to English]: ${text}`;
      }
    } else {
      translation = `[Перевод на ${targetLang}]: ${text}`;
    }
    
    return {
      success: true,
      translation: translation,
      detectedLanguage: text.length % 2 === 0 ? 'en' : 'ru' // Имитация определения языка
    };
  } catch (error) {
    console.error('Ошибка при переводе текста:', error);
    return { 
      success: false, 
      error: error.message
    };
  }
});

ipcMain.handle('get-translation-languages', async () => {
  try {
    // В реальном приложении это должен быть запрос к API для получения поддерживаемых языков
    // Возвращаем тестовый список языков
    return {
      success: true,
      languages: [
        { code: 'ru', name: 'Русский' },
        { code: 'en', name: 'Английский' },
        { code: 'de', name: 'Немецкий' },
        { code: 'fr', name: 'Французский' },
        { code: 'es', name: 'Испанский' },
        { code: 'it', name: 'Итальянский' },
        { code: 'zh', name: 'Китайский' },
        { code: 'ja', name: 'Японский' }
      ]
    };
  } catch (error) {
    console.error('Ошибка при получении списка языков:', error);
    return { success: false, error: error.message };
  }
});

// Функция для расчета скорости загрузки
function calculateSpeed(download) {
  const now = Date.now();
  const elapsed = (now - download.startTime) / 1000; // в секундах
  if (elapsed <= 0) return 0;
  
  const bytesPerSecond = download.receivedBytes / elapsed;
  return bytesPerSecond;
}

// Функция для форматирования размера файла
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

// Функция для форматирования времени
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}ч ${minutes % 60}м ${seconds % 60}с`;
  } else if (minutes > 0) {
    return `${minutes}м ${seconds % 60}с`;
  } else {
    return `${seconds}с`;
  }
}

// Обработчики для управления загрузками
ipcMain.handle('get-downloads', () => {
  // Преобразуем Map в массив и удаляем ссылку на объект item (не может быть сериализован)
  return Array.from(downloads.values()).map(download => {
    const { item, ...downloadData } = download;
    return {
      ...downloadData,
      formattedSize: formatFileSize(download.fileSize),
      formattedReceivedBytes: formatFileSize(download.receivedBytes),
      percent: download.fileSize > 0 ? (download.receivedBytes / download.fileSize) * 100 : 0,
      speed: formatFileSize(calculateSpeed(download)) + '/s'
    };
  });
});

ipcMain.handle('pause-download', (event, id) => {
  const download = downloads.get(id);
  if (download && download.item && download.status === 'progressing') {
    download.item.pause();
    download.status = 'paused';
    return { success: true };
  }
  return { success: false, error: 'Загрузка не найдена или не может быть приостановлена' };
});

ipcMain.handle('resume-download', (event, id) => {
  const download = downloads.get(id);
  if (download && download.item && download.status === 'paused') {
    download.item.resume();
    download.status = 'progressing';
    return { success: true };
  }
  return { success: false, error: 'Загрузка не найдена или не может быть возобновлена' };
});

ipcMain.handle('cancel-download', (event, id) => {
  const download = downloads.get(id);
  if (download && download.item && (download.status === 'progressing' || download.status === 'paused')) {
    download.item.cancel();
    download.status = 'cancelled';
    return { success: true };
  }
  return { success: false, error: 'Загрузка не найдена или не может быть отменена' };
});

ipcMain.handle('open-download-folder', (event, filePath) => {
  try {
    dialog.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    console.error('Ошибка при открытии папки с загрузкой:', error);
    return { success: false, error: error.message };
  }
});

// Добавляем IPC-обработчики для панели загрузок
ipcMain.handle('toggle-downloads-panel', (event, isVisible) => {
  appState.downloadsPanelVisible = isVisible !== undefined ? isVisible : !appState.downloadsPanelVisible;
  
  // Добавляем небольшую задержку для синхронизации с CSS-анимацией
  setTimeout(() => {
    updateBrowserViewBounds(appState.activeTabId);
  }, 50);
  
  return appState.downloadsPanelVisible;
});

ipcMain.handle('get-downloads-panel-visible', () => {
  return appState.downloadsPanelVisible;
});

// Добавляем IPC-обработчики для цветов
ipcMain.handle('get-custom-theme', () => {
  return appState.customTheme;
});

ipcMain.handle('toggle-custom-theme', (event, enabled) => {
  appState.customTheme.enabled = enabled;
  store.set('customTheme.enabled', enabled);
  return appState.customTheme;
});

ipcMain.handle('update-custom-theme', (event, theme) => {
  // Обновляем только переданные свойства
  if (theme.primaryColor) {
    appState.customTheme.primaryColor = theme.primaryColor;
    store.set('customTheme.primaryColor', theme.primaryColor);
  }
  if (theme.backgroundColor) {
    appState.customTheme.backgroundColor = theme.backgroundColor;
    store.set('customTheme.backgroundColor', theme.backgroundColor);
  }
  if (theme.textColor) {
    appState.customTheme.textColor = theme.textColor;
    store.set('customTheme.textColor', theme.textColor);
  }
  if (theme.headerColor) {
    appState.customTheme.headerColor = theme.headerColor;
    store.set('customTheme.headerColor', theme.headerColor);
  }
  
  return appState.customTheme;
});

ipcMain.handle('reset-custom-theme', () => {
  // Сбрасываем к значениям по умолчанию
  appState.customTheme = {
    enabled: false,
    primaryColor: '#0060df',
    backgroundColor: '#f0f0f4',
    textColor: '#15141a',
    headerColor: '#f9f9fb'
  };
  
  store.set('customTheme', appState.customTheme);
  return appState.customTheme;
});

// Функция для добавления записи в историю просмотра
function addToHistory(url, title) {
  // Игнорируем внутренние URL (стартовая страница, настройки и т.д.)
  if (url.startsWith('file://') || url.startsWith('about:') || url.startsWith('chrome://')) {
    return;
  }

  // Создаем запись истории
  const historyItem = {
    url,
    title: title || url,
    timestamp: Date.now()
  };

  // Удаляем дубликаты (если есть)
  appState.history = appState.history.filter(item => item.url !== url);
  
  // Добавляем новую запись в начало массива
  appState.history.unshift(historyItem);
  
  // Ограничиваем размер истории (например, 1000 записей)
  if (appState.history.length > 1000) {
    appState.history = appState.history.slice(0, 1000);
  }
  
  // Сохраняем историю в store
  store.set('history', appState.history);
  
  // Обновляем топ сайтов
  updateTopSites();
}

// Функция для обновления списка популярных сайтов
function updateTopSites() {
  // Создаем карту для подсчета посещений
  const siteVisits = new Map();
  
  // Подсчитываем посещения для каждого домена
  appState.history.forEach(item => {
    try {
      const domain = new URL(item.url).hostname;
      if (!siteVisits.has(domain)) {
        siteVisits.set(domain, { 
          url: item.url, 
          title: item.title, 
          visits: 1,
          lastVisit: item.timestamp
        });
      } else {
        const site = siteVisits.get(domain);
        site.visits += 1;
        // Обновляем название и URL если это более новое посещение
        if (item.timestamp > site.lastVisit) {
          site.title = item.title;
          site.url = item.url;
          site.lastVisit = item.timestamp;
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке URL:', error);
    }
  });
  
  // Преобразуем карту в массив и сортируем по количеству посещений
  appState.topSites = Array.from(siteVisits.values())
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 12); // Ограничиваем топ 12 сайтами
  
  // Сохраняем топ сайтов в store
  store.set('topSites', appState.topSites);
}
