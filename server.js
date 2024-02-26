import dotenv from 'dotenv';
dotenv.config();
import { Canvas } from 'canvas'; // fix on windows (canvas needs to imported first)
import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, getAggregateVotesInPollMessage} from '@adiwajshing/baileys';
import pkg from '@adiwajshing/baileys/WAProto/index.js';
const { proto } = pkg;
import bodyParser from 'body-parser';
import express from 'express';
import QRCode from 'qrcode';
import Mongo from './mongo.js';
import { errorMsgQueue, handlerQueue } from './src/QueueObj.js';
import { GLOBAL } from './src/storeMsg.js';
import MemoryStore from './src/store.js';
//import jwt from 'jsonwebtoken';
import handleMessage from './handler.js';
import messageRetryHandler from "./src/retryHandler.js";

const msgRetryCounterMap = {};

const secret = process.env.SECRET ?? 'MySecretDefault';
const PRODUCTION = process.env.NODE_ENV === 'production';
const SUPERUSER = process.env.SUPERUSER ?? "";

console.log("PRODUCTION:", PRODUCTION);
PRODUCTION ? null : process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const app = express()
const port = 3000;

app.use(bodyParser.json());

const mongo = new Mongo();

const getMessage = async (key) => {
    if (MemoryStore) {
        const msg = await MemoryStore.loadMessage(key.remoteJid, key.id)
        return msg?.message || undefined
    }
    // only if store is present
    return proto.Message.fromObject({})
}

let qr = "";
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log('version', version.join("."), 'isLatest', isLatest)
    /** @type {import('@adiwajshing/baileys').WASocket} */
    const sock = makeWASocket.default({
        // can provide additional config here
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: state.keys,
        },
        logger: MemoryStore.logger,
        version,
        msgRetryCounterMap,
        retryRequestDelayMs: 300,

        // this method works for poll, need to check if "waiting for message" problem is back
        getMessage, //messageRetryHandler.messageRetryHandler
    })

    try {
        MemoryStore.store.bind(sock.ev)
    } catch (error) {
        console.log(error);
        errorMsgQueue(error);
    }
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect, ", status code: ", lastDisconnect.error?.output?.statusCode)
            // reconnect if not logged out
            if (lastDisconnect.error?.output?.statusCode === DisconnectReason.timedOut
                || lastDisconnect.error?.output?.statusCode === DisconnectReason.connectionClosed) {
                setTimeout(() => {
                    connectToWhatsApp()
                }, 5000)
                console.log('reconnecting in 5 second...')
            }
            else if (shouldReconnect) {
                connectToWhatsApp()
            }
        } else if (connection === 'open') {
            // consol in green color
            console.log('\x1b[32m%s\x1b[0m', 'Baileys is connected!')
            GLOBAL.sock = sock;
        }
        if (connection === "connecting") {
            //console in yellow color
            console.log('\x1b[33m%s\x1b[0m', 'connecting');
        }
        qr = update.qr;
    })
    sock.ev.on('creds.update', () => {
        console.log('creds.update')
        saveCreds()
    })

    // join groups
    sock.ev.on('groups.upsert', async (event) => {
        for (const ev of event) {
            console.log(event);

            const superUser_inGroup = ev.participants.some(p => p.admin && p.id.includes(SUPERUSER))
            // superuser isn't falsy, and he admin at the group - do nothing
            if (SUPERUSER && superUser_inGroup) return;

            await sock.sendMessage(ev.id, {
                text: "היי! אני באבי בוט 😃\n"
                    + "שלחו לי את המילה '!פקודות' והתחילו להנות!\n\n"
                    + "(לידעתכם ההודעות שתשלחו לבוט אינן חסויות ויש למפתח גישה לראותן, השימוש בבוט מהווה את הסכמתכם לכך)\n\n"
                    + "כל הפקודות --> babibot.live"
            });
        }
    })

    // handle poll updates (show the votes in the poll only for one user)
    sock.ev.on("messages.update", async (message) => {
        for (const { key, update } of message) {
            if (update.pollUpdates) {
                const pollCreation = await getMessage(key);
                if (pollCreation) {
                    const pollMessage = getAggregateVotesInPollMessage({
                        message: pollCreation,
                        pollUpdates: update.pollUpdates,
                    })
                    const [messageCtx] = message;
                    let payload = {
                        ...messageCtx,
                        body: pollMessage.filter(poll => poll.voters.length > 0),
                        remoteJid: key.remoteJid,
                        pollId: key.id,
                        pollInfo: pollCreation.pollCreationMessage
                    };

                    console.log("poll message", payload);
                }
            }
        }
    });

    const allowCommands = ['!סטיקר', "!גוגל", "!תמלל", "!פקודות"];

    // handle messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type == 'notify') {
            for (const msg of messages) {
                if (!canHandleMsg(msg.key)) return;

                if (!msg.message) continue; // if there is no text or media message
                if (msg.key.remoteJid === 'status@broadcast') continue; // ignore status messages
                if (msg.key.remoteJid.includes("call")) continue; // ignore call messages

                let msgText = msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption
                    || msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
                // avoid handling commands from myself
                if (msg.key.fromMe && !allowCommands.some(cmd => msgText.startsWith(cmd))) continue;

                let proType = msg.message?.protocolMessage?.type;
                if (proType == proto.Message.ProtocolMessage.Type.REVOKE ||
                    proType == proto.Message.ProtocolMessage.Type.MESSAGE_EDIT)
                    continue;

                handlerQueue.add(() => handleMessage(sock, msg, mongo));
            }
        }
        if (type === 'append') {
            console.log(messages.length, " unread messages");
            if (!PRODUCTION) return; // avoid double handling in dev

            for (const msg of messages) {
                if (!msg.message) continue; // if there is no text or media message
                if (msg.key.fromMe) continue;
                if (msg.key.remoteJid === 'status@broadcast') continue; // ignore status messages

                let proType = msg.message?.protocolMessage?.type;
                if (proType == proto.Message.ProtocolMessage.Type.REVOKE ||
                    proType == proto.Message.ProtocolMessage.Type.MESSAGE_EDIT)
                    continue;

                handlerQueue.add(() => handleMessage(sock, msg, mongo));

            }
        }
    })


}
// run in main file
connectToWhatsApp();

