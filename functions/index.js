const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

exports.players_update = functions.firestore
  .document('/users/{user}')
  .onWrite((change, context) => {
    const user = context.params.user;
    console.log(`Update user ${user}`);

    // This automatically enables permissions for everybody.
    db.collection('permissions').doc(user).set({
      enabled: true
    });

    return null;
  });
