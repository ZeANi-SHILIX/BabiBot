import { GLOBAL } from '../src/storeMsg.js';
import { sendCustomMsgQueue } from '../src/QueueObj.js';

import labelsDB from '../src/schemas/mentions.js';
import federationsDB from '../src/schemas/federations.js';

class Mentions {

    // all the commands available for the mentions feature
    #commands = {
        'create_label': {
            commandWords: ['create', 'צור', 'תצור'],
            func: this.createLabel,
            desc: "צור תג חדש לתיוג"
        },
        'delete_label': {
            commandWords: ['delete', 'מחק', 'תמחק'],
            func: this.deleteLabel,
            desc: "מחק תג"
        },
        'list_labels': {
            commandWords: ['list', 'רשימה'],
            func: this.getAllLabels,
            desc: "קבל את רשימת התוויות שאפשר לתייג בקבוצה זו"
        },
        'edit_label': {
            commandWords: ['edit', 'ערוך', 'שנה', 'תשנה'],
            func: this.editLabel,
            desc: "שנה את הטקסט המופיע עם התיוג באותה תווית"
        },
        'add_mention': {
            commandWords: ['add', 'הוסף', 'תוסיף'],
            func: this.addUserMention,
            desc: "הוסף תיוג שלך או של משתמשים אחרים לרשימה"
        },
        'remove_mention': {
            commandWords: ['remove', 'הסר', 'תסיר'],
            func: this.removeUserMention,
            desc: "הסר תיוג שלך או משתמשים אחרים מהרשימה"
        },
        'help_manual': {
            commandWords: ['help', 'עזרה', 'פקודות'],
            func: this.helpManual,
            desc: "למד מה אפשר לעשות עם התגים של באביבוט!"
        }
    }

    constructor() {
        // in format of { jid: { label: timestamp } }
        this.cooldowns = {};
    }

    /**
     * availability to mention a label after cooldown period
     * @param {string} jid groupchat id
     * @param {string} label label name
     */
    isCooldownOver(jid, label) {
        const waitPeriod = 5 * 1000 * 60; // 5 minutes (TODO adjust if necessary)
        const lastTime = mentions.cooldowns[jid]?.[label];
        const currentTime = Date.now();

        let isAvailable = lastTime ? (currentTime - lastTime) > waitPeriod : true;

        if (isAvailable) {
            mentions.cooldowns[jid][label] = currentTime;
        }

        return isAvailable;
    }

    /**
     * get the mentions
     * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
     */
    async getMentions(msg) {
        const jid = msg.key.remoteJid;

        // check if the message is in a group
        if (!jid.includes("@g.us"))
            return sendMsgQueue(id, "הפקודה זמינה רק בקבוצות");

        const textMsg = msg.message.conversation || msg.message.extendedTextMessage.text || "";
        const label = textMsg.split(" ")[0].replace("@", "").toLowerCase();

        // no label - do nothing
        if (label === "") return;

        // prevent frequent mentioning of the same label in chat
        if (!this.isCooldownOver(jid, label)) {
            sendMsgQueue(jid, `${label} כבר תוייג לפני מספר דקות.`);
        }

        if (label === "כולם" || label === "everyone") {
            let metadata = await GLOBAL.sock.groupMetadata(jid);

            // check if the user is admin
            let isAdmin = metadata.participants.find((user) => user.id === msg.key.participant).admin
                || msg.key.participant.includes(GLOBAL.superuser);
            if (!isAdmin) return sendCustomMsgQueue(jid, { text: "פקודה זו זמינה רק למנהלים" });

            // filter the users
            let users = metadata.participants.map((user) => user.id)
                .filter((user) => !user.includes(GLOBAL.sock.user.id.split("@")[0].split(":")[0]) // bot
                    && user !== msg.key.participant); // user who sent the message

            let text = `לכם @${msg.key.participant.replace("@s.whatsapp.net", "")} קורא להיאסף כדי שאף אחד לא יפספס!\n\n`;
            text += users.map((user) => `@${user.replace("@s.whatsapp.net", "")}`).join(" ");
            return sendCustomMsgQueue(jid, { text, mentions: users });
        }

        else if (label === "admin" || label === "מנהלים") {
            let metadata = await GLOBAL.sock.groupMetadata(jid);

            // filter the users
            let users = metadata.participants
                .filter((user) => user.admin // admins only
                    && !user.id.includes(GLOBAL.sock.user.id.split("@")[0].split(":")[0])) // not bot
                .map((user) => user.id);

            let text = users.map((user) => `@${user.replace("@s.whatsapp.net", "")}`).join(" ");
            return sendCustomMsgQueue(jid, { text, mentions: users });
            // TODO: add quoted message if exists
        }
        else {
            // get all labels
            let allLabels = await labelsDB.find({ label: label }, (err, res) => {
                if (err) throw err;
                console.log(res);
            });

            if (allLabels.length === 0) return //sendCustomMsgQueue(jid, { text: "תג זה לא קיים" });

            /** find *first* label */
            let tempLabel = allLabels.find(label => label.jid === jid)

            //if not found - search with the feder
            if (!tempLabel) {
                // get federations
                const federations = await this.getFederationsByJID(jid);
                tempLabel = allLabels.find(label => federations.some(feder => label.federation.includes(feder.federation)))
            }

            // if no label was found
            if (!tempLabel) return //sendCustomMsgQueue(jid, { text: "תג זה לא קיים" });


            // filter only users in the group
            const metadata = await GLOBAL.sock.groupMetadata(jid);

            // TODO: check if the user is admin?
            const admins = metadata.participants.filter((user) => user.admin);

            let users = metadata.participants.map((user) => user.id);
            users = tempLabel.users.filter((user) => users.includes(user));

            let text = tempLabel.text;
            text += "\n" + users.map((user) => `@${user.replace("@s.whatsapp.net", "")}`).join(" ");
            return sendCustomMsgQueue(jid, { text, mentions: users });
        }
    }

    /*#####################
        Label Management
    #######################*/

    /**
     * create a new label
     * @param {string} labelName
     * @param {string} text
     * @param {string} jid
     * @param {string[]} feders optional
     * @param {string[]} users optional
     */
    addLabel(labelName, text, jid, feders = [], users = []) {
        if (jid && labelName) {
            labelsDB.create({
                label: labelName, jid: jid, text: text, federation: feders, users: users
            }, (err, res) => {
                if (err) throw err;
                console.log(res);
            });
        }
    }

    /**
     * verify user permission to execute the command
     * @param {string} user
     * @param {string} federName
     */
    async isPermitted(user, federName) {
        let feder = await federationsDB.findOne({ federation: federName });
        return feder.authorizedUsers.includes(user);
    }

    async getFederationsByJID(jid) {
        return await federationsDB.find({ groups: { $in: [jid] } });
    }

    /**
     * handle label operations such as add, remove, edit, etc.
     * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
     * @example "!tag command labelName {-global federName} text"
     */
    async labelHandling(msg) {
        const jid = msg.key.remoteJid;

        // check if the message is in a group
        if (!jid.includes("@g.us"))
            return sendMsgQueue(id, "הפקודה זמינה רק בקבוצות");

        // need fix - each group can have multiple federations
        const feders = await this.getFederationsByJID(jid);

        const textMsg = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const msgComponents = textMsg.split(/[\n ]/);

        const requestedCommand = msgComponents[1].toLowerCase() || "";
        const labelName = msgComponents[2].toLowerCase() || "";

        let numCommandOptions = 3;

        // optional global
        let globalFeder = null;
        if (msgComponents.length >= 5 && (msgComponents[3] === "-גלובלי" || msgComponents[3] === "-global")) {
            globalFeder = msgComponents[4].toLowerCase();
            numCommandOptions += 2;
        }

        const msgMentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid
            ? msg.message.extendedTextMessage.contextInfo.mentionedJid // msg has mentions
            : [msg.key.participant ?? ""]; // no mentions - use the sender

        // additional text for label 
        const preText = msgComponents.slice(numCommandOptions).join(" ") + "\n" || "";

        const args = {
            participantJid: msg.key.participant,
            groupJid: jid,
            labelName,
            preText,
            globalFeder,
            feders,
            msgMentions
        }

        let responseMsg = "";
        let isSuccessful = false;

        for (const op of Object.keys(this.#commands)) {
            let currCommand = this.#commands[op]
            if (currCommand.commandWords.includes(requestedCommand)) {
                [isSuccessful, responseMsg] = currCommand.func(args);
                break;
            }
        };

        if (responseMsg === "") {
            responseMsg = "אופס, נראה שפקודה זאת לא קיימת...\n";
            responseMsg += "> לרשימת הפקודות הקיימות עבור תגים, שלחו *!תג -עזרה*"
        }

        return sendMsgQueue(jid, responseMsg)
    }

    /**
     * create a new label from mentions
    * @param {{ participantJid: string, groupJid: string, labelName: string, preText: string, globalFeder: string, 
    *           feders: { // all the federations the group (jid) is part of
    *               federation: string, groups: string[], authorizedUsers: string[]
    *           }[]
    *          }} args
    * @returns {Promise<[boolean, string]>}
    */
    async createLabel(args) {
        const { participantJid, groupJid, labelName, preText, globalFeder, feders } = args;

        if (!labelName) return [false, "אופס... נראה ששכחת לכתוב את שם התג"];

        // the user wants to create a global label
        if (globalFeder) {
            if (!this.isPermitted(participantJid, globalFeder)) return `פקודה זו זמינה רק למנהלי ${globalFeder}`

            const federObj = feders.find(feder => feder.federation === globalFeder);
            if (!federObj) return [false, `הפדרציה ${globalFeder} לא משוייכת לקבוצה הנוכחית`];

            let labelExists = await labelsDB.findOne({ label: labelName, federation: { $in: [globalFeder] } })
            if (labelExists) return [false, "תג זה כבר קיים"];

            this.addLabel(labelName, preText, null, [globalFeder])
        }
        // private label
        else {
            let tempLabel = await labelsDB.findOne({ label: labelName, jid: groupJid })
            if (tempLabel) return [false, "תג זה כבר קיים בקבוצה"];

            tempLabel = await labelsDB.findOne({ label: labelName, federation: { $in: feders.map(f => f.federation) } })
            if (tempLabel) return [false, "תג זה כבר קיים בפדרציה שמשוייכת לקבוצה"];

            this.addLabel(labelName, preText, groupJid)
        }

        return [true, `התג *${labelName}* נוצר בהצלחה!`]
    }

    /**
     * remove label from mentions for the group
    * @param {{ participantJid: string, groupJid: string, labelName: string, preText: string, globalFeder: string, 
    *           feders: { // all the federations the group (jid) is part of
    *               federation: string, groups: string[], authorizedUsers: string[]
    *           }[]
    *          }} args
    * @returns {Promise<[boolean, string]>}
    */
    async deleteLabel(args) {
        const { participantJid, groupJid, labelName, globalFeder, feders } = args;
        let reqLabel;
        if (globalFeder) {
            if (!this.isPermitted(participantJid, globalFeder)) return [false, `פקודה זו זמינה רק למנהלי ${globalFeder}`];

            const federObj = feders.find(feder => feder.federation === globalFeder);
            if (!federObj) return [false, `הפדרציה ${globalFeder} לא משוייכת לקבוצה הנוכחית`];

            reqLabel = await labelsDB.findOne({ label: labelName, federation: { $in: [globalFeder] } })
            if (reqLabel) {
                labelsDB.deleteOne({ _id: reqLabel._id }, (err, _) => {
                    if (err) throw err;
                });
            }
        }
        else {
            let metadata = await GLOBAL.sock.groupMetadata(groupJid);
            let isAdmin = metadata.participants.find((user) => user.jid === participantJid).admin
                || keyParticipant.includes(GLOBAL.superuser);
            if (!isAdmin) return [false, "פקודה זו זמינה רק למנהלים"];

            reqLabel = await labelsDB.findOne({ label: labelName, jid: groupJid })
            if (!reqLabel) return [false, "תג זה לא קיים בכלל"];
        }

        labelsDB.deleteOne({ _id: reqLabel._id }, (err, _) => {
            if (err) throw err;
        });

        return [true, `התג *${labelName}* נמחק בהצלחה!`];
    }

    /**
    * get all labels associated with the group
    * @param {{ participantJid: string, groupJid: string, labelName: string, preText: string, globalFeder: string, 
    *           feders: { // all the federations the group (jid) is part of
    *               federation: string, groups: string[], authorizedUsers: string[]
    *           }[]
    *          }} args
    * @returns {Promise<[boolean, string]>}
    */
    async getAllLabels(args) {
        const { groupJid, feders } = args;
        /* cant be duplicated labels in the list, because we not saving the jid for global labels */

        // get chat specific labels
        let labels = await labelsDB.find({ jid: groupJid });
        let labelString = labels.map(label => label.label).join("\n");

        feders.forEach(async feder => {
            // get labels by feder
            labels = await labelsDB.find({ federation: { $in: [feder.federation] } });
            // add to text
            labelString += `> תגים כללים של ${feder.federation}:\n`
            labelString += labels.map(label => label.label).join("\n")
        })

        if (labelString === "") {
            labelString = "אין עדיין תגים בקבוצה זו."
        }

        return [true, labelString]
    }

    /**
    * remove user mentions from label
    * @param {{ participantJid: string, groupJid: string, labelName: string, 
    *          preText: string, globalFeder: string, msgMentions: string[], 
    *           feders: { // all the federations the group (jid) is part of
    *               federation: string, groups: string[], authorizedUsers: string[]
    *           }[]
    *          }} args
    * @returns {Promise<[boolean, string]>}
    */
    async removeUserMention(args) {
        const { groupJid, labelName, globalFeder, feders, msgMentions } = args;

        if (!labelName) return [false, "אופס... נראה ששכחת לכתוב את שם התג"];

        let reqLabel = null;
        if (globalFeder) {

            const federObj = feders.find(feder => feder.federation === globalFeder);
            if (!federObj) return [false, `הפדרציה ${globalFeder} לא משוייכת לקבוצה הנוכחית`];

            reqLabel = await labelsDB.findOne({ label: labelName, federation: { $in: [globalFeder] } })
            if (!reqLabel) return [false, "תג זה לא קיים בפדרציה"];
        }
        else {
            reqLabel = await labelsDB.findOne({ label: labelName, jid: groupJid });
            if (!reqLabel) return [false, "תג זה לא קיים"];
        }

        const updatedUsers = reqLabel.users.filter(user => !msgMentions.includes(user))
        await labelsDB.findOneAndUpdate({ _id: reqLabel._id }, { users: updatedUsers });

        return [true, `המשתמש הוסר בהצלחה!`]
    }

    /**
     * add user mentions to label
    * @param {{ participantJid: string, groupJid: string, labelName: string, 
    *          preText: string, globalFeder: string, msgMentions: string[], 
    *           feders: { // all the federations the group (jid) is part of
    *               federation: string, groups: string[], authorizedUsers: string[]
    *           }[]
    *          }} args
    * @returns {Promise<[boolean, string]>}
    */
    async addUserMention(args) {
        const { groupJid, labelName, globalFeder, feders, msgMentions } = args;

        if (!labelName) return [false, "אופס... נראה ששכחת לכתוב את שם התג"];

        let reqLabel = null;
        if (globalFeder) {
            const federObj = feders.find(feder => feder.federation === globalFeder);
            if (!federObj) return [false, `הפדרציה ${globalFeder} לא משוייכת לקבוצה הנוכחית`];

            reqLabel = await labelsDB.findOne({ label: labelName, federation: { $in: [globalFeder] } })
            if (!reqLabel) return [false, "תג זה לא קיים בפדרציה"];
        }
        else {
            reqLabel = await labelsDB.findOne({ label: label, jid: groupJid });
            if (!reqLabel) return [false, "תג זה לא קיים"];
        }

        const addedUsers = msgMentions.filter(user => !reqLabel.users.includes(user))
            .concat(reqLabel.users);
        await labelsDB.findOneAndUpdate({ _id: reqLabel._id }, { users: addedUsers });

        return [true, `המשתמש נוסף בהצלחה!`];
    }

    /**
    * edit label text
    * @param {{ participantJid: string, groupJid: string, labelName: string, 
    *          preText: string, globalFeder: string, msgMentions: string[], 
    *           feders: { // all the federations the group (jid) is part of
    *               federation: string, groups: string[], authorizedUsers: string[]
    *           }[]
    *          }} args
    * @returns {Promise<[boolean, string]>}
    */
    async editLabel(args) {
        const { participantJid, groupJid, labelName, preText, globalFeder, feders } = args;
        if (!labelName) return [false, "אופס... נראה ששכחת לכתוב את שם התג"];

        var reqLabel = null;
        if (globalFeder) {
            if (!this.isPermitted(participantJid, globalFeder)) return [false, `פקודה זו זמינה רק למנהלי ${globalFeder}`];

            const federObj = feders.find(feder => feder.federation === globalFeder);
            if (!federObj) return [false, `הפדרציה ${globalFeder} לא משוייכת לקבוצה הנוכחית`];

            reqLabel = await labelsDB.findOne({ label: labelName, federation: { $in: [globalFeder] } })
            if (!reqLabel) return [false, "תג זה לא קיים בפדרציה"];
        }
        else {
            reqLabel = await labelsDB.findOne({ label: labelName, jid: groupJid });
            if (!reqLabel) return [false, "תג זה לא קיים"];
        }

        await labelsDB.findOneAndUpdate({ _id: reqLabel._id }, { text: preText });

        return [true, `התג *${labelName}* נערך בהצלחה!`]
    }

    /**
     * info about the labels feature and how to use it
     */
    async helpManual() {
        // TODO review and rewrite if necessary, add example
        let text = "*אודות התגים / התוויות של הבוט*\n" +
            "תיוגים קבוצתיים ונוחים בוואטסאפ!\n" +
            "תייג את כל האנשים הרלוונטים להודעה בקלות\n" +
            "`@תג`\n"
        "\n" +
            ":רשימת הפקודות עבור תגים"
        Object.keys(this.#commands).forEach(op => {
            /** @type {{commandWords: string[], func: Function, desc: string}} */
            let currCommand = this.#commands[op]
            text += `*${currCommand.commandWords[1]}*: ${currCommand[desc]}`;
            // TODO add rest of commandWords to text (optional, start with '> ')
        })

        return [true, text];
    }

}

export const mentions = new Mentions();