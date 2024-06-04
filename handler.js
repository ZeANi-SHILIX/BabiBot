import dotenv from 'dotenv';
dotenv.config();
import noteHendler from './helpers/noteHandler.js';
import BarkuniSticker from './helpers/berkuniHandler.js';
import KupaRashitSticker from './helpers/kupaRashitHandler.js';
import sendSticker from './helpers/stickerMaker.js';
import { DownloadV2, DownloadVideoMP4, downloadTYoutubeVideo, handlerQueueYTDownload } from './helpers/downloader.js';
import { GLOBAL } from './src/storeMsg.js';
import MemoryStore from './src/memorystore.js';
import messageRetryHandler from './src/retryHandler.js'; // can be removed
import ChatGPT from './helpers/chatgpt.js';
import UnofficalGPT from './helpers/unofficalGPT.js';
import { info } from './helpers/globals.js';
import fetch from 'node-fetch';
import fs from 'fs';
import { getMsgType, MsgType } from './helpers/msgType.js';
import { errorMsgQueue, msgQueue, sendCustomMsgQueue, sendMsgQueue, TYQueue } from './src/QueueObj.js';
import translate, { languages } from './custom_modules/Translate.js';
import {
    getPhoneNumberOf, getMailOf, saveMailsListToFile, downloadFileAsPDF,
    getCoursesBlockedBy, getWhatThisCourseBlocks, getAllCourses, updateCourses
} from './helpers/jct/jct.js';
import { AllCommands } from './commands.js';
import { exec } from 'child_process';


//const chatGPT = new ChatGPT(process.env.OPENAI_API_KEY , false)
const chatGPT = new ChatGPT(process.env.OPENAI_API_KEY, true)
const unofficalGPT = new UnofficalGPT(process.env.UNOFFICALGPT_API_KEY)

