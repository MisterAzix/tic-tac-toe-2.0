const express = require('express');
const cors = require('cors');
const PORT = process.env.PORT || 3000;

const { createUser, removeUser, getUser } = require('./users');
const { createRoom, removeRoom, getRoom, getRooms, resetRoom, joinRoom, leaveRoom, getPlayer } = require('./rooms');

const app = express()
    .use(cors())
    .use((req, res) => res.end('Hello world!'))
    .listen(PORT, () => console.log(`Listening on ${PORT}`));

const io = require('socket.io')(app, {
    cors: {
        origin: "*"
    }
});

let teams = {
    blue: {
        id: 'blue',
        count: 0,
        player: '',
        playerName: '',
        score: 0,
        activePiece: 'medium',
        pieces: {
            small: 3,
            medium: 3,
            large: 3
        }
    },
    red: {
        id: 'red',
        count: 0,
        player: '',
        playerName: '',
        score: 0,
        activePiece: 'medium',
        pieces: {
            small: 3,
            medium: 3,
            large: 3
        }
    }
};

let grid = [
    [null, null], [null, null], [null, null],
    [null, null], [null, null], [null, null],
    [null, null], [null, null], [null, null]
];
//Team - Size

let activeTeam = teams.blue;

io.on('connection', socket => {
    console.log('Client connected : ', socket.id);
    socket.broadcast.emit('receive-connection', socket.id);

    socket.on('login', ({ name }, callback) => {
        const { error, user } = createUser({ id: socket.id, name });

        if (error) return callback(error);
        socket.emit('receive-init-room', getRooms());
        callback();
    });

    socket.on('create-room', callback => {
        const user = getUser(socket.id);
        const { error, room } = createRoom(user.name);

        if (error) return callback(error);
        joinRoom(room.id, socket);
        io.to(room.id).emit('receive-teams', room.players);
        io.to(room.id).emit('receive-active', room.activeTeam);
        callback();
    });

    socket.on('join-room', (roomId, callback) => {
        const { error, success } = joinRoom(roomId, socket);
        if (error) return callback(error);
        io.to(roomId).emit('receive-teams', getRoom(roomId).players);
        io.to(roomId).emit('receive-active', getRoom(roomId).activeTeam);
        callback();
    });

    socket.on('get-username', (user, callback) => callback(getUser(user)?.name));

    socket.on('disconnect', () => {
        const user = removeUser(socket.id);
        if (!user) return;
        leaveRoom(user.room, user.id);
        socket.broadcast.emit('receive-disconnect', socket.id);
        user.room && io.to(user.room).emit('receive-teams', getRoom(user.room).players);
        /* const t = teams[Object.keys(teams).find(key => teams[key].player === socket.id)];
        if (!t) return;
        t.count = 0;
        t.player = '';
        t.playerName = ''; */
        console.log(`${socket.id} disconnect!`);
    });

    /* socket.on('get-teams', callback => {
        callback(teams);
    });

    socket.on('get-grid', callback => {
        callback(grid);
    });

    socket.on('get-active', callback => {
        callback(activeTeam.id);
    }); */

    socket.on('play', (box, callback) => {
        const { error, player, room } = getPlayer(socket.id);
        if (error) return callback(error);
        if (player.team !== room.activeTeam) return callback("It's not your turn!");
        if (!isPieceAvailable(player)) return callback(`You used all your ${player.activePiece} pieces!`);
        if (isFree(room, player, box)) {
            room.grid[box - 1][0] = player.team;
            room.grid[box - 1][1] = player.activePiece;
            player.pieces[player.activePiece]--;
            io.to(room.id).emit('receive-play', box, player.team, player.activePiece);
            io.to(room.id).emit('receive-edit-piece', room.players);
            if (checkWin(room.grid)) {
                io.to(room.id).emit('receive-win', player.team);
                const newRoom = resetRoom(room.id);
                player.score++;
                io.to(room.id).emit('receive-teams', newRoom.players);
                io.to(room.id).emit('receive-init', newRoom.grid);
                io.to(room.id).emit('receive-edit-piece', newRoom.players);
            } else if (checkEquality(room.grid)) {
                io.to(room.id).emit('receive-equality');
                const newRoom = resetRoom(room.id);
                io.to(room.id).emit('receive-init', newRoom.grid);
                io.to(room.id).emit('receive-edit-piece', newRoom.players);
            }
            toogleActiveTeam(room);
        } else {
            callback(`You can't play on <b>box ${box}</b>!`);
        }
    });

    /* socket.on('join-team', (user, teamName, callback) => {
        if (isPlayer(socket.id)) return callback('You already joined a team!');
        const t = findTeamByName(teamName);
        if (t.count == 0) {
            t.count = 1;
            t.player = user;
            t.playerName = getUser(user).name;
            io.emit('receive-teams', teams);
            console.log(`${getUser(user).name} join ${teamName} team!`);
        } else {
            callback(`<b>${teamName}</b> is full!`);
        }
    }); */

    socket.on('send-reset', (callback) => {
        const { error, player } = getPlayer(socket.id);
        if (error) return callback(error);
        resetGrid();
    });

    socket.on('select-piece', (team, item, callback) => {
        const { error, player, room } = getPlayer(socket.id);
        if (error) return callback(error);
        if (player.team !== team) return;
        player.activePiece = item;
        io.to(room.id).emit('receive-edit-piece', room.players);
    });
});

