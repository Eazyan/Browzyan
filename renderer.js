// Получение элементов DOM - базовые элементы управления
const urlForm = document.getElementById('urlForm');
const urlInput = document.getElementById('urlInput');
const backButton = document.getElementById('backButton');
const forwardButton = document.getElementById('forwardButton');
const refreshButton = document.getElementById('refreshButton');
const bookmarkButton = document.getElementById('bookmarkButton');
const focusModeButton = document.getElementById('focusModeButton');
const themeButton = document.getElementById('themeButton');
const sidebarButton = document.getElementById('sidebarButton');
const closeSidebarButton = document.getElementById('closeSidebarButton');
const sidebar = document.getElementById('sidebar');
const bookmarksList = document.getElementById('bookmarksList');

// Получение элементов DOM - настройки
const darkModeToggle = document.getElementById('darkModeToggle');
const focusModeToggle = document.getElementById('focusModeToggle');
const adBlockToggle = document.getElementById('adBlockToggle');

// Получение элементов DOM - вкладки
const tabsList = document.getElementById('tabsList');
const newTabButton = document.getElementById('newTabButton');

// Получение элементов DOM - режим чтения
const readerModeButton = document.getElementById('readerModeButton');
const readerModeContainer = document.getElementById('readerModeContainer');
const closeReaderButton = document.getElementById('closeReaderButton');
const readerTitle = document.getElementById('readerTitle');
const readerDomain = document.getElementById('readerDomain');
const readerContent = document.getElementById('readerContent');
const readerModeSettings = document.getElementById('readerModeSettings');

// Настройки режима чтения
const decreaseFontButton = document.getElementById('decreaseFontButton');
const increaseFontButton = document.getElementById('increaseFontButton');
const lightThemeButton = document.getElementById('lightThemeButton');
const sepiaThemeButton = document.getElementById('sepiaThemeButton');
const darkThemeButton = document.getElementById('darkThemeButton');
const lineWidthRange = document.getElementById('lineWidthRange');
const lineHeightRange = document.getElementById('lineHeightRange');

// Элементы настройки цветов
const useDefaultThemesToggle = document.getElementById('useDefaultThemes');
const customColorsContainer = document.getElementById('customColorsContainer');
const primaryColorPicker = document.getElementById('primaryColorPicker');
const bgColorPicker = document.getElementById('bgColorPicker');
const textColorPicker = document.getElementById('textColorPicker');
const headerBgPicker = document.getElementById('headerBgPicker');
const resetColorsButton = document.getElementById('resetColorsButton');

// Поисковая система по умолчанию
let defaultSearchUrl = 'https://ya.ru';
let defaultSearchQueryUrl = 'https://yandex.ru/search/?text=';

// Состояние для перетаскивания вкладок
let draggedTabId = null;
let draggedTabElement = null;
let dragStartIndex = -1;

// Состояние приложения
let appState = {
  darkMode: false,
  focusMode: false,
  bookmarks: [],
  sidebarVisible: false,
  tabs: [],
  activeTabId: null,
  adBlockEnabled: false
};

// Флаг для отслеживания загрузки страницы
let isPageLoading = false;

// Состояние режима чтения
let readerModeActive = false;
let readerSettings = {
  fontSize: 18,
  lineHeight: 1.5,
  lineWidth: 70,
  theme: 'light'
};

// Элементы для загрузок
const downloadsButton = document.getElementById('downloadsButton');
const downloadsPanel = document.getElementById('downloadsPanel');
const closeDownloadsButton = document.getElementById('closeDownloadsButton');
const downloadsList = document.getElementById('downloadsList');

// Отслеживаем текущие загрузки
const activeDownloads = new Map();

// Элементы интерфейса
const historyButton = document.getElementById('historyButton');

// Инициализация подписки на события
function initEventSubscriptions() {
  // Предотвращаем повторную регистрацию
  if (window.eventsInitialized) return;
  window.eventsInitialized = true;

  console.log('Инициализация обработчиков событий');

  // Улучшенный обработчик для кнопки новой вкладки
  newTabButton.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Предотвращаем быстрые повторные клики
    const now = Date.now();
    if (window.lastNewTabClick && (now - window.lastNewTabClick < 500)) {
      console.log('Игнорируем быстрый повторный клик на кнопке новой вкладки');
      return;
    }
    window.lastNewTabClick = now;
    
    // Визуальная обратная связь
    newTabButton.classList.add('clicked');
    setTimeout(() => {
      newTabButton.classList.remove('clicked');
    }, 300);
    
    console.log('Клик по кнопке новой вкладки');
    await openNewTab();
  });

  // Обновлённые обработчики для кнопок навигации
  backButton.addEventListener('click', async () => {
    // Предотвращаем быстрые повторные клики
    const now = Date.now();
    if (window.lastBackClick && (now - window.lastBackClick < 300)) return;
    window.lastBackClick = now;
    
    const canGoBack = await window.electronAPI.goBack();
    backButton.disabled = !canGoBack;
    updateAddressBar();
  });

  forwardButton.addEventListener('click', async () => {
    // Предотвращаем быстрые повторные клики
    const now = Date.now();
    if (window.lastForwardClick && (now - window.lastForwardClick < 300)) return;
    window.lastForwardClick = now;
    
    const canGoForward = await window.electronAPI.goForward();
    forwardButton.disabled = !canGoForward;
    updateAddressBar();
  });

  refreshButton.addEventListener('click', async () => {
    // Предотвращаем быстрые повторные клики
    const now = Date.now();
    if (window.lastRefreshClick && (now - window.lastRefreshClick < 500)) return;
    window.lastRefreshClick = now;
    
    await window.electronAPI.reload();
  });

  // Остальные обработчики без изменений
  // ...
  
  // Загружаем конфигурацию поиска
  loadSearchSettings();
  
  // Регистрируем события из основного процесса
  window.electronAPI.onPageLoaded((url) => {
    updateAddressBar();
    updateNavigationButtons();
    isPageLoading = false;
  });

  window.electronAPI.onTabsUpdated((tabs) => {
    console.log('Получено обновление списка вкладок из main процесса:', tabs.length);
    appState.tabs = tabs;
    renderTabs();
  });

  window.electronAPI.onTabChanged((tabId) => {
    console.log('Получено событие изменения активной вкладки из main процесса:', tabId);
    appState.activeTabId = tabId;
    renderTabs();
    updateAddressBar();
    updateNavigationButtons();
  });

  // Остальные обработчики
  // ...
}

