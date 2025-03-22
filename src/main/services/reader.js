const path = require('path');
const { get, set, appState } = require('./storage');
const { BrowserView } = require('electron');
const fs = require('fs');

// Константы
const READER_HTML_PATH = path.join(__dirname, '../../assets/pages/reader.html');

// Хранилище для временного содержимого HTML
const readerContentStore = new Map();

// Хранилище для оригинальных URL страниц, когда мы переходим в режим чтения
const originalUrls = new Map();

// Настройки режима чтения по умолчанию
const DEFAULT_SETTINGS = {
  theme: 'light', // light, dark, sepia
  fontSize: 'medium', // small, medium, large, extra-large
  fontFamily: 'sans-serif', // sans-serif, serif, monospace
  lineHeight: 'normal', // compact, normal, relaxed
  contentWidth: 'normal' // narrow, normal, wide
};

// Переменные для отслеживания состояния
let readerViews = new Map(); // tabId -> BrowserView
let mainWindow = null;
let tabs = null;

// Инициализация модуля
function init(window, tabsModule) {
  mainWindow = window;
  tabs = tabsModule;
}

// Получение настроек режима чтения
function getSettings() {
  const settings = get('readerSettings');
  return settings || DEFAULT_SETTINGS;
}

// Установка настроек режима чтения
function setSettings(newSettings) {
  try {
    const currentSettings = getSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    set('readerSettings', updatedSettings);
    
    // Обновляем все активные режимы чтения
    for (const [tabId, view] of readerViews.entries()) {
      if (view && view.webContents) {
        updateReaderView(tabId, view);
      }
    }
    
    return { success: true, settings: updatedSettings };
  } catch (error) {
    console.error('Ошибка при установке настроек режима чтения:', error);
    return { success: false, error: error.message };
  }
}

// Получение HTML-содержимого по ID
function getReaderContent(contentId) {
  if (readerContentStore.has(contentId)) {
    const html = readerContentStore.get(contentId);
    
    // После получения содержимого удаляем его из хранилища
    readerContentStore.delete(contentId);
    
    return html;
  }
  return null;
}

// Вход в режим чтения
async function enterReaderMode(activeView) {
  try {
    if (!activeView) {
      return { success: false, error: 'Нет активной вкладки' };
    }

    // Получаем URL и title страницы
    const url = activeView.webContents.getURL();
    const title = activeView.webContents.getTitle();
    
    // Сохраняем оригинальный URL для возврата
    originalUrls.set(appState.activeTabId, url);

    // Получаем HTML содержимое страницы
    const html = await activeView.webContents.executeJavaScript(`
      document.documentElement.outerHTML;
    `);
    
    // Получаем настройки режима чтения
    const settings = getSettings();
    
    // Генерируем уникальный ID для хранения содержимого
    const contentId = Date.now().toString();
    
    // Сохраняем HTML во временное хранилище
    readerContentStore.set(contentId, html);
    
    // Создаем данные для передачи в режим чтения
    const readerData = {
      title,
      contentId,
      domain: new URL(url).hostname,
      url,
      settings
    };
    
    // Преобразуем данные в строку, подходящую для URL hash
    const encodedData = encodeURIComponent(JSON.stringify(readerData));
    
    // Загружаем reader.html и передаем метаданные через hash
    await activeView.webContents.loadFile(READER_HTML_PATH, {
      hash: encodedData
    });
    
    return { success: true };
  } catch (error) {
    console.error('Ошибка при входе в режим чтения:', error);
    return { success: false, error: error.message };
  }
}

