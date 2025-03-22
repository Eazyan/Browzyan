// src/main.js - Главный файл приложения, основная точка входа

const { app, BrowserWindow, session, protocol, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');

// Импорт сервисов
const storage = require('./main/services/storage');
const tabs = require('./main/services/tabs');
const history = require('./main/services/history');
const bookmarks = require('./main/services/bookmarks');
const adblock = require('./main/services/adblock');
const downloads = require('./main/services/downloads');
const reader = require('./main/services/reader');
const translate = require('./main/services/translate');
const theme = require('./main/services/theme');

// Импорт утилит
const { setupProtocols } = require('./main/protocol');
const { setupSecurity } = require('./main/security');
const { registerIpcHandlers } = require('./main/ipc');

// Глобальные переменные
let mainWindow = null;
let services = {};

// Проверка запуска только одного экземпляра приложения
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.log('Уже запущен другой экземпляр приложения. Закрываемся.');
    app.quit();
    return;
}

// Регистрация протоколов до готовности приложения
setupProtocols();

// Обработка перезапуска приложения
app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

// Настройка перед загрузкой приложения
app.whenReady().then(async () => {
    try {
        console.log('Приложение готово к запуску');
        
        // Инициализация сервисов
        setupServices();
        
        // Создание основного окна
        createMainWindow();
        
        // Настройка безопасности
        setupSecurity(mainWindow);
        
        // Регистрация протоколов
        const { registerProtocolHandlers } = require('./main/protocol');
        registerProtocolHandlers(session.defaultSession);
        
        // Регистрация IPC обработчиков
        registerIpcHandlers(mainWindow);
        
        console.log('Приложение успешно запущено');
    } catch (error) {
        console.error('Ошибка при запуске приложения:', error);
    }
});

// Инициализация сервисов
function setupServices() {
    try {
        console.log('Настройка сервисов...');
        
        // Добавляем все сервисы в объект services
        services.storage = storage;
        services.tabs = tabs;
        services.history = history;
        services.bookmarks = bookmarks;
        services.adblock = adblock;
        services.downloads = downloads;
        services.reader = reader;
        services.translate = translate;
        services.theme = theme;
        
        console.log('Все сервисы успешно настроены');
    } catch (error) {
        console.error('Ошибка при настройке сервисов:', error);
        throw error;
    }
}

// Создание основного окна приложения
function createMainWindow() {
    console.log('Создание основного окна приложения...');
    
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, 'assets/icons/app-icon.png'),
        show: false, // Не показываем окно до полной загрузки
        backgroundColor: '#ffffff',
        webPreferences: {
            nodeIntegration: false, // Для безопасности
            contextIsolation: true, // Для безопасности
            sandbox: true, // Для безопасности
            preload: path.join(__dirname, 'preload.js'), // Путь к скрипту предзагрузки
            webviewTag: false, // Отключаем тег webview в пользу BrowserView
            webSecurity: true, // Включаем веб-безопасность
            spellcheck: true, // Включаем проверку орфографии
            enableRemoteModule: false // Отключаем удаленный модуль
        }
    });
    
    // Загрузка начальной страницы
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'renderer/index.html'),
        protocol: 'file:',
        slashes: true
    }));
    
    // Показываем окно после полной загрузки
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Инициализация вкладок после загрузки окна
        tabs.init(mainWindow, services.adblock);
        
        // Применение темы
        applyTheme();
    });
    
    // Обработка закрытия окна
    mainWindow.on('closed', () => {
        console.log('Основное окно закрыто');
        mainWindow = null;
    });
    
    console.log('Основное окно создано');
    return mainWindow;
}

// Применение темы
function applyTheme() {
    try {
        const isDarkMode = theme.getCurrentTheme ? theme.getCurrentTheme() : storage.get('darkMode');
        if (isDarkMode) {
            mainWindow.webContents.send('theme:changed', 'dark');
        }
    } catch (error) {
        console.error('Ошибка при применении темы:', error);
    }
}

// Обработка закрытия приложения
app.on('window-all-closed', () => {
    console.log('Все окна закрыты');
    
    // На macOS приложение остается активным до явного выхода через Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Обработка активации приложения (на macOS)
app.on('activate', () => {
    console.log('Приложение активировано');
    
    // На macOS пересоздаем окно при активации иконки в доке
    if (mainWindow === null) {
        createMainWindow();
    }
});

// Обработка выхода из приложения
app.on('quit', () => {
    console.log('Приложение закрывается');
});

// Обработка ошибок
process.on('uncaughtException', (error) => {
    console.error('Необработанное исключение:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Необработанный reject:', reason);
}); 