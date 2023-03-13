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
    model: "text-davinci-003",
    temperature: 0.4,
    max_tokens: 180,
  });
  console.log("Total Tokens: " + res.data.usage?.total_tokens);
  return res.data.choices[0].text;
};

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
    max_tokens: 150,
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

  for (let msg of msgs) {
    let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || undefined;

    if (!text)
      continue;

    if (msg.key.fromMe) {
      messages.push({ role: "assistant", content: text });
    }
    else {
      messages.push({ role: "user", content: text });
    }

  }

  const response = await this.openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages,
    max_tokens: 80,
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
    max_tokens: 250,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0.6,
    stop: allUsers,
  });

  console.log("Total Tokens: " + response.data.usage?.total_tokens);
  
  let res = response.data.choices[0].text;
  if (res.startsWith(":"))
    res = res.replace(":", " ").trim();
  return res;
};



module.exports = ChatGPT;