// Выход из режима чтения
async function exitReaderMode(activeView) {
  try {
    if (!activeView) {
      return { success: false, error: 'Нет активной вкладки' };
    }
    
    // Используем активную вкладку
    const tabId = appState.activeTabId;
    
    // Используем сохраненный оригинальный URL, если он есть
    let originalUrl;
    
    if (originalUrls.has(tabId)) {
      originalUrl = originalUrls.get(tabId);
      // Удаляем запись после использования
      originalUrls.delete(tabId);
    } else {
      // Используем URL из данных вкладки (как запасной вариант)
      const tabs = get('tabs');
      const tabIndex = tabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) {
        return { success: false, error: 'Данные вкладки не найдены' };
      }
      originalUrl = tabs[tabIndex].url;
    }
    
    // Проверяем, не является ли URL страницей режима чтения
    if (originalUrl.startsWith('file://') && originalUrl.includes('reader.html')) {
      await activeView.webContents.goBack();
    } else {
      // Загружаем оригинальный URL
      await activeView.webContents.loadURL(originalUrl);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Ошибка при выходе из режима чтения:', error);
    return { success: false, error: error.message };
  }
}

// Включение режима чтения для вкладки
function enableReaderMode(tabId) {
  if (!mainWindow || !tabs) {
    return { success: false, error: 'Приложение не инициализировано' };
  }
  
  try {
    // Получаем вкладку
    const tabView = tabs.getTabView(tabId);
    if (!tabView) {
      return { success: false, error: 'Вкладка не найдена' };
    }
    
    // Получаем URL и контент страницы
    const url = tabView.webContents.getURL();
    
    // Не включаем режим чтения для специальных URL
    if (url.startsWith('browzyan://') || url.startsWith('file://') || url.startsWith('about:')) {
      return { success: false, error: 'Режим чтения недоступен для этой страницы' };
    }
    
    // Извлекаем контент страницы
    tabView.webContents.executeJavaScript(`
      {
        const article = {
          title: document.title,
          url: window.location.href,
          content: document.body.innerHTML,
          hostname: window.location.hostname
        };
        article;
      }
    `).then(article => {
      createReaderView(tabId, article);
    }).catch(error => {
      console.error('Ошибка при извлечении контента для режима чтения:', error);
    });
    
    return { success: true, message: 'Режим чтения включается...' };
  } catch (error) {
    console.error('Ошибка при включении режима чтения:', error);
    return { success: false, error: error.message };
  }
}

