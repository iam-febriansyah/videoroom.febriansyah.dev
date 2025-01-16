"use client"
import React, { createContext, useContext, useState, ReactNode } from "react";

interface GlobalContextType {
    myMic: boolean;
    setMyMic: (value: boolean) => void;
    myVideo: boolean;
    setMyVideo: (value: boolean) => void;
}

const GlobalContext = createContext<GlobalContextType | null>(null);

export const GlobalProvider = ({ children }: { children: ReactNode }) => {
    const [myMic, setMyMic] = useState(false);
    const [myVideo, setMyVideo] = useState(false);

    return (
        <GlobalContext.Provider
            value={{
                myMic,
                setMyMic,
                myVideo,
                setMyVideo,
            }}
        >
            {children}
        </GlobalContext.Provider>
    );
};

export const useGlobalContext = () => {
    const context = useContext(GlobalContext);
    if (!context) {
        throw new Error("useGlobalContext must be used within a GlobalProvider");
    }
    return context;
};
