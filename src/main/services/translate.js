const { net } = require('electron');
const { get, set } = require('./storage');

// Константы
const MAX_TEXT_LENGTH = 5000; // Максимальная длина текста для перевода в одном запросе
const TRANSLATE_API_URL = 'https://api.translation.example.com/translate'; // Заменить на реальный API
const TRANSLATION_CACHE_KEY = 'translationCache';

// Переменные
let translationCache = null;

// Основные языковые коды
const LANGUAGES = {
  'ru': 'Русский',
  'en': 'English',
  'fr': 'Français',
  'de': 'Deutsch',
  'es': 'Español',
  'it': 'Italiano',
  'zh': '中文',
  'ja': '日本語',
  'ko': '한국어',
  'ar': 'العربية'
};

// Инициализация кэша переводов
function initTranslationCache() {
  if (translationCache === null) {
    try {
      translationCache = get(TRANSLATION_CACHE_KEY) || {};
      cleanupCache();
    } catch (error) {
      console.error('Ошибка при инициализации кэша переводов:', error);
      translationCache = {};
    }
  }
  return translationCache;
}

// Очистка старых записей кэша
function cleanupCache() {
  try {
    if (!translationCache) return;
    
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 дней
    const maxEntries = 1000;
    
    // Удаляем старые записи
    const entries = Object.entries(translationCache).filter(([key, value]) => {
      return now - value.timestamp < maxAge;
    });
    
    // Если слишком много записей, оставляем только самые новые
    if (entries.length > maxEntries) {
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      entries.splice(maxEntries);
    }
    
    // Создаем новый объект кэша
    translationCache = Object.fromEntries(entries);
    
    // Сохраняем обновленный кэш
    saveCache();
  } catch (error) {
    console.error('Ошибка при очистке кэша переводов:', error);
  }
}

// Сохранение кэша переводов
function saveCache() {
  try {
    set(TRANSLATION_CACHE_KEY, translationCache);
  } catch (error) {
    console.error('Ошибка при сохранении кэша переводов:', error);
  }
}

// Перевод текста
async function translateText(text, targetLang = 'ru', sourceLang = 'auto') {
  try {
    // Инициализация кэша, если не инициализирован
    initTranslationCache();
    
    // Проверяем наличие в кэше
    const cacheKey = `${text}_${sourceLang}_${targetLang}`;
    if (translationCache[cacheKey]) {
      return translationCache[cacheKey].translation;
    }
    
    // Если текст слишком длинный, разбиваем на части
    if (text.length > MAX_TEXT_LENGTH) {
      const chunks = splitTextIntoChunks(text, MAX_TEXT_LENGTH);
      let translatedChunks = [];
      
      for (const chunk of chunks) {
        const translatedChunk = await translateTextChunk(chunk, targetLang, sourceLang);
        translatedChunks.push(translatedChunk);
      }
      
      const translatedText = translatedChunks.join(' ');
      
      // Сохраняем в кэш
      translationCache[cacheKey] = {
        translation: translatedText,
        timestamp: Date.now()
      };
      saveCache();
      
      return translatedText;
    } else {
      // Переводим текст целиком
      const translatedText = await translateTextChunk(text, targetLang, sourceLang);
      
      // Сохраняем в кэш
      translationCache[cacheKey] = {
        translation: translatedText,
        timestamp: Date.now()
      };
      saveCache();
      
      return translatedText;
    }
  } catch (error) {
    console.error('Ошибка при переводе текста:', error);
    return text; // Возвращаем исходный текст в случае ошибки
  }
}

