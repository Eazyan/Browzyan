const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('cross-fetch');
const { session } = require('electron');
const { get, set, appState } = require('./storage');

// Блокировщик рекламы
let blocker = null;

// Инициализация блокировщика рекламы
async function initAdBlocker() {
  if (appState.adBlockEnabled) {
    try {
      blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
      blocker.enableBlockingInSession(session.defaultSession);
      console.log('Блокировщик рекламы включен');
    } catch (error) {
      console.error('Ошибка при инициализации блокировщика рекламы:', error);
    }
  }
  return blocker;
}

// Включение/выключение блокировки рекламы
async function toggleAdBlock(browserViews) {
  // Инвертируем текущее состояние
  appState.adBlockEnabled = !appState.adBlockEnabled;
  set('adBlockEnabled', appState.adBlockEnabled);
  
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
}

// Обновление правил блокировки
async function updateAdBlockRules(browserViews) {
  if (appState.adBlockEnabled && blocker) {
    await blocker.enableBlockingInSession(session.defaultSession);
    Object.values(browserViews).forEach(view => {
      blocker.enableBlockingInSession(view.webContents.session);
    });
    return true;
  }
  return false;
}

// Проверка, является ли URL рекламой
function isAdvertisement(url) {
  if (!blocker) return false;
  return blocker.match(new Request(url)).match;
}

// Экспорт функций
module.exports = {
  initAdBlocker,
  toggleAdBlock,
  updateAdBlockRules,
  isAdvertisement,
  getBlocker: () => blocker
}; 