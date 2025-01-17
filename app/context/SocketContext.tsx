/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSearchParams } from 'next/navigation';

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
  const searchParams = useSearchParams();
  const group_id = searchParams.get('group_id') ? searchParams.get('group_id') == '' ? null : searchParams.get('group_id') : null;
//   const [remoteVideos, setRemoteVideos] = useState<{ [key: string]: HTMLVideoElement }>({});
  const [remoteVideos, setRemoteVideos] = useState<Record<string, HTMLVideoElement>>({});
    

  useEffect(() => {
    socket.current = io(process.env.URL_SOCKET || "http://localhost:3001");
    socket.current.on("connect", () => {
        console.log("Socket connected:", socket.current?.id);
    });
    socket.current.on("updateUserList", async (userList: string[]) => {
        if(!group_id) return;
        userActive.current = userList;
        await updateUsers();
    });
    socket.current.on("disconnect_user", async (username: string) => {
        removePeerConnection(username);
    });
    socket.current?.on("disconnect", async () => {
        console.log("Socket has been disconnected");
        await updateUsers();
    });

    socket.current.on("signal", async (data) => {
      if (!group_id || !data.signalData) return;

      const { from, signalData } = data;
      const { type, candidate, sdp } = signalData;
      const peerConnection = peerConnections.current[from];

      if (type === "candidate") {
        if (peerConnection) {
          try {
            console.log(type, from, peerConnection.signalingState)
            if ((!peerConnection.remoteDescription || !peerConnection.remoteDescription.type)) {
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
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (error) {
            console.error("Error adding ICE candidate:", error);
          }
        }
      }

      if (type === "offer") {
        console.log(type, from, peerConnection.signalingState)
        if (peerConnection) {
          try {
            if (peerConnection.signalingState == 'stable') {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                socket.current?.emit("signal", { from : usernameRef.current?.value, group_id : group_id, signalData: { type: "answer", sdp: answer } });
            }else if (peerConnection.signalingState === "have-local-offer") {
                // Wait for the negotiation to finish
                console.warn(`PeerConnection is still negotiating. Waiting for remote description...`);
                peerConnection.onnegotiationneeded = async () => {
                    try {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
                        const answer = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answer);
                        socket.current?.emit("signal", {
                            from: usernameRef.current?.value,
                            group_id: group_id,
                            signalData: { type: "answer", sdp: answer },
                        });
                    } catch (error) {
                        console.error("Error during negotiation:", error);
                    }
                };
            }else{
                console.warn(`PeerConnection signaling state not stable: ${peerConnection.signalingState}`);
            }
          } catch (error) {
            console.error("Error handling offer:", error);
          }
        }
      }

      if (type === "answer") {
        console.log(type, from, peerConnection.signalingState)
        if (peerConnection) {
          try {
            if (peerConnection.signalingState === "have-local-offer") {
                console.log("answer",peerConnection.connectionState)
                await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
            }else{
                console.warn(`Unexpected state for setting answer: ${peerConnection.signalingState}`);
            }
          } catch (error) {
            console.error("Error setting remote description:", error);
          }
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
    if(!group_id || !socket.current || !localVideoRef.current) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play();
        isCallActive.current = true;
        socket.current.emit("register", { username, group_id });
    } catch (error) {
        console.error("Error accessing media devices:", error);
    }
  };

  const updateUsers = async () => {
    if(!group_id) return;
    const users = userActive.current ?? [];
    // console.log('total member', users.length)
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

            // Handle ICE candidates
            peerConnection.onicecandidate = async (event) => {
                if (event.candidate) {
                    socket.current?.emit("signal", {
                        from : user,
                        group_id: group_id,
                        signalData: { type: "candidate", candidate: event.candidate }
                    });
                }
            };

            peerConnection.onsignalingstatechange = () => {
                console.log(`Signaling state changed : ${user} ${peerConnection.signalingState}`);
            }

            // Handle remote tracks (video)
            peerConnection.ontrack = (event) => {
                const remoteVideo = document.createElement("video");
                remoteVideo.srcObject = event.streams[0];
                remoteVideo.autoplay = true;
                remoteVideo.playsInline = true;
                remoteVideo.muted = true;
                const userId = user;
                if(!remoteVideoRefs.current[userId] && userId !== usernameRef.current?.value){
                    remoteVideoRefs.current[userId] = remoteVideo;
                }
            };

            peerConnections.current[user] = peerConnection;

            // Create offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            socket.current?.emit("signal", {
                from : user,
                group_id: group_id,
                signalData: { type: "offer", sdp: offer },
            });
        }
    });

    try {
        setRemoteVideos({ ...remoteVideoRefs.current });
    } catch (error) {
        console.error(error)
    }
  };

  const stopCall = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const tracks = (localVideoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      localVideoRef.current.srcObject = null;
    }
    if (socket.current) {
        socket.current.emit("disconnect_user");
    }
    isCallActive.current = false;
  };

  const removePeerConnection = (removeUser: string) => {
    if (peerConnections.current[removeUser]) {
      peerConnections.current[removeUser].close();
      delete peerConnections.current[removeUser];
      if (remoteVideoRefs.current[removeUser]) {
        delete remoteVideoRefs.current[removeUser];
        setRemoteVideos({ ...remoteVideoRefs.current }); 
      }
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

  const setUsername = (val: HTMLInputElement | null) => {
    usernameRef.current = val;
  };

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
        stopGroupCall,
        remoteVideos
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
