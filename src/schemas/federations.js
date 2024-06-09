import mongoose from "mongoose";

export const federationsDB = new mongoose.Schema(
    {
        federation: {
            type: String,
            required: true,
        },
        groups: {
            type: [String],
            required: true,
            default: []
        },
        authorizedUsers: {
            type: [String],
            required: false,
            default: []
        }
    },
    { collection: "federationsDB" }
);

export default mongoose.model("federationsDB", federationsDB);