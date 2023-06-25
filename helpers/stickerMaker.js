import { downloadMediaMessage } from '@adiwajshing/baileys';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
//const text2png = require('text2png');
import { UltimateTextToImage } from "ultimate-text-to-image";

import messageRetryHandler from "../src/retryHandler.js";

import { store } from '../src/storeMsg.js';
import { MsgType, getMsgType } from './msgType.js';


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
        if (messageType === 'imageMessage' || messageType === 'videoMessage') {

            const buffer = await downloadMediaMessage(msg, 'buffer', {})
            const sticker = new Sticker(buffer, {
                pack: '🎉',
                author: 'BabiBot',
                type: type,
                categories: ['🤩', '🎉'],
                quality: 30
            });
            sock.sendMessage(id, await sticker.toMessage()).then(messageRetryHandler.addMessage);
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
            return sock.sendMessage(id, await sticker.toMessage()).then(messageRetryHandler.addMessage);
        }
    } catch (error) {
        console.log(error);
        return sock.sendMessage(id, { text: "אופס... נראה שההודעה שציטטת אינה תקינה" })
    }


    // text message
    if (msgTypeSticker === "text") {
        let message = textMsg.replace('!sticker', "").replace('!סטיקר', '').trim();

        if (message == "") return sock.sendMessage(id, { text: "אופס... שלחת לי הודעה ריקה" });

        const sticker = new Sticker(
            //textToSticker(message),
            textToSticker2(message),
            {
                pack: '🎉',
                author: 'BabiBot',
                categories: ['🤩', '🎉'],
                quality: 50
            });
        sock.sendMessage(id, await sticker.toMessage()).then(messageRetryHandler.addMessage);
    }
}


/**
 * 
 * @param {String} text 
 * @returns {Buffer} buffer as default 
 */
// function textToSticker(text) {

//     const MAX_CHARS_IN_ROW = 20;
//     const style = {
//         font: "100px San Francisco",
//         textAlign: "center",
//         color: "white",
//         size: 20,
//         padding: 10,
//         strokeWidth: 3,
//         strokeColor: "black",
//     };

//     let v1 = "";
//     let v1_arr = [];
//     let count = 0;
//     for (let ch of text) {
//         if (ch === '\n') {
//             count = 0;
//             v1_arr.push(v1);
//             v1 = "";
//         }
//         else if (ch === ' ' && count >= MAX_CHARS_IN_ROW) {
//             count = 0;
//             v1_arr.push(v1);
//             v1 = "";
//         }
//         else {
//             v1 += ch;
//             count++;
//         }
//     }
//     if (v1 != "") v1_arr.push(v1);

//     console.log(v1_arr)
//     let v1_final = v1_arr.join('\n');

//     return text2png(v1_final, style);
// }

function textToSticker2(text) {
    text = putEnterBetweenEmojis(text);
    console.log(text);
    return new UltimateTextToImage(text, {
        width: 350,
        maxWidth: 400,
        maxHeight: 400,
        fontFamily: "Arial",
        // white color
        fontColor: "#ffffff",
        fontSize: 150,
        //fontWeight: "bold",
        minFontSize: 25,
        lineHeight: 50,
        autoWrapLineHeightMultiplier: 1.1,
        //autoWrapLineHeight: 2,
        margin: 10,
        marginBottom: 10,
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