const { Configuration, OpenAIApi } = require("openai");
const fs = require("fs");
const { convertOGGToMp3, isOGGFile } = require("./convertor");

function ChatGPT(apiKey) {
  const configuration = new Configuration({
    apiKey: apiKey,
  });

  this.openai = new OpenAIApi(configuration);
}

let commands = {
  "!סטיקר": "שלח לי תמונה/סרטון בתוספת הפקודה, או ללא מדיה ואני אהפוך את המילים שלך לסטיקר",
  "!יוטיוב": "שלח לי קישור לשיר ביוטיוב ואני אשלח לך את השיר",
  "!ברקוני": "קבל סטיקר רנדומלי מברקוני",
  "!כולם": "תייג את כל המשתמשים בקבוצה (מנהלים בלבד)",
  "!תרגם": "תרגם לעברית את הטקסט בהודעה המצוטטת או את הטקסט לאחר הפקודה",
  "!גוגל": "קבל קישור לחיפוש בגוגל לטקסט בהודעה המצוטטת או לטקסט לאחר הפקודה",
  "!בוט": "שאל את GPT שאלה (ניתן לשאול גם בפרטי ללא הפקודה)",
  "!אמלק": "קבל סיכום קצרצר של ההודעות האחרונות בשיחה",
  "!תמלל": "שלח לי את הפקודה בציטוט ההודעה בקבוצה, או פשוט רק את השמע בפרטי ואני אתמלל לך אותה"
}
let commandText = (Object.entries(commands)).map(([key, value]) => `'${key}' - ${value}`).join("\n");

const systemMessage = {
  role: "system",
  content: "You are a chatbot named 'Babi Bot' / 'באבי בוט'. Your code has written by Shilo Babila (שילה בבילה) using JavaScript.\n" +
    "your purpose is to chat with people and answer their questions.\n" +
    "You cannot remind others to perform any type of task.\n" +
    "you have the commands as follow:\n" + commandText
}

ChatGPT.prototype.ask = async function (prompt) {
  const res = await this.openai.createCompletion({
    prompt: prompt,
    model: "gpt-3.5-turbo",
    temperature: 0.6,
    max_tokens: 480,
  });
  console.log("Total Tokens: " + res.data.usage?.total_tokens);
  return res.data.choices[0].text;
};

ChatGPT.prototype.ask2 = async function (prompt) {
  let data = {
    "max_tokens": 480,
    "model": "gpt-3.5-turbo",
    "messages": [
      systemMessage,
      {
        "role": "user",
        "content": prompt
      }
    ]
  }
  let res = await this.openai.createChatCompletion(data);
  return res.data;
}

/**
 * 
 * @param {String[]} msgs 
 * @returns 
 */
ChatGPT.prototype.conversion = async function (msgs) {
  const response = await this.openai.createCompletion({
    model: "text-davinci-003",
    prompt: msgs,
    temperature: 0.9,
    max_tokens: 460,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0.6,
    stop: [" Human:", " AI:"],
  });
  console.log("Total Tokens: " + response.data.usage?.total_tokens);
  return response.data.choices[0].text;
};

/**
 * quick chat with the bot (80 tokens)
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo[]} msgs 
 * @param {String} user 
 * @returns [String, String | null]
 */
ChatGPT.prototype.chat = async function (msgs, user) {

  let messages = [
    systemMessage
  ];

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    messages.push({
      "role": msg.key.fromMe ? "assistant" : "user",
      "content": msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || ""
    })
  }

  const response = await this.openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages,
    max_tokens: 256,
    user
  });
  console.log("Total Tokens: " + response.data.usage?.total_tokens);

  /** @summary “stop” (indicating the completion was generated successfully),
   *           and “length” (indicating the language model ran out of tokens before being able to finish the completion) */
  let finish_reason = response.data.choices[0].finish_reason;

  return [response.data.choices[0].message.content, finish_reason];
};

/**
 * TL;DR the conversation (800 tokens)
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo[]} msgs 
 * @returns {Promise<String>}
 */
ChatGPT.prototype.tldr = async function (msgs) {
  let prompt = "";
  for (const msg of msgs) {
    let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
      || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
    let pushName = msg.key.fromMe ? "You" : msg.pushName
      || msg.key.remoteJid.slice(0, msg.key.remoteJid.indexOf("@")) || "Unknown";

    if (!text)
      continue;

    prompt += `${pushName}: ${text}\n`;
  }
  prompt += "Summarize the conversation as briefly as possible but with as much detail as possible without missing any important information\n";

  const response = await this.openai.createCompletion({
    model: "text-davinci-003",
    prompt: prompt,
    temperature: 0.7,
    max_tokens: 800,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0.6
  });

  console.log("Total Tokens: " + response.data.usage?.total_tokens);

  let res = response.data?.choices?.[0].text || "";
  if (res.startsWith(":"))
    res = res.replace(":", " ");
  if (res.startsWith("."))
    res = res.replace(".", " ");

  return res.trim();
};

/**
 * @param {string} filename
 */
ChatGPT.prototype.stt = async function (filename) {
  try {
    if (!isOGGFile(filename)) return "Not ogg";

    let newFilename = await convertOGGToMp3(filename);

    const res = await this.openai.createTranscription(
      fs.createReadStream(newFilename),
      "whisper-1")

    fs.unlinkSync(newFilename);

    return res?.data?.text;
  } catch (error) {
    console.error(error)
  }
  return "Error";
}


require("dotenv").config();

async function test() {
  let gpt = new ChatGPT(process.env.OPENAI_API_KEY);
  let messages = [
    systemMessage
  ];

  messages.push({
    "role": "user",
    "content": "ספר לי על עצמך"
  })


  let response = await gpt.openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages,
    max_tokens: 15,
  });

  console.log(response.data.choices[0]);

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  let counter = 0;

  while (response.data.choices[0].finish_reason == "length" && counter++ < 3) {
    console.log("length");

    messages.push({
      "role": "assistant",
      "content": response.data.choices[0].message.content
    })

    await sleep(1000);
    response = await gpt.openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 15,
    });

    console.log(response.data.choices[0]);
  }

}
//test();




module.exports = ChatGPT;