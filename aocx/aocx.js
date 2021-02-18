//!!! INSERT DATABASE PREFIX !!!//
const DATABASE_PREFIX="insert-your-database-prefix";

// Note: Should be loaded from database.
const INSTRUMENTS = Object.freeze(
    {
	1:"Accordion",
	2:"Alto",
	3:"Bag Pipe",
	4:"Banjo",
	5:"Baritone",
	6:"Bass",
	7:"Bassoon",
	8:"Celesta",
	9:"Cello",
	10:"Clarinet",
	11:"Concertina",
	12:"Contralto",
	13:"Counter Tenor",
	14:"Double Bass",
	15:"Dance",
	16:"Drum",
	17:"Dulcimer",
	18:"English Horn",
	19:"Fiddle",
	20:"Flute",
	21:"French Horn",
	22:"Glockenspiel",
	23:"Guitar",
	24:"Harmonica",
	25:"Harp",
	26:"Harpsichord",
	27:"Kalimba",
	28:"Koto",
	29:"Marimba",
	30:"Mezzo Soprano",
	31:"Oboe",
	32:"Ocarina",
	33:"Organ",
	34:"Pan Flute",
	35:"Piano",
	36:"Piccolo",
	37:"Recorder",
	38:"Saxophone",
	39:"Shakuhachi",
	40:"Shamisen",
	41:"Shanai",
	42:"Sitar",
	43:"Soprano",
	44:"Steel Pan",
	45:"Tenor",
	46:"Timpani",
	47:"Trombone",
	48:"Trumpet",
	49:"Tuba",
	50:"Tubular Bell",
	51:"Vibraphone",
	52:"Viola",
	53:"Violin",
	54:"Xylophone",
    });

const PLAYINGLEVELS = Object.freeze(
    {
	1:"Novice",
	2:"Intermediate",
	3:"Advanced",
	4:"Expert",
	5:"Professional",
    });

const ALLPLAYINGLEVELS = -1;

const DEFAULT_ENSEMBLE_ID = "default";

// 30 days staleness.
var dt = new Date();
dt.setDate(dt.getDate() - 30);
const STALE_DATE = firebase.firestore.Timestamp.fromDate(dt);

// Auth providers.
var google_auth_provider = new firebase.auth.GoogleAuthProvider();
var facebook_auth_provider = new firebase.auth.FacebookAuthProvider();
// Add Apple???

// Database.
var db = firebase.firestore();
var userCollectionRef = db.collection(DATABASE_PREFIX + "users");

var userRef = null;
var userPrivateDataRef = null;
var ensembleRef = null;
var invitationsRef = null;

// Cached data.
var loggedInUserId = null;
var allUserProfiles = new Map();
var allUserIdOrder = [];
var allInvitations = new Map();
var privateData = {};

// Invitations changes.
var invitationsAdded = new Map();
var invitationsRescinded = new Set();

// Creates an instrument dropdown.
function instrumentsDropdown() {
    var ret = "<select class='instrument-dropdown'>"
    for (var key in INSTRUMENTS) {
	ret += "<option value='" + key + "'>" + INSTRUMENTS[key] + "</option>";
    }
    ret += "</select>";
    return ret;
}

// Creates a skill level dropdown.
function levelsDropdown(withany) {
    var ret = "<select class='level-dropdown'>"
    ret += "<option value='" + ALLPLAYINGLEVELS + "'>Any</option>";
    for (var key in PLAYINGLEVELS) {
	ret += "<option value='" + key + "'>" + PLAYINGLEVELS[key] + "</option>";
    }
    ret += "</select>";
    return ret;
}

// Creates the text box for putting in video link
function videoInput() {
    return "<input type='text' class='video-link'>";
}

// Creates the text box for putting in a piece's title
function titleInput() {
    return "<input type='text' class='piece-title'>";
}

// Escapes html text.
function escape(text) {
    var escaped = $("<div>").text(text).html();
    return escaped;
}

// Formats an instrument_id and instrument object into a succinct text.
function formatInstrument(instrument_id, instrument) {
    if (!instrument) {
	return "No longer plays " + INSTRUMENTS[instrument_id];
    }
    var text = PLAYINGLEVELS[instrument.level_id] + " " + INSTRUMENTS[instrument.instrument_id];
    if (!instrument.video_url) {
	return text;
    }
    var $result = $('<a>');
    $result.attr('href', instrument.video_url);
    $result.attr('target', '_blank' )
    $result.html(text);
    var $wrap = $("<div>");
    $wrap.append($result);
    return $wrap.html();
}

