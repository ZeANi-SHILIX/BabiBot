import { GLOBAL } from '../src/storeMsg.js';
import { sendCustomMsgQueue } from '../src/QueueObj.js';

import labelsDB from '../src/schemas/mentions.js';
import federationsDB from '../src/schemas/federations.js';

class Mentions {

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

        const requestedCommand = msgComponents[1].toLowerCase();
        const labelName = msgComponents[2].toLowerCase();

        let numCommandOptions = 3;

        // optional global
        let globalFeder = null;
        if (msgComponents[3] === "-גלובלי" || msgComponents[3] === "-global") {
            globalFeder = msgComponents[4].toLowerCase();
            numCommandOptions += 2;
        }

        const msgMentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid
            ? msg.message.extendedTextMessage.contextInfo.mentionedJid // msg has mentions
            : [msg.key.participant ?? ""]; // no mentions - use the sender

        // additional text for label 
        const preText = msgComponents.slice(numCommandOptions).join(" ") + "\n" || "";

        const commands = {
            'create_label': {
                commandWords: ['create', 'צור', 'תצור'],
                func: this.createLabel,
                args: [msg.key.participant, jid, labelName, preText, globalFeder, feders],
                desc: "צור תג חדש לתיוג"
            },
            'delete_label': {
                commandWords: ['delete', 'מחק', 'תמחק'],
                func: this.deleteLabel,
                args: [msg.key.participant, jid, labelName, false, globalFeder, feders],
                desc: "מחק תג"
            },
            /*
            'delete_label_perm': {
                commandWords: ['del_perm', 'מחק_סופי'],
                func: this.deleteLabel,
                args: [jid, labelName, true, globalFeder, feder]
            },*/
            'list_labels': {
                commandWords: ['list', 'רשימה'],
                func: this.getAllLabels,
                args: [jid, feders],
                desc: "קבל את רשימת התוויות שאפשר לתייג בקבוצה זו"
            },
            'edit_label': {
                commandWords: ['edit', 'ערוך', 'שנה', 'תשנה'],
                func: this.editLabel,
                args: [msg.key.participant, jid, labelName, preText, globalFeder, feders],
                desc: "שנה את הטקסט המופיע עם התיוג באותה תווית"
            },
            'add_mention': {
                commandWords: ['add', 'הוסף', 'תוסיף'],
                func: this.addUserMention,
                args: [jid, labelName, msgMentions, globalFeder, feders],
                desc: "הוסף תיוג שלך או של משתמשים אחרים לרשימה"
            },
            'remove_mention': {
                commandWords: ['remove', 'הסר', 'תסיר'],
                func: this.removeUserMention,
                args: [jid, labelName, msgMentions, globalFeder, feders],
                desc: "הסר תיוג שלך או משתמשים אחרים מהרשימה"
            },
            'help_manual': {
                commandWords: ['-help', '-עזרה', '-פקודות'],
                func: this.helpManual,
                args: [],
                desc: "למד מה אפשר לעשות עם התגים של באביבוט!"
            }
        }

        responseMsg = ""

        Object.keys(commands).forEach(op => {
            let currCommand = commands[op]
            if (currCommand.commandWords.includes(requestedCommand)) {
                responseMsg = currCommand.func(...currCommand.args)
            }
        });

        // ##################################   TODO: must FIX! - every func is returning a string
        // ##################################   option: return a array [string, boolean] - [responseMsg, isCommandExist]
        // TODO: add "help" command

        if (responseMsg === "") // requested command does not currently exist
        {
            responseMsg = "אופס, נראה שפקודה זאת לא קיימת..."
        }

