import fetch from 'node-fetch';
import translate from '../custom_modules/Translate.js';
import { downloadMediaMessage } from '@adiwajshing/baileys'

export default class UnofficalGPT {
    /**
     * apikey from https://discord.pawan.krd/
     * @param {String} auth
     */
    constructor(auth) {
        this.auth = auth;

        this.completions = "https://api.pawan.krd/v1/chat/completions";
        this.images = "https://api.pawan.krd/v1/images/generations";
        this.text = "https://api.pawan.krd/v1/completions";
        this.cosmosrp = "https://api.pawan.krd/cosmosrp/v1/chat/completions";
    }

    /**
     * chat with cosmosrp
     * @param {import('@adiwajshing/baileys').proto.WebMessageInfo[]} msgs
     * @returns {Promise<{id: string, created: number, model: "cosmosrp-001", object: "chat.completion",
     *              choices: [{
     *                  finish_reason: "stop" | "max_tokens" | "timeout", index: number,
     *                  message: {content: string, role: "assistant" | "user"}
     *              }],
     *              usage: {
     *                  prompt_tokens: number,
     *                  completion_tokens: number,
     *                  total_tokens: number
     *             }
     *         }>}
     */
    async chatWithCosmosRP(msgs) {
        /** @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg */
        async function formatMessage(msg) {
            if (msg.message?.imageMessage)
                return [
                    { type: "text", text: msg.message.imageMessage.caption || "sent an image" },
                    {
                        type: "image_url", image_url: {
                            url: "data:" + msg.message.imageMessage.mimetype + ";base64," + (await downloadMediaMessage(msg, "buffer")).toString('base64')
                        }
                    }
                ]
            else if (msg.message?.stickerMessage)
                return [
                    { type: "text", text: "sent a sticker" },
                    {
                        type: "image_url", image_url: {
                            url: "data:" + msg.message.stickerMessage.mimetype + ";base64," + (await downloadMediaMessage(msg, "buffer")).toString('base64')
                        }
                    }
                ]
            else
                return msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ? msg.message?.extendedTextMessage?.text || msg.message?.conversation :
                    msg.message?.videoMessage ? "sent a video" :
                        msg.message?.audioMessage ? "sent an audio" : ""
        }

        let data = {
            "model": "cosmosrp",
            "temperature": 1.0,
            "messages": [
                {
                    role: "system",
                    content: "You are a WhatsApp chatbot named 'Babi Bot'.\n"
                        + "dont send emojis or emontions, just text.\n"
                        + "if you see a sticker or image, tell every interesting thing about it.\n"
                        + "you are very friendly and helpful, your answer write in english."
                }]
        };

        for (let i = 0; i < msgs.length; i++) {
            data.messages.push({
                "role": msgs[i].key.fromMe ? "assistant" : "user",
                "content": await formatMessage(msgs[i])
            });
        }

        try {
            const response = await fetch(this.cosmosrp, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.auth //(not needed for cosmosrp right now)
                },
                body: JSON.stringify(data)
            });

