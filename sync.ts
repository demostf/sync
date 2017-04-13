import {server as WebSocketServer, request, connection} from 'websocket';
import {createServer} from 'http';

interface Session {
	name: string;
	owner: connection;
	clients: connection[];
	tick: number;
	playing: boolean;
}

const sessions: { [name: string]: Session } = {};

interface JoinPacket {
	type: 'join';
	session: string;
}

interface CreatePacket {
	type: 'create';
	session: string;
}

interface TickPacket {
	type: 'tick';
	session: string;
	tick: number;
}

interface PlayPacket {
	type: 'play';
	session: string;
	play?: boolean;
	tick?: boolean; //old sync server
}

type Packet = JoinPacket | CreatePacket | TickPacket | PlayPacket;

const server = createServer(function (request, response) {
	response.writeHead(404);
	response.end();
});
const port = process.env.PORT || 80;
server.listen(port, function () {
	console.log(`${(new Date())} Server is listening on port ${port}`);
});

const wsServer = new WebSocketServer({
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

	const connection = request.accept('demo-sync', request.origin);
	connection.on('message', function (message) {
		if (message.type === 'utf8') {
			const data = <Packet>JSON.parse(message.utf8Data);
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
				case 'join' :
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
						for (const client of sessions[data.session].clients) {
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
						for (const client of sessions[data.session].clients) {
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
		for (const name in sessions) {
			if (sessions.hasOwnProperty(name)) {
				const session = sessions[name];
				if (session) {
					const index = session.clients.indexOf(connection);
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
