const noteHendler = require('./helpers/noteHandler');

const BarkuniSticker = require('./helpers/berkuniHandler')
const sendSticker = require('./helpers/stickerMaker')
const Downloader = require('./helpers/downloader')
const { getOmerDay } = require('./helpers/hebrewDate')
//const { msgQueue } = require('./src/QueueObj')
//const savedNotes = require('./src/notes')
const { store, GLOBAL } = require('./src/storeMsg')
const messageRetryHandler = require("./src/retryHandler")
//const ChatGPT = require('./helpers/chatgpt')
const UnofficalGPT = require('./helpers/unofficalGPT')
const { info } = require("./helpers/globals");
require('dotenv').config();
const fetch = require('node-fetch');
const axios = require('axios').default;
const fs = require("fs");

//const chatGPT = new ChatGPT(process.env.OPENAI_API_KEY)
const unofficalGPT = new UnofficalGPT(process.env.UNOFFICALGPT_API_KEY)

const superuser = process.env.SUPERUSER ?? "";
const ssid = process.env.MAILLIST ?? "";
const PRODUCTION = process.env.NODE_ENV === 'production';
const DEFAULT_COUNT_USER_TO_MUTE = 10;
const url_begin = 'https://docs.google.com/spreadsheets/d/';
const url_end = '/gviz/tq?&tqx=out:json';


let commands = {
    "!פינג": "בדוק אם אני חי",
    "!סטיקר": "שלח לי תמונה/סרטון בתוספת הפקודה, או ללא מדיה ואני אהפוך את המילים שלך לסטיקר",
    "!יוטיוב": "שלח לי קישור לסרטון ביוטיוב ואני אשלח לך אותו לכאן",
    "!ברקוני": "קבל סטיקר רנדומלי מברקוני",
    "!השתק": "השתק את הקבוצה לפי זמן מסוים",
    "!בטלהשתקה": "בטל השתקה",
}

/**
 * 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('./mongo')} mongo 
 */
