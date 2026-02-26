/**
 * ELITE LEAGUE - Official Engine
 * Handling: Firebase Realtime Database, Agora RTC, and Centered Modals
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";

// 1. FIREBASE INITIALIZATION
const firebaseConfig = {
    apiKey: "AIzaSyDsxf_2FkvyfU2QQsd_DBytd9pPi6r4o0k",
    authDomain: "learning-pro-f756e.firebaseapp.com",
    projectId: "learning-pro-f756e",
    storageBucket: "learning-pro-f756e.firebasestorage.app",
    messagingSenderId: "410163553623",
    appId: "1:410163553623:web:10fceb9616086fe9640a12",
    measurementId: "G-RXKDXG4J84"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 2. CONFIGURATION & STATE
const AGORA_APP_ID = "6b0b36a41dae4815b0d440836a4fb1f6"; // Must paste your ID from Agora Console
const CHANNEL = "EliteLeagueFinals";
const ADMIN_PIN = "2026"; 

let client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
let localTracks = { videoTrack: null, audioTrack: null };
let isStreaming = false;

// 3. UI & MODAL MANAGEMENT (Global Scope)
window.openModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('hidden');
};

window.closeModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
};

// 4. ADMIN AUTHENTICATION
window.verifyAdmin = function() {
    const pin = document.getElementById('pinInput').value;
    if (pin === ADMIN_PIN) {
        window.closeModal('pinModal');
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('loginBtn').innerText = "DASHBOARD";
        document.getElementById('loginBtn').classList.add('bg-amber-500', 'text-black');
    } else {
        alert("ACCESS DENIED: PIN incorrect.");
        document.getElementById('pinInput').value = "";
    }
};

// 5. BROADCASTER LOGIC (Admin Camera)
window.toggleStream = async function() {
    const btn = document.getElementById('streamToggleBtn');
    
    if (!isStreaming) {
        try {
            client.setClientRole("host");
            await client.join(AGORA_APP_ID, CHANNEL, null, null);
            
            // Audio + Video capture
            localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
                encoderConfig: "720p_1" 
            });
            
            // Show preview and publish
            localTracks.videoTrack.play("local-player");
            await client.publish(Object.values(localTracks));
            
            isStreaming = true;
            btn.innerText = "STOP FEED";
            btn.classList.add('bg-red-600', 'text-white');
            
            // Update status in Firebase
            set(ref(db, 'streamStatus/admin1'), { live: true, lastSeen: Date.now() });
            
        } catch (e) {
            console.error("Camera Initialization Failed:", e);
            alert("Could not start camera. Please check browser permissions.");
        }
    } else {
        // Hard stop for the tournament simplicity
        location.reload(); 
    }
};

// 6. GLOBAL ALERTS (Firebase Push)
window.sendPushAlert = function() {
    set(ref(db, 'globalAlert'), {
        title: "GAME BEGAN! 🏆",
        message: "The Elite League Finals are live. Join the stream now!",
        timestamp: Date.now()
    });
};

// Listen for Database Alerts (Every device runs this)
onValue(ref(db, 'globalAlert'), (snapshot) => {
    const data = snapshot.val();
    // Only show if the alert happened in the last 15 seconds
    if (data && (Date.now() - data.timestamp < 15000)) {
        document.getElementById('alertTitle').innerText = data.title;
        document.getElementById('alertMsg').innerText = data.message;
        window.openModal('alertModal');
        
        if (Notification.permission === "granted") {
            new Notification(data.title, { body: data.message });
        }
    }
});

// 7. VIEWER LOGIC (Student Connection)
async function startViewer() {
    try {
        client.setClientRole("audience");
        await client.join(AGORA_APP_ID, CHANNEL, null, null);

        client.on("user-published", async (user, mediaType) => {
            await client.subscribe(user, mediaType);
            
            if (mediaType === "video") {
                document.getElementById('standby-ui').classList.add('hidden');
                document.getElementById('statusIndicator').classList.add('bg-red-600');
                user.videoTrack.play("remote-player");
            }
            if (mediaType === "audio") {
                user.audioTrack.play();
            }
        });

        client.on("user-unpublished", (user) => {
            // Admin left the stream - Show centered alert
            document.getElementById('standby-ui').classList.remove('hidden');
            document.getElementById('statusIndicator').classList.remove('bg-red-600');
            
            document.getElementById('alertTitle').innerText = "Stream Paused";
            document.getElementById('alertMsg').innerText = "The admin has disconnected. Please wait for reconnection.";
            window.openModal('alertModal');
        });

    } catch (e) {
        console.warn("Viewer connection standby...");
    }
}

// 8. INITIALIZATION
window.onload = () => {
    startViewer();
    
    // Bind buttons (since modules isolate scope)
    document.getElementById('submitPin').onclick = window.verifyAdmin;
    document.getElementById('pushAlertBtn').onclick = window.sendPushAlert;
    document.getElementById('streamToggleBtn').onclick = window.toggleStream;
    document.getElementById('closeAlert').onclick = () => window.closeModal('alertModal');
    
    // Request notification access
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
};