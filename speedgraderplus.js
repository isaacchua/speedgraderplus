let sgpConfig = {
    enabled: true,
    assignmentId: 0,
    questionIds: [0]
};
globalThis.sgp = (function(config){
	const VERSION = "1.1.0";
    const BIND_STUDENTS_ATTEMPTS = 200;
	const BASE_CSS = "div.display_question.question { display: none; } ";
    const STYLE_ID = "sgp_styles";
	var find = true;
	
	function bindStudents(attempts = 0) {
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
                    if (iframe.getAttribute("src").includes("assignments/" + config.assignmentId)) {
                        console.log("SpeedGraderPlus: assignment " + config.assignmentId + " found");
                        iframe.contentWindow.addEventListener("load", handleIframeLoadEvent); // listen regardless, because iframe might reload
                        if (iframe.contentDocument.readyState === "complete") { // iframe might already be loaded
                            checkValidIframe(iframe.contentDocument);
                        }
                    }
                    else {
                        console.warn("SpeedGraderPlus: assignment " + config.assignmentId + " not found");
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

    function handleIframeLoadEvent (event) {
		console.log("SpeedGraderPlus: speedgrader_iframe Window.load detected");
        checkValidIframe(event.target);
    }
	
	function checkValidIframe (doc) {
		if (doc.location.href === "about:blank") {
			console.log("SpeedGraderPlus: speedgrader_iframe is about:blank, ignoring");
		}
		else {
			console.log("SpeedGraderPlus: speedgrader_iframe loaded: " + doc.location.href);
			applyStyles(doc);
		}
	}
	
	function applyStyles (doc) {
        var css;

        if (config.enabled) {
            // hide all question blocks
            css = BASE_CSS;

            // show all selected question blocks
            for (const questionId of config.questionIds) {
                css += "div#question_" + questionId + ", ";
            }
            css += ":not(*) { display: block; }";

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

	if (document.location.href.includes("speed_grader")) {
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
