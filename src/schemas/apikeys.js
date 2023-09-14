import mongoose from "mongoose";

const Schema = mongoose.Schema;

let apiKeys = new Schema(
    {
        name: {
            type: String,
            required: true,
        },
        apikey: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            require: true
        },
        level: {
            type: Number,
            required: false
        }
    },
    { collection: "API_Keys" }
);

export default mongoose.model("APIKeys", apiKeys);