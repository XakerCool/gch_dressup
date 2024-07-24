const fs = require('fs');
const path = require('path');

function logError(source, error) {
    try {
        const currentTime = new Date().toLocaleString();
        const errorMessage = `${currentTime} - Source: ${source}\nError: ${error?.stack || error}\n\n`;
        const logsDir = path.join(__dirname, 'logs');

        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir);
        }
        const logFilePath = path.join(logsDir, 'error.log');

        fs.appendFile(logFilePath, errorMessage, (err) => {
            if (err) {
                console.error('Ошибка записи в файл:', err);
            } else {
                console.log('Ошибка успешно записана в файл.');
            }
        });
    } catch (error) {
        console.error(error);
    }
}

module.exports = { logError }