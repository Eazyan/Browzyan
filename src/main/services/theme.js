const { nativeTheme } = require('electron');
const { get, set } = require('./storage');

// Доступные темы
const THEMES = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark'
};

// Получение текущей темы
function getCurrentTheme() {
  const savedTheme = get('theme');
  
  // Возвращаем сохраненную тему или системную тему по умолчанию
  return savedTheme || THEMES.SYSTEM;
}

// Проверка, темная ли сейчас тема
function isDarkTheme() {
  const theme = getCurrentTheme();
  
  if (theme === THEMES.DARK) {
    return true;
  } else if (theme === THEMES.LIGHT) {
    return false;
  } else {
    // Если установлена системная тема, проверяем системную настройку
    return nativeTheme.shouldUseDarkColors;
  }
}

// Получение текущей цветовой схемы (для CSS)
function getColorScheme() {
  return isDarkTheme() ? 'dark' : 'light';
}

// Переключение между темной и светлой темой
function toggleDarkMode() {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
  
  return setTheme(newTheme);
}

// Установка конкретной темы
function setTheme(themeName) {
  try {
    if (!Object.values(THEMES).includes(themeName)) {
      return { success: false, error: 'Недопустимое название темы' };
    }
    
    // Сохраняем тему в хранилище
    set('theme', themeName);
    
    // Настраиваем nativeTheme для Electron
    if (themeName === THEMES.DARK) {
      nativeTheme.themeSource = 'dark';
    } else if (themeName === THEMES.LIGHT) {
      nativeTheme.themeSource = 'light';
    } else {
      nativeTheme.themeSource = 'system';
    }
    
    return { 
      success: true, 
      theme: themeName,
      isDark: isDarkTheme()
    };
  } catch (error) {
    console.error('Ошибка при установке темы:', error);
    return { success: false, error: error.message };
  }
}

// Получение доступных тем
function getAvailableThemes() {
  return Object.values(THEMES);
}

// Получение темы, соответствующей системным настройкам
function getSystemTheme() {
  return nativeTheme.shouldUseDarkColors ? THEMES.DARK : THEMES.LIGHT;
}

// Инициализация темы при запуске приложения
function initTheme() {
  const savedTheme = getCurrentTheme();
  
  // Устанавливаем тему в соответствии с сохраненными настройками
  if (savedTheme === THEMES.DARK) {
    nativeTheme.themeSource = 'dark';
  } else if (savedTheme === THEMES.LIGHT) {
    nativeTheme.themeSource = 'light';
  } else {
    nativeTheme.themeSource = 'system';
  }
  
  // Возвращаем текущее состояние темы
  return {
    theme: savedTheme,
    isDark: isDarkTheme(),
    systemTheme: getSystemTheme()
  };
}

// Настройка слушателей изменения темы
function setupThemeListeners(mainWindow) {
  // Слушатель изменения системной темы
  nativeTheme.on('updated', () => {
    const currentTheme = getCurrentTheme();
    
    // Отправляем событие об изменении темы только если используется системная тема
    if (currentTheme === THEMES.SYSTEM && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('theme-updated', {
        theme: currentTheme,
        isDark: isDarkTheme(),
        systemTheme: getSystemTheme()
      });
    }
  });
}

// Экспорт функций и констант
module.exports = {
  getCurrentTheme,
  isDarkTheme,
  getColorScheme,
  toggleDarkMode,
  setTheme,
  getAvailableThemes,
  getSystemTheme,
  initTheme,
  setupThemeListeners,
  THEMES
}; 