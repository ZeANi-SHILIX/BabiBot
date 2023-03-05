const sendSticker = require('./helpers/stickerMaker')
const { msgQueue } = require('./src/QueueObj')

let commands = {
    "!ping": "בדוק אם אני חי",
    "!sticker": "שלח לי תמונה/סרטון בתוספת הפקודה, או ללא מדיה ואני אהפוך את המילים שלך לסטיקר",
}

/**
 * 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 */
async function handleMessage(sock, msg) {
    let id = msg.key.remoteJid;
    let caption = msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
    let textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

    console.log(`${msg.pushName} (${id}) - ${caption} ${textMsg}`)

    // send ACK
    sock.readMessages([msg.key])


    if (textMsg === "!ping" || textMsg === "!פינג")
        return msgQueue.add(() => sock.sendMessage(id, { text: "pong" }));
    if (textMsg === "!pong" || textMsg === "!פונג")
        return msgQueue.add(() => sock.sendMessage(id, { text: "ping" }));

    let helpCommand = ["help", "command", "עזרה", "פקודות"];
    if (helpCommand.some(com => textMsg.includes(com))) {
        let text = "*רשימת הפקודות הזמינות בבוט:*"

        for (const [key, value] of Object.entries(commands)) {
            //console.log(key, value);
            text += `\n${key}: ${value}`;
        }

        return sock.sendMessage(id, { text });
    }

    if (caption.startsWith('!sticker') || caption.startsWith('!סטיקר'))
        return sendSticker(msg, sock, "media");

    if (textMsg.startsWith('!sticker') || textMsg.startsWith('!סטיקר'))
        return sendSticker(msg, sock, "text");
}


module.exports = { handleMessage }