            const json = await response.json();
            return (await translate(json?.choices?.[0]?.message?.content?.trim(), "iw")).text;
        } catch (error) {
            console.error('Error:', error);
            return;
        }
    }

    /**
     * chat with gpt
     * @param {import('@adiwajshing/baileys').proto.WebMessageInfo[]} msgs
     */
    async conversation(msgs) {
        let data = {
            "model": "pai-001",
            "messages": [
                {
                    role: "system",
                    content: "You are a male chatbot named 'Babi Bot'. Your code has written by Shilo Babila using JavaScript."
                }
            ]
        };
        for (let i = 0; i < msgs.length; i++) {
            const msg = msgs[i];
            const m = msg.message;
            data.messages.push({
                "role": msg.key.fromMe ? "assistant" : "user",
                "content": m?.conversation ?? m?.extendedTextMessage?.text ? m?.extendedTextMessage?.text || m?.conversation :
                    m?.imageMessage ? "sent an image" :
                        m?.videoMessage ? "sent a video" :
                            m?.audioMessage ? "sent an audio" :
                                m?.stickerMessage ? "sent a sticker" : ""
            });
        }

        try {
            const response = await fetch(this.completions, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.auth
                },
                body: JSON.stringify(data)
            });

            const json = await response.json();
            return json;
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }

    /**
     * TL:DR the conversation is a list of messages
     * * this model know only english well, hebrew need to be translated
     * @param {import('@adiwajshing/baileys').proto.WebMessageInfo[]} msgs
     * @returns {Promise<{
     *              id: string;
     *              created: number;
     *              model: string;
     *              object: string;
     *              choices: {
     *                  finish_reason: string;
     *                  index: number;
     *                  message: {
     *                      content: string;
     *                      role: string;
     *                  };
     *              }[];
     *              usage: {
     *                  prompt_tokens: number;
     *                  completion_tokens: number;
     *                  total_tokens: number;
     *              };
     *      } | {
     *      status: false,
     *      error: string,
     *      hint: string,
     *      info: string,
     *      support: string
     *    }>}
     */
    async tldr(msgs) {
        let prompt = "";
        for (const msg of msgs) {
            const m = msg.message;
            let text = m?.conversation ?? m?.extendedTextMessage?.text ? m?.extendedTextMessage?.text || m?.conversation :
                m?.imageMessage ? "sent an image" :
                    m?.videoMessage ? "sent a video" :
                        m?.audioMessage ? "sent an audio" :
                            m?.stickerMessage ? "sent a sticker" : "";


            if (!text) continue;

            let pushName = msg.key.fromMe ? "BabiBot" : msg.pushName;

            if (!pushName) {
                let numOfSender = msg.key.participant || msg.key.remoteJid;
                pushName = numOfSender.split("@")[0];
            }

            prompt += `${pushName}: ${text}\n`;
        }
        //prompt += "Summarize the conversation as briefly as possible but with as much detail as possible\n";

        //console.log(prompt);
        prompt = (await translate(prompt, "en")).text
        //console.log(prompt);

        let data = {
            "model": "pai-001",
            "messages": [
                {
                    role: "system",
                    content: "You are a helpful Chatbot names BabiBot, "
                        + "your job is to summarize the conversation as briefly but with as much detail as possible, "
                        + "make sure to include all the important details, but dont do it long.\n"
                    //+ "Your summary should be in Herbrew."
                },
                {
                    role: "user",
                    content: prompt
                }
            ]
        };


        try {
            const response = await fetch(this.completions, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.auth
                },
                body: JSON.stringify(data)
            });

            const json = await response.json();
            if (json.choices?.[0]?.message?.content)
                json.choices[0].message.content = (await translate(json.choices[0].message.content, "iw")).text;
            return json;
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
    /**
     * generate image from prompt
     * @param {string} prompt
     * @returns {Promise<{
     *                  "created": Number,
     *                  "data": [{
     *                      "url": "https://..."
     *                  }]
     *           }| {
    *  status: false,
    *  error: 'You have run out of credits',
    *  hint: 'You can wait for your daily reset',
    *  info: 'https://gist.github.com/PawanOsman/72dddd0a12e5829da664a43fc9b9cf9a',
    *  support: 'https://discord.pawan.krd'
    *}>}
     */
    async image(prompt) {
        return new Promise((resolve, reject) => {
            fetch(this.images, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": this.auth
                },
                body: JSON.stringify({
                    prompt,
                    n: 4,
                    size: "256x256"
                })
            }).then(res => res.json())
                .then(json => resolve(json))
                .catch(err => reject(err));
        });
    }
}


