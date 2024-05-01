import mongoose from "mongoose";

export const federationDB = new mongoose.Schema(
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
    { collection: "federations" }
);

export default mongoose.model("federationsDB", federationDB);