const superuser = process.env.SUPERUSER ?? "";
const PRODUCTION = process.env.NODE_ENV === 'production';
const DEFAULT_COUNT_USER_TO_MUTE = 7;

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
    caption = caption.replace(new RegExp(String.fromCharCode(160), "g"), " ").trim();
    textMsg = textMsg.replace(new RegExp(String.fromCharCode(160), "g"), " ").trim();

    // update the bot without updating npm packages
    if (id.includes(superuser)) {
        if (textMsg.startsWith("!update") || textMsg.startsWith("!עדכן")) {
            // pull from git
            exec('git pull', async (err, stdout, stderr) => {
                if (err) {
                    console.error(err);
                    return;
                }
                if (stdout.includes("Already up to date.")) sendMsgQueue(id, "Already up to date.");
                else {
                    await sendMsgQueue(id, stdout + "\nUpdated successfully! Restarting the bot...");
                    process.exit(0); // pm2 will restart the bot
                }
            });
        }
    }


    // send ACK
    await sock.readMessages([msg.key])
    await sleep(Math.random() * 4000 + 2000); // 2-6 seconds

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
        if ((textMsg.startsWith("תזכורת עומר"))){
            if ("הוספה")
                return info.addOmerReminder(id, textMsg);
            if ("מחיקה")
            return info.deleteOmerReminder(id);
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
                            return sendCustomMsgQueue(id, {
                                text: "*הקישורים אסורים כאן!*"
                                //"זו לא פעם ראשונה שאתה שולח קישורים כאן!\nביי ביי"
                            })
                                // kick user
                                .then(msgQueue.add(async () => {
                                    GLOBAL.sock.groupParticipantsUpdate(id, [msg.key.participant], "remove").then(info => {
                                        console.log("kick user:", info);
                                    }).catch(err => {
                                        console.error("failed to kick user:", err);
                                    });
                                }));
                        }
                        else {
                            // create warned list if not exists
                            GLOBAL.groupConfig[id].blockLinksUser ??= [];
                            // add user to warned list
                            GLOBAL.groupConfig[id].blockLinksUser.push(msg.key.participant);
                            // delete msg
                            sendCustomMsgQueue(id, { delete: msg.key });
                            // send warning
                            return sendCustomMsgQueue(id, {
                                text: "*הקישורים אסורים כאן!*"
                                // \nבפעם הבאה תהיה ענישה ותועף מהקבוצה"
                            });
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

    // print to console
    let { type, mime } = getMsgType(msg);
    let bodymsg = caption || textMsg || msg.message?.reactionMessage?.text || type;
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
        //TYQueue.add(async () => await downloadTYoutubeVideo(id, video.id));
        TYQueue.add(async () => await handlerQueueYTDownload(id, video.id));
        return;
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
                    "option 4",
                    "option 5",
                    "option 6",
                    "option 7",
                    "option 8",
                    "option 9",
                    "option 10",
                    "option 11",
                    "option 12" //max 12 options
                ],
                selectableCount: 3,
            }
        })
        console.log(poll)

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

        return sendCustomMsgQueue(id, { text: quoteAll, mentions: members });
    }

    /**#########
     * STICKER
     ########## */
    if (caption.startsWith('!sticker') || caption.startsWith('!סטיקר') ||
        textMsg.startsWith('!sticker') || textMsg.startsWith('!סטיקר') ||
        caption.startsWith('!מדבקה') || textMsg.startsWith('!מדבקה'))
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

        return translate(text, lang)
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

            let botMsg = await sock.sendMessage(id, {
                text: `*מזה יש כאן בלאגן?*\n` +
                    `@${phoneOfSender} רוצה להשתיק את הקבוצה למשך ${muteTime_min} דקות...\n` +
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

        return noteHendler.saveNote(msg);
    }

    // save global notes
    if (textMsg.startsWith('!Gsave') || textMsg.startsWith('!גשמור')) {
        if (!mongo.isConnected)
            return sendMsgQueue(id, "אין חיבור למסד נתונים");

        let issuperuser = false;
        if (msg.key.remoteJid?.includes(superuser) || msg.key.participant?.includes(superuser))
            issuperuser = true;

        return noteHendler.saveNote(msg, true, issuperuser);
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

    if (textMsg.startsWith("!עדכוןמיילים")) {
        return saveMailsListToFile()
            .then(() => {
                console.log("mails list updated")
                sendMsgQueue(id, "המיילים עודכנו בהצלחה")
            })
            .catch((error) => {
                sendMsgQueue(id, "אופס... חלה שגיאה בעדכון המיילים")
                errorMsgQueue(error)
            });
    }

    if (textMsg.startsWith("!עדכוןקורסים")) {
        return updateCourses()
            .then(() => {
                sendMsgQueue(id, "הקורסים עודכנו בהצלחה")
            })
            .catch((error) => {
                sendMsgQueue(id, "אופס... חלה שגיאה בעדכון הקורסים")
                errorMsgQueue(error)
            })
    }

    let query;
    // you can't do this course because ... (the missing courses)
    if (textMsg.includes("חוסם את ")) {
        query = textMsg.slice(textMsg.indexOf("חוסם את") + 8);
    } else if (textMsg.includes("חוסמים את ")) {
        query = textMsg.slice(textMsg.indexOf("חוסמים את") + 10);
    } else if (textMsg.includes(" קדם של ")) {
        query = textMsg.slice(textMsg.indexOf("קדם של") + 8);
    }
    if (query) return getCoursesBlockedBy(id, query.replace(/\?/g, "").trim())

    // this course is blocking ... (the following courses)
    // match חסום ע"י אינפי, נחסם על ידי אינפי, etc
    // extract the course name or undefined
    query = textMsg.match(/(חסום|נחסם|חסומים) (על ידי|ע[״"']{0,2}י) (.*)/)?.[3];
    // match מה אינפי חוסם
    query = query || textMsg.match(/מה (.*) חוסם/)?.[1];
    if (query) return getWhatThisCourseBlocks(id, query.replace(/\?/g, "").trim())


    // get all courses
    if (textMsg.startsWith("כל הקורסים")) {
        return getAllCourses(id)
    }

    // used when dowlnoading file from LevNet
    if (textMsg.startsWith("!pdf")) {
        let customName = textMsg.replace("!pdf", "").trim();
        let qoutedMsg = await MemoryStore.loadMessage(id, msg.message?.extendedTextMessage?.contextInfo?.stanzaId);
        if (!qoutedMsg) return sendMsgQueue(id, "יש לצטט הודעה");
        return downloadFileAsPDF(qoutedMsg, customName);
    }
    if (msg.message?.documentWithCaptionMessage?.message?.documentMessage?.caption?.startsWith("!pdf")) {
        let customName = msg.message?.documentWithCaptionMessage?.message?.documentMessage?.caption.replace("!pdf", "").trim();
        return downloadFileAsPDF(msg, customName);
    }



    // reply with plesure to "תודה"
    if (textMsg.includes("תודה")) {
        let numberSocket = sock.user.id.slice(0, sock.user.id.indexOf(":"));
        // Check if replied to the bot.
        if (msg.message.extendedTextMessage?.contextInfo?.participant.startsWith(numberSocket)) {
            return sendMsgQueue(id, "בשמחה! תמיד שמח לעזור🤗")
        }
    }

    // ## NEED IMPROVE ##
    /**##########
     *  ChatGPT
     * ##########*/
    if (textMsg.includes("!גבטה") || textMsg.includes("!gpt")) {
        return sendMsgQueue(id, "שירות ChatGPT לא זמין כרגע")
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
        if (GLOBAL.unofficialGPTcredit && GLOBAL.unofficialGPTcredit < 10)
            return sendMsgQueue(id, "נגמרו להיום הקרדיטים לשימוש בשירות זה\nנסה שוב מחר");

        // get num from message
        let numMsgToLoad = parseInt(textMsg.match(/\d+/g)?.[0] || 50);
        if (numMsgToLoad > 1000) {
            return sendMsgQueue(id, "שגיאה: יותר מדי הודעות")
        }

        //let history = await store.loadMessages(id, numMsgToLoad);
        return MemoryStore.loadMessages(id, numMsgToLoad + 1)
            .then(async (history) => {
                console.log('history length loaded:', history.length);

                if (history.length < 1)
                    return sendMsgQueue(id, "לא מצאתי היסטוריה עבור שיחה זו")
                history = history.sort((a, b) => a.messageTimestamp - b.messageTimestamp);

                history.pop(); // remove the last message (the command itself)

                let res = await unofficalGPT.tldr(history);
                console.log(JSON.stringify({
                    model: res.model,
                    usage: res?.usage?.total_tokens,
                    response: res.choices?.[0].message.content.trim()
                }, null, 2) || res);

                GLOBAL.updateUnofficialGPTcredit(res?.usage.total_tokens, res.model);
                return sendMsgQueue(id, (await translate(res.choices[0].message.content.trim())).text);
            })

            .catch(error => {
                console.error(error);
                errorMsgQueue(error);
                return sendMsgQueue(id, "אופס... חלה שגיאה\nנסה לשאול שוב")
            })

    }

    if (textMsg.includes("!summery") || textMsg.includes("!סכם")) {
        return sendMsgQueue(id, "שירות ChatGPT לא זמין כרגע")
        if (!GLOBAL.canAskGPT(id))
            return sendMsgQueue(id, "יותר מידי שאלות בזמן קצר... נסה שוב מאוחר יותר\n"
                // + "תוכלו להסיר את ההגבלה על ידי תרומה לבוט:\n"
                // + "https://www.buymeacoffee.com/BabiBot\n"
                // + "https://payboxapp.page.link/C43xQBBdoUAo37oC6"
            );

        if (!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage)
            return sendMsgQueue(id, "יש להגיב על הודעה עם הטקסט שברצונך לסכם");

        // get qouted message
        let quotedMsg = await MemoryStore.loadMessage(id, msg.message.extendedTextMessage.contextInfo.stanzaId);
        if (!quotedMsg)
            return sendMsgQueue(id, "לא מצאתי את ההודעה שהגבת עליה, נסה להגיב על ההודעה שוב בעוד כמה שניות");

        // when audio, convert to text and summery
        if (type == MsgType.AUDIO) {
            return chatGPT.stt(msg).then(res => {
                if (!res) return sendMsgQueue(id, "לא הצלחתי להמיר את הקול לטקסט");

                chatGPT.summery(res).then(res => {
                    if (!res) sendMsgQueue(id, "לא הצלחתי לסכם את ההודעה");
                    else sendMsgQueue(id, res);
                })
            })
        }

        // if not text, skip
        if (type !== MsgType.TEXT) return sendMsgQueue(id, "לא מצאתי טקסט בהודעה שהגבת עליה");

        let text = quotedMsg.message?.conversation || quotedMsg.message?.extendedTextMessage?.text;
        if (!text) return sendMsgQueue(id, "לא מצאתי טקסט בהודעה שהגבת עליה");

        if (text.length < 250) return sendMsgQueue(id, "הטקסט קצר מדי, אל תתעצל ותקרא אותו בעצמך 😜");

        return chatGPT.summery(text).then(res => {
            if (!res) sendMsgQueue(id, "לא הצלחתי לסכם את ההודעה");
            else sendMsgQueue(id, res);
        })
    }

    // stt - speech to text
    if (textMsg.includes("!stt") || textMsg.includes("!טקסט") || textMsg.includes("!תמלל")) {
        let userID = id.endsWith("@g.us") ? msg.key.participant : id;
        if (GLOBAL.canIUseOpenAI(userID) || userID.includes(superuser)) {
            return sendCustomMsgQueue(id, { react: { text: '⏳', key: msg.key } })
                .then(() => chatGPT.stt(msg))
                .then(() => sendCustomMsgQueue(id, { react: { text: '', key: msg.key } }))
        }

        return sendMsgQueue(id, "שירות התמלול זמין רק למי שתרם לבוט\n"
            + "תוכלו לקבל מידע על איך תורמים באמצעות הפקודה '!תרומה'\n"
            + "אם תרמת כבר ועדיין לא עובד, אנא צור קשר עם המפתח.");
    }

    /**#######
     * YOUTUBE
     #########*/
    if ((textMsg.startsWith("!youtube") || textMsg.startsWith("!יוטיוב"))) {
        // return sendMsgQueue(id, "שירות הורדת קובץ שמע מיוטיוב לא זמין כרגע."
        //     + "\nניתן להשתמש בפקודה '!סרטון' להורדת סרטונים מיוטיוב"
        //     + "\nאו לחילופין להשתמש בשירותים אחרים כמו t.me/Musicvideobybot");
        return DownloadV2(msg);
    }

    if ((textMsg.startsWith("!video") || textMsg.startsWith("!Video")
        || textMsg.startsWith("!וידאו") || textMsg.startsWith("!סרטון"))) {
        //return sendMsgQueue(id, "שירות יוטיוב לא זמין כרגע");
        return DownloadVideoMP4(id, textMsg);
    }



    /**######
     *  MISC
     * ######*/
    // if the bot got mentioned
    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
        let mentionedJids = msg.message.extendedTextMessage.contextInfo.mentionedJid;
        const SOCK_NUM = GLOBAL.sock.user.id.split(":")[0].split("@")[0];
        if (mentionedJids.some(jid => jid.startsWith(SOCK_NUM)))
            return sendMsgQueue(id, "היי אני באבי בוט, מישהו קרא לי?\nשלחו לי את הפקודה '!פקודות' כדי שאני אראה לכם מה אני יודע לעשות");
    }

    // commands list
    const helpCommand = ["help", "command", "עזרה", "פקודות", "תפריט"];

    //in group
    if (msg.key.remoteJid.includes("@g.us") && helpCommand.some(com => textMsg.includes("!" + com))) {
        return sendCommandsList(id);
    }
    // in private
    if (!msg.key.remoteJid.includes("@g.us") && helpCommand.some(com => textMsg.includes(com))) {
        return sendCommandsList(id);
    }

    /**########
     *   INFO
     ##########*/

    if (textMsg.startsWith("!info") || textMsg.startsWith("!מידע") || textMsg.includes("!אודות")) {
        let text = "*מידע על הבוט:*\n\n" +
            "לידעתכם, ההודעות שנשלחות לבוט אינן חסויות לגמריי, ולמפתח יש גישה לראותן.\n" +
            "אל תשלחו מידע רגיש לבוט.\n\n" +
            "*השימוש בבוט מהווה הסכמה לכך שהמפתח יכול להשתמש בהודעות שנשלחו לבוט לצורך פיתוח ושיפור הבוט.*\n\n" +

            "על מנת לראות מה הבוט מסוגל לעשות יש לשלוח את הפקודה '!פקודות'\n" +
            "(הבוט בתהליכי בנייה... רשימת הפקודות איננה סופית!)\n" +
            "מוזמנים להפיץ ולהשתמש להנאתכם!!\n\n" +
            "בוט זה נוצר על ידי שילה בבילה\n" +
            "ליצירת קשר:\n" +
            "t.me/ContactMeSBbot\n" +
            "למידע על איך תורמים לפרוייקט שלחו את הפקודה '!תרומה' בפרטי לבוט.";

        return sendMsgQueue(id, text);
    }

    if (textMsg.startsWith("!תרומה") || textMsg.startsWith("!donate") || textMsg.startsWith("!donation") || textMsg.startsWith("!תרומות")) {
        // if sender is superuser
        if (id.includes(superuser)) {
            let [donation, phone] = textMsg.split(" ").slice(1);
            if (donation && phone && !isNaN(donation) && !isNaN(phone)) {
                phone = phone.startsWith("972") ? +phone : "972" + +phone;
                let jid = phone + "@s.whatsapp.net";

                if (!GLOBAL.sock.onWhatsApp([jid])) {
                    return sendMsgQueue(id, "מספר הטלפון אינו תקין");
                }
                if (donation < 1) {
                    return sendMsgQueue(id, "סכום התרומה צריך להיות גדול מ-0");
                }

                GLOBAL.updateBalanceOpenAI(jid, +donation);
                return sendMsgQueue(id, "התרומה נקלטה בהצלחה!\nהוזן סכום של " + donation + " דולר למשתמש " + phone);
            }
            else {
                return sendMsgQueue(id, "לא נמצאו פרטים לתרומה\nנא להזין את סכום התרומה (בדולרים) ולאחר מכן את מספר הטלפון");
            }
        }
        // normal user 
        else if (id.endsWith("@g.us")) {
            sendMsgQueue(id, "הפרטים נשלחו לפרטי");
            return sendDonationMsg(msg.key.participant);
        }
        return sendDonationMsg(id);
    }

    // ##############
    // ##############
    //  NOT IN GROUP - PRIVATE CHAT
    // ##############
    // ##############
    if (msg.key.remoteJid.includes("@g.us")) return;

    if (textMsg.startsWith("!יתרה") || textMsg.startsWith("!balance")) {
        if (id.includes(superuser)) {
            let phone = textMsg.split(" ")[1];
            if (phone && !isNaN(phone) && phone.length > 8) {
                phone = phone.startsWith("972") ? +phone : "972" + +phone;
                let jid = phone + "@s.whatsapp.net";

                if (!GLOBAL.sock.onWhatsApp([jid])) {
                    return sendMsgQueue(id, "מספר הטלפון אינו תקין");
                }

                let balance = GLOBAL.getBalanceOpenAI(jid);
                return sendMsgQueue(id, "היתרה של " + phone + " היא: " + balance + " דולר");
            }
            else {
                return sendMsgQueue(id, "לא נמצא מספר טלפון\nנא להזין את מספר הטלפון");
            }
        }
        return sendMsgQueue(id, "היתרה שלך היא: " + GLOBAL.getBalanceOpenAI(id) + " דולר");
    }


    // for supporter that donate more than 5$ - dont need to send the command in private chat
    if (type === MsgType.AUDIO) {
        if (GLOBAL.autoSTT(id) || id.includes(superuser))
            return sendCustomMsgQueue(id, { react: { text: '⏳', key: msg.key } })
                .then(() => chatGPT.stt(msg))
                .then(() => sendCustomMsgQueue(id, { react: { text: '', key: msg.key } }));
    }


    // if the bot got invited to a group
    if (msg.message?.groupInviteMessage) {
        sendMsgQueue(id, "אפשרות של צירוף באבי לקבוצות זמינה רק לתורמים.\n"
            + "לפרטים נוספים נא לשלוח '!תרומה' בפרטי לבוט");

        return sendMsgQueue(superuser + "@s.whatsapp.net", JSON.stringify({
            groupName: msg.message.groupInviteMessage.groupName,
            inviteCode: msg.message.groupInviteMessage.inviteCode,
            groupJid: msg.message.groupInviteMessage.groupJid,
            caption: msg.message.groupInviteMessage.caption,
            invitedBy: "wa.me/" + id.split("@")[0]
        }, null, 2));
    }

    // dev only
    if (id.includes(superuser) && textMsg.startsWith("!אשר")) {
        const inviteDetails = JSON.parse(msg.message?.extendedTextMessage?.text || "{}");
        if (!inviteDetails.groupJid) return sendMsgQueue(id, "לא נמצאו פרטי הזמנה");

        GLOBAL.sock.groupAcceptInvite(inviteDetails.inviteCode).then(() => {
            sendMsgQueue(id, "ההצטרפות לקבוצה " + inviteDetails.groupName + " בוצעה בהצלחה");
        }).catch((error) => {
            errorMsgQueue(error);
        });
    }

    return;
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

    for (let lang of languages) {
        let regex;
        if (w1 === lang.code) regex = new RegExp(`.*?${lang.code}`);
        if (w1.includes(lang.name1)) regex = new RegExp(`.*?${lang.name1}`);
        if (w1.includes(lang.name2)) regex = new RegExp(`.*?${lang.name2}`);
        if (w1 === lang.nickname || w1 === "ל" + lang.nickname) regex = new RegExp(`.*?${lang.nickname}`);

        if (w1 === "to") {
            if (w2 === lang.code) regex = new RegExp(`to .*?${lang.code}`, "i");
            if (w2.includes(lang.name1)) regex = new RegExp(`to .*?${lang.name1}`, "i");
            if (w2.includes(lang.name2)) regex = new RegExp(`to .*?${lang.name2}`, "i");
            if (w2 === lang.nickname) regex = new RegExp(`to .*?${lang.nickname}`, "i");
        }

        if (regex) {
            console.log(text.replace(regex, "").trim());
            return { lang: lang.code, text: text.replace(regex, "").trim() }
        }
    }

    // default
    return { lang: "iw", text: text };
}

function sendCommandsList(jid) {
    const showNumOfCommands = 8;

    let text = "היי! אני באבי בוט 🥹\nאני בוט חמוד שיכול לעשות המון דברים מגניבים!\n\n"
        + "הנה כמה דברים שאני יודע לעשות:"
        + "\n\nשימו לב שיש לכתוב סימן קריאה בתחילת ההודעה כדי להשתמש בפקודה.\nלדוגמא: !פינג\n\n"

    for (let i = 0; i < showNumOfCommands; i++) {
        const command = AllCommands.iw[i];
        text += `*${command.name}:* _${command.description}_\n`;
    }

    // info about the bot
    text += "*!אודות:* _לקבלת מידע על הבוט_\n";

    text += "\nלקריאת כל הפקודות בצורה נוחה: tinyurl.com/babibot"

    return sendMsgQueue(jid, text);
}

function sendDonationMsg(jid) {
    let text = "אוהבים את באבי בוט? 🥹\n"
        + "רוצים לתמוך בפרוייקט וגם לקבל יכולות נוספות?\n\n"
        + "תוכלו לתרום בקישורים הבאים:\n"
        + "https://www.buymeacoffee.com/BabiBot\n"
        + "https://payboxapp.page.link/C43xQBBdoUAo37oC6\n"
        + "על מנת לקבל את היכולות הנוספות - יש לשלוח צילום מסך של התרומה לטלגרם, ולציין גם את המספר טלפון שלכם,\n"
        + "ואני אפעיל את היכולות בהקדם האפשרי.\n"
        + "> לבוט בטלגרם: t.me/ContactMeSBbot\n"
        + "> לבירור יתרה יש לשלוח '!יתרה'\n\n"
        + "תודה רבה!";

    return sendMsgQueue(jid, text);
}