// Adds an instrument to the profile.
function addInstrumentSlot(instrument) {
    var $instruments_tbody = $('#instruments');
    var newRow = $("<tr>");
    var cols = "";
    cols += '<td>' + instrumentsDropdown() + '</td>';
    cols += '<td>' + levelsDropdown() + '</td>';
    cols += '<td>' + videoInput() + '</td>';
    cols += '<td><input type="button" class="ibtnDel btn btn-sm btn-danger delete-button" value="Delete"></td>';
    newRow.append(cols);
    $instruments_tbody.append(newRow);
    $new_instrument = $instruments_tbody.children().last();

    // Pre-populate the fields here, if given, and disable.
    if (instrument) {
	if (instrument.instrument_id) {
	    $new_instrument.find('.instrument-dropdown')
		.val(instrument.instrument_id);
	}
	if (instrument.level_id) {
	    $new_instrument.find('.level-dropdown').val(instrument.level_id);
	}
	if (instrument.video_url) {
	    $new_instrument.find('.video-link').val(instrument.video_url);
	}
	$new_instrument.find('.instrument-dropdown').prop('disabled', true);
	$new_instrument.find('.level-dropdown').prop('disabled', true);
	$new_instrument.find('.video-link').prop('disabled', true);
	$new_instrument.find('.delete-button').prop('hidden', true);
    }
}

// Formats a piece into a succinct text.
function formatPiece(piece) {
    var text = escape(piece.title);
    if (!piece.video_url) {
	return text;
    }
    var $result = $('<a>');
    $result.attr('href', piece.video_url);
    $result.attr('target', '_blank' )
    $result.html(text);
    var $wrap = $("<div>");
    $wrap.append($result);
    return $wrap.html();
}

// Adds a piece to the repertoire list.
function addPieceSlot(piece) {
    var $repertoire_tbody = $('#repertoire');
    var newRow = $("<tr>");
    var cols = "";
    cols += '<td>' + titleInput() + '</td>';
    cols += '<td>' + videoInput() + '</td>';
    cols += '<td><input type="button" class="ibtnDel btn btn-sm btn-danger delete-button" value="Delete"></td>';
    newRow.append(cols);
    $repertoire_tbody.append(newRow);
    $new_piece = $repertoire_tbody.children().last();

    // Pre-populate the fields here, if given, and disable.
    if (piece) {
	$new_piece.find('.piece-title').val(piece.title);
	if (piece.video_url) {
	    $new_piece.find('.video-link').val(piece.video_url);
	}
	$new_piece.find('.piece-title').prop('disabled', true);
	$new_piece.find('.video-link').prop('disabled', true);
	$new_piece.find('.delete-button').prop('hidden', true);
    }
}

// Creates a card to show in the ensemble section.
function formatMatch(uid, instrument_id, invited, accepted, private_data,
		     is_stale) {
    var user = allUserProfiles.get(uid);
    var instrument;
    user.instruments.forEach(function(i) {
	if (i.instrument_id == instrument_id) {
	    instrument = i;
	}
    });
    var instrument_status = formatInstrument(instrument_id, instrument);
    var invitation_status = "";
    var invitation_class = "dark";
    var email_status = "";
    if (invited) {
	if (accepted == undefined) {
	    invitation_status = "Pending";
	    invitation_class = "secondary";
	    email_status = "E-mail will be shown once your invitation is accepted."
	} else if (accepted) {
	    invitation_status = "Accepted";
	    invitation_class = "success";
	    email_status =
		private_data ? private_data.email : "No e-mail provided";
	} else {
	    invitation_status = "Declined";
	    invitation_class = "danger";
	}
    }
    var card =  "<div class='col-sm-6'>" +
	"<div class='card border-" + invitation_class + "'>" +
	"<div class='card-header'>" + escape(user.name) + "</div>" +
	"<div class='card-body'>" +
	"  <h5 class='card-title'>" + instrument_status + "</h5>" +
	"  <h6 class='card-subtitle mb-2 text-" + invitation_class + " '>" + invitation_status + "</h6>" +
	"  <p class='card-text'>" + escape(user.blurb) + "</p>" +
	(email_status ? "  <h7 class='card-subtitle mb-2 text-" + invitation_class + " '>" + email_status + "</h7>" : "") +
	"</div>" +
	"<div class='card-footer'><input type='button' style='width:50%' class='btn btn-sm btn-outline-" + invitation_class + " invite-button' value=" + (invited ? (is_stale ? "Expired" : "Disinvite") : "Invite") + "></div>";
    return card;
}

