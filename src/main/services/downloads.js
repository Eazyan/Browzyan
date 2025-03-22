const { dialog, shell, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { get, set } = require('./storage');
const os = require('os');
const { formatFileSize, calculateSpeed } = require('../../utils/format');
const { appState } = require('./storage');

// Константы
const MAX_DOWNLOADS_HISTORY = 100;
const DOWNLOADS_STORAGE_KEY = 'downloadsHistory';

// Переменные для отслеживания загрузок
let activeDownloads = new Map(); // id -> downloadItem
let mainWindow = null;
let downloadCounter = 0;

// Получение пути к папке загрузок
function getDownloadPath() {
  try {
    // Получаем путь из настроек пользователя
    const userPath = get('downloadPath');
    
    if (userPath && fs.existsSync(userPath)) {
      return userPath;
    }
    
    // Если путь не задан или недоступен, используем стандартную папку загрузок
    const defaultPath = BrowserWindow.getAllWindows()[0].webContents.session.getDownloadPath();
    return defaultPath;
  } catch (error) {
    console.error('Ошибка при получении пути загрузок:', error);
    return BrowserWindow.getAllWindows()[0].webContents.session.getDownloadPath();
  }
}

// Инициализация модуля загрузок
function init(window) {
  mainWindow = window;
  
  // Регистрация обработчика загрузок
  window.webContents.session.on('will-download', handleDownload);
}

// Обработчик события загрузки
function handleDownload(event, item, webContents) {
  try {
    const fileName = item.getFilename();
    const fileSize = item.getTotalBytes();
    const downloadId = ++downloadCounter;
    const savePath = path.join(getDownloadPath(), fileName);
    
    // Устанавливаем путь сохранения
    item.setSavePath(savePath);
    
    // Создаем объект загрузки
    const downloadItem = {
      id: downloadId,
      url: item.getURL(),
      filename: fileName,
      path: savePath,
      size: fileSize,
      received: 0,
      progress: 0,
      status: 'progressing',
      startTime: Date.now(),
      speed: 0,
      mime: item.getMimeType() || 'application/octet-stream',
      canResume: false
    };
    
    // Добавляем загрузку в список активных
    activeDownloads.set(downloadId, {
      item,
      info: downloadItem
    });
    
    // Отправляем информацию о новой загрузке
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-created', downloadItem);
    }
    
    // Обработчик прогресса загрузки
    item.on('updated', (event, state) => {
      if (state === 'progressing') {
        const received = item.getReceivedBytes();
        const total = item.getTotalBytes();
        const progress = total > 0 ? (received / total) : 0;
        const now = Date.now();
        const elapsedTime = now - downloadItem.startTime;
        const speed = elapsedTime > 0 ? (received / (elapsedTime / 1000)) : 0;
        
        // Обновляем информацию о загрузке
        downloadItem.received = received;
        downloadItem.progress = progress;
        downloadItem.status = 'progressing';
        downloadItem.speed = speed;
        downloadItem.canResume = item.canResume();
        
        // Отправляем обновление
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-updated', downloadItem);
        }
      } else if (state === 'interrupted') {
        downloadItem.status = 'interrupted';
        
        // Отправляем обновление
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-updated', downloadItem);
        }
      }
    });
    
    // Обработчик завершения загрузки
    item.once('done', (event, state) => {
      const endTime = Date.now();
      const duration = endTime - downloadItem.startTime;
      
      if (state === 'completed') {
        // Загрузка успешно завершена
        downloadItem.status = 'completed';
        downloadItem.progress = 1;
        downloadItem.endTime = endTime;
        downloadItem.duration = duration;
        
        // Добавляем в историю загрузок
        addToDownloadsHistory(downloadItem);
        
        // Отправляем обновление
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-completed', downloadItem);
        }
      } else if (state === 'cancelled') {
        // Загрузка отменена пользователем
        downloadItem.status = 'cancelled';
        downloadItem.endTime = endTime;
        downloadItem.duration = duration;
        
        // Отправляем обновление
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-cancelled', downloadItem);
        }
        
        // Удаляем недозагруженный файл
        if (fs.existsSync(savePath)) {
          try {
            fs.unlinkSync(savePath);
          } catch (error) {
            console.error('Ошибка при удалении недозагруженного файла:', error);
          }
        }
      } else {
        // Ошибка загрузки
        downloadItem.status = 'failed';
        downloadItem.error = 'Ошибка загрузки файла';
        downloadItem.endTime = endTime;
        downloadItem.duration = duration;
        
        // Отправляем обновление
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-failed', downloadItem);
        }
        
        // Удаляем недозагруженный файл
        if (fs.existsSync(savePath)) {
          try {
            fs.unlinkSync(savePath);
          } catch (error) {
            console.error('Ошибка при удалении недозагруженного файла:', error);
          }
        }
      }
      
      // Удаляем из активных загрузок
      activeDownloads.delete(downloadId);
    });
  } catch (error) {
    console.error('Ошибка при обработке загрузки:', error);
  }
}

