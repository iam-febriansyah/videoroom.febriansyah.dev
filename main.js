const videosContainer = document.getElementById('videos');
const joinRoomButton = document.getElementById('joinRoom');
const roomIdInput = document.getElementById('roomId');

let localStream;
let peerConnection;
const socket = io('http://localhost:8080', { transports : ['websocket'] });
const configuration = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302'
        }
    ]
};

joinRoomButton.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        joinRoom(roomId);
    } else {
        alert('Please enter a room ID.');
    }
});

function joinRoom(roomId) {
    socket.emit('joinRoom', roomId);

    socket.on('offer', async (offer) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { answer, roomId });
    });

    socket.on('answer', async (answer) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('candidate', async (candidate) => {
        try {
            await peerConnection.addIceCandidate(candidate);
        } catch (e) {
            console.error('Error adding received ice candidate', e);
        }
    });

    startLocalStream(roomId);
}

function startLocalStream(roomId) {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            const localVideo = createVideoElement('localVideo', true);
            localVideo.srcObject = stream;
            localStream = stream;
            initializePeerConnection(roomId);
        })
        .catch(error => {
            console.error('Error accessing media devices.', error);
        });
}

function createVideoElement(id, isLocal = false) {
    const videoWrapper = document.createElement('div');
    const video = document.createElement('video');
    video.id = id;
    video.autoplay = true;
    video.playsInline = true;
    videoWrapper.appendChild(video);

    // Optionally add metadata
    const metadata = document.createElement('div');
    metadata.className = 'metadata';
    metadata.innerText = isLocal ? 'Local Stream' : `Remote Stream: ${id}`;
    videoWrapper.appendChild(metadata);

    videosContainer.appendChild(videoWrapper);
    return video;
}

function initializePeerConnection(roomId) {
    peerConnection = new RTCPeerConnection(configuration);

    // Add local stream tracks to the peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', { candidate: event.candidate, roomId });
        }
    };

    // Handle remote stream
    peerConnection.ontrack = event => {
        const remoteStreamId = `remoteVideo_${event.streams[0].id}`;
        let remoteVideo = document.getElementById(remoteStreamId);
        if (!remoteVideo) {
            remoteVideo = createVideoElement(remoteStreamId);
        }
        remoteVideo.srcObject = event.streams[0];
    };

    // Create and send an offer
    peerConnection.createOffer()
        .then(offer => {
            return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
            socket.emit('offer', { offer: peerConnection.localDescription, roomId });
        })
        .catch(error => {
            console.error('Error creating offer:', error);
        });

}

function toggleAudioById(streamId) {
    const videoElement = document.getElementById(streamId);
    if (videoElement && videoElement.srcObject) {
        const audioTracks = videoElement.srcObject.getAudioTracks();
        audioTracks.forEach(track => {
            track.enabled = !track.enabled;
        });
        console.log(audioTracks[0].enabled ? 'Audio enabled' : 'Audio disabled');
    } else {
        console.error(`Stream with ID ${streamId} not found or has no audio tracks.`);
    }
}

function toggleVideoById(streamId) {
    const videoElement = document.getElementById(streamId);
    if (videoElement && videoElement.srcObject) {
        const videoTracks = videoElement.srcObject.getVideoTracks();
        videoTracks.forEach(track => {
            track.enabled = !track.enabled;
        });
        console.log(videoTracks[0].enabled ? 'Video enabled' : 'Video disabled');
    } else {
        console.error(`Stream with ID ${streamId} not found or has no video tracks.`);
    }
}


var myId = localStorage.getItem("myId") === null ? genID() : '';
window.onload = function () {
    if (localStorage.getItem("myId") === null) {
        localStorage.setItem("myId", genID());
    }
}

function genID() {
    const timeStamp = Date.now();
    let str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let Id = '';
    for (let i = 0; i < 7; i++) {
        let rom = Math.floor(1 +(str.length -1)*Math.random());
        Id += str.charAt(rom);
    }
    Id += timeStamp.toString();
    return Id;
}
