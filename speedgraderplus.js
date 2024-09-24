// SpeedGraderPlus.js v2.0.0 (2023-12-07) - https://github.com/isaacchua/speedgraderplus
let sgpConfig = {
	assignments: [
		{
			assignmentId: 0, // the assignment id
			profiles: [
				{
					name: "Profile", // name of the profile
					enabled: true, // true to hide specified assignment parts, false to show everything
					hideQuestions: true, // hide all questions except specified question ids
					questionIds: [0], // the question ids to show; others will be hidden
					hideQuestionText: true, // hides the text of the question
					hideQuizComments: true // hides the quiz comments that follow the student's answers (not the comments panel)
				}
			]
		}
	],
};
globalThis.sgp = (function(config){
	const VERSION = "2.0.0";
	const BIND_STUDENTS_ATTEMPTS = 200;
	const DEFAULT_PROFILE = {
		name: "(none)",
		enabled: false,
		hideQuestions: false,
		questionIds: [],
		hideQuestionText: false,
		hideQuizComments: false
	};
	const HIDE_QUESTIONS_CSS = "div.display_question.question { display: none; } ";
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
				student.addEventListener("click", handleApplyEvent);
			}
		}
	}

	function getCurrentStudentId () {
		let avatar = document.getElementById("avatar");
		if (avatar == null) return null;
		let img = avatar.children[0];
		if (img == null) return null;
		let src = img.src;
		if (src == null) return null;
		let match = STUDENT_ID_RE.exec(src);
		if (match == null) return null;
		let id = Number.parseInt(match[1]);
		if (Number.isNaN(id)) return null;
		return id;
	}
	
	function handleApplyEvent () {
		find = true;
	}

	function findIframe () {
		try {
			if (find) {
				let iframe = document.getElementById("speedgrader_iframe");
				if (iframe !== null) {
					find = false;
					console.log("SpeedGraderPlus: speedgrader_iframe found");
					let iframeSrc = iframe.getAttribute("src");
					let assignment = config.assignments.find(assignment => iframeSrc.includes("assignments/" + assignment.assignmentId));
					if (assignment !== undefined) {
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
			applyStyles(doc, assignment);
		}
	}
	
	function applyStyles (doc, assignment) {
		let profile = getProfile(assignment);
		let css = "";

		if (profile.enabled) {
			// hide all question blocks
			if (profile.hideQuestions) {
				css += HIDE_QUESTIONS_CSS;
	
				// show all selected question blocks
				for (const questionId of profile.questionIds) {
					if (typeof questionId === "object") {
					}
					else {
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
		}
		else {
			css = "";
			console.log("SpeedGraderPlus: disabled, clearing styles");
		}

		getStyles(doc).textContent = css;

		console.log("SpeedGraderPlus: all done");
	}

	function getStyles (doc) {
		let style = doc.getElementById(STYLE_ID);
		if (style === null) {
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
			label.htmlFor = "profile";
			let select = document.createElement("select");
			select.id = "profile";
			select.style.padding = "0";
			select.style.margin = "0";
			select.style.height = "30px";
			select.style.width = "auto";
			div.append(label, " ", select);
			collection[0].prepend(div);
			select.addEventListener("change", handleApplyEvent);
			return select;
		}
		else {
			console.log("SpeedGraderPlus: unable to find header toolbar to add selector");
			return null;
		}
	}

	function getProfile (assignment) {
		if (assignment == null) {
			console.log("SpeedGraderPlus: assignment not provided for profile");
			return DEFAULT_PROFILE;
		}
		let profileSelector = document.getElementById("profile") ?? createProfileSelector();
		if (profileSelector === null) {
			console.log("SpeedGraderPlus: no profile selector available");
			return DEFAULT_PROFILE;
		}
		else {
			let profileValue = profileSelector.value;
			let profiles = assignment.profiles;
			if (!Array.isArray(profiles)) {
				console.log("SpeedGraderPlus: profiles not configured for assignment");
				profiles = [];
			}
			let profile = profiles.find(profile => profile.name === profileValue);
			if (profile === undefined) {
				console.log("SpeedGraderPlus: original profile not found");
				profile = DEFAULT_PROFILE;
				profileValue = "";
			}
			profileSelector.replaceChildren(defaultOption);
			profiles.forEach(profile => {
				let option = document.createElement("option");
				option.value = profile.name;
				option.innerText = profile.name;
				profileSelector.append(option);
			});
			profileSelector.value = profileValue;
			return profile;
		}
	}

	if (document.location.href.includes("speed_grader")) {
		createDefaultOption();
		console.log("SpeedGraderPlus: find iframe");
		document.getElementById("prev-student-button").addEventListener("click", handleApplyEvent);
		document.getElementById("next-student-button").addEventListener("click", handleApplyEvent);
		bindStudents();
		setTimeout(findIframe, 200);
	}

	return {
		version: VERSION,
		reapply: handleApplyEvent,
		config: sgpConfig
	};
})(sgpConfig);
