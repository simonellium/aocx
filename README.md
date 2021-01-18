# aocx
Amateur Classical Musicians Association Online Collaboration Exchange

The AOCX was developed in December 2020 by Simon Yau, Association of Classical Musicians and Artists (ACMA) Digital Director, for members to look for potential musical collaborators. ACMA members can log into AOCX using their existing Google or Facebook accounts, search for other members in the exchange, extend invitations to join their ensemble, and respond to invitations from other members.

AOCX was tested as a webbapp, hosted on Firebase web hosting. It requires the webapp to be able to use firestore authentication via Google or Facebook authentication services. 

AOCX also requires a Firebase Cloud Firestore backend. Configure AOCX by naming the Firestore collection, and specifying it as `DATABASE_PREFIX` in `aocx.js`. Then configure the cloud firestore With the following Rules (replace the `DATABASE_PREFIX`): 

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
  
    function isSignedIn() {
      return request.auth != null;
    }
    function isSignedInAs(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    // Users collection
    match /{DATABASE_PREFIX}users/{userId} {
      // Profiles are world-readable but only editable by the user.
      allow list, create, read: if isSignedIn();
      allow update, delete: if isSignedInAs(userId);
      // Private subcollection (e-mail, etc) is only readable by user.
      match /private/{data} {
        allow list: if isSignedIn();
        allow create, read, update, delete: if isSignedInAs(userId);
      }
      // Ensemble subcollection is world-readable but only editable by the user.
      match /ensembles/{ensembleId} {
        allow list, read: if isSignedIn();
        allow create, update, delete: if isSignedInAs(userId);
        match /invitations/{inviteeId} {
          allow list: if isSignedIn();
          allow create, read, update, delete: if isSignedInAs(userId);
        }
      }
    }
    
    // Invitations subcollection: creatable and deletable by originator, and
    // but editable by the invitee.
    match /{path=**}/invitations/{inviteeId} {
      allow list: if isSignedIn();
      allow create, delete: if isSignedInAs(resource.data.originator_id);
      allow read, update: if isSignedInAs(resource.data.originator_id) || isSignedInAs(resource.data.invitee_id);
    }
  }
}
```

, and adding a composite index to the cloud firestore: 
```
Collection ID: invitations
Fields indexed: invitee_id Ascending; last_updated Ascending
Query scope: Collection group
```

