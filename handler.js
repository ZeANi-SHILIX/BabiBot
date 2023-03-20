const noteHendler = require('./helpers/noteHandler');

const BarkuniSticker = require('./helpers/berkuniHandler')
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
    "!יוטיוב": "שלח לי קישור לסרטון ביוטיוב ואני אשלח לך אותו לכאן",
    "!ברקוני": "קבל סטיקר רנדומלי מברקוני",
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
    //console.log(JSON.stringify(msg, null, 2));
    
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

    /**#########
     * barkuni
     ########## */
     if (textMsg.startsWith("!barkuni") || textMsg.startsWith("!ברקוני"))
        return BarkuniSticker(msg, sock);


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
        return noteHendler.saveNote(msg, sock);
    }

    // save global notes
    if (textMsg.startsWith('!Gsave') || textMsg.startsWith('!גשמור')) {
        if (!mongo.isConnected)
            return sock.sendMessage(id, { text: "אין חיבור למסד נתונים" });
        return noteHendler.saveNote(msg, sock, true);
    }

    // delete note
    if (textMsg.startsWith('!delete') || textMsg.startsWith('!מחק')) {
        if (!mongo.isConnected)
            return sock.sendMessage(id, { text: "אין חיבור למסד נתונים" });

        return noteHendler.deleteNote(msg, sock, superuser);
    }

    // get note
    if (textMsg.startsWith('!get') || textMsg.startsWith('#')) {
        if (!mongo.isConnected)
            return sock.sendMessage(id, { text: "אין חיבור למסד נתונים" });

        return noteHendler.getNote(msg, sock);
    }

    // get all notes
    if (textMsg.startsWith('!notes') || textMsg.startsWith('!הערות')) {
        if (!mongo.isConnected)
            return sock.sendMessage(id, { text: "אין חיבור למסד נתונים" });
        return noteHendler.getAllNotes(msg, sock);
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