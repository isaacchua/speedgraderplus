// SpeedGraderPlus.js v2.2.0 (2023-12-11) - https://github.com/isaacchua/speedgraderplus
let sgpConfig = {
	enabled: true, // true enable SpeedGraderPlus; false to show everything
	expandComments: true, // true to expand comments box; false to leave unchanged
	assignments: [
		{
			assignmentId: 0, // the Assignment ID
			expandImages: true, // true to expand images in answers when clicked; false otherwise
			showQuestionIds: true, // true to append Question IDs to Question headers; false otherwise
			autosaveScores: true, // true to autosave scores after changing them; false otherwise
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
globalThis.sgp = (function(topWin, topDoc, config){
	const VERSION = "2.2.0";
	const ADD_STUDENT_LIST_ATTEMPTS = 20;
	const DEFAULT_PROFILE = {
		name: "(none)",
		hideQuestions: false,
		questionIds: [],
		hideQuestionText: false,
		hideQuizComments: false
	};
	const EXPAND_COMMENTS_CSS = "#speed_grader_comment_textarea_mount_point textarea { min-height: 25lh; } ";
	const FIND_IFRAME_ATTEMPTS = 300;
	const IFRAME_EXPAND_IMAGE_HANDLER = "expandImageHandler";
	const IFRAME_EXPAND_IMAGE_CSS = ".answers img:not([src]) { display: none; } ";
	const IFRAME_EXPAND_IMAGE_SELECTOR = ".answers img[src]";
	const IFRAME_HIDE_QUESTIONS_CSS = ".question { display: none; } ";
	const IFRAME_MODAL_ID = "sgp_modal";
	const IFRAME_MODAL_CSS = "#sgp_modal { display: none; position: fixed; z-index: 999999; left: 0; top: 0; width: 100%; height: 100%; margin: 0; padding: 0; overflow: auto; background-color: rgba(0,0,0,0.7) } ";
	const IFRAME_MODAL_IMG_CSS = "#sgp_modal img { display: block; width: 96%; max-width: none; margin: 2% auto; padding: 0; background-color: white; } ";
	const IFRAME_QUESTION_ID_SELECTOR_CLASS = "sgp_question_ids";
	const IFRAME_SHOW_HEADERS_CSS = ".question .header { display: block !important; } ";
	const IFRAME_STYLE_ID = "sgp_styles";
	const IFRAME_ZOOM_IMAGE_HANDLER = "zoomImageHandler";
	const PROFILE_SELECTOR_ID = "sgp_profiles";
	const PROFILE_SELECTOR_CSS = "#sgp_profiles { padding: 0; margin: 0; height: 30px; width: auto } ";
	const STUDENT_ID_FN_ODD = id => (id % 2) === 1;
	const STUDENT_ID_FN_EVEN = id => (id % 2) === 0;
	const STUDENT_ID_RE = /\/users\/(\d+)-/;
	const STYLE_ID = "sgp_top_styles";
	const SUBMIT_ATTEMPTS = 20;
	let find = false;
	let timeoutId;

	function doFindIframe (attempts = 0) {
		try {
			let iframe = topDoc.getElementById("speedgrader_iframe");
			if (iframe) {
				find = false;
				console.log("SpeedGraderPlus: speedgrader_iframe found");
				if (config && config.enabled && config.assignments) { // check if configuration exists / is enabled
					let iframeSrc = iframe.getAttribute("src");
					let assignment = config.assignments.find(assignment => iframeSrc.includes(`assignments/${assignment.assignmentId}/`));
					if (assignment) {
						console.log(`SpeedGraderPlus: assignment ${assignment.assignmentId} found`);
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
		setTimeout(doFindIframe, 1); // yield to let other parts of the document / iframe load
	}

	function findAssignment (iframe, attempts = 0) { // note: to be called moments after detecting that the iframe is going to load
		iframe ||= topDoc.getElementById("speedgrader_iframe");
		if (iframe.contentDocument?.sgp?.submitting) { // check if the iframe's form is submitted but not yet reloaded
			if (attempts < SUBMIT_ATTEMPTS) {
				setTimeout(findAssignment, 1000, iframe, attempts + 1);
			}
			return;
		}
		if (config && config.enabled && config.assignments) { // check if configuration exists / is enabled
			let iframeSrc = iframe.getAttribute("src");
			let assignment = config.assignments.find(assignment => iframeSrc.includes(`assignments/${assignment.assignmentId}/`));
			if (assignment) {
				console.log(`SpeedGraderPlus: assignment ${assignment.assignmentId} found`);
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

	function handleIframeLoadEvent (event, assignment) {
		console.log("SpeedGraderPlus: speedgrader_iframe Window.load detected");
		checkValidIframe(event.target, assignment);
	}
	
	function checkValidIframe (doc, assignment) {
		if (doc.location.href === "about:blank") {
			console.log("SpeedGraderPlus: speedgrader_iframe is about:blank, ignoring");
		}
		else {
			console.log(`SpeedGraderPlus: speedgrader_iframe loaded: ${doc.location.href}`);
			registerIframe(doc, assignment);
		}
	}

	function applyAutosaveScores (doc) {
		doc.sgp.scoreChangeHandler = event => handleScoreChange(event, doc.sgp.form);
		doc.querySelectorAll("input[id^='question_score_']").forEach(input => input.addEventListener("change", doc.sgp.scoreChangeHandler));
		console.log("SpeedGraderPlus: applied autosaveScores");
	}

	function unapplyAutosaveScores (doc) {
		doc.querySelectorAll("input[id^='question_score_']").forEach(input => input.removeEventListener("change", doc.sgp.scoreChangeHandler));
		console.log("SpeedGraderPlus: unapplied autosaveScores");
	}

	function handleScoreChange (event, form) {
		form.requestSubmit(); // will fire submit event
	}

	function applyExpandImages (doc) {
		// must add event listeners to doc or it will not work for the next student
		doc.sgp[IFRAME_EXPAND_IMAGE_HANDLER] = event => handleExpandImage(event);
		doc.sgp[IFRAME_ZOOM_IMAGE_HANDLER] = event => handleZoomImage(event);
		Array.from(doc.querySelectorAll(IFRAME_EXPAND_IMAGE_SELECTOR))
			.forEach(element => element.addEventListener("click", doc.sgp[IFRAME_EXPAND_IMAGE_HANDLER]));
		console.log("SpeedGraderPlus: applied expandImages");
	}

	function unapplyExpandImages (doc) {
		Array.from(doc.querySelectorAll(IFRAME_EXPAND_IMAGE_SELECTOR))
			.forEach(element => element.removeEventListener("click", doc.sgp[IFRAME_EXPAND_IMAGE_HANDLER]));
		delete doc.sgp[IFRAME_EXPAND_IMAGE_HANDLER];
		delete doc.sgp[IFRAME_ZOOM_IMAGE_HANDLER];
		doc.getElementById(IFRAME_MODAL_ID)?.remove();
		console.log("SpeedGraderPlus: unapplied expandImages");
	}

	function handleExpandImage (event) {
		console.log("SpeedGraderPlus: image clicked");
		let img = event.target.cloneNode();
		let modal = getIframeModal(event.view.document);
		img.removeAttribute("class");
		img.removeAttribute("style");
		img.addEventListener("click", event.view.document.sgp[IFRAME_ZOOM_IMAGE_HANDLER]);
		modal.replaceChildren(img);
		console.log(`SpeedGraderPlus: showing modal: ${modal}`);
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

	function applyShowQuestionIds(doc) {
		Array.from(doc.querySelectorAll(`.question:not(:has(.${IFRAME_QUESTION_ID_SELECTOR_CLASS}))`))
			.forEach(question => {
				let name = question.querySelector(".name");
				if (name) {
					let span = doc.createElement("span");
					span.className = IFRAME_QUESTION_ID_SELECTOR_CLASS;
					span.textContent = ` (${question.id.split("_")[1]})`;
					name.append(span);
				}
			})
		console.log("SpeedGraderPlus: applied showQuestionIds");
	}

	function unapplyShowQuestionIds(doc) {
		Array.from(doc.querySelectorAll(`.${IFRAME_QUESTION_ID_SELECTOR_CLASS}`)).forEach(element => element.remove());
		console.log("SpeedGraderPlus: unapplied showQuestionIds");
	}
	
	function applyIframeStyles (doc, assignment) {
		let profile = getProfile(assignment);
		let css = "";

		// hide blank images, which result from Canvas editor saving loading screens
		// these blank images could block functionality
		if (assignment.expandImages) {
			css += IFRAME_EXPAND_IMAGE_CSS;
			css += IFRAME_MODAL_CSS;
			css += IFRAME_MODAL_IMG_CSS;
		}

		// show headers if showing question ids
		if (assignment.showQuestionIds) {
			css += IFRAME_SHOW_HEADERS_CSS;
		}

		// hide all question blocks
		if (profile.hideQuestions) {
			css += IFRAME_HIDE_QUESTIONS_CSS;

			// get current student ID
			let studentId = getCurrentStudentId();
			console.log(`SpeedGraderPlus: current student ID: ${studentId}`);

			// show all selected question blocks
			for (const questionId of profile.questionIds) {
				if (typeof questionId === "object") {
					if (questionId && questionId.id) {
						let result = true;
						if (questionId.exists) {
							result &&= Boolean(doc.getElementById(`question_${questionId.exists}`));
						}
						if (questionId.studentIdFn) {
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
							css += `div#question_${questionId.id}, `;
						}
					}
				}
				else if (questionId) {
					css += `div#question_${questionId}, `;
				}
			}
			css = `${css.slice(0,-2)} { display: block; } `;
		}

		// hide question text
		if (profile.hideQuestionText) {
			css += "div.question_text { display: none; } ";
		}

		// hide quiz comments
		if (profile.hideQuizComments) {
			css += "div.quiz_comment { display: none; } ";
		}

		getIframeStyles(doc).textContent = css;

		console.log(`SpeedGraderPlus: applied styles: ${css}`);
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

	function handleSubmit (event, data) {
		data.submitting = true; // indicator to tell that the frame is still loading, though it's possible that submit is blocked thereafter
		topWin.setTimeout(findAssignment, 1000); // yield to let the iframe reload
	}

	function handleScoreEnter (event, data) {
		if (event.keyCode === 13) { // Canvas uses submit() instead of requestSubmit(), so we have to catch this event too
			handleSubmit(event, data);
		}
	}

	function registerIframe (doc, assignment) {
		let data = {}; // object in the iframe document to store SpeedGraderPlus data
		data.submitHandler = event => handleSubmit(event, data);
		data.form = doc.getElementById("update_history_form");
		data.form.addEventListener("submit", data.submitHandler);
		data.scoreEnterHandler = event => handleScoreEnter(event, data);
		doc.querySelectorAll("input[id^='question_score_']").forEach(input => input.addEventListener("keyup", data.scoreEnterHandler));
		doc.sgp = data;

		applyIframeStyles(doc, assignment); // handles styles for all submodules
		assignment.autosaveScores ? applyAutosaveScores(doc) : unapplyAutosaveScores(doc);
		assignment.expandImages ? applyExpandImages(doc) : unapplyExpandImages(doc);
		assignment.showQuestionIds ? applyShowQuestionIds(doc) : unapplyShowQuestionIds(doc);

		console.log("SpeedGraderPlus: iframe registered");
	}

	function deregisterIframe (doc) {
		doc.sgp.form.removeEventListener("submit", doc.sgp.submitHandler);
		doc.querySelectorAll("input[id^='question_score_']").forEach(input => input.removeEventListener("keyup", doc.sgp.scoreEnterHandler));

		unapplyAutosaveScores(doc);
		unapplyExpandImages(doc);
		unapplyShowQuestionIds(doc);
		unapplyIframeStyles(doc);

		delete doc.sgp;

		console.log("SpeedGraderPlus: iframe deregistered");
	}

	function getCurrentStudentId () {
		let src = topDoc.getElementById("avatar")?.children[0]?.src;
		if (!src) return null;
		let match = STUDENT_ID_RE.exec(src);
		if (!match) return null;
		let id = Number.parseInt(match[1]);
		if (Number.isNaN(id)) return null;
		return id;
	}
	
	function applyStudentListListeners (add, attempts = 0) {
		let students = topDoc.querySelectorAll("ul#students_selectmenu-menu a");
		if (students.length) {
			if (add) {
				students.forEach(student => student.addEventListener("click", startFindIframe));
			}
			else {
				students.forEach(student => student.removeEventListener("click", startFindIframe));
			}
		}
		else { // students not yet loaded
			if (attempts < ADD_STUDENT_LIST_ATTEMPTS) {
				setTimeout(applyStudentListListeners, 1000, add, attempts + 1);
			}
			else {
				console.warn("SpeedGraderPlus: max attempts reached: unable to find student list");
			}
		}
	}

	function applyStudentListeners () {
		topDoc.getElementById("prev-student-button")?.addEventListener("click", startFindIframe);
		topDoc.getElementById("next-student-button")?.addEventListener("click", startFindIframe);
		applyStudentListListeners(true);
		console.log("SpeedGraderPlus: applied student event listeners");
	}

	function unapplyStudentListeners () {
		topDoc.getElementById("prev-student-button")?.removeEventListener("click", startFindIframe);
		topDoc.getElementById("next-student-button")?.removeEventListener("click", startFindIframe);
		applyStudentListListeners(false);
		console.log("SpeedGraderPlus: unapplied student event listeners");
	}

	function createProfileSelector () {
		let collection = topDoc.getElementsByClassName("subheadContent--flex-end");
		if (collection.length > 0) {
			let div = topDoc.createElement("div");
			div.style.paddingRight = "12px";
			let label = topDoc.createElement("label");
			label.innerText = "Profile:";
			label.htmlFor = PROFILE_SELECTOR_ID;
			let select = topDoc.createElement("select");
			select.id = PROFILE_SELECTOR_ID;
			let option = topDoc.createElement("option"); // default option
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
		let profileSelector = topDoc.getElementById(PROFILE_SELECTOR_ID) ?? createProfileSelector();
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
					option = topDoc.createElement("option");
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
		let css = PROFILE_SELECTOR_CSS;
		if (config.expandComments) {
			css += EXPAND_COMMENTS_CSS;
		}
		getStyles().textContent = css;
	}

	function unapplyStyles () {
		topDoc.getElementById(STYLE_ID)?.remove();
	}

	function getStyles () {
		let style = topDoc.getElementById(STYLE_ID);
		if (!style) {
			style = topDoc.createElement("style");
			style.id = STYLE_ID;
			topDoc.head.append(style);
		}
		return style;
	}

	function register () {
		applyStyles();
		applyStudentListeners();
		console.log("SpeedGraderPlus: plug-in registered");
	}

	function deregister () {
		unapplyStudentListeners();
		unapplyStyles();
		console.log("SpeedGraderPlus: plug-in deregistered");
	}

	function initialize () {
		let url = new URL(topDoc.location.href);
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
})(globalThis, globalThis.document, sgpConfig);
