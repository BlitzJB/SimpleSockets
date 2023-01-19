const Server = require('./static/lib/simplesockets_server');


// create express app

var express = require('express');
var app = express();

app.use(express.static('lib/simplesockets_client'))
app.use(express.static('static'))
app.use(function(req, res, next) {
    if (req.path.endsWith('.js')) {
        res.setHeader('Content-Type', 'text/javascript');
    }
    next();
});


// create ws server from ws module
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({ port: 8080 });
const server = new Server(wss);

server.createEmmiter('paused', true);
server.createEmmiter('play', true);
server.createEmmiter('seek', true);



// define request response in root URL (/)
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/static/templates/index.html');
});


app.get("/room/:code", function (req, res) {
    res.sendFile(__dirname + '/static/templates/room.html');
});

// listen for requests
app.listen(3000, function () {
    console.log("Example app listening at http://localhost:3000")
});
