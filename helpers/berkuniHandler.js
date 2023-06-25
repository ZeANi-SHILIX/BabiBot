import { store } from '../src/storeMsg.js';
import { downloadMediaMessage } from '@adiwajshing/baileys';
import barkuniDB from '../src/barkuni.js';
import { Sticker } from 'wa-sticker-formatter';
import messageRetryHandler from "../src/retryHandler.js";


/**
 * when ```!barkuni``` is called, this function will be called
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @param {String} superuser
 */
async function BarkuniSticker(msg, sock, superuser) {
    let id = msg.key.remoteJid;

    // save sticker to database
    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage) {
        let msgID = msg.message.extendedTextMessage.contextInfo.stanzaId;
        if (!msgID) return;

        let quotedMessage = await store.loadMessage(id, msgID);
        // if no quoted message, continue to search for sticker
        if (!quotedMessage) return searchBarkuni(sock, id);

        // check if sender is superuser
        if (!(id?.includes(superuser) || msg.key.participant?.includes(superuser)))
            return sock.sendMessage(id, { text: "אופס... אין לך הרשאה להוסיף סטיקרי ברקוני" });


        try {
            // download sticker
            let stickerBuffer = await downloadMediaMessage(quotedMessage, 'buffer', {});
            barkuniDB.exists({ buffer: stickerBuffer }, (err, res) => {
                if (err) throw err;
                if (res) return sock.sendMessage(id, { text: "אופס... סטיקר זה כבר קיים במאגר" });

                // save sticker to database
                barkuniDB.create({ buffer: stickerBuffer }, (err, res) => {
                    if (err) throw err;
                    console.log(res);
                    sock.sendMessage(id, { text: "הסטיקר נוסף בהצלחה!" });
                });
            });
        } catch (error) {
            console.error(error);
        }
        return;
    }

    // send random sticker from database
    searchBarkuni(sock, id);
}

/**
 * send random sticker from database
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @param {string} id 
 */
async function searchBarkuni(sock, id) {
    const numItems = await barkuniDB.estimatedDocumentCount()
    if (numItems === 0) return sock.sendMessage(id, { text: "אופס... אין לי סטיקרים" });

    const rand = Math.floor(Math.random() * numItems)
    const randomItem = await barkuniDB.findOne().skip(rand)

    const sticker = new Sticker(randomItem.buffer, {
        author: 'BabiBot',
        quality: 40
    });

    sock.sendMessage(id, await sticker.toMessage()).then(messageRetryHandler.addMessage);;
}

export default BarkuniSticker;