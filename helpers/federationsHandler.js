import { GLOBAL } from '../src/storeMsg.js';
import { sendCustomMsgQueue } from '../src/QueueObj.js';

import federationsDB from '../src/schemas/federations.js';

class Federations {
    /**
     * handle federation operations such as add/remove groups, etc.
     * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
     * @example "!federations {create} {myFederName} {...mentions}"
     */
    async federationsHandling(msg) {
        const jid = msg.key.remoteJid;

        // check if the message is in a group
        if (!jid.includes("@g.us"))
            return sendMsgQueue(id, "הפקודה זמינה רק בקבוצות");

        const textMsg = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        const msgComponents = textMsg.toLowerCase().split(/[\n ]/);

        const requestedCommand = msgComponents[1];
        const federName = msgComponents[2];

        const msgMentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid
            ? msg.message.extendedTextMessage.contextInfo.mentionedJid
            : [msg.key.participant ?? ""];

        const commands = {
            'create_federation': {
                commandWords: ['create', 'צור', 'תצור'],
                func: this.createFederation,
                args: [federName, jid, msgMentions]
            },
            'delete_federation': {
                commandWords: ['delete', 'מחק', 'תמחק'],
                func: this.deleteFederation,
                args: [federName, msg.key.participant]
            },
            'add_authorized_users': {
                commandWords: ['addusers', 'הוסף'],
                func: this.addAuthorizedUsers,
                args: [federName, msgMentions]
            },
            'remove_authorized_users': {
                commandWords: ['removeusers', 'הסר'],
                func: this.removeAuthorizedUsers,
                args: [federName, msgMentions]
            },
            'add_group': {
                commandWords: ['addgroup', 'שייך'],
                func: this.addGroup,
                args: [federName, jid]
            },
            'remove_group': {
                commandWords: ['removegroup', 'הוצא'],
                func: this.removeGroup,
                args: [federName, jid]
            }
        };
        

        responseMsg = ""

        Object.keys(commands).forEach(op => {
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
     * create new federation
     * @param {string} federName 
     * @param {string} jid
     * @returns 
     */
    async createFederation(federName, jid) {
        //feder = await federationsDB.findOne({ federation: federName, groups: { $in: [jid]}});
        const feder = await federationsDB.findOne({ federation: federName});
        if (feder) return "פדרציה בשם זה קיימת כבר, נסה שוב עם שם אחר";

        federationsDB.create({ federation: federName, groups: $push [jid] }, (err, res) => {
			if (err) throw err;
			console.log(res);
		});

        return `*${federName}* נוצרה בהצלחה!`
    }

    /**
     * delete federation from db
     * @param {string} federName 
     * @param {string} keyUser sender of the deletion command 
     * @returns 
     */
    async deleteFederation(federName, keyUser) {
        reqFeder = await federationsDB.findOne({ federation: federName, authorizedUsers: { $in: [keyUser]} })
        if (reqFeder) {
            federationsDB.deleteOne({ _id: reqFeder._id }, (err, _) => {
                if (err) throw err;
            });
            return `*${federName}* נמחקה בהצלחה!`
        }
        return "אין לך הרשאה למחוק פדרציה זו"
    }

    /**
     * add authorized access to users to manipulate federation
     * @param {string} federName 
     * @param {string[]} users 
     * @returns 
     */
    async addAuthorizedUsers(federName, users) {
        reqFeder = await federationsDB.findOne({ federation: federName })
        if (reqFeder) {
            let addedUsers = users.filter(user => !reqFeder.authorizedUsers.includes(user))
            updatedUsers = reqFeder.authorizedUsers.concat(addedUsers)
            await federationsDB.findOneAndUpdate({ federation: federName }, { authorizedUsers: updatedUsers });
            return "מורשי גישה נוספו בהצלחה"
        }
        return "הפדרציה לא קיימת"
    }

    /**
     * remove users authorized access to manipulate federation
     * @param {string} federName 
     * @param {string[]} users 
     * @returns 
     */
    async removeAuthorizedUsers(federName, users) {
        reqFeder = await federationsDB.findOne({ federation: federName })
        if (reqFeder) {
            let updatedUsers = reqFeder.authorizedUsers.filter(user => !users.includes(user));
            await federationsDB.findOneAndUpdate({ federation: federName }, { authorizedUsers: updatedUsers });
            return "מורשי גישה הוסרו בהצלחה"
        }
        return "הפדרציה לא קיימת"
    }

    /**
     * add group to federation
     * @param {string} federName 
     * @param {string} jid 
     * @returns 
     */
    async addGroup(federName, jid) {
        reqFeder = await federationsDB.findOne({ federation: federName })

        if (!reqFeder) return "הפדרציה לא קיימת"

        if (!(jid in reqFeder.groups)) {
            await federationsDB.findOneAndUpdate({ federation: federName }, { $push: { groups: jid} });
            return `הקבוצה נוספה ל${federName} בהצלחה`
        }
        return "הקבוצה כבר נמצאת בפדרציה"
    }

    /**
     * remove group from federation
     * @param {string} federName 
     * @param {string} jid 
     * @returns 
     */
    async removeGroup(federName, jid) {
        reqFeder = await federationsDB.findOne({ federation: federName })

        if (!reqFeder) return "הפדרציה לא קיימת"

        if (jid in reqFeder.groups) {
            await federationsDB.findOneAndUpdate({ federation: federName }, { $pull: { groups: jid } });
            return `הקבוצה הוסרה מ${federName} בהצלחה`
        }
        return "הקבוצה לא נמצאת בפדרציה"
    }

}

export const federations = new Federations();