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
  let allUsers = [ "AI:"]
  let messages = [
    "You are a chatbot named 'Babi Bot' your job is Summarize the conversation in a short and clear way, without expressing an opinion and without answering questions that were in the conversation. Your code has written by Shilo Babila using JavaScript."
  ];

  for (let msg of msgs) {
    let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || undefined;
    let name = (msg.pushName ?? user) + ":";

    if (!text)
      continue;

    if (msg.key.fromMe) {
      messages.push("AI:" + text);
    }
    else {
      allUsers.includes(name) ? 0 : allUsers.push(name)
      messages.push( name + text);
    }

  }
  messages.push("AI: Summarize the conversation")

  let mission = messages.join("\n");
  //console.log(mission)

  const response = await this.openai.createCompletion({
    model: "text-davinci-003",
    prompt: mission,
    temperature: 0.7,
    max_tokens: 130,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0.6,
    stop: allUsers,
  });
  console.log("Total Tokens: " + response.data.usage?.total_tokens);
  return response.data.choices[0].text;
};



module.exports = ChatGPT;