// Apply filters to allUserProfiles and display on browser.
function search(instrument_id, level) {
    var $browser_result = $('#browser-result');
    $browser_result.empty();
    var matches = 0;
    allUserIdOrder.forEach(function (userId) {
	var user = allUserProfiles.get(userId);
	if (!user || !user.instruments) return;
	user.instruments.forEach(function(i) {
	    if (i.instrument_id == instrument_id &&
		(level == ALLPLAYINGLEVELS || i.level_id == level)) {
		// add the match card to search result.
		++matches;
		$browser_result.append(
		    formatMatch(userId, instrument_id, false, undefined, null,
				false));
		$new_invite_button =
		    $browser_result.find(".invite-button").last();
		$new_invite_button.on('click', function() {
		    updateInvitation(userId, instrument_id, true);
		});
	    }
	});
    });
    if (matches == 0) {
	$browser_result.text("None found.");
    }
}

// Add/update or delete an invitation in the database and refresh the UI.
function updateInvitation(uid, instrument_id, invited) {
    var user = allUserProfiles.get(uid);
    if (invited) {
	invitationsRef.doc(uid).set({
	    instrument_id: instrument_id,
	    originator_private_data : privateData,
	    originator_id: loggedInUserId,
	    invitee_id: uid,
	    last_updated: firebase.firestore.FieldValue.serverTimestamp(),
	    ensemble_id: DEFAULT_ENSEMBLE_ID,
	}, {merge: true}).then(function() {
	    console.log("Updated invitation.");
	    refreshInvitations();
	}).catch(function(error) {
	    console.error("Error adding invitation: ", error);
	});
    } else {
	if (confirm("Disinvite " + (user ? user.name : "") + "?")) {
	    invitationsRef.doc(uid).delete().then(function() {
		console.log("Deleted invitation.");
		refreshInvitations();
	    }).catch(function(error) {
		console.error("Error rescinding invitation: ", error);
	    });
	}
    }
}

// Call the firestore backend to get the invitations and refresh the UI.
function refreshInvitations() {
    invitationsRef.get().then(function(querySnapshot) {
	allInvitations.clear();
	querySnapshot.forEach(function(i) {
	    if (!allUserProfiles.has(i.id)) {
		// This invitation went to a stale user. Ignore.
		return;
	    }
	    var invitation = {};
	    invitation.instrument_id = i.data().instrument_id;
	    invitation.is_stale = i.data().last_updated <= STALE_DATE;
	    if (i.data().accepted !== undefined) {
		invitation.accepted = i.data().accepted;
		if (invitation.accepted && i.data().invitee_private_data) {
		    invitation.private_data = i.data().invitee_private_data;
		}
	    }
	    allInvitations.set(i.id, invitation);
	});
	var $invitations_div = $('#invitations');
	$invitations_div.empty();
	allInvitations.forEach(function(invitation, uid, map) {
	    $invitations_div.append(
		formatMatch(uid, invitation.instrument_id, true,
			    invitation.accepted, invitation.private_data,
			    invitation.is_stale));
	    $new_disinvite_button =
		$invitations_div.find(".invite-button").last();
	    $new_disinvite_button.on('click', function() {
		updateInvitation(uid, invitation.instrument_id, false);
	    });
	});
	if (allInvitations.size == 0) {
	    $invitations_div.text("No invitations sent to active users.");
	}
    }).catch(function(error) {
	alert("Error getting sent invitations: " + error);
    });
}

// Looks up user's name from allUserProfiles.
function requestorName(uid) {
    if (!allUserProfiles.has(uid)) {
	return "User no longer active";
    }
    return allUserProfiles.get(uid).name;
}

// Save the accept/decline status to firestore.
function acceptOrDeclineRequest(request, requestId, accepted) {
    userCollectionRef
	.doc(request.originator_id).collection('ensembles')
	.doc(request.ensemble_id).collection('invitations')
	.doc(request.invitee_id)
	.set({ accepted : accepted,
	       invitee_private_data: privateData, 
	       last_updated: firebase.firestore.FieldValue.serverTimestamp() },
	     { merge: true })
	.then(function() {
	    var email =
		accepted ? (request.originator_private_data ?
			    request.originator_private_data.email :
			    "None entered" ) :
		"Accept to reveal their e-mail";
	    $("#private-" + requestId).text(email);
	    var buttonId = "button-" + requestId;
	    var invitation_class = accepted ? "success" : "danger";
	    $("#" + buttonId).removeClass("btn-outline-success btn-outline-danger btn-outline-secondary").addClass("btn-outline-" + invitation_class);
	    alert("Invitation " + (accepted ? "Accepted." : "Declined."));
	})
	.catch(function(error) {
	    alert("Error updating invitation status: " + error);
	});
}

