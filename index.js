require('dotenv').config();
const express = require('express');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Dummy route to keep the bot alive on Render
app.get('/', (req, res) => {
  res.send('🤖 Telegram Bot is Running!');
});

app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});

// === Initialize Telegram Bot ===
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// === BIN Lookup ===
async function getDetailedBinInfo(bin) {
  try {
    const response = await axios.get(`https://lookup.binlist.net/${bin}`, {
      headers: { 'Accept-Version': '3' }
    });

    return {
      bank: response.data.bank?.name || 'UNKNOWN BANK',
      country: response.data.country?.name || 'UNKNOWN COUNTRY',
      emoji: response.data.country?.emoji || '🌐',
      scheme: response.data.scheme?.toUpperCase() || 'UNKNOWN',
      type: response.data.type?.toUpperCase() || 'UNKNOWN'
    };
  } catch (error) {
    return {
      bank: 'UNKNOWN BANK',
      country: 'UNKNOWN COUNTRY',
      emoji: '🌐',
      scheme: 'UNKNOWN',
      type: 'UNKNOWN'
    };
  }
}

// === Card Generator ===
function generateValidCard(bin) {
  let cardNumber;
  do {
    cardNumber = bin + Math.floor(Math.random() * 1e10).toString().padStart(10, '0');
    cardNumber = cardNumber.substring(0, 16);
  } while (!luhnCheck(cardNumber));

  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const year = new Date().getFullYear() + Math.floor(Math.random() * 5);
  const cvv = String(Math.floor(Math.random() * 900) + 100);

  return `\`${cardNumber}|${month}|${year}|${cvv}\``;
}

// === Luhn Check ===
function luhnCheck(cardNumber) {
  let sum = 0;
  let alternate = false;
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber.charAt(i));
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit = (digit % 10) + 1;
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// === Format Telegram Message ===
function formatMessage(bin, details, cards, time, checker) {
  return `
- 𝐂𝐂 𝐆𝐞𝐧𝐞𝐫𝐚𝐭𝐞𝐝 𝐒𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥𝐥𝐲
- 𝐁𝐢𝐧 - ${bin}
- 𝐀𝐦𝐨𝐮𝐧𝐭 - ${cards.length}

${cards.join('\n')}

- 𝗜𝗻𝗳𝗼 - ${details.scheme} - ${details.type}
- 𝐁𝐚𝐧𝐤 - ${details.bank}
- 𝐂𝐨𝐮𝐧𝐭𝐫𝐲 - ${details.country} ${details.emoji}

- 𝐓𝐢𝐦𝐞: - ${time} 𝐬𝐞𝐜𝐨𝐧𝐝𝐬
- 𝐂𝐡𝐞𝐜𝐤𝐞𝐝 - ⏤‌‌ ${checker} 🜲
`;
}

// === /start Command ===
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '💳 *Credit Card Generator*\n\nSend BIN like this:\n`/gen 557571`',
    { parse_mode: 'Markdown' }
  );
});

// === /gen Command ===
bot.onText(/\/gen (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const bin = match[1].replace(/\D/g, '');

  if (!/^\d{6,16}$/.test(bin)) {
    return bot.sendMessage(chatId, '⚠️ Invalid BIN (6-16 digits)\nExample: /gen 557571');
  }

  try {
    const startTime = Date.now();
    const binInfo = await getDetailedBinInfo(bin.substring(0, 8));
    const cards = Array.from({ length: 10 }, () => generateValidCard(bin).replace(/`/g, ''));
    const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);

    const message = formatMessage(
      bin,
      binInfo,
      cards.map(card => `\`${card}\``),
      timeTaken,
      "𝘼𝙍𝙅𝙐𝙉 𝙃𝙀𝙍𝙀"
    );

    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
  } catch (err) {
    console.error('Error generating cards:', err);
    bot.sendMessage(chatId, '⚠️ Error generating cards.');
  }
});

console.log('✅ Bot and Server Started');
