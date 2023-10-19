(function(){
	const BASE_CSS = "div.display_question.question { display: none; } ";
	const DATA = {
		assignmentId: 0,
		questionIds: [0]
	};
	var find = true;
	
	function bindStudents() {
		let students = document.querySelectorAll("ul#students_selectmenu-menu a");
		if (students.length === 0) {
			setTimeout(bindStudents, 100);
		}
		else {
			for (const student of students) {
				student.addEventListener("click", startFindSpeedGraderIframe);
			}
		}
	}
	
	function startFindSpeedGraderIframe() {
		find = true;
	}

	function findSpeedGraderIframe () {
		if (find) {
			let iframe = document.getElementById("speedgrader_iframe");
			if (iframe !== null) {
				find = false;
				console.log("SpeedGradePlus: speedgrader_iframe found");
				if (iframe.getAttribute("src").includes("assignments/" + DATA.assignmentId)) {
					console.log("SpeedGradePlus: assignment " + DATA.assignmentId + " found");
					iframe.contentWindow.addEventListener("load", loadSpeedGraderIframe);
				}
				else {
					console.warn("SpeedGradePlus: assignment " + DATA.assignmentId + " not found");
				}
			}
		}
	}
	
	function loadSpeedGraderIframe (event) {
		console.log("SpeedGradePlus: speedgrader_iframe Window.load detected");
		let iframeDoc = event.target;
		if (iframeDoc.location.href === "about:blank") {
			console.log("SpeedGradePlus: speedgrader_iframe is about:blank, ignoring");
		}
		else {
			console.log("SpeedGradePlus: speedgrader_iframe loaded: " + iframeDoc.location.href);
			processSpeedGraderIframe(iframeDoc);
		}
	}
	
	function processSpeedGraderIframe (iframeDoc) {
		console.log("SpeedGradePlus: applying styles");
		let style = iframeDoc.createElement("style");
		style.textContent = BASE_CSS;
		for (const questionId of DATA.questionIds) {
			style.textContent += "div#question_" + questionId + ", ";
		}
		style.textContent += ":not(*) { display: block; }";
		console.log("SpeedGradePlus: styles: " + style.textContent);
		iframeDoc.head.appendChild(style);
		console.log("SpeedGradePlus: all done");
	}

	if (document.location.href.includes("speed_grader")) {
		console.log("SpeedGraderPlus: find iframe");
		setInterval(findSpeedGraderIframe, 200);
		document.getElementById("prev-student-button").addEventListener("click", startFindSpeedGraderIframe);
		document.getElementById("next-student-button").addEventListener("click", startFindSpeedGraderIframe);
		bindStudents();
	}
})();
