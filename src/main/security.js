// src/main/security.js - Настройка безопасности приложения

const { session, app } = require('electron');
const path = require('path');

// Настройка политик безопасности для окна
function setupSecurity(mainWindow) {
    if (!mainWindow) {
        console.error('Не удалось настроить безопасность: mainWindow не определен');
        return;
    }

    try {
        // Получение сессии по умолчанию
        const defaultSession = session.defaultSession;
        
        // Настройка политики безопасности содержимого (Content Security Policy - CSP)
        defaultSession.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [
                        "default-src 'self'; " +
                        "script-src 'self'; " +
                        "style-src 'self' 'unsafe-inline'; " +
                        "img-src 'self' data: https:; " +
                        "connect-src 'self' https:; " +
                        "font-src 'self'; " +
                        "object-src 'none'; " +
                        "media-src 'self'; " +
                        "child-src 'self';"
                    ]
                }
            });
        });
        
        // Настройка дополнительных заголовков безопасности
        defaultSession.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'X-Content-Type-Options': ['nosniff'],
                    'X-Frame-Options': ['SAMEORIGIN'],
                    'X-XSS-Protection': ['1; mode=block'],
                    'Referrer-Policy': ['strict-origin-when-cross-origin']
                }
            });
        });
        
        // Фильтрация небезопасных URL (фишинг, вредоносные сайты)
        defaultSession.webRequest.onBeforeRequest((details, callback) => {
            // Здесь можно реализовать проверку URL по базе данных фишинговых и вредоносных сайтов
            // Для примера просто пропускаем все запросы
            callback({ cancel: false });
        });
        
        // Блокировка небезопасных протоколов, кроме file: для доступа к локальным файлам в рамках приложения
        const blockedProtocols = ['javascript:', 'data:', 'ftp:'];
        defaultSession.webRequest.onBeforeRequest((details, callback) => {
            const url = details.url.toLowerCase();
            
            // Разрешаем внутренние протоколы
            if (url.startsWith('browzyan://')) {
                return callback({ cancel: false });
            }
            
            // Разрешаем file: протокол для локальных файлов приложения
            if (url.startsWith('file:') && url.includes('/Users/eazyan/Documents/BrowserTest/src/')) {
                return callback({ cancel: false });
            }
            
            // Проверяем, начинается ли URL с одного из заблокированных протоколов
            const isBlockedProtocol = blockedProtocols.some(protocol => url.startsWith(protocol));
            if (isBlockedProtocol) {
                console.warn(`Заблокирован доступ к ресурсу с небезопасным протоколом: ${details.url}`);
                return callback({ cancel: true });
            }
            
            callback({ cancel: false });
        });
        
        // Настройка разрешений для веб-функций
        const permissions = [
            'clipboard-read',
            'clipboard-write',
            'notifications',
            'fullscreen',
            'geolocation',
            'microphone',
            'camera'
        ];
        
        // Обработчик запросов разрешений
        defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
            const url = webContents.getURL();
            
            // Проверяем, является ли запрашиваемое разрешение одним из разрешенных
            if (permissions.includes(permission)) {
                // Здесь можно реализовать проверку доверенных сайтов или спрашивать пользователя
                callback(true); // Разрешаем
            } else {
                console.warn(`Заблокирован запрос разрешения ${permission} для ${url}`);
                callback(false); // Блокируем
            }
        });
        
        console.log('Настройки безопасности успешно применены');
    } catch (error) {
        console.error('Ошибка при настройке безопасности:', error);
    }
}

// Настройка безопасности для вкладок
function setupTabSecurity(browserView) {
    if (!browserView) {
        console.error('Не удалось настроить безопасность вкладки: browserView не определен');
        return;
    }
    
    try {
        // Блокировка открытия новых окон
        browserView.webContents.setWindowOpenHandler(({ url }) => {
            // Обрабатываем URL, открывая его в новой вкладке вместо нового окна
            console.log(`Перехвачена попытка открыть новое окно: ${url}`);
            
            // Возвращаем действие "deny", чтобы заблокировать открытие нового окна
            return { action: 'deny' };
            
            // В реальном приложении здесь нужно добавить логику создания новой вкладки
            // и перенаправления URL в неё
        });
        
        // Запрет выполнения небезопасного кода
        browserView.webContents.executeJavaScript(`
            // Блокируем eval и некоторые другие опасные функции
            window.eval = null;
            Object.defineProperty(window, 'eval', {
                value: null,
                writable: false,
                configurable: false
            });
            
            // Перехватываем console.error для логирования ошибок
            const originalConsoleError = console.error;
            console.error = function() {
                // Логируем ошибки на странице
                originalConsoleError.apply(console, arguments);
            };
            
            console.log('Безопасность страницы настроена');
        `).catch(error => {
            console.error('Ошибка при настройке безопасности JavaScript во вкладке:', error);
        });
        
        console.log('Настройки безопасности для вкладки успешно применены');
    } catch (error) {
        console.error('Ошибка при настройке безопасности вкладки:', error);
    }
}

module.exports = {
    setupSecurity,
    setupTabSecurity
}; 