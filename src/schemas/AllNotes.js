import mongoose from "mongoose";

const Schema = mongoose.Schema;

/**
 * @param question question
 * @param answer text or base64
 * @param type
 * @param mimetype
 * @param fileName
 * @param caption
 * ##################
 *    access level
 * ##################
 * @param chat
 * @param federation if private, chat and federation will be equals
 */
export const allNotes = new Schema(
    {
        question: {
            type: String,
            required: true,
        },
        answer: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            required: true
        },
        mimetype: {
            type: String,
            required: false
        },
        fileName: {
            type: String,
            required: false
        },
        caption: {
            type: String,
            required: false
        },

        chat: {
            type: String,
            required: true,
        },
        federation: {
            type: String,
            required: true,
        }
    },
    { collection: "AllNotes" }
);

export default mongoose.model("AllNotes", allNotes);