async function handleMessage(sock, msg, mongo) {
    let id = msg.key.remoteJid;

    // early check if action need to be done
    // reaction message
    if (msg.message?.reactionMessage) {
        console.log(msg.message.reactionMessage)

        // count reactions on saved msg
        let result = info.reactionsOnSavedMsg(msg);
        if (!result) return;
        let { reactionsCount, startTime, minToMute } = result;

        // check the delay between the first reaction and the last reaction
        let delay = Date.now() - startTime;

        // if delay is more than 5 minutes, delete msg (of reactions) from saved msgs
        if (delay > 5 * 60 * 1000) {
            info.deleteReactionMsg(msg);
            return;
        }

        // when count of reactions is enough, mute group
        if (reactionsCount >= GLOBAL.groupConfig?.[id]?.countUser ?? DEFAULT_COUNT_USER_TO_MUTE) {
            console.log("Mute Group:", id, " to:", minToMute)
            muteGroup(msg, minToMute);

            // delete msg (of reactions) from saved msgs
            info.deleteAllReactionMsg(id)
        }
        else {
            console.log("Not enough reactions", reactionsCount, "to mute group:", id)
        }
        return;
    }
    // set group config
    let stage = info.setSettingDialog(msg);
    if (stage !== undefined)
        switch (stage) {
            case -1:
                return sock.sendMessage(id, { text: "חלה שגיאה, אנא נסה שנית" }).then(messageRetryHandler.addMessage);
            case 0:
                return sock.sendMessage(id, { text: "הכנס את מספר המשתמשים להשתקה" }).then(messageRetryHandler.addMessage);
            case 1:
                return sock.sendMessage(id, { text: "הכנס הודעה שתשלח בקבוצה בעת ההשתקה" }).then(messageRetryHandler.addMessage);
            case 2:
                return sock.sendMessage(id, {
                    text: getGroupConfig(id) +
                        "\nהאם ברצונך לשמור את השינויים?\nכן - לשמור,  לא - לביטול, ערוך - כדי לערוך שוב."
                }).then(messageRetryHandler.addMessage);
            case 3:
                return sock.sendMessage(id, { text: "ההגדרות נשמרו בהצלחה!" }).then(messageRetryHandler.addMessage);
        }

    let caption = msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
    let textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    caption = caption.trim();
    textMsg = textMsg.trim();

    console.log(`${msg.pushName} (${id}) - ${caption || textMsg || msg?.message?.reactionMessage?.text}`)
    //console.log(JSON.stringify(msg, null, 2));

    // send ACK
    sock.readMessages([msg.key])

    // text message
    if (!PRODUCTION && textMsg.startsWith("test")) {
        const vcard = 'BEGIN:VCARD\n' // metadata of the contact card
            + 'VERSION:3.0\n'
            + 'FN:test\n' // full name
            //+ 'ORG:Ashoka Uni;\n' // the organization of the contact
            + 'TEL;type=CELL;waid=911234567890:+91 12345 67890\n' // WhatsApp ID + phone number
            + 'EMAIL;INTERNET:test1@gmail.com\n' // email ID
            + 'END:VCARD'
        const sentMsg = await sock.sendMessage(
            id,
            {
                contacts: {
                    displayName: 'Jeff',
                    contacts: [{ vcard }]
                }
            }
        )
            .then(messageRetryHandler.addMessage);
    }


    if (textMsg === "!ping" || textMsg === "!פינג")
        return sock.sendMessage(id, { text: "pong" }).then(messageRetryHandler.addMessage);
    if (textMsg === "!pong" || textMsg === "!פונג")
        return sock.sendMessage(id, { text: "ping" }).then(messageRetryHandler.addMessage);

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

            return sock.sendMessage(id, { text }).then(messageRetryHandler.addMessage);
        }
    }
    // in private
    else if (helpCommand.some(com => textMsg.startsWith(com))) {
        let text = "*רשימת הפקודות הזמינות בבוט:*"

        for (const [key, value] of Object.entries(commands)) {
            //console.log(key, value);
            text += `\n${key}: ${value}`;
        }

        return sock.sendMessage(id, { text }).then(messageRetryHandler.addMessage);
    }

    if (caption.startsWith('!sticker') || caption.startsWith('!סטיקר'))
        return sendSticker(msg, sock, "media");

    if (textMsg.startsWith('!sticker') || textMsg.startsWith('!סטיקר'))
        return sendSticker(msg, sock, "text");

    /**#########
     * barkuni
     ########## */
    if (textMsg.startsWith("!barkuni") || textMsg.startsWith("!ברקוני"))
        return BarkuniSticker(msg, sock, superuser);


    /**########
     * GOOGLE
     ##########*/
    else if (textMsg.startsWith("!google") || textMsg.startsWith("!גוגל")) {
        let textSearch = textMsg.replace("!google", "").replace("!גוגל", "").trim();

        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            let quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            let quotedText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || "";
            let linkMsg = textSearch.length === 0 ? "https://www.google.com/search?q=" + encodeURIComponent(quotedText.trim()) : "https://www.google.com/search?q=" + encodeURIComponent(textSearch);
            return sock.sendMessage(id, { text: "גוגל הוא חבר נהדר! למה שלא שתנסה לשאול אותו?\n" + linkMsg }).then(messageRetryHandler.addMessage);

        }

        let linkMsg = textSearch.length === 0 ? "https://giybf.com/" : "https://www.google.com/search?q=" + encodeURIComponent(textSearch);
        return sock.sendMessage(id, { text: "גוגל הוא חבר נהדר! למה שלא שתנסה לשאול אותו?\n" + linkMsg }).then(messageRetryHandler.addMessage);

    }

    /**##########
     * MUTE GROUP
     * ##########*/
    if (textMsg.startsWith("!mute") || textMsg.startsWith("!השתק")) {

        if (!msg.key.remoteJid.includes("@g.us"))
            return sock.sendMessage(id, { text: "אתה צריך לשלוח את הפקודה בקבוצה" });

        let groupData = await sock.groupMetadata(id);
        let participant = groupData.participants;

        // check if the bot is admin
        let bot = participant.find(p => sock.user.id.includes(p.id.slice(0, p.id.indexOf("@"))));
        console.log(bot);
        if (!bot?.admin)
            return sock.sendMessage(id, { text: "אני צריך להיות מנהל בקבוצה" });

        // get mute time
        let muteTime = textMsg.replace("!mute", "").replace("!השתק", "").trim();
        if (muteTime.length === 0)
            return sock.sendMessage(id, { text: "אנא הכנס זמן השתקה בדקות" });

        let muteTime_min = parseInt(muteTime);
        if (isNaN(muteTime_min))
            return sock.sendMessage(id, { text: "אנא הכנס זמן השתקה בדקות" });

        if (muteTime_min < 1 || muteTime_min > 60)
            return sock.sendMessage(id, { text: "אנא הכנס זמן השתקה בין 1 ל 60 דקות" });

        // check if the sender is admin
        // TODO: make poll to vote if to mute the group
        let sender = participant.find(p => p.id === msg.key.participant);
        console.log(sender);
        if (!sender.admin) {
            //return sock.sendMessage(id, { text: "אתה צריך להיות מנהל בקבוצה" });
            //info.deleteReactionMsg(msg);
            let phoneOfSender = msg.key.participant?.slice(0, msg.key.participant.indexOf("@"));
            // get the number from text
            let timeToMute = textMsg.replace(/[^0-9]/g, '').trim();

            console.log(GLOBAL.groupConfig?.[id]);

            let botMsg = await sock.sendMessage(id, {
                text: `*מזה יש כאן באלגן?*\n` +
                    `@${phoneOfSender} רוצה להשתיק את הקבוצה למשך ${timeToMute} דקות...\n` +
                    `ברגע ש${GLOBAL.groupConfig?.[id]?.countUser ?? DEFAULT_COUNT_USER_TO_MUTE} אנשים יסכימו איתו ויגיבו על ההודעה הזאת בלייק, הקבוצה תושתק.\n` +
                    `אתם מסכימים?`,
                mentions: [msg.key.participant]
            }).then(messageRetryHandler.addMessage);
            return info.makeReactionMsg(botMsg, muteTime_min);
        }

        // if admin, mute the group immediately
        info.deleteAllReactionMsg(id);
        return muteGroup(msg, muteTime_min);
    }

    if (textMsg.startsWith("!unmute") || textMsg.startsWith("!בטלהשתקה")) {
        if (!msg.key.remoteJid.includes("@g.us"))
            return sock.sendMessage(id, { text: "אתה צריך לשלוח את הפקודה בקבוצה" });

        let groupData = await sock.groupMetadata(id);
        if (!groupData.announce)
            return sock.sendMessage(id, { text: "הקבוצה כבר פתוחה" });

        // check if the bot is admin
        let participant = groupData.participants;
        let bot = participant.find(p => sock.user.id.includes(p.id.slice(0, p.id.indexOf("@"))));
        console.log(bot);
        if (!bot?.admin)
            return sock.sendMessage(id, { text: "אני צריך להיות מנהל בקבוצה" });

        sock.groupSettingUpdate(id, 'not_announcement');
        sock.sendMessage(id, { text: "הקבוצה פתוחה" });

    }

    // set group config
    if (textMsg.startsWith("!set") || textMsg.startsWith("!הגדר")) {
        if (!msg.key.remoteJid.includes("@g.us"))
            return sock.sendMessage(id, { text: "אתה צריך לשלוח את הפקודה בקבוצה" });

        let groupData = await sock.groupMetadata(id);
        let participant = groupData.participants;

        // check if the bot is admin
        let bot = participant.find(p => sock.user.id.includes(p.id.slice(0, p.id.indexOf("@"))));
        console.log(bot);
        if (!bot?.admin)
            return sock.sendMessage(id, { text: "אני צריך להיות מנהל בקבוצה" });

        // check if the sender is admin
        let sender = participant.find(p => p.id === msg.key.participant);
        console.log(sender);
        if (!sender.admin)
            return sock.sendMessage(id, { text: "אתה צריך להיות מנהל בקבוצה" });

        info.startDialog(msg);
        sock.sendMessage(id, { text: "הגדרות הקבוצה נשלחו לפרטי" });

        // send the group config to the sender
        sock.sendMessage(msg.key.participant, { text: getGroupConfig(id) + "\nמתחיל בעריכה:\nהכנס את מספר המשתמשים להשתקה" });
        return;
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

        let issuperuser = false;
        if (msg.key.remoteJid?.includes(superuser) || msg.key.participant?.includes(superuser))
            issuperuser = true;

        return noteHendler.saveNote(msg, sock, true, issuperuser);
    }

    // delete note
    if (textMsg.startsWith('!delete') || textMsg.startsWith('!מחק')) {
        if (!mongo.isConnected)
            return sock.sendMessage(id, { text: "אין חיבור למסד נתונים" });

        let issuperuser = false;
        if (msg.key.remoteJid?.includes(superuser) || msg.key.participant?.includes(superuser))
            issuperuser = true;

        return noteHendler.deleteNote(msg, sock, issuperuser);
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
    if (textMsg.includes("מייל של ")) {
        let mails = await getMails();

        let searchText = textMsg.slice(textMsg.indexOf("מייל של") + 7)
            .replace(/[?]/g, "")
            .replace("בבקשה", "").replace("המרצה ", "").replace("מרצה ", "")
            .replace("המתרגל ", "").replace("מתרגל ", "")
            .trim();
        let arr_search = searchText.split(" ");
        console.log(arr_search)

        let retunText = "";
        let countMails = 0;
        for (let mail of mails) {
            try {
                let str = mail.c[0].v;
                let nickname = mail.c[1]?.v || "";
                //console.log(str, arr_search);

                if (arr_search.every(s => str.includes(s) || nickname.includes(s))) {
                    console.log(mail);
                    countMails += 1;
                    retunText += str + "\n";
                }
            } catch (error) {
                console.error(error);
            }
        }
        retunText = retunText.trim();

        if (countMails > 0 && countMails < 8)
            sock.sendMessage(id, { text: retunText }).then(messageRetryHandler.addMessage);

        else if (msg.key.remoteJid.includes("s.whatsapp.net")) {
            if (countMails === 0)
                sock.sendMessage(id, {
                    text: `לא מצאתי את המייל המבוקש... נסה לחפש שוב במילים אחרות\n`
                        + `(אם המייל חסר גם כאן ${url_begin}${ssid}\n - נשמח שתוסיף)`
                }).then(messageRetryHandler.addMessage)

            else
                sock.sendMessage(id, {
                    text: `מצאתי ${countMails} מיילים עבור ${searchText}\n`
                        + `נסה לחפש באופן ממוקד יותר\n`
                }).then(messageRetryHandler.addMessage)

        }
        return;
    }

    // reply with plesure to "תודה"
    if (textMsg.includes("תודה")) {
        let numberSocket = sock.user.id.slice(0, sock.user.id.indexOf(":"));

        // check if replied to the bot
        // and have @ in the quoted message
        if (msg.message.extendedTextMessage?.contextInfo?.participant.startsWith(numberSocket) &&
            msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.conversation.includes("@")) {
            sock.sendMessage(id, { text: "בשמחה! תמיד שמח לעזור😃" }).then(messageRetryHandler.addMessage);
            return;
        }
    }

    // ask GPT
    if (textMsg.includes("!בוט") || textMsg.includes("!gpt")) {
        try {
            let res = await unofficalGPT.ask(textMsg.replace("!gpt", "").replace("!בוט", "").trim() + '\n')
            console.log(res?.choices?.[0]?.text?.trim() || res);
            return sock.sendMessage(id, { text: res.choices?.[0]?.text?.trim() }).then(messageRetryHandler.addMessage);
        } catch (error) {
            console.error(error);
            return sock.sendMessage(id, { text: "אופס... חלה שגיאה\nנסה לשאול שוב" }).then(messageRetryHandler.addMessage);
        }
    }

    // get image from GPT
    if (textMsg.includes("!image") || textMsg.includes("!תמונה")) {
        try {
            let resImage = await unofficalGPT.image(textMsg.replace("!image", "").replace("!תמונה", "").trim() + '\n');
            console.log(resImage?.data?.[0]?.url || resImage);
            return sock.sendMessage(id, { image: { url: resImage.data[0].url } }).then(messageRetryHandler.addMessage);
        } catch (error) {
            console.error(error);
            return sock.sendMessage(id, { text: "אופס... חלה שגיאה\nנסה לשאול שוב" }).then(messageRetryHandler.addMessage);
        }
    }

    if (textMsg.includes("!אמלק") || textMsg.includes("!tldr") || textMsg.includes("!TLDR")) {
        try {
            // get num from message
            let numMsgToLoad = parseInt(textMsg.match(/\d+/g)?.[0] || 15);

            let history = await store.loadMessages(id, numMsgToLoad);
            history.pop(); // we don't want the last message (the one we got now)
            console.log('history length loaded:', history.length);

            let res = await unofficalGPT.tldr(history)
            console.log(res);
            let resText = res.choices?.[0]?.text?.trim();
            return sock.sendMessage(id, { text: resText })
        } catch (error) {
            console.error(error);
            return sock.sendMessage(id, { text: "אופס... חלה שגיאה\nנסה לשאול שוב" })
        }

    }

    /**#######
     * YOUTUBE
     #########*/
    if ((textMsg.startsWith("!youtube") || textMsg.startsWith("!יוטיוב"))) {

        let link = textMsg.replace("!youtube", '').replace('!יוטיוב', '').trim();
        let vidID = link.replace("https://", "").replace("www.youtube.com/watch?v=", '').replace("youtu.be/", "");

        return Downloader(vidID, id, sock)
            .then(async data => {
                await sock.sendMessage(id, { caption: data.videoTitle, audio: { url: data.file }, mimetype: 'audio/mp4' }).then(messageRetryHandler.addMessage)
                sock.sendMessage(id, { text: data.videoTitle }).then(messageRetryHandler.addMessage)
                fs.unlinkSync(data.file);
            });
    }
    // get youtube progress
    if (textMsg.includes('%')) {
        let progress = info.getYouTubeProgress(id);
        if (progress)
            return sock.sendMessage(id, { text: `התקדמתי ${progress.progress.percentage.toFixed(1)}% מההורדה.\nנשאר כ${progress.progress.eta} שניות לסיום...` }).then(messageRetryHandler.addMessage)
    }

    // Omer count
    if (textMsg.includes("!omer") || textMsg.includes("!עומר")) {
        return sock.sendMessage(id, { text: `היום ${getOmerDay().render("he")}` }).then(messageRetryHandler.addMessage)
    }

    // no command - answer with ChatGPT
    if (!msg.key.remoteJid.includes("@g.us")) {
        try {
            let history = await store.loadMessages(id, 8);
            let res = await unofficalGPT.waMsgs(history)
            console.log(res.choices || res);
            return sock.sendMessage(id, { text: res.choices[0].message.content }).then(messageRetryHandler.addMessage)
        } catch (error) {
            console.error(error);
            return sock.sendMessage(id, { text: "אופס... חלה שגיאה\nנסה לשאול שוב" })
        }
    }
}

