require('dotenv').config();

const noteHendler = require('./helpers/noteHandler');
const BarkuniSticker = require('./helpers/berkuniHandler')
const sendSticker = require('./helpers/stickerMaker')
const Downloader = require('./helpers/downloader')
const { getOmerDay } = require('./helpers/hebrewDate')
const { store, GLOBAL } = require('./src/storeMsg')
const messageRetryHandler = require("./src/retryHandler")
const ChatGPT = require('./helpers/chatgpt')
const UnofficalGPT = require('./helpers/unofficalGPT')
const { info } = require("./helpers/globals");
const fetch = require('node-fetch');
const fs = require("fs");
const { getMsgType, MsgType } = require('./helpers/msgType');
const { downloadMediaMessage, getAggregateVotesInPollMessage, updateMessageWithPollUpdate } = require('@adiwajshing/baileys');

const chatGPT = new ChatGPT(process.env.OPENAI_API_KEY)
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
    "!יוטיוב": "שלח לי קישור לשיר ביוטיוב ואני אשלח לך אותו לכאן",
    "!ברקוני": "קבל סטיקר רנדומלי מברקוני",
    "!השתק": "השתק את הקבוצה לפי זמן מסוים",
    "!בטלהשתקה": "בטל השתקה",
    "!כולם": "תייג את כל המשתמשים בקבוצה (מנהלים בלבד)",
    "!תרגם": "תרגם לעברית את הטקסט בהודעה המצוטטת או את הטקסט לאחר הפקודה",
    "!גוגל": "קבל קישור לחיפוש בגוגל לטקסט בהודעה המצוטטת או לטקסט לאחר הפקודה",
    "!בוט": "שאל את GPT שאלה",
    "!אמלק": "קבל סיכום קצרצר של ההודעות האחרונות בשיחה",
    "!תמונה": "תאר לי תמונה (באנגלית) ואני אכין לך אותה",

    // "!הערות" : "קבל את כל ההערות בצאט זה",



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
                return sock.sendMessage(id, { text: "הכנס קוד פדרציה" }).then(messageRetryHandler.addMessage);
            case 3:
                return sock.sendMessage(id, {
                    text: getGroupConfig(id) +
                        "\nהאם ברצונך לשמור את השינויים?\nכן - לשמור,  לא - לביטול, ערוך - כדי לערוך שוב."
                }).then(messageRetryHandler.addMessage);
            case 4:
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
    if (textMsg.startsWith("!page")) {
        const page = "http://129.159.140.102:3000/"
        sock.sendMessage(id, { text: page }).then(messageRetryHandler.addMessage);
        return;
    }

    // text message
    if (!PRODUCTION && textMsg.startsWith("test")) {
        const poll = await sock.sendMessage(id, {
            poll: {
                name: "hello there!",
                values: [
                    "test123",
                    "test231"
                ],
                selectableCount: 1,
            }
        })
        console.log(poll)

        return;
    }

    if (msg.message?.pollUpdateMessage) {
        return;
        const pollUpdate = msg.message.pollUpdateMessage;
        const pollmsg = await store.loadMessage(id, msg.message.pollUpdateMessage.pollCreationMessageKey.id)
        console.log(msg.pollUpdates)
        console.log(pollmsg)

        const res = getAggregateVotesInPollMessage(pollmsg, sock.user.id)
        console.log(res)

        updateMessageWithPollUpdate(pollmsg, msg.pollUpdates)

        const res1 = getAggregateVotesInPollMessage(pollmsg, sock.user.id)
        console.log(res1)

        
    }


    if (textMsg === "!ping" || textMsg === "!פינג")
        return sock.sendMessage(id, { text: "פונג" }).then(messageRetryHandler.addMessage);
    if (textMsg === "!pong" || textMsg === "!פונג")
        return sock.sendMessage(id, { text: "פינג" }).then(messageRetryHandler.addMessage);

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

            text += "\n\nיש לכתוב סימן קריאה בתחילת ההודעה כדי להשתמש בפקודה.\nלדוגמא: !פינג"

            return sock.sendMessage(id, { text }).then(messageRetryHandler.addMessage);
        }
    }
    // in private
    else if (helpCommand.some(com => textMsg.includes(com))) {
        let text = "*רשימת הפקודות הזמינות בבוט:*\n"

        for (const [key, value] of Object.entries(commands)) {
            //console.log(key, value);
            text += `\n*${key}*: ${value}`;
        }

        text += `\n*!אודות*: קבל מידע אודות הבוט`;

        text += "\n\nיש לכתוב סימן קריאה בתחילת ההודעה כדי להשתמש בפקודה.\nלדוגמא: !פינג"

        return sock.sendMessage(id, { text }).then(messageRetryHandler.addMessage);
    }

    if (textMsg.startsWith("!כולם") || textMsg.startsWith("!everyone")) {
        if (!msg.key.remoteJid.includes("@g.us"))
            return sock.sendMessage(id, { text: "הפקודה זמינה רק בקבוצות" }).then(messageRetryHandler.addMessage);

        //get group members
        let groupData = await sock.groupMetadata(id);

        // sender is admin?
        let sender = groupData.participants.find(p => p.id === msg.key.participant);
        console.log(sender);

        const isAdmin = sender?.admin || msg.key.participant?.includes(superuser) || false;
        if (!isAdmin)
            return sock.sendMessage(id, { text: "אין לך הרשאות לבצע פקודה זו" }).then(messageRetryHandler.addMessage);

        // dont include bot
        const botnum = sock.user.id.split("@")[0].split(":")[0];
        groupData.participants = groupData.participants.filter(p => !p.id.includes(botnum));

        let members = groupData.participants.map(p => p.id);
        let quoteAll = members.map(m => "@" + m.replace("@s.whatsapp.net", "")).join(" ");

        return sock.sendMessage(id, { text: quoteAll, mentions: members }).then(messageRetryHandler.addMessage);
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


    /**#########
     * TRANSLATE
     * ##########*/
    if (textMsg.startsWith("!translate") || textMsg.startsWith("!תרגם")) {
        let textToTranslate = textMsg.replace("!translate", "").replace("!תרגם", "").trim();

        // check if has quoted message
        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            let quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            textToTranslate = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || "";
        }
        if (!textToTranslate) return sock.sendMessage(id, { text: "לא נמצא טקסט לתרגום" }).then(messageRetryHandler.addMessage);

        let translateUrl = "https://api.pawan.krd/mtranslate?from=en&to=iw&text=" + encodeURIComponent(textToTranslate);

        /** @type {{status:boolean, translated?: string, "time": number}} */
        let translateResult = await fetch(translateUrl).then(res => res.json());

        if (translateResult.status && translateResult.translated)
            return sock.sendMessage(id, { text: translateResult.translated }).then(messageRetryHandler.addMessage);

        return sock.sendMessage(id, { text: "משהו לא עבד טוב... נסה שנית" }).then(messageRetryHandler.addMessage);
    }




    /**########
     * GOOGLE
     ##########*/
    if (textMsg.startsWith("!google") || textMsg.startsWith("!גוגל")) {
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
            .replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
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
            //let res = await unofficalGPT.ask2(textMsg.replace("!gpt", "").replace("!בוט", "").trim() + '\n')
            let res = await chatGPT.ask2(textMsg.replace("!gpt", "").replace("!בוט", "").trim() + '\n')
            console.log(res?.choices?.[0] || res.error);
            let retText = res.choices?.[0]?.text?.trim() || res?.choices?.[0]?.message?.content || res.error + "\n" + res.hint;
            await sock.sendMessage(id, { text: retText }).then(messageRetryHandler.addMessage);
        } catch (error) {
            console.error(error);
            await sock.sendMessage(id, { text: "אופס... חלה שגיאה\nנסה לשאול שוב" }).then(messageRetryHandler.addMessage);
        }
        return;
    }

    // get image from GPT
    if (textMsg.includes("!image") || textMsg.includes("!תמונה")) {
        try {
            let resImage = await unofficalGPT.image(textMsg.replace("!image", "").replace("!תמונה", "").trim() + '\n');
            console.log(resImage?.data?.[0]?.url || resImage.error);
            if (resImage?.data?.[0]?.url) {
                for (const urlObj of resImage.data)
                    await sock.sendMessage(id, { image: { url: urlObj.url } }).then(messageRetryHandler.addMessage);
                return;
            }
            return sock.sendMessage(id, { text: resImage.error + "\n" + resImage.hint }).then(messageRetryHandler.addMessage);
        } catch (error) {
            console.error(error);
            return sock.sendMessage(id, { text: "אופס... חלה שגיאה\nנסה לשאול שוב" }).then(messageRetryHandler.addMessage);
        }
    }

    if (textMsg.includes("!אמלק") || textMsg.includes("!tldr") || textMsg.includes("!TLDR")) {
        try {
            // get num from message
            let numMsgToLoad = parseInt(textMsg.match(/\d+/g)?.[0] || 50);

            let history = await store.loadMessages(id, numMsgToLoad);
            history.pop(); // we don't want the last message (the one we got now)
            console.log('history length loaded:', history.length);

            let res = await unofficalGPT.tldr(history)
            console.log(res);
            let resText = res.choices?.[0]?.text?.trim() || res.error;
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

        Downloader(vidID, id, sock)
            .then(async data => {
                await sock.sendMessage(id, { caption: data.videoTitle, audio: { url: data.file }, mimetype: 'audio/mp4' }).then(messageRetryHandler.addMessage)
                await sock.sendMessage(id, { text: data.videoTitle }).then(messageRetryHandler.addMessage)
                fs.unlinkSync(data.file);
            });
        return;
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

    // stt
    if (textMsg.includes("!stt") || textMsg.includes("!טקסט")) {
        console.log(msg);
        // has quoted message?
        if (!msg.message.extendedTextMessage?.contextInfo?.quotedMessage)
            return sock.sendMessage(id, { text: "יש לצטט הודעה" }).then(messageRetryHandler.addMessage)

        // get from store
        let quotedMsg = await store.loadMessage(id, msg.message.extendedTextMessage.contextInfo.stanzaId);
        if (!quotedMsg)
            return sock.sendMessage(id, { text: "חלה שגיאה בטעינת ההודעה המצוטטת" }).then(messageRetryHandler.addMessage)

        // get type
        let { type } = getMsgType(quotedMsg);

        if (type !== MsgType.AUDIO)
            return sock.sendMessage(id, { text: "ההודעה המצוטטת אינה קובץ שמע" }).then(messageRetryHandler.addMessage)

        try {
            // download file
            let file = await downloadMediaMessage(quotedMsg, "buffer");
            // convert to text
            let info = await stt_heb(file);
            console.log(info);

            if (info.estimated_time) {
                const sended = await sock.sendMessage(id, { text: "מנסה לתמלל את ההודעה... זה עלול לקחת זמן" }).then(messageRetryHandler.addMessage)
                resendToSTT(file, id, sock, sended.key);
                return
            }

            if (info.error)
                return sock.sendMessage(id, { text: "אופס משהו לא עבד טוב" }).then(messageRetryHandler.addMessage)

            // send text
            return sock.sendMessage(id, { text: info.text }).then(messageRetryHandler.addMessage)

        } catch (error) {
            console.error(error);
            return sock.sendMessage(id, { text: "אופס משהו לא עבד טוב" }).then(messageRetryHandler.addMessage)
        }
    }

    // if the bot got mentioned
    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
        let mentionedJids = msg.message.extendedTextMessage.contextInfo.mentionedJid;
        const SOCK_NUM = sock.user.id.split(":")[0].split("@")[0];
        if (mentionedJids.some(jid => jid.startsWith(SOCK_NUM))) {
            return sock.sendMessage(id, { text: "הי אני באבי בוט, מישהו קרא לי?\nשלחו לי את הפקודה '!פקודות' כדי שאני אראה לכם מה אני יודע לעשות" }).then(messageRetryHandler.addMessage)
        }
    }


    // ##############
    // ##############
    //  NOT IN GROUP
    // ##############
    // ##############
    if (msg.key.remoteJid.includes("@g.us")) return;


    /**##########
     * INFO
     ############*/
    if (textMsg.startsWith("!info") || textMsg.startsWith("!מידע") || textMsg.includes("אודות")) {
        let text = "*מידע על הבוט:*\n\n" +
            "לידעתכם, ההודעות שנשלחות לבוט אינן חסויות לגמריי, ולמפתח יש גישה לראותן.\n" +
            "אל תשלחו מידע רגיש לבוט.\n\n" +

            "על מנת לראות מה הבוט מסוגל לעשות יש לשלוח את הפקודה '!פקודות'\n" +
            "(הבוט בתהליכי בנייה... רשימת הפקודות איננה סופית!)\n" +
            "מוזמנים להפיץ ולהשתמש להנאתכם!!\n\n" +
            "בוט זה נוצר על ידי שילה בבילה";

        return sock.sendMessage(id, { text }).then(messageRetryHandler.addMessage);
    }

    const { type } = getMsgType(msg);
    if (type === MsgType.AUDIO) {
        // get file
        let file = await downloadMediaMessage(msg, "buffer");
        // convert to text
        let info = await stt_heb(file);
        console.log(info);

        if (info.estimated_time) {
            const sended = await sock.sendMessage(id, { text: "מנסה לתמלל את ההודעה... זה עלול לקחת זמן" }).then(messageRetryHandler.addMessage)
            resendToSTT(file, id, sock, sended.key);
            return
        }

        if (info.error)
            return sock.sendMessage(id, { text: "אופס משהו לא עבד טוב" }).then(messageRetryHandler.addMessage)

        // send text
        return sock.sendMessage(id, { text: info.text }).then(messageRetryHandler.addMessage)
    }

    if (type !== MsgType.TEXT) return;

    // no command - answer with ChatGPT
    try {
        await sock.sendMessage(id, { react: { text: '⏳', key: msg.key } });
        let history = await store.loadMessages(id, 20);
        let res = await chatGPT.chat(history)
        await sock.sendMessage(id, { react: { text: '✅', key: msg.key } });
        return sock.sendMessage(id, { text: res }).then(messageRetryHandler.addMessage)


        // //let res = await unofficalGPT.waMsgs(history)
        // console.log(JSON.stringify(res, null, 2));
        // if (res?.choices?.[0]?.message?.content !== undefined) {
        //     await sock.sendMessage(id, { react: { text: '✅', key: msg.key } });
        //     return sock.sendMessage(id, { text: res.choices[0].message.content }).then(messageRetryHandler.addMessage)
        // }
        // await sock.sendMessage(id, { text: res.error + "\n" + res.hint }).then(messageRetryHandler.addMessage)
    } catch (error) {
        console.error(error);
        await sock.sendMessage(id, { text: "אופס... חלה שגיאה\nנסה לשאול שוב" })
    }
    await sock.sendMessage(id, { react: { text: '❌', key: msg.key } });


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
        msgToSend += `*מספר משתתפים להשתקה:* ${GLOBAL.groupConfig?.[id]?.countUser}\n`;
    if (GLOBAL.groupConfig?.[id]?.spam)
        msgToSend += `*ההודעה שתשלח בקבוצה בעת ההשתקה:* ${GLOBAL.groupConfig?.[id]?.spam}\n`;
    if (GLOBAL.groupConfig?.[id]?.feder)
        msgToSend += `*פדרציה:* ${GLOBAL.groupConfig?.[id]?.feder}\n`;

    msgToSend = GLOBAL.groupConfig?.[id] ? msgToSend : "אין הגדרות קבוצה";
    return msgToSend;
}

