// renderer.js - Главный файл клиентской логики Browzyan Browser

// Подключение API, предоставляемого через preload.js
const { 
    tabs, 
    navigation, 
    history, 
    downloads, 
    bookmarks, 
    adblock, 
    reader, 
    theme, 
    translate,
    settings
} = window.browzyanAPI;

// ============ Состояние приложения ============
let activeTabId = null;  // ID активной вкладки
let sidebarVisible = false;  // Состояние боковой панели
let downloadsVisible = false;  // Состояние панели загрузок
let readerModeActive = false;  // Статус режима чтения
let isDarkMode = false;  // Темная тема

// ============ Элементы DOM ============
// Вкладки
const tabsList = document.getElementById('tabsList');
const addTabButton = document.getElementById('addTabButton');

// Навигация
const backButton = document.getElementById('backButton');
const forwardButton = document.getElementById('forwardButton');
const refreshButton = document.getElementById('refreshButton');

// URL-строка
const urlForm = document.getElementById('urlForm');
const urlInput = document.getElementById('urlInput');

// Кнопки действий
const readerModeButton = document.getElementById('readerModeButton');
const downloadsButton = document.getElementById('downloadsButton');
const bookmarkButton = document.getElementById('bookmarkButton');
const darkModeButton = document.getElementById('darkModeButton');
const focusModeButton = document.getElementById('focusModeButton');
const menuButton = document.getElementById('menuButton');

// Панели
const sidebar = document.getElementById('sidebar');
const downloadsPanel = document.getElementById('downloadsPanel');
const closeDownloadsButton = document.getElementById('closeDownloadsButton');
const mainContent = document.getElementById('mainContent');

// ============ Инициализация приложения ============
document.addEventListener('DOMContentLoaded', () => {
    initTheme();       // Инициализация темы
    initTabs();        // Инициализация вкладок
    initEventListeners(); // Добавление обработчиков событий
});

// ============ Функции инициализации ============
// Инициализация темы
function initTheme() {
    theme.getTheme().then(themeName => {
        isDarkMode = themeName === 'dark';
        applyTheme(isDarkMode);
    });
}

// Инициализация вкладок
function initTabs() {
    console.log('Инициализация вкладок в renderer');
    tabs.getAllTabs().then(allTabs => {
        console.log('Получены вкладки из main процесса:', allTabs);
        
        if (allTabs.length === 0) {
            console.log('Нет сохраненных вкладок, создаем новую');
            tabs.createTab('https://ya.ru');
        } else {
            console.log('Добавляем сохраненные вкладки в DOM:', allTabs.length);
            allTabs.forEach(tab => {
                createTabElement(tab);
            });
            
            tabs.getActiveTab().then(tab => {
                console.log('Активная вкладка:', tab);
                if (tab) {
                    activeTabId = tab.id;
                    updateActiveTab(activeTabId);
                    updateUrlBar(tab.url);
                }
            });
        }
    });
}

// Добавление обработчиков событий
function initEventListeners() {
    // Кнопки навигации
    backButton.addEventListener('click', () => navigation.goBack());
    forwardButton.addEventListener('click', () => navigation.goForward());
    refreshButton.addEventListener('click', () => navigation.reload());
    
    // URL-строка
    urlForm.addEventListener('submit', handleUrlSubmit);
    
    // Создание новой вкладки
    addTabButton.addEventListener('click', () => {
        console.log('Нажата кнопка создания новой вкладки');
        tabs.createTab('browzyan://newtab')
            .then(tabId => {
                console.log(`Создана новая вкладка с ID: ${tabId}`);
            })
            .catch(error => {
                console.error('Ошибка при создании новой вкладки:', error);
            });
    });
    
    // Кнопки действий
    readerModeButton.addEventListener('click', toggleReaderMode);
    bookmarkButton.addEventListener('click', toggleBookmark);
    downloadsButton.addEventListener('click', toggleDownloadsPanel);
    darkModeButton.addEventListener('click', toggleDarkMode);
    focusModeButton.addEventListener('click', toggleFocusMode);
    menuButton.addEventListener('click', toggleSidebar);
    
    // Панель загрузок
    closeDownloadsButton.addEventListener('click', toggleDownloadsPanel);
    
    // Обработка горячих клавиш
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Слушатели событий от main процесса
    listenForIpcEvents();
}

