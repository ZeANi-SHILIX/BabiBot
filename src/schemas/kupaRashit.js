import mongoose from "mongoose";

const Schema = mongoose.Schema;

/**
 * @param buffer sticker data
 * @param name name of sticker
 */
let kupaRashit = new Schema(
    {
        buffer: {
            type: Buffer,
            required: true,
        },
        name: {
            type: String,
            required: false,
        }
    },
    { collection: "kupaRashit" }
);

export default mongoose.model("kupaRashit", kupaRashit);