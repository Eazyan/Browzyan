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

// Функция для расчета скорости загрузки
function calculateSpeed(download) {
  const now = Date.now();
  const elapsed = (now - download.startTime) / 1000; // в секундах
  if (elapsed <= 0) return 0;
  
  const bytesPerSecond = download.receivedBytes / elapsed;
  return bytesPerSecond;
}

module.exports = {
  formatFileSize,
  formatTime,
  calculateSpeed
}; 