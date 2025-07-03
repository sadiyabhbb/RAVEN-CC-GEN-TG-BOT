require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Function to get detailed BIN information
async function getDetailedBinInfo(bin) {
  try {
    const response = await axios.get(`https://lookup.binlist.net/${bin}`, {
      headers: {
        'Accept-Version': '3'
      }
    });
    
    return {
      bank: response.data.bank?.name || 'UNKNOWN BANK',
      country: response.data.country?.name || 'UNKNOWN COUNTRY',
      emoji: response.data.country?.emoji || '🌐',
      scheme: response.data.scheme?.toUpperCase() || 'UNKNOWN',
      type: response.data.type?.toUpperCase() || 'UNKNOWN'
    };
  } catch (error) {
    console.error('BIN Lookup Error:', error.message);
    return {
      bank: 'UNKNOWN BANK',
      country: 'UNKNOWN COUNTRY',
      emoji: '🌐',
      scheme: 'UNKNOWN',
      type: 'UNKNOWN'
    };
  }
}

// Generate valid card using Luhn algorithm
function generateValidCard(bin) {
  let cardNumber;
  do {
    const randomDigits = Math.floor(Math.random() * 1e10).toString().padStart(10, '0');
    cardNumber = bin + randomDigits.substring(0, 16 - bin.length);
  } while (!luhnCheck(cardNumber));

  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const year = new Date().getFullYear() + Math.floor(Math.random() * 5);
  const cvv = String(Math.floor(Math.random() * 900) + 100);
  
  return `${cardNumber}|${month}|${year}|${cvv}`;
}

// Luhn algorithm checker
function luhnCheck(cardNumber) {
  let sum = 0;
  let alternate = false;
  
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber.charAt(i));
    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit = (digit % 10) + 1;
      }
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// Format message with all details
function formatMessage(bin, details, cards, time, checker) {
  return `
- 𝐂𝐂 𝐆𝐞𝐧𝐚𝐫𝐚𝐭𝐞𝐝 𝐒𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥𝐥𝐲
- 𝐁𝐢𝐧 - ${bin}
- 𝐀𝐦𝐨𝐮𝐧𝐭 - ${cards.length}

${cards.join('\n')}

- 𝗜𝗻𝗳𝗼 - 
- 𝐁𝐚𝐧𝐤 - ${details.bank}
- 𝐂𝐨𝐮𝐧𝐭𝐫𝐲 - ${details.country} ${details.emoji}

- 𝐓𝐢𝐦𝐞: - ${time} 𝐬𝐞𝐜𝐨𝐧𝐝𝐬
- 𝐂𝐡𝐞𝐜𝐤𝐞𝐝 - ⏤‌‌ ${checker} 🜲
  `;
}

// Bot command handlers
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '💳 *Credit Card Generator*\n\n' +
    'To generate test cards:\n' +
    '/gen <BIN>\n\n' +
    'Example:\n/gen 557571\n\n' +
    'BIN must be 6-16 digits',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/gen (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const bin = match[1].replace(/\D/g, ''); // Remove non-digits

  if (!/^\d{6,16}$/.test(bin)) {
    return bot.sendMessage(chatId, '⚠️ Invalid BIN format (6-16 digits)\nExample: /gen 557571');
  }

  try {
    const startTime = Date.now();
    const binInfo = await getDetailedBinInfo(bin.substring(0, 8));
    const cards = Array.from({ length: 10 }, () => generateValidCard(bin));
    const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
    const checkerName = "X20 Raven"; // Set the checker's name

    const message = formatMessage(bin, binInfo, cards, timeTaken, checkerName);
    
    bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
  } catch (error) {
    console.error('Generation Error:', error);
    bot.sendMessage(chatId, '⚠️ Error generating cards. Please try again.');
  }
});

console.log('✅ Bot is running and ready to generate cards...');
