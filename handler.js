import dotenv from 'dotenv';
dotenv.config();
import noteHendler from './helpers/noteHandler.js';
import BarkuniSticker from './helpers/berkuniHandler.js';
import sendSticker from './helpers/stickerMaker.js';
import { DownloadV2, downloadTYoutubeVideo } from './helpers/downloader.js';
import { GLOBAL } from './src/storeMsg.js';
import MemoryStore from './src/store.js';
import messageRetryHandler from './src/retryHandler.js';
import ChatGPT from './helpers/chatgpt.js';
//import UnofficalGPT from './helpers/unofficalGPT.js';
import { info } from './helpers/globals.js';
import fetch from 'node-fetch';
import fs from 'fs';
import { getMsgType, MsgType } from './helpers/msgType.js';
import { downloadMediaMessage, getAggregateVotesInPollMessage, updateMessageWithPollUpdate } from '@adiwajshing/baileys';
import { msgQueue, sendMsgQueue, TYQueue } from './src/QueueObj.js';

//const chatGPT = new ChatGPT(process.env.OPENAI_API_KEY , false)
const chatGPT = new ChatGPT(process.env.OPENAI_API_KEY, true)
//const unofficalGPT = new UnofficalGPT(process.env.UNOFFICALGPT_API_KEY)

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
    //"!תרגם": "תרגם לעברית את הטקסט בהודעה המצוטטת או את הטקסט לאחר הפקודה",
    "!גוגל": "קבל קישור לחיפוש בגוגל לטקסט בהודעה המצוטטת או לטקסט לאחר הפקודה",
    //"!בוט": "שאל את GPT שאלה (ניתן לשאול גם בפרטי ללא הפקודה)",
    //"!אמלק": "קבל סיכום קצרצר של ההודעות האחרונות בשיחה",
    //"!תמונה": "תאר לי תמונה ואני אכין לך אותה",
    //"!תמלל": "שלח לי את הפקודה בציטוט ההודעה בקבוצה, או פשוט רק את השמע בפרטי ואני אתמלל לך אותה"

    // "!הערות" : "קבל את כל ההערות בצאט זה",
    '!אודות': 'קבל מידע אודות הבוט'


}

/**
 * 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('./mongo')} mongo 
 */