// Добавление записи в историю загрузок
function addToDownloadsHistory(downloadItem) {
  try {
    // Получаем текущую историю загрузок
    let history = get(DOWNLOADS_STORAGE_KEY) || [];
    
    // Добавляем новую запись
    history.unshift({
      id: downloadItem.id,
      url: downloadItem.url,
      filename: downloadItem.filename,
      path: downloadItem.path,
      size: downloadItem.size,
      mime: downloadItem.mime,
      startTime: downloadItem.startTime,
      endTime: downloadItem.endTime,
      duration: downloadItem.duration
    });
    
    // Ограничиваем размер истории
    if (history.length > MAX_DOWNLOADS_HISTORY) {
      history = history.slice(0, MAX_DOWNLOADS_HISTORY);
    }
    
    // Сохраняем историю
    set(DOWNLOADS_STORAGE_KEY, history);
  } catch (error) {
    console.error('Ошибка при добавлении в историю загрузок:', error);
  }
}

// Получение списка загрузок (активные + история)
function getDownloads() {
  try {
    // Получаем активные загрузки
    const active = Array.from(activeDownloads.values()).map(item => item.info);
    
    // Получаем историю загрузок
    const history = get(DOWNLOADS_STORAGE_KEY) || [];
    
    // Объединяем и сортируем по времени (сначала новые)
    const allDownloads = [...active, ...history].sort((a, b) => b.startTime - a.startTime);
    
    return allDownloads;
  } catch (error) {
    console.error('Ошибка при получении списка загрузок:', error);
    return [];
  }
}

// Приостановка загрузки
function pauseDownload(downloadId) {
  try {
    const download = activeDownloads.get(downloadId);
    if (download && download.item && download.item.canResume()) {
      download.item.pause();
      download.info.status = 'paused';
      
      // Отправляем обновление
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-updated', download.info);
      }
      
      return { success: true };
    }
    return { success: false, error: 'Не удалось приостановить загрузку' };
  } catch (error) {
    console.error('Ошибка при приостановке загрузки:', error);
    return { success: false, error: error.message };
  }
}

// Возобновление загрузки
function resumeDownload(downloadId) {
  try {
    const download = activeDownloads.get(downloadId);
    if (download && download.item && download.item.isPaused()) {
      download.item.resume();
      download.info.status = 'progressing';
      
      // Отправляем обновление
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-updated', download.info);
      }
      
      return { success: true };
    }
    return { success: false, error: 'Не удалось возобновить загрузку' };
  } catch (error) {
    console.error('Ошибка при возобновлении загрузки:', error);
    return { success: false, error: error.message };
  }
}

// Отмена загрузки
function cancelDownload(downloadId) {
  try {
    const download = activeDownloads.get(downloadId);
    if (download && download.item) {
      download.item.cancel();
      return { success: true };
    }
    return { success: false, error: 'Не удалось отменить загрузку' };
  } catch (error) {
    console.error('Ошибка при отмене загрузки:', error);
    return { success: false, error: error.message };
  }
}