// Adds a slot to the requests list UI.
function addRequest(request) {
    var $requests_div = $('#requests');
    var requestId = request.originator_id + '_' + request.ensemble_id + "_" + request.invitee_id;
    var headingId = "heading-" + requestId;
    var collapseId = "collapse-" + requestId;
    var contentId = "content-" + requestId;
    var buttonId = "button-" + requestId;
    var invitation_class = (request.accepted !== undefined) ? (request.accepted ? "success" : "danger") : "secondary";
    var display =
	"<div class='card'>" +
	"  <div class='class-header' id='" + headingId + "'>" +
	"  <h2 class='mb-0'>" +
	"    <button class='btn btn-outline-" + invitation_class + " btn-block text-center' type='button' data-toggle='collapse' data-target='#" + collapseId + "' aria-expanded='true' aria-controls='" + collapseId + "' id='" + buttonId + "'>" +
	"      " + escape(requestorName(request.originator_id)) +
	"    </button>" +
	"  </h2>" +
	"  </div> <!-- card header -->" +
	"  <div class='collapse' id='" + collapseId + "' aria-labelledby='" + headingId + "' data-parent='#requests' >" +
	"    <div class='card-body' id='" + contentId + "'></div>" +
	"  </div>" +
	"</div>";
    $requests_div.append(display);

    // Populating the content is lazy: only fires off a query to get the
    // ensemble description when the accordion opens.
    $('#' + collapseId).on('show.bs.collapse', function () {
	if ($("#" + contentId).text() !== "") {
	    // Already rendered.
	    return;
	}
	userCollectionRef
	    .doc(request.originator_id).collection('ensembles')
	    .doc(request.ensemble_id)
	    .get()
	    .then(function (ensemble) {
		var $me = $("#" + contentId);
		var originator = allUserProfiles.get(request.originator_id);
		if (originator) {
		    var o = escape(originator.name);
		    $me.append("<h6 class='card-subtitle'>About " + o + "'s Ensemble</h6>");
		    $me.append("<p>" + escape(ensemble.data().description) + "</p>");
		    if (ensemble.data().repertoire.length) {
			$me.append("<h6 class='card-subtitle'>" + o + "'s Proposed Repertoire</h6>");
			var repertoire_list = "<ul>";
			ensemble.data().repertoire.forEach(function(p) {
			    repertoire_list += "<li>" + formatPiece(p) + "</li>";
			});
			repertoire_list += "</ul>";
			$me.append(repertoire_list);
		    }
		    $me.append("<h6 class='card-subtitle'>About " + o + "</h6>");
		    $me.append("<p>" + escape(originator.blurb) + "</p>");
		    if (originator.instruments) {
			$me.append("<h6 class='card-subtitle'>" + o + "'s Instruments</h6>");
			var instrument_list = "<ul>";
			originator.instruments.forEach(function(i) {
			    instrument_list += "<li>" + formatInstrument(i.instrument_id, i) + "</li>";
			});
			instrument_list += "</ul>";
			$me.append(instrument_list);
		    }
		    $me.append("<h6 class='card-subtitle'>" + o + "'s E-mail</h6>");
		    $me.append("<p><span id='private-" + requestId + "'>Accept to reveal their e-mail</span></p>");
		    $me.append("<h6 class='card-subtitle'>My Decision</h6>");
		    $me.append("<input type='radio' name='radio-" + requestId + "' id='accept-" + requestId + "'><label class='text-success' style='padding-right:20px'>Accept</label>" +
			       "<input type='radio' name='radio-" + requestId + "' id='decline-" + requestId + "'><label class='text-danger'>Decline</label>");

		    $("#accept-" + requestId).on('click', function() {
			acceptOrDeclineRequest(request, requestId, true);
		    });
		    $("#decline-" + requestId).on('click', function() {
			acceptOrDeclineRequest(request, requestId, false);
		    });
		    // Pre-populate descision box.
		    if (request.accepted !== undefined) {
			$((request.accepted ? "#accept-" : "#decline-") + requestId)
			    .prop('checked', true);
			if (request.accepted) {
			    $("#private-" + requestId)
				.text(request.originator_private_data ?
				      request.originator_private_data.email :
				      "None entered");
			}
		    }
		} else {
		    $me.text("User is no longer active.");
		}		
	    })
	    .catch(function (error) {
		alert("Failed to get ensemble details." + error);
	    });
    });
}

