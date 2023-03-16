const sendSticker = require('./helpers/stickerMaker')
const Downloader = require('./helpers/downloader')
const { msgQueue } = require('./src/QueueObj')
const savedNotes = require('./src/notes')
const { store } = require('./src/storeMsg')
const ChatGPT = require('./helpers/chatgpt')
const { info } = require("./helpers/globals");
require('dotenv').config();
const fs = require("fs");

const chatGPT = new ChatGPT(process.env.OPENAI_API_KEY)

const superuser = process.env.SUPERUSER ?? "";
const ssid = process.env.MAILLIST ?? "";


let commands = {
    "!פינג": "בדוק אם אני חי",
    "!סטיקר": "שלח לי תמונה/סרטון בתוספת הפקודה, או ללא מדיה ואני אהפוך את המילים שלך לסטיקר",
    "!יוטיוב": "שלח לי קישור לסרטון ביוטיוב ואני אשלח לך אותו לכאן"
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
    //console.log(msg);

    // send ACK
    sock.readMessages([msg.key])


    if (textMsg === "!ping" || textMsg === "!פינג")
        return msgQueue.add(() => sock.sendMessage(id, { text: "pong" }));
    if (textMsg === "!pong" || textMsg === "!פונג")
        return msgQueue.add(() => sock.sendMessage(id, { text: "ping" }));

    // commands list
    let helpCommand = ["help", "command", "עזרה", "פקודות"];

    //in group
    if (msg.key.remoteJid.includes("@g.us")) {
        if (helpCommand.some(com => textMsg.includes("!" + com))) {
            let text = "*רשימת הפקודות הזמינות בבוט:*"

            for (const [key, value] of Object.entries(commands)) {
                //console.log(key, value);
                text += `\n${key}: ${value}`;
            }

            return sock.sendMessage(id, { text });
        }
    }
    // in private
    else if (helpCommand.some(com => textMsg.startsWith(com))) {
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


    /**######
     * GOOGLE
     ########*/
    else if (textMsg.startsWith("!google") || textMsg.startsWith("!גוגל")) {
        let textSearch = textMsg.replace("!google", "").replace("!גוגל", "").trim();

        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            let quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            let quotedText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || "";
            let linkMsg = textSearch.length === 0 ? "https://www.google.com/search?q=" + encodeURIComponent(quotedText.trim()) : "https://www.google.com/search?q=" + encodeURIComponent(textSearch);
            return sock.sendMessage(id, { text: "גוגל הוא חבר נהדר! למה שלא שתנסה לשאול אותו?\n" + linkMsg });

        }

        let linkMsg = textSearch.length === 0 ? "https://giybf.com/" : "https://www.google.com/search?q=" + encodeURIComponent(textSearch);
        return sock.sendMessage(id, { text: "גוגל הוא חבר נהדר! למה שלא שתנסה לשאול אותו?\n" + linkMsg });

    }


    /**######
     * NOTES
     ########*/
    // save notes
    if (textMsg.startsWith('!save') || textMsg.startsWith('!שמור')) {
        if (!mongo.isConnected)
            return sock.sendMessage(id, { text: "אין חיבור למסד נתונים" });

        textMsg = textMsg.replace('!save', '').replace('!שמור', '').trim();

        // quoted message
        if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.conversation) {
            let strs = textMsg.split(/(?<=^\S+)\s/);
            let result = await savedNotes.findOne({ q: strs[0] });
            console.log("Find if exist: ", result);

            if (result?.isGlobal || result?.chat === id)
                return sock.sendMessage(id, { text: "קיימת הערה בשם זה... נסה שם אחר" });

            result = await savedNotes.insertMany({
                q: strs[0],
                a: msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.conversation,
                chat: id
            });
            //console.log("Save: ", result);
            return sock.sendMessage(id, { text: "ההערה נשמרה בהצלחה!" });
        }
        // normal message

        let strs = textMsg.split(/(?<=^\S+)\s/);
        if (strs.length != 2)
            return sock.sendMessage(id, { text: "אופס נראה שחסר מידע... \nוודא שכתבת לי שם להערה וגם תוכן לההערה" });

        let result = await savedNotes.findOne({ q: strs[0] });
        console.log("Find: ", result);

        if (result?.isGlobal || result?.chat === id)
            return sock.sendMessage(id, { text: "קיימת הערה בשם זה... נסה שם אחר" });

        result = await savedNotes.insertMany({ q: strs[0], a: strs[1], chat: id });
        //console.log("Save: ", result);
        return sock.sendMessage(id, { text: "ההערה נשמרה בהצלחה!" });

    }

    // save global notes
    if (textMsg.startsWith('!Gsave') || textMsg.startsWith('!גשמור')) {
        if (!mongo.isConnected)
            return sock.sendMessage(id, { text: "אין חיבור למסד נתונים" });

        textMsg = textMsg.replace('!Gsave', '').replace('!גשמור', '').trim();

        // quoted message
        if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.conversation) {
            let strs = textMsg.split(/(?<=^\S+)\s/);
            let result = await savedNotes.findOne({ q: strs[0] });
            console.log("Find if exist: ", result);

            if (result?.isGlobal || result?.chat === id)
                return sock.sendMessage(id, { text: "קיימת הערה בשם זה... נסה שם אחר" });

            result = await savedNotes.insertMany({
                q: strs[0],
                a: msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.conversation,
                chat: id
            });
            //console.log("Save: ", result);
            return sock.sendMessage(id, { text: "ההערה נשמרה בהצלחה!" });
        }
        // normal message

        let strs = textMsg.split(/(?<=^\S+)\s/);
        if (strs.length != 2)
            return sock.sendMessage(id, { text: "אופס נראה שחסר מידע... \nוודא שכתבת לי שם להערה וגם תוכן לההערה" });

        let result = await savedNotes.findOne({ q: strs[0] });
        console.log("Find: ", result);

        if (result?.isGlobal || result?.chat === id)
            return sock.sendMessage(id, { text: "קיימת הערה בשם זה... נסה שם אחר" });

        result = await savedNotes.insertMany({ q: strs[0], a: strs[1], chat: id, isGlobal: true });
        //console.log("Save: ", result);
        return sock.sendMessage(id, { text: "ההערה נשמרה בהצלחה!" });
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

        if (result.chat == id || msg.key.participant?.includes(superuser)) {
            let res = await savedNotes.remove({ _id: result._id });
            console.log("Remove: ", res);
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
        let result = await savedNotes.findOne({ q: strs[0], chat: id });
        let resultGlobal = await savedNotes.findOne({ q: strs[0], isGlobal: true });

        if (!result && !resultGlobal)
            return sock.sendMessage(id, { text: "לא קיימת הערה עם שם זה" });

        let toConsole = [result?.a, result?.isGlobal, result?.chat]
        console.log("Find: ", toConsole);

        if (result?.isGlobal || result?.chat == id)
            return sock.sendMessage(id, { text: result.a });

        if (resultGlobal?.isGlobal)
            return sock.sendMessage(id, { text: resultGlobal.a });

        return sock.sendMessage(id, { text: "לא קיימת הערה עם שם זה" });
    }

    // get all notes
    if (textMsg.startsWith('!notes') || textMsg.startsWith('!הערות')) {
        if (!mongo.isConnected)
            return sock.sendMessage(id, { text: "אין חיבור למסד נתונים" });

        let resultPrivate = await savedNotes.find({ chat: id });
        let resultPublic = await savedNotes.find({ isGlobal: true });

        if (resultPrivate.length === 0 && resultPublic.length === 0)
            return sock.sendMessage(id, { text: "לא קיימות הערות" });

        resultPrivate = resultPrivate.filter(note => note.isGlobal != true);
        console.log("Find: ", resultPrivate, "Public: ", resultPublic);

        let str = "";
        if (resultPrivate.length !== 0) {
            str += "*הערות בצאט זה:*\n"
            for (let note of resultPrivate)
                str += note.q + "\n";
            str += "\n";
        }
        if (resultPublic.length !== 0) {
            str += `*הערות גלובליות:*\n`;
            for (let note of resultPublic)
                str += note.q + "\n";
            str += "\n";
        }

        str += "\nניתן לגשת להערה על ידי # או על ידי הפקודה !get";

        return sock.sendMessage(id, { text: str });
    }

    // get mails
    if (textMsg.includes("מייל של")) {
        let mails = await getMails();

        let searchText = textMsg.slice(textMsg.indexOf("מייל של") + 7).replace(/[?]/g, "").replace("בבקשה", "").trim();
        let arr_search = searchText.split(" ");
        console.log(arr_search)

        let retunText = "";
        let countMails = 0;
        for (let mail of mails) {
            try {
                //console.log(mail);
                let str = mail.c[0].v;
                //console.log(str, arr_search);

                if (arr_search.every(s => str.includes(s))) {
                    countMails += 1;
                    retunText += str + "\n";
                }
            } catch (error) {
                console.error(error);
            }
        }
        retunText = retunText.trim();

        if (countMails > 0 && countMails < 6)
            sock.sendMessage(id, { text: retunText });

        if (countMails === 0 && msg.key.remoteJid.includes("s.whatsapp.net"))
            sock.sendMessage(id, { text: "לא מצאתי את המייל המבוקש...\nנסה לחפש שוב במילים אחרות\n(אם המייל חסר - נשמח שתשלח לכאן אחרי שתמצא)" })
        return;
    }

    if (textMsg.includes("!אמלק") || textMsg.includes("!tldr") || textMsg.includes("!TLDR")) {
        try {
            let numMsgToLoad = parseInt(textMsg.replace(/^\D+|\D.*$/g, ""));
            numMsgToLoad = numMsgToLoad > 1 ? numMsgToLoad : 5;

            let history = await store.loadMessages(id, numMsgToLoad);
            history.pop();
            //console.log(history);

            let res = await chatGPT.tldr(history, id)
            return sock.sendMessage(id, { text: res })
        } catch (error) {
            return sock.sendMessage(id, { text: "אופס... חלה שגיאה\nנסה לשאול שוב" })
        }

    }

    /**#######
     * YOUTUBE
     #########*/
    if ((textMsg.startsWith("!youtube") || textMsg.startsWith("!יוטיוב"))) {

        let link = textMsg.replace("!youtube", '').replace('!יוטיוב', '').trim();
        let vidID = link.replace("https://", "").replace("www.youtube.com/watch?v=", '').replace("youtu.be/", "");


        Downloader(vidID, id, sock)
            .then(async data => {
                await sock.sendMessage(id, { caption: data.videoTitle, audio: { url: data.file }, mimetype: 'audio/mp4' })
                sock.sendMessage(id, { text: data.videoTitle })
                fs.unlinkSync(data.file);
            })

        return;
    }

    if (textMsg.includes('%')) {
        let progress = info.getYouTubeProgress(id);
        if (progress)
            return sock.sendMessage(id, { text: `התקדמתי ${progress.progress.percentage.toFixed(1)}% מההורדה.\nנשאר כ${progress.progress.eta} שניות לסיום...` })
    }


    // no command - answer with ChatGPT
    if (!msg.key.remoteJid.includes("@g.us")) {
        try {
            let history = await store.loadMessages(id, 8);
            let res = await chatGPT.chat(history, id)
            return sock.sendMessage(id, { text: res })
        } catch (error) {
            return sock.sendMessage(id, { text: "אופס... חלה שגיאה\nנסה לשאול שוב" })
        }


    }
}

/**
 * 
 * @returns {[{"c":[{"v":"name: mail@gmail.com"}]}]}
 */
async function getMails() {
    const url_begin = 'https://docs.google.com/spreadsheets/d/';
    const url_end = '/gviz/tq?&tqx=out:json';
    let url = `${url_begin}${ssid}${url_end}`;

    let res = await fetch(url);
    let data = await res.text();

    let json = JSON.parse(data.substr(47).slice(0, -2));
    return json.table.rows;
}


module.exports = { handleMessage }