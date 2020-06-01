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
  if (xpos >= 0 && ypos >= 0) {
    console.log(`set ${xpos},${ypos} to ${idi}`);
    game_data.grid = game_data.grid || {};
    game_data.grid[xpos] = game_data.grid[xpos] || {};
    game_data.grid[xpos][ypos] = game_data.grid[xpos][ypos] || { idi: -1 };
    grid_cell = game_data.grid[xpos][ypos];
    if (grid_cell.idi < 0) {
      grid_cell.idi = idi;
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
      if (!player_data) {
        console.log('No user data... resetting game.');
        const timestamp = new Date().toJSON();
        game_data = {
          players: {},
          started: timestamp,
          grid: {}
        };
      }
      const player_list = game_data.players
      let idi = -1;
      for (var i= 0; player_list[i]; i++) {
        if (player_list[i] == pid) {
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
      game_doc.set(game_data);
      return null;
    });
  }).then(result => {
    console.log('Transaction success! ' + result);
  }).catch(err => {
    console.log('Transaction failure:', err);
  });
});