// import env from 'dotenv';
// env.config();
async function generateCompletion() {
    const apiKey = process.env.UNOFFICALGPT_API_KEY
    const gpt = new UnofficalGPT(apiKey)

    // Example messages from multiple users
    const exampleMsgs = [
        {
            key: {
                fromMe: false,
                participant: "participant_id_1",
                remoteJid: "remote_jid_1"
            },
            pushName: "Sender1",
            message: {
                conversation: "היי, מה שלומך?"
            }
        },
        {
            key: {
                fromMe: true
            },
            message: {
                conversation: "לא רע, רק עובד על פרויקטים מעניינים. מה במקום?"
            }
        },
        {
            key: {
                fromMe: false,
                participant: "participant_id_2",
                remoteJid: "remote_jid_2"
            },
            pushName: "Sender2",
            message: {
                conversation: "אני צריך עזרה במתמטיקה מישהו יכול לעזור?"
            }
        },
        {
            key: {
                fromMe: false,
                participant: "participant_id_3",
                remoteJid: "remote_jid_3"
            },
            pushName: "Sender3",
            message: {
                conversation: "בטח אני יכול לעזור מה הבעיה?"
            }
        },
        {
            key: {
                fromMe: true
            },
            message: {
                conversation: "איזה יופי שאתם עוזרים אחד לשני"
            }
        }
    ];

    //Function call
    gpt.tldr(exampleMsgs)
        .then(async summary => {
            console.log("Conversation summary:");
            console.log(summary);
            console.log(summary.choices?.[0]?.message.content);
            let hebrew = (await translate(summary.choices?.[0]?.message.content, "iw")).text;
            console.log(hebrew);
        })
        .catch(error => {
            console.error("Error summarizing conversation:", error);
        });

    // Example messages with more details
    const exampleMsgsCoverstion = [
        {
            key: {
                fromMe: false,
                participant: "participant_id_1",
                remoteJid: "remote_jid_1"
            },
            message: {
                conversation: "Hey, how's it going?"
            }
        },
        {
            key: {
                fromMe: true
            },
            message: {
                conversation: "Not bad, just working on some coding projects. How about you?"
            }
        },
        {
            key: {
                fromMe: false,
                participant: "participant_id_1",
                remoteJid: "remote_jid_1"
            },
            message: {
                conversation: "I'm good, thanks for asking. Did you hear about the new software release?"
            }
        },
        {
            key: {
                fromMe: true
            },
            message: {
                conversation: "Yes, I did. It looks promising. Have you tried it yet?"
            }
        },
        {
            key: {
                fromMe: false,
                participant: "participant_id_1",
                remoteJid: "remote_jid_1"
            },
            message: {
                conversation: "Not yet, but I plan to give it a try later today. Do you have any initial impressions?"
            }
        },
        {
            key: {
                fromMe: true
            },
            message: {
                conversation: "I haven't had the chance to try it yet either, but I've heard positive feedback from others who have."
            }
        },
        {
            key: {
                fromMe: false,
                participant: "participant_id_1",
                remoteJid: "remote_jid_1"
            },
            message: {
                conversation: "That's good to know. I'll definitely check it out. Thanks for the info!"
            }
        }
    ];

    // Function call
    // gpt.conversation(exampleMsgsCoverstion)
    //     .then(response => {
    //         console.log("Conversation response:");
    //         console.log(response);
    //         console.log(response.choices?.[0]?.message.content);
    //     })
    //     .catch(error => {
    //         console.error("Error generating conversation:", error);
    //     });

}

//generateCompletion();

async function testCosmosRP() {
    const apiKey = process.env.UNOFFICALGPT_API_KEY
    const gpt = new UnofficalGPT(apiKey)

    // Example messages from multiple users
    const exampleMsgs = [
        {
            key: {
                fromMe: false,
                participant: "participant_id_1",
                remoteJid: "remote_jid_1"
            },
            pushName: "Sender1",
            message: {
                conversation: "היי, מה שלומך?"
            }
        },
        {
            key: {
                fromMe: true
            },
            message: {
                conversation: "לא רע, רק עובד על פרויקטים מעניינים. מה במקום?"
            }
        },
        {
            key: {
                fromMe: false,
                participant: "participant_id_2",
                remoteJid: "remote_jid_2"
            },
            pushName: "Sender2",
            message: {
                conversation: "אני צריך עזרה במתמטיקה מישהו יכול לעזור?"
            }
        },
        {
            key: {
                fromMe: false,
                participant: "participant_id_3",
                remoteJid: "remote_jid_3"
            },
            pushName: "Sender3",
            message: {
                conversation: "בטח אני יכול לעזור מה הבעיה?"
            }
        },
        {
            key: {
                fromMe: true
            },
            message: {
                conversation: "איזה יופי שאתם עוזרים אחד לשני"
            }
        }
    ];

    //Function call
    gpt.chatWithCosmosRP(exampleMsgs)
        .then(response => {
            console.log("CosmosRP response:");
            console.log(response);
            console.log(response.choices?.[0]?.message.content);
        })
        .catch(error => {
            console.error("Error chatting with CosmosRP:", error);
        });
}

//testCosmosRP();