function extractSalary(text) {
    const salaryRegex = /(\₹?\$?\d+[,\d]*\s?(LPA|per annum|per year|USD|PA|lakhs?))/gi;
    const matches = text.match(salaryRegex);

    if (!matches) return null;

    const validSalary = matches.find(s => {
        const number = parseInt(s.replace(/\D/g, ""));
        return number > 50000;
    });

    return validSalary || null;
}

function extractExperience(text) {
    const expRegex = /(\d+(\.\d+)?)\s+years?/i;
    const match = text.match(expRegex);
    return match ? parseFloat(match[1]) : null;
}

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
    extractSalary,
    extractExperience,
    escapeRegex
};