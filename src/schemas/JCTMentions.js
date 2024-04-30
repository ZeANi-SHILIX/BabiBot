import mongoose from "mongoose";

const Schema = mongoose.Schema;


export const JCTDB = new Schema(
    {
        groups: {
            type: [String],
            required: true,
            default: []
        },

        federation: {
            type: String,
            required: true,
        }
    },
    { collection: "JCTDB" }
);

export default mongoose.model("JCTDB", JCTDB);