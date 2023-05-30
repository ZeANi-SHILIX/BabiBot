const { Configuration, OpenAIApi } = require("openai");

function ChatGPT(apiKey) {
  const configuration = new Configuration({
    apiKey: apiKey,
  });

  this.openai = new OpenAIApi(configuration);
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
      "model":"gpt-3.5-turbo",
      "messages": [
          {
              role: "system",
              content: "You are a male chatbot named 'Babi Bot'. Your code has written by Shilo Babila using JavaScript."
                  + process.env.MAILLIST ? `only if ask for a mail, you have the mail list at https://docs.google.com/spreadsheets/d/${process.env.MAILLIST || ""}}` : ""
          },
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
 * @returns 
 */
ChatGPT.prototype.chat = async function (msgs, user) {
  let messages = [
    { role: "system", content: "You are a chatbot named 'Babi Bot'. Your code has written by Shilo Babila using JavaScript." }
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
  return (response.data.choices[0].message.content);
};

/**
 * TL;DR the conversation (130 tokens)
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo[]} msgs 
 * @param {String} user 
 * @returns 
 */
ChatGPT.prototype.tldr = async function (msgs, user) {
  let allUsers = ["BabiBOT:"]
  let messages = [];

  for (let msg of msgs) {
    let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || undefined;
    let name = (msg.pushName ?? user) + ":";

    if (!text)
      continue;

    if (msg.key.fromMe) {
      messages.push("BabiBOT:" + text);
    }
    else {
      messages.push(name + text);

      if (!allUsers.includes(name))
        allUsers.push(name)
    }

  }
  messages.push("BabiBOT: Summarize the conversation")

  let mission = messages.join("\n");
  //console.log(mission)

  const response = await this.openai.createCompletion({
    model: "text-davinci-003",
    prompt: mission,
    temperature: 0.7,
    max_tokens: 800,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0.6,
    stop: allUsers,
  });

  console.log("Total Tokens: " + response.data.usage?.total_tokens);

  let res = response.data.choices[0].text;
  if (res.startsWith(":"))
    res = res.replace(":", " ");
  if (res.startsWith("."))
    res = res.replace(".", " ");
  return res.trim();
};

/**
 * @param {fs.ReadStream} rs
 */
ChatGPT.prototype.stt = async function (rs) {
  try {
    const res = await this.openai.createTranscription(rs, "whisper-1")
    return res.data.text;
  } catch (error) {
    console.log(error)
  }
}

const fs = require("fs");
require("dotenv").config();

async function test() {
  const filename = "C:/Users/shilo/Desktop/BabiBot/testingFiles/audio.mp3";
  const chatgpt = new ChatGPT(process.env.OPENAI_API_KEY);
  console.log("Starting transcription");
  let res = await chatgpt.stt(
    fs.createReadStream(filename),
  )

  console.log(res);
}
//test();

module.exports = ChatGPT;