import mongoose from "mongoose";

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

export default mongoose.model("SavedNotes", savedNotes);