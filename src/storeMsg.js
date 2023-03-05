const { proto } = require('@adiwajshing/baileys')

/** save msgs */
const store = {
    "ID" : [
        proto.WebMessageInfo
    ]
};
delete store.ID;

/** save temp msgs */
const tempStore = {
    "ID" : [
        proto.WebMessageInfo
    ]
};
delete tempStore.ID;

module.exports = {store , tempStore}