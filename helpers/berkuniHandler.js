const { store } = require('../src/storeMsg');
const { downloadMediaMessage } = require('@adiwajshing/baileys');
const barkuniDB = require('../src/barkuni');
const { Sticker } = require('wa-sticker-formatter');


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
        if (!quotedMessage) return;

        // check if sender is superuser
        if (!msg.key.participant?.includes(superuser) || 
            !id?.includes(superuser)) 
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
    const numItems = await barkuniDB.estimatedDocumentCount()
    if (numItems === 0) return sock.sendMessage(id, { text: "אופס... אין לי סטיקרים" });

    const rand = Math.floor(Math.random() * numItems)
    const randomItem = await barkuniDB.findOne().skip(rand)

    const sticker = new Sticker(randomItem.buffer, {
        pack: '🎉',
        author: 'BabilaBot',
        categories: ['🤩', '🎉'],
        quality: 40
    });

    sock.sendMessage(id, await sticker.toMessage());


}

exports = module.exports = BarkuniSticker;