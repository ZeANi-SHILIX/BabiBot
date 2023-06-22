import mongoose from "mongoose";

const Schema = mongoose.Schema;

/**
 * @param q question
 * @param buffer media data
 * @param chat chat id
 * @param isGlobal is global note
 */
let mediaNote = new Schema(
    {
        q: {
            type: String,
            required: true,
        },
        buffer: {
            type: Buffer,
            required: true,
        },
        type: {
            type: String,
            required: true
        },
        mimetype: {
            type: String,
            required: true
        },
        fileName: {
            type: String,
            required: false
        }, 
        chat: {
            type: String,
            required: true,
        },
        isGlobal: {
            type: Boolean,
            required: false,
        }
    },
    { collection: "MediaNotes" }
);

module.exports = mongoose.model("MediaNotes", mediaNote);