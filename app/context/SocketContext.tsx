/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import React, { createContext, useContext, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useSearchParams } from 'next/navigation';

const SocketContext = createContext<any>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const isCallActive = useRef<boolean>(false);
  const socket = useRef<Socket | null>(null);
  const usernameRef = useRef<HTMLInputElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRefs = useRef<{ [key: string]: MediaStream }>({});
  const searchParams = useSearchParams();
  const group_id = searchParams.get('group_id') ? searchParams.get('group_id') == '' ? null : searchParams.get('group_id') : null;

  const peerConnectionConfig = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302',
            ],
        },
    ],
  };

  useEffect(() => {
    socket.current = io(process.env.URL_SOCKET || "http://localhost:3001");
    socket.current.on("connect", async () => {
      console.log("Socket connected:", socket.current?.id);
    });
    socket.current?.on("disconnect", async () => {
        console.log("Socket has been disconnected");
    });
    socket.current?.on("message", async (message, username) => {
      console.log(message, username)
      await handleMessage(message, username)
    });
    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, []);

  function _listener(){
    socket.current?.on('join', (groupId) => {
      console.log(`Incoming request to join room ${groupId}`)
    });
    socket.current?.on('joined', (groupId, username) => {
      console.log(`You (local) joined ${groupId} as ${username}`)
    });
  }

  async function getLocalStream() {
    if (!group_id || !usernameRef.current || usernameRef.current.value == '') { return; }
    return navigator.mediaDevices
        .getUserMedia({ audio: true, video: { width: 640, height: 480 }})
        .then((stream) => {
            localStreamRef.current = stream;
            if(localVideoRef.current){
              localVideoRef.current.srcObject = stream;
              localVideoRef.current.play();
            }
            gotStream();
            return stream;
        })
        .catch(() => {
            console.warn("Can't get usermedia");
        });
  }

  function gotStream() {
    if (group_id) {
        _sendMessage({ type: 'gotstream' }, null, group_id);
    }
  }

  async function _connect(username : any, from : any) {
    try {
      console.log('Connecting', username)
      if (localStreamRef.current && localVideoRef.current) {
        _createPeerConnection(username);
        localStreamRef.current.getTracks().forEach((track : any) => {
          if(localStreamRef.current){
            peerConnections.current[username].addTrack(track, localStreamRef.current);
          }
        });
        await _makeOffer(username);
      }else{
        console.log('_connect have', localStreamRef.current, localVideoRef.current)
      }
    } catch (error) {
      console.error(from, error)
    }
  }

  function _createPeerConnection(username : any) {
    try {
        if(!username){
          return;
        }
        if (peerConnections.current[username]) {
            console.warn('Connection with ', username, ' already established'); return;
        }
        peerConnections.current[username] = new RTCPeerConnection(peerConnectionConfig);
        peerConnections.current[username].onicecandidate = (event: any) => {
          _handleIceCandidate(username, event);
        };
        peerConnections.current[username].ontrack = (event: any) => {
          _handleOnTrack(username, event);
        };
        console.log('Created RTCPeerConnnection for ', username);
    } catch (error) {
      console.warn('_createPeerConnection', username, error);
    }
  }

  async function _makeOffer(username : any) {
    try {

        if (peerConnections.current[username].signalingState === 'have-remote-offer') {
          console.warn('Simultaneous offers detected, restarting the connection');
          peerConnections.current[username].restartIce(); // Restart the ICE negotiation.
          await peerConnections.current[username].setLocalDescription(await peerConnections.current[username].createAnswer());
          _sendMessage(peerConnections.current[username].localDescription, username, null);
          return;
        }

        if (peerConnections.current[username].signalingState !== 'stable') {
            console.error(`_makeOffer: Cannot create an offer. Current signaling state is ${peerConnections.current[username].signalingState}`);return;
        }

        const offer = await peerConnections.current[username].createOffer();
        await peerConnections.current[username].setLocalDescription(offer);

        const sessionDescription = peerConnections.current[username].localDescription;
        console.log('_makeOffer', 'sessionDescription', sessionDescription)
        _sendMessage(sessionDescription, username, null);

        console.log('_makeOffer', username);
    } catch (error) {
        console.log(peerConnections.current[username])
        console.error('_makeOffer', username, error);
    }
  }

  function _handleIceCandidate(username : any, event : any) {
    console.log('_handleIceCandidate', username, event)
    if (event.candidate) {
        _sendMessage(
            {
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate,
            },
            username,
            null
        );
    }
  }

  function _handleOnTrack(username : any, event : any) {
    console.log('_handleOnTrack', username)
    if (remoteStreamRefs.current[username]?.id !== event.streams[0].id) {
        remoteStreamRefs.current[username] = event.streams[0];

        const stream = event.streams[0];
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        remoteVideoRefs.current[username] = video;

        // if(!remoteVideoRefs.current[username] && username !== usernameRef.current?.value){

        // }
        console.log('_handleOnTrack', remoteVideoRefs.current);
    }
  }

  function _sendMessage(message : any, toId : string | null, group_id : string | null) {
    socket.current?.emit('message', message, toId, group_id);
  }

  function _answer(username : any) {
    peerConnections.current[username].createAnswer().then((sessionDescription) => {
      console.log('answer', sessionDescription)
      _sendMessage(sessionDescription, username, null);
    })
  }

  async function handleMessage(message : any, username: any){
    console.log(message, username)
    if (peerConnections.current[username] && peerConnections.current[username].connectionState === 'connected') {
      console.log( 'Connection with ', username, 'is already established');return;
    }

    if (message.type === 'leave') {
      removePeerConnection(username)
      socket.current?.emit('leave', username);return;
    }
    switch (message.type) {
      case 'gotstream':
        _connect(username, message.type);
        break;
      case 'offer':
        if (!peerConnections.current[username]) {
            _connect(username, message.type);
        }
        // if (peerConnections.current[username].signalingState !== 'stable') {
        //   console.warn(`PeerConnection for ${username} is in ${peerConnections.current[username].signalingState} state. Restarting ICE.`);
        //   peerConnections.current[username].restartIce();
        // }
        await peerConnections.current[username].setRemoteDescription(new RTCSessionDescription(message));
        _answer(username);
        break;
      case 'answer':
        peerConnections.current[username].setRemoteDescription(new RTCSessionDescription(message));
        break;
      case 'candidate':
        const candidate = new RTCIceCandidate({ sdpMLineIndex: message.label, candidate: message.candidate});
        peerConnections.current[username].addIceCandidate(candidate);
        break;
      case 'leave' :
        removePeerConnection(username);
        break;
      case 'new_owner' :
        console.log('owner', username)
        break;
    }
  }

  const startCall = async (username: string) => {
    if(!group_id || !socket.current || !localVideoRef.current) return;
    try {
        socket.current.emit("register", { username, group_id });
        isCallActive.current = true;
        getLocalStream();
        _sendMessage({ type: 'gotstream' }, username, group_id);
        _listener();
    } catch (error) {
        console.error("Error accessing media devices:", error);
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
