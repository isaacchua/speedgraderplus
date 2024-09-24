// SpeedGraderPlus.js v2.1.0 (2023-12-09) - https://github.com/isaacchua/speedgraderplus
let sgpConfig = {
	enabled: true, // true enable SpeedGraderPlus, false to show everything
	assignments: [
		{
			assignmentId: 0, // the Assignment ID
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
	const VERSION = "2.1.0";
	const BIND_STUDENTS_ATTEMPTS = 200;
	const DEFAULT_PROFILE = {
		name: "(none)",
		hideQuestions: false,
		questionIds: [],
		hideQuestionText: false,
		hideQuizComments: false
	};
	const HIDE_QUESTIONS_CSS = "div.display_question.question { display: none; } ";
	const PROFILE_SELECTOR_ID = "sgp_profiles";
	const QUESTION_ID_SELECTOR_CLASS = "sgp_question_ids";
	const SHOW_HEADERS_CSS = "div.header { display: block !important; } ";
	const STUDENT_ID_FN_ODD = id => (id % 2) === 1;
	const STUDENT_ID_FN_EVEN = id => (id % 2) === 0;
	const STUDENT_ID_RE = /\/users\/(\d+)-/;
	const STYLE_ID = "sgp_styles";
	let defaultOption;
	let find = true;
	
	function bindStudents (attempts = 0) {
		let students = document.querySelectorAll("ul#students_selectmenu-menu a");
		if (students.length === 0) { // students not yet loaded
			if (attempts < BIND_STUDENTS_ATTEMPTS) {
				setTimeout(bindStudents, 100, attempts + 1);
			}
			else {
				console.warn("SpeedGraderPlus: max attempts reached: unable to find student list");
			}
		}
		else {
			for (const student of students) {
				student.addEventListener("click", refresh);
			}
		}
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
	
	function refresh () {
		find = true;
	}

	function findIframe () {
		try {
			if (find) {
				let iframe = document.getElementById("speedgrader_iframe");
				if (iframe) {
					find = false;
					console.log("SpeedGraderPlus: speedgrader_iframe found");
					if (config && config.enabled && config.assignments) { // check if configuration exists / is enabled
						let iframeSrc = iframe.getAttribute("src");
						let assignment = config.assignments.find(assignment => iframeSrc.includes("assignments/" + assignment.assignmentId));
						if (assignment) {
							console.log("SpeedGraderPlus: assignment " + assignment.assignmentId + " found");
							iframe.contentWindow.addEventListener("load", // listen regardless, because iframe might reload
								event => handleIframeLoadEvent(event, assignment)); // wrap the event handler to pass the assignment
							if (iframe.contentDocument.readyState === "complete") { // iframe might already be loaded
								checkValidIframe(iframe.contentDocument, assignment);
							}
						}
						else {
							console.warn("SpeedGraderPlus: no assignments found");
						}
					}
					else { // no configuration / not enabled
						console.log("SpeedGraderPlus: no config or not enabled");
						let doc = iframe.contentDocument;
						if (doc) {
							hideQuestionIds(doc);
							doc.getElementById(STYLE_ID)?.remove();
						}
					}
				}
			}
		}
		catch (error) {
			console.error("SpeedGraderPlus: error encountered");
			throw error;
		}
		finally {
			setTimeout(findIframe, 200); // ensure this always runs
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
			console.log("SpeedGraderPlus: speedgrader_iframe loaded: " + doc.location.href);
			showQuestionIds(doc, assignment);
			applyStyles(doc, assignment);
		}
	}

	function showQuestionIds(doc, assignment) {
		if (assignment.showQuestionIds) {
			if (!doc.querySelector("."+QUESTION_ID_SELECTOR_CLASS)) { // check that ids do not already exist
				console.log("SpeedGraderPlus: showing question ids");
				Array.from(doc.querySelectorAll(".question > .header:has(.name)"))
					.forEach(element => {
						let span = doc.createElement("span");
						span.className = QUESTION_ID_SELECTOR_CLASS;
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
		Array.from(doc.querySelectorAll("."+QUESTION_ID_SELECTOR_CLASS)).forEach(element => element.remove());
		console.log("SpeedGraderPlus: question ids removed");
	}
	
	function applyStyles (doc, assignment) {
		let profile = getProfile(assignment);
		let css = "";

		// show headers if showing question ids
		if (assignment.showQuestionIds) {
			css += SHOW_HEADERS_CSS;
		}

		// hide all question blocks
		if (profile.hideQuestions) {
			css += HIDE_QUESTIONS_CSS;

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

		getStyles(doc).textContent = css;

		console.log("SpeedGraderPlus: all done");
	}

	function getStyles (doc) {
		let style = doc.getElementById(STYLE_ID);
		if (!style) {
			style = doc.createElement("style");
			style.id = STYLE_ID;
			doc.head.appendChild(style);
		}
		return style;
	}

	function createDefaultOption () {
		defaultOption = document.createElement("option");
		defaultOption.value = "";
		defaultOption.innerText = "(none)";
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
			div.append(label, " ", select);
			collection[0].prepend(div);
			select.addEventListener("change", refresh);
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
			profileSelector.replaceChildren(defaultOption);
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

	if (document.location.href.includes("speed_grader")) {
		createDefaultOption();
		console.log("SpeedGraderPlus: find iframe");
		document.getElementById("prev-student-button").addEventListener("click", refresh);
		document.getElementById("next-student-button").addEventListener("click", refresh);
		bindStudents();
		setTimeout(findIframe, 200);
	}

	return {
		version: VERSION,
		reapply: refresh,
		config: sgpConfig
	};
})(sgpConfig);
