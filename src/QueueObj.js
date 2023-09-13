import PQueue from 'p-queue';
import { GLOBAL } from './storeMsg.js';
import messageRetryHandler from './retryHandler.js';
import dotenv from 'dotenv';
dotenv.config();

/** queue of handlers promises.
 * 
 * to use: `handlerQueue.add(() => { })`
 */
export const handlerQueue = new PQueue({
    concurrency: 2,
    interval: 100 // 0.1s
});
//queue.add(() => { });

/** queue of msgs promises.
 * 
 * to use: `msgQueue.add(() => { })`
 */
export const msgQueue = new PQueue({
    concurrency: 1,
    interval: 1000, // 1s
    timeout: 10000, // 10s
});

/** queue of YouTube Download promises.
 * 
 * to use: `TYQueue.add(() => { })`
 */
export const TYQueue = new PQueue({
    concurrency: 1,
    timeout: 60000, // 1m
});

/**
 * 
 * @param {string} jid
 * @param {string} text
 */
export function sendMsgQueue(jid, text) {
    return msgQueue.add(async () => await GLOBAL.sock.sendMessage(jid, { text }).then(messageRetryHandler.addMessage));
}

/**
 * 
 * @param {string} jid
 * @param {import("@adiwajshing/baileys/lib/Types").AnyMessageContent} content
 * @param {import("@adiwajshing/baileys/lib/Types").MiscMessageGenerationOptions} options
 */
export function sendCustomMsgQueue(jid, content, options = {}) {
    return msgQueue.add(async () => await GLOBAL.sock.sendMessage(jid, content, options).then(messageRetryHandler.addMessage));
}

/**
 * 
 * @param {string} jid
 * @param {string} text
 */
export function errorMsgQueue(text) {
    const botNum = GLOBAL.sock.user?.id?.split("@")[0].split(":")[0] + "@s.whatsapp.net";
    const superuserNum = process.env.SUPERUSER + "@s.whatsapp.net";
    return msgQueue.add(async () => await GLOBAL.sock.sendMessage(superuserNum, { text })
        .then(messageRetryHandler.addMessage))
        .catch(() => { console.error("errorMsgQueue: failed to send error message to superuser") });
}