// Создание представления для режима чтения
function createReaderView(tabId, article) {
  try {
    // Удаляем предыдущий вид чтения, если он есть
    if (readerViews.has(tabId)) {
      const oldView = readerViews.get(tabId);
      if (oldView && !oldView.isDestroyed()) {
        mainWindow.removeBrowserView(oldView);
      }
      readerViews.delete(tabId);
    }
    
    // Создаем новый вид
    const readerView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        worldSafeExecuteJavaScript: true,
        sandbox: true
      }
    });
    
    // Настраиваем размер и позицию
    const contentBounds = tabs.getContentBounds();
    readerView.setBounds(contentBounds);
    
    // Добавляем в окно и скрываем оригинальный вид
    mainWindow.addBrowserView(readerView);
    tabs.hideTabView(tabId);
    
    // Загружаем HTML-шаблон режима чтения
    readerView.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(generateReaderHTML(article, getSettings()))}`);
    
    // Слушаем события для навигации и закрытия
    readerView.webContents.on('did-finish-load', () => {
      setupReaderEventListeners(tabId, readerView);
    });
    
    // Сохраняем представление
    readerViews.set(tabId, readerView);
    
    // Уведомляем рендерер о состоянии режима чтения
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('reader-mode-state-changed', { tabId, enabled: true });
    }
    
  } catch (error) {
    console.error('Ошибка при создании представления режима чтения:', error);
    disableReaderMode(tabId);
  }
}

// Обновление представления режима чтения (например, при изменении настроек)
function updateReaderView(tabId, view) {
  try {
    // Получаем текущие настройки
    const settings = getSettings();
    
    // Применяем тему
    view.webContents.executeJavaScript(`
      document.documentElement.dataset.theme = "${settings.theme}";
      document.documentElement.dataset.fontSize = "${settings.fontSize}";
      document.documentElement.dataset.fontFamily = "${settings.fontFamily}";
      document.documentElement.dataset.lineHeight = "${settings.lineHeight}";
      document.documentElement.dataset.contentWidth = "${settings.contentWidth}";
    `).catch(error => {
      console.error('Ошибка при обновлении настроек режима чтения:', error);
    });
  } catch (error) {
    console.error('Ошибка при обновлении представления режима чтения:', error);
  }
}

// Настройка слушателей событий для режима чтения
function setupReaderEventListeners(tabId, view) {
  try {
    // Слушаем события от клиентского кода
    view.webContents.executeJavaScript(`
      document.getElementById('close-reader').addEventListener('click', () => {
        window.electronAPI.closeReader();
      });
      
      document.getElementById('settings-toggle').addEventListener('click', () => {
        const settingsPanel = document.getElementById('settings-panel');
        settingsPanel.classList.toggle('visible');
      });
      
      // Обработчики для настроек
      document.querySelectorAll('[data-theme-option]').forEach(element => {
        element.addEventListener('click', () => {
          const theme = element.getAttribute('data-theme-option');
          window.electronAPI.updateReaderSettings({ theme });
        });
      });
      
      document.querySelectorAll('[data-font-size]').forEach(element => {
        element.addEventListener('click', () => {
          const fontSize = element.getAttribute('data-font-size');
          window.electronAPI.updateReaderSettings({ fontSize });
        });
      });
    `).catch(error => {
      console.error('Ошибка при настройке слушателей событий режима чтения:', error);
    });
    
    // Настраиваем IPC для этого вида
    view.webContents.ipc.handle('closeReader', () => {
      disableReaderMode(tabId);
    });
    
    view.webContents.ipc.handle('updateReaderSettings', (event, settings) => {
      return setSettings(settings);
    });
  } catch (error) {
    console.error('Ошибка при настройке слушателей событий режима чтения:', error);
  }
}

// Выключение режима чтения
function disableReaderMode(tabId) {
  try {
    if (readerViews.has(tabId)) {
      const readerView = readerViews.get(tabId);
      if (readerView && !readerView.isDestroyed()) {
        mainWindow.removeBrowserView(readerView);
        readerView.webContents.destroy();
      }
      readerViews.delete(tabId);
      
      // Показываем оригинальный вид
      tabs.showTabView(tabId);
      
      // Уведомляем рендерер
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('reader-mode-state-changed', { tabId, enabled: false });
      }
      
      return { success: true };
    }
    return { success: false, error: 'Режим чтения не был активен' };
  } catch (error) {
    console.error('Ошибка при выключении режима чтения:', error);
    return { success: false, error: error.message };
  }
}

// Генерация HTML для режима чтения
function generateReaderHTML(article, settings) {
  const { title, content, url, hostname } = article;
  const { theme, fontSize, fontFamily, lineHeight, contentWidth } = settings;
  
  return `
    <!DOCTYPE html>
    <html lang="ru" data-theme="${theme}" data-font-size="${fontSize}" data-font-family="${fontFamily}" data-line-height="${lineHeight}" data-content-width="${contentWidth}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - Режим чтения</title>
      <style>
        :root {
          /* Светлая тема */
          --light-bg: #f9f9fb;
          --light-text: #15141a;
          --light-link: #0060df;
          --light-border: #d7d7db;
          
          /* Темная тема */
          --dark-bg: #1c1b22;
          --dark-text: #f9f9fa;
          --dark-link: #0a84ff;
          --dark-border: #4a4a4f;
          
          /* Сепия тема */
          --sepia-bg: #f4ecd8;
          --sepia-text: #3b2e1a;
          --sepia-link: #0f6fd9;
          --sepia-border: #d0bfA0;
        }
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: sans-serif;
          line-height: 1.5;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          transition: background-color 0.3s, color 0.3s;
          overflow-x: hidden;
          padding: 0;
          margin: 0;
        }
        
        /* Применение тем */
        html[data-theme="light"] {
          background-color: var(--light-bg);
          color: var(--light-text);
        }
        
        html[data-theme="dark"] {
          background-color: var(--dark-bg);
          color: var(--dark-text);
        }
        
        html[data-theme="sepia"] {
          background-color: var(--sepia-bg);
          color: var(--sepia-text);
        }
        
        /* Размеры шрифта */
        html[data-font-size="small"] .reader-content {
          font-size: 16px;
        }
        
        html[data-font-size="medium"] .reader-content {
          font-size: 18px;
        }
        
        html[data-font-size="large"] .reader-content {
          font-size: 20px;
        }
        
        html[data-font-size="extra-large"] .reader-content {
          font-size: 22px;
        }
        
        /* Семейства шрифтов */
        html[data-font-family="sans-serif"] .reader-content {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        
        html[data-font-family="serif"] .reader-content {
          font-family: Georgia, "Times New Roman", serif;
        }
        
        html[data-font-family="monospace"] .reader-content {
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
        }
        
        /* Высота строки */
        html[data-line-height="compact"] .reader-content {
          line-height: 1.3;
        }
        
        html[data-line-height="normal"] .reader-content {
          line-height: 1.6;
        }
        
        html[data-line-height="relaxed"] .reader-content {
          line-height: 1.8;
        }
        
        /* Ширина контента */
        html[data-content-width="narrow"] .reader-container {
          max-width: 600px;
        }
        
        html[data-content-width="normal"] .reader-container {
          max-width: 720px;
        }
        
        html[data-content-width="wide"] .reader-container {
          max-width: 820px;
        }
        
        .reader-toolbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          z-index: 100;
          border-bottom: 1px solid transparent;
        }
        
        html[data-theme="light"] .reader-toolbar {
          background-color: var(--light-bg);
          border-color: var(--light-border);
        }
        
        html[data-theme="dark"] .reader-toolbar {
          background-color: var(--dark-bg);
          border-color: var(--dark-border);
        }
        
        html[data-theme="sepia"] .reader-toolbar {
          background-color: var(--sepia-bg);
          border-color: var(--sepia-border);
        }
        
        .reader-container {
          margin: 68px auto 40px;
          padding: 0 20px;
          width: 100%;
        }
        
        .reader-header {
          margin-bottom: 2rem;
        }
        
        .reader-title {
          font-size: 2em;
          margin-bottom: 0.5em;
        }
        
        .reader-domain {
          opacity: 0.7;
          font-size: 0.9em;
        }
        
        .reader-content {
          margin-bottom: 4rem;
        }
        
        .reader-content img {
          max-width: 100%;
          height: auto;
          margin: 1em 0;
        }
        
        .reader-content a {
          text-decoration: none;
        }
        
        html[data-theme="light"] .reader-content a {
          color: var(--light-link);
        }
        
        html[data-theme="dark"] .reader-content a {
          color: var(--dark-link);
        }
        
        html[data-theme="sepia"] .reader-content a {
          color: var(--sepia-link);
        }
        
        button {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          padding: 8px;
          border-radius: 4px;
        }
        
        button:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }
        
        html[data-theme="dark"] button:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }
        
        .settings-panel {
          position: fixed;
          top: 48px;
          right: 0;
          width: 300px;
          background-color: inherit;
          border-left: 1px solid;
          border-bottom: 1px solid;
          z-index: 99;
          padding: 16px;
          transform: translateX(100%);
          transition: transform 0.3s;
          bottom: 0;
          overflow-y: auto;
        }
        
        html[data-theme="light"] .settings-panel {
          border-color: var(--light-border);
        }
        
        html[data-theme="dark"] .settings-panel {
          border-color: var(--dark-border);
        }
        
        html[data-theme="sepia"] .settings-panel {
          border-color: var(--sepia-border);
        }
        
        .settings-panel.visible {
          transform: translateX(0);
        }
        
        .settings-group {
          margin-bottom: 24px;
        }
        
        .settings-group-title {
          font-size: 14px;
          margin-bottom: 8px;
          opacity: 0.8;
        }
        
        .theme-options, .font-size-options {
          display: flex;
          gap: 8px;
        }
        
        .theme-option, .font-size-option {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
        }
        
        html[data-theme="light"] .theme-option[data-theme-option="light"],
        html[data-theme="dark"] .theme-option[data-theme-option="dark"],
        html[data-theme="sepia"] .theme-option[data-theme-option="sepia"],
        html[data-font-size="small"] .font-size-option[data-font-size="small"],
        html[data-font-size="medium"] .font-size-option[data-font-size="medium"],
        html[data-font-size="large"] .font-size-option[data-font-size="large"],
        html[data-font-size="extra-large"] .font-size-option[data-font-size="extra-large"] {
          border-color: #0060df;
        }
        
        .theme-option[data-theme-option="light"] {
          background-color: #ffffff;
        }
        
        .theme-option[data-theme-option="dark"] {
          background-color: #1c1b22;
        }
        
        .theme-option[data-theme-option="sepia"] {
          background-color: #f4ecd8;
        }
        
        .font-size-option {
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }
        
        .font-size-option[data-font-size="small"] {
          font-size: 12px;
        }
        
        .font-size-option[data-font-size="medium"] {
          font-size: 16px;
        }
        
        .font-size-option[data-font-size="large"] {
          font-size: 18px;
        }
        
        .font-size-option[data-font-size="extra-large"] {
          font-size: 20px;
        }
      </style>
    </head>
    <body>
      <div class="reader-toolbar">
        <button id="close-reader">✕ Выйти из режима чтения</button>
        <button id="settings-toggle">⚙ Настройки</button>
      </div>
      
      <div class="reader-container">
        <header class="reader-header">
          <h1 class="reader-title">${title}</h1>
          <div class="reader-domain">${hostname}</div>
        </header>
        
        <article class="reader-content">
          ${content}
        </article>
      </div>
      
      <div id="settings-panel" class="settings-panel">
        <div class="settings-group">
          <div class="settings-group-title">Тема</div>
          <div class="theme-options">
            <div class="theme-option" data-theme-option="light" title="Светлая"></div>
            <div class="theme-option" data-theme-option="dark" title="Темная"></div>
            <div class="theme-option" data-theme-option="sepia" title="Сепия"></div>
          </div>
        </div>
        
        <div class="settings-group">
          <div class="settings-group-title">Размер шрифта</div>
          <div class="font-size-options">
            <div class="font-size-option" data-font-size="small" title="Маленький">A</div>
            <div class="font-size-option" data-font-size="medium" title="Средний">A</div>
            <div class="font-size-option" data-font-size="large" title="Большой">A</div>
            <div class="font-size-option" data-font-size="extra-large" title="Очень большой">A</div>
          </div>
        </div>
      </div>
      
      <script>
        // Инициализация электронного API
        window.electronAPI = {
          closeReader: async () => {
            try {
              await window.ipcRenderer.invoke('closeReader');
            } catch (error) {
              console.error('Ошибка при закрытии режима чтения:', error);
            }
          },
          updateReaderSettings: async (settings) => {
            try {
              return await window.ipcRenderer.invoke('updateReaderSettings', settings);
            } catch (error) {
              console.error('Ошибка при обновлении настроек режима чтения:', error);
              return { success: false, error: error.message };
            }
          }
        };
      </script>
    </body>
    </html>
  `;
}

// Экспорт функций модуля
module.exports = {
  init,
  getSettings,
  setSettings,
  enableReaderMode,
  disableReaderMode,
  getReaderContent,
  enterReaderMode,
  exitReaderMode,
  READER_HTML_PATH
}; 