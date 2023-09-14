import dotenv from 'dotenv';
dotenv.config();
import noteHendler from './helpers/noteHandler.js';
import BarkuniSticker from './helpers/berkuniHandler.js';
import KupaRashitSticker from './helpers/kupaRashitHandler.js';
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
//import { downloadMediaMessage, getAggregateVotesInPollMessage, updateMessageWithPollUpdate } from '@adiwajshing/baileys';
import { errorMsgQueue, msgQueue, sendCustomMsgQueue, sendMsgQueue, TYQueue } from './src/QueueObj.js';
import translate from './custom_modules/Translate.js';
import { getPhoneNumberOf, getMailOf, getCoursesBlockedBy, getWhatThisCourseBlocks, getAllCourses } from './helpers/jct/jct.js';

//const chatGPT = new ChatGPT(process.env.OPENAI_API_KEY , false)
const chatGPT = new ChatGPT(process.env.OPENAI_API_KEY, true)
//const unofficalGPT = new UnofficalGPT(process.env.UNOFFICALGPT_API_KEY)

const superuser = process.env.SUPERUSER ?? "";
const PRODUCTION = process.env.NODE_ENV === 'production';
const DEFAULT_COUNT_USER_TO_MUTE = 7;

let commands = {
    "!פינג": "בדוק אם אני חי",
    "!סטיקר": "צור סטיקר ממדיה או טקסט בקלות! (שלח '!סטיקר -עזרה' לפרטים נוספים)",
    "!יוטיוב": "שלח לי קישור לסרטון או טקסט לחיפוש ביוטיוב ואני אשלח לך אותו כקובץ אודיו לשמיעה",
    "!ברקוני": "קבל סטיקר רנדומלי של ברקוני",
    "!קופהראשית": "קבל סטיקר רנדומלי של קופה ראשית",
    "!תרגם": "תרגם את הטקסט בהודעה המצוטטת או את הטקסט לאחר הפקודה",
    "!גוגל": "קבל קישור לחיפוש בגוגל לטקסט בהודעה המצוטטת או לטקסט לאחר הפקודה",
    "!השתק": "השתק את הקבוצה לפי זמן מסוים",
    "!בטלהשתקה": "בטל השתקה (מנהלים בלבד)",
    "!כולם": "תייג את כל המשתמשים בקבוצה (מנהלים בלבד)",
    "!חסוםקישורים": "חסום קישורים בקבוצה (מנהלים בלבד)",
    "!בטלחסימתקישורים": "בטל חסימת קישורים בקבוצה (מנהלים בלבד)",
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
    let id = msg.key.remoteJid || "";
    let caption = msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
    let textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    caption = caption.trim();
    textMsg = textMsg.trim();

    // send ACK
    sock.readMessages([msg.key])

    // print to console
    let groupName;
    if (id.endsWith("@g.us")) {
        groupName = GLOBAL.groupConfig?.[id]?.name;
        if (!groupName) {
            let groupMetadata = await GLOBAL.sock.groupMetadata(id)
            groupName = groupMetadata.subject;
            GLOBAL.groupConfig[id] = {
                ...GLOBAL.groupConfig[id], // if exists
                name: groupMetadata.subject,
                countUsersToMute: DEFAULT_COUNT_USER_TO_MUTE > groupMetadata.participants.length
                    ? groupMetadata.participants.length - 1 // -1 for the bot
                    : DEFAULT_COUNT_USER_TO_MUTE
            };
        }

        // block links
        if (isIncludeLink(caption) || isIncludeLink(textMsg)) {
            if (GLOBAL.groupConfig[id]?.blockLinks) {
                console.log("blocking link:", caption || textMsg);
                // check if bot is admin
                let groupData = await sock.groupMetadata(id);
                let participant = groupData.participants;
                let bot = participant.find(p => sock.user.id.includes(p.id.slice(0, p.id.indexOf("@"))));

                if (bot.admin) {
                    // check if sender is admin
                    let sender = participant.find(p => msg.key.participant === p.id);
                    console.log("sender:", sender);
                    if (!sender?.admin) {
                        // check if warned before
                        if (GLOBAL.groupConfig[id]?.blockLinksUser?.includes(msg.key.participant)) {
                            // delete msg
                            sendCustomMsgQueue(id, { delete: msg.key });

                            // // remove user from warned list
                            // GLOBAL.groupConfig[id].blockLinksUser = GLOBAL.groupConfig[id].blockLinksUser.filter(u => u !== msg.key.participant);

                            // kick user
                            return sendCustomMsgQueue(id, { text: "זו לא פעם ראשונה שאתה שולח קישורים כאן!\nביי ביי" })
                                // kick user
                                .then(msgQueue.add(async () => await GLOBAL.sock.groupParticipantsUpdate(id, [msg.key.participant], "remove")));
                        }
                        else {
                            // create warned list if not exists
                            GLOBAL.groupConfig[id].blockLinksUser ??= [];
                            // add user to warned list
                            GLOBAL.groupConfig[id].blockLinksUser.push(msg.key.participant);
                            // delete msg
                            sendCustomMsgQueue(id, { delete: msg.key });
                            // send warning
                            return sendCustomMsgQueue(id, { text: "*הקישורים אסורים כאן!*\nבפעם הבאה תהיה ענישה ותועף מהקבוצה" });
                        }
                    }
                }
                else {
                    // if bot is not admin, unblock links
                    GLOBAL.groupConfig[id].blockLinks = false;
                    GLOBAL.groupConfig[id].blockLinksUser = [];
                }
            }
        }
    }

    let bodymsg = caption || textMsg || msg.message?.reactionMessage?.text;
    groupName
        ? console.log(`${msg.pushName} in (${groupName}) - ${bodymsg}`)
        : console.log(`${msg.pushName} (private) - ${bodymsg}`)


    // early check if action need to be done
    // reaction message
    if (msg.message?.reactionMessage) {
        //console.log(msg.message.reactionMessage)

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
        if (reactionsCount >= GLOBAL.groupConfig?.[id]?.countUsersToMute ?? DEFAULT_COUNT_USER_TO_MUTE) {
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

        if (TYQueue.size > 0) sendMsgQueue(id, "מקומך בתור: " + TYQueue.size + "\nאנא המתן...");
        return TYQueue.add(async () => await downloadTYoutubeVideo(id, video.id));
    }
    // set group config
    let stage = info.setSettingDialog(msg);
    if (stage !== undefined && !id.endsWith("@g.us"))
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
        return BarkuniSticker(msg, superuser);

    /**#########
     * Kupa Rashit
     ########## */
    if (textMsg.startsWith("!קופה ראשית") || textMsg.startsWith("!קופהראשית"))
        return KupaRashitSticker(msg, superuser);


    /**#########
     * TRANSLATE
     * ##########*/
    if (textMsg.startsWith("!translate") || textMsg.startsWith("!תרגם")) {
        textMsg = textMsg.replace("!translate", "").replace("!תרגם", "").trim();

        // get target language
        let { lang, text } = getTargetlanguage(textMsg);

        // check if has quoted message
        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            let quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || "";
        }
        if (!text) return sendCustomMsgQueue(id, { text: "לא נמצא טקסט לתרגום" });

        translate(text, lang)
            .then(res => {
                sendCustomMsgQueue(id, { text: res.text });
            })
            .catch(err => {
                sendCustomMsgQueue(id, { text: "שגיאה בתרגום" });
                errorMsgQueue(err)
            });
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
            let linkMsg = textSearch.length === 0
                ? "https://www.google.com/search?q=" + encodeURIComponent(quotedText.trim())
                : "https://www.google.com/search?q=" + encodeURIComponent(textSearch);
            textToSend = "גוגל הוא חבר נהדר! למה שלא ננסה לשאול אותו?\n" + linkMsg;

        }
        else {
            let linkMsg = textSearch.length === 0
                ? "https://giybf.com/"
                : "https://www.google.com/search?q=" + encodeURIComponent(textSearch);
            textToSend = "גוגל הוא חבר נהדר! כדאי לנו לשאול אותו!\n" + linkMsg;
        }
        return sendMsgQueue(id, textToSend);
    }

    /**##########
     * MUTE GROUP
     * ##########*/
    if (textMsg.startsWith("!mute") || textMsg.startsWith("!השתק")) {

        if (!msg.key.remoteJid.includes("@g.us"))
            return sendMsgQueue(id, "הפקודה זמינה רק בקבוצה");

        let groupData = await sock.groupMetadata(id);
        let participant = groupData.participants;

        // check if the bot is admin
        let bot = participant.find(p => sock.user.id.includes(p.id.slice(0, p.id.indexOf("@"))));
        console.log(bot);
        if (!bot?.admin)
            return sendMsgQueue(id, "אני צריך להיות מנהל בקבוצה כדי שהפקודה תוכל לפעול");

        // get mute time
        let muteTime = textMsg.replace("!mute", "").replace("!השתק", "").trim();
        let muteTime_min = parseInt(muteTime);
        if (muteTime.length === 0 || isNaN(muteTime_min))
            return sendMsgQueue(id, "יש להכניס מספר (בדקות) לאחר שליחת הפקודה");

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
                text: `*מזה יש כאן בלאגן?*\n` +
                    `@${phoneOfSender} רוצה להשתיק את הקבוצה למשך ${timeToMute} דקות...\n` +
                    `ברגע ש${GLOBAL.groupConfig?.[id]?.countUsersToMute ?? DEFAULT_COUNT_USER_TO_MUTE} אנשים יסכימו איתו ויגיבו על ההודעה הזאת בלייק, הקבוצה תושתק.\n` +
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
    if (textMsg.startsWith("!unmute") || textMsg.startsWith("!בטלהשתק")) {
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
        return sendMsgQueue(id, "הקבוצה פתוחה");
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
        return sendMsgQueue(msg.key.participant, getGroupConfig(id) + "\nמתחיל בעריכה:\nהכנס את מספר המשתמשים להשתקה");
    }

    // BLOCK LINKS
    if (textMsg.startsWith("!blocklinks") || textMsg.startsWith("!חסוםקישורים")) {
        if (!msg.key.remoteJid.includes("@g.us"))
            return sendMsgQueue(id, "הפקודה זמינה רק בקבוצות");

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
            return sendMsgQueue(id, "הפקודה זמינה רק למנהלים");

        // check if the group is already blocked
        if (GLOBAL.groupConfig?.[id]?.blockLinks)
            return sendMsgQueue(id, "הקבוצה כבר חסומה משליחת קישורים");

        // block links
        if (!GLOBAL.groupConfig[id]) GLOBAL.groupConfig[id] = {};

        GLOBAL.groupConfig[id].blockLinks = true;
        return sendMsgQueue(id, "הקבוצה חסומה משליחת קישורים");
    }

    // UNBLOCK LINKS
    if (textMsg.startsWith("!unblocklinks") || textMsg.startsWith("!בטלחסימתקישורים")) {
        if (!msg.key.remoteJid.includes("@g.us"))
            return sendMsgQueue(id, "הפקודה זמינה רק בקבוצות");

        let groupData = await sock.groupMetadata(id);
        let participant = groupData.participants;

        // check if the bot is admin
        let bot = participant.find(p => sock.user.id.includes(p.id.slice(0, p.id.indexOf("@"))));
        console.log(bot);
        if (!bot?.admin)
            return sendMsgQueue(id, "אני צריך להיות מנהל בקבוצה על מנת שהפקודה תוכל לפעול");

        // check if the sender is admin
        let sender = participant.find(p => p.id === msg.key.participant);
        console.log(sender);
        if (!sender.admin)
            return sendMsgQueue(id, "הפקודה זמינה רק למנהלים");

        // check if the group is already unblocked
        if (!GLOBAL.groupConfig?.[id]?.blockLinks)
            return sendMsgQueue(id, "הקבוצה כבר מותרת לשלוח קישורים");

        // unblock links
        if (!GLOBAL.groupConfig[id]) GLOBAL.groupConfig[id] = {};

        GLOBAL.groupConfig[id].blockLinks = false;
        return sendMsgQueue(id, "הקבוצה מותרת לשלוח קישורים");
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
     *    JCT
     * ##########*/
    if (textMsg.includes("מייל של ")) {
        return getMailOf(id, textMsg.slice(textMsg.indexOf("מייל של") + 7).trim())
    }

    if (textMsg.includes("מספר של ")) {
        return getPhoneNumberOf(id, textMsg.slice(textMsg.indexOf("מספר של") + 8).trim())
    }

    if (textMsg.includes("טלפון של ")) {
        return getPhoneNumberOf(id, textMsg.slice(textMsg.indexOf("טלפון של") + 9).trim())
    }

    // you can't do this course because ... (the missing courses)
    if (textMsg.includes("חוסם את ") || textMsg.includes("קדם של ")) {
        let query = textMsg.includes("חוסם את ") ? textMsg.slice(textMsg.indexOf("חוסם את") + 8): textMsg.slice(textMsg.indexOf("קדם של") + 7);
        return getCoursesBlockedBy(id, query.replace(/\?/g, "").trim())
    }

    // this course is blocking ... (the following courses)
    if (textMsg.includes("חסום על ידי ") || textMsg.includes("חסומים על ידי ")) {
        let query = textMsg.includes("חסום על ידי ") ? textMsg.slice(textMsg.indexOf("חסום על ידי") + 11): textMsg.slice(textMsg.indexOf("חסומים על ידי") + 13);
        return getWhatThisCourseBlocks(id, query.replace(/\?/g, "").trim())
    }

    // get all courses
    if (textMsg.startsWith("כל הקורסים")) {
        return getAllCourses(id)
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
    if (textMsg.includes("!גבטה") || textMsg.includes("!gpt")) {
        if (!GLOBAL.canAskGPT(id))
            return sendMsgQueue(id, "יותר מידי שאלות בזמן קצר... נסה שוב מאוחר יותר\n"
                // + "תוכלו להסיר את ההגבלה על ידי תרומה לבוט:\n"
                // + "https://www.buymeacoffee.com/BabiBot\n"
                // + "https://payboxapp.page.link/C43xQBBdoUAo37oC6"
            );


        const text = textMsg.replace("!gpt", "").replace("!גבטה", "").trim();
        if (!text) return;

        return chatGPT.ask3_5(text + '\n')
            .then(res => {
                console.log(res?.choices?.[0] || res.error);
                let returnText = res.choices[0].message.content.trim(); // should throw error if not exist
                sendMsgQueue(id, returnText)
            })
            .catch(err => {
                console.error(err);
                errorMsgQueue(err)
                sendMsgQueue(id, "אופס... חלה שגיאה\nנסה לשאול שוב")
            });
    }

    // get image from GPT
    if (textMsg.includes("!image") || textMsg.includes("!תמונה")) {
        return sendMsgQueue(id, "שירות יצירת תמונה לא זמין כרגע\nהאם התכוונת ל'!סטיקר'?")
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


        // get num from message
        let numMsgToLoad = parseInt(textMsg.match(/\d+/g)?.[0] || 50);

        //let history = await store.loadMessages(id, numMsgToLoad);
        return MemoryStore.loadMessages(id, numMsgToLoad)
            .then(async (history) => {
                history.pop(); // we don't want the last message (the one we got now)
                console.log('history length loaded:', history.length);

                if (history.length < 1)
                    return sendMsgQueue(id, "לא מצאתי היסטוריה עבור שיחה זו")

                let res = await chatGPT.tldr(history)
                return sendMsgQueue(id, res);
            })

            .catch(error => {
                console.error(error);
                errorMsgQueue(error);
                return sendMsgQueue(id, "אופס... חלה שגיאה\nנסה לשאול שוב")
            })

    }

    // stt - speech to text
    if (textMsg.includes("!stt") || textMsg.includes("!טקסט") || textMsg.includes("!תמלל")) {
        if (!GLOBAL.canAskGPT(id))
            return sendMsgQueue(id, "יותר מידי שאלות בזמן קצר... נסה שוב מאוחר יותר\n"
                // + "תוכלו להסיר את ההגבלה על ידי תרומה לבוט:\n"
                // + "https://www.buymeacoffee.com/BabiBot\n"
                // + "https://payboxapp.page.link/C43xQBBdoUAo37oC6"
            );

        return chatGPT.stt(msg)
    }

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
        return chatGPT.stt(msg);
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
 * @param {String} str
 * @returns {Boolean} 
 */
function isIncludeLink(str) {
    str = str.toLowerCase();
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
    if (GLOBAL.groupConfig?.[id]?.countUsersToMute)
        msgToSend += `*מספר משתתפים להשתקה:* ${GLOBAL.groupConfig?.[id]?.countUsersToMute}\n`;
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

/**
 * 
 * @param {string} text 
 */
function getTargetlanguage(text) {
    text = text.toLowerCase();

    let words = text.split(" ");
    let [w1, w2, ...rest] = words;

    // first word is the target language
    if (w1.startsWith("en")) return { lang: "en", text: w2 ? w2 + " " + rest.join(" ") : "" };
    if (w1.startsWith("he")) return { lang: "he", text: w2 ? w2 + " " + rest.join(" ") : "" };

    if (w1.includes("אנגלית")) return { lang: "en", text: text.replace(/.*אנגלית/, "").trim() };
    if (w1.includes("עברית")) return { lang: "he", text: text.replace(/.*עברית/, "").trim() };

    // first word is "to"
    if (w1 == "to") {
        if (w2.startsWith("en")) return { lang: "en", text: rest.join(" ") };
        if (w2.startsWith("he")) return { lang: "he", text: rest.join(" ") };
    }

    // default
    return { lang: "iw", text: text };
}