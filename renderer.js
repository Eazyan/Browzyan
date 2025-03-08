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

// Инициализация подписки на события
function initEventSubscriptions() {
  // Подписка на событие загрузки страницы
  window.electronAPI.on('page-loaded', (url) => {
    isPageLoading = false;
    updateAddressBar();
    updateNavigationButtons();
  });
  
  // Подписка на событие смены вкладки
  window.electronAPI.on('tab-changed', (tabId) => {
    appState.activeTabId = tabId;
    renderTabs();
    updateAddressBar();
    updateNavigationButtons();
  });
  
  // Подписка на события загрузок
  window.electronAPI.onDownloadStarted((event, download) => {
    addDownloadItem(download);
  });
  
  window.electronAPI.onDownloadProgress((event, progress) => {
    updateDownloadProgress(progress);
  });
  
  window.electronAPI.onDownloadCompleted((event, download) => {
    completeDownload(download);
  });
  
  window.electronAPI.onDownloadCancelled((event, download) => {
    cancelDownload(download.id);
  });
  
  window.electronAPI.onDownloadFailed((event, error) => {
    failDownload(error.id, error.error);
  });
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

// Обновление UI в соответствии с состоянием
function updateUI() {
  // Обновление темы
  if (appState.darkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  darkModeToggle.checked = appState.darkMode;
  
  // Обновление режима фокусировки
  if (appState.focusMode) {
    document.body.classList.add('focus-mode');
  } else {
    document.body.classList.remove('focus-mode');
  }
  focusModeToggle.checked = appState.focusMode;
  
  // Обновление боковой панели
  if (appState.sidebarVisible) {
    sidebar.classList.add('visible');
  } else {
    sidebar.classList.remove('visible');
  }
  
  // Обновление состояния блокировки рекламы
  adBlockToggle.checked = appState.adBlockEnabled;
  
  // Отображение закладок
  renderBookmarks();
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
  tabsList.innerHTML = '';
  
  appState.tabs.forEach((tab, index) => {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.setAttribute('data-tab-id', tab.id);
    tabElement.setAttribute('data-index', index);
    
    if (tab.id === appState.activeTabId) {
      tabElement.classList.add('active');
    }
    
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || 'Загрузка...';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'tab-close';
    closeButton.textContent = '✕';
    closeButton.title = 'Закрыть вкладку';
    
    tabElement.appendChild(title);
    tabElement.appendChild(closeButton);
    
    // Переключение на вкладку при клике
    tabElement.addEventListener('click', (e) => {
      if (e.target !== closeButton) {
        switchTab(tab.id);
      }
    });
    
    // Закрытие вкладки при клике на крестик
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    
    // Добавляем обработчики для drag and drop
    tabElement.setAttribute('draggable', 'true');
    
    tabElement.addEventListener('dragstart', (e) => {
      draggedTabId = tab.id;
      draggedTabElement = tabElement;
      dragStartIndex = index;
      
      // Отложенное добавление класса для визуального эффекта
      setTimeout(() => {
        tabElement.classList.add('dragging');
      }, 0);
      
      // Устанавливаем данные для переноса
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index);
    });
    
    tabElement.addEventListener('dragend', () => {
      draggedTabElement.classList.remove('dragging');
      draggedTabId = null;
      draggedTabElement = null;
      dragStartIndex = -1;
      
      // Убираем все маркеры перетаскивания
      document.querySelectorAll('.tab-drop-indicator').forEach(el => el.remove());
    });
    
    tabElement.addEventListener('dragover', (e) => {
      e.preventDefault(); // Необходимо для разрешения drop
      
      // Если это другая вкладка (не та, которую мы перетаскиваем)
      if (draggedTabId !== tab.id) {
        // Определяем, куда вставлять: слева или справа от текущей вкладки
        const rect = tabElement.getBoundingClientRect();
        const midPoint = rect.left + rect.width / 2;
        const insertBefore = e.clientX < midPoint;
        
        // Отображаем индикатор
        showDropIndicator(tabElement, insertBefore);
      }
    });
    
    tabElement.addEventListener('dragleave', () => {
      // Убираем индикатор, когда мышь покидает вкладку
      document.querySelectorAll('.tab-drop-indicator').forEach(el => el.remove());
    });
    
    tabElement.addEventListener('drop', async (e) => {
      e.preventDefault();
      
      if (draggedTabId !== tab.id && dragStartIndex !== -1) {
        // Определяем, куда вставлять: слева или справа от текущей вкладки
        const rect = tabElement.getBoundingClientRect();
        const midPoint = rect.left + rect.width / 2;
        const insertBefore = e.clientX < midPoint;
        
        // Вычисляем новый индекс
        let newIndex = index;
        if (!insertBefore) newIndex++;
        
        // Если перемещаем вперед, корректируем индекс
        if (dragStartIndex < newIndex) newIndex--;
        
        // Выполняем перестановку
        await window.electronAPI.reorderTabs(dragStartIndex, newIndex);
        
        // Перерисовываем вкладки
        const tabsInfo = await window.electronAPI.getTabs();
        appState.tabs = tabsInfo.tabs;
        renderTabs();
      }
      
      // Убираем все маркеры перетаскивания
      document.querySelectorAll('.tab-drop-indicator').forEach(el => el.remove());
    });
    
    tabsList.appendChild(tabElement);
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
  const result = await window.electronAPI.openTab(url);
  appState.tabs = result.tabs;
  appState.activeTabId = result.id;
  renderTabs();
}

// Закрытие вкладки
async function closeTab(tabId) {
  const result = await window.electronAPI.closeTab(tabId);
  appState.tabs = result.tabs;
  appState.activeTabId = result.activeTabId;
  renderTabs();
  updateAddressBar();
  updateNavigationButtons();
}

// Переключение на вкладку
async function switchTab(tabId) {
  const result = await window.electronAPI.switchTab(tabId);
  appState.activeTabId = result.activeTabId;
  renderTabs();
  updateAddressBar();
  updateNavigationButtons();
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
function toggleDownloadsPanel() {
  downloadsPanel.classList.toggle('visible');
  
  if (downloadsPanel.classList.contains('visible')) {
    refreshDownloadsList();
  }
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
  
  // Показываем панель загрузок
  downloadsPanel.classList.add('visible');
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
  closeDownloadsButton.addEventListener('click', () => {
    downloadsPanel.classList.remove('visible');
  });
}); 