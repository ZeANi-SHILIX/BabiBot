const url_begin = 'https://docs.google.com/spreadsheets/d/';
const url_end = '/gviz/tq?&tqx=out:json';
const ssid = process.env.MAILLIST || "";

import fetch from 'node-fetch';
import { sendCustomMsgQueue, sendMsgQueue } from '../src/QueueObj.js';

/**
 * 
 * @param {string} jid
 * @param {string} textMsg 
 * @returns 
 */
export async function getMailOf(jid, textMsg) {
    let contacts = await getMails();

    let searchText = textMsg.replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
        .replace(/[?]/g, "")
        .replace("בבקשהה", "").replace("בבקשה", "")
        .replace("המרצה ", "").replace("מרצה ", "")
        .replace("המתרגל ", "").replace("מתרגל ", "")
        .trim();

    if ((" " + searchText).includes(" דר "))
        searchText = searchText.replace("דר ", "")

    let arr_search = searchText.split(" ");
    console.log(arr_search)

    let contactsToSend = [];

    for (let contact of contacts) {
        if (arr_search.every(s => contact.mailName.includes(s) || contact.nickname.includes(s))) {
            contactsToSend.push(contact)
        }
    }

    if (contactsToSend.length > 0 && contactsToSend.length < 10)
        sendMsgQueue(jid, contactsToSend.map(c => c.mailName + ": " + c.mail).join("\n"))

    else if (jid.includes("s.whatsapp.net")) {
        if (contactsToSend.length === 0)
            sendMsgQueue(jid, `לא מצאתי את המייל המבוקש... נסה לחפש שוב במילים אחרות\n`
                + `(אם המייל חסר גם כאן ${url_begin}${ssid}\nנשמח אם תשלח לנו ונוסיף אותו)`)
        else
            sendMsgQueue(jid, `מצאתי ${contactsToSend.length} מיילים עבור ${searchText}\n`
                + `נסה לחפש באופן ממוקד יותר`)
    }
}

/**
 * @param {string} jid
 * @param {string} textMsg 
 */
export async function getPhoneNumberOf(jid, textMsg) {
    let contacts = await getMails();

    let searchText = textMsg.replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
        .replace(/[?]/g, "")
        .replace("בבקשהה", "").replace("בבקשה", "")
        .replace("המרצה ", "").replace("מרצה ", "")
        .replace("המתרגל ", "").replace("מתרגל ", "")
        .trim();

    if ((" " + searchText).includes(" דר "))
        searchText = searchText.replace("דר ", "")

    let arr_search = searchText.split(" ");
    console.log(arr_search)

    let contactsToSend = [];

    for (let contact of contacts) {
        if (!(contact.phone || contact.whatsapp)) continue;

        if (arr_search.every(s => contact.name.includes(s) || contact.nickname.includes(s) || contact.mailName.includes(s))) {
            contactsToSend.push({ vcard: makeVcard(contact) })
        }
    }

    if (contactsToSend.length)
        return sendCustomMsgQueue(jid, {
            contacts: {
                contacts: contactsToSend
            }
        })

    if (jid.includes("s.whatsapp.net")) {
        if (contactsToSend.length === 0)
            return sendMsgQueue(jid, "לא מצאתי מספרי טלפון התואמים לחיפוש שלך")

        //return sendMsgQueue(jid, "מצאתי " + contactsToSend.length + "מספרי טלפון התואמים לחיפוש שלך... נסה לחפש באופן ממוקד יותר")
    }
}

/**
 * 
 * @returns {Promise<{  mail: string, mailName: string, nickname: string,
 *                      phone: string, name: string, officeReceptionHours: string, 
 *                      phoneReceptionHours: string, location: string, whatsapp: string}[]>}
 */
async function getMails() {
    let url = `${url_begin}${ssid}${url_end}`;

    let res = await fetch(url);
    let data = await res.text();

    let json = JSON.parse(data.substr(47).slice(0, -2));

    let contacts = [];
    for (let mail of json.table.rows) {
        let contact = {
            mail: mail.c[0]?.v.split(":")[1]?.trim() || "",
            mailName: mail.c[0]?.v.split(":")[0]?.trim() || "",
            nickname: mail.c[1]?.v || "",
            phone: mail.c[2]?.v || "",
            name: mail.c[3]?.v || "",
            officeReceptionHours: mail.c[4]?.v || "",
            phoneReceptionHours: mail.c[5]?.v || "",
            location: mail.c[6]?.v || "",
            whatsapp: mail.c[7]?.v || "",
        }
        contacts.push(contact);
    }
    contacts.shift(); // remove the first row
    return contacts;
}

/**
 * 
 * @param {{mail: string, mailName: string, nickname: string,
 *          phone: string, name: string, officeReceptionHours: string,
 *          phoneReceptionHours: string, location: string, whatsapp: string}} contact 
 * @returns 
 */
function makeVcard(contact = {}) {

    let VCARD = 'BEGIN:VCARD\n' // metadata of the contact card
        + `VERSION:3.0\n`
        + `FN:${contact.name || ""}\n`
        + `ORG:JCT;\n`

    if (contact.whatsapp) {
        contact.whatsapp = contact.whatsapp.replace("0", "972").replace("-", "")
        VCARD += `TEL;type=CELL;type=VOICE;waid=${contact.whatsapp}:+${contact.whatsapp}\n`
    }

    let phones = contact.phone.split(",").map(p => p.trim());
    for (let phone of phones) {
        if (phone) VCARD += `TEL;type=WORK;type=VOICE: ${phone}\n`
    }

    if (contact.location) VCARD += `ADR;type=WORK:;;${contact.location};\n`

    if (contact.mail) VCARD += `EMAIL:${contact.mail}\n`

    VCARD += `END:VCARD`

    return VCARD;
}