// Загрузка настроек поиска
async function loadSearchSettings() {
  try {
    const searchSettings = await window.electronAPI.getDefaultSearch();
    defaultSearchUrl = searchSettings.url;
    defaultSearchQueryUrl = searchSettings.queryUrl;
  } catch (error) {
    console.error('Ошибка при загрузке настроек поиска:', error);
  }
}

// Загрузка состояния приложения
async function loadAppState() {
  appState = await window.electronAPI.getAppState();
  
  // Загружаем информацию о вкладках
  const tabsInfo = await window.electronAPI.getTabs();
  appState.tabs = tabsInfo.tabs;
  appState.activeTabId = tabsInfo.activeTabId;
  
  // Обновляем UI
  updateUI();
  renderTabs();
}

// Функция обновления интерфейса в соответствии с настройками
async function updateUI() {
  try {
    const state = await window.electronAPI.getAppState();
    appState = state; // Обновляем локальную копию состояния
    
    // Темная тема
    if (state.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    darkModeToggle.checked = state.darkMode;
    
    // После установки темы проверяем, нужно ли применить пользовательские цвета
    const customTheme = await window.electronAPI.getCustomTheme();
    if (customTheme.enabled) {
      applyCustomColors(customTheme);
    }
    
    // Режим фокусировки
    if (state.focusMode) {
      document.body.classList.add('focus-mode');
    } else {
      document.body.classList.remove('focus-mode');
    }
    focusModeToggle.checked = state.focusMode;
    
    // Боковая панель
    if (state.sidebarVisible) {
      sidebar.classList.add('visible');
    } else {
      sidebar.classList.remove('visible');
    }
    
    // Обновление состояния блокировки рекламы
    adBlockToggle.checked = state.adBlockEnabled;
    
    // Отображение закладок
    renderBookmarks();
  } catch (error) {
    console.error('Ошибка при обновлении интерфейса:', error);
  }
}

// Отображение закладок
function renderBookmarks() {
  bookmarksList.innerHTML = '';
  appState.bookmarks.forEach(bookmark => {
    const bookmarkItem = document.createElement('div');
    bookmarkItem.className = 'bookmark-item';
    
    const title = document.createElement('span');
    title.className = 'bookmark-title';
    title.textContent = bookmark.title;
    title.title = bookmark.url; // добавляем подсказку с URL
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'icon-button';
    deleteButton.textContent = '✕';
    deleteButton.title = 'Удалить закладку';
    deleteButton.onclick = (e) => {
      e.stopPropagation(); // Останавливаем распространение события
      removeBookmark(bookmark.url);
    };
    
    bookmarkItem.appendChild(title);
    bookmarkItem.appendChild(deleteButton);
    
    // Добавление обработчика клика для перехода по закладке
    bookmarkItem.addEventListener('click', event => {
      if (event.target !== deleteButton) {
        navigateToUrl(bookmark.url);
      }
    });
    
    bookmarksList.appendChild(bookmarkItem);
  });
}

// Отображение вкладок
function renderTabs() {
  console.log('Рендеринг вкладок, текущее состояние:', {
    activeTabId: appState.activeTabId,
    tabsCount: appState.tabs.length,
    tabs: appState.tabs.map(t => ({ id: t.id, title: t.title }))
  });
  
  // Очищаем контейнер перед добавлением новых элементов
  tabsList.innerHTML = '';

  // Установка глобального обработчика для предотвращения двойного выделения
  if (!window.tabsHandlerInitialized) {
    window.addEventListener('click', function(e) {
      // Находим ближайший родительский элемент с классом 'tab'
      const tabEl = e.target.closest('.tab');
      
      // Если клик не по вкладке или уже обрабатывается другим обработчиком, выходим
      if (!tabEl || e.tabHandled) return;
      
      // Помечаем клик как обработанный для предотвращения двойной обработки
      e.tabHandled = true;
      
      // Получаем tabId из атрибута данных
      const tabId = parseInt(tabEl.dataset.tabId, 10);
      
      // Проверяем, что клик был не на крестике закрытия
      const closeBtn = tabEl.querySelector('.tab-close');
      if (e.target === closeBtn || closeBtn.contains(e.target)) {
        console.log('Клик на крестик, пропускаем обработку переключения вкладки');
        return;
      }
      
      // Проверка времени, чтобы предотвратить множественные клики
      const now = Date.now();
      if (window.lastTabClickTime && (now - window.lastTabClickTime < 300)) {
        console.log('Слишком быстрый повторный клик, игнорируем');
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // Запоминаем время клика
      window.lastTabClickTime = now;
      window.lastClickedTabId = tabId;
      
      // Проверяем, что вкладка не является активной
      if (tabId === appState.activeTabId) {
        console.log('Клик на уже активную вкладку, игнорируем');
        return;
      }
      
      console.log(`Переключение на вкладку ${tabId} через глобальный обработчик`);
      switchTab(tabId);
    }, true); // Захватывающая фаза для обработки до других обработчиков
    
    window.tabsHandlerInitialized = true;
  }
  
  // Перебираем вкладки и создаем элементы
  appState.tabs.forEach((tab, index) => {
    // Создаем элемент вкладки с уникальным классом на основе tabId
    const tabElement = document.createElement('div');
    tabElement.className = `tab tab-${tab.id}`;
    tabElement.setAttribute('data-tab-id', tab.id);
    tabElement.setAttribute('data-index', index);
    
    // Устанавливаем класс active для активной вкладки
    if (tab.id === appState.activeTabId) {
      tabElement.classList.add('active');
    }
    
    // Создаем содержимое вкладки
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || 'Новая вкладка';
    
    // Создаем кнопку закрытия
    const closeButton = document.createElement('button');
    closeButton.className = 'tab-close';
    closeButton.setAttribute('title', 'Закрыть вкладку');
    closeButton.dataset.tabId = tab.id; // Добавляем дополнительный атрибут для надежности
    closeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
      </svg>
    `;
    
    // Добавляем элементы в DOM
    tabElement.appendChild(title);
    tabElement.appendChild(closeButton);
    
    // Обработчик только для кнопки закрытия
    closeButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.tabHandled = true; // Предотвращаем обработку глобальным обработчиком
      
      const tabIdToClose = parseInt(this.dataset.tabId, 10);
      console.log(`Закрытие вкладки ${tabIdToClose} через кнопку закрытия`);
      
      // Защита от быстрых кликов
      const now = Date.now();
      if (window.lastCloseClickTime && (now - window.lastCloseClickTime < 300)) {
        console.log('Слишком быстрый повторный клик на закрытие, игнорируем');
        return;
      }
      window.lastCloseClickTime = now;
      
      // Добавляем класс closing для анимации
      tabElement.classList.add('closing');
      
      // Небольшая задержка для анимации
      setTimeout(() => {
        closeTab(tabIdToClose);
      }, 100);
    });
    
    // Настройка drag-and-drop
    setupTabDragAndDrop(tabElement, tab, index);
    
    // Добавляем вкладку в список
    tabsList.appendChild(tabElement);
  });
  
  // Регистрируем элементы вкладок для отладки
  console.log('Отрендерены вкладки:', document.querySelectorAll('.tab').length);
}

// Выносим логику drag-and-drop в отдельную функцию для улучшения читаемости
function setupTabDragAndDrop(tabElement, tab, index) {
  tabElement.setAttribute('draggable', 'true');
  
  tabElement.addEventListener('dragstart', (e) => {
    // Проверяем, не было ли недавно клика для предотвращения случайного drag&drop
    if (Date.now() - window.lastTabClickTime < 200) {
      e.preventDefault();
      return;
    }
    
    draggedTabId = tab.id;
    draggedTabElement = tabElement;
    dragStartIndex = index;
    
    // Визуальный эффект
    setTimeout(() => tabElement.classList.add('dragging'), 0);
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
    
    console.log(`Начато перетаскивание вкладки ${tab.id}`);
  });
  
  tabElement.addEventListener('dragend', () => {
    if (draggedTabElement) {
      draggedTabElement.classList.remove('dragging');
    }
    
    draggedTabId = null;
    draggedTabElement = null;
    dragStartIndex = -1;
    
    // Удаляем индикаторы
    document.querySelectorAll('.tab-drop-indicator').forEach(el => el.remove());
    
    console.log('Завершено перетаскивание вкладки');
  });
  
  tabElement.addEventListener('dragover', (e) => {
    e.preventDefault(); // Необходимо для разрешения drop
    
    // Если это та же вкладка, которую мы перетаскиваем, ничего не делаем
    if (draggedTabId === tab.id) return;
    
    // Определяем, куда вставлять: слева или справа
    const rect = tabElement.getBoundingClientRect();
    const midPoint = rect.left + rect.width / 2;
    const insertBefore = e.clientX < midPoint;
    
    // Показываем индикатор
    showDropIndicator(tabElement, insertBefore);
  });
  
  tabElement.addEventListener('dragleave', () => {
    // Удаляем индикатор при выходе мыши
    document.querySelectorAll('.tab-drop-indicator').forEach(el => el.remove());
  });
  
  tabElement.addEventListener('drop', async (e) => {
    e.preventDefault();
    
    if (draggedTabId !== tab.id && dragStartIndex !== -1) {
      // Определяем позицию вставки
      const rect = tabElement.getBoundingClientRect();
      const midPoint = rect.left + rect.width / 2;
      const insertBefore = e.clientX < midPoint;
      
      // Вычисляем новый индекс
      let newIndex = index;
      if (!insertBefore) newIndex++;
      if (dragStartIndex < newIndex) newIndex--;
      
      console.log(`Перемещение вкладки с позиции ${dragStartIndex} на позицию ${newIndex}`);
      
      // Вызываем метод для переупорядочивания
      await window.electronAPI.reorderTabs(dragStartIndex, newIndex);
      
      // Обновляем состояние и перерисовываем
      const tabsInfo = await window.electronAPI.getTabs();
      appState.tabs = tabsInfo.tabs;
      renderTabs();
    }
    
    // Удаляем индикаторы
    document.querySelectorAll('.tab-drop-indicator').forEach(el => el.remove());
  });
}

// Показать индикатор вставки при перетаскивании
function showDropIndicator(tabElement, insertBefore) {
  // Удаляем все существующие индикаторы
  document.querySelectorAll('.tab-drop-indicator').forEach(el => el.remove());
  
  // Создаем новый индикатор
  const indicator = document.createElement('div');
  indicator.className = 'tab-drop-indicator';
  
  // Размещаем индикатор
  if (insertBefore) {
    indicator.style.left = tabElement.offsetLeft + 'px';
  } else {
    indicator.style.left = (tabElement.offsetLeft + tabElement.offsetWidth) + 'px';
  }
  
  // Добавляем индикатор
  tabsList.appendChild(indicator);
}

// Открытие новой вкладки
async function openNewTab(url) {
  // Предотвращаем многократное выполнение операции открытия вкладки
  if (window.isProcessingTabOpen) {
    console.log(`Уже идет процесс открытия вкладки, запрос на открытие новой вкладки отклонен`);
    return;
  }

  try {
    // Устанавливаем флаг блокировки операций открытия
    window.isProcessingTabOpen = true;
    
    console.log(`Начало процесса открытия новой вкладки с URL: ${url || 'пустой'}`);
    
    // Добавляем обработку URL
    const processedUrl = url ? prepareUrl(url) : null;
    
    // Ожидаем результат от main процесса
    console.log(`Отправка запроса в main процесс на открытие новой вкладки`);
    const result = await window.electronAPI.openTab(processedUrl);
    
    // Проверяем результат и обновляем состояние
    if (result && result.id) {
      console.log(`Успешно открыта новая вкладка с ID ${result.id}`);
      
      appState.tabs = result.tabs;
      appState.activeTabId = result.id;
      
      // Обновляем интерфейс
      renderTabs();
      updateAddressBar();
      updateNavigationButtons();
      
      return result.id;
    } else if (result && result.error) {
      console.error(`Ошибка при открытии новой вкладки:`, result.error);
    } else {
      console.error('Не удалось получить корректный результат при открытии вкладки');
    }
  } catch (error) {
    console.error('Ошибка при открытии новой вкладки:', error);
  } finally {
    // Сбрасываем флаг через некоторое время
    setTimeout(() => {
      window.isProcessingTabOpen = false;
      console.log('Завершена операция открытия вкладки, снят флаг блокировки');
    }, 300);
  }
}

// Закрытие вкладки
async function closeTab(tabId) {
  // Предотвращаем многократное выполнение операции закрытия
  if (window.isProcessingTabClose) {
    console.log(`Уже идет процесс закрытия вкладки, запрос на закрытие вкладки ${tabId} отклонен`);
    return;
  }

  // Проверяем валидность tabId
  if (!tabId || typeof tabId !== 'number') {
    console.error('Ошибка при закрытии вкладки: некорректный tabId', tabId);
    return;
  }
  
  // Проверяем существование вкладки
  const tabExists = appState.tabs.some(tab => tab.id === tabId);
  if (!tabExists) {
    console.error('Попытка закрыть несуществующую вкладку:', tabId);
    return;
  }
  
  try {
    // Устанавливаем флаг блокировки операций с вкладками
    window.isProcessingTabClose = true;
    
    console.log(`Начало процесса закрытия вкладки ${tabId}`);
    
    // Добавляем визуальную обратную связь всем элементам с этим tabId
    document.querySelectorAll(`.tab[data-tab-id="${tabId}"]`).forEach(el => {
      el.classList.add('closing');
      // Убираем обработчики событий
      el.style.pointerEvents = 'none';
    });
    
    // Небольшая задержка для анимации
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Ожидаем результат от main процесса
    console.log(`Отправка запроса в main процесс на закрытие вкладки ${tabId}`);
    const result = await window.electronAPI.closeTab(tabId);
    
    // Проверяем результат и обновляем состояние
    if (result && result.tabs) {
      console.log(`Успешно закрыта вкладка ${tabId}, осталось ${result.tabs.length} вкладок`);
      console.log(`Новая активная вкладка: ${result.activeTabId}`);
      
      appState.tabs = result.tabs;
      appState.activeTabId = result.activeTabId;
      
      // Обновляем интерфейс
      renderTabs();
      updateAddressBar();
      updateNavigationButtons();
    } else if (result && result.error) {
      console.error(`Ошибка при закрытии вкладки ${tabId}:`, result.error);
    } else {
      console.error('Не удалось получить корректный результат при закрытии вкладки');
    }
  } catch (error) {
    console.error(`Ошибка при закрытии вкладки ${tabId}:`, error);
  } finally {
    // Сбрасываем флаг через некоторое время, чтобы предотвратить повторные клики
    setTimeout(() => {
      window.isProcessingTabClose = false;
      console.log('Завершена операция закрытия вкладки, снят флаг блокировки');
    }, 300);
  }
}

// Переключение на вкладку
async function switchTab(tabId) {
  // Предотвращаем многократное выполнение операции переключения
  if (window.isProcessingTabSwitch) {
    console.log(`Уже идет процесс переключения вкладки, запрос на переключение на вкладку ${tabId} отклонен`);
    return;
  }

  // Проверяем валидность tabId
  if (!tabId || typeof tabId !== 'number') {
    console.error('Ошибка при переключении вкладки: некорректный tabId', tabId);
    return;
  }
  
  // Проверяем существование вкладки
  const tabExists = appState.tabs.some(tab => tab.id === tabId);
  if (!tabExists) {
    console.error('Попытка переключиться на несуществующую вкладку:', tabId);
    return;
  }
  
  // Предотвращаем повторное переключение на активную вкладку
  if (tabId === appState.activeTabId) {
    console.log('Вкладка уже активна:', tabId);
    return;
  }
  
  // Если в данный момент идет закрытие вкладки, пропускаем переключение
  if (window.isProcessingTabClose) {
    console.log('Операция переключения отменена: идет процесс закрытия вкладки');
    return;
  }

  try {
    // Устанавливаем флаг блокировки операций с вкладками
    window.isProcessingTabSwitch = true;
    
    console.log(`Начало процесса переключения на вкладку ${tabId}`);
    
    // Удаляем класс 'active' у всех вкладок для предотвращения двойной активации
    document.querySelectorAll('.tab.active').forEach(el => {
      el.classList.remove('active');
    });
    
    // Активируем новую вкладку в UI
    const newActiveTab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (newActiveTab) {
      newActiveTab.classList.add('active');
    }
    
    // Блокируем кнопки на время переключения
    document.querySelectorAll('.tab').forEach(el => {
      el.style.pointerEvents = 'none';
    });
    
    // Ожидаем результат от main процесса
    console.log(`Отправка запроса в main процесс на переключение на вкладку ${tabId}`);
    const result = await window.electronAPI.switchTab(tabId);
    
    // Проверяем результат и обновляем состояние
    if (result && typeof result.activeTabId === 'number') {
      console.log(`Успешное переключение на вкладку ${result.activeTabId}`);
      
      appState.activeTabId = result.activeTabId;
      
      // Обновляем интерфейс
      renderTabs();
      updateAddressBar();
      updateNavigationButtons();
    } else if (result && result.error) {
      console.error(`Ошибка при переключении на вкладку ${tabId}:`, result.error);
    } else {
      console.error('Не удалось получить корректный результат при переключении вкладки');
    }
  } catch (error) {
    console.error(`Ошибка при переключении на вкладку ${tabId}:`, error);
  } finally {
    // Разблокируем кнопки
    document.querySelectorAll('.tab').forEach(el => {
      el.style.pointerEvents = 'auto';
    });
    
    // Сбрасываем флаг через некоторое время, чтобы предотвратить повторные клики
    setTimeout(() => {
      window.isProcessingTabSwitch = false;
      console.log('Завершена операция переключения вкладки, снят флаг блокировки');
    }, 300);
  }
}

// Обновление URL в адресной строке при изменении страницы
async function updateAddressBar() {
  try {
    const navState = await window.electronAPI.checkNavigation();
    urlInput.value = navState.currentUrl;
    
    // Обновление состояния кнопок навигации
    backButton.disabled = !navState.canGoBack;
    forwardButton.disabled = !navState.canGoForward;
    
    // Обновление состояния кнопки закладок
    const isBookmarked = appState.bookmarks.some(bookmark => bookmark.url === navState.currentUrl);
    bookmarkButton.textContent = isBookmarked ? '★' : '☆';
    bookmarkButton.style.color = isBookmarked ? '#FFD700' : '';
    
    // Обновление заголовка вкладки
    const tabIndex = appState.tabs.findIndex(tab => tab.id === appState.activeTabId);
    if (tabIndex !== -1) {
      renderTabs();
    }
  } catch (error) {
    console.error('Ошибка обновления адресной строки:', error);
  }
}

// Обновление состояния кнопок навигации
async function updateNavigationButtons() {
  try {
    const navState = await window.electronAPI.checkNavigation();
    backButton.disabled = !navState.canGoBack;
    forwardButton.disabled = !navState.canGoForward;
  } catch (error) {
    console.error('Ошибка обновления кнопок навигации:', error);
  }
}

// Функция для навигации
async function navigateToUrl(url) {
  if (isPageLoading) return;
  isPageLoading = true;
  
  try {
    const result = await window.electronAPI.navigate(url);
    
    if (!result.success) {
      console.error('Ошибка навигации:', result.error);
      isPageLoading = false;
    }
  } catch (error) {
    console.error('Непредвиденная ошибка навигации:', error);
    isPageLoading = false;
  }
}

// Подготавливаем URL для навигации
function prepareUrl(inputUrl) {
  let url = inputUrl.trim();
  
  // Проверяем, является ли ввод URL-адресом
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Если нет http/https, предполагаем, что это поисковый запрос
    if (/^[\w-]+\.\w+/.test(url)) {
      // Если похоже на домен (например, example.com), добавляем https://
      url = 'https://' + url;
    } else {
      // Иначе выполняем поиск в Яндексе
      url = defaultSearchQueryUrl + encodeURIComponent(url);
    }
  }
  
  return url;
}

// Обработка отправки формы URL
urlForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const url = prepareUrl(urlInput.value);
  navigateToUrl(url);
});

// Обработчики кнопок навигации
backButton.addEventListener('click', async () => {
  await window.electronAPI.goBack();
});

forwardButton.addEventListener('click', async () => {
  await window.electronAPI.goForward();
});

refreshButton.addEventListener('click', async () => {
  await window.electronAPI.refresh();
});

// Обработчик кнопки новой вкладки
newTabButton.addEventListener('click', () => {
  openNewTab();
});

// Обработчик кнопки закладок
bookmarkButton.addEventListener('click', async () => {
  const navState = await window.electronAPI.checkNavigation();
  const url = navState.currentUrl;
  const title = urlInput.value.trim();
  
  const isBookmarked = appState.bookmarks.some(bookmark => bookmark.url === url);
  
  if (isBookmarked) {
    // Удаляем закладку
    appState.bookmarks = await window.electronAPI.removeBookmark(url);
  } else {
    // Добавляем закладку
    const bookmark = { url, title: title || url };
    appState.bookmarks = await window.electronAPI.addBookmark(bookmark);
  }
  
  updateAddressBar();
  renderBookmarks();
});

// Функция удаления закладки
async function removeBookmark(url) {
  appState.bookmarks = await window.electronAPI.removeBookmark(url);
  updateAddressBar();
  renderBookmarks();
}

// Обработчик кнопки режима фокусировки
focusModeButton.addEventListener('click', async () => {
  appState.focusMode = await window.electronAPI.toggleFocusMode();
  updateUI();
});

// Обработчик кнопки темы
themeButton.addEventListener('click', async () => {
  appState.darkMode = await window.electronAPI.toggleDarkMode();
  updateUI();
});

// Обработчики боковой панели
sidebarButton.addEventListener('click', async () => {
  appState.sidebarVisible = await window.electronAPI.toggleSidebar();
  updateUI();
});

closeSidebarButton.addEventListener('click', async () => {
  appState.sidebarVisible = await window.electronAPI.toggleSidebar();
  updateUI();
});

// Обработчики переключателей в боковой панели
darkModeToggle.addEventListener('change', async () => {
  appState.darkMode = await window.electronAPI.toggleDarkMode();
  updateUI();
});

focusModeToggle.addEventListener('change', async () => {
  appState.focusMode = await window.electronAPI.toggleFocusMode();
  updateUI();
});

adBlockToggle.addEventListener('change', async () => {
  appState.adBlockEnabled = await window.electronAPI.toggleAdBlock();
  
  if (appState.adBlockEnabled) {
    // Обновляем правила блокировки рекламы если она включена
    await window.electronAPI.updateAdBlockRules();
  }
  
  // Перезагружаем текущую страницу для применения новых настроек
  await window.electronAPI.refresh();
});

// Загрузка настроек режима чтения
async function loadReaderSettings() {
  try {
    const result = await window.electronAPI.getReaderSettings();
    if (result.success) {
      readerSettings = result.settings;
      applyReaderSettings();
    }
  } catch (error) {
    console.error('Ошибка при загрузке настроек режима чтения:', error);
  }
}

// Применение настроек режима чтения
function applyReaderSettings() {
  // Применяем размер шрифта
  document.documentElement.style.setProperty('--reader-font-size', `${readerSettings.fontSize}px`);
  
  // Применяем высоту строки
  document.documentElement.style.setProperty('--reader-line-height', readerSettings.lineHeight);
  
  // Применяем ширину контента
  document.documentElement.style.setProperty('--reader-width', `${readerSettings.lineWidth}%`);
  
  // Применяем тему
  document.documentElement.setAttribute('data-reader-theme', readerSettings.theme);
  
  // Обновляем ползунки
  lineWidthRange.value = readerSettings.lineWidth;
  lineHeightRange.value = readerSettings.lineHeight;
  
  // Обновляем активные кнопки
  lightThemeButton.classList.toggle('active', readerSettings.theme === 'light');
  sepiaThemeButton.classList.toggle('active', readerSettings.theme === 'sepia');
  darkThemeButton.classList.toggle('active', readerSettings.theme === 'dark');
}

// Сохранение настроек режима чтения
async function saveReaderSettings() {
  try {
    await window.electronAPI.saveReaderSettings(readerSettings);
  } catch (error) {
    console.error('Ошибка при сохранении настроек режима чтения:', error);
  }
}

// Преобразование HTML-строки в документ
function parseHTML(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

// Функция активации режима чтения должна использовать новый API
async function activateReaderMode() {
  try {
    // Показываем настройки режима чтения в боковой панели
    readerModeSettings.style.display = 'block';
    
    // Используем новое API для активации режима чтения
    const result = await window.electronAPI.enterReaderMode();
    
    if (!result.success) {
      console.error('Не удалось активировать режим чтения:', result.error);
      readerModeSettings.style.display = 'none';
    }
  } catch (error) {
    console.error('Ошибка при активации режима чтения:', error);
    readerModeSettings.style.display = 'none';
  }
}

// Функция деактивации режима чтения также уже не нужна,
// так как выход из режима чтения обрабатывается на странице reader.html
function deactivateReaderMode() {
  // Скрываем настройки режима чтения
  readerModeSettings.style.display = 'none';
}

// Обработчик кнопки режима чтения
readerModeButton.addEventListener('click', () => {
  if (readerModeActive) {
    deactivateReaderMode();
  } else {
    activateReaderMode();
  }
});

// Обработчик закрытия режима чтения
closeReaderButton.addEventListener('click', deactivateReaderMode);

// Обработчики настроек режима чтения
decreaseFontButton.addEventListener('click', () => {
  if (readerSettings.fontSize > 12) {
    readerSettings.fontSize -= 2;
    applyReaderSettings();
    saveReaderSettings();
  }
});

increaseFontButton.addEventListener('click', () => {
  if (readerSettings.fontSize < 32) {
    readerSettings.fontSize += 2;
    applyReaderSettings();
    saveReaderSettings();
  }
});

lightThemeButton.addEventListener('click', () => {
  readerSettings.theme = 'light';
  applyReaderSettings();
  saveReaderSettings();
});

sepiaThemeButton.addEventListener('click', () => {
  readerSettings.theme = 'sepia';
  applyReaderSettings();
  saveReaderSettings();
});

darkThemeButton.addEventListener('click', () => {
  readerSettings.theme = 'dark';
  applyReaderSettings();
  saveReaderSettings();
});

lineWidthRange.addEventListener('input', () => {
  readerSettings.lineWidth = parseInt(lineWidthRange.value);
  applyReaderSettings();
});

lineWidthRange.addEventListener('change', () => {
  saveReaderSettings();
});

lineHeightRange.addEventListener('input', () => {
  readerSettings.lineHeight = parseFloat(lineHeightRange.value);
  applyReaderSettings();
});

lineHeightRange.addEventListener('change', () => {
  saveReaderSettings();
});

// Функции для работы с загрузками
async function toggleDownloadsPanel() {
  const isVisible = await window.electronAPI.toggleDownloadsPanel();
  
  // Обновляем класс панели для CSS анимации
  downloadsPanel.classList.toggle('visible', isVisible);
  
  // Обновляем класс контейнера для сдвига верхней панели
  document.querySelector('.browser-container').classList.toggle('downloads-visible', isVisible);
  
  if (isVisible) {
    refreshDownloadsList();
  }
}

// Также обновим функцию закрытия панели
function closeDownloadsPanel() {
  window.electronAPI.toggleDownloadsPanel(false).then(() => {
    downloadsPanel.classList.remove('visible');
    document.querySelector('.browser-container').classList.remove('downloads-visible');
  });
}

async function refreshDownloadsList() {
  try {
    const downloads = await window.electronAPI.getDownloads();
    
    if (downloads.length === 0) {
      downloadsList.innerHTML = '<div class="no-downloads">У вас пока нет загрузок</div>';
      return;
    }
    
    // Очищаем список
    downloadsList.innerHTML = '';
    
    // Добавляем загрузки в список
    downloads.forEach(download => {
      // Сохраняем загрузку в активные, если она еще не завершена
      if (download.status === 'progressing' || download.status === 'paused') {
        activeDownloads.set(download.id, download);
      }
      
      // Добавляем элемент загрузки в список
      const downloadItem = createDownloadElement(download);
      downloadsList.appendChild(downloadItem);
    });
  } catch (error) {
    console.error('Ошибка при получении списка загрузок:', error);
    downloadsList.innerHTML = '<div class="no-downloads">Не удалось загрузить список загрузок</div>';
  }
}

function addDownloadItem(download) {
  // Сохраняем загрузку в активные
  activeDownloads.set(download.id, {
    ...download,
    receivedBytes: 0,
    percent: 0,
    status: 'progressing'
  });
  
  // Создаем элемент загрузки
  const downloadItem = createDownloadElement({
    ...download,
    receivedBytes: 0,
    percent: 0,
    status: 'progressing',
    formattedSize: formatFileSize(download.fileSize),
    formattedReceivedBytes: '0 B',
    speed: '0 B/s'
  });
  
  // Проверяем, нужно ли заменить сообщение "нет загрузок"
  const noDownloadsMessage = downloadsList.querySelector('.no-downloads');
  if (noDownloadsMessage) {
    downloadsList.innerHTML = '';
  }
  
  // Добавляем элемент в начало списка
  downloadsList.insertBefore(downloadItem, downloadsList.firstChild);
  
  // Показываем панель загрузок корректно через API
  window.electronAPI.toggleDownloadsPanel(true).then(() => {
    // Также устанавливаем класс visible для CSS-анимации
    downloadsPanel.classList.add('visible');
    // Обновляем класс контейнера для сдвига верхней панели
    document.querySelector('.browser-container').classList.add('downloads-visible');
  });
}

function updateDownloadProgress(progress) {
  const downloadItem = activeDownloads.get(progress.id);
  if (!downloadItem) return;
  
  // Обновляем данные о загрузке
  downloadItem.receivedBytes = progress.receivedBytes;
  downloadItem.percent = progress.percent;
  downloadItem.speed = progress.speed;
  
  // Обновляем элемент загрузки
  const element = document.getElementById(`download-${progress.id}`);
  if (element) {
    const progressBar = element.querySelector('.download-progress-bar');
    const progressText = element.querySelector('.download-progress-text');
    const speedText = element.querySelector('.download-speed');
    
    if (progressBar) {
      progressBar.style.width = `${progress.percent}%`;
    }
    
    if (progressText) {
      progressText.textContent = `${formatFileSize(progress.receivedBytes)} / ${formatFileSize(progress.fileSize)}`;
    }
    
    if (speedText) {
      speedText.textContent = formatFileSize(progress.speed) + '/s';
    }
  }
}

function completeDownload(download) {
  const downloadItem = activeDownloads.get(download.id);
  if (!downloadItem) return;
  
  // Обновляем статус загрузки
  downloadItem.status = 'completed';
  downloadItem.receivedBytes = downloadItem.fileSize;
  downloadItem.percent = 100;
  
  // Удаляем из активных
  activeDownloads.delete(download.id);
  
  // Обновляем элемент загрузки
  updateDownloadStatus(download.id, 'completed', 'Завершено');
}

function cancelDownload(id) {
  const downloadItem = activeDownloads.get(id);
  if (!downloadItem) return;
  
  // Обновляем статус загрузки
  downloadItem.status = 'cancelled';
  
  // Удаляем из активных
  activeDownloads.delete(id);
  
  // Обновляем элемент загрузки
  updateDownloadStatus(id, 'failed', 'Отменено');
}

function failDownload(id, error) {
  const downloadItem = activeDownloads.get(id);
  if (!downloadItem) return;
  
  // Обновляем статус загрузки
  downloadItem.status = 'failed';
  
  // Удаляем из активных
  activeDownloads.delete(id);
  
  // Обновляем элемент загрузки
  updateDownloadStatus(id, 'failed', 'Ошибка', error);
}

function updateDownloadStatus(id, statusClass, statusText, errorText) {
  const element = document.getElementById(`download-${id}`);
  if (!element) return;
  
  const statusElement = element.querySelector('.download-status');
  const actionsElement = element.querySelector('.download-actions');
  
  if (statusElement) {
    statusElement.className = `download-status ${statusClass}`;
    statusElement.textContent = statusText;
  }
  
  if (actionsElement) {
    if (statusClass === 'completed') {
      actionsElement.innerHTML = `
        <button class="download-button" onclick="openDownloadFolder('${element.dataset.path}')">Открыть папку</button>
      `;
    } else if (statusClass === 'failed') {
      if (errorText) {
        const detailsElement = element.querySelector('.download-details');
        if (detailsElement) {
          detailsElement.innerHTML += `<div class="download-error">${errorText}</div>`;
        }
      }
      actionsElement.innerHTML = '';
    }
  }
}

function createDownloadElement(download) {
  const element = document.createElement('div');
  element.className = 'download-item';
  element.id = `download-${download.id}`;
  element.dataset.path = download.savePath;
  
  let statusClass = 'progressing';
  let statusText = 'Загрузка...';
  let actions = '';
  
  switch (download.status) {
    case 'completed':
      statusClass = 'completed';
      statusText = 'Завершено';
      actions = `<button class="download-button" onclick="openDownloadFolder('${download.savePath}')">Открыть папку</button>`;
      break;
    case 'cancelled':
      statusClass = 'failed';
      statusText = 'Отменено';
      break;
    case 'interrupted':
    case 'failed':
      statusClass = 'failed';
      statusText = 'Ошибка';
      break;
    case 'paused':
      statusClass = 'paused';
      statusText = 'Приостановлено';
      actions = `
        <button class="download-button" onclick="resumeDownload(${download.id})">Возобновить</button>
        <button class="download-button cancel" onclick="cancelDownload(${download.id})">Отменить</button>
      `;
      break;
    default:
      actions = `
        <button class="download-button" onclick="pauseDownload(${download.id})">Приостановить</button>
        <button class="download-button cancel" onclick="cancelDownload(${download.id})">Отменить</button>
      `;
  }
  
  element.innerHTML = `
    <div class="download-item-header">
      <div class="download-title">${download.fileName}</div>
      <div class="download-status ${statusClass}">${statusText}</div>
    </div>
    ${download.status === 'progressing' || download.status === 'paused' ? `
      <div class="download-progress-container">
        <div class="download-progress-bar" style="width: ${download.percent}%"></div>
      </div>
    ` : ''}
    <div class="download-details">
      <div class="download-progress-text">${download.formattedReceivedBytes || '0 B'} / ${download.formattedSize}</div>
      <div class="download-speed">${download.speed || '0 B/s'}</div>
    </div>
    <div class="download-actions">${actions}</div>
  `;
  
  return element;
}

// Функция для форматирования размера файла
function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

// Глобальные функции для управления загрузками (доступны из HTML)
window.pauseDownload = async function(id) {
  try {
    const result = await window.electronAPI.pauseDownload(id);
    if (result.success) {
      updateDownloadStatus(id, 'paused', 'Приостановлено');
      
      // Обновляем действия
      const element = document.getElementById(`download-${id}`);
      if (element) {
        const actionsElement = element.querySelector('.download-actions');
        if (actionsElement) {
          actionsElement.innerHTML = `
            <button class="download-button" onclick="resumeDownload(${id})">Возобновить</button>
            <button class="download-button cancel" onclick="cancelDownload(${id})">Отменить</button>
          `;
        }
      }
    } else {
      console.error('Ошибка при приостановке загрузки:', result.error);
    }
  } catch (error) {
    console.error('Ошибка при приостановке загрузки:', error);
  }
};

window.resumeDownload = async function(id) {
  try {
    const result = await window.electronAPI.resumeDownload(id);
    if (result.success) {
      updateDownloadStatus(id, 'progressing', 'Загрузка...');
      
      // Обновляем действия
      const element = document.getElementById(`download-${id}`);
      if (element) {
        const actionsElement = element.querySelector('.download-actions');
        if (actionsElement) {
          actionsElement.innerHTML = `
            <button class="download-button" onclick="pauseDownload(${id})">Приостановить</button>
            <button class="download-button cancel" onclick="cancelDownload(${id})">Отменить</button>
          `;
        }
      }
    } else {
      console.error('Ошибка при возобновлении загрузки:', result.error);
    }
  } catch (error) {
    console.error('Ошибка при возобновлении загрузки:', error);
  }
};

window.cancelDownload = async function(id) {
  try {
    const result = await window.electronAPI.cancelDownload(id);
    if (result.success) {
      cancelDownload(id);
    } else {
      console.error('Ошибка при отмене загрузки:', result.error);
    }
  } catch (error) {
    console.error('Ошибка при отмене загрузки:', error);
  }
};

window.openDownloadFolder = async function(path) {
  try {
    await window.electronAPI.openDownloadFolder(path);
  } catch (error) {
    console.error('Ошибка при открытии папки с загрузкой:', error);
  }
};

// Функции для работы с цветами
async function loadCustomThemeSettings() {
  try {
    const customTheme = await window.electronAPI.getCustomTheme();
    
    // Заполняем значения цветов
    primaryColorPicker.value = customTheme.primaryColor;
    bgColorPicker.value = customTheme.backgroundColor;
    textColorPicker.value = customTheme.textColor;
    headerBgPicker.value = customTheme.headerColor;
    
    // Обновляем состояние переключателя
    useDefaultThemesToggle.checked = !customTheme.enabled;
    customColorsContainer.style.display = customTheme.enabled ? 'block' : 'none';
    
    // Если включена пользовательская тема, применяем её
    if (customTheme.enabled) {
      applyCustomColors(customTheme);
    }
  } catch (error) {
    console.error('Ошибка при загрузке настроек пользовательских цветов:', error);
  }
}

function applyCustomColors(customTheme) {
  // Сохраняем текущий режим (светлая/темная тема)
  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  
  // Применяем пользовательские цвета через CSS переменные
  document.documentElement.style.setProperty('--primary-color', customTheme.primaryColor);
  document.documentElement.style.setProperty('--primary-hover', adjustColor(customTheme.primaryColor, -20));
  document.documentElement.style.setProperty('--bg-color', customTheme.backgroundColor);
  document.documentElement.style.setProperty('--text-color', customTheme.textColor);
  document.documentElement.style.setProperty('--header-bg', customTheme.headerColor);
  document.documentElement.style.setProperty('--sidebar-bg', customTheme.headerColor);
  document.documentElement.style.setProperty('--card-bg', adjustColor(customTheme.headerColor, isDarkMode ? -10 : 10));
  
  // Устанавливаем производные цвета
  const borderColor = isDarkMode ? 
    adjustColor(customTheme.backgroundColor, 20) : 
    adjustColor(customTheme.backgroundColor, -20);
  document.documentElement.style.setProperty('--border-color', borderColor);
  
  // Цвета вкладок
  document.documentElement.style.setProperty('--tab-active-bg', customTheme.headerColor);
  document.documentElement.style.setProperty('--tab-hover-bg', adjustColor(customTheme.headerColor, isDarkMode ? 10 : -5));
  document.documentElement.style.setProperty('--tab-inactive-bg', adjustColor(customTheme.headerColor, isDarkMode ? -10 : -10));
}

// Вспомогательная функция для корректировки цвета
function adjustColor(colorHex, amount) {
  let color = colorHex.replace('#', '');
  
  // Преобразуем в RGB
  let r = parseInt(color.substring(0, 2), 16);
  let g = parseInt(color.substring(2, 4), 16);
  let b = parseInt(color.substring(4, 6), 16);
  
  // Корректируем значения
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  
  // Обратно в HEX
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Сброс пользовательских цветов
async function resetCustomColors() {
  try {
    const defaultTheme = await window.electronAPI.resetCustomTheme();
    
    // Обновляем UI элементы
    primaryColorPicker.value = defaultTheme.primaryColor;
    bgColorPicker.value = defaultTheme.backgroundColor;
    textColorPicker.value = defaultTheme.textColor;
    headerBgPicker.value = defaultTheme.headerColor;
    
    // Включаем стандартные темы
    useDefaultThemesToggle.checked = true;
    customColorsContainer.style.display = 'none';
    
    // Сбрасываем стили
    document.documentElement.removeAttribute('style');
    
    // Проверяем и применяем текущую тему (светлую/темную)
    updateUI();
  } catch (error) {
    console.error('Ошибка при сбросе цветов:', error);
  }
}

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', async () => {
  initEventSubscriptions();
  await loadSearchSettings();
  await loadAppState();
  await loadReaderSettings();
  
  // Инициализируем состояние навигации
  updateAddressBar();
  updateNavigationButtons();
  
  // Устанавливаем обработчики событий для загрузок
  downloadsButton.addEventListener('click', toggleDownloadsPanel);
  closeDownloadsButton.addEventListener('click', closeDownloadsPanel);
  
  // Загружаем настройки цветов
  await loadCustomThemeSettings();
  
  // Обработчик для кнопки истории
  historyButton.addEventListener('click', openHistoryPage);
});

// Обработчики событий для настроек цветов
useDefaultThemesToggle.addEventListener('change', async (e) => {
  const useDefault = e.target.checked;
  customColorsContainer.style.display = useDefault ? 'none' : 'block';
  
  // Сохраняем настройку
  await window.electronAPI.toggleCustomTheme(!useDefault);
  
  if (useDefault) {
    // Возвращаем стандартную тему, удаляя inline стили
    document.documentElement.removeAttribute('style');
    // Применяем текущую тему (светлую/темную)
    updateUI();
  } else {
    // Собираем текущие значения цветов
    const customTheme = {
      primaryColor: primaryColorPicker.value,
      backgroundColor: bgColorPicker.value,
      textColor: textColorPicker.value,
      headerColor: headerBgPicker.value
    };
    
    // Применяем пользовательские цвета
    applyCustomColors(customTheme);
    
    // Сохраняем изменения
    await window.electronAPI.updateCustomTheme(customTheme);
  }
});

// Обработчики для каждого из color picker'ов
primaryColorPicker.addEventListener('change', updateColor);
bgColorPicker.addEventListener('change', updateColor);
textColorPicker.addEventListener('change', updateColor);
headerBgPicker.addEventListener('change', updateColor);

// Функция обновления цвета
async function updateColor() {
  // Проверяем, включены ли пользовательские темы
  if (!useDefaultThemesToggle.checked) {
    // Собираем текущие значения цветов
    const customTheme = {
      primaryColor: primaryColorPicker.value,
      backgroundColor: bgColorPicker.value,
      textColor: textColorPicker.value,
      headerColor: headerBgPicker.value
    };
    
    // Применяем пользовательские цвета
    applyCustomColors(customTheme);
    
    // Сохраняем изменения
    await window.electronAPI.updateCustomTheme(customTheme);
  }
}

// Обработчик сброса цветов
resetColorsButton.addEventListener('click', resetCustomColors);

// Функция открытия страницы истории
async function openHistoryPage() {
  try {
    await window.electronAPI.openHistoryPage();
  } catch (error) {
    console.error('Ошибка при открытии страницы истории:', error);
  }
} 