/**
 * Simple file to handle test results events from DAQ.
 * Uses firebase for data management, and renders straight to HTML.
 */

var db;
var my_uid;
var player_id = -1;
var player_name;
var loaded_players = {};
var game_started;

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

function write_move(x, y) {
  if (player_id < 0) {
    status_update('View only player');
    return;
  }
  const timestamp = new Date().toJSON();
  const player = get_players_doc(my_uid);
  player.set({
    updated: timestamp,
    xpos: x,
    ypos: y
  }).then(() => {
    status_update(`Played cell ${x},${y}`);
  }).catch(e => {
    status_update('Error updating cell', e);
  });
}

function hex_click(e) {
  xpos = Number(e.srcElement.getAttribute('xpos'))
  ypos = Number(e.srcElement.getAttribute('ypos'))
  write_move(xpos, ypos)
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

function reset_map() {
  make_map();
  reset_players();
}

function update_map(grid) {
  for (const xpos in grid) {
    for (const ypos in grid[xpos]) {
      update_cell(xpos, ypos, grid[xpos][ypos].idi);
    }
  }
}

function register_game_listener() {
  game_doc = get_game_doc();
  game_doc.onSnapshot(snapshot => {
    const data = snapshot.data();
    if (data.started != game_started) {
      reset_map();
      game_started = data.started;
    }
    update_map(data.grid);
    setup_players(data);
  }, e => {
    console.log(e);
  });
}

function setup_map() {
  register_game_listener();
}

function reset_game() {
  get_players_doc(my_uid).delete();
}

function reset_players() {
  loaded_players = {};
  player_id = -1;
  document.getElementById('players').innerHTML = '';
  const rel = document.createElement('div');
  rel.innerHTML = 'Reset Game';
  rel.classList.add('simple-button');
  rel.style.display = 'inline-block';
  rel.onclick = reset_game;
  document.getElementById('players').appendChild(rel);
}

function load_player(id, uid) {
  if (uid == my_uid) {
    status_update(`Player slot ${id}`);
    player_id = id;
  }
  if (loaded_players[id]) {
    return;
  }
  loaded_players[id] = uid;
  user_doc = get_user_doc(uid);
  const pel = document.createElement('div');
  pel.setAttribute('pid', id);
  pel.classList.add('player-label');
  document.getElementById('players').appendChild(pel);
  user_doc.get().then(doc => {
    pel.innerHTML = `Player ${id} is ${doc.data().name} at ${doc.data().email}`;
  }).catch(e => {
    status_update(`loading player ${id} from ${user_doc.path}`, e)
  });
}

function get_players_doc(uid) {
  return get_game_doc().collection('players').doc(uid);
}

function setup_players(game_data) {
  players = game_data.players || {};
  for (var player in players) {
    load_player(player, players[player]);
  }
  if (player_id < 0) {
    ensure_player();
  }
}

function ensure_player() {
  const timestamp = new Date().toJSON();
  const me_doc = get_players_doc(my_uid);
  me_doc.set({
    updated: timestamp
  }).then(r => {
    console.log('Player record updated');
  }).catch(e => status_update('ensuring player', e));
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
        setup_map();
      } else {
        status_update('User not enabled, contact your system administrator.');
      }
    });
  }).catch((e) => status_update('Error updating user info', e));
}
