/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import React, { createContext, useContext, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const SocketContext = createContext<any>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const socket = useRef<Socket | null>(null);
  const usernameRef = useRef<HTMLInputElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const isCallActive = useRef<boolean>(false);
  const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});
  const userActive = useRef<string[]>([]);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    socket.current = io(process.env.URL_SOCKET || "http://localhost:3001");
    socket.current.on("connect", () => {
        console.log("Socket connected:", socket.current?.id);
    });
    socket.current.on("updateUserList", async (userList: string[]) => {
        userActive.current = userList;
        await updateUsers();
    });
    socket.current.on("disconnect_user", async (username: string) => {
        removePeerConnection(username)
    });
    socket.current?.on("disconnect", () => {
        console.log("Socket has been disconnected");
    });
    socket.current.on("signal", async (data) => {
        if (!data.signalData) return;
        if (data.signalData.type === 'offer') {
            const peerConnection = peerConnections.current[data.from];
            if (!peerConnection) {
                console.error("No peerConnection found for user:", data.from);
                return;
            }
            try {
                const sdp = data.signalData.sdp?.sdp;
                if (typeof sdp !== "string") {
                    console.error("Invalid SDP format. Expected a string, but got:", sdp);
                    return;
                }
                await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp }));
                console.log('peerConnection.signalingState',data.from, peerConnection.signalingState)
                if (peerConnection.signalingState === "have-remote-offer") {
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    socket.current?.emit("signal", {
                      to: data.from,
                      signalData: { type: "answer", sdp: answer },
                    });
                } else {
                    console.error("Peer connection is not in the correct state for creating an answer:", peerConnection.signalingState);
                }
            } catch (error) {
                console.error("Error handling the offer:", error);
            }
        }

        else if (data.signalData.type === 'candidate') {
            const peerConnection = peerConnections.current[data.from];
            if (!peerConnection) {
                console.error("No peerConnection found for user:", data.from);
                return;
            }

            if (!peerConnection.remoteDescription || !peerConnection.remoteDescription.type) {
                peerConnection.onnegotiationneeded = async () => {
                    try {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signalData));
                        await peerConnection.addIceCandidate(new RTCIceCandidate(data.signalData.candidate));
                    } catch (error) {
                        console.error('Error handling ICE candidate:', error);
                    }
                };
                return;
            }

            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.signalData.candidate));
            } catch (error) {
                console.error("Error adding ICE candidate:", error);
            }
        }
    });

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, []);

  const startCall = async (username: string) => {
    if (!socket.current || !localVideoRef.current) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play();
        isCallActive.current = true;
        socket.current.emit("register", username);
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
  };

  const updateUsers = async (groupId: string) =>{
    const users = userActive.current ?? [];
    users.forEach(async (user) => {
        let peerConnection = peerConnections.current[user];
        if(!peerConnection){
            peerConnection = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });

            // Add local tracks
            localStreamRef.current?.getTracks().forEach((track) => {
                if(localStreamRef.current){
                    peerConnection.addTrack(track, localStreamRef.current);
                }
            });

            peerConnection.oniceconnectionstatechange = () => {
                // console.log("ICE connection state:", peerConnection.iceConnectionState);
            };

            // Handle ICE candidates
            peerConnection.onicecandidate = async (event) => {
                if (event.candidate) {
                    socket.current?.emit("signal", {
                        to: user,
                        group: groupId,
                        signalData: { type : "candidate", candidate: event.candidate }
                    });
                }
            };

            // Handle remote tracks (video)
            peerConnection.ontrack = (event) => {
                console.log('ontrack', user, event)

                const remoteVideo = document.createElement("video");
                remoteVideo.srcObject = event.streams[0];
                remoteVideo.autoplay = true;
                const userId = user;
                remoteVideoRefs.current[userId] = remoteVideo;
            };
            peerConnections.current[user] = peerConnection;

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
                socket.current?.emit("signal", {
                to: user,
                group: groupId,
                signalData: { type: "offer", sdp: offer },
            });
        }else{
            console.log('peerConnection is exist', user)
        }
    });
    console.log('peerConnections.current', peerConnections.current)
    console.log('remoteVideoRefs.current', remoteVideoRefs.current)
  }

  const stopCall = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const tracks = (localVideoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      localVideoRef.current.srcObject = null;
    }
    if (socket.current) {
      socket.current.disconnect();
    }
    isCallActive.current = false;
  };

  const removePeerConnection = (removeUser: string) => {
    if (peerConnections.current[removeUser]) {
      peerConnections.current[removeUser].close();
      delete peerConnections.current[removeUser]; 
      console.log(`Peer connection for ${removeUser} removed`);
    }
  };

  const stopGroupCall = () => {
    Object.values(peerConnections.current).forEach((peerConnection) => {
      peerConnection.close();
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    peerConnections.current = {};
    userActive.current = [];
  };

  const setUsername = (val: HTMLInputElement | null) =>{
    usernameRef.current = val;
  }

  return (
    <SocketContext.Provider
      value={{
        socket: socket.current,
        startCall,
        stopCall,
        usernameRef,
        localVideoRef,
        remoteVideoRefs,
        setUsername,
        isCallActive,
        stopGroupCall
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

// Custom hook to use the SocketContext
export const useSocketContext = () => {
  return useContext(SocketContext);
};
