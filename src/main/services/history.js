const { get, set, appState } = require('./storage');

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
  set('history', appState.history);
  
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
  set('topSites', appState.topSites);
}

// Функция поиска по истории
function searchHistory(query) {
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
}

// Функция очистки всей истории
function clearHistory() {
  appState.history = [];
  set('history', []);
  
  // Сбрасываем также топ сайтов
  appState.topSites = [];
  set('topSites', []);
  
  return true;
}

// Функция удаления одной записи из истории
function deleteHistoryItem(url) {
  const initialLength = appState.history.length;
  appState.history = appState.history.filter(item => item.url !== url);
  
  // Если были удалены записи, обновляем хранилище и топ сайтов
  if (initialLength !== appState.history.length) {
    set('history', appState.history);
    updateTopSites();
    return true;
  }
  
  return false;
}

// Функция очистки истории за период
function clearHistoryPeriod(period) {
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
    set('history', appState.history);
    updateTopSites();
    return true;
  }
  
  return false;
}

// Экспорт функций
module.exports = {
  addToHistory,
  updateTopSites,
  searchHistory,
  clearHistory,
  deleteHistoryItem,
  clearHistoryPeriod,
  getHistory: () => appState.history,
  getTopSites: () => appState.topSites
}; 