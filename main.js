const videosContainer = document.getElementById('videos');
const joinRoomButton = document.getElementById('joinRoom');
const roomIdInput = document.getElementById('roomId');

let localStream;
let peerConnection;
let signalingServer;
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
    signalingServer = new WebSocket(`wss://your.signaling.server?roomId=${roomId}`);

    signalingServer.onmessage = async message => {
        const data = JSON.parse(message.data);

        if (data.offer) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            signalingServer.send(JSON.stringify({ 'answer': answer }));
        } else if (data.answer) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.candidate) {
            try {
                await peerConnection.addIceCandidate(data.candidate);
            } catch (e) {
                console.error('Error adding received ice candidate', e);
            }
        }
    };

    startLocalStream();
}

function startLocalStream() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            const localVideo = createVideoElement('localVideo', true);
            localVideo.srcObject = stream;
            localStream = stream;
            initializePeerConnection();
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

function initializePeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);

    // Add local stream tracks to the peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            signalingServer.send(JSON.stringify({ 'candidate': event.candidate }));
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
}

// Function to create and send an offer
async function createOffer() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    signalingServer.send(JSON.stringify({ 'offer': offer }));
}