/**
 * 
 * @param {{remoteJid:string,participant:string}} key 
 * @returns 
 */
function canHandleMsg(key) {
    if (PRODUCTION) return true;
    // in private chat
    if (key.remoteJid.includes(SUPERUSER)) return true;
    // in group
    if (key.participant && key.participant.includes(SUPERUSER)) return true;
    return false;
}

const console_info = console.info;
console.info = (...args) => args.join(" ").includes("SessionEntry") ? console_info("Updating SessionEntry",[]) : console_info(...args);




app.get('/qr', async (req, res) => {
    if (qr === undefined) return res.send("Already connected")

    await QRCode.toFile('./qr_code.png', qr);
    res.sendFile(process.cwd() + '/qr_code.png');
})

app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/index.html');
    //res.send('Hello World! its Babi Bot')
});


// app.post('/login', async (req, res) => {
//     const { username, password } = req.body;
//     console.log(req.body)

//     const user = await mongo.findApiKey({ name: username })

//     if (!user) {
//         return res.status(401).send({ message: 'Invalid username' });
//     }

//     if (password !== user.apikey)
//         return res.status(401).send({ message: 'Invalid username or password' });

//     const token = jwt.sign({ sub: user.apikey }, secret, { expiresIn: '1h' });

//     res.send({ token });


// });

// app.post('/newMsgs', (req, res) => {
//     const authHeader = req.headers.authorization;
//     const contactID = req.body.contact;

//     if (!authHeader) {
//         return res.status(401).send({ message: 'Missing Authorization header' });
//     }

//     if (!contactID) {
//         return res.status(401).send({ message: 'Missing Contact ID' });
//     }

//     const token = authHeader.split(' ')[1];

//     jwt.verify(token, secret, (err, decoded) => {
//         if (err) {
//             return res.status(403).send({ message: 'Invalid token' });
//         }

//         //const newToken = jwt.sign({ sub: user.id }, secret, { expiresIn: '30m' });


//         // Return data that belongs to the authenticated user
//         res.send({
//             data: tempStore[contactID]
//             //newToken
//         });

//         delete tempStore[contactID];
//     });
// });

// app.post('/allMsgs', (req, res) => {
//     const authHeader = req.body.auth;
//     const contactID = req.body.contact;

//     if (!authHeader) {
//         return res.status(401).send({ message: 'Missing Authorization header' });
//     }

//     if (!contactID) {
//         return res.status(401).send({ message: 'Missing Contact ID' });
//     }

//     const token = authHeader.split(' ')[1];

//     jwt.verify(token, secret, (err, decoded) => {
//         if (err) {
//             return res.status(401).send({ message: 'Invalid token' });
//         }


//         // Return data that belongs to the authenticated user
//         res.send({
//             data: store[contactID]
//         });
//     });
// });


//http://localhost:3000/send?apikey=8e3f5c0f57274eb1&phone=972507923132&text=hello1
//http://localhost:3000/send?apikey=8e3f5c0f57274eb1&group=120363027168894023&text=ניסיון

// "120363027168894023@g.us",

app.get('/send', async (req, res) => {
    const apikey = req.query.apikey;

    let searchResult = (await mongo.apiKeys.findOne({ apikey: apikey }))?.toJSON();

    if (searchResult == null)
        return res.status(403).json({
            status: 403,
            info: "you do not have permission to send messages"
        });

    const phone = req.query.phone;
    const group = req.query.group;
    const text = req.query.text;

    if ((group == undefined && phone == undefined) || text == undefined) {
        return res.status(404).json({
            status: 404,
            info: `The field 'text' or 'phone' is missing`
        })
    }
    let receiver = group ? group + '@g.us' : phone + "@s.whatsapp.net";
    console.log(`Send ${text} to ${receiver}, from ${searchResult.name}`);


    let msgInfo = await GLOBAL.sock.sendMessage(receiver, { text: text })
    if (msgInfo)
        res.status(200).json({
            status: 200,
            info: `Send ${text} to ${receiver}, from ${searchResult.name}`
        })
    else
        res.status(500).json({
            status: 500,
            info: `failed to send ${text} to ${receiver}`
        })
});


app.listen(port, () => {
    console.log(`WaAPI app listening at http://localhost:${port}`)
    console.log(`QR at http://localhost:${port}/qr`)
});

process.on('uncaughtException', (err, origin) => {
    console.error("uncaughtException:", err);
    try {
        errorMsgQueue(err);
    } catch (error) {
        console.error("can't send error message to myself", error);
    }
});