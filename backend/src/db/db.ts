import mongoose from "mongoose";

const url = "mongodb://localhost:27017/"; // MongoDB URL
export const connectToDatabase = async () => {
  try {
    console.log("connecting to db");
    await mongoose.connect(url, {
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });
    console.log(`Connected to MongoDB with Mongoose`);
  } catch (error) {
    console.error("Error connecting to MongoDB with Mongoose:", error);
    throw error;
  }
};
