import { GLOBAL } from '../src/storeMsg.js';
import { sendCustomMsgQueue } from '../src/QueueObj.js';

import labelsDB from '../src/schemas/mentions.js';
import federationsDB from '../src/schemas/federations.js';
import e from 'express';

class Mentions {
    constructor() {

        this.permittedUsers = [] //TODO set permissions
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

        if (label === "כולם" || label === "everyone") {
            let metadata = await GLOBAL.sock.groupMetadata(jid);

            // check if the user is admin
            let isAdmin = metadata.participants.find((user) => user.jid === msg.key.participant).admin
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
            let users = metadata.participants.map((user) => user.id)
                .filter((user) => user.admin // admins only
                    && !user.includes(GLOBAL.sock.user.id.split("@")[0].split(":")[0])); // not bots

            let text = users.map((user) => `@${user.replace("@s.whatsapp.net", "")}`).join(" ");
            return sendCustomMsgQueue(jid, { text, mentions: users });
        }
        else {
            // get federations
            const federations = await this.getFederationsByJID(jid);
            // get all labels
            let labels = (await labelsDB.find({ label: label }, (err, res) => {
                if (err) throw err;
                console.log(res);
            }));

            // filter
            // first find label from the chat
            let tempLabels = labels.filter(label => label.jid === jid)
            //if not found - search with the feder
            if (tempLabels.length === 0 && federations.length !== 0) {
                tempLabels = labels.filter(label => federations.some(feder => label.federation.includes(feder.federation)))
            }
            labels = tempLabels

            // if the label is not found
            if (labels.length === 0) return //sendCustomMsgQueue(jid, { text: "תג זה לא קיים" });

            // TODO: check if the user is admin?

            // when some labels are found - use the first one

            // filter only users in the group
            let metadata = await GLOBAL.sock.groupMetadata(jid);
            let users = metadata.participants.map((user) => user.id);
            users = labels[0].users.filter((user) => users.includes(user));

            let text = labels[0].text;
            text += "\n" + users.map((user) => `@${user.replace("@s.whatsapp.net", "")}`).join(" ");
            return sendCustomMsgQueue(jid, { text, mentions: users });
        }
    }

    /*############################################################################################################
    ** Label Management
    * label: is a string that the user will use to mention a group of users
    * groups: is an array of the groups that the label will be available in
    * text: is the message that will be sent when the label is used
    * users: is an array of the users that the label will mention
    * 
    * TODO: add a function to add a label
    * TODO: add a function to remove a label
    * TODO: add a function to edit a label
    *       - changing the users (add/remove)
    *       - changing the groups (add/remove)
    *       - changing the text
    * TODO: add a function to list all the labels in a group
    ############################################################################################################*/

    /**
     * create a new label
     * @param {string} label
     * @param {string} text
     * @param {string} jid
     * @param {string[]} feders
     */
    addLabel(label, text, jid = null, feder = []) {
        // TODO:options to add here: feder, users
        if (jid) {
            labelsDB.create({ label: label, jid: jid, text: text }, (err, res) => {
                if (err) throw err;
                console.log(res);
            });
        }
        else if (feder) {
            labelsDB.create({ label: label, text: text, federation: feder}, (err, res) => {
                if (err) throw err;
                console.log(res);
            });
        }
    }

    /**
     * verify user permission to execute the command
     * @param {string} user 
     */
    isPermitted(user) {
        return this.permittedUsers.includes(user)
    }

    async getFederationsByJID(jid) {
        const feders = await federationsDB.find({ groups: { $in: [jid] } });
        return feders
    }

