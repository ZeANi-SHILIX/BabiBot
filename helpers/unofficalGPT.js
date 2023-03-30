const fetch = require('node-fetch');

/**
 * apikey from https://discord.pawan.krd/
 * @param {String} auth 
 */
function UnofficalGPT(auth) {
    this.auth = auth;

    this.completions = "https://api.pawan.krd/v1/chat/completions"
    this.images = "https://api.pawan.krd/v1/images/generations"
    this.text = "https://api.pawan.krd/v1/completions"
}

/**
 * ask question to the bot
 * @param {String} prompt 
 * @returns {Promise<{
 *              "object":"text_completion",
 *              "model":"text-davinci-003",
 *              "choices":[{
 *                  "text":" Hi there! How can I help you?",
 *                  "index":0,
 *                  "finish_reason":"stop",
 *                  "logprobs":null}],
 *              "usage":{
 *                  "prompt_tokens":7,
 *                  "completion_tokens":9,
 *                  "total_tokens":16
 *              }
 *          }>}
 */
UnofficalGPT.prototype.ask = async function (prompt) {
    return new Promise((resolve, reject) => {
        fetch(this.text, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": this.auth
            },
            body: JSON.stringify({
                "prompt": prompt,
                "temperature": 0.7,
                "max_tokens": 256,
                "model": "text-davinci-003"
            })
        }).then(res => res.json())
            .then(json => resolve(json))
            .catch(err => reject(err)) 
    })
}


/**
 * make post request to the server
 * @param {{"messages": [
 *              {"role": "system" | "user" | "assistant",
 *               "content": "You are an helful assistant"}
 *         ]}} data 
 * @returns 
 */
UnofficalGPT.prototype.chat = async function (data) {
    return new Promise((resolve, reject) => {
        fetch(this.completions, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": this.auth
            },
            body: JSON.stringify(data)
        }).then(res => res.json())
            .then(json => resolve(json))
            .catch(err => reject(err))
    })
}

/**
 * message from private chat
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo[]} msgs
 */
UnofficalGPT.prototype.waMsgs = async function (msgs) {
    let data = {
        "messages": [
            {
                role: "system",
                content: "You are a chatbot named 'Babi Bot'. Your code has written by Shilo Babila using JavaScript." 
                        + "you have mail list at https://docs.google.com/spreadsheets/d/1jm2Pcn9SOjczfl5lyhYueafh1HpjXNQ0EfyFHQL-ajQ/edit?usp=sharing"
            }
        ]
    }
    for (let i = 0; i < msgs.length; i++) {
        const msg = msgs[i];
        data.messages.push({
            "role": msg.key.fromMe ? "assistant" : "user",
            "content": msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || ""
        })
    }
    return await this.chat(data);
}

/**
 * TL:DR the conversation is a list of messages
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo[]} msgs
 */
UnofficalGPT.prototype.tldr = async function (msgs) {
    //let stopsChat = [];
    let prompt = "";
    for (const msg of msgs) {
        let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
            || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
        let pushName = msg.key.fromMe ? "You" : msg.pushName
            || msg.key.remoteJid.slice(0, msg.key.remoteJid.indexOf("@")) || "Unknown";

        if (!text)
            continue;

        prompt += `${pushName}: ${text}\n`;
        stopsChat.push(pushName);
    }
    prompt += "TL:DR this conversions with details: ";

    // remove duplicate
    //stopsChat = [...new Set(stopsChat)];

    let data = {
        "model": "text-davinci-003",
        "prompt": prompt,
        "temperature": 0.7,
        "max_tokens": 420
    }

    return new Promise((resolve, reject) => {
        fetch(this.text, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": this.auth
            },
            body: JSON.stringify(data)
        }).then(res => res.json())
            .then(json => resolve(json))
            .catch(err => reject(err))
    })
}

/**
 * generate image from prompt
 * @param {string} prompt
 * @returns {Promise<{
 *                  "created": Number,
 *                  "data": [{
 *                      "url": "https://..."
 *                  }]
 *           }>}
 */
UnofficalGPT.prototype.image = async function (prompt) {
    return new Promise((resolve, reject) => {
        fetch(this.images, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": this.auth
            },
            body: JSON.stringify({
                prompt,
                n: 1,
                size: "512x512"
            })
        }).then(res => res.json())
            .then(json => resolve(json))
            .catch(err => reject(err))
    })
}


module.exports = UnofficalGPT;

//const gpt = new UnofficalGPT();
// async function example() {
//     let data = {
//         "messages": [
//             {
//                 "role": "system",
//                 "content": "You are an helful assistant"
//             },
//             {
//                 "role": "user",
//                 "content": "my name is Joe"
//             },
//             {
//                 "role": "user",
//                 "content": "what is my name?"
//             }
//         ]
//     }
//     try {
//         let res = await gpt.chat(data);
//         console.log(JSON.stringify(res, null, 2))

//     } catch (error) {
//         console.log(error)
//     }
// }
// example()