import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const URI = process.env.MONGOURL;
const connectDb = async (req, res) => {
    try {
        await mongoose.connect(URI);
        console.log("Connection successful.");
    } catch (error) {
        console.error(error);
        process.exit(0);
    }
};

export default connectDb;