export default async function handleMessage(sock, msg, mongo) {
    let id = msg.key.remoteJid;
    let caption = msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
    let textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    caption = caption.trim();
    textMsg = textMsg.trim();

    // print to console
    const metadata = id.endsWith("@g.us") ? await sock.groupMetadata(id) : null;
    let bodymsg = caption || textMsg || msg.message?.reactionMessage?.text;
    metadata
        ? console.log(`${msg.pushName} in (${metadata.subject}) - ${bodymsg}`)
        : console.log(`${msg.pushName} (private) - ${bodymsg}`)



    // send ACK
    sock.readMessages([msg.key])

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
    // choose number to download YT video
    let YTinfo = info.YTgetSearch(id);
    if (YTinfo) {
        let num = parseInt(textMsg);
        if (num === 0) {
            info.YTdeleteSearch(id);
            return sendMsgQueue(id, "ההורדה בוטלה");
        }
        if (isNaN(num) || num < 1 || num > 5 || num > YTinfo.length)
            return sendMsgQueue(id, `אנא בחר מספר בין 1 ל ${YTinfo.length > 4 ? 5 : YTinfo.length}\nאו 0 כדי לבטל`);
        let video = YTinfo[num - 1];
        info.YTdeleteSearch(id);

        TYQueue.size > 0 ? sendMsgQueue(id, "מקומך בתור: " + TYQueue.size + "\nאנא המתן...") : null;
        return TYQueue.add(async () => await downloadTYoutubeVideo(id, video.id));
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

    // text message
    if (!PRODUCTION && textMsg.startsWith("test")) {
        const poll = await sock.sendMessage(id, {
            poll: {
                name: "test poll",
                values: [
                    "option 1",
                    "option 2",
                    "option 3",
                ],
                selectableCount: 1,
            }
        })
        console.log(poll)

        return;
    }

    if (msg.message?.pollUpdateMessage || msg.pollUpdates) {
        return;
        //console.log(msg.pollUpdates)

        // let key = msg.message.pollUpdateMessage.pollCreationMessageKey;
        // if (!key) return;

        // let pollCreation = await store.loadMessage(id, key.id);
        // if (!pollCreation) return;

        // const pollMessage = await getAggregateVotesInPollMessage({
        //     message: pollCreation,
        //     pollUpdates: msg.pollUpdates,
        // }, sock.user.id)

        //console.log(pollMessage)

        // const pollUpdate = msg.message.pollUpdateMessage;
        // const pollmsg = await store.loadMessage(id, msg.message.pollUpdateMessage.pollCreationMessageKey.id)
        // console.log(msg.pollUpdates)
        // console.log(pollmsg)

        // const res = getAggregateVotesInPollMessage(pollmsg, sock.user.id)
        // console.log(res)

        // updateMessageWithPollUpdate(pollmsg, msg.pollUpdates)

        // const res1 = getAggregateVotesInPollMessage(pollmsg, sock.user.id)
        //console.log(res1)


        return;
    }


    if (textMsg === "!ping" || textMsg === "!פינג")
        return sendMsgQueue(id, "פונג");
    if (textMsg === "!pong" || textMsg === "!פונג")
        return sendMsgQueue(id, "פינג");


    if (textMsg.startsWith("!כולם") || textMsg.startsWith("!everyone")) {
        if (!msg.key.remoteJid.includes("@g.us"))
            return sendMsgQueue(id, "הפקודה זמינה רק בקבוצות");

        //get group members
        let groupData = await sock.groupMetadata(id);

        // sender is admin?
        let sender = groupData.participants.find(p => p.id === msg.key.participant);
        console.log(sender);

        const isAdmin = sender?.admin || msg.key.participant?.includes(superuser) || false;
        if (!isAdmin)
            return sendMsgQueue(id, "פקודה זו זמינה למנהלים בלבד");

        if (!GLOBAL.everybodyLastUse2min(id)) return sendMsgQueue(id, "יש להמתין 2 דקות לפני שימוש בפקודה פעם נוספת");

        // dont include bot
        const botnum = sock.user.id.split("@")[0].split(":")[0];
        groupData.participants = groupData.participants.filter(p => !p.id.includes(botnum));

        let members = groupData.participants.map(p => p.id);
        let phoneOfSender = msg.key.participant?.slice(0, msg.key.participant.indexOf("@"));
        let quoteAll = "*הופה בלאגן!!! @" + phoneOfSender + " קורא/ת לכולם!* \n\n" // fix to set tag to the sender
            + members.map(m => "@" + m.replace("@s.whatsapp.net", "")).join(" ");

        let everybody_msg = msgQueue.add(async () => await sock.sendMessage(id, { text: quoteAll, mentions: members }).then(messageRetryHandler.addMessage));


        return //everybodyMSG(everybody_msg, sock);
    }

    /**#########
     * STICKER
     ########## */
    if (caption.startsWith('!sticker') || caption.startsWith('!סטיקר') ||
        textMsg.startsWith('!sticker') || textMsg.startsWith('!סטיקר'))
        return sendSticker(msg);

    /**#########
     * barkuni
     ########## */
    if (textMsg.startsWith("!barkuni") || textMsg.startsWith("!ברקוני"))
        return BarkuniSticker(msg, sock, superuser);


    // ## NEED FIX ##
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

        let translateResult = await translate(textToTranslate);

        if (translateResult.status && translateResult.translated)
            return sock.sendMessage(id, { text: translateResult.translated }).then(messageRetryHandler.addMessage);

        return sock.sendMessage(id, { text: "משהו לא עבד טוב... נסה שנית" }).then(messageRetryHandler.addMessage);
    }




    /**########
     * GOOGLE
     ##########*/
    if (textMsg.startsWith("!google") || textMsg.startsWith("!גוגל")) {
        let textSearch = textMsg.replace("!google", "").replace("!גוגל", "").trim();
        let textToSend;

        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            let quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            let quotedText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || "";
            let linkMsg = textSearch.length === 0 ? "https://www.google.com/search?q=" + encodeURIComponent(quotedText.trim()) : "https://www.google.com/search?q=" + encodeURIComponent(textSearch);
            textToSend = "גוגל הוא חבר נהדר! למה שלא תנסה לשאול אותו?\n" + linkMsg;

        }
        else {
            let linkMsg = textSearch.length === 0 ? "https://giybf.com/" : "https://www.google.com/search?q=" + encodeURIComponent(textSearch);
            textToSend = "גוגל הוא חבר נהדר! כדאי לשאול אותו?\n" + linkMsg;
        }
        return sendMsgQueue(id, textToSend);
    }

    /**##########
     * MUTE GROUP
     * ##########*/
    if (textMsg.startsWith("!mute") || textMsg.startsWith("!השתק")) {

        if (!msg.key.remoteJid.includes("@g.us"))
            return sendMsgQueue(id, "אתה צריך לשלוח את הפקודה בקבוצה");

        let groupData = await sock.groupMetadata(id);
        let participant = groupData.participants;

        // check if the bot is admin
        let bot = participant.find(p => sock.user.id.includes(p.id.slice(0, p.id.indexOf("@"))));
        console.log(bot);
        if (!bot?.admin)
            return sendMsgQueue(id, "אני צריך להיות מנהל בקבוצה כדי שהפקודה תוכל לפעול");

        // get mute time
        let muteTime = textMsg.replace("!mute", "").replace("!השתק", "").trim();
        if (muteTime.length === 0)
            return sendMsgQueue(id, "אנא הכנס זמן השתקה בדקות");

        let muteTime_min = parseInt(muteTime);
        if (isNaN(muteTime_min))
            return sendMsgQueue(id, "אנא הכנס זמן השתקה בדקות");

        if (muteTime_min < 1 || muteTime_min > 60)
            return sendMsgQueue(id, "אנא הכנס זמן השתקה בין 1 ל 60 דקות");

        // check if the sender is admin
        // TODO: make poll to vote if to mute the group
        let sender = participant.find(p => p.id === msg.key.participant);
        console.log(sender);
        if (!sender.admin) {
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
            // store the msg id
            return info.makeReactionMsg(botMsg, muteTime_min);
        }

        // else if admin, mute the group immediately
        info.deleteAllReactionMsg(id);
        return muteGroup(msg, muteTime_min);
    }

    // UNMUTE GROUP
    if (textMsg.startsWith("!unmute") || textMsg.startsWith("!בטלהשתקה")) {
        if (!msg.key.remoteJid.includes("@g.us"))
            return sendMsgQueue(id, "הפקודה זמינה רק בקבוצה");

        let groupData = await sock.groupMetadata(id);
        if (!groupData.announce)
            return sendMsgQueue(id, "הקבוצה כבר פתוחה");

        // check if the bot is admin - (not needed)
        let participant = groupData.participants;
        let bot = participant.find(p => sock.user.id.includes(p.id.slice(0, p.id.indexOf("@"))));
        console.log(bot);
        if (!bot?.admin)
            return sendMsgQueue(id, "אני צריך להיות מנהל בקבוצה כדי שהפקודה תוכל לפעול");

        msgQueue.add(async () => await sock.groupSettingUpdate(id, 'not_announcement'));
        sendMsgQueue(id, "הקבוצה פתוחה");

    }

    // ## NEED IMPROVE ##
    /**#############
     * GROUP CONFIG
     * #############*/
    if (textMsg.startsWith("!set") || textMsg.startsWith("!הגדר")) {
        if (!msg.key.remoteJid.includes("@g.us"))
            return sendMsgQueue(id, "הפקודה זמינה רק בקבוצה");

        let groupData = await sock.groupMetadata(id);
        let participant = groupData.participants;

        // check if the bot is admin
        let bot = participant.find(p => sock.user.id.includes(p.id.slice(0, p.id.indexOf("@"))));
        console.log(bot);
        if (!bot?.admin)
            return sendMsgQueue(id, "אני צריך להיות מנהל בקבוצה");

        // check if the sender is admin
        let sender = participant.find(p => p.id === msg.key.participant);
        console.log(sender);
        if (!sender.admin)
            return sendMsgQueue(id, "אתה צריך להיות מנהל בקבוצה");

        info.startDialog(msg);
        sendMsgQueue(id, "הגדרות הקבוצה נשלחו לפרטי");

        // send the group config to the sender
        sendMsgQueue(msg.key.participant, getGroupConfig(id) + "\nמתחיל בעריכה:\nהכנס את מספר המשתמשים להשתקה");
        return;
    }



    /**######
     * NOTES
     ########*/
    // save notes
    if (textMsg.startsWith('!save') || textMsg.startsWith('!שמור')) {
        if (!mongo.isConnected)
            return sendMsgQueue(id, "אין חיבור למסד נתונים");

        return noteHendler.saveNote(msg, sock);
    }

    // save global notes
    if (textMsg.startsWith('!Gsave') || textMsg.startsWith('!גשמור')) {
        if (!mongo.isConnected)
            return sendMsgQueue(id, "אין חיבור למסד נתונים");

        let issuperuser = false;
        if (msg.key.remoteJid?.includes(superuser) || msg.key.participant?.includes(superuser))
            issuperuser = true;

        return noteHendler.saveNote(msg, sock, true, issuperuser);
    }

    // delete note
    if (textMsg.startsWith('!delete') || textMsg.startsWith('!מחק')) {
        if (!mongo.isConnected)
            return sendMsgQueue(id, "אין חיבור למסד נתונים");

        let issuperuser = false;
        if (msg.key.remoteJid?.includes(superuser) || msg.key.participant?.includes(superuser))
            issuperuser = true;

        return noteHendler.deleteNote(msg, sock, issuperuser);
    }

    // get note
    if (textMsg.startsWith('!get') || textMsg.startsWith('#')) {
        if (!mongo.isConnected)
            return sendMsgQueue(id, "אין חיבור למסד נתונים");

        return noteHendler.getNote(msg, sock);
    }

    // get all notes
    if (textMsg.startsWith('!notes') || textMsg.startsWith('!הערות')) {
        if (!mongo.isConnected)
            return sendMsgQueue(id, "אין חיבור למסד נתונים");

        return noteHendler.getAllNotes(msg, sock);
    }

    /**##########
     * MAIL LIST
     * ##########*/
    if (textMsg.includes("מייל של ")) {
        let mails = await getMails();

        let searchText = textMsg.slice(textMsg.indexOf("מייל של") + 7)
            .replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
            .replace(/[?]/g, "")
            .replace("בבקשהה", "").replace("בבקשה", "")
            .replace("המרצה ", "").replace("מרצה ", "")
            .replace("המתרגל ", "").replace("מתרגל ", "")
            .trim();

        if ((" " + searchText).includes(" דר "))
            searchText = searchText.replace("דר ", "")

        let arr_search = searchText.split(" ");
        console.log(arr_search)

        let returnText = "";
        let countMails = 0;
        for (let mail of mails) {
            try {
                let str = mail.c[0].v;
                let nickname = mail.c[1]?.v || "";
                //console.log(str, arr_search);

                if (arr_search.every(s => str.includes(s) || nickname.includes(s))) {
                    console.log(mail.c[0]);
                    countMails += 1;
                    returnText += str + "\n";
                }
            } catch (error) {
                console.error(error);
            }
        }
        returnText = returnText.trim();

        if (countMails > 0 && countMails < 8)
            sendMsgQueue(id, returnText)

        else if (msg.key.remoteJid.includes("s.whatsapp.net")) {
            if (countMails === 0)
                sendMsgQueue(id, `לא מצאתי את המייל המבוקש... נסה לחפש שוב במילים אחרות\n`
                    + `(אם המייל חסר גם כאן ${url_begin}${ssid}\n - נשמח שתוסיף)`)
            else
                sendMsgQueue(id, `מצאתי ${countMails} מיילים עבור ${searchText}\n`
                    + `נסה לחפש באופן ממוקד יותר`)
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
            return sendMsgQueue(id, "בשמחה! תמיד שמח לעזור😃")
        }
    }

    // ## NEED IMPROVE ##
    /**##########
     *  ChatGPT
     * ##########*/
    if (textMsg.includes("!בוט") || textMsg.includes("!gpt")) {
        if (!GLOBAL.canAskGPT(id))
            return sendMsgQueue(id, "יותר מידי שאלות בזמן קצר... נסה שוב מאוחר יותר\n"
                // + "תוכלו להסיר את ההגבלה על ידי תרומה לבוט:\n"
                // + "https://www.buymeacoffee.com/BabiBot\n"
                // + "https://payboxapp.page.link/C43xQBBdoUAo37oC6"
            );

        //return sock.sendMessage(id, { text: "השירות לא זמין\nמוזמנים לתרום לבוט ותעזרו לבאבי בוט להיות משוכלל יותר\n\nhttps://www.buymeacoffee.com/BabiBot" }).then(messageRetryHandler.addMessage);
        try {
            const text = textMsg.replace("!gpt", "").replace("!בוט", "").trim();
            if (!text) return;
            //let res = await unofficalGPT.ask2(textMsg.replace("!gpt", "").replace("!בוט", "").trim() + '\n')
            let res = await chatGPT.ask(text + '\n')
            console.log(res?.choices?.[0] || res.error);
            let retText = res.choices?.[0]?.text?.trim() || res?.choices?.[0]?.message?.content || res?.error?.message || res;
            sendMsgQueue(id, retText)
        } catch (error) {
            console.error(error);
            sendMsgQueue(id, "אופס... חלה שגיאה\nנסה לשאול שוב")
        }
    }

    // get image from GPT
    if (textMsg.includes("!image") || textMsg.includes("!תמונה")) {
        return sendMsgQueue(id, "השירות כרגע לא זמין")
        // try {
        //     let imgdesc = textMsg.replace("!image", "").replace("!תמונה", "").trim();
        //     // get only english letters
        //     let imgdesc_en = imgdesc.replace(/[^a-zA-Z0-9 ]/g, '').trim();

        //     if (imgdesc_en.length < 2) {
        //         let translatedText = await translate(imgdesc, 'iw', 'en');
        //         console.log(translatedText);
        //         imgdesc_en = translatedText.translated || "";
        //     }

        //     console.log(imgdesc_en);

        //     let resImage = await unofficalGPT.image(imgdesc_en + '\n');
        //     console.log(resImage?.data?.[0]?.url || resImage.error);
        //     if (resImage?.data?.[0]?.url) {
        //         for (const urlObj of resImage.data)
        //             await sock.sendMessage(id, { image: { url: urlObj.url } }).then(messageRetryHandler.addMessage);
        //         return;
        //     }
        //     return sock.sendMessage(id, { text: resImage.error + "\n" + resImage.hint }).then(messageRetryHandler.addMessage);
        // } catch (error) {
        //     console.error(error);
        //     return sock.sendMessage(id, { text: "אופס... חלה שגיאה\nנסה לשאול שוב" }).then(messageRetryHandler.addMessage);
        // }
    }

    if (textMsg.includes("!אמלק") || textMsg.includes("!tldr") || textMsg.includes("!TLDR")) {
        if (!GLOBAL.canAskGPT(id))
            return sendMsgQueue(id, "יותר מידי שאלות בזמן קצר... נסה שוב מאוחר יותר\n"
                // + "תוכלו להסיר את ההגבלה על ידי תרומה לבוט:\n"
                // + "https://www.buymeacoffee.com/BabiBot\n"
                // + "https://payboxapp.page.link/C43xQBBdoUAo37oC6"
            );

        //return sock.sendMessage(id, { text: "השירות לא זמין\nמוזמנים לתרום לבוט ותעזרו לבאבי בוט להיות משוכלל יותר\n\nhttps://www.buymeacoffee.com/BabiBot" }).then(messageRetryHandler.addMessage);
        try {
            // get num from message
            let numMsgToLoad = parseInt(textMsg.match(/\d+/g)?.[0] || 50);

            //let history = await store.loadMessages(id, numMsgToLoad);
            let history = await MemoryStore.loadMessages(id, numMsgToLoad);
            history.pop(); // we don't want the last message (the one we got now)
            console.log('history length loaded:', history.length);

            if (history.length < 1)
                return sendMsgQueue(id, "לא מצאתי היסטוריה עבור שיחה זו")

            let res = await chatGPT.tldr(history)
            return sendMsgQueue(id, res);
        } catch (error) {
            console.error(error);
            return sendMsgQueue(id, "אופס... חלה שגיאה\nנסה לשאול שוב")
        }

    }

    // stt - speech to text
    if (textMsg.includes("!stt") || textMsg.includes("!טקסט") || textMsg.includes("!תמלל")) {
        if (!GLOBAL.canAskGPT(id))
            return sendMsgQueue(id, "יותר מידי שאלות בזמן קצר... נסה שוב מאוחר יותר\n"
                // + "תוכלו להסיר את ההגבלה על ידי תרומה לבוט:\n"
                // + "https://www.buymeacoffee.com/BabiBot\n"
                // + "https://payboxapp.page.link/C43xQBBdoUAo37oC6"
            );

        //return sock.sendMessage(id, { text: "השירות לא זמין\nמוזמנים לתרום לבוט ותעזרו לבאבי בוט להיות משוכלל יותר\n\nhttps://www.buymeacoffee.com/BabiBot" }).then(messageRetryHandler.addMessage);

        // has quoted message?
        if (!msg.message.extendedTextMessage?.contextInfo?.quotedMessage)
            return sendMsgQueue(id, "יש לצטט הודעה")

        // get from store
        //let quotedMsg = await store.loadMessage(id, msg.message.extendedTextMessage.contextInfo.stanzaId);
        let quotedMsg = await MemoryStore.loadMessage(id, msg.message.extendedTextMessage.contextInfo.stanzaId);
        if (!quotedMsg)
            return sendMsgQueue(id, "חלה שגיאה בטעינת ההודעה המצוטטת")

        // get type
        let { type } = getMsgType(quotedMsg);

        if (type !== MsgType.AUDIO)
            return sendMsgQueue(id, "ההודעה המצוטטת אינה קובץ שמע")

        return whisper(quotedMsg, sock);
    }

    // ## NEED IMPROVE ## 
    // check if download is in progress
    // replace libary
    /**#######
     * YOUTUBE
     #########*/
    if ((textMsg.startsWith("!youtube") || textMsg.startsWith("!יוטיוב"))) {
        return DownloadV2(msg);
    }

    /**######
     *  MISC
     * ######*/
    // if the bot got mentioned
    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
        let mentionedJids = msg.message.extendedTextMessage.contextInfo.mentionedJid;
        const SOCK_NUM = sock.user.id.split(":")[0].split("@")[0];
        if (mentionedJids.some(jid => jid.startsWith(SOCK_NUM))) {
            return sock.sendMessage(id, { text: "היי אני באבי בוט, מישהו קרא לי?\nשלחו לי את הפקודה '!פקודות' כדי שאני אראה לכם מה אני יודע לעשות" }).then(messageRetryHandler.addMessage)
        }
    }

    // commands list
    let helpCommand = ["help", "command", "עזרה", "פקודות"];

    //in group
    if (msg.key.remoteJid.includes("@g.us")) {
        if (helpCommand.some(com => textMsg.includes("!" + com))) {
            let text = "*רשימת הפקודות הזמינות בבוט:*"

            for (const [key, value] of Object.entries(commands)) {
                //console.log(key, value);
                text += `\n*${key}:* _${value}_`;
            }

            text += "\n\nיש לכתוב סימן קריאה בתחילת ההודעה כדי להשתמש בפקודה.\nלדוגמא: !פינג"
            text += "\n\nלקריאת הפקודות בצורה נוחה: babibot.live "
            return sendMsgQueue(id, text);
        }
    }
    // in private
    else if (helpCommand.some(com => textMsg.includes(com))) {
        let text = "*רשימת הפקודות הזמינות בבוט:*\n"

        for (const [key, value] of Object.entries(commands)) {
            //console.log(key, value);
            text += `\n*${key}*: _${value}_`;
        }

        text += "\n\nיש לכתוב סימן קריאה בתחילת ההודעה כדי להשתמש בפקודה.\nלדוגמא: !פינג"

        text += "\n\nלקריאת הפקודות בצורה נוחה: babibot.live "
        return sendMsgQueue(id, text);
    }


    if (textMsg.startsWith("!info") || textMsg.startsWith("!מידע") || textMsg.includes("!אודות")) {
        let text = "*מידע על הבוט:*\n\n" +
            "לידעתכם, ההודעות שנשלחות לבוט אינן חסויות לגמריי, ולמפתח יש גישה לראותן.\n" +
            "אל תשלחו מידע רגיש לבוט.\n\n" +
            "*השימוש בבוט מהווה הסכמה לכך שהמפתח יכול להשתמש בהודעות שנשלחו לבוט לצורך פיתוח ושיפור הבוט.*\n\n" +

            "על מנת לראות מה הבוט מסוגל לעשות יש לשלוח את הפקודה '!פקודות'\n" +
            "(הבוט בתהליכי בנייה... רשימת הפקודות איננה סופית!)\n" +
            "מוזמנים להפיץ ולהשתמש להנאתכם!!\n\n" +
            "בוט זה נוצר על ידי שילה בבילה";

        return sendMsgQueue(id, text);
    }

    return
    // ##############
    // ##############
    //  NOT IN GROUP
    // ##############
    // ##############
    if (msg.key.remoteJid.includes("@g.us")) return;


    /**##########
     * INFO
     ############*/

    const { type } = getMsgType(msg);
    if (type === MsgType.AUDIO) {
        return whisper(msg, sock);
        // // get file
        // let file = await downloadMediaMessage(msg, "buffer");
        // // convert to text
        // let info = await stt_heb(file);
        // console.log(info);

        // if (info.estimated_time) {
        //     const sended = await sock.sendMessage(id, { text: "מנסה לתמלל את ההודעה... זה עלול לקחת זמן" }).then(messageRetryHandler.addMessage)
        //     resendToSTT(file, id, sock, sended.key);
        //     return
        // }

        // if (info.error)
        //     return sock.sendMessage(id, { text: "אופס משהו לא עבד טוב" }).then(messageRetryHandler.addMessage)

        // // send text
        // return sock.sendMessage(id, { text: info.text }).then(messageRetryHandler.addMessage)
    }

    if (type !== MsgType.TEXT) return;

    // no command - answer with ChatGPT
    // try {
    //     await sock.sendMessage(id, { react: { text: '⏳', key: msg.key } });
    //     let history = await store.loadMessages(id, 20);
    //     let [res, finish_reason] = await chatGPT.chatDevinci(history)
    //     if (res == "") {
    //         [res, finish_reason] = await chatGPT.chatDevinci(history);
    //     }
    //     await sock.sendMessage(id, { react: { text: '✅', key: msg.key } });
    //     let returnMsg = await sock.sendMessage(id, { text: res }).then(messageRetryHandler.addMessage);
    //     if (finish_reason == "length") {
    //         history.push({
    //             key: { fromMe: true },
    //             message: { conversation: res }
    //         })
    //         continueChat(history, res, id, sock, returnMsg.key);
    //     }
    //     return;

    // } catch (error) {
    //     console.error(error);
    //     await sock.sendMessage(id, { text: "אופס... חלה שגיאה\nנסה לשאול שוב" })
    // }
    // await sock.sendMessage(id, { react: { text: '❌', key: msg.key } });


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
 * @param {String} str
 * @returns {Boolean} 
 */
