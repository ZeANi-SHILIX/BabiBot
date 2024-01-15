import { downloadMediaMessage } from '@adiwajshing/baileys';
import messageRetryHandler from "../src/retryHandler.js";

import savedNotes from '../src/schemas/notes.js';
import mediaNote from '../src/schemas/mediaNote.js';
import allNotes from '../src/schemas/AllNotes.js';

import { MsgType, getMsgType } from './msgType.js';
import { GLOBAL } from '../src/storeMsg.js'; // TODO: "store" change to memory store

import MemoryStore from '../src/store.js';
import { msgQueue, sendMsgQueue } from '../src/QueueObj.js';


function NoteHendler() {
    this.savedNotes = savedNotes;
    this.mediaNote = mediaNote;
    this.allNotes = allNotes;
}
const noteHendler = new NoteHendler();
export default noteHendler;


/**
 * activate by the command ```!note``` or ```!שמור```
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @param {Boolean} isGlobal optional, default is false
 * @param {boolean} issuperuser optional, default is null
 */
NoteHendler.prototype.saveNote = async function (msg, isGlobal = false, issuperuser = null) {
    let id = msg.key.remoteJid;

    let msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    // split by "\n" or " "
    let q = msgText.split(/[\n ]/)[1];
    if (!q) return sendMsgQueue(id, "אופס... נראה ששכחת לכתוב את שם ההערה");

    // check permissions
    if (isGlobal && issuperuser !== true)
        return sendMsgQueue(id, "אופס... אין לך הרשאה לשמור הערה גלובלית")

    let quoted;
    try {
        quoted = await MemoryStore.loadMessage(id, msg.message?.extendedTextMessage?.contextInfo?.stanzaId);
    } catch (error) {
        console.log(error);
    }
    let { type, mime } = getMsgType(quoted);

    // ### text note ### (no quoted message or quoted message is text)
    if (type == MsgType.TEXT) {
        let a = quoted?.message?.conversation
            || quoted?.message?.extendedTextMessage?.text
            || msgText.split(/[\n ]/).slice(2).join(" ") || "";
        //console.log(a);
        if (!a) return sendMsgQueue(id, "אופס... נראה ששכחת לכתוב את תוכן ההערה")

        // check if the note already exist in global or in the chat
        let result = await savedNotes.findOne({ q: q });

        if (result?.isGlobal || result?.chat === id)
            return sendMsgQueue(id, "אופס... ההערה כבר קיימת במאגר");

        return savedNotes.create({ q: q, a: a, chat: id, isGlobal: isGlobal }, (err, res) => {
            if (err) return sendMsgQueue(id, "אופס... ההערה כבר קיימת במאגר");

            sendMsgQueue(id, "ההערה נשמרה בהצלחה");
        });
    }

    // ### media note ###

    let buffer = await downloadMediaMessage(quoted, "buffer");

    // check if the buffer more than 15 mb
    let nameFile;
    if (type == MsgType.DOCUMENT) {
        nameFile = quoted.message.documentMessage.fileName;
        let size = buffer.length / 1024 / 1024;
        if (size > 15) return sendMsgQueue(id, "אופס... הקובץ גדול מדי");
    }

    mediaNote.create({
        q: q, buffer: buffer,
        type: type, mimetype: mime,
        fileName: nameFile,
        chat: id, isGlobal: isGlobal
    }, (err, res) => {
        console.log(res);
        if (err) return sendMsgQueue(id, "אופס... ההערה כבר קיימת במאגר");

        sendMsgQueue(id, "ההערה נשמרה בהצלחה")
    });

}

/**
 * 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @param {boolean} issuperuser 
 */
NoteHendler.prototype.deleteNote = async function (msg, sock, issuperuser = false) {
    let id = msg.key.remoteJid;

    let msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    let q = msgText.split(" ")[1];

    if (!q) return sendMsgQueue(id, "אופס... נראה ששכחת לכתוב את שם ההערה");

    let search = await savedNotes.find({ q: q });
    let searchMedia = await mediaNote.find({ q: q });

    // filter the notes
    search = search.filter(note => note.chat === id || note.isGlobal == true);
    searchMedia = searchMedia.filter(note => note.chat === id || note.isGlobal == true);

    if (search.length === 0 && searchMedia.length === 0)
        return sendMsgQueue(id, "אופס... אין הערה בשם זה")


    for (const note of search) {
        // check permissions
        if (note.isGlobal == true && issuperuser !== true)
            return sendMsgQueue(id, "אופס... אין לך הרשאה למחוק הערה זו")

        // delete the note
        savedNotes.deleteOne({ _id: note._id }, (err, res) => {
            if (err) return sendMsgQueue(id, "אופס... משהו השתבש");

            sendMsgQueue(id, "ההערה נמחקה בהצלחה")
        })
    }

    for (const note of searchMedia) {
        // check permissions
        if (note.isGlobal == true && issuperuser !== true)
            return sendMsgQueue(id, "אופס... אין לך הרשאה למחוק הערה זו")

        // delete the note
        mediaNote.deleteOne({ _id: note._id }, (err, res) => {
            if (err) return sendMsgQueue(id, "אופס... משהו השתבש")

            sendMsgQueue(id, "ההערה נמחקה בהצלחה")
        });
    }
}

