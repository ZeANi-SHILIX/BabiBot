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
     * get the mentions
     * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
     */
    async setLabel(msg) {
        const jid = msg.key.remoteJid;

        // check if the message is in a group
        if (!jid.includes("@g.us"))
            return sendMsgQueue(id, "הפקודה זמינה רק בקבוצות");

        const textMsg = msg.message.conversation || msg.message.extendedTextMessage.text || "";
        commandChar = "&"
        const msgComponents = textMsg.toLowerCase().split(/[\n ]/);

        const command = msgComponents[0].toLowerCase()
        
        if (command === (commandChar + "צור") || command === (commandChar + "create"))
        {
            const labelName = msgComponents[1];
            if (!labelName) return sendMsgQueue(jid, "אופס... נראה ששכחת לכתוב את שם התג");
                      

            const preText = msgText.split(/[\n ]/).slice(2).join(" ") || "";
            if (this.mentions[labelName]) 
            {
                if (this.mentions[labelName].groups.includes(jid))
                    return sendMsgQueue(jid, "תג זה כבר קיים");
                // label already exists in other groups
                else
                    {
                        //this.addLabel(labelName, this.mentions[labelName].groups.push(jid), preText)
                        this.addLabel(labelName, this.mentions[labelName].groups.push(jid), this.mentions[labelName].text)
                        return sendMsgQueue(jid, "תג זה כבר קיים, בקבוצות אחרות");
                    }
            }
            else this.addLabel(labelName, jid, preText)

            // update the json file
            this.saveMentions()

            success = `התג *${labelName}* נוצר בהצלחה!`
            return sendMsgQueue(jid, success)
        }
    }


    async getAllLabels(msg) {
        const jid = msg.key.remoteJid;

        // check if the message is in a group
        if (!jid.includes("@g.us"))
            return sendMsgQueue(id, "הפקודה זמינה רק בקבוצות");

        const textMsg = msg.message.conversation || msg.message.extendedTextMessage.text || "";

        commandChar = "&"
        const msgComponents = textMsg.toLowerCase().split(/[\n ]/);
        const command = msgComponents[0].toLowerCase()
        
        if (command === (commandChar + "רשימה") || command === (commandChar + "רשימת") || command === (commandChar + "list"))
        {
            // gather all labels related to this group
            labelList = []
            for (let label in this.mentions){
                if (this.mentions[label].groups.includes(jid))
                    labelList.push(label)
            }
           
            return sendCustomMsgQueue(jid, labelList.join("\n"))
        }
    }

    async editLabel(msg) {
        const jid = msg.key.remoteJid;

        // check if the message is in a group
        if (!jid.includes("@g.us"))
            return sendMsgQueue(id, "הפקודה זמינה רק בקבוצות");

        const textMsg = msg.message.conversation || msg.message.extendedTextMessage.text || "";

        commandChar = "&"
        const msgComponents = textMsg.toLowerCase().split(/[\n ]/);
        const command = msgComponents[0].toLowerCase()
        responseMsg = ""

        const labelName = msgComponents[1];
            if (!labelName) return sendMsgQueue(jid, "אופס... נראה ששכחת לציין את שם התג");

        if (command === "הוסף" || command === "תוסיף" || command === "add")
        {
            if (!this.mentions[labelName] && !this.mentions[labelName].groups.includes(jid)) 
            {
                // remove hebrew preposition if label had one on
                if (labelName.startsWith("ל") && this.mentions[labelName] && !this.mentions[labelName].groups.includes(jid))
                    labelName = labelName.slice(1)
                else
                    return sendMsgQueue(jid, "תג זה לא קיים");
            }

        
            // get list of users from msg to add
            addedUsers = msg.mentions.filter(user => !this.mentions[labelName].users.includes(user))
            this.mentions[labelName].users = this.mentions[labelName].users.concat(addedUsers)

            // add oneself
            if (msg.mentions.length() <= 0)
                this.mentions[labelName].users.push(msg.key.participant);

            responseMsg = `המשתמש נוסף בהצלחה!`
        }
        
        else if (command === "הסר" || command === "תסיר" || command === "remove" || command === "delete")
        {
            if (!this.mentions[labelName] && !this.mentions[labelName].groups.includes(jid)) 
            {
                // remove hebrew preposition if label had one on
                if (labelName.startsWith("מ") && this.mentions[labelName] && !this.mentions[labelName].groups.includes(jid))
                    labelName = labelName.slice(1)
                else
                    return sendMsgQueue(jid, "תג זה לא קיים");
            }

            
            // get list of users from msg to remove
            this.mentions[labelName].users.filter(user => !msg.mentions.includes(user));

            // remove oneself
            if (msg.mentions.length() <= 0)
                this.mentions[labelName].users.filter(user => user !== msg.key.participant);

                responseMsg = `המשתמש הוסר בהצלחה!`
            }

        else if (command === (commandChar + "ערוך") || command === (commandChar + "שנה") || command === (commandChar + "תשנה")
            || command === (commandChar + "edit") || command === (commandChar + "change"))
        {
            
            // command continuation, which component to edit
            const commandToChange = msgComponents[2].toLowerCase()
            if (!commandToChange) return sendMsgQueue(jid, "אז לא לשנות כלום? טוב.");

            if (commandToChange === "תיאור" || commandToChange === "טקסט" || commandToChange.startsWith("desc"))
            {
                //...
                // TODO
            }
            responseMsg =`התג *${labelName}* נערך בהצלחה!`
        }

        // update the json file
        this.saveMentions()

        return sendCustomMsgQueue(jid, responseMsg)
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