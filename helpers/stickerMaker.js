import dotenv from 'dotenv';
dotenv.config();
import { downloadMediaMessage } from '@adiwajshing/baileys';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const { UltimateTextToImage, registerFont } = process.env.NODE_ENV === 'production' ? await import("ultimate-text-to-image") : { UltimateTextToImage: null, registerFont: null };
registerFont?.('./src/Gveret Levin Alef Alef Alef.ttf', { family: 'Alef' });

import messageRetryHandler from "../src/retryHandler.js";
import { MsgType, getMsgType } from './msgType.js';
import MemoryStore from '../src/store.js';
import { msgQueue, sendMsgQueue, errorMsgQueue } from '../src/QueueObj.js';


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
export default async function sendSticker(msg, sock, msgTypeSticker) {
    let id = msg.key.remoteJid;
    let caption = msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
    let textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";


    // video or image message
    if (msgTypeSticker === "media") {
        let setType = caption.replace('!sticker', '').replace('!סטיקר', '').trim();

        const type = sticker_types[setType] || StickerTypes.FULL;

        const messageType = Object.keys(msg.message)[0]
        if (messageType === 'imageMessage' || messageType === 'videoMessage' || messageType === 'stickerMessage') {

            const buffer = await downloadMediaMessage(msg, 'buffer', {})
            // not bigger than 1.5MB
            const size = buffer.byteLength / 1024 / 1024
            if (size > 1.5) return sendMsgQueue(id, "אופס... הקובץ גדול מדי, נסה לשלוח קובץ קטן יותר")

            const quality = size > 0.8 ? 10 : 30;
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
            msgQueue.add(async () => await sock.sendMessage(id, stickerMsg).then(messageRetryHandler.addMessage))
        }
        return;
    }

    // quoted message with image or video
    try {
        let quoted = await MemoryStore.loadMessage(id, msg.message?.extendedTextMessage?.contextInfo?.stanzaId);
        let { type } = getMsgType(quoted);

        if (type === MsgType.IMAGE || type === MsgType.VIDEO || type === MsgType.STICKER) {
            const buffer = await downloadMediaMessage(quoted, 'buffer', {})
            
            let setType = textMsg.replace('!sticker', '').replace('!סטיקר', '').trim();
            const type = sticker_types[setType] || StickerTypes.FULL;
            
            // not bigger than 1.5MB
            const size = buffer.byteLength / 1024 / 1024
            if (size > 1.5) return sendMsgQueue(id, "אופס... הקובץ גדול מדי, נסה לשלוח קובץ קטן יותר")

            const quality = size > 0.8 ? 10 : 30;
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
            msgQueue.add(async () => await sock.sendMessage(id, stickerMsg).then(messageRetryHandler.addMessage))
            return;
        }
    } catch (error) {
        console.log(error);
        errorMsgQueue(error)
        return sendMsgQueue(id, "אופס... נראה שההודעה שציטטת אינה תקינה")
    }


    // text message
    if (msgTypeSticker === "text") {
        let message = textMsg.replace('!sticker', "").replace('!סטיקר', '').trim();

        let isQuoted = false;
        // no content, check if quoted message
        if (message == "") {
            isQuoted = true;
            message = await MemoryStore.loadMessage(id, msg.message?.extendedTextMessage?.contextInfo?.stanzaId)
            message = message?.message?.conversation || message?.message?.extendedTextMessage?.text || "";
        }

        // no content and no quoted message
        if (isQuoted && message == "") return sendMsgQueue(id, "אופס! לא מצאתי תוכן להפוך לסטיקר...\nיש לכתוב טקסט לאחר הפקודה או לצטט הודעה אחרת")


        const sticker = new Sticker(
            //textToSticker(message),
            textToSticker2(message),
            {
                pack: '🎉',
                author: 'BabiBot',
                categories: ['🤩', '🎉'],
                quality: 50
            });
            const stickerMsg = await sticker.toMessage();

            console.log("adding sticker message to queue, type: text")
            msgQueue.add(async () => await sock.sendMessage(id, stickerMsg).then(messageRetryHandler.addMessage))
    }
}

function textToSticker2(text) {
    text = putEnterBetweenEmojis(text);
    text = doubleEnter(text);
    console.log(text);
    return new UltimateTextToImage(text + "  ", {
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
        marginLeft: 90,
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