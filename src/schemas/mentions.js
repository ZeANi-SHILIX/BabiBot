import mongoose from "mongoose";

export const labelsDB = new mongoose.Schema(
    {
        label: {
            type: String,
            required: true,
        },
        jid: {
            type: String,
            required: false,
            default: null
        },
        users: {
            type: [String],
            required: true,
            default: []
        },
        text: {
            type: String,
            required: false,
        },
        federation: {
            type: [String],
            required: true,
            default: null
        }
    },
    { collection: "labels" }
);

export default mongoose.model("labelsDB", labelsDB);