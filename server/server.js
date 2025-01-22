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
      is_owner : { type: String, required: true },
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

const createOrUpdateUser = async (username, group_id, is_owner, id_socket, active) => {
  try {
    await UserTable.findOneAndUpdate(
      { username },
      { username, group_id, is_owner, id_socket, active },
      { upsert: true, new: true }
    );
    return await getAllUsers(group_id);
  } catch (error) {
    console.error("Error save/update user:", error.message);
    return false;
  }
};

const setOwner = async (username, group_id, is_owner, id_socket) => {
  try {
    return await UserTable.findOneAndUpdate(
      { username },
      { username, group_id, is_owner, id_socket },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("Error setOwner user:", error.message);
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

const getUserByUsernameGroupId = async (username, group_id) => {
  try {
    const user = await UserTable.findOne({ group_id : group_id, username : username });
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

const getUserByUsername = async (username) => {
  try {
    const user = await UserTable.findOne({ username : username });
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

const getUserByGroupId = async (group_id) => {
  try {
    const user = await UserTable.findOne({ group_id});
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

const checkHaveOwner = async (group_id) => {
  try {
    const user = await UserTable.findOne({ group_id, is_owner : '1'});
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

async function socketRegister(socket, io, data) {
  var { username, group_id } = data;
  if (!username || !group_id) {
    console.error("Invalid register data:", data);
    io.to(socket.id).emit("register_failed", "Invalid username / group_id");
    return;
  }

  try {
    var is_owner = '0';
    var members = await getAllUsers(group_id);
    if(members.length == 0){
      is_owner = '1';
    }

    const user = await createOrUpdateUser(username, group_id, is_owner, socket.id, '1');
    if (!user) {
      io.to(socket.id).emit("register_failed", "Error registering user");
      return;
    }

    socket.join(group_id);
    if(is_owner == '0'){
      io.in(group_id).emit('join', group_id); // Notify users in room
      io.to(socket.id).emit('joined', group_id, username); // Notify client that they joined a room
      console.log('socketRegister', 'A new member joined ', username, socket.id)
    }else{
      socket.emit('created', group_id, username);
      console.log('socketRegister', 'A new group created ', username, socket.id)
    }
  } catch (error) {
    console.error("Error during registration:", error.message);
    io.to(socket.id).emit("register_failed", "Error registering user");
  }
}

async function disconnectUser(socket_id) {
  try {
    const user = await getUserBySocketId(socket_id);
    if (user) {
      await createOrUpdateUser(user.username, '', '0', user.username, '0');
      socket.leave(user.group_id);
      return user;
    }
    return false;
  } catch (error) {
    console.error("Error during disconnectUser:", error.message);
  }
}

async function kickUser(socket, data) {
  try {
    var { username, group_id } = data
    const user = await getUserBySocketId(socket.id);
    if (user) {
      if(user.is_owner == '1'){
        const userKick = await getUserByUsernameGroupId(username, group_id);
        if(userKick){
          await createOrUpdateUser(userKick.username, '', '0', '', '0');
          socket.leave(userKick.group_id);
          return userKick;
        }
      }
    }
    return false;
  } catch (error) {
    console.error("Error during kickUser:", error.message);
  }
}

async function broadcastLeave(socket, group_id, username) {
  socket.broadcast.to(group_id).emit('message', { type: 'leave' }, username);
  var checkOwner = await checkHaveOwner(group_id);
  if(checkOwner){
    var ownerSoon = await getUserByGroupId(group_id);
    if(ownerSoon){
      var result = await setOwner(ownerSoon.username, ownerSoon.group_id, '1', ownerSoon.socket_id);
      if(result){
        socket.broadcast.to(group_id).emit('message', { type: 'new_owner' }, ownerSoon.username);
      }
    }
  }
}

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("register", async ({ username, group_id }) => {
    await socketRegister(socket, io, {username, group_id})
  });

  socket.on('message', async (message, toId = null, group_id = null) => {
    const user = await getUserBySocketId(socket.id);
    console.log(message, 'from', user.username)
    if (toId) {
        const toIdUser = await getUserByUsername(toId);
        if(toIdUser){
          console.log('message toId', toIdUser.username, message)
          io.to(toIdUser.id_socket).emit('message', message, user.username);
        }
    } else if (group_id) {
        console.log('message group_id', group_id, message)
        socket.broadcast.to(group_id).emit('message', message, user.username);
    } else {
        socket.broadcast.emit('message', message, user.username);
    }
  });

  socket.on("disconnect_user", async () => {
    var user = await disconnectUser(socket.id)
    await broadcastLeave(socket, user.group_id, user.username);
  });

  socket.on("disconnect", async () => {
    var user = await disconnectUser(socket.id)
    if(user){
      await broadcastLeave(socket, user.group_id, user.username);
    }
  });

  socket.on("kick", async (username, group_id) => {
    var user = await kickUser(socket, {username, group_id})
    if(user){
      await broadcastLeave(socket, user.group_id, user.username);
    }
  });

  socket.on("leave", async (username) => {
    var userActive = await getUserByUsername(username);
    if(userActive){
      var socket_id = userActive.socket_id;
      var user = await disconnectUser(socket_id)
      if(user){
        await broadcastLeave(socket, user.group_id, user.username);
      }
    }
  });

  socket.on('disconnecting', () => {
    socket.rooms.forEach(async (group_id) => {
        if (group_id === socket.id) return;
        var user = await getUserBySocketId(socket.id)
        socket.broadcast.to(group_id).emit('message', { type: 'leave' }, user.username);
    });
  });

});

app.get("/", (req, res) => {
  res.send("WebRTC Signaling Server is running");
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
