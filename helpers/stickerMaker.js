const { downloadMediaMessage } = require('@adiwajshing/baileys')
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const text2png = require('text2png');

const { store } = require('../src/storeMsg');
const { MsgType, getMsgType } = require('./msgType');

const sticker_types = {
    "חתוך": StickerTypes.CROPPED,
    "ריבוע": StickerTypes.CROPPED,
    "מרובע": StickerTypes.CROPPED,
    "עיגול": StickerTypes.CIRCLE,
    "עגול": StickerTypes.CIRCLE,
    "מעוגל": StickerTypes.ROUNDED
}

/**
 * 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 */
async function sendSticker(msg, sock, msgTypeSticker) {
    let id = msg.key.remoteJid;
    let caption = msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
    let textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";


    // video or image message
    if (msgTypeSticker === "media") {
        let setType = caption.replace('!sticker', '').replace('!סטיקר', '').trim();

        const type = sticker_types[setType] || StickerTypes.FULL;

        const messageType = Object.keys(msg.message)[0]
        if (messageType === 'imageMessage' || messageType === 'videoMessage') {

            const buffer = await downloadMediaMessage(msg, 'buffer', {})
            const sticker = new Sticker(buffer, {
                pack: '🎉',
                author: 'BabilaBot',
                type: type,
                categories: ['🤩', '🎉'],
                quality: 40
            });
            sock.sendMessage(id, await sticker.toMessage());
            console.log("sended sticker message", type)
        }
        return;
    }

    // quoted message with image or video
    try {
        let quoted = await store.loadMessage(id, msg.message?.extendedTextMessage?.contextInfo?.stanzaId);
        let { type } = getMsgType(quoted);
        if (type === MsgType.IMAGE || type === MsgType.VIDEO) {

            let setType = textMsg.replace('!sticker', '').replace('!סטיקר', '').trim();
            const type = sticker_types[setType] || StickerTypes.FULL;

            const buffer = await downloadMediaMessage(quoted, 'buffer', {})
            const sticker = new Sticker(buffer, {
                pack: '🎉',
                author: 'BabiBot',
                type: type,
                categories: ['🤩', '🎉'],
                quality: 30
            });
            return sock.sendMessage(id, await sticker.toMessage());
        }
    } catch (error) {
        //console.log(error);
    }


    // text message
    if (msgTypeSticker === "text") {
        let message = textMsg.replace('!sticker', "").replace('!סטיקר', '').trim();

        if (message == "") return sock.sendMessage(id, { text: "אופס... שלחת לי הודעה ריקה" });

        const sticker = new Sticker(textToSticker(message), {
            pack: '🎉',
            author: 'BabiBot',
            categories: ['🤩', '🎉'],
            quality: 50
        });
        sock.sendMessage(id, await sticker.toMessage());
    }
}


/**
 * 
 * @param {String} text 
 * @returns {Buffer} buffer as default 
 */
function textToSticker(text) {

    const MAX_CHARS_IN_ROW = 20;
    const style = {
        font: "100px San Francisco",
        textAlign: "center",
        color: "white",
        size: 20,
        padding: 10,
        strokeWidth: 3,
        strokeColor: "black",
    };

    let v1 = "";
    let v1_arr = [];
    let count = 0;
    for (let ch of text) {
        if (ch === '\n') {
            count = 0;
            v1_arr.push(v1);
            v1 = "";
        }
        else if (ch === ' ' && count >= MAX_CHARS_IN_ROW) {
            count = 0;
            v1_arr.push(v1);
            v1 = "";
        }
        else {
            v1 += ch;
            count++;
        }
    }
    if (v1 != "") v1_arr.push(v1);

    console.log(v1_arr)
    let v1_final = v1_arr.join('\n');

    return text2png(v1_final, style);
}

module.exports = sendSticker;