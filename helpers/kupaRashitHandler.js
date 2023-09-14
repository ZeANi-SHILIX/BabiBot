import MemoryStore from '../src/store.js'
import { downloadMediaMessage } from '@adiwajshing/baileys';
import kupaRashit from '../src/schemas/kupaRashit.js';
import { Sticker } from 'wa-sticker-formatter';
import { sendCustomMsgQueue, errorMsgQueue } from '../src/QueueObj.js';


/**
 * when ```!kupaRashit``` is called, this function will be called
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {String} superuser
 */
async function KupaRashitSticker(msg, superuser) {
    let id = msg.key.remoteJid;

    // save sticker to database
    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage) {
        let msgID = msg.message.extendedTextMessage.contextInfo.stanzaId;
        if (!msgID) return;

        let quotedMessage = await MemoryStore.loadMessage(id, msgID);
        // if no quoted message, continue to search for sticker
        if (!quotedMessage) return searchKupaRashit(id);

        // check if sender is superuser
        if (!(id?.includes(superuser) || msg.key.participant?.includes(superuser)))
            return searchKupaRashit(id);


        try {
            // download sticker
            let stickerBuffer = await downloadMediaMessage(quotedMessage, 'buffer', {});
            kupaRashit.exists({ buffer: stickerBuffer }, (err, res) => {
                if (err) throw err;
                if (res) return sendCustomMsgQueue(id, { text: "אופס... סטיקר זה כבר קיים במאגר" });

                // save sticker to database
                kupaRashit.create({ buffer: stickerBuffer }, (err, res) => {
                    if (err) throw err;
                    console.log(res);
                    sendCustomMsgQueue(id, { text: "הסטיקר נוסף בהצלחה!" });
                });
            });
        } catch (error) {
            console.error(error);
            errorMsgQueue("kupaRashitSticker" + error);
        }
        return;
    }

    // send random sticker from database
    searchKupaRashit(id);
}

/**
 * send random sticker from database
 * @param {string} id 
 */
async function searchKupaRashit(id) {
    const numItems = await kupaRashit.estimatedDocumentCount()
    if (numItems === 0) return sendCustomMsgQueue(id, { text: "אופס... אין לי סטיקרים" });

    const rand = Math.floor(Math.random() * numItems)
    const randomItem = await kupaRashit.findOne().skip(rand)

    const sticker = new Sticker(randomItem.buffer, {
        author: 'BabiBot',
        pack: 'קופה ראשית',
        quality: 30
    });

    sendCustomMsgQueue(id, await sticker.toMessage());
}

export default KupaRashitSticker;