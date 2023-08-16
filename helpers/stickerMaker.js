import dotenv from 'dotenv';
dotenv.config();
import { downloadMediaMessage } from '@adiwajshing/baileys';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const { UltimateTextToImage, registerFont } = process.env.NODE_ENV === 'production'
    ? await import("ultimate-text-to-image")
    : { UltimateTextToImage: null, registerFont: null };

registerFont?.('./src/Gveret Levin Alef Alef Alef.ttf', { family: 'Alef' });

import { MsgType, getMsgType } from './msgType.js';
import MemoryStore from '../src/store.js';
import { sendMsgQueue, errorMsgQueue, sendCustomMsgQueue } from '../src/QueueObj.js';


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
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 */
export default async function sendSticker(msg) {
    let id = msg.key.remoteJid;
    const originalMsg = msg;

    let textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text
        || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
    // remove the command
    textMsg = textMsg.replace('!sticker', '').replace('!סטיקר', '').trim();
    // get the sticker type
    const type = sticker_types[textMsg] || StickerTypes.FULL;

    // quoted message
    let hasQuoted = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
        let quoted = await MemoryStore.loadMessage(id, msg.message?.extendedTextMessage?.contextInfo?.stanzaId);
        if (!quoted) {
            console.log("retrying to get quoted message in 2 sec...")
            await sleep(2000)
            quoted = await MemoryStore.loadMessage(id, msg.message?.extendedTextMessage?.contextInfo?.stanzaId);
        }
        msg = quoted || msg;
    }

    // get the message type
    const messageType = getMsgType(msg).type;

    // media message
    if (messageType === MsgType.IMAGE || messageType === MsgType.VIDEO || messageType === MsgType.STICKER) {
        sendCustomMsgQueue(id, { react: { text: '⏳', key: originalMsg.key } });
        return makeMediaSticker(msg, type)
            .then(() => sendCustomMsgQueue(id, { react: { text: '✅', key: originalMsg.key } }))
    }

    // text message
    else if (messageType === MsgType.TEXT) {
        let msgToSticker = hasQuoted ? msg.message?.conversation || msg.message?.extendedTextMessage?.text : textMsg;

        // quoted message have text or the text is not empty
        if (msgToSticker)
            return makeTextSticker(id, msgToSticker);
    }
    sendMsgQueue(id, "אופס! לא מצאתי תוכן להפוך לסטיקר...\nיש לצטט הודעה או לכתוב טקסט לאחר הפקודה")
}

async function makeTextSticker(id, text) {
    const sticker = new Sticker(textToSticker2(text), {
        pack: '🎉',
        author: 'BabiBot',
        categories: ['🤩', '🎉'],
        quality: 20
    });
    const stickerMsg = await sticker.toMessage();

    console.log("adding sticker message to queue, type: text")
    sendCustomMsgQueue(id, stickerMsg)
}

/**
 * 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg
 *  @param {StickerTypes} type 
 */
async function makeMediaSticker(msg, type) {
    const id = msg.key.remoteJid;
    let buffer;
    try {
        buffer = await downloadMediaMessage(msg, 'buffer')
    } catch (error) {
        errorMsgQueue(error)
        return sendMsgQueue(id, "אופס... נראה שההודעה שציטטת אינה תקינה")
    }

    // not bigger than 1.5MB
    const size = buffer.byteLength / 1024 / 1024
    if (size > 1.5) return sendMsgQueue(id, "אופס... הקובץ גדול מדי, נסה לשלוח קובץ קטן יותר")

    const quality = 20 - Math.floor(size * 10);
    console.log("making sticker...")
    const sticker = new Sticker(buffer, {
        pack: '🎉',
        author: 'BabiBot',
        type: type,
        categories: ['🤩', '🎉'],
        quality: quality
    });
    const stickerMsg = await sticker.toMessage();

    console.log("adding sticker message to queue, type:", type)
    sendCustomMsgQueue(id, stickerMsg)
}

function textToSticker2(text) {
    text = putEnterBetweenEmojis(text);
    text = doubleEnter(text);
    console.log(text);
    return new UltimateTextToImage(text + " ", {
        width: 350,
        maxWidth: 400,
        maxHeight: 400,
        fontFamily: "Alef",
        // white color
        fontColor: "#ffffff",
        fontSize: 150,
        //fontWeight: "bold",
        minFontSize: 25,
        lineHeight: 50,
        autoWrapLineHeightMultiplier: 1.1,
        //autoWrapLineHeight: 2,
        margin: 10,
        marginLeft: 100,
        align: "center",
        valign: "middle",
        strokeSize: 2,
        // backgroud color transparent
        backgroundColor: "#00000000",
    })
        .render().toBuffer("image/png")
}

/**
 * 
 * @param {String} text 
 * @returns 
 */
function putEnterBetweenEmojis(text) {
    const regexAllEmojis = /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}\u{200d}]*/ug;
    let match = text.match(regexAllEmojis);
    match = match.filter(i => i != '');

    const arrText = text.split('\n');
    for (let i = 0; i < arrText.length; i++) {
        for (let j = 0; j < match.length; j++) {
            if (arrText[i].endsWith(match[j])
                && arrText[i + 1] && match[j + 1] // if not undefined
                && arrText[i + 1].startsWith(match[j + 1])) {
                arrText[i] += '\n';
            }
        }
    }
    return arrText.join('\n');

}

/**
 * 
 * @param {String} text 
 * @returns 
 */
function doubleEnter(text) {
    if (!text) return text;
    return text.replace(/\n/g, '\n\n');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}