// Login
function login(auth_provider) {
    firebase.auth().signInWithPopup(auth_provider).then(function(result) {
	var user = result.user;
	// alert("signed in as " + user.displayName + ", " +
	//       user.email + ", " + user.uid);
	// Logged in. Initialize the database references.
	loggedInUserId = user.uid
	userRef = userCollectionRef.doc(loggedInUserId);
	userPrivateDataRef = userCollectionRef
	    .doc(loggedInUserId).collection("private").doc("data");
	// Update last seen timestamp on the database.
	userRef.set(
	    {last_seen: firebase.firestore.FieldValue.serverTimestamp()},
	    { merge: true })
	    .then(function() { console.log("Updated last seen."); })
	    .catch(function(error) {
		console.error("Error updating last seen: ", error);
	    });
	
	// Update the greeting.
	$('#greetingname').text(user.displayName);
	$('#displayname').val(user.displayName);

	// Initialize profile section.
	// Look up firebase user profile and pre-populate main form.
	userRef.get().then(function(user) {
	    console.log("Got the user profile: ", user.data());
	    if (user.data().name) {
		$('#displayname').val(user.data().name);
	    }
	    if (user.data().blurb) {
		$('#blurb').val(user.data().blurb);
	    }
	    // Update the instruments.
	    if (user.data().instruments) {
		for (var i in user.data().instruments) {
		    addInstrumentSlot(user.data().instruments[i]);
		}
	    }
	}).catch(function(error) {
	    console.log("Error getting the user profile: ", error);
	});
	userPrivateDataRef.get().then(function(data) {
	    console.log("Got the user private data: ", data.data());
	    $('#email').val(data.data() && data.data().email ?
			    data.data().email : user.email);
	    privateData = { "email" : $('#email').val() };
	}).catch(function(error) {
	    console.log("Error getting the user private data: " + error);
	});

	// Initialize Ensemble Section.
	// Populate the user profiles for browsing.
	userCollectionRef
	    .where("last_seen", ">", STALE_DATE)
	    .orderBy("last_seen", "desc")
	    .get()
	    .then(function(querySnapshot) {
		allUserProfiles.clear();
		allUserIdOrder.splice(0, allUserIdOrder.length);
		querySnapshot.forEach(function(u) {
		    if (loggedInUserId !=  u.id) {
			allUserProfiles.set(u.id, u.data());
			allUserIdOrder.push(u.id);
		    }
		});
		// Populate the ensemble description.
		ensembleRef = userCollectionRef
		    .doc(loggedInUserId).collection('ensembles')
		    .doc(DEFAULT_ENSEMBLE_ID);
		ensembleRef.get().then(function(e) {
		    if (e.exists) {
			$('#ensemble-card').show();
			$('#ensemble-blurb').val(e.data().description);
			for (var i in e.data().repertoire) {
			    addPieceSlot(e.data().repertoire[i]);
			}
		    }
		    // Populate the list of invited members. Can only be
		    // done after allUserProfiles is populated.
		    invitationsRef = ensembleRef.collection("invitations");
		    refreshInvitations();
		}).catch(function(error) {
		    alert("Error reading default ensemble description" + error);
		});
	    })
	    .catch(function(error) {
		alert("Error getting user profile: " + error);
	    });

	// Initialize the requests section.
	db.collectionGroup('invitations')
	    .where('invitee_id', '==', loggedInUserId)
	    .where("last_updated", ">", STALE_DATE)
	    .get()
	    .then(function(querySnapshot) {
		querySnapshot.forEach(function (request) {
		    addRequest(request.data());
		});
	    })
	    .catch(function(error) {
		alert("Error reading ensembles I'm invited to: " + error);
	    });
	
	$('#login').hide();
	$('#main').show();
    }).catch(function(error) {
	// Handle Errors here.
	alert("error: " + error.message);
	var errorCode = error.code;
	var errorMessage = error.message;
    });
}