/**
 * activate by the command ```!notes``` or ```!הערות```
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 */
NoteHendler.prototype.getAllNotes = async function (msg, sock) {
    let id = msg.key.remoteJid;

    // get notes from the database
    let resultPrivate = await savedNotes.find({ chat: id });
    let resultPublic = await savedNotes.find({ isGlobal: true });

    let resultPrivateMedia = await mediaNote.find({ chat: id });
    let resultPublicMedia = await mediaNote.find({ isGlobal: true });

    // filter the notes that are not global
    resultPrivate = resultPrivate.filter(note => note.isGlobal != true);
    resultPrivateMedia = resultPrivateMedia.filter(note => note.isGlobal != true);

    // combine the notes
    let globalNotes = [...resultPublic, ...resultPublicMedia];
    let privateNotes = [...resultPrivate, ...resultPrivateMedia];

    if (globalNotes.length === 0 && privateNotes.length === 0)
        return sendMsgQueue(id, "לא קיימות הערות")

    // create the message
    let str = "";
    if (privateNotes.length !== 0) {
        str += "*הערות בצ'אט זה:*\n"
        for (let note of privateNotes)
            str += note.q + "\n";
        str += "\n";
    }
    if (globalNotes.length !== 0) {
        str += `*הערות גלובליות:*\n`;
        for (let note of globalNotes)
            str += note.q + "\n";
        str += "\n";
    }

    str += "\nניתן לגשת להערה על ידי # או על ידי הפקודה !get";

    return sendMsgQueue(id, str)
}

/**
 * activate by the command ```!get <note name>``` or ```#<note name>```
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg
 * @param {import('@adiwajshing/baileys').WASocket} sock
*/
NoteHendler.prototype.getNote = async function (msg, sock) {
    let id = msg.key.remoteJid;

    let msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    let q = msgText.startsWith("#") ? msgText.replace("#", "").split(/[\n ]/)[0] : msgText.split(/[\n ]/)[1];
    if (!q) return sendMsgQueue(id, "אופס... נראה ששכחת לכתוב את שם ההערה");

    // note with text
    let result = await savedNotes.findOne({ q: q, chat: id });
    if (result) return sendMsgQueue(id, result.a)

    result = await savedNotes.findOne({ q: q, isGlobal: true });
    if (result) return sendMsgQueue(id, result.a)

    // note with media
    let resultMedia = await mediaNote.findOne({ q: q, chat: id });
    if (!resultMedia) resultMedia = await mediaNote.findOne({ q: q, isGlobal: true });

    // note not found
    if (!result && !resultMedia) return //sock.sendMessage(id, { text: "אופס... אין הערה בשם זה" }).then(messageRetryHandler.addMessage);

    // send the media
    switch (resultMedia.type) {
        case MsgType.IMAGE:
            return msgQueue.add(async () => { await sock.sendMessage(id, { image: resultMedia.buffer, mimetype: resultMedia.mimetype }) });
        case MsgType.VIDEO:
            return msgQueue.add(async () => { await sock.sendMessage(id, { video: resultMedia.buffer, mimetype: resultMedia.mimetype }) });
        case MsgType.AUDIO:
            return msgQueue.add(async () => { await sock.sendMessage(id, { audio: resultMedia.buffer, mimetype: resultMedia.mimetype }) });
        case MsgType.STICKER:
            return msgQueue.add(async () => { await sock.sendMessage(id, { sticker: resultMedia.buffer, mimetype: resultMedia.mimetype }) });
        case MsgType.DOCUMENT:
            return msgQueue.add(async () => { await sock.sendMessage(id, { document: resultMedia.buffer, mimetype: resultMedia.mimetype, fileName: resultMedia.fileName }) });
    }
}


// ############################################################################################
// ######################################### TESTING  #########################################
// ############################################################################################

/**
 * activate by the command ```!note``` or ```!שמור```
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @param {Boolean} isGlobal optional, default is false
 * @param {boolean} isAdmin optional, default is false
 */
