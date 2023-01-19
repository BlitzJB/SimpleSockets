class Client {
    constructor(wsUrl, idCallback, roomCallback, stateCallback = null) {
        this.id = idCallback();
        this.room = roomCallback();
        this.ws = new WebSocket(wsUrl);
        this.events = [];
        this.stateCallback = stateCallback ? stateCallback : () => null;
        this.mountListeners();
        this.downloads = [];
        this.heartbeatInterval = setInterval(() => {
            this.ws.send(this.buildMessage({ type: MESSAGES.HEARTBEAT }));
        }, 5000);
    }

    broadcast(data) {
        this.ws.send(this.buildMessage({
            type: MESSAGES.BROADCAST,
            payload: data,
            from: this.id,
        }));
    }

    buildMessage(data) {
        return JSON.stringify({
            id: this.id,
            room: this.room,
            data: data,
            state: this.stateCallback(),
            timestamp: Date.now(),
        })
    }

    mountListeners() {
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.messageReducer(message);
        }
    }

    messageReducer(message) {
        console.log(message);
        if (message.data.type === MESSAGES.ACKNOWLEDGE) {
            this.ws.send(this.buildMessage({ type: MESSAGES.JOIN}));
        } else if (message.data.type === MESSAGES.SYNCED_DOWNLOAD_START) {
            const download = this.downloads.find((download) => {
                return download.name === message.data.payload.uniqueName;
            });
            download.startCallback(message.data.payload.data);
            fetch(message.data.payload.resourceUrl).then((response) => {
                return response.blob();
            }).then((blob) => {
                const blobUrl = URL.createObjectURL(blob);
                download.finishedHereCallback(blobUrl);
                download.blobUrl = blobUrl;
                this.ws.send(this.buildMessage({
                    type: MESSAGES.SYNCED_DOWNLOAD_DONE,
                    payload: {
                        downloadId: message.data.payload.uniqueName,
                    },
                }));
            });
        } else if (message.data.type === MESSAGES.SYNCED_DOWNLOAD_ALL_DONE) {
            const download = this.downloads.find((download) => {
                return download.name === message.data.payload.uniqueName;
            })
            download.finishedAllCallback(download.blobUrl);
        }
        this.events.forEach((event) => {
            if (event.name === message.data.name) {
                event.respond(message.data.data);
            }
        })
    }

    createSyncedDownload(uniqueName, startCallback, finishedHereCallback, finishedAllCallback) {
        const download = new SyncedDownload({
            uniqueName: uniqueName,
            startCallback: startCallback, 
            finishedHereCallback: finishedHereCallback,
            finishedAllCallback: finishedAllCallback,
            client: this,
        });
        this.downloads.push(download);
        return download;
    }

    createEmitter(eventName, callback = (data) => {}) {
        return new Event(eventName, callback, this);
    }
    
}

class SyncedDownload {
    constructor(data) {
        this.name = data.uniqueName
        this.startCallback = data.startCallback
        this.finishedHereCallback = data.finishedHereCallback
        this.finishedAllCallback = data.finishedAllCallback
        this.client = data.client
        this.blobUrl = null
    }
    
    start(resourceUrl, data) {
        this.client.ws.send(this.client.buildMessage({
            type: MESSAGES.SYNCED_DOWNLOAD_INITIATE,
            payload: {
                resourceUrl: resourceUrl,
                uniqueName: this.name,
                data: data
            },
        }))
    }
}


class Event {
    constructor(name, callback, client) {
        this.name = name
        this.callback = callback
        this.client = client
        this.client.events.push(this)
    }

    emit(data) {
        this.client.ws.send(this.client.buildMessage({
            name: this.name,
            data: data
        }))
    }

    respond(data) {
        this.callback(data)
    }
}


const MESSAGES = {
    ACKNOWLEDGE: 'simplesockets__acknowledge',
    HEARTBEAT: 'simplesockets__heartbeat',
    JOIN: 'simplesockets__join',
    BROADCAST: 'simplesockets__broadcast',
    SYNCED_DOWNLOAD_INITIATE: 'simplesockets__synced_download_initiate',
    SYNCED_DOWNLOAD_START: 'simplesockets__synced_download_start',
    SYNCED_DOWNLOAD_DONE: 'simplesockets__synced_download_done',
    SYNCED_DOWNLOAD_ALL_DONE: 'simplesockets__synced_download_all_done',
}

function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}