function isIncludeLink(str) {
    return str.includes("http") || str.includes("https") || str.includes("www.");
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

    GLOBAL.clearTimeout(id);
    GLOBAL.timeouts[id] = setTimeout(async () => {
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

/**
 * 
 * @param {proto.IWebMessageInfo[]} history 
 * @param {string} oldRes 
 * @param {string} id 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @param {proto.IWebMessageInfo.key} editMsgkey 
 * @returns 
 */
async function continueChat(history, oldRes, id, sock, editMsgkey) {
    let [res, finish_reason] = await chatGPT.chatDevinci(history);
    if (res == "") return;

    // edit the last message
    sock.relayMessage(id, {
        protocolMessage: {
            key: editMsgkey,
            type: 14,
            editedMessage: {
                conversation: oldRes + res
            }
        }
    }, {})
}



/**
 * 
 * @param {string} text 
 * @param {"iw" | "en"} source 
 * @param {"iw" | "en"} target 
 * @returns {Promise<{status:boolean, translated?: string, time: number}>}
 */
async function translate(text, source = "en", target = "iw") {
    let translateUrl = `https://api.pawan.krd/mtranslate?from=${source}&to=${target}&text=` + encodeURIComponent(text);

    return await fetch(translateUrl).then(res => res.json());
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

/**
 * 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 */
async function whisper(msg, sock) {
    const id = msg.key.remoteJid;
    try {
        const filename = `./${id}_whisper.ogg`;

        // download file
        /** @type {Buffer} */
        let buffer = await downloadMediaMessage(msg, "buffer");
        // save temp file
        fs.writeFileSync(filename, buffer);
        // send to stt
        let res = await chatGPT.stt(filename);
        // delete file
        fs.unlinkSync(filename);

        // send the result
        return sendMsgQueue(id, res)

    } catch (error) {
        console.error(error);
        return sendMsgQueue(id, "אופס משהו לא עבד טוב")
    }
}

/**
 * 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @returns 
 */
async function everybodyMSG(msg, sock) {
    const id = msg.key.remoteJid;
    await sleep(1000);
    await sock.relayMessage(id, {
        protocolMessage: {
            key: msg.key,
            type: 14,
            editedMessage: {
                conversation: "כל משתמשי הקבוצה תוייגו בהצלחה!",
            }
        }
    }, {})
    return;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