NoteHendler.prototype.saveNote1 = async function (msg, sock, isGlobal = false, isAdmin = false) {
    let id = msg.key.remoteJid;
    let feder = getFeder(id);

    // get note name
    let msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    let q = msgText.split(" ")[1].split("\n")[0];
    if (!q) return sock.sendMessage(id, { text: "אופס... נראה ששכחת לכתוב את שם ההערה" }).then(messageRetryHandler.addMessage);

    // check if the note already exist
    let result = await allNotes.find({ question: q });

    // filter to only private or feder notes
    result = result.filter(res => res.chat === id || res.federation === feder)

    // not 0 - exist
    if (result.length)
        return sock.sendMessage(id, { text: "אופס... קיימת הערה עם שם זה\nנסה שם אחר" }).then(messageRetryHandler.addMessage);

    // check permissions to save as global (federation) note
    if (isGlobal && isAdmin !== true)
        return sock.sendMessage(id, { text: "אופס... אין לך הרשאה לשמור הערה גלובלית" }).then(messageRetryHandler.addMessage);
    else
        feder = id; // will save as private note


    // ------------------ save the note ------------------

    // TODO check all references to quoted message

    // check if the msg is a reply
    let isQuoted = false;
    if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
        // get the quoted message
        try {
            msg = await MemoryStore.loadMessage(id, msg.message?.extendedTextMessage?.contextInfo?.stanzaId);
            isQuoted = true;
        } catch (error) {
            console.log(error);
            return sock.sendMessage(id, { text: "אופס... לא הצלחתי לגשת להודעה המצוטטת" }).then(messageRetryHandler.addMessage);
        }
    }

    // get the message type
    let { type, mime } = getMsgType(msg); // ("msg" can be the current msg or the quoted msg)
    let nameFile;

    // save by type
    switch (type) {
        // ---- Text Note ----
        // (no quoted message or quoted message is text)
        case MsgType.TEXT:
            // get body note
            let a = isQuoted ? msg.message.conversation || msg.message.extendedTextMessage.text : msgText.split(" ").slice(2).join(" ") || "";
            if (!a) return sock.sendMessage(id, { text: "אופס... נראה ששכחת לכתוב את תוכן ההערה" }).then(messageRetryHandler.addMessage);

            // save the note
            return allNotes.create({ question: q, answer: a, chat: id, federation: feder, type: type }, (err, res) => {
                if (err) return sock.sendMessage(id, { text: "אופס... ההערה כבר קיימת במאגר" });

                sock.sendMessage(id, { text: "ההערה נשמרה בהצלחה" }).then(messageRetryHandler.addMessage);;
            });
            break;
        case MsgType.DOCUMENT:
            // check if the file is too big
            nameFile = msg.message.documentMessage.fileName;
            let size = buffer.length / 1024 / 1024;
            if (size > 15) return sock.sendMessage(id, { text: "אופס... הקובץ גדול מדי" }).then(messageRetryHandler.addMessage);

        case MsgType.IMAGE:
        case MsgType.VIDEO:
        case MsgType.AUDIO:
        case MsgType.STICKER:
            let buffer = await downloadMediaMessage(msg, "buffer");
            const base64 = buffer.toString("base64")
            //const _buffer = Buffer.from(myBase64File, "base64")


            allNotes.create({
                question: q, answer: base64,
                type: type, mimetype: mime,
                fileName: nameFile,
                caption: msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || msg.message.audioMessage?.caption || "",
                chat: id, federation: feder
            }, (err, res) => {
                console.log(res);
                if (err) return sock.sendMessage(id, { text: "אופס... ההערה כבר קיימת במאגר" }).then(messageRetryHandler.addMessage);

                sock.sendMessage(id, { text: "ההערה נשמרה בהצלחה" }).then(messageRetryHandler.addMessage);
            });
    }

}

/**
 * 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @param {boolean} isAdmin default false
 */
NoteHendler.prototype.deleteNote1 = async function (msg, sock, isAdmin = false) {
    let id = msg.key.remoteJid;
    let feder = getFeder(id);

    // get note name
    let msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    let q = msgText.split(" ")[1].split("\n")[0];
    if (!q) return sock.sendMessage(id, { text: "אופס... נראה ששכחת לכתוב את שם ההערה" }).then(messageRetryHandler.addMessage);

    // check if the note already exist
    let result = await allNotes.find({ question: q });

    // filter to only private or feder notes
    result = result.filter(res => res.chat === id || res.federation === feder)

    // is 0 - not exist
    if (!result.length)
        return sock.sendMessage(id, { text: "אופס... אין הערה בשם זה" }).then(messageRetryHandler.addMessage);

    let privateNote = result.filter(res => res.chat === id)
    let federNote = result.filter(res => res.federation === feder)

    // delete private
    if (privateNote.length) {
        allNotes.deleteOne({ _id: privateNote[0]._id }, (err, res) => {
            if (err) return sock.sendMessage(id, { text: "אופס... משהו השתבש" }).then(messageRetryHandler.addMessage);

            sock.sendMessage(id, { text: "ההערה נמחקה בהצלחה" }).then(messageRetryHandler.addMessage);
        })

    }
    // admin can delete federtion note
    else if (isAdmin && federNote.length) {
        allNotes.deleteOne({ _id: federNote[0]._id }, (err, res) => {
            if (err) return sock.sendMessage(id, { text: "אופס... משהו השתבש" }).then(messageRetryHandler.addMessage);

            sock.sendMessage(id, { text: "ההערה נמחקה בהצלחה" }).then(messageRetryHandler.addMessage);
        })
    }
    else
        sock.sendMessage(id, { text: "אופס! אין לך הרשאה למחוק את ההערה" }).then(messageRetryHandler.addMessage);

}

