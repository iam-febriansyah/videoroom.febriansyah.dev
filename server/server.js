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
    return await getAllUsers(group_id);
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

  socket.on("register", async ({ username, group_id }) => {

    if (!username || !group_id) {
      console.error("Invalid register data:", data);
      io.to(socket.id).emit("register_failed", "Invalid username / group_id");
      return;
    }

    try {
      const user = await createOrUpdateUser(username, group_id, socket.id, '1');
      if (!user) {
        io.to(socket.id).emit("register_failed", "Error registering user");
        return;
      }

      socket.join(group_id);
      const users = await getAllUsers(group_id);
      io.to(group_id).emit("updateUserList", users.map((user) => user.username));
      console.log(`User registered: ${username} in group ${group_id}`);
    } catch (error) {
      console.error("Error during registration:", error.message);
      io.to(socket.id).emit("register_failed", "Error registering user");
    }

  });

  socket.on("disconnect_user", async () => {
    const user = await getUserBySocketId(socket.id);
    if (user) {
      await createOrUpdateUser(user.username, user.group_id, socket.id, '0');
      const groupUsers = await getAllUsers(user.group_id);
      io.to(user.group_id).emit("disconnect_user", user.username);
      io.to(user.group_id).emit("updateUserList", groupUsers.map((u) => u.username));
      console.log(`${user.username} disconnected from group ${user.group_id}`);
    }
  });

  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    const user = await getUserBySocketId(socket.id);
    if (user) {
        await createOrUpdateUser(user.username, user.group_id, socket.id, '0');
        const groupUsers = await getAllUsers(user.group_id);
        io.to(user.group_id).emit("disconnect_user", user.username);
        io.to(user.group_id).emit("updateUserList", groupUsers.map((u) => u.username));
        console.log(`${user.username} disconnected from group ${user.group_id}`);
    }
  });

  socket.on("signal", async (data) => {
    const { from, signalData, group_id } = data;
    if (!signalData || !group_id) {
      console.error("Invalid signal data:", data);
      io.to(socket.id).emit("signal_failed", "Invalid signal data or group_id");
      return;
    }

    try {
      const users = await getAllUsers(group_id);
      const fromUser = users.find((user) => user.username === from);
      const { type, candidate, sdp } = signalData;

      if (!fromUser) {
        console.log(data)
        console.error("User not found for signaling. username : ", from);
        io.to(socket.id).emit("signal_failed", "User not found in group. username : "+from);
        return;
      }

      console.log(`Broadcasting ICE candidate from ${fromUser.username} to group ${group_id}`);

      if (type === "offer" || type === "answer" || type === "candidate") {
        io.to(group_id).emit("signal", { from : from, signalData: { type, candidate, sdp } });
        if(type == "candidate"){
          const groupUsers = await getAllUsers(group_id);
          io.to(group_id).emit("updateUserList", groupUsers.map((u) => u.username));
        }
        if(type == 'offer'){
          io.to(group_id).emit("update_videos", from);
        }
        console.log(`Signal ${type} from ${from} to group ${group_id}`);
      }
    } catch (error) {
      console.error("Error during signal handling:", error.message);
      io.to(socket.id).emit("signal_failed", "Error handling signal");
    }
  });

});

app.get("/", (req, res) => {
  res.send("WebRTC Signaling Server is running");
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
