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
            if (users.length !== this.mentions[label].users.length) {
                this.mentions[label].users = users;
                this.saveMentions();
            }

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

    //############################################################################################################

    /**
     * save the mentions to the file
     */
    saveMentions() {
        fs.writeFileSync("./mentions/mentions.json", JSON.stringify(this.mentions, null, 2));
    }
}

export const mentions = new Mentions();