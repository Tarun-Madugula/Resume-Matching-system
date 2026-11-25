const fs = require("fs");

function parseJD(jobId, filePath) {
    const content = fs.readFileSync(filePath, "utf-8");

    const lines = content.split("\n");

    let role = "";
    let requiredSkills = [];
    let optionalSkills = [];
    let aboutRole = "";

    let currentSection = "";

    lines.forEach(line => {
        const trimmed = line.trim();

        if (trimmed.startsWith("Role:")) {
            role = trimmed.replace("Role:", "").trim();
        }

        else if (trimmed === "Required Skills:") {
            currentSection = "required";
        }

        else if (trimmed === "Optional Skills:") {
            currentSection = "optional";
        }

        else if (trimmed === "About Role:") {
            currentSection = "about";
        }

        else if (trimmed !== "") {
            if (currentSection === "required") {
                requiredSkills.push(trimmed);
            }
            else if (currentSection === "optional") {
                optionalSkills.push(trimmed);
            }
            else if (currentSection === "about") {
                aboutRole += trimmed + " ";
            }
        }
    });

    return {
        jobId,
        role,
        requiredSkills,
        optionalSkills,
        aboutRole: aboutRole.trim()
    };
}

module.exports = { parseJD };