// Перевод части текста (реальный запрос к API)
async function translateTextChunk(text, targetLang, sourceLang) {
  try {
    // Этот код имитирует работу с API перевода
    // В реальном приложении здесь должен быть запрос к API перевода
    
    // Эмуляция задержки сети
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Простая эмуляция перевода для демонстрации
    if (targetLang === 'en' && detectLanguage(text) === 'ru') {
      // Простой словарь русско-английских фраз
      const dictionary = {
        'привет': 'hello',
        'мир': 'world',
        'как дела': 'how are you',
        'спасибо': 'thank you',
        'пожалуйста': 'please',
        'да': 'yes',
        'нет': 'no',
        'браузер': 'browser',
        'интернет': 'internet',
        'страница': 'page',
        'сайт': 'website'
      };
      
      let translatedText = text.toLowerCase();
      for (const [rus, eng] of Object.entries(dictionary)) {
        translatedText = translatedText.replace(new RegExp(rus, 'gi'), eng);
      }
      return translatedText;
    } else if (targetLang === 'ru' && detectLanguage(text) === 'en') {
      // Простой словарь англо-русских фраз
      const dictionary = {
        'hello': 'привет',
        'world': 'мир',
        'how are you': 'как дела',
        'thank you': 'спасибо',
        'please': 'пожалуйста',
        'yes': 'да',
        'no': 'нет',
        'browser': 'браузер',
        'internet': 'интернет',
        'page': 'страница',
        'website': 'сайт'
      };
      
      let translatedText = text.toLowerCase();
      for (const [eng, rus] of Object.entries(dictionary)) {
        translatedText = translatedText.replace(new RegExp(eng, 'gi'), rus);
      }
      return translatedText;
    }
    
    // Для остальных языков просто возвращаем исходный текст
    return text;
    
    /* Реальная реализация для API перевода
    const response = await net.fetch(TRANSLATE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        source: sourceLang,
        target: targetLang
      })
    });
    
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    const data = await response.json();
    return data.translatedText;
    */
  } catch (error) {
    console.error('Ошибка при переводе части текста:', error);
    return text; // Возвращаем исходный текст в случае ошибки
  }
}

// Разделение текста на части
function splitTextIntoChunks(text, maxLength) {
  const chunks = [];
  
  // Разбиваем текст на предложения
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  let currentChunk = '';
  for (const sentence of sentences) {
    // Если предложение само по себе длиннее максимальной длины
    if (sentence.length > maxLength) {
      // Если текущий чанк не пустой, добавляем его
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // Разбиваем длинное предложение на части
      for (let i = 0; i < sentence.length; i += maxLength) {
        chunks.push(sentence.substring(i, i + maxLength));
      }
    } 
    // Если добавление предложения превысит максимальную длину
    else if (currentChunk.length + sentence.length > maxLength) {
      chunks.push(currentChunk);
      currentChunk = sentence;
    } 
    // Иначе добавляем предложение к текущему чанку
    else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  // Добавляем последний чанк, если он не пустой
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Определение языка текста (примитивная реализация)
function detectLanguage(text) {
  // Проверяем наличие кириллицы для определения русского языка
  const cyrillicPattern = /[а-яА-ЯёЁ]/;
  if (cyrillicPattern.test(text)) {
    return 'ru';
  }
  
  // По умолчанию предполагаем английский
  return 'en';
}

// Перевод страницы
async function translatePage(tabId, targetLang) {
  try {
    // Здесь должен быть код для получения текста со страницы
    // и его перевода, а затем замены на странице
    
    // Эмуляция успешного перевода
    return { success: true, message: 'Страница переведена' };
  } catch (error) {
    console.error('Ошибка при переводе страницы:', error);
    return { success: false, error: error.message };
  }
}

// Получение поддерживаемых языков
function getSupportedLanguages() {
  return LANGUAGES;
}

// Очистка кэша переводов
function clearTranslationCache() {
  try {
    translationCache = {};
    saveCache();
    return { success: true };
  } catch (error) {
    console.error('Ошибка при очистке кэша переводов:', error);
    return { success: false, error: error.message };
  }
}

// Экспорт функций
module.exports = {
  translateText,
  translatePage,
  detectLanguage,
  getSupportedLanguages,
  clearTranslationCache
}; 