$(document).ready(function(){
     // Login
    $('#facebook-login').on('click', function() {
	login(facebook_auth_provider);
    });
    $('#google-login').on('click', function() {
	login(google_auth_provider);
    });

    // Profile section.
    $('#profile-edit, #profile-save').on('click', function(){
  	var $form = $(this).closest('form');
	// Validate there is a non-empty displayname
	if ($form.find('#displayname').val() === "") {
	    alert("Please provide a name.");
	    return;
	}
  	$form.toggleClass('is-readonly is-editing');
	var isReadonly  = $form.hasClass('is-readonly');
	$form.find('input,textarea,select').prop('disabled', isReadonly);
	$form.find('.add-button').prop('disabled', isReadonly);
	$form.find('.delete-button').prop('hidden', isReadonly);
	// Saving.
	if (isReadonly) {
	    // Round up all instruments into a json object.
	    var profile = { "name": "",
			    "blurb": "",
			    "instruments": [] };
	    profile.name = $form.find('#displayname').val();
	    profile.blurb = $form.find('#blurb').val();
	    profile.instruments = [];
	    $('#instruments').children().each(function() {
		var instrument = { "instrument_id": -1,
				   "level_id": -1,
				   "video_url": "" };
		instrument.instrument_id =
		    $(this).find('.instrument-dropdown').val();
		instrument.level_id = $(this).find('.level-dropdown').val();
		instrument.video_url = $(this).find('.video-link').val();
		profile.instruments.push(instrument);
	    });
	    privateData = { "email" : $('#email').val() };
	    // Save to firebase database.
	    if (userRef && userPrivateDataRef) {
		userRef.set(profile, { merge: true })	
		    .then(function() { console.log("Updated user profile."); })
		    .catch(function(error) {
			console.error("Error updating user profile: ", error);
		    });
		userPrivateDataRef.set(privateData, { merge: true })	
		    .then(function() {
			console.log("Updated user private data.");
		    })
		    .catch(function(error) {
			console.error("Error updating user private data: ",
				      error); });
	    }
	}
    });
    $('#add-instrument').on('click', function() {
	addInstrumentSlot(null);
    });
    $("table.instrument-list").on("click", ".ibtnDel", function (event) {
        $(this).closest("tr").remove();
    });

    // Ensemble Section.
    $('#ensemble-save').hide();
    $('#ensemble-edit').on('click', function() {
  	var $form = $(this).closest('form');
	$form.find('input,textarea,select').prop('disabled', false);
	$form.find('.add-button').prop('disabled', false);
	$form.find('.delete-button').prop('hidden', false);
	$('#ensemble-edit').hide();
	$('#ensemble-save').prop('disabled', false).show();
	$('#ensemble-card').removeClass('is-readonly');
    });
    $('#ensemble-save').on('click', function() {
	var ensemble = { "description": $('#ensemble-blurb').val(),
			 "repertoire": [] };
	$('#repertoire').children().each(function() {
	    var piece = { "title": $(this).find('.piece-title').val(),
			  "video_url": $(this).find('.video-link').val() };
	    ensemble.repertoire.push(piece);
	});
	for (var i in ensemble.repertoire) {
	    if (!ensemble.repertoire[i].title) {
		alert("Please enter all the pieces' titles");
		return;
	    }
	}
	if (ensembleRef) {
	    ensembleRef.set(ensemble, { merge: true })
		.then(function() {
		    console.log("Updated defaut ensemble description.");
		})
		.catch(function(error) {
		    console.error("Error updating default ensemble: ", error);
		});
	}
  	var $form = $(this).closest('form');
	$form.find('input,textarea,select').prop('disabled', true);
	$form.find('.add-button').prop('disabled', true);
	$form.find('.delete-button').prop('hidden', true);
	$('#ensemble-edit').prop('disabled', false).show();
	$('#ensemble-save').hide();
	$('#ensemble-card').addClass('is-readonly');
    });
    $('#add-piece').on('click', function() {
	addPieceSlot(null);
    });
    $("table.repertoire-list").on("click", ".ibtnDel", function (event) {
        $(this).closest("tr").remove();
    });
    // Profile Browser.
    var $browser_search_div = $('#browser-search');
    $browser_search_div.append(
	"<div class='instrument''>" +
	    "Instrument: " + instrumentsDropdown() + "<br>" +
	    "Level: " + levelsDropdown() + "<br>" +
	    "<input type='button' class='btn btn-md btn-outline-primary browse-button' style='margin:20px' value='Search'>" +
	    "</div>");
    $search_button = $browser_search_div.find(".browse-button").last();
    $search_button.on('click', function() {
	var $browser_search_div = $('#browser-search');
	search($browser_search_div.find('.instrument-dropdown').val(),
	       $browser_search_div.find('.level-dropdown').val());
    });

});
