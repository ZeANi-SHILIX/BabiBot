const mongoose = require("mongoose");

const Schema = mongoose.Schema;

/**
 * @param q question
 * @param a answer
 * @param chat where is saved
 * @param isGlobal can be used anywhere
 */
let savedNotes = new Schema(
    {
        q: {
            type: String,
            required: true,
        },
        a: {
            type: String,
            required: true,
        },
        chat: {
            type: String,
            require: true
        },
        isGlobal: {
            type: Boolean,
            required: false
        }
    },
    { collection: "Saved_Notes" }
);

module.exports  = mongoose.model("SavedNotes", savedNotes);