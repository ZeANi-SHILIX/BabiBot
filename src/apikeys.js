const mongoose = require("mongoose");

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

module.exports  = mongoose.model("APIKeys", apiKeys);