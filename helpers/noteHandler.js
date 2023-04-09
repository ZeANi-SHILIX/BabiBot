const { downloadMediaMessage } = require('@adiwajshing/baileys')

const savedNotes = require('../src/notes');
const mediaNote = require('../src/mediaNote');

const { MsgType, getMsgType } = require('./msgType');

const { store } = require('../src/storeMsg')

function NoteHendler() {
    this.savedNotes = savedNotes;
    this.mediaNote = mediaNote;
}
let noteHendler = new NoteHendler();


/**
 * activate by the command ```!note``` or ```!שמור```
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('@adiwajshing/baileys').WASocket} sock 
 * @param {Boolean} isGlobal optional, default is false
 * @param {boolean} issuperuser optional, default is null
 */
NoteHendler.prototype.saveNote = async function (msg, sock, isGlobal = false, issuperuser = null) {
    let id = msg.key.remoteJid;

    let msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    let q = msgText.split(" ")[1];
    if (!q) return sock.sendMessage(id, { text: "אופס... נראה ששכחת לכתוב את שם ההערה" });

    // check premissions
    if (isGlobal && issuperuser !== true)
        return sock.sendMessage(id, { text: "אופס... אין לך הרשאה לשמור הערה גלובלית" });

    let quoted;
    try {
        quoted = await store.loadMessage(id, msg.message?.extendedTextMessage?.contextInfo?.stanzaId);
    } catch (error) {
        console.log(error);
    }
    let { type, mime } = getMsgType(quoted);

    // ### text note ### (no quoted message or quoted message is text)
    if (type == MsgType.TEXT) {
        let a = msgText.split(" ").slice(2).join(" ") || msg.message.extendedTextMessage?.text || "";
        if (!a) return sock.sendMessage(id, { text: "אופס... נראה ששכחת לכתוב את תוכן ההערה" });

        // check if the note already exist in global or in the chat
        let result = await savedNotes.findOne({ q: q });

        if (result?.isGlobal || result?.chat === id)
            return sock.sendMessage(id, { text: "אופס... ההערה כבר קיימת במאגר" });

        return savedNotes.create({ q: q, a: a, chat: id, isGlobal: isGlobal }, (err, res) => {
            if (err) return sock.sendMessage(id, { text: "אופס... ההערה כבר קיימת במאגר" });

            sock.sendMessage(id, { text: "ההערה נשמרה בהצלחה" });
        });
    }

    // ### media note ###

    let buffer = await downloadMediaMessage(quoted, "buffer");

    // check if the buffer more than 15 mb
    let nameFile;
    if (type == MsgType.DOCUMENT) {
        nameFile = quoted.message.documentMessage.fileName;
        let size = buffer.length / 1024 / 1024;
        if (size > 15) return sock.sendMessage(id, { text: "אופס... הקובץ גדול מדי" });
    }

    mediaNote.create({
        q: q, buffer: buffer,
        type: type, mimetype: mime,
        fileName: nameFile,
        chat: id, isGlobal: isGlobal
    }, (err, res) => {
        console.log(res);
        if (err) return sock.sendMessage(id, { text: "אופס... ההערה כבר קיימת במאגר" });

        sock.sendMessage(id, { text: "ההערה נשמרה בהצלחה" });
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

    if (!q) return sock.sendMessage(id, { text: "אופס... נראה ששכחת לכתוב את שם ההערה" });

    let search = await savedNotes.find({ q: q });
    let searchMedia = await mediaNote.find({ q: q });

    // filter the notes
    search = search.filter(note => note.chat === id || note.isGlobal == true);
    searchMedia = searchMedia.filter(note => note.chat === id || note.isGlobal == true);

    if (search.length === 0 && searchMedia.length === 0)
        return sock.sendMessage(id, { text: "אופס... אין הערה בשם זה" });


    for (const note of search) {
        // check permissions
        if (note.isGlobal == true && issuperuser !== true)
            return sock.sendMessage(id, { text: "אופס... אין לך הרשאה למחוק הערה זו" });

        // delete the note
        savedNotes.deleteOne({ _id: search._id }, (err, res) => {
            if (err) return sock.sendMessage(id, { text: "אופס... משהו השתבש" });

            sock.sendMessage(id, { text: "ההערה נמחקה בהצלחה" });
        })
    }

    for (const note of searchMedia) {
        // check permissions
        if (note.isGlobal == true && issuperuser !== true)
            return sock.sendMessage(id, { text: "אופס... אין לך הרשאה למחוק הערה זו" });

        // delete the note
        mediaNote.deleteOne({ _id: searchMedia._id }, (err, res) => {
            if (err) return sock.sendMessage(id, { text: "אופס... משהו השתבש" });

            sock.sendMessage(id, { text: "ההערה נמחקה בהצלחה" });
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
        return sock.sendMessage(id, { text: "לא קיימות הערות" });

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

    return sock.sendMessage(id, { text: str });
}

/**
 * activate by the command ```!get <note name>``` or ```#<note name>```
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg
 * @param {import('@adiwajshing/baileys').WASocket} sock
*/
NoteHendler.prototype.getNote = async function (msg, sock) {
    let id = msg.key.remoteJid;

    let msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    let q = msgText.replace("#", "").split(" ")[0] || msgText.split(" ")[1];
    if (!q) return sock.sendMessage(id, { text: "אופס... נראה ששכחת לכתוב את שם ההערה" });

    // note with text
    let result = await savedNotes.findOne({ q: q, chat: id });
    if (result) return sock.sendMessage(id, { text: result.a });

    result = await savedNotes.findOne({ q: q, isGlobal: true });
    if (result) return sock.sendMessage(id, { text: result.a });

    // note with media
    let resultMedia = await mediaNote.findOne({ q: q, chat: id });
    if (!resultMedia) resultMedia = await mediaNote.findOne({ q: q, isGlobal: true });

    // note not found
    if (!result && !resultMedia) return sock.sendMessage(id, { text: "אופס... אין הערה בשם זה" });

    // send the media
    switch (resultMedia.type) {
        case MsgType.IMAGE:
            return sock.sendMessage(id, { image: resultMedia.buffer, mimetype: resultMedia.mimetype });
        case MsgType.VIDEO:
            return sock.sendMessage(id, { video: resultMedia.buffer, mimetype: resultMedia.mimetype });
        case MsgType.AUDIO:
            return sock.sendMessage(id, { audio: resultMedia.buffer, mimetype: resultMedia.mimetype });
        case MsgType.STICKER:
            return sock.sendMessage(id, { sticker: resultMedia.buffer, mimetype: resultMedia.mimetype });
        case MsgType.DOCUMENT:
            return sock.sendMessage(id, { document: resultMedia.buffer, mimetype: resultMedia.mimetype, fileName: resultMedia.fileName });
    }
}


exports = module.exports = noteHendler;