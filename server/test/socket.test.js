import { expect } from "chai";
import { io as ioc } from "socket.io-client";
import { Server } from "socket.io";
import { createServer } from "http";
import express from "express";

describe("Socket.IO Chat Server", () => {
    let io, clientSocket, clientSocket2, httpServer;
    let onlineUsers;

    beforeEach((done) => {
        const app = express();
        httpServer = createServer(app);
        io = new Server(httpServer);
        onlineUsers = new Map();

        io.on("connection", (socket) => {
            socket.on("add-user", (userId) => {
                onlineUsers.set(userId, socket.id);
                socket.broadcast.emit("online-users", {
                    onlineUsers: Array.from(onlineUsers.keys()),
                });
            });

            socket.on("send-msg", (data) => {
                const sendUserSocket = onlineUsers.get(data.to);
                if (sendUserSocket) {
                    socket.to(sendUserSocket).emit("msg-recieve", {
                        from: data.from,
                        message: data.message,
                    });
                    const senderSocket = onlineUsers.get(data.from);
                    if (senderSocket) {
                        io.to(senderSocket).emit("delivered", {
                            messageId: data.message._id,
                        });
                    }
                }
            });

            socket.on("disconnect", () => {
                for (const [userId, socketId] of onlineUsers.entries()) {
                    if (socketId === socket.id) {
                        onlineUsers.delete(userId);
                        break;
                    }
                }
                socket.broadcast.emit("online-users", {
                    onlineUsers: Array.from(onlineUsers.keys()),
                });
            });
        });

        httpServer.listen(() => {
            const port = httpServer.address().port;
            clientSocket = ioc(`http://localhost:${port}`);
            clientSocket2 = ioc(`http://localhost:${port}`);
            clientSocket.on("connect", () => {
                clientSocket2.on("connect", done);
            });
        });
    });

    afterEach(() => {
        io.close();
        clientSocket.close();
        clientSocket2.close();
        httpServer.close();
    });

    it("should allow users to connect and be added to online users", (done) => {
        clientSocket.emit("add-user", "user1");
        clientSocket2.on("online-users", (data) => {
            expect(data.onlineUsers).to.deep.equal(["user1"]);
            done();
        });
    });

    it("should allow users to send and receive messages", (done) => {
        onlineUsers.set("user1", clientSocket.id);
        onlineUsers.set("user2", clientSocket2.id);

        const message = { _id: "msg1", text: "hello" };
        clientSocket.emit("send-msg", { from: "user1", to: "user2", message });

        clientSocket2.on("msg-recieve", (data) => {
            expect(data.from).to.equal("user1");
            expect(data.message.text).to.equal("hello");
            done();
        });
    });

    it("should notify sender when a message is delivered", (done) => {
        onlineUsers.set("user1", clientSocket.id);
        onlineUsers.set("user2", clientSocket2.id);

        const message = { _id: "msg2", text: "delivered test" };
        clientSocket.emit("send-msg", { from: "user1", to: "user2", message });

        clientSocket.on("delivered", (data) => {
            expect(data.messageId).to.equal("msg2");
            done();
        });
    });

    it("should notify other users when a user disconnects", (done) => {
        onlineUsers.set("user1", clientSocket.id);
        onlineUsers.set("user2", clientSocket2.id);

        clientSocket2.on("online-users", (data) => {
            expect(data.onlineUsers).to.deep.equal(["user2"]);
            done();
        });

        clientSocket.disconnect();
    });
});
