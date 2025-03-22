const { get, set, appState } = require('./storage');

// Получение списка закладок
function getBookmarks() {
  return appState.bookmarks;
}

// Добавление закладки
function addBookmark(bookmark) {
  // Проверяем, существует ли уже такая закладка
  const existingIndex = appState.bookmarks.findIndex(b => b.url === bookmark.url);
  
  if (existingIndex !== -1) {
    // Обновляем существующую закладку
    appState.bookmarks[existingIndex] = bookmark;
  } else {
    // Добавляем новую закладку
    appState.bookmarks.push(bookmark);
  }
  
  // Сохраняем в хранилище
  set('bookmarks', appState.bookmarks);
  
  return appState.bookmarks;
}

// Удаление закладки по URL
function removeBookmark(url) {
  // Фильтруем массив, удаляя закладку с указанным URL
  appState.bookmarks = appState.bookmarks.filter(bookmark => bookmark.url !== url);
  
  // Сохраняем в хранилище
  set('bookmarks', appState.bookmarks);
  
  return appState.bookmarks;
}

// Проверка, является ли URL закладкой
function isBookmarked(url) {
  return appState.bookmarks.some(bookmark => bookmark.url === url);
}

// Получение закладки по URL
function getBookmark(url) {
  return appState.bookmarks.find(bookmark => bookmark.url === url);
}

// Экспорт функций
module.exports = {
  getBookmarks,
  addBookmark,
  removeBookmark,
  isBookmarked,
  getBookmark
}; 