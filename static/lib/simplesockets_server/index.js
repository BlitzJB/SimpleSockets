class Server {
    constructor(wss) {
        this.rooms = [];
        this.wss = wss;
        this.mountListeners();
        this.clients = [];
        this.heartbeatEvaliateInterval = setInterval(() => {
            this.evaluateHeartbeats();
        }, 5000);
        this.events = [];
    }

    mountListeners() {
        this.wss.on('connection', (ws) => {
            ws.send(this.buildMessage({ type: MESSAGES.ACKNOWLEDGE }))
            ws.on('message', (message) => {
                const parsedMessage = JSON.parse(message);
                this.messageReducer(parsedMessage, ws);
            })
        });
    }

    messageReducer(message, ws) {
        console.log(message);
        if (message.data.type === MESSAGES.JOIN) {
            const room = this.createRoom(message.room);
            room.createClient(message.id, ws);
        } else if (message.data.type === MESSAGES.HEARTBEAT) {
            const client = this.clients.find((client) => {
                return client.id === message.id;
            });
            client.lastHeartbeat = message.timestamp;
        } else if (message.data.type === MESSAGES.SYNCED_DOWNLOAD_INITIATE) {
            const room = this.getRoomFromRoomName(message.room);
            const download = room.createSyncedDownload({
                name: message.data.payload.uniqueName,
                resourceUrl: message.data.payload.resourceUrl,
            });
            download.start(message.data.payload.data);
        } else if (message.data.type === MESSAGES.SYNCED_DOWNLOAD_DONE) {
            const room = this.getRoomFromRoomName(message.room);
            room.acknowledgeCompletedDownload(message.data.payload.downloadId, message.id);
        } else {
            this.events.forEach((event) => {
                if (event.name === message.data.name) {
                    event.handle(message);
                }
            });
        }
    }

    getRoomFromRoomName(name) {
        for (let i = 0; i < this.rooms.length; i++) {
            if (this.rooms[i].name === name) {
                return this.rooms[i];
            }
        }
        return null;
    }

    createRoom(name) {
        for (let i = 0; i < this.rooms.length; i++) {
            if (this.rooms[i].name === name) {
                return this.rooms[i];
            }
        }
        const room = new Room({ name, server: this });
        this.rooms.push(room);
        return room;
    }

    buildMessage(data) {
        return JSON.stringify({
            data: data,
            timestamp: Date.now(),
        })
    }

    evaluateHeartbeats() {
        const now = Date.now();
        this.clients.forEach((client) => {
            if (now - client.lastHeartbeat > 10000) {
                client.ws.close();
                this.clients = this.clients.filter((c) => c.id !== client.id);
                const room = this.getRoomFromRoomName(client.room.name);
                room.clients = room.clients.filter((roomClient) => roomClient.id !== client.id);
                room.downloads.forEach((download) => {
                    delete download.stateMap[client.id];
                    room.evalutateDownloadAndEmit(download.name, download);
                })
            }
        })
    }

    createEmmiter(name, shouldBroadcast) {
        this.events.push(new Event(name, shouldBroadcast, this));
    }
}

class Room {
    constructor(data) {
        this.clients = [];
        this.downloads = []
        this.name = data.name;
        this.server = data.server;
    }

    createClient(id, ws) {
        const client = new Client({ id, ws, room: this });
        this.clients.push(client);
        this.server.clients.push(client);
        return client;
    }

    createSyncedDownload(data) {
        const download = new SyncedDownload({ ...data, room: this, clients: this.clients });
        this.downloads.push(download);
        return download;
    }

    acknowledgeCompletedDownload(uniqueName, clientId) {
        const download = this.downloads.find((download) => download.name === uniqueName);
        download.stateMap[clientId] = true;
        this.evalutateDownloadAndEmit(uniqueName, download);
    }
    
    evalutateDownloadAndEmit(uniqueName, download) {
        if (download.isAllDone() && !download.finishedAllAcknowledged) {
            download.finishedAllAcknowledged = true;
            this.downloads = this.downloads.filter((download) => download.name !== uniqueName);
            this.clients.forEach(client => {
                client.ws.send(this.server.buildMessage({
                    type: MESSAGES.SYNCED_DOWNLOAD_ALL_DONE,
                    payload: {
                        uniqueName,
                    }
                }))
            })
        }
    }

}

class Client {
    constructor(data) {
        this.data = data;
        this.id = data.id;
        this.ws = data.ws;
        this.room = data.room;
        this.lastHeartbeat = Date.now();
    }
}

class SyncedDownload {
    constructor(data) {
        this.name = data.name;
        this.resourceUrl = data.resourceUrl;
        this.room = data.room;
        this.clients = data.clients || [];
        this.stateMap = {};
        this.clients.forEach((client) => {
            this.stateMap[client.id] = false;
        })
        this.finishedAllAcknowledged = false;
    }

    addClient(client) {
        this.clients.push(client);
    }

    start(data) {
        this.clients.forEach((client) => {
            client.ws.send(this.room.server.buildMessage({
                type: MESSAGES.SYNCED_DOWNLOAD_START,
                payload: {
                    resourceUrl: this.resourceUrl,
                    uniqueName: this.name,
                    data: data
                }
            }))
        })
    }

    isAllDone() {
        return Object.values(this.stateMap).every((value) => value);
    }

}


class Event {
    constructor(name, shouldBroadcast, server) {
        this.name = name;
        this.server = server;
        this.shouldBroadcast = shouldBroadcast;
    }

    emit(data = {}) {
        this.server.clients.forEach((client) => {
            client.ws.send(this.server.buildMessage({
                type: this.name,
                payload: data,
            }))
        })
    }

    handle(message) {
        if (this.shouldBroadcast) {
            this.server.getRoomFromRoomName(message.room).clients.forEach((client) => {
                client.ws.send(this.server.buildMessage({
                    name: this.name,
                    data: message.data.data,
                }))
            })
        }
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

module.exports = Server;