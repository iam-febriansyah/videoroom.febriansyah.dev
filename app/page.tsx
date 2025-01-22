"use client"
import React, { useEffect } from 'react';
import { useSocketContext } from './context/SocketContext'; 


export default function Home() {
    const { remoteVideoRefs, localVideoRef, usernameRef } = useSocketContext();

    useEffect(() => {
        console.log(remoteVideoRefs);
    }, [remoteVideoRefs]);


    return (
        <div>
            <input ref={usernameRef} type="text" placeholder="Enter your username" />
            <div className="max-w-sm rounded-sm overflow-hidden shadow-sm bg-white">
                <video ref={localVideoRef} autoPlay muted/>
            </div>
            <div id="remote-videos">
            {Object.entries(remoteVideoRefs).map(([key, videoElement]) => (
                <div key={key} className="max-w-sm rounded-sm overflow-hidden shadow-sm bg-red-500">
                    <video
                    ref={(ref) => {
                        if (ref && videoElement.srcObject) {
                            ref.srcObject = videoElement.srcObject;
                        }
                    }}
                    autoPlay
                    playsInline

                    />
                </div>
            ))}
            </div>
        </div>
    );
}
