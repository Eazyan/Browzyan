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
    adBlockEnabled: false
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
  adBlockEnabled: store.get('adBlockEnabled')
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

  // Добавляем обработчики событий для этой вкладки
  view.webContents.on('did-finish-load', () => {
    const currentUrl = view.webContents.getURL();
    const pageTitle = view.webContents.getTitle();

    // Обновляем данные вкладки
    const tabIndex = appState.tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex !== -1) {
      appState.tabs[tabIndex].url = currentUrl;
      appState.tabs[tabIndex].title = pageTitle;
      store.set('tabs', appState.tabs);
    }

    // Если это активная вкладка, сохраняем URL как последний посещенный
    if (appState.activeTabId === tabId) {
      appState.lastVisitedUrl = currentUrl;
      store.set('lastVisitedUrl', currentUrl);
      
      // Обновляем заголовок окна
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setTitle(`${pageTitle} - ${APP_NAME}`);
        
        // Отправляем сообщение в renderer процесс об окончании загрузки
        mainWindow.webContents.send('page-loaded', currentUrl);
      }
    }
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
  if (!browserViews[tabId] || !mainWindow) return;

  // Устанавливаем BrowserView для окна
  mainWindow.setBrowserView(browserViews[tabId]);
  
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
  
  return tabId;
}

// Закрытие вкладки
function closeTab(tabId) {
  if (!browserViews[tabId]) return;
  
  // Удаляем BrowserView
  const view = browserViews[tabId];
  delete browserViews[tabId];
  view.webContents.destroy();
  
  // Удаляем из списка вкладок
  appState.tabs = appState.tabs.filter(tab => tab.id !== tabId);
  store.set('tabs', appState.tabs);
  
  // Если закрыли активную вкладку, активируем другую
  if (appState.activeTabId === tabId && appState.tabs.length > 0) {
    activateTab(appState.tabs[0].id);
  } else if (appState.tabs.length === 0) {
    // Если нет вкладок, создаем новую
    const newTabId = createTab(nextTabId++, DEFAULT_SEARCH_URL);
    activateTab(newTabId);
    
    // Добавляем в список вкладок
    appState.tabs.push({ id: newTabId, url: DEFAULT_SEARCH_URL, title: 'Яндекс' });
    store.set('tabs', appState.tabs);
  }
  
  return appState.tabs;
}

// Обновление границ browserView в зависимости от видимости боковой панели и других элементов
function updateBrowserViewBounds(tabId) {
  if (!mainWindow || !browserViews[tabId]) return;
  
  const bounds = mainWindow.getContentBounds();
  const topOffset = 120; // Высота верхней панели с URL и вкладками
  let leftOffset = appState.sidebarVisible ? 250 : 0; // Ширина боковой панели
  
  browserViews[tabId].setBounds({ 
    x: leftOffset, 
    y: topOffset, 
    width: bounds.width - leftOffset, 
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
    return { success: true, url: activeView.webContents.getURL() };
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
  const tabId = nextTabId++;
  createTab(tabId, url || DEFAULT_SEARCH_URL);
  
  // Добавляем в список вкладок
  appState.tabs.push({ id: tabId, url: url || DEFAULT_SEARCH_URL, title: 'Новая вкладка' });
  store.set('tabs', appState.tabs);
  
  // Активируем новую вкладку
  activateTab(tabId);
  
  return { id: tabId, tabs: appState.tabs };
});

ipcMain.handle('close-tab', async (event, tabId) => {
  const tabs = closeTab(tabId);
  return { activeTabId: appState.activeTabId, tabs };
});

ipcMain.handle('switch-tab', async (event, tabId) => {
  activateTab(tabId);
  return { activeTabId: appState.activeTabId, tabs: appState.tabs };
});

ipcMain.handle('get-tabs', async () => {
  return { activeTabId: appState.activeTabId, tabs: appState.tabs };
});

ipcMain.handle('reorder-tabs', async (event, fromIndex, toIndex) => {
  // Переупорядочиваем вкладки в состоянии
  const tab = appState.tabs.splice(fromIndex, 1)[0];
  appState.tabs.splice(toIndex, 0, tab);
  
  // Сохраняем изменения
  store.set('tabs', appState.tabs);
  
  return { tabs: appState.tabs };
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
  // Здесь будет логика анализа посещений из истории
  // Временная заглушка с примерами
  return [
    { url: 'https://yandex.ru', title: 'Яндекс', visits: 42 },
    { url: 'https://github.com', title: 'GitHub', visits: 28 },
    { url: 'https://vk.com', title: 'ВКонтакте', visits: 24 },
    { url: 'https://youtube.com', title: 'YouTube', visits: 19 },
    { url: 'https://habr.com', title: 'Хабр', visits: 15 }
  ];
});

// Получение недавней истории
ipcMain.handle('get-recent-history', () => {
  // Здесь будет логика получения истории
  // Временная заглушка с примерами
  return [
    { url: 'https://habr.com/ru/articles/697090/', title: 'Создание Electron приложения: подробное руководство', timestamp: Date.now() - 30 * 60 * 1000 },
    { url: 'https://yandex.ru/news', title: 'Яндекс.Новости', timestamp: Date.now() - 2 * 60 * 60 * 1000 },
    { url: 'https://github.com/electron/electron', title: 'electron/electron: Build cross-platform desktop apps with JavaScript, HTML, and CSS', timestamp: Date.now() - 5 * 60 * 60 * 1000 },
    { url: 'https://www.electronjs.org/docs/latest/', title: 'Документация Electron', timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000 },
    { url: 'https://developer.mozilla.org/en-US/docs/Web/API', title: 'Web APIs | MDN', timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000 }
  ];
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
