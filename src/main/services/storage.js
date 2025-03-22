const Store = require('electron-store');
const { nativeTheme } = require('electron');

// Название приложения и URL по умолчанию
const APP_NAME = 'Browzyan';
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
    // История просмотра
    history: [],
    // Топ сайтов
    topSites: []
  }
});

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
  history: store.get('history'),
  topSites: store.get('topSites'),
  nextTabId: 2 // Начальный ID для новых вкладок
};

// Очистка хранилища вкладок
function clearTabs() {
  try {
    console.log('Очистка хранилища вкладок...');
    // Вместо полной очистки, устанавливаем начальную вкладку
    const initialTabs = [
      { id: 1, url: DEFAULT_SEARCH_URL, title: 'Новая вкладка' }
    ];
    appState.tabs = initialTabs;
    appState.activeTabId = 1;
    store.set('tabs', initialTabs);
    store.set('activeTabId', 1);
    console.log('Вкладки успешно очищены и установлена начальная вкладка');
    return true;
  } catch (error) {
    console.error('Ошибка при очистке вкладок:', error);
    return false;
  }
}

// Геттеры и сеттеры для доступа к хранилищу
function get(key) {
  return appState[key];
}

function set(key, value) {
  appState[key] = value;
  store.set(key, value);
  return value;
}

// Экспорт констант и функций
module.exports = {
  store,
  appState,
  APP_NAME,
  DEFAULT_SEARCH_URL,
  DEFAULT_SEARCH_QUERY_URL,
  get,
  set,
  clearTabs
}; 