        return sendMsgQueue(jid, responseMsg)
    }

    /**
     * create a new label from mentions
    * @param {string} keyParticipant
    * @param {string} jid
    * @param {string} label
    * @param {string} preText
    * @param {string} globalFeder federation name for global label
    * @param {{federation: string, groups: string[], authorizedUsers: string[]}[]} feders all the federations the group (jid) is part of
    */
    async createLabel(keyParticipant, jid, label, preText, globalFeder = null, feders = null) {

        if (!label) return "אופס... נראה ששכחת לכתוב את שם התג";

        // the user wants to create a global label
        if (globalFeder) {
            if (!globalFeder in feders) return `הפדרציה ${globalFeder} לא משוייכת לקבוצה הנוכחית`

            if (!this.isPermitted(keyParticipant, globalFeder)) return `פקודה זו זמינה רק למנהלי ${globalFeder}`

            let labelExists = await labelsDB.findOne({ label: label, federation: { $in: [globalFeder] } })
            if (labelExists) return "תג זה כבר קיים";

            this.addLabel(label, preText, null, [globalFeder])
        }
        // private label
        else {
            let chatSpecificLabel = await labelsDB.findOne({ label: label, jid: jid })
            if (chatSpecificLabel) return "תג זה כבר קיים בקבוצה";

            let federLabel = await labelsDB.findOne({ label: label, federation: { $in: feders } })
            if (federLabel) return "תג זה כבר קיים בפדרציה שמשוייכת לקבוצה"

            this.addLabel(label, preText, jid)
        }

        return `התג *${labelName}* נוצר בהצלחה!`
    }

    /**
     * remove label from mentions for the group
    * @param {string} keyParticipant
    * @param {string} jid
    * @param {string} label
    * @param {boolean} permanent
    * @param {string} globalFeder
    * @param {{{federation: string, groups: string[], authorizedUsers: string[]}[]}} feders
    */
    async deleteLabel(keyParticipant, jid, label, permanent = false, globalFeder = null, feders = null) {
        let reqLabel;
        if (globalFeder) {
            if (!globalFeder in feders) return `הפדרציה ${globalFeder} לא משוייכת לקבוצה הנוכחית`

            if (!this.isPermitted(keyParticipant, globalFeder)) return `פקודה זו זמינה רק למנהלי ${globalFeder}`

            reqLabel = await labelsDB.findOne({ label: label, federation: { $in: [globalFeder] } })
            if (reqLabel) {
                labelsDB.deleteOne({ _id: reqLabel._id }, (err, _) => {
                    if (err) throw err;
                });
            }
        }
        else {
            let metadata = await GLOBAL.sock.groupMetadata(jid);
            let isAdmin = metadata.participants.find((user) => user.jid === keyParticipant).admin
                || keyParticipant.includes(GLOBAL.superuser);
            if (!isAdmin) return "פקודה זו זמינה רק למנהלים";

            reqLabel = await labelsDB.findOne({ label: label, jid: jid })
            if (!reqLabel) return "תג זה לא קיים בכלל";
        }

        labelsDB.deleteOne({ _id: reqLabel._id }, (err, _) => {
            if (err) throw err;
        });

        return `התג *${label}* נמחק בהצלחה!`
    }

    /**
     * get all labels associated with the group
     * @param {string} jid group id
     * @param {{{federation: string, groups: string[], authorizedUsers: string[]}[]}} feders all the federations the group (jid) is part of
    */
    async getAllLabels(jid, feders) {
        /* cant be duplicated labels in the list, because we not saving the jid for global labels */

        // get chat specific labels
        let labels = await labelsDB.find({ jid });
        let labelString = list(labels.map(label => label.label)).join("\n");

        feders.forEach(async feder => {
            // get labels by feder
            labels = await labelsDB.find({ federation: feder });
            // add to text
            labelString += `> תגים כללים של ${feder}:\n`
            labelString += list(labels.map(label => label.label)).join("\n")
        })

        return labelString
    }

    /**
     * remove user mentions from label
    * @param {string} jid
    * @param {string} label
    * @param {string[]} msgMentions
    * @param {string} globalFeder
    * @param {{{federation: string, groups: string[], authorizedUsers: string[]}[]}} feders all the federations the group (jid) is part of
    */
    async removeUserMention(jid, label, msgMentions, globalFeder = null, feders = null) {
        if (!label) return "אופס... נראה ששכחת לכתוב את שם התג";

        var reqLabel = null;
        if (globalFeder && globalFeder in feders) {
            reqLabel = await labelsDB.findOne({ label: label, federation: { $in: [globalFeder] } })
            if (!reqLabel) return
            jid = null
        }
        else {
            reqLabel = await labelsDB.findOne({ label: label, jid: jid });
            if (!reqLabel) return "תג זה לא קיים";
        }

        let updatedUsers = reqLabel.users.filter(user => !msgMentions.includes(user))
        await labelsDB.findOneAndUpdate({ label: label, jid: jid, federation: feders }, { users: updatedUsers });

        return `המשתמש הוסר בהצלחה!`
    }

    /**
     * add user mentions to label
    * @param {string} jid
    * @param {string} label
    * @param {string[]} msgMentions
    * @param {string} globalFeder
    * @param {{{federation: string, groups: string[], authorizedUsers: string[]}[]}} feders all the federations the group (jid) is part of
    */
    async addUserMention(jid, label, msgMentions, globalFeder = null, feders = null) {
        if (!label) return "אופס... נראה ששכחת לכתוב את שם התג";

        var reqLabel = null;
        if (globalFeder && globalFeder in feders) {
            reqLabel = await labelsDB.findOne({ label: label, federation: { $in: [globalFeder] } })
            if (!reqLabel) return
            jid = null
        }
        else {
            reqLabel = await labelsDB.findOne({ label: label, jid: jid });
            if (!reqLabel) return "תג זה לא קיים";
        }

        let addedUsers = msgMentions.filter(user => !reqLabel.users.includes(user))
        updatedUsers = reqLabel.users.concat(addedUsers)
        await labelsDB.findOneAndUpdate({ label: label, jid: jid, federation: feders }, { users: updatedUsers });


        return `המשתמש נוסף בהצלחה!`
    }

    /**
     * edit label text
    * @param {string} jid
    * @param {string} label
    * @param {string} preText new text for the label
    * @param {string} globalFeder
    * @param {{{federation: string, groups: string[], authorizedUsers: string[]}[]}} feders all the federations the group (jid) is part of
    */
    async editLabel(keyParticipant, jid, label, preText, globalFeder = null, feders = null) {
        if (!label) return "אופס... נראה ששכחת לכתוב את שם התג";

        var reqLabel = null;
        if (globalFeder && globalFeder in feders) {
            if (!this.isPermitted(keyParticipant, globalFeder)) return `פקודה זו זמינה רק למנהלי ${globalFeder}`

            reqLabel = await labelsDB.findOne({ label: label, federation: { $in: [globalFeder] } })
            if (!reqLabel) return
            jid = null
        }
        else {
            reqLabel = await labelsDB.findOne({ label: label, jid: jid });
            if (!reqLabel) return "תג זה לא קיים";
        }

        await labelsDB.findOneAndUpdate({ label: label, jid: jid, federation: feders }, { text: preText });


        return [true, `התג *${label}* נערך בהצלחה!`]
    }

    /**
     * info about the labels feature and how to use it
     */
    async helpManual() {
        // TODO review and rewrite if necessary, add example
        text = "*אודות התגים / התוויות של הבוט*\n" +
        "תיוגים קבוצתיים ונוחים בוואטסאפ!\n" + 
        "תייג את כל האנשים הרלוונטים להודעה בקלות\n" +
        "`@תג`\n"        
        "\n" +
        ":רשימת הפקודות עבור תגים"
        Object.keys(commands).forEach(op => {
            let currCommand = commands[op]
            text += `*${currCommand[commandWords[1]]}*: ${currCommand[desc]}`;
            // TODO add rest of commandWords to text (optional, start with '> ')
        })
        
        return [true, text];
    }

}

export const mentions = new Mentions();