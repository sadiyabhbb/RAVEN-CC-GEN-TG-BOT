require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Local BIN database fallback
const binDatabase = {
  '515462': { bank: 'MASTERCARD', country: 'USA', type: 'CREDIT', scheme: 'MASTERCARD', emoji: '🇺🇸' },
  '471612': { bank: 'VISA', country: 'Germany', type: 'CREDIT', scheme: 'VISA', emoji: '🇩🇪' },
  '401288': { bank: 'VISA', country: 'USA', type: 'DEBIT', scheme: 'VISA', emoji: '🇺🇸' }
};

async function getBinInfo(bin) {
  const prefix = bin.substring(0, 6);
  const cached = binDatabase[prefix];
  if (cached) return cached;

  try {
    const response = await axios.get(`https://lookup.binlist.net/${bin}`);
    return {
      bank: response.data.bank?.name || prefix + ' BANK',
      country: response.data.country?.name || 'INTERNATIONAL',
      emoji: response.data.country?.emoji || '🌍',
      type: response.data.type?.toUpperCase() || 'UNKNOWN',
      scheme: response.data.scheme?.toUpperCase() || 'UNKNOWN'
    };
  } catch {
    return {
      bank: prefix + ' BANK',
      country: 'INTERNATIONAL',
      emoji: '🌍',
      type: 'UNKNOWN',
      scheme: 'UNKNOWN'
    };
  }
}

function formatCard(card, index) {
  const [number, month, year, cvc] = card.split('|');
  const spacedNumber = number.replace(/(\d{4})(?=\d)/g, '$1 ');
  return `${index + 1}. \`${spacedNumber} | ${month}/${year} | ${cvc}\``;
}

function createCCMessage(bin, info, cards) {
  const currency = info.country === 'Germany' ? '€' : '$';
  
  return `
✨ *CC GENERATION SUCCESS* ✨

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
🔹 *BIN INFORMATION*
├ Prefix: ${bin.substring(0, 6)}
├ Bank: ${info.bank}
├ Country: ${info.country} ${info.emoji}
├ Type: ${info.type}
└ Scheme: ${info.scheme}

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
💳 *VALID TEST CARDS*

${cards.map(formatCard).join('\n')}

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
⚠️ *IMPORTANT NOTES*
- Format: \`CARD NUMBER | EXPIRY (MM/YY) | CVC\`
- These are test numbers only
- No real financial value
`;
}

function luhnCheck(num) {
  const arr = (num + '').split('').reverse().map(x => parseInt(x));
  const lastDigit = arr.shift();
  const sum = arr.reduce((acc, val, i) => 
    (i % 2 !== 0 ? acc + val : acc + ((val * 2) % 9) || 9), 0);
  return (sum + lastDigit) % 10 === 0;
}

function generateCard(bin) {
  let cardNumber;
  do {
    cardNumber = bin + Math.floor(Math.random() * 1e10).toString().padStart(10, '0');
    cardNumber = cardNumber.substring(0, 16);
  } while (!luhnCheck(cardNumber));

  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const year = String(new Date().getFullYear() + Math.floor(Math.random() * 5)).slice(-2);
  const cvv = String(Math.floor(100 + Math.random() * 900));
  
  return `${cardNumber}|${month}|${year}|${cvv}`;
}

bot.onText(/\/gen (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const bin = match[1].replace(/\D/g, '');

  if (!/^\d{6,}$/.test(bin)) {
    return bot.sendMessage(chatId, '⚠️ Invalid BIN format\nExample: /gen 517805');
  }

  try {
    const cards = Array.from({ length: 5 }, () => generateCard(bin));
    const info = await getBinInfo(bin.substring(0, 8));
    const message = createCCMessage(bin, info, cards);

    await bot.sendMessage(chatId, message.text, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
  } catch (err) {
    await bot.sendMessage(chatId, '❌ Error generating cards. Please try again.');
  }
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 
    '💳 *CC Generator Bot*\n\n' +
    'To generate test cards:\n' +
    '`/gen 515462` - MasterCard example\n' +
    '`/gen 401288` - Visa example\n\n' +
    '_These numbers are for testing only_',
    { parse_mode: 'Markdown' }
  );
});

console.log('✅ Bot is running...');
