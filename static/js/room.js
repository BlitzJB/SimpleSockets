const BASEURL = "https://ytmusic-interactions.blitzsite.repl.co";

const action = document.getElementById("action");
const state = document.getElementById("state");
const pauseplay = document.getElementById("play");
const seek = document.getElementById("seek");

const searchInput = document.getElementById("search");
const searchTrigger = document.getElementById("searchTrigger");
const searchResults = document.getElementById("searchResults");

const currentlyPlayingThumbnail = document.getElementById("thumbnail");
const currentlyPlayingTitle = document.getElementById("title");
const currentlyPlayingArtist = document.getElementById("artist");
const currentlyPlayingDuration = document.getElementById("currentDuration");
const currentlyPlayingTotalDuration = document.getElementById("totalDuration");

const enter = document.getElementById("enter").addEventListener("click", () => {
    document.querySelector(".enter__container").style.display = "none";
});

searchTrigger.addEventListener("click", () => {
    searchTrigger.innerHTML = "Searching...";
    fetch(`${BASEURL}/search?query=${searchInput.value.replace(" ", "+")}`)
        .then(res => res.json())
        .then(data => {
            searchResults.innerHTML = "";
            data.forEach(item => {
                const div = document.createElement("div");
                div.setAttribute("class", "result");
                div.innerHTML = `
                    <img src="${item.thumbnail.mini}" alt="">
                    <div class="result__info">
                        <p class="result__title">${item.title} - ${item['length']}</p>
                        <p class="result__artist">${item.artists.join(", ")}</p>
                    </div>
                `;
                div.dataset.title = item.title;
                div.addEventListener("click", () => {
                    triggerDownload(item.id, item);
                    updateCurrentlyPlaying(item);
                });
                searchResults.appendChild(div);
                searchTrigger.innerHTML = "Search";
            });
        });
    });
    
function updateCurrentlyPlaying(item) {
    currentlyPlayingThumbnail.src = item.thumbnail.mini;
    currentlyPlayingTitle.innerText = item.title;
    currentlyPlayingArtist.innerText = item.artists.join(", ");
    currentlyPlayingTotalDuration.innerText = item['length'];
}

const audio = new Audio();
let isplaying = false;

function randomString(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

const client = new Client('ws://localhost:8080', () => randomString(10), () => {
    // url is of form /room/roomId
    const url = window.location.pathname;
    const roomId = url.substring(url.lastIndexOf('/') + 1);
    return roomId;
});

document.title = `Room - ${client.roomId}`;


const pausedEvent = client.createEmitter("paused", (data) => {
    console.log("paused", data);
    audio.pause();
    pauseplay.innerHTML = "play";
    isplaying = false;
});

const playEvent = client.createEmitter("play", (data) => {
    console.log("play", data);
    audio.play();
    pauseplay.innerHTML = "pause";
    isplaying = true;
});

const seekEvent = client.createEmitter("seek", (data) => {
    console.log("seek", data);
    audio.currentTime = data.currentTime;
    if (data.paused) {
        audio.pause();
        pauseplay.innerHTML = "play";
        isplaying = false;
    } else {
        audio.play();
        pauseplay.innerHTML = "pause";
        isplaying = true;
    }
});



const download = client.createSyncedDownload(
    "songdownload",
    (item) => {
        pausedEvent.emit();
        updateCurrentlyPlaying(item);
    },
    (data) => {
        console.log("Finished Here", data);
        state.innerHTML = "Finished Here, Waiting for other clients..";
        audio.src = data;
    },
    (data) => {
        console.log("finished all", data);
        state.innerHTML = "Finished All";
        audio.src = data;
    }
);

function triggerDownload(id, item) {
    download.start(`${BASEURL}/download?video_id=${id}`, item);
}


audio.addEventListener("timeupdate", () => {
    if (audio.currentTime % .5 < .5) 
        seek.value = (audio.currentTime / audio.duration) * 100;
    currentlyPlayingDuration.innerText = `${Math.floor(audio.currentTime/60)}:${Math.floor(audio.currentTime%60)}`;
});

seek.addEventListener("change", () => {
    seekEvent.emit({
        currentTime: (seek.value/100) * audio.duration,
        paused: audio.paused
    });
});

pauseplay.addEventListener("click", () => {
    if (isplaying) {
        pausedEvent.emit();
    } else {
        playEvent.emit();
    }
    isplaying = !isplaying;
});