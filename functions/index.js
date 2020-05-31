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

function make_move(move) {
  pid = move.pid;
  xpos = move.xpos;
  ypos = move.ypos;
  const game_doc = db.collection('games').doc('game');
  console.log(`set ${xpos},${ypos} to ${pid}`);
  game_doc.set({
    'grid': {
      [xpos]: {
        [ypos]: {
          'pid': pid
        }
      }
    }
  }, {merge: true}).then(() => {
    console.log('move complete');
  }).catch(e => console.log(e));
}

exports.player_update = functions.firestore.document('/games/{game}/players/{pid}').onWrite((change, context) => {
  const game = context.params.game;
  const pid = context.params.pid;
  if (pid == 'list') {
    return null;
  }
  const game_doc = db.collection('games').doc(game);
  const player_doc = game_doc.collection('players').doc(pid);
  const list_doc = game_doc.collection('players').doc('list');
  console.log(`Game ${game} for ${pid}`);
  return db.runTransaction(t => {
    return t.getAll(player_doc, list_doc).then(doc => {
      player_data = doc[0].data();
      if (!player_data) {
        console.log('No user data... resetting game.');
        game_doc.delete();
        list_doc.delete();
        return null;
      }
      player_list = doc[1].data() || {};
      for (var i= 0; player_list[i]; i++) {
        if (player_list[i] == pid) {
          player_data['pid'] = i;
          return player_data;
        }
      }
      player_list[i] = pid;
      list_doc.set(player_list);
      return null;
    });
  }).then(result => {
    console.log('Transaction success! ' + result);
    if (result) {
      make_move(result);
    }
  }).catch(err => {
    console.log('Transaction failure:', err);
  });
});
