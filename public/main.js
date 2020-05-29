/**
 * Simple file to handle test results events from DAQ.
 * Uses firebase for data management, and renders straight to HTML.
 */

var db;
var uid;

document.addEventListener('DOMContentLoaded', () => {
  db = firebase.firestore();
  const settings = {
  };
  db.settings(settings);
  console.log('firestore db initialized');
});

function getQueryParam(field) {
  var reg = new RegExp('[?&]' + field + '=([^&#]*)', 'i');
  var string = reg.exec(window.location.href);
  return string ? string[1] : null;
}

function statusUpdate(message, e) {
  console.log(message);
  if (e) {
    console.error(e);
    message = message + ' ' + String(e)
  }
  document.getElementById('status').innerHTML = message;
}

function write_cell(x, y) {
  const user_doc = db.collection('users').doc(uid);
  const game_doc = user_doc.collection('games').doc('game');
  let value = Math.floor(Math.random() * 4);
  game_doc.set({
    'grid': {
      [x]: {
        [y]: {
          'value': value
        }
      }
    }
  }, {merge: true}).then(() => {
    statusUpdate(`Updated cell ${x},${y} with ${value}`);
  }).catch(e => {
    statusUpdate('Error updating cell', e);
  });
}

function hex_click(e) {
  xpos = Number(e.srcElement.getAttribute('xpos'))
  ypos = Number(e.srcElement.getAttribute('ypos'))
  write_cell(xpos, ypos)
}

function make_map(x_size, y_size) {
  container = document.getElementById('map');
  for (y = 0; y < y_size; y++) {
    row = document.createElement('div');
    row.classList.add('row')
    for (x = 0; x < x_size; x++) {
      cell = document.createElement('div');
      cell.setAttribute('xpos', `${x}`);
      cell.setAttribute('ypos', `${y}`);
      cell.classList.add('hex');
      row.appendChild(cell);
      cell.onclick = hex_click;
    }
    container.appendChild(row);
  }
}

function setupUser() {
  make_map(10, 10);
}

function authenticated(userData) {
  if (!userData) {
    statusUpdate('Authentication failed, please sign in.');
    return;
  }
  statusUpdate('Authentication succeeded for ' + userData.displayName);

  uid = userData.uid;
  const perm_doc = db.collection('permissions').doc(uid);
  const user_doc = db.collection('users').doc(uid);
  const timestamp = new Date().toJSON();
  user_doc.set({
    name: userData.displayName,
    email: userData.email,
    updated: timestamp
  }).then(function () {
    statusUpdate('User info updated');
    perm_doc.get().then((doc) => {
      if (doc.exists && doc.data().enabled) {
        setupUser();
      } else {
        statusUpdate('User not enabled, contact your system administrator.');
      }
    });
  }).catch((e) => statusUpdate('Error updating user info', e));
}
