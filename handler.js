const sendSticker = require('./helpers/stickerMaker')
const { msgQueue } = require('./src/QueueObj')
const savedNotes = require('./src/notes')


let commands = {
    "!ping": "בדוק אם אני חי",
    "!sticker": "שלח לי תמונה/סרטון בתוספת הפקודה, או ללא מדיה ואני אהפוך את המילים שלך לסטיקר",
}

/**
 * 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('./mongo')} mongo 
 */
async function handleMessage(sock, msg, mongo) {
    let id = msg.key.remoteJid;
    let caption = msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
    let textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    caption = caption.trim();
    textMsg = textMsg.trim();

    console.log(`${msg.pushName} (${id}) - ${caption} ${textMsg}`)
    console.log(msg);

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


    // save notes
    if (textMsg.startsWith('!save') || textMsg.startsWith('!שמור')) {
        if (!mongo.isConnected)
            return sock.sendMessage(id, { text: "אין חיבור למסד נתונים" });

        textMsg = textMsg.replace('!save', '').replace('!שמור', '').trim();

        if (msg.message.conversation) {
            let strs = textMsg.split(/(?<=^\S+)\s/);
            let result = await savedNotes.findOne({ q: strs[0] });
            console.log("Find: ", result);

            if (result)
                return sock.sendMessage(id, { text: "קיימת הערה בשם זה... נסה שם אחר" });

            result = await savedNotes.insertMany({ q: strs[0], a: strs[1], chat: id });
            //console.log("Save: ", result);
            return sock.sendMessage(id, { text: "ההערה נשמרה בהצלחה!" });

        }
        if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.conversation) {

        }
    }

    // delete note
    if (textMsg.startsWith('!delete') || textMsg.startsWith('!מחק')) {
        if (!mongo.isConnected)
            return sock.sendMessage(id, { text: "אין חיבור למסד נתונים" });

        textMsg = textMsg.replace('!delete', '').replace('!מחק', '').trim();

        let strs = textMsg.split(/(?<=^\S+)\s/);
        let result = await savedNotes.findOne({ q: strs[0] });
        console.log("Find: ", result);

        if (!result)
            return sock.sendMessage(id, { text: "לא קיימת הערה בשם זה" });

        if (result.chat == id) {
            savedNotes.remove(result)
            return sock.sendMessage(id, { text: "ההערה " + result.q + " הוסרה בהצלחה" });
        }

        return sock.sendMessage(id, { text: "אין לך את ההרשאות המתאימות להסיר את ההערה " });


    }

    // get note
    if (textMsg.startsWith('!get') || textMsg.startsWith('#')) {
        if (!mongo.isConnected)
            return sock.sendMessage(id, { text: "אין חיבור למסד נתונים" });

        textMsg = textMsg.replace('!get', '').replace('#', '').trim();

        let strs = textMsg.split(/(?<=^\S+)\s/);
        let result = await savedNotes.findOne({ q: strs[0] });
        console.log("Find: ", result);

        if (!result)
            return sock.sendMessage(id, { text: "לא קיימת הערה עם שם זה" });

        if (result.isGlobal || result.chat == id)
            return sock.sendMessage(id, { text: result.a });

        return sock.sendMessage(id, { text: "לא קיימת הערה עם שם זה" });


    }

    // get all notes
    if (textMsg.startsWith('!notes') || textMsg.startsWith('!הערות')) {
        if (!mongo.isConnected)
            return sock.sendMessage(id, { text: "אין חיבור למסד נתונים" });

        let resultPrivate = await savedNotes.find({ chat: id });
        let resultPublic = await savedNotes.find({ isGlobal: true });
        console.log("Find: ", resultPrivate, "Public: ", resultPublic);

        if (resultPrivate.length === 0 && resultPublic.length === 0)
            return sock.sendMessage(id, { text: "לא קיימות הערות" });

        resultPrivate = resultPrivate.filter(note => note.isGlobal != true);

        let str = "";
        if (resultPublic.length !== 0) {
            str = `*הערות גלובליות:*\n`;
            for (let note of resultPublic)
                str += note.q + "\n";
            str += "\n";
        }

        if (resultPrivate.length !== 0) {
            str += "*הערות בצאט זה:*\n"
            for (let note of resultPrivate)
                str += note.q + "\n";
            str += "\n";
        }

        str += "\nניתן לגשת להערה על ידי # או על ידי הפקודה !get";

        return sock.sendMessage(id, { text: str });


    }
}




module.exports = { handleMessage }