// Настройка IPC-слушателей событий от main процесса
function listenForIpcEvents() {
    // Обновление вкладок
    tabs.onCreated(tab => {
        console.log('Событие tabs:created получено в renderer', tab);
        
        // Проверяем, существует ли уже элемент для этой вкладки
        const existingTab = document.querySelector(`.tab[data-tab-id="${tab.id}"]`);
        if (!existingTab) {
            createTabElement(tab);
            // Активируем вкладку, если это первая вкладка
            if (tabsList.children.length === 1) {
                activeTabId = tab.id;
                updateActiveTab(activeTabId);
            }
        } else {
            console.log('Вкладка уже существует в DOM:', tab.id);
        }
    });
    
    tabs.onUpdated((tabId, changeInfo) => {
        updateTabElement(tabId, changeInfo);
        
        if (tabId === activeTabId) {
            if (changeInfo.url) {
                updateUrlBar(changeInfo.url);
            }
            
            if (changeInfo.title) {
                document.title = `${changeInfo.title} - Browzyan`;
            }
            
            if (changeInfo.isLoading !== undefined) {
                updateLoadingState(tabId, changeInfo.isLoading);
            }
        }
    });
    
    tabs.onRemoved(tabId => {
        removeTabElement(tabId);
    });
    
    tabs.onActivated(tabId => {
        activeTabId = tabId;
        updateActiveTab(tabId);
        
        // Получаем информацию о вкладке и обновляем URL-строку
        tabs.getTab(tabId).then(tab => {
            if (tab) {
                updateUrlBar(tab.url);
                updateNavigationState(tab.canGoBack, tab.canGoForward);
            }
        });
    });
    
    // События истории навигации
    navigation.onNavigationStateChanged((tabId, canGoBack, canGoForward) => {
        if (tabId === activeTabId) {
            updateNavigationState(canGoBack, canGoForward);
        }
    });
    
    // События загрузок
    downloads.onCreated(downloadItem => {
        addDownloadElement(downloadItem);
    });
    
    downloads.onUpdated((downloadId, changeInfo) => {
        updateDownloadElement(downloadId, changeInfo);
    });
}