/**
 * activate by the command ```!notes``` or ```!הערות```
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 */
NoteHendler.prototype.getAllNotes1 = async function (msg, sock) {
    let id = msg.key.remoteJid;

    // get notes from the database
    let resultPrivate = await savedNotes.find({ chat: id });
    let resultPublic = await savedNotes.find({ isGlobal: true });

    let resultPrivateMedia = await mediaNote.find({ chat: id });
    let resultPublicMedia = await mediaNote.find({ isGlobal: true });

    // filter the notes that are not global
    resultPrivate = resultPrivate.filter(note => note.isGlobal != true);
    resultPrivateMedia = resultPrivateMedia.filter(note => note.isGlobal != true);

    // combine the notes
    let globalNotes = [...resultPublic, ...resultPublicMedia];
    let privateNotes = [...resultPrivate, ...resultPrivateMedia];

    if (globalNotes.length === 0 && privateNotes.length === 0)
        return sock.sendMessage(id, { text: "לא קיימות הערות" }).then(messageRetryHandler.addMessage);

    // create the message
    let str = "";
    if (privateNotes.length !== 0) {
        str += "*הערות בצ'אט זה:*\n"
        for (let note of privateNotes)
            str += note.q + "\n";
        str += "\n";
    }
    if (globalNotes.length !== 0) {
        str += `*הערות גלובליות:*\n`;
        for (let note of globalNotes)
            str += note.q + "\n";
        str += "\n";
    }

    str += "\nניתן לגשת להערה על ידי # או על ידי הפקודה !get";

    return sock.sendMessage(id, { text: str }).then(messageRetryHandler.addMessage);
}

/**
 * activate by the command ```!get <note name>``` or ```#<note name>```
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg
 * @param {import('@adiwajshing/baileys').WASocket} sock
*/
NoteHendler.prototype.getNote1 = async function (msg, sock) {
    let id = msg.key.remoteJid;

    let msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    let q = msgText.replace("#", "").split(" ")[0] || msgText.split(" ")[1];
    if (!q) return sock.sendMessage(id, { text: "אופס... נראה ששכחת לכתוב את שם ההערה" });

    // note with text
    let result = await savedNotes.findOne({ q: q, chat: id });
    if (result) return sock.sendMessage(id, { text: result.a }).then(messageRetryHandler.addMessage);

    result = await savedNotes.findOne({ q: q, isGlobal: true });
    if (result) return sock.sendMessage(id, { text: result.a }).then(messageRetryHandler.addMessage);

    // note with media
    let resultMedia = await mediaNote.findOne({ q: q, chat: id });
    if (!resultMedia) resultMedia = await mediaNote.findOne({ q: q, isGlobal: true });

    // note not found
    if (!result && !resultMedia) return sock.sendMessage(id, { text: "אופס... אין הערה בשם זה" }).then(messageRetryHandler.addMessage);

    // send the media
    switch (resultMedia.type) {
        case MsgType.IMAGE:
            return sock.sendMessage(id, { image: resultMedia.buffer, mimetype: resultMedia.mimetype })
                .then(messageRetryHandler.addMessage);
        case MsgType.VIDEO:
            return sock.sendMessage(id, { video: resultMedia.buffer, mimetype: resultMedia.mimetype })
                .then(messageRetryHandler.addMessage);
        case MsgType.AUDIO:
            return sock.sendMessage(id, { audio: resultMedia.buffer, mimetype: resultMedia.mimetype })
                .then(messageRetryHandler.addMessage);
        case MsgType.STICKER:
            return sock.sendMessage(id, { sticker: resultMedia.buffer, mimetype: resultMedia.mimetype })
                .then(messageRetryHandler.addMessage);
        case MsgType.DOCUMENT:
            return sock.sendMessage(id, { document: resultMedia.buffer, mimetype: resultMedia.mimetype, fileName: resultMedia.fileName })
                .then(messageRetryHandler.addMessage);
    }
}

/**
 * 
 * @param {String} id 
 * @returns {String | undefined}
 */
function getFeder(id) {
    return GLOBAL.groupConfig?.[id]?.feder
}