/**
 * 
 * @param {string | Buffer} data 
 * @returns {Promise<{text?: string, error?: string, estimated_time?: number>}}
 */
async function stt_heb(data) {
    // if not buffer - load from file
    if (typeof data !== "object")
        data = fs.readFileSync(data);

    const response = await fetch(
        //"https://api-inference.huggingface.co/models/imvladikon/wav2vec2-xls-r-300m-hebrew",
        "https://api-inference.huggingface.co/models/imvladikon/wav2vec2-xls-r-300m-lm-hebrew",
        {
            headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_TOKEN}` },
            method: "POST",
            body: data,
        }
    );
    const result = await response.json();
    return result;
}

async function resendToSTT(file, id, sock, msgkey) {
    for (let i = 0; i < 10; i++) {
        console.log("try", i);
        let res = await stt_heb(file);
        console.log(res);
        if (res.estimated_time) {
            sock.relayMessage(id, {
                protocolMessage: {
                    key: msgkey,
                    type: 14,
                    editedMessage: {
                        conversation: "מנסה לתמלל את ההודעה... זה עלול לקחת זמן \nניסיון מספר " + (i + 1) + "/10"
                    }
                }
            }, {})
            await sleep(15 * 1000);
            continue;
        }
        if (res.error) {
            await sock.relayMessage(id, {
                protocolMessage: {
                    key: msgkey,
                    type: 14,
                    editedMessage: {
                        conversation: res.error,
                    }
                }
            }, {})
            return;
        }
        return await sock.relayMessage(id, {
            protocolMessage: {
                key: msgkey,
                type: 14,
                editedMessage: {
                    conversation: res.text,
                }
            }
        }, {})
    }
    await sock.relayMessage(id, {
        protocolMessage: {
            key: msgkey,
            type: 14,
            editedMessage: {
                conversation: "אני לא מצליח לתמלל את ההודעה שלך כרגע\nנסה שוב בעוד כמה דקות",
            }
        }
    }, {})
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { handleMessage }