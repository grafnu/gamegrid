const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

exports.user_update = functions.firestore.document('/users/{user}').onWrite((change, context) => {
  const user = context.params.user;
  console.log(`Update user ${user}`);

  // This automatically enables permissions for everybody.
  db.collection('permissions').doc(user).set({
    enabled: true
  });

  return null;
});

function make_move(idi, game_data, move) {
  xpos = move.xpos;
  ypos = move.ypos;
  const timestamp = new Date().toJSON();
  if (xpos >= 0 && ypos >= 0) {
    console.log(`set ${xpos},${ypos} to ${idi}`);
    game_data.moves[idi] = {
      updated: timestamp,
      move: move
    }
  }
}

function resolve_moves(game_data) {
  const timestamp = new Date().toJSON();
  let ready = 0;
  let count = 0;
  let moves = game_data.moves;
  let last = game_data.last;
  for (let idi in moves) {
    if (moves[idi].updated > last) {
      ready++;
    }
  }
  if (ready == Object.keys(game_data.players).length) {
    update_moves(game_data);
    game_data.last = timestamp;
  }
}

function update_moves(game_data) {
  let moves = game_data.moves;
  let end = {};
  for (let idi in moves) {
    let xpos = moves[idi].move.xpos;
    let ypos = moves[idi].move.ypos;
    let key = `${xpos},${ypos}`
    if (end[key]) {
      end[key] = -1;
    } else {
      end[key] = idi;
    }
  }

  for (let key in end) {
    idi = end[key]
    if (idi < 0) {
      continue;
    }
    let xpos = moves[idi].move.xpos;
    let ypos = moves[idi].move.ypos;
    game_data.grid[xpos] = game_data.grid[xpos] || {};
    game_data.grid[xpos][ypos] = game_data.grid[xpos][ypos] || { idi: -1 };
    grid_cell = game_data.grid[xpos][ypos];
    if (grid_cell.idi < 0) {
      grid_cell.idi = end[key];
      console.log(`Resolving ${key} to ${end[key]}`);
    }
  }
}

exports.player_update = functions.firestore.document('/games/{game}/players/{pid}').onWrite((change, context) => {
  const game = context.params.game;
  const pid = context.params.pid;
  const game_doc = db.collection('games').doc(game);
  const player_doc = game_doc.collection('players').doc(pid);
  console.log(`Game ${game} for ${pid}`);
  return db.runTransaction(t => {
    return t.getAll(player_doc, game_doc).then(doc => {
      player_data = doc[0].data();
      game_data = doc[1].data();
      if (!player_data || !game_data) {
        console.log('No user data... resetting game.');
        const timestamp = new Date().toJSON();
        game_data = {
          players: {},
          moves: {},
          started: timestamp,
          last: timestamp,
          grid: {}
        };
      }
      const player_list = game_data.players
      let idi = -1;
      for (var i= 0; player_list[i]; i++) {
        if (player_list[i] === pid) {
          idi = i;
        }
      }
      if (idi < 0) {
        player_list[i] = pid;
        idi = i;
        console.log(`Initializing ${idi} as ${pid}`);
      }
      if (player_data && player_data.updated) {
        make_move(idi, game_data, player_data);
      }
      resolve_moves(game_data);
      game_doc.set(game_data);
      return null;
    });
  }).then(result => {
    return console.log('Transaction success! ' + result);
  }).catch(err => {
    console.log('Transaction failure:', err);
  });
});
