"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var websocket_1 = require("websocket");
var http_1 = require("http");
var sessions = {};
var server = http_1.createServer(function (request, response) {
    response.writeHead(404);
    response.end();
});
var port = process.env.PORT || 80;
server.listen(port, function () {
    console.log((new Date()) + " Server is listening on port " + port);
});
var wsServer = new websocket_1.server({
    httpServer: server,
    autoAcceptConnections: false
});
function originIsAllowed(origin) {
    return true;
}
wsServer.on('request', function (request) {
    if (!originIsAllowed(request.origin)) {
        // Make sure we only accept requests from an allowed origin
        request.reject();
        console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
        return;
    }
    var connection = request.accept('demo-sync', request.origin);
    connection.on('message', function (message) {
        if (message.type === 'utf8') {
            var data = JSON.parse(message.utf8Data);
            switch (data.type) {
                case 'create':
                    sessions[data.session] = {
                        name: data.session,
                        owner: connection,
                        clients: [],
                        tick: 0,
                        playing: false
                    };
                    break;
                case 'join':
                    if (sessions[data.session]) {
                        sessions[data.session].clients.push(connection);
                        connection.sendUTF(JSON.stringify({
                            type: 'tick',
                            tick: sessions[data.session].tick
                        }));
                        connection.sendUTF(JSON.stringify({
                            type: 'play',
                            tick: sessions[data.session].playing
                        }));
                    }
                    break;
                case 'tick':
                    if (sessions[data.session]) {
                        sessions[data.session].tick = data.tick;
                        for (var _i = 0, _a = sessions[data.session].clients; _i < _a.length; _i++) {
                            var client = _a[_i];
                            client.sendUTF(JSON.stringify({
                                type: 'tick',
                                tick: data.tick
                            }));
                        }
                    }
                    break;
                case 'play':
                    if (sessions[data.session]) {
                        sessions[data.session].playing = data.play;
                        for (var _b = 0, _c = sessions[data.session].clients; _b < _c.length; _b++) {
                            var client = _c[_b];
                            client.sendUTF(JSON.stringify({
                                type: 'play',
                                play: data.play
                            }));
                        }
                    }
            }
        }
    });
    connection.on('close', function (reasonCode, description) {
        for (var name_1 in sessions) {
            if (sessions.hasOwnProperty(name_1)) {
                var session = sessions[name_1];
                if (session) {
                    var index = session.clients.indexOf(connection);
                    if (index !== -1) {
                        session.clients.splice(index, 1);
                    }
                    if (session.owner === connection) {
                        sessions[session.name] = null;
                        break;
                    }
                }
            }
        }
    });
});
