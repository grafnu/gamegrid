/**
 * Simple file to handle test results events from DAQ.
 * Uses firebase for data management, and renders straight to HTML.
 */

var db;
var my_uid;
var player_id = -1;
var player_name;

document.addEventListener('DOMContentLoaded', () => {
  db = firebase.firestore();
  let settings = {};
  if (location.hostname === "localhost") {
    settings = {
      host: "localhost:8080",
      ssl: false
    }
    console.log('using local emulator');
  }
  db.settings(settings);
  console.log('firestore db initialized');
});

function getQueryParam(field) {
  var reg = new RegExp('[?&]' + field + '=([^&#]*)', 'i');
  var string = reg.exec(window.location.href);
  return string ? string[1] : null;
}

function status_update(message, e) {
  console.log(message);
  if (e) {
    console.error(e);
    message = message + ' ' + String(e)
  }
  document.getElementById('status').innerHTML = message;
}

function get_user_doc(uid) {
  return db.collection('users').doc(uid || my_uid);
}

function get_game_doc() {
  return db.collection('games').doc('game');
}

function write_cell(x, y) {
  if (player_id < 0) {
    status_update('View only player');
    return;
  }
  const game_doc = get_game_doc()
  game_doc.set({
    'grid': {
      [x]: {
        [y]: {
          'pid': player_id
        }
      }
    }
  }, {merge: true}).then(() => {
    status_update(`Updated cell ${x},${y}`);
  }).catch(e => {
    status_update('Error updating cell', e);
  });
}

function hex_click(e) {
  xpos = Number(e.srcElement.getAttribute('xpos'))
  ypos = Number(e.srcElement.getAttribute('ypos'))
  write_cell(xpos, ypos)
}

function make_map() {
  const size = 10;
  let container = document.getElementById('map');
  container.innerHTML = '';
  for (y = 0; y < size; y++) {
    let row = document.createElement('div');
    row.classList.add('row')
    for (x = 0; x < size; x++) {
      let cell = document.createElement('div');
      cell.setAttribute('xpos', `${x}`);
      cell.setAttribute('ypos', `${y}`);
      cell.classList.add('hex');
      row.appendChild(cell);
      cell.onclick = hex_click;
    }
    container.appendChild(row);
  }
}

function update_cell(xpos, ypos, pid) {
  let selector = `.hex[xpos="${xpos}"][ypos="${ypos}"]`;
  let cell = document.querySelector(selector);
  cell.setAttribute('pid', pid);
}

function update_map(grid) {
  if (!grid) {
    make_map();
    return;
  }
  for (const xpos in grid) {
    for (const ypos in grid[xpos]) {
      update_cell(xpos, ypos, grid[xpos][ypos].pid);
    }
  }
}

function register_game_listener() {
  game_doc = get_game_doc();
  game_doc.onSnapshot(snapshot => {
    const data = snapshot.data();
    if (data) {
      update_map(data.grid);
    } else {
      update_map(null);
    }
  }, e => {
    console.log(e);
  });
}

function setup_map() {
  make_map();
  register_game_listener();
}

function reset_game() {
  get_players_doc().delete();
  get_game_doc().delete();
}

function load_player(id, uid) {
  if (!uid) {
    document.getElementById('players').innerHTML = '';
    const rel = document.createElement('div');
    rel.innerHTML = 'Reset Game';
    rel.classList.add('simple-button');
    rel.style.display = 'inline-block';
    rel.onclick = reset_game;
    document.getElementById('players').appendChild(rel);
    return;
  }
  user_doc = get_user_doc(uid);
  const pel = document.createElement('div');
  pel.setAttribute('pid', id);
  pel.classList.add('player-label');
  document.getElementById('players').appendChild(pel);
  user_doc.get().then(doc => {
    pel.innerHTML = `Player ${id} is ${doc.data().name} at ${doc.data().email}`;
  });
}

function setup_player(id) {
  status_update(`Player slot ${id}`);
  if (id < 4) {
    player_id = id;
  }
  players_doc = get_players_doc();
  players_doc.get().then(doc => {
    load_player();
    players = doc.data() || {};
    for (var player in players) {
      load_player(player, players[player]);
    }
  });
}

function find_player_slot(players) {
  for (var i = 0; players && players[i] && players[i] != my_uid; i++) {}
  return i;
}

function get_players_doc() {
  const game_doc = get_game_doc();
  return game_doc.collection('players').doc('list');
}

function ensure_user() {
  const players_doc = get_players_doc();
  db.runTransaction(trans => {
    return trans.get(players_doc)
      .then(doc => {
        players = doc.data() || {};
        id = find_player_slot(players);
        if (players[id] != my_uid) {
          players[id] = my_uid;
          players_doc.set(players);
        }
        return id;
      });
  }).then(result => {
    console.log('Transaction success!', result);
    setup_player(result);
  }).catch(err => {
    console.log('Transaction failure:', err);
  });
}


function setup_user() {
  get_players_doc().onSnapshot(snapshot => ensure_user());
}

function authenticated(userData) {
  if (!userData) {
    status_update('Authentication failed, please sign in.');
    return;
  }
  status_update('Authentication succeeded for ' + userData.displayName);
  player_name = userData.displayName;

  my_uid = userData.uid;
  const perm_doc = db.collection('permissions').doc(my_uid);
  const user_doc = get_user_doc();
  const timestamp = new Date().toJSON();
  user_doc.set({
    name: userData.displayName,
    email: userData.email,
    updated: timestamp
  }).then(function () {
    status_update('User info updated');
    perm_doc.get().then((doc) => {
      if (doc.exists && doc.data().enabled) {
        setup_user();
        setup_map();
      } else {
        status_update('User not enabled, contact your system administrator.');
      }
    });
  }).catch((e) => status_update('Error updating user info', e));
}