// Открытие загруженного файла
function openDownload(downloadId) {
  try {
    // Проверяем в активных загрузках
    const activeDownload = activeDownloads.get(downloadId);
    if (activeDownload) {
      if (activeDownload.info.status === 'completed') {
        shell.openPath(activeDownload.info.path);
        return { success: true };
      }
      return { success: false, error: 'Файл еще не загружен' };
    }
    
    // Проверяем в истории загрузок
    const history = get(DOWNLOADS_STORAGE_KEY) || [];
    const download = history.find(d => d.id === downloadId);
    
    if (download) {
      if (fs.existsSync(download.path)) {
        shell.openPath(download.path);
        return { success: true };
      }
      return { success: false, error: 'Файл не найден на диске' };
    }
    
    return { success: false, error: 'Загрузка не найдена' };
  } catch (error) {
    console.error('Ошибка при открытии загруженного файла:', error);
    return { success: false, error: error.message };
  }
}

// Показ загруженного файла в папке
function showDownloadInFolder(downloadId) {
  try {
    // Проверяем в активных загрузках
    const activeDownload = activeDownloads.get(downloadId);
    if (activeDownload) {
      shell.showItemInFolder(activeDownload.info.path);
      return { success: true };
    }
    
    // Проверяем в истории загрузок
    const history = get(DOWNLOADS_STORAGE_KEY) || [];
    const download = history.find(d => d.id === downloadId);
    
    if (download) {
      if (fs.existsSync(download.path)) {
        shell.showItemInFolder(download.path);
        return { success: true };
      }
      return { success: false, error: 'Файл не найден на диске' };
    }
    
    return { success: false, error: 'Загрузка не найдена' };
  } catch (error) {
    console.error('Ошибка при показе файла в папке:', error);
    return { success: false, error: error.message };
  }
}

// Очистка истории загрузок
function clearDownloads() {
  try {
    set(DOWNLOADS_STORAGE_KEY, []);
    return { success: true };
  } catch (error) {
    console.error('Ошибка при очистке истории загрузок:', error);
    return { success: false, error: error.message };
  }
}

// Открытие папки загрузок
function openDownloadDirectory() {
  try {
    const downloadPath = getDownloadPath();
    if (fs.existsSync(downloadPath)) {
      shell.openPath(downloadPath);
      return { success: true, path: downloadPath };
    }
    return { success: false, error: 'Папка загрузок не найдена' };
  } catch (error) {
    console.error('Ошибка при открытии папки загрузок:', error);
    return { success: false, error: error.message };
  }
}

// Изменение пути для сохранения загрузок
async function setDownloadPath() {
  try {
    if (!mainWindow) {
      return { success: false, error: 'Окно не инициализировано' };
    }
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Выберите папку для загрузок',
      defaultPath: getDownloadPath()
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const newPath = result.filePaths[0];
      set('downloadPath', newPath);
      return { success: true, path: newPath };
    }
    
    return { success: false, error: 'Выбор папки отменен пользователем' };
  } catch (error) {
    console.error('Ошибка при установке пути загрузок:', error);
    return { success: false, error: error.message };
  }
}

// Переключение видимости панели загрузок
function toggleDownloadsPanel(isVisible) {
  appState.downloadsPanelVisible = isVisible !== undefined ? isVisible : !appState.downloadsPanelVisible;
  return appState.downloadsPanelVisible;
}

// Экспорт функций
module.exports = {
  init,
  getDownloadPath,
  formatFileSize,
  getDownloads,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  openDownload,
  showDownloadInFolder,
  clearDownloads,
  openDownloadDirectory,
  setDownloadPath,
  toggleDownloadsPanel,
  isDownloadsPanelVisible: () => appState.downloadsPanelVisible
}; 