/**
 * 
 * @returns {Promise<[{"c":[{"v":"name: mail@gmail.com"},{"v":"nickname"} | undefined]}]>}
 */
async function getMails() {
    let url = `${url_begin}${ssid}${url_end}`;

    let res = await fetch(url);
    let data = await res.text();

    let json = JSON.parse(data.substr(47).slice(0, -2));
    return json.table.rows;
}

/**
 * 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {Number} muteTime_min 
 */
async function muteGroup(msg, muteTime_min) {
    let id = msg.key.remoteJid;
    const ONE_MINUTE = 1000 * 60;

    await GLOBAL.sock.groupSettingUpdate(id, 'announcement')
    if (GLOBAL.groupConfig?.[id]?.spam)
        GLOBAL.sock.sendMessage(id, {
            text: `הקבוצה נעולה לשיחה ל-${muteTime_min} דקות\n`
                + `${GLOBAL.groupConfig?.[id]?.spam}`
        })
    else
        GLOBAL.sock.sendMessage(id, { text: `הקבוצה נעולה לשיחה ל-${muteTime_min} דקות` })

    setTimeout(async () => {
        let groupData = await GLOBAL.sock.groupMetadata(id);
        if (!groupData.announce) return;

        await GLOBAL.sock.groupSettingUpdate(id, 'not_announcement');
        GLOBAL.sock.sendMessage(id, { text: "הקבוצה פתוחה" })
    }, muteTime_min * ONE_MINUTE);

}

/**
 * get the group config
 * @param {String} id
 * @returns {String}
 */
function getGroupConfig(id) {
    let msgToSend = `*הגדרות הקבוצה:*\n`;
    if (GLOBAL.groupConfig?.[id]?.countUser)
        msgToSend += `*מספר משתתפים להשתקה*: ${GLOBAL.groupConfig?.[id]?.countUser}\n`;
    if (GLOBAL.groupConfig?.[id]?.spam)
        msgToSend += `*ההודעה שתשלח בקבוצה בעת ההשתקה*:\n ${GLOBAL.groupConfig?.[id]?.spam}`;

    msgToSend = GLOBAL.groupConfig?.[id] ? msgToSend : "אין הגדרות קבוצה";
    return msgToSend;
}

module.exports = { handleMessage }