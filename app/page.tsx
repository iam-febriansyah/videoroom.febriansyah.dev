"use client"
import React, { useRef, useState } from 'react';
import { useSocketContext } from './context/SocketContext'; 

export default function Home() {
    const { socket, startCall, stopCall, localVideoRef, remoteVideoRefs, setUsername, usernameRef } = useSocketContext();
    const handleStartCall = () => {
        const username = usernameRef.current?.value;
        if (username) {
            startCall(username);
        }
    };

  return (
    <div>
        <input ref={usernameRef} type="text" placeholder="Enter your username" />
        <div className="max-w-sm rounded-sm overflow-hidden shadow-sm bg-white">
            <video ref={localVideoRef} autoPlay muted/>
        </div>
        <div id="remote-videos">
            {Object.values(remoteVideoRefs.current).map((videoElement, index) => (
                <video key={index} ref={(el) => el && (videoElement = el)} autoPlay style={{ width: "300px" }} />
            ))}
        </div>
    </div>
  );
}
