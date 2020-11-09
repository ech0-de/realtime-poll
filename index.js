const express = require('express');

const app = express();
app.use(express.static('./public'));
app.get('/style.css', (req, res) => res.sendFile(require.resolve('mini.css')));

const http = require('http').createServer(app);
const io = require('socket.io')(http);

if (!process.env.PASSWORD) {
    console.error('Error: specify admin password via PASSWORD env variable');
    process.exit(1);
}

const poll = {
    question: 'Keine laufende Umfrage...',
    options: []
};

let adminSocket;
const votes = new Map();

function sendResults() {
    if (adminSocket) {
        let sum = 0;
        const results = [];
        poll.options.forEach((option, i) => {
            results[i] = 0;
        });

        for (const vote of votes.values()) {
            sum += 1;
            results[vote] += 1;
        }

        adminSocket.emit('results', results, sum);
    }
}

io.on('connection', (socket) => {
    const clientId = `${socket.request.connection.remoteAddress}-${socket.request.headers['user-agent']}`;

    socket.on('auth', (x) => {
        if (x === PASSWORD) {
            adminSocket = socket;
            sendResults();

            socket.on('update', (update) => {
                if (Array.isArray(poll.options)) {
                    poll.question = update.question;
                    poll.options = update.options;
                    io.emit('poll', poll);
                    votes.clear();
                    sendResults();
                }
            });
        } else {
            socket.emit('unauthorized');
        }
    });

    socket.on('vote', (x) => {
        if (poll) {
            try {
                votes.set(clientId, parseInt(x, 10));
                sendResults();
            } catch {}
        }
    });

    socket.on('disconnect', () => {
        if (adminSocket === socket) {
            adminSocket = null;
        }
    });

    if (poll) {
        socket.emit('poll', poll, votes.has(clientId));
    }
});

http.listen(process.env.PORT || 3000, () => {
  console.log(`listening on *:${process.env.PORT || 3000}`);
});
