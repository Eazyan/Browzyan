const { BrowserView } = require('electron');
const path = require('path');
const { get, set, DEFAULT_SEARCH_URL, appState } = require('./storage');

// Глобальные переменные
let mainWindow;
let browserViews = {}; // Хранение всех BrowserView для вкладок
let nextTabId = 2; // Начальный ID для новых вкладок
let blocker = null; // Ссылка на блокировщик рекламы

// Константы путей
const STARTPAGE_HTML_PATH = path.join(__dirname, '../../assets/pages/startpage.html');

// Установка ссылок на объекты
function init(window, adBlocker) {
  mainWindow = window;
  blocker = adBlocker;
  
  // Инициализация browserViews из сохраненных вкладок
  const tabs = get('tabs');
  tabs.forEach(tab => {
    createTab(tab.id, tab.url);
  });

  // Активируем активную вкладку
  const activeTabId = get('activeTabId');
  if (browserViews[activeTabId]) {
    activateTab(activeTabId);
  } else if (tabs.length > 0) {
    // Если активной вкладки нет, активируем первую
    activateTab(tabs[0].id);
  } else {
    // Если нет сохраненных вкладок, создаем новую
    const newTabId = createTab(nextTabId++, DEFAULT_SEARCH_URL);
    activateTab(newTabId);
  }
  
  return { browserViews };
}

// Функция для получения активной вкладки
function getActiveView() {
  return browserViews[appState.activeTabId];
}

// Создание новой вкладки
function createTab(tabId, tabUrl) {
  console.log(`Вызов createTab с ID: ${tabId}, URL: ${tabUrl}`);
  
  if (!mainWindow) {
    console.error('Ошибка: mainWindow не инициализирован');
    return tabId;
  }

  try {
    // Создаем BrowserView для вкладки
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, '../../preload.js') // Исправляем путь к preload.js
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
      const tabs = get('tabs');
      tabs.push(newTab);
      set('tabs', tabs);
      
      // Отправляем событие о создании вкладки
      console.log('Отправка события tab-created', newTab);
      mainWindow.webContents.send('tab-created', newTab);
      
      // Дублируем событие для IPC API (tabs:created)
      mainWindow.webContents.send('tabs:created', newTab);
      
      // Создаем новую вкладку
      createTab(newTabId, url);
      
      // Активируем новую вкладку
      activateTab(newTabId);
      
      // Предотвращаем открытие нового окна
      return { action: 'deny' };
    });

    // Загружаем URL, если передан, иначе открываем стартовую страницу
    if (tabUrl) {
      console.log(`Загрузка URL: ${tabUrl} в вкладку ${tabId}`);
      view.webContents.loadURL(tabUrl).catch(error => {
        console.error(`Ошибка загрузки URL ${tabUrl}:`, error);
        // Пытаемся загрузить стартовую страницу при ошибке
        try {
          view.webContents.loadFile(STARTPAGE_HTML_PATH);
        } catch (fallbackError) {
          console.error('Ошибка загрузки стартовой страницы:', fallbackError);
        }
      });
    } else {
      console.log(`Загрузка стартовой страницы в вкладку ${tabId}`);
      view.webContents.loadFile(STARTPAGE_HTML_PATH).catch(error => {
        console.error('Ошибка загрузки стартовой страницы:', error);
      });
    }

    console.log(`Вкладка ${tabId} успешно создана`);
    return tabId;
  } catch (error) {
    console.error(`Ошибка создания вкладки ${tabId}:`, error);
    return tabId;
  }
}

// Активация вкладки
function activateTab(tabId) {
  console.log(`Вызов activateTab с ID: ${tabId}`);
  
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
    set('activeTabId', tabId);
    
    // Обновляем заголовок окна
    const tabs = get('tabs');
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex !== -1 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(`${tabs[tabIndex].title} - ${get('APP_NAME')}`);
    }
    
    // Обновляем размеры и позицию BrowserView
    updateBrowserViewBounds(tabId);
    
    // Отправляем событие о смене вкладки
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('Отправка события tab-changed', tabId);
      mainWindow.webContents.send('tab-changed', tabId);
      
      // Дублируем событие для IPC API (tabs:activated)
      mainWindow.webContents.send('tabs:activated', tabId);
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
  // Преобразуем ID к числу для корректного сравнения
  tabId = parseInt(tabId, 10);
  console.log(`Вызов closeTab с ID: ${tabId}`);
  
  // Проверка параметров
  if (isNaN(tabId) || !browserViews[tabId]) {
    console.error('Ошибка закрытия вкладки: вкладка не найдена', tabId);
    return appState.tabs;
  }
  
  try {
    const tabs = get('tabs');
    // Если это активная вкладка, сначала активируем другую
    const isActiveTab = appState.activeTabId === tabId;
    
    // Найдем индекс в массиве вкладок
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) {
      console.error('Ошибка закрытия вкладки: вкладка не найдена в списке', tabId);
      return tabs;
    }
    
    // Находим новую вкладку для активации, если закрываем активную
    let newActiveTabId = appState.activeTabId;
    if (isActiveTab) {
      // Пытаемся активировать предыдущую вкладку в списке
      if (tabIndex > 0) {
        newActiveTabId = tabs[tabIndex - 1].id;
      } 
      // Если нет предыдущей, то пытаемся активировать следующую
      else if (tabIndex < tabs.length - 1) {
        newActiveTabId = tabs[tabIndex + 1].id;
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
    const updatedTabs = tabs.filter(tab => tab.id !== tabId);
    set('tabs', updatedTabs);
    
    // Обрабатываем случай, когда были закрыты все вкладки
    if (updatedTabs.length === 0) {
      // Если нет вкладок, создаем новую
      const newTabId = createTab(nextTabId++, DEFAULT_SEARCH_URL);
      updatedTabs.push({ id: newTabId, url: DEFAULT_SEARCH_URL, title: 'Новая вкладка' });
      set('tabs', updatedTabs);
      
      // Активируем новую вкладку
      activateTab(newTabId);
    } 
    // Если мы закрыли активную вкладку, активируем выбранную новую
    else if (isActiveTab && newActiveTabId !== null) {
      activateTab(newActiveTabId);
    }
    
    // Отправляем уведомление об удалении вкладки
    console.log(`Отправка события tabs:removed для вкладки ${tabId}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tabs:removed', tabId);
    }
    
    console.log(`Закрыта вкладка ${tabId}, осталось ${updatedTabs.length} вкладок`);
    return updatedTabs;
  } catch (error) {
    console.error('Непредвиденная ошибка при закрытии вкладки:', error);
    return get('tabs');
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

// Экспорт функций
module.exports = {
  init,
  createTab,
  activateTab,
  closeTab,
  getActiveView,
  updateBrowserViewBounds,
  browserViews
}; 