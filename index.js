require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');

// ✅ Configuration
const token = process.env.BOT_TOKEN;
const forceJoinChannel = process.env.CHANNEL_USERNAME;
const bot = new TelegramBot(token, { 
  polling: true,
  fileDownloadOptions: {
    headers: {
      'User-Agent': 'Telegram Bot'
    }
  }
});

// ✅ Local BIN Database (Fallback)
const localBinDatabase = {
  '515462': { bank: 'MASTERCARD', country: 'USA', type: 'CREDIT', scheme: 'MASTERCARD' },
  '471612': { bank: 'VISA', country: 'Germany', type: 'CREDIT', scheme: 'VISA' },
  '453245': { bank: 'VISA', country: 'UK', type: 'DEBIT', scheme: 'VISA' },
  // Add more BINs as needed
};

// ✅ Bin Lookup Function
async function getBinInfo(bin) {
  const shortBin = bin.substring(0, 6);
  
  // First check local database
  if (localBinDatabase[shortBin]) {
    return localBinDatabase[shortBin];
  }

  try {
    const response = await axios.get(`https://lookup.binlist.net/${bin}`);
    return {
      bank: response.data.bank?.name || `${shortBin} BANK`,
      country: response.data.country?.name || 'INTERNATIONAL',
      emoji: response.data.country?.emoji || '🌍',
      scheme: response.data.scheme?.toUpperCase() || 'UNKNOWN',
      type: response.data.type?.toUpperCase() || 'UNKNOWN'
    };
  } catch (error) {
    return {
      bank: `${shortBin} BANK`,
      country: 'INTERNATIONAL',
      emoji: '🌍',
      scheme: 'UNKNOWN',
      type: 'UNKNOWN'
    };
  }
}

// ✅ New Message Formatting Function
function createCCMessage(bin, binInfo, cards) {
  // Emoji mapping
  const countryEmojis = {
    'USA': '🇺🇸',
    'Germany': '🇩🇪',
    'UK': '🇬🇧',
    'France': '🇫🇷',
    'INTERNATIONAL': '🌍'
  };
  
  // Currency symbols
  const currencySymbols = {
    'USA': '$',
    'Germany': '€',
    'UK': '£',
    'France': '€',
    'INTERNATIONAL': '$'
  };

  const currency = currencySymbols[binInfo.country] || '$';
  const emoji = countryEmojis[binInfo.country] || '🌍';
  
  const message = `
🟢 *CC GENERATOR SUCCESS* 🟢

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
🔹 *BIN Details:*
├ Bank: ${binInfo.bank}
├ Country: ${binInfo.country} ${emoji}
├ Type: ${binInfo.type}
└ Scheme: ${binInfo.scheme}

🔹 *Pricing:*
├ Monthly: ${currency}9.99
├ Yearly: ${currency}99.99
└ Trial: 1 Month Free

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
📋 *Generated Cards* (Tap to copy):
  
${cards.map((card, index) => `🔸 ${index+1}. \`${card}\``).join('\n')}

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
⚠️ *Disclaimer:* 
Generated cards are for testing purposes only
`;

  return {
    text: message,
    options: {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    }
  };
}

// ✅ Luhn Check Algorithm
function luhnCheck(num) {
  let arr = (num + '').split('').reverse().map(x => parseInt(x));
  let lastDigit = arr.shift();
  let sum = arr.reduce((acc, val, i) => 
    (i % 2 !== 0 ? acc + val : acc + ((val * 2) % 9) || 9), 0);
  return (sum + lastDigit) % 10 === 0;
}

// ✅ Card Generator
function generateValidCard(bin) {
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

// ✅ Command Handlers
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const member = await bot.getChatMember(`@${forceJoinChannel}`, userId);
    if (["left", "kicked"].includes(member.status)) {
      return bot.sendMessage(chatId, `🚫 প্রথমে চ্যানেলে জয়েন করুন: https://t.me/${forceJoinChannel}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ জয়েন করুন", url: `https://t.me/${forceJoinChannel}` }],
            [{ text: "🔄 চেক করুন", callback_data: "check_join" }]
          ]
        }
      });
    }
    bot.sendMessage(chatId, `🎉 বট ব্যবহার করতে প্রস্তুত!\n\n💳 CC জেনারেট করতে:\n/gen 515462`);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, '❌ সার্ভার সমস্যা, পরে চেষ্টা করুন');
  }
});

bot.onText(/\/gen (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const bin = match[1].trim().replace(/\D/g, '');

  try {
    const member = await bot.getChatMember(`@${forceJoinChannel}`, userId);
    if (["left", "kicked"].includes(member.status)) {
      return bot.sendMessage(chatId, `❌ প্রথমে চ্যানেলে জয়েন করুন: @${forceJoinChannel}`);
    }
  } catch (error) {
    return bot.sendMessage(chatId, '❌ সার্ভার সমস্যা, পরে চেষ্টা করুন');
  }

  if (!/^\d{6,}$/.test(bin)) {
    return bot.sendMessage(chatId, "⚠️ সঠিক BIN দিন (৬+ ডিজিট)\nExample: /gen 515462");
  }

  const cards = Array.from({length: 10}, () => generateValidCard(bin));
  const binInfo = await getBinInfo(bin.substring(0, 8));
  const message = createCCMessage(bin, binInfo, cards);

  await bot.sendMessage(chatId, message.text, message.options);
});

// ✅ HTTP Server (for health checks)
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <head><title>Telegram CC Generator</title></head>
      <body style="font-family: Arial; text-align: center; margin-top: 50px;">
        <h2>Telegram CC Generator Bot</h2>
        <p>✅ Bot is Running Successfully</p>
      </body>
    </html>
  `);
}).listen(process.env.PORT || 3000);

console.log('✅ Bot is running...');
