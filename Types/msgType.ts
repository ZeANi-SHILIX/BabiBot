import { proto } from '@adiwajshing/baileys'

export declare enum MsgType {
    TEXT = "text",
    IMAGE = "image",
    VIDEO = "video",
    AUDIO = "audio",
    STICKER = "sticker",
    DOCUMENT = "document"
};

/**
 * 
 * @param msg 
 * @returns default {type: MsgType.TEXT, mime: undefined}
 */
export function getMsgType(msg: proto.WebMessageInfo) {
    if (msg?.message?.imageMessage) return {type: MsgType.IMAGE, mime: msg.message.imageMessage.mimetype};
    if (msg?.message?.videoMessage) return {type: MsgType.VIDEO, mime: msg.message.videoMessage.mimetype};
    if (msg?.message?.audioMessage) return {type: MsgType.AUDIO, mime: msg.message.audioMessage.mimetype};
    if (msg?.message?.stickerMessage) return {type: MsgType.STICKER, mime: msg.message.stickerMessage.mimetype}
    if (msg?.message?.documentMessage) return {type: MsgType.DOCUMENT, mime: msg.message.documentMessage.mimetype}
    return {type: MsgType.TEXT, mime: undefined};
}