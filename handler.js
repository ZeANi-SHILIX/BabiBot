const sendSticker = require('./helpers/stickerMaker')
const { msgQueue } = require('./src/QueueObj')

/**
 * 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 */
async function handleMessage(sock, msg) {
    let id = msg.key.remoteJid;
    let caption = msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
    let textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

    // send ACK
    sock.readMessages([msg.key])


    if (textMsg === "!ping")
        return msgQueue.add(() => sock.sendMessage(id, { text: "pong" }));
    

    if (textMsg.includes("commands")) {
        return sock.sendMessage(id, {
            text: "!ping"
        });
    }

    if (caption.startsWith('!sticker') || caption.startsWith('!סטיקר'))
        return sendSticker(msg, sock, "media");

    if (textMsg.startsWith('!sticker') || textMsg.startsWith('!סטיקר'))
        return sendSticker(msg, sock, "text");
}


module.exports = { handleMessage }