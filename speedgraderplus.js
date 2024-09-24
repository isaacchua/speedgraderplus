// SpeedGraderPlus.js v2.2.0 (2023-12-11) - https://github.com/isaacchua/speedgraderplus
let sgpConfig = {
	enabled: true, // true enable SpeedGraderPlus; false to show everything
	expandComments: true, // true to expand comments box; false to leave unchanged
	assignments: [
		{
			assignmentId: 0, // the Assignment ID
			expandImages: true, // true to expand images in answers when clicked; false otherwise
			showQuestionIds: true, // true to append Question IDs to Question headers; false otherwise
			profiles: [
				{
					name: "Profile", // name of the Profile
					hideQuestions: true, // hide all questions except specified Question IDs
					questionIds: [ // the Question IDs to show; others will be hidden
						0, // numeric plain Question ID
						"1", // string plain Question ID
						{id: 1, exists: 2, studentIdFn: "odd"} // object conditional Question ID
					],
					hideQuestionText: true, // hides the text of the Question
					hideQuizComments: true // hides the quiz comments that follow the student's answers (not the comments panel)
				}
			]
		}
	],
};
globalThis.sgp = (function(config){
	const VERSION = "2.2.0";
	const BIND_STUDENTS_ATTEMPTS = 200;
	const DEFAULT_PROFILE = {
		name: "(none)",
		hideQuestions: false,
		questionIds: [],
		hideQuestionText: false,
		hideQuizComments: false
	};
	const EXPAND_COMMENTS_CSS = "#speed_grader_comment_textarea_mount_point textarea { min-height: 25lh; }";
	const FIND_IFRAME_ATTEMPTS = 300;
	const IFRAME_EXPAND_IMAGE_FN_NAME = "sgpExpandImage";
	const IFRAME_EXPAND_IMAGE_HIDE_BLANK_IMAGES_CSS = ".answers img:not([src]) { display: none; }";
	const IFRAME_EXPAND_IMAGE_SELECTOR = ".answers img[src]";
	const IFRAME_HIDE_QUESTIONS_CSS = ".question { display: none; } ";
	const IFRAME_MODAL_ID = "sgp_modal";
	const IFRAME_QUESTION_ID_SELECTOR_CLASS = "sgp_question_ids";
	const IFRAME_SHOW_HEADERS_CSS = ".question .header { display: block !important; } ";
	const IFRAME_STYLE_ID = "sgp_styles";
	const IFRAME_ZOOM_IMAGE_FN_NAME = "sgpZoomImage";
	const PROFILE_SELECTOR_ID = "sgp_profiles";
	const STUDENT_ID_FN_ODD = id => (id % 2) === 1;
	const STUDENT_ID_FN_EVEN = id => (id % 2) === 0;
	const STUDENT_ID_RE = /\/users\/(\d+)-/;
	const STYLE_ID = "sgp_top_styles";
	let find = false;
	let timeoutId;

	function doFindIframe (attempts = 0) {
		try {
			let iframe = document.getElementById("speedgrader_iframe");
			if (iframe) {
				find = false;
				console.log("SpeedGraderPlus: speedgrader_iframe found");
				if (config && config.enabled && config.assignments) { // check if configuration exists / is enabled
					let iframeSrc = iframe.getAttribute("src");
					let assignment = config.assignments.find(assignment => iframeSrc.includes("assignments/" + assignment.assignmentId + "/"));
					if (assignment) {
						console.log("SpeedGraderPlus: assignment " + assignment.assignmentId + " found");
						register();
						iframe.contentWindow.addEventListener("load", // listen regardless, because iframe might reload
							event => handleIframeLoadEvent(event, assignment)); // wrap the event handler to pass the assignment
						if (iframe.contentDocument.readyState === "complete") { // iframe might already be loaded
							checkValidIframe(iframe.contentDocument, assignment);
						}
					}
					else { // no assignment, nothing to do
						console.warn("SpeedGraderPlus: no assignments found");
						deregister();
						deregisterIframe(iframe.contentDocument);
					}
				}
				else { // no configuration / not enabled
					console.log("SpeedGraderPlus: no config provided, not enabled, or no assignments configured");
					deregister();
					deregisterIframe(iframe.contentDocument);
				}
			}
		}
		catch (error) {
			console.error("SpeedGraderPlus: error encountered");
			throw error;
		}
		finally {
			clearTimeout(timeoutId); // ensure no other timeout is running
			if (find) {
				if (attempts < FIND_IFRAME_ATTEMPTS) {
					timeoutId = setTimeout(doFindIframe, 200, attempts + 1);
				}
				else {
					console.warn("SpeedGraderPlus: max attempts reached: unable to find speedgrader_iframe");
				}
			}
		}
	}
	
	function startFindIframe () {
		console.log("SpeedGraderPlus: finding speedgrader_iframe");
		find = true;
		doFindIframe();
	}

	function handleIframeLoadEvent (event, assignment) {
		console.log("SpeedGraderPlus: speedgrader_iframe Window.load detected");
		checkValidIframe(event.target, assignment);
	}
	
	function checkValidIframe (doc, assignment) {
		if (doc.location.href === "about:blank") {
			console.log("SpeedGraderPlus: speedgrader_iframe is about:blank, ignoring");
		}
		else {
			console.log("SpeedGraderPlus: speedgrader_iframe loaded: " + doc.location.href);
			registerIframe(doc, assignment);
		}
	}

	function applyExpandImages (doc, assignment) {
			// must add event listeners to doc or it will not work for the next student
		if (!doc[IFRAME_EXPAND_IMAGE_FN_NAME]) {
			doc[IFRAME_EXPAND_IMAGE_FN_NAME] = event => handleExpandImage(event);
		}
		if (!doc[IFRAME_ZOOM_IMAGE_FN_NAME]) {
			doc[IFRAME_ZOOM_IMAGE_FN_NAME] = event => handleZoomImage(event);
		}
		Array.from(doc.querySelectorAll(IFRAME_EXPAND_IMAGE_SELECTOR))
			.forEach(element => element.addEventListener("click", doc[IFRAME_EXPAND_IMAGE_FN_NAME]));
		console.log("SpeedGraderPlus: registered expand image listeners");
	}

	function unapplyExpandImages (doc) {
		Array.from(doc.querySelectorAll(IFRAME_EXPAND_IMAGE_SELECTOR))
			.forEach(element => element.removeEventListener("click", doc[IFRAME_EXPAND_IMAGE_FN_NAME]));
		delete doc[IFRAME_EXPAND_IMAGE_FN_NAME];
		delete doc[IFRAME_ZOOM_IMAGE_FN_NAME];
		doc.getElementById(IFRAME_MODAL_ID)?.remove();
		console.log("SpeedGraderPlus: deregistered expand image listeners");
	}

	function handleExpandImage (event) {
		console.log("SpeedGraderPlus: image clicked");
		let img = event.target.cloneNode();
		let modal = getIframeModal(event.view.document);
		img.className = "";
		img.style.display = "block";
		img.style.width = "96%";
		img.style.maxWidth = "none";
		img.style.margin = "2% auto";
		img.style.padding = "0";
		img.style.backgroundColor = "white";
		img.addEventListener("click", event.view.document[IFRAME_ZOOM_IMAGE_FN_NAME]);
		modal.replaceChildren(img);
		console.log("SpeedGraderPlus: showing modal: " + modal);
		event.view.document.body.style.overflow = "hidden";
		modal.style.display = "block";
	}

	function handleZoomImage (event) {
		event.preventDefault();
		let img = event.target;
		let scale = img.dataset.sgpScale && Number.parseFloat(img.dataset.sgpScale) || 1;
		scale = scale >= 4 ? 1 : scale * 2;
		img.dataset.sgpScale = scale;
		scale *= 96;
		img.style.width = scale + "%";
	}

	function getIframeModal(doc) {
		let modal = doc.getElementById(IFRAME_MODAL_ID);
		if (!modal) {
			console.log("SpeedGraderPlus: creating new modal");
			modal = doc.createElement("div");
			modal.id = IFRAME_MODAL_ID;
			modal.style.display = "none";
			modal.style.position = "fixed";
			modal.style.zIndex = "999999";
			modal.style.left = "0";
			modal.style.top = "0";
			modal.style.width = "100%";
			modal.style.height = "100%";
			modal.style.margin = "0";
			modal.style.padding = "0";
			modal.style.overflow = "auto";
			modal.style.backgroundColor = "rgba(0,0,0,0.7)";
			modal.addEventListener("click", event => {
				if (event.target === modal) {
					event.target.style.display = "none";
					event.view.document.body.style.overflow = "auto";
				}
			});
			doc.body.append(modal);
		}
		return modal;
	}

	function showQuestionIds(doc, assignment) {
		if (assignment.showQuestionIds) {
			if (!doc.querySelector("."+IFRAME_QUESTION_ID_SELECTOR_CLASS)) { // check that ids do not already exist
				console.log("SpeedGraderPlus: showing question ids");
				Array.from(doc.querySelectorAll(".question > .header:has(.name)"))
					.forEach(element => {
						let span = doc.createElement("span");
						span.className = IFRAME_QUESTION_ID_SELECTOR_CLASS;
						span.textContent = " (".concat(element.parentElement.id.split("_")[1],")");
						element.querySelector(".name").append(span);
					})
			}
			else {
				console.log("SpeedGraderPlus: question ids are already shown");
			}
		}
		else {
			hideQuestionIds(doc);
		}
	}

	function hideQuestionIds(doc) {
		Array.from(doc.querySelectorAll("."+IFRAME_QUESTION_ID_SELECTOR_CLASS)).forEach(element => element.remove());
		console.log("SpeedGraderPlus: question ids removed");
	}
	
	function applyIframeStyles (doc, assignment) {
		let profile = getProfile(assignment);
		let css = "";

		// hide blank images, which result from Canvas editor saving loading screens
		// these blank images could block functionality
		if (assignment.expandImages) {
			css += IFRAME_EXPAND_IMAGE_HIDE_BLANK_IMAGES_CSS;
		}

		// show headers if showing question ids
		if (assignment.showQuestionIds) {
			css += IFRAME_SHOW_HEADERS_CSS;
		}

		// hide all question blocks
		if (profile.hideQuestions) {
			css += IFRAME_HIDE_QUESTIONS_CSS;

			// show all selected question blocks
			for (const questionId of profile.questionIds) {
				if (typeof questionId === "object") {
					if (questionId && questionId.id) {
						let result = true;
						if (questionId.exists) {
							result &&= Boolean(doc.getElementById("question_" + questionId.exists));
						}
						if (questionId.studentIdFn) {
							let studentId = getCurrentStudentId();
							console.log("SpeedGraderPlus: current student ID: " + studentId);
							switch (typeof questionId.studentIdFn) {
								case "string":
									switch (questionId.studentIdFn) {
										case "odd":
											result &&= STUDENT_ID_FN_ODD(studentId);
											break;
										case "even":
											result &&= STUDENT_ID_FN_EVEN(studentId);
											break;
										default:
											result = false;
									}
									break;
								case "function":
									result &&= Boolean(questionId.studentIdFn(studentId));
									break;
								default:
									result = false;
							}
						}
						if (result) {
							css += "div#question_" + questionId.id + ", ";
						}
					}
				}
				else if (questionId) {
					css += "div#question_" + questionId + ", ";
				}
			}
			css = css.slice(0,-2) + " { display: block; } ";
		}

		// hide question text
		if (profile.hideQuestionText) {
			css += "div.question_text { display: none; } ";
		}

		// hide quiz comments
		if (profile.hideQuizComments) {
			css += "div.quiz_comment { display: none; } ";
		}

		console.log("SpeedGraderPlus: applying styles: " + css);

		getIframeStyles(doc).textContent = css;

		console.log("SpeedGraderPlus: all done");
	}

	function unapplyIframeStyles (doc) {
		doc.getElementById(IFRAME_STYLE_ID)?.remove();
	}

	function getIframeStyles (doc) {
		let style = doc.getElementById(IFRAME_STYLE_ID);
		if (!style) {
			style = doc.createElement("style");
			style.id = IFRAME_STYLE_ID;
			doc.head.append(style);
		}
		return style;
	}

	function registerIframe (doc, assignment) {
		assignment.expandImages ? applyExpandImages(doc, assignment) : unapplyExpandImages(doc);
		showQuestionIds(doc, assignment);
		applyIframeStyles(doc, assignment);
	}

	function deregisterIframe (doc) {
		unapplyExpandImages(doc);
		hideQuestionIds(doc);
		unapplyIframeStyles(doc);
	}

	function getCurrentStudentId () {
		let src = document.getElementById("avatar")?.children[0]?.src;
		if (!src) return null;
		let match = STUDENT_ID_RE.exec(src);
		if (!match) return null;
		let id = Number.parseInt(match[1]);
		if (Number.isNaN(id)) return null;
		return id;
	}
	
	function doBindStudents (bind, attempts = 0) {
		let students = document.querySelectorAll("ul#students_selectmenu-menu a");
		if (students.length) {
			if (bind) {
				students.forEach(student => student.addEventListener("click", startFindIframe));
			}
			else {
				students.forEach(student => student.removeEventListener("click", startFindIframe));
			}
		}
		else { // students not yet loaded
			if (attempts < BIND_STUDENTS_ATTEMPTS) {
				setTimeout(doBindStudents, 100, bind, attempts + 1);
			}
			else {
				console.warn("SpeedGraderPlus: max attempts reached: unable to find student list");
			}
		}
	}

	function bindStudents () {
		console.log("SpeedGraderPlus: adding event listeners to student list");
		doBindStudents(true);
	}

	function unbindStudents () {
		console.log("SpeedGraderPlus: removing event listeners from student list");
		doBindStudents(false);
	}

	function createProfileSelector () {
		let collection = document.getElementsByClassName("subheadContent--flex-end");
		if (collection.length > 0) {
			let div = document.createElement("div");
			div.style.paddingRight = "12px";
			let label = document.createElement("label");
			label.innerText = "Profile:";
			label.htmlFor = PROFILE_SELECTOR_ID;
			let select = document.createElement("select");
			select.id = PROFILE_SELECTOR_ID;
			select.style.padding = "0";
			select.style.margin = "0";
			select.style.height = "30px";
			select.style.width = "auto";
			let option = document.createElement("option"); // default option
			option.value = "";
			option.innerText = "(none)";
			select.append(option);
			div.append(label, " ", select);
			collection[0].prepend(div);
			select.addEventListener("change", startFindIframe);
			return select;
		}
		else {
			console.error("SpeedGraderPlus: unable to find header toolbar to add selector");
			return null;
		}
	}

	function getProfile (assignment) {
		if (!assignment) {
			console.error("SpeedGraderPlus: assignment not provided to retrieve profiles");
			return DEFAULT_PROFILE;
		}
		let profileSelector = document.getElementById(PROFILE_SELECTOR_ID) ?? createProfileSelector();
		if (profileSelector) {
			let profileValue = profileSelector.value;
			let profiles = assignment.profiles;
			if (!Array.isArray(profiles)) {
				console.warn("SpeedGraderPlus: profiles not configured for assignment");
				profiles = [];
			}
			let profile = profiles.find(profile => profile.name === profileValue);
			if (!profile) {
				console.log("SpeedGraderPlus: previous profile not found, using default");
				profile = DEFAULT_PROFILE;
				profileValue = "";
			}
			let children = [...profileSelector.children]; // pull out the children as an array for reuse
			profileSelector.replaceChildren(children[0]); // replace with default option
			profiles.forEach(profile => {
				let option = children.find(child => child.value === profile.name && child.innerText === profile.name);
				if (!option) {
					option = document.createElement("option");
					option.value = profile.name;
					option.innerText = profile.name;
				}
				profileSelector.append(option);
			});
			profileSelector.value = profileValue;
			return profile;
		}
		else {
			console.error("SpeedGraderPlus: no profile selector available");
			return DEFAULT_PROFILE;
		}
	}

	function applyStyles () {
		if (config.expandComments) {
			getStyles().textContent = EXPAND_COMMENTS_CSS;
		}
		else {
			getStyles().textContent = "";
		}
	}

	function unapplyStyles () {
		document.getElementById(STYLE_ID)?.remove();
	}

	function getStyles () {
		let style = document.getElementById(STYLE_ID);
		if (!style) {
			style = document.createElement("style");
			style.id = STYLE_ID;
			document.head.append(style);
		}
		return style;
	}

	function register () {
		console.log("SpeedGraderPlus: registering plug-in");
		document.getElementById("prev-student-button").addEventListener("click", startFindIframe);
		document.getElementById("next-student-button").addEventListener("click", startFindIframe);
		bindStudents();
		applyStyles();
	}

	function deregister () {
		console.log("SpeedGraderPlus: deregistering plug-in");
		document.getElementById("prev-student-button").removeEventListener("click", startFindIframe);
		document.getElementById("next-student-button").removeEventListener("click", startFindIframe);
		unbindStudents();
		unapplyStyles();
	}

	function initialize () {
		let url = new URL(document.location.href);
		if (url.hostname.endsWith("instructure.com") && url.pathname.endsWith("speed_grader")) {
			startFindIframe();
		}
		else {
			console.error("SpeedGraderPlus: unable to start: not on Canvas LMS SpeedGrader");
		}
	}

	// starting point
	initialize();

	return {
		version: VERSION,
		initialize: initialize,
		config: config
	};
})(sgpConfig);
