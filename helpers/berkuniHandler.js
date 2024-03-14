import MemoryStore from '../src/memorystore.js'
import { downloadMediaMessage } from '@adiwajshing/baileys';
import barkuniDB from '../src/schemas/barkuni.js';
import { Sticker } from 'wa-sticker-formatter';
import { sendCustomMsgQueue, errorMsgQueue } from '../src/QueueObj.js';


/**
 * when ```!barkuni``` is called, this function will be called
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {String} superuser
 */
async function BarkuniSticker(msg, superuser) {
    let id = msg.key.remoteJid;

    // save sticker to database
    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage) {
        let msgID = msg.message.extendedTextMessage.contextInfo.stanzaId;
        if (!msgID) return;

        let quotedMessage = await MemoryStore.loadMessage(id, msgID);
        // if no quoted message, continue to search for sticker
        if (!quotedMessage) return searchBarkuni(id);

        // check if sender is superuser
        if (!(id?.includes(superuser) || msg.key.participant?.includes(superuser)))
            return searchBarkuni(id);

        try {
            // download sticker
            let stickerBuffer = await downloadMediaMessage(quotedMessage, 'buffer', {});
            barkuniDB.exists({ buffer: stickerBuffer }, (err, res) => {
                if (err) throw err;
                if (res) return sendCustomMsgQueue(id, { text: "אופס... סטיקר זה כבר קיים במאגר" });

                // save sticker to database
                barkuniDB.create({ buffer: stickerBuffer }, (err, res) => {
                    if (err) throw err;
                    console.log(res);
                    sendCustomMsgQueue(id, { text: "הסטיקר נוסף בהצלחה!" });
                });
            });
        } catch (error) {
            console.error(error);
            errorMsgQueue("BarkuniSticker" + error);
        }
        return;
    }

    // send random sticker from database
    searchBarkuni(id);
}

/**
 * send random sticker from database
 * @param {string} id 
 */
async function searchBarkuni(id) {
    const numItems = await barkuniDB.estimatedDocumentCount()
    if (numItems === 0) return sendCustomMsgQueue(id, { text: "אופס... אין לי סטיקרים" });

    const rand = Math.floor(Math.random() * numItems)
    const randomItem = await barkuniDB.findOne().skip(rand)

    const sticker = new Sticker(randomItem.buffer, {
        author: 'BabiBot',
        pack: 'ברקוני',
        quality: 30
    });

    sendCustomMsgQueue(id, await sticker.toMessage());
}

export default BarkuniSticker;