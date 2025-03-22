// src/main/protocol.js - Настройка и управление протоколами

const { protocol, app } = require('electron');
const path = require('path');
const fs = require('fs');

// Регистрация протоколов до запуска приложения
function setupProtocols() {
    // Регистрируем схемы как привилегированные до готовности приложения
    // Это необходимо для безопасной работы с настраиваемыми протоколами
    if (!app.isReady()) {
        protocol.registerSchemesAsPrivileged([
            {
                scheme: 'browzyan',
                privileges: {
                    standard: true,
                    secure: true,
                    supportFetchAPI: true,
                    corsEnabled: true,
                    bypassCSP: false
                }
            }
        ]);
    } else {
        console.warn('setupProtocols() должен вызываться до app.isReady()');
    }
}

// Регистрация обработчиков протоколов после запуска приложения
function registerProtocolHandlers(session) {
    if (!session) {
        console.error('Не удалось зарегистрировать обработчики протоколов: сессия не определена');
        return;
    }

    try {
        // Регистрируем browzyan:// протокол для внутренних страниц
        protocol.registerFileProtocol('browzyan', (request, callback) => {
            try {
                // Извлекаем путь из URL
                const url = new URL(request.url);
                let filePath = '';
                
                console.log(`Обработка browzyan URL: ${request.url}, pathname: ${url.pathname}`);

                // Обработка специальных страниц
                if (url.pathname === '/newtab' || url.pathname === '//newtab' || url.pathname === '/') {
                    filePath = path.join(__dirname, '../../renderer/newtab.html');
                    console.log(`Путь к файлу newtab: ${filePath}, существует: ${fs.existsSync(filePath)}`);
                    
                    if (!fs.existsSync(filePath)) {
                        // Пробуем альтернативный путь
                        filePath = path.join(__dirname, '../renderer/newtab.html');
                        console.log(`Альтернативный путь к файлу newtab: ${filePath}, существует: ${fs.existsSync(filePath)}`);
                    }
                } else if (url.pathname === '/pages/history') {
                    filePath = path.join(__dirname, '../renderer/history.html');
                } else if (url.pathname === '/pages/bookmarks') {
                    filePath = path.join(__dirname, '../renderer/bookmarks.html');
                } else if (url.pathname === '/pages/settings') {
                    filePath = path.join(__dirname, '../renderer/settings.html');
                } else if (url.pathname === '/pages/error') {
                    filePath = path.join(__dirname, '../renderer/error.html');
                } else if (url.pathname === '/pages/reader') {
                    filePath = path.join(__dirname, '../assets/pages/reader.html');
                } else {
                    // Любой другой путь пытаемся найти относительно папки assets
                    filePath = path.normalize(path.join(__dirname, '../assets', url.pathname));
                }

                // Проверяем существование файла
                if (fs.existsSync(filePath)) {
                    console.log(`Файл найден: ${filePath}`);
                    return callback(filePath);
                }

                // Если файл не найден, возвращаем ошибку 404
                console.warn(`Файл не найден: ${filePath}`);
                callback({ error: -6 }); // NET::ERR_FILE_NOT_FOUND
            } catch (error) {
                console.error('Ошибка при обработке browzyan:// протокола:', error);
                callback({ error: -2 }); // NET::FAILED
            }
        });

        console.log('Обработчики протоколов успешно зарегистрированы');
    } catch (error) {
        console.error('Ошибка при регистрации обработчиков протоколов:', error);
    }
}

module.exports = {
    setupProtocols,
    registerProtocolHandlers
}; 