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
      'User -Agent': 'Telegram Bot'
    }
  }
});

// ✅ Helper Functions
function luhnCheck(num) {
  let arr = (num + '').split('').reverse().map(x => parseInt(x));
  let lastDigit = arr.shift();
  let sum = arr.reduce((acc, val, i) => 
    (i % 2 !== 0 ? acc + val : acc + ((val * 2) % 9) || 9), 0);
  return (sum + lastDigit) % 10 === 0;
}

function generateValidCard(bin) {
  let cardNumber;
  do {
    cardNumber = bin + Math.floor(Math.random() * 1e10).toString().padStart(10, '0');
    cardNumber = cardNumber.substring(0, 16);
  } while (!luhnCheck(cardNumber));
  
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const year = String(new Date().getFullYear() + Math.floor(Math.random() * 5)).slice(-2);
  const cvv = String(Math.floor(100 + Math.random() * 900));
  
  return `${cardNumber}|${month}|20${year}|${cvv}`;
}

// ✅ Message Formatting Function
function createCCMessage(bin, binInfo, cards) {
  const message = `💳 Generated CC (${bin})\n\n` +
                  `🏦 Bank: ${binInfo.bank}\n` +
                  `🌎 Country: ${binInfo.country} ${binInfo.emoji}\n` +
                  `🔖 Type: ${binInfo.type}\n\n` +
                  `📋 Tap any card below to copy:\n\n` +
                  cards.map(card => `\`${card}\``).join('\n'); // Use backticks for code formatting

  return {
    text: message,
    options: {
      parse_mode: 'Markdown', // Use Markdown for formatting
      disable_web_page_preview: true
    }
  };
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

// ✅ Bin Info Lookup
async function getBinInfo(bin) {
  try {
    const response = await axios.get(`https://lookup.binlist.net/${bin}`);
    return {
      bank: response.data.bank?.name || "UNKNOWN BANK",
      country: response.data.country?.name || "UNKNOWN",
      emoji: response.data.country?.emoji || "",
      scheme: response.data.scheme?.toUpperCase() || "UNKNOWN",
      type: response.data.type?.toUpperCase() || "UNKNOWN"
    };
  } catch (error) {
    return {
      bank: "UNKNOWN BANK",
      country: "UNKNOWN",
      emoji: "",
      scheme: "UNKNOWN",
      type: "UNKNOWN"
    };
  }
}

// ✅ HTTP Server
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
