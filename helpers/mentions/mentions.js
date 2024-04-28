import fs from 'fs';
import { GLOBAL } from '../../src/storeMsg';
import { sendCustomMsgQueue } from '../../src/QueueObj';

class Mentions {
    constructor() {
        // load the mentions from the file
        if (!fs.existsSync("./mentions/mentions.json")) {
            fs.writeFileSync("./mentions/mentions.json", "{}");
        }

        /** 
         * @type {{[label:string]: {
         *          groups: string[],
         *          users: string[], 
         *          text: string
         * }}} 
        */
        this.mentions = JSON.parse(fs.readFileSync("./mentions/mentions.json"));
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

        // check if the label exists and contains the group
        if (this.mentions[label]?.groups.includes(jid)) {
            // we dont need to get the metadata, but if one of left the group, we need to remove him
            let metadata = await GLOBAL.sock.groupMetadata(jid);
            let users = metadata.participants.map((user) => user.jid);
            users = this.mentions[label].users.filter((user) => users.includes(user));

            // if is there any user left, we need to update the mentions
            // (only when is one group?, user can be in another groups)
            // if (users.length !== this.mentions[label].users.length) {
            //     this.mentions[label].users = users;
            //     this.saveMentions();
            // }

            // send the message
            let text = this.mentions[label].text;
            text += "\n" + users.map((user) => `@${user.replace("@s.whatsapp.net", "")}`).join(" ");
            return sendCustomMsgQueue(jid, { text, mentions: users });
        }
        else if (label === "כולם" || label === "everyone") {
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
     * example (maybe need a change)
     * @param {string} label
     * @param {string[]} groups
     * @param {string} text
     */
    addLabel(label, groups, text) {
        this.mentions[label] = { groups, users: [], text };
        this.saveMentions();

    }

    /**
     * handle label operations such as add, remove, edit, etc.
     * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
     */
    async labelHandling(msg){
        const jid = msg.key.remoteJid;

        // check if the message is in a group
        if (!jid.includes("@g.us"))
            return sendMsgQueue(id, "הפקודה זמינה רק בקבוצות");

        const textMsg = msg.message.conversation || msg.message.extendedTextMessage.text || "";

        const msgComponents = textMsg.toLowerCase().split(/[\n ]/);

        // command without the "&"
        const requestedCommand = msgComponents[0].slice(1);
        // label
        const labelName = msgComponents[1];
        // additional text for label 
        const preText = textMsg.split(/[\n ]/).slice(2).join(" ") + "\n" || "";

        const commands = {
            'create_label': {
                commandWords: ['create', 'צור', 'תצור'],
                func: this.createLabel,
                args: [jid, labelName, preText]
            },
            'delete_label': {
                commandWords: ['delete', 'מחק', 'תמחק'],
                func: this.deleteLabel,
                args: [jid, labelName]
            },
            'delete_label_perm': {
                commandWords: ['del_perm', 'מחק_סופי'],
                func: this.deleteLabel,
                args: [jid, labelName, true]
            },
            'list_labels': {
                commandWords: ['list', 'רשימה'],
                func: this.getAllLabels,
                args: [jid]
            },
            'edit_label': {
                commandWords: ['edit', 'ערוך', 'שנה', 'תשנה'],
                func: this.editLabel,
                args: [jid, labelName, preText]
            },
            'add_mention': {
                commandWords: ['add', 'הוסף', 'תוסיף'],
                func: this.editLabel,
                args: [jid, labelName] 
            },
            'remove_mention': {
                commandWords: ['remove', 'הסר', 'תסיר'],
                func: this.removeUserMention,
                args: [jid, labelName]
            }
        }

        responseMsg = ""

        Object.entries(commands).forEach(op => {
            let currCommand = commands[op]
            if (currCommand.commandWords.includes(requestedCommand))
            {
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
    createLabel(jid, label, preText) {
        
        if (!label) return "אופס... נראה ששכחת לכתוב את שם התג";          

        if (this.mentions[label]) 
        {
            //if (this.mentions[label].groups.includes(jid))
            //    return "תג זה כבר קיים";
            // label already exists in other groups
            //else
                {
                    //this.addLabel(labelName, this.mentions[labelName].groups.push(jid), preText)
                    this.addLabel(label, this.mentions[label].groups.push(jid), this.mentions[label].text)
                    //return "תג זה כבר קיים, בקבוצות אחרות";
                }
        }
        else this.addLabel(label, jid, preText)

        // update the json file
        this.saveMentions()

        return `התג *${labelName}* נוצר בהצלחה!`
    }

    /**
     * remove label from mentions for the group
    * @param {string} jid group id
    * @param {string} label
    */
    deleteLabel(jid, label, permanent=false) {
        let isAdmin = metadata.participants.find((user) => user.jid === msg.key.participant).admin
                || msg.key.participant.includes(GLOBAL.superuser);
        if (!isAdmin) return "פקודה זו זמינה רק למנהלים";

        if (!label) return "אופס... נראה ששכחת לכתוב את שם התג";

        if (this.mentions[label] && this.mentions[label].groups.includes(jid)) 
        {
            this.mentions[label].groups = this.mentions[label].groups.filter(g => g !== jid)
            
            // delete completely from mentions if requested or inaccessable anymore
            if (permanent || this.mentions[label].groups.length <= 0){
                delete this.mentions[label]
            }
        }
        else return "תג זה לא קיים פה מלכתחילה";

        // update the json file
        this.saveMentions()

        return `התג *${label}* נמחק בהצלחה!`
        }

    /**
     * get all labels associated with the group
    * @param {string} jid group id
    */
    getAllLabels(jid) {
        const allLabels = Object.keys(this.mentions)
        const labelList = allLabels.filter(l => this.mentions[l].groups.includes(jid));
        return labelList.join("\n")
    }

    /**
     * remove user mentions from label
    * @param {string} jid
    * @param {string} label
    */
    removeUserMention(jid, label) {
        if (!this.mentions[label] || !this.mentions[label].groups.includes(jid)) 
        {
            // remove hebrew preposition if label had one on
            //if (label.startsWith("מ") && this.mentions[label] && this.mentions[label].groups.includes(jid)) label = label.slice(1)
            //else
            return "תג זה לא קיים";
        }

        
        // get list of users from msg to remove
        this.mentions[label].users.filter(user => !msg.mentions.includes(user));

        // remove oneself
        if (msg.mentions.length() <= 0) this.mentions[label].users.filter(user => user !== msg.key.participant);

        // update the json file
        this.saveMentions()

        return `המשתמש הוסר בהצלחה!`
    }

    /**
     * add user mentions to label
    * @param {string} jid
    * @param {string} label
    */
    addUserMention(jid, label) {
        if (!this.mentions[label] || !this.mentions[label].groups.includes(jid)) 
            {
                // remove hebrew preposition if label had one on
                //if (label.startsWith("ל") && this.mentions[label] && this.mentions[label].groups.includes(jid)) label = label.slice(1)
                //else 
                return "תג זה לא קיים";
            }

        
        // get list of users from msg to add
        addedUsers = msg.mentions.filter(user => !this.mentions[label].users.includes(user))
        this.mentions[label].users = this.mentions[label].users.concat(addedUsers)

        // add oneself
        if (msg.mentions.length() <= 0) this.mentions[label].users.push(msg.key.participant);

        // update the json file
        this.saveMentions()

        return `המשתמש נוסף בהצלחה!`
    }

    /**
     * edit label text
    * @param {string} jid
    * @param {string} label
    * @param {string} preText new text for the label
    */
    editLabel(jid, label, preText) {
        if (!this.mentions[label] || !this.mentions[label].groups.includes(jid)) return "תג זה לא קיים";
        else
        {
            this.addLabel(label, this.mentions[label].groups, preText)
        }

        // update the json file
        this.saveMentions()

        return `התג *${label}* נערך בהצלחה!`
    }
    //############################################################################################################

    /**
     * save the mentions to the file
     */
    saveMentions() {
        fs.writeFileSync("./mentions/mentions.json", JSON.stringify(this.mentions, null, 2));
    }
}

export const mentions = new Mentions();