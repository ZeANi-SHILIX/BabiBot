import PQueue from 'p-queue';
import { GLOBAL } from './storeMsg.js';
import messageRetryHandler from './retryHandler.js';

/** queue of handlers promises.
 * 
 * to use: `handlerQueue.add(() => { })`
 */
export const handlerQueue = new PQueue({
    concurrency: 2
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

/**
 * 
 * @param {string} jid
 * @param {string} text
 */
export function sendMsgQueue(jid, text) {
    msgQueue.add(async () => {
        await GLOBAL.sock.sendMessage(jid, { text }).then(messageRetryHandler.addMessage);
    });
}

/**
 * 
 * @param {string} jid
 * @param {string} text
 */
export function errorMsgQueue(text) {
    const botNum = GLOBAL.sock.user.id.split("@")[0].split(":")[0] + "@s.whatsapp.net";
    msgQueue.add(async () => {
        await GLOBAL.sock.sendMessage(botNum, { text }).then(messageRetryHandler.addMessage);
    });
}