/* function isPlayer(id) {
    return getUser(id).room;
} */

function isFree(room, player, box) {
    boxContent = room.grid[box - 1][1];
    if (boxContent === null) return true;
    else if (boxContent === 'small' && (player.activePiece === 'medium' || player.activePiece === 'large')) return true;
    else if (boxContent === 'medium' && player.activePiece === 'large') return true;
    else return false;
}

/* function findTeamByName(teamName) {
    return teams[Object.keys(teams).find(key => key === teamName)];
} */

function toogleActiveTeam(room) {
    room.activeTeam = room.activeTeam === 'blue' ? 'red' : 'blue';
    io.to(room.id).emit('receive-active', room.activeTeam);
}

function checkEquality(grid) {
    return grid.filter(g => g[0] !== null).length >= 9;
}

function checkWin(grid) {
    if ((grid[0][0] !== null && grid[0][0] === grid[1][0] && grid[1][0] === grid[2][0]) ||
        (grid[3][0] !== null && grid[3][0] === grid[4][0] && grid[4][0] === grid[5][0]) ||
        (grid[6][0] !== null && grid[6][0] === grid[7][0] && grid[7][0] === grid[8][0]) ||
        (grid[0][0] !== null && grid[0][0] === grid[3][0] && grid[3][0] === grid[6][0]) ||
        (grid[1][0] !== null && grid[1][0] === grid[4][0] && grid[4][0] === grid[7][0]) ||
        (grid[2][0] !== null && grid[2][0] === grid[5][0] && grid[5][0] === grid[8][0]) ||
        (grid[0][0] !== null && grid[0][0] === grid[4][0] && grid[4][0] === grid[8][0]) ||
        (grid[2][0] !== null && grid[2][0] === grid[4][0] && grid[4][0] === grid[6][0])) {
        return true;
    } else {
        return false;
    }
}

/* function resetGrid() {
    grid = [
        [null, null], [null, null], [null, null],
        [null, null], [null, null], [null, null],
        [null, null], [null, null], [null, null]
    ];
    teams.blue.pieces = {
        small: 3,
        medium: 3,
        large: 3
    }
    teams.red.pieces = {
        small: 3,
        medium: 3,
        large: 3
    }
    io.emit('receive-init', grid);
    io.emit('receive-edit-piece', teams);
} */

function isPieceAvailable(player) {
    return player.pieces[player.activePiece] > 0;
}