// eslint-disable @typescript-eslint/no-explicit-any
import dotenv from 'dotenv';
dotenv.config();
import mongoose from "mongoose";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

let UserTable;

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.URL_MONGO, { });
    const userSchema = new mongoose.Schema({
      username: { type: String, required: true, unique: true  },
      id_socket: { type: String, required: true, unique: true },
      group_id : { type: String, required: true },
      active : { type: String, required: true },
    });
    UserTable = mongoose.model("User", userSchema);
    await UserTable.updateMany( {}, { $set: { active: '0', group_id : '' } });
    console.log("Connected to MongoDB Atlas!");
  } catch (error) {
    console.error("Error connecting to MongoDB Atlas:", error.message);
    process.exit(1);
  }
};

const createOrUpdateUser = async (username, group_id, id_socket, active) => {
  try {
    await UserTable.findOneAndUpdate(
      { username },
      { username, group_id, id_socket, active },
      { upsert: true, new: true }
    );
    return await getAllUsers();
  } catch (error) {
    console.error("Error saving user:", error.message);
    return false;
  }
};

const getAllUsers = async (group_id) => {
  try {
    const user_db = await UserTable.find({ group_id, active: '1' });
    return user_db;
  } catch (error) {
    console.error("Error fetching users:", error.message);
  }
};

const getUserBySocketId = async (id_socket) => {
  try {
    const user = await UserTable.findOne({ id_socket });
    if (!user) {
      console.log("User not found");
      return false;
    } else {
      console.log("User found:", user);
      return user;
    }
  } catch (error) {
    console.error("Error fetching user:", error.message);
    return false;
  }
};


const connectMongo = async () => {
  await connectDB();
};

connectMongo();

const allowedOrigins = [
  process.env.URL_SOCKET,
  process.env.URL_CLIENT,
];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (allowedOrigins.includes(origin) || !origin) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (allowedOrigins.includes(origin) || !origin) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  })
);

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("register", async (data) => {
    const { username, group_id } = data;
    var users = await createOrUpdateUser(username, group_id, socket.id,  '1');
    io.emit("updateUserList", users.map(user => user.username));
  });

  socket.on("signal", async (data) => {
    const { signalData, to } = data;

    users = await getAllUsers();
    users = users.filter((user) => user.active === '1');

    if (signalData.type === "offer") {
      const fromUser = users.find(user => user.id_socket === socket.id);
      if(fromUser){
        console.log(`Received offer from ${fromUser.username}`);
        const toUser = users.find(user => user.username === to);
        if(toUser){
          io.to(toUser.id_socket).emit("signal", {
            from: fromUser.username,
            signalData,
          });
          console.log(`Sent offer to ${to}`);
        }
      }
    } else if (signalData.type === "answer") {
      const fromUser = users.find(user => user.id_socket === socket.id);
      if(fromUser){
        console.log(`Received answer from ${fromUser.username} to ${to}`);
        const toUser = users.find(user => user.username === to);
        if(toUser){
          io.to(toUser.id_socket).emit("signal", {
            from: fromUser.username,
            signalData,
          });
          console.log(`Sent offer to ${to}`);
        }
      }
    } else if (signalData.type === "candidate") {
      console.log(`Received ICE candidate from ${to}`);
      users.forEach((user) => {
        if (user.id_socket !== socket.id) {
          io.to(user.id_socket).emit("signal", {
            from: to,
            signalData,
          });
        }
      });
    } else {
      console.log("Unknown signal type");
    }
  });


  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    var user = await getUserBySocketId(socket.id);
    if(user){
      users.forEach((userBroadcast) => {
        if (userBroadcast.id_socket !== socket.id) {
          console.log("disconnect_user", user.username)
          io.to(userBroadcast.id_socket).emit("disconnect_user", user.username);
        }
      });
      await createOrUpdateUser(user.username, socket.id, '0');
      users = users.filter((user) => user.active == '1');
    }else{
      users = users.filter((user) => user.id_socket !== socket.id);
    }
    io.emit("updateUserList", users.map(user => user.username));
  });
});

app.get("/", (req, res) => {
  res.send("WebRTC Signaling Server is running");
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
