const pdf = require("pdf-parse");
const skillsList = require("../utils/skillDictionary");
const { extractSalary, escapeRegex } = require("../utils/regexUtils");

async function extractTextFromPDF(pdfBuffer) {
    const data = await pdf(pdfBuffer);
    return data.text;
}
function normalizeText(text) {
    return text
        .replace(/\s+/g, " ")
        .replace(/C\s*\+\s*\+/gi, "C++")
        .replace(/CI\s*\/\s*CD/gi, "CI/CD")
        .toLowerCase();
}

function extractSkills(text) {
    const foundSkills = [];
    const normalizedText = normalizeText(text);

    skillsList.forEach(skill => {
        const normalizedSkill = skill.toLowerCase();

    
        if (normalizedSkill.includes("+") || normalizedSkill.includes("#") || normalizedSkill.includes("/")) {
            if (normalizedText.includes(normalizedSkill)) {
                foundSkills.push(skill);
            }
        } else {
            const safeSkill = escapeRegex(normalizedSkill);
            const regex = new RegExp(`\\b${safeSkill}\\b`, "i");

            if (regex.test(normalizedText)) {
                foundSkills.push(skill);
            }
        }
    });

    return foundSkills;
}

function calculateExperience(text) {
    const explicitMatch = text.match(/(\d+(\.\d+)?)\s+years?/i);
    if (explicitMatch) {
        return parseFloat(explicitMatch[1]);
    }

    const dateMatch = text.match(
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s*[-–]\s*(Present|\w+\s+\d{4})/i
    );

    if (dateMatch) {
        const startYear = parseInt(dateMatch[2]);
        const currentYear = new Date().getFullYear();
        return currentYear - startYear;
    }

    return null;
}

async function parseResume(pdfBuffer) {
    const text = await extractTextFromPDF(pdfBuffer);

    const salary = extractSalary(text);
    const yearOfExperience = calculateExperience(text);
    const resumeSkills = extractSkills(text);

    return {
        salary,
        yearOfExperience,
        resumeSkills,
        resumeText: text
    };
}

module.exports = { parseResume };