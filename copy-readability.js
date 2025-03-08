const fs = require('fs');
const path = require('path');

// Путь к исходному файлу в node_modules
const sourcePath = path.join(__dirname, 'node_modules', '@mozilla', 'readability', 'Readability.js');

// Путь к целевой директории
const targetDir = path.join(__dirname, 'lib');

// Создаем директорию lib, если она не существует
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir);
}

// Путь к целевому файлу
const targetPath = path.join(targetDir, 'Readability.js');

// Копируем файл
fs.copyFileSync(sourcePath, targetPath);

console.log(`Файл скопирован из ${sourcePath} в ${targetPath}`); 