// ============ Функции управления вкладками ============
// Создание DOM-элемента вкладки
function createTabElement(tab) {
    console.log('Создание DOM-элемента для вкладки:', tab);
    
    // Проверяем, существует ли уже элемент для этой вкладки
    const existingTab = document.querySelector(`.tab[data-tab-id="${tab.id}"]`);
    if (existingTab) {
        console.log(`Вкладка с ID ${tab.id} уже существует в DOM`);
        return existingTab;
    }
    
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.setAttribute('data-tab-id', tab.id);  // Важно использовать setAttribute для корректной работы
    tabElement.innerHTML = `
        <span class="tab-title">${tab.title || 'Новая вкладка'}</span>
        <span class="tab-close"><i class="fas fa-times"></i></span>
    `;
    
    // Переключение на вкладку при клике
    tabElement.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab-close')) {
            const tabId = parseInt(tab.id, 10);
            console.log(`Клик на вкладке с ID: ${tabId}, активируем...`);
            
            // Добавляем визуальную обратную связь при клике
            tabElement.classList.add('clicking');
            setTimeout(() => tabElement.classList.remove('clicking'), 150);
            
            // Активируем вкладку
            try {
                tabs.activateTab(tabId)
                    .then(() => {
                        console.log(`Вкладка ${tabId} успешно активирована`);
                    })
                    .catch(error => {
                        console.error(`Ошибка при активации вкладки ${tabId}:`, error);
                    });
            } catch (error) {
                console.error(`Исключение при активации вкладки ${tabId}:`, error);
            }
        }
    });
    
    // Добавляем обработчик правого клика и контекстное меню
    tabElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const tabId = parseInt(tab.id, 10);
        console.log(`Правый клик на вкладке с ID: ${tabId}`);
        
        // Создаем элементы контекстного меню
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" data-action="close-others">Закрыть остальные вкладки</div>
        `;
        
        // Позиционируем меню
        menu.style.top = `${e.clientY}px`;
        menu.style.left = `${e.clientX}px`;
        
        // Добавляем в DOM
        document.body.appendChild(menu);
        
        // Обработчик клика на пункт меню
        menu.addEventListener('click', (menuEvent) => {
            const action = menuEvent.target.getAttribute('data-action');
            if (action === 'close-others') {
                console.log(`Закрываем все вкладки, кроме ${tabId}`);
                closeOtherTabs(tabId);
            }
            // Удаляем меню после выбора
            menu.remove();
        });
        
        // Скрываем меню при клике в другом месте
        document.addEventListener('click', () => {
            menu.remove();
        }, { once: true });
        
        // Скрываем меню при прокрутке
        document.addEventListener('scroll', () => {
            menu.remove();
        }, { once: true });
    });
    
    // Закрытие вкладки при клике на крестик
    const closeButton = tabElement.querySelector('.tab-close');
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = parseInt(tab.id, 10);
        console.log(`Клик на закрытие вкладки с ID: ${tabId}`);
        
        // Добавляем визуальную обратную связь при клике
        closeButton.classList.add('closing');
        tabElement.classList.add('closing');
        
        // Небольшая задержка для анимации
        setTimeout(() => {
            try {
                tabs.closeTab(tabId)
                    .then(result => {
                        console.log(`Вкладка ${tabId} успешно закрыта`);
                    })
                    .catch(error => {
                        console.error(`Ошибка при закрытии вкладки ${tabId}:`, error);
                        // Восстанавливаем визуальное состояние в случае ошибки
                        closeButton.classList.remove('closing');
                        tabElement.classList.remove('closing');
                    });
            } catch (error) {
                console.error(`Исключение при закрытии вкладки ${tabId}:`, error);
                // Восстанавливаем визуальное состояние в случае ошибки
                closeButton.classList.remove('closing');
                tabElement.classList.remove('closing');
            }
        }, 50);
    });
    
    console.log('Добавление вкладки в DOM:', tab.id);
    tabsList.appendChild(tabElement);
    
    // Если это новая вкладка и она единственная, активируем её
    if (tabsList.children.length === 1) {
        activeTabId = tab.id;
        updateActiveTab(tab.id);
    }
    
    return tabElement;
}

// Функция для закрытия всех вкладок, кроме указанной
function closeOtherTabs(tabId) {
    console.log(`Закрытие всех вкладок, кроме ${tabId}`);
    
    // Получаем все вкладки
    tabs.getAllTabs().then(allTabs => {
        // Фильтруем вкладки, оставляя только те, которые нужно закрыть
        const tabsToClose = allTabs.filter(tab => tab.id !== tabId);
        
        console.log(`Найдено ${tabsToClose.length} вкладок для закрытия`);
        
        // Закрываем каждую вкладку по очереди
        tabsToClose.forEach(tab => {
            console.log(`Закрытие вкладки ${tab.id}`);
            tabs.closeTab(tab.id).catch(error => {
                console.error(`Ошибка при закрытии вкладки ${tab.id}:`, error);
            });
        });
        
        // Активируем оставшуюся вкладку
        tabs.activateTab(tabId).catch(error => {
            console.error(`Ошибка при активации вкладки ${tabId}:`, error);
        });
    }).catch(error => {
        console.error('Ошибка при получении списка вкладок:', error);
    });
}

// Обновление DOM-элемента вкладки
function updateTabElement(tabId, changeInfo) {
    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    
    if (!tabElement) return;
    
    if (changeInfo.title) {
        const titleElement = tabElement.querySelector('.tab-title');
        titleElement.textContent = changeInfo.title;
    }
    
    if (changeInfo.favicon) {
        // TODO: добавить обработку favicon, если он будет добавлен в DOM
    }
}

// Удаление DOM-элемента вкладки
function removeTabElement(tabId) {
    console.log(`Удаление DOM-элемента для вкладки с ID: ${tabId}`);
    
    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    
    if (tabElement) {
        console.log(`Найден DOM-элемент для вкладки ${tabId}, удаляем`);
        tabElement.remove();
        
        // Если были удалены все вкладки, создаем новую
        if (tabsList.children.length === 0) {
            console.log('Все вкладки удалены, создаем новую вкладку');
            tabs.createTab('https://ya.ru');
        } 
        // Если была удалена активная вкладка, активируем последнюю в списке
        else if (parseInt(tabId) === parseInt(activeTabId)) {
            const lastTab = tabsList.lastElementChild;
            if (lastTab) {
                const lastTabId = parseInt(lastTab.getAttribute('data-tab-id'));
                console.log(`Была удалена активная вкладка. Активируем последнюю вкладку с ID: ${lastTabId}`);
                tabs.activateTab(lastTabId);
            }
        }
    } else {
        console.warn(`Не найден DOM-элемент для вкладки с ID: ${tabId}`);
    }
}

// Обновление активной вкладки
function updateActiveTab(tabId) {
    console.log(`Обновление активной вкладки на ${tabId}`);
    
    // Приводим tabId к числу для корректного сравнения
    tabId = parseInt(tabId, 10);
    
    // Обновляем локальную переменную состояния
    activeTabId = tabId;
    
    // Снимаем выделение со всех вкладок
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Выделяем активную вкладку
    const activeTab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (activeTab) {
        console.log(`Найден DOM-элемент для активной вкладки ${tabId}`);
        activeTab.classList.add('active');
        
        // Скроллим к активной вкладке, если она не видна
        if (activeTab.offsetLeft < tabsList.scrollLeft || 
            activeTab.offsetLeft + activeTab.offsetWidth > tabsList.scrollLeft + tabsList.offsetWidth) {
            activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
        
        // Обновляем заголовок окна
        const titleEl = activeTab.querySelector('.tab-title');
        if (titleEl && titleEl.textContent) {
            document.title = `${titleEl.textContent} - Browzyan`;
        }
    } else {
        console.warn(`Не найден DOM-элемент для активной вкладки ${tabId}`);
    }
    
    // Запрашиваем у main процесса информацию о вкладке для обновления URL-строки и кнопок навигации
    tabs.getTab(tabId).then(tab => {
        if (tab) {
            updateUrlBar(tab.url);
            updateNavigationState(tab.canGoBack, tab.canGoForward);
            
            // Обновляем статус вкладки (закладка, режим чтения и т.д.)
            updateTabStatus(tab);
        } else {
            console.warn(`Не удалось получить информацию о вкладке ${tabId} при её активации`);
        }
    }).catch(error => {
        console.error(`Ошибка при получении информации о вкладке ${tabId}:`, error);
    });
}

// Обновление статуса вкладки (закладка, режим чтения и т.д.)
function updateTabStatus(tab) {
    // В будущем здесь будет код для обновления статуса закладки, режима чтения и других
    // элементов интерфейса в зависимости от активной вкладки
    
    // Например, проверка закладки
    if (typeof bookmarks !== 'undefined' && bookmarks.isBookmarked) {
        bookmarks.isBookmarked(tab.url).then(isBookmarked => {
            if (bookmarkButton) {
                bookmarkButton.textContent = isBookmarked ? '⭐' : '★';
                bookmarkButton.title = isBookmarked ? 'Удалить из закладок' : 'Добавить в закладки';
            }
        }).catch(error => {
            console.error('Ошибка при проверке закладки:', error);
        });
    }
}

// Обновление URL-строки
function updateUrlBar(url) {
    // Не показываем внутренние URL (about: и browzyan:)
    if (url.startsWith('about:') || url.startsWith('chrome:') || url.startsWith('browzyan://')) {
        urlInput.value = '';
    } else {
        urlInput.value = url;
    }
}

// Обновление статуса кнопок навигации
function updateNavigationState(canGoBack, canGoForward) {
    backButton.disabled = !canGoBack;
    forwardButton.disabled = !canGoForward;
    
    backButton.style.opacity = canGoBack ? '1' : '0.5';
    forwardButton.style.opacity = canGoForward ? '1' : '0.5';
}

// Обновление индикатора загрузки
function updateLoadingState(tabId, isLoading) {
    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (!tabElement) return;
    
    if (isLoading) {
        refreshButton.classList.add('spin');
    } else {
        refreshButton.classList.remove('spin');
    }
}

// ============ Обработчики событий ============
// Обработка отправки URL
function handleUrlSubmit(e) {
    e.preventDefault();
    
    const input = urlInput.value.trim();
    
    if (input) {
        let url = input;
        
        // Если ввод не похож на URL, выполняем поиск
        if (!isUrl(url)) {
            const searchEngine = 'https://www.google.com/search?q=';
            url = searchEngine + encodeURIComponent(url);
        } 
        // Если URL без протокола, добавляем https://
        else if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        navigation.navigateTo(url);
    }
}

// Обработка клавиатурных сокращений
function handleKeyboardShortcuts(e) {
    // Ctrl+T - новая вкладка
    if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        tabs.createTab('browzyan://newtab');
    }
    
    // Ctrl+W - закрыть вкладку
    if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) {
            tabs.closeTab(activeTabId);
        }
    }
    
    // Ctrl+R - перезагрузить страницу
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        navigation.reload();
    }
    
    // Ctrl+L - фокус на URL-строке
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        urlInput.focus();
        urlInput.select();
    }
}

// ============ Функции для боковой панели и загрузок ============
// Переключение боковой панели
function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    sidebar.classList.toggle('visible', sidebarVisible);
}

// Переключение панели загрузок
function toggleDownloadsPanel() {
    downloadsVisible = !downloadsVisible;
    downloadsPanel.classList.toggle('visible', downloadsVisible);
}

// Добавление элемента загрузки в панель
function addDownloadElement(downloadItem) {
    const downloadsList = document.getElementById('downloadsList');
    
    const downloadElement = document.createElement('div');
    downloadElement.className = 'download-item';
    downloadElement.dataset.downloadId = downloadItem.id;
    
    updateDownloadElementContents(downloadElement, downloadItem);
    
    downloadsList.appendChild(downloadElement);
    
    // Если панель загрузок не видна, показываем её
    if (!downloadsVisible) {
        toggleDownloadsPanel();
    }
}

// Обновление содержимого элемента загрузки
function updateDownloadElementContents(element, downloadItem) {
    const fileName = downloadItem.filename.split('/').pop();
    const progress = downloadItem.totalBytes > 0 
        ? Math.round((downloadItem.receivedBytes / downloadItem.totalBytes) * 100) 
        : 0;
    
    const statusText = downloadItem.state === 'completed' 
        ? 'Завершено' 
        : downloadItem.state === 'cancelled' 
            ? 'Отменено' 
            : downloadItem.state === 'interrupted' 
                ? 'Прервано' 
                : `${progress}%`;
    
    element.innerHTML = `
        <div class="download-info">
            <div class="download-title">${fileName}</div>
            <div class="download-status">${statusText}</div>
        </div>
        <div class="download-progress">
            <div class="progress-bar" style="width: ${progress}%"></div>
        </div>
        <div class="download-actions">
            ${downloadItem.state === 'in_progress' ? 
                `<button class="download-pause" data-action="pause">||</button>
                <button class="download-cancel" data-action="cancel">×</button>` : 
                downloadItem.state === 'completed' ? 
                `<button class="download-open" data-action="open">Открыть</button>
                <button class="download-folder" data-action="show">Папка</button>` : 
                ''}
        </div>
    `;
    
    // Добавляем обработчики событий для кнопок
    const actionButtons = element.querySelectorAll('[data-action]');
    actionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.action;
            
            switch (action) {
                case 'pause':
                    downloads.pauseDownload(downloadItem.id);
                    break;
                case 'resume':
                    downloads.resumeDownload(downloadItem.id);
                    break;
                case 'cancel':
                    downloads.cancelDownload(downloadItem.id);
                    break;
                case 'open':
                    downloads.openDownload(downloadItem.id);
                    break;
                case 'show':
                    downloads.showDownloadInFolder(downloadItem.id);
                    break;
            }
        });
    });
}

// Обновление элемента загрузки
function updateDownloadElement(downloadId, changeInfo) {
    const downloadElement = document.querySelector(`.download-item[data-download-id="${downloadId}"]`);
    
    if (!downloadElement) return;
    
    downloads.getDownload(downloadId).then(downloadItem => {
        if (downloadItem) {
            updateDownloadElementContents(downloadElement, downloadItem);
        }
    });
}

// ============ Функции для закладок и режима чтения ============
// Переключение статуса закладки
function toggleBookmark() {
    if (!activeTabId) return;
    
    tabs.getTab(activeTabId).then(tab => {
        if (tab && tab.url) {
            bookmarks.isBookmarked(tab.url).then(isBookmarked => {
                if (isBookmarked) {
                    bookmarks.removeBookmark(tab.url);
                    bookmarkButton.innerHTML = '<i class="far fa-star"></i>'; // Пустая звезда
                } else {
                    bookmarks.addBookmark({
                        url: tab.url,
                        title: tab.title || tab.url
                    });
                    bookmarkButton.innerHTML = '<i class="fas fa-star"></i>'; // Заполненная звезда
                }
            });
        }
    });
}

// Переключение режима чтения
function toggleReaderMode() {
    if (!activeTabId) return;
    
    readerModeActive = !readerModeActive;
    
    if (readerModeActive) {
        reader.enableReaderMode(activeTabId);
    } else {
        reader.disableReaderMode(activeTabId);
    }
}

// Переключение темной темы
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    applyTheme(isDarkMode);
    theme.setTheme(isDarkMode ? 'dark' : 'light');
}

// Применение темы
function applyTheme(isDark) {
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    darkModeButton.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

// Переключение режима фокусировки
function toggleFocusMode() {
    document.body.classList.toggle('focus-mode');
    focusModeButton.innerHTML = document.body.classList.contains('focus-mode') 
        ? '<i class="fas fa-search-plus"></i>' 
        : '<i class="fas fa-search"></i>';
}

// ============ Вспомогательные функции ============
// Проверка, является ли строка URL-адресом
function isUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (e) {
        // Проверяем простые домены без протокола
        const pattern = /^([-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6})\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
        return pattern.test(string);
    }
} 