    /**
     * handle label operations such as add, remove, edit, etc.
     * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
     */
    async labelHandling(msg) {
        const jid = msg.key.remoteJid;

        // check if the message is in a group
        if (!jid.includes("@g.us"))
            return sendMsgQueue(id, "הפקודה זמינה רק בקבוצות");

        // need fix - each group can have multiple federations
        const feders = await this.getFederationsByJID(jid)

        const textMsg = msg.message.conversation || msg.message.extendedTextMessage.text || "";

        const msgComponents = textMsg.toLowerCase().split(/[\n ]/);

        //drop handler prefix
        const requestedCommand = msgComponents[0].slice(1);
        // label
        const labelName = msgComponents[1];

        var numCommandOptions = 1;

        // optional global
        var globalFeder = null;
        if (msgComponents[2] === "-גלובלי" || msgComponents[2] === "-global") {
            globalFeder = msgComponents[3];
            numCommandOptions += 2;
        }

        const msgMentions = msg.mentions ? msg.mentions : msg.key.participant

        // additional text for label 
        const preText = textMsg.split(/[\n ]/).slice(numCommandOptions).join(" ") + "\n" || "";

        const commands = {
            'create_label': {
                commandWords: ['create', 'צור', 'תצור'],
                func: this.createLabel,
                args: [jid, labelName, preText, globalFeder, feders]
            },
            'delete_label': {
                commandWords: ['delete', 'מחק', 'תמחק'],
                func: this.deleteLabel,
                args: [msg.key.participant, jid, labelName, false, globalFeder, feders]
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
                args: [jid, feders]
            },
            'edit_label': {
                commandWords: ['edit', 'ערוך', 'שנה', 'תשנה'],
                func: this.editLabel,
                args: [jid, labelName, preText, globalFeder, feders]
            },
            'add_mention': {
                commandWords: ['add', 'הוסף', 'תוסיף'],
                func: this.addUserMention,
                args: [jid, labelName, msgMentions, globalFeder, feders]
            },
            'remove_mention': {
                commandWords: ['remove', 'הסר', 'תסיר'],
                func: this.removeUserMention,
                args: [jid, labelName, msgMentions, globalFeder, feders]
            },
            'join_federation': {
                commandWords: ['join'],
                func: this.joinFederation,
                args: [msg.key.participant, jid, globalFeder]
            },
            'leave_federation': {
                commandWords: ['leave'],
                func: this.leaveFederation,
                args: [msg.key.participant, jid, globalFeder]
            }
        }

        responseMsg = ""

        Object.entries(commands).forEach(op => {
            let currCommand = commands[op]
            if (currCommand.commandWords.includes(requestedCommand)) {
                responseMsg = currCommand.func(...currCommand.args)
            }
        });

        if (responseMsg === "") // requested command does not currently exist
        {
            responseMsg = "אופס, נראה שפקודה זאת לא קיימת..."
        }

        return sendMsgQueue(jid, responseMsg)
    }

    /**
     * create a new label from mentions
    * @param {string} jid
    * @param {string} label
    * @param {string} textMsg
    */
    async createLabel(jid, label, preText, globalFeder = null, feders = null) {

        if (!label) return "אופס... נראה ששכחת לכתוב את שם התג";

        if (globalFeder && globalFeder in feders) {
            let labelExists = await labelsDB.findOne({ label: label, federation: { $in: [globalFeder] } })
            if (labelExists) return "תג זה כבר קיים";

            this.addLabel(label, text = preText, feder = globalFeder)
        }
        else {
            let chatSpecificLabel = await labelsDB.findOne({ label: label, jid: jid })

            if (chatSpecificLabel) return "תג זה כבר קיים";
            else {
                this.addLabel(label, jid = jid, text = preText)
            }
        }

        return `התג *${labelName}* נוצר בהצלחה!`
    }

    /**
     * remove label from mentions for the group
    * @param {string} jid group id
    * @param {string} label
    */
    async deleteLabel(keyParticipant, jid, label, permanent = false, globalFeder = null, feders = null) {
        let metadata = await GLOBAL.sock.groupMetadata(jid);

        let isAdmin = metadata.participants.find((user) => user.jid === keyParticipant).admin
            || keyParticipant.includes(GLOBAL.superuser);
        if (!isAdmin) return "פקודה זו זמינה רק למנהלים";

        var reqLabel;
        if (globalFeder && globalFeder in feders) {
            reqLabel = await labelsDB.findOne({ label: label, federation: { $in: [globalFeder] } })
            if (reqLabel) {
                labelsDB.deleteOne({ _id: reqLabel._id }, (err, _) => {
                    if (err) throw err;
                });
            }
        }
        else {
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
    */
    async getAllLabels(jid, feders) {
        // get chat specific labels
        let labels = await labelsDB.find({ jid });
        let labelString = list(labels.map(label => label.label)).join("\n");

        feders.forEach(async feder => {
            // get labels by feder
            labels = await labelsDB.find({ federation: feder })
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
    */
    async editLabel(jid, label, preText, globalFeder = null, feders = null) {
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
        
        await labelsDB.findOneAndUpdate({ label: label, jid: jid, federation: feders }, { text: preText });


        return `התג *${label}* נערך בהצלחה!`
    }
    /**
     * add groupchat to the federation's groups
     * @param {string} jid 
     * @param {string} feder 
     */
    async joinFederation(keyParticipant, jid, feder) {
        let metadata = await GLOBAL.sock.groupMetadata(jid);

        let isAdmin = metadata.participants.find((user) => user.jid === keyParticipant).admin
            || keyParticipant.includes(GLOBAL.superuser);
        if (!isAdmin) return "פקודה זו זמינה רק למנהלים";

        await federationsDB.findOneAndUpdate({federation: feder }, { $push: { groups: jid }})
    }

    /**
     * remove groupchat from the federation's groups
     * @param {string} jid 
     * @param {string} feder 
     */
    async leaveFederation(keyParticipant, jid, feder) {
        let metadata = await GLOBAL.sock.groupMetadata(jid);

        let isAdmin = metadata.participants.find((user) => user.jid === keyParticipant).admin
            || keyParticipant.includes(GLOBAL.superuser);
        if (!isAdmin) return "פקודה זו זמינה רק למנהלים";

        await federationsDB.findOneAndUpdate({federation: feder }, { $pull: { groups: jid }})
    }
}

export const mentions = new Mentions();