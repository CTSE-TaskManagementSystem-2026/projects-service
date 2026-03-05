import mongoose from "mongoose";

const MONGO_URI = 'mongodb+srv://admin:R0703318808n@cluster0.uioovnh.mongodb.net/projects-service'

if (!MONGO_URI) {
    throw new Error('Please define the MONGO_URI');
}

let cached = (global as any).mongoose;

if (!cached) {
    cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {

    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        cached.promise = mongoose.connect(MONGO_URI).then((mongoose) => {
            return mongoose;
        });
    }
    cached.conn = await cached.promise;
    return cached.conn;
}