# Browzyan

Минималистичный веб-браузер, созданный с использованием Electron, с фокусом на продуктивность и конфиденциальность.

## Версия 0.0.2
Обновление включает важные исправления проблем с вкладками и улучшения пользовательского интерфейса.

## Версия 0.0.4
Обновление включает ряд важных улучшений:
- Модернизированный пользовательский интерфейс с иконками Font Awesome
- Реорганизованная модульная структура кода
- Улучшенное управление вкладками и загрузками
- Добавлены сервисы для работы с закладками, историей и темами
- Расширены возможности переводчика и режима чтения

## Возможности

- Современный минималистичный интерфейс
- Навигация по веб-страницам
- Адресная строка с поддержкой поисковых запросов (поиск Яндекс по умолчанию)
- Улучшенное управление вкладками (открытие, закрытие, переключение, перетаскивание)
- Кнопки навигации (назад, вперед, обновить)
- Темная тема с возможностью переключения
- Режим фокусировки для минимизации отвлекающих факторов
- Закладки для сохранения избранных сайтов
- Боковая панель с настройками и закладками
- Блокировка рекламы и трекеров
- Режим чтения для комфортного просмотра статей
- Управление загрузками файлов
- Персонализированная стартовая страница
- Сохранение пользовательских настроек между сеансами
- Надежная система работы с вкладками с защитой от ошибок

## Установка

1. Убедитесь, что у вас установлен [Node.js](https://nodejs.org/) (рекомендуется версия 14 или выше)
2. Клонируйте репозиторий или скачайте исходный код
3. Установите зависимости:

```bash
npm install
```

## Запуск браузера

Для запуска браузера в режиме разработки выполните:

```bash
npm start
```

## Сборка приложения

Для создания исполняемого файла:

```bash
npm run build
```

После сборки вы найдете готовое приложение в папке `dist`.

## Использование

- Нажмите кнопку `+` для открытия новой вкладки
- Кликните на вкладку для переключения, на `✕` для закрытия
- Перетаскивайте вкладки для изменения их порядка
- Введите URL в адресную строку и нажмите Enter или кнопку ▶
- Используйте кнопки ⬅ и ➡ для навигации по истории
- Нажмите 🔄 для обновления текущей страницы
- Нажмите ★ для добавления текущей страницы в закладки
- Нажмите 📖 для активации режима чтения на подходящих страницах
- Нажмите ⬇️ для просмотра загрузок
- Нажмите 🌓 для переключения между светлой и темной темой
- Нажмите 🔍 для включения режима фокусировки
- Нажмите ☰ для открытия боковой панели с настройками и закладками
- Включите или отключите блокировку рекламы в настройках боковой панели
- Если вы введете поисковый запрос вместо URL, браузер выполнит поиск в Яндексе

## Режим чтения

Режим чтения позволяет читать статьи и блоги в удобном формате без отвлекающих элементов. Возможности:
- Настройка размера шрифта
- Выбор цветовой схемы (светлая, сепия, темная)
- Настройка ширины строки и межстрочного интервала
- Сохранение ваших предпочтений для будущего использования

## Технологии

- Electron
- JavaScript
- HTML/CSS
- Electron Store для хранения настроек
- @cliqz/adblocker-electron для блокировки рекламы и трекеров
- Mozilla Readability для режима чтения

## Ближайшие планы

- Расширенные настройки приватности
- Улучшение блокировщика рекламы
- Синхронизация данных между устройствами
- Интеграция с сервисами для чтения позже (Pocket, Instapaper)
- Расширение возможностей загрузок
- Улучшение стартовой страницы
- Группировка вкладок
- Сохранение и восстановление закрытых вкладок
- Закрепление важных вкладок

## Лицензия

ISC 

# Новая система управления вкладками в версии 0.0.2

## Исправленные проблемы с вкладками

В этом обновлении мы провели полную реорганизацию системы управления вкладками:

1. **Решение проблемы одновременного выделения нескольких вкладок**
   - Внедрили глобальный обработчик событий для предотвращения многократной обработки кликов
   - Добавили уникальную идентификацию вкладок для предотвращения коллизий
   - Реализовали новую архитектуру с изоляцией событий между элементами интерфейса

2. **Усовершенствование механизма закрытия вкладок**
   - Полностью переработали алгоритм выбора новой активной вкладки при закрытии
   - Добавили блокировку одновременного закрытия нескольких вкладок
   - Внедрили анимацию закрытия с обработкой состояния гонки

3. **Улучшение взаимодействия между элементами интерфейса**
   - Создали системные индикаторы состояния процессов и операций
   - Добавили подробное логирование для диагностики проблем
   - Внедрили механизмы восстановления при сбоях и ошибках

## Технические улучшения

### 1. Фундаментальные изменения в архитектуре

- **Глобальный обработчик кликов** - создали единый обработчик, который предотвращает многократную обработку одного и того же клика разными элементами
- **Защита от состояния гонки** - добавили флаги блокировки для предотвращения одновременного выполнения конфликтующих операций
- **Уникальная идентификация вкладок** - каждая вкладка теперь имеет уникальный класс на основе tabId

### 2. Улучшения в визуальном интерфейсе

- **Добавили визуальную обратную связь** - анимация при закрытии и переключении вкладок
- **Улучшили маркировку активных вкладок** - добавили цветную полосу сверху для более чёткого выделения
- **Оптимизировали области кликов** - увеличили область клика для кнопки закрытия

### 3. Защита от множественных кликов

- **Временная блокировка** - предотвращаем повторное срабатывание операций в течение 300-500 мс
- **Отслеживание состояния** - сохраняем временные метки кликов по разным элементам
- **Логирование событий** - подробное логирование для диагностики проблем

### 4. Изоляция событий

- **CSS свойства для предотвращения кликов** - использовали pointer-events и z-index
- **Предотвращение выделения текста** - user-select: none и свойства ::selection
- **Блокировка интерактивности** - временная блокировка элементов во время анимаций

### 5. Оптимизация производительности

- **Улучшения в CSS** - добавили will-change и contain для оптимизации рендеринга
- **Эффективный DOM** - предотвращаем лишнюю перерисовку через изоляцию анимаций
- **Асинхронные операции** - добавили корректную обработку асинхронных операций

## Планы по дальнейшему улучшению

1. Добавить группировку вкладок для более эффективного управления
2. Реализовать сохранение закрытых вкладок для возможности восстановления
3. Добавить функцию закрепления вкладок для важных сайтов
4. Внедрить статистику использования для анализа популярных сайтов
5. Разработать механизм синхронизации вкладок между устройствами 